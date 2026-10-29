import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ScheduleEventContent } from "../schedule-event-content";
import type { ScheduleEvent } from "@/lib/types";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

let onResize: ResizeObserverCallback;
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: ResizeObserverCallback) { onResize = callback; }
    observe() {}
    disconnect() {}
  });
});

const event: ScheduleEvent = {
  id: "exam", date: "2026-10-26", startHour: 9, endHour: 10,
  title: "2026级研究生新生校纪校规考试", notes: "地点：岳麓山校区科教北楼304\n提前十分钟到场", requirements: ["带学生证"],
  category: "学习", tag: "不可后退", isCompleted: false,
};

function setup(patch: Partial<ScheduleEvent> = {}, durationHour = 1, dense = false) {
  const onRename = vi.fn();
  const onOpenEdit = vi.fn();
  const timeLabel = durationHour === 0.25 ? "09:00-09:15" : durationHour === 0.5 ? "09:00-09:30" : "09:00-10:00";
  const props = { event: { ...event, ...patch }, timeLabel, fullTimeLabel: timeLabel, categoryName: "学习", durationHour, dense, onRename, onNotesChange: vi.fn(), onOpenEdit, onToggleSelection: vi.fn(), onEditingChange: vi.fn() };
  const result = render(<ScheduleEventContent {...props} />);
  return { ...result, onRename, onNotesChange: props.onNotesChange, onOpenEdit, onToggleSelection: props.onToggleSelection, rerenderMoving: (moving: boolean) => result.rerender(<ScheduleEventContent {...props} moving={moving} />), rerenderEvent: (patch: Partial<ScheduleEvent>) => result.rerender(<ScheduleEventContent {...props} event={{ ...props.event, ...patch }} />) };
}

describe("schedule card information", () => {
  it("uses the available notes height and updates the line limit when the card resizes", () => {
    setup({ notes: "第一项\n第二项\n第三项\n第四项\n第五项" }, 3);
    const notes = screen.getByRole("button", { name: `编辑 ${event.title} 补充信息` });
    notes.style.lineHeight = "16px";
    const space = notes.parentElement!;
    onResize([{ contentRect: { height: 95 } } as ResizeObserverEntry], {} as ResizeObserver);
    expect(space.style.getPropertyValue("--schedule-notes-lines")).toBe("5");
    onResize([{ contentRect: { height: 48 } } as ResizeObserverEntry], {} as ResizeObserver);
    expect(space.style.getPropertyValue("--schedule-notes-lines")).toBe("3");
  });

  it.each([0.25, 0.5, 1])("shows the complete time range on an overlapping %s-hour card", (duration) => {
    setup({}, duration, true);
    expect(screen.getByRole("button", { name: `查看 ${event.title} 完整信息` }).textContent).toBe(duration === 0.25 ? "09:00-09:15" : duration === 0.5 ? "09:00-09:30" : "09:00-10:00");
  });

  it("edits multiline notes inline, keeps Enter for newlines and saves with Ctrl+Enter", () => {
    const { onNotesChange, onRename } = setup();
    fireEvent.click(screen.getByRole("button", { name: `编辑 ${event.title} 补充信息` }));
    const input = screen.getByRole("textbox", { name: `修改补充信息：${event.title}` });
    fireEvent.change(input, { target: { value: "地点：科教北楼305\n带学生证" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onNotesChange).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });
    expect(onNotesChange).toHaveBeenCalledExactlyOnceWith("地点：科教北楼305\n带学生证");
    expect(onRename).not.toHaveBeenCalled();
  });

  it("cancels notes edits and allows notes to be cleared", () => {
    const { onNotesChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: `编辑 ${event.title} 补充信息` }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "取消的备注" } });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    expect(onNotesChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: `编辑 ${event.title} 补充信息` }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "" } });
    fireEvent.blur(screen.getByRole("textbox"));
    expect(onNotesChange).toHaveBeenCalledExactlyOnceWith("");
  });

  it("adds notes directly to an empty card", () => {
    const { onNotesChange } = setup({ notes: "" });
    fireEvent.click(screen.getByRole("button", { name: `编辑 ${event.title} 补充信息` }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "地点：北楼304" } });
    fireEvent.blur(screen.getByRole("textbox"));
    expect(onNotesChange).toHaveBeenCalledExactlyOnceWith("地点：北楼304");
  });

  it("opens the on-card notes editor from a short card preview without stealing focus", async () => {
    setup({}, 0.25);
    fireEvent.click(screen.getByRole("button", { name: `查看 ${event.title} 完整信息` }));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: `在卡片上编辑 ${event.title} 补充信息` }));
    const input = await screen.findByRole("textbox", { name: `修改补充信息：${event.title}` });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(input);
  });

  it("retains a notes draft when the same field changes remotely", () => {
    const { onNotesChange, rerenderEvent } = setup();
    fireEvent.click(screen.getByRole("button", { name: `编辑 ${event.title} 补充信息` }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "本机地址" } });
    rerenderEvent({ notes: "远端地址" });
    fireEvent.blur(screen.getByRole("textbox"));
    expect(onNotesChange).not.toHaveBeenCalled();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("本机地址");
  });

  it.each([0.25, 0.5])("keeps the full time range visible on a %s-hour card", (duration) => {
    setup({}, duration);
    expect(screen.getByRole("button", { name: `查看 ${event.title} 完整信息` }).textContent).toBe(duration === 0.25 ? "09:00-09:15" : "09:00-09:30");
  });

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
