"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Bot, Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLLMChat } from "@/hooks/useLLMChat";
import { cn } from "@/lib/utils";

export function LLMChatSidebar() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const { messages, loading, error, sendMessage, reset } = useLLMChat();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    await sendMessage(text);
  }

  return (
    <>
      <button
        type="button"
        className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-black text-white shadow-lg transition hover:scale-105"
        onClick={() => setOpen(true)}
        aria-label="打开 AI 对话"
      >
        <Bot className="h-5 w-5" />
      </button>

      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-[430px] translate-x-full flex-col border-l border-gray-200 bg-white shadow-2xl transition-transform",
          open && "translate-x-0",
        )}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">科研对话助手</h2>
            <p className="text-xs text-gray-500">可询问科研、论文、任务和复盘问题</p>
          </div>
          <div className="flex gap-1">
            <Button type="button" size="icon-sm" variant="ghost" onClick={reset}>
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon-sm" variant="ghost" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              可以直接问：“帮我分析这周科研安排有什么问题？”或“帮我把论文任务拆细”。
            </div>
          ) : null}
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "rounded-xl px-3 py-2 text-sm",
                message.role === "user" ? "ml-8 bg-black text-white" : "mr-8 border border-gray-200 bg-gray-50 text-gray-800",
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
      </div>
    </>
  );
}
