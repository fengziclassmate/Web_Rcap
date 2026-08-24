import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MonitoringSidebar } from "../sidebar";

describe("MonitoringSidebar", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("only exposes the maintained schedule and log modules", () => {
    const onChange = vi.fn();
    const { container } = render(<MonitoringSidebar active="schedule" onChange={onChange} />);

    expect(screen.queryByRole("button", { name: /执行连续性/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /人情往来/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /科研项目/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /论文进度/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /文献阅读/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /投稿记录/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /组会记录/ })).toBeNull();
    expect(container.querySelector(".nav-orb")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /动态日志/ }));
    expect(onChange).toHaveBeenCalledWith("logs");
  });

  it("restores and saves the centered reminder", async () => {
    window.localStorage.setItem("workbench-motivation-message-v1", "先完成今天最重要的一件事");
    render(<MonitoringSidebar active="schedule" onChange={vi.fn()} />);

    const reminder = await screen.findByLabelText("工作台提醒") as HTMLInputElement;
    await waitFor(() => expect(reminder.value).toBe("先完成今天最重要的一件事"));

    fireEvent.change(reminder, { target: { value: "完成实验后及时复盘" } });
    expect(window.localStorage.getItem("workbench-motivation-message-v1")).toBe("完成实验后及时复盘");
  });
});
