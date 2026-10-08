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
  function renderDateEditor(focused = true) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 27, 15, 0));
    const onUpdateTask = vi.fn();
    const item = task({ name: "准备汇报", isTodayFocus: focused });
    const props = {
      tasks: [item], events: [], onAddTask: vi.fn(), onToggleTask: vi.fn(), onUpdateTask,
      onRequestDeleteTask: vi.fn(), onReorderTask: vi.fn(), sortMode: "time" as const,
      onSortModeChange: vi.fn(), onCreateTimeBlock: vi.fn(), archivedSectionOpen: false,
      onArchivedSectionOpenChange: vi.fn(),
    };
    return { ...render(<DailyTaskPanel {...props} />), onUpdateTask, item, props };
  }

  it("reschedules a today-focus task to an arbitrary date two weeks later", () => {
    const { onUpdateTask, rerender, item, props } = renderDateEditor();
    const focus = screen.getByText("今日三件事").parentElement!.parentElement!;
    fireEvent.click(within(focus).getByRole("button", { name: "修改 准备汇报 的时间" }));
    const dialog = within(screen.getByRole("dialog", { name: "修改任务时间" }));
    expect((dialog.getByLabelText("任务日期") as HTMLInputElement).value).toBe("2026-07-27");
    fireEvent.change(dialog.getByLabelText("任务日期"), { target: { value: "2026-08-10" } });
    fireEvent.change(dialog.getByLabelText("计划时间（可选）"), { target: { value: "10:30" } });
    fireEvent.click(dialog.getByRole("button", { name: "保存时间" }));
    expect(onUpdateTask).toHaveBeenCalledWith("task", { dueDate: "2026-08-10", plannedTime: "10:30", isTodayFocus: false });
    expect(screen.queryByRole("dialog")).toBeNull();
    rerender(<DailyTaskPanel {...props} tasks={[{ ...item, ...onUpdateTask.mock.calls[0][1] }]} />);
    expect(within(focus).queryByText("准备汇报")).toBeNull();
    expect(screen.getByText("2026-08-10 10:30")).toBeTruthy();
  });

  it("retains today's focus when the selected date remains today", () => {
    const { onUpdateTask } = renderDateEditor();
    fireEvent.click(screen.getAllByRole("button", { name: "修改 准备汇报 的时间" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "保存时间" }));
    expect(onUpdateTask).toHaveBeenCalledWith("task", { dueDate: "2026-07-27", plannedTime: "", isTodayFocus: true });
  });

  it("offers arbitrary rescheduling in the context menu and cancels without saving", () => {
    const { onUpdateTask } = renderDateEditor(false);
    fireEvent.contextMenu(screen.getByText("准备汇报").closest("article")!, { clientX: 120, clientY: 120 });
    fireEvent.click(screen.getByRole("menuitem", { name: "修改时间" }));
    const dialog = within(screen.getByRole("dialog", { name: "修改任务时间" }));
    fireEvent.change(dialog.getByLabelText("任务日期"), { target: { value: "2026-08-12" } });
    fireEvent.click(dialog.getByRole("button", { name: "取消" }));
    expect(onUpdateTask).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("rejects an empty date without saving", () => {
    const { onUpdateTask } = renderDateEditor(false);
    fireEvent.click(screen.getByRole("button", { name: "修改 准备汇报 的时间" }));
    fireEvent.change(screen.getByLabelText("任务日期"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "保存时间" }));
    expect(onUpdateTask).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "修改任务时间" })).toBeTruthy();
  });

  it("loads an existing time and allows clearing it while keeping the date", () => {
    const { props, item, rerender, onUpdateTask } = renderDateEditor(false);
    rerender(<DailyTaskPanel {...props} tasks={[{ ...item, plannedTime: "23:59" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "修改 准备汇报 的时间" }));
    expect((screen.getByLabelText("计划时间（可选）") as HTMLInputElement).value).toBe("23:59");
    fireEvent.click(screen.getByRole("button", { name: "清除时间" }));
    fireEvent.click(screen.getByRole("button", { name: "保存时间" }));
    expect(onUpdateTask).toHaveBeenCalledWith("task", { dueDate: "2026-07-27", plannedTime: "", isTodayFocus: false });
  });

  it("orders by the user-selected date and time even when old linked time blocks exist", () => {
    const { props, item, rerender } = renderDateEditor(false);
    rerender(<DailyTaskPanel {...props} tasks={[
      { ...item, id: "late", name: "下午任务", plannedTime: "15:00" },
      { ...item, id: "untimed", name: "未指定时间" },
      { ...item, id: "early", name: "上午任务", plannedTime: "00:00" },
      { ...item, id: "future", name: "未来任务", dueDate: "2026-08-10", plannedTime: "10:30" },
    ]} events={[{ id: "old-block", date: "2026-07-26", startHour: 8, endHour: 9, linkedDailyTaskId: "future", title: "旧时间块", notes: "", requirements: [], category: "其他", isCompleted: false, tag: null }]} />);
    const names = Array.from(screen.getByTestId("daily-task-scroll-list").querySelectorAll("article p")).map((node) => node.textContent);
    expect(names).toEqual(["上午任务", "下午任务", "未指定时间", "未来任务"]);
  });

  it("collapses daily tasks and deadline radar while keeping a scrollable task list", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 27, 15, 0));
    const onSectionOpenChange = vi.fn();
    const onDeadlineRadarOpenChange = vi.fn();

    render(
      <DailyTaskPanel
        tasks={[
          ...Array.from({ length: 8 }, (_, index) => task({
            id: `daily-${index}`,
            name: `日常任务 ${index + 1}`,
          })),
          task({
            id: "long-deadline",
            name: "即将截止的长期任务",
            dueDate: "2026-07-30",
            taskType: "long",
          }),
        ]}
        events={[]}
        onAddTask={vi.fn()}
        onToggleTask={vi.fn()}
        onUpdateTask={vi.fn()}
        onRequestDeleteTask={vi.fn()}
        onReorderTask={vi.fn()}
        sortMode="time"
        onSortModeChange={vi.fn()}
        onCreateTimeBlock={vi.fn()}
        sectionOpen
        onSectionOpenChange={onSectionOpenChange}
        deadlineRadarOpen={false}
        onDeadlineRadarOpenChange={onDeadlineRadarOpenChange}
        archivedSectionOpen={false}
        onArchivedSectionOpenChange={vi.fn()}
      />,
    );

    const scrollList = screen.getByTestId("daily-task-scroll-list");
    expect(scrollList.className).toContain("max-h-72");
    expect(scrollList.className).toContain("overflow-y-auto");
    expect(screen.queryByText("即将截止的长期任务")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "折叠日常任务" }));
    expect(onSectionOpenChange.mock.calls[0][0]).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "展开截止日期雷达" }));
    expect(onDeadlineRadarOpenChange.mock.calls[0][0]).toBe(true);
  });

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
        onReorderTask={vi.fn()}
        sortMode="time"
        onSortModeChange={vi.fn()}
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
        onReorderTask={vi.fn()}
        sortMode="time"
        onSortModeChange={vi.fn()}
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
        onReorderTask={vi.fn()}
        sortMode="time"
        onSortModeChange={vi.fn()}
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

  it("orders daily tasks by date and linked schedule start time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 27, 15, 0));
    const events: ScheduleEvent[] = [
      {
        id: "late-event",
        date: "2026-07-27",
        startHour: 15,
        endHour: 16,
        title: "下午任务",
        notes: "",
        requirements: [],
        isCompleted: false,
        category: "生活",
        tag: null,
        linkedDailyTaskId: "late",
      },
      {
        id: "recurring-event",
        date: "2026-07-01",
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
          "2026-07-27": { linkedDailyTaskId: "early", startHour: 8.5 },
        },
      },
    ];

    render(
      <DailyTaskPanel
        tasks={[
          task({ id: "late", name: "下午任务" }),
          task({ id: "tomorrow", name: "明日任务", dueDate: "2026-07-28" }),
          task({ id: "early", name: "早间任务" }),
          task({ id: "unscheduled", name: "今日未排期" }),
        ]}
        events={events}
        onAddTask={vi.fn()}
        onToggleTask={vi.fn()}
        onUpdateTask={vi.fn()}
        onRequestDeleteTask={vi.fn()}
        onReorderTask={vi.fn()}
        sortMode="time"
        onSortModeChange={vi.fn()}
        onCreateTimeBlock={vi.fn()}
        archivedSectionOpen={false}
        onArchivedSectionOpenChange={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("article").map((row) => row.textContent)).toEqual([
      "早间任务2026-07-27",
      "下午任务2026-07-27",
      "今日未排期2026-07-27",
      "明日任务2026-07-28",
    ]);
  });

  it("keeps custom order and lets the user reorder daily tasks", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 27, 15, 0));
    const onReorderTask = vi.fn();
    const onSortModeChange = vi.fn();

    render(
      <DailyTaskPanel
        tasks={[
          task({ id: "second", name: "自定义第二项" }),
          task({ id: "first", name: "自定义第一项" }),
        ]}
        events={[]}
        onAddTask={vi.fn()}
        onToggleTask={vi.fn()}
        onUpdateTask={vi.fn()}
        onRequestDeleteTask={vi.fn()}
        onReorderTask={onReorderTask}
        sortMode="custom"
        onSortModeChange={onSortModeChange}
        onCreateTimeBlock={vi.fn()}
        archivedSectionOpen={false}
        onArchivedSectionOpenChange={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("article").map((row) => row.textContent)).toEqual([
      "自定义第二项2026-07-27",
      "自定义第一项2026-07-27",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "按时间排序" }));
    expect(onSortModeChange).toHaveBeenCalledWith("time");

    const dragHandle = screen.getByRole("button", { name: "调整顺序 自定义第二项" });
    const targetRow = screen.getByText("自定义第一项").closest("article");
    expect(targetRow).toBeTruthy();
    fireEvent.dragStart(dragHandle);
    fireEvent.dragOver(targetRow!);
    fireEvent.drop(targetRow!);
    expect(onReorderTask).toHaveBeenCalledWith("second", "first");
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
        onReorderTask={vi.fn()}
        sortMode="time"
        onSortModeChange={vi.fn()}
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
