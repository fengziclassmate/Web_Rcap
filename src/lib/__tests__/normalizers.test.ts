import { describe, expect, it } from "vitest";
import {
  normalizeDashboardUiPreferences,
  normalizeEvents,
  normalizeProjectCheckins,
  normalizeShoppingItems,
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

  it("normalizes shopping items while preserving their added time", () => {
    expect(normalizeShoppingItems([
      {
        id: "shopping-1",
        name: "  便携水杯  ",
        addedAt: "2026-08-03T10:15:00.000Z",
        done: true,
      },
      { name: "" },
    ])).toEqual([
      {
        id: "shopping-1",
        name: "便携水杯",
        addedAt: "2026-08-03T10:15:00.000Z",
        done: true,
      },
    ]);
  });
  it("keeps project archives and defaults legacy projects to an empty archive", () => {
    const [archivedProject, legacyProject] = normalizeProjectCheckins([
      {
        id: "project-1",
        name: "健身",
        startDate: "2026-07-01",
        checkins: [],
        archives: [{
          id: "archive-1",
          startDate: "2026-06-01",
          endDate: "2026-06-30",
          archivedAt: "2026-07-01T00:00:00.000Z",
          checkins: [{ date: "2026-06-30", note: "完成训练" }],
        }],
      },
      { id: "project-2", name: "旧项目", checkins: [] },
    ]);

    expect(archivedProject.archives).toEqual([
      expect.objectContaining({ id: "archive-1", checkins: [{ date: "2026-06-30", note: "完成训练" }] }),
    ]);
    expect(legacyProject.archives).toEqual([]);
  });
  it("keeps daily task metadata while defaulting legacy tasks to long tasks", () => {
    const [dailyTask, legacyTask] = normalizeTasks([
      { name: "Today", taskType: "daily", isTodayFocus: true },
      { name: "Legacy" },
    ]);
    expect(dailyTask).toMatchObject({ taskType: "daily", isTodayFocus: true });
    expect(legacyTask).toMatchObject({ taskType: "long", isTodayFocus: false });
  });
  it("normalizes uncertainty ranges and research task fields", () => {
    const [task] = normalizeTasks([{
      name: "验证模型",
      uncertainty: {
        level: "high",
        workType: "data",
        estimateMinMinutes: 120,
        estimateMaxMinutes: 60,
        unknowns: ["字段是否完整", ""],
        successCriteria: "得到可解释结果",
        minimumValidationStep: "先跑200条样本",
        branchOptions: ["继续", "更换模型"],
        stopCondition: "数据缺失超过30%",
      },
    }]);

    expect(task.uncertainty).toMatchObject({
      level: "high",
      workType: "data",
      estimateMinMinutes: 120,
      estimateMaxMinutes: 120,
      unknowns: ["字段是否完整"],
      minimumValidationStep: "先跑200条样本",
    });
  });
  it("normalizes event recurrence and defaults", () => {
    const [event] = normalizeEvents([
      {
        title: "Read",
        meetingRecordId: "meeting-1",
        recurrence: { kind: "weekly", weekdays: [1, 8, "x"] },
      },
    ]);
    expect(event).toMatchObject({
      title: "Read",
      startHour: 9,
      endHour: 10,
      meetingRecordId: "meeting-1",
      recurrence: { kind: "weekly", weekdays: [1] },
      exceptionDates: [],
    });
  });

  it("normalizes dashboard preferences safely", () => {
    expect(normalizeDashboardUiPreferences({
      timeGranularity: "45-15",
      dailyArchiveSectionOpen: true,
      expandedTasks: ["a", 1],
    })).toMatchObject({
      timeGranularity: "45-15",
      annualSectionOpen: true,
      longTaskSectionOpen: true,
      completedSectionOpen: true,
      dailyArchiveSectionOpen: true,
      expandedTasks: ["a"],
    });
    expect(normalizeDashboardUiPreferences({ timeGranularity: "invalid" })).toMatchObject({
      timeGranularity: 60,
      dailyArchiveSectionOpen: false,
    });
  });
});
