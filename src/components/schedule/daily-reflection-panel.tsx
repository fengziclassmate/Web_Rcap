"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, BookHeart, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  logMoodOptions,
  moodLabel,
  type LogComposerInput,
  type LogMood,
} from "@/lib/logs";

const moodEmoji: Record<LogMood, string> = {
  happy: "😊",
  calm: "🌿",
  tired: "🥱",
  anxious: "😟",
  stressed: "😵",
  sad: "😔",
  excited: "🤩",
  neutral: "😐",
};

type DailyReflectionPanelProps = {
  date: string;
  saving?: boolean;
  onCreatePost: (input: LogComposerInput) => Promise<boolean>;
  onOpenLogs: () => void;
};

export function DailyReflectionPanel({
  date,
  saving = false,
  onCreatePost,
  onOpenLogs,
}: DailyReflectionPanelProps) {
  const [mood, setMood] = useState<LogMood | "">("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [displayDate, setDisplayDate] = useState("");

  useEffect(() => {
    setDisplayDate(date);
  }, [date]);

  const canSubmit = Boolean(mood || content.trim());

  async function handleSubmit() {
    if (!canSubmit || submitting || saving) return;
    const normalizedContent = content.trim() || `今日心情：${moodLabel(mood as LogMood)}`;
    setSubmitting(true);
    try {
      const saved = await onCreatePost({
        content: normalizedContent,
        category: "mood",
        mood,
        location: "",
        tagNames: ["每日记录"],
        images: [],
        links: [],
      });
      if (!saved) return;
      setMood("");
      setContent("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="border-t border-stone-200 bg-[linear-gradient(120deg,rgba(236,253,245,0.72),rgba(255,251,235,0.64))] px-4 py-4 sm:px-6">
      <div className="rounded-xl border border-emerald-900/10 bg-white/85 p-3 shadow-[0_10px_30px_rgba(28,25,23,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-950 text-emerald-50">
              <BookHeart className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-stone-950">今日记录</h3>
              <p className="truncate text-[11px] text-stone-500">{displayDate ? `${displayDate} · ` : ""}心情和文字会同步到动态日志</p>
            </div>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={onOpenLogs}>
            打开动态日志
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </div>

        <div className="mt-3 grid gap-3 xl:grid-cols-[auto_minmax(12rem,1fr)_auto] xl:items-center">
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="选择今日心情">
            {logMoodOptions.map((option) => {
              const selected = mood === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-label={`心情：${option.label}`}
                  aria-pressed={selected}
                  title={option.label}
                  onClick={() => setMood((previous) => (previous === option.value ? "" : option.value))}
                  className={`grid h-8 w-8 place-items-center rounded-full border text-base transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${
                    selected
                      ? "border-emerald-900 bg-emerald-950 shadow-sm"
                      : "border-stone-200 bg-stone-50 hover:border-emerald-300 hover:bg-emerald-50"
                  }`}
                >
                  <span className={selected ? "scale-105" : ""} aria-hidden>{moodEmoji[option.value]}</span>
                </button>
              );
            })}
          </div>
          <Input
            value={content}
            onChange={(event) => setContent(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSubmit();
              }
            }}
            aria-label="今日日志"
            placeholder="写一句今天的日志……"
            className="h-9 border-stone-200 bg-white"
          />
          <Button
            type="button"
            size="sm"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit || submitting || saving}
            className="bg-emerald-950 text-white hover:bg-emerald-900"
          >
            <Send className="h-3.5 w-3.5" aria-hidden />
            {submitting || saving ? "写入中…" : "记入动态"}
          </Button>
        </div>
      </div>
    </section>
  );
}
