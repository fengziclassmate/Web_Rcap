import { addDays, addMinutes, format, parseISO } from "date-fns";
import { expandScheduleEvents } from "@/lib/recurrence";
import type { ScheduleEvent } from "@/lib/types";

export const normalizeBufferMinutes = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(180, Math.round(value))) : 0;

export function eventTiming(event: ScheduleEvent) {
  const day = parseISO(event.date);
  const start = new Date(day);
  start.setMinutes(Math.round(event.startHour * 60));
  const end = event.endDate ? parseISO(event.endDate) : addDays(day, event.endHour < event.startHour ? 1 : 0);
  end.setMinutes(Math.round(event.endHour * 60));
  return {
    event, start, end,
    prepareAt: addMinutes(start, -normalizeBufferMinutes(event.bufferBeforeMinutes)),
    freeAt: addMinutes(end, normalizeBufferMinutes(event.bufferAfterMinutes)),
  };
}

export function eventTimingsInRange(events: ScheduleEvent[], from: string, to: string) {
  // An overnight event can end late tomorrow, with recovery extending one day further.
  return (expandScheduleEvents(events, format(addDays(parseISO(from), -2), "yyyy-MM-dd"), format(addDays(parseISO(to), 1), "yyyy-MM-dd")) as ScheduleEvent[]).map(eventTiming);
}

export function nextEventTiming(events: ScheduleEvent[], now: Date) {
  // Look ahead one year, including tomorrow's preparation and overnight events.
  const timings = eventTimingsInRange(events, format(now, "yyyy-MM-dd"), format(addDays(now, 366), "yyyy-MM-dd"))
    .filter((item) => !item.event.isCompleted && item.end > item.start && item.freeAt > now);
  const active = timings.filter((item) => item.start <= now && item.end > now).sort((a, b) => +a.end - +b.end)[0];
  const preparing = timings.filter((item) => item.prepareAt <= now && item.start > now).sort((a, b) => +a.start - +b.start)[0];
  const recovering = timings.filter((item) => item.end <= now).sort((a, b) => +a.freeAt - +b.freeAt)[0];
  const upcoming = timings.filter((item) => item.start > now).sort((a, b) => +a.prepareAt - +b.prepareAt || +a.start - +b.start)[0];
  const next = active ?? preparing ?? recovering ?? upcoming;
  if (!next) return null;
  const phase = active ? "进行中" : preparing ? "该准备了" : recovering ? "结束后缓冲" : "待开始";
  return { ...next, phase, conflicts: timings.filter((item) => item.event.id !== next.event.id && item.prepareAt < next.freeAt && item.freeAt > next.prepareAt).length };
}
