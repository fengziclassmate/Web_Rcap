"use client";

import { useCallback, useState } from "react";
import type { LLMMessage } from "@/lib/llm/types";

export type ChatMessage = LLMMessage & {
  id: string;
  createdAt: string;
};

type SendOptions = {
  temperature?: number;
  maxTokens?: number;
};

function createMessage(role: ChatMessage["role"], content: string): ChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

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

export function useLLMChat(initialMessages: ChatMessage[] = []) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (content: string, options: SendOptions = {}) => {
      const trimmed = content.trim();
      if (!trimmed || loading) return "";

      const userMessage = createMessage("user", trimmed);
      const assistantMessage = createMessage("assistant", "");
      const nextMessages = [...messages, userMessage];
      setMessages([...nextMessages, assistantMessage]);
      setLoading(true);
      setError(null);

      let fullText = "";
      try {
        const res = await fetch("/api/llm/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: nextMessages.map(({ role, content }) => ({ role, content })),
            temperature: options.temperature ?? 0.7,
            maxTokens: options.maxTokens ?? 4096,
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
              prev.map((item) =>
                item.id === assistantMessage.id ? { ...item, content: fullText } : item,
              ),
            );
          }
        }

        setMessages((prev) =>
          prev.map((item) => (item.id === assistantMessage.id ? { ...item, content: fullText } : item)),
        );
        return fullText;
      } catch (error) {
        const message = error instanceof Error ? error.message : "LLM 调用失败";
        setError(message);
        setMessages((prev) =>
          prev.map((item) =>
            item.id === assistantMessage.id ? { ...item, content: `调用失败：${message}` } : item,
          ),
        );
        return "";
      } finally {
        setLoading(false);
      }
    },
    [loading, messages],
  );

  const reset = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, loading, error, sendMessage, reset, setMessages };
}
