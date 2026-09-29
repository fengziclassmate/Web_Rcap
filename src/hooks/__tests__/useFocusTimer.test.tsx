import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFocusTimer } from "../useFocusTimer";
import { elapsedFocusMs } from "@/lib/execution-insights";

beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 29, 10)); });
afterEach(() => vi.useRealTimers());
describe("persistent focus timer", () => {
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
