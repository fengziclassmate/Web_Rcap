import { beforeEach, describe, expect, it, vi } from "vitest";
import { authenticatedFetch } from "../authenticated-fetch";
import { AuthRetryableFetchError } from "@supabase/supabase-js";

const auth = vi.hoisted(() => ({ getSession: vi.fn(), refreshSession: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: { auth } }));
beforeEach(() => { vi.clearAllMocks(); auth.getSession.mockResolvedValue({ data: { session: { access_token: "old" } }, error: null }); vi.stubGlobal("fetch", vi.fn()); });

describe("authenticated requests", () => {
  it("refreshes a rejected credential and retries once with the new token and original body", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 401 })).mockResolvedValueOnce(new Response("ok"));
    auth.refreshSession.mockResolvedValue({ data: { session: { access_token: "new" } }, error: null });
    const response = await authenticatedFetch("/api/expenses", { method: "POST", body: "draft", headers: { "Content-Type": "application/json" } });
    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(new Headers(vi.mocked(fetch).mock.calls[1][1]?.headers).get("Authorization")).toBe("Bearer new");
    expect(vi.mocked(fetch).mock.calls[1][1]?.body).toBe("draft");
  });
  it("does not refresh on a temporary service error", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 503 }));
    expect((await authenticatedFetch("/api/day-summary")).status).toBe(503);
    expect(auth.refreshSession).not.toHaveBeenCalled();
  });
  it("reports a revoked session without retrying a write", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }));
    auth.refreshSession.mockResolvedValue({ data: { session: null }, error: new Error("session_not_found") });
    await expect(authenticatedFetch("/api/day-summary")).rejects.toThrow("登录状态已失效");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("distinguishes refresh network failure from an expired login", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }));
    auth.refreshSession.mockResolvedValue({ data: { session: null }, error: new AuthRetryableFetchError("offline", 503) });
    await expect(authenticatedFetch("/api/day-summary")).rejects.toThrow("暂时无法连接登录服务");
  });
  it("stops after one failed refresh retry", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }));
    auth.refreshSession.mockResolvedValue({ data: { session: { access_token: "new" } }, error: null });
    await expect(authenticatedFetch("/api/day-summary")).rejects.toThrow("登录验证未通过");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
