import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { normalizeEvents, normalizeTasks } from "@/lib/normalizers";
import { buildSearchIndex, GlobalSearch } from "../global-search";
import { createProjectBoard } from "@/lib/project-boards";

describe("global search", () => {
  it("locates a project task through its subtask notes, priority and dates", () => {
    const board = createProjectBoard("research", "城市用地诊断");
    board.tasks[0].subtasks[0].notes = "核对土地分类口径";
    board.tasks[0].subtasks[0].priority = "p1";
    board.tasks[0].subtasks[0].plannedDate = "2026-10-18";
    board.tasks[0].subtasks[0].dueDate = "2026-10-25";
    const onLocate = vi.fn();
    render(<GlobalSearch tasks={[]} events={[]} logs={[]} annualTasks={[]} projects={[]} shopping={[]} boards={[board]} logsReady onLocate={onLocate} />);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    fireEvent.change(screen.getByLabelText("搜索工作台内容"), { target: { value: "土地分类口径 重要且紧急 2026-10-18 2026-10-25" } });
    fireEvent.click(screen.getByRole("button", { name: /明确研究问题与评价指标/ }));
    fireEvent.click(screen.getByRole("button", { name: "打开项目任务" }));
    expect(onLocate).toHaveBeenCalledWith(expect.objectContaining({ boardId: board.id, boardTaskId: board.tasks[0].id }));
  });
  it("opens with the keyboard, searches notes, and locates the selected task", () => {
    const task = normalizeTasks([{ id: "task", name: "实验记录", notes: "检查对照组参数" }])[0];
    const onLocate = vi.fn();
    render(<GlobalSearch tasks={[task]} events={[]} logs={[]} annualTasks={[]} projects={[]} shopping={[]} logsReady onLocate={onLocate} />);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    fireEvent.change(screen.getByLabelText("搜索工作台内容"), { target: { value: "对照组" } });
    fireEvent.click(screen.getByRole("button", { name: /实验记录/ }));
    fireEvent.click(screen.getByRole("button", { name: "打开任务" }));
    expect(onLocate).toHaveBeenCalledWith(expect.objectContaining({ task }));
  });
  it("indexes schedule requirements and keeps same-id entities separate", () => {
    const index = buildSearchIndex(normalizeEvents([{ id: "same", title: "阅读", requirements: ["重点核对消融实验"] }]), normalizeTasks([{ id: "same", name: "阅读任务" }]), [], [], [], []);
    expect(index).toHaveLength(2);
    expect(index.find((entry) => entry.kind === "日程")?.detail).toContain("消融实验");
  });
});
