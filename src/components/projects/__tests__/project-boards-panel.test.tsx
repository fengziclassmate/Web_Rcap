import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectBoardsPanel } from "../project-boards-panel";
import { createProjectBoard } from "@/lib/project-boards";

describe("task console project boards", () => {
  it("opens a selected project and keeps archived projects out of the active summary", () => {
    const active = createProjectBoard("research", "城市用地诊断");
    active.tasks[0].status = "done";
    const archived = { ...createProjectBoard("learning", "旧学习计划"), archived: true };
    const onOpen = vi.fn();
    render(<ProjectBoardsPanel boards={[active, archived]} open onOpenChange={vi.fn()} onOpenWorkspace={onOpen} />);
    expect(screen.getByText("1 个项目")).toBeTruthy();
    expect(screen.queryByText("旧学习计划")).toBeNull();
    expect(screen.getByText("1/4")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /城市用地诊断/ }));
    expect(onOpen).toHaveBeenCalledWith(active.id);
  });

  it("keeps the workspace entry accessible while the module is collapsed", () => {
    const onOpen = vi.fn();
    const onOpenChange = vi.fn();
    render(<ProjectBoardsPanel boards={[]} open={false} onOpenChange={onOpenChange} onOpenWorkspace={onOpen} />);
    expect(screen.queryByRole("button", { name: "创建第一个项目" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "打开科研与自学任务表" }));
    expect(onOpen).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "展开科研与自学" }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });
});
