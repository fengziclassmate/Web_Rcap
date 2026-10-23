"use client";

import { useRef, useState } from "react";
import { ArrowLeft, BookOpen, Check, ChevronDown, ChevronRight, FolderClosed, ListTodo, Search, X } from "lucide-react";
import type { ProjectBoard, ProjectTaskLink } from "@/lib/project-boards";
import { resolveProjectTask } from "@/lib/project-schedule";
import { Input } from "@/components/ui/input";

export function ProjectTaskPicker({ boards, value, onChange }: { boards: ProjectBoard[]; value?: ProjectTaskLink; onChange: (link?: ProjectTaskLink) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [directory, setDirectory] = useState<{ boardId: string; taskId?: string } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const selected = value ? resolveProjectTask(boards, value) : undefined;
  const board = boards.find((item) => item.id === directory?.boardId && !item.archived);
  const task = board?.tasks.find((item) => item.id === directory?.taskId);
  const search = query.trim().toLocaleLowerCase();
  const options = (task
    ? task.subtasks.filter((item) => item.status !== "done").map((item) => ({ id: item.id, title: item.title, count: "", done: false }))
    : board
      ? board.tasks.map((item) => ({ id: item.id, title: item.title, count: `${item.subtasks.filter((child) => child.status !== "done").length} 子任务`, done: item.status === "done" }))
      : boards.filter((item) => !item.archived).map((item) => ({ id: item.id, title: item.name, count: `${item.tasks.length} 任务`, done: false }))
  ).filter((option) => option.title.toLocaleLowerCase().includes(search));
  const searchLabel = task ? "搜索子任务" : board ? "搜索任务" : "搜索项目";

  function navigate(next: typeof directory) {
    setDirectory(next); setQuery(""); searchInput.current?.focus();
  }

  function choose(link: ProjectTaskLink) {
    onChange(link); setOpen(false); setQuery(""); trigger.current?.focus();
  }

  return <section className="space-y-2" aria-label="关联科研与自学任务" onKeyDown={(event) => { if (open && event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); } }}>
    <div className="flex items-center gap-1">
      <button ref={trigger} type="button" aria-label="选择科研与自学任务" aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-stone-200 px-2.5 py-2 text-left text-sm hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-primary" onClick={() => { if (!open) { setDirectory(null); setQuery(""); } setOpen(!open); }}>
        <BookOpen aria-hidden className="size-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">{selected ? <><span className="block truncate text-[11px] text-stone-500">{selected.board.name}{value?.subtaskId ? ` / ${selected.task.title}` : ""}</span><span className="block break-words">{selected.item.title}</span></> : value ? "任务已失效，重新选择" : "关联科研与自学任务"}</span>
        <ChevronDown aria-hidden className={`size-3.5 shrink-0 text-stone-400 ${open ? "rotate-180" : ""}`} />
      </button>
      {value && <button type="button" aria-label="解除科研与自学任务关联" title="解除关联" className="grid size-8 shrink-0 place-items-center rounded-md text-stone-500 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-primary" onClick={() => { onChange(undefined); trigger.current?.focus(); }}><X aria-hidden className="size-3.5" /></button>}
    </div>
    {open && <div className="rounded-md border border-stone-200 p-2">
      <nav aria-label="关联任务目录" className="mb-2 flex min-w-0 items-center gap-1 text-xs text-stone-500">
        {board && <button type="button" aria-label="返回上一级" className="grid size-7 shrink-0 place-items-center rounded hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-primary" onClick={() => navigate(task ? { boardId: board.id } : null)}><ArrowLeft aria-hidden className="size-3.5" /></button>}
        <button type="button" aria-current={!board ? "page" : undefined} className="shrink-0 rounded px-1 py-1 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary" onClick={() => navigate(null)}>项目</button>
        {board && <><ChevronRight aria-hidden className="size-3 shrink-0" /><button type="button" aria-current={!task ? "page" : undefined} title={board.name} className="min-w-0 truncate rounded px-1 py-1 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary" onClick={() => navigate({ boardId: board.id })}>{board.name}</button></>}
        {task && <><ChevronRight aria-hidden className="size-3 shrink-0" /><span aria-current="page" title={task.title} className="min-w-0 flex-1 truncate text-stone-700">{task.title}</span></>}
      </nav>
      <div className="relative mb-1"><Search aria-hidden className="absolute left-2 top-2 size-3.5 text-stone-400" /><Input ref={searchInput} autoFocus aria-label={searchLabel} placeholder={searchLabel} value={query} onChange={(event) => setQuery(event.target.value)} className="h-8 pl-7 text-sm" /></div>
      {board && task && <button type="button" aria-label={`选择此任务：${task.title}`} className="mb-1 flex w-full items-center gap-2 rounded bg-stone-50 px-2 py-2 text-left text-xs text-primary hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-primary" onClick={() => choose({ boardId: board.id, taskId: task.id })}><BookOpen aria-hidden className="size-3.5" />选择此任务</button>}
      <div className="max-h-48 space-y-0.5 overflow-y-auto" role="group" aria-label="科研与自学任务选项">
        {options.map((option) => <button key={option.id} type="button" aria-label={`${task ? "选择子任务" : board ? "打开任务" : "打开项目"}：${option.title}`} aria-pressed={task ? value?.boardId === board?.id && value?.taskId === task.id && value?.subtaskId === option.id : undefined} className="flex w-full items-center gap-2 rounded px-2 py-2 text-left hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-primary" onClick={() => { if (board && task) choose({ boardId: board.id, taskId: task.id, subtaskId: option.id }); else navigate(board ? { boardId: board.id, taskId: option.id } : { boardId: option.id }); }}>
          {!task && (board ? <ListTodo aria-hidden className="size-4 shrink-0 text-stone-400" /> : <FolderClosed aria-hidden className="size-4 shrink-0 text-primary" />)}
          <span className="min-w-0 flex-1 break-words text-sm text-stone-800">{option.title}</span>
          {option.count && <span className="shrink-0 text-[11px] tabular-nums text-stone-500">{option.count}</span>}
          {option.done && <Check aria-label="已完成" className="size-3.5 shrink-0 text-stone-500" />}
          {!task && <ChevronRight aria-hidden className="size-3.5 shrink-0 text-stone-400" />}
        </button>)}
        {!options.length && <p className="px-2 py-3 text-center text-xs text-stone-500">{search ? "没有匹配项" : task ? "暂无未完成子任务" : board ? "暂无任务" : "暂无项目"}</p>}
      </div>
    </div>}
  </section>;
}
