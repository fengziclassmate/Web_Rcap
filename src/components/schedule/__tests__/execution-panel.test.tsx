import { useState } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExecutionPanel } from "../execution-panel";
import { defaultDashboardUiPreferences, normalizeTasks } from "@/lib/normalizers";
import { createProjectBoard } from "@/lib/project-boards";

const owner = "focus-ui-owner";
const props = { userId: owner, events: [], tasks: [], preferences: defaultDashboardUiPreferences, onPreferencesChange: vi.fn() };
beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 16, 10)); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("task focus panel", () => {
  it("preserves the goal and accumulated time through pauses and refreshes", () => {
    const first = render(<ExecutionPanel {...props} />);
    expect(screen.getByRole("timer").textContent).toBe("25:00");
    fireEvent.click(screen.getByRole("button", { name: "50 分钟" }));
    fireEvent.click(screen.getByRole("button", { name: "开始专注" }));
    act(() => { vi.advanceTimersByTime(60000); });
    expect(screen.getByRole("timer").textContent).toBe("49:00");
    fireEvent.click(screen.getByRole("button", { name: "暂停" }));
    act(() => { vi.advanceTimersByTime(120000); });
    expect(screen.getByRole("timer").textContent).toBe("49:00");
    first.unmount();
    render(<ExecutionPanel {...props} />);
    expect(screen.getByRole("timer").textContent).toBe("49:00");
    expect(screen.getByRole("button", { name: "50 分钟" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "继续" }));
    act(() => { vi.advanceTimersByTime(60000); });
    expect(screen.getByRole("timer").textContent).toBe("48:00");
    fireEvent.click(screen.getByRole("button", { name: "结束并保存专注" }));
    expect(screen.getByText("1 次完成")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "复盘统计" }));
    const history = within(screen.getByRole("region", { name: "最近专注记录" }));
    expect(history.getAllByText("自由专注")).toHaveLength(2);
    expect(history.getByText("2 分钟")).toBeTruthy();
    const state = JSON.parse(localStorage.getItem(`workbench-focus-v1:${owner}`)!);
    expect(state.sessions).toHaveLength(2);
    expect(state.sessions[0].runId).toBe(state.sessions[1].runId);
  });

  it("offers today's tasks and project tasks as direct focus targets", () => {
    const board = createProjectBoard("research", "城市用地诊断");
    const tasks = normalizeTasks([{ id: "today", name: "今日阅读", taskType: "daily", dueDate: "2026-10-16" }, { id: "future", name: "未来阅读", taskType: "daily", dueDate: "2026-10-17" }]);
    render(<ExecutionPanel {...props} tasks={tasks} boards={[board]} />);
    expect(screen.getByRole("option", { name: "今日阅读" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "未来阅读" })).toBeNull();
    const id = `board:${board.id}:${board.tasks[0].id}`;
    fireEvent.change(screen.getByRole("combobox", { name: "专注任务或日程" }), { target: { value: id } });
    fireEvent.click(screen.getByRole("button", { name: "开始专注" }));
    expect(screen.getByText(board.tasks[0].title)).toBeTruthy();
    expect(screen.getByText("城市用地诊断")).toBeTruthy();
  });

  it("keeps running after the goal instead of silently discarding overtime", () => {
    render(<ExecutionPanel {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "开始专注" }));
    act(() => { vi.advanceTimersByTime(26 * 60000); });
    expect(screen.getByRole("timer").textContent).toBe("+01:00");
    expect(screen.getByText("已达目标")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "结束并保存专注" }));
    expect(screen.getByText("26 分钟")).toBeTruthy();
  });

  it("restores legacy stopwatch sessions without assigning a countdown goal", () => {
    localStorage.setItem(`workbench-focus-v1:${owner}`, JSON.stringify({ active: { id: "legacy", title: "旧专注", category: "任务", elapsedMs: 3600000, startedAt: Date.now() - 62000 }, sessions: [] }));
    render(<ExecutionPanel {...props} />);
    expect(screen.getByRole("timer").textContent).toBe("01:01:02");
    expect(screen.getByRole("button", { name: "自由" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("retains the collapse preference and hides time settings until requested", () => {
    function Panel() { const [preferences, setPreferences] = useState(defaultDashboardUiPreferences); return <ExecutionPanel {...props} preferences={preferences} onPreferencesChange={setPreferences} />; }
    render(<Panel />);
    expect(screen.getByRole("combobox", { name: "可安排开始时间" }).closest("details")?.open).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "折叠时间与专注" }));
    expect(screen.queryByRole("button", { name: "开始专注" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "展开时间与专注" }));
    expect(screen.getByRole("timer")).toBeTruthy();
  });
});
