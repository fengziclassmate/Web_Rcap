"use client";

import { useAccountId } from "@/components/account-scope";

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
  icon: ReactNode;
}> = [
  { id: "schedule", label: "个人日程", icon: <CalendarDays className="h-4 w-4" aria-hidden /> },
  { id: "logs", label: "动态日志", icon: <NotebookPen className="h-4 w-4" aria-hidden /> },
];

const motivationMessageStorageKey = "workbench-motivation-message-v1";

export function MonitoringSidebar({
  active,
  onChange,
  actions,
  status,
}: {
  actions?: ReactNode;
  status?: ReactNode;
  active: MonitoringModuleId;
  onChange: (id: MonitoringModuleId) => void;
}) {
  const userId = useAccountId();
  const storageKey = `${motivationMessageStorageKey}:${userId}`;
  const [motivationMessage, setMotivationMessage] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return window.localStorage.getItem(storageKey) ?? "";
    } catch {
      return "";
    }
  });

  function handleMotivationMessageChange(value: string) {
    setMotivationMessage(value);
    try {
      window.localStorage.setItem(storageKey, value);
    } catch {
      // localStorage may be unavailable in private browsing mode.
    }
  }

  return (
    <header className="workbench-header">
      <div className="workbench-header-main">
        <div className="workbench-brand" title="个人科研与生活工作台">
          <LayoutDashboard className="size-4" aria-hidden />
          <span>研究手札</span>
        </div>
        <nav aria-label="模块切换" className="workbench-navigation">
          {items.map((item) => (
            <button key={item.id} type="button" aria-pressed={active === item.id}
              className={cn("workbench-nav-item", active === item.id && "is-active")}
              onClick={() => onChange(item.id)}>
              {item.icon}<span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="workbench-header-actions">{actions}</div>
      </div>
      <div className="workbench-header-secondary">
        <Input value={motivationMessage} onChange={(event) => handleMotivationMessageChange(event.target.value)}
          aria-label="工作台提醒" placeholder="今天要记住什么？" maxLength={160}
          className="workbench-reminder" />
        {status}
      </div>
    </header>
  );
}
