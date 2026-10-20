import { addDays, differenceInCalendarDays, format, isValid, parseISO } from "date-fns";
import { createId } from "./id";
import { eventTiming } from "./event-timing";
import { setBoardTaskStatus, type ProjectBoard, type ProjectTaskLink } from "./project-boards";
import type { ScheduleEvent } from "./types";

export type ProjectScheduleTime = { date: string; endDate: string; startHour: number; endHour: number };

export function normalizeProjectTaskLink(value: unknown): ProjectTaskLink | undefined {
  if (!value || typeof value !== "object") return;
  const link = value as Partial<ProjectTaskLink>;
  if (typeof link.boardId !== "string" || !link.boardId || typeof link.taskId !== "string" || !link.taskId) return;
  if (link.subtaskId !== undefined && (typeof link.subtaskId !== "string" || !link.subtaskId)) return;
  return { boardId: link.boardId, taskId: link.taskId, ...(link.subtaskId ? { subtaskId: link.subtaskId } : {}) };
}

export function resolveProjectTask(boards: ProjectBoard[], link: ProjectTaskLink) {
  const board = boards.find((board) => board.id === link.boardId);
  const task = board?.tasks.find((task) => task.id === link.taskId);
  const item = link.subtaskId ? task?.subtasks.find((item) => item.id === link.subtaskId) : task;
  return board && task && item ? { board, task, item } : undefined;
}

export function findProjectSchedule(events: ScheduleEvent[], link: ProjectTaskLink) {
  return events.find((event) => event.linkedProjectTask?.boardId === link.boardId && event.linkedProjectTask.taskId === link.taskId && event.linkedProjectTask.subtaskId === link.subtaskId);
}

export function projectBoardsFromSchedule(boards: ProjectBoard[], event: ScheduleEvent, patch: Partial<ScheduleEvent>): ProjectBoard[] {
  const link = event.linkedProjectTask;
  const target = link && resolveProjectTask(boards, link);
  if (!link || !target) return boards;
  const item = target.item;
  const status = patch.isCompleted === true ? "done" : patch.isCompleted === false && item.status === "done" ? "todo" : item.status;
  const title = patch.title?.trim() || item.title;
  const plannedDate = typeof patch.date === "string" ? patch.date : item.plannedDate;
  if (status === item.status && title === item.title && plannedDate === item.plannedDate) return boards;
  return boards.map((board) => board.id !== link.boardId ? board : { ...board, tasks: board.tasks.map((task) => {
    if (task.id !== link.taskId) return task;
    if (link.subtaskId) return { ...task, subtasks: task.subtasks.map((subtask) => subtask.id === link.subtaskId ? { ...subtask, title, plannedDate, status } : subtask) };
    return { ...setBoardTaskStatus(task, status), title, plannedDate };
  }) });
}

export function schedulesFromProjectChanges(events: ScheduleEvent[], before: ProjectBoard[], after: ProjectBoard[]): ScheduleEvent[] {
  return events.flatMap((event) => {
    const link = event.linkedProjectTask;
    if (!link) return [event];
    const previous = resolveProjectTask(before, link)?.item;
    const next = resolveProjectTask(after, link)?.item;
    // Keep the historical time block when its source task is deleted.
    if (!next) { const standalone = { ...event }; delete standalone.linkedProjectTask; return [standalone]; }
    if (!previous) return [event];
    const patch: Partial<ScheduleEvent> = {};
    if (next.title !== previous.title) patch.title = next.title;
    if (next.status !== previous.status) patch.isCompleted = next.status === "done";
    if (next.plannedDate !== previous.plannedDate) {
      if (!next.plannedDate) return [];
      patch.date = next.plannedDate;
      if (event.endDate) patch.endDate = format(addDays(parseISO(event.endDate), differenceInCalendarDays(parseISO(next.plannedDate), parseISO(event.date))), "yyyy-MM-dd");
    }
    return [Object.keys(patch).length ? { ...event, ...patch } : event];
  });
}

export function saveProjectSchedule(boards: ProjectBoard[], events: ScheduleEvent[], link: ProjectTaskLink, time: ProjectScheduleTime) {
  const target = resolveProjectTask(boards, link);
  if (!target || target.board.archived) throw new Error("任务或项目已删除或归档，请重新打开后安排。");
  if (![time.date, time.endDate].every((date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && isValid(parseISO(date))) || ![time.startHour, time.endHour].every((hour) => Number.isFinite(hour) && hour >= 0 && hour < 24)) throw new Error("请选择有效的日期和时间。");
  const existing = findProjectSchedule(events, link);
  const event: ScheduleEvent = {
    id: existing?.id ?? createId("event"),
    notes: target.item.notes, requirements: [],
    category: target.board.kind === "learning" ? "学习" : target.board.kind === "research" ? "科研" : "其他",
    tag: null, ...existing, ...time, title: target.item.title,
    isCompleted: target.item.status === "done", linkedProjectTask: link,
  };
  const timing = eventTiming(event);
  if (timing.end <= timing.start) throw new Error("结束时间必须晚于开始时间。");
  return {
    events: existing ? events.map((item) => item.id === existing.id ? event : item) : [...events, event],
    boards: projectBoardsFromSchedule(boards, event, { date: time.date }),
  };
}

export function projectScheduleLabel(event: ScheduleEvent) {
  const time = (hour: number) => `${String(Math.floor(hour) % 24).padStart(2, "0")}:${String(Math.round(hour * 60) % 60).padStart(2, "0")}`;
  const { start, end } = eventTiming(event);
  const overnight = format(end, "yyyy-MM-dd") !== format(start, "yyyy-MM-dd");
  return `${time(event.startHour)}–${overnight ? `${format(end, "M/d")} ` : ""}${time(event.endHour)}`;
}
