"use client";

import { useState } from "react";
import { Lightbulb, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useQuickNotes } from "@/hooks/useQuickNotes";

export function QuickNoteFab() {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const { addNote } = useQuickNotes();

  function save() {
    if (!content.trim()) return;
    addNote(content);
    setContent("");
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        className="fixed bottom-6 left-6 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-amber-200 bg-amber-100 text-amber-900 shadow-lg transition hover:scale-105"
        onClick={() => setOpen(true)}
        aria-label="打开速记"
      >
        <Lightbulb className="h-5 w-5" />
      </button>
      {open ? (
        <div className="fixed bottom-24 left-6 z-50 w-[min(360px,calc(100vw-3rem))] rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">速记 / 脑洞捕获</h3>
            <Button type="button" size="icon-sm" variant="ghost" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="输入速记"
            className="min-h-28"
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) save();
            }}
          />
          <div className="mt-3 flex justify-end">
            <Button type="button" onClick={save} disabled={!content.trim()}>
              保存速记
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function QuickNotesPanel() {
  const { notes, deleteNote, clearNotes } = useQuickNotes();
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">速记</h2>
        </div>
        {notes.length > 0 ? (
          <Button type="button" size="sm" variant="ghost" onClick={clearNotes}>
            清空
          </Button>
        ) : null}
      </div>
      <div className="space-y-2">
        {notes.length === 0 ? <p className="text-sm text-gray-500">暂无速记。</p> : null}
        {notes.map((note) => (
          <div key={note.id} className="group rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="whitespace-pre-wrap text-sm text-gray-800">{note.content}</p>
              <button
                type="button"
                className="opacity-0 transition group-hover:opacity-100"
                onClick={() => deleteNote(note.id)}
              >
                <Trash2 className="h-4 w-4 text-gray-500" />
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-400">{new Date(note.createdAt).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
