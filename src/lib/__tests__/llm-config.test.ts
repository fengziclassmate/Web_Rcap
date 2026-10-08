// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { LLM_CONFIG_MAX_AGE, readLLMConfig, sealLLMConfig } from "../server/llm-config";
const key = "12".repeat(32);
const config = { provider: "openai" as const, apiKey: "test-placeholder-secret", model: "test-model" };
afterEach(() => vi.useRealTimers());
describe("encrypted account-scoped AI configuration", () => {
  it("round-trips without putting the API key or user configuration in plaintext", () => {
    const cookie = sealLLMConfig(config, "owner", key);
    expect(cookie).not.toContain(config.apiKey); expect(cookie).not.toContain(config.model);
    expect(readLLMConfig(cookie, "owner", key)).toEqual(config);
    expect(sealLLMConfig(config, "owner", key)).not.toEqual(cookie);
  });
  it("rejects another account, tampering, key rotation and legacy plaintext", () => {
    const cookie = sealLLMConfig(config, "owner", key);
    expect(readLLMConfig(cookie, "other", key)).toBeNull();
    const bytes = Buffer.from(cookie.slice(3), "base64url"); bytes[35] ^= 1;
    expect(readLLMConfig(`v2.${bytes.toString("base64url")}`, "owner", key)).toBeNull();
    expect(readLLMConfig(cookie, "owner", "34".repeat(32))).toBeNull();
    expect(readLLMConfig(JSON.stringify({ ...config, userId: "owner" }), "owner", key)).toBeNull();
  });
  it("enforces expiry independently of the browser cookie lifetime", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-02T00:00:00Z"));
    const cookie = sealLLMConfig(config, "owner", key);
    vi.advanceTimersByTime(LLM_CONFIG_MAX_AGE * 1000 + 1);
    expect(readLLMConfig(cookie, "owner", key)).toBeNull();
  });
  it("fails closed without a valid encryption key and rejects oversized cookies", () => {
    expect(() => sealLLMConfig(config, "owner", "short")).toThrow();
    expect(() => sealLLMConfig({ ...config, apiKey: "x".repeat(4000) }, "owner", key)).toThrow();
  });
});
