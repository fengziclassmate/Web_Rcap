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
  it("edits phase, status and dates directly in table and board without opening details", () => {
    const board = createProjectBoard("research", "直接编辑");
    render(<Workspace initial={[board]} />);
    const title = board.tasks[0].title;
    const phase = screen.getByLabelText(`阶段：${title}`) as HTMLInputElement;
    fireEvent.focus(phase);
    fireEvent.change(phase, { target: { value: "结果验证" } });
    fireEvent.blur(phase);
    fireEvent.change(screen.getByLabelText(`计划日期：${title}`), { target: { value: "2026-10-18" } });
    fireEvent.change(screen.getByLabelText(`截止日期：${title}`), { target: { value: "2026-10-25" } });
    fireEvent.change(screen.getByLabelText(`状态：${title}`), { target: { value: "doing" } });
    fireEvent.click(screen.getByRole("button", { name: "看板" }));
    expect((screen.getByLabelText(`阶段：${title}`) as HTMLInputElement).value).toBe("结果验证");
    expect((screen.getByLabelText(`计划日期：${title}`) as HTMLInputElement).value).toBe("2026-10-18");
    expect((screen.getByLabelText(`截止日期：${title}`) as HTMLInputElement).value).toBe("2026-10-25");
    expect((screen.getByLabelText(`状态：${title}`) as HTMLSelectElement).value).toBe("doing");
    fireEvent.change(screen.getByLabelText(`计划日期：${title}`), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "任务表" }));
    expect((screen.getByLabelText(`计划日期：${title}`) as HTMLInputElement).value).toBe("");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps a phase draft when its field changes remotely and preserves unrelated updates on commit", () => {
    const board = createProjectBoard("research", "并发编辑");
    const title = board.tasks[0].title;
    const onChange = vi.fn();
    const { rerender } = render(<ProjectWorkspace boards={[board]} onChange={onChange} onCopyToToday={vi.fn()} />);
    const phase = screen.getByLabelText(`阶段：${title}`) as HTMLInputElement;
    fireEvent.focus(phase);
    fireEvent.change(phase, { target: { value: "本机阶段" } });
    const incoming = structuredClone(board);
    incoming.tasks[0].phase = "远端阶段";
    incoming.tasks[0].notes = "远端资料";
    rerender(<ProjectWorkspace boards={[incoming]} onChange={onChange} onCopyToToday={vi.fn()} />);
    fireEvent.blur(phase);
    expect(onChange).not.toHaveBeenCalled();
    expect(phase.value).toBe("本机阶段");
    fireEvent.focus(phase);
    fireEvent.blur(phase);
    expect(onChange.mock.calls[0][0]([incoming])[0].tasks[0]).toMatchObject({ phase: "本机阶段", notes: "远端资料" });
  });

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
    fireEvent.click(screen.getByRole("button", { name: "筛选" }));
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

  it("quickly adds a task and shows only filled detail fields", () => {
    const board = createProjectBoard("blank", "城市用地诊断");
    render(<Workspace initial={[board]} />);
    fireEvent.click(within(screen.getByRole("navigation", { name: "项目列表" })).getByRole("button", { name: /城市用地诊断/ }));
    const input = screen.getByRole("textbox", { name: "快速添加任务" });
    fireEvent.change(input, { target: { value: "核对分类口径" } });
    fireEvent.submit(input.closest("form")!);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "展开任务：核对分类口径" }));
    expect(screen.getByRole("button", { name: "添加内容" })).toBeTruthy();
    expect(screen.queryByText("尚未填写内容")).toBeNull();
    expect(screen.queryByText("未拆分")).toBeNull();
  });

  it("starts focus from the project task action", () => {
    const board = createProjectBoard("research", "城市用地诊断");
    const onStartFocus = vi.fn();
    render(<ProjectWorkspace boards={[board]} onChange={vi.fn()} onCopyToToday={vi.fn()} onStartFocus={onStartFocus} />);
    fireEvent.click(screen.getByRole("button", { name: `专注任务：${board.tasks[0].title}` }));
    expect(onStartFocus).toHaveBeenCalledWith(board, board.tasks[0]);
  });

  it("renders raw HTML and unsafe links as text while allowing safe resource links", () => {
    const { container } = render(<AnnotatedContent value={'<img src=x onerror=alert(1)>\n[危险](javascript:alert(1))\n[论文](https://example.com/paper)\n{red}重点{/red}'} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelectorAll("a")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "论文" }).getAttribute("rel")).toContain("noopener");
    expect(screen.getByText("重点").className).toContain("text-red-700");
  });
});
