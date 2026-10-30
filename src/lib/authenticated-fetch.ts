import { supabase } from "@/lib/supabase";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";

export async function authenticatedFetch(input: string, init: RequestInit = {}) {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session) throw new Error("登录已过期，请重新登录");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${data.session.access_token}`);
  const response = await fetch(input, { ...init, headers });
  if (response.status !== 401) return response;
  const refreshed = await supabase.auth.refreshSession();
  if (refreshed.error && isAuthRetryableFetchError(refreshed.error)) throw new Error("暂时无法连接登录服务，请稍后重试。");
  if (refreshed.error || !refreshed.data.session) throw new Error("登录状态已失效，请重新登录。");
  headers.set("Authorization", `Bearer ${refreshed.data.session.access_token}`);
  const retried = await fetch(input, { ...init, headers });
  if (retried.status === 401) throw new Error("登录验证未通过，请重新登录后重试。");
  return retried;
}
