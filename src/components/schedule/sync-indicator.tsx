"use client";

import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { CheckCircle2, CloudOff, Loader2, WifiOff } from "lucide-react";
import { syncEngine, type SyncStatus } from "@/lib/sync-engine";
import { cn } from "@/lib/utils";

const statusConfig: Record<SyncStatus, { label: string; className: string; icon: ComponentType<{ className?: string }> }> = {
  idle: { label: "本地就绪", className: "border-emerald-200 bg-emerald-50 text-emerald-700", icon: CheckCircle2 },
  syncing: { label: "同步中", className: "border-sky-200 bg-sky-50 text-sky-700", icon: Loader2 },
  error: { label: "同步异常", className: "border-rose-200 bg-rose-50 text-rose-700", icon: CloudOff },
  offline: { label: "离线模式", className: "border-amber-200 bg-amber-50 text-amber-700", icon: WifiOff },
};

export function SyncIndicator() {
  const [snapshot, setSnapshot] = useState(syncEngine.getSnapshot());

  useEffect(() => syncEngine.subscribe((status, message) => setSnapshot({ status, message: message ?? "" })), []);

  const config = statusConfig[snapshot.status];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs shadow-sm backdrop-blur",
        config.className,
      )}
      title={snapshot.message}
    >
      <Icon className={cn("h-3.5 w-3.5", snapshot.status === "syncing" && "animate-spin")} />
      <span>{config.label}</span>
    </div>
  );
}
