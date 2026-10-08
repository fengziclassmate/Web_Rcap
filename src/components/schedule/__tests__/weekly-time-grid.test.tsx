import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CenteredTimePartSelect,
  WeeklyTimeGrid,
} from "@/components/schedule/weekly-time-grid";
import type { ScheduleEvent } from "@/lib/types";

type WeeklyTimeGridProps = ComponentProps<typeof WeeklyTimeGrid>;

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

beforeEach(() => {
  window.localStorage.clear();
});

describe("CenteredTimePartSelect", () => {
  it("shows the first minute option without blank content above it", async () => {
    render(
      <CenteredTimePartSelect
        value={0}
        options={[0, 1, 2]}
        label="分钟"
        onChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("combobox", { name: "分钟" }));

    const listbox = await screen.findByRole("listbox");
    expect(listbox.firstElementChild).toBe(screen.getByRole("option", { name: "00" }));
  });

  it("applies the rest template to every 50+10 tail slot in the work week", async () => {
    const onCreateEvents = vi.fn();
    render(
      <WeeklyTimeGrid
        currentWeekStart={new Date(2026, 6, 13)}
        weekRange="2026/07/13 - 2026/07/19"
        events={[]}
        onCreateEvent={vi.fn()}
        onCreateEvents={onCreateEvents}
        onCreateDailyTask={vi.fn(() => null)}
        onUpdateEvent={vi.fn()}
        onDeleteEvent={vi.fn()}
        onPrevWeek={vi.fn()}
        onNextWeek={vi.fn()}
        viewMode="week"
        timeGranularity="50-10"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "模板" }));

    const dialog = await screen.findByRole("dialog");
    expect((within(dialog).getByLabelText("标题") as HTMLInputElement).value).toBe("休息");
    expect(within(dialog).getByText("45 个")).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("button", { name: "铺入本周" }));

    expect(onCreateEvents).toHaveBeenCalledTimes(1);
    expect(onCreateEvents.mock.calls[0][0]).toHaveLength(45);
    expect(onCreateEvents.mock.calls[0][0][0]).toEqual(
      expect.objectContaining({
        date: "2026-07-13",
        startHour: 9 + 50 / 60,
        endHour: 10,
        title: "休息",
      }),
    );
  });
});

function renderGrid({
  events = [],
  onCreateDailyTask = vi.fn<WeeklyTimeGridProps["onCreateDailyTask"]>(() => null),
  onUpdateEvent = vi.fn<WeeklyTimeGridProps["onUpdateEvent"]>(),
  onDeleteEvent = vi.fn<WeeklyTimeGridProps["onDeleteEvent"]>(),
}: {
  events?: ScheduleEvent[];
  onCreateDailyTask?: WeeklyTimeGridProps["onCreateDailyTask"];
  onUpdateEvent?: WeeklyTimeGridProps["onUpdateEvent"];
  onDeleteEvent?: WeeklyTimeGridProps["onDeleteEvent"];
} = {}) {
  const props: WeeklyTimeGridProps = {
    currentWeekStart: new Date(2026, 6, 27),
    weekRange: "2026/07/27 - 2026/08/02",
    events,
    onCreateEvent: vi.fn(),
    onCreateDailyTask,
    onUpdateEvent,
    onDeleteEvent,
    onPrevWeek: vi.fn(),
    onNextWeek: vi.fn(),
    viewMode: "week",
    timeGranularity: 60,
  };
  const result = render(<WeeklyTimeGrid {...props} />);
  return {
    ...result,
    rerenderGrid: (patch: Partial<WeeklyTimeGridProps>) =>
      result.rerender(<WeeklyTimeGrid {...props} {...patch} />),
  };
}

const scheduleEvent: ScheduleEvent = {
  id: "event-1",
  date: "2026-07-27",
  startHour: 9,
  endHour: 10,
  title: "完成态行程",
  notes: "",
  requirements: [],
  isCompleted: true,
  category: "工作",
  tag: null,
};

function marqueeSelectAll(container: HTMLElement) {
  const cards = Array.from(container.querySelectorAll<HTMLElement>("[data-schedule-card]"));
  const timeline = cards[0].closest<HTMLDivElement>(".relative.grid");
  expect(timeline).toBeTruthy();
  let hasPointerCapture = false;
  const setPointerCapture = vi.fn(() => {
    hasPointerCapture = true;
  });
  const releasePointerCapture = vi.fn(() => {
    hasPointerCapture = false;
  });
  Object.defineProperties(timeline!, {
    getBoundingClientRect: {
      value: () => ({ left: 0, top: 0, right: 1000, bottom: 2000, width: 1000, height: 2000 }),
    },
    setPointerCapture: { value: setPointerCapture },
    hasPointerCapture: { value: vi.fn(() => hasPointerCapture) },
    releasePointerCapture: { value: releasePointerCapture },
  });
  cards.forEach((card, index) => {
    Object.defineProperty(card, "getBoundingClientRect", {
      value: () => ({
        left: 100,
        top: 100 + index * 100,
        right: 220,
        bottom: 170 + index * 100,
        width: 120,
        height: 70,
      }),
    });
  });

  fireEvent.pointerDown(timeline!, { pointerId: 1, button: 0, clientX: 50, clientY: 50 });
  fireEvent.pointerMove(timeline!, { pointerId: 1, buttons: 1, clientX: 260, clientY: 300 });
  fireEvent.pointerUp(timeline!, { pointerId: 1, clientX: 260, clientY: 300 });
  expect(setPointerCapture).toHaveBeenCalledTimes(1);
  expect(releasePointerCapture).toHaveBeenCalledTimes(1);
}

describe("WeeklyTimeGrid interactions", () => {
  it("drops inside a 45-minute grid slot at the pointer time rather than the slot start", () => {
    const onUpdateEvent = vi.fn();
    const { container, rerenderGrid } = renderGrid({ events: [{ ...scheduleEvent, startHour: 6.75, endHour: 7 }], onUpdateEvent });
    rerenderGrid({ timeGranularity: "45-15" });
    const slot = container.querySelector('[data-timeline-date="2026-07-27"] > .grid')!.children[12] as HTMLElement;
    Object.defineProperty(slot.closest('[data-timeline-date]')!, "getBoundingClientRect", { value: () => ({ top: 100 - 6 * 72 }) });
    fireEvent.dragStart(container.querySelector('[data-schedule-card]')!);
    fireEvent(slot, new MouseEvent("drop", { bubbles: true, cancelable: true, clientY: 136 }));
    expect(onUpdateEvent).toHaveBeenCalledWith(scheduleEvent.id, expect.objectContaining({ date: "2026-07-27", startHour: 6.5, endHour: 6.75 }), undefined);
  });
  it("ignores legacy buffers in the calendar and editor while preserving event times", () => {
    const onUpdateEvent = vi.fn();
    const legacyEvent = { ...scheduleEvent, bufferBeforeMinutes: 20, bufferAfterMinutes: 15, bufferBeforeName: "去羽毛球场", bufferAfterName: "回实验室" };
    const { container } = renderGrid({ events: [legacyEvent], onUpdateEvent });
    expect(container.querySelectorAll('[data-testid="event-buffer"]')).toHaveLength(0);
    fireEvent.click(screen.getAllByRole("button", { name: `打开 ${scheduleEvent.title} 编辑窗口` })[0]);
    const editor = within(screen.getByRole("dialog"));
    expect(editor.queryByLabelText("提前准备")).toBeNull();
    expect(editor.queryByLabelText("事件前缓冲名称")).toBeNull();
    fireEvent.click(editor.getByRole("button", { name: "保存修改" }));
    expect(onUpdateEvent).toHaveBeenCalledWith(scheduleEvent.id, expect.objectContaining({ startHour: scheduleEvent.startHour, endHour: scheduleEvent.endHour }));
    expect(onUpdateEvent.mock.calls[0][1]).not.toHaveProperty("bufferBeforeMinutes");
  });
  it("edits a multi-day start date while keeping its end fixed", () => {
    const onUpdateEvent = vi.fn();
    renderGrid({ events: [{ ...scheduleEvent, endDate: "2026-07-30", startHour: 9, endHour: 10 }], onUpdateEvent });
    fireEvent.click(screen.getAllByRole("button", { name: `打开 ${scheduleEvent.title} 编辑窗口` })[0]);
    fireEvent.change(screen.getByLabelText("编辑行程开始日期"), { target: { value: "2026-07-29" } });
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));
    expect(onUpdateEvent).toHaveBeenCalledWith(scheduleEvent.id, expect.objectContaining({ date: "2026-07-29", endDate: "2026-07-30", startHour: 9, endHour: 10 }));
  });
  it("accepts moving a multi-day event onto its own later segment at the pointer time", () => {
    const onUpdateEvent = vi.fn();
    const { container } = renderGrid({ events: [{ ...scheduleEvent, endDate: "2026-07-30", startHour: 9, endHour: 10 }], onUpdateEvent });
    const cards = container.querySelectorAll("[data-schedule-card]");
    Object.defineProperty(cards[1], "getBoundingClientRect", { value: () => ({ top: 0, height: 1728 }) });
    fireEvent.dragStart(cards[0]);
    expect(fireEvent.dragOver(cards[1], { clientY: 720 })).toBe(false);
    fireEvent(cards[1], new MouseEvent("drop", { bubbles: true, cancelable: true, clientY: 720 }));
    expect(onUpdateEvent).toHaveBeenCalledWith(scheduleEvent.id, expect.objectContaining({ date: "2026-07-28", startHour: 10, endDate: "2026-07-31", endHour: 11 }));
  });
  it("can shorten a multi-day event to its final day and rejects a start after its end", () => {
    const onUpdateEvent = vi.fn();
    renderGrid({ events: [{ ...scheduleEvent, endDate: "2026-07-30", startHour: 9, endHour: 10 }], onUpdateEvent });
    fireEvent.click(screen.getAllByRole("button", { name: `打开 ${scheduleEvent.title} 编辑窗口` })[0]);
    const editor = within(screen.getByRole("dialog"));
    fireEvent.change(editor.getByLabelText("编辑行程开始日期"), { target: { value: "2026-07-31" } });
    fireEvent.click(editor.getByRole("button", { name: "保存修改" }));
    expect(onUpdateEvent).not.toHaveBeenCalled();
    fireEvent.change(editor.getByLabelText("编辑行程开始日期"), { target: { value: "" } });
    fireEvent.change(editor.getByLabelText("编辑行程结束日期"), { target: { value: "" } });
    fireEvent.click(editor.getByRole("button", { name: "保存修改" }));
    expect(onUpdateEvent).not.toHaveBeenCalled();
    fireEvent.change(editor.getByLabelText("编辑行程结束日期"), { target: { value: "2026-07-30" } });
    fireEvent.change(editor.getByLabelText("编辑行程开始日期"), { target: { value: "2026-07-30" } });
    fireEvent.click(editor.getByRole("button", { name: "保存修改" }));
    expect(onUpdateEvent).toHaveBeenCalledWith(scheduleEvent.id, expect.objectContaining({ date: "2026-07-30", endDate: undefined, startHour: 9, endHour: 10 }));
  });
  it("resizes a multi-day start into a later date without moving its end", () => {
    const onUpdateEvent = vi.fn();
    const { container } = renderGrid({ events: [{ ...scheduleEvent, endDate: "2026-07-30", startHour: 9, endHour: 10 }], onUpdateEvent });
    const columns = container.querySelectorAll("[data-timeline-date]");
    columns.forEach((column, i) => Object.defineProperty(column, "getBoundingClientRect", { value: () => ({ left: i * 100, right: (i + 1) * 100, top: 0, width: 100 }) }));
    fireEvent.mouseDown(screen.getByRole("button", { name: `调整 ${scheduleEvent.title} 的开始时间` }), { clientX: 50, clientY: 648 });
    fireEvent.mouseMove(window, { clientX: 250, clientY: 720 });
    fireEvent.mouseUp(window);
    expect(onUpdateEvent).toHaveBeenCalledWith(scheduleEvent.id, { date: "2026-07-29", startHour: 10, endDate: "2026-07-30", endHour: 10 }, undefined);
  });
  it("persists a custom quick-template order", () => {
    localStorage.setItem("schedule-event-templates-v1", JSON.stringify([{ id: "walk", title: "散步", category: "休息", notes: "", requirements: [], tag: null }]));
    const { container } = renderGrid();
    const slot = Array.from(container.querySelectorAll("button")).find((button) => button.getAttribute("aria-label")?.endsWith("新建日程"));
    fireEvent.click(slot!);
    fireEvent.dragStart(screen.getByRole("button", { name: "快捷填写：散步" }));
    fireEvent.drop(screen.getByRole("button", { name: "快捷填写：休息" }));
    expect(JSON.parse(localStorage.getItem("schedule-event-templates-v1")!).map((item: { title: string }) => item.title)).toEqual(["散步", "休息"]);
  });
  it("moves a multi-day event without requiring an empty multi-day slot", () => {
    const onUpdateEvent = vi.fn();
    const { container } = renderGrid({ events: [{ ...scheduleEvent, endDate: "2026-07-30", startHour: 9, endHour: 10 }], onUpdateEvent });
    const card = container.querySelector("[data-schedule-card]");
    const slot = Array.from(container.querySelectorAll("button")).find((button) => button.getAttribute("aria-label")?.endsWith("新建日程"));
    fireEvent.dragStart(card!);
    fireEvent(slot!, new MouseEvent("drop", { bubbles: true, cancelable: true, clientY: 0 }));
    expect(onUpdateEvent).toHaveBeenCalledWith(scheduleEvent.id, { date: "2026-07-27", endDate: "2026-07-30", startHour: 0, endHour: 1 });
  });
  it("resizes only the outer boundaries of a multi-day event", () => {
    const onUpdateEvent = vi.fn();
    renderGrid({ events: [{ ...scheduleEvent, endDate: "2026-07-30", startHour: 9, endHour: 10 }], onUpdateEvent });
    expect(screen.getAllByRole("button", { name: `调整 ${scheduleEvent.title} 的开始时间` })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: `调整 ${scheduleEvent.title} 的结束时间` })).toHaveLength(1);
    fireEvent.mouseDown(screen.getByRole("button", { name: `调整 ${scheduleEvent.title} 的结束时间` }), { clientY: 100 });
    fireEvent.mouseMove(window, { clientY: 136 });
    fireEvent.mouseUp(window);
    expect(onUpdateEvent).toHaveBeenCalledWith(scheduleEvent.id, { startHour: 9, endHour: 10.5, endDate: "2026-07-30" }, undefined);
  });
  it("creates a multi-day event at the occupied card time without shifting it", () => {
    const { rerenderGrid } = renderGrid({ events: [scheduleEvent] });
    const onCreateEvent = vi.fn();
    rerenderGrid({ onCreateEvent });
    fireEvent.click(screen.getByRole("button", { name: `在 ${scheduleEvent.title} 同时段新建行程` }));
    fireEvent.change(screen.getByPlaceholderText("输入行程标题"), { target: { value: "连续出差" } });
    fireEvent.change(screen.getByLabelText("新建行程结束日期"), { target: { value: "2026-07-30" } });
    fireEvent.click(screen.getByRole("button", { name: "创建行程" }));
    expect(onCreateEvent).toHaveBeenCalledWith(expect.objectContaining({ date: "2026-07-27", endDate: "2026-07-30", startHour: 9, title: "连续出差" }));
  });
  it("edits and restores the appearance of the built-in sleep category", () => {
    renderGrid();
    fireEvent.click(screen.getByRole("button", { name: "分类管理" }));
    fireEvent.click(screen.getAllByTitle("编辑分类")[0]);
    fireEvent.change(screen.getByLabelText("分类 HEX 颜色"), { target: { value: "#123456" } });
    fireEvent.click(screen.getByRole("button", { name: "图标 coffee" }));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    const stored = JSON.parse(localStorage.getItem("schedule-user-categories")!);
    expect(stored.find((item: { name: string }) => item.name === "睡眠")).toMatchObject({ hex: "#123456", icon: "coffee" });
    fireEvent.click(screen.getAllByTitle("编辑分类")[0]);
    fireEvent.click(screen.getByRole("button", { name: "恢复默认" }));
    expect((screen.getByLabelText("分类 HEX 颜色") as HTMLInputElement).value).toBe("#6366f1");
    expect(screen.getByRole("button", { name: "图标 moon" }).getAttribute("aria-pressed")).toBe("true");
  }, 15000);

  it("keeps the context menu focused and can link an event to a daily task", () => {
    const onCreateDailyTask = vi.fn<WeeklyTimeGridProps["onCreateDailyTask"]>(() => "task-1");
    const onUpdateEvent = vi.fn<WeeklyTimeGridProps["onUpdateEvent"]>();
    renderGrid({
      events: [{ ...scheduleEvent, isCompleted: false }],
      onCreateDailyTask,
      onUpdateEvent,
    });

    const card = screen.getByText("完成态行程").closest<HTMLElement>("[data-schedule-card]");
    expect(card).toBeTruthy();
    fireEvent.contextMenu(card!, { clientX: 120, clientY: 120 });

    expect(screen.queryByText("问 AI 分析该行程")).toBeNull();
    expect(screen.queryByText("标记为待定")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "加入日常任务" }));

    expect(onCreateDailyTask).toHaveBeenCalledWith("完成态行程", "2026-07-27");
    expect(onUpdateEvent).toHaveBeenCalledWith(
      "event-1",
      { linkedDailyTaskId: "task-1", isCompleted: false },
      undefined,
    );
  });

  it("keeps a simple blank-cell press available for creating an event", () => {
    const { container } = renderGrid();
    const emptySlot = Array.from(container.querySelectorAll("button")).find(
      (button) => button.getAttribute("aria-label")?.endsWith("新建日程"),
    );
    const timeline = emptySlot?.closest<HTMLDivElement>(".relative.grid");
    expect(emptySlot).toBeTruthy();
    expect(timeline).toBeTruthy();
    const setPointerCapture = vi.fn();
    Object.defineProperties(timeline!, {
      getBoundingClientRect: {
        value: () => ({ left: 0, top: 0, right: 1000, bottom: 2000, width: 1000, height: 2000 }),
      },
      setPointerCapture: { value: setPointerCapture },
      hasPointerCapture: { value: vi.fn(() => false) },
      releasePointerCapture: { value: vi.fn() },
    });

    fireEvent.pointerDown(emptySlot!, { pointerId: 1, button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(timeline!, { pointerId: 1, buttons: 1, clientX: 103, clientY: 104 });
    fireEvent.pointerUp(emptySlot!, { pointerId: 1, button: 0, clientX: 100, clientY: 100 });
    fireEvent.click(emptySlot!);

    expect(setPointerCapture).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("clears a pending marquee when the pointer leaves before dragging", () => {
    const { container } = renderGrid();
    const emptySlot = Array.from(container.querySelectorAll("button")).find(
      (button) => button.getAttribute("aria-label")?.endsWith("新建日程"),
    );
    const timeline = emptySlot?.closest<HTMLDivElement>(".relative.grid");
    expect(emptySlot).toBeTruthy();
    expect(timeline).toBeTruthy();
    const setPointerCapture = vi.fn();
    Object.defineProperties(timeline!, {
      getBoundingClientRect: {
        value: () => ({ left: 0, top: 0, right: 1000, bottom: 2000, width: 1000, height: 2000 }),
      },
      setPointerCapture: { value: setPointerCapture },
    });

    fireEvent.pointerDown(emptySlot!, { pointerId: 1, button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerLeave(timeline!, { pointerId: 1, buttons: 1, clientX: 102, clientY: 102 });
    fireEvent.pointerMove(timeline!, { pointerId: 1, buttons: 0, clientX: 200, clientY: 200 });

    expect(setPointerCapture).not.toHaveBeenCalled();
  });

  it("uses a whole-card diagonal pattern instead of striking through the title", () => {
    renderGrid({ events: [scheduleEvent] });

    const title = screen.getByText("完成态行程");
    expect(title.className).not.toContain("line-through");
    const card = title.closest("[data-schedule-card]");
    expect(card?.querySelector('[class*="repeating-linear-gradient(45deg"]')).toBeTruthy();
  });

  it("uses the same title font size for short and long events", () => {
    renderGrid({
      events: [
        {
          ...scheduleEvent,
          id: "short-title-event",
          title: "短行程标题",
          startHour: 9,
          endHour: 9.25,
        },
        {
          ...scheduleEvent,
          id: "long-title-event",
          title: "长行程标题",
          startHour: 10,
          endHour: 12,
        },
      ],
    });

    const shortTitle = screen.getByText("短行程标题");
    const longTitle = screen.getByText("长行程标题");
    expect(shortTitle.className).toContain("text-xs");
    expect(longTitle.className).toContain("text-xs");
  });

  it("commits an end-time resize after dragging the bottom edge", () => {
    const onUpdateEvent = vi.fn();
    renderGrid({ events: [{ ...scheduleEvent, isCompleted: false }], onUpdateEvent });

    fireEvent.mouseDown(screen.getByRole("button", { name: "调整 完成态行程 的结束时间" }), {
      clientY: 100,
    });
    fireEvent.mouseMove(window, { clientY: 136 });
    fireEvent.mouseUp(window);

    expect(onUpdateEvent).toHaveBeenCalledWith(
      "event-1",
      expect.objectContaining({ startHour: 9, endHour: 10.5 }),
      undefined,
    );
  });

  it("drags a single recurring occurrence without changing the whole series", () => {
    const onUpdateEvent = vi.fn<WeeklyTimeGridProps["onUpdateEvent"]>();
    const { container } = renderGrid({
      events: [
        {
          ...scheduleEvent,
          id: "recurring-event",
          title: "循环锻炼",
          isCompleted: false,
          recurrence: { kind: "daily" },
          exceptionDates: [],
          recurrenceOverrides: {},
        },
      ],
      onUpdateEvent,
    });

    const card = screen.getAllByText("循环锻炼")[0].closest<HTMLElement>("[data-schedule-card]");
    const targetSlot = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.getAttribute("aria-label")?.endsWith("新建日程"),
    );
    expect(card).toBeTruthy();
    expect(targetSlot).toBeTruthy();
    expect(card!.draggable).toBe(true);

    fireEvent.dragStart(card!);
    fireEvent(targetSlot!, new MouseEvent("drop", { bubbles: true, cancelable: true, clientY: 0 }));

    expect(onUpdateEvent).toHaveBeenCalledWith(
      "recurring-event__2026-07-27",
      {
        date: "2026-07-27",
        startHour: 0,
        endHour: 1,
      },
      { scope: "occurrence" },
    );
  });

  it("edits the selected recurring day forward with a compact scope control", () => {
    const onUpdateEvent = vi.fn<WeeklyTimeGridProps["onUpdateEvent"]>();
    renderGrid({
      events: [
        {
          ...scheduleEvent,
          id: "recurring-edit-event",
          date: "2026-07-27",
          title: "循环编辑",
          isCompleted: false,
          recurrence: { kind: "daily" },
          exceptionDates: [],
          recurrenceOverrides: {},
        },
      ],
      onUpdateEvent,
    });

    fireEvent.click(screen.getAllByRole("button", { name: "打开 循环编辑 编辑窗口" })[0]);
    const editor = within(screen.getByRole("dialog"));
    fireEvent.click(editor.getByRole("button", { name: /循环行程设置/ }));

    expect(editor.queryByText(/当前日期/)).toBeNull();
    expect(editor.queryByText(/修改时间、标题等时/)).toBeNull();
    fireEvent.click(editor.getByRole("button", { name: "当天及未来" }));
    fireEvent.change(editor.getByLabelText("标题"), { target: { value: "未来循环编辑" } });
    fireEvent.click(editor.getByRole("button", { name: "保存修改" }));

    expect(onUpdateEvent).toHaveBeenCalledWith(
      "recurring-edit-event__2026-07-27",
      expect.objectContaining({ title: "未来循环编辑" }),
      { scope: "future" },
    );
  });

  it("folds edit details and defaults every recurring edit to the selected day", () => {
    const onUpdateEvent = vi.fn<WeeklyTimeGridProps["onUpdateEvent"]>();
    window.localStorage.setItem("recurrence-edit-scope", "future");
    renderGrid({
      events: [
        {
          ...scheduleEvent,
          id: "recurring-default-scope-event",
          date: "2026-07-27",
          title: "默认仅此日",
          notes: "已有备注",
          requirements: ["已有物品"],
          isCompleted: false,
          recurrence: { kind: "daily" },
          exceptionDates: [],
          recurrenceOverrides: {},
        },
      ],
      onUpdateEvent,
    });

    fireEvent.click(screen.getAllByRole("button", { name: "打开 默认仅此日 编辑窗口" })[0]);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByLabelText("备注")).toBeNull();

    fireEvent.click(within(dialog).getByRole("button", { name: "补充信息" }));
    expect((within(dialog).getByLabelText("备注") as HTMLTextAreaElement).value).toBe("已有备注");
    expect((within(dialog).getByLabelText("所需物品/准备事项") as HTMLTextAreaElement).value).toBe("已有物品");

    fireEvent.change(within(dialog).getByLabelText("标题"), { target: { value: "仅修改今天" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "保存修改" }));

    expect(onUpdateEvent).toHaveBeenCalledWith(
      "recurring-default-scope-event__2026-07-27",
      expect.objectContaining({ title: "仅修改今天" }),
      { scope: "occurrence" },
    );
  });

  it("drops a short event at the pointer time inside an occupied card", () => {
    const onUpdateEvent = vi.fn<WeeklyTimeGridProps["onUpdateEvent"]>();
    renderGrid({
      events: [
        {
          ...scheduleEvent,
          id: "occupied-event",
          title: "九点事项",
          startHour: 6,
          endHour: 6.75,
          isCompleted: false,
        },
        {
          ...scheduleEvent,
          id: "dragged-event",
          title: "待移动的十五分钟事件",
          startHour: 10,
          endHour: 10.25,
          isCompleted: false,
        },
      ],
      onUpdateEvent,
    });

    const draggedCard = screen
      .getByText("待移动的十五分钟事件")
      .closest<HTMLElement>("[data-schedule-card]");
    const occupiedCard = screen
      .getByText("九点事项")
      .closest<HTMLElement>("[data-schedule-card]");
    expect(draggedCard).toBeTruthy();
    expect(occupiedCard).toBeTruthy();
    Object.defineProperty(occupiedCard!, "getBoundingClientRect", { value: () => ({ top: 100, height: 54 }) });
    Object.defineProperty(occupiedCard!.closest('[data-timeline-date]')!, "getBoundingClientRect", { value: () => ({ top: 100 - 6 * 72 }) });

    fireEvent.dragStart(draggedCard!);
    fireEvent.dragOver(occupiedCard!);
    fireEvent(occupiedCard!, new MouseEvent("drop", { bubbles: true, cancelable: true, clientY: 136 }));

    expect(onUpdateEvent).toHaveBeenCalledWith(
      "dragged-event",
      {
        date: "2026-07-27",
        startHour: 6.5,
        endHour: 6.75,
      },
      undefined,
    );
  });

  it("keeps the selected date even when the rest of the day is occupied", () => {
    const onUpdateEvent = vi.fn();
    const { container } = renderGrid({ events: [
      { ...scheduleEvent, id: "blocked", startHour: 6, endHour: 24 },
      { ...scheduleEvent, id: "dragged", startHour: 1, endHour: 2 },
    ], onUpdateEvent });
    const cards = container.querySelectorAll("[data-schedule-card]");
    const target = Array.from(cards).find((card) => card.getAttribute("data-schedule-event-id") === "blocked")!;
    const source = Array.from(cards).find((card) => card.getAttribute("data-schedule-event-id") === "dragged")!;
    Object.defineProperty(target.closest('[data-timeline-date]')!, "getBoundingClientRect", { value: () => ({ top: 100 - 6 * 72 }) });
    fireEvent.dragStart(source);
    fireEvent(target, new MouseEvent("drop", { bubbles: true, cancelable: true, clientY: 172 }));
    expect(onUpdateEvent).toHaveBeenCalledWith("dragged", { date: "2026-07-27", startHour: 7, endHour: 8 }, undefined);
  });

  it("snaps occupied-card drops against the timeline rather than the inset card edge", () => {
    const onUpdateEvent = vi.fn();
    const { container } = renderGrid({ events: [
      { ...scheduleEvent, id: "occupied", startHour: 6, endHour: 7 },
      { ...scheduleEvent, id: "rest", startHour: 8, endHour: 8.25 },
    ], onUpdateEvent });
    const target = container.querySelector('[data-schedule-event-id="occupied"]')!;
    Object.defineProperty(target, "getBoundingClientRect", { value: () => ({ top: 103 }) });
    Object.defineProperty(target.closest('[data-timeline-date]')!, "getBoundingClientRect", { value: () => ({ top: 100 - 6 * 72 }) });
    fireEvent.dragStart(container.querySelector('[data-schedule-event-id="rest"]')!);
    fireEvent(target, new MouseEvent("drop", { bubbles: true, cancelable: true, clientY: 139.6 }));
    expect(onUpdateEvent).toHaveBeenCalledWith("rest", { date: "2026-07-27", startHour: 6 + 35 / 60, endHour: 6 + 50 / 60 }, undefined);
  });

  it("moves a full-day recurring instance with an explicit next-day end", () => {
    const onUpdateEvent = vi.fn();
    const { container } = renderGrid({ events: [{ ...scheduleEvent, startHour: 0, endHour: 24, recurrence: { kind: "daily" } }], onUpdateEvent });
    const source = container.querySelector('[data-schedule-card]')!;
    fireEvent.dragStart(source);
    fireEvent(source, new MouseEvent("drop", { bubbles: true, cancelable: true, clientY: 432 }));
    expect(onUpdateEvent).toHaveBeenCalledWith(`${scheduleEvent.id}__2026-07-27`, { date: "2026-07-27", endDate: "2026-07-28", startHour: 6, endHour: 6 }, { scope: "occurrence" });
  });

  it("preserves a full-day duration when the new start crosses midnight", () => {
    const onUpdateEvent = vi.fn();
    const { container } = renderGrid({ events: [{ ...scheduleEvent, startHour: 0, endHour: 24 }], onUpdateEvent });
    const target = container.querySelector('[data-timeline-date="2026-07-28"] > .grid')!.children[6];
    Object.defineProperty(target.closest('[data-timeline-date]')!, "getBoundingClientRect", { value: () => ({ top: 100 - 6 * 72 }) });
    fireEvent.dragStart(container.querySelector('[data-schedule-card]')!);
    fireEvent(target, new MouseEvent("drop", { bubbles: true, cancelable: true, clientY: 100 }));
    expect(onUpdateEvent).toHaveBeenCalledWith(scheduleEvent.id, { date: "2026-07-28", endDate: "2026-07-29", startHour: 6, endHour: 6 }, undefined);
  });

  it("keeps resize handles available for short and cross-midnight cards", () => {
    const onUpdateEvent = vi.fn<WeeklyTimeGridProps["onUpdateEvent"]>();
    const { rerenderGrid } = renderGrid({
      events: [
        {
          ...scheduleEvent,
          id: "short-event",
          title: "十五分钟行程",
          startHour: 9,
          endHour: 9.25,
          isCompleted: false,
        },
      ],
      onUpdateEvent,
    });
    expect(screen.getByRole("button", { name: "调整 十五分钟行程 的开始时间" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "调整 十五分钟行程 的结束时间" })).toBeTruthy();

    rerenderGrid({
      events: [
        {
          ...scheduleEvent,
          id: "overnight-event",
          title: "跨夜实验",
          startHour: 22,
          endHour: 2,
          isCompleted: false,
        },
      ],
    });
    expect(screen.getByRole("button", { name: "调整 跨夜实验 的开始时间" })).toBeTruthy();
    const endHandle = screen.getByRole("button", { name: "调整 跨夜实验 的结束时间" });
    fireEvent.mouseDown(endHandle, { clientY: 100 });
    fireEvent.mouseMove(window, { clientY: 136 });
    fireEvent.mouseUp(window);

    expect(onUpdateEvent).toHaveBeenCalledWith(
      "overnight-event",
      expect.objectContaining({ startHour: 22, endHour: 2.5 }),
      undefined,
    );
  });

  it("keeps the center of a short card available for opening its editor", () => {
    renderGrid({
      events: [
        {
          ...scheduleEvent,
          id: "short-edit-event",
          title: "十五分钟行程",
          startHour: 9,
          endHour: 9.25,
          isCompleted: false,
        },
      ],
    });

    const editTrigger = screen.getByRole("button", { name: "打开 十五分钟行程 编辑窗口" });
    const startHandle = screen.getByRole("button", { name: "调整 十五分钟行程 的开始时间" });
    const endHandle = screen.getByRole("button", { name: "调整 十五分钟行程 的结束时间" });

    expect(startHandle.className).toContain("left-1");
    expect(startHandle.className).toContain("max-w-8");
    expect(endHandle.className).toContain("right-1");
    expect(endHandle.className).toContain("max-w-8");

    fireEvent.click(editTrigger);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("completes a meeting event without requiring a separate meeting record", () => {
    const onUpdateEvent = vi.fn<WeeklyTimeGridProps["onUpdateEvent"]>();
    renderGrid({
      events: [{ ...scheduleEvent, title: "课题组周会", category: "会议", isCompleted: false }],
      onUpdateEvent,
    });

    fireEvent.click(screen.getByRole("button", { name: "打开 课题组周会 编辑窗口" }));
    fireEvent.click(screen.getByRole("switch", { name: "标记为已完成" }));
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));

    expect(onUpdateEvent).toHaveBeenCalledWith(
      "event-1",
      expect.objectContaining({ isCompleted: true, category: "会议" }),
    );
  });

  it("renames a linked event without resubmitting an unchanged completion state", () => {
    const onUpdateEvent = vi.fn<WeeklyTimeGridProps["onUpdateEvent"]>();
    renderGrid({
      events: [
        {
          ...scheduleEvent,
          title: "原日程名称",
          linkedDailyTaskId: "task-1",
          isCompleted: false,
        },
      ],
      onUpdateEvent,
    });

    fireEvent.click(screen.getByRole("button", { name: "打开 原日程名称 编辑窗口" }));
    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "修改后的日程名称" } });
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));

    expect(onUpdateEvent).toHaveBeenCalledWith(
      "event-1",
      expect.objectContaining({ title: "修改后的日程名称" }),
    );
    expect(onUpdateEvent.mock.calls[0][1]).not.toHaveProperty("isCompleted");
  });

  it("shows the recurrence switch directly and offers compact minute shortcuts", () => {
    const { container } = renderGrid();
    const emptySlot = Array.from(container.querySelectorAll("button")).find(
      (button) => button.getAttribute("aria-label")?.endsWith("新建日程"),
    );
    expect(emptySlot).toBeTruthy();
    fireEvent.click(emptySlot!);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("switch", { name: "\u5faa\u73af\u884c\u7a0b" })).toBeTruthy();
    expect(within(dialog).queryByRole("button", { name: /\u5faa\u73af\u8bbe\u7f6e/ })).toBeNull();
    expect(within(dialog).getByRole("region", { name: "循环行程设置" })).toBeTruthy();
    expect(within(dialog).getByRole("region", { name: "快捷事件" })).toBeTruthy();
    const templateList = within(dialog).getByRole("group", { name: "快捷事件模板列表" });
    expect(templateList.className).toContain("flex-wrap");
    expect(templateList.className).not.toContain("overflow-x-auto");

    const quickPick = dialog.querySelector('[aria-label="开始时间分钟快捷选择"]');
    expect(quickPick).toBeTruthy();
    expect(
      Array.from(quickPick!.querySelectorAll("button")).map((button) => button.textContent),
    ).toEqual(["00", "10", "15", "30", "45", "50"]);
  });

  it("keeps optional details folded and applies quick event templates", () => {
    const longTemplateTitle = "这是一个名称很长但仍然不会撑出新建行程弹窗的快捷事件模板";
    window.localStorage.setItem(
      "schedule-event-templates-v1",
      JSON.stringify([
        {
          id: "custom-reading",
          title: "文献阅读",
          category: "科研",
          tag: "不着急",
          notes: "阅读方法章",
          requirements: ["纸笔"],
        },
        {
          id: "custom-long-title",
          title: longTemplateTitle,
          category: "项目工作",
          tag: null,
          notes: "",
          requirements: [],
        },
      ]),
    );
    const { container } = renderGrid();
    const emptySlot = Array.from(container.querySelectorAll("button")).find(
      (button) => button.getAttribute("aria-label")?.endsWith("新建日程"),
    );
    fireEvent.click(emptySlot!);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByLabelText("备注")).toBeNull();
    expect(within(dialog).getByRole("button", { name: /补充信息/ })).toBeTruthy();
    expect(within(dialog).queryByText("一键填入标题、分类和准备信息")).toBeNull();
    expect(within(dialog).queryByText("备注与所需物品，需要时再展开")).toBeNull();
    const longTemplateButton = within(dialog).getByRole("button", { name: `快捷填写：${longTemplateTitle}` });
    expect(longTemplateButton.className).toContain("max-w-full");
    expect(longTemplateButton.className).toContain("overflow-hidden");
    expect(within(longTemplateButton).getByText(longTemplateTitle).className).toContain("truncate");

    fireEvent.click(within(dialog).getByRole("button", { name: "快捷填写：休息" }));
    expect((within(dialog).getByLabelText("标题") as HTMLInputElement).value).toBe("休息");
    expect(within(dialog).getAllByRole("combobox")[0].textContent).toContain("休息");

    fireEvent.click(within(dialog).getByRole("button", { name: "快捷填写：文献阅读" }));
    expect((within(dialog).getByLabelText("标题") as HTMLInputElement).value).toBe("文献阅读");
    expect(within(dialog).queryByText("已填写备注或准备事项")).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: /补充信息/ }));
    expect((within(dialog).getByLabelText("备注") as HTMLTextAreaElement).value).toBe("阅读方法章");
    expect((within(dialog).getByLabelText("所需物品\/准备事项") as HTMLTextAreaElement).value).toBe("纸笔");

    fireEvent.click(within(dialog).getByRole("button", { name: "添加快捷事件模板" }));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    const templateHeading = screen.getByRole("heading", { name: /行程模板/ });
    const templateDialog = templateHeading.closest('[role="dialog"]') as HTMLElement;
    expect((within(templateDialog).getByLabelText("标题") as HTMLInputElement).value).toBe("");
    expect((within(templateDialog).getByLabelText("标题") as HTMLInputElement).maxLength).toBe(80);
    expect((within(templateDialog).getByLabelText("所需物品\/准备事项") as HTMLTextAreaElement).value).toBe("");

    fireEvent.click(within(templateDialog).getByRole("button", { name: "关闭" }));
    const restoredCreateDialog = screen.getByRole("dialog");
    expect((within(restoredCreateDialog).getByLabelText("标题") as HTMLInputElement).value).toBe("文献阅读");
  });

  it("marquee-selects multiple cards and deletes them together", () => {
    const onDeleteEvent = vi.fn();
    const { container } = renderGrid({
      events: [
        { ...scheduleEvent, id: "event-1", isCompleted: false },
        { ...scheduleEvent, id: "event-2", title: "第二个行程", startHour: 11, endHour: 12, isCompleted: false },
      ],
      onDeleteEvent,
    });
    marqueeSelectAll(container);

    expect(screen.getByText("已选 2 项")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "删除所选" }));
    const confirmDialog = screen.getByRole("dialog");
    fireEvent.click(within(confirmDialog).getByRole("button", { name: "删除所选" }));

    expect(onDeleteEvent).toHaveBeenCalledTimes(2);
    expect(onDeleteEvent).toHaveBeenCalledWith("event-1", { mode: "all" });
    expect(onDeleteEvent).toHaveBeenCalledWith("event-2", { mode: "all" });
  });

  it("clears hidden selections when the visible week changes", () => {
    const { container, rerenderGrid } = renderGrid({
      events: [{ ...scheduleEvent, isCompleted: false }],
    });
    marqueeSelectAll(container);
    expect(screen.getByText("已选 1 项")).toBeTruthy();

    rerenderGrid({
      currentWeekStart: new Date(2026, 7, 3),
      weekRange: "2026/08/03 - 2026/08/09",
    });

    expect(screen.queryByText("已选 1 项")).toBeNull();
    expect(screen.queryByRole("button", { name: "删除所选" })).toBeNull();
  });
});
