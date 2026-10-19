"use client";

import { ArrowUpRight, BookOpen, ChevronDown, Flag, FlaskConical, Plus } from "lucide-react";
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
  const today = todayISO();
  const overdue = active.reduce((count, board) => count + board.tasks.filter((task) => isBoardTaskOverdue(task, today)).length, 0);
  return <section className="task-dashboard-section dashboard-section-card project-boards-panel" aria-label="科研与自学">
    <div className="dashboard-section-heading flex items-center gap-2" data-expanded={open}>
      <BookOpen className="size-4 shrink-0 text-primary" aria-hidden />
      <h3 className="flex-1 text-sm font-semibold text-stone-800">科研与自学</h3>
      {overdue > 0 ? <span className="rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-700">{overdue} 逾期</span> : <span className="text-[13px] tabular-nums text-stone-400">{active.length} 个项目</span>}
      <Button size="icon-sm" variant="ghost" aria-label={open ? "折叠科研与自学" : "展开科研与自学"} aria-expanded={open} onClick={() => onOpenChange(!open)}><ChevronDown className={`size-3.5 transition-transform ${open ? "" : "-rotate-90"}`} /></Button>
      <Button size="icon-sm" variant="ghost" aria-label="打开科研与自学任务表" title="项目任务表" onClick={() => onOpenWorkspace()}><ArrowUpRight className="size-3.5" /></Button>
    </div>
    <div hidden={!open}>
      <div className="space-y-1">{active.map((board) => {
        const progress = getBoardProgress(board);
        const milestone = board.tasks.find((task) => task.milestone && task.status !== "done");
        return <button key={board.id} type="button" onClick={() => onOpenWorkspace(board.id)} className="project-summary-row">
          <span className="project-summary-icon">{board.kind === "research" ? <FlaskConical className="size-4" /> : <BookOpen className="size-4" />}</span>
          <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-medium text-stone-700">{board.name}</span>{milestone && <span className="mt-1 block truncate text-xs text-stone-400"><Flag className="mr-1 inline size-2.5" />{milestone.title}</span>}<span className="mt-2 block h-0.5 overflow-hidden rounded-full bg-stone-100"><span className="block h-full rounded-full bg-emerald-700" style={{ width: `${progress.percent}%` }} /></span></span>
          <span className="ml-2 self-start text-[13px] tabular-nums text-stone-400">{progress.done}/{progress.total}</span>
        </button>;
      })}</div>
      {!active.length && <Button size="sm" variant="outline" className="w-full" aria-label={boards.length ? "查看归档项目" : "创建第一个项目"} onClick={() => onOpenWorkspace()}><Plus className="size-3.5" />{boards.length ? "全部项目" : "新建项目"}</Button>}
    </div>
  </section>;
}
