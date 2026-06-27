"use client";

import React, { useMemo, useState } from "react";
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
  type LongTask,
  type Priority,
  type ProjectCheckin,
  type SubTask,
} from "@/lib/types";
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

type TaskDashboardProps = {
  tasks: LongTask[];
  onToggleTask: (taskId: string) => void;
  onAddTask: (name: string, dueDate: string) => void;
  onUpdateTask: (taskId: string, patch: Partial<LongTask>) => void;
  onDeleteTask: (taskId: string) => void;
  onReorderTask: (sourceTaskId: string, targetTaskId: string) => void;
  annualTasks: AnnualTask[];
  onAddAnnualTask: (name: string) => void;
  onToggleAnnualTask: (taskId: string) => void;
  onDeleteAnnualTask: (taskId: string) => void;
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
};

const PRIORITY_ORDER: Priority[] = ["紧急且重要", "紧急不重要", "不紧急重要", "不紧急不重要"];

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

function getTodayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetweenInclusive(startIso: string, endIso: string) {
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);
  const ms = Math.max(0, end.getTime() - start.getTime());
  return Math.floor(ms / (24 * 60 * 60 * 1000)) + 1;
}

function isValidTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function TaskDashboard({
  tasks,
  onToggleTask,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onReorderTask,
  annualTasks,
  onAddAnnualTask,
  onToggleAnnualTask,
  onDeleteAnnualTask,
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
}: TaskDashboardProps) {
  const [taskName, setTaskName] = useState("");
  const [annualTaskName, setAnnualTaskName] = useState("");
  const [dueDate, setDueDate] = useState(getTodayISODate);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState<TaskDraft | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pendingDeleteTaskId, setPendingDeleteTaskId] = useState<string | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(
    () => new Set(uiPreferences.expandedTasks),
  );
  const [taskViewMode, setTaskViewMode] = useState<"order" | "priority">("order");
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [projectNoteDraft, setProjectNoteDraft] = useState<Record<string, string>>({});
  const [dailyCheckinDrafts, setDailyCheckinDrafts] = useState<Record<string, DailyCheckinDraft>>({});
  const [newFootprintName, setNewFootprintName] = useState("");
  const [showAddTaskDialog, setShowAddTaskDialog] = useState(false);
  const [showAddAnnualDialog, setShowAddAnnualDialog] = useState(false);
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
  const [longTaskSectionOpen, setLongTaskSectionOpen] = useState(uiPreferences.longTaskSectionOpen);
  const [expandedCompletedTasks, setExpandedCompletedTasks] = useState<Set<string>>(
    () => new Set(uiPreferences.expandedCompletedTasks),
  );
  const [completedSectionOpen, setCompletedSectionOpen] = useState(
    uiPreferences.completedSectionOpen ?? true,
  );
  const [projectSectionOpen, setProjectSectionOpen] = useState(uiPreferences.projectSectionOpen);
  const [routineCheckinSectionOpen, setRoutineCheckinSectionOpen] = useState(
    uiPreferences.routineCheckinSectionOpen ?? true,
  );
  const [achievementSectionOpen, setAchievementSectionOpen] = useState(
    uiPreferences.achievementSectionOpen ?? true,
  );
  const [footprintSectionOpen, setFootprintSectionOpen] = useState(uiPreferences.footprintSectionOpen);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    () => new Set(uiPreferences.expandedProjects),
  );
  const [expandedFootprints, setExpandedFootprints] = useState<Set<string>>(
    () => new Set(uiPreferences.expandedFootprints),
  );
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);
  const incompleteTasks = tasks.filter((task) => !task.done);
  const completedTasks = tasks.filter((task) => task.done);
  const editingTask = tasks.find((task) => task.id === editingTaskId) ?? null;
  const todayDate = getTodayISODate();

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

  const groupedIncompleteTasks = useMemo(
    () =>
      PRIORITY_ORDER.map((priority) => ({
        priority,
        items: orderedIncompleteTasks.filter((task) => task.priority === priority),
      })),
    [orderedIncompleteTasks],
  );
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
    });
  }

  function handleSaveTask() {
    if (!taskDraft || !taskDraft.name.trim()) return;
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
      priority: taskDraft.priority,
      subtasks: taskDraft.subtasks,
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
    onCheckinProject(projectId, getTodayISODate(), projectNoteDraft[projectId] ?? "");
    setProjectNoteDraft((prev) => ({ ...prev, [projectId]: "" }));
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

  return (
    <aside className="module-shell">
      <div className="module-header px-6 py-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-gray-900">
          <ListTodo className="h-5 w-5 text-primary" />
          任务控制台
        </h2>
      </div>

      <Separator />

      <div className="p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-gray-600">
            <CalendarRange className="h-4 w-4 text-primary" aria-hidden />
            年度任务清单
          </p>
          <Button type="button" size="sm" onClick={() => setShowAddAnnualDialog(true)}>
            <Plus className="mr-1 h-4 w-4" />
            添加
          </Button>
        </div>
        <div className="mb-6 space-y-3 rounded-2xl subtle-card p-4">
          {annualTasks.length > 0 ? (
            <ul className="max-h-56 space-y-2 overflow-y-auto pr-1 text-sm">
              {annualTasks.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start gap-2 rounded-xl border border-stone-100 bg-white/55 px-3 py-2"
                >
                  <Checkbox
                    checked={item.done}
                    onCheckedChange={() => onToggleAnnualTask(item.id)}
                    className="mt-0.5"
                    aria-label={`年度任务 ${item.name} 完成状态`}
                  />
                  <span
                    className={`min-w-0 flex-1 leading-snug [overflow-wrap:anywhere] break-words ${
                      item.done ? "text-gray-500 line-through" : "text-gray-900"
                    }`}
                  >
                    {item.name}
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 rounded-md hover:bg-red-50 hover:text-red-500"
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
            <p className="text-center text-sm text-gray-500">
              尚未添加年度任务。
            </p>
          )}
        </div>

        <Collapsible
          open={longTaskSectionOpen}
          onOpenChange={(open) => {
            setLongTaskSectionOpen(open);
            patchUiPreferences({ longTaskSectionOpen: open });
          }}
        >
          <CollapsibleTrigger className="section-trigger mb-3 flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left">
            <span className="text-sm font-medium uppercase tracking-wide text-gray-600">
              长期任务 / 未完成任务
            </span>
            <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${longTaskSectionOpen ? "" : "-rotate-90"}`} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mb-3 flex items-center gap-2">
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
              <Button type="button" size="sm" onClick={() => setShowAddTaskDialog(true)}>
                <Plus className="mr-1 h-4 w-4" />
                添加
              </Button>
            </div>

            {taskViewMode === "order" ? (
          <ul className="space-y-2">
            {orderedIncompleteTasks.map((task) => (
              <li
                key={task.id}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => handleDropTask(task.id)}
                className="interactive-card rounded-2xl p-3"
              >
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    draggable
                    onDragStart={(event) => handleTaskDragStart(task.id, event)}
                    onDragEnd={() => setDraggingTaskId(null)}
                    className="mt-0.5 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
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
                    className="mt-1"
                  />
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(task)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-start gap-2">
                      {getPriorityIcon(task.priority)}
                      <p className="min-w-0 flex-1 break-words text-sm font-medium text-gray-900">
                        {task.name}
                      </p>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <span>截止：{task.dueDate}</span>
                      <Badge className="rounded-md border border-primary bg-primary text-white">未完成</Badge>
                      {task.subtasks.length > 0 ? (
                        <button
                          type="button"
                          className="rounded border border-gray-300 px-1.5 py-0.5 text-[11px] text-gray-600 hover:bg-gray-100"
                          onClick={(event) => {
                            event.stopPropagation();
                            setExpandedTasks((prev) => {
                              const next = new Set(prev);
                              if (next.has(task.id)) {
                                next.delete(task.id);
                              } else {
                                next.add(task.id);
                              }
                              patchUiPreferences({ expandedTasks: [...next] });
                              return next;
                            });
                          }}
                        >
                          {expandedTasks.has(task.id) ? "收起子任务" : `子任务 ${task.subtasks.length}`}
                        </button>
                      ) : null}
                    </div>
                  </button>
                  <ContextBadge
                    source={{
                      kind: "task",
                      id: task.id,
                      title: task.name,
                      priority: task.priority,
                      dueDate: task.dueDate,
                      done: task.done,
                    }}
                    className="mt-0.5 shrink-0"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-md hover:bg-red-50 hover:text-red-500"
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
                  <ul className="mt-2 space-y-1 rounded-xl border border-stone-200/70 bg-white/50 p-2">
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
              <div key={group.priority} className="rounded-2xl subtle-card p-3">
                <p className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                  {getPriorityIcon(group.priority)}
                  {group.priority}
                </p>
                {group.items.length === 0 ? (
                  <p className="text-xs text-gray-500">暂无任务</p>
                ) : (
                  <ul className="space-y-1">
                    {group.items.map((task) => (
                      <li key={task.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/55 px-3 py-2">
                        <button type="button" className="min-w-0 flex-1 truncate text-left text-sm" title={task.name} onClick={() => handleOpenEdit(task)}>
                          {task.name}
                        </button>
                        <span className="text-xs text-gray-500">{task.dueDate}</span>
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

      <Collapsible
        open={completedSectionOpen}
        onOpenChange={(open) => {
          setCompletedSectionOpen(open);
          patchUiPreferences({ completedSectionOpen: open });
        }}
        className="p-6"
      >
        <CollapsibleTrigger className="section-trigger flex w-full items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium text-gray-900 transition-colors duration-150 hover:bg-white/70">
          已完成任务库
          <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${completedSectionOpen ? "" : "-rotate-90"}`} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          {completedTasks.length > 0 ? (
            <ul className="mt-4 space-y-3 rounded-2xl subtle-card p-4 text-sm text-gray-600">
              {completedTasks.map((task) => (
                <li key={task.id} className="rounded-xl border border-stone-200/70 bg-white/65 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      onClick={() =>
                        setExpandedCompletedTasks((prev) => {
                          const next = new Set(prev);
                          if (next.has(task.id)) {
                            next.delete(task.id);
                          } else {
                            next.add(task.id);
                          }
                          patchUiPreferences({ expandedCompletedTasks: [...next] });
                          return next;
                        })
                      }
                    >
                      <ChevronDown
                        className={`h-4 w-4 text-gray-500 transition-transform ${expandedCompletedTasks.has(task.id) ? "" : "-rotate-90"}`}
                      />
                      <span className="min-w-0 truncate line-through">{task.name}</span>
                    </button>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenEdit(task)}
                      >
                        编辑
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-md border-gray-300 px-3 text-xs hover:bg-gray-50 transition-colors duration-150"
                        onClick={() => handleMoveBackToIncomplete(task.id)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        移回未完成
                      </Button>
                    </div>
                  </div>
                  {expandedCompletedTasks.has(task.id) ? (
                    <div className="mt-2 space-y-2 rounded-md border border-gray-100 bg-gray-50 p-2">
                      <p className="text-xs text-gray-600">
                        完成记录：{task.completionLog || "暂无"}
                      </p>
                      <div className="text-xs text-gray-600">
                        子任务完成情况：
                        {task.subtasks.length === 0 ? (
                          <span className="ml-1">无子任务</span>
                        ) : (
                          <ul className="mt-1 space-y-1">
                            {task.subtasks.map((subtask) => (
                              <li key={subtask.id} className="flex items-center gap-2">
                                <Checkbox checked={subtask.done} className="h-3.5 w-3.5" />
                                <span className={subtask.done ? "line-through text-gray-500" : "text-gray-700"}>
                                  {subtask.name}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 border border-gray-200 rounded-lg p-4 text-sm text-gray-500 text-center">暂无已归档任务</p>
          )}
        </CollapsibleContent>
      </Collapsible>

      {showProjectSection ? (
        <>
      <Separator />

      <section className="space-y-4 p-6">
        <Collapsible
          open={projectSectionOpen}
          onOpenChange={(open) => {
            setProjectSectionOpen(open);
            patchUiPreferences({ projectSectionOpen: open });
          }}
        >
          <div className="flex items-center gap-2">
            <CollapsibleTrigger className="flex min-h-11 flex-1 items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-left">
              <h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
                <KanbanSquare className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">Project 打卡记录栏</span>
              </h3>
              <ChevronDown className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${projectSectionOpen ? "" : "-rotate-90"}`} />
            </CollapsibleTrigger>
            <Button type="button" size="sm" className="shrink-0" onClick={() => setShowAddProjectDialog(true)}>
              <Plus className="mr-1 h-4 w-4" />
              添加
            </Button>
          </div>
          <CollapsibleContent className="mt-3 space-y-3">
            <div className="space-y-3">
              {visibleProjectCheckins.map((project) => {
                const projectExpanded = expandedProjects.has(project.id);
            const today = getTodayISODate();
            const doneCount = project.checkins.length;
            const totalDays = daysBetweenInclusive(project.startDate, today);
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
                    onClick={() =>
                      setExpandedProjects((prev) => {
                        const next = new Set(prev);
                        if (next.has(project.id)) next.delete(project.id);
                        else next.add(project.id);
                        patchUiPreferences({ expandedProjects: [...next] });
                        return next;
                      })
                    }
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
                        withOptionalConfirm("确认删除这个 Project 以及其全部打卡记录吗？", () =>
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
                    <div className="flex gap-2">
                      <Input
                        value={projectNoteDraft[project.id] ?? ""}
                        onChange={(event) =>
                          setProjectNoteDraft((prev) => ({ ...prev, [project.id]: event.target.value }))
                        }
                        placeholder="今日描述（可选）"
                      />
                      <Button type="button" size="sm" onClick={() => handleProjectCheckin(project.id)}>
                        打卡
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
              {visibleProjectCheckins.length === 0 ? <p className="text-xs text-gray-500">暂无 Project 打卡项</p> : null}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </section>
        </>
      ) : null}

      <Separator />

      <section className="space-y-4 p-6">
        <Collapsible
          open={routineCheckinSectionOpen}
          onOpenChange={(open) => {
            setRoutineCheckinSectionOpen(open);
            patchUiPreferences({ routineCheckinSectionOpen: open });
          }}
        >
          <div className="flex items-center gap-2">
            <CollapsibleTrigger className="flex min-h-11 flex-1 items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-left">
              <h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
                <Clock className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">日常时段打卡任务</span>
              </h3>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${
                  routineCheckinSectionOpen ? "" : "-rotate-90"
                }`}
              />
            </CollapsibleTrigger>
            <Button
              type="button"
              size="sm"
              className="shrink-0"
              onClick={() => setShowRoutineCheckinForm((open) => !open)}
            >
              <Plus className="mr-1 h-4 w-4" />
              添加
            </Button>
          </div>

          <CollapsibleContent className="mt-3 space-y-3">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                  今日打卡
                </p>
                <span className="rounded-full bg-white px-2 py-1 text-[11px] font-medium text-emerald-700">
                  {completedDailyCheckinCount}/{dailyCheckinEntries.length}
                </span>
              </div>

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
          </CollapsibleContent>
        </Collapsible>
      </section>

      <Separator />

      <section className="space-y-4 p-6">
        <Collapsible
          open={achievementSectionOpen}
          onOpenChange={(open) => {
            setAchievementSectionOpen(open);
            patchUiPreferences({ achievementSectionOpen: open });
          }}
        >
          <div className="flex items-center gap-2">
            <CollapsibleTrigger className="flex min-h-11 flex-1 items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-left">
              <h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
                <Trophy className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">成就记录栏</span>
              </h3>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${
                  achievementSectionOpen ? "" : "-rotate-90"
                }`}
              />
            </CollapsibleTrigger>
            <Button type="button" size="sm" className="shrink-0" onClick={openCreateAchievement}>
              <Plus className="mr-1 h-4 w-4" />
              添加
            </Button>
          </div>
          <CollapsibleContent className="mt-3 space-y-3">
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

      {showFootprintsSection ? (
        <>
          <Separator />

          <section className="space-y-4 p-6">
            <Collapsible
              open={footprintSectionOpen}
              onOpenChange={(open) => {
                setFootprintSectionOpen(open);
                patchUiPreferences({ footprintSectionOpen: open });
              }}
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
                  <Button type="button" size="sm" onClick={() => setShowAddFootprintDialog(true)}>
                    <Plus className="mr-1 h-4 w-4" />
                    添加
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
                          onClick={() =>
                            setExpandedFootprints((prev) => {
                              const next = new Set(prev);
                              if (next.has(item.id)) next.delete(item.id);
                              else next.add(item.id);
                              patchUiPreferences({ expandedFootprints: [...next] });
                              return next;
                            })
                          }
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

      <Dialog open={showAddProjectDialog} onOpenChange={setShowAddProjectDialog}>
        <DialogContent className="rounded-sm border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-sm">新增 Project 打卡项</DialogTitle>
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
            <DialogTitle className="text-sm">编辑 Project</DialogTitle>
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
          <DialogContent className="rounded-sm border-gray-200">
            <DialogHeader>
              <DialogTitle className="text-sm">编辑长期任务详情</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
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
