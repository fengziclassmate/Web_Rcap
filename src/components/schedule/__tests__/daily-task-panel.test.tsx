import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DailyTaskPanel } from "@/components/schedule/daily-task-panel";
import type { LongTask } from "@/lib/types";

function task(overrides: Partial<LongTask>): LongTask {
  return {
    id: "task",
    name: "日常任务",
    dueDate: "2026-07-27",
    done: false,
    notes: "",
    precautions: [],
    completionLog: "",
    priority: "不紧急重要",
    subtasks: [],
    taskType: "daily",
    isTodayFocus: false,
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("DailyTaskPanel completion archive", () => {
  it("shows only today's completions in the panel and groups older records in history", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 27, 15, 0));

    render(
      <DailyTaskPanel
        tasks={[
          task({
            id: "today",
            name: "今天完成的实验记录",
            done: true,
            completedAt: new Date(2026, 6, 27, 10, 30).toISOString(),
          }),
          task({
            id: "past",
            name: "昨天完成的文献整理",
            dueDate: "2026-07-26",
            done: true,
            completedAt: new Date(2026, 6, 26, 18, 20).toISOString(),
          }),
          task({
            id: "legacy",
            name: "旧版未记录完成时间",
            dueDate: "2026-01-01",
            done: true,
            completedAt: null,
          }),
        ]}
        events={[]}
        onAddTask={vi.fn()}
        onToggleTask={vi.fn()}
        onUpdateTask={vi.fn()}
        onCreateTimeBlock={vi.fn()}
        archivedSectionOpen
        onArchivedSectionOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText("今日已完成")).toBeTruthy();
    expect(screen.getByText("今天完成的实验记录")).toBeTruthy();
    expect(screen.queryByText("昨天完成的文献整理")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /历史记录/ }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("昨天完成的文献整理")).toBeTruthy();
    expect(within(dialog).queryByText("今天完成的实验记录")).toBeNull();
    expect(within(dialog).getByText("2026-07-26")).toBeTruthy();
    expect(within(dialog).getByText("处理时间未记录")).toBeTruthy();
    expect(within(dialog).getByText("旧版未记录完成时间")).toBeTruthy();
    expect(within(dialog).queryByText("2026-01-01")).toBeNull();
  });
});
