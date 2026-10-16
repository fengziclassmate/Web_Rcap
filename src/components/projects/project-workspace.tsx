"use client";

import { useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Archive, ArrowDownToLine, BookOpen, CalendarDays, Check, ChevronDown, ChevronRight, CircleAlert, Flag, FlaskConical, FolderOpen, LayoutGrid, ListTodo, Plus, Search, Settings2, Table2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AnnotatedContent } from "./annotated-content";
import { BoardTaskEditor, ProjectBoardEditor, selectClass } from "./board-editors";
import { createId } from "@/lib/id";
import { todayISO } from "@/lib/date-utils";
import { boardPriorities, boardStatuses, boardTasksToCsv, checklistProgress, createBoardTask, getBoardProgress, isBoardTaskOverdue, matchesBoardScope, normalizeProjectBoards, setBoardTaskStatus, type BoardPriority, type BoardScope, type BoardStatus, type BoardTask, type ProjectBoard } from "@/lib/project-boards";

type TaskRow = { board: ProjectBoard; task: BoardTask };
const kinds = { research: "科研", learning: "自学", other: "其他" };
const scopes = [
  { id: "all", label: "全部任务", icon: ListTodo },
  { id: "today", label: "今天要做", icon: CalendarDays },
  { id: "week", label: "本周计划", icon: CalendarDays },
  { id: "overdue", label: "逾期待处理", icon: CircleAlert },
  { id: "archived", label: "已归档项目", icon: Archive },
] as const;

function download(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function PriorityBadge({ priority }: { priority: BoardPriority }) {
  const item = boardPriorities[priority];
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-medium ${item.className}`} title={item.label}>{item.short}<span>{item.label}</span></span>;
}

function TaskProgress({ task }: { task: BoardTask }) {
  const progress = checklistProgress(task.content);
  if (!progress.total) return <span className="text-xs text-stone-400">未拆分</span>;
  return <span className="inline-flex items-center gap-2 text-xs tabular-nums text-stone-500" title="已完成子任务 / 全部子任务"><span className="h-1 w-12 overflow-hidden rounded-full bg-stone-200"><span className="block h-full rounded-full bg-emerald-700" style={{ width: `${progress.done / progress.total * 100}%` }} /></span>{progress.done}/{progress.total}</span>;
}

export function ProjectWorkspace({ boards, onChange, onCopyToToday, initialSelection }: {
  boards: ProjectBoard[];
  onChange: Dispatch<SetStateAction<ProjectBoard[]>>;
  onCopyToToday: (board: ProjectBoard, task: BoardTask) => void;
  initialSelection?: { boardId: string; taskId?: string; token: number };
}) {
  const today = todayISO();
  const [selectedId, setSelectedId] = useState(initialSelection?.boardId ?? "");
  const [scope, setScope] = useState<BoardScope>("all");
  const [view, setView] = useState<"table" | "board">("table");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [phase, setPhase] = useState("all");
  const [sort, setSort] = useState("priority");
  const [quickTitle, setQuickTitle] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [projectEditor, setProjectEditor] = useState<{ board?: ProjectBoard; template?: "blank" | "research" | "learning" } | null>(null);
  const [taskEditor, setTaskEditor] = useState<{ boardId: string; task: BoardTask; isNew?: boolean } | null>(() => {
    const board = boards.find((item) => item.id === initialSelection?.boardId);
    const task = board?.tasks.find((item) => item.id === initialSelection?.taskId);
    return board && task ? { boardId: board.id, task } : null;
  });
  const [deletion, setDeletion] = useState<{ boardId: string; taskId?: string; name: string } | null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const selected = boards.find((board) => board.id === selectedId);
  const activeBoards = boards.filter((board) => scope === "archived" ? board.archived : !board.archived);
  const sourceBoards = selected ? [selected] : activeBoards;
  const allRows = boards.filter((board) => !board.archived).flatMap((board) => board.tasks.map((task) => ({ board, task })));
  const sourceRows = sourceBoards.flatMap((board) => board.tasks.map((task) => ({ board, task })));
  const phases = [...new Set(sourceRows.map(({ task }) => task.phase).filter(Boolean))];
  const rows = useMemo(() => sourceRows.filter(({ task, board }) => {
    const searchText = [board.name, task.title, task.content, task.notes, task.review, task.phase, ...task.tags].join(" ").toLocaleLowerCase();
    return matchesBoardScope(task, selected ? "all" : scope, today) && (status === "all" || task.status === status) && (priority === "all" || task.priority === priority) && (phase === "all" || task.phase === phase) && query.trim().toLocaleLowerCase().split(/\s+/).every((word) => searchText.includes(word));
  }).sort((a, b) => sort === "priority" ? a.task.priority.localeCompare(b.task.priority) || (a.task.dueDate || "9999").localeCompare(b.task.dueDate || "9999") : sort === "due" ? (a.task.dueDate || "9999").localeCompare(b.task.dueDate || "9999") : a.task.createdAt.localeCompare(b.task.createdAt)), [sourceRows, selected, scope, today, status, priority, phase, query, sort]);
  const doneCount = sourceRows.filter(({ task }) => task.status === "done").length;
  const overdueCount = sourceRows.filter(({ task }) => isBoardTaskOverdue(task, today)).length;
  const blockedCount = sourceRows.filter(({ task }) => task.status === "blocked").length;
  const scopeLabel = scopes.find((item) => item.id === scope)?.label ?? "全部任务";

  function clearFilters() { setQuery(""); setStatus("all"); setPriority("all"); setPhase("all"); }
  function openProject(id: string) { setSelectedId(id); clearFilters(); }
  function updateTask(boardId: string, taskId: string, update: (task: BoardTask) => BoardTask) {
    onChange((previous) => previous.map((board) => board.id === boardId ? { ...board, tasks: board.tasks.map((task) => task.id === taskId ? update(task) : task) } : board));
  }
  function newTask(title = "") {
    if (!selected) { toast.info("先在左侧选择一个项目，再添加任务。"); return; }
    setTaskEditor({ boardId: selected.id, task: createBoardTask(title), isNew: true });
  }
  function saveTask(edited: BoardTask) {
    if (!taskEditor) return;
    const latestBoard = boards.find((board) => board.id === taskEditor.boardId);
    if (!latestBoard || (!taskEditor.isNew && !latestBoard.tasks.some((task) => task.id === edited.id))) {
      toast.error("此任务或项目已在其他页面删除。请备份编辑内容后取消，不会自动恢复已删除的记录。");
      return;
    }
    const initial = taskEditor.task;
    const changes = Object.fromEntries(Object.entries(edited).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(initial[key as keyof BoardTask])));
    const latestTask = latestBoard.tasks.find((task) => task.id === edited.id);
    if (latestTask && Object.keys(changes).some((key) => JSON.stringify(latestTask[key as keyof BoardTask]) !== JSON.stringify(initial[key as keyof BoardTask]) && JSON.stringify(latestTask[key as keyof BoardTask]) !== JSON.stringify(edited[key as keyof BoardTask]))) {
      toast.error("正在编辑的字段已在其他页面更新。请复制当前内容后取消并重新打开任务，核对新版本后保存。");
      return;
    }
    onChange((previous) => previous.map((board) => board.id === taskEditor.boardId ? { ...board, tasks: board.tasks.some((task) => task.id === edited.id) ? board.tasks.map((task) => task.id === edited.id ? { ...task, ...changes } : task) : [...board.tasks, edited] } : board));
    setTaskEditor(null); setQuickTitle("");
  }
  function saveProject(edited: ProjectBoard) {
    const initial = projectEditor?.board;
    if (initial && !boards.some((board) => board.id === initial.id)) {
      toast.error("此项目已在其他页面删除，请复制需要保留的内容后取消编辑。");
      return;
    }
    const changes = initial ? Object.fromEntries(Object.entries(edited).filter(([key, value]) => key !== "tasks" && JSON.stringify(value) !== JSON.stringify(initial[key as keyof ProjectBoard]))) : {};
    onChange((previous) => previous.some((board) => board.id === edited.id) ? previous.map((board) => board.id === edited.id ? { ...board, ...changes } : board) : [...previous, edited]);
    setProjectEditor(null); setScope("all"); openProject(edited.id);
  }
  async function importBoards(file?: File) {
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("请选择小于 5 MB 的项目备份。");
      const backup = JSON.parse(await file.text());
      if (backup.version !== 1 || !Array.isArray(backup.project_boards)) throw new Error("备份格式不正确，请选择本模块导出的 JSON 文件。");
      const restored = normalizeProjectBoards(backup.project_boards);
      if (!restored.length || restored.length !== backup.project_boards.length) throw new Error("备份中没有有效项目，或项目格式不完整。");
      const imported = restored.map((board) => ({ ...board, id: createId("board"), name: `${board.name}（导入）`, tasks: board.tasks.map((task) => ({ ...task, id: createId("board-task") })) }));
      onChange((previous) => [...previous, ...imported]);
      setScope(imported[0].archived ? "archived" : "all"); openProject(imported[0].id);
      toast.success(`已新增 ${imported.length} 个项目，原有项目已保留。`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "导入失败，请检查备份文件。"); }
    finally { if (importInput.current) importInput.current.value = ""; }
  }

  function rowActions({ board, task }: TaskRow) {
    return <div className="flex items-center justify-end gap-1">
      <Button size="icon-sm" variant="ghost" aria-label={`复制到今日：${task.title}`} title="复制到今日待办" disabled={board.archived || task.status === "done"} onClick={() => onCopyToToday(board, task)}><CalendarDays className="size-3.5" /></Button>
      <Button size="icon-sm" variant="ghost" aria-label={`删除任务：${task.title}`} title="删除任务" onClick={() => setDeletion({ boardId: board.id, taskId: task.id, name: task.title })}><Trash2 className="size-3.5" /></Button>
    </div>;
  }

  return <section className="project-workspace module-shell" aria-label="科研与自学工作台">
    <aside className="project-navigation">
      <div className="flex items-center gap-2 px-3 pb-5 pt-2"><span className="flex size-9 items-center justify-center rounded-xl bg-emerald-900 text-white"><BookOpen className="size-4" /></span><div><h2 className="text-sm font-semibold">科研与自学</h2><p className="mt-0.5 text-[11px] text-stone-500">从计划到成果</p></div></div>
      <nav className="space-y-1" aria-label="项目视图">
        {scopes.map(({ id, label, icon: Icon }) => <button type="button" key={id} aria-pressed={!selected && scope === id} onClick={() => { setSelectedId(""); setScope(id); clearFilters(); }} className={`project-nav-item ${!selected && scope === id ? "is-active" : ""}`}><Icon className="size-4" /><span className="flex-1 text-left">{label}</span><span className="text-xs tabular-nums text-stone-500">{id === "archived" ? boards.filter((board) => board.archived).length : allRows.filter(({ task }) => matchesBoardScope(task, id, today)).length}</span></button>)}
      </nav>
      <div className="mb-2 mt-7 flex items-center justify-between px-3"><p className="text-[11px] font-semibold tracking-widest text-stone-500">我的项目 · {activeBoards.length}</p><Button variant="ghost" size="icon-sm" aria-label="新建项目" onClick={() => setProjectEditor({})}><Plus className="size-4" /></Button></div>
      <nav className="space-y-1" aria-label="项目列表">
        {activeBoards.map((board) => <button key={board.id} type="button" aria-pressed={selected?.id === board.id} onClick={() => openProject(board.id)} className={`project-nav-item ${selected?.id === board.id ? "is-active" : ""}`}>
          {board.kind === "research" ? <FlaskConical className="size-4 shrink-0 text-sky-700" /> : board.kind === "learning" ? <BookOpen className="size-4 shrink-0 text-emerald-800" /> : <FolderOpen className="size-4 shrink-0" />}
          <span className="min-w-0 flex-1 truncate text-left" title={board.name}>{board.name}</span><span className="text-xs tabular-nums text-stone-500">{getBoardProgress(board).done}/{board.tasks.length}</span>
        </button>)}
        {!activeBoards.length && <p className="px-3 py-3 text-xs leading-6 text-stone-400">{scope === "archived" ? "还没有归档项目" : "把一个长期目标建成项目，再拆成可执行的任务。"}</p>}
      </nav>
      <div className="mt-auto space-y-2 border-t border-stone-200 px-2 pt-5">
        <Button variant="outline" className="w-full justify-start" size="sm" onClick={() => download(JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), project_boards: boards }, null, 2), `科研自学项目-${today}.json`, "application/json")} disabled={!boards.length}><ArrowDownToLine className="size-3.5" />备份全部项目</Button>
        <Button variant="ghost" className="w-full justify-start text-stone-500" size="sm" onClick={() => importInput.current?.click()}><Upload className="size-3.5" />从备份导入</Button>
        <input ref={importInput} type="file" accept=".json,application/json" aria-label="导入项目备份" className="hidden" onChange={(event) => void importBoards(event.target.files?.[0])} />
      </div>
    </aside>

    <div className="min-w-0 flex-1">
      <header className="border-b border-stone-200 px-7 py-6">
        <div className="mb-3 flex items-center gap-2 text-xs text-stone-500"><BookOpen className="size-3.5" />科研与自学<ChevronRight className="size-3" /><span>{selected ? kinds[selected.kind] : "项目总览"}</span>{selected?.archived && <span className="rounded bg-stone-100 px-2 py-0.5">已归档</span>}</div>
        <div className="flex items-start justify-between gap-4"><div className="min-w-0"><h1 className="break-words text-2xl font-semibold tracking-tight text-stone-900">{selected?.name ?? scopeLabel}</h1><p className="mt-2 max-w-3xl whitespace-pre-wrap break-words text-sm leading-6 text-stone-500">{selected?.goal || (selected ? "在项目设置中写下目标与验收标准，让每项任务都有方向。" : "把长期目标拆成清晰的下一步，让每一次投入都留下进展。")}</p>{selected?.targetDate && <p className="mt-2 text-xs text-stone-500">目标日期 · {selected.targetDate}</p>}</div>
          <div className="flex shrink-0 items-center gap-2">
            {selected ? <><Button variant="outline" size="sm" aria-label="项目设置" onClick={() => setProjectEditor({ board: selected })}><Settings2 className="size-3.5" />设置</Button><Button size="sm" disabled={selected.archived} onClick={() => newTask()}><Plus className="size-4" />新任务</Button></> : <Button size="sm" onClick={() => setProjectEditor({})}><Plus className="size-4" />新项目</Button>}
          </div>
        </div>
        {selected?.description && <details className="mt-3 text-xs text-stone-500"><summary className="cursor-pointer">项目说明</summary><p className="mt-2 whitespace-pre-wrap break-words leading-6">{selected.description}</p></details>}
        <div className="mt-6 grid grid-cols-4 gap-5" aria-label="项目统计">
          {[{ label: "任务总数", value: sourceRows.length, color: "text-stone-900" }, { label: "已完成", value: doneCount, color: "text-emerald-800" }, { label: "逾期待处理", value: overdueCount, color: overdueCount ? "text-red-700" : "text-stone-900" }, { label: "有阻塞", value: blockedCount, color: blockedCount ? "text-amber-700" : "text-stone-900" }].map((stat) => <div key={stat.label} className="border-l border-stone-200 pl-4 first:border-0 first:pl-0"><p className="text-xs text-stone-500">{stat.label}</p><p className={`mt-1 text-2xl font-semibold tabular-nums ${stat.color}`}>{stat.value}<span className="ml-1 text-xs font-normal text-stone-400">项</span></p></div>)}
        </div>
        {selected && <div className="mt-5 flex items-center gap-3"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-emerald-800 transition-all" style={{ width: `${getBoardProgress(selected).percent}%` }} /></div><span className="text-xs tabular-nums text-stone-500">任务完成 {getBoardProgress(selected).percent}%</span></div>}
      </header>

      {!boards.length ? <div className="px-8 py-14"><div className="mx-auto max-w-3xl"><p className="text-xs font-semibold tracking-wider text-emerald-800">开始一个值得持续推进的项目</p><h2 className="mt-3 text-xl font-semibold">研究有线索，学习有路径。</h2><p className="mt-3 text-sm leading-7 text-stone-500">每个项目都有独立任务表。用阶段整理路径，用子任务记录进度，选中文字即可标出重点与完成内容。</p><div className="mt-7 grid grid-cols-3 gap-4">{([{ template: "research", title: "科研项目", detail: "研究问题 → 数据 → 验证 → 成果", icon: FlaskConical }, { template: "learning", title: "自学计划", detail: "学习目标 → 练习 → 检验 → 复盘", icon: BookOpen }, { template: "blank", title: "空白项目", detail: "从自己的方法开始，自由组织任务", icon: FolderOpen }] as const).map(({ template, title, detail, icon: Icon }) => <button type="button" key={template} onClick={() => setProjectEditor({ template })} className="rounded-xl border border-stone-200 bg-stone-50/50 p-5 text-left transition-colors hover:border-emerald-700 hover:bg-emerald-50/50 focus-visible:outline-2 focus-visible:outline-emerald-800"><Icon className="mb-5 size-6 text-emerald-800" /><span className="block text-sm font-semibold">{title}</span><span className="mt-2 block text-xs leading-6 text-stone-500">{detail}</span><span className="mt-5 block text-xs font-medium text-emerald-800">创建任务表 →</span></button>)}</div></div></div> : <>
        <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 bg-stone-50/50 px-5 py-3">
          <div className="mr-2 inline-flex rounded-lg border border-stone-200 bg-white p-0.5" aria-label="展示方式"><Button size="sm" variant={view === "table" ? "secondary" : "ghost"} aria-pressed={view === "table"} onClick={() => setView("table")}><Table2 className="size-3.5" />任务表</Button><Button size="sm" variant={view === "board" ? "secondary" : "ghost"} aria-pressed={view === "board"} onClick={() => setView("board")}><LayoutGrid className="size-3.5" />看板</Button></div>
          <div className="relative min-w-40 flex-1"><Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-stone-400" /><Input aria-label="搜索项目任务" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索任务、内容、备注、标签…" className="h-9 bg-white pl-8" /></div>
          <select aria-label="筛选任务状态" className={`${selectClass} !w-auto`} value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">全部状态</option>{Object.entries(boardStatuses).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
          <select aria-label="筛选任务优先级" className={`${selectClass} !w-auto`} value={priority} onChange={(event) => setPriority(event.target.value)}><option value="all">全部优先级</option>{Object.entries(boardPriorities).map(([id, item]) => <option key={id} value={id}>{item.short} · {item.label}</option>)}</select>
          <select aria-label="筛选任务阶段" className={`${selectClass} !w-auto max-w-36`} value={phase} onChange={(event) => setPhase(event.target.value)}><option value="all">全部阶段</option>{phases.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <select aria-label="任务排序" className={`${selectClass} !w-auto`} value={sort} onChange={(event) => setSort(event.target.value)}><option value="priority">按优先级</option><option value="due">按截止日期</option><option value="created">按创建顺序</option></select>
          <Button size="icon-sm" variant="ghost" aria-label="导出当前任务为 CSV" title="导出当前筛选结果为 CSV" disabled={!rows.length} onClick={() => download(boardTasksToCsv(rows), `${selected?.name ?? scopeLabel}-${today}.csv`, "text/csv;charset=utf-8")}><ArrowDownToLine className="size-4" /></Button>
        </div>
        <div className="flex items-center justify-between gap-3 px-6 py-3 text-xs text-stone-500"><span>显示 {rows.length} / {sourceRows.length} 项{(query || status !== "all" || priority !== "all" || phase !== "all") && <button type="button" className="ml-3 text-emerald-800 underline" onClick={clearFilters}>清除筛选</button>}</span><span>展开行可直接勾选子任务 · 点击名称编辑标注</span></div>
        {view === "table" ? <div className="overflow-x-auto"><table className="project-task-table"><thead><tr><th className="w-8"><span className="sr-only">完成状态</span></th><th className="min-w-64">任务名称 / 子任务进度</th><th>阶段 / 标签</th><th>轻重缓急</th><th>状态</th><th>计划 / 截止</th><th className="w-20"><span className="sr-only">操作</span></th></tr></thead><tbody>
          {rows.map(({ board, task }) => <TaskTableRow key={`${board.id}:${task.id}`} board={board} task={task} today={today} expanded={expanded.includes(task.id)} showProject={!selected} onExpand={() => setExpanded((previous) => previous.includes(task.id) ? previous.filter((id) => id !== task.id) : [...previous, task.id])} onEdit={() => setTaskEditor({ boardId: board.id, task })} onUpdate={(update) => updateTask(board.id, task.id, update)} actions={rowActions({ board, task })} />)}
        </tbody></table></div> : <div className="grid grid-cols-4 gap-3 px-5 pb-5">{Object.entries(boardStatuses).map(([id, label]) => <section key={id} className="min-w-0 rounded-xl border border-stone-200 bg-stone-50/70 p-3"><h3 className="mb-3 flex justify-between text-xs font-semibold text-stone-700">{label}<span className="font-normal text-stone-400">{rows.filter(({ task }) => task.status === id).length}</span></h3><div className="space-y-3">{rows.filter(({ task }) => task.status === id).map(({ board, task }) => <article key={`${board.id}:${task.id}`} className="rounded-lg border border-stone-200 bg-white p-3 shadow-xs"><p className="mb-2 text-[11px] text-stone-400">{selected ? task.phase || "未设置阶段" : board.name}</p><button type="button" onClick={() => setTaskEditor({ boardId: board.id, task })} className="text-left text-sm font-medium leading-6 hover:text-emerald-800">{task.milestone && <Flag className="mr-1 inline size-3 text-amber-700" />}{task.title}</button><div className="mt-3"><PriorityBadge priority={task.priority} /></div><div className="mt-3 flex items-center justify-between"><TaskProgress task={task} /><span className={`text-[11px] ${isBoardTaskOverdue(task, today) ? "text-red-700" : "text-stone-400"}`}>{task.dueDate || "无截止日"}</span></div><div className="mt-3 flex items-center gap-1 border-t border-stone-100 pt-2"><select aria-label={`状态：${task.title}`} className="min-w-0 flex-1 bg-transparent text-xs text-stone-600" value={task.status} onChange={(event) => updateTask(board.id, task.id, (previous) => setBoardTaskStatus(previous, event.target.value as BoardStatus))}>{Object.entries(boardStatuses).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select>{rowActions({ board, task })}</div></article>)}{!rows.some(({ task }) => task.status === id) && <p className="py-6 text-center text-xs text-stone-400">暂无任务</p>}</div></section>)}</div>}
        {!rows.length && <div className="px-6 py-12 text-center"><Check className="mx-auto mb-3 size-7 text-stone-300" /><p className="text-sm text-stone-500">{sourceRows.length ? "当前视图没有匹配的任务" : selected ? "还没有任务，从一个具体的下一步开始。" : scope === "archived" ? "归档后的项目会出现在这里。" : "选择左侧项目查看任务，或创建一个新项目。"}</p></div>}
        {selected && !selected.archived && <form className="mx-5 mb-5 flex gap-2 rounded-lg border border-dashed border-stone-300 px-3 py-2" onSubmit={(event) => { event.preventDefault(); if (quickTitle.trim()) newTask(quickTitle.trim()); }}><Plus className="mt-2 size-4 shrink-0 text-stone-400" /><Input aria-label="快速添加任务" value={quickTitle} onChange={(event) => setQuickTitle(event.target.value)} placeholder="写下下一步，按 Enter 补充详情…" className="border-0 shadow-none focus-visible:ring-0" /><Button type="submit" size="sm" variant="ghost" disabled={!quickTitle.trim()}>添加任务</Button></form>}
        {selected && <footer className="flex items-center justify-between border-t border-stone-200 px-6 py-4 text-xs text-stone-400"><span>完成任务后记录成果与复盘，让进度可以回顾。</span><div className="flex gap-3"><button type="button" className="hover:text-emerald-800" onClick={() => { onChange((previous) => previous.map((board) => board.id === selected.id ? { ...board, archived: !board.archived } : board)); setSelectedId(""); setScope(selected.archived ? "all" : "archived"); clearFilters(); }}>{selected.archived ? "恢复项目" : "归档项目"}</button><button type="button" className="hover:text-red-700" onClick={() => setDeletion({ boardId: selected.id, name: selected.name })}>删除项目</button></div></footer>}
      </>}
    </div>
    {projectEditor && <ProjectBoardEditor key={projectEditor.board?.id ?? projectEditor.template ?? "new"} {...projectEditor} onSave={saveProject} onClose={() => setProjectEditor(null)} />}
    {taskEditor && <BoardTaskEditor key={taskEditor.task.id} task={taskEditor.task} projectName={boards.find((board) => board.id === taskEditor.boardId)?.name ?? "项目"} onSave={saveTask} onClose={() => setTaskEditor(null)} />}
    <ConfirmDialog open={Boolean(deletion)} onOpenChange={(open) => { if (!open) setDeletion(null); }} title={deletion?.taskId ? "删除这项任务？" : "删除整个项目？"} description={`“${deletion?.name ?? ""}”${deletion?.taskId ? "将从任务表移除。" : "及其全部任务将被移除。暂时结束的项目可以使用归档保留记录。"}可使用工作台顶部的撤销恢复。`} confirmLabel="确认删除" onConfirm={() => { if (!deletion) return; onChange((previous) => deletion.taskId ? previous.map((board) => board.id === deletion.boardId ? { ...board, tasks: board.tasks.filter((task) => task.id !== deletion.taskId) } : board) : previous.filter((board) => board.id !== deletion.boardId)); setDeletion(null); }} />
  </section>;
}

function TaskTableRow({ board, task, today, expanded, showProject, onExpand, onEdit, onUpdate, actions }: TaskRow & { today: string; expanded: boolean; showProject: boolean; onExpand: () => void; onEdit: () => void; onUpdate: (update: (task: BoardTask) => BoardTask) => void; actions: React.ReactNode }) {
  return <>
    <tr className={task.status === "done" ? "is-completed" : ""}>
      <td><input type="checkbox" aria-label={`完成任务：${task.title}`} checked={task.status === "done"} onChange={(event) => onUpdate((previous) => setBoardTaskStatus(previous, event.target.checked ? "done" : "todo"))} className="size-4 accent-emerald-800" /></td>
      <td><div className="flex items-start gap-1.5"><button type="button" aria-label={`${expanded ? "收起" : "展开"}任务：${task.title}`} aria-expanded={expanded} onClick={onExpand} className="mt-0.5 rounded p-0.5 text-stone-400 hover:bg-stone-100">{expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}</button><div className="min-w-0"><button type="button" className={`break-words text-left text-sm font-medium leading-6 hover:text-emerald-800 ${task.status === "done" ? "text-stone-500 line-through" : "text-stone-800"}`} onClick={onEdit}>{task.milestone && <Flag aria-label="里程碑" className="mr-1 inline size-3 text-amber-700" />}{task.title}</button><div className="mt-1 flex flex-wrap items-center gap-2">{showProject && <span className="max-w-32 truncate text-[11px] text-stone-400" title={board.name}>{board.name}</span>}<TaskProgress task={task} /></div></div></div></td>
      <td><p className="max-w-40 truncate text-xs text-stone-600" title={task.phase}>{task.phase || "—"}</p><div className="mt-1 flex max-w-44 flex-wrap gap-1">{task.tags.slice(0, 3).map((tag) => <span key={tag} className="max-w-28 truncate rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500" title={tag}>{tag}</span>)}{task.tags.length > 3 && <span className="text-[10px] text-stone-400" title={task.tags.slice(3).join("、")}>+{task.tags.length - 3}</span>}</div></td>
      <td><select aria-label={`优先级：${task.title}`} className={`max-w-40 rounded-md border px-1.5 py-1.5 text-[11px] ${boardPriorities[task.priority].className}`} value={task.priority} onChange={(event) => onUpdate((previous) => ({ ...previous, priority: event.target.value as BoardPriority }))}>{Object.entries(boardPriorities).map(([id, item]) => <option key={id} value={id}>{item.short} · {item.label}</option>)}</select></td>
      <td><select aria-label={`状态：${task.title}`} value={task.status} onChange={(event) => onUpdate((previous) => setBoardTaskStatus(previous, event.target.value as BoardStatus))} className={`rounded-md border border-transparent bg-transparent p-1 text-xs ${task.status === "done" ? "text-emerald-700" : task.status === "blocked" ? "text-amber-700" : task.status === "doing" ? "text-blue-700" : "text-stone-500"}`}>{Object.entries(boardStatuses).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></td>
      <td className="whitespace-nowrap text-[11px] tabular-nums"><p className="text-stone-400">{task.plannedDate ? `计划 ${task.plannedDate.slice(5).replace("-", "/")}` : "未安排"}</p><p className={`mt-1 ${isBoardTaskOverdue(task, today) ? "font-medium text-red-700" : "text-stone-500"}`}>{task.dueDate ? `${isBoardTaskOverdue(task, today) ? "逾期" : "截止"} ${task.dueDate}` : "无截止日期"}</p></td>
      <td>{actions}</td>
    </tr>
    {expanded && <tr><td colSpan={7} className="!bg-stone-50/70 !px-8 !py-5"><div className="grid grid-cols-3 gap-6">{([['content', '任务内容'], ['notes', '备注与资料'], ['review', '成果与复盘']] as const).map(([field, label]) => <div key={field} className="min-w-0"><p className="mb-3 text-[11px] font-semibold text-stone-500">{label}</p><AnnotatedContent value={task[field]} onChange={(value) => onUpdate((previous) => ({ ...previous, [field]: value }))} /></div>)}</div><Button size="sm" variant="ghost" className="mt-4 text-emerald-800" onClick={onEdit}>编辑内容与标注 →</Button></td></tr>}
  </>;
}
