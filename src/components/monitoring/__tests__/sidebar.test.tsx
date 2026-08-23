import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MonitoringSidebar } from "../sidebar";

describe("MonitoringSidebar", () => {
  it("does not expose retired continuity or relationship modules", () => {
    const onChange = vi.fn();
    render(<MonitoringSidebar active="schedule" onChange={onChange} />);

    expect(screen.queryByRole("button", { name: /执行连续性/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /人情往来/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /动态日志/ }));
    expect(onChange).toHaveBeenCalledWith("logs");
  });
});
