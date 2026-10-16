"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AnnotatedEditor } from "./annotated-content";
import { boardPriorities, boardStatuses, createProjectBoard, setBoardTaskStatus, type BoardTask, type ProjectBoard } from "@/lib/project-boards";

export const selectClass = "h-9 w-full rounded-md border border-input bg-white px-2 text-sm focus-visible:outline-2 focus-visible:outline-emerald-800";
const fieldClass = "block space-y-1.5 text-xs font-medium text-stone-600";

function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const preventLoss = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, [dirty]);
}

export function BoardTaskEditor({ task, projectName, onSave, onClose }: { task: BoardTask; projectName: string; onSave: (task: BoardTask) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(task);
  const [tab, setTab] = useState<"content" | "notes" | "review">("content");
  const [discard, setDiscard] = useState(false);
  const [tags, setTags] = useState(task.tags.join("、"));
  const dirty = JSON.stringify(draft) !== JSON.stringify(task) || tags !== task.tags.join("、");
  useUnsavedChanges(dirty);
  function close() { if (dirty) setDiscard(true); else onClose(); }
  const patch = (value: Partial<BoardTask>) => setDraft((previous) => ({ ...previous, ...value }));
  return <>
    <Dialog open onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader><DialogTitle>任务详情</DialogTitle><DialogDescription className="sr-only">{projectName}</DialogDescription></DialogHeader>
        <form onSubmit={(event) => { event.preventDefault(); if (draft.title.trim()) onSave({ ...draft, title: draft.title.trim(), tags: [...new Set(tags.split(/[,，、]/).map((tag) => tag.trim()).filter(Boolean))] }); }}>
          <Input aria-label="任务名称" autoFocus required value={draft.title} onChange={(event) => patch({ title: event.target.value })} placeholder="任务名称" className="mb-5 h-12 text-lg font-semibold" />
          <div className="grid grid-cols-[minmax(0,1fr)_200px] gap-5">
            <div className="min-w-0">
              <div className="mb-3 flex gap-1 border-b border-stone-200" role="tablist" aria-label="任务信息">
                {([['content', '任务内容'], ['notes', '备注与资料'], ['review', '成果与复盘']] as const).map(([id, name]) => <button key={id} id={`task-tab-${id}`} type="button" role="tab" aria-selected={tab === id} aria-controls={`task-panel-${id}`} tabIndex={tab === id ? 0 : -1} onKeyDown={(event) => { const tabs = ['content', 'notes', 'review'] as const; if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return; event.preventDefault(); const next = tabs[(tabs.indexOf(tab) + (event.key === 'ArrowRight' ? 1 : 2)) % 3]; setTab(next); document.getElementById(`task-tab-${next}`)?.focus(); }} onClick={() => setTab(id)} className={`border-b-2 px-3 py-2 text-sm ${tab === id ? "border-emerald-800 font-semibold text-emerald-900" : "border-transparent text-stone-500"}`}>{name}</button>)}
              </div>
              <div role="tabpanel" id={`task-panel-${tab}`} aria-labelledby={`task-tab-${tab}`}>
                <AnnotatedEditor key={tab} label={{ content: "任务内容", notes: "备注与资料", review: "成果与复盘" }[tab]} value={draft[tab]} onChange={(value) => patch({ [tab]: value })} placeholder={{ content: "任务内容…", notes: "备注、资料链接…", review: "成果与复盘…" }[tab]} />
              </div>
            </div>
            <div className="space-y-4 rounded-xl bg-stone-50 p-4">
              <label className={fieldClass}>任务状态<select aria-label="任务状态" className={selectClass} value={draft.status} onChange={(event) => setDraft((previous) => setBoardTaskStatus(previous, event.target.value as BoardTask['status']))}>{Object.entries(boardStatuses).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
              <label className={fieldClass}>轻重缓急<select aria-label="任务优先级" className={selectClass} value={draft.priority} onChange={(event) => patch({ priority: event.target.value as BoardTask['priority'] })}>{Object.entries(boardPriorities).map(([id, priority]) => <option key={id} value={id}>{priority.short} · {priority.label}</option>)}</select></label>
              <label className={fieldClass}>阶段<Input aria-label="任务阶段" value={draft.phase} onChange={(event) => patch({ phase: event.target.value })} placeholder="阶段" /></label>
              <label className={fieldClass}>计划执行日期<Input aria-label="计划执行日期" type="date" value={draft.plannedDate} onChange={(event) => patch({ plannedDate: event.target.value })} /></label>
              <label className={fieldClass}>截止日期<Input aria-label="任务截止日期" type="date" value={draft.dueDate} onChange={(event) => patch({ dueDate: event.target.value })} /></label>
              <label className={fieldClass}>标签<Input aria-label="任务标签" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="文献, 数据" /></label>
              <label className="flex items-center gap-2 text-sm text-stone-700"><input type="checkbox" checked={draft.milestone} onChange={(event) => patch({ milestone: event.target.checked })} className="accent-emerald-800" />设为里程碑</label>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2 border-t border-stone-200 pt-4"><Button type="button" variant="outline" onClick={close}>取消</Button><Button type="submit" disabled={!draft.title.trim()}>保存任务</Button></div>
        </form>
      </DialogContent>
    </Dialog>
    <ConfirmDialog open={discard} onOpenChange={setDiscard} title="放弃尚未保存的修改？" description="任务详情中的修改还没有保存。可取消并返回继续编辑。" confirmLabel="放弃修改" onConfirm={onClose} />
  </>;
}

export function ProjectBoardEditor({ board, template = "blank", onSave, onClose }: { board?: ProjectBoard; template?: "blank" | "research" | "learning"; onSave: (board: ProjectBoard) => void; onClose: () => void }) {
  const [initial] = useState(() => board ?? createProjectBoard(template, ""));
  const [draft, setDraft] = useState(initial);
  const [discard, setDiscard] = useState(false);
  const dirty = JSON.stringify(initial) !== JSON.stringify(draft);
  useUnsavedChanges(dirty);
  const patch = (value: Partial<ProjectBoard>) => setDraft((previous) => ({ ...previous, ...value }));
  function close() { if (dirty) setDiscard(true); else onClose(); }
  return <>
    <Dialog open onOpenChange={(open) => { if (!open) close(); }}><DialogContent className="sm:max-w-xl">
      <DialogHeader><DialogTitle>{board ? "项目设置" : "创建项目任务表"}</DialogTitle><DialogDescription className="sr-only">项目名称、分类与目标</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (draft.name.trim()) onSave({ ...draft, name: draft.name.trim() }); }}>
        <label className={fieldClass}>项目名称<Input autoFocus required aria-label="项目名称" value={draft.name} onChange={(event) => patch({ name: event.target.value })} placeholder="城市用地诊断 / LeetCode" /></label>
        <div className="grid grid-cols-2 gap-4"><label className={fieldClass}>项目分类<select className={selectClass} aria-label="项目分类" value={draft.kind} onChange={(event) => patch({ kind: event.target.value as ProjectBoard['kind'] })}><option value="research">科研</option><option value="learning">自学</option><option value="other">其他</option></select></label><label className={fieldClass}>目标日期<Input aria-label="项目目标日期" type="date" value={draft.targetDate} onChange={(event) => patch({ targetDate: event.target.value })} /></label></div>
        <label className={fieldClass}>目标与验收标准<Textarea aria-label="项目目标与验收标准" rows={3} value={draft.goal} onChange={(event) => patch({ goal: event.target.value })} placeholder="目标与验收标准" /></label>
        <label className={fieldClass}>项目说明<Textarea aria-label="项目说明" rows={3} value={draft.description} onChange={(event) => patch({ description: event.target.value })} placeholder="项目说明" /></label>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={close}>取消</Button><Button type="submit" disabled={!draft.name.trim()}>{board ? "保存项目" : "创建项目"}</Button></div>
      </form>
    </DialogContent></Dialog>
    <ConfirmDialog open={discard} onOpenChange={setDiscard} title="放弃项目修改？" description="这些修改尚未保存。" confirmLabel="放弃修改" onConfirm={onClose} />
  </>;
}
