import { describe, expect, it } from "vitest";
import { boardTasksToCsv, checklistProgress, createBoardTask, createBoardSubtask, createProjectBoard, getTaskSubtaskProgress, matchesBoardScope, normalizeProjectBoards, reorderProjectBoards, reorderVisibleRecords, setBoardTaskStatus, toggleChecklistLine } from "../project-boards";
import { normalizePersistedSchedulePayload } from "../schedule-persistence";
import { mergeScheduleChanges } from "../schedule-merge";
import { normalizeDashboardUiPreferences } from "../normalizers";

describe("project board records", () => {
  it("persists scoped expansion preferences through backup and merges them with remote task edits", () => {
    const board = createProjectBoard("research", "展开偏好");
    const key = JSON.stringify([board.id, board.tasks[0].id]);
    expect(normalizeDashboardUiPreferences({ projectWorkspaceExpandedTasks: [key, key, 1, ""] }).projectWorkspaceExpandedTasks).toEqual([key]);
    const other = JSON.stringify([board.id, board.tasks[1].id]);
    expect(normalizeDashboardUiPreferences({ projectWorkspaceExpandedTasks: [key, other] }).projectWorkspaceExpandedTasks).toEqual(normalizeDashboardUiPreferences({ projectWorkspaceExpandedTasks: [other, key] }).projectWorkspaceExpandedTasks);
    const base = normalizePersistedSchedulePayload({ project_boards: [board] })!;
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.ui_preferences.projectWorkspaceExpandedTasks = [key];
    remote.project_boards![0].tasks[0].notes = "远端资料";
    const merged = mergeScheduleChanges(base, local, remote);
    expect(merged.conflicts).toEqual([]);
    const restored = normalizePersistedSchedulePayload(JSON.parse(JSON.stringify(merged.value)))!;
    expect(restored.ui_preferences.projectWorkspaceExpandedTasks).toEqual([key]);
    expect(restored.project_boards![0].tasks[0].notes).toBe("远端资料");
  });

  it("upgrades old subtask fields and validates priority and dates without changing identity or order", () => {
    const source = [{ id: "board", tasks: [{ id: "task", subtasks: [
      { id: "old", title: "旧子任务", notes: "保留备注", status: "done" },
      { id: "valid", title: "已安排", status: "doing", priority: "p1", plannedDate: "2026-10-18", dueDate: "2026-10-25" },
      { id: "invalid", title: "异常字段", priority: "__proto__", plannedDate: "2026-02-30", dueDate: "tomorrow" },
    ] }] }];
    const normalized = normalizeProjectBoards(source);
    expect(normalized[0].tasks[0].subtasks).toEqual([
      { id: "old", title: "旧子任务", notes: "保留备注", status: "done", priority: "p2", plannedDate: "", dueDate: "" },
      { id: "valid", title: "已安排", notes: "", status: "doing", priority: "p1", plannedDate: "2026-10-18", dueDate: "2026-10-25" },
      { id: "invalid", title: "异常字段", notes: "", status: "todo", priority: "p2", plannedDate: "", dueDate: "" },
    ]);
    expect(normalizeProjectBoards(JSON.parse(JSON.stringify(normalized)))).toEqual(normalized);
  });

  it("merges subtask date and priority edits from different devices and keeps new fields in backup and CSV", () => {
    const board = createProjectBoard("research", "子任务规划");
    board.tasks[0].subtasks[0].notes = "保留原始备注";
    const base = normalizePersistedSchedulePayload({ project_boards: [board] })!;
    const local = structuredClone(base);
    const remote = structuredClone(base);
    const localChild = local.project_boards![0].tasks[0].subtasks[0];
    localChild.priority = "p1";
    localChild.dueDate = "2026-10-25";
    remote.project_boards![0].tasks[0].subtasks[0].plannedDate = "2026-10-18";
    const merged = mergeScheduleChanges(base, local, remote);
    expect(merged.conflicts).toEqual([]);
    const task = merged.value.project_boards![0].tasks[0];
    expect(task.subtasks[0]).toMatchObject({ notes: "保留原始备注", priority: "p1", plannedDate: "2026-10-18", dueDate: "2026-10-25" });
    expect(normalizePersistedSchedulePayload(JSON.parse(JSON.stringify(merged.value)))).toEqual(merged.value);
    const csv = boardTasksToCsv([{ board, task }]);
    expect(csv).toContain('"重要且紧急","未开始","2026-10-18","2026-10-25"');
    const cleared = structuredClone(merged.value);
    cleared.project_boards![0].tasks[0].subtasks[0].plannedDate = "";
    cleared.project_boards![0].tasks[0].subtasks[0].dueDate = "";
    expect(normalizePersistedSchedulePayload(JSON.parse(JSON.stringify(cleared)))?.project_boards?.[0].tasks[0].subtasks[0]).toMatchObject({ plannedDate: "", dueDate: "", priority: "p1" });
  });

  it("reorders visible records without moving hidden rows or resurrecting removed records", () => {
    const items = ["a", "hidden", "b", "c", "new"].map((id) => ({ id, notes: `最新备注 ${id}` }));
    const reordered = reorderVisibleRecords(items, "c", "b", ["b", "c", "a"]);
    expect(reordered.map((item) => item.id)).toEqual(["c", "hidden", "b", "a", "new"]);
    expect(reordered[0]).toBe(items[3]);
    expect(reordered[1]).toBe(items[1]);
    expect(items.map((item) => item.id)).toEqual(["a", "hidden", "b", "c", "new"]);
    expect(reorderVisibleRecords(items, "removed", "a", ["removed", "a"])).toBe(items);
    expect(reorderVisibleRecords(items, "a", "a")).toBe(items);
    expect(reorderVisibleRecords(items, "a", "missing")).toBe(items);
  });

  it("keeps task and subtask order through cloud merge and backup while merging remote notes", () => {
    const board = createProjectBoard("research", "排序同步");
    const base = normalizePersistedSchedulePayload({ project_boards: [board] })!;
    const local = structuredClone(base);
    const remote = structuredClone(base);
    const taskId = board.tasks[0].id;
    const childId = board.tasks[0].subtasks[0].id;
    local.project_boards![0].tasks = reorderVisibleRecords(local.project_boards![0].tasks, board.tasks[3].id, taskId);
    const localTask = local.project_boards![0].tasks.find((task) => task.id === taskId)!;
    localTask.subtasks = reorderVisibleRecords(localTask.subtasks, localTask.subtasks[1].id, childId);
    remote.project_boards![0].tasks[0].notes = "另一台电脑补充任务备注";
    remote.project_boards![0].tasks[0].subtasks[0].notes = "另一台电脑补充子任务备注";
    remote.project_boards![0].tasks[0].subtasks[0].status = "done";
    const merged = mergeScheduleChanges(base, local, remote);
    expect(merged.conflicts).toEqual([]);
    expect(merged.value.project_boards![0].tasks.map((task) => task.id)).toEqual([board.tasks[3].id, ...board.tasks.slice(0, 3).map((task) => task.id)]);
    const task = merged.value.project_boards![0].tasks.find((item) => item.id === taskId)!;
    expect(task.notes).toBe("另一台电脑补充任务备注");
    expect(task.subtasks.map((item) => item.id)).toEqual(board.tasks[0].subtasks.map((item) => item.id).reverse());
    expect(task.subtasks.find((item) => item.id === childId)).toMatchObject({ notes: "另一台电脑补充子任务备注", status: "done" });
    expect(normalizePersistedSchedulePayload(JSON.parse(JSON.stringify(merged.value)))).toEqual(merged.value);
  });

  it("converts old annotated checklists to stable rows without losing content or completion", () => {
    const old = [{ id: "research", name: "研究", tasks: [{ id: "task", title: "验证方法", content: "# 核心问题\n- [ ] ==分析**边界**==\n补充数据来源\n- [X] {red}核对结果{/red}\n- [ ] [论文](https://example.com/paper)", notes: "原始备注" }] }];
    const normalized = normalizeProjectBoards(old);
    const task = normalized[0].tasks[0];
    expect(task.content).toBe("# 核心问题\n补充数据来源");
    expect(task.notes).toBe("原始备注");
    expect(task.subtasks.map(({ title, status }) => ({ title, status }))).toEqual([{ title: "分析边界", status: "todo" }, { title: "核对结果", status: "done" }, { title: "论文 (https://example.com/paper)", status: "todo" }]);
    expect(normalizeProjectBoards(old)).toEqual(normalized);
    task.subtasks[0].notes = "记录样本不足时的处理";
    const restored = normalizePersistedSchedulePayload(JSON.parse(JSON.stringify({ project_boards: normalized })))!;
    expect(restored.project_boards).toEqual(normalized);
    expect(getTaskSubtaskProgress(task)).toEqual({ total: 3, done: 1 });
    task.subtasks = [];
    expect(normalizeProjectBoards(normalized)[0].tasks[0].subtasks).toEqual([]);
  });

  it("merges a subtask status with another device's note and keeps rows in CSV", () => {
    const board = createProjectBoard("research", "研究");
    const base = normalizePersistedSchedulePayload({ project_boards: [board] })!;
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.project_boards![0].tasks[0].subtasks[0].notes = "保留实验记录";
    remote.project_boards![0].tasks[0].subtasks[0].status = "done";
    const merged = mergeScheduleChanges(base, local, remote);
    expect(merged.conflicts).toEqual([]);
    expect(merged.value.project_boards![0].tasks[0].subtasks[0]).toMatchObject({ notes: "保留实验记录", status: "done" });
    expect(boardTasksToCsv([{ board, task: merged.value.project_boards![0].tasks[0] }])).toContain('"保留实验记录"');
    expect(boardTasksToCsv([{ board, task: merged.value.project_boards![0].tasks[0] }])).toContain('"子任务"');
  });

  it("reorders projects while keeping hidden archive slots and concurrent content intact", () => {
    const first = createProjectBoard("blank", "一");
    const archived = { ...createProjectBoard("blank", "归档"), archived: true };
    const second = createProjectBoard("blank", "二");
    const third = createProjectBoard("blank", "三");
    const boards = [first, archived, second, third];
    const changed = reorderProjectBoards(boards, third.id, first.id);
    expect(changed).toEqual([third, archived, first, second]);
    expect(changed[2]).toBe(first);
    expect(reorderProjectBoards(boards, first.id, "missing")).toBe(boards);
    expect(reorderProjectBoards(boards, first.id, archived.id)).toBe(boards);
    const child = createBoardSubtask("追加记录");
    first.tasks.push({ ...createBoardTask("新任务"), subtasks: [child] });
    expect(reorderProjectBoards(boards, second.id, first.id).find((board) => board.id === first.id)?.tasks[0].subtasks[0]).toBe(child);
    const base = normalizePersistedSchedulePayload({ project_boards: boards })!;
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.project_boards = reorderProjectBoards(local.project_boards!, second.id, first.id);
    remote.project_boards![0].tasks[0].notes = "另一个设备的备注";
    const merged = mergeScheduleChanges(base, local, remote);
    expect(merged.conflicts).toEqual([]);
    expect(merged.value.project_boards!.map((board) => board.id)).toEqual([second.id, archived.id, first.id, third.id]);
    expect(merged.value.project_boards!.find((board) => board.id === first.id)?.tasks[0].notes).toBe("另一个设备的备注");
  });
  it("round trips annotations, checklists and archived projects through account backups", () => {
    const board = createProjectBoard("learning", "LeetCode");
    board.archived = true;
    board.tasks[0].content = "**目标**\n- [ ] ==边界条件==\n- [x] {red}错因{/red}";
    const restored = normalizePersistedSchedulePayload(JSON.parse(JSON.stringify({ project_boards: [board] })))!;
    expect(restored.project_boards).toEqual([board]);
    expect(checklistProgress(board.tasks[0].content)).toEqual({ total: 2, done: 1 });
  });

  it("drops malformed identities and normalizes invalid fields without inventing IDs", () => {
    const result = normalizeProjectBoards([null, {}, { id: "a", tasks: [{ id: "t", priority: "__proto__", status: "missing", dueDate: "2026-02-30", tags: ["数据", "数据", 1] }, { id: "t" }] }, { id: "a" }]);
    expect(result).toHaveLength(1);
    expect(result[0].tasks).toHaveLength(1);
    expect(result[0].tasks[0]).toMatchObject({ priority: "p2", status: "todo", dueDate: "", tags: ["数据"] });
    expect(normalizeProjectBoards(result)).toEqual(result);
  });

  it("toggles exactly the selected checklist line and keeps annotations and duplicate labels", () => {
    const source = "笔记\n- [ ] **验证**\n- [ ] **验证**\n- [X] 完成";
    const changed = toggleChecklistLine(source, 2);
    expect(changed).toBe("笔记\n- [ ] **验证**\n- [x] **验证**\n- [X] 完成");
    expect(toggleChecklistLine(changed, 2)).toBe(source);
    expect(toggleChecklistLine(source, 0)).toBe(source);
  });

  it("includes overdue unfinished work today and bounds this week to Sunday", () => {
    const task = { ...createBoardTask("test"), dueDate: "2026-10-15" };
    expect(matchesBoardScope(task, "today", "2026-10-16")).toBe(true);
    expect(matchesBoardScope(task, "week", "2026-10-16")).toBe(true);
    expect(matchesBoardScope({ ...task, dueDate: "2026-10-18" }, "week", "2026-10-16")).toBe(true);
    expect(matchesBoardScope({ ...task, dueDate: "2026-10-19" }, "week", "2026-10-16")).toBe(false);
    expect(matchesBoardScope({ ...task, status: "done" }, "overdue", "2026-10-16")).toBe(false);
    expect(matchesBoardScope({ ...task, dueDate: "", plannedDate: "2026-10-16" }, "today", "2026-10-16")).toBe(true);
  });

  it("retains completion timestamps until a task is reopened", () => {
    const done = setBoardTaskStatus(createBoardTask("test"), "done");
    expect(done.completedAt).not.toBe("");
    expect(setBoardTaskStatus(done, "done").completedAt).toBe(done.completedAt);
    expect(setBoardTaskStatus(done, "doing").completedAt).toBe("");
  });

  it("merges independent task edits across devices and flags competing content edits", () => {
    const board = createProjectBoard("research", "诊断");
    const base = normalizePersistedSchedulePayload({ project_boards: [board] })!;
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.project_boards![0].tasks[0].notes = "资料链接";
    remote.project_boards![0].tasks[0].status = "doing";
    const merged = mergeScheduleChanges(base, local, remote);
    expect(merged.conflicts).toEqual([]);
    expect(merged.value.project_boards![0].tasks[0]).toMatchObject({ notes: "资料链接", status: "doing" });
    local.project_boards![0].tasks[0].content = "本机内容";
    remote.project_boards![0].tasks[0].content = "其他电脑的内容";
    expect(mergeScheduleChanges(base, local, remote).conflicts[0]).toContain(".content");
  });

  it("exports quoted multiline CSV and neutralizes spreadsheet formulas", () => {
    const board = createProjectBoard("blank", "=危险公式");
    const task = { ...createBoardTask('标题,"引号"'), content: "第一行\n第二行" };
    const csv = boardTasksToCsv([{ board, task }]);
    expect(csv).toContain('"\'=危险公式"');
    expect(csv).toContain('"标题,""引号"""');
    expect(csv).toContain('"第一行\n第二行"');
  });
});
