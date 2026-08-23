import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { LogPostRecord } from "@/lib/logs";
import { DailyReflectionPanel } from "../daily-reflection-panel";

const days = [
  { date: "2026-08-24", weekday: "周一", shortDate: "8/24", isToday: true },
  { date: "2026-08-25", weekday: "周二", shortDate: "8/25", isToday: false },
  { date: "2026-08-26", weekday: "周三", shortDate: "8/26", isToday: false },
  { date: "2026-08-27", weekday: "周四", shortDate: "8/27", isToday: false },
  { date: "2026-08-28", weekday: "周五", shortDate: "8/28", isToday: false },
  { date: "2026-08-29", weekday: "周六", shortDate: "8/29", isToday: false },
  { date: "2026-08-30", weekday: "周日", shortDate: "8/30", isToday: false },
];

function createPost(overrides: Partial<LogPostRecord> = {}): LogPostRecord {
  const timestamp = new Date("2026-08-24T12:00:00").toISOString();
  return {
    id: "log-1",
    userId: "user-1",
    content: "周一完成实验复盘。",
    category: "mood",
    mood: "calm",
    location: "",
    visibility: "private",
    isPinned: false,
    isArchived: false,
    sourceType: "manual",
    sourceId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    images: [],
    tags: [],
    links: [],
    ...overrides,
  };
}

describe("DailyReflectionPanel", () => {
  it("shows each day in a weekly grid and displays recorded content", () => {
    render(
      <DailyReflectionPanel
        days={days}
        posts={[
          createPost(),
          createPost({ id: "archived-log", content: "已归档记录", isArchived: true }),
        ]}
        onCreatePost={vi.fn(async () => true)}
        onOpenLogs={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "本周日志" })).toBeTruthy();
    expect(screen.getByText("已记录 1/7 天")).toBeTruthy();
    expect(screen.getByText("周一完成实验复盘。")).toBeTruthy();
    expect(screen.queryByText("已归档记录")).toBeNull();
    expect(screen.getByRole("button", { name: "2026-08-24 日志：已记录 1 条" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "2026-08-30 日志：尚未记录" })).toBeTruthy();
  });

  it("uses the full row for a single-day view", () => {
    render(
      <DailyReflectionPanel
        days={[days[0]]}
        posts={[]}
        onCreatePost={vi.fn(async () => true)}
        onOpenLogs={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "当日日志" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "选择日志日期" }).className).toContain("grid-cols-1");
  });

  it("writes a journal entry for the selected day into the dynamic log source", async () => {
    const onCreatePost = vi.fn(async () => true);
    const onOpenLogs = vi.fn();
    render(
      <DailyReflectionPanel
        days={days}
        posts={[]}
        onCreatePost={onCreatePost}
        onOpenLogs={onOpenLogs}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "2026-08-25 日志：尚未记录" }));
    fireEvent.click(screen.getByRole("button", { name: "心情：平静" }));
    fireEvent.change(screen.getByLabelText("2026-08-25 日志内容"), {
      target: { value: "今天的实验进展很稳。" },
    });
    fireEvent.click(screen.getByRole("button", { name: "记入动态" }));

    await waitFor(() => {
      expect(onCreatePost).toHaveBeenCalledWith({
        content: "今天的实验进展很稳。",
        category: "mood",
        mood: "calm",
        recordDate: "2026-08-25",
        location: "",
        tagNames: ["每日记录"],
        images: [],
        links: [],
      });
    });

    fireEvent.click(screen.getByRole("button", { name: /打开动态日志/ }));
    expect(onOpenLogs).toHaveBeenCalledTimes(1);
  });

  it("locks the selected day and draft while a save is in progress", async () => {
    let finishSave: ((saved: boolean) => void) | undefined;
    const onCreatePost = vi.fn(() => new Promise<boolean>((resolve) => {
      finishSave = resolve;
    }));
    render(
      <DailyReflectionPanel
        days={days}
        posts={[]}
        onCreatePost={onCreatePost}
        onOpenLogs={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("2026-08-24 日志内容"), {
      target: { value: "保存中的草稿" },
    });
    fireEvent.click(screen.getByRole("button", { name: "记入动态" }));

    await waitFor(() => {
      expect((screen.getByRole("button", { name: "2026-08-25 日志：尚未记录" }) as HTMLButtonElement).disabled).toBe(true);
      expect((screen.getByLabelText("2026-08-24 日志内容") as HTMLInputElement).disabled).toBe(true);
    });

    finishSave?.(true);
    await waitFor(() => {
      expect((screen.getByRole("button", { name: "2026-08-25 日志：尚未记录" }) as HTMLButtonElement).disabled).toBe(false);
    });
  });
});
