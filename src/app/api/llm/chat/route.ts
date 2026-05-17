import { NextRequest, NextResponse } from "next/server";
import { callLLM, streamLLM } from "@/lib/llm/client";
import type { LLMMessage, LLMUserConfig } from "@/lib/llm/types";

export const runtime = "nodejs";

type ChatRequest = {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
};

function readConfig(request: NextRequest): LLMUserConfig | null {
  const cookieConfig = request.cookies.get("llm_config")?.value;
  if (!cookieConfig) return null;
  try {
    const config = JSON.parse(cookieConfig) as LLMUserConfig;
    if (!config.apiKey || !config.provider || !config.model) return null;
    return config;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const config = readConfig(request);
    if (!config) {
      return NextResponse.json({ error: "未配置 LLM API Key，请先打开 AI 助手设置" }, { status: 400 });
    }

    const body = (await request.json()) as ChatRequest;
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (messages.length === 0) {
      return NextResponse.json({ error: "消息列表不能为空" }, { status: 400 });
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
