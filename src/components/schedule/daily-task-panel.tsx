"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle, Clock, ListTodo, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { LongTask, ScheduleEvent, TaskType } from "@/lib/types";

type DailyTaskPanelProps = {
  tasks: LongTask[];
  events: ScheduleEvent[];
  onAddTask: (name: string, dueDate: string, taskType: TaskType) => void;
  onToggleTask: (taskId: string) => void;
  onUpdateTask: (taskId: string, patch: Partial<LongTask>) => void;
  onCreateTimeBlock: (task: LongTask, date: string, startHour: number, durationMinutes: number) => void;
  archivedSectionOpen: boolean;
  onArchivedSectionOpenChange: (open: boolean) => void;
};

function getLocalISODate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(isoDate: string, amount: number) {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + amount);
  return getLocalISODate(date);
}

function dayDistance(from: string, to: string) {
  const start = new Date(`${from}T00:00:00`).getTime();
  const end = new Date(`${to}T00:00:00`).getTime();
  return Math.round((end - start) / 86_400_000);
}

function parseTimeToHour(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour + minute / 60;
}

export function DailyTaskPanel({
  tasks,
  events,
  onAddTask,
  onToggleTask,
  onUpdateTask,
  onCreateTimeBlock,
  archivedSectionOpen,
  onArchivedSectionOpenChange,
}: DailyTaskPanelProps) {
  const today = getLocalISODate();
  const tomorrow = addDays(today, 1);
  const [name, setName] = useState("");
  const [targetDate, setTargetDate] = useState(today);
  const [taskForSchedule, setTaskForSchedule] = useState<LongTask | null>(null);
  const [scheduleDate, setScheduleDate] = useState(today);
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [duration, setDuration] = useState("30");
  const [dailyCloseOpen, setDailyCloseOpen] = useState(false);

  const dailyTasks = tasks.filter(
    (task) => task.taskType === "daily" && !task.done && !task.abandonedAt,
  );
  const archivedDailyTasks = tasks.filter(
    (task) => task.taskType === "daily" && (task.done || task.abandonedAt),
  );
  const todayTasks = dailyTasks.filter((task) => task.dueDate === today);
  const focusTasks = todayTasks.filter((task) => task.isTodayFocus);
  const radarTasks = tasks
    .filter((task) => task.taskType === "long" && !task.done)
    .map((task) => ({ task, days: dayDistance(today, task.dueDate) }))
    .filter(({ days }) => days <= 7)
    .sort((a, b) => a.days - b.days);
  const scheduledDailyTaskIds = new Set(
    events.flatMap((event) => (event.linkedDailyTaskId ? [event.linkedDailyTaskId] : [])),
  );
  const legacyScheduledDailyTaskNames = new Set(
    events
      .map((event) => event.notes.match(/^来自日常任务：(.+)$/)?.[1])
      .filter((name): name is string => Boolean(name)),
  );

  function addDailyTask() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAddTask(trimmed, targetDate, "daily");
    setName("");
    setTargetDate(today);
    toast.success("已添加日常任务");
  }

  function toggleFocus(task: LongTask) {
    if (!task.isTodayFocus && focusTasks.length >= 3) {
      toast.error("今日三件事已满，请先取消其中一项");
      return;
    }
    onUpdateTask(task.id, { isTodayFocus: !task.isTodayFocus });
  }

  function openSchedule(task: LongTask) {
    setTaskForSchedule(task);
    setScheduleDate(task.dueDate);
    setScheduleTime("09:00");
    setDuration("30");
  }

  function createTimeBlock() {
    if (!taskForSchedule) return;
    const durationMinutes = Number(duration);
    const startHour = parseTimeToHour(scheduleTime);
    if (
      !Number.isFinite(startHour) ||
      !Number.isFinite(durationMinutes) ||
      durationMinutes <= 0 ||
      startHour + durationMinutes / 60 > 24
    ) {
      toast.error("请选择当天可用的时间段");
      return;
    }
    onCreateTimeBlock(taskForSchedule, scheduleDate, startHour, durationMinutes);
    setTaskForSchedule(null);
    toast.success("已加入日程时间块");
  }

  function moveToTomorrow(task: LongTask) {
    onUpdateTask(task.id, { dueDate: tomorrow, isTodayFocus: false });
  }

  function turnIntoLongTask(task: LongTask) {
    onUpdateTask(task.id, { taskType: "long", isTodayFocus: false, abandonedAt: null });
  }

  function abandonDailyTask(task: LongTask) {
    onUpdateTask(task.id, { abandonedAt: new Date().toISOString(), isTodayFocus: false });
  }

  function restoreDailyTask(task: LongTask) {
    onUpdateTask(task.id, { done: false, completedAt: null, abandonedAt: null });
  }

  return (
    <section className="daily-task-panel">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-stone-900">
            <ListTodo className="h-4 w-4 text-emerald-700" aria-hidden />
            日常任务
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => setDailyCloseOpen(true)}>
          <RotateCcw className="h-3.5 w-3.5" />
          每日收尾
        </Button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_132px_auto]">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="添加日常任务"
          onKeyDown={(event) => {
            if (event.key === "Enter") addDailyTask();
          }}
        />
        <Input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
        <Button type="button" size="icon-sm" onClick={addDailyTask} disabled={!name.trim()} aria-label="添加日常任务" title="添加日常任务">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="today-focus-strip mt-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold tracking-wide text-emerald-900">今日三件事</p>
          <span className="text-xs tabular-nums text-emerald-700">{focusTasks.length}/3</span>
        </div>
        {focusTasks.length > 0 ? (
          <ol className="mt-2 grid gap-1.5">
            {focusTasks.map((task, index) => (
              <li key={task.id} className="flex items-center gap-2 text-sm text-emerald-950">
                <span className="grid size-5 place-items-center rounded-full bg-emerald-700 text-[11px] font-bold text-white">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate">{task.name}</span>
              </li>
            ))}
          </ol>
        ) : null}
      </div>

      <div className="mt-3 space-y-2">
        {dailyTasks.length > 0 ? (
          dailyTasks.map((task) => (
            <article key={task.id} className="daily-task-row">
              <Checkbox
                checked={task.done}
                onCheckedChange={() => onToggleTask(task.id)}
                aria-label={`完成日常任务 ${task.name}`}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-stone-900">{task.name}</p>
                <p className="mt-0.5 text-xs tabular-nums text-stone-500">{task.dueDate}</p>
              </div>
              {task.dueDate === today ? (
                <Button
                  type="button"
                  size="xs"
                  variant={task.isTodayFocus ? "default" : "outline"}
                  className={task.isTodayFocus ? "bg-emerald-700 hover:bg-emerald-800" : ""}
                  onClick={() => toggleFocus(task)}
                >
                  {task.isTodayFocus ? "今日重点" : "设为重点"}
                </Button>
              ) : null}
              {scheduledDailyTaskIds.has(task.id) || legacyScheduledDailyTaskNames.has(task.name) ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                  <CheckCircle className="h-3 w-3" aria-hidden />
                  已排入日程
                </span>
              ) : (
                <Button type="button" size="xs" variant="outline" onClick={() => openSchedule(task)}>
                  <Clock className="h-3 w-3" />
                  排入日程
                </Button>
              )}
            </article>
          ))
        ) : (
          <p className="rounded-lg border border-dashed border-stone-200 px-3 py-3 text-xs text-stone-500">
            暂无日常任务。把今天需要落地执行的事放在这里。
          </p>
        )}
      </div>

      {archivedDailyTasks.length > 0 ? (
        <div className="mt-2 rounded-lg border border-stone-200/80 bg-white/55 px-2.5 py-2">
          <button
            type="button"
            className="flex w-full items-center justify-between text-xs font-medium text-stone-600"
            onClick={() => onArchivedSectionOpenChange(!archivedSectionOpen)}
            aria-expanded={archivedSectionOpen}
          >
            已处理的日常任务
            <span>{archivedDailyTasks.length} 项</span>
          </button>
          {archivedSectionOpen ? (
            <div className="mt-2 space-y-1.5">
              {archivedDailyTasks.map((task) => (
                <div key={task.id} className="flex items-center gap-2 rounded-md bg-stone-50 px-2 py-1.5 text-xs">
                  <span className="min-w-0 flex-1 truncate text-stone-500 line-through">{task.name}</span>
                  <span className={task.abandonedAt ? "text-amber-700" : "text-emerald-700"}>
                    {task.abandonedAt ? "已放弃" : "已完成"}
                  </span>
                  <Button type="button" size="xs" variant="ghost" onClick={() => restoreDailyTask(task)}>恢复</Button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="deadline-radar mt-3">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-950">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-700" aria-hidden />
            截止日期雷达
          </p>
          <span className="text-[11px] text-amber-800">7 天内</span>
        </div>
        {radarTasks.length > 0 ? (
          <div className="mt-2 space-y-1.5">
            {radarTasks.map(({ task, days }) => (
              <div key={task.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate text-stone-700">{task.name}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 font-medium ${days < 0 ? "bg-rose-100 text-rose-700" : days === 0 ? "bg-amber-100 text-amber-800" : "bg-stone-100 text-stone-600"}`}>
                  {days < 0 ? `逾期 ${Math.abs(days)} 天` : days === 0 ? "今天到期" : `${days} 天后`}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-amber-800">未来 7 天没有待处理的长期任务截止日。</p>
        )}
      </div>

      <Dialog open={Boolean(taskForSchedule)} onOpenChange={(open) => !open && setTaskForSchedule(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>排入日程</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="rounded-lg bg-stone-100 px-3 py-2 text-sm font-medium text-stone-800">{taskForSchedule?.name}</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><label className="text-xs text-stone-600">日期</label><Input type="date" value={scheduleDate} onChange={(event) => setScheduleDate(event.target.value)} /></div>
              <div className="space-y-1"><label className="text-xs text-stone-600">开始时间</label><Input type="time" value={scheduleTime} onChange={(event) => setScheduleTime(event.target.value)} /></div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-stone-600" htmlFor="daily-task-duration">时长（分钟）</label>
              <Input
                id="daily-task-duration"
                type="number"
                min="1"
                max="1440"
                step="5"
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
              />
              <div className="grid grid-cols-3 gap-2">
                {[30, 60, 90].map((minutes) => (
                  <Button key={minutes} type="button" size="sm" variant={duration === String(minutes) ? "default" : "outline"} onClick={() => setDuration(String(minutes))}>
                    {minutes} 分钟
                  </Button>
                ))}
              </div>
            </div>
            <Button type="button" className="w-full" onClick={createTimeBlock}>创建时间块</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dailyCloseOpen} onOpenChange={setDailyCloseOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>每日收尾</DialogTitle></DialogHeader>
          <p className="text-xs text-stone-500">处理今天尚未完成的日常任务，避免它们悄悄留在列表里。</p>
          <div className="space-y-2">
            {todayTasks.filter((task) => !task.done).length > 0 ? todayTasks.filter((task) => !task.done).map((task) => (
              <div key={task.id} className="rounded-lg border border-stone-200 p-3">
                <p className="text-sm font-medium text-stone-900">{task.name}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Button type="button" size="xs" variant="outline" onClick={() => moveToTomorrow(task)}>移到明天</Button>
                  <Button type="button" size="xs" variant="outline" onClick={() => turnIntoLongTask(task)}>转长期任务</Button>
                  <Button type="button" size="xs" variant="outline" onClick={() => abandonDailyTask(task)}>标记放弃</Button>
                  <Button type="button" size="xs" onClick={() => onToggleTask(task.id)}><CheckCircle className="h-3 w-3" />标记完成</Button>
                </div>
              </div>
            )) : <p className="rounded-lg border border-dashed border-emerald-200 bg-emerald-50 px-3 py-5 text-center text-sm text-emerald-800">今天的日常任务已经处理完毕。</p>}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
