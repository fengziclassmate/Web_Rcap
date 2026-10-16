"use client";

import { useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { boardStatuses, createBoardSubtask, type BoardStatus, type BoardSubtask } from "@/lib/project-boards";

export function TaskStatusControl({ status, label, onChange }: { status: BoardStatus; label: string; onChange: (status: BoardStatus) => void }) {
  return <span className={`project-status-control status-${status}`}><span className={`project-status-dot status-${status}`} /><select aria-label={label} title="修改状态" value={status} onChange={(event) => onChange(event.target.value as BoardStatus)}>{Object.entries(boardStatuses).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></span>;
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

export function SubtaskTable({ title, subtasks, onChange }: { title: string; subtasks: BoardSubtask[]; onChange: (update: (previous: BoardSubtask[]) => BoardSubtask[]) => void }) {
  const [newTitle, setNewTitle] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  function patch(id: string, changes: Partial<BoardSubtask>) { onChange((previous) => previous.map((item) => item.id === id ? { ...item, ...changes } : item)); }
  function add() {
    if (!newTitle.trim()) return;
    const item = createBoardSubtask(newTitle.trim());
    onChange((previous) => [...previous, item]);
    setNewTitle("");
  }
  return <section className="project-subtasks" aria-label={`${title}的子任务`}>
    <div className="project-subtask-scroll"><table className="project-subtask-table"><caption className="sr-only">{title}的子任务表</caption><thead><tr><th className="w-8"><span className="sr-only">完成状态</span></th><th>子任务 <span className="project-subtask-count">{subtasks.filter((item) => item.status === "done").length}/{subtasks.length}</span></th><th className="w-24">状态</th><th className="w-[42%]">备注</th><th className="w-10"><span className="sr-only">操作</span></th></tr></thead><tbody>
      {subtasks.map((item) => <tr key={item.id} data-subtask-id={item.id}>
        <td><input type="checkbox" checked={item.status === "done"} aria-label={`完成子任务：${item.title}`} onChange={(event) => patch(item.id, { status: event.target.checked ? "done" : "todo" })} className="size-3.5 accent-emerald-800" /></td>
        <td><InlineProjectText required value={item.title} label={`子任务名称：${item.title}`} onChange={(title) => patch(item.id, { title })} /></td>
        <td><TaskStatusControl status={item.status} label={`子任务状态：${item.title}`} onChange={(status) => patch(item.id, { status })} /></td>
        <td><InlineProjectText multiline value={item.notes} label={`子任务备注：${item.title}`} placeholder="添加备注" onChange={(notes) => patch(item.id, { notes })} /></td>
        <td><Button type="button" size="icon-sm" variant="ghost" aria-label={`删除子任务：${item.title}`} title="删除子任务" onClick={() => setDeleting(item.id)}><Trash2 className="size-3.5" /></Button></td>
      </tr>)}
    </tbody></table></div>
    <div className="project-subtask-add"><Plus className="size-3.5" /><input aria-label={`添加子任务：${title}`} value={newTitle} placeholder="添加子任务…" onChange={(event) => setNewTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); add(); } }} /><Button type="button" size="icon-sm" variant="ghost" aria-label={`保存子任务：${title}`} disabled={!newTitle.trim()} onClick={add}><Plus className="size-3.5" /></Button></div>
    <ConfirmDialog open={Boolean(deleting)} onOpenChange={(open) => { if (!open) setDeleting(null); }} title="删除这项子任务？" description={subtasks.find((item) => item.id === deleting)?.title ?? ""} confirmLabel="确认删除" onConfirm={() => { onChange((previous) => previous.filter((item) => item.id !== deleting)); setDeleting(null); }} />
  </section>;
}
