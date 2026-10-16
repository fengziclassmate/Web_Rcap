"use client";

import { useCallback, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { createId } from "@/lib/id";
import { EMPTY_FOCUS, normalizeFocusState, pauseFocus, type FocusState, type FocusTarget } from "@/lib/execution-insights";

const changed = "workbench-focus-changed";
const cache = new Map<string, { raw: string | null; state: FocusState }>();
export const focusStorageKey = (userId: string) => `workbench-focus-v1:${userId}`;
export function readStoredFocusState(userId: string): FocusState | null {
  try { return localStorage.getItem(focusStorageKey(userId)) === null ? null : read(focusStorageKey(userId)); }
  catch { return null; }
}
export function hydrateFocusState(userId: string, state: FocusState) {
  const key = focusStorageKey(userId);
  const next = normalizeFocusState(state);
  const raw = JSON.stringify(next);
  if (JSON.stringify(read(key)) === raw) return;
  // Keep the cloud snapshot usable even if this browser cannot persist its cache.
  try { localStorage.setItem(key, raw); cache.set(key, { raw, state: next }); }
  catch {
    let previousRaw: string | null = null;
    try { previousRaw = localStorage.getItem(key); } catch { /* Storage may be disabled. */ }
    cache.set(key, { raw: previousRaw, state: next });
  }
  window.dispatchEvent(new Event(changed));
}
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
  const key = focusStorageKey(userId);
  const snapshot = useCallback(() => read(key), [key]);
  const state = useSyncExternalStore(subscribe, snapshot, () => EMPTY_FOCUS);
  function update(transform: (current: FocusState) => FocusState) {
    const current = read(key);
    const transformed = transform(current);
    if (transformed === current) return false;
    const next = normalizeFocusState(transformed);
    try {
      const raw = JSON.stringify(next);
      localStorage.setItem(key, raw);
      cache.set(key, { raw, state: next });
      window.dispatchEvent(new Event(changed));
      return true;
    } catch { toast.error("专注记录保存失败，请检查浏览器存储空间后重试"); return false; }
  }
  return {
    state,
    start: (target: FocusTarget) => update((current) => current.active ? current : { ...current, active: { ...target, runId: createId("focus-run"), startedAt: Date.now(), elapsedMs: 0 } }),
    pause: () => update((current) => pauseFocus(current, Date.now(), createId("focus"))),
    resume: () => update((current) => current.active && current.active.startedAt === null ? { ...current, active: { ...current.active, startedAt: Date.now() } } : current),
    finish: () => update((current) => ({ ...pauseFocus(current, Date.now(), createId("focus")), active: null })),
  };
}
