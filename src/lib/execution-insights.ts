import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { expandScheduleEvents } from "@/lib/recurrence";
import { splitScheduleEventByDay } from "@/lib/schedule-layout";
import type { LongTask, ScheduleEvent } from "@/lib/types";

export type FocusTarget = { id: string; title: string; category: string };
export type FocusSession = FocusTarget & { startedAt: number; endedAt: number; sessionId: string };
export type FocusState = {
  active: (FocusTarget & { startedAt: number | null; elapsedMs: number }) | null;
  sessions: FocusSession[];
};
export const EMPTY_FOCUS: FocusState = { active: null, sessions: [] };

export function elapsedFocusMs(state: FocusState, now: number) {
  return state.active ? state.active.elapsedMs + (state.active.startedAt === null ? 0 : Math.max(0, now - state.active.startedAt)) : 0;
}

export function pauseFocus(state: FocusState, now: number, sessionId: string): FocusState {
  const active = state.active;
  if (!active || active.startedAt === null) return state;
  const endedAt = Math.max(active.startedAt, now);
  return {
    active: { ...active, startedAt: null, elapsedMs: elapsedFocusMs(state, endedAt) },
    sessions: endedAt > active.startedAt
      ? [...state.sessions, { id: active.id, title: active.title, category: active.category, startedAt: active.startedAt, endedAt, sessionId }]
      : state.sessions,
  };
}

export function normalizeFocusState(value: unknown): FocusState {
  if (!value || typeof value !== "object") return EMPTY_FOCUS;
  const state = value as FocusState;
  const targetValid = (target: FocusTarget) => target && typeof target.id === "string" && typeof target.title === "string" && typeof target.category === "string";
  const timeValid = (time: unknown): time is number => typeof time === "number" && Number.isFinite(time) && time >= 0;
  return {
    active: state.active && targetValid(state.active) && timeValid(state.active.elapsedMs)
      && (state.active.startedAt === null || timeValid(state.active.startedAt)) ? state.active : null,
    sessions: Array.isArray(state.sessions) ? state.sessions.filter((session) => targetValid(session)
      && typeof session.sessionId === "string" && timeValid(session.startedAt) && timeValid(session.endedAt) && session.endedAt > session.startedAt) : [],
  };
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
  const occupied = occupiedMinutes(remainingEvents.map((event) => [Math.max(start, event.startHour * 60), Math.min(end, event.endHour * 60)]));
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
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(first, i);
    const date = format(day, "yyyy-MM-dd");
    const start = parseISO(date).getTime();
    const end = addDays(parseISO(date), 1).getTime();
    let actual = 0;
    for (const session of sessions) {
      const minutes = Math.max(0, Math.min(end, session.endedAt) - Math.max(start, session.startedAt)) / 60000;
      actual += minutes;
      category(session.category).actual += minutes;
    }
    return { date, planned: segments.filter((event) => event.displayDate === date).reduce((total, event) => total + Math.max(0, event.endHour - event.startHour) * 60, 0), actual };
  });
  const today = format(now, "yyyy-MM-dd");
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
