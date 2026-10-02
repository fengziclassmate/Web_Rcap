"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { Archive, ListChecks, Plus, RotateCcw } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { followUpStatuses, followUpStatusPatch, getFollowUpStatus } from "@/lib/follow-up";
import type { LongTask } from "@/lib/types";

type Props = {
  tasks: LongTask[];
  onAdd: (name: string) => void;
  onUpdate: (id: string, patch: Partial<LongTask>) => void;
  onDelete: (id: string) => void;
  openTaskRequest?: { id: string; token: number };
  onOpenRequestHandled?: () => void;
};

export function FollowUpPanel({ tasks, onAdd, onUpdate, onDelete, openTaskRequest, onOpenRequestHandled }: Props) {
  const [name, setName] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string; notes: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const items = tasks.filter((task) => task.taskType === "followup");
  const active = items.filter((task) => !task.done);
  const archived = items.filter((task) => task.done).sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  const matchingArchive = archived.filter((task) => `${task.name} ${task.notes}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const selectedTask = items.find((task) => task.id === editing?.id);

  const openRequestedTask = useEffectEvent(() => {
    const task = items.find((item) => item.id === openTaskRequest?.id);
    if (!task) return;
    setEditing({ id: task.id, name: task.name, notes: task.notes });
    onOpenRequestHandled?.();
  });
  useEffect(() => { if (openTaskRequest) openRequestedTask(); }, [openTaskRequest]);

  function statusSelect(task: LongTask) {
    const status = getFollowUpStatus(task);
    return <select aria-label={`${task.name}的跟进状态`} value={status} onChange={(event) => onUpdate(task.id, followUpStatusPatch(event.target.value))}
      className={`h-7 w-[88px] max-w-full rounded-md border border-current/10 px-1 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${followUpStatuses[status].color}`}>
      {Object.entries(followUpStatuses).map(([value, info]) => <option key={value} value={value}>{info.label}</option>)}
    </select>;
  }

  function taskName(task: LongTask) {
    return <button type="button" className="block w-full min-w-0 rounded text-left outline-none hover:text-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-700" aria-label={`编辑跟进事项：${task.name}`} onClick={() => setEditing({ id: task.id, name: task.name, notes: task.notes })}>
      <span className="block break-words font-medium [overflow-wrap:anywhere]">{task.name}</span>
      {task.notes && <span className="mt-0.5 line-clamp-1 text-xs font-normal text-stone-500">{task.notes}</span>}
    </button>;
  }

  return <section className="task-dashboard-section" aria-label="跟进事项">
    <div className="mb-3 flex items-center justify-between gap-2">
      <h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold"><ListChecks className="h-4 w-4 text-emerald-800" />跟进事项<span className="text-xs font-normal tabular-nums text-stone-500">{active.length}</span></h3>
      <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 gap-1 px-2 text-xs" onClick={() => setArchiveOpen(true)}><Archive className="h-3.5 w-3.5" />存档库 {archived.length}</Button>
    </div>
    <form className="mb-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); if (!name.trim()) return; onAdd(name.trim()); setName(""); }}>
      <Input aria-label="新跟进事项" placeholder="文献、LeetCode 题或其他事项" value={name} onChange={(event) => setName(event.target.value)} className="min-w-0 flex-1 text-xs" />
      <Button type="submit" size="icon-sm" disabled={!name.trim()} aria-label="添加跟进事项"><Plus className="h-4 w-4" /></Button>
    </form>
    <table className="w-full table-fixed text-xs" aria-label="待跟进事项列表">
      <thead><tr className="border-b border-stone-200 text-stone-500"><th className="pb-2 text-left font-medium">事项</th><th className="w-[96px] pb-2 pl-2 text-left font-medium">状态</th></tr></thead>
      <tbody>{active.map((task) => <tr key={task.id} className="border-b border-stone-100 last:border-0"><td className="py-2.5 align-top">{taskName(task)}</td><td className="py-2.5 pl-2 align-top">{statusSelect(task)}</td></tr>)}</tbody>
    </table>
    {!active.length && <p className="py-4 text-center text-xs text-stone-400">暂无待跟进事项</p>}

    <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>跟进事项存档库</DialogTitle></DialogHeader>
        <Input aria-label="搜索已解决事项" placeholder="搜索事项或备注" value={query} onChange={(event) => setQuery(event.target.value)} />
        <div className="max-h-[55vh] overflow-y-auto">
          <table className="w-full table-fixed text-sm" aria-label="已解决事项列表">
            <thead><tr className="border-b border-stone-200 text-xs text-stone-500"><th className="pb-2 text-left font-medium">事项</th><th className="w-20 pb-2 text-left font-medium">解决日期</th><th className="w-10 pb-2"><span className="sr-only">操作</span></th></tr></thead>
            <tbody>{matchingArchive.map((task) => <tr key={task.id} className="border-b border-stone-100"><td className="py-3 pr-3 align-top">{taskName(task)}<span className="mt-1 block text-xs text-emerald-700">已解决</span></td><td className="py-3 text-xs tabular-nums text-stone-500">{task.completedAt ? format(parseISO(task.completedAt), "yyyy/MM/dd") : "—"}</td><td><Button variant="ghost" size="icon-sm" aria-label={`重新跟进：${task.name}`} title="重新跟进" onClick={() => onUpdate(task.id, followUpStatusPatch("pending"))}><RotateCcw className="h-4 w-4" /></Button></td></tr>)}</tbody>
          </table>
          {!matchingArchive.length && <p className="py-8 text-center text-sm text-stone-400">{query.trim() ? "没有匹配的事项" : "暂无已解决事项"}</p>}
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={Boolean(editing && selectedTask)} onOpenChange={(open) => { if (!open) { setEditing(null); setDeleting(false); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>跟进事项详情</DialogTitle></DialogHeader>
        {editing && selectedTask && <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (!editing.name.trim()) return; onUpdate(editing.id, { name: editing.name.trim(), notes: editing.notes.trim() }); setEditing(null); }}>
          <label className="block space-y-1.5 text-xs"><span>事项名称</span><Input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></label>
          <div className="flex items-center gap-3 text-xs"><span>状态</span>{statusSelect(selectedTask)}</div>
          <label className="block space-y-1.5 text-xs"><span>备注 / 解决方法</span><Textarea rows={3} value={editing.notes} onChange={(event) => setEditing({ ...editing, notes: event.target.value })} placeholder="记录卡点、尝试过程或解决方法" /></label>
          <div className="flex justify-between gap-2"><Button type="button" variant="ghost" className="text-red-600" onClick={() => setDeleting(true)}>删除事项</Button><Button type="submit" disabled={!editing.name.trim()}>保存修改</Button></div>
        </form>}
      </DialogContent>
    </Dialog>
    <ConfirmDialog open={deleting && Boolean(editing)} onOpenChange={setDeleting} title="删除跟进事项？" description={editing?.name ?? ""} confirmLabel="删除" onConfirm={() => { if (editing) onDelete(editing.id); setEditing(null); }} />
  </section>;
}
