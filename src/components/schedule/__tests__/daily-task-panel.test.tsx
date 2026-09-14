import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DailyTaskPanel } from "@/components/schedule/daily-task-panel";
import type { LongTask, ScheduleEvent } from "@/lib/types";

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
  it("moves task actions into the context menu and recognizes recurring event links", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 27, 15, 0));
    const onUpdateTask = vi.fn();
    const recurringEvent: ScheduleEvent = {
      id: "recurring-event",
      date: "2026-07-27",
      startHour: 9,
      endHour: 10,
      title: "循环任务",
      notes: "",
      requirements: [],
      isCompleted: false,
      category: "生活",
      tag: null,
      recurrence: { kind: "daily" },
      recurrenceOverrides: {
        "2026-07-27": { linkedDailyTaskId: "task" },
      },
    };

    render(
      <DailyTaskPanel
        tasks={[task({ name: "循环日常任务" })]}
        events={[recurringEvent]}
        onAddTask={vi.fn()}
        onToggleTask={vi.fn()}
        onUpdateTask={onUpdateTask}
        onRequestDeleteTask={vi.fn()}
        onCreateTimeBlock={vi.fn()}
        archivedSectionOpen={false}
        onArchivedSectionOpenChange={vi.fn()}
      />,
    );

    expect(screen.queryByText("已排入日程")).toBeNull();
    expect(screen.queryByRole("button", { name: "设为重点" })).toBeNull();

    const taskRow = screen.getByText("循环日常任务").closest("article");
    expect(taskRow).toBeTruthy();
    fireEvent.contextMenu(taskRow!, { clientX: 120, clientY: 120 });

    expect(screen.getByRole("menuitem", { name: "已排入日程" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("menuitem", { name: "设为重点" }));
    expect(onUpdateTask).toHaveBeenCalledWith("task", { isTodayFocus: true });
  });

  it("opens the scheduling dialog from an unscheduled task context menu", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 27, 15, 0));

    render(
      <DailyTaskPanel
        tasks={[task({ name: "未排期任务" })]}
        events={[]}
        onAddTask={vi.fn()}
        onToggleTask={vi.fn()}
        onUpdateTask={vi.fn()}
        onRequestDeleteTask={vi.fn()}
        onCreateTimeBlock={vi.fn()}
        archivedSectionOpen={false}
        onArchivedSectionOpenChange={vi.fn()}
      />,
    );

    const taskRow = screen.getByText("未排期任务").closest("article");
    expect(taskRow).toBeTruthy();
    fireEvent.contextMenu(taskRow!, { clientX: 120, clientY: 120 });
    fireEvent.click(screen.getByRole("menuitem", { name: "排入日程" }));

    expect(screen.getByRole("dialog", { name: "排入日程" })).toBeTruthy();
  });

  it("requests deletion from the daily task context menu", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 27, 15, 0));
    const onRequestDeleteTask = vi.fn();

    render(
      <DailyTaskPanel
        tasks={[task({ name: "待删除日常任务" })]}
        events={[]}
        onAddTask={vi.fn()}
        onToggleTask={vi.fn()}
        onUpdateTask={vi.fn()}
        onRequestDeleteTask={onRequestDeleteTask}
        onCreateTimeBlock={vi.fn()}
        archivedSectionOpen={false}
        onArchivedSectionOpenChange={vi.fn()}
      />,
    );

    const taskRow = screen.getByText("待删除日常任务").closest("article");
    expect(taskRow).toBeTruthy();
    fireEvent.contextMenu(taskRow!, { clientX: 120, clientY: 120 });
    fireEvent.click(screen.getByRole("menuitem", { name: "删除任务" }));

    expect(onRequestDeleteTask).toHaveBeenCalledWith("task");
  });

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
        onRequestDeleteTask={vi.fn()}
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
