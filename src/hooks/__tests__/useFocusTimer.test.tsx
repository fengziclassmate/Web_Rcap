import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFocusTimer } from "../useFocusTimer";
import { elapsedFocusMs } from "@/lib/execution-insights";

beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 29, 10)); });
afterEach(() => vi.useRealTimers());
describe("persistent focus timer", () => {
  it("keeps a goal and run ID through pauses, and refuses to replace an active target", () => {
    const hook = renderHook(() => useFocusTimer("goal-owner"));
    let started = false;
    act(() => { started = hook.result.current.start({ id: "board:one", title: "指标整理", category: "城市用地诊断", goalMinutes: 25 }); });
    expect(started).toBe(true);
    const runId = hook.result.current.state.active!.runId;
    act(() => { vi.advanceTimersByTime(60000); hook.result.current.pause(); });
    expect(hook.result.current.state.sessions[0]).toMatchObject({ runId, goalMinutes: 25 });
    act(() => { hook.result.current.resume(); vi.advanceTimersByTime(60000); hook.result.current.finish(); });
    expect(hook.result.current.state.sessions[1].runId).toBe(runId);
    act(() => { hook.result.current.start({ id: "new", title: "下一次", category: "任务" }); });
    expect(hook.result.current.state.active!.runId).not.toBe(runId);
    let replaced = true;
    act(() => { replaced = hook.result.current.start({ id: "other", title: "不能覆盖", category: "任务" }); });
    expect(replaced).toBe(false);
    expect(hook.result.current.state.active!.id).toBe("new");
    hook.unmount();
  });

  it("reports failed storage without claiming a focus session started", () => {
    const hook = renderHook(() => useFocusTimer("quota-owner"));
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    let started = true;
    act(() => { started = hook.result.current.start({ id: "free", title: "自由专注", category: "自由专注", goalMinutes: 25 }); });
    expect(started).toBe(false);
    expect(hook.result.current.state.active).toBeNull();
    write.mockRestore();
    hook.unmount();
  });
  it("recovers after remount, records pauses once across subscribers, isolates accounts", () => {
    const first = renderHook(() => useFocusTimer("one"));
    act(() => first.result.current.start({ id: "task", title: "论文", category: "任务" }));
    act(() => vi.advanceTimersByTime(60000));
    first.unmount();
    const second = renderHook(() => useFocusTimer("one"));
    const third = renderHook(() => useFocusTimer("one"));
    expect(elapsedFocusMs(second.result.current.state, Date.now())).toBe(60000);
    act(() => { second.result.current.pause(); third.result.current.pause(); });
    expect(third.result.current.state.sessions).toHaveLength(1);
    act(() => vi.advanceTimersByTime(60000));
    expect(elapsedFocusMs(second.result.current.state, Date.now())).toBe(60000);
    const other = renderHook(() => useFocusTimer("two"));
    expect(other.result.current.state.active).toBeNull();
    act(() => second.result.current.finish());
    expect(third.result.current.state.active).toBeNull();
    expect(third.result.current.state.sessions).toHaveLength(1);
  });
});
