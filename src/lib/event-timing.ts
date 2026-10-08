import { addDays, format, parseISO } from "date-fns";
import { expandScheduleEvents } from "@/lib/recurrence";
import type { ScheduleEvent } from "@/lib/types";

export function eventTiming(event: ScheduleEvent) {
  const day = parseISO(event.date);
  const start = new Date(day);
  start.setMinutes(Math.round(event.startHour * 60));
  const end = event.endDate ? parseISO(event.endDate) : addDays(day, event.endHour < event.startHour ? 1 : 0);
  end.setMinutes(Math.round(event.endHour * 60));
  return { event, start, end };
}

export function eventTimingsInRange(events: ScheduleEvent[], from: string, to: string) {
  // Include overnight occurrences and ongoing multi-day events.
  return expandScheduleEvents(events, format(addDays(parseISO(from), -1), "yyyy-MM-dd"), to).map((event) => eventTiming(event as ScheduleEvent));
}

export function nextEventTiming(events: ScheduleEvent[], now: Date) {
  const timings = eventTimingsInRange(events, format(now, "yyyy-MM-dd"), format(addDays(now, 366), "yyyy-MM-dd"))
    .filter((item) => !item.event.isCompleted && item.end > item.start && item.end > now);
  const active = timings.filter((item) => item.start <= now).sort((a, b) => +a.end - +b.end)[0];
  const upcoming = timings.filter((item) => item.start > now).sort((a, b) => +a.start - +b.start)[0];
  const next = active ?? upcoming;
  if (!next) return null;
  return { ...next, phase: active ? "进行中" : "待开始", conflicts: timings.filter((item) => item.event.id !== next.event.id && item.start < next.end && item.end > next.start).length };
}
