import { addDays, format } from "date-fns";
import type { ScheduleEvent } from "@/lib/types";
import {
  DEFAULT_SCHEDULE_CATEGORY,
  SCHEDULE_CATEGORY_PROMPT_LIST,
  normalizeScheduleCategory,
} from "@/lib/categories";

export type ParsedScheduleEvent = Omit<ScheduleEvent, "id" | "isCompleted" | "requirements" | "tag">;

export function buildScheduleParsePrompt(input: string, today = new Date()) {
  return `请把用户的自然语言日程转换为 JSON。

当前日期：${format(today, "yyyy-MM-dd")}
明天日期：${format(addDays(today, 1), "yyyy-MM-dd")}

要求：
1. 只输出 JSON，不要 Markdown。
2. 字段：title, date, startHour, endHour, category, notes。
3. startHour/endHour 使用 24 小时小数，例如 14.5 表示 14:30。
4. category 从这些里面选一个：${SCHEDULE_CATEGORY_PROMPT_LIST}。
5. 无法解析日期或时间时，返回 {"error":"原因"}。

用户输入：${input}`;
}

export function parseScheduleEventResponse(raw: string): ParsedScheduleEvent {
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "");
  const parsed = JSON.parse(cleaned) as Partial<ParsedScheduleEvent> & { error?: string };
  if (parsed.error) throw new Error(parsed.error);
  if (!parsed.title || !parsed.date || typeof parsed.startHour !== "number" || typeof parsed.endHour !== "number") {
    throw new Error("LLM 返回的日程结构不完整");
  }
  return {
    title: parsed.title,
    date: parsed.date,
    startHour: parsed.startHour,
    endHour: parsed.endHour,
    category: normalizeScheduleCategory(parsed.category || DEFAULT_SCHEDULE_CATEGORY),
    notes: parsed.notes || "",
    recurrence: null,
    exceptionDates: [],
    recurrenceOverrides: {},
    recurrenceEndExclusive: null,
  };
}
