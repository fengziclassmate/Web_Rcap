"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createId } from "@/lib/id";
import { dbDelete, dbGetAll, dbPut } from "@/lib/db";
import { useAccountId } from "@/components/account-scope";
import { toast } from "sonner";
import type { ChatSession, ContextSource, StoredChatMessage } from "@/lib/llm/context-types";

const STORAGE_KEY = "llm-chat-history";

function loadFromLocalStorage(userId: string): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${userId}`);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveToLocalStorage(userId: string, sessions: ChatSession[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${STORAGE_KEY}:${userId}`, JSON.stringify(sessions));
}

function buildInitialTitle(contextSources: ContextSource[]) {
  if (contextSources.length > 0) {
    const first = contextSources[0];
    const title = "title" in first ? first.title : "name" in first ? first.name : "上下文";
    return `关于「${title}」的讨论`;
  }
  return `新对话 ${new Date().toLocaleDateString("zh-CN")}`;
}

export function useChatHistory() {
  const userId = useAccountId();
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!userId) return;
      const localSessions = loadFromLocalStorage(userId);
      try {
        const indexedSessions = (await dbGetAll<ChatSession & { userId?: string }>("chat-sessions"))
          .filter((session) => session.userId === userId);
        if (!mounted) return;
        // The local snapshot also records deletions; prefer it when available.
        const next = localStorage.getItem(`${STORAGE_KEY}:${userId}`) !== null ? localSessions : indexedSessions;
        setSessions(next.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
      } catch {
        if (mounted) setSessions(localSessions);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [userId]);

  const persist = useCallback((next: ChatSession[]) => {
    if (!userId) return next;
    const sorted = [...next].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    try { saveToLocalStorage(userId, sorted); }
    catch { toast.error("对话的本地备份失败，请检查浏览器存储空间"); }
    for (const session of sorted) {
      void dbPut("chat-sessions", { ...session, userId }).catch(() => undefined);
    }
    return sorted;
  }, [userId]);

  const createSession = useCallback(
    (contextSources: ContextSource[] = []) => {
      const now = new Date().toISOString();
      const session: ChatSession = {
        id: createId("chat"),
        title: buildInitialTitle(contextSources),
        createdAt: now,
        updatedAt: now,
        messages: [],
        contextSources,
      };
      setSessions((prev) => persist([session, ...prev]));
      return session.id;
    },
    [persist],
  );

  const upsertSession = useCallback(
    (session: ChatSession) => {
      setSessions((prev) => persist([session, ...prev.filter((item) => item.id !== session.id)]));
    },
    [persist],
  );

  const deleteSession = useCallback(
    (sessionId: string) => {
      setSessions((prev) => persist(prev.filter((item) => item.id !== sessionId)));
      void dbDelete("chat-sessions", sessionId).catch(() => undefined);
    },
    [persist],
  );

  const renameSession = useCallback(
    (sessionId: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      setSessions((prev) =>
        persist(
          prev.map((session) =>
            session.id === sessionId
              ? { ...session, title: trimmed, updatedAt: new Date().toISOString() }
              : session,
          ),
        ),
      );
    },
    [persist],
  );

  const appendMessages = useCallback(
    (sessionId: string, messages: StoredChatMessage[]) => {
      setSessions((prev) =>
        persist(
          prev.map((session) => {
            if (session.id !== sessionId) return session;
            const nextMessages = [...session.messages, ...messages];
            const firstUserMessage = nextMessages.find((message) => message.role === "user");
            const shouldAutoTitle = session.title.startsWith("新对话") || session.title.startsWith("关于「");
            return {
              ...session,
              title:
                shouldAutoTitle && firstUserMessage
                  ? firstUserMessage.content.slice(0, 32) + (firstUserMessage.content.length > 32 ? "..." : "")
                  : session.title,
              messages: nextMessages,
              updatedAt: new Date().toISOString(),
            };
          }),
        ),
      );
    },
    [persist],
  );

  const injectContext = useCallback(
    (sessionId: string, contextSources: ContextSource[]) => {
      setSessions((prev) =>
        persist(
          prev.map((session) => {
            if (session.id !== sessionId) return session;
            const merged = [...session.contextSources];
            for (const source of contextSources) {
              if (!merged.some((item) => item.kind === source.kind && item.id === source.id)) merged.push(source);
            }
            return {
              ...session,
              contextSources: merged,
              updatedAt: new Date().toISOString(),
            };
          }),
        ),
      );
    },
    [persist],
  );

  const groupedSessions = useMemo(() => {
    const groups = new Map<string, ChatSession[]>();
    for (const session of sessions) {
      const date = new Date(session.updatedAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      groups.set(key, [...(groups.get(key) ?? []), session]);
    }
    return Array.from(groups.entries());
  }, [sessions]);

  return {
    sessions,
    groupedSessions,
    createSession,
    upsertSession,
    deleteSession,
    renameSession,
    appendMessages,
    injectContext,
  };
}
