"use client";

import { useState, type ReactNode } from "react";
import {
  CalendarDays,
  LayoutDashboard,
  NotebookPen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export type MonitoringModuleId =
  | "schedule"
  | "logs";

const items: Array<{
  id: MonitoringModuleId;
  label: string;
  group: string;
  icon: ReactNode;
}> = [
  { id: "schedule", label: "个人日程", group: "Today", icon: <CalendarDays className="h-4 w-4" aria-hidden /> },
  { id: "logs", label: "动态日志", group: "Journal", icon: <NotebookPen className="h-4 w-4" aria-hidden /> },
];

const motivationMessageStorageKey = "workbench-motivation-message-v1";

export function MonitoringSidebar({
  active,
  onChange,
}: {
  active: MonitoringModuleId;
  onChange: (id: MonitoringModuleId) => void;
}) {
  const [motivationMessage, setMotivationMessage] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return window.localStorage.getItem(motivationMessageStorageKey) ?? "";
    } catch {
      return "";
    }
  });

  function handleMotivationMessageChange(value: string) {
    setMotivationMessage(value);
    try {
      window.localStorage.setItem(motivationMessageStorageKey, value);
    } catch {
      // localStorage may be unavailable in private browsing mode.
    }
  }

  return (
    <section className="glass-panel overflow-hidden rounded-[1.35rem]">
      <div className="grid gap-4 px-4 py-4 xl:grid-cols-[max-content_minmax(18rem,1fr)_max-content] xl:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center">
            <LayoutDashboard className="h-5 w-5 text-stone-700" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold tracking-tight text-stone-950">个人科研与生活工作台</p>
          </div>
        </div>

        <div className="mx-auto w-full max-w-2xl">
          <Input
            value={motivationMessage}
            onChange={(event) => handleMotivationMessageChange(event.target.value)}
            aria-label="工作台提醒"
            placeholder="今天要记住什么？"
            maxLength={160}
            className="h-11 rounded-2xl border-stone-200/70 bg-white/55 px-5 text-center text-sm font-medium tracking-wide text-stone-800 shadow-inner placeholder:text-stone-400 focus-visible:border-stone-300 focus-visible:ring-stone-300/40"
          />
        </div>

        <nav className="-mx-1 overflow-x-auto pb-1 xl:mx-0 xl:pb-0" aria-label="模块切换">
          <div className="flex min-w-max items-center gap-2 px-1 xl:justify-end">
            {items.map((item) => {
              const selected = item.id === active;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={cn(
                    "group inline-flex h-11 shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-2xl border px-3.5 text-sm font-medium outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40",
                    selected
                      ? "border-teal-700/20 bg-stone-950 text-white shadow-[0_14px_28px_rgba(35,48,42,0.18)]"
                      : "border-white/60 bg-white/45 text-stone-700 hover:border-stone-200 hover:bg-white/80 hover:text-stone-950",
                  )}
                  onClick={() => onChange(item.id)}
                >
                  <span
                    className={cn(
                      "flex size-7 items-center justify-center rounded-xl transition-colors",
                      selected ? "bg-white/14 text-white" : "bg-stone-100/80 text-stone-500 group-hover:bg-stone-200/80",
                    )}
                  >
                    {item.icon}
                  </span>
                  <span className="flex flex-col items-start leading-none">
                    <span>{item.label}</span>
                    <span className={cn("mt-1 text-[10px] uppercase tracking-[0.18em]", selected ? "text-white/55" : "text-stone-400")}>
                      {item.group}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </section>
  );
}
