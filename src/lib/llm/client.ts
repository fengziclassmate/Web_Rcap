import { PROVIDER_ENDPOINTS } from "@/lib/llm/types";
import type { LLMRequestOptions, LLMUserConfig } from "@/lib/llm/types";

const DEFAULT_SYSTEM_PROMPT =
  "You are a helpful research and productivity assistant. Reply in Chinese unless the user writes in another language. Be concise, concrete, and practical.";

export function buildRequestUrl(config: LLMUserConfig): string {
  const endpoint = PROVIDER_ENDPOINTS[config.provider];
  const base = (config.baseUrl?.trim() || endpoint.baseUrl).replace(/\/$/, "");
  return `${base}${endpoint.chatPath}`;
}

export function buildHeaders(config: LLMUserConfig): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
    ...(config.provider === "openrouter"
      ? {
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
          "X-Title": "Personal Research Schedule App",
        }
      : {}),
  };
}

function buildBody(options: LLMRequestOptions) {
  const { messages, config, temperature = 0.7, maxTokens = 4096, stream = false } = options;
  return {
    model: config.model,
    messages: [{ role: "system", content: DEFAULT_SYSTEM_PROMPT }, ...messages],
    temperature,
    max_tokens: maxTokens,
    stream,
  };
}

export async function callLLM(options: LLMRequestOptions): Promise<string> {
  const response = await fetch(buildRequestUrl(options.config), {
    method: "POST",
    headers: buildHeaders(options.config),
    body: JSON.stringify(buildBody({ ...options, stream: false })),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`LLM API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

export async function streamLLM(options: LLMRequestOptions): Promise<Response> {
  const response = await fetch(buildRequestUrl(options.config), {
    method: "POST",
    headers: buildHeaders(options.config),
    body: JSON.stringify(buildBody({ ...options, stream: true })),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`LLM stream API error (${response.status}): ${errorBody}`);
  }

  return response;
}
