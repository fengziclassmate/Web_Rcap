// @vitest-environment node
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST, DELETE } from "../config/route";
import { POST as chat } from "../chat/route";
import { callLLM } from "@/lib/llm/client";
vi.mock("@/lib/server/supabase-auth", () => ({ getAuthenticatedSupabase: async () => ({ user: { id: "owner" } }) }));
vi.mock("@/lib/llm/client", () => ({ callLLM: vi.fn(async () => "test reply"), streamLLM: vi.fn() }));
const secret = "placeholder-provider-key";
beforeEach(() => { vi.stubEnv("LLM_CONFIG_ENCRYPTION_KEY", "12".repeat(32)); vi.clearAllMocks(); });
afterEach(() => vi.unstubAllEnvs());
describe("AI configuration route contract", () => {
  it("stores encrypted credentials, returns only public config and decrypts only for upstream calls", async () => {
    const saved = await POST(new NextRequest("http://localhost/api/llm/config", { method: "POST", body: JSON.stringify({ provider: "openai", model: "test-model", apiKey: secret }) }));
    expect(saved.status).toBe(200); expect(await saved.text()).not.toContain(secret);
    const cookie = saved.cookies.get("llm_config")!; expect(cookie.value.startsWith("v2.")).toBe(true); expect(cookie.value).not.toContain(secret);
    expect(cookie.httpOnly).toBe(true);
    const headers = { cookie: `llm_config=${cookie.value}` };
    const loaded = await GET(new NextRequest("http://localhost/api/llm/config", { headers }));
    expect(await loaded.json()).toMatchObject({ configured: true, config: { provider: "openai", model: "test-model" } });
    const reply = await chat(new NextRequest("http://localhost/api/llm/chat", { method: "POST", headers, body: JSON.stringify({ messages: [{ role: "user", content: "hello" }], stream: false }) }));
    expect(reply.status).toBe(200); expect(callLLM).toHaveBeenCalledWith(expect.objectContaining({ config: expect.objectContaining({ apiKey: secret }) }));
    expect((await DELETE(new NextRequest("http://localhost/api/llm/config"))).cookies.get("llm_config")?.maxAge).toBe(0);
  });
  it("clears legacy plaintext cookies and refuses to use them for chat", async () => {
    const headers = { cookie: `llm_config=${encodeURIComponent(JSON.stringify({ userId: "owner", apiKey: secret, model: "test-model", provider: "openai" }))}` };
    const result = await GET(new NextRequest("http://localhost/api/llm/config", { headers }));
    expect(await result.json()).toMatchObject({ configured: false }); expect(result.cookies.get("llm_config")?.maxAge).toBe(0);
    const reply = await chat(new NextRequest("http://localhost/api/llm/chat", { method: "POST", headers, body: "{}" }));
    expect(reply.status).toBe(400); expect(callLLM).not.toHaveBeenCalled();
  });
  it("refuses to save credentials when the server encryption key is absent", async () => {
    vi.stubEnv("LLM_CONFIG_ENCRYPTION_KEY", "");
    const result = await POST(new NextRequest("http://localhost/api/llm/config", { method: "POST", body: JSON.stringify({ provider: "openai", model: "test-model", apiKey: secret }) }));
    expect(result.status).toBe(503); expect(result.cookies.get("llm_config")).toBeUndefined();
  });
});
