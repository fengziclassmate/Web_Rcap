"use client";

import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ArrowUpRight, FlaskConical, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  getDailyLogKind,
  type LogComposerInput,
  type LogPostRecord,
} from "@/lib/logs";

type ResearchProgressPanelProps = {
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

export function ResearchProgressPanel({
  date,
  posts,
  saving = false,
  onCreatePost,
  onOpenLogs,
}: ResearchProgressPanelProps) {
  const [open, setOpen] = useState(true);
  useEffect(() => { try { setOpen(localStorage.getItem("research-progress-open") !== "closed"); } catch {} }, []);
  const [completed, setCompleted] = useState("");
  const [insight, setInsight] = useState("");
  const [nextPlan, setNextPlan] = useState("");
  const [draftDate, setDraftDate] = useState(date);
  const [submitting, setSubmitting] = useState(false);

  const todayEntryCount = useMemo(
    () =>
      posts.filter(
        (post) => getDailyLogKind(post) === "research" && getPostDate(post) === date,
      ).length,
    [date, posts],
  );
  const canSubmit = Boolean(completed.trim() || insight.trim() || nextPlan.trim());
  const disabled = submitting || saving;

  useEffect(() => {
    if (!canSubmit) setDraftDate(date);
  }, [canSubmit, date]);

  async function handleSubmit() {
    if (!canSubmit || disabled) return;
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
      setCompleted("");
      setInsight("");
      setNextPlan("");
      setDraftDate(date);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="task-dashboard-section" data-testid="research-progress-panel">
      <div className="border-t border-stone-200 pt-3">
        <div className="mb-2 flex items-center gap-2">
          <FlaskConical className="h-4 w-4 shrink-0 text-sky-800" aria-hidden />
          <h3 className="text-sm font-semibold text-stone-800">今日科研进展</h3>
          <Button type="button" size="icon-sm" variant="ghost" aria-label={open ? "折叠今日科研进展" : "展开今日科研进展"} aria-expanded={open} onClick={() => { setOpen(!open); try { localStorage.setItem("research-progress-open", open ? "closed" : "open"); } catch {} }}>{open ? "⌄" : "›"}</Button>
          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium tabular-nums text-sky-800">
            今日 {todayEntryCount} 条
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
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-stone-600">今日完成</span>
            <Textarea
              value={completed}
              onChange={(event) => setCompleted(event.target.value)}
              disabled={disabled}
              aria-label="今日完成"
              placeholder="实验、阅读、写作或分析进展"
              className="min-h-16 resize-y border-sky-900/10 bg-white/90 text-xs leading-5"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-stone-600">关键进展 / 卡点</span>
            <Textarea
              value={insight}
              onChange={(event) => setInsight(event.target.value)}
              disabled={disabled}
              aria-label="关键进展或卡点"
              placeholder="新发现、待验证判断或当前阻碍"
              className="min-h-14 resize-y border-sky-900/10 bg-white/90 text-xs leading-5"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-stone-600">明日计划</span>
            <Textarea
              value={nextPlan}
              onChange={(event) => setNextPlan(event.target.value)}
              disabled={disabled}
              aria-label="明日计划"
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
