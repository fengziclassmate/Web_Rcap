import { useState } from "react";
import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectWorkspace } from "../project-workspace";
import { AnnotatedContent, AnnotatedEditor } from "../annotated-content";
import { InlineProjectText } from "../subtask-table";
import { createBoardSubtask, createProjectBoard, type ProjectBoard } from "@/lib/project-boards";

function Workspace({ initial = [] }: { initial?: ProjectBoard[] }) {
  const [boards, setBoards] = useState(initial);
  return <ProjectWorkspace boards={boards} onChange={setBoards} onCopyToToday={vi.fn()} />;
}

describe("research and learning workspace", () => {
  it("edits subtask priority and dates inline, clears a date and retains fields while reordering", () => {
    const board = createProjectBoard("research", "子任务日期");
    const task = board.tasks[0];
    const child = task.subtasks[0];
    const { container } = render(<Workspace initial={[board]} />);
    fireEvent.click(screen.getByRole("button", { name: `展开任务：${task.title}` }));
    fireEvent.change(screen.getByLabelText(`子任务优先级：${child.title}`), { target: { value: "p1" } });
    fireEvent.change(screen.getByLabelText(`子任务计划日期：${child.title}`), { target: { value: "2026-10-18" } });
    fireEvent.change(screen.getByLabelText(`子任务截止日期：${child.title}`), { target: { value: "2026-10-25" } });
    fireEvent.keyDown(screen.getByRole("button", { name: `移动子任务：${child.title}` }), { key: "ArrowDown" });
    expect(Array.from(container.querySelectorAll("[data-subtask-id]")).map((row) => row.getAttribute("data-subtask-id"))).toEqual(task.subtasks.map((item) => item.id).reverse());
    expect((screen.getByLabelText(`子任务优先级：${child.title}`) as HTMLSelectElement).value).toBe("p1");
    expect((screen.getByLabelText(`子任务计划日期：${child.title}`) as HTMLInputElement).value).toBe("2026-10-18");
    expect((screen.getByLabelText(`子任务截止日期：${child.title}`) as HTMLInputElement).value).toBe("2026-10-25");
    fireEvent.change(screen.getByLabelText(`子任务计划日期：${child.title}`), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: `收起任务：${task.title}` }));
    fireEvent.click(screen.getByRole("button", { name: `展开任务：${task.title}` }));
    expect((screen.getByLabelText(`子任务计划日期：${child.title}`) as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText(`子任务截止日期：${child.title}`) as HTMLInputElement).value).toBe("2026-10-25");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("saves subtask priority and dates from task details", async () => {
    const board = createProjectBoard("learning", "详情规划");
    const task = board.tasks[0];
    const title = task.subtasks[0].title;
    render(<Workspace initial={[board]} />);
    fireEvent.click(screen.getByRole("button", { name: task.title }));
    const editor = within(screen.getByRole("dialog"));
    fireEvent.change(editor.getByLabelText(`子任务优先级：${title}`), { target: { value: "p3" } });
    fireEvent.change(editor.getByLabelText(`子任务计划日期：${title}`), { target: { value: "2026-10-19" } });
    fireEvent.change(editor.getByLabelText(`子任务截止日期：${title}`), { target: { value: "2026-10-26" } });
    fireEvent.click(editor.getByRole("button", { name: "保存任务" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: `展开任务：${task.title}` }));
    expect((screen.getByLabelText(`子任务优先级：${title}`) as HTMLSelectElement).value).toBe("p3");
    expect((screen.getByLabelText(`子任务计划日期：${title}`) as HTMLInputElement).value).toBe("2026-10-19");
    expect((screen.getByLabelText(`子任务截止日期：${title}`) as HTMLInputElement).value).toBe("2026-10-26");
  });

  it("drags tasks from priority view into manual order and keeps that order when switching views", () => {
    const board = createProjectBoard("research", "手动排序");
    board.tasks.forEach((task, index) => { task.priority = (["p3", "p1", "p2", "p4"] as const)[index]; });
    const { container } = render(<Workspace initial={[board]} />);
    const order = () => Array.from(container.querySelectorAll(".project-content-scroll [data-task-order-id]")).map((row) => row.getAttribute("data-task-order-id"));
    expect((screen.getByLabelText("任务排序") as HTMLSelectElement).value).toBe("manual");
    fireEvent.change(screen.getByLabelText("任务排序"), { target: { value: "priority" } });
    expect(order()).toEqual([1, 2, 0, 3].map((index) => board.tasks[index].id));
    const dataTransfer = { setData: vi.fn(), effectAllowed: "move", dropEffect: "move" };
    fireEvent.dragStart(screen.getByRole("button", { name: `移动任务：${board.tasks[3].title}` }), { dataTransfer });
    const target = container.querySelector(`[data-task-order-id="${board.tasks[2].id}"]`)!;
    fireEvent.dragOver(target, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });
    const expected = [1, 3, 2, 0].map((index) => board.tasks[index].id);
    expect((screen.getByLabelText("任务排序") as HTMLSelectElement).value).toBe("manual");
    expect(order()).toEqual(expected);
    fireEvent.change(screen.getByLabelText("任务排序"), { target: { value: "due" } });
    fireEvent.change(screen.getByLabelText("任务排序"), { target: { value: "manual" } });
    expect(order()).toEqual(expected);
    fireEvent.click(screen.getByRole("button", { name: "看板" }));
    expect(order()).toEqual(expected);
  });

  it("keeps hidden tasks in place and prevents dropping tasks into another project", () => {
    const first = createProjectBoard("research", "科研一");
    const second = createProjectBoard("research", "科研二");
    second.tasks[0].title = "另一个项目的任务";
    first.tasks[0].phase = first.tasks[2].phase = "显示阶段";
    const { container } = render(<Workspace initial={[first, second]} />);
    const dataTransfer = { setData: vi.fn(), effectAllowed: "move", dropEffect: "move" };
    const rows = () => Array.from(container.querySelectorAll(".project-task-table > tbody > tr[data-task-order-id]"));
    fireEvent.dragStart(screen.getAllByRole("button", { name: `移动任务：${first.tasks[0].title}` })[0], { dataTransfer });
    fireEvent.drop(rows().find((row) => row.getAttribute("data-task-order-id") === second.tasks[0].id)!, { dataTransfer });
    expect(rows().map((row) => row.getAttribute("data-task-order-id"))).toEqual([...first.tasks, ...second.tasks].map((task) => task.id));
    fireEvent.click(screen.getByRole("button", { name: "筛选" }));
    fireEvent.change(screen.getByLabelText("筛选任务阶段"), { target: { value: "显示阶段" } });
    fireEvent.dragStart(screen.getByRole("button", { name: `移动任务：${first.tasks[2].title}` }), { dataTransfer });
    fireEvent.drop(rows()[0], { dataTransfer });
    fireEvent.change(screen.getByLabelText("筛选任务阶段"), { target: { value: "all" } });
    expect(rows().slice(0, 4).map((row) => row.getAttribute("data-task-order-id"))).toEqual([2, 1, 0, 3].map((index) => first.tasks[index].id));
  });

  it("drags and keyboard-sorts subtasks independently without changing notes or parent order", () => {
    const board = createProjectBoard("research", "子任务排序");
    const task = board.tasks[0];
    task.subtasks.push(createBoardSubtask("第三个子任务"));
    task.subtasks[0].notes = "保留备注";
    task.subtasks[0].status = "done";
    const { container } = render(<Workspace initial={[board]} />);
    fireEvent.click(screen.getByRole("button", { name: `展开任务：${task.title}` }));
    const table = screen.getByRole("table", { name: `${task.title}的子任务表` });
    const order = () => Array.from(table.querySelectorAll("[data-subtask-id]")).map((row) => row.getAttribute("data-subtask-id"));
    const dataTransfer = { setData: vi.fn(), effectAllowed: "move", dropEffect: "move" };
    fireEvent.dragStart(screen.getByRole("button", { name: "移动子任务：第三个子任务" }), { dataTransfer });
    const target = table.querySelectorAll("[data-subtask-id]")[0];
    fireEvent.dragOver(target, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });
    expect(order()).toEqual([2, 0, 1].map((index) => task.subtasks[index].id));
    fireEvent.keyDown(screen.getByRole("button", { name: "移动子任务：第三个子任务" }), { key: "ArrowDown" });
    expect(order()).toEqual([0, 2, 1].map((index) => task.subtasks[index].id));
    expect((screen.getByLabelText(`子任务备注：${task.subtasks[0].title}`) as HTMLTextAreaElement).value).toBe("保留备注");
    expect((screen.getByLabelText(`完成子任务：${task.subtasks[0].title}`) as HTMLInputElement).checked).toBe(true);
    expect(Array.from(container.querySelectorAll(".project-task-table > tbody > tr[data-task-order-id]")).map((row) => row.getAttribute("data-task-order-id"))).toEqual(board.tasks.map((item) => item.id));
  });

  it("saves subtask ordering from the task detail editor", async () => {
    const board = createProjectBoard("research", "详情排序");
    const task = board.tasks[0];
    render(<Workspace initial={[board]} />);
    fireEvent.click(screen.getByRole("button", { name: task.title }));
    fireEvent.keyDown(screen.getByRole("button", { name: `移动子任务：${task.subtasks[1].title}` }), { key: "ArrowUp" });
    fireEvent.click(screen.getByRole("button", { name: "保存任务" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: `展开任务：${task.title}` }));
    expect(Array.from(screen.getByRole("table", { name: `${task.title}的子任务表` }).querySelectorAll("[data-subtask-id]")).map((row) => row.getAttribute("data-subtask-id"))).toEqual(task.subtasks.map((item) => item.id).reverse());
  });

  it("accepts a task drop onto an expanded task body and keeps its subtask draft", () => {
    const board = createProjectBoard("research", "展开区排序");
    const task = board.tasks[0];
    const { container } = render(<Workspace initial={[board]} />);
    fireEvent.click(screen.getByRole("button", { name: `展开任务：${task.title}` }));
    const note = screen.getByLabelText(`子任务备注：${task.subtasks[0].title}`) as HTMLTextAreaElement;
    fireEvent.focus(note);
    fireEvent.change(note, { target: { value: "尚未失焦的备注" } });
    const dataTransfer = { setData: vi.fn(), effectAllowed: "move", dropEffect: "move" };
    fireEvent.dragStart(screen.getByRole("button", { name: `移动任务：${board.tasks[3].title}` }), { dataTransfer });
    fireEvent.drop(container.querySelector(".project-expanded-cell")!, { dataTransfer });
    expect(Array.from(container.querySelectorAll(".project-task-table > tbody > tr[data-task-order-id]")).map((row) => row.getAttribute("data-task-order-id"))).toEqual([3, 0, 1, 2].map((index) => board.tasks[index].id));
    expect((screen.getByLabelText(`子任务备注：${task.subtasks[0].title}`) as HTMLTextAreaElement).value).toBe("尚未失焦的备注");
  });

  it("reorders kanban cards within their status without moving a task to another status", () => {
    const board = createProjectBoard("research", "看板排序");
    board.tasks[0].status = board.tasks[1].status = "doing";
    const { container } = render(<Workspace initial={[board]} />);
    fireEvent.click(screen.getByRole("button", { name: "看板" }));
    const dataTransfer = { setData: vi.fn(), effectAllowed: "move", dropEffect: "move" };
    const doingOrder = () => Array.from(container.querySelectorAll(".project-kanban-column")[1].querySelectorAll("[data-task-order-id]")).map((row) => row.getAttribute("data-task-order-id"));
    fireEvent.dragStart(screen.getByRole("button", { name: `移动任务：${board.tasks[1].title}` }), { dataTransfer });
    fireEvent.drop(container.querySelector(`[data-task-order-id="${board.tasks[0].id}"]`)!, { dataTransfer });
    expect(doingOrder()).toEqual([board.tasks[1].id, board.tasks[0].id]);
    fireEvent.dragStart(screen.getByRole("button", { name: `移动任务：${board.tasks[1].title}` }), { dataTransfer });
    fireEvent.drop(container.querySelector(`[data-task-order-id="${board.tasks[2].id}"]`)!, { dataTransfer });
    expect(doingOrder()).toEqual([board.tasks[1].id, board.tasks[0].id]);
    expect((screen.getByLabelText(`状态：${board.tasks[1].title}`) as HTMLSelectElement).value).toBe("doing");
    expect((screen.getByLabelText(`状态：${board.tasks[2].title}`) as HTMLSelectElement).value).toBe("todo");
  });

  it("retains a conflicting note draft and lets Escape restore the remote note", () => {
    const onChange = vi.fn();
    const { rerender } = render(<InlineProjectText multiline label="备注" value="初稿" onChange={onChange} />);
    const input = screen.getByLabelText("备注") as HTMLTextAreaElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "本机草稿" } });
    rerender(<InlineProjectText multiline label="备注" value="远端新稿" onChange={onChange} />);
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe("本机草稿");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input.value).toBe("远端新稿");
  });

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

  it("edits structured subtask rows and notes without submitting the task form early", async () => {
    render(<Workspace />);
    fireEvent.click(screen.getByRole("button", { name: /自学计划/ }));
    fireEvent.change(screen.getByLabelText("项目名称"), { target: { value: "LeetCode" } });
    fireEvent.click(screen.getByRole("button", { name: "创建项目" }));
    await screen.findByRole("heading", { name: "LeetCode" });
    const title = "明确学习目标与检验方式";
    fireEvent.click(screen.getByRole("button", { name: title }));
    const add = screen.getByLabelText(`添加子任务：${title}`);
    fireEvent.change(add, { target: { value: "分析复杂度" } });
    fireEvent.keyDown(add, { key: "Enter" });
    expect(screen.getByRole("dialog")).toBeTruthy();
    const note = screen.getByLabelText("子任务备注：分析复杂度");
    fireEvent.focus(note);
    fireEvent.change(note, { target: { value: "记录时间和空间复杂度" } });
    fireEvent.blur(note);
    fireEvent.click(screen.getByRole("button", { name: "保存任务" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: `展开任务：${title}` }));
    fireEvent.click(screen.getByRole("checkbox", { name: "完成子任务：分析复杂度" }));
    expect((screen.getByRole("checkbox", { name: "完成子任务：分析复杂度" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("子任务备注：分析复杂度") as HTMLTextAreaElement).value).toBe("记录时间和空间复杂度");
    expect((screen.getByLabelText("子任务状态：分析复杂度") as HTMLSelectElement).value).toBe("done");
    expect(screen.getByLabelText("子任务状态：分析复杂度").parentElement?.querySelector("svg")).toBeNull();
    const mainNote = screen.getByLabelText(`任务备注：${title}`);
    fireEvent.focus(mainNote);
    fireEvent.change(mainNote, { target: { value: "本周完成两轮练习" } });
    fireEvent.blur(mainNote);
    fireEvent.click(screen.getByRole("button", { name: title }));
    expect((within(screen.getByRole("dialog")).getByLabelText("子任务备注：分析复杂度") as HTMLTextAreaElement).value).toBe("记录时间和空间复杂度");
    fireEvent.click(screen.getByRole("tab", { name: "备注与资料" }));
    expect((screen.getByRole("textbox", { name: "备注与资料" }) as HTMLTextAreaElement).value).toBe("本周完成两轮练习");
  });

  it("supports dragging and keyboard ordering without changing the selected project", () => {
    const first = createProjectBoard("blank", "城市用地诊断");
    const second = createProjectBoard("blank", "LeetCode");
    const { container } = render(<Workspace initial={[first, second]} />);
    const nav = screen.getByRole("navigation", { name: "项目列表" });
    fireEvent.click(within(nav).getByRole("button", { name: /城市用地诊断/, pressed: false }));
    const transfer = { setData: vi.fn(), effectAllowed: "move", dropEffect: "move" };
    fireEvent.dragStart(screen.getByRole("button", { name: "移动项目：LeetCode" }), { dataTransfer: transfer });
    const target = container.querySelector(`[data-project-order-id="${first.id}"]`)!;
    fireEvent.dragOver(target, { dataTransfer: transfer });
    fireEvent.drop(target, { dataTransfer: transfer });
    expect(Array.from(nav.querySelectorAll("[data-project-order-id]")).map((item) => item.getAttribute("data-project-order-id"))).toEqual([second.id, first.id]);
    expect(screen.getByRole("heading", { name: first.name })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("button", { name: "移动项目：LeetCode" }), { key: "ArrowDown" });
    expect(Array.from(nav.querySelectorAll("[data-project-order-id]")).map((item) => item.getAttribute("data-project-order-id"))).toEqual([first.id, second.id]);
  });

  it("filters by status and archives projects without removing their tasks", async () => {
    const board = createProjectBoard("research", "城市用地诊断");
    board.tasks[0].status = "blocked";
    render(<Workspace initial={[board]} />);
    fireEvent.click(screen.getByRole("button", { name: "筛选" }));
    fireEvent.change(screen.getByLabelText("筛选任务状态"), { target: { value: "blocked" } });
    expect(screen.getByRole("button", { name: board.tasks[0].title })).toBeTruthy();
    expect(screen.queryByRole("button", { name: board.tasks[1].title })).toBeNull();
    fireEvent.click(within(screen.getByRole("navigation", { name: "项目列表" })).getByRole("button", { name: /城市用地诊断/, pressed: false }));
    fireEvent.click(screen.getByRole("button", { name: "归档项目" }));
    fireEvent.click(within(screen.getByRole("navigation", { name: "项目列表" })).getByRole("button", { name: /城市用地诊断/, pressed: false }));
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
    fireEvent.click(within(screen.getByRole("navigation", { name: "项目列表" })).getByRole("button", { name: /城市用地诊断/, pressed: false }));
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
