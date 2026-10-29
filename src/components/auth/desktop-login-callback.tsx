"use client";

import { useSyncExternalStore } from "react";
import { loginErrorMessage } from "@/lib/desktop-auth";

function subscribe(callback: () => void) {
  window.addEventListener("popstate", callback);
  window.addEventListener("hashchange", callback);
  return () => { window.removeEventListener("popstate", callback); window.removeEventListener("hashchange", callback); };
}

export function DesktopLoginCallback() {
  const href = useSyncExternalStore(subscribe, () => window.location.href, () => "");
  let link = "", error = "";
  if (href) {
    const url = new URL(href);
    const params = new URLSearchParams(url.hash.slice(1));
    const errorCode = url.searchParams.get("error_code") ?? params.get("error_code");
    if (url.searchParams.has("error") || params.has("error")) {
      error = loginErrorMessage({ code: errorCode ?? undefined, message: url.searchParams.get("error_description") ?? params.get("error_description") ?? "登录链接无效，请重新发送。" });
    } else if (url.searchParams.get("code") && url.searchParams.get("state")) {
      const callback = new URL("rcap-desktop://auth");
      callback.searchParams.set("code", url.searchParams.get("code")!);
      callback.searchParams.set("state", url.searchParams.get("state")!);
      link = callback.href;
    } else error = "请从桌面版重新发送登录邮件，并打开最新链接。";
  }
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-6 text-sm text-[#202020]">
      <h1 className="text-lg font-semibold">返回桌面完成登录</h1>
      {error ? <p role="alert" className="text-[#ce2c31]">{error}</p> : link ? <>
        <p>点击下方按钮，在浏览器询问时允许打开桌面版。</p>
        <a className="w-fit rounded-md border-[0.5px] border-[#d9d9d9] bg-[#202020] px-4 py-2 text-[#fcfcfc]" href={link}>打开桌面版并登录</a>
      </> : <p role="status">正在确认登录链接…</p>}
    </main>
  );
}
