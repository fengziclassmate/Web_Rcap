"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { QuickNote } from "@/lib/types";

const STORAGE_KEY = "schedule-app-quick-notes";
const NOTES_CHANGE_EVENT = "schedule-app-quick-notes-change";
const EMPTY_NOTES: QuickNote[] = [];
let cachedRaw: string | null | undefined;
let cachedNotes = EMPTY_NOTES;

function readNotes(): QuickNote[] {
  if (typeof window === "undefined") return EMPTY_NOTES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === cachedRaw) return cachedNotes;
    cachedRaw = raw;
    const parsed = raw ? JSON.parse(raw) : [];
    cachedNotes = Array.isArray(parsed) ? parsed : EMPTY_NOTES;
    return cachedNotes;
  } catch {
    return EMPTY_NOTES;
  }
}

function writeNotes(notes: QuickNote[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  window.dispatchEvent(new Event(NOTES_CHANGE_EVENT));
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
  const notes = useSyncExternalStore(subscribeToNotes, readNotes, () => EMPTY_NOTES);

  const persist = useCallback((next: QuickNote[]) => {
    const sorted = [...next].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    writeNotes(sorted);
  }, []);

  const addNote = useCallback(
    (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;
      const now = new Date().toISOString();
      persist([
        {
          id: `quick-note-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          content: trimmed,
          createdAt: now,
          updatedAt: now,
          source: "manual",
        },
        ...notes,
      ]);
    },
    [notes, persist],
  );

  const deleteNote = useCallback(
    (id: string) => {
      persist(notes.filter((note) => note.id !== id));
    },
    [notes, persist],
  );

  const clearNotes = useCallback(() => {
    persist([]);
  }, [persist]);

  return { notes, addNote, deleteNote, clearNotes };
}
