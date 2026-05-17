"use client";

import { addDays, endOfMonth, format, startOfMonth } from "date-fns";
import { useMemo } from "react";
import type { ScheduleEvent } from "@/lib/types";
import { getScheduleCategoryVisual } from "@/lib/categories";
import { expandScheduleEvents } from "@/lib/recurrence";
import { CategoryPieChart } from "@/components/schedule/category-pie-chart";

type ViewMode = "day" | "week" | "month";

type TimelineSegment = {
  id: string;
  title: string;
  category: string;
  startLabel: string;
  endLabel: string;
  minutes: number;
  width: number;
  offset: number;
  color: string;
};

type ScheduleTimeAnalyticsProps = {
  events: ScheduleEvent[];
  currentWeekStart: Date;
  viewMode?: ViewMode;
};

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

function getRange(currentDate: Date, viewMode: ViewMode) {
  if (viewMode === "day") {
    const day = format(currentDate, "yyyy-MM-dd");
    return { start: day, end: day, label: day };
  }
  if (viewMode === "month") {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return {
      start: format(start, "yyyy-MM-dd"),
      end: format(end, "yyyy-MM-dd"),
      label: format(currentDate, "yyyy/MM"),
    };
  }
  return {
    start: format(currentDate, "yyyy-MM-dd"),
    end: format(addDays(currentDate, 6), "yyyy-MM-dd"),
    label: `${format(currentDate, "MM/dd")} - ${format(addDays(currentDate, 6), "MM/dd")}`,
  };
}

function getReferenceDate(currentWeekStart: Date) {
  const today = new Date();
  const weekEnd = addDays(currentWeekStart, 6);
  const todayIso = format(today, "yyyy-MM-dd");
  const startIso = format(currentWeekStart, "yyyy-MM-dd");
  const endIso = format(weekEnd, "yyyy-MM-dd");
  return todayIso >= startIso && todayIso <= endIso ? today : currentWeekStart;
}

export function ScheduleTimeAnalytics({ events, currentWeekStart, viewMode = "week" }: ScheduleTimeAnalyticsProps) {
  const range = getRange(currentWeekStart, viewMode);
  const referenceDate = viewMode === "week" ? getReferenceDate(currentWeekStart) : currentWeekStart;
  const referenceIso = format(referenceDate, "yyyy-MM-dd");

  const { timelineSegments, dayTotalMinutes } = useMemo(() => {
    const expanded = expandScheduleEvents(events, range.start, range.end) as ScheduleEvent[];
    const dayEvents = expanded
      .filter((event) => event.date === referenceIso && durationMinutes(event) > 0)
      .sort((a, b) => a.startHour - b.startHour || a.endHour - b.endHour);

    const segments: TimelineSegment[] = dayEvents.map((event) => {
      const minutes = durationMinutes(event);
      const visual = getScheduleCategoryVisual(event.category);
      return {
        id: event.id,
        title: event.title,
        category: visual.name,
        startLabel: formatClock(event.startHour),
        endLabel: formatClock(event.endHour),
        minutes,
        width: Math.max(2, (minutes / (24 * 60)) * 100),
        offset: (event.startHour / 24) * 100,
        color: visual.hex,
      };
    });

    return {
      timelineSegments: segments,
      dayTotalMinutes: dayEvents.reduce((total, event) => total + durationMinutes(event), 0),
    };
  }, [events, range.end, range.start, referenceIso]);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">时间分布分析</h2>
      </div>

      <div className="space-y-6 p-4">
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-900">当天行程时间条</p>
              <p className="mt-1 text-xs text-gray-500">{referenceIso}</p>
            </div>
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">
              {formatDuration(dayTotalMinutes)}
            </span>
          </div>

          {timelineSegments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
              当天暂无行程。
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative h-7 overflow-hidden rounded-full bg-gray-100">
                {timelineSegments.map((segment) => (
                  <div
                    key={segment.id}
                    className="absolute top-0 h-full border-r border-white/70"
                    style={{ left: `${segment.offset}%`, width: `${segment.width}%`, backgroundColor: segment.color }}
                    title={`${segment.startLabel}-${segment.endLabel} ${segment.title}`}
                  />
                ))}
              </div>
              <div className="space-y-2">
                {timelineSegments.map((segment) => (
                  <div key={segment.id} className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />
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
          <div className="mb-3">
            <p className="text-sm font-medium text-gray-900">分类时间占比</p>
            <p className="mt-1 text-xs text-gray-500">{range.label}</p>
          </div>
          <CategoryPieChart events={events} currentDate={currentWeekStart} viewMode={viewMode} />
        </div>
      </div>
    </section>
  );
}
