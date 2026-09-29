"use client";

import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  ArrowUpRight,
  ChevronDown,
  FlaskConical,
  Heart,
  NotebookPen,
  PenLine,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  getDailyLogKind,
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

const reflectionPanelOpenStorageKey = "schedule-reflection-panel-open-v1";

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
  const [moodOpen, setMoodOpen] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [customExpression, setCustomExpression] = useState(false);
  const imagePreviews = useMemo(() => images.map((file) => URL.createObjectURL(file)), [images]);
  useEffect(() => () => imagePreviews.forEach((url) => URL.revokeObjectURL(url)), [imagePreviews]);
  function addImages(files: FileList | null, expression = false) {
    const valid = Array.from(files ?? []).filter((file) => file.type.startsWith("image/") && file.size <= 10 * 1024 * 1024);
    if (valid.length !== (files?.length ?? 0)) toast.error("请选择不超过10MB的图片");
    if (valid.length + images.length > 9) toast.info("每条日志最多保存9张图片");
    if (expression && valid[0]) { setImages((previous) => [valid[0], ...previous].slice(0, 9)); setCustomExpression(true); }
    else setImages((previous) => [...previous, ...valid].slice(0, 9));
  }
  const [submitting, setSubmitting] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [panelPreferenceReady, setPanelPreferenceReady] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(reflectionPanelOpenStorageKey);
      setPanelOpen(stored !== "closed");
    } catch {
      setPanelOpen(true);
    } finally {
      setPanelPreferenceReady(true);
    }
  }, []);

  useEffect(() => {
    if (!panelPreferenceReady) return;
    try {
      window.localStorage.setItem(reflectionPanelOpenStorageKey, panelOpen ? "open" : "closed");
    } catch {
      // localStorage may be unavailable in private browsing mode.
    }
  }, [panelOpen, panelPreferenceReady]);

  useEffect(() => {
    if (!days.some((day) => day.date === selectedDate)) {
      setSelectedDate(fallbackDate);
      setImages([]);
      setCustomExpression(false);
      setMood("");
      setContent("");
    }
  }, [days, fallbackDate, selectedDate]);

  const postsByDate = useMemo(() => {
    const grouped = new Map<string, LogPostRecord[]>();
    posts
      .filter((post) => getDailyLogKind(post) !== null)
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
  const canSubmit = Boolean(selectedDate && (mood || content.trim() || images.length));
  const panelTitle = days.length > 1 ? "本周日志" : "当日日志";

  function selectDay(date: string) {
    setImages([]);
    setCustomExpression(false);
    setSelectedDate(date);
    setMood("");
    setContent("");
  }

  async function handleSubmit() {
    if (!canSubmit || submitting || saving) return;
    const normalizedContent = content.trim() || (mood ? `当日心情：${moodLabel(mood as LogMood)}` : customExpression ? "今日表情" : "图片日志");
    setSubmitting(true);
    try {
      const saved = await onCreatePost({
        content: normalizedContent,
        category: "life",
        mood,
        recordDate: selectedDate,
        location: "",
        tagNames: ["每日记录", "生活日志", ...(customExpression ? ["自定义表情"] : [])],
        images,
        links: [],
      });
      if (!saved) return;
      setImages([]);
      setCustomExpression(false);
      setMoodOpen(false);
      setMood("");
      setContent("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="border-t border-gray-200 bg-stone-50/80 px-4 py-3 sm:px-6">
      <Collapsible open={panelOpen} onOpenChange={setPanelOpen}>
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <NotebookPen className="h-4 w-4 shrink-0 text-stone-700" aria-hidden />
              <h3 className="text-sm font-semibold text-stone-950">{panelTitle}</h3>
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                已记录 {recordedDayCount}/{days.length} 天
              </span>
              <span className="hidden items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-700 lg:flex">
                <Heart className="h-3 w-3" aria-hidden />
                生活日志
              </span>
              <span className="hidden items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-800 lg:flex">
                <FlaskConical className="h-3 w-3" aria-hidden />
                科研日志
              </span>
              <CollapsibleTrigger
                className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-lg text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
                aria-label={panelOpen ? `折叠${panelTitle}` : `展开${panelTitle}`}
              >
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${panelOpen ? "" : "-rotate-90"}`}
                  aria-hidden
                />
              </CollapsibleTrigger>
            </div>
            <Button type="button" size="sm" variant="ghost" onClick={onOpenLogs}>
              打开动态日志
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </div>

          <CollapsibleContent>
            <div
              role="group"
              aria-label="选择日志日期"
              className={`mt-3 grid overflow-hidden rounded-xl border border-stone-200 bg-stone-200 shadow-inner ${days.length === 1 ? "grid-cols-1" : "grid-cols-7"}`}
            >
          {days.map((day) => {
            const dayPosts = postsByDate.get(day.date) ?? [];
            const latestLifePost = dayPosts.find((post) => getDailyLogKind(post) === "life");
            const latestResearchPost = dayPosts.find((post) => getDailyLogKind(post) === "research");
            const visiblePostCount = Number(Boolean(latestLifePost)) + Number(Boolean(latestResearchPost));
            const hiddenPostCount = dayPosts.length - visiblePostCount;
            const selected = selectedDate === day.date;
            const statusLabel = dayPosts.length > 0 ? `已记录 ${dayPosts.length} 条` : "尚未记录";
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

                {latestLifePost || latestResearchPost ? (
                  <span className="mt-2 grid gap-1.5">
                    {latestLifePost ? (
                      <span className="block min-w-0 rounded-md bg-rose-50/80 px-1.5 py-1">
                        <span className="flex items-center gap-1 text-[9px] font-semibold text-rose-700">
                          {latestLifePost.mood ? <span aria-hidden>{moodEmoji[latestLifePost.mood]}</span> : <Heart className="h-2.5 w-2.5" aria-hidden />}
                          生活
                        </span>
                        <span className="mt-0.5 line-clamp-2 text-[10px] leading-3.5 text-stone-700">
                          {latestLifePost.content}
                        </span>
                        {latestLifePost.images[0]?.imageUrl ? <span className="mt-1 block h-12 w-full rounded bg-cover bg-center" role="img" aria-label="日志图片或自定义表情" style={{ backgroundImage: `url("${latestLifePost.images[0].imageUrl}")` }} /> : null}
                      </span>
                    ) : null}
                    {latestResearchPost ? (
                      <span className="block min-w-0 rounded-md bg-sky-50/90 px-1.5 py-1">
                        <span className="flex items-center gap-1 text-[9px] font-semibold text-sky-800">
                          <FlaskConical className="h-2.5 w-2.5" aria-hidden />
                          科研
                        </span>
                        <span className="mt-0.5 line-clamp-2 whitespace-pre-line text-[10px] leading-3.5 text-stone-700">
                          {latestResearchPost.content}
                        </span>
                      </span>
                    ) : null}
                    {hiddenPostCount > 0 ? (
                      <span className="text-right text-[9px] text-stone-400">另有 {hiddenPostCount} 条</span>
                    ) : null}
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
                <span className="block">生活日志</span>
                <span className="mt-0.5 block font-normal text-stone-400">{selectedDay.weekday} {selectedDay.shortDate}</span>
              </span>
              <div className="relative">
              <Button type="button" size="sm" variant="outline" disabled={submitting || saving} aria-expanded={moodOpen} onClick={() => setMoodOpen(!moodOpen)}>{mood ? `${moodEmoji[mood]} ${moodLabel(mood)}` : customExpression ? "图片表情" : "选择表情"} <ChevronDown className="h-3 w-3" /></Button>
              <div hidden={!moodOpen} className="absolute bottom-full left-0 z-30 mb-2 w-64 rounded-xl border border-stone-200 bg-white p-3 shadow-lg">
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
                      onClick={() => { setMood((previous) => (previous === option.value ? "" : option.value)); setMoodOpen(false); }}
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
                {["🥰", "😂", "🥳", "😎", "🤔", "😭", "😤", "🤒", "🙏", "💪", "🎉", "❤️", "🔥", "✨", "☕", "🌈"].map((emoji) => <button type="button" key={emoji} disabled={submitting || saving} aria-label={`表情 ${emoji}`} className="h-7 w-7 rounded hover:bg-stone-100" onClick={() => { setContent((previous) => `${previous}${emoji}`); setMoodOpen(false); }}>{emoji}</button>)}
              </div>
              <label className="mt-2 block cursor-pointer text-xs text-emerald-800">上传图片表情<input type="file" accept="image/*" className="mt-1 block w-full text-xs" onChange={(event) => { addImages(event.target.files, true); event.target.value = ""; setMoodOpen(false); }} disabled={submitting || saving} /></label>
              </div></div>
            </div>
            <Textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  void handleSubmit();
                }
              }}
              aria-label={`${selectedDate} 日志内容`}
              placeholder="写一句这一天的日志……"
              disabled={submitting || saving}
              className="min-h-16 resize-y border-stone-200 bg-white text-xs"
            />
            <div className="flex flex-wrap items-center gap-2 xl:col-span-full">
              <label className="text-xs text-stone-600">添加图片（最多9张，单张10MB）<input aria-label="添加日志图片" type="file" accept="image/*" multiple disabled={submitting || saving} onChange={(event) => { addImages(event.target.files); event.target.value = ""; }} className="block max-w-64 text-xs" /></label>
              {imagePreviews.map((url, index) => <button key={url} type="button" disabled={submitting || saving} aria-label={`移除图片 ${index + 1}`} title="点击移除" className="h-14 w-14 rounded border bg-cover bg-center" style={{ backgroundImage: `url("${url}")` }} onClick={() => { setImages((previous) => previous.filter((_, i) => i !== index)); if (index === 0) setCustomExpression(false); }} />)}
            </div>
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
          </CollapsibleContent>
        </div>
      </Collapsible>
    </section>
  );
}
