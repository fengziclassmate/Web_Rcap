import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectWorkspace } from "../project-workspace";
import { ProjectScheduleDialog } from "../project-schedule-dialog";
import { createProjectBoard } from "@/lib/project-boards";
import { saveProjectSchedule } from "@/lib/project-schedule";
import { toast } from "sonner";

describe("project calendar controls", () => {
  it.each([false, true])("schedules the selected task identity and time (subtask: %s)", (child) => {
    const board = createProjectBoard("research", "城市诊断");
    const task = board.tasks[0];
    const item = child ? task.subtasks[0] : task;
    const onSave = vi.fn(() => true);
    render(<ProjectWorkspace boards={[board]} onChange={vi.fn()} onCopyToToday={vi.fn()} onSaveSchedule={onSave} />);
    if (child) fireEvent.click(screen.getByRole("button", { name: `展开任务：${task.title}` }));
    fireEvent.click(screen.getByRole("button", { name: `安排${child ? "子任务" : "任务"}日程：${item.title}` }));
    const dialog = within(screen.getByRole("dialog", { name: "日程安排" }));
    fireEvent.change(dialog.getByLabelText("安排开始日期"), { target: { value: "2026-10-20" } });
    fireEvent.change(dialog.getByLabelText("安排开始时间"), { target: { value: "16:00" } });
    fireEvent.change(dialog.getByLabelText("安排结束时间"), { target: { value: "17:00" } });
    fireEvent.click(dialog.getByRole("button", { name: "安排日程" }));
    expect(onSave).toHaveBeenCalledWith({ boardId: board.id, taskId: task.id, ...(child ? { subtaskId: item.id } : {}) }, { date: "2026-10-20", endDate: "2026-10-20", startHour: 16, endHour: 17 });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows a linked time, edits it and supports viewing the original card", () => {
    const board = createProjectBoard("research", "日程回看");
    const link = { boardId: board.id, taskId: board.tasks[0].id };
    const saved = saveProjectSchedule([board], [], link, { date: "2026-10-20", endDate: "2026-10-20", startHour: 16, endHour: 17 });
    const onView = vi.fn();
    render(<ProjectWorkspace boards={saved.boards} events={saved.events} onChange={vi.fn()} onCopyToToday={vi.fn()} onSaveSchedule={vi.fn()} onViewSchedule={onView} />);
    const trigger = screen.getByRole("button", { name: `修改日程安排：${board.tasks[0].title}` });
    expect(trigger.textContent).toBe("16:00–17:00");
    fireEvent.click(trigger);
    expect((screen.getByLabelText("安排开始时间") as HTMLInputElement).value).toBe("16:00");
    fireEvent.click(screen.getByRole("button", { name: "周视图" }));
    expect(onView).toHaveBeenCalledWith(saved.events[0]);
  });

  it("keeps an invalid save open and requires confirmation to cancel a time block", () => {
    const board = createProjectBoard("research", "取消安排");
    const event = saveProjectSchedule([board], [], { boardId: board.id, taskId: board.tasks[0].id }, { date: "2026-10-20", endDate: "2026-10-20", startHour: 16, endHour: 17 }).events[0];
    const onClose = vi.fn(); const onRemove = vi.fn();
    render(<ProjectScheduleDialog title="数据处理" source="城市诊断" plannedDate="" event={event} onSave={() => false} onRemove={onRemove} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "保存安排" }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "取消安排" }));
    expect(onRemove).not.toHaveBeenCalled();
    const confirm = within(screen.getByRole("dialog", { name: "取消这项日程安排？" }));
    fireEvent.click(confirm.getByRole("button", { name: "取消安排" }));
    expect(onRemove).toHaveBeenCalledOnce(); expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not overwrite a time block edited or deleted remotely while the form is open", () => {
    const errorToast = vi.spyOn(toast, "error");
    const board = createProjectBoard("research", "并发编辑");
    const event = saveProjectSchedule([board], [], { boardId: board.id, taskId: board.tasks[0].id }, { date: "2026-10-20", endDate: "2026-10-20", startHour: 16, endHour: 17 }).events[0];
    const onSave = vi.fn(() => true);
    const props = { title: "数据处理", source: "城市诊断", plannedDate: "", onSave, onClose: vi.fn() };
    const { rerender } = render(<ProjectScheduleDialog {...props} event={event} />);
    fireEvent.change(screen.getByLabelText("安排开始时间"), { target: { value: "15:00" } });
    rerender(<ProjectScheduleDialog {...props} event={{ ...event, startHour: 14 }} />);
    fireEvent.click(screen.getByRole("button", { name: "保存安排" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(errorToast).toHaveBeenCalledWith(expect.stringContaining("其他页面"));
    rerender(<ProjectScheduleDialog {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "安排日程" }));
    expect(onSave).not.toHaveBeenCalled();
  });
});
