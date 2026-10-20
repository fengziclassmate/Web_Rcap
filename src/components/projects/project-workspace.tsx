"use client";

import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Archive, ArrowDownToLine, ArrowUpDown, BookOpen, CalendarDays, CalendarPlus, ChevronDown, ChevronRight, CircleAlert, Flag, FlaskConical, FolderOpen, GripVertical, LayoutGrid, ListTodo, Play, Plus, Search, Settings2, SlidersHorizontal, Table2, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AnnotatedContent } from "./annotated-content";
import { InlineProjectText, ProjectTableColumns, SubtaskTable, TaskDateControls, TaskPriorityControl, TaskStatusControl } from "./subtask-table";
import { ProjectScheduleDialog } from "./project-schedule-dialog";
import { findProjectSchedule, resolveProjectTask, type ProjectScheduleTime } from "@/lib/project-schedule";
import type { ScheduleEvent } from "@/lib/types";
import type { ProjectTaskLink } from "@/lib/project-boards";
import { useRowReorder } from "./use-row-reorder";
import { BoardTaskEditor, ProjectBoardEditor, selectClass } from "./board-editors";
import { createId } from "@/lib/id";
import { todayISO } from "@/lib/date-utils";
import { boardPriorities, boardStatuses, boardTasksToCsv, compareCompletion, createBoardTask, getTaskSubtaskProgress, isBoardTaskOverdue, matchesBoardScope, normalizeProjectBoards, reorderProjectBoards, reorderVisibleRecords, setBoardTaskStatus, type BoardPriority, type BoardScope, type BoardStatus, type BoardTask, type ProjectBoard } from "@/lib/project-boards";

type TaskRow = { board: ProjectBoard; task: BoardTask };
const taskSortId = ({ board, task }: TaskRow) => JSON.stringify([board.id, task.id]);
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
  return <span className={`project-priority-badge priority-${priority}`} title={item.label}>{item.short}<span>{item.label}</span></span>;
}

function TaskProgress({ task }: { task: BoardTask }) {
  const progress = getTaskSubtaskProgress(task);
  if (!progress.total) return null;
  return <span className="inline-flex items-center gap-2 text-[13px] tabular-nums text-stone-500" title="已完成子任务 / 全部子任务"><span className="h-1 w-12 overflow-hidden rounded-full bg-stone-200"><span className="block h-full rounded-full bg-emerald-700" style={{ width: `${progress.done / progress.total * 100}%` }} /></span>{progress.done}/{progress.total}</span>;
}

export function ProjectWorkspace({ boards, onChange, onCopyToToday, onStartFocus, initialSelection, expandedTasks, onExpandedTasksChange, events = [], onSaveSchedule, onRemoveSchedule, onViewSchedule }: {
  boards: ProjectBoard[];
  onChange: Dispatch<SetStateAction<ProjectBoard[]>>;
  onCopyToToday: (board: ProjectBoard, task: BoardTask) => void;
  onStartFocus?: (board: ProjectBoard, task: BoardTask) => void;
  initialSelection?: { boardId: string; taskId?: string; token: number };
  expandedTasks?: string[];
  onExpandedTasksChange?: Dispatch<SetStateAction<string[]>>;
  events?: ScheduleEvent[];
  onSaveSchedule?: (link: ProjectTaskLink, time: ProjectScheduleTime) => boolean;
  onRemoveSchedule?: (link: ProjectTaskLink) => void;
  onViewSchedule?: (event: ScheduleEvent) => void;
}) {
  const today = todayISO();
  const [selectedId, setSelectedId] = useState(initialSelection?.boardId ?? "");
  const [scope, setScope] = useState<BoardScope>("all");
  const [view, setView] = useState<"table" | "board">("table");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [phase, setPhase] = useState("all");
  const [sort, setSort] = useState("manual");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [localExpanded, setLocalExpanded] = useState<string[]>([]);
  const expanded = expandedTasks ?? localExpanded;
  const setExpanded = onExpandedTasksChange ?? setLocalExpanded;
  const [projectEditor, setProjectEditor] = useState<{ board?: ProjectBoard; template?: "blank" | "research" | "learning" } | null>(null);
  const [taskEditor, setTaskEditor] = useState<{ boardId: string; task: BoardTask; isNew?: boolean } | null>(() => {
    const board = boards.find((item) => item.id === initialSelection?.boardId);
    const task = board?.tasks.find((item) => item.id === initialSelection?.taskId);
    return board && task ? { boardId: board.id, task } : null;
  });
  const [deletion, setDeletion] = useState<{ boardId: string; taskId?: string; name: string } | null>(null);
  const [scheduleLink, setScheduleLink] = useState<ProjectTaskLink | null>(null);
  const scheduleTarget = scheduleLink ? resolveProjectTask(boards, scheduleLink) : undefined;
  const importInput = useRef<HTMLInputElement>(null);
  const draggingProject = useRef<string | null>(null);
  const projectHandles = useRef(new Map<string, HTMLButtonElement>());
  const [dropProject, setDropProject] = useState<string | null>(null);
  const [sortAnnouncement, setSortAnnouncement] = useState("");
  const selected = boards.find((board) => board.id === selectedId);
  const activeBoards = boards.filter((board) => scope === "archived" ? board.archived : !board.archived);
  const sourceBoards = selected ? [selected] : activeBoards;
  const allRows = boards.filter((board) => !board.archived).flatMap((board) => board.tasks.map((task) => ({ board, task })));
  const sourceRows = sourceBoards.flatMap((board) => board.tasks.map((task) => ({ board, task })));
  const phases = [...new Set(sourceRows.map(({ task }) => task.phase).filter(Boolean))];
  const rows = sourceRows.filter(({ task, board }) => {
    const searchText = [board.name, task.title, task.content, task.notes, task.review, task.phase, ...task.tags, ...task.subtasks.flatMap((item) => [item.title, item.notes])].join(" ").toLocaleLowerCase();
    return matchesBoardScope(task, selected ? "all" : scope, today) && (status === "all" || task.status === status) && (priority === "all" || task.priority === priority) && (phase === "all" || task.phase === phase) && query.trim().toLocaleLowerCase().split(/\s+/).every((word) => searchText.includes(word));
  }).sort((a, b) => compareCompletion(a.task, b.task) || (sort === "manual" ? 0 : sort === "priority" ? a.task.priority.localeCompare(b.task.priority) || (a.task.dueDate || "9999").localeCompare(b.task.dueDate || "9999") : sort === "due" ? (a.task.dueDate || "9999").localeCompare(b.task.dueDate || "9999") : a.task.createdAt.localeCompare(b.task.createdAt)));
  const taskSorting = useRowReorder(rows.map((row) => ({ id: taskSortId(row), group: JSON.stringify([row.board.id, view === "board" ? row.task.status : row.task.status === "done"]), label: `任务：${row.task.title}` })), (sourceId, targetId) => {
    const source = rows.find((row) => taskSortId(row) === sourceId);
    const target = rows.find((row) => taskSortId(row) === targetId);
    if (!source || !target || source.board.id !== target.board.id || compareCompletion(source.task, target.task) || view === "board" && source.task.status !== target.task.status) return;
    const visibleIds = rows.filter((row) => row.board.id === source.board.id && !compareCompletion(row.task, source.task) && (view !== "board" || row.task.status === source.task.status)).map((row) => row.task.id);
    onChange((previous) => previous.map((board) => board.id === source.board.id ? { ...board, tasks: reorderVisibleRecords(board.tasks, source.task.id, target.task.id, visibleIds) } : board));
    setSort("manual");
  });
  const doneCount = sourceRows.filter(({ task }) => task.status === "done").length;
  const overdueCount = sourceRows.filter(({ task }) => isBoardTaskOverdue(task, today)).length;
  const blockedCount = sourceRows.filter(({ task }) => task.status === "blocked").length;
  const scopeLabel = scopes.find((item) => item.id === scope)?.label ?? "全部任务";

  function clearFilters() { setQuery(""); setStatus("all"); setPriority("all"); setPhase("all"); }
  function openProject(id: string) { setSelectedId(id); clearFilters(); }
  function moveProject(sourceId: string, targetId: string) {
    onChange((previous) => reorderProjectBoards(previous, sourceId, targetId));
    const name = boards.find((board) => board.id === sourceId)?.name;
    if (name) setSortAnnouncement(`已调整${name}的项目顺序`);
  }
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

  const filterCount = [status, priority, phase].filter((value) => value !== "all").length;

  function quickAdd() {
    if (!selected || !quickTitle.trim() || selected.archived) return;
    const task = createBoardTask(quickTitle.trim());
    onChange((previous) => previous.map((board) => board.id === selected.id ? { ...board, tasks: [...board.tasks, task] } : board));
    setQuickTitle("");
  }

  function rowActions({ board, task }: TaskRow) {
    const disabled = board.archived || task.status === "done";
    return <div className="project-row-actions">
      {onSaveSchedule && <Button className="project-schedule-action size-7" size="icon-sm" variant="ghost" aria-label={`安排任务日程：${task.title}`} title="日程安排" disabled={board.archived} onClick={() => setScheduleLink({ boardId: board.id, taskId: task.id })}><CalendarPlus className="size-3.5" /></Button>}
      {onStartFocus && <Button className="size-6" size="icon-sm" variant="ghost" aria-label={`专注任务：${task.title}`} title="开始 25 分钟专注" disabled={disabled} onClick={() => onStartFocus(board, task)}><Play className="size-3.5" /></Button>}
      <Button className="size-6" size="icon-sm" variant="ghost" aria-label={`复制到今日：${task.title}`} title="复制到今日" disabled={disabled} onClick={() => onCopyToToday(board, task)}><CalendarDays className="size-3.5" /></Button>
      <Button className="size-6" size="icon-sm" variant="ghost" aria-label={`删除任务：${task.title}`} title="删除任务" onClick={() => setDeletion({ boardId: board.id, taskId: task.id, name: task.title })}><Trash2 className="size-3.5" /></Button>
    </div>;
  }

  return <section className="project-workspace" aria-label="科研与自学工作台">
    <aside className="project-navigation">
      <div className="project-brand"><span><BookOpen className="size-4" /></span><h2>科研与自学</h2></div>
      <nav className="space-y-1" aria-label="项目视图">
        {scopes.map(({ id, label, icon: Icon }) => <button type="button" key={id} aria-pressed={!selected && scope === id} onClick={() => { setSelectedId(""); setScope(id); clearFilters(); }} className={`project-nav-item ${!selected && scope === id ? "is-active" : ""}`}>
          <Icon className="size-4 shrink-0" /><span className="flex-1 text-left">{label}</span><span className="project-nav-count">{id === "archived" ? boards.filter((board) => board.archived).length : allRows.filter(({ task }) => matchesBoardScope(task, id, today)).length}</span>
        </button>)}
      </nav>
      <div className="project-list-label"><span>项目 <span className="ml-1 font-normal text-stone-400">{activeBoards.length}</span></span><Button variant="ghost" size="icon-sm" aria-label="新建项目" title="新建项目" onClick={() => setProjectEditor({})}><Plus className="size-3.5" /></Button></div>
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto" aria-label="项目列表">
        {activeBoards.map((board, index) => <div key={board.id} data-project-order-id={board.id} className={`project-list-row ${dropProject === board.id ? "is-drop-target" : ""}`} onDragOver={(event) => { if (draggingProject.current && draggingProject.current !== board.id) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDropProject(board.id); } }} onDrop={(event) => { event.preventDefault(); if (draggingProject.current) moveProject(draggingProject.current, board.id); draggingProject.current = null; setDropProject(null); }}>
          <button type="button" ref={(node) => { if (node) projectHandles.current.set(board.id, node); else projectHandles.current.delete(board.id); }} draggable className="project-drag-handle" aria-label={`移动项目：${board.name}`} title="拖动排序，或使用上下方向键" aria-keyshortcuts="ArrowUp ArrowDown" onDragStart={(event) => { draggingProject.current = board.id; event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/project-board", board.id); }} onDragEnd={() => { draggingProject.current = null; setDropProject(null); }} onKeyDown={(event) => { if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return; event.preventDefault(); const target = activeBoards[index + (event.key === "ArrowUp" ? -1 : 1)]; if (target) { moveProject(board.id, target.id); requestAnimationFrame(() => projectHandles.current.get(board.id)?.focus()); } }}><GripVertical className="size-3.5" /></button>
          <button type="button" aria-pressed={selected?.id === board.id} onClick={() => openProject(board.id)} className={`project-nav-item ${selected?.id === board.id ? "is-active" : ""}`}>
          {board.kind === "research" ? <FlaskConical className="size-4 shrink-0" /> : board.kind === "learning" ? <BookOpen className="size-4 shrink-0" /> : <FolderOpen className="size-4 shrink-0" />}
          <span className="min-w-0 flex-1 truncate text-left" title={board.name}>{board.name}</span><span className="project-nav-count">{board.tasks.filter((task) => task.status !== "done").length}</span>
        </button></div>)}
      </nav>
      <span role="status" className="sr-only">{sortAnnouncement}</span>
      <div className="project-backup-actions">
        <Button variant="ghost" size="sm" aria-label="备份全部项目" onClick={() => download(JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), project_boards: boards }, null, 2), `科研自学项目-${today}.json`, "application/json")} disabled={!boards.length}><ArrowDownToLine className="size-3.5" />备份</Button>
        <Button variant="ghost" size="sm" aria-label="从备份导入" onClick={() => importInput.current?.click()}><Upload className="size-3.5" />导入</Button>
        <input ref={importInput} type="file" accept=".json,application/json" aria-label="导入项目备份" className="hidden" onChange={(event) => void importBoards(event.target.files?.[0])} />
      </div>
    </aside>

    <div className="project-main">
      <header className="project-header">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2.5"><h1>{selected?.name ?? scopeLabel}</h1>{selected && <span className="project-kind-label">{selected.archived ? "已归档" : kinds[selected.kind]}</span>}</div>
          {selected?.goal && <p className="project-goal" title={selected.goal}>{selected.goal}</p>}
          <div className="project-header-meta" role="group" aria-label="项目统计">
            <span>{sourceRows.length} 项任务</span><span className="project-completion"><span className="project-mini-track"><i style={{ width: `${sourceRows.length ? doneCount / sourceRows.length * 100 : 0}%` }} /></span>{doneCount} 已完成</span>
            {selected?.targetDate && <span className="tabular-nums"><CalendarDays className="mr-1 inline size-3" />{selected.targetDate}</span>}
            {overdueCount > 0 && <span className="text-red-700">{overdueCount} 逾期</span>}{blockedCount > 0 && <span className="text-amber-700">{blockedCount} 阻塞</span>}
          </div>
          {selected?.description && <details className="mt-2 text-xs text-stone-500"><summary className="cursor-pointer">项目说明</summary><p className="mt-2 max-w-[70ch] whitespace-pre-wrap leading-6">{selected.description}</p></details>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {selected ? <><Button variant="ghost" size="icon-sm" aria-label="项目设置" title="项目设置" onClick={() => setProjectEditor({ board: selected })}><Settings2 className="size-4" /></Button><Button size="sm" disabled={selected.archived} onClick={() => newTask()}><Plus className="size-3.5" />新任务</Button></> : <Button size="sm" onClick={() => setProjectEditor({})}><Plus className="size-3.5" />新项目</Button>}
        </div>
      </header>

      {!boards.length ? <div className="project-empty-start"><FolderOpen className="mb-4 size-8 text-stone-300" /><h2 className="text-base font-medium text-stone-700">新建项目</h2><div className="mt-5 flex gap-3">
        {([{ template: "blank", title: "空白项目", icon: Plus }, { template: "research", title: "科研项目", icon: FlaskConical }, { template: "learning", title: "自学计划", icon: BookOpen }] as const).map(({ template, title, icon: Icon }) => <Button key={template} variant="outline" onClick={() => setProjectEditor({ template })}><Icon className="size-4" />{title}</Button>)}
      </div></div> : <>
        <div className="project-toolbar">
          <div className="project-view-switch" role="group" aria-label="展示方式"><button type="button" aria-pressed={view === "table"} onClick={() => setView("table")}><Table2 className="size-3.5" />任务表</button><button type="button" aria-pressed={view === "board"} onClick={() => setView("board")}><LayoutGrid className="size-3.5" />看板</button></div>
          {view === "table" && <div className="flex items-center gap-1" role="group" aria-label="任务展开操作">
            <Button type="button" size="sm" variant="ghost" className="text-[13px]" disabled={!rows.length || rows.every((row) => expanded.includes(taskSortId(row)))} onClick={() => setExpanded((previous) => [...new Set([...previous, ...rows.map(taskSortId)])])}>全部展开</Button>
            <Button type="button" size="sm" variant="ghost" className="text-[13px]" disabled={!rows.some((row) => expanded.includes(taskSortId(row)))} onClick={() => { const visible = new Set(rows.map(taskSortId)); setExpanded((previous) => previous.filter((key) => !visible.has(key))); }}>全部折叠</Button>
          </div>}
          <div className="project-search"><Search className="size-3.5" /><Input aria-label="搜索项目任务" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索任务" className="h-8 rounded-md border-[#e6ebe7] pl-8 pr-7 text-xs shadow-none" />{query && <button type="button" aria-label="清空搜索" onClick={() => setQuery("")}><X className="size-3" /></button>}</div>
          <div className="ml-auto flex items-center gap-1.5">
            <Button size="sm" variant={filtersOpen || filterCount ? "secondary" : "ghost"} aria-label="筛选" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}><SlidersHorizontal className="size-3.5" />筛选{filterCount > 0 && <span className="project-filter-count">{filterCount}</span>}</Button>
            <label className="project-sort"><ArrowUpDown className="size-3.5" /><select aria-label="任务排序" value={sort} onChange={(event) => setSort(event.target.value)}><option value="manual">手动顺序</option><option value="priority">优先级</option><option value="due">截止日期</option><option value="created">创建顺序</option></select></label>
            <Button size="icon-sm" variant="ghost" aria-label="导出当前任务为 CSV" title="导出 CSV" disabled={!rows.length} onClick={() => download(boardTasksToCsv(rows), `${selected?.name ?? scopeLabel}-${today}.csv`, "text/csv;charset=utf-8")}><ArrowDownToLine className="size-3.5" /></Button>
          </div>
        </div>
        <span role="status" className="sr-only">{taskSorting.announcement}</span>
        <div hidden={!filtersOpen} className="project-filter-row">
          <select aria-label="筛选任务状态" className={selectClass} value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">全部状态</option>{Object.entries(boardStatuses).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
          <select aria-label="筛选任务优先级" className={selectClass} value={priority} onChange={(event) => setPriority(event.target.value)}><option value="all">全部优先级</option>{Object.entries(boardPriorities).map(([id, item]) => <option key={id} value={id}>{item.short} · {item.label}</option>)}</select>
          <select aria-label="筛选任务阶段" className={selectClass} value={phase} onChange={(event) => setPhase(event.target.value)}><option value="all">全部阶段</option>{phases.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          {filterCount > 0 && <Button variant="ghost" size="sm" onClick={clearFilters}>清除</Button>}
        </div>

        <div className="project-content-scroll">
          {view === "table" ? <table className="project-task-table"><ProjectTableColumns /><thead><tr><th><span className="sr-only">排序及完成状态</span></th><th>任务 / 阶段</th><th>优先级</th><th>状态</th><th>计划 / 日程</th><th>截止</th><th>备注</th><th><span className="sr-only">操作</span></th></tr></thead><tbody>
            {rows.map(({ board, task }) => <TaskTableRow key={`${board.id}:${task.id}`} board={board} task={task} sorting={taskSorting} today={today} expanded={expanded.includes(taskSortId({ board, task }))} showProject={!selected} schedule={findProjectSchedule(events, { boardId: board.id, taskId: task.id })} onSchedule={onSaveSchedule ? () => setScheduleLink({ boardId: board.id, taskId: task.id }) : undefined} scheduleFor={(subtaskId) => findProjectSchedule(events, { boardId: board.id, taskId: task.id, subtaskId })} onSubtaskSchedule={onSaveSchedule ? (subtaskId) => setScheduleLink({ boardId: board.id, taskId: task.id, subtaskId }) : undefined} onExpand={() => { const key = taskSortId({ board, task }); setExpanded((previous) => previous.includes(key) ? previous.filter((id) => id !== key) : [...previous, key]); }} onEdit={() => setTaskEditor({ boardId: board.id, task })} onUpdate={(update) => updateTask(board.id, task.id, update)} actions={rowActions({ board, task })} />)}
          </tbody></table> : <div className="project-kanban">{Object.entries(boardStatuses).map(([id, label]) => <section key={id} className="project-kanban-column"><h3><span className={`project-status-dot status-${id}`} />{label}<span className="ml-auto font-normal text-stone-400">{rows.filter(({ task }) => task.status === id).length}</span></h3>
            {rows.filter(({ task }) => task.status === id).map(({ board, task }) => <article key={`${board.id}:${task.id}`} className="project-kanban-card project-sortable-row relative" data-task-order-id={task.id} data-task-board-id={board.id} {...taskSorting.rowProps(taskSortId({ board, task }))}><div className="absolute right-2 top-2">{taskSorting.handle(taskSortId({ board, task }))}</div><div className="mb-2 pr-5">{!selected && <p className="mb-1 truncate text-[13px] text-stone-500">{board.name}</p>}<PhaseControl task={task} onChange={(phase) => updateTask(board.id, task.id, (previous) => ({ ...previous, phase }))} /></div><button type="button" onClick={() => setTaskEditor({ boardId: board.id, task })} className="text-left text-[15px] font-medium leading-6 hover:text-primary">{task.milestone && <Flag className="mr-1 inline size-3 text-amber-700" />}{task.title}</button><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><PriorityBadge priority={task.priority} /><TaskProgress task={task} /></div><div className="mt-2"><TaskDateControls task={task} today={today} schedule={findProjectSchedule(events, { boardId: board.id, taskId: task.id })} onSchedule={onSaveSchedule ? () => setScheduleLink({ boardId: board.id, taskId: task.id }) : undefined} onChange={(field, value) => updateTask(board.id, task.id, (previous) => ({ ...previous, [field]: value }))} /></div><div className="mt-2"><InlineProjectText multiline label={`任务备注：${task.title}`} value={task.notes} onChange={(notes) => updateTask(board.id, task.id, (previous) => ({ ...previous, notes }))} /></div><Button type="button" size="sm" variant="ghost" className="mt-1" aria-label={`编辑子任务：${task.title}`} onClick={() => setTaskEditor({ boardId: board.id, task })}>子任务 {task.subtasks.length}</Button><div className="mt-3 flex items-center gap-1 border-t border-stone-100 pt-2"><StatusControl task={task} onChange={(next) => updateTask(board.id, task.id, (previous) => setBoardTaskStatus(previous, next))} />{rowActions({ board, task })}</div></article>)}
          </section>)}</div>}
          {!rows.length && <div className="project-empty-tasks"><ListTodo className="mb-3 size-6 text-stone-300" /><p>{sourceRows.length ? "没有匹配任务" : "暂无任务"}</p>{(query || filterCount > 0) && <Button variant="ghost" size="sm" onClick={clearFilters}>清除筛选</Button>}</div>}
          {selected && !selected.archived && <form className="project-quick-add" onSubmit={(event) => { event.preventDefault(); quickAdd(); }}><Plus className="size-4 text-stone-400" /><Input aria-label="快速添加任务" value={quickTitle} onChange={(event) => setQuickTitle(event.target.value)} placeholder="添加任务…" className="h-8 rounded-none border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0" /><Button type="submit" size="icon-sm" variant="ghost" aria-label="添加任务" disabled={!quickTitle.trim()}><Plus className="size-4" /></Button></form>}
        </div>
        <footer className="project-footer"><span>{rows.length} 项{filterCount > 0 || query ? ` / ${sourceRows.length}` : ""}</span>{selected && <div className="ml-auto flex gap-4"><button type="button" onClick={() => { onChange((previous) => previous.map((board) => board.id === selected.id ? { ...board, archived: !board.archived } : board)); setSelectedId(""); setScope(selected.archived ? "all" : "archived"); clearFilters(); }}>{selected.archived ? "恢复项目" : "归档项目"}</button><button type="button" onClick={() => setDeletion({ boardId: selected.id, name: selected.name })}>删除项目</button></div>}</footer>
      </>}
    </div>
    {scheduleLink && scheduleTarget && onSaveSchedule && <ProjectScheduleDialog key={JSON.stringify(scheduleLink)} title={scheduleTarget.item.title} source={`${scheduleTarget.board.name}${scheduleLink.subtaskId ? ` / ${scheduleTarget.task.title}` : ""}`} plannedDate={scheduleTarget.item.plannedDate} event={findProjectSchedule(events, scheduleLink)} onSave={(time) => onSaveSchedule(scheduleLink, time)} onRemove={onRemoveSchedule ? () => onRemoveSchedule(scheduleLink) : undefined} onView={onViewSchedule} onClose={() => setScheduleLink(null)} />}
    {projectEditor && <ProjectBoardEditor key={projectEditor.board?.id ?? projectEditor.template ?? "new"} {...projectEditor} onSave={saveProject} onClose={() => setProjectEditor(null)} />}
    {taskEditor && <BoardTaskEditor key={taskEditor.task.id} task={taskEditor.task} projectName={boards.find((board) => board.id === taskEditor.boardId)?.name ?? "项目"} onSave={saveTask} onClose={() => setTaskEditor(null)} />}
    <ConfirmDialog open={Boolean(deletion)} onOpenChange={(open) => { if (!open) setDeletion(null); }} title={deletion?.taskId ? "删除这项任务？" : "删除整个项目？"} description={`“${deletion?.name ?? ""}”${deletion?.taskId ? "将被删除。" : "及其全部任务将被删除。"}`} confirmLabel="确认删除" onConfirm={() => { if (!deletion) return; onChange((previous) => deletion.taskId ? previous.map((board) => board.id === deletion.boardId ? { ...board, tasks: board.tasks.filter((task) => task.id !== deletion.taskId) } : board) : previous.filter((board) => board.id !== deletion.boardId)); setDeletion(null); }} />
  </section>;
}

function StatusControl({ task, onChange }: { task: BoardTask; onChange: (status: BoardStatus) => void }) {
  return <TaskStatusControl status={task.status} label={`状态：${task.title}`} onChange={onChange} />;
}

function PhaseControl({ task, onChange }: { task: BoardTask; onChange: (phase: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const baseline = useRef(task.phase);
  const cancelled = useRef(false);
  return <input className="project-phase-input" aria-label={`阶段：${task.title}`} maxLength={100} value={draft ?? task.phase}
    onFocus={() => { baseline.current = task.phase; cancelled.current = false; }}
    onChange={(event) => setDraft(event.target.value)}
    onBlur={() => {
      if (cancelled.current || draft === null) return;
      const next = draft.trim();
      if (next !== task.phase && baseline.current !== task.phase) { toast.error("阶段已在其他页面更新，请核对后重新提交。"); return; }
      if (next !== task.phase) onChange(next);
      setDraft(null);
    }}
    onKeyDown={(event) => {
      if (event.nativeEvent.isComposing) return;
      if (event.key === "Escape") { cancelled.current = true; setDraft(null); event.currentTarget.blur(); }
      if (event.key === "Enter") event.currentTarget.blur();
    }} />;
}

function TaskTableRow({ board, task, sorting, today, expanded, showProject, onExpand, onEdit, onUpdate, actions, schedule, onSchedule, scheduleFor, onSubtaskSchedule }: TaskRow & { sorting: ReturnType<typeof useRowReorder>; today: string; expanded: boolean; showProject: boolean; onExpand: () => void; onEdit: () => void; onUpdate: (update: (task: BoardTask) => BoardTask) => void; actions: React.ReactNode; schedule?: ScheduleEvent; onSchedule?: () => void; scheduleFor: (id: string) => ScheduleEvent | undefined; onSubtaskSchedule?: (id: string) => void }) {
  const details = ([['content', '内容'], ['review', '成果与复盘']] as const).filter(([field]) => task[field].trim());
  return <>
    <tr className={`project-sortable-row ${task.status === "done" ? "is-completed" : ""}`} data-task-order-id={task.id} data-task-board-id={board.id} {...sorting.rowProps(taskSortId({ board, task }))}>
      <td><div className="flex items-center gap-1">{sorting.handle(taskSortId({ board, task }))}<input type="checkbox" aria-label={`完成任务：${task.title}`} checked={task.status === "done"} onChange={(event) => onUpdate((previous) => setBoardTaskStatus(previous, event.target.checked ? "done" : "todo"))} className="size-3.5 shrink-0 accent-emerald-800" /></div></td>
      <td><div className="flex items-start gap-2"><button type="button" aria-label={`${expanded ? "收起" : "展开"}任务：${task.title}`} aria-expanded={expanded} onClick={onExpand} className="project-expand-button">{expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}</button><div className="min-w-0"><button type="button" className={`project-task-title ${task.status === "done" ? "line-through" : ""}`} onClick={onEdit}>{task.milestone && <Flag aria-label="里程碑" className="mr-1.5 inline size-3 text-amber-700" />}{task.title}</button><div className="project-task-meta">{showProject && <span className="max-w-40 truncate text-[13px] text-stone-400">{board.name}</span>}<TaskProgress task={task} /><PhaseControl task={task} onChange={(phase) => onUpdate((previous) => ({ ...previous, phase }))} />{task.tags.length > 0 && <div className="flex flex-wrap gap-1">{task.tags.slice(0, 2).map((tag) => <span key={tag} className="project-tag" title={tag}>{tag}</span>)}{task.tags.length > 2 && <span className="text-xs text-stone-400" title={task.tags.slice(2).join("、")}>+{task.tags.length - 2}</span>}</div>}</div></div></div></td>

      <td><TaskPriorityControl priority={task.priority} label={`优先级：${task.title}`} onChange={(priority) => onUpdate((previous) => ({ ...previous, priority }))} /></td>
      <td><StatusControl task={task} onChange={(next) => onUpdate((previous) => setBoardTaskStatus(previous, next))} /></td>
      <td><TaskDateControls task={task} today={today} fields={["plannedDate"]} schedule={schedule} onSchedule={onSchedule} onChange={(field, value) => onUpdate((previous) => ({ ...previous, [field]: value }))} /></td><td><TaskDateControls task={task} today={today} fields={["dueDate"]} onChange={(field, value) => onUpdate((previous) => ({ ...previous, [field]: value }))} /></td>
      <td><InlineProjectText multiline label={`任务备注：${task.title}`} value={task.notes} onChange={(notes) => onUpdate((previous) => ({ ...previous, notes }))} /></td>
      <td>{actions}</td>
    </tr>
    {expanded && <tr className="project-sortable-row" data-task-drop-id={task.id} {...sorting.rowProps(taskSortId({ board, task }))}><td colSpan={8} className="project-expanded-cell">{details.length ? <div className="project-task-details">{details.map(([field, label]) => <div key={field} className={`project-detail-${field}`}><span className="project-detail-label">{label}</span><AnnotatedContent value={task[field]} onChange={(value) => onUpdate((previous) => ({ ...previous, [field]: value }))} /></div>)}</div> : null}<SubtaskTable title={task.title} subtasks={task.subtasks} scheduleFor={scheduleFor} onSchedule={onSubtaskSchedule} onChange={(update) => onUpdate((previous) => ({ ...previous, subtasks: update(previous.subtasks) }))} /></td></tr>}
  </>;
}
