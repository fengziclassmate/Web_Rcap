export type LLMProvider = "openai" | "deepseek" | "openrouter";

export type LLMUserConfig = {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;
};

export type LLMMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LLMRequestOptions = {
  messages: LLMMessage[];
  config: LLMUserConfig;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
};


type ProviderEndpoint = {
  baseUrl: string;
  chatPath: string;
};

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

export const PRESET_MODELS: Record<LLMProvider, string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  openrouter: ["auto"],
};
