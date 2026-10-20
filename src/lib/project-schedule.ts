import { addDays, differenceInCalendarDays, format, isValid, parseISO } from "date-fns";
import { createId } from "./id";
import { eventTiming } from "./event-timing";
import type { ProjectBoard, ProjectTaskLink } from "./project-boards";
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

export function findProjectSchedules(events: ScheduleEvent[], link: ProjectTaskLink) {
  return events.filter((event) => event.linkedProjectTask?.boardId === link.boardId && event.linkedProjectTask.taskId === link.taskId && event.linkedProjectTask.subtaskId === link.subtaskId)
    .sort((a, b) => a.date.localeCompare(b.date) || a.startHour - b.startHour);
}

export function reconcileProjectPlans(boards: ProjectBoard[], before: ScheduleEvent[], after: ScheduleEvent[]): ProjectBoard[] {
  const links = new Map<string, ProjectTaskLink>();
  const oldEvents = new Map(before.map((event) => [event.id, event]));
  const newEvents = new Map(after.map((event) => [event.id, event]));
  const plan = (event?: ScheduleEvent) => event && JSON.stringify([event.linkedProjectTask, event.date, event.endDate, event.startHour, event.endHour, event.isCompleted]);
  for (const id of new Set([...oldEvents.keys(), ...newEvents.keys()])) {
    const oldEvent = oldEvents.get(id); const newEvent = newEvents.get(id);
    if (plan(oldEvent) === plan(newEvent)) continue;
    for (const event of [oldEvent, newEvent]) if (event?.linkedProjectTask) links.set(JSON.stringify(event.linkedProjectTask), event.linkedProjectTask);
  }
  let result = boards;
  for (const link of links.values()) {
    const previous = findProjectSchedules(before, link).find((event) => !event.isCompleted);
    const next = findProjectSchedules(after, link).find((event) => !event.isCompleted);
    // Editing completed history must not erase a separately chosen future plan.
    if (!previous && !next) continue;
    const plannedDate = next?.date ?? "";
    if (resolveProjectTask(result, link)?.item.plannedDate === plannedDate) continue;
    result = result.map((board) => board.id !== link.boardId ? board : { ...board, tasks: board.tasks.map((task) => {
      if (task.id !== link.taskId) return task;
      if (link.subtaskId) return { ...task, subtasks: task.subtasks.map((item) => item.id === link.subtaskId ? { ...item, plannedDate } : item) };
      return { ...task, plannedDate };
    }) });
  }
  return result;
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
    if (next.title !== previous.title && event.title === previous.title) patch.title = next.title;
    const pending = next.plannedDate !== previous.plannedDate && findProjectSchedules(events, link).find((item) => !item.isCompleted);
    if (pending && pending.id === event.id) {
      if (!next.plannedDate) return [];
      patch.date = next.plannedDate;
      if (event.endDate) patch.endDate = format(addDays(parseISO(event.endDate), differenceInCalendarDays(parseISO(next.plannedDate), parseISO(event.date))), "yyyy-MM-dd");
    }
    return [Object.keys(patch).length ? { ...event, ...patch } : event];
  });
}

export function saveProjectSchedule(boards: ProjectBoard[], events: ScheduleEvent[], link: ProjectTaskLink, time: ProjectScheduleTime, eventId?: string) {
  const target = resolveProjectTask(boards, link);
  if (!target || target.board.archived) throw new Error("任务或项目已删除或归档，请重新打开后安排。");
  if (![time.date, time.endDate].every((date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && isValid(parseISO(date))) || ![time.startHour, time.endHour].every((hour) => Number.isFinite(hour) && hour >= 0 && hour < 24)) throw new Error("请选择有效的日期和时间。");
  const existing = eventId ? findProjectSchedules(events, link).find((event) => event.id === eventId) : undefined;
  if (eventId && !existing) throw new Error("该时段已删除或解除关联，请重新打开安排。");
  const event: ScheduleEvent = {
    id: existing?.id ?? createId("event"),
    notes: target.item.notes, requirements: [],
    category: target.board.kind === "learning" ? "学习" : target.board.kind === "research" ? "科研" : "其他",
    tag: null, ...existing, ...time, title: existing?.title ?? target.item.title,
    isCompleted: existing?.isCompleted ?? false, linkedProjectTask: link,
  };
  const timing = eventTiming(event);
  if (timing.end <= timing.start) throw new Error("结束时间必须晚于开始时间。");
  const nextEvents = existing ? events.map((item) => item.id === existing.id ? event : item) : [...events, event];
  return { events: nextEvents, boards: reconcileProjectPlans(boards, events, nextEvents) };
}

export function removeProjectSchedule(boards: ProjectBoard[], events: ScheduleEvent[], link: ProjectTaskLink, eventId: string) {
  if (!findProjectSchedules(events, link).some((event) => event.id === eventId)) return { boards, events };
  const nextEvents = events.filter((event) => event.id !== eventId);
  return { events: nextEvents, boards: reconcileProjectPlans(boards, events, nextEvents) };
}

export function projectScheduleLabel(event: ScheduleEvent) {
  const time = (hour: number) => `${String(Math.floor(hour) % 24).padStart(2, "0")}:${String(Math.round(hour * 60) % 60).padStart(2, "0")}`;
  const { start, end } = eventTiming(event);
  const overnight = format(end, "yyyy-MM-dd") !== format(start, "yyyy-MM-dd");
  return `${time(event.startHour)}–${overnight ? `${format(end, "M/d")} ` : ""}${time(event.endHour)}`;
}
