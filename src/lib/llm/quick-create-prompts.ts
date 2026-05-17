import { addDays, format } from "date-fns";
import { DEFAULT_SCHEDULE_CATEGORY } from "@/lib/categories";

export type QuickCreateResult =
  | {
      type: "event";
      title: string;
      date: string;
      startHour: number;
      endHour: number;
      category: string;
      notes: string;
    }
  | {
      type: "task";
      title: string;
      dueDate: string;
      notes: string;
    }
  | {
      type: "annual";
      title: string;
      notes: string;
    };

export function buildQuickCreatePrompt(input: string, today = new Date()) {
  return `请把用户输入识别为要创建的对象，并只输出 JSON，不要 Markdown。

当前日期：${format(today, "yyyy-MM-dd")}
明天日期：${format(addDays(today, 1), "yyyy-MM-dd")}
后天日期：${format(addDays(today, 2), "yyyy-MM-dd")}

可创建对象：
1. event：日程。用户明确给出日期/相对日期和时间段时使用，例如“明天下午3-5点写论文”。
2. task：长期任务。用户说的是待办、任务、截止日期、某天前完成，但没有具体时间段时使用，例如“下周五前完成文献综述”。
3. annual：年度计划任务。用户表达年度目标、长期年度愿望或全年计划时使用，例如“今年完成毕业论文初稿”。

输出格式：
日程：
{"type":"event","title":"...","date":"yyyy-MM-dd","startHour":14,"endHour":16.5,"category":"...","notes":"..."}

长期任务：
{"type":"task","title":"...","dueDate":"yyyy-MM-dd","notes":"..."}

年度计划：
{"type":"annual","title":"...","notes":"..."}

规则：
1. 只能输出一个 JSON 对象。
2. event 的 startHour/endHour 使用 24 小时小数，例如 14.5 表示 14:30。
3. event 的 category 从这些选一个：深度科研、实验数据、论文写作、文献阅读、课程学习、会议沟通、任务推进、行政事务、吃饭休息、健康运动、家务杂事、社交娱乐、通勤外出、情绪复盘、弹性缓冲。
4. task 如果没有明确截止日期，dueDate 使用当前日期。
5. annual 不需要日期。
6. 无法判断时优先返回 task。

用户输入：${input}`;
}

function cleanLLMJson(raw: string) {
  return raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "");
}

export function parseQuickCreateResponse(raw: string): QuickCreateResult {
  const parsed = JSON.parse(cleanLLMJson(raw)) as Partial<QuickCreateResult> & { error?: string };
  if (parsed.error) throw new Error(parsed.error);

  if (parsed.type === "event") {
    if (
      !parsed.title ||
      !parsed.date ||
      typeof parsed.startHour !== "number" ||
      typeof parsed.endHour !== "number"
    ) {
      throw new Error("LLM 返回的日程结构不完整");
    }
    return {
      type: "event",
      title: parsed.title,
      date: parsed.date,
      startHour: parsed.startHour,
      endHour: parsed.endHour,
      category: parsed.category || DEFAULT_SCHEDULE_CATEGORY,
      notes: parsed.notes || "",
    };
  }

  if (parsed.type === "annual") {
    if (!parsed.title) throw new Error("LLM 返回的年度计划结构不完整");
    return {
      type: "annual",
      title: parsed.title,
      notes: parsed.notes || "",
    };
  }

  if (!parsed.title) throw new Error("LLM 返回的任务结构不完整");
  return {
    type: "task",
    title: parsed.title,
    dueDate: "dueDate" in parsed && typeof parsed.dueDate === "string" ? parsed.dueDate : format(new Date(), "yyyy-MM-dd"),
    notes: parsed.notes || "",
  };
}
