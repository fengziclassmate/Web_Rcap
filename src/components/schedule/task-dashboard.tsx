"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight, ListTodo, Plus, RotateCcw, Trash2, AlertTriangle, Clock, Star, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { LongTask, Priority, SubTask } from "@/app/page";
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
};

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

export function TaskDashboard({
  tasks,
  onToggleTask,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
}: TaskDashboardProps) {
  const [taskName, setTaskName] = useState("");
  const [dueDate, setDueDate] = useState(getTodayISODate);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState<TaskDraft | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pendingDeleteTaskId, setPendingDeleteTaskId] = useState<string | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
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

  function handleAddTask() {
    if (!taskName.trim()) return;
    onAddTask(taskName, dueDate);
    setTaskName("");
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

  function handleToggleTaskSubtask(taskId: string, subtaskId: string) {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      const updatedSubtasks = task.subtasks.map(subtask => {
        if (subtask.id === subtaskId) {
          return { ...subtask, done: !subtask.done };
        }
        return subtask;
      });
      onUpdateTask(taskId, { subtasks: updatedSubtasks });
    }
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
        <p className="mb-4 text-sm font-medium uppercase tracking-wide text-gray-600">新增长期任务</p>
        <div className="mb-6 space-y-3 rounded-lg border border-gray-200 p-4">
          <Input
            value={taskName}
            onChange={(event) => setTaskName(event.target.value)}
            placeholder="输入任务名称"
            className="rounded-md border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150"
          />
          <div className="flex items-center gap-3">
            <Input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className="min-w-0 rounded-md border-gray-300 text-sm focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150"
            />
            <Button
              type="button"
              onClick={handleAddTask}
              className="rounded-md bg-primary text-white hover:bg-primary/90 transition-all duration-150"
            >
              <Plus className="h-4 w-4" />
              添加
            </Button>
          </div>
        </div>

        <p className="mb-4 text-sm font-medium uppercase tracking-wide text-gray-600">
          长期任务 / 未完成任务
        </p>

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
              {incompleteTasks.map((task) => (
                <React.Fragment key={task.id}>
                  <TableRow
                    className="cursor-pointer hover:bg-gray-50 transition-colors duration-150"
                    onClick={(event) => {
                      const target = event.target as HTMLElement;
                      if (target.closest("[data-no-open='true']")) return;
                      handleOpenEdit(task);
                    }}
                  >
                    <TableCell data-no-open="true">
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
                    <TableCell className={task.done ? "text-gray-500" : "text-gray-900"}>
                      {task.dueDate}
                    </TableCell>
                    <TableCell>
                      {task.done ? (
                        <Badge className="rounded-md border border-gray-300 bg-white text-gray-700">
                          已完成
                        </Badge>
                      ) : (
                        <Badge className="rounded-md border border-primary bg-primary text-white">
                          未完成
                        </Badge>
                      )}
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
                  {task.subtasks.length > 0 && expandedTasks.has(task.id) && (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <div className="pl-12 pr-4 py-3 bg-gray-50">
                          <ul className="space-y-2">
                            {task.subtasks.map((subtask) => (
                              <li key={subtask.id} className="flex items-center gap-3">
                                <Checkbox
                                  checked={subtask.done}
                                  onCheckedChange={() => {
                                    handleToggleTaskSubtask(task.id, subtask.id);
                                  }}
                                  onPointerDown={(event) => event.stopPropagation()}
                                  onClick={(event) => event.stopPropagation()}
                                  className="h-4 w-4"
                                />
                                <span className={subtask.done ? "text-gray-500 line-through text-sm" : "text-gray-800 text-sm"}>
                                  {subtask.name}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
        {incompleteTasks.length === 0 && (
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
