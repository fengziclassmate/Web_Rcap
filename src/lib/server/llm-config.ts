import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { LLMUserConfig } from "@/lib/llm/types";

export const LLM_CONFIG_COOKIE = "llm_config";
export const LLM_CONFIG_MAX_AGE = 30 * 24 * 60 * 60;

function encryptionKey(secret: string | undefined) {
  if (!secret || !/^[a-fA-F0-9]{64}$/.test(secret)) throw new Error("未配置服务端 AI 保护密钥，请设置 LLM_CONFIG_ENCRYPTION_KEY（32 字节随机密钥的十六进制文本）。");
  return Buffer.from(secret, "hex");
}

export function sealLLMConfig(config: LLMUserConfig, owner: string, secret = process.env.LLM_CONFIG_ENCRYPTION_KEY) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  cipher.setAAD(Buffer.from(`llm_config:v2:${owner}`));
  const payload = JSON.stringify({ ...config, userId: owner, expiresAt: Date.now() + LLM_CONFIG_MAX_AGE * 1000 });
  const ciphertext = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  const value = `v2.${Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url")}`;
  if (value.length > 3500) throw new Error("AI 配置过长，请缩短密钥、模型名或网关地址。");
  return value;
}

export function readLLMConfig(value: string | undefined, owner: string, secret = process.env.LLM_CONFIG_ENCRYPTION_KEY): LLMUserConfig | null {
  // Never accept the old plaintext/unsigned cookie as a trusted configuration.
  if (!value?.startsWith("v2.") || value.length > 3500) return null;
  try {
    const bytes = Buffer.from(value.slice(3), "base64url");
    if (bytes.length < 29) return null;
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(secret), bytes.subarray(0, 12));
    decipher.setAAD(Buffer.from(`llm_config:v2:${owner}`));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const config = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8"));
    if (config.userId !== owner || !Number.isFinite(config.expiresAt) || config.expiresAt <= Date.now()) return null;
    if (!["openai", "deepseek", "openrouter"].includes(config.provider) || typeof config.apiKey !== "string" || !config.apiKey || typeof config.model !== "string" || !config.model) return null;
    return { provider: config.provider, apiKey: config.apiKey, model: config.model, ...(typeof config.baseUrl === "string" ? { baseUrl: config.baseUrl } : {}) };
  } catch { return null; }
}
