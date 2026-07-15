import { addDays, format, isWithinInterval, parseISO } from "date-fns";
import type { Achievement } from "@/lib/legacy-research";
import type { LogPostRecord } from "@/lib/logs";
import type { LongTask, ScheduleEvent } from "@/lib/types";
import { normalizeScheduleCategory } from "@/lib/categories";

type EfficiencyAnalysisStats = {
  rangeText: string;
  categoryHours: Array<{ category: string; hours: number }>;
  dailyResearchHours: Array<{ date: string; hours: number }>;
  taskDoneRate: number;
  completedTasks: number;
  totalTasks: number;
  achievementCount: number;
  moodCounts: Array<{ mood: string; count: number }>;
  fragmentedDays: Array<{ date: string; eventCount: number }>;
};

export function buildEfficiencyStats(
  days: number,
  events: ScheduleEvent[],
  tasks: LongTask[],
  achievements: Achievement[],
  logs: LogPostRecord[],
): EfficiencyAnalysisStats {
  const end = new Date();
  const start = addDays(end, -(days - 1));
  const inRange = (date: string) => {
    try {
      return isWithinInterval(parseISO(date.slice(0, 10)), { start, end });
    } catch {
      return false;
    }
  };
  const rangeEvents = events.filter((event) => inRange(event.date));
  const categoryMap = new Map<string, number>();
  const dailyResearchMap = new Map<string, number>();
  const dailyEventCount = new Map<string, number>();

  for (const event of rangeEvents) {
    const hours = Math.max(0, event.endHour - event.startHour);
    const category = normalizeScheduleCategory(event.category);
    categoryMap.set(category, (categoryMap.get(category) ?? 0) + hours);
    dailyEventCount.set(event.date, (dailyEventCount.get(event.date) ?? 0) + 1);
    if (/科研|文献阅读|会议|学习|论文|文献|实验|写作|投稿/.test(category + event.title)) {
      dailyResearchMap.set(event.date, (dailyResearchMap.get(event.date) ?? 0) + hours);
    }
  }

  const rangeTasks = tasks.filter((task) => inRange(task.dueDate));
  const completedTasks = rangeTasks.filter((task) => task.done).length;
  const moodMap = new Map<string, number>();
  for (const post of logs.filter((item) => inRange(item.createdAt))) {
    if (post.mood) moodMap.set(post.mood, (moodMap.get(post.mood) ?? 0) + 1);
  }

  return {
    rangeText: `${format(start, "yyyy-MM-dd")} 至 ${format(end, "yyyy-MM-dd")}`,
    categoryHours: [...categoryMap.entries()].map(([category, hours]) => ({ category, hours })),
    dailyResearchHours: [...dailyResearchMap.entries()].map(([date, hours]) => ({ date, hours })),
    taskDoneRate: rangeTasks.length ? Math.round((completedTasks / rangeTasks.length) * 100) : 0,
    completedTasks,
    totalTasks: rangeTasks.length,
    achievementCount: achievements.filter((item) => inRange(item.date)).length,
    moodCounts: [...moodMap.entries()].map(([mood, count]) => ({ mood, count })),
    fragmentedDays: [...dailyEventCount.entries()]
      .filter(([, eventCount]) => eventCount >= 6)
      .map(([date, eventCount]) => ({ date, eventCount })),
  };
}

export function buildEfficiencyAnalysisPrompt(stats: EfficiencyAnalysisStats) {
  return `请基于下面的个人工作台统计数据，生成一份效率/科研节奏分析报告。

要求：
1. 输出 Markdown。
2. 包含：投入模式、科研专注度、任务完成质量、情绪/节奏线索、主要风险、下周期优化建议。
3. 不要夸大数据，不要编造。
4. 建议必须可执行。

统计周期：${stats.rangeText}
分类投入：${JSON.stringify(stats.categoryHours)}
每日科研投入：${JSON.stringify(stats.dailyResearchHours)}
任务完成率：${stats.taskDoneRate}% (${stats.completedTasks}/${stats.totalTasks})
成就数量：${stats.achievementCount}
情绪分布：${JSON.stringify(stats.moodCounts)}
碎片化日期：${JSON.stringify(stats.fragmentedDays)}`;
}
