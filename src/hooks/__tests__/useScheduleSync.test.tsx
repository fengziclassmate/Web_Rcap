import { act, renderHook, waitFor } from "@testing-library/react";
import { useCallback, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useScheduleSync } from "../useScheduleSync";
import { getScheduleDraftKey, normalizePersistedSchedulePayload, readPendingScheduleDrafts, writePendingScheduleDraft, type PersistedSchedulePayload } from "@/lib/schedule-persistence";

type Row = PersistedSchedulePayload & { updated_at: string; user_id: string };
const remote = vi.hoisted(() => ({ row: null as Row | null, fail: false, failRead: false, writes: 0, race: false }));
vi.mock("@/lib/supabase", () => ({ supabase: { from: () => {
  let write: Row | undefined;
  let revision: string | undefined;
  const query = {
    select: () => query,
    eq: (key: string, value: string) => { if (key === "updated_at") revision = value; return query; },
    abortSignal: () => query,
    update: (value: Row) => { write = value; return query; },
    insert: (value: Row) => { write = value; return query; },
    maybeSingle: async () => {
      if (!write && remote.failRead) return { data: null, error: { message: "read failed" } };
      if (!write) return { data: structuredClone(remote.row), error: null };
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
beforeEach(() => { localStorage.clear(); remote.row = null; remote.fail = false; remote.failRead = false; remote.writes = 0; remote.race = false; });

describe("schedule persistence lifecycle", () => {
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
