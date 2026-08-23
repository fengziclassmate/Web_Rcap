import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MonitoringSidebar } from "../sidebar";

describe("MonitoringSidebar", () => {
  it("only exposes the maintained schedule and log modules", () => {
    const onChange = vi.fn();
    render(<MonitoringSidebar active="schedule" onChange={onChange} />);

    expect(screen.queryByRole("button", { name: /执行连续性/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /人情往来/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /科研项目/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /论文进度/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /文献阅读/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /投稿记录/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /组会记录/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /动态日志/ }));
    expect(onChange).toHaveBeenCalledWith("logs");
  });
});
