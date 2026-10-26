import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ScheduleEventContent } from "../schedule-event-content";
import type { ScheduleEvent } from "@/lib/types";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const event: ScheduleEvent = {
  id: "exam", date: "2026-10-26", startHour: 9, endHour: 10,
  title: "2026级研究生新生校纪校规考试", notes: "地点：岳麓山校区科教北楼304\n提前十分钟到场", requirements: ["带学生证"],
  category: "学习", tag: "不可后退", isCompleted: false,
};

function setup(patch: Partial<ScheduleEvent> = {}, durationHour = 1) {
  const onRename = vi.fn();
  const onOpenEdit = vi.fn();
  const props = { event: { ...event, ...patch }, timeLabel: "09:00-10:00", fullTimeLabel: "09:00-10:00", categoryName: "学习", durationHour, dense: false, onRename, onOpenEdit, onToggleSelection: vi.fn() };
  const result = render(<ScheduleEventContent {...props} />);
  return { ...result, onRename, onOpenEdit, onToggleSelection: props.onToggleSelection, rerenderMoving: (moving: boolean) => result.rerender(<ScheduleEventContent {...props} moving={moving} />), rerenderEvent: (patch: Partial<ScheduleEvent>) => result.rerender(<ScheduleEventContent {...props} event={{ ...props.event, ...patch }} />) };
}

describe("schedule card information", () => {
  it("closes the preview during dragging so it cannot cover the drop target", async () => {
    const { rerenderMoving } = setup();
    fireEvent.click(screen.getByRole("button", { name: `查看 ${event.title} 完整信息` }));
    await screen.findByRole("dialog");
    rerenderMoving(true);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("keeps Ctrl-click selection available on the title and time preview control", () => {
    const { onToggleSelection, onOpenEdit } = setup();
    fireEvent.click(screen.getByRole("button", { name: `修改 ${event.title} 标题` }), { ctrlKey: true });
    fireEvent.click(screen.getByRole("button", { name: `查看 ${event.title} 完整信息` }), { metaKey: true });
    expect(onToggleSelection).toHaveBeenCalledTimes(2);
    expect(onOpenEdit).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows notes on one-hour cards and offers the full title, tag and preparation list in the preview", async () => {
    setup();
    expect(screen.getByText(/地点：岳麓山校区科教北楼304/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: `查看 ${event.title} 完整信息` }));
    const preview = await screen.findByRole("dialog");
    expect(preview.textContent).toContain(event.title);
    expect(preview.textContent).toContain("分类：学习");
    expect(preview.textContent).toContain("标记：固定时间");
    expect(preview.textContent).toContain("带学生证");
    expect(preview.textContent).toContain("提前十分钟到场");
  });

  it("keeps full information accessible for a fifteen-minute card", async () => {
    setup({}, 0.25);
    expect(screen.queryByText(/地点：岳麓山校区科教北楼304/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: `查看 ${event.title} 完整信息` }));
    expect((await screen.findByRole("dialog")).textContent).toContain("地点：岳麓山校区科教北楼304");
  });

  it("renames inline with Enter and saves only the title", () => {
    const { onRename, onOpenEdit } = setup();
    fireEvent.click(screen.getByRole("button", { name: `修改 ${event.title} 标题` }));
    const input = screen.getByRole("textbox", { name: `修改标题：${event.title}` });
    fireEvent.change(input, { target: { value: "  校纪校规考试  " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onRename).toHaveBeenCalledExactlyOnceWith("校纪校规考试");
    expect(onOpenEdit).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("cancels with Escape and rejects an empty title", () => {
    const { onRename } = setup();
    fireEvent.click(screen.getByRole("button", { name: `修改 ${event.title} 标题` }));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "取消的修改" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: `修改 ${event.title} 标题` }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "  " } });
    fireEvent.blur(screen.getByRole("textbox"));
    expect(onRename).not.toHaveBeenCalled();
  });

  it("keeps IME Enter in the field and commits on blur", () => {
    const { onRename } = setup();
    fireEvent.click(screen.getByRole("button", { name: `修改 ${event.title} 标题` }));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "研究生考试" } });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(onRename).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(onRename).toHaveBeenCalledExactlyOnceWith("研究生考试");
  });

  it("preserves the draft if the title changes remotely while editing", () => {
    const { onRename, rerenderEvent } = setup();
    fireEvent.click(screen.getByRole("button", { name: `修改 ${event.title} 标题` }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "本机草稿" } });
    rerenderEvent({ title: "远端新标题" });
    fireEvent.blur(screen.getByRole("textbox"));
    expect(onRename).not.toHaveBeenCalled();
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("本机草稿");
  });
});
