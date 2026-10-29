import type { Metadata } from "next";
import { DesktopLoginCallback } from "@/components/auth/desktop-login-callback";

export const metadata: Metadata = { title: "返回桌面登录", referrer: "no-referrer", robots: { index: false, follow: false } };

export default function DesktopAuthPage() {
  return <DesktopLoginCallback />;
}
