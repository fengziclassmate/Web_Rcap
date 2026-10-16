import { format, isValid, parseISO, endOfWeek } from "date-fns";
import { createId } from "@/lib/id";

export const boardPriorities = {
  p1: { label: "重要且紧急", short: "P1", className: "bg-red-50 text-red-800 border-red-200" },
  p2: { label: "重要不紧急", short: "P2", className: "bg-blue-50 text-blue-800 border-blue-200" },
  p3: { label: "紧急不重要", short: "P3", className: "bg-amber-50 text-amber-800 border-amber-200" },
  p4: { label: "不重要不紧急", short: "P4", className: "bg-stone-100 text-stone-600 border-stone-200" },
} as const;
export const boardStatuses = { todo: "未开始", doing: "进行中", blocked: "有阻塞", done: "已完成" } as const;
export type BoardPriority = keyof typeof boardPriorities;
export type BoardStatus = keyof typeof boardStatuses;
export type BoardScope = "all" | "today" | "week" | "overdue" | "archived";
export type BoardSubtask = { id: string; title: string; notes: string; status: BoardStatus; priority: BoardPriority; plannedDate: string; dueDate: string };
export type BoardTask = {
  id: string;
  title: string;
  content: string;
  notes: string;
  review: string;
  phase: string;
  tags: string[];
  priority: BoardPriority;
  status: BoardStatus;
  plannedDate: string;
  dueDate: string;
  milestone: boolean;
  createdAt: string;
  completedAt: string;
  subtasks: BoardSubtask[];
};
export type ProjectBoard = {
  id: string;
  name: string;
  kind: "research" | "learning" | "other";
  goal: string;
  description: string;
  targetDate: string;
  archived: boolean;
  createdAt: string;
  tasks: BoardTask[];
};

const text = (value: unknown) => typeof value === "string" ? value : "";
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const date = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value)) ? value : "";

function plainChecklistTitle(value: string) {
  // Preserve the text and resource URL while retiring marks used as completion states.
  for (let depth = 0; depth < 8; depth++) {
    const next = value.replace(/\*\*([\s\S]+?)\*\*|==([\s\S]+?)==|~~([\s\S]+?)~~|__([\s\S]+?)__|\{(red|blue|green)\}([\s\S]+?)\{\/\5\}|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,
      (_, bold, highlight, strike, underline, _color, colored, label, url) => bold ?? highlight ?? strike ?? underline ?? colored ?? `${label} (${url})`);
    if (next === value) break;
    value = next;
  }
  return value;
}

function normalizeTaskSubtasks(task: Record<string, unknown>): { content: string; subtasks: BoardSubtask[] } {
  if (!Array.isArray(task.subtasks)) {
    const subtasks: BoardSubtask[] = [];
    const content = text(task.content).split("\n").filter((line, index) => {
      const match = line.match(/^\s*- \[([ xX])\] (.*)$/);
      if (!match) return true;
      subtasks.push({ id: `${task.id}:subtask:${index}`, title: plainChecklistTitle(match[2]), notes: "", status: match[1] === " " ? "todo" : "done", priority: "p2", plannedDate: "", dueDate: "" });
      return false;
    }).join("\n");
    return { content, subtasks };
  }
  const ids = new Set<string>();
  const subtasks = task.subtasks.filter(record).filter((item) => {
    if (typeof item.id !== "string" || !item.id || ids.has(item.id)) return false;
    ids.add(item.id);
    return true;
  }).map((item): BoardSubtask => ({ id: item.id as string, title: text(item.title) || "未命名子任务", notes: text(item.notes), status: Object.hasOwn(boardStatuses, text(item.status)) ? item.status as BoardStatus : "todo", priority: Object.hasOwn(boardPriorities, text(item.priority)) ? item.priority as BoardPriority : "p2", plannedDate: date(item.plannedDate), dueDate: date(item.dueDate) }));
  return { content: text(task.content), subtasks };
}

export function normalizeProjectBoards(value: unknown): ProjectBoard[] {
  if (!Array.isArray(value)) return [];
  const boardIds = new Set<string>();
  return value.filter(record).filter((board) => {
    if (typeof board.id !== "string" || !board.id || boardIds.has(board.id)) return false;
    boardIds.add(board.id);
    return true;
  }).map((board) => {
    const taskIds = new Set<string>();
    return {
      id: board.id as string, name: text(board.name) || "未命名项目",
      kind: board.kind === "research" || board.kind === "learning" ? board.kind : "other",
      goal: text(board.goal), description: text(board.description), targetDate: date(board.targetDate),
      archived: board.archived === true, createdAt: text(board.createdAt),
      tasks: (Array.isArray(board.tasks) ? board.tasks : []).filter(record).filter((task) => {
        if (typeof task.id !== "string" || !task.id || taskIds.has(task.id)) return false;
        taskIds.add(task.id);
        return true;
      }).map((task): BoardTask => ({
        id: task.id as string, title: text(task.title) || "未命名任务", ...normalizeTaskSubtasks(task),
        notes: text(task.notes), review: text(task.review), phase: text(task.phase),
        tags: Array.isArray(task.tags) ? [...new Set(task.tags.filter((tag): tag is string => typeof tag === "string" && Boolean(tag.trim())).map((tag) => tag.trim()))] : [],
        priority: Object.hasOwn(boardPriorities, text(task.priority)) ? task.priority as BoardPriority : "p2",
        status: Object.hasOwn(boardStatuses, text(task.status)) ? task.status as BoardStatus : "todo",
        plannedDate: date(task.plannedDate), dueDate: date(task.dueDate), milestone: task.milestone === true,
        createdAt: text(task.createdAt), completedAt: text(task.completedAt),
      })),
    } satisfies ProjectBoard;
  });
}

export function createBoardTask(title = ""): BoardTask {
  return { id: createId("board-task"), title, content: "", notes: "", review: "", phase: "", tags: [], priority: "p2", status: "todo", plannedDate: "", dueDate: "", milestone: false, createdAt: new Date().toISOString(), completedAt: "", subtasks: [] };
}

export function createBoardSubtask(title = ""): BoardSubtask {
  return { id: createId("board-subtask"), title, notes: "", status: "todo", priority: "p2", plannedDate: "", dueDate: "" };
}

export function createProjectBoard(template: "blank" | "research" | "learning", name: string): ProjectBoard {
  const titles = template === "research"
    ? [["明确研究问题与评价指标", "研究设计"], ["收集数据并记录来源", "数据准备"], ["完成方法验证与结果分析", "分析验证"], ["整理图表与研究结论", "成果整理"]]
    : template === "learning"
      ? [["明确学习目标与检验方式", "目标设定"], ["完成核心知识练习", "学习实践"], ["独立解决一道综合问题", "独立验证"], ["复盘错因并安排复习", "复习巩固"]] : [];
  return {
    id: createId("board"), name: name.trim(), kind: template === "blank" ? "other" : template,
    goal: "", description: "", targetDate: "", archived: false, createdAt: new Date().toISOString(),
    tasks: titles.map(([title, phase], index) => ({ ...createBoardTask(title), phase, milestone: index === titles.length - 1, subtasks: [createBoardSubtask("写下一个可以执行的下一步"), createBoardSubtask("明确完成后要留下的成果")] })),
  };
}

export function checklistProgress(content: string) {
  const items = content.split("\n").filter((line) => /^\s*- \[[ xX]\] /.test(line));
  return { total: items.length, done: items.filter((line) => /^\s*- \[[xX]\] /.test(line)).length };
}

export function toggleChecklistLine(content: string, index: number) {
  return content.split("\n").map((line, lineIndex) => lineIndex === index
    ? line.replace(/^(\s*- \[)([ xX])(\] )/, (_, before: string, state: string, after: string) => `${before}${state === " " ? "x" : " "}${after}`) : line).join("\n");
}

export function isBoardTaskOverdue(task: Pick<BoardTask, "status" | "dueDate">, today: string) {
  return task.status !== "done" && Boolean(task.dueDate) && task.dueDate < today;
}

export function matchesBoardScope(task: BoardTask, scope: BoardScope, today: string) {
  if (scope === "all" || scope === "archived") return true;
  if (task.status === "done") return false;
  if (scope === "overdue") return isBoardTaskOverdue(task, today);
  if (scope === "today") return task.plannedDate === today || Boolean(task.dueDate && task.dueDate <= today);
  const end = format(endOfWeek(parseISO(today), { weekStartsOn: 1 }), "yyyy-MM-dd");
  return [task.plannedDate, task.dueDate].some((day) => day >= today && day <= end) || isBoardTaskOverdue(task, today);
}

export function getBoardProgress(board: ProjectBoard) {
  const done = board.tasks.filter((task) => task.status === "done").length;
  return { done, total: board.tasks.length, percent: board.tasks.length ? Math.round(done / board.tasks.length * 100) : 0 };
}

export function getTaskSubtaskProgress(task: BoardTask) {
  return { total: task.subtasks.length, done: task.subtasks.filter((item) => item.status === "done").length };
}

export function reorderVisibleRecords<T extends { id: string }>(items: T[], sourceId: string, targetId: string, visibleIds = items.map((item) => item.id)): T[] {
  const latest = new Map(items.map((item) => [item.id, item]));
  const order = [...new Set(visibleIds.filter((id) => latest.has(id)))];
  const from = order.indexOf(sourceId);
  const to = order.indexOf(targetId);
  if (from < 0 || to < 0 || from === to) return items;
  order.splice(to, 0, ...order.splice(from, 1));
  const visible = new Set(order);
  let index = 0;
  return items.map((item) => visible.has(item.id) ? latest.get(order[index++])! : item);
}

export function reorderProjectBoards(boards: ProjectBoard[], sourceId: string, targetId: string) {
  const source = boards.find((board) => board.id === sourceId);
  const target = boards.find((board) => board.id === targetId);
  if (!source || !target || sourceId === targetId || source.archived !== target.archived) return boards;
  const visible = boards.filter((board) => board.archived === source.archived);
  const from = visible.findIndex((board) => board.id === sourceId);
  const to = visible.findIndex((board) => board.id === targetId);
  visible.splice(to, 0, ...visible.splice(from, 1));
  let index = 0;
  return boards.map((board) => board.archived === source.archived ? visible[index++] : board);
}

export function setBoardTaskStatus(task: BoardTask, status: BoardStatus): BoardTask {
  return { ...task, status, completedAt: status === "done" ? task.completedAt || new Date().toISOString() : "" };
}

export function boardTasksToCsv(rows: { board: ProjectBoard; task: BoardTask }[]) {
  const escape = (value: string) => `"${value.replace(/^[\s]*[=+\-@]/, (match) => `'${match}`).replaceAll('"', '""')}"`;
  return "\uFEFF" + [["项目", "任务", "阶段", "优先级", "状态", "计划日期", "截止日期", "标签", "里程碑", "任务内容", "备注与资料", "成果与复盘", "类型", "父任务"], ...rows.flatMap(({ board, task }) => [[board.name, task.title, task.phase, boardPriorities[task.priority].label, boardStatuses[task.status], task.plannedDate, task.dueDate, task.tags.join("、"), task.milestone ? "是" : "否", task.content, task.notes, task.review, "任务", ""], ...task.subtasks.map((item) => [board.name, item.title, task.phase, boardPriorities[item.priority].label, boardStatuses[item.status], item.plannedDate, item.dueDate, "", "", "", item.notes, "", "子任务", task.title])])].map((row) => row.map(escape).join(",")).join("\r\n");
}
