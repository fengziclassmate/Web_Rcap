"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { readStoredFocusState } from "./useFocusTimer";
import { mergeFocusSessions, pauseFocus } from "@/lib/execution-insights";
import { createId } from "@/lib/id";
import { mergeScheduleChanges } from "@/lib/schedule-merge";
import { withScheduleDraftLock } from "@/lib/schedule-lock";
import { clearAcknowledgedScheduleDraft, getScheduleBackupStorageKey, getScheduleDraftKey, normalizePersistedSchedulePayload, readPendingScheduleDrafts, readScheduleSyncBackup, writePendingScheduleDraft, writeScheduleBackupToLocal, type PersistedSchedulePayload } from "@/lib/schedule-persistence";

export type ScheduleSyncStatus = "loading" | "saved" | "pending" | "saving" | "offline" | "error" | "conflict";
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const empty = () => normalizePersistedSchedulePayload({})!;
const legacyColumns = "events,tasks,annual_tasks,shopping_items,project_checkins,footprints,ui_preferences,achievements,updated_at";
const columns = `${legacyColumns},project_boards,focus_state`;
type SyncView = { owner: string | null; ready: boolean; status: ScheduleSyncStatus; message: string };
type Controls = {
  owner: string;
  update: (payload: PersistedSchedulePayload) => void;
  retry: () => Promise<void>;
  resolve: (prefer: "local" | "remote") => void;
};

/** Local drafts survive refresh; remote writes compare the revision read before merging. */
export function useScheduleSync(userId: string | null, payload: PersistedSchedulePayload, hydrate: (payload: PersistedSchedulePayload, externalChange: boolean) => void) {
  const [view, setView] = useState<SyncView>({ owner: null, ready: false, status: "loading", message: "" });
  const controls = useRef<Controls | null>(null);

  useEffect(() => {
    if (!userId) { controls.current = null; return; }
    const owner = userId;
    const draftKey = getScheduleDraftKey(owner, crypto.randomUUID());
    let backup = readScheduleSyncBackup(owner);
    let inheritedDraft: ReturnType<typeof readPendingScheduleDrafts>[number] | undefined;
    let lastDraft: { raw: string; payload: PersistedSchedulePayload } | undefined;
    let base = backup ? backup.base : empty();
    let desired = backup?.payload ?? empty();
    let lastObserved: PersistedSchedulePayload | null = null;
    let expectedHydration: string | null = null;
    let disposed = false;
    let started = false;
    let running: Promise<void> | null = null;
    let dirty = backup?.pending ?? false;
    let conflict = false;
    let focusConflict = false;
    let ready = Boolean(backup);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let remoteRevision: string | null | undefined;
    const controller = new AbortController();

    function show(status: ScheduleSyncStatus, message = "") {
      ready = started && (ready || status !== "saving");
      if (!disposed) setView({ owner, ready, status, message });
    }
    function apply(value: PersistedSchedulePayload) {
      desired = value;
      expectedHydration = equal(value, lastObserved) ? null : JSON.stringify(value);
      if (expectedHydration !== null) hydrate(value, !equal({ ...normalizePersistedSchedulePayload(lastObserved), focus_state: undefined }, { ...value, focus_state: undefined }));
    }
    function recognizeDraftHandoff() {
      if (!lastDraft) return;
      try {
        if (localStorage.getItem(draftKey) === lastDraft.raw) return;
        // A successor or another syncing tab has taken responsibility for this snapshot.
        // Only subsequent edits belong to this tab; replaying the old base resurrects deletions.
        base = lastDraft.payload;
        dirty = !equal(desired, base);
        lastDraft = undefined;
      } catch { /* preserve reports unavailable storage. */ }
    }
    function preserve() {
      recognizeDraftHandoff();
      const draftOk = !dirty || writePendingScheduleDraft(draftKey, desired, base);
      if (dirty && draftOk) lastDraft = { raw: JSON.stringify({ payload: desired, base }), payload: desired };
      const ok = writeScheduleBackupToLocal(owner, desired, { base, pending: dirty, ...(dirty ? { draftKey } : {}) });
      if (ok && draftOk && inheritedDraft) {
        clearAcknowledgedScheduleDraft(inheritedDraft.key, inheritedDraft.raw);
        inheritedDraft = undefined;
      }
      if (!ok || !draftOk) show("error", "浏览器存储空间不足，本机备份失败。请保持页面打开并重试同步。");
      return ok && draftOk;
    }
    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(() => { void run(); }, 400);
    }

    async function synchronize(prefer?: "local" | "remote"): Promise<boolean> {
      recognizeDraftHandoff();
      show("saving");
      try {
        for (let attempt = 0; attempt < 4 && !disposed; attempt++) {
          const read = (selection: string) => supabase.from("schedule_data").select(selection).eq("user_id", owner).abortSignal(AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)])).maybeSingle<Partial<PersistedSchedulePayload> & { updated_at: string }>();
          let result = await read(columns);
          const unavailable = new Set<"project_boards" | "focus_state">();
          // A code deployment may precede its database migration. Keep the existing
          // workbench usable and retain unsynced project data in the normal draft.
          for (let fallback = 0; fallback < 2; fallback++) {
            const missing = (["project_boards", "focus_state"] as const).find((column) => !unavailable.has(column) && result.error?.message.includes(column) && (result.error.message.includes("column") || result.error.message.includes("schema cache")));
            if (!missing) break;
            unavailable.add(missing);
            result = await read(columns.split(",").filter((column) => !unavailable.has(column as "project_boards" | "focus_state")).join(","));
          }
          if (disposed) return false;
          if (result.error) throw new Error(result.error.message);
          recognizeDraftHandoff();
          const remote = normalizePersistedSchedulePayload(result.data) ?? empty();
          let acknowledgedRevision = result.data?.updated_at ?? null;
          if (unavailable.has("project_boards")) remote.project_boards = base?.project_boards ?? [];
          if (unavailable.has("focus_state")) remote.focus_state = base?.focus_state ?? empty().focus_state;
          const otherDrafts = readPendingScheduleDrafts(owner).filter((draft) => draft.key !== draftKey);
          let incoming = remote;
          const draftConflicts: string[] = [];
          for (const draft of otherDrafts) {
            if (draft.base === undefined && result.data && !equal(draft.payload, incoming)) {
              draftConflicts.push("旧版本未同步草稿");
              if (prefer !== "remote") incoming = draft.payload;
              continue;
            }
            const combined = mergeScheduleChanges(draft.base ?? empty(), draft.payload, incoming, prefer);
            incoming = combined.value;
            draftConflicts.push(...combined.conflicts);
          }
          if (prefer === "local" && focusConflict && incoming.focus_state?.active && !equal(incoming.focus_state.active, desired.focus_state?.active)) {
            const paused = pauseFocus(incoming.focus_state, Date.now(), createId("focus"));
            incoming = { ...incoming, focus_state: { ...incoming.focus_state, sessions: mergeFocusSessions(paused.sessions) } };
          }
          const local = desired;
          let merged: PersistedSchedulePayload;
          let conflicts: string[];
          if (base === undefined && result.data && !equal(local, incoming)) {
            merged = prefer === "remote" ? incoming : local;
            conflicts = ["旧版本本机备份与云端记录不同"];
          } else {
            ({ value: merged, conflicts } = mergeScheduleChanges(base ?? empty(), local, incoming, prefer));
          }
          conflicts.push(...draftConflicts);
          if (conflicts.length && !prefer) {
            conflict = true;
            focusConflict = conflicts.includes("schedule.focus_state.active");
            dirty = true;
            preserve();
            show("conflict", base === undefined ? "旧版本本机备份与云端不同，请选择保留本机或云端版本。" : `发现 ${conflicts.length} 处不同修改，请选择保留哪一方的冲突内容。其他修改会合并。`);
            return false;
          }
          if (!equal(merged, remote) || (!result.data && dirty)) {
            const updatedAt = new Date(Math.max(Date.now(), Date.parse(result.data?.updated_at ?? "") + 1 || 0)).toISOString();
            const write = { ...merged, user_id: owner, updated_at: updatedAt };
            for (const column of unavailable) delete write[column];
            const saved = result.data
              ? await supabase.from("schedule_data").update(write).eq("user_id", owner).eq("updated_at", result.data.updated_at).select("updated_at").abortSignal(AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)])).maybeSingle()
              : await supabase.from("schedule_data").insert(write).select("updated_at").abortSignal(AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)])).maybeSingle();
            if (disposed) return false;
            if (saved.error?.code === "23505" || (!saved.error && !saved.data)) continue;
            if (saved.error) throw new Error(saved.error.message);
            acknowledgedRevision = saved.data?.updated_at ?? updatedAt;
          }
          // A user may continue typing while the request is in flight.
          const next = mergeScheduleChanges(local, desired, merged).value;
          base = { ...merged,
            ...(unavailable.has("project_boards") ? { project_boards: base?.project_boards ?? [] } : {}),
            ...(unavailable.has("focus_state") ? { focus_state: base?.focus_state ?? empty().focus_state } : {}),
          };
          dirty = !equal(next, base);
          conflict = false;
          focusConflict = false;
          remoteRevision = acknowledgedRevision;
          apply(next);
          for (const draft of otherDrafts) clearAcknowledgedScheduleDraft(draft.key, draft.raw);
          if (!dirty) { clearAcknowledgedScheduleDraft(draftKey); lastDraft = undefined; }
          if (preserve()) {
            if (unavailable.size && dirty) {
              show("error", `${unavailable.has("focus_state") ? "专注记录" : "科研与自学项目"}已保存在本机，云端同步需要执行数据库迁移。其他日程修改已同步；迁移后点击重试。`);
              return false;
            }
            show(dirty ? "pending" : "saved");
          }
          return true;
        }
        if (!disposed) throw new Error("其他页面正在同时修改记录，请稍后重试。");
      } catch (error) {
        if (disposed) return false;
        if (dirty && !preserve()) return false;
        const message = error instanceof Error ? error.message : "网络请求失败";
        show(navigator.onLine ? "error" : "offline", message.includes("column") || message.includes("schema cache")
          ? "云端数据库需要更新。本机修改已保留，请完成数据库迁移后重试。"
          : "暂未同步到云端。本机修改已保留，联网后自动重试，也可手动重试。");
      }
      return false;
    }
    function run(prefer?: "local" | "remote"): Promise<void> {
      if (disposed || !started) return Promise.resolve();
      if (running) return running;
      clearTimeout(timer);
      let successful = false;
      running = synchronize(prefer).then((result) => { successful = result; }).finally(() => {
        running = null;
        // Only newly edited data schedules another pass; failures wait for retry/online.
        if (!disposed && successful && dirty && !conflict) schedule();
      });
      return running;
    }

    const api: Controls = {
      owner,
      update(value) {
        if (!started) return;
        lastObserved = value;
        if (expectedHydration !== null) {
          if (JSON.stringify(value) !== expectedHydration) return;
          expectedHydration = null;
        }
        if (equal(value, desired)) return;
        recognizeDraftHandoff();
        desired = value;
        dirty = true;
        const backedUp = preserve();
        if (!conflict) { if (backedUp) show("pending"); schedule(); }
      },
      retry: () => run(),
      resolve: (prefer) => {
        if (prefer === "remote" && focusConflict && desired.focus_state?.active) {
          apply({ ...desired, focus_state: pauseFocus(desired.focus_state, Date.now(), createId("focus")) });
          dirty = true; preserve();
        }
        void run(prefer);
      },
    };
    controls.current = api;
    function start() {
      if (disposed) return;
      // Re-read inside the lock: two newly opened pages must not inherit the same ancestor.
      backup = readScheduleSyncBackup(owner);
      base = backup ? backup.base : empty();
      const cached = backup?.payload ?? empty();
      desired = { ...cached, focus_state: readStoredFocusState(owner) ?? cached.focus_state };
      dirty = (backup?.pending ?? false) || !equal(desired, cached);
      inheritedDraft = dirty ? readPendingScheduleDrafts(owner).find((draft) =>
        (!backup?.draftKey || draft.key === backup.draftKey) && equal(draft.payload, desired) && equal(draft.base, base)) : undefined;
      started = true;
      apply(desired);
      if (backup) show(dirty ? "pending" : "loading");
      if (dirty) preserve();
      void run();
    }
    const online = () => { void run(); };
    let lastPoll = 0;
    const poll = window.setInterval(() => {
      if (document.visibilityState === "hidden" || !navigator.onLine || conflict || running || disposed || !started) return;
      if (Date.now() - lastPoll < (desired.focus_state?.active ? 10_000 : 30_000)) return;
      lastPoll = Date.now();
      if (dirty) { void run(); return; }
      // Check only the revision while idle; download the full workspace only after a remote edit.
      void supabase.from("schedule_data").select("updated_at").eq("user_id", owner)
        .abortSignal(AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]))
        .maybeSingle<{ updated_at: string }>().then((result) => {
          if (!disposed && !result.error && (result.data?.updated_at ?? null) !== remoteRevision) void run();
        }, () => { /* Poll again when the connection recovers. */ });
    }, 10_000);
    const visibility = () => { if (document.visibilityState === "visible") void run(); };
    const offline = () => { if (dirty) show("offline", "修改已保存在本机，联网后自动同步。"); };
    const storage = (event: StorageEvent) => {
      if (event.key !== getScheduleBackupStorageKey(owner) || conflict || !event.newValue) return;
      try {
        // Pending edits live in independent drafts; only acknowledgements trigger peers.
        const incoming = JSON.parse(event.newValue);
        if (incoming._sync?.pending === false && !equal(normalizePersistedSchedulePayload(incoming), desired)) void run();
      } catch { /* Ignore unrelated or partially written storage events. */ }
    };
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    window.addEventListener("focus", online);
    window.addEventListener("storage", storage);
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("visibilitychange", visibility);
    void withScheduleDraftLock(owner, start).catch(() => {
      show("error", "无法协调本机草稿，请启用浏览器存储或关闭其他工作台标签页后刷新。");
    });
    return () => {
      disposed = true;
      controller.abort();
      clearTimeout(timer);
      window.clearInterval(poll);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      window.removeEventListener("focus", online);
      window.removeEventListener("storage", storage);
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("visibilitychange", visibility);
      if (controls.current === api) controls.current = null;
    };
  }, [userId, hydrate]);

  useEffect(() => { if (controls.current?.owner === userId) controls.current.update(payload); }, [payload, userId]);

  return {
    ready: Boolean(userId) && view.owner === userId && view.ready,
    status: view.owner === userId ? view.status : "loading" as ScheduleSyncStatus,
    message: view.owner === userId ? view.message : "",
    retry: () => controls.current?.retry(),
    resolve: (prefer: "local" | "remote") => controls.current?.resolve(prefer),
  };
}
