import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectWorkspace } from "../project-workspace";
import { ProjectScheduleDialog } from "../project-schedule-dialog";
import { createProjectBoard } from "@/lib/project-boards";
import { saveProjectSchedule } from "@/lib/project-schedule";
import { toast } from "sonner";

function sessions() {
  const board = createProjectBoard("research", "城市诊断");
  const link = { boardId: board.id, taskId: board.tasks[0].id };
  const time = { date: "2026-10-20", endDate: "2026-10-20", startHour: 16, endHour: 17 };
  const first = saveProjectSchedule([board], [], link, time);
  const saved = saveProjectSchedule(first.boards, first.events, link, { ...time, startHour: 19, endHour: 20 });
  return { board, link, time, saved };
}

describe("project work session controls", () => {
  it.each([false, true])("adds a session for the selected task identity (subtask: %s)", (child) => {
    const board = createProjectBoard("research", "城市诊断"); const task = board.tasks[0];
    const item = child ? task.subtasks[0] : task;
    const onSave = vi.fn(() => true);
    render(<ProjectWorkspace boards={[board]} onChange={vi.fn()} onCopyToToday={vi.fn()} onSaveSchedule={onSave} />);
    if (child) fireEvent.click(screen.getByRole("button", { name: `展开任务：${task.title}` }));
    fireEvent.click(screen.getByRole("button", { name: `安排${child ? "子任务" : "任务"}日程：${item.title}` }));
    const dialog = within(screen.getByRole("dialog", { name: "日程安排" }));
    fireEvent.change(dialog.getByLabelText("安排开始日期"), { target: { value: "2026-10-20" } });
    fireEvent.change(dialog.getByLabelText("安排开始时间"), { target: { value: "16:00" } });
    fireEvent.change(dialog.getByLabelText("安排结束时间"), { target: { value: "17:00" } });
    fireEvent.click(dialog.getByRole("button", { name: "添加时段" }));
    expect(onSave).toHaveBeenCalledWith({ boardId: board.id, taskId: task.id, ...(child ? { subtaskId: item.id } : {}) }, { date: "2026-10-20", endDate: "2026-10-20", startHour: 16, endHour: 17 }, undefined);
    expect(dialog.getByRole("button", { name: "新增时段" })).toBeTruthy();
  });

  it("adds a third session without replacing the first two", () => {
    const { board, link, saved } = sessions();
    function Harness() {
      const [data, setData] = useState(saved);
      return <ProjectScheduleDialog title={board.tasks[0].title} source={board.name} plannedDate="2026-10-20" events={data.events} onSave={(time, id) => { setData(saveProjectSchedule(data.boards, data.events, link, time, id)); return true; }} onClose={vi.fn()} />;
    }
    render(<Harness />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "新增时段" }));
    fireEvent.change(screen.getByLabelText("安排开始时间"), { target: { value: "21:00" } });
    fireEvent.change(screen.getByLabelText("安排结束时间"), { target: { value: "22:00" } });
    fireEvent.click(screen.getByRole("button", { name: "添加时段" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    for (const range of ["16:00–17:00", "19:00–20:00", "21:00–22:00"]) expect(screen.getByText(range)).toBeTruthy();
  });

  it("edits, views and cancels the specified session only", () => {
    const { board, saved } = sessions();
    const onSave = vi.fn(() => true); const onView = vi.fn(); const onRemove = vi.fn();
    render(<ProjectScheduleDialog title={board.tasks[0].title} source={board.name} plannedDate="" events={saved.events} onSave={onSave} onView={onView} onRemove={onRemove} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "查看时段：2026-10-20 19:00–20:00" }));
    expect(onView).toHaveBeenCalledWith(saved.events[1]);
    fireEvent.click(screen.getByRole("button", { name: "修改时段：2026-10-20 19:00–20:00" }));
    expect((screen.getByLabelText("安排开始时间") as HTMLInputElement).value).toBe("19:00");
    fireEvent.change(screen.getByLabelText("安排开始时间"), { target: { value: "18:00" } });
    fireEvent.click(screen.getByRole("button", { name: "保存安排" }));
    expect(onSave).toHaveBeenCalledWith({ date: "2026-10-20", endDate: "2026-10-20", startHour: 18, endHour: 20 }, saved.events[1].id);
    fireEvent.click(screen.getByRole("button", { name: "修改时段：2026-10-20 19:00–20:00" }));
    fireEvent.click(screen.getByRole("button", { name: "取消此时段" }));
    expect(onRemove).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("dialog", { name: "取消这个时段？" })).getByRole("button", { name: "取消时段" }));
    expect(onRemove).toHaveBeenCalledWith(saved.events[1].id);
  });

  it("shows independent completed session counts without checking the task", () => {
    const { board, saved } = sessions();
    saved.events[0].isCompleted = true;
    render(<ProjectWorkspace boards={saved.boards} events={saved.events} onChange={vi.fn()} onCopyToToday={vi.fn()} onSaveSchedule={vi.fn()} />);
    const task = board.tasks[0];
    expect((screen.getByRole("checkbox", { name: `完成任务：${task.title}` }) as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: `修改日程安排：${task.title}` }));
    const dialog = within(screen.getByRole("dialog", { name: "日程安排" }));
    expect(dialog.getByText("已完成 1/2")).toBeTruthy();
    expect(dialog.getByText("已完成")).toBeTruthy();
    expect(dialog.getByText("待完成")).toBeTruthy();
  });

  it("keeps a rejected save open", () => {
    render(<ProjectScheduleDialog title="数据处理" source="城市诊断" plannedDate="" events={[]} onSave={() => false} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "添加时段" }));
    expect(screen.getByLabelText("安排开始时间")).toBeTruthy();
  });

  it("does not overwrite a session changed or deleted remotely while editing", () => {
    const errorToast = vi.spyOn(toast, "error");
    const { board, saved } = sessions();
    const onSave = vi.fn(() => true);
    const props = { title: board.tasks[0].title, source: board.name, plannedDate: "", onSave, onClose: vi.fn() };
    const { rerender } = render(<ProjectScheduleDialog {...props} events={saved.events} />);
    fireEvent.click(screen.getByRole("button", { name: "修改时段：2026-10-20 16:00–17:00" }));
    fireEvent.change(screen.getByLabelText("安排开始时间"), { target: { value: "15:00" } });
    rerender(<ProjectScheduleDialog {...props} events={[{ ...saved.events[0], startHour: 14 }, saved.events[1]]} />);
    fireEvent.click(screen.getByRole("button", { name: "保存安排" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(errorToast).toHaveBeenCalledWith(expect.stringContaining("其他页面"));
    rerender(<ProjectScheduleDialog {...props} events={[saved.events[1]]} />);
    fireEvent.click(screen.getByRole("button", { name: "保存安排" }));
    expect(onSave).not.toHaveBeenCalled();
  });
});
