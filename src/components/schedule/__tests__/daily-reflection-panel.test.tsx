import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DailyReflectionPanel } from "../daily-reflection-panel";

vi.mock("sonner", () => ({
  toast: { success: vi.fn() },
}));

describe("DailyReflectionPanel", () => {
  it("writes mood and journal content into the dynamic log source", async () => {
    const onCreatePost = vi.fn(async () => true);
    const onOpenLogs = vi.fn();
    render(
      <DailyReflectionPanel
        date="2026-08-24"
        onCreatePost={onCreatePost}
        onOpenLogs={onOpenLogs}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "心情：平静" }));
    fireEvent.change(screen.getByLabelText("今日日志"), { target: { value: "今天的实验进展很稳。" } });
    fireEvent.click(screen.getByRole("button", { name: "记入动态" }));

    await waitFor(() => {
      expect(onCreatePost).toHaveBeenCalledWith({
        content: "今天的实验进展很稳。",
        category: "mood",
        mood: "calm",
        location: "",
        tagNames: ["每日记录"],
        images: [],
        links: [],
      });
    });

    fireEvent.click(screen.getByRole("button", { name: /打开动态日志/ }));
    expect(onOpenLogs).toHaveBeenCalledTimes(1);
  });
});
