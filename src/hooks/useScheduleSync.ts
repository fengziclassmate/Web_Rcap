"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { mergeScheduleChanges } from "@/lib/schedule-merge";
import { withScheduleDraftLock } from "@/lib/schedule-lock";
import { clearAcknowledgedScheduleDraft, getScheduleBackupStorageKey, getScheduleDraftKey, normalizePersistedSchedulePayload, readPendingScheduleDrafts, readScheduleSyncBackup, writePendingScheduleDraft, writeScheduleBackupToLocal, type PersistedSchedulePayload } from "@/lib/schedule-persistence";

export type ScheduleSyncStatus = "loading" | "saved" | "pending" | "saving" | "offline" | "error" | "conflict";
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const empty = () => normalizePersistedSchedulePayload({})!;
const columns = "events,tasks,annual_tasks,shopping_items,project_checkins,footprints,ui_preferences,achievements,updated_at";
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
    let ready = Boolean(backup);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();

    function show(status: ScheduleSyncStatus, message = "") {
      ready = started && (ready || status !== "saving");
      if (!disposed) setView({ owner, ready, status, message });
    }
    function apply(value: PersistedSchedulePayload) {
      desired = value;
      expectedHydration = equal(value, lastObserved) ? null : JSON.stringify(value);
      if (expectedHydration !== null) hydrate(value, !equal(normalizePersistedSchedulePayload(lastObserved), normalizePersistedSchedulePayload(value)));
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
          const result = await supabase.from("schedule_data").select(columns).eq("user_id", owner).abortSignal(AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)])).maybeSingle();
          if (disposed) return false;
          if (result.error) throw new Error(result.error.message);
          recognizeDraftHandoff();
          const remote = normalizePersistedSchedulePayload(result.data) ?? empty();
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
            dirty = true;
            preserve();
            show("conflict", base === undefined ? "旧版本本机备份与云端不同，请选择保留本机或云端版本。" : `发现 ${conflicts.length} 处不同修改，请选择保留哪一方的冲突内容。其他修改会合并。`);
            return false;
          }
          if (!equal(merged, remote) || (!result.data && dirty)) {
            const updatedAt = new Date(Math.max(Date.now(), Date.parse(result.data?.updated_at ?? "") + 1 || 0)).toISOString();
            const write = { ...merged, user_id: owner, updated_at: updatedAt };
            const saved = result.data
              ? await supabase.from("schedule_data").update(write).eq("user_id", owner).eq("updated_at", result.data.updated_at).select("updated_at").abortSignal(AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)])).maybeSingle()
              : await supabase.from("schedule_data").insert(write).select("updated_at").abortSignal(AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)])).maybeSingle();
            if (disposed) return false;
            if (saved.error?.code === "23505" || (!saved.error && !saved.data)) continue;
            if (saved.error) throw new Error(saved.error.message);
          }
          // A user may continue typing while the request is in flight.
          const next = mergeScheduleChanges(local, desired, merged).value;
          base = merged;
          dirty = !equal(next, merged);
          conflict = false;
          apply(next);
          for (const draft of otherDrafts) clearAcknowledgedScheduleDraft(draft.key, draft.raw);
          if (!dirty) { clearAcknowledgedScheduleDraft(draftKey); lastDraft = undefined; }
          if (preserve()) show(dirty ? "pending" : "saved");
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
      resolve: (prefer) => { void run(prefer); },
    };
    controls.current = api;
    function start() {
      if (disposed) return;
      // Re-read inside the lock: two newly opened pages must not inherit the same ancestor.
      backup = readScheduleSyncBackup(owner);
      base = backup ? backup.base : empty();
      desired = backup?.payload ?? empty();
      dirty = backup?.pending ?? false;
      inheritedDraft = dirty ? readPendingScheduleDrafts(owner).find((draft) =>
        (!backup?.draftKey || draft.key === backup.draftKey) && equal(draft.payload, desired) && equal(draft.base, base)) : undefined;
      started = true;
      apply(desired);
      if (backup) show(dirty ? "pending" : "loading");
      if (dirty) preserve();
      void run();
    }
    const online = () => { void run(); };
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
    void withScheduleDraftLock(owner, start).catch(() => {
      show("error", "无法协调本机草稿，请启用浏览器存储或关闭其他工作台标签页后刷新。");
    });
    return () => {
      disposed = true;
      controller.abort();
      clearTimeout(timer);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      window.removeEventListener("focus", online);
      window.removeEventListener("storage", storage);
      window.removeEventListener("beforeunload", beforeUnload);
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
