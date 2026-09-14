import { describe, expect, it } from "vitest";
import {
  expandScheduleEvents,
  getLinkedDailyTaskIdsForEventUpdate,
  moveRecurrenceOccurrence,
  unlinkDailyTaskFromEvents,
  updateEventsLinkedToDailyTask,
  updateRecurrenceFuture,
  updateTasksLinkedToScheduleEvent,
  type ExpandableScheduleEvent,
} from "../recurrence";

function event(patch: Partial<ExpandableScheduleEvent> = {}): ExpandableScheduleEvent {
  return {
    id: "evt-1",
    date: "2026-05-01",
    startHour: 9,
    endHour: 10,
    title: "Base event",
    notes: "",
    requirements: [],
    isCompleted: false,
    category: "task",
    tag: null,
    ...patch,
  };
}

describe("expandScheduleEvents", () => {
  it("returns non-recurring events inside the range", () => {
    const result = expandScheduleEvents([event()], "2026-05-01", "2026-05-07");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("evt-1");
  });

  it("omits non-recurring events outside the range", () => {
    const result = expandScheduleEvents([event()], "2026-05-02", "2026-05-07");
    expect(result).toEqual([]);
  });

  it("expands daily recurrence within the range", () => {
    const result = expandScheduleEvents(
      [event({ recurrence: { kind: "daily" } })],
      "2026-05-01",
      "2026-05-03",
    );
    expect(result.map((item) => item.date)).toEqual(["2026-05-01", "2026-05-02", "2026-05-03"]);
    expect(result[1].id).toBe("evt-1__2026-05-02");
  });

  it("expands weekly recurrence only on selected weekdays", () => {
    const result = expandScheduleEvents(
      [event({ date: "2026-05-04", recurrence: { kind: "weekly", weekdays: [1, 3] } })],
      "2026-05-04",
      "2026-05-10",
    );
    expect(result.map((item) => item.date)).toEqual(["2026-05-04", "2026-05-06"]);
  });

  it("skips exception dates", () => {
    const result = expandScheduleEvents(
      [event({ recurrence: { kind: "daily" }, exceptionDates: ["2026-05-02"] })],
      "2026-05-01",
      "2026-05-03",
    );
    expect(result.map((item) => item.date)).toEqual(["2026-05-01", "2026-05-03"]);
  });

  it("applies recurrence overrides", () => {
    const result = expandScheduleEvents(
      [
        event({
          recurrence: { kind: "daily" },
          recurrenceOverrides: {
            "2026-05-02": { title: "Changed", isCompleted: true },
          },
        }),
      ],
      "2026-05-02",
      "2026-05-02",
    );
    expect(result[0]).toMatchObject({
      title: "Changed",
      isCompleted: true,
      date: "2026-05-02",
    });
  });

  it("respects recurrenceEndExclusive", () => {
    const result = expandScheduleEvents(
      [event({ recurrence: { kind: "daily" }, recurrenceEndExclusive: "2026-05-03" })],
      "2026-05-01",
      "2026-05-05",
    );
    expect(result.map((item) => item.date)).toEqual(["2026-05-01", "2026-05-02"]);
  });
});

describe("moveRecurrenceOccurrence", () => {
  it("detaches one occurrence when it is moved to another date", () => {
    const result = moveRecurrenceOccurrence(
      [
        event({
          recurrence: { kind: "daily" },
          recurrenceOverrides: {
            "2026-05-02": { title: "Changed occurrence", category: "personal" },
          },
        }),
      ],
      "evt-1__2026-05-02",
      { date: "2026-05-03", startHour: 11, endHour: 12 },
      "event-detached",
    );

    expect(result[0]).toMatchObject({
      id: "evt-1",
      exceptionDates: ["2026-05-02"],
      recurrenceOverrides: {},
    });
    expect(result[1]).toMatchObject({
      id: "event-detached",
      date: "2026-05-03",
      startHour: 11,
      endHour: 12,
      title: "Changed occurrence",
      category: "personal",
      recurrence: null,
      exceptionDates: [],
      recurrenceOverrides: {},
      recurrenceEndExclusive: null,
    });
  });
});

describe("updateRecurrenceFuture", () => {
  it("keeps past completed occurrences unchanged and updates the selected day forward", () => {
    const result = updateRecurrenceFuture(
      [
        event({
          recurrence: { kind: "daily" },
          recurrenceOverrides: {
            "2026-05-02": { title: "已完成旧行程", isCompleted: true },
          },
        }),
      ],
      "evt-1__2026-05-04",
      { title: "新的未来行程", startHour: 11, endHour: 12 },
      "evt-future",
    );

    const expanded = expandScheduleEvents(result, "2026-05-02", "2026-05-05");
    expect(expanded.map(({ date, title, startHour, isCompleted }) => ({
      date,
      title,
      startHour,
      isCompleted,
    }))).toEqual([
      { date: "2026-05-02", title: "已完成旧行程", startHour: 9, isCompleted: true },
      { date: "2026-05-03", title: "Base event", startHour: 9, isCompleted: false },
      { date: "2026-05-04", title: "新的未来行程", startHour: 11, isCompleted: false },
      { date: "2026-05-05", title: "新的未来行程", startHour: 11, isCompleted: false },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].recurrenceEndExclusive).toBe("2026-05-04");
    expect(result[1]).toMatchObject({ id: "evt-future", date: "2026-05-04" });
  });
});

describe("daily task links", () => {
  it("renames a completed linked task without reopening it", () => {
    const completedAt = "2026-05-01T10:00:00.000Z";
    const result = updateTasksLinkedToScheduleEvent(
      [
        { id: "task-1", name: "原任务名称", done: true, completedAt },
        { id: "task-2", name: "其他任务", done: false, completedAt: null },
      ],
      new Set(["task-1"]),
      { title: "修改后的任务名称" },
      "2026-05-01T11:00:00.000Z",
    );

    expect(result[0]).toEqual({
      id: "task-1",
      name: "修改后的任务名称",
      done: true,
      completedAt,
    });
    expect(result[1].name).toBe("其他任务");
  });

  it("removes stale links from normal events and recurring overrides when a task is deleted", () => {
    const result = unlinkDailyTaskFromEvents(
      [
        event({ linkedDailyTaskId: "deleted-task" }),
        event({
          id: "recurring-event",
          recurrence: { kind: "daily" },
          recurrenceOverrides: {
            "2026-05-02": { linkedDailyTaskId: "deleted-task", isCompleted: true },
            "2026-05-03": { linkedDailyTaskId: "kept-task" },
          },
        }),
      ],
      "deleted-task",
    );

    expect(result[0].linkedDailyTaskId).toBeUndefined();
    expect(result[1].recurrenceOverrides?.["2026-05-02"]).toEqual({ isCompleted: true });
    expect(result[1].recurrenceOverrides?.["2026-05-03"]?.linkedDailyTaskId).toBe("kept-task");
  });

  it("updates normal events and only matching recurring overrides", () => {
    const result = updateEventsLinkedToDailyTask(
      [
        event({ linkedDailyTaskId: "task-1" }),
        event({
          id: "recurring-event",
          recurrence: { kind: "daily" },
          recurrenceOverrides: {
            "2026-05-02": { linkedDailyTaskId: "task-1" },
            "2026-05-03": { linkedDailyTaskId: "task-2", isCompleted: false },
          },
        }),
      ],
      "task-1",
      true,
    );

    expect(result[0].isCompleted).toBe(true);
    expect(result[1].recurrenceOverrides?.["2026-05-02"]?.isCompleted).toBe(true);
    expect(result[1].recurrenceOverrides?.["2026-05-03"]?.isCompleted).toBe(false);
  });

  it("finds the daily task linked to one recurring occurrence", () => {
    const events = [
      event({
        recurrence: { kind: "daily" },
        linkedDailyTaskId: "series-task",
        recurrenceOverrides: {
          "2026-05-02": { linkedDailyTaskId: "occurrence-task" },
        },
      }),
    ];

    expect(
      getLinkedDailyTaskIdsForEventUpdate(
        events,
        "evt-1__2026-05-02",
        "occurrence",
      ),
    ).toEqual(["occurrence-task"]);
  });

  it("finds only current and future task links for a future series update", () => {
    const events = [
      event({
        recurrence: { kind: "daily" },
        recurrenceOverrides: {
          "2026-05-02": { linkedDailyTaskId: "past-task" },
          "2026-05-04": { linkedDailyTaskId: "current-task" },
          "2026-05-05": { linkedDailyTaskId: "future-task" },
        },
      }),
    ];

    expect(
      getLinkedDailyTaskIdsForEventUpdate(
        events,
        "evt-1__2026-05-04",
        "future",
      ),
    ).toEqual(["current-task", "future-task"]);
  });
});
