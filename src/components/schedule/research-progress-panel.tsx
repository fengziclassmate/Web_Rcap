"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, format, isValid, parseISO } from "date-fns";
import { ArrowUpRight, FlaskConical, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { emptyResearchDraft, hasResearchDraft, mergeResearchLocalState, parseResearchLocalState, researchStorageKey, type ResearchDraft, type ResearchLocalState } from "@/lib/research-progress-storage";
import {
  getDailyLogKind,
  type LogComposerInput,
  type LogPostRecord,
} from "@/lib/logs";

type ResearchProgressPanelProps = {
  userId?: string;
  logsReady?: boolean;
  date: string;
  posts: LogPostRecord[];
  saving?: boolean;
  onCreatePost: (input: LogComposerInput) => Promise<boolean>;
  onOpenLogs: () => void;
};

function getPostDate(post: LogPostRecord) {
  return format(parseISO(post.createdAt), "yyyy-MM-dd");
}

function buildResearchLogContent(completed: string, insight: string, nextPlan: string) {
  return [
    ["今日完成", completed],
    ["关键进展 / 卡点", insight],
    ["明日计划", nextPlan],
  ]
    .filter(([, value]) => value.trim())
    .map(([label, value]) => `${label}：\n${value.trim()}`)
    .join("\n\n");
}

export function ResearchProgressPanel(props: ResearchProgressPanelProps) {
  return <ResearchProgressContent key={props.userId ?? "session"} {...props} />;
}

function ResearchProgressContent({
  userId,
  logsReady = true,
  date,
  posts,
  saving = false,
  onCreatePost,
  onOpenLogs,
}: ResearchProgressPanelProps) {
  const [open, setOpen] = useState(true);
  useEffect(() => { try { setOpen(localStorage.getItem("research-progress-open") !== "closed"); } catch {} }, []);
  const [draftDate, setDraftDate] = useState(date);
  const [followToday, setFollowToday] = useState(true);
  const [local, setLocal] = useState<ResearchLocalState>({ drafts: {}, restDays: [], selectedDate: date });
  const persisted = useRef(local);
  const [storageReady, setStorageReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const { drafts, restDays } = local;
  useEffect(() => {
    if (userId) {
      try {
        const restored = parseResearchLocalState(localStorage.getItem(researchStorageKey(userId)), date);
        persisted.current = restored;
        setLocal(restored);
        setDraftDate(restored.selectedDate);
        setFollowToday(restored.selectedDate === date);
      } catch { setStorageError(true); }
    }
    setStorageReady(true);
    // Hydrate once per account; the keyed component resets on account changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
  useEffect(() => {
    if (!userId) return;
    function sync(event: StorageEvent) {
      if (event.storageArea !== localStorage || (event.key !== null && event.key !== researchStorageKey(userId!))) return;
      try {
        const latest = parseResearchLocalState(event.newValue, date);
        const baseline = persisted.current;
        persisted.current = latest;
        setLocal((previous) => mergeResearchLocalState(baseline, previous, latest));
      } catch { setStorageError(true); }
    }
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [date, userId]);
  const [submitting, setSubmitting] = useState(false);
  const { completed, insight, nextPlan } = drafts[draftDate] ?? emptyResearchDraft;

  function persist(next: ResearchLocalState, baseline = persisted.current) {
    setLocal(next);
    if (!userId) return;
    try {
      const raw = localStorage.getItem(researchStorageKey(userId));
      let latest: ResearchLocalState;
      try { latest = parseResearchLocalState(raw, date); }
      catch { latest = local; }
      const merged = mergeResearchLocalState(baseline, next, latest);
      localStorage.setItem(researchStorageKey(userId), JSON.stringify(merged));
      persisted.current = merged;
      setLocal(merged);
      setStorageError(false);
    } catch { setStorageError(true); }
  }

  const recordedDates = useMemo(() => new Set(posts.filter((post) => getDailyLogKind(post) === "research").map(getPostDate)), [posts]);
  const recentDates = Array.from({ length: 7 }, (_, index) => format(addDays(parseISO(date), index - 6), "yyyy-MM-dd"));
  const missingCount = recentDates.filter((day) => day < date && !recordedDates.has(day) && !restDays.includes(day)).length;

  const selectedEntryCount = useMemo(
    () =>
      posts.filter(
        (post) => getDailyLogKind(post) === "research" && getPostDate(post) === draftDate,
      ).length,
    [draftDate, posts],
  );
  const canSubmit = Boolean(completed.trim() || insight.trim() || nextPlan.trim());
  const disabled = submitting || saving || !storageReady;

  useEffect(() => {
    if (storageReady && followToday && !canSubmit) setDraftDate(date);
  }, [canSubmit, date, followToday, storageReady]);

  function selectDate(value: string) {
    if (disabled || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !isValid(parseISO(value)) || value > date) return;
    setFollowToday(value === date);
    setDraftDate(value);
    persist({ ...local, selectedDate: value });
  }

  function updateDraft(patch: Partial<ResearchDraft>) {
    const nextDraft = { ...emptyResearchDraft, ...drafts[draftDate], ...patch };
    const nextDrafts = { ...drafts };
    if (hasResearchDraft(nextDraft)) nextDrafts[draftDate] = nextDraft;
    else delete nextDrafts[draftDate];
    persist({ ...local, drafts: nextDrafts, selectedDate: draftDate });
  }

  async function handleSubmit() {
    if (!canSubmit || disabled) return;
    const submittedBaseline = persisted.current;
    setSubmitting(true);
    try {
      const saved = await onCreatePost({
        content: buildResearchLogContent(completed, insight, nextPlan),
        category: "research",
        mood: "",
        recordDate: draftDate,
        location: "",
        tagNames: ["每日记录", "科研日志"],
        images: [],
        links: [],
      });
      if (!saved) return;
      const nextDrafts = { ...drafts };
      delete nextDrafts[draftDate];
      persist({ ...local, drafts: nextDrafts, restDays: restDays.filter((day) => day !== draftDate) }, submittedBaseline);
      if (followToday) setDraftDate(date);
    } catch {
      toast.error("保存科研日志失败，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="task-dashboard-section" data-testid="research-progress-panel">
      <div className="border-t border-stone-200 pt-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <FlaskConical className="h-4 w-4 shrink-0 text-sky-800" aria-hidden />
          <h3 className="text-sm font-semibold text-stone-800">今日科研进展</h3>
          <Button type="button" size="icon-sm" variant="ghost" aria-label={open ? "折叠今日科研进展" : "展开今日科研进展"} aria-expanded={open} onClick={() => { setOpen(!open); try { localStorage.setItem("research-progress-open", open ? "closed" : "open"); } catch {} }}>{open ? "⌄" : "›"}</Button>
          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium tabular-nums text-sky-800">
            {draftDate === date ? "今日" : "当日"} {selectedEntryCount} 条
          </span>
          {canSubmit && draftDate !== date ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium tabular-nums text-amber-800">
              草稿 {draftDate.slice(5).replace("-", "/")}
            </span>
          ) : null}
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="ml-auto text-stone-500 hover:bg-white hover:text-sky-900"
            onClick={onOpenLogs}
            aria-label="打开科研动态日志"
            title="打开动态日志"
          >
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </div>

        <div className="space-y-2.5" hidden={!open}>
          <div className="rounded-lg border border-stone-200 bg-stone-50/80 p-2">
            <div className="mb-2 flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-stone-600">近 7 天</span>
              <span className={logsReady && missingCount ? "text-amber-800" : "text-stone-500"}>
                {!logsReady ? "记录状态暂不可用" : missingCount ? `${missingCount} 天待补记` : "往日无漏记"}
              </span>
            </div>
            <div className="grid grid-cols-7 gap-1" aria-label="近七天科研记录">
              {recentDates.map((day) => {
                const status = !logsReady ? "待确认" : recordedDates.has(day) ? "已记录" : restDays.includes(day) ? "休息日" : hasResearchDraft(drafts[day]) ? "草稿" : day === date ? "待记录" : "待补记";
                const color = status === "已记录" ? "text-emerald-700" : status === "草稿" ? "text-sky-800" : status === "待补记" ? "text-amber-800" : "text-stone-500";
                return <button key={day} type="button" disabled={disabled} aria-label={`${day} ${status}`} aria-pressed={draftDate === day} onClick={() => selectDate(day)} className={`min-w-0 rounded-md border px-0.5 py-1.5 text-center text-xs disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-sky-800 ${draftDate === day ? "border-sky-800 bg-sky-50" : "border-transparent hover:bg-white"}`}>
                  <span className="block tabular-nums text-stone-700">{day === date ? "今天" : format(parseISO(day), "M/d")}</span>
                  <span className={`mt-1 block text-[10px] leading-4 ${color}`}>{status}</span>
                </button>;
              })}
            </div>
          </div>
          <div className="flex items-end gap-1.5">
            <label className="min-w-0 flex-1 space-y-1">
              <span className="text-xs font-semibold text-stone-600">日志日期</span>
              <Input
                type="date"
                aria-label="科研日志日期"
                value={draftDate}
                max={date}
                disabled={disabled}
                onChange={(event) => selectDate(event.target.value)}
                className="bg-white/90"
              />
            </label>
            <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => selectDate(format(addDays(parseISO(date), -1), "yyyy-MM-dd"))}>昨天</Button>
            <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => selectDate(date)}>今天</Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
            <span role="status" className={storageError ? "text-amber-800" : "text-stone-500"}>
              {storageError ? "本地保存失败，离开前请保存日志" : userId && canSubmit ? "草稿已自动保存到本机" : ""}
            </span>
            {!recordedDates.has(draftDate) && logsReady && <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => persist({ ...local, restDays: restDays.includes(draftDate) ? restDays.filter((day) => day !== draftDate) : [...restDays, draftDate] })}>
              {restDays.includes(draftDate) ? "取消休息日" : "标记休息日"}
            </Button>}
          </div>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-stone-600">{draftDate === date ? "今日完成" : "当日完成"}</span>
            <Textarea
              value={completed}
              onChange={(event) => updateDraft({ completed: event.target.value })}
              disabled={disabled}
              aria-label={draftDate === date ? "今日完成" : "当日完成"}
              placeholder="实验、阅读、写作或分析进展"
              className="min-h-16 resize-y border-sky-900/10 bg-white/90 text-xs leading-5"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-stone-600">关键进展 / 卡点</span>
            <Textarea
              value={insight}
              onChange={(event) => updateDraft({ insight: event.target.value })}
              disabled={disabled}
              aria-label="关键进展或卡点"
              placeholder="新发现、待验证判断或当前阻碍"
              className="min-h-14 resize-y border-sky-900/10 bg-white/90 text-xs leading-5"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-stone-600">{draftDate === date ? "明日计划" : "次日计划"}</span>
            <Textarea
              value={nextPlan}
              onChange={(event) => updateDraft({ nextPlan: event.target.value })}
              disabled={disabled}
              aria-label={draftDate === date ? "明日计划" : "次日计划"}
              placeholder="下一步最小且明确的行动"
              className="min-h-14 resize-y border-sky-900/10 bg-white/90 text-xs leading-5"
            />
          </label>
          <Button
            type="button"
            size="sm"
            className="w-full bg-sky-950 text-white hover:bg-sky-900"
            disabled={!canSubmit || disabled}
            onClick={() => void handleSubmit()}
          >
            <Send className="h-3.5 w-3.5" aria-hidden />
            {disabled ? "保存中…" : "保存科研日志"}
          </Button>
        </div>
      </div>
    </section>
  );
}
