"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, format, isValid, parseISO } from "date-fns";
import { ArrowUpRight, ChevronDown, FlaskConical, Moon, Send } from "lucide-react";
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
    let submittedBaseline = persisted.current;
    setSubmitting(true);
    try {
      const requestId = drafts[draftDate]?.requestId ?? crypto.randomUUID();
      updateDraft({ requestId });
      submittedBaseline = persisted.current;
      const saved = await onCreatePost({
        requestId,
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
    <section className="task-dashboard-section dashboard-section-card research-progress-card" aria-label="今日科研进展" data-testid="research-progress-panel">
      <div className="dashboard-section-heading flex items-center gap-2" data-expanded={open}>
        <FlaskConical className="size-4 shrink-0 text-primary" aria-hidden />
        <h3 className="min-w-0 flex-1 font-semibold">今日科研进展</h3>
        <span className="console-count" role="status" aria-label="科研日志条数">{selectedEntryCount}</span>
        {canSubmit && draftDate !== date && <span className="console-draft" title={draftDate}>草稿</span>}
        <Button type="button" size="icon-sm" variant="ghost" aria-label={open ? "折叠今日科研进展" : "展开今日科研进展"} aria-expanded={open} onClick={() => { setOpen(!open); try { localStorage.setItem("research-progress-open", open ? "closed" : "open"); } catch {} }}><ChevronDown className={`size-3.5 ${open ? "" : "-rotate-90"}`} /></Button>
        <Button type="button" size="icon-sm" variant="ghost" onClick={onOpenLogs} aria-label="打开科研动态日志" title="动态日志"><ArrowUpRight className="size-3.5" /></Button>
      </div>
      <div hidden={!open} className="research-body">
        <div className="research-week" role="group" aria-label="近七天科研记录">
          {recentDates.map((day) => {
            const status = !logsReady ? "待确认" : recordedDates.has(day) ? "已记录" : restDays.includes(day) ? "休息日" : hasResearchDraft(drafts[day]) ? "草稿" : day === date ? "待记录" : "待补记";
            return <button key={day} type="button" disabled={disabled} aria-label={`${day} ${status}`} title={`${day} · ${status}`} aria-pressed={draftDate === day} data-status={status} onClick={() => selectDate(day)}>
              <span>{day === date ? "今" : format(parseISO(day), "dd")}</span><i aria-hidden />
            </button>;
          })}
        </div>
        <div className="research-datebar">
          <Input type="date" aria-label="科研日志日期" value={draftDate} max={date} disabled={disabled} onChange={(event) => selectDate(event.target.value)} />
          <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => selectDate(format(addDays(parseISO(date), -1), "yyyy-MM-dd"))}>昨天</Button>
          <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => selectDate(date)}>今天</Button>
          <span className="research-gap-count">{!logsReady ? "记录状态暂不可用" : missingCount ? `${missingCount} 天待补记` : ""}</span>
        </div>
        <div className="research-note-rows">
          <label><span>{draftDate === date ? "今日完成" : "当日完成"}</span><Textarea rows={2} value={completed} onChange={(event) => updateDraft({ completed: event.target.value })} disabled={disabled} aria-label={draftDate === date ? "今日完成" : "当日完成"} placeholder="完成了什么" className="research-note-input" /></label>
          <label><span>进展卡点</span><Textarea rows={2} value={insight} onChange={(event) => updateDraft({ insight: event.target.value })} disabled={disabled} aria-label="关键进展或卡点" placeholder="进展或阻碍" className="research-note-input" /></label>
          <label><span>{draftDate === date ? "明日计划" : "次日计划"}</span><Textarea rows={2} value={nextPlan} onChange={(event) => updateDraft({ nextPlan: event.target.value })} disabled={disabled} aria-label={draftDate === date ? "明日计划" : "次日计划"} placeholder="下一步" className="research-note-input" /></label>
        </div>
        <span role="status" className={storageError ? "console-storage-error" : "sr-only"}>{storageError ? "本地保存失败，离开前请保存日志" : userId && canSubmit ? "草稿已自动保存到本机" : ""}</span>
        <div className="research-footer">
          {!recordedDates.has(draftDate) && logsReady && <Button type="button" size="sm" variant="ghost" aria-label={restDays.includes(draftDate) ? "取消休息日" : "标记休息日"} aria-pressed={restDays.includes(draftDate)} disabled={disabled} onClick={() => persist({ ...local, restDays: restDays.includes(draftDate) ? restDays.filter((day) => day !== draftDate) : [...restDays, draftDate] })}><Moon className="size-3" />{restDays.includes(draftDate) ? "已休息" : "休息日"}</Button>}
          <Button type="button" size="sm" className="ml-auto" aria-label="保存科研日志" disabled={!canSubmit || disabled} onClick={() => void handleSubmit()}><Send className="size-3" />{disabled ? "保存中…" : "保存"}</Button>
        </div>
      </div>
    </section>
  );
}
