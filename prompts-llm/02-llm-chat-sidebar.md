# Prompt 02 — 科研对话侧边栏（通用助手浮窗）

> **依赖：** 必须先完成 Prompt 01（LLM 基础架构）
> **目标：** 在页面右侧添加一个可展开/收起的对话侧边栏，用户可以在任意页面咨询科研相关问题。
> LLM 回复流式渲染，支持 Markdown。

---

## 一、新增文件：`src/hooks/useLLMChat.ts`

对话管理 hook，管理消息历史和发送/接收逻辑。

```typescript
"use client";

import { useState, useCallback, useRef } from "react";
import type { LLMMessage } from "@/lib/llm/types";

export type ChatMessage = LLMMessage & { id: string };

export function useLLMChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content };
    setMessages((prev) => [...prev, userMsg]);
    setStreaming(true);

    const assistantId = crypto.randomUUID();
    const assistantMsg: ChatMessage = { id: assistantId, role: "assistant", content: "" };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const res = await fetch("/api/llm/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            // 只给最近 20 条做上下文（控制 token 消耗）
            ...messages.slice(-19).map(({ role, content }) => ({ role, content })),
            { role: "user", content },
          ],
          temperature: 0.7,
          maxTokens: 4096,
          stream: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "请求失败");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("响应体不可读");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") break;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantId
                    ? { ...msg, content: msg.content + delta }
                    : msg
                )
              );
            }
          } catch {
            // 跳过
          }
        }
      }
    } catch (e) {
      const failMsg =
        e instanceof Error ? e.message : "无法连接到 AI 助手";
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? { ...msg, content: `⚠️ ${failMsg}` }
            : msg
        )
      );
    } finally {
      setStreaming(false);
    }
  }, [messages]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
  }, []);

  return {
    messages,
    streaming,
    sendMessage,
    clearMessages,
    stopStreaming,
  };
}
```

## 二、新增文件：`src/components/llm/chat-sidebar.tsx`

对话侧边栏 UI 组件。

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import {
  Bot,
  MessageSquare,
  Send,
  Trash2,
  PanelRightClose,
  PanelRight,
  Square,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLLMChat } from "@/hooks/useLLMChat";
import Markdown from "react-markdown";

export function ChatSidebar() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const { messages, streaming, sendMessage, clearMessages, stopStreaming } = useLLMChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // 快捷键
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape" && !streaming) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, streaming]);

  async function handleSend() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    await sendMessage(text);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      {/* 浮动的启动按钮 */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg transition-all duration-200 ${
          open
            ? "bg-stone-200 text-stone-600 hover:bg-stone-300"
            : "bg-stone-950 text-white hover:bg-stone-800"
        }`}
        title={open ? "关闭 AI 助手" : "打开 AI 助手"}
      >
        {open ? <PanelRightClose className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
      </button>

      {/* 侧边栏 */}
      <div
        className={`fixed top-0 right-0 z-40 h-full w-full max-w-md border-l border-stone-200 bg-white/95 backdrop-blur-xl shadow-2xl transition-transform duration-300 flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-stone-950 text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-900">科研助手</p>
              <p className="text-[11px] text-stone-400">AI Research Assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={clearMessages}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-600"
                title="清空对话"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-600"
            >
              <PanelRightClose className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 空状态 */}
        {messages.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100">
              <MessageSquare className="h-6 w-6 text-stone-400" />
            </div>
            <p className="text-sm font-medium text-stone-600">开始对话</p>
            <p className="text-xs text-stone-400 leading-relaxed">
              可以问我任何科研相关的问题，例如：<br />
              "这个 idea 有哪些值得关注的痛点？"<br />
              "帮我解释一下 Transformer 的注意力机制"<br />
              "如何回复审稿人的这条意见？"
            </p>
          </div>
        )}

        {/* 消息列表 */}
        {messages.length > 0 && (
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-stone-950 text-white">
                    <Bot className="h-3.5 w-3.5" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-stone-950 text-white rounded-br-md"
                      : "bg-stone-100 text-stone-800 rounded-bl-md"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm prose-stone max-w-none">
                      <Markdown>{msg.content || (streaming ? "…" : "")}</Markdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
            {streaming && !messages[messages.length - 1]?.content && (
              <div className="flex gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-stone-950 text-white">
                  <Bot className="h-3.5 w-3.5" />
                </div>
                <div className="rounded-2xl bg-stone-100 px-4 py-3">
                  <span className="inline-flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-stone-400" style={{ animationDelay: "0ms" }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-stone-400" style={{ animationDelay: "150ms" }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-stone-400" style={{ animationDelay: "300ms" }} />
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 输入框 */}
        <div className="border-t border-stone-100 p-4">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入问题… (Shift+Enter 换行, Enter 发送)"
              rows={2}
              disabled={streaming}
              className="flex-1 resize-none rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm outline-none placeholder:text-stone-400 focus:border-stone-400 focus:bg-white disabled:opacity-50"
            />
            <div className="flex flex-col gap-1.5">
              {streaming ? (
                <button
                  type="button"
                  onClick={stopStreaming}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-500 hover:bg-red-100"
                  title="停止生成"
                >
                  <Square className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-950 text-white hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Send className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
```

## 三、修改文件：`src/app/page.tsx`

在页面底部、`<Toaster>` 之前或者任意合适位置渲染 `ChatSidebar`：

```tsx
import { ChatSidebar } from "@/components/llm/chat-sidebar";

// 在 page.tsx 的 return 最底部（在 </div> 之前或闭合标签之前）：
<ChatSidebar />
```

或者在 `src/app/layout.tsx` 的 `<body>` 内渲染（这样所有页面都可用，推荐）：

```tsx
import { ChatSidebar } from "@/components/llm/chat-sidebar";

// 在 layout.tsx 的 <body> 标签内，{children} 之后：
<ChatSidebar />
```

## 四、新增文件：`src/app/api/llm/chat/route.ts`

**已在 Prompt 01 中创建，不需要重复创建。** 如果 Prompt 01 已完成，这里只需验证该文件存在即可。

## 验收标准

- [ ] `npm run build` 通过
- [ ] 页面右下角出现 Bot 图标按钮
- [ ] 点击按钮弹出右侧对话面板
- [ ] 输入文字按 Enter 发送，对话流式返回
- [ ] Markdown 渲染正常（标题、列表、代码块、表格）
- [ ] LLM 未配置时返回友好提示（"请在设置中配置 API Key"）
- [ ] Esc 关闭侧边栏
