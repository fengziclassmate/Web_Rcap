import { getAuthenticatedSupabase } from "@/lib/server/supabase-auth";
import { resolveLLMEndpoint } from "@/lib/llm/endpoint";
import { NextRequest, NextResponse } from "next/server";
import { PRESET_MODELS } from "@/lib/llm/types";
import type { LLMProvider, LLMUserConfig } from "@/lib/llm/types";

import { LLM_CONFIG_COOKIE as COOKIE_NAME, LLM_CONFIG_MAX_AGE, readLLMConfig, sealLLMConfig } from "@/lib/server/llm-config";

export const runtime = "nodejs";

const PROVIDERS = new Set<LLMProvider>(["openai", "deepseek", "openrouter"]);

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedSupabase(request);
  if (auth.error) return auth.error;
  const config = readLLMConfig(request.cookies.get(COOKIE_NAME)?.value, auth.user.id);
  const safeConfig = config ? { provider: config.provider, model: config.model, ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}) } : null;
  const response = NextResponse.json({ configured: Boolean(safeConfig), config: safeConfig, presetModels: PRESET_MODELS });
  if (!config && request.cookies.has(COOKIE_NAME)) response.cookies.set(COOKIE_NAME, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedSupabase(request);
  if (auth.error) return auth.error;
  try {
    const config = (await request.json()) as LLMUserConfig;

    if (typeof config?.apiKey !== "string" || !config.apiKey.trim()) {
      return NextResponse.json({ error: "API Key 不能为空" }, { status: 400 });
    }
    if (!PROVIDERS.has(config.provider)) {
      return NextResponse.json({ error: "不支持的 Provider" }, { status: 400 });
    }
    if (typeof config.model !== "string" || !config.model.trim()) {
      return NextResponse.json({ error: "模型名不能为空" }, { status: 400 });
    }

    resolveLLMEndpoint(config);
    const response = NextResponse.json({
      success: true,
      configured: true,
      config: {
        provider: config.provider,
        model: config.model,
        ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}),
      },
    });

    response.cookies.set(
      COOKIE_NAME,
      sealLLMConfig({ provider: config.provider, apiKey: config.apiKey.trim(), model: config.model.trim(), ...(config.baseUrl?.trim() ? { baseUrl: config.baseUrl.trim() } : {}) }, auth.user.id),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: LLM_CONFIG_MAX_AGE,
        path: "/",
      },
    );

    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "配置保存失败" }, { status: error instanceof Error && error.message.includes("服务端 AI 保护密钥") ? 503 : 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await getAuthenticatedSupabase(request);
  if (auth.error) return auth.error;
  const response = NextResponse.json({ success: true, configured: false });
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}
