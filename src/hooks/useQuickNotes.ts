"use client";

import { useCallback, useEffect, useState } from "react";
import type { QuickNote } from "@/lib/types";

const STORAGE_KEY = "schedule-app-quick-notes";

function readNotes(): QuickNote[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeNotes(notes: QuickNote[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

export function useQuickNotes() {
  const [notes, setNotes] = useState<QuickNote[]>([]);

  useEffect(() => {
    setNotes(readNotes());
  }, []);

  const persist = useCallback((next: QuickNote[]) => {
    const sorted = [...next].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    setNotes(sorted);
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
