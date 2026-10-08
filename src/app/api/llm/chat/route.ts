import { getAuthenticatedSupabase } from "@/lib/server/supabase-auth";
import { NextRequest, NextResponse } from "next/server";
import { callLLM, streamLLM } from "@/lib/llm/client";
import { readLLMConfig } from "@/lib/server/llm-config";
import type { LLMMessage } from "@/lib/llm/types";

export const runtime = "nodejs";

type ChatRequest = {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
};

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedSupabase(request);
  if (auth.error) return auth.error;
  try {
    const config = readLLMConfig(request.cookies.get("llm_config")?.value, auth.user.id);
    if (!config) {
      return NextResponse.json({ error: "未配置 LLM API Key，请先打开 AI 助手设置" }, { status: 400 });
    }

    const body = (await request.json()) as ChatRequest;
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (messages.length === 0 || messages.length > 200 || messages.some((item) => !item || !["user", "assistant", "system"].includes(item.role) || typeof item.content !== "string" || item.content.length > 100_000)) {
      return NextResponse.json({ error: "消息为空、格式错误或超出长度限制" }, { status: 400 });
    }

    if (body.stream) {
      const upstream = await streamLLM({
        messages,
        config,
        temperature: body.temperature,
        maxTokens: body.maxTokens,
        stream: true,
      });
      return new NextResponse(upstream.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    const content = await callLLM({
      messages,
      config,
      temperature: body.temperature,
      maxTokens: body.maxTokens,
      stream: false,
    });
    return NextResponse.json({ content, model: config.model });
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
