import { supabase } from "@/lib/supabase";

export async function authenticatedFetch(input: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("登录已过期，请重新登录");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${data.session.access_token}`);
  return fetch(input, { ...init, headers });
}
