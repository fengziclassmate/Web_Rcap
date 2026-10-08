"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/** One render is one transaction, including linked task/event and bulk mutations. */
export function useUndoHistory<T extends Record<string, unknown>>(value: T, restore: (value: T) => void, scope: string | null) {
  const history = useRef<{ scope: string | null; current: T; past: T[]; future: T[] }>({ scope: null, current: value, past: [], future: [] });
  const [availability, setAvailability] = useState({ undo: false, redo: false });
  const restoreRef = useRef(restore);
  useLayoutEffect(() => {
    restoreRef.current = restore;
    const state = history.current;
    if (!scope || scope !== state.scope) {
      history.current = { scope, current: value, past: [], future: [] };
    } else if (JSON.stringify(value) !== JSON.stringify(state.current)) {
      state.past = [...state.past.slice(-29), state.current];
      state.current = value;
      state.future = [];
    }
    const next = history.current;
    // History is external to React state; only expose its button availability.
    setAvailability((previous) => previous.undo === !!next.past.length && previous.redo === !!next.future.length
      ? previous : { undo: !!next.past.length, redo: !!next.future.length });
  }, [value, scope, restore]);

  const move = useCallback((direction: "undo" | "redo") => {
    const state = history.current;
    if (!state.scope) return;
    const source = direction === "undo" ? state.past : state.future;
    const target = source.pop();
    if (!target) return;
    (direction === "undo" ? state.future : state.past).push(state.current);
    state.current = target;
    restoreRef.current(target);
    setAvailability({ undo: !!state.past.length, redo: !!state.future.length });
  }, []);

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      if (event.key.toLowerCase() === "z") { event.preventDefault(); move(event.shiftKey ? "redo" : "undo"); }
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [move]);
  return { canUndo: availability.undo, canRedo: availability.redo, undo: () => move("undo"), redo: () => move("redo") };
}
