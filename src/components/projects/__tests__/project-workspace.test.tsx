import { useState } from "react";
import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectWorkspace } from "../project-workspace";
import { AnnotatedContent, AnnotatedEditor } from "../annotated-content";
import { InlineProjectText } from "../subtask-table";
import { TaskTagsControl } from "../task-tags-control";
import { createBoardSubtask, createProjectBoard, type ProjectBoard } from "@/lib/project-boards";

function Workspace({ initial = [] }: { initial?: ProjectBoard[] }) {
  const [boards, setBoards] = useState(initial);
  return <ProjectWorkspace boards={boards} onChange={setBoards} onCopyToToday={vi.fn()} />;
}

describe("research and learning workspace", () => {
  it.each([false, true])("sorts subtasks by priority without overwriting manual order (details: %s)", async (details) => {
    const board = createProjectBoard("research", "子任务优先级");
    const task = board.tasks[0];
    board.tasks = [task];
    task.subtasks = [
      { ...createBoardSubtask("稍后处理"), priority: "p3" },
      { ...createBoardSubtask("重要事项甲"), priority: "p1", dueDate: "2026-10-25" },
      { ...createBoardSubtask("重要事项乙"), priority: "p1", dueDate: "2026-10-24" },
      { ...createBoardSubtask("常规事项"), priority: "p2" },
      { ...createBoardSubtask("已完成事项"), priority: "p1", status: "done" },
    ];
    render(<Workspace initial={[board]} />);
    fireEvent.change(screen.getByLabelText("任务排序"), { target: { value: "priority" } });
    fireEvent.click(screen.getByRole("button", { name: details ? task.title : `展开任务：${task.title}` }));
    const table = screen.getByRole("table", { name: `${task.title}的子任务表` });
    const order = () => Array.from(table.querySelectorAll("[data-subtask-id]")).map((row) => row.getAttribute("data-subtask-id"));
    expect(order()).toEqual([2, 1, 3, 0, 4].map((index) => task.subtasks[index].id));
    fireEvent.change(screen.getByLabelText("子任务优先级：稍后处理"), { target: { value: "p1" } });
    expect(order()).toEqual([2, 1, 0, 3, 4].map((index) => task.subtasks[index].id));
    if (details) {
      fireEvent.click(screen.getByRole("button", { name: "保存任务" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      fireEvent.click(screen.getByRole("button", { name: `展开任务：${task.title}` }));
    }
    fireEvent.change(screen.getByLabelText("任务排序"), { target: { value: "manual" } });
    expect(Array.from(screen.getByRole("table", { name: `${task.title}的子任务表` }).querySelectorAll("[data-subtask-id]")).map((row) => row.getAttribute("data-subtask-id"))).toEqual(task.subtasks.map((item) => item.id));
  });

  it.each([false, true])("switches to manual order when moving a priority-sorted subtask (details: %s)", async (details) => {
    const board = createProjectBoard("research", "子任务手动顺序");
    const task = board.tasks[0];
    board.tasks = [task];
    task.subtasks = [
      { ...createBoardSubtask("稍后处理"), priority: "p3" },
      { ...createBoardSubtask("先处理"), priority: "p1" },
      { ...createBoardSubtask("常规处理"), priority: "p2" },
    ];
    render(<Workspace initial={[board]} />);
    fireEvent.change(screen.getByLabelText("任务排序"), { target: { value: "priority" } });
    fireEvent.click(screen.getByRole("button", { name: details ? task.title : `展开任务：${task.title}` }));
    fireEvent.keyDown(screen.getByRole("button", { name: "移动子任务：稍后处理" }), { key: "ArrowUp" });
    expect((screen.getByLabelText("任务排序") as HTMLSelectElement).value).toBe("manual");
    if (details) {
      fireEvent.click(screen.getByRole("button", { name: "保存任务" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      fireEvent.click(screen.getByRole("button", { name: `展开任务：${task.title}` }));
    }
    const table = screen.getByRole("table", { name: `${task.title}的子任务表` });
    const order = () => Array.from(table.querySelectorAll("[data-subtask-id]")).map((row) => row.getAttribute("data-subtask-id"));
    expect(order()).toEqual([1, 0, 2].map((index) => task.subtasks[index].id));
    fireEvent.change(screen.getByLabelText("任务排序"), { target: { value: "priority" } });
    fireEvent.change(screen.getByLabelText("任务排序"), { target: { value: "manual" } });
    expect(order()).toEqual([1, 0, 2].map((index) => task.subtasks[index].id));
  });

  it("adds, renames and removes tags inline and shares the result with task details", () => {
    const board = createProjectBoard("research", "标签编辑");
    const task = board.tasks[0];
    task.tags = ["中等", "数组", "扫描线"];
    render(<Workspace initial={[board]} />);
    const row = within(screen.getByRole("button", { name: task.title }).closest("tr")!);
    for (const tag of task.tags) expect(row.getByRole("button", { name: `修改标签 ${tag}：${task.title}` })).toBeTruthy();
    fireEvent.click(row.getByRole("button", { name: `添加标签：${task.title}` }));
    fireEvent.change(row.getByRole("textbox", { name: `新标签：${task.title}` }), { target: { value: " 双指针，数组、排序 " } });
    fireEvent.keyDown(row.getByRole("textbox", { name: `新标签：${task.title}` }), { key: "Enter" });
    expect(row.getAllByRole("button", { name: `修改标签 数组：${task.title}` })).toHaveLength(1);
    fireEvent.click(row.getByRole("button", { name: `修改标签 扫描线：${task.title}` }));
    const edit = row.getByRole("textbox", { name: `修改标签 扫描线：${task.title}` });
    fireEvent.change(edit, { target: { value: "区间合并" } });
    fireEvent.blur(edit);
    fireEvent.click(row.getByRole("button", { name: `删除标签 中等：${task.title}` }));
    expect(document.activeElement).toBe(row.getByRole("button", { name: `添加标签：${task.title}` }));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(row.getByRole("button", { name: task.title }));
    expect((screen.getByLabelText("任务标签") as HTMLInputElement).value).toBe("数组、区间合并、双指针、排序");
    expect((screen.getByLabelText("任务阶段") as HTMLInputElement).value).toBe(task.phase);
  });

  it("cancels tag drafts, ignores composition Enter, and keeps an emptied label on blur", () => {
    const board = createProjectBoard("research", "标签输入");
    const task = board.tasks[0];
    task.tags = ["原标签"];
    render(<Workspace initial={[board]} />);
    fireEvent.click(screen.getByRole("button", { name: `添加标签：${task.title}` }));
    const input = screen.getByRole("textbox", { name: `新标签：${task.title}` });
    fireEvent.change(input, { target: { value: "输入中" } });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(screen.getByRole("textbox", { name: `新标签：${task.title}` })).toBe(input);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("button", { name: `修改标签 输入中：${task.title}` })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: `修改标签 原标签：${task.title}` }));
    const rename = screen.getByRole("textbox", { name: `修改标签 原标签：${task.title}` });
    fireEvent.change(rename, { target: { value: "   " } });
    fireEvent.blur(rename);
    expect(screen.getByRole("button", { name: `修改标签 原标签：${task.title}` })).toBeTruthy();
  });

  it("preserves concurrent tag additions and does not restore a remotely removed tag", () => {
    const onChange = vi.fn();
    const { rerender } = render(<TaskTagsControl title="并发修改" tags={["数组"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "修改标签 数组：并发修改" }));
    const input = screen.getByRole("textbox", { name: "修改标签 数组：并发修改" });
    fireEvent.change(input, { target: { value: "矩阵" } });
    rerender(<TaskTagsControl title="并发修改" tags={["数组", "远端新增"]} onChange={onChange} />);
    fireEvent.blur(input);
    const update = onChange.mock.calls[0][0];
    expect(update(["数组", "远端新增", "更新的标签"])).toEqual(["矩阵", "远端新增", "更新的标签"]);
    expect(update(["远端重命名"])).toEqual(["远端重命名"]);
    onChange.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "修改标签 数组：并发修改" }));
    const draft = screen.getByRole("textbox", { name: "修改标签 数组：并发修改" });
    fireEvent.change(draft, { target: { value: "本机草稿" } });
    rerender(<TaskTagsControl title="并发修改" tags={["远端重命名"]} onChange={onChange} />);
    fireEvent.blur(draft);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "修改标签 数组：并发修改" })).toBe(draft);
  });

  it.each([false, true])("reveals the linked row without opening a task editor (subtask: %s)", async (child) => {
    const board = createProjectBoard("research", "日程返回定位");
    const task = board.tasks[2];
    const item = child ? task.subtasks[1] : task;
    const originalScroll = HTMLElement.prototype.scrollTo;
    const scroll = vi.fn();
    HTMLElement.prototype.scrollTo = scroll;
    try {
      render(<ProjectWorkspace boards={[board]} onChange={vi.fn()} onCopyToToday={vi.fn()} initialSelection={{ boardId: board.id, taskId: task.id, ...(child ? { subtaskId: item.id } : {}), intent: "reveal", token: 1 }} />);
      expect(screen.queryByRole("dialog", { name: "任务详情" })).toBeNull();
      expect(screen.getByRole("heading", { name: board.name })).toBeTruthy();
      const target = child ? screen.getByLabelText(`子任务名称：${item.title}`).closest("tr") : screen.getByRole("button", { name: task.title }).closest("tr");
      await waitFor(() => expect(document.activeElement).toBe(target));
      expect(scroll).toHaveBeenCalledOnce();
      expect(scroll.mock.contexts[0]).toBe(screen.getByRole("region", { name: "科研与自学工作台" }).querySelector(".project-content-scroll"));
      fireEvent.click(screen.getByRole("button", { name: `收起任务：${task.title}` }));
      expect(screen.queryByRole("table", { name: `${task.title}的子任务表` })).toBeNull();
    } finally { HTMLElement.prototype.scrollTo = originalScroll; }
  });

  it("still opens task details for an edit selection", () => {
    const board = createProjectBoard("research", "搜索编辑");
    render(<ProjectWorkspace boards={[board]} onChange={vi.fn()} onCopyToToday={vi.fn()} initialSelection={{ boardId: board.id, taskId: board.tasks[0].id, token: 1 }} />);
    expect(screen.getByRole("dialog", { name: "任务详情" })).toBeTruthy();
  });

  it("remembers expanded rows on reopen and supports expanding and collapsing the visible list", () => {
    const board = createProjectBoard("research", "展开记忆");
    function Remembered() {
      const [boards, setBoards] = useState([board]);
      const [expanded, setExpanded] = useState<string[]>([]);
      const [open, setOpen] = useState(true);
      return <><button onClick={() => setOpen(!open)}>{open ? "关闭工作台" : "打开工作台"}</button>{open && <ProjectWorkspace boards={boards} onChange={setBoards} onCopyToToday={vi.fn()} expandedTasks={expanded} onExpandedTasksChange={setExpanded} />}</>;
    }
    render(<Remembered />);
    fireEvent.click(screen.getByRole("button", { name: `展开任务：${board.tasks[0].title}` }));
    fireEvent.click(screen.getByRole("button", { name: `展开任务：${board.tasks[1].title}` }));
    fireEvent.click(screen.getByRole("button", { name: "关闭工作台" }));
    fireEvent.click(screen.getByRole("button", { name: "打开工作台" }));
    expect(screen.getByRole("button", { name: `收起任务：${board.tasks[0].title}` })).toBeTruthy();
    expect(screen.getByRole("button", { name: `收起任务：${board.tasks[1].title}` })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "筛选" }));
    fireEvent.change(screen.getByLabelText("筛选任务阶段"), { target: { value: board.tasks[0].phase } });
    fireEvent.click(screen.getByRole("button", { name: "全部折叠" }));
    fireEvent.change(screen.getByLabelText("筛选任务阶段"), { target: { value: "all" } });
    expect(screen.getByRole("button", { name: `展开任务：${board.tasks[0].title}` })).toBeTruthy();
    expect(screen.getByRole("button", { name: `收起任务：${board.tasks[1].title}` })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "全部展开" }));
    expect(screen.getAllByRole("table").length).toBe(5);
    fireEvent.click(screen.getByRole("button", { name: "全部折叠" }));
    expect(screen.getAllByRole("table").length).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "关闭工作台" }));
    fireEvent.click(screen.getByRole("button", { name: "打开工作台" }));
    expect(screen.getAllByRole("table").length).toBe(1);
  });

  it("scopes expansion by project even when tasks share an ID, and leaves content cells without placeholders", () => {
    const first = createProjectBoard("research", "甲");
    const second = createProjectBoard("research", "乙");
    first.tasks[0].title = "甲任务";
    second.tasks[0].title = "乙任务";
    second.tasks[0].id = first.tasks[0].id;
    render(<Workspace initial={[first, second]} />);
    fireEvent.click(screen.getByRole("button", { name: "展开任务：甲任务" }));
    expect(screen.getByRole("button", { name: "展开任务：乙任务" })).toBeTruthy();
    expect(screen.getByLabelText("阶段：甲任务").getAttribute("placeholder")).toBeNull();
    expect(screen.getByLabelText("任务备注：甲任务").getAttribute("placeholder")).toBeNull();
    expect(screen.getByLabelText(`子任务备注：${first.tasks[0].subtasks[0].title}`).getAttribute("placeholder")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "甲任务" }));
    expect(screen.getByRole("textbox", { name: "任务内容" }).getAttribute("placeholder")).toBeNull();
    expect(screen.getByRole("textbox", { name: "任务名称" }).getAttribute("placeholder")).toBeNull();
  });

  it("moves completed tasks below active tasks while retaining manual rank when reopened", () => {
    const board = createProjectBoard("research", "完成下移");
    board.tasks[0].priority = board.tasks[1].priority = "p1";
    board.tasks[1].status = "done";
    const { container } = render(<Workspace initial={[board]} />);
    const order = () => Array.from(container.querySelectorAll(".project-task-table > tbody > tr[data-task-order-id]")).map((row) => row.getAttribute("data-task-order-id"));
    expect(order()).toEqual([0, 2, 3, 1].map((index) => board.tasks[index].id));
    fireEvent.click(screen.getByRole("checkbox", { name: `完成任务：${board.tasks[0].title}` }));
    expect(order()).toEqual([2, 3, 0, 1].map((index) => board.tasks[index].id));
    const dataTransfer = { setData: vi.fn(), effectAllowed: "move", dropEffect: "move" };
    fireEvent.dragStart(screen.getByRole("button", { name: `移动任务：${board.tasks[3].title}` }), { dataTransfer });
    fireEvent.drop(container.querySelector(`[data-task-order-id="${board.tasks[0].id}"]`)!, { dataTransfer });
    expect(order()).toEqual([2, 3, 0, 1].map((index) => board.tasks[index].id));
    fireEvent.click(screen.getByRole("checkbox", { name: `完成任务：${board.tasks[0].title}` }));
    expect(order()).toEqual([0, 2, 3, 1].map((index) => board.tasks[index].id));
    fireEvent.change(screen.getByLabelText("任务排序"), { target: { value: "priority" } });
    expect(order().at(-1)).toBe(board.tasks[1].id);
  });

  it("moves checked subtasks down and restores their manual position when unchecked", () => {
    const board = createProjectBoard("research", "子任务完成");
    const task = board.tasks[0];
    const { container } = render(<Workspace initial={[board]} />);
    fireEvent.click(screen.getByRole("button", { name: `展开任务：${task.title}` }));
    const order = () => Array.from(container.querySelectorAll("[data-subtask-id]")).map((row) => row.getAttribute("data-subtask-id"));
    fireEvent.click(screen.getByRole("checkbox", { name: `完成子任务：${task.subtasks[0].title}` }));
    expect(order()).toEqual(task.subtasks.map((item) => item.id).reverse());
    fireEvent.click(screen.getByRole("checkbox", { name: `完成子任务：${task.subtasks[0].title}` }));
    expect(order()).toEqual(task.subtasks.map((item) => item.id));
  });

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
    expect(order()).toEqual([2, 1, 0].map((index) => task.subtasks[index].id));
    fireEvent.keyDown(screen.getByRole("button", { name: "移动子任务：第三个子任务" }), { key: "ArrowDown" });
    expect(order()).toEqual([1, 2, 0].map((index) => task.subtasks[index].id));
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
    expect(screen.getByRole("button", { name: "核对分类口径" })).toBeTruthy();
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
