import { describe, expect, it } from "vitest";
import { boardTasksToCsv, checklistProgress, createBoardTask, createProjectBoard, matchesBoardScope, normalizeProjectBoards, setBoardTaskStatus, toggleChecklistLine } from "../project-boards";
import { normalizePersistedSchedulePayload } from "../schedule-persistence";
import { mergeScheduleChanges } from "../schedule-merge";

describe("project board records", () => {
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
