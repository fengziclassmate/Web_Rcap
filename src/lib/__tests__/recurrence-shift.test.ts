import { describe, expect, it } from "vitest";
import { expandScheduleEvents, updateRecurrenceFuture, updateTasksLinkedToScheduleEvent } from "../recurrence";
import type { ScheduleEvent } from "../types";

const sleep: ScheduleEvent = { id: "sleep", date: "2026-07-27", title: "睡眠", startHour: 22, endHour: 6, notes: "", requirements: [], isCompleted: false, category: "生活", tag: null, recurrence: { kind: "daily" } };

describe("rescheduling recurring dates", () => {
  it("moves the selected and following nights forward while preserving the past", () => {
    const next = updateRecurrenceFuture([sleep], "sleep__2026-07-29", { date: "2026-07-30", startHour: 2, endHour: 8 }, "new-series");
    expect(next[0]).toMatchObject({ date: "2026-07-27", startHour: 22, recurrenceEndExclusive: "2026-07-29" });
    expect(next[1]).toMatchObject({ id: "new-series", date: "2026-07-30", startHour: 2, endHour: 8 });
    expect(expandScheduleEvents(next, "2026-07-29", "2026-07-31").map((event) => event.date)).toEqual(["2026-07-30", "2026-07-31"]);
  });
  it("shifts weekday rules, exceptions, overrides and the series cutoff together", () => {
    const weekly = { ...sleep, recurrence: { kind: "weekly" as const, weekdays: [1, 3, 5] }, exceptionDates: ["2026-07-31"], recurrenceOverrides: { "2026-08-03": { notes: "保留备注" } }, recurrenceEndExclusive: "2026-08-10" };
    const next = updateRecurrenceFuture([weekly], "sleep__2026-07-29", { date: "2026-07-30", startHour: 2, endHour: 8 }, "new-series");
    expect(next[1]).toMatchObject({ recurrence: { kind: "weekly", weekdays: [2, 4, 6] }, exceptionDates: ["2026-08-01"], recurrenceOverrides: { "2026-08-04": { notes: "保留备注" } }, recurrenceEndExclusive: "2026-08-11" });
  });
  it("keeps a recurring multi-day end date relative to each occurrence", () => {
    const events = expandScheduleEvents([{ ...sleep, date: "2026-07-27", endDate: "2026-07-29" }], "2026-07-30", "2026-07-31");
    expect(events.map((event) => event.endDate)).toEqual(["2026-08-01", "2026-08-02"]);
  });
  it("shifts linked future tasks by the same offset without moving past tasks to one common date", () => {
    const tasks = ["2026-07-27", "2026-07-29", "2026-07-31"].map((dueDate, index) => ({ id: `task-${index}`, name: "复习", done: false, dueDate }));
    const result = updateTasksLinkedToScheduleEvent(tasks, new Set(tasks.map((task) => task.id)), { date: "2026-07-30", dateShift: { from: "2026-07-29", days: 1 } }, "2026-07-29T10:00:00Z");
    expect(result.map((task) => task.dueDate)).toEqual(["2026-07-27", "2026-07-30", "2026-08-01"]);
  });
});
