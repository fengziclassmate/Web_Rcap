import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ExecutionContinuityPanel } from "@/components/continuity/execution-continuity-panel";
import { defaultExecutionContinuityState, type ExecutionContinuityState } from "@/lib/execution-continuity";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function Harness() {
  const [value, setValue] = useState<ExecutionContinuityState>(defaultExecutionContinuityState);
  return (
    <ExecutionContinuityPanel
      value={value}
      onChange={setValue}
      projects={[{ id: "project-1", title: "空间分析" }]}
      tasks={[]}
      events={[]}
    />
  );
}

describe("ExecutionContinuityPanel", () => {
  it("switches continuity views and opens the matching editor", () => {
    render(<Harness />);

    expect(screen.getByRole("heading", { name: "科研执行连续性" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "科研债务" }));
    expect(screen.getByText("还没有科研债务")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "新建科研债务" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "登记科研债务" })).toBeTruthy();
  });

  it("generates a confirmable resume draft from project momentum", () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "项目动量" }));
    expect(screen.getByText("空间分析")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "根据当前状态生成恢复包草稿" }));

    expect(screen.getByRole("heading", { name: "创建科研恢复包" })).toBeTruthy();
    expect(screen.getByDisplayValue("空间分析 · 恢复点")).toBeTruthy();
  });
});
