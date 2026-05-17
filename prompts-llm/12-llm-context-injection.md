# Prompt 12 — LLM 上下文注入 + 对话历史归档

> **依赖：** 必须先完成 Prompt 01（LLM 基础设施）
> **目标：** 让 LLM 对话侧边栏能"看到"用户当前在做什么——点击日程/任务/文献卡片时自动注入上下文，同时支持历史对话归档管理

---

## 一、功能设计

### 1.1 上下文注入

用户在日程视图、任务控制台、文献页面等任意位置点击卡片时，自动将该事件/任务/文献的信息注入到 LLM 对话中，作为 system context 发送。

交互方式：
- 点击卡片右下角的 AI 悬浮按钮（🧠）
- 或右键菜单 → "问问 AI"
- 注入后对话侧边栏自动弹出，显示"已加载上下文：XXX"

### 1.2 对话历史管理

当前 chat sidebar 没有历史概念——刷新页面后对话丢失。
需要：
1. 按时间线自动保存对话历史（会话级别）
2. 支持按周/月归类查看历史会话
3. 支持重命名/删除历史会话
4. 支持恢复到旧会话继续对话

---

## 二、新增文件

### 2.1 新建 `src/lib/llm/context-types.ts`

```typescript
/** 上下文来源类型 */
export type ContextSource =
  | { kind: "event"; id: string; title: string; date: string; category: string }
  | { kind: "task"; id: string; title: string; priority: string; dueDate: string }
  | { kind: "literature"; id: string; title: string; authors?: string; year?: number }
  | { kind: "achievement"; id: string; title: string; date: string }
  | { kind: "research-project"; id: string; title: string; status: string }
  | { kind: "paper"; id: string; title: string; status: string }
  | { kind: "footprint"; id: string; name: string; lastDate: string };

/** 单条聊天消息 */
export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
};

/** 一个对话会话 */
export type ChatSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  contextSources: ContextSource[];
};

/** 上下文注入到 LLM 时的 system prompt 片段 */
export function buildContextSystemPrompt(sources: ContextSource[]): string {
  if (sources.length === 0) return "";

  const lines = sources.map((source) => {
    switch (source.kind) {
      case "event":
        return `- 日程事件「${source.title}」(${source.date}, ${source.category})`;
      case "task":
        return `- 长期任务「${source.title}」(优先级: ${source.priority}, 截止: ${source.dueDate})`;
      case "literature":
        return `- 文献「${source.title}」${source.authors ? `(作者: ${source.authors})` : ""}`;
      case "achievement":
        return `- 成就「${source.title}」(${source.date})`;
      case "research-project":
        return `- 科研项目「${source.title}」(状态: ${source.status})`;
      case "paper":
        return `- 论文「${source.title}」(进度: ${source.status})`;
      default:
        return "";
    }
  }).filter(Boolean);

  return `\n\n## 当前上下文\n用户在应用中关注的以下内容：\n${lines.join("\n")}\n请基于以上上下文回答用户的问题。`;
}
```

### 2.2 新建 `src/hooks/useChatHistory.ts`

```typescript
"use client";

import { useState, useCallback, useEffect } from "react";
import type { ChatSession, ChatMessage, ContextSource } from "@/lib/llm/context-types";
import { createId } from "@/lib/id";

const STORAGE_KEY = "llm-chat-history";

function loadFromStorage(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToStorage(sessions: ChatSession[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function useChatHistory() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  useEffect(() => {
    setSessions(loadFromStorage());
  }, []);

  /** 创建新会话 */
  const createSession = useCallback((contextSources: ContextSource[] = []): string => {
    const id = createId("chat");
    const now = new Date().toISOString();
    const newSession: ChatSession = {
      id,
      title: contextSources.length > 0
        ? `关于「${contextSources[0].title}」的讨论`
        : `新对话 ${new Date().toLocaleDateString("zh-CN")}`,
      createdAt: now,
      updatedAt: now,
      messages: [],
      contextSources,
    };
    setSessions((prev) => {
      const next = [newSession, ...prev];
      saveToStorage(next);
      return next;
    });
    return id;
  }, []);

  /** 获取会话 */
  const getSession = useCallback((id: string): ChatSession | undefined => {
    return sessions.find((s) => s.id === id);
  }, [sessions]);

  /** 添加消息到会话 */
  const addMessage = useCallback((sessionId: string, message: ChatMessage) => {
    setSessions((prev) => {
      const next = prev.map((s) => {
        if (s.id !== sessionId) return s;
        const updated = {
          ...s,
          messages: [...s.messages, message],
          updatedAt: new Date().toISOString(),
        };
        // 根据首条消息自动生成标题
        if (updated.title.startsWith("新对话") || updated.title.startsWith("关于")) {
          if (message.role === "user" && message.content.length > 10) {
            updated.title = message.content.slice(0, 40) + (message.content.length > 40 ? "…" : "");
          }
        }
        return updated;
      });
      saveToStorage(next);
      return next;
    });
  }, []);

  /** 注入上下文到会话 */
  const injectContext = useCallback((sessionId: string, sources: ContextSource[]) => {
    setSessions((prev) => {
      const next = prev.map((s) => {
        if (s.id !== sessionId) return s;
        return {
          ...s,
          contextSources: [...s.contextSources, ...sources],
          title: s.title.startsWith("新对话")
            ? `关于「${sources[0].title}」的讨论`
            : s.title,
        };
      });
      saveToStorage(next);
      return next;
    });
  }, []);

  /** 删除会话 */
  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      saveToStorage(next);
      return next;
    });
  }, []);

  /** 重命名会话 */
  const renameSession = useCallback((id: string, title: string) => {
    setSessions((prev) => {
      const next = prev.map((s) => s.id === id ? { ...s, title, updatedAt: new Date().toISOString() } : s);
      saveToStorage(next);
      return next;
    });
  }, []);

  /** 按周/月分组统计 */
  const groupedSessions = useCallback(() => {
    const groups: Record<string, ChatSession[]> = {};
    const now = new Date();
    const weekStart = (date: Date) => {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      d.setDate(diff);
      d.setHours(0, 0, 0, 0);
      return d;
    };

    sessions.forEach((session) => {
      const date = new Date(session.updatedAt);
      const groupKey = formatGroupKey(date, now);
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(session);
    });

    return groups;
  }, [sessions]);

  return {
    sessions,
    createSession,
    getSession,
    addMessage,
    injectContext,
    deleteSession,
    renameSession,
    groupedSessions,
  };
}

function formatGroupKey(date: Date, now: Date): string {
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "昨天";
  if (diffDays <= 7) return "本周";
  if (diffDays <= 30) return "本月";
  if (diffDays <= 90) return "近三个月";
  return "更早";
}
```

### 2.3 新建 `src/components/llm/context-badge.tsx`

在事件/任务/文献卡片上显示的 AI 快捷入口：

```tsx
"use client";

import { Sparkles } from "lucide-react";

type ContextBadgeProps = {
  onClick: () => void;
  size?: "sm" | "md";
};

export function ContextBadge({ onClick, size = "sm" }: ContextBadgeProps) {
  const sizeClass = size === "sm" ? "h-6 w-6" : "h-8 w-8";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`inline-flex items-center justify-center rounded-full ${sizeClass}
        bg-teal-50 text-teal-600 opacity-0 group-hover:opacity-100
        hover:bg-teal-100 hover:text-teal-700 hover:shadow-md
        transition-all duration-150`}
      title="问问 AI"
    >
      <Sparkles className="h-3.5 w-3.5" />
    </button>
  );
}
```

### 2.4 修改 `src/components/llm/chat-sidebar.tsx`

大幅改造，增加上下文显示 + 历史会话列表：

```tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Bot, Send, X, History, Trash2, PencilLine,
  MessageSquare, Sparkles, PanelRightOpen,
} from "lucide-react";
import type { ContextSource, ChatSession } from "@/lib/llm/context-types";

// ……

function LLMChatSidebarInner({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(true);
  const [view, setView] = useState<"chat" | "history">("chat");  // 新增：历史视图切换
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Array<{role: string; content: string}>>([]);
  const [streaming, setStreaming] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [contextSources, setContextSources] = useState<ContextSource[]>([]);
  const { sessions, createSession, getSession, addMessage, ...chatHistory } = useChatHistory();

  // 注入上下文的公共入口
  const injectContext = useCallback((sources: ContextSource[]) => {
    setContextSources((prev) => [...prev, ...sources]);

    if (!activeSessionId) {
      // 没有活跃会话时自动创建
      const id = createSession(sources);
      setActiveSessionId(id);
    } else {
      chatHistory.injectContext(activeSessionId, sources);
    }

    // 显示 toast 或动画通知
    if (sources.length > 0) {
      toast.success(`已加载上下文：${sources[0].title}`);
    }

    // 自动切换到聊天视图
    setView("chat");
  }, [activeSessionId, createSession, chatHistory]);

  // …… 其他聊天逻辑

  // 将 injectContext 暴露给全局（通过 window 或 Event）
  useEffect(() => {
    (window as any).__injectLLMContext = injectContext;
    return () => { delete (window as any).__injectLLMContext; };
  }, [injectContext]);

  // ……

  return (
    <aside className={cn(
      "fixed right-0 top-0 z-50 flex h-full flex-col border-l bg-white shadow-2xl transition-all duration-300",
      open ? "w-[400px]" : "w-0",
    )}>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <span className="font-semibold">AI 助手</span>
          {contextSources.length > 0 && (
            <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] text-teal-700">
              {contextSources.length} 个上下文
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setView(view === "chat" ? "history" : "chat")}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            title={view === "chat" ? "对话历史" : "返回对话"}
          >
            {view === "chat" ? <History className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {view === "chat" ? (
        <>
          {/* 上下文来源标签 */}
          {contextSources.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-b bg-teal-50/50 px-3 py-2">
              {contextSources.map((source, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] text-teal-800 shadow-sm"
                >
                  <Sparkles className="h-3 w-3" />
                  {source.title}
                </span>
              ))}
            </div>
          )}

          {/* 消息列表 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* ……原有消息渲染 */}
          </div>

          {/* 输入框 */}
          <div className="border-t p-4">
            {/* ……原有输入框 */}
          </div>
        </>
      ) : (
        /* 历史会话视图 */
        <div className="flex-1 overflow-y-auto p-4">
          {Object.entries(grouped()).map(([group, groupSessions]) => (
            <div key={group} className="mb-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                {group}
              </h3>
              <div className="space-y-1">
                {groupSessions.map((session) => (
                  <div
                    key={session.id}
                    className={cn(
                      "group flex items-center justify-between rounded-lg px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 transition-colors",
                      session.id === activeSessionId ? "bg-teal-50 border border-teal-200" : "",
                    )}
                    onClick={() => restoreSession(session.id)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-gray-800">
                        {session.title}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {new Date(session.updatedAt).toLocaleString("zh-CN")}
                        · {session.messages.length} 条消息
                        {session.contextSources.length > 0 && ` · 📎${session.contextSources.length}`}
                      </p>
                    </div>
                    <div className="hidden group-hover:flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleRename(session.id); }}
                        className="rounded p-1 text-gray-400 hover:text-gray-600"
                      >
                        <PencilLine className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDelete(session.id); }}
                        className="rounded p-1 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {sessions.length === 0 && (
            <div className="flex flex-col items-center justify-center pt-12 text-gray-400">
              <MessageSquare className="mb-2 h-8 w-8" />
              <p className="text-sm">暂无对话历史</p>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
```

### 2.5 注入上下文的事件入口

**在 WeeklyTimeGrid 的事件卡片上：**

```tsx
// 在渲染每个事件的 div 中找到合适位置添加
{/* 事件标题 */}
<div className="flex items-center gap-1">
  <span>{event.title}</span>
  <ContextBadge
    onClick={() => injectEventContext(event)}
    size="sm"
  />
</div>
```

注入函数：

```tsx
function injectEventContext(event: ScheduleEvent) {
  const fallback = window.__injectLLMContext;
  if (fallback) {
    fallback([{
      kind: "event",
      id: event.id,
      title: event.title,
      date: event.date,
      category: event.category,
    }]);
  }
}
```

**在 TaskDashboard 的任务行上：**

```tsx
// 在任务名称旁添加 ContextBadge
<span className="flex items-center gap-2">
  {task.name}
  <ContextBadge onClick={() => injectTaskContext(task)} />
</span>
```

**在 LiteratureItemRow 上：**

```tsx
<ContextBadge onClick={() => injectLiteratureContext(item)} />
```

**在 ResearchProjectCard 上：**

同理添加。

---

## 三、执行步骤

1. 新建 `src/lib/llm/context-types.ts`
2. 新建 `src/hooks/useChatHistory.ts`
3. 新建 `src/components/llm/context-badge.tsx`
4. 修改 `src/components/llm/chat-sidebar.tsx` — 增加上下文显示 + 历史会话归档
5. 在 `WeeklyTimeGrid` 的事件卡片上添加 `ContextBadge`
6. 在 `TaskDashboard` 的任务行上添加 `ContextBadge`
7. 在 `LiteraturePage` 的文献条目上添加 `ContextBadge`
8. `npm run build` 验证

## 四、验收标准

- [ ] 点击日程事件上的 AI 按钮 → 对话自动注入该事件信息 → 显示"已加载上下文"
- [ ] 同一对话可注入多个上下文（先点一个任务，再点一个事件，都在同一对话中）
- [ ] 对话历史按时间分组显示（今天/昨天/本周/本月）
- [ ] 点击历史对话可恢复到该对话继续聊
- [ ] 可重命名/删除历史对话
- [ ] 刷新页面后历史对话不丢失
- [ ] `npm run build` 无 TypeScript 错误

## 五、注意事项

1. **全局注入接口**：使用 `window.__injectLLMContext` 是临时方案。正式环境中可以用 EventEmitter 或 Zustand store 来替代
2. **上下文数量限制**：注入上限为 5 个来源，超过时提示"已注入 5 个上下文，请先清除旧上下文"
3. **会话自动保存**：每收到一条新消息就写入 localStorage，防止意外丢失
