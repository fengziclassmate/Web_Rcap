"use client";

import type { ReactNode } from "react";
import {
  BookOpen,
  CalendarDays,
  FileText,
  FlaskConical,
  Footprints,
  KanbanSquare,
  LayoutDashboard,
  NotebookPen,
  Send,
  Trophy,
  Users,
} from "lucide-react";
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
  | "literature"
  | "logs";

const items: Array<{
  id: MonitoringModuleId;
  label: string;
  group: string;
  icon: ReactNode;
}> = [
  { id: "schedule", label: "个人日程", group: "Today", icon: <CalendarDays className="h-4 w-4" aria-hidden /> },
  { id: "project-checkins", label: "Project 打卡", group: "Habit", icon: <KanbanSquare className="h-4 w-4" aria-hidden /> },
  { id: "achievements", label: "成就记录", group: "Life", icon: <Trophy className="h-4 w-4" aria-hidden /> },
  { id: "footprints", label: "足迹跟踪", group: "Life", icon: <Footprints className="h-4 w-4" aria-hidden /> },
  { id: "research", label: "科研项目", group: "Research", icon: <FlaskConical className="h-4 w-4" aria-hidden /> },
  { id: "paper", label: "论文进度", group: "Writing", icon: <FileText className="h-4 w-4" aria-hidden /> },
  { id: "literature", label: "文献阅读", group: "Reading", icon: <BookOpen className="h-4 w-4" aria-hidden /> },
  { id: "submissions", label: "投稿记录", group: "Publish", icon: <Send className="h-4 w-4" aria-hidden /> },
  { id: "meetings", label: "组会记录", group: "Meeting", icon: <Users className="h-4 w-4" aria-hidden /> },
  { id: "logs", label: "动态日志", group: "Journal", icon: <NotebookPen className="h-4 w-4" aria-hidden /> },
];

export function MonitoringSidebar({
  active,
  onChange,
}: {
  active: MonitoringModuleId;
  onChange: (id: MonitoringModuleId) => void;
}) {
  return (
    <section className="glass-panel overflow-hidden rounded-[1.35rem]">
      <div className="flex flex-col gap-4 px-4 py-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="nav-orb flex size-11 shrink-0 items-center justify-center rounded-2xl">
            <LayoutDashboard className="h-5 w-5 text-white" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold tracking-tight text-stone-950">个人科研与生活工作台</p>
          </div>
        </div>

        <nav className="-mx-1 overflow-x-auto pb-1 xl:mx-0 xl:flex-1 xl:pb-0" aria-label="模块切换">
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
