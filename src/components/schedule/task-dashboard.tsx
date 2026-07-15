"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarRange,
  ChevronDown,
  CheckCircle,
  Clock,
  ListTodo,
  Plus,
  RotateCcw,
  Star,
  Trash2,
  AlertTriangle,
  Footprints,
  FileCheck2,
  KanbanSquare,
  GripVertical,
  Pencil,
  Trophy,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ROUTINE_CHECKIN_PROJECT_ID,
  type AnnualTask,
  type DashboardUiPreferences,
  type FootprintItem,
  type KnowledgeWorkType,
  type LongTask,
  type Priority,
  type ProjectCheckin,
  type ScheduleEvent,
  type SubTask,
  type TaskType,
  type TaskUncertaintyLevel,
} from "@/lib/types";
import {
  buildDeviationInsights,
  type ExecutionOutcome,
} from "@/lib/execution-continuity";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { TaskDecompositionDialog } from "@/components/llm/task-decomposition-dialog";
import { ContextBadge } from "@/components/llm/context-badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { Achievement } from "@/components/monitoring/achievements-panel";
import { DailyTaskPanel } from "@/components/schedule/daily-task-panel";
import { cn } from "@/lib/utils";

type TaskDashboardProps = {
  tasks: LongTask[];
  events: ScheduleEvent[];
  onToggleTask: (taskId: string) => void;
  onAddTask: (name: string, dueDate: string, taskType?: TaskType) => void;
  onUpdateTask: (taskId: string, patch: Partial<LongTask>) => void;
  onDeleteTask: (taskId: string) => void;
  onReorderTask: (sourceTaskId: string, targetTaskId: string) => void;
  annualTasks: AnnualTask[];
  onAddAnnualTask: (name: string) => void;
  onToggleAnnualTask: (taskId: string) => void;
  onDeleteAnnualTask: (taskId: string) => void;
  onUpdateAnnualTask: (taskId: string, name: string) => void;
  onReorderAnnualTask: (sourceTaskId: string, targetTaskId: string) => void;
  onCreateDailyTaskTimeBlock: (
    task: LongTask,
    date: string,
    startHour: number,
    durationMinutes: number,
  ) => void;
  projectCheckins: ProjectCheckin[];
  onAddProjectCheckin: (name: string, description: string) => void;
  onCheckinProject: (projectId: string, date: string, note: string) => void;
  onDeleteProjectCheckin: (projectId: string) => void;
  onUpdateProjectCheckin: (
    projectId: string,
    patch: Partial<Omit<ProjectCheckin, "id">>,
  ) => void;
  onUpdateRoutineCheckins: (
    patch: Partial<Pick<ProjectCheckin, "dailyCheckins" | "dailyCompletions">>,
  ) => void;
  onUpdateProjectCheckinEntry: (projectId: string, date: string, note: string) => void;
  onDeleteProjectCheckinEntry: (projectId: string, date: string) => void;
  achievements: Achievement[];
  onAddAchievement: (value: Omit<Achievement, "id">) => void;
  onUpdateAchievement: (id: string, patch: Partial<Omit<Achievement, "id">>) => void;
  onDeleteAchievement: (id: string) => void;
  footprints: FootprintItem[];
  onAddFootprint: (name: string) => void;
  onResetFootprint: (itemId: string) => void;
  onDeleteFootprint: (itemId: string) => void;
  onUpdateFootprint: (
    itemId: string,
    patch: Partial<Pick<FootprintItem, "name" | "lastDate">>,
  ) => void;
  showFootprintsSection?: boolean;
  showProjectSection?: boolean;
  confirmDangerousActions: boolean;
  uiPreferences: DashboardUiPreferences;
  onUiPreferencesChange: (value: DashboardUiPreferences) => void;
  onRecordTaskOutcome?: (taskId: string) => void;
  executionOutcomes?: ExecutionOutcome[];
};

const PRIORITY_ORDER: Priority[] = ["紧急且重要", "紧急不重要", "不紧急重要", "不紧急不重要"];

const PRIORITY_VISUAL_STYLE: Record<
  Priority,
  { barClassName: string; badgeClassName: string }
> = {
  "\u7d27\u6025\u4e14\u91cd\u8981": {
    barClassName: "bg-red-500",
    badgeClassName: "border-red-200 bg-red-50 text-red-700",
  },
  "\u7d27\u6025\u4e0d\u91cd\u8981": {
    barClassName: "bg-amber-500",
    badgeClassName: "border-amber-200 bg-amber-50 text-amber-700",
  },
  "\u4e0d\u7d27\u6025\u91cd\u8981": {
    barClassName: "bg-blue-500",
    badgeClassName: "border-blue-200 bg-blue-50 text-blue-700",
  },
  "\u4e0d\u7d27\u6025\u4e0d\u91cd\u8981": {
    barClassName: "bg-slate-500",
    badgeClassName: "border-slate-200 bg-slate-50 text-slate-700",
  },
};

const fallbackPriority = PRIORITY_ORDER[3];

function getPriorityVisualStyle(priority: Priority) {
  return PRIORITY_VISUAL_STYLE[priority] ?? PRIORITY_VISUAL_STYLE[fallbackPriority];
}

type TaskDraft = {
  id: string;
  name: string;
  dueDate: string;
  notes: string;
  precautionsText: string;
  completionLog: string;
  done: boolean;
  priority: Priority;
  subtasks: SubTask[];
  newSubtaskName: string;
  uncertaintyEnabled: boolean;
  uncertaintyLevel: TaskUncertaintyLevel;
  workType: KnowledgeWorkType;
  estimateMinMinutes: string;
  estimateMaxMinutes: string;
  unknownsText: string;
  successCriteria: string;
  minimumValidationStep: string;
  branchOptionsText: string;
  stopCondition: string;
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

const uncertaintyLabels: Record<TaskUncertaintyLevel, string> = {
  low: "低：路径清晰",
  medium: "中：存在未知项",
  high: "高：结果与路径都不确定",
};

type DailyCheckinDraft = {
  label: string;
  time: string;
};

type AchievementForm = {
  date: string;
  title: string;
  note: string;
};

function toggleStoredId(items: string[], id: string) {
  const next = new Set(items);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return [...next];
}

function formatDateToISODate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayISODate() {
  return formatDateToISODate(new Date());
}

function isISODateString(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function daysBetweenInclusive(startIso: string, endIso: string) {
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);
  const ms = Math.max(0, end.getTime() - start.getTime());
  return Math.floor(ms / (24 * 60 * 60 * 1000)) + 1;
}

const HOUR_MS = 60 * 60 * 1000;

function parseDateTime(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getTaskCompletionDateTime(task: LongTask) {
  return parseDateTime(task.completedAt) ?? parseDateTime(`${task.dueDate}T23:59:59`);
}

function getTaskCreatedDateTime(task: LongTask) {
  return parseDateTime(task.createdAt);
}

function getTaskCompletionISODate(task: LongTask) {
  const completedAt = getTaskCompletionDateTime(task);
  return completedAt ? formatDateToISODate(completedAt) : task.dueDate;
}

function getTaskCompletionDurationHours(task: LongTask) {
  const startedAt = getTaskCreatedDateTime(task);
  const completedAt = getTaskCompletionDateTime(task);
  if (!startedAt || !completedAt) return null;
  const duration = completedAt.getTime() - startedAt.getTime();
  if (duration < 0) return null;
  return Math.max(1, Math.ceil(duration / HOUR_MS));
}

function formatDateTimeLabel(date: Date | null) {
  if (!date) return "\u672a\u8bb0\u5f55";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${formatDateToISODate(date)} ${hours}:${minutes}`;
}

function formatDurationLabel(hours: number | null) {
  if (hours === null) return "\u672a\u8bb0\u5f55";
  if (hours < 24) return `${hours}\u5c0f\u65f6`;
  const days = Math.floor(hours / 24);
  const remainderHours = hours % 24;
  return remainderHours === 0 ? `${days}\u5929` : `${days}\u5929${remainderHours}\u5c0f\u65f6`;
}

function addDaysToISODate(isoDate: string, amount: number) {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + amount);
  return formatDateToISODate(date);
}

function getWeekStartISODate(isoDate: string) {
  const date = new Date(`${isoDate}T00:00:00`);
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + offset);
  return formatDateToISODate(date);
}

function formatWeekRangeLabel(weekStartIso: string) {
  return `${weekStartIso} - ${addDaysToISODate(weekStartIso, 6)}`;
}
function isValidTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function TaskDashboard({
  tasks,
  events,
  onToggleTask,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onReorderTask,
  annualTasks,
  onAddAnnualTask,
  onToggleAnnualTask,
  onDeleteAnnualTask,
  onUpdateAnnualTask,
  onReorderAnnualTask,
  onCreateDailyTaskTimeBlock,
  projectCheckins,
  onAddProjectCheckin,
  onCheckinProject,
  onDeleteProjectCheckin,
  onUpdateProjectCheckin,
  onUpdateRoutineCheckins,
  onUpdateProjectCheckinEntry,
  onDeleteProjectCheckinEntry,
  achievements,
  onAddAchievement,
  onUpdateAchievement,
  onDeleteAchievement,
  footprints,
  onAddFootprint,
  onResetFootprint,
  onDeleteFootprint,
  onUpdateFootprint,
  showFootprintsSection = true,
  showProjectSection = true,
  confirmDangerousActions,
  uiPreferences,
  onUiPreferencesChange,
  onRecordTaskOutcome,
  executionOutcomes = [],
}: TaskDashboardProps) {
  const [taskName, setTaskName] = useState("");
  const [annualTaskName, setAnnualTaskName] = useState("");
  const [dueDate, setDueDate] = useState(getTodayISODate);
  const [todayDate, setTodayDate] = useState(getTodayISODate);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState<TaskDraft | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pendingDeleteTaskId, setPendingDeleteTaskId] = useState<string | null>(null);
  const expandedTasks = useMemo(() => new Set(uiPreferences.expandedTasks), [uiPreferences.expandedTasks]);
  const [taskViewMode, setTaskViewMode] = useState<"order" | "priority">("order");
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [projectNoteDraft, setProjectNoteDraft] = useState<Record<string, string>>({});
  const [projectDateDraft, setProjectDateDraft] = useState<Record<string, string>>({});
  const [dailyCheckinDrafts, setDailyCheckinDrafts] = useState<Record<string, DailyCheckinDraft>>({});
  const [newFootprintName, setNewFootprintName] = useState("");
  const [showAddTaskDialog, setShowAddTaskDialog] = useState(false);
  const [showAddAnnualDialog, setShowAddAnnualDialog] = useState(false);
  const [editingAnnualTaskId, setEditingAnnualTaskId] = useState<string | null>(null);
  const [editingAnnualTaskName, setEditingAnnualTaskName] = useState("");
  const [draggingAnnualTaskId, setDraggingAnnualTaskId] = useState<string | null>(null);
  const [showAddProjectDialog, setShowAddProjectDialog] = useState(false);
  const [showRoutineCheckinForm, setShowRoutineCheckinForm] = useState(false);
  const [showAchievementDialog, setShowAchievementDialog] = useState(false);
  const [showAddFootprintDialog, setShowAddFootprintDialog] = useState(false);
  const [historyProjectId, setHistoryProjectId] = useState<string | null>(null);
  const [checkinDrafts, setCheckinDrafts] = useState<Record<string, string>>({});
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState("");
  const [editingProjectDesc, setEditingProjectDesc] = useState("");
  const [editingAchievementId, setEditingAchievementId] = useState<string | null>(null);
  const [achievementForm, setAchievementForm] = useState<AchievementForm>({
    date: getTodayISODate(),
    title: "",
    note: "",
  });
  const [editingFootprintId, setEditingFootprintId] = useState<string | null>(null);
  const [editingFootprintName, setEditingFootprintName] = useState("");
  const [editingFootprintDate, setEditingFootprintDate] = useState(getTodayISODate);
  const longTaskSectionOpen = uiPreferences.longTaskSectionOpen;
  const annualSectionOpen = uiPreferences.annualSectionOpen;
  const expandedCompletedTasks = useMemo(
    () => new Set(uiPreferences.expandedCompletedTasks),
    [uiPreferences.expandedCompletedTasks],
  );
  const [completedLibraryOpen, setCompletedLibraryOpen] = useState(false);
  const activeUtilityPanel: "project" | "routine" | "achievement" | "footprint" | null =
    uiPreferences.projectSectionOpen
      ? "project"
      : uiPreferences.routineCheckinSectionOpen
        ? "routine"
        : uiPreferences.achievementSectionOpen
          ? "achievement"
          : uiPreferences.footprintSectionOpen
            ? "footprint"
            : null;
  const footprintSectionOpen = uiPreferences.footprintSectionOpen;
  const expandedProjects = useMemo(
    () => new Set(uiPreferences.expandedProjects),
    [uiPreferences.expandedProjects],
  );
  const expandedFootprints = useMemo(
    () => new Set(uiPreferences.expandedFootprints),
    [uiPreferences.expandedFootprints],
  );
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);
  const incompleteTasks = useMemo(
    () => tasks.filter((task) => task.taskType === "long" && !task.done),
    [tasks],
  );
  const completedTasks = useMemo(
    () => tasks.filter((task) => task.taskType === "long" && task.done),
    [tasks],
  );
  const deviationInsights = useMemo(
    () => buildDeviationInsights(executionOutcomes),
    [executionOutcomes],
  );
  const editingTask = tasks.find((task) => task.id === editingTaskId) ?? null;
  const editingTaskDeviationInsight = taskDraft
    ? deviationInsights.find((item) => item.workType === taskDraft.workType) ?? null
    : null;

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTodayDate((currentDate) => {
        const nextDate = getTodayISODate();
        return currentDate === nextDate ? currentDate : nextDate;
      });
    }, 60 * 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  const orderedIncompleteTasks = useMemo(() => [...incompleteTasks], [incompleteTasks]);
  const visibleProjectCheckins = useMemo(
    () => projectCheckins.filter((project) => project.id !== ROUTINE_CHECKIN_PROJECT_ID),
    [projectCheckins],
  );
  const routineProject = useMemo<ProjectCheckin>(
    () =>
      projectCheckins.find((project) => project.id === ROUTINE_CHECKIN_PROJECT_ID) ?? {
        id: ROUTINE_CHECKIN_PROJECT_ID,
        name: "日常时段打卡",
        description: "",
        startDate: todayDate,
        checkins: [],
        dailyCheckins: [],
        dailyCompletions: [],
      },
    [projectCheckins, todayDate],
  );
  const dailyCheckinEntries = useMemo(
    () =>
      projectCheckins
        .flatMap((project) =>
          (project.dailyCheckins ?? []).map((slot) => ({
            project,
            slot,
          })),
        )
        .sort((a, b) => a.slot.time.localeCompare(b.slot.time)),
    [projectCheckins],
  );
  const completedDailyCheckinCount = dailyCheckinEntries.filter(({ project, slot }) =>
    (project.dailyCompletions ?? []).some(
      (completion) => completion.date === todayDate && completion.slotId === slot.id,
    ),
  ).length;
  const dailyCheckinArchive = useMemo(() => {
    const dates = new Set<string>();
    const startDateCandidates: string[] = [];

    for (const { project } of dailyCheckinEntries) {
      if (isISODateString(project.startDate)) {
        startDateCandidates.push(project.startDate);
      }

      for (const completion of project.dailyCompletions ?? []) {
        if (isISODateString(completion.date)) {
          startDateCandidates.push(completion.date);
          if (completion.date < todayDate) {
            dates.add(completion.date);
          }
        }
      }
    }

    const archiveStartDate = startDateCandidates.sort()[0];
    if (archiveStartDate && archiveStartDate < todayDate) {
      const cursor = new Date(`${archiveStartDate}T00:00:00`);
      const end = new Date(`${todayDate}T00:00:00`);

      while (cursor < end) {
        dates.add(formatDateToISODate(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    return [...dates]
      .sort((a, b) => b.localeCompare(a))
      .map((date) => {
        const entries = dailyCheckinEntries.map(({ project, slot }) => {
          const completion = (project.dailyCompletions ?? []).find(
            (item) => item.date === date && item.slotId === slot.id,
          );

          return {
            id: `${project.id}-${slot.id}`,
            label: slot.label,
            time: slot.time,
            projectName: project.id === ROUTINE_CHECKIN_PROJECT_ID ? "" : project.name,
            completed: Boolean(completion),
          };
        });
        const completedCount = entries.filter((entry) => entry.completed).length;

        return {
          date,
          entries,
          completedCount,
          totalCount: entries.length,
        };
      });
  }, [dailyCheckinEntries, todayDate]);

  const groupedIncompleteTasks = useMemo(
    () =>
      PRIORITY_ORDER.map((priority) => ({
        priority,
        items: orderedIncompleteTasks.filter((task) => task.priority === priority),
      })),
    [orderedIncompleteTasks],
  );
  const orderedCompletedTasks = useMemo(
    () =>
      [...completedTasks].sort((a, b) => {
        const aTime = getTaskCompletionDateTime(a)?.getTime() ?? 0;
        const bTime = getTaskCompletionDateTime(b)?.getTime() ?? 0;
        return bTime - aTime;
      }),
    [completedTasks],
  );
  const completedTaskInsights = useMemo(() => {
    const weeklyMap = new Map<
      string,
      { weekStart: string; count: number; totalDurationHours: number; durationCount: number }
    >();
    let totalDurationHours = 0;
    let durationCount = 0;

    for (const task of completedTasks) {
      const completionDate = getTaskCompletionISODate(task);
      const weekStart = getWeekStartISODate(completionDate);
      const current = weeklyMap.get(weekStart) ?? {
        weekStart,
        count: 0,
        totalDurationHours: 0,
        durationCount: 0,
      };
      const durationHours = getTaskCompletionDurationHours(task);
      current.count += 1;
      if (durationHours !== null) {
        current.totalDurationHours += durationHours;
        current.durationCount += 1;
        totalDurationHours += durationHours;
        durationCount += 1;
      }
      weeklyMap.set(weekStart, current);
    }

    const weeklyStats = [...weeklyMap.values()]
      .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
      .slice(0, 8)
      .map((week) => ({
        ...week,
        averageDurationHours:
          week.durationCount > 0 ? Math.round(week.totalDurationHours / week.durationCount) : null,
      }));
    const maxWeeklyCount = Math.max(1, ...weeklyStats.map((week) => week.count));
    const thisWeekStart = getWeekStartISODate(todayDate);
    const priorityStats = PRIORITY_ORDER.map((priority) => {
      const count = completedTasks.filter((task) => task.priority === priority).length;
      return {
        priority,
        count,
        percent: completedTasks.length > 0 ? Math.round((count / completedTasks.length) * 100) : 0,
      };
    });

    return {
      total: completedTasks.length,
      thisWeekCount: weeklyMap.get(thisWeekStart)?.count ?? 0,
      durationSampleCount: durationCount,
      averageDurationHours: durationCount > 0 ? Math.round(totalDurationHours / durationCount) : null,
      maxWeeklyCount,
      priorityStats,
      weeklyStats,
    };
  }, [completedTasks, todayDate]);
  const historyProject = useMemo(
    () => projectCheckins.find((project) => project.id === historyProjectId) ?? null,
    [projectCheckins, historyProjectId],
  );
  const editingFootprint = useMemo(
    () => footprints.find((item) => item.id === editingFootprintId) ?? null,
    [footprints, editingFootprintId],
  );
  const editingAchievement = useMemo(
    () => achievements.find((item) => item.id === editingAchievementId) ?? null,
    [achievements, editingAchievementId],
  );
  const groupedAchievements = useMemo(() => {
    const map = new Map<string, Achievement[]>();
    for (const item of achievements) {
      const items = map.get(item.date) ?? [];
      items.push(item);
      map.set(item.date, items);
    }
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, items]) => [
        date,
        [...items].sort((a, b) => a.title.localeCompare(b.title)),
      ] as const);
  }, [achievements]);

  function patchUiPreferences(patch: Partial<DashboardUiPreferences>) {
    onUiPreferencesChange({ ...uiPreferences, ...patch });
  }

  function handleAddTask() {
    if (!taskName.trim()) return;
    onAddTask(taskName, dueDate);
    setTaskName("");
    setShowAddTaskDialog(false);
    toast.success("长期任务已添加");
  }

  function handleAddAnnual() {
    if (!annualTaskName.trim()) return;
    onAddAnnualTask(annualTaskName);
    setAnnualTaskName("");
    setShowAddAnnualDialog(false);
    toast.success("已加入年度清单");
  }

  function handleOpenEdit(task: LongTask) {
    setEditingTaskId(task.id);
    setTaskDraft({
      id: task.id,
      name: task.name,
      dueDate: task.dueDate,
      notes: task.notes ?? "",
      precautionsText: (task.precautions ?? []).join("\n"),
      completionLog: task.completionLog ?? "",
      done: task.done,
      priority: task.priority ?? "不紧急不重要",
      subtasks: task.subtasks ?? [],
      newSubtaskName: "",
      uncertaintyEnabled: Boolean(task.uncertainty),
      uncertaintyLevel: task.uncertainty?.level ?? "medium",
      workType: task.uncertainty?.workType ?? "other",
      estimateMinMinutes: task.uncertainty?.estimateMinMinutes?.toString() ?? "",
      estimateMaxMinutes: task.uncertainty?.estimateMaxMinutes?.toString() ?? "",
      unknownsText: task.uncertainty?.unknowns.join("\n") ?? "",
      successCriteria: task.uncertainty?.successCriteria ?? "",
      minimumValidationStep: task.uncertainty?.minimumValidationStep ?? "",
      branchOptionsText: task.uncertainty?.branchOptions.join("\n") ?? "",
      stopCondition: task.uncertainty?.stopCondition ?? "",
    });
  }

  function handleSaveTask() {
    if (!taskDraft || !taskDraft.name.trim()) return;
    const parseDraftMinutes = (input: string) => {
      if (!input.trim()) return null;
      const parsed = Number(input);
      return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : null;
    };
    const estimateMinMinutes = parseDraftMinutes(taskDraft.estimateMinMinutes);
    const estimateMaxDraft = parseDraftMinutes(taskDraft.estimateMaxMinutes);
    const estimateMaxMinutes = estimateMinMinutes !== null && estimateMaxDraft !== null
      ? Math.max(estimateMinMinutes, estimateMaxDraft)
      : estimateMaxDraft;
    const wasDone = editingTask?.done ?? false;
    const completedAt = taskDraft.done
      ? wasDone
        ? editingTask?.completedAt ?? new Date().toISOString()
        : new Date().toISOString()
      : null;
    onUpdateTask(taskDraft.id, {
      name: taskDraft.name.trim(),
      dueDate: taskDraft.dueDate,
      notes: taskDraft.notes.trim(),
      precautions: taskDraft.precautionsText
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
      completionLog: taskDraft.completionLog.trim(),
      done: taskDraft.done,
      completedAt,
      priority: taskDraft.priority,
      subtasks: taskDraft.subtasks,
      uncertainty: taskDraft.uncertaintyEnabled
        ? {
            level: taskDraft.uncertaintyLevel,
            workType: taskDraft.workType,
            estimateMinMinutes,
            estimateMaxMinutes,
            unknowns: taskDraft.unknownsText.split("\n").map((item) => item.trim()).filter(Boolean),
            successCriteria: taskDraft.successCriteria.trim(),
            minimumValidationStep: taskDraft.minimumValidationStep.trim(),
            branchOptions: taskDraft.branchOptionsText.split("\n").map((item) => item.trim()).filter(Boolean),
            stopCondition: taskDraft.stopCondition.trim(),
          }
        : null,
    });
    setEditingTaskId(null);
    setTaskDraft(null);
    toast.success("任务已保存");
  }

  function handleAddSubtask() {
    if (!taskDraft || !taskDraft.newSubtaskName.trim()) return;
    setTaskDraft(prev => prev ? {
      ...prev,
      subtasks: [...prev.subtasks, {
        id: `subtask-${Date.now()}`,
        name: prev.newSubtaskName.trim(),
        done: false,
      }],
      newSubtaskName: "",
    } : prev);
  }

  function handleToggleSubtask(subtaskId: string) {
    if (!taskDraft) return;
    setTaskDraft(prev => prev ? {
      ...prev,
      subtasks: prev.subtasks.map(subtask => 
        subtask.id === subtaskId ? { ...subtask, done: !subtask.done } : subtask
      ),
    } : prev);
  }

  function handleDeleteSubtask(subtaskId: string) {
    if (!taskDraft) return;
    setTaskDraft(prev => prev ? {
      ...prev,
      subtasks: prev.subtasks.filter(subtask => subtask.id !== subtaskId),
    } : prev);
  }

  function getPriorityIcon(priority: Priority) {
    switch (priority) {
      case "紧急且重要":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "紧急不重要":
        return <Clock className="h-4 w-4 text-orange-500" />;
      case "不紧急重要":
        return <Star className="h-4 w-4 text-blue-500" />;
      case "不紧急不重要":
        return <CheckCircle className="h-4 w-4 text-gray-500" />;
      default:
        return null;
    }
  }

  function handleConfirmDeleteTask() {
    if (!pendingDeleteTaskId) return;
    onDeleteTask(pendingDeleteTaskId);
    setConfirmDeleteOpen(false);
    setPendingDeleteTaskId(null);
    setEditingTaskId(null);
    setTaskDraft(null);
    toast.success("任务已删除");
  }

  function handleMoveBackToIncomplete(taskId: string) {
    onToggleTask(taskId);
    toast.success("任务已移回未完成");
  }

  function handleDropTask(targetTaskId: string) {
    if (!draggingTaskId || draggingTaskId === targetTaskId) return;
    onReorderTask(draggingTaskId, targetTaskId);
    setDraggingTaskId(null);
  }

  function handleTaskDragStart(taskId: string, event: React.DragEvent<HTMLButtonElement>) {
    setDraggingTaskId(taskId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/task-id", taskId);
    const ghost = document.createElement("div");
    ghost.className = "rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700";
    ghost.textContent = "移动任务";
    document.body.appendChild(ghost);
    event.dataTransfer.setDragImage(ghost, 24, 12);
    requestAnimationFrame(() => document.body.removeChild(ghost));
  }

  function handleAddProject() {
    if (!newProjectName.trim()) return;
    onAddProjectCheckin(newProjectName, newProjectDesc);
    setNewProjectName("");
    setNewProjectDesc("");
    setShowAddProjectDialog(false);
  }

  function handleProjectCheckin(projectId: string) {
    const checkinDate = projectDateDraft[projectId] ?? todayDate;
    if (!isISODateString(checkinDate)) {
      toast.error("请选择有效的打卡日期");
      return;
    }
    if (checkinDate > todayDate) {
      toast.error("不能补打未来日期");
      return;
    }

    onCheckinProject(projectId, checkinDate, projectNoteDraft[projectId] ?? "");
    setProjectNoteDraft((prev) => ({ ...prev, [projectId]: "" }));
    toast.success(checkinDate === todayDate ? "项目已打卡" : `已补打 ${checkinDate}`);
  }

  function getDailyCheckinDraft(projectId: string): DailyCheckinDraft {
    return dailyCheckinDrafts[projectId] ?? { label: "", time: "" };
  }

  function patchDailyCheckinDraft(projectId: string, patch: Partial<DailyCheckinDraft>) {
    setDailyCheckinDrafts((prev) => ({
      ...prev,
      [projectId]: { ...(prev[projectId] ?? { label: "", time: "" }), ...patch },
    }));
  }

  function updateDailyCheckinProject(
    project: ProjectCheckin,
    patch: Partial<Pick<ProjectCheckin, "dailyCheckins" | "dailyCompletions">>,
  ) {
    if (project.id === ROUTINE_CHECKIN_PROJECT_ID) {
      onUpdateRoutineCheckins(patch);
      return;
    }
    onUpdateProjectCheckin(project.id, patch);
  }

  function handleAddDailyCheckin(project: ProjectCheckin) {
    const draft = getDailyCheckinDraft(project.id);
    const label = draft.label.trim();
    const time = draft.time.trim();
    if (!label || !time) return;
    if (!isValidTime(time)) {
      toast.error("请输入有效时间，例如 07:50");
      return;
    }

    const nextDailyCheckins = [
      ...(project.dailyCheckins ?? []),
      {
        id: `daily-${Date.now()}`,
        label,
        time,
      },
    ].sort((a, b) => a.time.localeCompare(b.time));

    updateDailyCheckinProject(project, { dailyCheckins: nextDailyCheckins });
    setDailyCheckinDrafts((prev) => ({ ...prev, [project.id]: { label: "", time: "" } }));
    setShowRoutineCheckinForm(false);
  }

  function handleToggleDailyCheckin(project: ProjectCheckin, slotId: string, checked: boolean) {
    const today = getTodayISODate();
    const completions = project.dailyCompletions ?? [];
    const alreadyDone = completions.some(
      (completion) => completion.date === today && completion.slotId === slotId,
    );

    const nextDailyCompletions = checked
      ? alreadyDone
        ? completions
        : [
            ...completions,
            {
              date: today,
              slotId,
              completedAt: new Date().toISOString(),
            },
          ]
      : completions.filter(
          (completion) => !(completion.date === today && completion.slotId === slotId),
        );

    updateDailyCheckinProject(project, { dailyCompletions: nextDailyCompletions });
  }

  function handleDeleteDailyCheckin(project: ProjectCheckin, slotId: string) {
    updateDailyCheckinProject(project, {
      dailyCheckins: (project.dailyCheckins ?? []).filter((slot) => slot.id !== slotId),
      dailyCompletions: (project.dailyCompletions ?? []).filter(
        (completion) => completion.slotId !== slotId,
      ),
    });
  }

  function handleDeleteProject(projectId: string) {
    onDeleteProjectCheckin(projectId);
  }

  function daysSince(startIso: string) {
    const start = new Date(`${startIso}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const ms = Math.max(0, today.getTime() - start.getTime());
    return Math.floor(ms / (24 * 60 * 60 * 1000));
  }

  function withOptionalConfirm(message: string, action: () => void) {
    if (!confirmDangerousActions) {
      action();
      return;
    }
    setConfirmState({
      open: true,
      title: "确认操作",
      description: message,
      onConfirm: action,
    });
  }

  function openEditProject(project: ProjectCheckin) {
    setEditingProjectId(project.id);
    setEditingProjectName(project.name);
    setEditingProjectDesc(project.description);
  }

  function saveEditProject() {
    if (!editingProjectId || !editingProjectName.trim()) return;
    onUpdateProjectCheckin(editingProjectId, {
      name: editingProjectName.trim(),
      description: editingProjectDesc.trim(),
    });
    setEditingProjectId(null);
  }

  function openCreateAchievement() {
    setEditingAchievementId(null);
    setAchievementForm({
      date: getTodayISODate(),
      title: "",
      note: "",
    });
    setShowAchievementDialog(true);
  }

  function openEditAchievement(item: Achievement) {
    setEditingAchievementId(item.id);
    setAchievementForm({
      date: item.date,
      title: item.title,
      note: item.note ?? "",
    });
    setShowAchievementDialog(true);
  }

  function handleSaveAchievement() {
    const date = achievementForm.date.trim();
    const title = achievementForm.title.trim();
    const note = achievementForm.note.trim();
    if (!date || !title) return;

    if (editingAchievementId) {
      onUpdateAchievement(editingAchievementId, {
        date,
        title,
        note: note.length > 0 ? note : undefined,
      });
    } else {
      onAddAchievement({
        date,
        title,
        note: note.length > 0 ? note : undefined,
      });
    }

    setShowAchievementDialog(false);
    setEditingAchievementId(null);
  }

  function handleAddFootprint() {
    if (!newFootprintName.trim()) return;
    onAddFootprint(newFootprintName);
    setNewFootprintName("");
    setShowAddFootprintDialog(false);
  }

  function handleResetFootprint(itemId: string) {
    onResetFootprint(itemId);
  }

  function openEditFootprint(item: FootprintItem) {
    setEditingFootprintId(item.id);
    setEditingFootprintName(item.name);
    setEditingFootprintDate(item.lastDate);
  }

  function saveEditFootprint() {
    if (!editingFootprintId || !editingFootprintName.trim() || !editingFootprintDate) return;
    onUpdateFootprint(editingFootprintId, {
      name: editingFootprintName.trim(),
      lastDate: editingFootprintDate,
    });
    setEditingFootprintId(null);
  }

  function handleToggleTaskSubtask(taskId: string, subtaskId: string) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const nextSubtasks = task.subtasks.map((subtask) =>
      subtask.id === subtaskId ? { ...subtask, done: !subtask.done } : subtask,
    );
    onUpdateTask(taskId, { subtasks: nextSubtasks });
  }

  function openEditAnnualTask(task: AnnualTask) {
    setEditingAnnualTaskId(task.id);
    setEditingAnnualTaskName(task.name);
  }

  function saveAnnualTaskName() {
    if (!editingAnnualTaskId || !editingAnnualTaskName.trim()) return;
    onUpdateAnnualTask(editingAnnualTaskId, editingAnnualTaskName);
    setEditingAnnualTaskId(null);
  }

  function handleAnnualTaskDrop(targetTaskId: string) {
    if (!draggingAnnualTaskId || draggingAnnualTaskId === targetTaskId) return;
    onReorderAnnualTask(draggingAnnualTaskId, targetTaskId);
    setDraggingAnnualTaskId(null);
  }

  function setUtilityPanel(
    panel: "project" | "routine" | "achievement" | "footprint",
    open: boolean,
  ) {
    patchUiPreferences({
      projectSectionOpen: open && panel === "project",
      routineCheckinSectionOpen: open && panel === "routine",
      achievementSectionOpen: open && panel === "achievement",
      footprintSectionOpen: open && panel === "footprint",
    });
  }

  function handleAddUtilityItem() {
    if (activeUtilityPanel === "routine") {
      setShowRoutineCheckinForm(true);
      return;
    }

    if (activeUtilityPanel === "achievement") {
      openCreateAchievement();
      return;
    }

    if (activeUtilityPanel === "footprint") {
      setShowAddFootprintDialog(true);
      return;
    }

    setShowAddProjectDialog(true);
  }

  return (
    <aside className="module-shell">
      <div className="module-header px-6 py-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-gray-900">
          <ListTodo className="h-5 w-5 text-primary" />
          任务控制台
        </h2>
      </div>

      <Separator />

      <section className="task-dashboard-section">
        <div className="completed-library-trigger">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle className="h-4 w-4" aria-hidden />
            </span>
            <p className="truncate text-sm font-semibold text-stone-900">{"\u5df2\u5b8c\u6210\u4efb\u52a1\u5e93"}</p>
            <span className="text-xs tabular-nums text-stone-500">
              {completedTaskInsights.total} {"\u9879"}
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="shrink-0 rounded-lg px-2 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-950"
            onClick={() => setCompletedLibraryOpen(true)}
          >
            {"\u67e5\u770b"}
            <ChevronDown className="h-3.5 w-3.5 -rotate-90" aria-hidden />
          </Button>
        </div>
      </section>

      <Dialog open={completedLibraryOpen} onOpenChange={setCompletedLibraryOpen}>
        <DialogContent className="h-[calc(100dvh-1rem)] max-h-[860px] w-[calc(100%-1rem)] max-w-6xl grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:w-full sm:!max-w-6xl">
          <DialogHeader className="border-b border-stone-200 bg-white px-5 py-4 pr-12 sm:px-6">
            <DialogTitle className="flex items-center gap-2 text-lg text-stone-950">
              <CheckCircle className="h-5 w-5 text-emerald-600" aria-hidden />
              {"\u5df2\u5b8c\u6210\u4efb\u52a1\u5e93"}
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-0 overflow-y-auto bg-stone-50/80 p-4 sm:p-6">
            {completedTasks.length > 0 ? (
              <div className="grid items-start gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
                <aside className="space-y-4 xl:sticky xl:top-0">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                      <p className="text-[11px] font-medium text-emerald-700">{"\u5f52\u6863\u4efb\u52a1"}</p>
                      <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-950">{completedTaskInsights.total}</p>
                    </div>
                    <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5">
                      <p className="text-[11px] font-medium text-blue-700">{"\u672c\u5468\u5b8c\u6210"}</p>
                      <p className="mt-1 text-2xl font-semibold tabular-nums text-blue-950">{completedTaskInsights.thisWeekCount}</p>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                      <p className="text-[11px] font-medium text-amber-700">{"\u5e73\u5747\u5b8c\u6210\u65f6\u957f"}</p>
                      <p className="mt-1 text-base font-semibold text-amber-950">
                        {formatDurationLabel(completedTaskInsights.averageDurationHours)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-stone-200 bg-white px-3 py-2.5">
                      <p className="text-[11px] font-medium text-stone-600">{"\u65f6\u957f\u6837\u672c"}</p>
                      <p className="mt-1 text-2xl font-semibold tabular-nums text-stone-950">
                        {completedTaskInsights.durationSampleCount}
                      </p>
                    </div>
                  </div>

                  <section className="rounded-lg border border-stone-200 bg-white p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h4 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
                        <CalendarRange className="h-4 w-4 text-emerald-600" />
                        {"\u6bcf\u5468\u5b8c\u6210"}
                      </h4>
                      <span className="text-[11px] text-stone-500">{"\u6700\u8fd1 8 \u5468"}</span>
                    </div>
                    <div className="space-y-2.5">
                      {completedTaskInsights.weeklyStats.map((week) => (
                        <div key={week.weekStart}>
                          <div className="mb-1 flex items-center justify-between gap-3 text-[11px]">
                            <span className="truncate text-stone-500" title={formatWeekRangeLabel(week.weekStart)}>
                              {formatWeekRangeLabel(week.weekStart)}
                            </span>
                            <span className="shrink-0 font-semibold tabular-nums text-stone-800">{week.count}</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
                            <div
                              className="h-full rounded-full bg-emerald-600"
                              style={{
                                width: `${Math.max(8, (week.count / completedTaskInsights.maxWeeklyCount) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-lg border border-stone-200 bg-white p-4">
                    <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-900">
                      <ListTodo className="h-4 w-4 text-blue-600" />
                      {"\u4f18\u5148\u7ea7\u5206\u5e03"}
                    </h4>
                    <div className="space-y-2.5">
                      {completedTaskInsights.priorityStats.map((stat) => (
                        <div key={stat.priority}>
                          <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                            <span className="flex min-w-0 items-center gap-1.5 text-stone-700">
                              {getPriorityIcon(stat.priority)}
                              <span className="truncate">{stat.priority}</span>
                            </span>
                            <span className="shrink-0 font-medium tabular-nums text-stone-800">
                              {stat.count} / {stat.percent}%
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
                            <div
                              className={`h-full rounded-full ${getPriorityVisualStyle(stat.priority).barClassName}`}
                              style={{ width: `${stat.count > 0 ? Math.max(stat.percent, 6) : 0}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </aside>

                <section className="min-w-0 rounded-lg border border-stone-200 bg-white">
                  <div className="flex items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-3">
                    <p className="text-sm font-semibold text-stone-900">{"\u5f52\u6863\u5217\u8868"}</p>
                    <span className="text-xs text-stone-500">{"\u6309\u5b8c\u6210\u65f6\u95f4\u5012\u5e8f"}</span>
                  </div>
                  <ul className="divide-y divide-stone-100">
                    {orderedCompletedTasks.map((task) => {
                      const completedAt = getTaskCompletionDateTime(task);
                      const createdAt = getTaskCreatedDateTime(task);
                      const durationHours = getTaskCompletionDurationHours(task);
                      const completedSubtasks = task.subtasks.filter((subtask) => subtask.done).length;

                      return (
                        <li key={task.id} className="px-4 py-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <button
                              type="button"
                              className="flex min-w-0 flex-1 items-start gap-2 text-left"
                              onClick={() => patchUiPreferences({
                                expandedCompletedTasks: toggleStoredId(
                                  uiPreferences.expandedCompletedTasks,
                                  task.id,
                                ),
                              })}
                            >
                              <ChevronDown
                                className={`mt-0.5 h-4 w-4 shrink-0 text-stone-500 transition-transform ${
                                  expandedCompletedTasks.has(task.id) ? "" : "-rotate-90"
                                }`}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="break-words font-medium text-stone-900 line-through">{task.name}</p>
                                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-stone-500">
                                  <Badge className={`rounded-md border ${getPriorityVisualStyle(task.priority).badgeClassName}`}>
                                    {task.priority}
                                  </Badge>
                                  <span className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-stone-50 px-1.5 py-0.5">
                                    <Clock className="h-3 w-3" />
                                    {"\u5b8c\u6210 "}{formatDateTimeLabel(completedAt)}
                                  </span>
                                  <span className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-stone-50 px-1.5 py-0.5">
                                    {"\u65f6\u957f "}{formatDurationLabel(durationHours)}
                                  </span>
                                </div>
                              </div>
                            </button>
                            <div className="flex shrink-0 items-center gap-1 self-end sm:self-start">
                              <Button type="button" size="sm" variant="ghost" onClick={() => handleOpenEdit(task)}>
                                {"\u7f16\u8f91"}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 rounded-md border-stone-300 px-3 text-xs hover:bg-stone-50"
                                onClick={() => handleMoveBackToIncomplete(task.id)}
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                {"\u79fb\u56de\u672a\u5b8c\u6210"}
                              </Button>
                            </div>
                          </div>
                          {expandedCompletedTasks.has(task.id) ? (
                            <div className="mt-3 space-y-3 rounded-md border border-stone-200 bg-stone-50 p-3">
                              <div className="grid gap-2 text-xs text-stone-600 sm:grid-cols-3">
                                <span>{"\u521b\u5efa\u65f6\u95f4\uff1a"}{formatDateTimeLabel(createdAt)}</span>
                                <span>{"\u5b8c\u6210\u65f6\u95f4\uff1a"}{formatDateTimeLabel(completedAt)}</span>
                                <span>{"\u5b8c\u6210\u65f6\u957f\uff1a"}{formatDurationLabel(durationHours)}</span>
                              </div>
                              <p className="text-xs leading-5 text-stone-600">
                                {"\u5b8c\u6210\u8bb0\u5f55\uff1a"}{task.completionLog || "\u6682\u65e0"}
                              </p>
                              <div className="text-xs text-stone-600">
                                {"\u5b50\u4efb\u52a1\u5b8c\u6210\u60c5\u51b5\uff1a"}
                                {task.subtasks.length === 0 ? (
                                  <span className="ml-1">{"\u65e0\u5b50\u4efb\u52a1"}</span>
                                ) : (
                                  <div className="mt-1 space-y-2">
                                    <span className="inline-flex rounded-md border border-stone-200 bg-white px-2 py-1 text-[11px] text-stone-500">
                                      {completedSubtasks} / {task.subtasks.length}
                                    </span>
                                    <ul className="space-y-1">
                                      {task.subtasks.map((subtask) => (
                                        <li key={subtask.id} className="flex items-center gap-2">
                                          <Checkbox checked={subtask.done} className="h-3.5 w-3.5" />
                                          <span className={subtask.done ? "line-through text-stone-500" : "text-stone-700"}>
                                            {subtask.name}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              </div>
            ) : (
              <div className="grid min-h-72 place-items-center rounded-lg border border-dashed border-stone-300 bg-white p-6 text-center">
                <div>
                  <CheckCircle className="mx-auto h-8 w-8 text-stone-300" aria-hidden />
                  <p className="mt-3 text-sm font-medium text-stone-900">{"\u6682\u65e0\u5df2\u5f52\u6863\u4efb\u52a1"}</p>
                  <p className="mt-1 text-xs text-stone-500">{"\u5b8c\u6210\u957f\u671f\u4efb\u52a1\u540e\uff0c\u8fd9\u91cc\u4f1a\u81ea\u52a8\u4fdd\u5b58\u5b83\u7684\u5b8c\u6210\u4fe1\u606f\u3002"}</p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <DailyTaskPanel
        tasks={tasks}
        events={events}
        onAddTask={(name, dueDate, taskType) => onAddTask(name, dueDate, taskType)}
        onToggleTask={onToggleTask}
        onUpdateTask={onUpdateTask}
        onCreateTimeBlock={onCreateDailyTaskTimeBlock}
        archivedSectionOpen={uiPreferences.dailyArchiveSectionOpen}
        onArchivedSectionOpenChange={(open) => patchUiPreferences({ dailyArchiveSectionOpen: open })}
      />

      <Separator />

      <div className="task-dashboard-section">
        <Collapsible
          open={longTaskSectionOpen}
          onOpenChange={(open) => patchUiPreferences({ longTaskSectionOpen: open })}
        >
          <CollapsibleTrigger className="section-trigger mb-3 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left">
            <span className="text-sm font-semibold text-gray-700">
              长期任务 / 未完成任务
            </span>
            <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${longTaskSectionOpen ? "" : "-rotate-90"}`} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mb-3 flex items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant={taskViewMode === "order" ? "default" : "outline"}
                onClick={() => setTaskViewMode("order")}
              >
                常规
              </Button>
              <Button
                type="button"
                size="sm"
                variant={taskViewMode === "priority" ? "default" : "outline"}
                onClick={() => setTaskViewMode("priority")}
              >
                按优先级分组
              </Button>
              <Button type="button" size="icon-sm" onClick={() => setShowAddTaskDialog(true)} aria-label="添加长期任务" title="添加长期任务">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>

            {taskViewMode === "order" ? (
          <ul className="space-y-2">
            {orderedIncompleteTasks.map((task) => (
              <li
                key={task.id}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => handleDropTask(task.id)}
                className="task-row-card"
              >
                <div className="flex items-start gap-2.5">
                  <button
                    type="button"
                    draggable
                    onDragStart={(event) => handleTaskDragStart(task.id, event)}
                    onDragEnd={() => setDraggingTaskId(null)}
                    className="mt-0.5 rounded-md p-0.5 text-gray-400 hover:bg-stone-100 hover:text-gray-600"
                    aria-label={`拖动排序 ${task.name}`}
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>
                  <Checkbox
                    checked={task.done}
                    onCheckedChange={() => {
                      onToggleTask(task.id);
                      toast.success("任务已标记为完成");
                    }}
                    aria-label={`任务 ${task.name} 的完成状态`}
                    className="mt-1.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-start gap-2">
                      {getPriorityIcon(task.priority)}
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(task)}
                        className="min-w-0 flex-1 break-words text-left text-sm font-semibold leading-5 text-gray-900 hover:text-emerald-800"
                      >
                        {task.name}
                      </button>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1 rounded-md bg-stone-100 px-1.5 py-1 tabular-nums">
                        <Clock className="h-3 w-3" aria-hidden />
                        {task.dueDate}
                      </span>
                      <Badge className={`rounded-md border ${getPriorityVisualStyle(task.priority).badgeClassName}`}>
                        {task.priority}
                      </Badge>
                      {task.uncertainty ? (
                        <span className={cn(
                          "rounded-md border px-1.5 py-1 text-[11px] font-medium",
                          task.uncertainty.level === "high"
                            ? "border-amber-200 bg-amber-50 text-amber-800"
                            : "border-teal-200 bg-teal-50 text-teal-800",
                        )}>
                          {workTypeLabels[task.uncertainty.workType]} · 不确定性{task.uncertainty.level === "high" ? "高" : task.uncertainty.level === "medium" ? "中" : "低"}
                        </span>
                      ) : null}
                      {task.subtasks.length > 0 ? (
                        <button
                          type="button"
                          className="rounded-md px-1.5 py-1 text-[11px] font-medium text-stone-600 hover:bg-stone-100"
                          onClick={() => patchUiPreferences({
                            expandedTasks: toggleStoredId(uiPreferences.expandedTasks, task.id),
                          })}
                        >
                          {expandedTasks.has(task.id) ? "收起子任务" : `子任务 ${task.subtasks.length}`}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 rounded-md hover:bg-red-50 hover:text-red-500"
                    onClick={() => {
                      setPendingDeleteTaskId(task.id);
                      setConfirmDeleteOpen(true);
                    }}
                    aria-label={`删除任务 ${task.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {task.subtasks.length > 0 && expandedTasks.has(task.id) ? (
                  <ul className="mt-2.5 space-y-1.5 rounded-lg border border-stone-200/70 bg-stone-50/70 p-2.5">
                    {task.subtasks.map((subtask) => (
                      <li key={subtask.id} className="flex items-center gap-2 text-xs">
                        <Checkbox
                          checked={subtask.done}
                          onCheckedChange={() => handleToggleTaskSubtask(task.id, subtask.id)}
                          className="h-3.5 w-3.5"
                        />
                        <span className={subtask.done ? "line-through text-gray-500" : "text-gray-700"}>
                          {subtask.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
            ) : (
          <div className="space-y-3">
            {groupedIncompleteTasks.map((group) => (
              <div key={group.priority} className="rounded-xl border border-stone-200/80 bg-white/55 p-3">
                <p className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                  {getPriorityIcon(group.priority)}
                  {group.priority}
                </p>
                {group.items.length === 0 ? (
                  <p className="text-xs text-gray-500">暂无任务</p>
                ) : (
                  <ul className="space-y-1.5">
                    {group.items.map((task) => (
                      <li key={task.id} className="task-group-row">
                        <Checkbox
                          checked={task.done}
                          onCheckedChange={() => onToggleTask(task.id)}
                          aria-label={`任务 ${task.name} 的完成状态`}
                        />
                        <button type="button" className="min-w-0 flex-1 truncate text-left text-sm font-medium text-stone-800" title={task.name} onClick={() => handleOpenEdit(task)}>
                          {task.name}
                        </button>
                        {task.uncertainty ? (
                          <span className="shrink-0 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] text-teal-800">
                            {workTypeLabels[task.uncertainty.workType]}
                          </span>
                        ) : null}
                        <span className="shrink-0 text-xs tabular-nums text-gray-500">{task.dueDate}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
            )}
            {orderedIncompleteTasks.length === 0 && (
              <p className="mt-4 border border-gray-200 rounded-lg p-4 text-sm text-gray-500 text-center">当前没有未完成长期任务</p>
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>

      <Separator />

      <div className="task-dashboard-section utility-panel-grid">
      <div className="utility-panel-controls">
        <div className="utility-panel-tabs" role="tablist" aria-label="打卡、成就与足迹栏目">
          <button
            type="button"
            role="tab"
            aria-selected={activeUtilityPanel === "project"}
            className={`utility-panel-tab ${activeUtilityPanel === "project" ? "utility-panel-tab-active" : ""}`}
            onClick={() => setUtilityPanel("project", activeUtilityPanel !== "project")}
          >
            <KanbanSquare className="h-4 w-4 shrink-0" />
            <span className="truncate">项目</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeUtilityPanel === "routine"}
            className={`utility-panel-tab ${activeUtilityPanel === "routine" ? "utility-panel-tab-active" : ""}`}
            onClick={() => setUtilityPanel("routine", activeUtilityPanel !== "routine")}
          >
            <Clock className="h-4 w-4 shrink-0" />
            <span className="truncate">日常</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeUtilityPanel === "achievement"}
            className={`utility-panel-tab ${activeUtilityPanel === "achievement" ? "utility-panel-tab-active" : ""}`}
            onClick={() => setUtilityPanel("achievement", activeUtilityPanel !== "achievement")}
          >
            <Trophy className="h-4 w-4 shrink-0" />
            <span className="truncate">成就</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeUtilityPanel === "footprint"}
            className={`utility-panel-tab ${activeUtilityPanel === "footprint" ? "utility-panel-tab-active" : ""}`}
            onClick={() => setUtilityPanel("footprint", activeUtilityPanel !== "footprint")}
          >
            <Footprints className="h-4 w-4 shrink-0" />
            <span className="truncate">足迹</span>
          </button>
        </div>
        {activeUtilityPanel ? (
          <Button type="button" size="icon" className="utility-panel-add shrink-0" onClick={handleAddUtilityItem} aria-label="添加当前栏目项目" title="添加当前栏目项目">
            <Plus className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      {showProjectSection ? (
      <section className="utility-panel utility-panel-project">
        <Collapsible
          className="utility-panel-root"
          open={activeUtilityPanel === "project"}
          onOpenChange={(open) => setUtilityPanel("project", open)}
        >
          <CollapsibleContent className="utility-panel-content mt-3 space-y-3">
            <div className="space-y-3">
              {visibleProjectCheckins.map((project) => {
                const projectExpanded = expandedProjects.has(project.id);
            const today = getTodayISODate();
            const doneCount = project.checkins.length;
            const trackedStartDate = project.checkins.reduce(
              (earliestDate, entry) => (entry.date < earliestDate ? entry.date : earliestDate),
              project.startDate,
            );
            const totalDays = daysBetweenInclusive(trackedStartDate, today);
            const percent = Math.min(100, Math.round((doneCount / Math.max(1, totalDays)) * 100));
            const recentCheckins = [...project.checkins]
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 5);
            return (
              <div key={project.id} className="rounded-lg border border-gray-200 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    onClick={() => patchUiPreferences({
                      expandedProjects: toggleStoredId(uiPreferences.expandedProjects, project.id),
                    })}
                  >
                    <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${projectExpanded ? "" : "-rotate-90"}`} />
                    <p className="truncate text-sm font-medium" title={project.name}>
                      {project.name}
                    </p>
                  </button>
                  <div className="flex items-center gap-1">
                    <Button type="button" size="sm" variant="ghost" onClick={() => openEditProject(project)}>
                      编辑
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        withOptionalConfirm("确认删除这个项目以及其全部打卡记录吗？", () =>
                          handleDeleteProject(project.id),
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {projectExpanded ? (
                  <>
                    {project.description ? <p className="mb-2 text-xs text-gray-500">{project.description}</p> : null}
                    <div className="mb-2 h-2 rounded bg-gray-100">
                      <div className="h-2 rounded bg-black" style={{ width: `${percent}%` }} />
                    </div>
                    <p className="mb-2 text-xs text-gray-600">
                      进度：{doneCount}/{totalDays}（{percent}%）
                    </p>
                    <div className="grid gap-2 rounded-lg border border-gray-200 bg-gray-50/70 p-2 sm:grid-cols-[150px_minmax(0,1fr)_auto] sm:items-end">
                      <div className="space-y-1">
                        <Label className="text-[11px] font-medium text-gray-600">打卡日期</Label>
                        <Input
                          type="date"
                          value={projectDateDraft[project.id] ?? todayDate}
                          max={todayDate}
                          onChange={(event) =>
                            setProjectDateDraft((prev) => ({ ...prev, [project.id]: event.target.value }))
                          }
                          aria-label={`${project.name} 打卡日期`}
                          className="h-9 bg-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] font-medium text-gray-600">打卡描述</Label>
                        <Input
                          value={projectNoteDraft[project.id] ?? ""}
                          onChange={(event) =>
                            setProjectNoteDraft((prev) => ({ ...prev, [project.id]: event.target.value }))
                          }
                          placeholder="可选"
                          className="h-9 bg-white"
                        />
                      </div>
                      <Button type="button" size="sm" className="h-9" onClick={() => handleProjectCheckin(project.id)}>
                        {(projectDateDraft[project.id] ?? todayDate) === todayDate ? "打卡" : "补打"}
                      </Button>
                    </div>

                    <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-2">
                      <p className="mb-1 text-xs font-medium text-gray-600">最近打卡记录</p>
                      {recentCheckins.length === 0 ? (
                        <p className="text-xs text-gray-500">暂无记录</p>
                      ) : (
                        <ul className="space-y-1">
                          {recentCheckins.map((entry) => (
                            <li key={`${project.id}-${entry.date}`} className="text-xs text-gray-700">
                              <span className="font-medium">{entry.date}</span>
                              <span className="mx-1">·</span>
                              <span className="inline-block max-w-[220px] truncate align-bottom" title={entry.note || "（无描述）"}>
                                {entry.note || "（无描述）"}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-2 w-full"
                      onClick={() => setHistoryProjectId(project.id)}
                    >
                      查看全部打卡历史
                    </Button>
                  </>
                ) : null}
              </div>
            );
              })}
              {visibleProjectCheckins.length === 0 ? <p className="text-xs text-gray-500">暂无项目打卡项</p> : null}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </section>
      ) : null}

      <section className="utility-panel utility-panel-routine">
        <Collapsible
          className="utility-panel-root"
          open={activeUtilityPanel === "routine"}
          onOpenChange={(open) => setUtilityPanel("routine", open)}
        >
          <CollapsibleContent className="utility-panel-content mt-3 space-y-3">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                  今日打卡
                </p>
                <span className="rounded-full bg-white px-2 py-1 text-[11px] font-medium text-emerald-700">
                  {completedDailyCheckinCount}/{dailyCheckinEntries.length}
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-emerald-700">
                今日记录只属于 {todayDate}；跨过当天后，列表会自动重新开始，旧日期会进入归档。
              </p>

              {showRoutineCheckinForm ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_104px_auto]">
                  <Input
                    value={getDailyCheckinDraft(routineProject.id).label}
                    onChange={(event) =>
                      patchDailyCheckinDraft(routineProject.id, { label: event.target.value })
                    }
                    placeholder="喝水 / 站立"
                    aria-label="新日常打卡名称"
                  />
                  <Input
                    type="time"
                    value={getDailyCheckinDraft(routineProject.id).time}
                    onChange={(event) =>
                      patchDailyCheckinDraft(routineProject.id, { time: event.target.value })
                    }
                    aria-label="新日常打卡时间"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleAddDailyCheckin(routineProject)}
                    disabled={
                      !getDailyCheckinDraft(routineProject.id).label.trim() ||
                      !getDailyCheckinDraft(routineProject.id).time.trim()
                    }
                  >
                    保存
                  </Button>
                </div>
              ) : null}

              {dailyCheckinEntries.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {dailyCheckinEntries.map(({ project, slot }) => {
                    const checked = (project.dailyCompletions ?? []).some(
                      (completion) => completion.date === todayDate && completion.slotId === slot.id,
                    );
                    const fromProject = project.id !== ROUTINE_CHECKIN_PROJECT_ID;
                    return (
                      <div
                        key={`${project.id}-${slot.id}`}
                        className="flex items-center gap-2 rounded-lg border border-white/80 bg-white/70 px-2 py-2"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) =>
                            handleToggleDailyCheckin(project, slot.id, value === true)
                          }
                          aria-label={`${slot.time} ${slot.label} 打卡状态`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-900">{slot.label}</p>
                          <p className="text-xs tabular-nums text-gray-500">
                            {slot.time}
                            {fromProject ? ` · 来自 ${project.name}` : ""}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0 rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600"
                          onClick={() =>
                            withOptionalConfirm("确认删除这个日常打卡时间点吗？", () =>
                              handleDeleteDailyCheckin(project, slot.id),
                            )
                          }
                          aria-label={`删除 ${slot.time} ${slot.label}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-3 rounded-lg border border-dashed border-emerald-200 bg-white/60 px-3 py-2 text-xs text-emerald-700">
                  还没有日常打卡任务。可以添加 07:50 喝水、08:40 站立这类固定时间点。
                </p>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white/80 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-700">
                  <CalendarRange className="h-4 w-4 text-gray-500" />
                  历史归档
                </p>
                <span className="text-[11px] text-gray-500">按日期自动整理</span>
              </div>

              {dailyCheckinArchive.length > 0 ? (
                <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                  {dailyCheckinArchive.map((day) => (
                    <div key={day.date} className="rounded-lg border border-gray-200 bg-gray-50/70 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-gray-800">{day.date}</p>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-gray-600">
                          {day.completedCount}/{day.totalCount}
                        </span>
                      </div>
                      <div className="mt-2 space-y-1">
                        {day.entries.map((entry) => (
                          <div
                            key={entry.id}
                            className="flex items-center justify-between gap-2 rounded-md bg-white px-2 py-1.5"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium text-gray-800">{entry.label}</p>
                              <p className="text-[11px] tabular-nums text-gray-500">
                                {entry.time}
                                {entry.projectName ? ` · 来自 ${entry.projectName}` : ""}
                              </p>
                            </div>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                entry.completed
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-gray-100 text-gray-400"
                              }`}
                            >
                              {entry.completed ? "已打卡" : "未打卡"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-500">
                  还没有过往归档。今天完成的勾选会按日期保存，明天会在这里看到今天的记录。
                </p>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </section>

      <section className="utility-panel utility-panel-achievement">
        <Collapsible
          className="utility-panel-root"
          open={activeUtilityPanel === "achievement"}
          onOpenChange={(open) => setUtilityPanel("achievement", open)}
        >
          <CollapsibleContent className="utility-panel-content mt-3 space-y-3">
            {groupedAchievements.length === 0 ? (
              <p className="rounded-lg border border-gray-200 p-4 text-sm text-gray-500">
                暂无成就记录。可以把今天完成的重要进展记下来。
              </p>
            ) : (
              <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
                {groupedAchievements.map(([date, items]) => (
                  <div key={date} className="rounded-lg border border-gray-200 bg-white/70">
                    <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700">
                      {date}
                    </div>
                    <ul className="divide-y divide-gray-100">
                      {items.map((item) => (
                        <li key={item.id} className="flex items-start justify-between gap-2 px-3 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="break-words text-sm font-medium text-gray-900">
                              {item.title}
                            </p>
                            {item.note ? (
                              <p className="mt-1 whitespace-pre-wrap break-words text-xs text-gray-600">
                                {item.note}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 rounded-md hover:bg-gray-100"
                              onClick={() => openEditAchievement(item)}
                              aria-label={`编辑成就 ${item.title}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 rounded-md hover:bg-red-50 hover:text-red-600"
                              onClick={() =>
                                withOptionalConfirm("确认删除这条成就记录吗？", () =>
                                  onDeleteAchievement(item.id),
                                )
                              }
                              aria-label={`删除成就 ${item.title}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </section>

      <section className="utility-panel utility-panel-footprint">
        <Collapsible
          className="utility-panel-root"
          open={activeUtilityPanel === "footprint"}
          onOpenChange={(open) => setUtilityPanel("footprint", open)}
        >
          <CollapsibleContent className="utility-panel-content mt-3 space-y-3">
            {footprints.length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-200 bg-white/70 px-3 py-4 text-sm text-gray-500">
                暂无足迹项目，点击添加开始跟踪。
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {footprints.map((item) => {
                  const itemExpanded = expandedFootprints.has(item.id);
                  const days = daysSince(item.lastDate);
                  const dayLabel = days === 0 ? "今天" : `${days} 天`;
                  return (
                    <div key={item.id} className="rounded-xl border border-gray-200 bg-white/80 p-3 text-center">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-2 text-left"
                        onClick={() => patchUiPreferences({
                          expandedFootprints: toggleStoredId(uiPreferences.expandedFootprints, item.id),
                        })}
                      >
                        <p className="truncate text-sm font-medium" title={item.name}>{item.name}</p>
                        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${itemExpanded ? "" : "-rotate-90"}`} />
                      </button>
                      {itemExpanded ? (
                        <div className="mt-3 space-y-2">
                          <p className="text-lg font-semibold">{dayLabel}</p>
                          <p className="text-xs text-gray-500">距上次记录</p>
                          <div className="flex flex-wrap justify-center gap-1">
                            <Button type="button" size="sm" variant="outline" onClick={() => handleResetFootprint(item.id)}>今天重置</Button>
                            <Button type="button" size="sm" variant="ghost" onClick={() => openEditFootprint(item)}>编辑</Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-red-500 hover:text-red-600"
                              onClick={() => withOptionalConfirm("确认删除这个足迹项吗？", () => onDeleteFootprint(item.id))}
                            >
                              删除
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </section>
      </div>

      <Separator />

      <div className="task-dashboard-section">
        <Collapsible
          open={annualSectionOpen}
          onOpenChange={(open) => patchUiPreferences({ annualSectionOpen: open })}
        >
          <CollapsibleTrigger className="section-trigger mb-3 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left">
            <span className="text-sm font-semibold text-gray-700">年度任务清单</span>
            <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${annualSectionOpen ? "" : "-rotate-90"}`} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mb-3 flex items-center gap-1.5">
              <Button type="button" size="icon-sm" onClick={() => setShowAddAnnualDialog(true)} aria-label="添加年度任务" title="添加年度任务">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-3 rounded-2xl subtle-card p-3">
              {annualTasks.length > 0 ? (
                <ul className="max-h-56 space-y-1.5 overflow-y-auto pr-1 text-sm">
                {annualTasks.map((item) => (
                  <li
                    key={item.id}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => handleAnnualTaskDrop(item.id)}
                    className="annual-task-row"
                  >
                    <button
                      type="button"
                      draggable
                      onDragStart={() => setDraggingAnnualTaskId(item.id)}
                      onDragEnd={() => setDraggingAnnualTaskId(null)}
                      className="mt-0.5 shrink-0 rounded p-0.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                      aria-label={`拖动排序年度任务 ${item.name}`}
                    >
                      <GripVertical className="h-4 w-4" />
                    </button>
                    <Checkbox
                      checked={item.done}
                      onCheckedChange={() => onToggleAnnualTask(item.id)}
                      className="mt-0.5"
                      aria-label={`年度任务 ${item.name} 完成状态`}
                    />
                    <button
                      type="button"
                      onClick={() => openEditAnnualTask(item)}
                      className={`min-w-0 flex-1 leading-snug [overflow-wrap:anywhere] break-words ${
                        item.done ? "text-left text-gray-500 line-through" : "text-left text-gray-900"
                      }`}
                    >
                      {item.name}
                    </button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      className="mt-0.5 shrink-0 rounded-md text-stone-500 hover:bg-stone-100"
                      onClick={() => openEditAnnualTask(item)}
                      aria-label={`编辑年度任务 ${item.name}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="mt-0.5 h-7 w-7 shrink-0 rounded-md hover:bg-red-50 hover:text-red-500"
                      onClick={() => {
                        onDeleteAnnualTask(item.id);
                        toast.success("已从年度清单移除");
                      }}
                      aria-label={`删除年度任务 ${item.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
                </ul>
              ) : (
                <p className="text-center text-sm text-gray-500">尚未添加年度任务。</p>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {showFootprintsSection ? (
        <>
          <Separator />

          <section className="task-dashboard-section space-y-4">
            <Collapsible
              open={footprintSectionOpen}
              onOpenChange={(open) => patchUiPreferences({ footprintSectionOpen: open })}
            >
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-left">
                <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
                  <Footprints className="h-4 w-4 text-primary" />
                  足迹跟踪栏
                </h3>
                <ChevronDown
                  className={`h-4 w-4 text-gray-500 transition-transform ${
                    footprintSectionOpen ? "" : "-rotate-90"
                  }`}
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-3">
                <div className="flex justify-end">
                  <Button type="button" size="icon-sm" onClick={() => setShowAddFootprintDialog(true)} aria-label="添加足迹项" title="添加足迹项">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {footprints.map((item) => {
                    const itemExpanded = expandedFootprints.has(item.id);
                    const days = daysSince(item.lastDate);
                    const dayLabel = days === 0 ? "今天" : `${days} 天`;
                    return (
                      <div key={item.id} className="rounded-lg border border-gray-200 p-3 text-center">
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-2 text-left"
                          onClick={() => patchUiPreferences({
                            expandedFootprints: toggleStoredId(uiPreferences.expandedFootprints, item.id),
                          })}
                        >
                          <p className="truncate text-sm font-medium" title={item.name}>
                            {item.name}
                          </p>
                          <ChevronDown
                            className={`h-4 w-4 text-gray-500 transition-transform ${
                              itemExpanded ? "" : "-rotate-90"
                            }`}
                          />
                        </button>
                        {itemExpanded ? (
                          <>
                            <p className="mt-2 text-lg font-semibold">{dayLabel}</p>
                            <p className="text-xs text-gray-500">距上次</p>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="mt-2"
                              onClick={() => handleResetFootprint(item.id)}
                            >
                              今天重置
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="mt-1"
                              onClick={() => openEditFootprint(item)}
                            >
                              编辑
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="mt-1 text-xs text-red-500 hover:text-red-600"
                              onClick={() =>
                                withOptionalConfirm("确认删除这个足迹项吗？", () => onDeleteFootprint(item.id))
                              }
                            >
                              删除
                            </Button>
                          </>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </section>
        </>
      ) : null}

      <Dialog open={showAddTaskDialog} onOpenChange={setShowAddTaskDialog}>
        <DialogContent className="rounded-sm border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-sm">新增长期任务</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={taskName}
              onChange={(event) => setTaskName(event.target.value)}
              placeholder="输入任务名称"
            />
            <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            <Button type="button" className="w-full" onClick={handleAddTask}>
              添加任务
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddAnnualDialog} onOpenChange={setShowAddAnnualDialog}>
        <DialogContent className="rounded-sm border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-sm">新增年度任务</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={annualTaskName}
              onChange={(event) => setAnnualTaskName(event.target.value)}
              placeholder="输入本年度目标或大事（如：考证、旅行计划）"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleAddAnnual();
                }
              }}
            />
            <Button type="button" className="w-full" onClick={handleAddAnnual}>
              添加年度任务
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editingAnnualTaskId)}
        onOpenChange={(open) => !open && setEditingAnnualTaskId(null)}
      >
        <DialogContent>
          <DialogHeader><DialogTitle>编辑年度任务</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input
              value={editingAnnualTaskName}
              onChange={(event) => setEditingAnnualTaskName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") saveAnnualTaskName();
              }}
              aria-label="年度任务名称"
            />
            <Button type="button" className="w-full" onClick={saveAnnualTaskName}>保存修改</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddProjectDialog} onOpenChange={setShowAddProjectDialog}>
        <DialogContent className="rounded-sm border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-sm">新增项目打卡项</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={newProjectName}
              onChange={(event) => setNewProjectName(event.target.value)}
              placeholder="项目名（如：每天喝水）"
            />
            <Textarea
              value={newProjectDesc}
              onChange={(event) => setNewProjectDesc(event.target.value)}
              placeholder="项目描述（可选）"
              className="min-h-20"
            />
            <Button type="button" className="w-full" onClick={handleAddProject}>
              添加项目
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showAchievementDialog}
        onOpenChange={(open) => {
          setShowAchievementDialog(open);
          if (!open) setEditingAchievementId(null);
        }}
      >
        <DialogContent className="rounded-sm border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {editingAchievement ? "编辑成就" : "新增成就"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="task-dashboard-achievement-date">日期</Label>
              <Input
                id="task-dashboard-achievement-date"
                type="date"
                value={achievementForm.date}
                onChange={(event) =>
                  setAchievementForm((prev) => ({ ...prev, date: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="task-dashboard-achievement-title">成就内容</Label>
              <Input
                id="task-dashboard-achievement-title"
                value={achievementForm.title}
                onChange={(event) =>
                  setAchievementForm((prev) => ({ ...prev, title: event.target.value }))
                }
                placeholder="输入成就"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="task-dashboard-achievement-note">备注（可选）</Label>
              <Textarea
                id="task-dashboard-achievement-note"
                value={achievementForm.note}
                onChange={(event) =>
                  setAchievementForm((prev) => ({ ...prev, note: event.target.value }))
                }
                placeholder="补充说明、感受、证据链接等"
                className="min-h-24"
              />
            </div>
            <Button type="button" className="w-full" onClick={handleSaveAchievement}>
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddFootprintDialog} onOpenChange={setShowAddFootprintDialog}>
        <DialogContent className="rounded-sm border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-sm">新增足迹项</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={newFootprintName}
              onChange={(event) => setNewFootprintName(event.target.value)}
              placeholder="足迹名（如：换牙刷）"
            />
            <Button type="button" className="w-full" onClick={handleAddFootprint}>
              添加足迹
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(historyProject)} onOpenChange={(open) => !open && setHistoryProjectId(null)}>
        {historyProject ? (
          <DialogContent className="rounded-sm border-gray-200">
            <DialogHeader>
              <DialogTitle className="text-sm">
                {historyProject.name} · 全部打卡历史
              </DialogTitle>
            </DialogHeader>
            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {[...historyProject.checkins]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((entry, index) => (
                  <div
                    key={`${historyProject.id}-${entry.date}-${index}`}
                    className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
                  >
                    <p className="text-xs font-medium text-gray-700">{entry.date}</p>
                    <div className="mt-1 flex gap-2">
                      <Input
                        value={checkinDrafts[`${historyProject.id}__${entry.date}`] ?? entry.note}
                        onChange={(event) =>
                          setCheckinDrafts((prev) => ({
                            ...prev,
                            [`${historyProject.id}__${entry.date}`]: event.target.value,
                          }))
                        }
                        placeholder="打卡描述"
                        className="h-8 text-xs"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() =>
                          onUpdateProjectCheckinEntry(
                            historyProject.id,
                            entry.date,
                            checkinDrafts[`${historyProject.id}__${entry.date}`] ?? entry.note,
                          )
                        }
                      >
                        保存
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-red-600"
                        onClick={() =>
                          withOptionalConfirm("确认删除这条打卡记录吗？", () =>
                            onDeleteProjectCheckinEntry(historyProject.id, entry.date),
                          )
                        }
                      >
                        删除
                      </Button>
                    </div>
                  </div>
                ))}
              {historyProject.checkins.length === 0 ? (
                <p className="rounded-md border border-gray-200 p-3 text-sm text-gray-500">
                  暂无打卡记录
                </p>
              ) : null}
            </div>
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog open={Boolean(editingProjectId)} onOpenChange={(open) => !open && setEditingProjectId(null)}>
        <DialogContent className="rounded-sm border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-sm">编辑项目</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={editingProjectName}
              onChange={(event) => setEditingProjectName(event.target.value)}
              placeholder="项目名称"
            />
            <Textarea
              value={editingProjectDesc}
              onChange={(event) => setEditingProjectDesc(event.target.value)}
              placeholder="项目描述"
              className="min-h-20"
            />
            <Button type="button" className="w-full" onClick={saveEditProject}>
              保存修改
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editingFootprint)}
        onOpenChange={(open) => !open && setEditingFootprintId(null)}
      >
        <DialogContent className="rounded-sm border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-sm">编辑足迹</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={editingFootprintName}
              onChange={(event) => setEditingFootprintName(event.target.value)}
              placeholder="足迹名称"
            />
            <Input
              type="date"
              value={editingFootprintDate}
              onChange={(event) => setEditingFootprintDate(event.target.value)}
            />
            <Button type="button" className="w-full" onClick={saveEditFootprint}>
              保存修改
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editingTask)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingTaskId(null);
            setTaskDraft(null);
          }
        }}
      >
        {editingTask && taskDraft && (
          <DialogContent className="flex max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-sm border-gray-200 p-0 sm:max-w-xl">
            <DialogHeader className="shrink-0 border-b border-gray-200 bg-white px-5 py-4 pr-12">
              <DialogTitle className="text-sm">编辑长期任务详情</DialogTitle>
            </DialogHeader>
            <div className="min-h-0 space-y-3 overflow-y-auto px-5 py-4">
              <div className="flex justify-end">
                <ContextBadge
                  source={{
                    kind: "task",
                    id: taskDraft.id,
                    title: taskDraft.name,
                    priority: taskDraft.priority,
                    dueDate: taskDraft.dueDate,
                    done: taskDraft.done,
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="task-edit-name">任务名称</Label>
                <Input
                  id="task-edit-name"
                  value={taskDraft.name}
                  onChange={(event) =>
                    setTaskDraft((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                  }
                  className="rounded-sm border-gray-200"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="task-edit-date">截止日期</Label>
                <Input
                  id="task-edit-date"
                  type="date"
                  value={taskDraft.dueDate}
                  onChange={(event) =>
                    setTaskDraft((prev) => (prev ? { ...prev, dueDate: event.target.value } : prev))
                  }
                  className="rounded-sm border-gray-200"
                />
              </div>
              <div className="space-y-1">
                <Label>任务优先级</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "紧急且重要" as Priority, label: "紧急且重要" },
                    { value: "紧急不重要" as Priority, label: "紧急不重要" },
                    { value: "不紧急重要" as Priority, label: "不紧急重要" },
                    { value: "不紧急不重要" as Priority, label: "不紧急不重要" },
                  ].map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant={taskDraft.priority === option.value ? "default" : "outline"}
                      className={`rounded-sm ${taskDraft.priority === option.value ? "bg-black text-white" : "border-gray-300"}`}
                      onClick={() =>
                        setTaskDraft((prev) => (prev ? { ...prev, priority: option.value } : prev))
                      }
                    >
                      <div className="flex items-center gap-2">
                        {getPriorityIcon(option.value)}
                        <span>{option.label}</span>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-teal-900/15 bg-teal-50/45 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label>不确定性任务模型</Label>
                    <p className="mt-0.5 text-xs text-stone-500">用于研究、分析和写作等无法精确估时的任务</p>
                  </div>
                  <Switch
                    checked={taskDraft.uncertaintyEnabled}
                    onCheckedChange={(checked) =>
                      setTaskDraft((prev) => prev ? { ...prev, uncertaintyEnabled: checked } : prev)
                    }
                  />
                </div>
                {taskDraft.uncertaintyEnabled ? (
                  <div className="mt-3 space-y-3 border-t border-teal-900/10 pt-3">
                    {editingTaskDeviationInsight ? (
                      <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
                        历史 {editingTaskDeviationInsight.sampleSize} 次“{workTypeLabels[taskDraft.workType]}”记录平均为计划的
                        <span className="mx-1 font-semibold">{editingTaskDeviationInsight.averageMultiplier} 倍</span>
                        ，平均偏差 {editingTaskDeviationInsight.averageDeltaMinutes > 0 ? "+" : ""}{editingTaskDeviationInsight.averageDeltaMinutes} 分钟。
                      </div>
                    ) : (
                      <p className="rounded-lg bg-white/70 px-3 py-2 text-xs text-stone-500">尚无同类型执行样本，完成任务后记录计划与实际时长即可开始学习。</p>
                    )}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor="task-uncertainty-level">不确定性等级</Label>
                        <select
                          id="task-uncertainty-level"
                          className="h-9 w-full rounded-md border border-stone-200 bg-white px-3 text-sm"
                          value={taskDraft.uncertaintyLevel}
                          onChange={(event) => setTaskDraft((prev) => prev ? { ...prev, uncertaintyLevel: event.target.value as TaskUncertaintyLevel } : prev)}
                        >
                          {Object.entries(uncertaintyLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="task-work-type">工作类型</Label>
                        <select
                          id="task-work-type"
                          className="h-9 w-full rounded-md border border-stone-200 bg-white px-3 text-sm"
                          value={taskDraft.workType}
                          onChange={(event) => setTaskDraft((prev) => prev ? { ...prev, workType: event.target.value as KnowledgeWorkType } : prev)}
                        >
                          {Object.entries(workTypeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1"><Label htmlFor="task-estimate-min">最少时间（分钟）</Label><Input id="task-estimate-min" type="number" min="0" value={taskDraft.estimateMinMinutes} onChange={(event) => setTaskDraft((prev) => prev ? { ...prev, estimateMinMinutes: event.target.value } : prev)} /></div>
                      <div className="space-y-1"><Label htmlFor="task-estimate-max">最多时间（分钟）</Label><Input id="task-estimate-max" type="number" min="0" value={taskDraft.estimateMaxMinutes} onChange={(event) => setTaskDraft((prev) => prev ? { ...prev, estimateMaxMinutes: event.target.value } : prev)} /></div>
                    </div>
                    <div className="space-y-1"><Label htmlFor="task-min-validation">最小验证步骤</Label><Input id="task-min-validation" value={taskDraft.minimumValidationStep} onChange={(event) => setTaskDraft((prev) => prev ? { ...prev, minimumValidationStep: event.target.value } : prev)} placeholder="先用最小样本验证最关键的未知项" /></div>
                    <div className="space-y-1"><Label htmlFor="task-success-criteria">成功判定标准</Label><Textarea id="task-success-criteria" className="min-h-16 bg-white" value={taskDraft.successCriteria} onChange={(event) => setTaskDraft((prev) => prev ? { ...prev, successCriteria: event.target.value } : prev)} /></div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1"><Label htmlFor="task-unknowns">当前未知项（每行一项）</Label><Textarea id="task-unknowns" className="min-h-20 bg-white" value={taskDraft.unknownsText} onChange={(event) => setTaskDraft((prev) => prev ? { ...prev, unknownsText: event.target.value } : prev)} /></div>
                      <div className="space-y-1"><Label htmlFor="task-branches">可能分支（每行一项）</Label><Textarea id="task-branches" className="min-h-20 bg-white" value={taskDraft.branchOptionsText} onChange={(event) => setTaskDraft((prev) => prev ? { ...prev, branchOptionsText: event.target.value } : prev)} /></div>
                    </div>
                    <div className="space-y-1"><Label htmlFor="task-stop-condition">停止或转向条件</Label><Input id="task-stop-condition" value={taskDraft.stopCondition} onChange={(event) => setTaskDraft((prev) => prev ? { ...prev, stopCondition: event.target.value } : prev)} /></div>
                  </div>
                ) : null}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>子任务</Label>
                  <TaskDecompositionDialog
                    task={{
                      id: taskDraft.id,
                      name: taskDraft.name,
                      dueDate: taskDraft.dueDate,
                      done: taskDraft.done,
                      notes: taskDraft.notes,
                      precautions: taskDraft.precautionsText
                        .split("\n")
                        .map((item) => item.trim())
                        .filter(Boolean),
                      completionLog: taskDraft.completionLog,
                      priority: taskDraft.priority,
                      subtasks: taskDraft.subtasks,
                      taskType: editingTask.taskType,
                      isTodayFocus: editingTask.isTodayFocus,
                      uncertainty: editingTask.uncertainty,
                    }}
                    onImport={(names) =>
                      setTaskDraft((prev) =>
                        prev
                          ? {
                              ...prev,
                              subtasks: [
                                ...prev.subtasks,
                                ...names.map((name, index) => ({
                                  id: `ai-subtask-${Date.now()}-${index}`,
                                  name,
                                  done: false,
                                })),
                              ],
                            }
                          : prev,
                      )
                    }
                  />
                </div>
                <div className="space-y-2 border border-gray-200 p-3 rounded-sm">
                  {taskDraft.subtasks.map((subtask) => (
                    <div key={subtask.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={subtask.done}
                        onCheckedChange={() => handleToggleSubtask(subtask.id)}
                        className="h-3.5 w-3.5"
                      />
                      <span className={subtask.done ? "text-gray-500 line-through text-sm" : "text-black text-sm"}>
                        {subtask.name}
                      </span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 rounded-sm ml-auto"
                        onClick={() => handleDeleteSubtask(subtask.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      value={taskDraft.newSubtaskName}
                      onChange={(event) =>
                        setTaskDraft((prev) => (prev ? { ...prev, newSubtaskName: event.target.value } : prev))
                      }
                      placeholder="输入子任务名称"
                      className="rounded-sm border-gray-200 text-sm"
                    />
                    <Button
                      type="button"
                      onClick={handleAddSubtask}
                      className="rounded-sm bg-black text-white hover:bg-black/90"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="task-edit-notes">记录情况</Label>
                <Textarea
                  id="task-edit-notes"
                  value={taskDraft.notes}
                  onChange={(event) =>
                    setTaskDraft((prev) => (prev ? { ...prev, notes: event.target.value } : prev))
                  }
                  className="min-h-20 rounded-sm border-gray-200"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="task-edit-precautions">注意事项（每行一条）</Label>
                <Textarea
                  id="task-edit-precautions"
                  value={taskDraft.precautionsText}
                  onChange={(event) =>
                    setTaskDraft((prev) => (prev ? { ...prev, precautionsText: event.target.value } : prev))
                  }
                  className="min-h-20 rounded-sm border-gray-200"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="task-edit-completion-log">完成记录</Label>
                <Textarea
                  id="task-edit-completion-log"
                  value={taskDraft.completionLog}
                  onChange={(event) =>
                    setTaskDraft((prev) => (prev ? { ...prev, completionLog: event.target.value } : prev))
                  }
                  className="min-h-20 rounded-sm border-gray-200"
                />
              </div>
              <div className="flex items-center justify-between rounded-sm border border-gray-200 px-3 py-2">
                <span className="text-sm">标记为完成</span>
                <Switch
                  checked={taskDraft.done}
                  onCheckedChange={(checked) =>
                    setTaskDraft((prev) => (prev ? { ...prev, done: checked } : prev))
                  }
                />
              </div>
              <Button
                type="button"
                onClick={handleSaveTask}
                className="w-full rounded-sm bg-black text-white hover:bg-black/90"
              >
                保存任务
              </Button>
              {onRecordTaskOutcome ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full rounded-sm border-emerald-200 bg-emerald-50/60 text-emerald-900 hover:bg-emerald-100"
                  onClick={() => {
                    onRecordTaskOutcome(editingTask.id);
                    setEditingTaskId(null);
                    setTaskDraft(null);
                  }}
                >
                  <FileCheck2 className="size-4" />
                  记录执行结果与证据
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-sm border-gray-300"
                onClick={() => {
                  setPendingDeleteTaskId(editingTask.id);
                  setConfirmDeleteOpen(true);
                }}
              >
                删除该任务
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent className="rounded-sm border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-sm">确认删除任务？</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">删除后将无法恢复，请确认是否继续。</p>
          <div className="mt-2 flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-sm border-gray-300"
              onClick={() => setConfirmDeleteOpen(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              className="flex-1 rounded-sm bg-black text-white hover:bg-black/90"
              onClick={handleConfirmDeleteTask}
            >
              确认删除
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {confirmState ? (
        <ConfirmDialog
          open={confirmState.open}
          onOpenChange={(open) => setConfirmState(open ? confirmState : null)}
          title={confirmState.title}
          description={confirmState.description}
          confirmLabel="确认"
          onConfirm={confirmState.onConfirm}
        />
      ) : null}
    </aside>
  );
}
