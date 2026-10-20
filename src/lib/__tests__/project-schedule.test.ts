import { describe, expect, it } from "vitest";
import { createBoardSubtask, createBoardTask, createProjectBoard, type ProjectTaskLink } from "../project-boards";
import { findProjectSchedule, normalizeProjectTaskLink, projectBoardsFromSchedule, projectScheduleLabel, resolveProjectTask, saveProjectSchedule, schedulesFromProjectChanges } from "../project-schedule";
import { normalizePersistedSchedulePayload } from "../schedule-persistence";
import { mergeScheduleChanges } from "../schedule-merge";

function fixture(child = false) {
  const task = { ...createBoardTask("数据准备"), dueDate: "2026-10-25", subtasks: [{ ...createBoardSubtask("AOI 数据处理"), dueDate: "2026-10-24" }, createBoardSubtask("核对分类")] };
  const boards = [{ ...createProjectBoard("research", "城市用地诊断"), tasks: [task, createBoardTask("方法验证")] }];
  const link: ProjectTaskLink = { boardId: boards[0].id, taskId: task.id, ...(child ? { subtaskId: task.subtasks[0].id } : {}) };
  const time = { date: "2026-10-20", endDate: "2026-10-20", startHour: 16, endHour: 17 };
  return { boards, link, time };
}

describe("project task time blocks", () => {
  it.each([false, true])("creates and updates a single linked time block (subtask: %s)", (child) => {
    const { boards, link, time } = fixture(child);
    const first = saveProjectSchedule(boards, [], link, time);
    const event = first.events[0];
    expect(event).toMatchObject({ ...time, linkedProjectTask: link, title: child ? "AOI 数据处理" : "数据准备", isCompleted: false, category: "科研" });
    expect(resolveProjectTask(first.boards, link)?.item).toMatchObject({ plannedDate: time.date, dueDate: child ? "2026-10-24" : "2026-10-25" });
    const second = saveProjectSchedule(first.boards, first.events, link, { ...time, date: "2026-10-22", endDate: "2026-10-22", startHour: 9, endHour: 10 });
    expect(second.events).toHaveLength(1);
    expect(second.events[0].id).toBe(event.id);
    expect(resolveProjectTask(second.boards, link)?.item.plannedDate).toBe("2026-10-22");
    expect(boards[0].tasks[0].plannedDate).toBe("");
  });

  it.each([false, true])("syncs completion, undo completion and rescheduling from the calendar (subtask: %s)", (child) => {
    const { boards, link, time } = fixture(child);
    const saved = saveProjectSchedule(boards, [], link, time);
    const completed = projectBoardsFromSchedule(saved.boards, saved.events[0], { isCompleted: true, date: "2026-10-21" });
    expect(resolveProjectTask(completed, link)?.item).toMatchObject({ status: "done", plannedDate: "2026-10-21", dueDate: child ? "2026-10-24" : "2026-10-25" });
    expect(completed[0].tasks[0].subtasks[1]).toEqual(boards[0].tasks[0].subtasks[1]);
    if (child) expect(completed[0].tasks[0].status).toBe("todo");
    else expect(completed[0].tasks[0].completedAt).not.toBe("");
    const restored = projectBoardsFromSchedule(completed, saved.events[0], { isCompleted: false });
    expect(resolveProjectTask(restored, link)?.item.status).toBe("todo");
  });

  it.each([false, true])("syncs task completion and changed plan date back to the calendar (subtask: %s)", (child) => {
    const { boards, link, time } = fixture(child);
    const saved = saveProjectSchedule(boards, [], link, time);
    const changed = structuredClone(saved.boards);
    Object.assign(resolveProjectTask(changed, link)!.item, { status: "done", plannedDate: "2026-10-23", title: "重命名数据处理" });
    const events = schedulesFromProjectChanges(saved.events, saved.boards, changed);
    expect(events[0]).toMatchObject({ id: saved.events[0].id, date: "2026-10-23", endDate: "2026-10-23", title: "重命名数据处理", isCompleted: true, startHour: 16, endHour: 17 });
    resolveProjectTask(changed, link)!.item.status = "doing";
    expect(schedulesFromProjectChanges(events, projectBoardsFromSchedule(changed, events[0], { isCompleted: true }), changed)[0].isCompleted).toBe(false);
  });

  it("moves an overnight block without changing duration or its deadline", () => {
    const { boards, link, time } = fixture(true);
    const saved = saveProjectSchedule(boards, [], link, { ...time, startHour: 23, endHour: 2, endDate: "2026-10-21" });
    const changed = structuredClone(saved.boards);
    resolveProjectTask(changed, link)!.item.plannedDate = "2026-10-24";
    const event = schedulesFromProjectChanges(saved.events, saved.boards, changed)[0];
    expect(event).toMatchObject({ date: "2026-10-24", endDate: "2026-10-25", startHour: 23, endHour: 2 });
    expect(projectScheduleLabel(event)).toBe("23:00–10/25 02:00");
    expect(projectScheduleLabel({ ...event, endDate: "2026-10-24", endHour: 24 })).toBe("23:00–10/25 00:00");
    expect(resolveProjectTask(changed, link)?.item.dueDate).toBe("2026-10-24");
  });

  it("clears a linked plan by cancelling the time block; deleting a source preserves standalone history", () => {
    const { boards, link, time } = fixture(true);
    const saved = saveProjectSchedule(boards, [], link, time);
    const unplanned = projectBoardsFromSchedule(saved.boards, saved.events[0], { date: "" });
    expect(schedulesFromProjectChanges(saved.events, saved.boards, unplanned)).toEqual([]);
    const deleted = structuredClone(saved.boards);
    deleted[0].tasks[0].subtasks = [];
    const events = schedulesFromProjectChanges(saved.events, saved.boards, deleted);
    expect(events[0]).toMatchObject({ title: "AOI 数据处理", date: time.date });
    expect(events[0].linkedProjectTask).toBeUndefined();
    expect(projectBoardsFromSchedule(deleted, saved.events[0], { isCompleted: true })).toBe(deleted);
  });

  it("preserves task status on an unrelated event edit and leaves unrelated blocks alone", () => {
    const { boards, link, time } = fixture();
    boards[0].tasks[0].status = "doing";
    const saved = saveProjectSchedule(boards, [], link, time);
    expect(projectBoardsFromSchedule(saved.boards, saved.events[0], { notes: "日程备注", isCompleted: false })).toBe(saved.boards);
    const standalone = { ...saved.events[0], id: "standalone", linkedProjectTask: undefined };
    const changed = structuredClone(saved.boards);
    changed[0].tasks[0].notes = "只更新备注";
    const next = schedulesFromProjectChanges([standalone, ...saved.events], saved.boards, changed);
    expect(next[0]).toBe(standalone);
    expect(next[1]).toBe(saved.events[0]);
  });

  it("isolates project identity and rejects malformed links, missing tasks and invalid ranges", () => {
    const { boards, link, time } = fixture(true);
    const saved = saveProjectSchedule(boards, [], link, time);
    expect(findProjectSchedule(saved.events, { ...link, boardId: "other" })).toBeUndefined();
    expect(findProjectSchedule(saved.events, { ...link, subtaskId: undefined })).toBeUndefined();
    for (const value of [null, {}, { ...link, subtaskId: 1 }, { ...link, taskId: "" }, { ...link, subtaskId: "" }]) expect(normalizeProjectTaskLink(value)).toBeUndefined();
    expect(() => saveProjectSchedule(boards, [], { ...link, subtaskId: "deleted" }, time)).toThrow(/删除/);
    for (const invalid of [{ endHour: 15 }, { date: "2026-02-30" }, { endDate: "2026-10-19" }, { startHour: NaN }, { endHour: 24 }]) expect(() => saveProjectSchedule(boards, [], link, { ...time, ...invalid })).toThrow();
    boards[0].archived = true;
    expect(() => saveProjectSchedule(boards, [], link, time)).toThrow(/归档/);
  });

  it("retains links and both sides of an independent remote edit through sync and backup", () => {
    const { boards, link, time } = fixture(true);
    const saved = saveProjectSchedule(boards, [], link, time);
    const base = normalizePersistedSchedulePayload({ project_boards: saved.boards, events: saved.events })!;
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.events[0].date = local.events[0].endDate = "2026-10-22";
    local.project_boards = projectBoardsFromSchedule(local.project_boards!, local.events[0], { date: "2026-10-22" });
    remote.project_boards![0].tasks[0].subtasks[0].notes = "另一台电脑的资料";
    const merged = mergeScheduleChanges(base, local, remote);
    expect(merged.conflicts).toEqual([]);
    const restored = normalizePersistedSchedulePayload(JSON.parse(JSON.stringify(merged.value)))!;
    expect(restored.events[0].linkedProjectTask).toEqual(link);
    expect(resolveProjectTask(restored.project_boards!, link)?.item).toMatchObject({ plannedDate: "2026-10-22", notes: "另一台电脑的资料" });
  });
});
