import { describe, expect, it } from "vitest";
import { createBoardSubtask, createBoardTask, createProjectBoard, type ProjectBoard, type ProjectTaskLink } from "../project-boards";
import { findProjectSchedules, normalizeProjectTaskLink, reconcileProjectPlans, projectScheduleLabel, resolveProjectTask, saveProjectSchedule, removeProjectSchedule, schedulesFromProjectChanges } from "../project-schedule";
import { normalizePersistedSchedulePayload } from "../schedule-persistence";
import { mergeScheduleChanges } from "../schedule-merge";
import type { ScheduleEvent } from "../types";

function fixture(child = true) {
  const task = { ...createBoardTask("数据准备"), dueDate: "2026-10-25", subtasks: [{ ...createBoardSubtask("AOI 数据处理"), dueDate: "2026-10-24" }, createBoardSubtask("核对分类")] };
  const boards = [{ ...createProjectBoard("research", "城市用地诊断"), tasks: [task, createBoardTask("方法验证")] }];
  const link: ProjectTaskLink = { boardId: boards[0].id, taskId: task.id, ...(child ? { subtaskId: task.subtasks[0].id } : {}) };
  const time = { date: "2026-10-20", endDate: "2026-10-20", startHour: 16, endHour: 17 };
  return { boards, link, time };
}
function patchEvent(boards: ProjectBoard[], events: ScheduleEvent[], id: string, patch: Partial<ScheduleEvent>) {
  const nextEvents = events.map((event) => event.id === id ? { ...event, ...patch } : event);
  return { events: nextEvents, boards: reconcileProjectPlans(boards, events, nextEvents) };
}

describe("independent project work sessions", () => {
  it.each([false, true])("creates several sessions, then edits only the specified one (subtask: %s)", (child) => {
    const { boards, link, time } = fixture(child);
    const first = saveProjectSchedule(boards, [], link, time);
    const second = saveProjectSchedule(first.boards, first.events, link, { ...time, startHour: 19, endHour: 20 });
    expect(second.events).toHaveLength(2);
    expect(second.events[0]).toEqual(first.events[0]);
    expect(second.events[1].id).not.toBe(first.events[0].id);
    const edited = saveProjectSchedule(second.boards, second.events, link, { ...time, date: "2026-10-22", endDate: "2026-10-22" }, second.events[1].id);
    expect(edited.events).toHaveLength(2);
    expect(edited.events[0]).toEqual(first.events[0]);
    expect(edited.events[1]).toMatchObject({ id: second.events[1].id, date: "2026-10-22" });
    expect(resolveProjectTask(edited.boards, link)?.item.plannedDate).toBe("2026-10-20");
    expect(resolveProjectTask(edited.boards, link)?.item.dueDate).toBe(child ? "2026-10-24" : "2026-10-25");
  });

  it.each([false, true])("never completes the source, even after every session is done (subtask: %s)", (child) => {
    const { boards, link, time } = fixture(child);
    resolveProjectTask(boards, link)!.item.status = "doing";
    const first = saveProjectSchedule(boards, [], link, time);
    const saved = saveProjectSchedule(first.boards, first.events, link, { ...time, date: "2026-10-21", endDate: "2026-10-21" });
    const done = patchEvent(saved.boards, saved.events, saved.events[0].id, { isCompleted: true });
    expect(resolveProjectTask(done.boards, link)?.item).toMatchObject({ status: "doing", plannedDate: "2026-10-21" });
    expect(done.events[1].isCompleted).toBe(false);
    const allDone = patchEvent(done.boards, done.events, done.events[1].id, { isCompleted: true });
    expect(resolveProjectTask(allDone.boards, link)?.item).toMatchObject({ status: "doing", plannedDate: "" });
    expect(allDone.boards[0].tasks[0].completedAt).toBe("");
    const reopened = patchEvent(allDone.boards, allDone.events, allDone.events[0].id, { isCompleted: false });
    expect(resolveProjectTask(reopened.boards, link)?.item).toMatchObject({ status: "doing", plannedDate: "2026-10-20" });
    expect(reopened.boards[0].tasks[0].subtasks[1]).toEqual(boards[0].tasks[0].subtasks[1]);
  });

  it.each([false, true])("manual task completion and reopening preserve every session status (subtask: %s)", (child) => {
    const { boards, link, time } = fixture(child);
    const first = saveProjectSchedule(boards, [], link, time);
    const second = saveProjectSchedule(first.boards, first.events, link, { ...time, startHour: 19, endHour: 20 });
    const saved = patchEvent(second.boards, second.events, second.events[0].id, { isCompleted: true });
    const changed = structuredClone(saved.boards);
    resolveProjectTask(changed, link)!.item.status = "done";
    const events = schedulesFromProjectChanges(saved.events, saved.boards, changed);
    expect(events).toEqual(saved.events);
    const reopened = structuredClone(changed);
    resolveProjectTask(reopened, link)!.item.status = "todo";
    expect(schedulesFromProjectChanges(events, changed, reopened)).toEqual(saved.events);
    const extra = saveProjectSchedule(changed, events, link, { ...time, date: "2026-10-22", endDate: "2026-10-22" });
    expect(extra.events.at(-1)?.isCompleted).toBe(false);
    expect(resolveProjectTask(extra.boards, link)?.item.status).toBe("done");
  });

  it("reschedules or cancels only the next unfinished session from the plan date", () => {
    const { boards, link, time } = fixture();
    let saved = saveProjectSchedule(boards, [], link, time);
    saved = patchEvent(saved.boards, saved.events, saved.events[0].id, { isCompleted: true });
    saved = saveProjectSchedule(saved.boards, saved.events, link, { ...time, date: "2026-10-21", endDate: "2026-10-21" });
    saved = saveProjectSchedule(saved.boards, saved.events, link, { ...time, date: "2026-10-22", endDate: "2026-10-22" });
    const changed = structuredClone(saved.boards);
    resolveProjectTask(changed, link)!.item.plannedDate = "2026-10-24";
    const movedEvents = schedulesFromProjectChanges(saved.events, saved.boards, changed);
    expect(movedEvents.map((event) => event.date)).toEqual(["2026-10-20", "2026-10-24", "2026-10-22"]);
    const movedBoards = reconcileProjectPlans(changed, saved.events, movedEvents);
    expect(resolveProjectTask(movedBoards, link)?.item.plannedDate).toBe("2026-10-22");
    const cleared = structuredClone(movedBoards);
    resolveProjectTask(cleared, link)!.item.plannedDate = "";
    const cancelled = schedulesFromProjectChanges(movedEvents, movedBoards, cleared);
    expect(cancelled.map((event) => event.date)).toEqual(["2026-10-20", "2026-10-24"]);
    expect(resolveProjectTask(reconcileProjectPlans(cleared, movedEvents, cancelled), link)?.item.plannedDate).toBe("2026-10-24");
  });

  it("supports repeated card moves without changing the other sessions or deadline", () => {
    const { boards, link, time } = fixture();
    const first = saveProjectSchedule(boards, [], link, time);
    const saved = saveProjectSchedule(first.boards, first.events, link, { ...time, date: "2026-10-21", endDate: "2026-10-21" });
    const moved = patchEvent(saved.boards, saved.events, saved.events[0].id, { date: "2026-10-23", endDate: "2026-10-23", title: "第一阶段处理" });
    expect(resolveProjectTask(moved.boards, link)?.item).toMatchObject({ title: "AOI 数据处理", plannedDate: "2026-10-21", dueDate: "2026-10-24" });
    expect(moved.events[1]).toEqual(saved.events[1]);
    const movedAgain = patchEvent(moved.boards, moved.events, moved.events[1].id, { date: "2026-10-24", endDate: "2026-10-24" });
    expect(resolveProjectTask(movedAgain.boards, link)?.item.plannedDate).toBe("2026-10-23");
  });

  it("deletes one selected session and keeps manual plans when only completed history changes", () => {
    const { boards, link, time } = fixture();
    const first = saveProjectSchedule(boards, [], link, time);
    const saved = saveProjectSchedule(first.boards, first.events, link, { ...time, date: "2026-10-21", endDate: "2026-10-21" });
    expect(removeProjectSchedule(saved.boards, saved.events, { ...link, taskId: "other" }, saved.events[0].id).events).toBe(saved.events);
    const removed = removeProjectSchedule(saved.boards, saved.events, link, saved.events[0].id);
    expect(removed.events).toEqual([saved.events[1]]);
    expect(resolveProjectTask(removed.boards, link)?.item.plannedDate).toBe("2026-10-21");
    const done = patchEvent(removed.boards, removed.events, removed.events[0].id, { isCompleted: true });
    resolveProjectTask(done.boards, link)!.item.plannedDate = "2026-10-25";
    const historyEdited = patchEvent(done.boards, done.events, done.events[0].id, { date: "2026-10-19" });
    expect(resolveProjectTask(historyEdited.boards, link)?.item.plannedDate).toBe("2026-10-25");
    const historySaved = saveProjectSchedule(historyEdited.boards, historyEdited.events, link, { ...time, date: "2026-10-19", endDate: "2026-10-19" }, done.events[0].id);
    expect(historySaved.events[0].isCompleted).toBe(true);
    expect(resolveProjectTask(historySaved.boards, link)?.item.plannedDate).toBe("2026-10-25");
    const historyDeleted = removeProjectSchedule(historyEdited.boards, historyEdited.events, link, done.events[0].id);
    expect(resolveProjectTask(historyDeleted.boards, link)?.item.plannedDate).toBe("2026-10-25");
  });

  it("preserves overnight duration and custom session titles", () => {
    const { boards, link, time } = fixture();
    const saved = saveProjectSchedule(boards, [], link, { ...time, startHour: 23, endHour: 2, endDate: "2026-10-21" });
    const custom = { ...saved.events[0], id: "custom", title: "AOI 复核", date: "2026-10-22", endDate: "2026-10-23" };
    const changed = structuredClone(saved.boards);
    Object.assign(resolveProjectTask(changed, link)!.item, { plannedDate: "2026-10-24", title: "AOI 处理与复核" });
    const events = schedulesFromProjectChanges([...saved.events, custom], saved.boards, changed);
    expect(events[0]).toMatchObject({ title: "AOI 处理与复核", date: "2026-10-24", endDate: "2026-10-25", startHour: 23, endHour: 2 });
    expect(events[1]).toEqual(custom);
    expect(saveProjectSchedule(saved.boards, [custom], link, time, custom.id).events[0].title).toBe("AOI 复核");
    expect(projectScheduleLabel(events[0])).toBe("23:00–10/25 02:00");
    expect(projectScheduleLabel({ ...events[0], endDate: "2026-10-24", endHour: 24 })).toBe("23:00–10/25 00:00");
  });

  it("keeps all sessions as standalone history when the source is deleted", () => {
    const { boards, link, time } = fixture();
    const first = saveProjectSchedule(boards, [], link, time);
    const saved = saveProjectSchedule(first.boards, first.events, link, { ...time, startHour: 19, endHour: 20 });
    const deleted = structuredClone(saved.boards);
    deleted[0].tasks[0].subtasks = [];
    const events = schedulesFromProjectChanges(saved.events, saved.boards, deleted);
    expect(events).toHaveLength(2);
    expect(events.every((event) => !event.linkedProjectTask)).toBe(true);
    expect(events.map((event) => event.id)).toEqual(saved.events.map((event) => event.id));
  });

  it("isolates identities and rejects stale edits and invalid ranges", () => {
    const { boards, link, time } = fixture();
    const saved = saveProjectSchedule(boards, [], link, time);
    expect(findProjectSchedules(saved.events, { ...link, boardId: "other" })).toEqual([]);
    expect(findProjectSchedules(saved.events, { ...link, subtaskId: undefined })).toEqual([]);
    for (const value of [null, {}, { ...link, subtaskId: 1 }, { ...link, taskId: "" }, { ...link, subtaskId: "" }]) expect(normalizeProjectTaskLink(value)).toBeUndefined();
    expect(() => saveProjectSchedule(boards, [], link, time, "deleted")).toThrow(/删除/);
    expect(() => saveProjectSchedule(boards, saved.events, { ...link, subtaskId: "deleted" }, time, saved.events[0].id)).toThrow(/删除/);
    for (const invalid of [{ endHour: 15 }, { date: "2026-02-30" }, { endDate: "2026-10-19" }, { startHour: NaN }, { endHour: 24 }]) expect(() => saveProjectSchedule(boards, [], link, { ...time, ...invalid })).toThrow();
    boards[0].archived = true;
    expect(() => saveProjectSchedule(boards, [], link, time)).toThrow(/归档/);
  });

  it("round-trips all sessions and independent completion through sync and backups", () => {
    const { boards, link, time } = fixture();
    const first = saveProjectSchedule(boards, [], link, time);
    const saved = saveProjectSchedule(first.boards, first.events, link, { ...time, date: "2026-10-21", endDate: "2026-10-21" });
    const base = normalizePersistedSchedulePayload({ project_boards: saved.boards, events: saved.events })!;
    const local = structuredClone(base); const remote = structuredClone(base);
    local.events[0].isCompleted = true;
    local.project_boards = reconcileProjectPlans(local.project_boards!, base.events, local.events);
    remote.project_boards![0].tasks[0].subtasks[0].notes = "另一台电脑的资料";
    const merged = mergeScheduleChanges(base, local, remote);
    expect(merged.conflicts).toEqual([]);
    const restored = normalizePersistedSchedulePayload(JSON.parse(JSON.stringify(merged.value)))!;
    expect(findProjectSchedules(restored.events, link)).toHaveLength(2);
    expect(restored.events.map((event) => event.isCompleted)).toEqual([true, false]);
    expect(resolveProjectTask(restored.project_boards!, link)?.item).toMatchObject({ status: "todo", plannedDate: "2026-10-21", notes: "另一台电脑的资料" });
  });

  it("cancels one session after a normalized cloud round-trip without a false conflict", () => {
    const { boards, link, time } = fixture();
    const first = saveProjectSchedule(boards, [], link, time);
    const saved = saveProjectSchedule(first.boards, first.events, link, { ...time, startHour: 19, endHour: 20 });
    const base = normalizePersistedSchedulePayload({ project_boards: saved.boards, events: saved.events })!;
    const remote = normalizePersistedSchedulePayload(JSON.parse(JSON.stringify(base)))!;
    const removed = removeProjectSchedule(base.project_boards!, base.events, link, base.events[1].id);
    const local = normalizePersistedSchedulePayload({ ...base, events: removed.events, project_boards: removed.boards })!;
    const merged = mergeScheduleChanges(base, local, remote);
    expect(merged.conflicts).toEqual([]);
    expect(merged.value.events.map((event) => event.id)).toEqual([base.events[0].id]);
  });
});
