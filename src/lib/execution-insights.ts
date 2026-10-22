import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { expandScheduleEvents } from "@/lib/recurrence";
import { splitScheduleEventByDay } from "@/lib/schedule-layout";
import { eventTimingsInRange } from "@/lib/event-timing";
import type { LongTask, ScheduleEvent } from "@/lib/types";
import type { BoardTask, ProjectBoard } from "@/lib/project-boards";

export type FocusTarget = { id: string; title: string; category: string; goalMinutes?: number };
export type FocusSession = FocusTarget & { startedAt: number; endedAt: number; sessionId: string; runId?: string };
export type FocusState = {
  active: (FocusTarget & { startedAt: number | null; elapsedMs: number; runId?: string }) | null;
  sessions: FocusSession[];
};
export const EMPTY_FOCUS: FocusState = { active: null, sessions: [] };

export function elapsedFocusMs(state: FocusState, now: number) {
  if (state.active?.runId) {
    const recorded = state.sessions.filter((session) => session.runId === state.active!.runId);
    if (recorded.length) return occupiedMinutes([...recorded.map((session): [number, number] => [session.startedAt, session.endedAt]), ...(state.active.startedAt === null ? [] : [[state.active.startedAt, Math.max(state.active.startedAt, now)] as [number, number]])]);
  }
  return state.active ? state.active.elapsedMs + (state.active.startedAt === null ? 0 : Math.max(0, now - state.active.startedAt)) : 0;
}

/** Pause records are append-only; retrying or merging another device must not duplicate them. */
export function mergeFocusSessions(sessions: FocusSession[]) {
  const unique = new Map<string, FocusSession>();
  for (const session of sessions) {
    const previous = unique.get(session.sessionId);
    if (!previous || session.endedAt > previous.endedAt) unique.set(session.sessionId, session);
  }
  return [...unique.values()].sort((a, b) => a.startedAt - b.startedAt || a.sessionId.localeCompare(b.sessionId));
}

function focusDuration(sessions: FocusSession[], start = 0, end = Infinity) {
  const runs = new Map<string, Array<[number, number]>>();
  for (const session of sessions) {
    const key = session.runId ?? session.sessionId;
    const intervals = runs.get(key) ?? [];
    intervals.push([Math.max(start, session.startedAt), Math.min(end, session.endedAt)]);
    runs.set(key, intervals);
  }
  return [...runs.values()].reduce((total, intervals) => total + occupiedMinutes(intervals), 0);
}

export function pauseFocus(state: FocusState, now: number, sessionId: string): FocusState {
  const active = state.active;
  if (!active || active.startedAt === null) return state;
  const endedAt = Math.max(active.startedAt, now);
  return normalizeFocusState({
    active: { ...active, startedAt: null, elapsedMs: elapsedFocusMs(state, endedAt) },
    sessions: endedAt > active.startedAt
      ? [...state.sessions, { id: active.id, title: active.title, category: active.category, startedAt: active.startedAt, endedAt, sessionId, ...(active.runId ? { runId: active.runId } : {}), ...(active.goalMinutes ? { goalMinutes: active.goalMinutes } : {}) }]
      : state.sessions,
  });
}

export function normalizeFocusState(value: unknown): FocusState {
  if (!value || typeof value !== "object") return EMPTY_FOCUS;
  const state = value as FocusState;
  const targetValid = (target: FocusTarget) => target && typeof target.id === "string" && typeof target.title === "string" && typeof target.category === "string";
  const timeValid = (time: unknown): time is number => typeof time === "number" && Number.isFinite(time) && time >= 0;
  function metadata(target: FocusTarget & { runId?: string }) {
    const { goalMinutes, runId } = target;
    // JSONB does not preserve object key order; canonical fields also stabilize sync acknowledgements.
    return { id: target.id, title: target.title, category: target.category,
      ...(typeof goalMinutes === "number" && Number.isInteger(goalMinutes) && goalMinutes > 0 && goalMinutes <= 240 ? { goalMinutes } : {}),
      ...(typeof runId === "string" && runId ? { runId } : {}),
    };
  }
  return {
    active: state.active && targetValid(state.active) && timeValid(state.active.elapsedMs)
      && (state.active.startedAt === null || timeValid(state.active.startedAt)) ? { ...metadata(state.active), startedAt: state.active.startedAt, elapsedMs: state.active.elapsedMs } : null,
    sessions: Array.isArray(state.sessions) ? state.sessions.filter((session) => targetValid(session)
      && typeof session.sessionId === "string" && timeValid(session.startedAt) && timeValid(session.endedAt) && session.endedAt > session.startedAt)
      .map((session) => ({ ...metadata(session), startedAt: session.startedAt, endedAt: session.endedAt, sessionId: session.sessionId })) : [],
  };
}

export function projectFocusTarget(board: ProjectBoard, task: BoardTask): FocusTarget {
  return { id: `board:${board.id}:${task.id}`, title: task.title, category: board.name };
}

export function focusTargets(events: ScheduleEvent[], tasks: LongTask[], boards: ProjectBoard[], today: string) {
  return [
    ...tasks.filter((task) => task.taskType === "daily" && !task.done && !task.abandonedAt && (task.dueDate <= today || task.isTodayFocus))
      .sort((a, b) => Number(b.isTodayFocus) - Number(a.isTodayFocus))
      .map((task) => ({ id: `task:${task.id}`, title: task.name, category: "任务", group: task.isTodayFocus ? "重点任务" : "今日待办" })),
    ...eventsInDays(events, today, today).filter((event) => !event.isCompleted)
      .map((event) => ({ id: `event:${event.id}`, title: event.title, category: event.category, group: "今日日程" })),
    ...boards.filter((board) => !board.archived).flatMap((board) => board.tasks.filter((task) => task.status !== "done")
      .map((task) => ({ ...projectFocusTarget(board, task), group: "项目任务" }))),
    ...tasks.filter((task) => task.taskType !== "daily" && !task.done && !task.abandonedAt)
      .map((task) => ({ id: `task:${task.id}`, title: task.name, category: "任务", group: "其他任务" })),
    { id: "free", title: "自由专注", category: "自由专注", group: "自由专注" },
  ];
}

export function focusHistory(sessions: FocusSession[]) {
  const runs = new Map<string, FocusSession & { intervals: Array<[number, number]> }>();
  for (const session of sessions) {
    const key = session.runId ?? session.sessionId;
    const previous = runs.get(key);
    if (previous) {
      previous.endedAt = Math.max(previous.endedAt, session.endedAt);
      previous.startedAt = Math.min(previous.startedAt, session.startedAt);
      previous.intervals.push([session.startedAt, session.endedAt]);
    } else runs.set(key, { ...session, intervals: [[session.startedAt, session.endedAt]] });
  }
  return [...runs.values()].map(({ intervals, ...run }) => ({ ...run, durationMs: occupiedMinutes(intervals) })).sort((a, b) => b.endedAt - a.endedAt);
}

export function focusDaySummary(state: FocusState, now: Date) {
  const start = parseISO(format(now, "yyyy-MM-dd")).getTime();
  const end = addDays(new Date(start), 1).getTime();
  const live = state.active?.startedAt != null && now.getTime() > state.active.startedAt ? [{ ...state.active, startedAt: state.active.startedAt, endedAt: now.getTime(), sessionId: "current" }] : [];
  const durationMs = focusDuration([...state.sessions, ...live], start, end);
  const completed = focusHistory(state.sessions).filter((run) => run.endedAt >= start && run.endedAt < end && (!state.active?.runId || run.runId !== state.active.runId)).length;
  return { minutes: durationMs / 60000, completed };
}

// Include the previous day so overnight occurrences contribute to today's capacity.
export function eventsInDays(events: ScheduleEvent[], from: string, to: string) {
  return expandScheduleEvents(events, format(addDays(parseISO(from), -1), "yyyy-MM-dd"), to)
    .flatMap((event) => splitScheduleEventByDay(event as ScheduleEvent))
    .filter((event) => event.displayDate >= from && event.displayDate <= to);
}

export function occupiedMinutes(intervals: Array<[number, number]>) {
  let end = -Infinity;
  let total = 0;
  for (const [start, nextEnd] of [...intervals].sort((a, b) => a[0] - b[0])) {
    if (nextEnd <= start) continue;
    total += Math.max(0, nextEnd - Math.max(start, end));
    end = Math.max(end, nextEnd);
  }
  return total;
}

export function dailyCapacity(events: ScheduleEvent[], tasks: LongTask[], now: Date, startHour: number, endHour: number) {
  const date = format(now, "yyyy-MM-dd");
  const start = Math.max(startHour * 60, now.getHours() * 60 + now.getMinutes());
  const end = endHour * 60;
  const remainingEvents = eventsInDays(events, date, date).filter((event) => event.endHour * 60 > start && event.startHour * 60 < end);
  const midnight = parseISO(date).getTime();
  const occupied = occupiedMinutes(eventTimingsInRange(events, date, date).map((item) => [Math.max(start, (item.start.getTime() - midnight) / 60000), Math.min(end, (item.end.getTime() - midnight) / 60000)]));
  const free = Math.max(0, end - start - occupied);
  const scheduledIntervals = new Map<string, Array<[number, number]>>();
  for (const event of remainingEvents) {
    if (!event.linkedDailyTaskId || event.isCompleted) continue;
    const intervals = scheduledIntervals.get(event.linkedDailyTaskId) ?? [];
    intervals.push([Math.max(start, event.startHour * 60), Math.min(end, event.endHour * 60)]);
    scheduledIntervals.set(event.linkedDailyTaskId, intervals);
  }
  const pending = tasks.filter((task) => task.taskType === "daily" && !task.done && !task.abandonedAt && task.dueDate <= date);
  let demand = 0;
  let unknown = 0;
  for (const task of pending) {
    const estimate = task.uncertainty?.estimateMaxMinutes ?? task.uncertainty?.estimateMinMinutes;
    if (estimate == null) { unknown++; continue; }
    demand += Math.max(0, estimate - occupiedMinutes(scheduledIntervals.get(task.id) ?? []));
  }
  return { free, occupied, demand, unknown, overload: Math.max(0, demand - free), pending: pending.length };
}

export function weeklyInsights(events: ScheduleEvent[], tasks: LongTask[], sessions: FocusSession[], anchor: Date, now: Date) {
  const first = startOfWeek(anchor, { weekStartsOn: 1 });
  const from = format(first, "yyyy-MM-dd");
  const to = format(addDays(first, 6), "yyyy-MM-dd");
  const segments = eventsInDays(events, from, to);
  const categories = new Map<string, { planned: number; actual: number }>();
  const category = (key: string) => {
    if (!categories.has(key)) categories.set(key, { planned: 0, actual: 0 });
    return categories.get(key)!;
  };
  for (const event of segments) category(event.category).planned += Math.max(0, event.endHour - event.startHour) * 60;
  for (const session of sessions) category(session.category);
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(first, i);
    const date = format(day, "yyyy-MM-dd");
    const start = parseISO(date).getTime();
    const end = addDays(parseISO(date), 1).getTime();
    const actual = focusDuration(sessions, start, end) / 60000;
    return { date, planned: segments.filter((event) => event.displayDate === date).reduce((total, event) => total + Math.max(0, event.endHour - event.startHour) * 60, 0), actual };
  });
  const today = format(now, "yyyy-MM-dd");
  for (const [name, value] of categories) value.actual = focusDuration(sessions.filter((session) => session.category === name), parseISO(from).getTime(), addDays(parseISO(to), 1).getTime()) / 60000;
  const completed = tasks.filter((task) => {
    if (!task.done || !task.completedAt) return false;
    const completedAt = parseISO(task.completedAt);
    if (Number.isNaN(completedAt.getTime())) return false;
    const date = format(completedAt, "yyyy-MM-dd");
    return date >= from && date <= to;
  }).length;
  const overdue = tasks.filter((task) => !task.done && !task.abandonedAt && task.dueDate >= from && task.dueDate <= to && task.dueDate < today).length;
  return { from, to, days, completed, overdue, planned: days.reduce((n, day) => n + day.planned, 0), actual: days.reduce((n, day) => n + day.actual, 0), categories: [...categories].map(([name, value]) => ({ name, ...value })).filter((item) => item.planned || item.actual) };
}

export function formatMinutes(minutes: number) {
  const rounded = Math.round(minutes);
  return rounded < 60 ? `${rounded} 分钟` : `${Math.floor(rounded / 60)} 小时${rounded % 60 ? ` ${rounded % 60} 分钟` : ""}`;
}
