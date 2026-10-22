"use client";

import { useRef, useState } from "react";
import { BookOpen, Check, ChevronDown, Search, X } from "lucide-react";
import type { ProjectBoard, ProjectTaskLink } from "@/lib/project-boards";
import { resolveProjectTask } from "@/lib/project-schedule";
import { Input } from "@/components/ui/input";

export function ProjectTaskPicker({ boards, value, onChange }: { boards: ProjectBoard[]; value?: ProjectTaskLink; onChange: (link?: ProjectTaskLink) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const selected = value ? resolveProjectTask(boards, value) : undefined;
  const search = query.trim().toLocaleLowerCase();
  const options = boards.filter((board) => !board.archived).flatMap((board) => board.tasks.flatMap((task) => [
    { link: { boardId: board.id, taskId: task.id }, title: task.title, source: board.name, done: task.status === "done" },
    ...task.subtasks.map((item) => ({ link: { boardId: board.id, taskId: task.id, subtaskId: item.id }, title: item.title, source: `${board.name} / ${task.title}`, done: item.status === "done" })),
  ])).filter((option) => `${option.source} ${option.title}`.toLocaleLowerCase().includes(search));

  return <section className="space-y-2" aria-label="关联科研与自学任务" onKeyDown={(event) => { if (open && event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); } }}>
    <div className="flex items-center gap-1">
      <button ref={trigger} type="button" aria-label="选择科研与自学任务" aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-stone-200 px-2.5 py-2 text-left text-sm hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-primary" onClick={() => setOpen(!open)}>
        <BookOpen aria-hidden className="size-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">{selected ? <><span className="block truncate text-[11px] text-stone-500">{selected.board.name}{value?.subtaskId ? ` / ${selected.task.title}` : ""}</span><span className="block break-words">{selected.item.title}</span></> : value ? "任务已失效，重新选择" : "关联科研与自学任务"}</span>
        <ChevronDown aria-hidden className={`size-3.5 shrink-0 text-stone-400 ${open ? "rotate-180" : ""}`} />
      </button>
      {value && <button type="button" aria-label="解除科研与自学任务关联" title="解除关联" className="grid size-8 shrink-0 place-items-center rounded-md text-stone-500 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-primary" onClick={() => { onChange(undefined); trigger.current?.focus(); }}><X aria-hidden className="size-3.5" /></button>}
    </div>
    {open && <div className="rounded-md border border-stone-200 p-2">
      <div className="relative mb-1"><Search aria-hidden className="absolute left-2 top-2 size-3.5 text-stone-400" /><Input autoFocus aria-label="搜索科研与自学任务" placeholder="搜索项目、任务或子任务" value={query} onChange={(event) => setQuery(event.target.value)} className="h-8 pl-7 text-sm" /></div>
      <div className="max-h-48 space-y-0.5 overflow-y-auto" role="group" aria-label="科研与自学任务选项">
        {options.map((option) => <button key={JSON.stringify(option.link)} type="button" aria-pressed={Boolean(value && value.boardId === option.link.boardId && value.taskId === option.link.taskId && value.subtaskId === ("subtaskId" in option.link ? option.link.subtaskId : undefined))} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-primary" onClick={() => { onChange(option.link); setOpen(false); setQuery(""); trigger.current?.focus(); }}>
          <span className="min-w-0 flex-1"><span className="block break-words text-[11px] text-stone-500">{option.source}</span><span className="block break-words text-sm text-stone-800">{option.title}</span></span>
          {option.done && <Check aria-label="已完成" className="size-3.5 shrink-0 text-stone-400" />}
        </button>)}
        {!options.length && <p className="px-2 py-3 text-center text-xs text-stone-500">{search ? "没有匹配任务" : "暂无可关联任务"}</p>}
      </div>
    </div>}
  </section>;
}
