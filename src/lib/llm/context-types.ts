export type ContextSource =
  | { kind: "event"; id: string; title: string; date: string; category: string; time?: string }
  | { kind: "task"; id: string; title: string; priority: string; dueDate: string; done?: boolean }
  | { kind: "literature"; id: string; title: string; authors?: string; year?: number | string; status?: string }
  | { kind: "achievement"; id: string; title: string; date: string }
  | { kind: "research-project"; id: string; title: string; status: string }
  | { kind: "paper"; id: string; title: string; status: string }
  | { kind: "footprint"; id: string; name: string; lastDate: string };

export type StoredChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type ChatSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: StoredChatMessage[];
  contextSources: ContextSource[];
};

export type LLMContextInjector = (sources: ContextSource | ContextSource[]) => void;

declare global {
  interface Window {
    __injectLLMContext?: LLMContextInjector;
  }
}

function describeSource(source: ContextSource) {
  switch (source.kind) {
    case "event":
      return `- 日程：${source.title}，日期 ${source.date}${source.time ? `，时间 ${source.time}` : ""}，分类 ${source.category}`;
    case "task":
      return `- 任务：${source.title}，优先级 ${source.priority}，截止 ${source.dueDate || "未设置"}，状态 ${source.done ? "已完成" : "未完成"}`;
    case "literature":
      return `- 文献：${source.title}${source.authors ? `，作者 ${source.authors}` : ""}${source.year ? `，年份 ${source.year}` : ""}${source.status ? `，状态 ${source.status}` : ""}`;
    case "achievement":
      return `- 成就：${source.title}，日期 ${source.date}`;
    case "research-project":
      return `- 科研项目：${source.title}，状态 ${source.status}`;
    case "paper":
      return `- 论文：${source.title}，状态 ${source.status}`;
    case "footprint":
      return `- 足迹：${source.name}，上次记录 ${source.lastDate}`;
  }
}

export function buildContextSystemPrompt(sources: ContextSource[]) {
  if (sources.length === 0) return "";
  return [
    "你正在辅助用户管理个人科研与生活工作台。",
    "以下是用户从当前页面注入的上下文。回答时优先结合这些对象，必要时指出还缺哪些信息。",
    ...sources.map(describeSource),
  ].join("\n");
}

export function createChatMessage(role: StoredChatMessage["role"], content: string): StoredChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}
