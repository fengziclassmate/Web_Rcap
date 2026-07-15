"use client";

import { useMemo, useState } from "react";
import {
  Archive,
  Activity,
  BadgeCheck,
  BookOpenCheck,
  CircleDotDashed,
  Clock3,
  FileCheck2,
  Gauge,
  ChartNoAxesCombined,
  Link2,
  Pencil,
  Plus,
  RotateCcw,
  Scale,
  ShieldAlert,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { createId } from "@/lib/id";
import { buildDeviationInsights } from "@/lib/execution-continuity";
import type {
  ContinuityEntityLink,
  DecisionConfidence,
  ExecutionContinuityState,
  ExecutionOutcome,
  ExecutionOutcomeStatus,
  ResearchDebt,
  ResearchDebtKind,
  ResearchDebtSeverity,
  ResearchDecision,
  ResearchResumePacket,
  WorkNovelty,
} from "@/lib/execution-continuity";
import type { KnowledgeWorkType, LongTask, ScheduleEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

type RecordTab = "resume" | "decisions" | "debts" | "outcomes";
type PanelTab = RecordTab | "learning" | "momentum";

type ProjectOption = {
  id: string;
  title: string;
  progress?: number;
  status?: string;
  currentIssues?: string;
  nextActions?: string;
  targetEndDate?: string;
  startDate?: string;
  linkedTaskIds?: string[];
  plannedTaskIds?: string[];
  lastActivityDate?: string | null;
};

type LinkDraft = {
  projectId: string;
  taskId: string;
  eventId: string;
};

const emptyLinkDraft: LinkDraft = { projectId: "", taskId: "", eventId: "" };

const tabItems: Array<{
  id: PanelTab;
  label: string;
  icon: typeof BookOpenCheck;
  accent: string;
}> = [
  { id: "resume", label: "恢复包", icon: BookOpenCheck, accent: "text-teal-700" },
  { id: "decisions", label: "决策账本", icon: Scale, accent: "text-sky-700" },
  { id: "debts", label: "科研债务", icon: ShieldAlert, accent: "text-amber-700" },
  { id: "outcomes", label: "执行结果", icon: BadgeCheck, accent: "text-emerald-700" },
  { id: "learning", label: "偏差学习", icon: ChartNoAxesCombined, accent: "text-indigo-700" },
  { id: "momentum", label: "项目动量", icon: Activity, accent: "text-rose-700" },
];

const selectClassName =
  "h-9 w-full rounded-md border border-stone-200 bg-white px-3 text-sm text-stone-800 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-700/15";

const outcomeLabels: Record<ExecutionOutcomeStatus, string> = {
  completed: "形成有效产出",
  negative_result: "验证后不成立",
  replaced: "被其他方案替代",
  not_needed: "已失去必要性",
  paused: "暂停并保留恢复条件",
  abandoned: "放弃并记录原因",
  partial: "部分完成",
};

const debtKindLabels: Record<ResearchDebtKind, string> = {
  citation: "引用核验",
  data: "数据处理",
  code: "代码维护",
  analysis: "分析验证",
  writing: "论文写作",
  method: "方法假设",
  other: "其他",
};

const severityLabels: Record<ResearchDebtSeverity, string> = {
  low: "低",
  medium: "中",
  high: "高",
  blocking: "阻断",
};

const workTypeLabels: Record<KnowledgeWorkType, string> = {
  reading: "文献阅读",
  writing: "论文写作",
  coding: "编程实现",
  data: "数据处理",
  experiment: "实验验证",
  meeting: "会议沟通",
  admin: "行政整理",
  other: "其他",
};

function isRecordTab(value: PanelTab): value is RecordTab {
  return value === "resume" || value === "decisions" || value === "debts" || value === "outcomes";
}

function toEntityLink(link: LinkDraft): ContinuityEntityLink {
  return {
    projectId: link.projectId || null,
    taskId: link.taskId || null,
    eventId: link.eventId || null,
  };
}

function fromEntityLink(link: ContinuityEntityLink): LinkDraft {
  return {
    projectId: link.projectId ?? "",
    taskId: link.taskId ?? "",
    eventId: link.eventId ?? "",
  };
}

function lines(value: string) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function LinkSelectors({
  value,
  onChange,
  projects,
  tasks,
  events,
}: {
  value: LinkDraft;
  onChange: (value: LinkDraft) => void;
  projects: ProjectOption[];
  tasks: LongTask[];
  events: ScheduleEvent[];
}) {
  return (
    <div className="grid gap-3 rounded-xl border border-stone-200 bg-stone-50/70 p-3 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label htmlFor="continuity-link-project">关联项目</Label>
        <select
          id="continuity-link-project"
          className={selectClassName}
          value={value.projectId}
          onChange={(event) => onChange({ ...value, projectId: event.target.value })}
        >
          <option value="">不关联</option>
          {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="continuity-link-task">关联任务</Label>
        <select
          id="continuity-link-task"
          className={selectClassName}
          value={value.taskId}
          onChange={(event) => onChange({ ...value, taskId: event.target.value })}
        >
          <option value="">不关联</option>
          {tasks.map((task) => <option key={task.id} value={task.id}>{task.name}</option>)}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="continuity-link-event">关联日程</Label>
        <select
          id="continuity-link-event"
          className={selectClassName}
          value={value.eventId}
          onChange={(event) => onChange({ ...value, eventId: event.target.value })}
        >
          <option value="">不关联</option>
          {events.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 80).map((item) => (
            <option key={item.id} value={item.id}>{item.date} · {item.title}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function RecordLinks({
  record,
  projectMap,
  taskMap,
  eventMap,
}: {
  record: ContinuityEntityLink;
  projectMap: Map<string, string>;
  taskMap: Map<string, string>;
  eventMap: Map<string, string>;
}) {
  const labels = [
    record.projectId ? projectMap.get(record.projectId) : null,
    record.taskId ? taskMap.get(record.taskId) : null,
    record.eventId ? eventMap.get(record.eventId) : null,
  ].filter(Boolean) as string[];
  if (!labels.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {labels.map((label) => (
        <span key={label} className="inline-flex max-w-full items-center gap-1 rounded-full bg-stone-100 px-2 py-1 text-[11px] text-stone-600">
          <Link2 className="size-3 shrink-0" aria-hidden />
          <span className="truncate">{label}</span>
        </span>
      ))}
    </div>
  );
}

export function ExecutionContinuityPanel({
  value,
  onChange,
  projects,
  tasks,
  events,
  initialOutcomeTaskId,
  onInitialOutcomeHandled,
}: {
  value: ExecutionContinuityState;
  onChange: (value: ExecutionContinuityState) => void;
  projects: ProjectOption[];
  tasks: LongTask[];
  events: ScheduleEvent[];
  initialOutcomeTaskId?: string | null;
  onInitialOutcomeHandled?: () => void;
}) {
  const initialOutcomeTask = initialOutcomeTaskId
    ? tasks.find((item) => item.id === initialOutcomeTaskId)
    : undefined;
  const [activeTab, setActiveTab] = useState<PanelTab>(initialOutcomeTaskId ? "outcomes" : "resume");
  const [resumeEditorId, setResumeEditorId] = useState<string | null>(null);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [resumeTitle, setResumeTitle] = useState("");
  const [resumeCompleted, setResumeCompleted] = useState("");
  const [resumeState, setResumeState] = useState("");
  const [resumeQuestions, setResumeQuestions] = useState("");
  const [resumeNext, setResumeNext] = useState("");
  const [resumeResources, setResumeResources] = useState("");
  const [resumeLinks, setResumeLinks] = useState<LinkDraft>(emptyLinkDraft);

  const [decisionEditorId, setDecisionEditorId] = useState<string | null>(null);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [decisionQuestion, setDecisionQuestion] = useState("");
  const [decisionOptions, setDecisionOptions] = useState("");
  const [decisionChoice, setDecisionChoice] = useState("");
  const [decisionRationale, setDecisionRationale] = useState("");
  const [decisionCounter, setDecisionCounter] = useState("");
  const [decisionConfidence, setDecisionConfidence] = useState<DecisionConfidence>("medium");
  const [decisionTrigger, setDecisionTrigger] = useState("");
  const [decisionLinks, setDecisionLinks] = useState<LinkDraft>(emptyLinkDraft);

  const [debtEditorId, setDebtEditorId] = useState<string | null>(null);
  const [debtOpen, setDebtOpen] = useState(false);
  const [debtTitle, setDebtTitle] = useState("");
  const [debtKind, setDebtKind] = useState<ResearchDebtKind>("analysis");
  const [debtSeverity, setDebtSeverity] = useState<ResearchDebtSeverity>("medium");
  const [debtImpact, setDebtImpact] = useState("");
  const [debtDueStage, setDebtDueStage] = useState("");
  const [debtBlocksSubmission, setDebtBlocksSubmission] = useState(false);
  const [debtLinks, setDebtLinks] = useState<LinkDraft>(emptyLinkDraft);

  const [outcomeEditorId, setOutcomeEditorId] = useState<string | null>(null);
  const [outcomeOpen, setOutcomeOpen] = useState(Boolean(initialOutcomeTaskId));
  const [outcomeTitle, setOutcomeTitle] = useState(initialOutcomeTask?.name ?? "");
  const [outcomeStatus, setOutcomeStatus] = useState<ExecutionOutcomeStatus>("completed");
  const [outcomeSummary, setOutcomeSummary] = useState(initialOutcomeTask?.completionLog ?? "");
  const [outcomeEvidence, setOutcomeEvidence] = useState("");
  const [outcomeNext, setOutcomeNext] = useState("");
  const [outcomePlanned, setOutcomePlanned] = useState("");
  const [outcomeActual, setOutcomeActual] = useState("");
  const [outcomeDeviation, setOutcomeDeviation] = useState("");
  const [outcomeWorkType, setOutcomeWorkType] = useState<KnowledgeWorkType>(
    initialOutcomeTask?.uncertainty?.workType ?? "other",
  );
  const [outcomeNovelty, setOutcomeNovelty] = useState<WorkNovelty>("familiar");
  const [outcomeLinks, setOutcomeLinks] = useState<LinkDraft>({
    ...emptyLinkDraft,
    taskId: initialOutcomeTaskId ?? "",
  });

  const projectMap = useMemo(() => new Map(projects.map((item) => [item.id, item.title])), [projects]);
  const taskMap = useMemo(() => new Map(tasks.map((item) => [item.id, item.name])), [tasks]);
  const eventMap = useMemo(() => new Map(events.map((item) => [item.id, item.title])), [events]);
  const openDebts = value.debts.filter((item) => item.status === "open");
  const blockingDebts = openDebts.filter((item) => item.severity === "blocking" || item.blocksSubmission);
  const measurableOutcomes = value.outcomes.filter((item) => item.plannedMinutes !== null && item.actualMinutes !== null);
  const averageDeviation = measurableOutcomes.length
    ? Math.round(measurableOutcomes.reduce((sum, item) => sum + ((item.actualMinutes ?? 0) - (item.plannedMinutes ?? 0)), 0) / measurableOutcomes.length)
    : null;
  const deviationInsights = useMemo(
    () => buildDeviationInsights(value.outcomes),
    [value.outcomes],
  );
  const momentumRows = useMemo(() => {
    const now = new Date();
    return projects.map((project) => {
      const linkedTaskIds = new Set([...(project.linkedTaskIds ?? []), ...(project.plannedTaskIds ?? [])]);
      const isProjectRecord = (record: ContinuityEntityLink) =>
        record.projectId === project.id || Boolean(record.taskId && linkedTaskIds.has(record.taskId));
      const projectOutcomes = value.outcomes.filter(isProjectRecord);
      const projectDebts = value.debts.filter((item) => item.status === "open" && isProjectRecord(item));
      const activeResume = value.resumePackets.find((item) => item.status === "active" && isProjectRecord(item));
      const projectDecisions = value.decisions.filter(isProjectRecord);
      const pendingTasks = tasks.filter((task) => linkedTaskIds.has(task.id) && !task.done);
      const activityDates = [
        project.lastActivityDate ?? null,
        ...projectOutcomes.map((item) => item.createdAt),
        ...projectDecisions.map((item) => item.updatedAt),
        activeResume?.updatedAt ?? null,
        project.startDate ?? null,
      ].filter((item): item is string => Boolean(item) && !Number.isNaN(Date.parse(item as string)));
      const lastActivityDate = activityDates.sort((a, b) => b.localeCompare(a))[0] ?? null;
      const daysIdle = lastActivityDate
        ? Math.max(0, Math.floor((now.getTime() - new Date(lastActivityDate).getTime()) / 86_400_000))
        : null;
      const hasBlockingDebt = projectDebts.some((item) => item.severity === "blocking" || item.blocksSubmission);
      const projectMeasured = projectOutcomes.filter((item) => item.plannedMinutes && item.actualMinutes !== null);
      const averageMultiplier = projectMeasured.length
        ? projectMeasured.reduce((sum, item) => sum + (item.actualMinutes ?? 0) / (item.plannedMinutes ?? 1), 0) / projectMeasured.length
        : null;
      let diagnosis = "稳定推进";
      let tone = "emerald";
      let recommendedAction = project.nextActions || pendingTasks[0]?.name || "记录下一步最小动作";
      if (hasBlockingDebt) {
        diagnosis = "依赖阻塞"; tone = "red"; recommendedAction = "优先处理阻断型科研债务";
      } else if (!project.nextActions && !activeResume && pendingTasks.length === 0) {
        diagnosis = "上下文脆弱"; tone = "amber"; recommendedAction = "创建恢复包并明确下一步";
      } else if (daysIdle !== null && daysIdle >= 21) {
        diagnosis = "实质停滞"; tone = "red"; recommendedAction = activeResume?.nextAction || "安排一次最小恢复会话";
      } else if (daysIdle !== null && daysIdle >= 10) {
        diagnosis = "缓慢推进"; tone = "amber"; recommendedAction = activeResume?.nextAction || recommendedAction;
      } else if (averageMultiplier !== null && projectMeasured.length >= 2 && averageMultiplier >= 1.5) {
        diagnosis = "高估时偏差"; tone = "sky"; recommendedAction = "按历史倍率扩大下一次时间预留";
      }
      return {
        project,
        diagnosis,
        tone,
        recommendedAction,
        daysIdle,
        pendingTasks,
        projectOutcomes,
        projectDebts,
        activeResume,
        averageMultiplier,
      };
    });
  }, [projects, tasks, value.debts, value.decisions, value.outcomes, value.resumePackets]);

  function openCreate(tab: RecordTab) {
    if (tab === "resume") {
      setResumeEditorId(null); setResumeTitle(""); setResumeCompleted(""); setResumeState("");
      setResumeQuestions(""); setResumeNext(""); setResumeResources(""); setResumeLinks(emptyLinkDraft); setResumeOpen(true);
    } else if (tab === "decisions") {
      setDecisionEditorId(null); setDecisionQuestion(""); setDecisionOptions(""); setDecisionChoice("");
      setDecisionRationale(""); setDecisionCounter(""); setDecisionConfidence("medium"); setDecisionTrigger("");
      setDecisionLinks(emptyLinkDraft); setDecisionOpen(true);
    } else if (tab === "debts") {
      setDebtEditorId(null); setDebtTitle(""); setDebtKind("analysis"); setDebtSeverity("medium"); setDebtImpact("");
      setDebtDueStage(""); setDebtBlocksSubmission(false); setDebtLinks(emptyLinkDraft); setDebtOpen(true);
    } else {
      setOutcomeEditorId(null); setOutcomeTitle(""); setOutcomeStatus("completed"); setOutcomeSummary("");
      setOutcomeEvidence(""); setOutcomeNext(""); setOutcomePlanned(""); setOutcomeActual("");
      setOutcomeDeviation(""); setOutcomeWorkType("other"); setOutcomeNovelty("familiar");
      setOutcomeLinks(emptyLinkDraft); setOutcomeOpen(true);
    }
  }

  function generateResumeDraft(project: ProjectOption) {
    const linkedTaskIds = new Set([...(project.linkedTaskIds ?? []), ...(project.plannedTaskIds ?? [])]);
    const matchesProject = (record: ContinuityEntityLink) =>
      record.projectId === project.id || Boolean(record.taskId && linkedTaskIds.has(record.taskId));
    const recentOutcomes = value.outcomes
      .filter(matchesProject)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 3);
    const openProjectDebts = value.debts.filter((item) => item.status === "open" && matchesProject(item));
    const pendingTask = tasks.find((item) => linkedTaskIds.has(item.id) && !item.done);
    const latestOutcomeNext = recentOutcomes.find((item) => item.nextAction)?.nextAction;
    setActiveTab("resume");
    setResumeEditorId(null);
    setResumeTitle(`${project.title} · 恢复点`);
    setResumeCompleted(recentOutcomes.map((item) => `${outcomeLabels[item.status]}：${item.summary}`).join("\n"));
    setResumeState([
      typeof project.progress === "number" ? `当前进度 ${project.progress}%` : "",
      project.currentIssues ? `当前问题：${project.currentIssues}` : "",
    ].filter(Boolean).join("；"));
    setResumeQuestions(openProjectDebts.map((item) => item.title).join("\n"));
    setResumeNext(project.nextActions || latestOutcomeNext || pendingTask?.name || "明确下一步最小验证动作");
    setResumeResources(recentOutcomes.map((item) => item.evidence).filter(Boolean).join("\n"));
    setResumeLinks({ projectId: project.id, taskId: pendingTask?.id ?? "", eventId: "" });
    setResumeOpen(true);
    toast.success("已根据项目状态生成恢复包草稿，请确认后保存");
  }

  function saveResume() {
    if (!resumeTitle.trim() || !resumeNext.trim()) return toast.error("请填写恢复包标题和下一步最小动作");
    const now = new Date().toISOString();
    const existing = value.resumePackets.find((item) => item.id === resumeEditorId);
    const record: ResearchResumePacket = {
      id: existing?.id ?? createId("resume"), title: resumeTitle.trim(), completedSummary: resumeCompleted.trim(),
      lastKnownState: resumeState.trim(), unresolvedQuestions: lines(resumeQuestions), nextAction: resumeNext.trim(),
      resourceLinks: lines(resumeResources), status: existing?.status ?? "active", createdAt: existing?.createdAt ?? now,
      updatedAt: now, ...toEntityLink(resumeLinks),
    };
    onChange({ ...value, resumePackets: existing ? value.resumePackets.map((item) => item.id === record.id ? record : item) : [record, ...value.resumePackets] });
    setResumeOpen(false); toast.success(existing ? "恢复包已更新" : "恢复包已创建");
  }

  function editResume(item: ResearchResumePacket) {
    setResumeEditorId(item.id); setResumeTitle(item.title); setResumeCompleted(item.completedSummary); setResumeState(item.lastKnownState);
    setResumeQuestions(item.unresolvedQuestions.join("\n")); setResumeNext(item.nextAction); setResumeResources(item.resourceLinks.join("\n"));
    setResumeLinks(fromEntityLink(item)); setResumeOpen(true);
  }

  function saveDecision() {
    if (!decisionQuestion.trim() || !decisionChoice.trim()) return toast.error("请填写决策问题和最终选择");
    const now = new Date().toISOString();
    const existing = value.decisions.find((item) => item.id === decisionEditorId);
    const record: ResearchDecision = {
      id: existing?.id ?? createId("decision"), question: decisionQuestion.trim(), options: lines(decisionOptions),
      choice: decisionChoice.trim(), rationale: decisionRationale.trim(), counterEvidence: decisionCounter.trim(),
      confidence: decisionConfidence, revisitTrigger: decisionTrigger.trim(), createdAt: existing?.createdAt ?? now,
      updatedAt: now, ...toEntityLink(decisionLinks),
    };
    onChange({ ...value, decisions: existing ? value.decisions.map((item) => item.id === record.id ? record : item) : [record, ...value.decisions] });
    setDecisionOpen(false); toast.success(existing ? "决策已更新" : "决策已记录");
  }

  function editDecision(item: ResearchDecision) {
    setDecisionEditorId(item.id); setDecisionQuestion(item.question); setDecisionOptions(item.options.join("\n"));
    setDecisionChoice(item.choice); setDecisionRationale(item.rationale); setDecisionCounter(item.counterEvidence);
    setDecisionConfidence(item.confidence); setDecisionTrigger(item.revisitTrigger); setDecisionLinks(fromEntityLink(item)); setDecisionOpen(true);
  }

  function saveDebt() {
    if (!debtTitle.trim()) return toast.error("请填写科研债务内容");
    const existing = value.debts.find((item) => item.id === debtEditorId);
    const record: ResearchDebt = {
      id: existing?.id ?? createId("debt"), title: debtTitle.trim(), kind: debtKind, severity: debtSeverity,
      impact: debtImpact.trim(), dueStage: debtDueStage.trim(), blocksSubmission: debtBlocksSubmission,
      status: existing?.status ?? "open", createdAt: existing?.createdAt ?? new Date().toISOString(),
      resolvedAt: existing?.resolvedAt ?? null, ...toEntityLink(debtLinks),
    };
    onChange({ ...value, debts: existing ? value.debts.map((item) => item.id === record.id ? record : item) : [record, ...value.debts] });
    setDebtOpen(false); toast.success(existing ? "科研债务已更新" : "科研债务已登记");
  }

  function editDebt(item: ResearchDebt) {
    setDebtEditorId(item.id); setDebtTitle(item.title); setDebtKind(item.kind); setDebtSeverity(item.severity);
    setDebtImpact(item.impact); setDebtDueStage(item.dueStage); setDebtBlocksSubmission(item.blocksSubmission);
    setDebtLinks(fromEntityLink(item)); setDebtOpen(true);
  }

  function saveOutcome() {
    if (!outcomeTitle.trim() || !outcomeSummary.trim()) return toast.error("请填写结果名称和结果说明");
    const existing = value.outcomes.find((item) => item.id === outcomeEditorId);
    const parseMinutes = (input: string) => input.trim() === "" ? null : Math.max(0, Math.round(Number(input)));
    const record: ExecutionOutcome = {
      id: existing?.id ?? createId("outcome"), title: outcomeTitle.trim(), status: outcomeStatus,
      summary: outcomeSummary.trim(), evidence: outcomeEvidence.trim(), nextAction: outcomeNext.trim(),
      plannedMinutes: parseMinutes(outcomePlanned), actualMinutes: parseMinutes(outcomeActual),
      deviationReason: outcomeDeviation.trim(), workType: outcomeWorkType, novelty: outcomeNovelty,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      ...toEntityLink(outcomeLinks),
    };
    onChange({ ...value, outcomes: existing ? value.outcomes.map((item) => item.id === record.id ? record : item) : [record, ...value.outcomes] });
    setOutcomeOpen(false);
    if (initialOutcomeTaskId) onInitialOutcomeHandled?.();
    toast.success(existing ? "执行结果已更新" : "执行结果已记录");
  }

  function editOutcome(item: ExecutionOutcome) {
    setOutcomeEditorId(item.id); setOutcomeTitle(item.title); setOutcomeStatus(item.status); setOutcomeSummary(item.summary);
    setOutcomeEvidence(item.evidence); setOutcomeNext(item.nextAction); setOutcomePlanned(item.plannedMinutes?.toString() ?? "");
    setOutcomeActual(item.actualMinutes?.toString() ?? ""); setOutcomeDeviation(item.deviationReason);
    setOutcomeWorkType(item.workType); setOutcomeNovelty(item.novelty);
    setOutcomeLinks(fromEntityLink(item)); setOutcomeOpen(true);
  }

  function deleteRecord(kind: RecordTab, id: string) {
    if (kind === "resume") onChange({ ...value, resumePackets: value.resumePackets.filter((item) => item.id !== id) });
    if (kind === "decisions") onChange({ ...value, decisions: value.decisions.filter((item) => item.id !== id) });
    if (kind === "debts") onChange({ ...value, debts: value.debts.filter((item) => item.id !== id) });
    if (kind === "outcomes") onChange({ ...value, outcomes: value.outcomes.filter((item) => item.id !== id) });
    toast.success("记录已删除");
  }

  const cardActions = (onEdit: () => void, onDelete: () => void) => (
    <div className="flex shrink-0 gap-1">
      <Button type="button" size="icon-sm" variant="ghost" onClick={onEdit} aria-label="编辑"><Pencil className="size-3.5" /></Button>
      <Button type="button" size="icon-sm" variant="ghost" onClick={onDelete} aria-label="删除"><Trash2 className="size-3.5" /></Button>
    </div>
  );

  return (
    <section className="continuity-shell overflow-hidden rounded-[1.4rem] border border-stone-200/80 bg-[#f6f4ee] shadow-[0_24px_70px_rgba(50,54,45,0.09)]">
      <div className="relative overflow-hidden border-b border-stone-200/80 bg-[#183f3a] px-5 py-6 text-white sm:px-7">
        <div className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -right-3 top-5 size-32 rounded-full border border-white/10" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-emerald-50/80">
              <CircleDotDashed className="size-3.5" /> Continuity
            </div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">科研执行连续性</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50/70">保存上次有效状态、关键决策、隐性债务和真实产出，让项目中断后仍能快速接回。</p>
          </div>
          {isRecordTab(activeTab) ? (
            <Button type="button" onClick={() => openCreate(activeTab)} className="w-fit border border-white/20 bg-white text-stone-950 hover:bg-emerald-50">
              <Plus className="size-4" /> 新建{tabItems.find((item) => item.id === activeTab)?.label}
            </Button>
          ) : (
            <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs text-emerald-50/75">
              基于已有执行数据自动计算，不需要额外维护
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-3 border-b border-stone-200/80 bg-white/55 p-4 sm:grid-cols-2 xl:grid-cols-4 sm:p-5">
        {[
          { label: "当前恢复点", value: value.resumePackets.filter((item) => item.status === "active").length, icon: RotateCcw, tone: "text-teal-700 bg-teal-50" },
          { label: "关键决策", value: value.decisions.length, icon: Scale, tone: "text-sky-700 bg-sky-50" },
          { label: "开放债务", value: openDebts.length, note: blockingDebts.length ? `${blockingDebts.length} 项阻断` : "暂无阻断", icon: TriangleAlert, tone: "text-amber-700 bg-amber-50" },
          { label: "平均时长偏差", value: averageDeviation === null ? "待积累" : `${averageDeviation > 0 ? "+" : ""}${averageDeviation} 分钟`, icon: Gauge, tone: "text-emerald-700 bg-emerald-50" },
        ].map((item) => (
          <div key={item.label} className="flex min-h-24 items-center gap-3 rounded-2xl border border-white bg-white/90 px-4 py-3 shadow-[0_10px_25px_rgba(50,54,45,0.05)]">
            <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-2xl", item.tone)}><item.icon className="size-4.5" /></span>
            <div className="min-w-0"><p className="text-xs text-stone-500">{item.label}</p><p className="mt-1 truncate text-lg font-semibold text-stone-900">{item.value}</p>{item.note ? <p className="text-[11px] text-amber-700">{item.note}</p> : null}</div>
          </div>
        ))}
      </div>

      <div className="p-4 sm:p-5">
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
          {tabItems.map((item) => {
            const Icon = item.icon;
            const selected = activeTab === item.id;
            return <button key={item.id} type="button" onClick={() => setActiveTab(item.id)} className={cn("inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition", selected ? "border-stone-900 bg-stone-900 text-white shadow-sm" : "border-stone-200 bg-white/80 text-stone-600 hover:bg-white")}><Icon className={cn("size-4", selected ? "text-white" : item.accent)} />{item.label}</button>;
          })}
        </div>

        {activeTab === "resume" ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {value.resumePackets.length ? value.resumePackets.map((item) => (
              <article key={item.id} className={cn("rounded-2xl border bg-white p-4 shadow-[0_12px_30px_rgba(50,54,45,0.05)]", item.status === "superseded" ? "border-stone-200 opacity-65" : "border-teal-900/15")}>
                <div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-medium uppercase tracking-[0.16em] text-teal-700">{item.status === "active" ? "当前恢复点" : "历史版本"} · {shortDate(item.updatedAt)}</p><h2 className="mt-1.5 font-semibold text-stone-950">{item.title}</h2></div>{cardActions(() => editResume(item), () => deleteRecord("resume", item.id))}</div>
                {item.lastKnownState ? <p className="mt-3 text-sm leading-6 text-stone-600">{item.lastKnownState}</p> : null}
                <div className="mt-4 rounded-xl bg-teal-50/80 p-3"><p className="text-[11px] font-medium text-teal-800">重新开始后的第一步</p><p className="mt-1 text-sm font-medium text-teal-950">{item.nextAction}</p></div>
                {item.unresolvedQuestions.length ? <p className="mt-3 text-xs text-amber-800">未决：{item.unresolvedQuestions.join(" · ")}</p> : null}
                <RecordLinks record={item} projectMap={projectMap} taskMap={taskMap} eventMap={eventMap} />
                <Button type="button" size="sm" variant="ghost" className="mt-3" onClick={() => onChange({ ...value, resumePackets: value.resumePackets.map((row) => row.id === item.id ? { ...row, status: row.status === "active" ? "superseded" : "active", updatedAt: new Date().toISOString() } : row) })}>{item.status === "active" ? <Archive className="size-3.5" /> : <RotateCcw className="size-3.5" />}{item.status === "active" ? "归入历史" : "设为当前"}</Button>
              </article>
            )) : <EmptyState icon={BookOpenCheck} title="还没有恢复包" action="在结束一次重要工作时，留下下一次重新进入项目所需的最小上下文。" onCreate={() => openCreate("resume")} />}
          </div>
        ) : null}

        {activeTab === "decisions" ? (
          <div className="space-y-3">
            {value.decisions.length ? value.decisions.map((item) => (
              <article key={item.id} className="rounded-2xl border border-sky-900/10 bg-white p-4 shadow-[0_12px_30px_rgba(50,54,45,0.05)]">
                <div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-medium uppercase tracking-[0.16em] text-sky-700">置信度 {item.confidence === "high" ? "高" : item.confidence === "low" ? "低" : "中"} · {shortDate(item.updatedAt)}</p><h2 className="mt-1.5 font-semibold text-stone-950">{item.question}</h2></div>{cardActions(() => editDecision(item), () => deleteRecord("decisions", item.id))}</div>
                <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]"><div className="rounded-xl bg-sky-50 p-3"><p className="text-[11px] text-sky-700">最终选择</p><p className="mt-1 text-sm font-medium text-sky-950">{item.choice}</p></div><div className="rounded-xl bg-stone-50 p-3"><p className="text-[11px] text-stone-500">依据</p><p className="mt-1 text-sm leading-5 text-stone-700">{item.rationale || "未记录"}</p></div></div>
                {item.revisitTrigger ? <p className="mt-3 text-xs text-amber-800">重新评估条件：{item.revisitTrigger}</p> : null}
                <RecordLinks record={item} projectMap={projectMap} taskMap={taskMap} eventMap={eventMap} />
              </article>
            )) : <EmptyState icon={Scale} title="还没有关键决策" action="只记录会改变研究路径的选择，以及未来应当重新评估它的条件。" onCreate={() => openCreate("decisions")} />}
          </div>
        ) : null}

        {activeTab === "debts" ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {value.debts.length ? value.debts.map((item) => (
              <article key={item.id} className={cn("rounded-2xl border bg-white p-4 shadow-[0_12px_30px_rgba(50,54,45,0.05)]", item.status !== "open" ? "border-stone-200 opacity-65" : item.severity === "blocking" ? "border-red-300" : "border-amber-900/15")}>
                <div className="flex items-start justify-between gap-3"><div className="flex flex-wrap items-center gap-2"><span className={cn("rounded-full px-2 py-1 text-[11px] font-medium", item.severity === "blocking" ? "bg-red-100 text-red-700" : item.severity === "high" ? "bg-orange-100 text-orange-700" : "bg-amber-50 text-amber-700")}>{severityLabels[item.severity]}</span><span className="text-xs text-stone-500">{debtKindLabels[item.kind]}</span></div>{cardActions(() => editDebt(item), () => deleteRecord("debts", item.id))}</div>
                <h2 className="mt-3 font-semibold text-stone-950">{item.title}</h2>{item.impact ? <p className="mt-2 text-sm leading-6 text-stone-600">{item.impact}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-stone-500">{item.dueStage ? <span className="rounded-full bg-stone-100 px-2 py-1">最迟：{item.dueStage}</span> : null}{item.blocksSubmission ? <span className="rounded-full bg-red-50 px-2 py-1 text-red-700">阻止投稿</span> : null}</div>
                <RecordLinks record={item} projectMap={projectMap} taskMap={taskMap} eventMap={eventMap} />
                <div className="mt-3 flex gap-2">{item.status === "open" ? <><Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...value, debts: value.debts.map((row) => row.id === item.id ? { ...row, status: "resolved", resolvedAt: new Date().toISOString() } : row) })}><FileCheck2 className="size-3.5" />已解决</Button><Button type="button" size="sm" variant="ghost" onClick={() => onChange({ ...value, debts: value.debts.map((row) => row.id === item.id ? { ...row, status: "accepted", resolvedAt: null } : row) })}>接受债务</Button></> : <Button type="button" size="sm" variant="ghost" onClick={() => onChange({ ...value, debts: value.debts.map((row) => row.id === item.id ? { ...row, status: "open", resolvedAt: null } : row) })}><RotateCcw className="size-3.5" />重新打开</Button>}</div>
              </article>
            )) : <EmptyState icon={ShieldAlert} title="还没有科研债务" action="把临时清洗、待核引用、未验证假设等隐性风险显性化。" onCreate={() => openCreate("debts")} />}
          </div>
        ) : null}

        {activeTab === "outcomes" ? (
          <div className="space-y-3">
            {value.outcomes.length ? value.outcomes.map((item) => {
              const deviation = item.plannedMinutes !== null && item.actualMinutes !== null ? item.actualMinutes - item.plannedMinutes : null;
              return <article key={item.id} className="rounded-2xl border border-emerald-900/10 bg-white p-4 shadow-[0_12px_30px_rgba(50,54,45,0.05)]"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-medium uppercase tracking-[0.16em] text-emerald-700">{outcomeLabels[item.status]} · {workTypeLabels[item.workType]} · {item.novelty === "new" ? "首次任务" : "熟悉任务"} · {shortDate(item.createdAt)}</p><h2 className="mt-1.5 font-semibold text-stone-950">{item.title}</h2></div>{cardActions(() => editOutcome(item), () => deleteRecord("outcomes", item.id))}</div><p className="mt-3 text-sm leading-6 text-stone-600">{item.summary}</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{item.evidence ? <div className="rounded-xl bg-emerald-50 p-3"><p className="text-[11px] text-emerald-700">完成证据</p><p className="mt-1 text-sm text-emerald-950">{item.evidence}</p></div> : null}{deviation !== null ? <div className="rounded-xl bg-stone-50 p-3"><p className="text-[11px] text-stone-500">计划 / 实际</p><p className="mt-1 text-sm font-medium text-stone-900">{item.plannedMinutes} / {item.actualMinutes} 分钟 <span className={deviation > 0 ? "text-amber-700" : "text-emerald-700"}>({deviation > 0 ? "+" : ""}{deviation})</span></p>{item.deviationReason ? <p className="mt-1 text-xs text-stone-500">{item.deviationReason}</p> : null}</div> : null}</div>{item.nextAction ? <p className="mt-3 text-xs text-sky-800">后续动作：{item.nextAction}</p> : null}<RecordLinks record={item} projectMap={projectMap} taskMap={taskMap} eventMap={eventMap} /></article>;
            }) : <EmptyState icon={BadgeCheck} title="还没有证据化结果" action="任务结束时记录它实际产生了什么，而不只留下一个完成勾选。" onCreate={() => openCreate("outcomes")} />}
          </div>
        ) : null}

        {activeTab === "learning" ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-indigo-900/10 bg-[linear-gradient(135deg,#eef2ff_0%,#ffffff_72%)] p-4 sm:p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-700">Personal Estimation Model</p>
              <h2 className="mt-2 text-lg font-semibold text-stone-950">你的计划偏差不是一个总完成率</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-stone-600">系统按工作类型和新颖程度学习实际耗时。样本越多，长期任务详情里的时间建议越接近你的真实工作方式。</p>
            </div>
            {deviationInsights.length ? (
              <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                {deviationInsights.map((insight) => (
                  <article key={insight.workType} className="rounded-2xl border border-indigo-900/10 bg-white p-4 shadow-[0_12px_30px_rgba(50,54,45,0.05)]">
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="text-xs text-stone-500">{workTypeLabels[insight.workType]}</p><p className="mt-1 text-2xl font-semibold tabular-nums text-stone-950">× {insight.averageMultiplier}</p></div>
                      <span className="rounded-full bg-indigo-50 px-2 py-1 text-[11px] text-indigo-700">{insight.sampleSize} 个样本</span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-stone-50 p-3"><p className="text-[11px] text-stone-500">平均计划</p><p className="mt-1 font-medium text-stone-900">{insight.averagePlannedMinutes} 分钟</p></div>
                      <div className="rounded-xl bg-indigo-50/70 p-3"><p className="text-[11px] text-indigo-600">平均实际</p><p className="mt-1 font-medium text-indigo-950">{insight.averageActualMinutes} 分钟</p></div>
                    </div>
                    <p className={cn("mt-3 text-xs", insight.averageDeltaMinutes > 0 ? "text-amber-700" : "text-emerald-700")}>
                      平均偏差 {insight.averageDeltaMinutes > 0 ? "+" : ""}{insight.averageDeltaMinutes} 分钟
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-stone-600">
                      {insight.newWorkMultiplier !== null ? <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-800">首次任务 ×{insight.newWorkMultiplier}</span> : null}
                      {insight.familiarWorkMultiplier !== null ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-800">熟悉任务 ×{insight.familiarWorkMultiplier}</span> : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="grid min-h-52 place-items-center rounded-2xl border border-dashed border-stone-300 bg-white/55 p-6 text-center">
                <div><ChartNoAxesCombined className="mx-auto size-7 text-stone-400" /><p className="mt-3 font-medium text-stone-900">还没有可学习的时长样本</p><p className="mt-1 text-sm text-stone-500">在执行结果中同时填写工作类型、计划时长和实际时长后，这里会自动形成个人倍率。</p></div>
              </div>
            )}
          </div>
        ) : null}

        {activeTab === "momentum" ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-rose-900/10 bg-[linear-gradient(135deg,#fff1f2_0%,#ffffff_72%)] p-4 sm:p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-700">Project Momentum</p>
              <h2 className="mt-2 text-lg font-semibold text-stone-950">发现“形式活跃、实质停滞”的项目</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-stone-600">诊断综合最近产出、阻断债务、待办任务、下一步动作和恢复包状态，不使用单一完成百分比。</p>
            </div>
            {momentumRows.length ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {momentumRows.map((row) => (
                  <article key={row.project.id} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-[0_12px_30px_rgba(50,54,45,0.05)]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0"><p className="truncate font-semibold text-stone-950">{row.project.title}</p><p className="mt-1 text-xs text-stone-500">进度 {row.project.progress ?? 0}% · {row.daysIdle === null ? "暂无活动记录" : `${row.daysIdle} 天未形成新记录`}</p></div>
                      <span className={cn(
                        "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium",
                        row.tone === "red" ? "bg-red-100 text-red-700" : row.tone === "amber" ? "bg-amber-100 text-amber-800" : row.tone === "sky" ? "bg-sky-100 text-sky-800" : "bg-emerald-100 text-emerald-800",
                      )}>{row.diagnosis}</span>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-teal-700" style={{ width: `${Math.min(100, Math.max(0, row.project.progress ?? 0))}%` }} /></div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-stone-50 p-2"><p className="text-lg font-semibold text-stone-900">{row.projectOutcomes.length}</p><p className="text-[10px] text-stone-500">实际产出</p></div>
                      <div className="rounded-xl bg-stone-50 p-2"><p className="text-lg font-semibold text-stone-900">{row.pendingTasks.length}</p><p className="text-[10px] text-stone-500">待推进任务</p></div>
                      <div className={cn("rounded-xl p-2", row.projectDebts.length ? "bg-amber-50" : "bg-stone-50")}><p className="text-lg font-semibold text-stone-900">{row.projectDebts.length}</p><p className="text-[10px] text-stone-500">开放债务</p></div>
                    </div>
                    <div className="mt-3 rounded-xl bg-rose-50/70 p-3"><p className="text-[11px] text-rose-700">建议的恢复动作</p><p className="mt-1 text-sm font-medium text-rose-950">{row.recommendedAction}</p></div>
                    {row.activeResume ? <p className="mt-3 text-xs text-teal-800">当前恢复包：{row.activeResume.nextAction}</p> : null}
                    <Button type="button" size="sm" variant="outline" className="mt-4 w-full border-teal-200 text-teal-900 hover:bg-teal-50" onClick={() => generateResumeDraft(row.project)}>
                      <RotateCcw className="size-3.5" /> 根据当前状态生成恢复包草稿
                    </Button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="grid min-h-52 place-items-center rounded-2xl border border-dashed border-stone-300 bg-white/55 p-6 text-center"><div><Activity className="mx-auto size-7 text-stone-400" /><p className="mt-3 font-medium text-stone-900">暂无科研项目</p><p className="mt-1 text-sm text-stone-500">创建科研项目后，这里会自动诊断项目动量。</p></div></div>
            )}
          </div>
        ) : null}
      </div>

      <Dialog open={resumeOpen} onOpenChange={setResumeOpen}><DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{resumeEditorId ? "编辑恢复包" : "创建科研恢复包"}</DialogTitle></DialogHeader><div className="space-y-4"><Field label="标题"><Input value={resumeTitle} onChange={(e) => setResumeTitle(e.target.value)} placeholder="例如：空间回归模型中断点" /></Field><LinkSelectors value={resumeLinks} onChange={setResumeLinks} projects={projects} tasks={tasks} events={events} /><Field label="本次完成了什么"><Textarea value={resumeCompleted} onChange={(e) => setResumeCompleted(e.target.value)} /></Field><Field label="最后一个有效状态"><Textarea value={resumeState} onChange={(e) => setResumeState(e.target.value)} /></Field><Field label="未解决问题（每行一项）"><Textarea value={resumeQuestions} onChange={(e) => setResumeQuestions(e.target.value)} /></Field><Field label="下一步最小动作"><Input value={resumeNext} onChange={(e) => setResumeNext(e.target.value)} placeholder="重新开始后第一件可在30分钟内完成的动作" /></Field><Field label="相关资源（每行一项）"><Textarea value={resumeResources} onChange={(e) => setResumeResources(e.target.value)} placeholder="文件名、网页或说明" /></Field><Button type="button" className="w-full" onClick={saveResume}>保存恢复包</Button></div></DialogContent></Dialog>

      <Dialog open={decisionOpen} onOpenChange={setDecisionOpen}><DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{decisionEditorId ? "编辑决策" : "记录关键决策"}</DialogTitle></DialogHeader><div className="space-y-4"><Field label="决策问题"><Input value={decisionQuestion} onChange={(e) => setDecisionQuestion(e.target.value)} /></Field><LinkSelectors value={decisionLinks} onChange={setDecisionLinks} projects={projects} tasks={tasks} events={events} /><Field label="候选方案（每行一个）"><Textarea value={decisionOptions} onChange={(e) => setDecisionOptions(e.target.value)} /></Field><Field label="最终选择"><Input value={decisionChoice} onChange={(e) => setDecisionChoice(e.target.value)} /></Field><Field label="选择依据"><Textarea value={decisionRationale} onChange={(e) => setDecisionRationale(e.target.value)} /></Field><Field label="反对证据或保留意见"><Textarea value={decisionCounter} onChange={(e) => setDecisionCounter(e.target.value)} /></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="当前信心"><select className={selectClassName} value={decisionConfidence} onChange={(e) => setDecisionConfidence(e.target.value as DecisionConfidence)}><option value="low">低</option><option value="medium">中</option><option value="high">高</option></select></Field><Field label="重新评估条件"><Input value={decisionTrigger} onChange={(e) => setDecisionTrigger(e.target.value)} /></Field></div><Button type="button" className="w-full" onClick={saveDecision}>保存决策</Button></div></DialogContent></Dialog>

      <Dialog open={debtOpen} onOpenChange={setDebtOpen}><DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{debtEditorId ? "编辑科研债务" : "登记科研债务"}</DialogTitle></DialogHeader><div className="space-y-4"><Field label="债务内容"><Input value={debtTitle} onChange={(e) => setDebtTitle(e.target.value)} /></Field><LinkSelectors value={debtLinks} onChange={setDebtLinks} projects={projects} tasks={tasks} events={events} /><div className="grid gap-3 sm:grid-cols-2"><Field label="债务类型"><select className={selectClassName} value={debtKind} onChange={(e) => setDebtKind(e.target.value as ResearchDebtKind)}>{Object.entries(debtKindLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field><Field label="严重程度"><select className={selectClassName} value={debtSeverity} onChange={(e) => setDebtSeverity(e.target.value as ResearchDebtSeverity)}>{Object.entries(severityLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field></div><Field label="影响范围"><Textarea value={debtImpact} onChange={(e) => setDebtImpact(e.target.value)} /></Field><Field label="最迟处理阶段"><Input value={debtDueStage} onChange={(e) => setDebtDueStage(e.target.value)} placeholder="例如：投稿前、稳健性检验前" /></Field><div className="flex items-center justify-between rounded-xl border border-stone-200 p-3"><div><p className="text-sm font-medium text-stone-900">阻止投稿</p><p className="text-xs text-stone-500">未解决前不应进入投稿阶段</p></div><Switch checked={debtBlocksSubmission} onCheckedChange={setDebtBlocksSubmission} /></div><Button type="button" className="w-full" onClick={saveDebt}>保存科研债务</Button></div></DialogContent></Dialog>

      <Dialog open={outcomeOpen} onOpenChange={(open) => { setOutcomeOpen(open); if (!open && initialOutcomeTaskId) onInitialOutcomeHandled?.(); }}><DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{outcomeEditorId ? "编辑执行结果" : "记录证据化结果"}</DialogTitle></DialogHeader><div className="space-y-4"><Field label="结果名称"><Input value={outcomeTitle} onChange={(e) => setOutcomeTitle(e.target.value)} /></Field><LinkSelectors value={outcomeLinks} onChange={setOutcomeLinks} projects={projects} tasks={tasks} events={events} /><Field label="结果状态"><select className={selectClassName} value={outcomeStatus} onChange={(e) => setOutcomeStatus(e.target.value as ExecutionOutcomeStatus)}>{Object.entries(outcomeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="工作类型"><select className={selectClassName} value={outcomeWorkType} onChange={(e) => setOutcomeWorkType(e.target.value as KnowledgeWorkType)}>{Object.entries(workTypeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field><Field label="任务新颖程度"><select className={selectClassName} value={outcomeNovelty} onChange={(e) => setOutcomeNovelty(e.target.value as WorkNovelty)}><option value="familiar">熟悉任务</option><option value="new">首次或高度陌生</option></select></Field></div><Field label="实际结果"><Textarea value={outcomeSummary} onChange={(e) => setOutcomeSummary(e.target.value)} placeholder="得到什么结论、失败信息或阶段性产出" /></Field><Field label="完成证据"><Textarea value={outcomeEvidence} onChange={(e) => setOutcomeEvidence(e.target.value)} placeholder="文件、代码提交、图表、笔记、数据或论文段落" /></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="计划时长（分钟）"><Input type="number" min="0" value={outcomePlanned} onChange={(e) => setOutcomePlanned(e.target.value)} /></Field><Field label="实际时长（分钟）"><Input type="number" min="0" value={outcomeActual} onChange={(e) => setOutcomeActual(e.target.value)} /></Field></div><Field label="偏差原因"><Input value={outcomeDeviation} onChange={(e) => setOutcomeDeviation(e.target.value)} placeholder="如：重新理解上下文、数据异常、外部打断" /></Field><Field label="后续动作"><Input value={outcomeNext} onChange={(e) => setOutcomeNext(e.target.value)} /></Field><Button type="button" className="w-full" onClick={saveOutcome}>保存执行结果</Button></div></DialogContent></Dialog>
    </section>
  );
}

function EmptyState({ icon: Icon, title, action, onCreate }: { icon: typeof Clock3; title: string; action: string; onCreate: () => void }) {
  return <div className="col-span-full grid min-h-52 place-items-center rounded-2xl border border-dashed border-stone-300 bg-white/55 p-6 text-center"><div><span className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-stone-100 text-stone-500"><Icon className="size-5" /></span><p className="mt-3 font-medium text-stone-900">{title}</p><p className="mx-auto mt-1 max-w-md text-sm leading-6 text-stone-500">{action}</p><Button type="button" size="sm" variant="outline" className="mt-4" onClick={onCreate}><Plus className="size-3.5" />添加记录</Button></div></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
