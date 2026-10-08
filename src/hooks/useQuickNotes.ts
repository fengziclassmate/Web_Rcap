"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { QuickNote } from "@/lib/types";
import { useAccountId } from "@/components/account-scope";
import { toast } from "sonner";

const STORAGE_KEY = "schedule-app-quick-notes";
const NOTES_CHANGE_EVENT = "schedule-app-quick-notes-change";
const EMPTY_NOTES: QuickNote[] = [];
const cache = new Map<string, { raw: string | null; notes: QuickNote[] }>();

function readNotes(key: string): QuickNote[] {
  if (typeof window === "undefined") return EMPTY_NOTES;
  try {
    const raw = localStorage.getItem(key);
    const cached = cache.get(key);
    if (cached?.raw === raw) return cached.notes;
    const parsed = raw ? JSON.parse(raw) : [];
    const notes = Array.isArray(parsed) ? parsed : EMPTY_NOTES;
    cache.set(key, { raw, notes });
    return notes;
  } catch {
    return EMPTY_NOTES;
  }
}

function subscribeToNotes(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(NOTES_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(NOTES_CHANGE_EVENT, onStoreChange);
  };
}

export function useQuickNotes() {
  const userId = useAccountId();
  const key = `${STORAGE_KEY}:${userId}`;
  const snapshot = useCallback(() => userId ? readNotes(key) : EMPTY_NOTES, [key, userId]);
  const notes = useSyncExternalStore(subscribeToNotes, snapshot, () => EMPTY_NOTES);

  const persist = useCallback((next: QuickNote[]) => {
    const sorted = [...next].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (!userId) return false;
    try {
      localStorage.setItem(key, JSON.stringify(sorted));
      window.dispatchEvent(new Event(NOTES_CHANGE_EVENT));
      return true;
    } catch {
      toast.error("速记保存失败，内容仍保留在输入框中");
      return false;
    }
  }, [key, userId]);

  const addNote = useCallback(
    (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;
      const now = new Date().toISOString();
      return persist([
        {
          id: `quick-note-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          content: trimmed,
          createdAt: now,
          updatedAt: now,
          source: "manual",
        },
        ...readNotes(key),
      ]);
    },
    [key, persist],
  );

  const deleteNote = useCallback(
    (id: string) => {
      persist(readNotes(key).filter((note) => note.id !== id));
    },
    [key, persist],
  );

  const clearNotes = useCallback(() => {
    persist([]);
  }, [persist]);

  return { notes, addNote, deleteNote, clearNotes };
}
