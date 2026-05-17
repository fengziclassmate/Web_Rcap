import { addDays, format, isWithinInterval, parseISO } from "date-fns";
import type { Achievement } from "@/components/monitoring/achievements-panel";
import type { LongTask, ScheduleEvent } from "@/lib/types";

export type WeeklyReportData = {
  rangeText: string;
  events: ScheduleEvent[];
  completedEvents: ScheduleEvent[];
  pendingTasks: LongTask[];
  completedTasks: LongTask[];
  achievements: Achievement[];
  categoryHours: Array<{ category: string; hours: number }>;
};

export type SavedWeeklyReport = {
  id: string;
  title: string;
  rangeText: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export function buildWeeklyReportData(
  currentWeekStart: Date,
  events: ScheduleEvent[],
  tasks: LongTask[],
  achievements: Achievement[],
): WeeklyReportData {
  const start = currentWeekStart;
  const end = addDays(start, 6);
  const rangeText = `${format(start, "yyyy-MM-dd")} 至 ${format(end, "yyyy-MM-dd")}`;
  const inWeek = (date: string) => {
    try {
      return isWithinInterval(parseISO(date.slice(0, 10)), { start, end });
    } catch {
      return false;
    }
  };

  const weekEvents = events.filter((event) => inWeek(event.date));
  const categoryMap = new Map<string, number>();
  for (const event of weekEvents) {
    const hours = Math.max(0, event.endHour - event.startHour);
    categoryMap.set(event.category, (categoryMap.get(event.category) ?? 0) + hours);
  }

  return {
    rangeText,
    events: weekEvents,
    completedEvents: weekEvents.filter((event) => event.isCompleted),
    pendingTasks: tasks.filter((task) => !task.done),
    completedTasks: tasks.filter((task) => task.done && inWeek(task.dueDate)),
    achievements: achievements.filter((item) => inWeek(item.date)),
    categoryHours: [...categoryMap.entries()]
      .map(([category, hours]) => ({ category, hours: Math.round(hours * 10) / 10 }))
      .sort((a, b) => b.hours - a.hours),
  };
}

export function buildWeeklyReportPrompt(data: WeeklyReportData) {
  return `请根据下面的个人科研与生活工作台数据，生成一份中文周报草稿。

硬性格式要求：
1. 输出纯文本，不要使用 Markdown。
2. 不要使用 #、##、**、-、*、\`\`\` 等 Markdown 符号。
3. 标题直接写成普通文本，例如“本周概览”“科研与论文推进”“任务完成情况”。
4. 段落之间用空行分隔。
5. 列举事项时使用中文序号，如“1. ”“2. ”，不要使用项目符号。

内容要求：
1. 结构包括：本周概览、科研与论文推进、任务完成情况、时间投入、问题与风险、下周计划。
2. 不要编造不存在的数据。
3. 语气适合自己复盘，也能稍作修改后发给导师或团队。
4. 内容要具体，不要空泛表扬。

周范围：${data.rangeText}

本周行程：
${data.events.map((event, index) => `${index + 1}. ${event.date} ${event.startHour}:00-${event.endHour}:00 ${event.title} [${event.category}] ${event.isCompleted ? "已完成" : "未完成"}`).join("\n") || "无"}

已完成行程：
${data.completedEvents.map((event, index) => `${index + 1}. ${event.title}`).join("\n") || "无"}

本周完成任务：
${data.completedTasks.map((task, index) => `${index + 1}. ${task.name}`).join("\n") || "无"}

未完成任务：
${data.pendingTasks.map((task, index) => `${index + 1}. ${task.name}，截止 ${task.dueDate}，优先级 ${task.priority}`).join("\n") || "无"}

本周成就：
${data.achievements.map((item, index) => `${index + 1}. ${item.date} ${item.title}${item.note ? `：${item.note}` : ""}`).join("\n") || "无"}

分类投入时间：
${data.categoryHours.map((item, index) => `${index + 1}. ${item.category}: ${item.hours} 小时`).join("\n") || "无"}`;
}
