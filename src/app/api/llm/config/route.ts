import { NextRequest, NextResponse } from "next/server";
import { PRESET_MODELS } from "@/lib/llm/types";
import type { LLMProvider, LLMUserConfig } from "@/lib/llm/types";

export const runtime = "nodejs";

const COOKIE_NAME = "llm_config";
const PROVIDERS = new Set<LLMProvider>(["openai", "deepseek", "openrouter"]);

function parseConfig(value: string | undefined): Omit<LLMUserConfig, "apiKey"> | null {
  if (!value) return null;
  try {
    const config = JSON.parse(value) as LLMUserConfig;
    if (!PROVIDERS.has(config.provider) || !config.model) return null;
    return {
      provider: config.provider,
      model: config.model,
      ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}),
    };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const safeConfig = parseConfig(request.cookies.get(COOKIE_NAME)?.value);
  return NextResponse.json({
    configured: Boolean(safeConfig),
    config: safeConfig,
    presetModels: PRESET_MODELS,
  });
}

export async function POST(request: NextRequest) {
  try {
    const config = (await request.json()) as LLMUserConfig;

    if (!config.apiKey?.trim()) {
      return NextResponse.json({ error: "API Key 不能为空" }, { status: 400 });
    }
    if (!PROVIDERS.has(config.provider)) {
      return NextResponse.json({ error: "不支持的 Provider" }, { status: 400 });
    }
    if (!config.model?.trim()) {
      return NextResponse.json({ error: "模型名不能为空" }, { status: 400 });
    }

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
      JSON.stringify({
        provider: config.provider,
        apiKey: config.apiKey.trim(),
        model: config.model.trim(),
        ...(config.baseUrl?.trim() ? { baseUrl: config.baseUrl.trim() } : {}),
      }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60,
        path: "/",
      },
    );

    return response;
  } catch {
    return NextResponse.json({ error: "配置保存失败" }, { status: 500 });
  }
}

export async function DELETE() {
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
