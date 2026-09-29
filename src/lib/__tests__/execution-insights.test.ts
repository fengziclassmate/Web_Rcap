import { describe, expect, it } from "vitest";
import { dailyCapacity, EMPTY_FOCUS, elapsedFocusMs, eventsInDays, normalizeFocusState, occupiedMinutes, pauseFocus, weeklyInsights } from "../execution-insights";
import { normalizeEvents, normalizeTasks } from "../normalizers";

const now = new Date(2026, 8, 29, 10);
const date = "2026-09-29";
const event = (patch = {}) => normalizeEvents([{ id: "event", date, startHour: 10, endHour: 11, ...patch }])[0];
const task = (patch = {}) => normalizeTasks([{ id: "task", dueDate: date, taskType: "daily", uncertainty: { estimateMaxMinutes: 120 }, ...patch }])[0];

describe("execution capacity", () => {
  it("merges overlaps and touching intervals without double counting", () => {
    expect(occupiedMinutes([[60, 120], [90, 180], [180, 200], [70, 80]])).toBe(140);
  });
  it("clips to remaining available hours and discounts linked scheduled time", () => {
    const result = dailyCapacity([event({ linkedDailyTaskId: "task" }), event({ id: "other", startHour: 10.5, endHour: 11.5 })], [task()], now, 9, 12);
    expect(result).toMatchObject({ occupied: 90, free: 30, demand: 60, overload: 30 });
  });
  it("does not discount the same linked occupied interval twice", () => {
    const result = dailyCapacity([event({ linkedDailyTaskId: "task" }), event({ id: "duplicate", linkedDailyTaskId: "task" })], [task({ uncertainty: { estimateMaxMinutes: 180 } })], now, 9, 12);
    expect(result).toMatchObject({ free: 60, demand: 120, overload: 60 });
  });
  it("counts unknown estimates explicitly, excludes done/future/abandoned tasks", () => {
    const result = dailyCapacity([], [task({ uncertainty: null }), task({ id: "done", done: true }), task({ id: "future", dueDate: "2026-09-30" }), task({ id: "abandoned", abandonedAt: now.toISOString() })], now, 9, 12);
    expect(result).toMatchObject({ unknown: 1, demand: 0, pending: 1 });
  });
  it("has zero capacity after the end of the configured day", () => {
    expect(dailyCapacity([event()], [task()], new Date(2026, 8, 29, 23), 9, 22).free).toBe(0);
  });
  it("includes previous-day overnight recurrence and excludes exceptions", () => {
    const overnight = event({ date: "2026-09-28", startHour: 23, endHour: 2, recurrence: { kind: "daily" }, exceptionDates: [date] });
    const segments = eventsInDays([overnight], date, date);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ startHour: 0, endHour: 2, displayDate: date });
  });
  it("clips multi-day events to the selected week", () => {
    const report = weeklyInsights([event({ date: "2026-09-27", endDate: "2026-09-29", startHour: 23, endHour: 1 })], [], [], now, now);
    expect(report.planned).toBe(25 * 60);
  });
});

describe("focus and review", () => {
  it("records elapsed wall time once and never counts pauses", () => {
    const started = { ...EMPTY_FOCUS, active: { id: "task", title: "论文", category: "任务", startedAt: 1000, elapsedMs: 0 } };
    const paused = pauseFocus(started, 61000, "one");
    expect(elapsedFocusMs(paused, 100000)).toBe(60000);
    expect(pauseFocus(paused, 100000, "two").sessions).toHaveLength(1);
    const resumed = { ...paused, active: { ...paused.active!, startedAt: 121000 } };
    const ended = pauseFocus(resumed, 181000, "two");
    expect(elapsedFocusMs(ended, 999999)).toBe(120000);
    expect(ended.sessions).toHaveLength(2);
  });
  it("restores a running timer and ignores corrupt persisted data", () => {
    expect(normalizeFocusState({ active: { id: "x", title: "x", category: "x", startedAt: 1000, elapsedMs: 2000 }, sessions: [] }).active?.elapsedMs).toBe(2000);
    expect(normalizeFocusState({ active: { startedAt: -1 }, sessions: [null, {}] })).toEqual(EMPTY_FOCUS);
  });
  it("splits actual time at local midnight and counts completedAt rather than dueDate", () => {
    const report = weeklyInsights([event({ isCompleted: true })], [task({ done: true, dueDate: "2026-10-20", completedAt: now.toISOString() })], [{ id: "task", title: "论文", category: "任务", sessionId: "session", startedAt: new Date(2026, 8, 28, 23, 30).getTime(), endedAt: new Date(2026, 8, 29, 0, 30).getTime() }], now, now);
    expect(report.days[0].actual).toBe(30);
    expect(report.days[1].actual).toBe(30);
    expect(report.completed).toBe(1);
    expect(report.planned).toBe(60);
    expect(report.actual).toBe(60);
  });
  it("never infers actual effort from completing a schedule event", () => {
    expect(weeklyInsights([event({ isCompleted: true })], [], [], now, now).actual).toBe(0);
  });
});
