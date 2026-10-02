import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FollowUpPanel } from "../follow-up-panel";
import { normalizeTasks } from "@/lib/normalizers";

function Harness() {
  const [tasks, setTasks] = useState(normalizeTasks([{ id: "paper", name: "Attention Is All You Need", taskType: "followup" }]));
  return <FollowUpPanel tasks={tasks} onAdd={(name) => setTasks([...tasks, ...normalizeTasks([{ id: "new", name, taskType: "followup" }])])} onUpdate={(id, patch) => setTasks(tasks.map((task) => task.id === id ? { ...task, ...patch, completedAt: patch.done ? "2026-10-02T09:00:00+08:00" : null } : task))} onDelete={(id) => setTasks(tasks.filter((task) => task.id !== id))} />;
}

describe("follow-up panel", () => {
  it("adds an item, changes its state, archives it on resolution and reopens it", () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("新跟进事项"), { target: { value: "  LeetCode 146 LRU  " } });
    fireEvent.click(screen.getByRole("button", { name: "添加跟进事项" }));
    const status = screen.getByLabelText("LeetCode 146 LRU的跟进状态");
    fireEvent.change(status, { target: { value: "trying" } });
    expect((status as HTMLSelectElement).value).toBe("trying");
    fireEvent.change(status, { target: { value: "verifying" } });
    fireEvent.change(status, { target: { value: "paused" } });
    fireEvent.change(status, { target: { value: "resolved" } });
    expect(within(screen.getByRole("table", { name: "待跟进事项列表" })).queryByText("LeetCode 146 LRU")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "存档库 1" }));
    const archive = within(screen.getByRole("dialog"));
    expect(archive.getByText("LeetCode 146 LRU")).toBeTruthy();
    expect(archive.getByText("2026/10/02")).toBeTruthy();
    fireEvent.click(archive.getByRole("button", { name: "重新跟进：LeetCode 146 LRU" }));
    expect(archive.queryByText("LeetCode 146 LRU")).toBeNull();
    expect((screen.getByLabelText("LeetCode 146 LRU的跟进状态") as HTMLSelectElement).value).toBe("pending");
  });

  it("saves renamed items and solution notes, and confirms deletion", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "编辑跟进事项：Attention Is All You Need" }));
    fireEvent.change(screen.getByLabelText("事项名称"), { target: { value: "Transformer 精读" } });
    fireEvent.change(screen.getByLabelText("备注 / 解决方法"), { target: { value: "重新推导 attention 公式" } });
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));
    expect(screen.getByText("重新推导 attention 公式")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "编辑跟进事项：Transformer 精读" }));
    fireEvent.click(screen.getByRole("button", { name: "删除事项" }));
    fireEvent.click(screen.getByRole("button", { name: "删除", exact: true }));
    expect(screen.queryByText("Transformer 精读")).toBeNull();
  });

  it("opens an archived follow-up from global search without showing unrelated tasks", () => {
    const handled = vi.fn();
    render(<FollowUpPanel tasks={normalizeTasks([{ id: "archived", name: "已解决论文", taskType: "followup", done: true }, { id: "long", name: "长期任务" }])} onAdd={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} openTaskRequest={{ id: "archived", token: 1 }} onOpenRequestHandled={handled} />);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect((screen.getByLabelText("事项名称") as HTMLInputElement).value).toBe("已解决论文");
    expect(screen.queryByText("长期任务")).toBeNull();
    expect(handled).toHaveBeenCalledTimes(1);
  });
});
