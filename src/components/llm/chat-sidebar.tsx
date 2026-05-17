"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Bot, History, MessageSquarePlus, Pencil, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useChatHistory } from "@/hooks/useChatHistory";
import {
  buildContextSystemPrompt,
  createChatMessage,
  type ChatSession,
  type ContextSource,
  type StoredChatMessage,
} from "@/lib/llm/context-types";
import { cn } from "@/lib/utils";

function parseSSEChunk(chunk: string): string[] {
  return chunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data: "))
    .map((line) => line.slice(6))
    .filter((data) => data && data !== "[DONE]")
    .map((data) => {
      try {
        const parsed = JSON.parse(data);
        return parsed.choices?.[0]?.delta?.content ?? "";
      } catch {
        return "";
      }
    })
    .filter(Boolean);
}

function sourceTitle(source: ContextSource) {
  if ("title" in source) return source.title;
  if ("name" in source) return source.name;
  return "上下文";
}

function formatSessionTime(value: string) {
  try {
    return new Date(value).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

export function LLMChatSidebar() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"chat" | "history">("chat");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<StoredChatMessage[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const {
    sessions,
    groupedSessions,
    createSession,
    deleteSession,
    renameSession,
    appendMessages,
    injectContext,
  } = useChatHistory();

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? null,
    [activeSessionId, sessions],
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (activeSession) setMessages(activeSession.messages);
  }, [activeSession]);

  useEffect(() => {
    window.__injectLLMContext = (sources) => {
      const nextSources = Array.isArray(sources) ? sources : [sources];
      const targetSessionId = activeSessionId ?? createSession(nextSources);
      if (activeSessionId) injectContext(targetSessionId, nextSources);
      setActiveSessionId(targetSessionId);
      setOpen(true);
      setView("chat");
      toast.success(`已加载上下文：${nextSources.map(sourceTitle).join("、")}`);
    };

    return () => {
      if (window.__injectLLMContext) delete window.__injectLLMContext;
    };
  }, [activeSessionId, createSession, injectContext]);

  function startNewSession() {
    const id = createSession();
    setActiveSessionId(id);
    setMessages([]);
    setInput("");
    setError(null);
    setView("chat");
  }

  function loadSession(session: ChatSession) {
    setActiveSessionId(session.id);
    setMessages(session.messages);
    setInput("");
    setError(null);
    setView("chat");
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    const sessionId = activeSessionId ?? createSession();
    if (!activeSessionId) setActiveSessionId(sessionId);

    const userMessage = createChatMessage("user", text);
    const assistantMessage = createChatMessage("assistant", "");
    const visibleMessages = [...messages, userMessage, assistantMessage];
    const contextSources = sessions.find((session) => session.id === sessionId)?.contextSources ?? [];
    const systemPrompt = buildContextSystemPrompt(contextSources);

    setInput("");
    setMessages(visibleMessages);
    setLoading(true);
    setError(null);

    let fullText = "";
    try {
      const apiMessages = [
        ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
        ...[...messages, userMessage].map(({ role, content }) => ({ role, content })),
      ];

      const res = await fetch("/api/llm/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          temperature: 0.7,
          maxTokens: 4096,
          stream: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "LLM 调用失败");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("响应体不可读");

      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lastBreak = buffer.lastIndexOf("\n");
        if (lastBreak === -1) continue;
        const chunk = buffer.slice(0, lastBreak + 1);
        buffer = buffer.slice(lastBreak + 1);
        for (const token of parseSSEChunk(chunk)) {
          fullText += token;
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantMessage.id ? { ...message, content: fullText } : message,
            ),
          );
        }
      }

      const finalAssistant = { ...assistantMessage, content: fullText || "已收到，但模型未返回正文。" };
      setMessages((prev) =>
        prev.map((message) => (message.id === assistantMessage.id ? finalAssistant : message)),
      );
      appendMessages(sessionId, [userMessage, finalAssistant]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "LLM 调用失败";
      setError(message);
      const failedAssistant = { ...assistantMessage, content: `调用失败：${message}` };
      setMessages((prev) =>
        prev.map((item) => (item.id === assistantMessage.id ? failedAssistant : item)),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-black text-white shadow-lg transition hover:scale-105"
        onClick={() => {
          setOpen(true);
          setView("chat");
        }}
        aria-label="打开 AI 对话"
      >
        <Bot className="h-5 w-5" />
      </button>

      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-[460px] translate-x-full flex-col border-l border-gray-200 bg-white shadow-2xl transition-transform",
          open && "translate-x-0",
        )}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">科研对话助手</h2>
            <p className="text-xs text-gray-500">支持上下文注入和历史对话归档</p>
          </div>
          <div className="flex gap-1">
            <Button type="button" size="icon-sm" variant="ghost" onClick={startNewSession} title="新对话">
              <MessageSquarePlus className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant={view === "history" ? "secondary" : "ghost"}
              onClick={() => setView((prev) => (prev === "history" ? "chat" : "history"))}
              title="历史"
            >
              <History className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon-sm" variant="ghost" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {view === "history" ? (
          <div className="flex-1 overflow-y-auto p-4">
            {groupedSessions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                暂无历史对话。发送问题后会自动归档到这里。
              </div>
            ) : (
              <div className="space-y-5">
                {groupedSessions.map(([group, items]) => (
                  <section key={group} className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">{group}</h3>
                    {items.map((session) => (
                      <div key={session.id} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                        {renamingSessionId === session.id ? (
                          <div className="flex gap-2">
                            <Input value={renameText} onChange={(event) => setRenameText(event.target.value)} />
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => {
                                renameSession(session.id, renameText);
                                setRenamingSessionId(null);
                              }}
                            >
                              保存
                            </Button>
                          </div>
                        ) : (
                          <>
                            <button type="button" className="block w-full text-left" onClick={() => loadSession(session)}>
                              <p className="line-clamp-1 text-sm font-semibold text-gray-900">{session.title}</p>
                              <p className="mt-1 text-xs text-gray-500">
                                {formatSessionTime(session.updatedAt)} · {session.messages.length} 条消息
                              </p>
                            </button>
                            <div className="mt-3 flex justify-end gap-1">
                              <Button
                                type="button"
                                size="icon-xs"
                                variant="ghost"
                                onClick={() => {
                                  setRenamingSessionId(session.id);
                                  setRenameText(session.title);
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                size="icon-xs"
                                variant="ghost"
                                className="text-red-600"
                                onClick={() => {
                                  deleteSession(session.id);
                                  if (activeSessionId === session.id) {
                                    setActiveSessionId(null);
                                    setMessages([]);
                                  }
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </section>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {activeSession?.contextSources?.length ? (
              <div className="border-b border-gray-100 bg-gray-50 px-4 py-2">
                <p className="mb-1 text-xs font-medium text-gray-500">已加载上下文</p>
                <div className="flex flex-wrap gap-1.5">
                  {activeSession.contextSources.map((source) => (
                    <span
                      key={`${source.kind}-${source.id}`}
                      className="rounded-full border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700"
                    >
                      {sourceTitle(source)}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                  可以直接提问，也可以在日程、任务或文献卡片上点击“问 AI”自动带入上下文。
                </div>
              ) : null}
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "rounded-xl px-3 py-2 text-sm",
                    message.role === "user"
                      ? "ml-8 bg-black text-white"
                      : "mr-8 border border-gray-200 bg-gray-50 text-gray-800",
                  )}
                >
                  {message.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown>{message.content || "..."}</ReactMarkdown>
                    </div>
                  ) : (
                    message.content
                  )}
                </div>
              ))}
              {error ? <p className="text-xs text-red-600">{error}</p> : null}
            </div>

            <div className="border-t border-gray-200 p-3">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="输入问题，Enter 发送，Shift+Enter 换行"
                className="min-h-20"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
              />
              <div className="mt-2 flex justify-end">
                <Button type="button" onClick={handleSend} disabled={loading || !input.trim()}>
                  <Send className="h-4 w-4" />
                  {loading ? "生成中" : "发送"}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
