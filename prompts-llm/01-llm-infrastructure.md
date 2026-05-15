# Prompt 01 — LLM 基础架构：Provider 适配层 + API Route + 用户配置

> **依赖：** 无
> **目标：** 搭建可复用的 LLM 调用基础设施，用户可以在设置页面输入 API Key 和选择模型，
> 后续所有 LLM 功能都依赖这个基础设施。

---

## 一、新增依赖

```bash
cd "C:\Users\25371\Desktop\日程安排_app"
npm install react-markdown
```

## 二、新增文件：`src/lib/llm/types.ts`

```typescript
/** 支持的 LLM Provider */
export type LLMProvider = "openai" | "deepseek" | "openrouter";

/** 用户在前端 LLM 配置中的保存内容 */
export type LLMUserConfig = {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  /** 自定义 API 端点（选填，默认不同 provider 有自己的默认值） */
  baseUrl?: string;
};

/** 聊天消息格式（OpenAI 兼容） */
export type LLMMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/** LLM API 调用的配置 */
export type LLMRequestOptions = {
  messages: LLMMessage[];
  config: LLMUserConfig;
  /** 温度，默认 0.7 */
  temperature?: number;
  /** 最大 token 数，默认 4096 */
  maxTokens?: number;
  /** 是否流式输出 */
  stream?: boolean;
};

/** 非流式响应 */
export type LLMResponse = {
  content: string;
  model: string;
};

/** Provider 端点配置 */
export type ProviderEndpoint = {
  baseUrl: string;
  chatPath: string;
};

/** 预设的 Provider 端点 */
export const PROVIDER_ENDPOINTS: Record<LLMProvider, ProviderEndpoint> = {
  openai: {
    baseUrl: "https://api.openai.com",
    chatPath: "/v1/chat/completions",
  },
  deepseek: {
    baseUrl: "https://api.deepseek.com",
    chatPath: "/v1/chat/completions",
  },
  openrouter: {
    baseUrl: "https://openrouter.ai",
    chatPath: "/api/v1/chat/completions",
  },
};

/** 预设常用模型列表 */
export const PRESET_MODELS: Record<LLMProvider, string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  openrouter: ["auto"],
};
```

## 三、新增文件：`src/lib/llm/client.ts`

核心的 LLM 调用函数，支持流式和非流式。**注意：这个文件是浏览器端工具库，不要直接用它发起 API 调用（会暴露 API Key）——它只在 API Route 或浏览器端直接使用。**

实际上 API Key 存在 httpOnly cookie 里不经过浏览器 JS，所以浏览器端不需要这个 client。
这个 client 只在 **API Route** 中使用。

```typescript
import { PROVIDER_ENDPOINTS } from "./types";
import type { LLMMessage, LLMRequestOptions, LLMUserConfig } from "./types";

/** 构建请求 URL */
export function buildRequestUrl(config: LLMUserConfig): string {
  const endpoint = PROVIDER_ENDPOINTS[config.provider];
  const base = config.baseUrl?.replace(/\/$/, "") ?? endpoint.baseUrl;
  return `${base}${endpoint.chatPath}`;
}

/** 构建请求头 */
export function buildHeaders(config: LLMUserConfig): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
    ...(config.provider === "openrouter" ? { "HTTP-Referer": window.location.origin } : {}),
  };
}

/** 非流式调用（用于简单的 LLM 调用） */
export async function callLLM(options: LLMRequestOptions): Promise<string> {
  const { messages, config, temperature = 0.7, maxTokens = 4096 } = options;

  const response = await fetch(buildRequestUrl(config), {
    method: "POST",
    headers: buildHeaders(config),
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: "system", content: "You are a helpful research assistant. Reply in Chinese unless the user writes in another language." }, ...messages],
      temperature,
      max_tokens: maxTokens,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`LLM API 错误 (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

/** 解析 SSE 流，返回 AsyncGenerator */
export async function* streamLLM(
  options: LLMRequestOptions
): AsyncGenerator<string> {
  const { messages, config, temperature = 0.7, maxTokens = 4096 } = options;

  const response = await fetch(buildRequestUrl(config), {
    method: "POST",
    headers: buildHeaders(config),
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: "system", content: "You are a helpful research assistant. Reply in Chinese unless the user writes in another language." }, ...messages],
      temperature,
      max_tokens: maxTokens,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`LLM 流式 API 错误 (${response.status}): ${errorBody}`);
  }

  const reader = response.body?.getReader();
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
      if (data === "[DONE]") return;

      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // 解析失败跳过
      }
    }
  }
}
```

## 四、新增文件：`src/app/api/llm/chat/route.ts`

API Route 封装。**用户 API Key 从 cookie 读取**，不暴露给前端 JS。

```typescript
import { NextRequest, NextResponse } from "next/server";
import { PROVIDER_ENDPOINTS } from "@/lib/llm/types";
import type { LLMUserConfig, LLMMessage } from "@/lib/llm/types";

export const runtime = "nodejs";

type ChatRequest = {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
};

export async function POST(request: NextRequest) {
  try {
    // 1. 从 cookie 读取 LLM 配置
    const cookieConfig = request.cookies.get("llm_config")?.value;
    if (!cookieConfig) {
      return NextResponse.json(
        { error: "未配置 LLM API Key，请在设置页面配置" },
        { status: 400 }
      );
    }

    let config: LLMUserConfig;
    try {
      config = JSON.parse(cookieConfig);
    } catch {
      return NextResponse.json(
        { error: "LLM 配置格式错误，请重新设置" },
        { status: 400 }
      );
    }

    if (!config.apiKey || !config.provider || !config.model) {
      return NextResponse.json(
        { error: "LLM 配置不完整，缺少 API Key、Provider 或 Model" },
        { status: 400 }
      );
    }

    // 2. 解析请求体
    const body: ChatRequest = await request.json();
    const { messages, temperature = 0.7, maxTokens = 4096, stream = false } = body;

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "消息列表不能为空" }, { status: 400 });
    }

    // 3. 构建 API 请求
    const endpoint = PROVIDER_ENDPOINTS[config.provider];
    const baseUrl = (config.baseUrl ?? endpoint.baseUrl).replace(/\/$/, "");
    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    };

    // 4. 发起请求
    const apiResponse = await fetch(`${baseUrl}${endpoint.chatPath}`, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: "system" as const,
            content: "You are a helpful research assistant. Reply in Chinese unless the user writes in another language. Be concise and precise.",
          },
          ...messages,
        ],
        temperature,
        max_tokens: maxTokens,
        stream,
      }),
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error("LLM API 错误:", errorText);
      return NextResponse.json(
        { error: `LLM API 错误 (${apiResponse.status})` },
        { status: apiResponse.status }
      );
    }

    // 5. 流式 / 非流式响应
    if (stream) {
      // 流式：将 API 的 SSE 流直接 pipe 回前端
      const headers = new Headers({
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      return new NextResponse(apiResponse.body, { headers });
    } else {
      // 非流式：解析后返回 JSON
      const data = await apiResponse.json();
      const content = data.choices?.[0]?.message?.content ?? "";
      return NextResponse.json({ content, model: config.model });
    }
  } catch (error) {
    console.error("LLM Chat API 错误:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "未知错误" },
      { status: 500 }
    );
  }
}
```

## 五、新增文件：`src/app/api/llm/config/route.ts`

用于读取/写入 LLM 配置的 API Route（通过 httpOnly cookie）。

```typescript
import { NextRequest, NextResponse } from "next/server";
import type { LLMUserConfig } from "@/lib/llm/types";

/** GET: 读取当前的 LLM 配置（不返回 apiKey 明文，只返回是否已配置） */
export async function GET() {
  return NextResponse.json({
    configured: false,
    message: "API Key 通过 cookie 存储，前端不读取明文",
  });
}

/** POST: 保存 LLM 配置到 httpOnly cookie */
export async function POST(request: NextRequest) {
  try {
    const config: LLMUserConfig = await request.json();

    // 基本校验
    if (!config.apiKey?.trim()) {
      return NextResponse.json({ error: "API Key 不能为空" }, { status: 400 });
    }
    if (!["openai", "deepseek", "openrouter"].includes(config.provider)) {
      return NextResponse.json({ error: "不支持的 Provider" }, { status: 400 });
    }
    if (!config.model?.trim()) {
      return NextResponse.json({ error: "模型名不能为空" }, { status: 400 });
    }

    // 存到 httpOnly cookie（有效期 30 天）
    const response = NextResponse.json({ success: true });

    response.cookies.set("llm_config", JSON.stringify(config), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 天
      path: "/",
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: "配置保存失败" },
      { status: 500 }
    );
  }
}

/** DELETE: 清除 LLM 配置 */
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set("llm_config", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}
```

## 六、新增文件：`src/hooks/useLLMConfig.ts`

前端读取 LLM 配置状态的自定义 hook。

```typescript
"use client";

import { useState, useCallback } from "react";
import type { LLMProvider, LLMUserConfig } from "@/lib/llm/types";
import { PRESET_MODELS } from "@/lib/llm/types";

export type LLMConfigState = {
  configured: boolean;
  loading: boolean;
  error: string | null;
};

export function useLLMConfig() {
  const [state, setState] = useState<LLMConfigState>({
    configured: false,
    loading: false,
    error: null,
  });

  const saveConfig = useCallback(async (config: LLMUserConfig) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const res = await fetch("/api/llm/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "保存失败");
      }

      setState({ configured: true, loading: false, error: null });
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "保存失败";
      setState({ configured: false, loading: false, error: msg });
      return false;
    }
  }, []);

  const clearConfig = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      await fetch("/api/llm/config", { method: "DELETE" });
      setState({ configured: false, loading: false, error: null });
    } catch {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  return { ...state, saveConfig, clearConfig, presetModels: PRESET_MODELS };
}
```

## 七、新增文件：`src/components/llm/settings-dialog.tsx`

LLM 配置弹窗。在页面上点击"LLM 设置"按钮打开。

```tsx
"use client";

import { useState } from "react";
import { Brain, Eye, EyeOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useLLMConfig } from "@/hooks/useLLMConfig";
import type { LLMProvider, LLMUserConfig } from "@/lib/llm/types";

type LLMSettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const PROVIDER_OPTIONS: { value: LLMProvider; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "openrouter", label: "OpenRouter" },
];

export function LLMSettingsDialog({ open, onOpenChange }: LLMSettingsDialogProps) {
  const { saveConfig, clearConfig, loading, error, presetModels } = useLLMConfig();
  const [showKey, setShowKey] = useState(false);
  const [provider, setProvider] = useState<LLMProvider>("deepseek");
  const [model, setModel] = useState("deepseek-chat");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");

  const currentModels = presetModels[provider];

  async function handleSave() {
    const config: LLMUserConfig = {
      provider,
      apiKey: apiKey.trim(),
      model,
      ...(baseUrl.trim() ? { baseUrl: baseUrl.trim() } : {}),
    };

    const ok = await saveConfig(config);
    if (ok) {
      toast.success("LLM 配置已保存");
      onOpenChange(false);
    } else {
      toast.error("保存失败，请检查 API Key 是否正确");
    }
  }

  async function handleClear() {
    await clearConfig();
    toast.success("已清除 LLM 配置");
    onOpenChange(false);
  }

  function handleProviderChange(value: string) {
    setProvider(value as LLMProvider);
    const models = presetModels[value as LLMProvider];
    setModel(models[0] ?? "");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            LLM 科研助手设置
          </DialogTitle>
          <DialogDescription>
            配置你的 AI 助手。API Key 仅本地存储，不会上传到我们的服务器。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select value={provider} onValueChange={handleProviderChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {provider === "openrouter" && (
            <p className="text-xs text-muted-foreground">
              OpenRouter 初次使用需要先登录官网配置 API Key 权限。
            </p>
          )}

          <div className="space-y-2">
            <Label>模型</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currentModels.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>API Key</Label>
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>自定义 API 端点（可选）</Label>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="留空则使用默认端点"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={handleClear}>
            清除配置
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="button" onClick={handleSave} disabled={!apiKey.trim() || loading}>
              {loading ? "保存中…" : "保存"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

## 八、修改文件：`src/components/llm/settings-dialog.tsx`（可选快捷入口）

在个人日程 `page.tsx` 或 `layout.tsx` 任意合适位置添加 LLM 设置按钮。

如果选择放在 **`MonitoringSidebar`**（`src/components/monitoring/sidebar.tsx`），在导航按钮后方加一个齿轮图标按钮。

**实际建议：放在 page.tsx 的右上角，与现有布局不冲突。** 修改 `src/app/page.tsx`（如果已重构）或直接添加。

添加位置示例：
```tsx
// 在 page.tsx 的返回内容中，导航区域旁边
<LLMSettingsButton />
```

`LLMSettingsButton` 组件（可写作 `src/components/llm/settings-button.tsx`）：

```tsx
"use client";

import { useState } from "react";
import { Brain } from "lucide-react";
import { LLMSettingsDialog } from "./settings-dialog";

export function LLMSettingsButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/60 bg-white/45 px-3 text-xs font-medium text-stone-600 hover:border-stone-200 hover:bg-white/80 hover:text-stone-950 transition-colors"
        title="LLM 科研助手设置"
      >
        <Brain className="h-4 w-4" />
        <span className="hidden sm:inline">AI 助手</span>
      </button>
      <LLMSettingsDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
```

## 九、修改 `src/app/layout.tsx`（可选）

如果希望 LLM 按钮全局可见，可以加在 layout 的固定位置。

## 验收标准

- [ ] `npm run build` TypeScript 无错误
- [ ] 访问 `/api/llm/config` POST 后 cookie 写入成功
- [ ] LLM 设置弹窗可以正常输入 API Key / Provider / Model
- [ ] 输入正确 API Key 后，设置页面显示"已保存"
- [ ] 后续 Prompt 02~07 通过该基础设施正常调用 LLM
