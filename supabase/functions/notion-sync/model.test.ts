import { describe, expect, it } from "vitest";
import type { LongTask, ProjectCheckin } from "../../../src/lib/types";
import {
  newTask,
  patchCheckin,
  patchTask,
  projectCycle,
  readCheckin,
  readTask,
  reconcile,
  updateEventsLinkedToDailyTask,
  type TaskFields,
} from "./model.ts";

const createdAt = "2026-11-18T16:05:00.000Z";
const now = "2026-11-19T04:00:00.000Z";
const taskFields: TaskFields = { title: "Review results", date: null, notes: "", status: "open" };
const emptyChanges = { local: {}, remote: {}, conflicts: [] };

describe("task synchronization", () => {
  it("uses the Shanghai creation day without writing a fallback date to Notion", () => {
    const task: LongTask = newTask("task-1", taskFields, createdAt, now);
    expect(task.dueDate).toBe("2026-11-19");
    const local = readTask(task);
    const base = { local, remote: taskFields };
    expect(reconcile(base, local, taskFields)).toEqual(emptyChanges);
    expect(reconcile(base, { ...local, date: "2026-11-21" }, taskFields)).toEqual({
      ...emptyChanges,
      remote: { date: "2026-11-21" },
    });
    expect(patchTask({ ...task, dueDate: "2026-11-21" }, { date: null }, now).dueDate).toBe("2026-11-19");
  });

  it("merges different fields while isolating a conflict on the same field", () => {
    const base = { local: taskFields, remote: taskFields };
    const local = { ...taskFields, title: "Local title", notes: "Local notes" };
    const remote: TaskFields = { ...taskFields, title: "Notion title", status: "done" };
    expect(reconcile(base, local, remote)).toEqual({
      local: { status: "done" },
      remote: { notes: "Local notes" },
      conflicts: ["title"],
    });
    expect(reconcile(base, local, local)).toEqual(emptyChanges);
  });

  it("updates completion, cancellation and reopening without changing other task fields", () => {
    const task = { ...newTask("task-1", taskFields, createdAt, now), isTodayFocus: true, plannedTime: "09:30" };
    const completed = patchTask(task, { status: "done" }, now);
    expect(completed).toMatchObject({ completedAt: now, done: true, isTodayFocus: true });
    const cancelled = patchTask(completed, { status: "cancelled" }, now);
    expect(cancelled).toMatchObject({ done: false, completedAt: null, abandonedAt: now, isTodayFocus: false });
    expect(readTask(cancelled).status).toBe("cancelled");
    const reopened = patchTask(cancelled, { status: "open" }, now);
    expect(reopened).toMatchObject({ done: false, completedAt: null, abandonedAt: null, plannedTime: "09:30" });
  });

  it("updates explicitly linked and inherited recurring events", () => {
    const events = [{
      linkedDailyTaskId: "task-1",
      isCompleted: false,
      recurrenceOverrides: {
        "2026-11-19": { title: "Different title" },
        "2026-11-20": { linkedDailyTaskId: "task-2", isCompleted: false },
      },
    }];
    const completed = updateEventsLinkedToDailyTask(events, "task-1", true);
    expect(completed[0]).toEqual({
      ...events[0],
      isCompleted: true,
      recurrenceOverrides: {
        ...events[0].recurrenceOverrides,
        "2026-11-19": { title: "Different title", isCompleted: true },
      },
    });
    expect(updateEventsLinkedToDailyTask(completed, "task-1", false)[0].isCompleted).toBe(false);
  });
});

describe("project check-in synchronization", () => {
  const date = "2026-11-19";
  const day = { date, note: "Read the methods section" };
  const project: ProjectCheckin = {
    id: "project-1",
    name: "Reading",
    description: "",
    startDate: date,
    checkins: [day],
    dailyCheckins: [],
    dailyCompletions: [],
  };

  it("restores the retained note after unchecking and keeps retries idempotent", () => {
    const unchecked = patchCheckin(project, date, { checked: false });
    expect(readCheckin(unchecked, date)).toEqual({ checked: false });
    expect(readCheckin(unchecked, date, true, day.note)).toEqual({ checked: false, note: day.note });
    const restored = patchCheckin(unchecked, date, { checked: true }, day.note);
    expect(restored.checkins).toEqual([day]);
    expect(patchCheckin(restored, date, { checked: true })).toBe(restored);
  });

  it("changes only the mapped date and identifies a same-day phase restart", () => {
    const archive = { id: "archive-1", startDate: date, endDate: date, archivedAt: now, checkins: [day] };
    const restarted: ProjectCheckin = { ...project, checkins: [], archives: [archive] };
    expect(projectCycle(project)).not.toBe(projectCycle(restarted));
    expect(patchCheckin(restarted, "2026-11-18", { checked: true })).toBe(restarted);
    const current = patchCheckin(restarted, date, { checked: true, note: "New phase note" });
    expect(current.checkins).toEqual([{ date, note: "New phase note" }]);
    expect(current.archives).toBe(restarted.archives);
  });
});
