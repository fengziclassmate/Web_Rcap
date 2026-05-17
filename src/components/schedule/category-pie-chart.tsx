"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { addDays, endOfMonth, format, startOfMonth } from "date-fns";
import type { ScheduleEvent } from "@/lib/types";
import { expandScheduleEvents } from "@/lib/recurrence";
import { getScheduleCategoryVisual } from "@/lib/categories";

type ViewMode = "day" | "week" | "month";

type CategoryPieChartProps = {
  events: ScheduleEvent[];
  currentDate: Date;
  viewMode: ViewMode;
};

function durationMinutes(event: ScheduleEvent) {
  return Math.max(0, Math.round((event.endHour - event.startHour) * 60));
}

function getRange(currentDate: Date, viewMode: ViewMode) {
  if (viewMode === "day") {
    const day = format(currentDate, "yyyy-MM-dd");
    return { start: day, end: day };
  }
  if (viewMode === "month") {
    return {
      start: format(startOfMonth(currentDate), "yyyy-MM-dd"),
      end: format(endOfMonth(currentDate), "yyyy-MM-dd"),
    };
  }
  return {
    start: format(currentDate, "yyyy-MM-dd"),
    end: format(addDays(currentDate, 6), "yyyy-MM-dd"),
  };
}

function formatHours(minutes: number) {
  const hours = minutes / 60;
  return `${hours.toFixed(hours >= 10 ? 0 : 1)}h`;
}

export function CategoryPieChart({ events, currentDate, viewMode }: CategoryPieChartProps) {
  const data = useMemo(() => {
    const range = getRange(currentDate, viewMode);
    const expanded = expandScheduleEvents(events, range.start, range.end) as ScheduleEvent[];
    const categoryMap = new Map<string, { name: string; minutes: number; color: string }>();

    for (const event of expanded) {
      const minutes = durationMinutes(event);
      if (minutes <= 0) continue;
      const visual = getScheduleCategoryVisual(event.category);
      const current = categoryMap.get(visual.name);
      categoryMap.set(visual.name, {
        name: visual.name,
        minutes: (current?.minutes ?? 0) + minutes,
        color: visual.hex,
      });
    }

    const total = Array.from(categoryMap.values()).reduce((sum, item) => sum + item.minutes, 0);
    return Array.from(categoryMap.values())
      .map((item) => ({
        ...item,
        hours: Number((item.minutes / 60).toFixed(2)),
        percentage: total > 0 ? Math.round((item.minutes / total) * 100) : 0,
      }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [currentDate, events, viewMode]);

  if (data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
        当前范围暂无可统计行程。
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-[220px_1fr]">
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="hours" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={2}>
              {data.map((item) => (
                <Cell key={item.name} fill={item.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, _name, item) => [
                `${value} 小时 · ${item.payload.percentage}%`,
                item.payload.name,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-2 self-center">
        {data.slice(0, 8).map((item) => (
          <div key={item.name} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-gray-50">
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="truncate text-gray-700">{item.name}</span>
            </div>
            <span className="font-mono text-xs text-gray-500">{formatHours(item.minutes)}</span>
            <span className="w-10 text-right font-mono text-xs font-semibold text-gray-900">{item.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
