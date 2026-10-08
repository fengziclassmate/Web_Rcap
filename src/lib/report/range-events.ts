import { addDays, format, parseISO } from "date-fns";
import { expandScheduleEvents } from "@/lib/recurrence";
import { splitScheduleEventByDay } from "@/lib/schedule-layout";
import { normalizeEventTag } from "@/lib/event-tags";
import type { ScheduleEvent } from "@/lib/types";

export function reportEventsInRange(events: ScheduleEvent[], start: string, end: string) {
  // Include the previous day's overnight occurrence, then clip by calendar day.
  const expanded = expandScheduleEvents(events, format(addDays(parseISO(start), -1), "yyyy-MM-dd"), end);
  return expanded.flatMap((event) => splitScheduleEventByDay({ ...event, tag: normalizeEventTag(event.tag) }))
    .filter((event) => event.displayDate >= start && event.displayDate <= end)
    .map((event) => ({ ...event, date: event.displayDate, endDate: undefined }));
}

export function reportTime(hour: number) {
  const minutes = Math.round(hour * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
