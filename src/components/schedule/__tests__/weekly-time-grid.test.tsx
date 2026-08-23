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
  onUpdateEvent = vi.fn<WeeklyTimeGridProps["onUpdateEvent"]>(),
  onDeleteEvent = vi.fn<WeeklyTimeGridProps["onDeleteEvent"]>(),
}: {
  events?: ScheduleEvent[];
  onUpdateEvent?: WeeklyTimeGridProps["onUpdateEvent"];
  onDeleteEvent?: WeeklyTimeGridProps["onDeleteEvent"];
} = {}) {
  const props: WeeklyTimeGridProps = {
    currentWeekStart: new Date(2026, 6, 27),
    weekRange: "2026/07/27 - 2026/08/02",
    events,
    onCreateEvent: vi.fn(),
    onCreateDailyTask: vi.fn(() => null),
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
  it("keeps a simple blank-cell press available for creating an event", () => {
    const { container } = renderGrid();
    const emptySlot = Array.from(container.querySelectorAll("button")).find(
      (button) => !button.textContent?.trim() && !button.getAttribute("aria-label"),
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
      (button) => !button.textContent?.trim() && !button.getAttribute("aria-label"),
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
    expect(shortTitle.className).toContain("text-[10px]");
    expect(longTitle.className).toContain("text-[10px]");
    expect(longTitle.className).not.toContain("text-xs");
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

  it("shows the recurrence switch directly and offers compact minute shortcuts", () => {
    const { container } = renderGrid();
    const emptySlot = Array.from(container.querySelectorAll("button")).find(
      (button) => !button.textContent?.trim() && !button.getAttribute("aria-label"),
    );
    expect(emptySlot).toBeTruthy();
    fireEvent.click(emptySlot!);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("switch", { name: "\u5faa\u73af\u884c\u7a0b" })).toBeTruthy();
    expect(within(dialog).queryByRole("button", { name: /\u5faa\u73af\u8bbe\u7f6e/ })).toBeNull();
    expect(within(dialog).getByRole("region", { name: "循环行程设置" })).toBeTruthy();
    expect(within(dialog).getByRole("region", { name: "快捷事件" })).toBeTruthy();


    const quickPick = dialog.querySelector('[aria-label="开始时间分钟快捷选择"]');
    expect(quickPick).toBeTruthy();
    expect(
      Array.from(quickPick!.querySelectorAll("button")).map((button) => button.textContent),
    ).toEqual(["00", "10", "15", "30", "45", "50"]);
  });

  it("keeps optional details folded and applies quick event templates", () => {
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
      ]),
    );
    const { container } = renderGrid();
    const emptySlot = Array.from(container.querySelectorAll("button")).find(
      (button) => !button.textContent?.trim() && !button.getAttribute("aria-label"),
    );
    fireEvent.click(emptySlot!);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByLabelText("备注")).toBeNull();
    expect(within(dialog).getByRole("button", { name: /补充信息/ })).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("button", { name: "快捷填写：休息" }));
    expect((within(dialog).getByLabelText("标题") as HTMLInputElement).value).toBe("休息");
    expect(within(dialog).getAllByRole("combobox")[0].textContent).toContain("休息");

    fireEvent.click(within(dialog).getByRole("button", { name: "快捷填写：文献阅读" }));
    expect((within(dialog).getByLabelText("标题") as HTMLInputElement).value).toBe("文献阅读");
    fireEvent.click(within(dialog).getByRole("button", { name: /补充信息/ }));
    expect((within(dialog).getByLabelText("备注") as HTMLTextAreaElement).value).toBe("阅读方法章");
    expect((within(dialog).getByLabelText("所需物品\/准备事项") as HTMLTextAreaElement).value).toBe("纸笔");

    fireEvent.click(within(dialog).getByRole("button", { name: "添加快捷事件模板" }));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    const templateHeading = screen.getByRole("heading", { name: /行程模板/ });
    const templateDialog = templateHeading.closest('[role="dialog"]') as HTMLElement;
    expect((within(templateDialog).getByLabelText("标题") as HTMLInputElement).value).toBe("");
    expect((within(templateDialog).getByLabelText("所需物品\/准备事项") as HTMLTextAreaElement).value).toBe("");

    fireEvent.click(within(templateDialog).getByRole("button", { name: "Close" }));
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
