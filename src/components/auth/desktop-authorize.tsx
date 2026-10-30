"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const subscribe = () => () => {};
export function DesktopAuthorize() {
  const href = useSyncExternalStore(subscribe, () => window.location.href, () => "");
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState("");
  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      setUser(data.session?.user ?? null);
      if (error) setError(error.message);
      setReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { if (active) setUser(session?.user ?? null); });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);
  async function authorize() {
    setLoading(true); setError("");
    try {
      const url = new URL(href);
      const state = url.searchParams.get("state"), key = url.searchParams.get("key");
      if (!state || !key) throw new Error("授权请求无效，请从软件点击“网页登录”重新发起。");
      const publicKey = JSON.parse(atob(key.replaceAll("-", "+").replaceAll("_", "/")));
      const response = await authenticatedFetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/desktop-authorize`, {
        method: "POST", headers: { "Content-Type": "application/json", apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! }, body: JSON.stringify({ publicKey }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      const destination = new URL("rcap-desktop://authorize");
      destination.searchParams.set("state", state); destination.searchParams.set("payload", result.payload);
      setLink(destination.href);
    } catch (error) { setError(error instanceof Error ? error.message : "授权失败，请重试。"); }
    finally { setLoading(false); }
  }
  return <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-6 text-sm text-[#202020]">
    <h1 className="text-lg font-semibold">授权桌面登录</h1>
    {!ready ? <p role="status">正在读取网页登录状态…</p> : user ? <>
      <p>{user.email}</p><p>使用此网页账号登录桌面版，无需发送邮件。</p>
      {link ? <a className="w-fit rounded-md bg-[#202020] px-4 py-2 text-[#fcfcfc]" href={link}>打开桌面版完成登录</a> : <Button className="w-fit" disabled={loading} onClick={() => void authorize()}>{loading ? "正在授权…" : "授权桌面登录"}</Button>}
    </> : <><p>此浏览器尚未登录。请在已登录网页的浏览器中打开本页。</p><Link href="/">打开网页登录</Link></>}
    {error ? <p role="alert" className="text-[#ce2c31]">{error}</p> : null}
  </main>;
}
