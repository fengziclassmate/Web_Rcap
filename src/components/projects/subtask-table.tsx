"use client";

import { useRef, useState } from "react";
import { CalendarClock, CalendarPlus, ChevronDown, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { boardPriorities, boardStatuses, compareCompletion, createBoardSubtask, isBoardTaskOverdue, reorderVisibleRecords, type BoardPriority, type BoardStatus, type BoardSubtask, type BoardTask } from "@/lib/project-boards";
import { todayISO } from "@/lib/date-utils";
import { useRowReorder } from "./use-row-reorder";
import type { ScheduleEvent } from "@/lib/types";
import { projectScheduleLabel } from "@/lib/project-schedule";

export function ProjectTableColumns() {
  return <colgroup><col className="project-col-check" /><col /><col className="project-col-priority" /><col className="project-col-status" /><col className="project-col-date" /><col className="project-col-date" /><col className="project-col-notes" /><col className="project-col-actions" /></colgroup>;
}

export function TaskStatusControl({ status, label, onChange }: { status: BoardStatus; label: string; onChange: (status: BoardStatus) => void }) {
  return <span className={`project-status-control status-${status}`}><span className={`project-status-dot status-${status}`} /><select aria-label={label} title="修改状态" value={status} onChange={(event) => onChange(event.target.value as BoardStatus)}>{Object.entries(boardStatuses).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></span>;
}

export function TaskPriorityControl({ priority, label, onChange }: { priority: BoardPriority; label: string; onChange: (priority: BoardPriority) => void }) {
  const compact = { p1: "紧急重要", p2: "重要不急", p3: "紧急次要", p4: "稍后处理" };
  return <span className={`project-priority-control priority-${priority}`}><select aria-label={label} title={boardPriorities[priority].label} value={priority} onChange={(event) => onChange(event.target.value as BoardPriority)}>{Object.entries(boardPriorities).map(([id, item]) => <option key={id} value={id}>{item.short} · {compact[id as BoardPriority]}</option>)}</select><ChevronDown className="size-3" /></span>;
}

export function TaskDateControls({ task, today = todayISO(), labelPrefix = "", fields = ["plannedDate", "dueDate"], schedule, onSchedule, onChange }: { task: Pick<BoardTask, "title" | "status" | "plannedDate" | "dueDate">; today?: string; labelPrefix?: string; fields?: ("plannedDate" | "dueDate")[]; schedule?: ScheduleEvent; onSchedule?: () => void; onChange: (field: "plannedDate" | "dueDate", value: string) => void }) {
  return <div className="project-date-controls" data-single={fields.length === 1}>{([['plannedDate', '计划'], ['dueDate', '截止']] as const).filter(([field]) => fields.includes(field)).map(([field, label]) => <label key={field} className={field === "dueDate" && isBoardTaskOverdue(task, today) ? "is-overdue" : ""}><span>{label}</span><span className="project-date-value" data-empty={!task[field]}><input type="date" aria-label={`${labelPrefix}${label}日期：${task.title}`} title={field === "plannedDate" && schedule ? "清空计划日期会取消对应日程" : undefined} value={task[field]} onChange={(event) => onChange(field, event.target.value)} />{!task[field] && <span aria-hidden>—</span>}</span></label>)}{fields.includes("plannedDate") && schedule && onSchedule && <button type="button" className="project-schedule-chip" aria-label={`修改日程安排：${task.title}`} title={`${schedule.date} ${projectScheduleLabel(schedule)}`} onClick={onSchedule}><CalendarClock className="size-3" />{projectScheduleLabel(schedule)}</button>}</div>;
}

export function InlineProjectText({ value, label, placeholder, required = false, multiline = false, onChange }: { value: string; label: string; placeholder?: string; required?: boolean; multiline?: boolean; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const baseline = useRef(value);
  const cancelled = useRef(false);
  return <textarea className={`project-inline-text ${multiline ? "project-inline-note" : "project-inline-title"}`} aria-label={label} placeholder={placeholder} rows={1} value={draft ?? value}
    onFocus={() => { baseline.current = value; cancelled.current = false; }}
    onChange={(event) => setDraft(event.target.value)}
    onBlur={() => {
      if (cancelled.current || draft === null) return;
      const next = required ? draft.trim() : draft;
      if (required && !next) { toast.error("子任务名称不能为空。"); return; }
      if (next !== value && baseline.current !== value) { toast.error("该字段已在其他页面更新，请核对后重新提交。"); return; }
      if (next !== value) onChange(next);
      setDraft(null);
    }}
    onKeyDown={(event) => {
      if (event.nativeEvent.isComposing) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); cancelled.current = true; setDraft(null); event.currentTarget.blur(); }
      if (event.key === "Enter" && (!multiline || event.ctrlKey || event.metaKey)) { event.preventDefault(); event.currentTarget.blur(); }
    }} />;
}

export function SubtaskTable({ title, subtasks, onChange, scheduleFor, onSchedule }: { title: string; subtasks: BoardSubtask[]; onChange: (update: (previous: BoardSubtask[]) => BoardSubtask[]) => void; scheduleFor?: (id: string) => ScheduleEvent | undefined; onSchedule?: (id: string) => void }) {
  const [newTitle, setNewTitle] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const rows = [...subtasks].sort(compareCompletion);
  const sorting = useRowReorder(rows.map((item) => ({ id: item.id, group: item.status === "done" ? "done" : "active", label: `子任务：${item.title}` })), (sourceId, targetId) => {
    const source = rows.find((item) => item.id === sourceId);
    if (!source) return;
    const visibleIds = rows.filter((item) => !compareCompletion(item, source)).map((item) => item.id);
    onChange((previous) => reorderVisibleRecords(previous, sourceId, targetId, visibleIds));
  });
  function patch(id: string, changes: Partial<BoardSubtask>) { onChange((previous) => previous.map((item) => item.id === id ? { ...item, ...changes } : item)); }
  function add() {
    if (!newTitle.trim()) return;
    const item = createBoardSubtask(newTitle.trim());
    onChange((previous) => [...previous, item]);
    setNewTitle("");
  }
  return <section className="project-subtasks" aria-label={`${title}的子任务`}>
    <div className="project-subtask-scroll"><table className="project-subtask-table"><caption className="sr-only">{title}的子任务表</caption><ProjectTableColumns /><thead><tr><th><span className="sr-only">排序及完成状态</span></th><th>子任务 <span className="project-subtask-count">{subtasks.filter((item) => item.status === "done").length}/{subtasks.length}</span></th><th>优先级</th><th>状态</th><th>计划 / 日程</th><th>截止</th><th>备注</th><th><span className="sr-only">操作</span></th></tr></thead><tbody>
      {rows.map((item) => <tr key={item.id} data-subtask-id={item.id} className="project-sortable-row" {...sorting.rowProps(item.id)}>
        <td><div className="flex items-center gap-1">{sorting.handle(item.id)}<input type="checkbox" checked={item.status === "done"} aria-label={`完成子任务：${item.title}`} onChange={(event) => patch(item.id, { status: event.target.checked ? "done" : "todo" })} className="size-3.5 shrink-0 accent-emerald-800" /></div></td>
        <td><InlineProjectText required value={item.title} label={`子任务名称：${item.title}`} onChange={(title) => patch(item.id, { title })} /></td>
        <td><TaskPriorityControl priority={item.priority} label={`子任务优先级：${item.title}`} onChange={(priority) => patch(item.id, { priority })} /></td>
        <td><TaskStatusControl status={item.status} label={`子任务状态：${item.title}`} onChange={(status) => patch(item.id, { status })} /></td>
        <td><TaskDateControls task={item} labelPrefix="子任务" fields={["plannedDate"]} schedule={scheduleFor?.(item.id)} onSchedule={onSchedule ? () => onSchedule(item.id) : undefined} onChange={(field, value) => patch(item.id, { [field]: value })} /></td><td><TaskDateControls task={item} labelPrefix="子任务" fields={["dueDate"]} onChange={(field, value) => patch(item.id, { [field]: value })} /></td>
        <td><InlineProjectText multiline value={item.notes} label={`子任务备注：${item.title}`} onChange={(notes) => patch(item.id, { notes })} /></td>
        <td><div className="project-row-actions">{onSchedule && <Button type="button" size="icon-sm" variant="ghost" aria-label={`安排子任务日程：${item.title}`} title="日程安排" onClick={() => onSchedule(item.id)}><CalendarPlus className="size-3.5" /></Button>}<Button type="button" size="icon-sm" variant="ghost" aria-label={`删除子任务：${item.title}`} title="删除子任务" onClick={() => setDeleting(item.id)}><Trash2 className="size-3.5" /></Button></div></td>
      </tr>)}
    </tbody></table></div>
    <span role="status" className="sr-only">{sorting.announcement}</span>
    <div className="project-subtask-add"><Plus className="size-3.5" /><input aria-label={`添加子任务：${title}`} value={newTitle} placeholder="添加子任务…" onChange={(event) => setNewTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); add(); } }} /><Button type="button" size="icon-sm" variant="ghost" aria-label={`保存子任务：${title}`} disabled={!newTitle.trim()} onClick={add}><Plus className="size-3.5" /></Button></div>
    <ConfirmDialog open={Boolean(deleting)} onOpenChange={(open) => { if (!open) setDeleting(null); }} title="删除这项子任务？" description={subtasks.find((item) => item.id === deleting)?.title ?? ""} confirmLabel="确认删除" onConfirm={() => { onChange((previous) => previous.filter((item) => item.id !== deleting)); setDeleting(null); }} />
  </section>;
}
