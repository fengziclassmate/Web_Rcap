"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  Trophy,
  Footprints,
  FlaskConical,
  FileText,
  Send,
  Users,
  LayoutDashboard,
} from "lucide-react";

export type MonitoringModuleId =
  | "schedule"
  | "achievements"
  | "footprints"
  | "research"
  | "paper"
  | "submissions"
  | "meetings";

const items: Array<{
  id: MonitoringModuleId;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: "schedule", label: "个人行程管理", icon: <CalendarDays className="h-4 w-4" aria-hidden /> },
  { id: "achievements", label: "成就记录", icon: <Trophy className="h-4 w-4" aria-hidden /> },
  { id: "footprints", label: "足迹跟踪", icon: <Footprints className="h-4 w-4" aria-hidden /> },
  { id: "research", label: "科研项目进度", icon: <FlaskConical className="h-4 w-4" aria-hidden /> },
  { id: "paper", label: "论文进度", icon: <FileText className="h-4 w-4" aria-hidden /> },
  { id: "submissions", label: "投稿记录", icon: <Send className="h-4 w-4" aria-hidden /> },
  { id: "meetings", label: "组会记录", icon: <Users className="h-4 w-4" aria-hidden /> },
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
          <p className="truncate text-sm font-semibold text-gray-900">博士生精神状态监测站</p>
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
                <span className={cn("mr-2", selected ? "text-white" : "text-gray-600")}>
                  {item.icon}
                </span>
                <span className="text-sm">{item.label}</span>
              </Button>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}

