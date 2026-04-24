"use client";

import type { ReactNode } from "react";
import { CalendarDays, FileText, FlaskConical, Footprints, KanbanSquare, LayoutDashboard, NotebookPen, Send, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type MonitoringModuleId =
  | "schedule"
  | "achievements"
  | "footprints"
  | "project-checkins"
  | "research"
  | "paper"
  | "submissions"
  | "meetings"
  | "logs";

const items: Array<{
  id: MonitoringModuleId;
  label: string;
  icon: ReactNode;
}> = [
  { id: "schedule", label: "个人日程管理", icon: <CalendarDays className="h-4 w-4" aria-hidden /> },
  { id: "achievements", label: "成就记录", icon: <Trophy className="h-4 w-4" aria-hidden /> },
  { id: "project-checkins", label: "Project 打卡", icon: <KanbanSquare className="h-4 w-4" aria-hidden /> },
  { id: "footprints", label: "足迹跟踪", icon: <Footprints className="h-4 w-4" aria-hidden /> },
  { id: "research", label: "科研项目", icon: <FlaskConical className="h-4 w-4" aria-hidden /> },
  { id: "paper", label: "论文进度", icon: <FileText className="h-4 w-4" aria-hidden /> },
  { id: "submissions", label: "投稿记录", icon: <Send className="h-4 w-4" aria-hidden /> },
  { id: "meetings", label: "组会记录", icon: <Users className="h-4 w-4" aria-hidden /> },
  { id: "logs", label: "动态日志", icon: <NotebookPen className="h-4 w-4" aria-hidden /> },
];

export function MonitoringSidebar({
  active,
  onChange,
}: {
  active: MonitoringModuleId;
  onChange: (id: MonitoringModuleId) => void;
}) {
  return (
    <aside className="h-full w-full border-r border-gray-200 bg-white">
      <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-4">
        <div className="flex size-9 items-center justify-center rounded-md border border-gray-200 bg-gray-50">
          <LayoutDashboard className="h-4 w-4 text-gray-700" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">个人科研与生活工作台</p>
          <p className="truncate text-xs text-gray-500">切换模块</p>
        </div>
      </div>

      <nav className="p-2" aria-label="模块切换">
        <div className="space-y-1">
          {items.map((item) => {
            const selected = item.id === active;
            return (
              <Button
                key={item.id}
                type="button"
                variant={selected ? "default" : "ghost"}
                className={cn(
                  "w-full justify-start rounded-md px-3",
                  selected ? "bg-black text-white hover:bg-black/90" : "text-gray-700",
                )}
                onClick={() => onChange(item.id)}
              >
                <span className={cn("mr-2", selected ? "text-white" : "text-gray-600")}>{item.icon}</span>
                <span className="text-sm">{item.label}</span>
              </Button>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}
