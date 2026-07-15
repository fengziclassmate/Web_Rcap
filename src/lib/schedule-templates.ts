import type { EventTag } from "@/lib/types";

export type SplitScheduleGranularity = "45-15" | "50-10";

export type ScheduleTemplate = {
  id: string;
  title: string;
  category: string;
  tag: EventTag;
  notes: string;
  requirements: string[];
};

export type TemplatePlacement = {
  date: string;
  startHour: number;
  endHour: number;
};

type PlacementDate = {
  date: string;
  weekday: number;
};

type BusyInterval = {
  date: string;
  startHour: number;
  endHour: number;
};

const scheduleTemplateStorageKey = "schedule-event-templates-v1";

export const defaultScheduleTemplates: ScheduleTemplate[] = [
  {
    id: "default-rest-template",
    title: "休息",
    category: "休息",
    tag: null,
    notes: "",
    requirements: [],
  },
];

function normalizeTag(value: unknown): EventTag {
  return value === "待定" || value === "不着急" || value === "不可后退" ? value : null;
}

export function normalizeScheduleTemplates(value: unknown): ScheduleTemplate[] {
  if (!Array.isArray(value)) return defaultScheduleTemplates.map((template) => ({ ...template }));

  const templates = value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<ScheduleTemplate>;
    const title = typeof candidate.title === "string" ? candidate.title.trim() : "";
    if (!title) return [];

    return [
      {
        id:
          typeof candidate.id === "string" && candidate.id.trim()
            ? candidate.id
            : `schedule-template-${index}`,
        title,
        category:
          typeof candidate.category === "string" && candidate.category.trim()
            ? candidate.category.trim()
            : "其他",
        tag: normalizeTag(candidate.tag),
        notes: typeof candidate.notes === "string" ? candidate.notes : "",
        requirements: Array.isArray(candidate.requirements)
          ? candidate.requirements.filter((item): item is string => typeof item === "string")
          : [],
      },
    ];
  });

  return templates;
}

export function loadScheduleTemplates() {
  if (typeof window === "undefined") return defaultScheduleTemplates.map((template) => ({ ...template }));
  try {
    const raw = window.localStorage.getItem(scheduleTemplateStorageKey);
    return normalizeScheduleTemplates(raw ? JSON.parse(raw) : null);
  } catch {
    return defaultScheduleTemplates.map((template) => ({ ...template }));
  }
}

export function saveScheduleTemplates(templates: ScheduleTemplate[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(scheduleTemplateStorageKey, JSON.stringify(templates));
  } catch {
    // localStorage may be unavailable in private browsing mode.
  }
}

export function getSplitTailSlot(granularity: SplitScheduleGranularity) {
  return granularity === "50-10"
    ? { offsetMinutes: 50, durationMinutes: 10 }
    : { offsetMinutes: 45, durationMinutes: 15 };
}

export function buildSplitTailPlacements({
  dates,
  weekdays,
  startHour,
  endHour,
  granularity,
  busyIntervals,
}: {
  dates: PlacementDate[];
  weekdays: number[];
  startHour: number;
  endHour: number;
  granularity: SplitScheduleGranularity;
  busyIntervals: BusyInterval[];
}) {
  if (startHour >= endHour) return { placements: [] as TemplatePlacement[], skipped: 0 };

  const allowedWeekdays = new Set(weekdays);
  const busyByDate = new Map<string, BusyInterval[]>();
  for (const interval of busyIntervals) {
    const dateIntervals = busyByDate.get(interval.date) ?? [];
    dateIntervals.push(interval);
    busyByDate.set(interval.date, dateIntervals);
  }

  const { offsetMinutes, durationMinutes } = getSplitTailSlot(granularity);
  const placements: TemplatePlacement[] = [];
  let skipped = 0;

  for (const date of dates) {
    if (!allowedWeekdays.has(date.weekday)) continue;
    const dateIntervals = busyByDate.get(date.date) ?? [];

    for (let hour = Math.max(0, Math.floor(startHour)); hour < Math.min(24, endHour); hour += 1) {
      const slotStart = hour + offsetMinutes / 60;
      const slotEnd = slotStart + durationMinutes / 60;
      if (slotStart < startHour || slotEnd > endHour) continue;

      const overlaps = dateIntervals.some(
        (interval) => interval.startHour < slotEnd && slotStart < interval.endHour,
      );
      if (overlaps) {
        skipped += 1;
        continue;
      }

      placements.push({ date: date.date, startHour: slotStart, endHour: slotEnd });
    }
  }

  return { placements, skipped };
}
