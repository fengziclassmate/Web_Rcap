"use client";

import { addDays, format } from "date-fns";
import type { ScheduleEvent } from "@/lib/types";
import { getScheduleCategoryVisual, normalizeScheduleCategory } from "@/lib/categories";
import { expandScheduleEvents } from "@/lib/recurrence";
import { cn } from "@/lib/utils";

type CategoryVisual = {
  name: string;
  accent: string;
  hex: string;
};

type CategoryStat = CategoryVisual & {
  minutes: number;
  percentage: number;
};

type TimelineSegment = {
  id: string;
  title: string;
  category: string;
  startLabel: string;
  endLabel: string;
  minutes: number;
  width: number;
  offset: number;
  visual: CategoryVisual;
};

type ScheduleTimeAnalyticsProps = {
  events: ScheduleEvent[];
  currentWeekStart: Date;
};

const categoryVisuals: CategoryVisual[] = [
  { name: "深度科研", accent: "bg-sky-400", hex: "#38bdf8" },
  { name: "实验数据", accent: "bg-teal-400", hex: "#2dd4bf" },
  { name: "论文写作", accent: "bg-indigo-400", hex: "#818cf8" },
  { name: "文献阅读", accent: "bg-cyan-400", hex: "#22d3ee" },
  { name: "课程学习", accent: "bg-violet-400", hex: "#a78bfa" },
  { name: "会议沟通", accent: "bg-amber-400", hex: "#fbbf24" },
  { name: "任务推进", accent: "bg-emerald-400", hex: "#34d399" },
  { name: "行政事务", accent: "bg-stone-400", hex: "#a8a29e" },
  { name: "生活事务", accent: "bg-rose-400", hex: "#fb7185" },
  { name: "健康运动", accent: "bg-orange-400", hex: "#fb923c" },
  { name: "通勤外出", accent: "bg-lime-400", hex: "#a3e635" },
  { name: "情绪复盘", accent: "bg-fuchsia-400", hex: "#e879f9" },
  { name: "休息恢复", accent: "bg-slate-400", hex: "#94a3b8" },
  { name: "弹性缓冲", accent: "bg-zinc-400", hex: "#a1a1aa" },
];

const categoryAliasMap: Record<string, string> = {
  个人: "生活事务",
  工作提升: "任务推进",
  运动健康: "健康运动",
  生活运动: "健康运动",
  学习成长: "课程学习",
  娱乐休息: "休息恢复",
  兴趣爱好: "休息恢复",
  放松休闲: "休息恢复",
  "life&other": "生活事务",
  自我提升: "课程学习",
  计划复盘: "任务推进",
  其他: "生活事务",
  数据整理: "实验数据",
  实验分析: "实验数据",
  行政杂务: "行政事务",
  外出通勤: "通勤外出",
  情绪记录: "情绪复盘",
  缓冲时间: "弹性缓冲",
};

const fallbackVisual: CategoryVisual = {
  name: "未分类",
  accent: "bg-zinc-400",
  hex: "#a1a1aa",
};

function normalizeCategoryName(value: string) {
  return normalizeScheduleCategory(value);
}

function getVisual(category: string) {
  return getScheduleCategoryVisual(category);
}

function durationMinutes(event: ScheduleEvent) {
  return Math.max(0, Math.round((event.endHour - event.startHour) * 60));
}

function formatClock(value: number) {
  const hour = Math.floor(value);
  const minute = Math.round((value - hour) * 60);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatDuration(minutes: number) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  if (hour > 0 && minute > 0) return `${hour}h ${minute}m`;
  if (hour > 0) return `${hour}h`;
  return `${minute}m`;
}

function buildPieGradient(stats: CategoryStat[]) {
  if (stats.length === 0) return "conic-gradient(#e5e7eb 0deg 360deg)";

  let cursor = 0;
  const segments = stats.map((item) => {
    const start = cursor;
    const end = cursor + item.percentage * 3.6;
    cursor = end;
    return `${item.hex} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`;
  });
  return `conic-gradient(${segments.join(", ")})`;
}

function getReferenceDate(currentWeekStart: Date) {
  const today = new Date();
  const weekEnd = addDays(currentWeekStart, 6);
  const todayIso = format(today, "yyyy-MM-dd");
  const startIso = format(currentWeekStart, "yyyy-MM-dd");
  const endIso = format(weekEnd, "yyyy-MM-dd");
  return todayIso >= startIso && todayIso <= endIso ? today : currentWeekStart;
}

export function ScheduleTimeAnalytics({ events, currentWeekStart }: ScheduleTimeAnalyticsProps) {
  const weekStartIso = format(currentWeekStart, "yyyy-MM-dd");
  const weekEndIso = format(addDays(currentWeekStart, 6), "yyyy-MM-dd");
  const referenceDate = getReferenceDate(currentWeekStart);
  const referenceIso = format(referenceDate, "yyyy-MM-dd");

  const expandedEvents = expandScheduleEvents(events, weekStartIso, weekEndIso) as ScheduleEvent[];
  const dayEvents = expandedEvents
    .filter((event) => event.date === referenceIso && durationMinutes(event) > 0)
    .sort((a, b) => a.startHour - b.startHour || a.endHour - b.endHour);

  const timelineSegments: TimelineSegment[] = dayEvents.map((event) => {
    const minutes = durationMinutes(event);
    const visual = getVisual(event.category);
    return {
      id: event.id,
      title: event.title,
      category: normalizeCategoryName(event.category),
      startLabel: formatClock(event.startHour),
      endLabel: formatClock(event.endHour),
      minutes,
      width: Math.max(2, (minutes / (24 * 60)) * 100),
      offset: (event.startHour / 24) * 100,
      visual,
    };
  });

  const weekCategoryMap = new Map<string, CategoryStat>();
  for (const event of expandedEvents) {
    const minutes = durationMinutes(event);
    if (minutes <= 0) continue;
    const visual = getVisual(event.category);
    const key = visual.name;
    const current = weekCategoryMap.get(key);
    weekCategoryMap.set(key, {
      ...visual,
      minutes: (current?.minutes ?? 0) + minutes,
      percentage: 0,
    });
  }

  const weekTotalMinutes = Array.from(weekCategoryMap.values()).reduce((total, item) => total + item.minutes, 0);
  const weekStats = Array.from(weekCategoryMap.values())
    .map((item) => ({
      ...item,
      percentage: weekTotalMinutes > 0 ? (item.minutes / weekTotalMinutes) * 100 : 0,
    }))
    .sort((a, b) => b.minutes - a.minutes);
  const pieGradient = buildPieGradient(weekStats);

  return (
    <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">时间分布分析</h2>
        <p className="mt-1 text-xs text-gray-500">按行程分类查看当天顺序和本周时间占比。</p>
      </div>

      <div className="space-y-5 p-4">
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-900">当天行程时间条</p>
              <p className="mt-1 text-xs text-gray-500">{referenceIso}</p>
            </div>
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">
              {formatDuration(dayEvents.reduce((total, event) => total + durationMinutes(event), 0))}
            </span>
          </div>

          {timelineSegments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
              当天暂无行程。
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative h-7 overflow-hidden rounded-full bg-gray-100">
                {timelineSegments.map((segment) => (
                  <div
                    key={segment.id}
                    className={cn("absolute top-0 h-full border-r border-white/70", segment.visual.accent)}
                    style={{ left: `${segment.offset}%`, width: `${segment.width}%` }}
                    title={`${segment.startLabel}-${segment.endLabel} ${segment.title}`}
                  />
                ))}
              </div>
              <div className="space-y-2">
                {timelineSegments.map((segment) => (
                  <div key={segment.id} className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <span className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", segment.visual.accent)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{segment.title}</p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {segment.startLabel}-{segment.endLabel} · {segment.category} · {formatDuration(segment.minutes)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-900">本周分类占比</p>
              <p className="mt-1 text-xs text-gray-500">
                {weekStartIso} 至 {weekEndIso}
              </p>
            </div>
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">
              {formatDuration(weekTotalMinutes)}
            </span>
          </div>

          {weekStats.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
              本周暂无可统计行程。
            </div>
          ) : (
            <div className="grid grid-cols-[112px_1fr] gap-4">
              <div className="relative size-28 rounded-full" style={{ background: pieGradient }}>
                <div className="absolute inset-6 rounded-full bg-white shadow-inner" />
              </div>
              <div className="space-y-2">
                {weekStats.slice(0, 6).map((item) => (
                  <div key={item.name} className="grid grid-cols-[1fr_auto] items-center gap-2 text-xs">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", item.accent)} />
                        <span className="truncate text-gray-700">{item.name}</span>
                      </div>
                    </div>
                    <span className="font-medium text-gray-900">{item.percentage.toFixed(0)}%</span>
                    <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
                      <div className={cn("h-full rounded-full", item.accent)} style={{ width: `${item.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
