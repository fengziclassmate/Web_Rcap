"use client";

import React, { useMemo, useState } from "react";
import {
  CalendarRange,
  ChevronDown,
  ChevronRight,
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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type {
  AnnualTask,
  FootprintItem,
  LongTask,
  Priority,
  ProjectCheckin,
  SubTask,
} from "@/app/page";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

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
  onCheckinProject: (projectId: string, note: string) => void;
  onDeleteProjectCheckin: (projectId: string) => void;
  footprints: FootprintItem[];
  onAddFootprint: (name: string) => void;
  onResetFootprint: (itemId: string) => void;
  onDeleteFootprint: (itemId: string) => void;
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

function getTodayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetweenInclusive(startIso: string, endIso: string) {
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);
  const ms = Math.max(0, end.getTime() - start.getTime());
  return Math.floor(ms / (24 * 60 * 60 * 1000)) + 1;
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
  footprints,
  onAddFootprint,
  onResetFootprint,
  onDeleteFootprint,
}: TaskDashboardProps) {
  const [taskName, setTaskName] = useState("");
  const [annualTaskName, setAnnualTaskName] = useState("");
  const [dueDate, setDueDate] = useState(getTodayISODate);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState<TaskDraft | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pendingDeleteTaskId, setPendingDeleteTaskId] = useState<string | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [taskViewMode, setTaskViewMode] = useState<"order" | "priority">("order");
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [projectNoteDraft, setProjectNoteDraft] = useState<Record<string, string>>({});
  const [newFootprintName, setNewFootprintName] = useState("");
  const [showAddTaskDialog, setShowAddTaskDialog] = useState(false);
  const [showAddProjectDialog, setShowAddProjectDialog] = useState(false);
  const [showAddFootprintDialog, setShowAddFootprintDialog] = useState(false);
  const incompleteTasks = tasks.filter((task) => !task.done);
  const completedTasks = tasks.filter((task) => task.done);
  const editingTask = tasks.find((task) => task.id === editingTaskId) ?? null;

  function toggleTaskExpansion(taskId: string) {
    setExpandedTasks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  }

  const orderedIncompleteTasks = useMemo(() => [...incompleteTasks], [incompleteTasks]);

  const groupedIncompleteTasks = useMemo(
    () =>
      PRIORITY_ORDER.map((priority) => ({
        priority,
        items: orderedIncompleteTasks.filter((task) => task.priority === priority),
      })),
    [orderedIncompleteTasks],
  );

  function handleAddTask() {
    if (!taskName.trim()) return;
    onAddTask(taskName, dueDate);
    setTaskName("");
    setShowAddTaskDialog(false);
    toast.success("长期任务已添加");
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
    onCheckinProject(projectId, projectNoteDraft[projectId] ?? "");
    setProjectNoteDraft((prev) => ({ ...prev, [projectId]: "" }));
  }

  function handleDeleteProject(projectId: string) {
    onDeleteProjectCheckin(projectId);
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

  return (
    <aside className="rounded-lg border border-gray-200 bg-white shadow-md">
      <div className="px-6 py-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-gray-900">
          <ListTodo className="h-5 w-5 text-primary" />
          任务控制台
        </h2>
      </div>

      <Separator />

      <div className="p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm font-medium uppercase tracking-wide text-gray-600">长期任务</p>
          <Button type="button" size="sm" onClick={() => setShowAddTaskDialog(true)}>
            <Plus className="mr-1 h-4 w-4" />
            添加
          </Button>
        </div>

        <p className="mb-4 flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-gray-600">
          <CalendarRange className="h-4 w-4 text-primary" aria-hidden />
          年度任务清单
        </p>
        <div className="mb-6 space-y-3 rounded-lg border border-gray-200 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              value={annualTaskName}
              onChange={(event) => setAnnualTaskName(event.target.value)}
              placeholder="输入本年度目标或大事（如：考证、旅行计划）"
              className="min-w-0 flex-1 rounded-md border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  if (!annualTaskName.trim()) return;
                  onAddAnnualTask(annualTaskName);
                  setAnnualTaskName("");
                  toast.success("已加入年度清单");
                }
              }}
            />
            <Button
              type="button"
              onClick={() => {
                if (!annualTaskName.trim()) return;
                onAddAnnualTask(annualTaskName);
                setAnnualTaskName("");
                toast.success("已加入年度清单");
              }}
              className="shrink-0 rounded-md bg-primary text-white hover:bg-primary/90 transition-all duration-150"
            >
              <Plus className="h-4 w-4" />
              添加
            </Button>
          </div>
          {annualTasks.length > 0 ? (
            <ul className="max-h-56 space-y-2 overflow-y-auto pr-1 text-sm">
              {annualTasks.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start gap-2 rounded-md border border-gray-100 bg-gray-50/80 px-2 py-2"
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
              尚未添加年度任务。可在此记录全年级目标，与下方按截止日管理的长期任务互补。
            </p>
          )}
        </div>

        <p className="mb-4 text-sm font-medium uppercase tracking-wide text-gray-600">
          长期任务 / 未完成任务
        </p>
        <div className="mb-3 flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={taskViewMode === "order" ? "default" : "outline"}
            onClick={() => setTaskViewMode("order")}
          >
            拖拽排序
          </Button>
          <Button
            type="button"
            size="sm"
            variant={taskViewMode === "priority" ? "default" : "outline"}
            onClick={() => setTaskViewMode("priority")}
          >
            按优先级分组
          </Button>
        </div>

        {taskViewMode === "order" ? (
          <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-white">
                  <TableHead className="w-12" />
                  <TableHead>任务名称</TableHead>
                  <TableHead className="w-[124px]">截止日期</TableHead>
                  <TableHead className="w-[84px]">状态</TableHead>
                  <TableHead className="w-[56px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {orderedIncompleteTasks.map((task) => (
                  <React.Fragment key={task.id}>
                    <TableRow
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => handleDropTask(task.id)}
                      className="cursor-pointer hover:bg-gray-50 transition-colors duration-150"
                      onClick={(event) => {
                        const target = event.target as HTMLElement;
                        if (target.closest("[data-no-open='true']")) return;
                        handleOpenEdit(task);
                      }}
                    >
                      <TableCell data-no-open="true">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            draggable
                            onDragStart={(event) => handleTaskDragStart(task.id, event)}
                            onDragEnd={() => setDraggingTaskId(null)}
                            onClick={(event) => event.stopPropagation()}
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
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
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => event.stopPropagation()}
                            aria-label={`任务 ${task.name} 的完成状态`}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {getPriorityIcon(task.priority)}
                          <span className={task.done ? "text-gray-500 line-through" : "text-gray-900 font-medium"}>
                            {task.name}
                          </span>
                          {task.subtasks.length > 0 && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleTaskExpansion(task.id);
                              }}
                              className="ml-2 p-1 rounded-md hover:bg-gray-100 transition-colors duration-150"
                              aria-label={expandedTasks.has(task.id) ? "折叠子任务" : "展开子任务"}
                            >
                              {expandedTasks.has(task.id) ? (
                                <ChevronDown className="h-4 w-4 text-gray-500" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-gray-500" />
                              )}
                            </button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{task.dueDate}</TableCell>
                      <TableCell>
                        <Badge className="rounded-md border border-primary bg-primary text-white">未完成</Badge>
                      </TableCell>
                      <TableCell className="text-right" data-no-open="true">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-md hover:bg-red-50 hover:text-red-500 transition-colors duration-150"
                          onClick={(event) => {
                            event.stopPropagation();
                            setPendingDeleteTaskId(task.id);
                            setConfirmDeleteOpen(true);
                          }}
                          aria-label={`删除任务 ${task.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="space-y-3">
            {groupedIncompleteTasks.map((group) => (
              <div key={group.priority} className="rounded-lg border border-gray-200 p-3">
                <p className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                  {getPriorityIcon(group.priority)}
                  {group.priority}
                </p>
                {group.items.length === 0 ? (
                  <p className="text-xs text-gray-500">暂无任务</p>
                ) : (
                  <ul className="space-y-1">
                    {group.items.map((task) => (
                      <li key={task.id} className="flex items-center justify-between gap-2 rounded-md bg-gray-50 px-2 py-1.5">
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
      </div>

      <Separator />

      <Collapsible defaultOpen className="p-6">
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50 transition-colors duration-150">
          已完成任务库
          <ChevronDown className="h-4 w-4 text-gray-500" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          {completedTasks.length > 0 ? (
            <ul className="mt-4 space-y-3 border border-gray-200 rounded-lg p-4 text-sm text-gray-600">
              {completedTasks.map((task) => (
                <li key={task.id} className="flex items-center justify-between gap-3">
                  <span className="line-through">{task.name}</span>
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
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 border border-gray-200 rounded-lg p-4 text-sm text-gray-500 text-center">暂无已归档任务</p>
          )}
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      <section className="space-y-4 p-6">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
            <KanbanSquare className="h-4 w-4 text-primary" />
            Project 打卡记录栏
          </h3>
          <Button type="button" size="sm" onClick={() => setShowAddProjectDialog(true)}>
            <Plus className="mr-1 h-4 w-4" />
            添加
          </Button>
        </div>
        <div className="space-y-3">
          {projectCheckins.map((project) => {
            const today = getTodayISODate();
            const doneCount = project.checkins.length;
            const totalDays = daysBetweenInclusive(project.startDate, today);
            const percent = Math.min(100, Math.round((doneCount / Math.max(1, totalDays)) * 100));
            return (
              <div key={project.id} className="rounded-lg border border-gray-200 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium" title={project.name}>
                    {project.name}
                  </p>
                  <Button type="button" size="icon" variant="ghost" onClick={() => handleDeleteProject(project.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
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
              </div>
            );
          })}
          {projectCheckins.length === 0 ? <p className="text-xs text-gray-500">暂无 Project 打卡项</p> : null}
        </div>
      </section>

      <Separator />

      <section className="space-y-4 p-6">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
            <Footprints className="h-4 w-4 text-primary" />
            足迹跟踪栏
          </h3>
          <Button type="button" size="sm" onClick={() => setShowAddFootprintDialog(true)}>
            <Plus className="mr-1 h-4 w-4" />
            添加
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {footprints.map((item) => {
            const days = daysBetweenInclusive(item.lastDate, getTodayISODate()) - 1;
            return (
              <div key={item.id} className="rounded-lg border border-gray-200 p-3 text-center">
                <p className="truncate text-sm font-medium" title={item.name}>
                  {item.name}
                </p>
                <p className="mt-2 text-lg font-semibold">{days} 天</p>
                <p className="text-xs text-gray-500">距上次</p>
                <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => handleResetFootprint(item.id)}>
                  今天重置
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="mt-1 text-xs text-red-500 hover:text-red-600"
                  onClick={() => onDeleteFootprint(item.id)}
                >
                  删除
                </Button>
              </div>
            );
          })}
        </div>
      </section>

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
                <Label>子任务</Label>
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
    </aside>
  );
}
