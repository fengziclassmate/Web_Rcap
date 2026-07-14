import { describe, expect, it } from "vitest";
import {
  normalizeDashboardUiPreferences,
  normalizeEvents,
  normalizeTasks,
} from "../normalizers";

describe("normalizers", () => {
  it("returns empty arrays for invalid task and event payloads", () => {
    expect(normalizeTasks(undefined)).toEqual([]);
    expect(normalizeTasks({})).toEqual([]);
    expect(normalizeEvents(null)).toEqual([]);
    expect(normalizeEvents("bad")).toEqual([]);
  });

  it("normalizes task defaults without demo data fallback", () => {
    expect(normalizeTasks([{ name: "Task" }])).toEqual([
      expect.objectContaining({
        name: "Task",
        done: false,
        notes: "",
        precautions: [],
        subtasks: [],
        taskType: "long",
        isTodayFocus: false,
      }),
    ]);
  });

  it("normalizes invalid task priority to the default priority", () => {
    expect(normalizeTasks([{ name: "Done", done: true, priority: "old-priority" }])).toEqual([
      expect.objectContaining({
        priority: "\u4e0d\u7d27\u6025\u4e0d\u91cd\u8981",
      }),
    ]);
  });
  it("keeps daily task metadata while defaulting legacy tasks to long tasks", () => {
    const [dailyTask, legacyTask] = normalizeTasks([
      { name: "Today", taskType: "daily", isTodayFocus: true },
      { name: "Legacy" },
    ]);
    expect(dailyTask).toMatchObject({ taskType: "daily", isTodayFocus: true });
    expect(legacyTask).toMatchObject({ taskType: "long", isTodayFocus: false });
  });
  it("normalizes event recurrence and defaults", () => {
    const [event] = normalizeEvents([
      {
        title: "Read",
        recurrence: { kind: "weekly", weekdays: [1, 8, "x"] },
      },
    ]);
    expect(event).toMatchObject({
      title: "Read",
      startHour: 9,
      endHour: 10,
      recurrence: { kind: "weekly", weekdays: [1] },
      exceptionDates: [],
    });
  });

  it("normalizes dashboard preferences safely", () => {
    expect(normalizeDashboardUiPreferences({ expandedTasks: ["a", 1] })).toMatchObject({
      annualSectionOpen: true,
      longTaskSectionOpen: true,
      completedSectionOpen: true,
      expandedTasks: ["a"],
    });
  });
});
