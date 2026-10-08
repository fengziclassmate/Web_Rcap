import { useCallback, useMemo, useState } from "react";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useUndoHistory } from "../useUndoHistory";

function useFixture(scope: string | null) {
  const [tasks, setTasks] = useState(["task"]);
  const [events, setEvents] = useState(["linked event"]);
  const snapshot = useMemo(() => ({ tasks, events }), [tasks, events]);
  const restore = useCallback((value: typeof snapshot) => { setTasks(value.tasks); setEvents(value.events); }, []);
  return { ...useUndoHistory(snapshot, restore, scope), tasks, events, setTasks, setEvents };
}
describe("undo transactions", () => {
  it("restores both sides of a linked mutation, supports redo, clears redo on new edits", () => {
    const { result } = renderHook(() => useFixture("account"));
    act(() => { result.current.setTasks([]); result.current.setEvents([]); });
    expect(result.current.canUndo).toBe(true);
    act(() => result.current.undo());
    expect(result.current.tasks).toEqual(["task"]);
    expect(result.current.events).toEqual(["linked event"]);
    act(() => result.current.redo());
    expect(result.current.tasks).toEqual([]);
    act(() => result.current.undo());
    act(() => result.current.setTasks(["another"]));
    expect(result.current.canRedo).toBe(false);
  });
  it("does not record initial hydration and resets on account changes", () => {
    const { result, rerender } = renderHook(({ scope }) => useFixture(scope), { initialProps: { scope: null as string | null } });
    act(() => result.current.setTasks(["loaded"]));
    rerender({ scope: "account" });
    expect(result.current.canUndo).toBe(false);
    act(() => result.current.setTasks([]));
    rerender({ scope: "other-account" });
    expect(result.current.canUndo).toBe(false);
  });
  it("does not turn an identical cloud acknowledgement into an undo step", () => {
    const { result } = renderHook(() => useFixture("account"));
    act(() => result.current.setTasks(["edited"]));
    act(() => result.current.setTasks(["edited"]));
    act(() => result.current.undo());
    expect(result.current.tasks).toEqual(["task"]);
    expect(result.current.canUndo).toBe(false);
  });
  it("preserves native text undo", () => {
    const { result } = renderHook(() => useFixture("account"));
    act(() => result.current.setTasks([]));
    const input = document.createElement("input"); document.body.append(input);
    act(() => input.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true })));
    expect(result.current.tasks).toEqual([]);
    input.remove();
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true })));
    expect(result.current.tasks).toEqual(["task"]);
  });
});
