import { act, renderHook, waitFor } from "@testing-library/react";
import { useCallback, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useScheduleSync } from "../useScheduleSync";
import { getScheduleDraftKey, normalizePersistedSchedulePayload, readPendingScheduleDrafts, writePendingScheduleDraft, type PersistedSchedulePayload } from "@/lib/schedule-persistence";
import { createProjectBoard } from "@/lib/project-boards";
import { hydrateFocusState, useFocusTimer } from "../useFocusTimer";
import { elapsedFocusMs, focusHistory } from "@/lib/execution-insights";

type Row = PersistedSchedulePayload & { updated_at: string; user_id: string };
const remote = vi.hoisted(() => ({ row: null as Row | null, fail: false, failRead: false, writes: 0, race: false, missingBoards: false, missingFocus: false, jsonbOrder: false }));
vi.mock("@/lib/supabase", () => ({ supabase: { from: () => {
  let write: Row | undefined;
  let revision: string | undefined;
  let selection = "";
  const query = {
    select: (columns: string) => { selection = columns; return query; },
    eq: (key: string, value: string) => { if (key === "updated_at") revision = value; return query; },
    abortSignal: () => query,
    update: (value: Row) => { write = value; return query; },
    insert: (value: Row) => { write = value; return query; },
    maybeSingle: async () => {
      if (!write && remote.missingBoards && selection.includes("project_boards")) return { data: null, error: { message: "column schedule_data.project_boards does not exist" } };
      if (!write && remote.missingFocus && selection.includes("focus_state")) return { data: null, error: { message: "column schedule_data.focus_state does not exist" } };
      if (!write && remote.failRead) return { data: null, error: { message: "read failed" } };
      if (!write) {
        const data = structuredClone(remote.row);
        function reverseKeys(value: unknown): unknown {
          if (Array.isArray(value)) return value.map(reverseKeys);
          if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reverseKeys(item)]));
          return value;
        }
        if (data?.focus_state && remote.jsonbOrder) data.focus_state = reverseKeys(data.focus_state) as typeof data.focus_state;
        return { data, error: null };
      }
      remote.writes++;
      if (remote.fail) return { data: null, error: { message: "offline" } };
      if (remote.race && remote.row) {
        remote.race = false;
        remote.row = { ...remote.row, annual_tasks: [{ id: "other", name: "另一页面的目标", done: false }], updated_at: "2030-01-01T00:00:00Z" };
      }
      if (revision && remote.row?.updated_at !== revision) return { data: null, error: null };
      remote.row = structuredClone(write);
      return { data: { updated_at: write.updated_at }, error: null };
    },
  };
  return query;
} } }));

vi.mock("@/lib/schedule-lock", () => ({ withScheduleDraftLock: async (_owner: string, work: () => void) => work() }));

const empty = () => normalizePersistedSchedulePayload({})!;
function useWorkspace() {
  const [payload, setPayload] = useState(empty);
  const hydrate = useCallback((value: PersistedSchedulePayload) => setPayload(value), []);
  const sync = useScheduleSync("test-owner", payload, hydrate);
  return { ...sync, payload, remove: (id: string) => setPayload((prev) => ({ ...prev, annual_tasks: prev.annual_tasks.filter(item => item.id !== id) })), add: (id: string) => setPayload((prev) => ({ ...prev, annual_tasks: [...prev.annual_tasks, { id, name: id, done: false }] })) };
}
beforeEach(() => { localStorage.clear(); remote.row = null; remote.fail = false; remote.failRead = false; remote.writes = 0; remote.race = false; remote.missingBoards = false; remote.missingFocus = false; remote.jsonbOrder = false; });

describe("schedule persistence lifecycle", () => {
  it.each([false, true])("cleans zero-minute cloud events without user edits and preserves concurrent changes (race=%s)", async (race) => {
    const valid = normalizePersistedSchedulePayload({ events: [{ id: "valid", date: "2026-10-20", startHour: 9, endHour: 10, isCompleted: true }] })!.events[0];
    remote.row = { ...empty(), user_id: "test-owner", updated_at: "2026-01-01T00:00:00Z", events: [valid, {
      ...valid, id: "phantom", isCompleted: false, startHour: 20.416666666666664, endHour: 20.416666666666668,
    }] };
    remote.race = race;
    const hook = renderHook(useWorkspace);
    try {
      await waitFor(() => expect(hook.result.current.status).toBe("saved"));
      expect(hook.result.current.payload.events.map((event) => event.id)).toEqual(["valid"]);
      expect(remote.row?.events.map((event) => event.id)).toEqual(["valid"]);
      expect(remote.writes).toBe(race ? 2 : 1);
      if (race) expect(remote.row?.annual_tasks[0].id).toBe("other");
    } finally { hook.unmount(); }
  });

  function useSyncedFocus() {
    const focus = useFocusTimer("test-owner");
    const [payload, setPayload] = useState(empty);
    const hydrate = useCallback((value: PersistedSchedulePayload) => { setPayload(value); hydrateFocusState("test-owner", value.focus_state!); }, []);
    const sync = useScheduleSync("test-owner", { ...payload, focus_state: focus.state }, hydrate);
    return { focus, sync };
  }

  it("imports old local focus records once and merges them with cloud history", async () => {
    const session = { id: "old", title: "旧记录", category: "科研", startedAt: 1000, endedAt: 61000, sessionId: "legacy" };
    localStorage.setItem("workbench-focus-v1:test-owner", JSON.stringify({ active: null, sessions: [session] }));
    remote.row = { ...empty(), focus_state: { active: null, sessions: [{ ...session, sessionId: "cloud", startedAt: 100000, endedAt: 160000 }] }, user_id: "test-owner", updated_at: "2026-01-01T00:00:00Z" };
    const hook = renderHook(useSyncedFocus);
    await waitFor(() => expect(hook.result.current.sync.status).toBe("saved"));
    expect(remote.row.focus_state?.sessions).toHaveLength(2);
    await act(async () => { await hook.result.current.sync.retry(); });
    expect(remote.row.focus_state?.sessions).toHaveLength(2);
    hook.unmount();
  });

  it("continues saving timer actions when JSONB returns object keys in a different order", async () => {
    remote.jsonbOrder = true;
    const hook = renderHook(useSyncedFocus);
    await waitFor(() => expect(hook.result.current.sync.status).toBe("saved"));
    act(() => { hook.result.current.focus.start({ id: "task", title: "JSONB 计时", category: "科研", goalMinutes: 25 }); });
    await waitFor(() => expect(remote.row?.focus_state?.active?.id).toBe("task"));
    await waitFor(() => expect(hook.result.current.sync.status).toBe("saved"));
    act(() => { hook.result.current.focus.pause(); });
    await waitFor(() => expect(remote.row?.focus_state?.active?.startedAt).toBeNull());
    await waitFor(() => expect(hook.result.current.sync.status).toBe("saved"));
    act(() => { hook.result.current.focus.resume(); });
    await waitFor(() => expect(remote.row?.focus_state?.active?.startedAt).not.toBeNull());
    await waitFor(() => expect(hook.result.current.sync.status).toBe("saved"));
    act(() => { hook.result.current.focus.finish(); });
    await waitFor(() => expect(remote.row?.focus_state?.active).toBeNull());
    expect(focusHistory(remote.row!.focus_state!.sessions)).toHaveLength(1);
    hook.unmount();
  });

  it("restores a running cloud timer on another computer and syncs pause, resume and finish", async () => {
    const startedAt = Date.now() - 60000;
    remote.row = { ...empty(), focus_state: { active: { id: "task", title: "跨电脑专注", category: "科研", runId: "cloud-run", goalMinutes: 25, startedAt, elapsedMs: 0 }, sessions: [] }, user_id: "test-owner", updated_at: "2026-01-01T00:00:00Z" };
    const first = renderHook(useSyncedFocus);
    await waitFor(() => expect(first.result.current.sync.status).toBe("saved"));
    expect(elapsedFocusMs(first.result.current.focus.state, Date.now())).toBeGreaterThanOrEqual(60000);
    act(() => { first.result.current.focus.pause(); });
    await waitFor(() => expect(remote.row?.focus_state?.active?.startedAt).toBeNull());
    await waitFor(() => expect(first.result.current.sync.status).toBe("saved"));
    first.unmount();
    localStorage.clear();
    const second = renderHook(useSyncedFocus);
    await waitFor(() => expect(second.result.current.sync.status).toBe("saved"));
    expect(second.result.current.focus.state.active).toMatchObject({ runId: "cloud-run", goalMinutes: 25, startedAt: null });
    act(() => { second.result.current.focus.resume(); });
    await waitFor(() => expect(remote.row?.focus_state?.active?.startedAt).not.toBeNull());
    act(() => { second.result.current.focus.finish(); });
    await waitFor(() => expect(remote.row?.focus_state?.active).toBeNull());
    expect(focusHistory(remote.row.focus_state!.sessions)).toHaveLength(1);
    second.unmount();
  });

  it("fetches a timer stopped elsewhere on window focus instead of restarting a stale timer", async () => {
    remote.row = { ...empty(), focus_state: { active: { id: "task", title: "跨电脑专注", category: "科研", runId: "run", startedAt: 1000, elapsedMs: 0 }, sessions: [] }, user_id: "test-owner", updated_at: "2026-01-01T00:00:00Z" };
    const hook = renderHook(useSyncedFocus);
    await waitFor(() => expect(hook.result.current.sync.status).toBe("saved"));
    remote.row.focus_state = { active: null, sessions: [] };
    remote.row.updated_at = "2026-02-01T00:00:00Z";
    act(() => { window.dispatchEvent(new Event("focus")); });
    await waitFor(() => expect(hook.result.current.focus.state.active).toBeNull());
    expect(remote.row.focus_state.active).toBeNull();
    hook.unmount();
  });

  it("retains local focus edits before the database migration and uploads them after retry", async () => {
    remote.missingFocus = true;
    const hook = renderHook(useSyncedFocus);
    await waitFor(() => expect(hook.result.current.sync.status).toBe("saved"));
    act(() => { hook.result.current.focus.start({ id: "task", title: "保留计时", category: "任务" }); });
    await waitFor(() => expect(hook.result.current.sync.status).toBe("error"));
    expect(hook.result.current.focus.state.active?.title).toBe("保留计时");
    expect(readPendingScheduleDrafts("test-owner")[0].payload.focus_state?.active?.title).toBe("保留计时");
    remote.missingFocus = false;
    await act(async () => { await hook.result.current.sync.retry(); });
    expect(hook.result.current.sync.status).toBe("saved");
    expect(remote.row?.focus_state?.active?.title).toBe("保留计时");
    hook.unmount();
  });

  it.each(["local", "remote"] as const)("keeps the losing device's work when resolving concurrent timers in favour of %s", async (prefer) => {
    remote.row = { ...empty(), user_id: "test-owner", updated_at: "2026-01-01T00:00:00Z" };
    const hook = renderHook(useSyncedFocus);
    await waitFor(() => expect(hook.result.current.sync.status).toBe("saved"));
    act(() => { hook.result.current.focus.start({ id: "local", title: "本机工作", category: "科研" }); });
    remote.row.focus_state = { active: { id: "remote", title: "另一台的工作", category: "学习", runId: "remote-run", startedAt: Date.now() - 60000, elapsedMs: 0 }, sessions: [] };
    remote.row.updated_at = "2026-02-01T00:00:00Z";
    await waitFor(() => expect(hook.result.current.sync.status).toBe("conflict"));
    act(() => { hook.result.current.sync.resolve(prefer); });
    await waitFor(() => expect(hook.result.current.sync.status).toBe("saved"));
    expect(hook.result.current.focus.state.active?.id).toBe(prefer === "remote" ? "remote" : "local");
    expect(remote.row.focus_state?.sessions.some((session) => session.id === (prefer === "remote" ? "local" : "remote"))).toBe(true);
    act(() => { hook.result.current.focus.pause(); });
    await waitFor(() => expect(remote.row?.focus_state?.active?.startedAt).toBeNull());
    await waitFor(() => expect(hook.result.current.sync.status).toBe("saved"));
    hook.unmount();
  });

  it("polls another device's clock change even while this page remains in front", async () => {
    vi.useFakeTimers();
    const hook = renderHook(useSyncedFocus);
    try {
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      expect(hook.result.current.sync.status).toBe("saved");
      remote.row = { ...empty(), focus_state: { active: { id: "remote", title: "远端专注", category: "科研", runId: "run", startedAt: Date.now(), elapsedMs: 0 }, sessions: [] }, user_id: "test-owner", updated_at: "2030-01-01T00:00:00Z" };
      await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
      expect(hook.result.current.focus.state.active?.id).toBe("remote");
    } finally { hook.unmount(); vi.useRealTimers(); }
  });
  it("keeps legacy schedules usable before migration and syncs retained board drafts afterwards", async () => {
    remote.missingBoards = true;
    const board = createProjectBoard("research", "城市用地诊断");
    function useBoards() {
      const [payload, setPayload] = useState(empty);
      const hydrate = useCallback((value: PersistedSchedulePayload) => setPayload(value), []);
      return { ...useScheduleSync("test-owner", payload, hydrate), payload, edit: () => setPayload((previous) => ({ ...previous, project_boards: [board], annual_tasks: [{ id: "goal", name: "目标", done: false }] })) };
    }
    const hook = renderHook(useBoards);
    await waitFor(() => expect(hook.result.current.status).toBe("saved"));
    act(() => hook.result.current.edit());
    await waitFor(() => expect(hook.result.current.status).toBe("error"));
    expect(hook.result.current.ready).toBe(true);
    expect(hook.result.current.message).toContain("迁移");
    expect(remote.row?.annual_tasks[0].id).toBe("goal");
    expect(remote.row?.project_boards).toBeUndefined();
    expect(readPendingScheduleDrafts("test-owner")[0].payload.project_boards).toEqual([board]);
    remote.missingBoards = false;
    await act(async () => { await hook.result.current.retry(); });
    expect(hook.result.current.status).toBe("saved");
    expect(remote.row?.project_boards).toEqual([board]);
    expect(readPendingScheduleDrafts("test-owner")).toHaveLength(0);
    hook.unmount();
  });
  it("does not resurrect an inherited offline addition deleted after reload", async () => {
    remote.row = { ...empty(), user_id: "test-owner", updated_at: "2026-01-01T00:00:00Z" };
    const first = renderHook(useWorkspace);
    await waitFor(() => expect(first.result.current.status).toBe("saved"));
    remote.failRead = true;
    act(() => first.result.current.add("removed-after-reload"));
    await waitFor(() => expect(first.result.current.status).toBe("error"));
    first.unmount();
    const second = renderHook(useWorkspace);
    await waitFor(() => expect(second.result.current.status).toBe("error"));
    expect(readPendingScheduleDrafts("test-owner")).toHaveLength(1);
    act(() => second.result.current.remove("removed-after-reload"));
    remote.failRead = false;
    await act(async () => { await second.result.current.retry(); });
    expect(remote.row.annual_tasks).toEqual([]);
    expect(second.result.current.status).toBe("saved");
    second.unmount();
  });
  it("preserves only new edits from an active tab whose draft was inherited", async () => {
    remote.row = { ...empty(), user_id: "test-owner", updated_at: "2026-01-01T00:00:00Z" };
    const first = renderHook(useWorkspace);
    await waitFor(() => expect(first.result.current.status).toBe("saved"));
    remote.failRead = true;
    act(() => first.result.current.add("inherited"));
    await waitFor(() => expect(first.result.current.status).toBe("error"));
    const second = renderHook(useWorkspace);
    await waitFor(() => expect(second.result.current.status).toBe("error"));
    act(() => second.result.current.remove("inherited"));
    act(() => first.result.current.add("new-edit"));
    remote.failRead = false;
    await act(async () => { await second.result.current.retry(); });
    expect(remote.row.annual_tasks.map(item => item.id)).toEqual(["new-edit"]);
    first.unmount(); second.unmount();
  });

  it("recovers pending drafts from a closed page and acknowledges only the recovered contents", async () => {
    const base = empty();
    remote.row = { ...base, user_id: "test-owner", updated_at: "2026-01-01T00:00:00Z" };
    writePendingScheduleDraft(getScheduleDraftKey("test-owner", "closed-page"), { ...base, annual_tasks: [{ id: "recovered", name: "离线草稿", done: false }] }, base);
    const hook = renderHook(useWorkspace);
    await waitFor(() => expect(hook.result.current.status).toBe("saved"));
    expect(remote.row.annual_tasks[0].id).toBe("recovered");
    expect(readPendingScheduleDrafts("test-owner")).toHaveLength(0);
    hook.unmount();
  });
  it("does not create an empty pending draft when the initial remote read fails", async () => {
    remote.failRead = true;
    const hook = renderHook(useWorkspace);
    await waitFor(() => expect(hook.result.current.status).toBe("error"));
    expect(remote.writes).toBe(0);
    expect(readPendingScheduleDrafts("test-owner")).toHaveLength(0);
    hook.unmount();
  });
  it("creates the first remote row and continues saving edits after acknowledgement", async () => {
    const hook = renderHook(useWorkspace);
    await waitFor(() => expect(hook.result.current.status).toBe("saved"));
    act(() => hook.result.current.add("first"));
    await waitFor(() => expect(remote.row?.annual_tasks).toHaveLength(1));
    await waitFor(() => expect(hook.result.current.status).toBe("saved"));
    act(() => hook.result.current.add("second"));
    await waitFor(() => expect(remote.row?.annual_tasks).toHaveLength(2));
    hook.unmount();
  });
  it("retains a failed write across a reload and retries against the latest remote data", async () => {
    remote.row = { ...empty(), user_id: "test-owner", updated_at: "2026-01-01T00:00:00Z" };
    const first = renderHook(useWorkspace);
    await waitFor(() => expect(first.result.current.status).toBe("saved"));
    remote.fail = true;
    act(() => first.result.current.add("offline-draft"));
    await waitFor(() => expect(first.result.current.status).toBe("error"));
    first.unmount();
    const second = renderHook(useWorkspace);
    await waitFor(() => expect(second.result.current.payload.annual_tasks[0]?.name).toBe("offline-draft"));
    await waitFor(() => expect(second.result.current.status).toBe("error"));
    remote.fail = false;
    await act(async () => { await second.result.current.retry(); });
    expect(remote.row.annual_tasks[0].id).toBe("offline-draft");
    second.unmount();
  });
  it("re-reads and merges when another page wins the conditional write", async () => {
    remote.row = { ...empty(), user_id: "test-owner", updated_at: "2026-01-01T00:00:00Z" };
    const hook = renderHook(useWorkspace);
    await waitFor(() => expect(hook.result.current.status).toBe("saved"));
    remote.race = true;
    act(() => hook.result.current.add("mine"));
    await waitFor(() => expect(remote.row?.annual_tasks.map((item) => item.id)).toEqual(expect.arrayContaining(["mine", "other"])));
    expect(remote.writes).toBe(2);
    hook.unmount();
  });
});
