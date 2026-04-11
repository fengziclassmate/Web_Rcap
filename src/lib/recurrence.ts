import { addDays } from "date-fns";

export type RecurrenceKind = "daily" | "weekly";

export type RecurrenceConfig = {
  kind: RecurrenceKind;
  /** JS getDay(): 0=周日 … 6=周六 */
  weekdays?: number[];
};

export type RecurrenceInstanceOverride = Partial<{
  title: string;
  startHour: number;
  endHour: number;
  notes: string;
  requirements: string[];
  isCompleted: boolean;
  category: string;
  tag: string | null;
}>;

/** 与 page 中 ScheduleEvent 对齐，供展开逻辑使用（避免引用 app） */
export type ExpandableScheduleEvent = {
  id: string;
  date: string;
  startHour: number;
  endHour: number;
  title: string;
  notes: string;
  requirements: string[];
  isCompleted: boolean;
  category: string;
  tag: string | null;
  recurrence?: RecurrenceConfig | null;
  exceptionDates?: string[];
  recurrenceOverrides?: Record<string, RecurrenceInstanceOverride>;
  /** 不生成此日及之后的实例（ISO yyyy-MM-dd，含当日不生成） */
  recurrenceEndExclusive?: string | null;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseSyntheticEventId(id: string): { masterId: string; occurrenceDate: string } | null {
  if (!id.includes("__")) return null;
  const i = id.lastIndexOf("__");
  const masterId = id.slice(0, i);
  const occurrenceDate = id.slice(i + 2);
  if (!ISO_DATE.test(occurrenceDate)) return null;
  return { masterId, occurrenceDate };
}

function parseISODateLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatISODateLocal(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

function maxDateStr(a: string, b: string): string {
  return a > b ? a : b;
}

function enumerateOccurrenceDates(
  master: ExpandableScheduleEvent,
  rangeStartStr: string,
  rangeEndStr: string,
): string[] {
  const anchor = master.date;
  const start = maxDateStr(anchor, rangeStartStr);
  const result: string[] = [];
  let cur = parseISODateLocal(start);
  const end = parseISODateLocal(rangeEndStr);
  const rule = master.recurrence;
  if (!rule?.kind) return result;

  while (cur <= end) {
    const d = formatISODateLocal(cur);
    if (master.recurrenceEndExclusive && d >= master.recurrenceEndExclusive) {
      break;
    }
    if (d >= anchor) {
      if (rule.kind === "daily") {
        result.push(d);
      } else if (rule.kind === "weekly") {
        const wd = cur.getDay();
        if (rule.weekdays?.includes(wd)) {
          result.push(d);
        }
      }
    }
    cur = addDays(cur, 1);
  }
  return result;
}

/**
 * 将存储中的主事件（含循环定义）展开为当前视图范围内的展示用事件。
 * 循环实例的 id 为 `${masterId}__${yyyy-MM-dd}`，且不携带 recurrence 字段。
 */
export function expandScheduleEvents(
  events: ExpandableScheduleEvent[],
  rangeStartStr: string,
  rangeEndStr: string,
): ExpandableScheduleEvent[] {
  const out: ExpandableScheduleEvent[] = [];
  for (const e of events) {
    if (!e.recurrence?.kind) {
      if (e.date >= rangeStartStr && e.date <= rangeEndStr) {
        out.push(e);
      }
      continue;
    }
    for (const d of enumerateOccurrenceDates(e, rangeStartStr, rangeEndStr)) {
      if (e.exceptionDates?.includes(d)) continue;
      const ov = e.recurrenceOverrides?.[d] ?? {};
      out.push({
        ...e,
        ...ov,
        date: d,
        id: `${e.id}__${d}`,
        recurrence: undefined,
        exceptionDates: undefined,
        recurrenceOverrides: undefined,
        recurrenceEndExclusive: undefined,
      });
    }
  }
  return out;
}

export const RECURRENCE_INSTANCE_OVERRIDE_KEYS = [
  "title",
  "startHour",
  "endHour",
  "notes",
  "requirements",
  "isCompleted",
  "category",
  "tag",
] as const;

export type RecurrenceInstanceOverrideKey = (typeof RECURRENCE_INSTANCE_OVERRIDE_KEYS)[number];

export function pickRecurrenceOverridePatch(
  patch: Partial<ExpandableScheduleEvent>,
): RecurrenceInstanceOverride {
  const o: RecurrenceInstanceOverride = {};
  for (const key of RECURRENCE_INSTANCE_OVERRIDE_KEYS) {
    if (key in patch && patch[key] !== undefined) {
      (o as Record<string, unknown>)[key] = patch[key];
    }
  }
  return o;
}

/** 周一=1 … 周日=0，用于 UI 展示顺序 */
export const WEEKDAY_UI_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export const WEEKDAY_SHORT_LABEL: Record<number, string> = {
  0: "日",
  1: "一",
  2: "二",
  3: "三",
  4: "四",
  5: "五",
  6: "六",
};

export function parseExceptionDateList(text: string): string[] {
  const raw = text
    .split(/[\s,，;；]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const s of raw) {
    if (ISO_DATE.test(s)) out.push(s);
  }
  return [...new Set(out)];
}
