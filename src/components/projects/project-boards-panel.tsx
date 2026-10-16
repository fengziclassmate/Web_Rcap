"use client";

import { ArrowUpRight, BookOpen, ChevronDown, Flag, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/date-utils";
import { getBoardProgress, isBoardTaskOverdue, type ProjectBoard } from "@/lib/project-boards";

export function ProjectBoardsPanel({ boards, open, onOpenChange, onOpenWorkspace }: {
  boards: ProjectBoard[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenWorkspace: (boardId?: string) => void;
}) {
  const active = boards.filter((board) => !board.archived);
  const overdue = active.reduce((count, board) => count + board.tasks.filter((task) => isBoardTaskOverdue(task, todayISO())).length, 0);
  return <section className="task-dashboard-section dashboard-section-card" aria-label="科研与自学">
    <div className="dashboard-section-heading flex items-center gap-2" data-expanded={open}>
      <BookOpen className="size-4 shrink-0 text-emerald-800" aria-hidden />
      <h3 className="flex-1 text-sm font-semibold text-stone-800">科研与自学</h3>
      <span className="text-xs tabular-nums text-stone-500">{active.length} 个项目</span>
      <Button size="icon-sm" variant="ghost" aria-label={open ? "折叠科研与自学" : "展开科研与自学"} aria-expanded={open} onClick={() => onOpenChange(!open)}><ChevronDown className={`size-3.5 transition-transform ${open ? "" : "-rotate-90"}`} /></Button>
      <Button size="icon-sm" variant="ghost" aria-label="打开科研与自学任务表" title="打开完整任务表" onClick={() => onOpenWorkspace()}><ArrowUpRight className="size-3.5" /></Button>
    </div>
    <div hidden={!open} className="space-y-2.5">
      {overdue > 0 && <p className="rounded-md bg-red-50 px-2.5 py-2 text-xs text-red-800">{overdue} 项任务已逾期，打开任务表安排下一步。</p>}
      {active.map((board) => {
        const progress = getBoardProgress(board);
        const milestone = board.tasks.find((task) => task.milestone && task.status !== "done");
        return <button key={board.id} type="button" onClick={() => onOpenWorkspace(board.id)} className="block w-full rounded-lg border border-stone-200 bg-white p-3 text-left hover:border-emerald-700/40 hover:bg-emerald-50/30 focus-visible:outline-2 focus-visible:outline-primary">
          <span className="flex items-center justify-between gap-2"><span className="min-w-0 truncate text-sm font-medium text-stone-800">{board.name}</span><span className="shrink-0 text-xs tabular-nums text-stone-500">{progress.done}/{progress.total}</span></span>
          <span className="mt-2 block h-1 overflow-hidden rounded-full bg-stone-100"><span className="block h-full rounded-full bg-emerald-700" style={{ width: `${progress.percent}%` }} /></span>
          {milestone && <span className="mt-2 block truncate text-[11px] text-stone-500"><Flag className="mr-1 inline size-3 text-amber-700" />下一里程碑 · {milestone.title}</span>}
        </button>;
      })}
      {!active.length && <p className="text-xs leading-6 text-stone-500">为科研课题或自学方向建一张任务表，记录优先级、子任务和成果。</p>}
      <Button size="sm" variant="outline" className="w-full" onClick={() => onOpenWorkspace()}>{boards.length ? <ArrowUpRight className="size-3.5" /> : <Plus className="size-3.5" />}{boards.length ? "管理项目与任务" : "创建第一个项目"}</Button>
    </div>
  </section>;
}
