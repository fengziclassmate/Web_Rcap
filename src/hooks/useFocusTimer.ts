"use client";

import { useCallback, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { createId } from "@/lib/id";
import { EMPTY_FOCUS, normalizeFocusState, pauseFocus, type FocusState, type FocusTarget } from "@/lib/execution-insights";

const changed = "workbench-focus-changed";
const cache = new Map<string, { raw: string | null; state: FocusState }>();
function read(key: string) {
  try {
    const raw = localStorage.getItem(key);
    const existing = cache.get(key);
    if (existing?.raw === raw) return existing.state;
    const state = normalizeFocusState(raw ? JSON.parse(raw) : null);
    cache.set(key, { raw, state });
    return state;
  } catch { return cache.get(key)?.state ?? EMPTY_FOCUS; }
}
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(changed, callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener(changed, callback); };
}

export function useFocusTimer(userId: string) {
  const key = `workbench-focus-v1:${userId}`;
  const snapshot = useCallback(() => read(key), [key]);
  const state = useSyncExternalStore(subscribe, snapshot, () => EMPTY_FOCUS);
  function update(transform: (current: FocusState) => FocusState) {
    const next = transform(read(key));
    try {
      const raw = JSON.stringify(next);
      localStorage.setItem(key, raw);
      cache.set(key, { raw, state: next });
      window.dispatchEvent(new Event(changed));
    } catch { toast.error("专注记录保存失败，请检查浏览器存储空间后重试"); }
  }
  return {
    state,
    start: (target: FocusTarget) => update((current) => current.active ? current : { ...current, active: { ...target, startedAt: Date.now(), elapsedMs: 0 } }),
    pause: () => update((current) => pauseFocus(current, Date.now(), createId("focus"))),
    resume: () => update((current) => current.active && current.active.startedAt === null ? { ...current, active: { ...current.active, startedAt: Date.now() } } : current),
    finish: () => update((current) => ({ ...pauseFocus(current, Date.now(), createId("focus")), active: null })),
  };
}
