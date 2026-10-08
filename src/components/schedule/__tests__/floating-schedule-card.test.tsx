import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FloatingScheduleCard } from "@/components/schedule/floating-schedule-card";
import { defaultDashboardUiPreferences, normalizeEvents, normalizeTasks } from "@/lib/normalizers";

const events = normalizeEvents([{ id: "meeting", date: "2026-10-08", title: "讨论方案", startHour: 10, endHour: 11 }]);
const tasks = normalizeTasks([
  { id: "daily", name: "核对实验数据", dueDate: "2026-10-08", taskType: "daily" },
  { id: "focus", name: "撰写论文", dueDate: "2026-10-15", taskType: "long", isTodayFocus: true },
  { id: "future", name: "明天再做", dueDate: "2026-10-09", taskType: "daily" },
  { id: "done", name: "已经完成", dueDate: "2026-10-08", taskType: "daily", done: true },
]);

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 8, 9));
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0));
  vi.stubGlobal("cancelAnimationFrame", window.clearTimeout);
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function mount() {
  const callbacks = { onOpenEvent: vi.fn(), onOpenTask: vi.fn(), onToggleTask: vi.fn() };
  const result = render(<FloatingScheduleCard userId="account-a" events={events} tasks={tasks} preferences={defaultDashboardUiPreferences} {...callbacks} />);
  return { ...result, ...callbacks };
}

describe("floating schedule window", () => {
  it("uses the visible viewport when the desktop page overflows a phone screen", async () => {
    vi.stubGlobal("innerWidth", 1180);
    vi.stubGlobal("innerHeight", 2554);
    vi.stubGlobal("visualViewport", Object.assign(new EventTarget(), { width: 390, height: 844, offsetLeft: 0, offsetTop: 0 }));
    mount();
    const panel = await screen.findByRole("complementary", { name: "日程悬浮窗口" });
    expect(panel.style.left).toBe("54px");
    expect(panel.style.top).toBe("464px");
  });
  it("offers useful empty states in every view", async () => {
    render(<FloatingScheduleCard userId="account-a" events={[]} tasks={[]} preferences={defaultDashboardUiPreferences} onOpenEvent={vi.fn()} onOpenTask={vi.fn()} onToggleTask={vi.fn()} />);
    const panel = within(await screen.findByRole("complementary", { name: "日程悬浮窗口" }));
    expect(panel.getByText("接下来没有待进行的日程")).toBeTruthy();
    fireEvent.click(panel.getByRole("button", { name: "今日日程" }));
    expect(panel.getByText("今天还没有安排")).toBeTruthy();
    fireEvent.click(panel.getByRole("button", { name: "今日待办" }));
    expect(panel.getByText("今天的待办已清空")).toBeTruthy();
  });
  it("opens the upcoming event and can switch to the full day agenda", async () => {
    const { onOpenEvent } = mount();
    const panel = within(await screen.findByRole("complementary", { name: "日程悬浮窗口" }));
    expect(panel.getByText("1 小时")).toBeTruthy();
    fireEvent.click(panel.getByRole("button", { name: "查看日程" }));
    expect(onOpenEvent).toHaveBeenCalledWith(events[0]);
    fireEvent.click(panel.getByRole("button", { name: "今日日程" }));
    expect(panel.getByText("1 项日程")).toBeTruthy();
    fireEvent.click(panel.getByRole("button", { name: /讨论方案/ }));
    expect(onOpenEvent).toHaveBeenCalledTimes(2);
  });
  it("shows today's focus and due daily tasks and delegates completion and editing", async () => {
    const { onToggleTask, onOpenTask } = mount();
    const panel = within(await screen.findByRole("complementary", { name: "日程悬浮窗口" }));
    fireEvent.click(panel.getByRole("button", { name: "今日待办" }));
    expect(panel.getByText("核对实验数据")).toBeTruthy();
    expect(panel.getByText("撰写论文")).toBeTruthy();
    expect(panel.queryByText("明天再做")).toBeNull();
    expect(panel.queryByText("已经完成")).toBeNull();
    fireEvent.click(panel.getByRole("checkbox", { name: "完成待办：核对实验数据" }));
    expect(onToggleTask).toHaveBeenCalledWith("daily");
    fireEvent.click(panel.getByRole("button", { name: /撰写论文/ }));
    expect(onOpenTask).toHaveBeenCalledWith(tasks[1]);
  });
  it("remembers the chosen view and allows hiding and restoring the window", async () => {
    mount();
    const panel = within(await screen.findByRole("complementary", { name: "日程悬浮窗口" }));
    fireEvent.click(panel.getByRole("button", { name: "今日待办" }));
    fireEvent.click(panel.getByRole("button", { name: "收起悬浮窗口" }));
    expect(panel.queryByRole("group", { name: "悬浮窗口展示内容" })).toBeNull();
    fireEvent.click(panel.getByRole("button", { name: "隐藏悬浮窗口" }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem("schedule-floating-card:account-a")!)).toMatchObject({ view: "tasks", collapsed: true, hidden: true }));
    expect(localStorage.getItem("schedule-floating-card:account-b")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "显示悬浮窗口" }));
    expect(screen.getByRole("button", { name: "展开悬浮窗口" })).toBeTruthy();
  });
  it("restores a previously hidden window with its saved content and position", async () => {
    localStorage.setItem("schedule-floating-card:account-a", JSON.stringify({ view: "agenda", hidden: true, collapsed: false, x: 200, y: 300 }));
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "显示悬浮窗口" }));
    const panel = screen.getByRole("complementary", { name: "日程悬浮窗口" });
    expect(panel.style.left).toBe("200px");
    expect(within(panel).getByRole("button", { name: "今日日程" }).getAttribute("aria-pressed")).toBe("true");
  });
});
