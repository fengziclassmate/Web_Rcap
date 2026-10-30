import type { Metadata } from "next";
import { DesktopAuthorize } from "@/components/auth/desktop-authorize";
export const metadata: Metadata = { title: "授权桌面登录", referrer: "no-referrer", robots: { index: false, follow: false } };
export default function AuthorizePage() { return <DesktopAuthorize />; }
