import { useState } from "react";
import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectWorkspace } from "../project-workspace";
import { AnnotatedContent, AnnotatedEditor } from "../annotated-content";
import { createProjectBoard, type ProjectBoard } from "@/lib/project-boards";

function Workspace({ initial = [] }: { initial?: ProjectBoard[] }) {
  const [boards, setBoards] = useState(initial);
  return <ProjectWorkspace boards={boards} onChange={setBoards} onCopyToToday={vi.fn()} />;
}

describe("research and learning workspace", () => {
  it("saves only edited fields when another device updates a different field", () => {
    const board = createProjectBoard("research", "并发项目");
    const onChange = vi.fn();
    const { rerender } = render(<ProjectWorkspace boards={[board]} onChange={onChange} onCopyToToday={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: board.tasks[0].title }));
    fireEvent.change(screen.getByLabelText("任务名称"), { target: { value: "本机改名" } });
    const incoming = structuredClone(board);
    incoming.tasks[0].notes = "另一台电脑补充的资料";
    rerender(<ProjectWorkspace boards={[incoming]} onChange={onChange} onCopyToToday={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "保存任务" }));
    const saved = onChange.mock.calls[0][0]([incoming]);
    expect(saved[0].tasks[0]).toMatchObject({ title: "本机改名", notes: "另一台电脑补充的资料" });
  });

  it("does not overwrite the same field changed remotely while a task editor is open", () => {
    const board = createProjectBoard("research", "并发项目");
    const onChange = vi.fn();
    const { rerender } = render(<ProjectWorkspace boards={[board]} onChange={onChange} onCopyToToday={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: board.tasks[0].title }));
    fireEvent.change(screen.getByLabelText("任务名称"), { target: { value: "本机改名" } });
    const incoming = structuredClone(board);
    incoming.tasks[0].title = "另一台电脑的名字";
    rerender(<ProjectWorkspace boards={[incoming]} onChange={onChange} onCopyToToday={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "保存任务" }));
    expect(onChange).not.toHaveBeenCalled();
    expect((screen.getByLabelText("任务名称") as HTMLInputElement).value).toBe("本机改名");
  });

  it("creates a learning template, edits a task and checks its annotated subtask", async () => {
    render(<Workspace />);
    fireEvent.click(screen.getByRole("button", { name: /自学计划/ }));
    fireEvent.change(screen.getByLabelText("项目名称"), { target: { value: "LeetCode" } });
    fireEvent.click(screen.getByRole("button", { name: "创建项目" }));
    await screen.findByRole("heading", { name: "LeetCode" });
    fireEvent.click(screen.getByRole("button", { name: "明确学习目标与检验方式" }));
    fireEvent.change(screen.getByRole("textbox", { name: "任务内容" }), { target: { value: "- [ ] ==分析复杂度==\n- [ ] 独立实现" } });
    fireEvent.click(screen.getByRole("button", { name: "保存任务" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "展开任务：明确学习目标与检验方式" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "子任务：==分析复杂度==" }));
    expect((screen.getByRole("checkbox", { name: "子任务：==分析复杂度==" }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText("1/2")).toBeTruthy();
    expect(screen.getByText("分析复杂度").tagName).toBe("MARK");
    fireEvent.click(screen.getByRole("button", { name: "明确学习目标与检验方式" }));
    expect((screen.getByRole("textbox", { name: "任务内容" }) as HTMLTextAreaElement).value).toContain("- [x] ==分析复杂度==");
  });

  it("filters by status and archives projects without removing their tasks", async () => {
    const board = createProjectBoard("research", "城市用地诊断");
    board.tasks[0].status = "blocked";
    render(<Workspace initial={[board]} />);
    fireEvent.change(screen.getByLabelText("筛选任务状态"), { target: { value: "blocked" } });
    expect(screen.getByRole("button", { name: board.tasks[0].title })).toBeTruthy();
    expect(screen.queryByRole("button", { name: board.tasks[1].title })).toBeNull();
    fireEvent.click(within(screen.getByRole("navigation", { name: "项目列表" })).getByRole("button", { name: /城市用地诊断/ }));
    fireEvent.click(screen.getByRole("button", { name: "归档项目" }));
    fireEvent.click(within(screen.getByRole("navigation", { name: "项目列表" })).getByRole("button", { name: /城市用地诊断/ }));
    expect(screen.getByRole("button", { name: board.tasks[1].title })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "恢复项目" }));
    expect(screen.getByRole("button", { name: board.tasks[1].title })).toBeTruthy();
  });

  it("wraps a selected text fragment without changing its surrounding content", async () => {
    function Editor() { const [value, setValue] = useState("先分析，再实现"); return <AnnotatedEditor label="内容" value={value} onChange={setValue} />; }
    render(<Editor />);
    const input = screen.getByLabelText("内容") as HTMLTextAreaElement;
    input.setSelectionRange(1, 3);
    fireEvent.click(screen.getByRole("button", { name: "高亮" }));
    expect(input.value).toBe("先==分析==，再实现");
    await waitFor(() => expect(input.selectionStart).toBe(3));
    expect(screen.getByText("分析").tagName).toBe("MARK");
  });

  it("renders raw HTML and unsafe links as text while allowing safe resource links", () => {
    const { container } = render(<AnnotatedContent value={'<img src=x onerror=alert(1)>\n[危险](javascript:alert(1))\n[论文](https://example.com/paper)\n{red}重点{/red}'} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelectorAll("a")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "论文" }).getAttribute("rel")).toContain("noopener");
    expect(screen.getByText("重点").className).toContain("text-red-700");
  });
});
