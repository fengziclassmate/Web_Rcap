import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuickEventInput } from "../quick-event-input";

const sendMessage = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useLLMChat", () => ({ useLLMChat: () => ({ loading: false, error: null, sendMessage }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

beforeEach(() => sendMessage.mockReset());

describe("quick event input", () => {
  it("opens the input on demand and keeps its draft when dismissed", async () => {
    render(<QuickEventInput onCreateEvent={vi.fn()} onAddTask={vi.fn()} onAddAnnualTask={vi.fn()} />);
    expect(screen.queryByRole("textbox", { name: "智能快速创建输入" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "智能识别" }));
    const input = await screen.findByRole("textbox", { name: "智能快速创建输入" });
    fireEvent.change(input, { target: { value: "明天下午开会" } });
    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("textbox", { name: "智能快速创建输入" })).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "智能识别" }));
    expect((await screen.findByRole("textbox", { name: "智能快速创建输入" }) as HTMLInputElement).value).toBe("明天下午开会");
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("keeps recognition, confirmation and creation working from the collapsed input", async () => {
    sendMessage.mockResolvedValue(JSON.stringify({ type: "task", title: "核对文献", dueDate: "2026-10-30", notes: "" }));
    const onAddTask = vi.fn();
    render(<QuickEventInput onCreateEvent={vi.fn()} onAddTask={onAddTask} onAddAnnualTask={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "智能识别" }));
    fireEvent.change(await screen.findByRole("textbox", { name: "智能快速创建输入" }), { target: { value: "明天之前核对文献" } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "识别" }));
    const confirmation = await screen.findByRole("dialog", { name: "确认创建内容" });
    fireEvent.click(within(confirmation).getByRole("button", { name: "确认创建" }));
    expect(onAddTask).toHaveBeenCalledExactlyOnceWith("核对文献", "2026-10-30");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "智能识别" }));
    expect((await screen.findByRole("textbox", { name: "智能快速创建输入" }) as HTMLInputElement).value).toBe("");
  });
});
