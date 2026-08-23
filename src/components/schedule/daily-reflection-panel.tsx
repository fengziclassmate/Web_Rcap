"use client";

import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ArrowUpRight, BookHeart, PenLine, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  logMoodOptions,
  moodLabel,
  type LogComposerInput,
  type LogMood,
  type LogPostRecord,
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

type ReflectionDay = {
  date: string;
  weekday: string;
  shortDate: string;
  isToday: boolean;
};

type DailyReflectionPanelProps = {
  days: ReflectionDay[];
  posts: LogPostRecord[];
  saving?: boolean;
  onCreatePost: (input: LogComposerInput) => Promise<boolean>;
  onOpenLogs: () => void;
};

function getPostDate(post: LogPostRecord) {
  return format(parseISO(post.createdAt), "yyyy-MM-dd");
}

function isDailyReflection(post: LogPostRecord) {
  return !post.isArchived && (post.category === "mood" || post.tags.some((tag) => tag.name === "每日记录"));
}

export function DailyReflectionPanel({
  days,
  posts,
  saving = false,
  onCreatePost,
  onOpenLogs,
}: DailyReflectionPanelProps) {
  const fallbackDate = days.find((day) => day.isToday)?.date ?? days[0]?.date ?? "";
  const [selectedDate, setSelectedDate] = useState(fallbackDate);
  const [mood, setMood] = useState<LogMood | "">("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!days.some((day) => day.date === selectedDate)) {
      setSelectedDate(fallbackDate);
      setMood("");
      setContent("");
    }
  }, [days, fallbackDate, selectedDate]);

  const postsByDate = useMemo(() => {
    const grouped = new Map<string, LogPostRecord[]>();
    posts
      .filter(isDailyReflection)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .forEach((post) => {
        const date = getPostDate(post);
        const dayPosts = grouped.get(date);
        if (dayPosts) dayPosts.push(post);
        else grouped.set(date, [post]);
      });
    return grouped;
  }, [posts]);

  const recordedDayCount = days.filter((day) => (postsByDate.get(day.date)?.length ?? 0) > 0).length;
  const selectedDay = days.find((day) => day.date === selectedDate);
  const canSubmit = Boolean(selectedDate && (mood || content.trim()));

  function selectDay(date: string) {
    setSelectedDate(date);
    setMood("");
    setContent("");
  }

  async function handleSubmit() {
    if (!canSubmit || submitting || saving) return;
    const normalizedContent = content.trim() || `当日心情：${moodLabel(mood as LogMood)}`;
    setSubmitting(true);
    try {
      const saved = await onCreatePost({
        content: normalizedContent,
        category: "mood",
        mood,
        recordDate: selectedDate,
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
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-stone-950">{days.length > 1 ? "本周日志" : "当日日志"}</h3>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                  已记录 {recordedDayCount}/{days.length} 天
                </span>
              </div>
              <p className="truncate text-[11px] text-stone-500">每天的心情和文字会同步到动态日志</p>
            </div>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={onOpenLogs}>
            打开动态日志
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </div>

        <div
          role="group"
          aria-label="选择日志日期"
          className={`mt-3 grid overflow-hidden rounded-xl border border-stone-200 bg-stone-200 shadow-inner ${days.length === 1 ? "grid-cols-1" : "grid-cols-7"}`}
        >
          {days.map((day) => {
            const dayPosts = postsByDate.get(day.date) ?? [];
            const latestPost = dayPosts[0];
            const selected = selectedDate === day.date;
            const statusLabel = latestPost ? `已记录 ${dayPosts.length} 条` : "尚未记录";
            return (
              <button
                key={day.date}
                type="button"
                aria-label={`${day.date} 日志：${statusLabel}`}
                aria-pressed={selected}
                disabled={submitting || saving}
                onClick={() => selectDay(day.date)}
                className={`group relative min-h-28 min-w-0 border-r border-stone-200 bg-white p-2.5 text-left transition last:border-r-0 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-700 disabled:cursor-wait disabled:opacity-70 ${
                  selected ? "z-[1] bg-emerald-50/80 ring-2 ring-inset ring-emerald-800" : "hover:bg-emerald-50/40"
                }`}
              >
                <span className="flex items-start justify-between gap-1">
                  <span>
                    <span className={`block text-xs font-semibold ${day.isToday ? "text-emerald-900" : "text-stone-800"}`}>
                      {day.weekday}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-stone-500">{day.shortDate}</span>
                  </span>
                  {day.isToday ? (
                    <span className="rounded bg-emerald-900 px-1.5 py-0.5 text-[9px] font-medium text-white">今天</span>
                  ) : null}
                </span>

                {latestPost ? (
                  <span className="mt-2 block">
                    <span className="flex items-center gap-1 text-[10px] font-medium text-stone-600">
                      {latestPost.mood ? <span aria-hidden>{moodEmoji[latestPost.mood]}</span> : null}
                      <span>{latestPost.mood ? moodLabel(latestPost.mood) : "日志"}</span>
                      {dayPosts.length > 1 ? <span className="ml-auto text-stone-400">+{dayPosts.length - 1}</span> : null}
                    </span>
                    <span className="mt-1 line-clamp-3 text-[11px] leading-4 text-stone-700">{latestPost.content}</span>
                  </span>
                ) : (
                  <span className="mt-3 flex items-center gap-1 text-[10px] text-stone-400 group-hover:text-emerald-700">
                    <PenLine className="h-3 w-3" aria-hidden />
                    点击记录
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {selectedDay ? (
          <div className="mt-3 grid gap-3 rounded-lg border border-stone-200 bg-stone-50/80 p-2.5 xl:grid-cols-[auto_minmax(12rem,1fr)_auto] xl:items-center">
            <div className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-[11px] font-medium text-stone-600">
                {selectedDay.weekday} {selectedDay.shortDate}
              </span>
              <div className="flex flex-wrap items-center gap-1" role="group" aria-label={`选择 ${selectedDate} 心情`}>
                {logMoodOptions.map((option) => {
                  const selected = mood === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-label={`心情：${option.label}`}
                      aria-pressed={selected}
                      disabled={submitting || saving}
                      title={option.label}
                      onClick={() => setMood((previous) => (previous === option.value ? "" : option.value))}
                      className={`grid h-7 w-7 place-items-center rounded-full border text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${
                        selected
                          ? "border-emerald-900 bg-emerald-950 shadow-sm"
                          : "border-stone-200 bg-white hover:border-emerald-300 hover:bg-emerald-50"
                      }`}
                    >
                      <span className={selected ? "scale-105" : ""} aria-hidden>{moodEmoji[option.value]}</span>
                    </button>
                  );
                })}
              </div>
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
              aria-label={`${selectedDate} 日志内容`}
              placeholder="写一句这一天的日志……"
              disabled={submitting || saving}
              className="h-8 border-stone-200 bg-white text-xs"
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
        ) : null}
      </div>
    </section>
  );
}
