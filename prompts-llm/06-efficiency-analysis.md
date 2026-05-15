# Prompt 06 — 情绪/效率模式分析

> **依赖：** 必须先完成 Prompt 01（LLM 基础架构）
> **目标：** 基于过去 N 天的日程、任务、情绪记录等数据，生成一份可视化的科研效率分析报告，
> 指出行为模式中的问题并给出建议。

---

## 一、新增文件：`src/lib/llm/analysis-prompts.ts`

数据分析 + prompt 构建。

```typescript
import { subDays, format } from "date-fns";
import type { ScheduleEvent, LongTask, Achievement, ProjectCheckin } from "@/lib/types";

/** 分析范围 */
export type AnalysisPeriod = "7d" | "14d" | "30d";

/** 汇总统计数据 */
export type AnalysisStats = {
  periodDays: number;
  periodLabel: string;
  /** 按 category 统计的投入时间 (分钟) */
  categoryMinutes: Record<string, number>;
  /** 每天科研类事件总时长 (分钟) */
  dailyResearchMinutes: { date: string; minutes: number }[];
  /** 任务完成率 */
  taskStats: {
    total: number;
    completed: number;
    incomplete: number;
  };
  /** 按优先级的未完成任务数 */
  priorityIncomplete: Record<string, number>;
  /** 每日任务完成数 */
  dailyTaskCompletions: { date: string; count: number }[];
  /** 情绪记录 */
  moodEntries: { date: string; note: string }[];
  /** 成就数 */
  achievementCount: number;
  /** 各分类事件数量 */
  categoryEventCounts: Record<string, number>;
  /** 注意力碎片化指数（平均每天切换分类数） */
  attentionFragmentation: {
    dailyCategorySwitches: number[];
    average: number;
  };
};

// 科研相关分类关键词
const RESEARCH_CATEGORIES = new Set([
  "深度科研", "实验数据", "论文写作", "文献阅读",
  "情绪复盘", "会议沟通",
]);

/** 从 events 中提取情绪记录（分类为"情绪复盘"的事件） */
function extractMoodEntries(events: ScheduleEvent[]): { date: string; note: string }[] {
  return events
    .filter((e) => e.category === "情绪复盘" && e.notes?.trim())
    .map((e) => ({ date: e.date, note: e.notes.trim() }));
}

/** 计算注意力碎片化 */
function calcFragmentation(eventsByDate: Record<string, ScheduleEvent[]>) {
  const switches: number[] = [];
  for (const dayEvents of Object.values(eventsByDate)) {
    const sorted = [...dayEvents].sort((a, b) => a.startHour - b.startHour);
    const uniqueCategories = new Set(sorted.map((e) => e.category));
    switches.push(uniqueCategories.size);
  }
  const avg = switches.length > 0
    ? switches.reduce((a, b) => a + b, 0) / switches.length
    : 0;
  return { dailyCategorySwitches: switches, average: Math.round(avg * 10) / 10 };
}

/** 构建分析用的统计数据 */
export function buildAnalysisStats(
  events: ScheduleEvent[],
  tasks: LongTask[],
  achievements: Achievement[],
  period: AnalysisPeriod,
): AnalysisStats {
  const days = period === "7d" ? 7 : period === "14d" ? 14 : 30;
  const now = new Date();
  const startDate = subDays(now, days);
  const startStr = format(startDate, "yyyy-MM-dd");

  const periodEvents = events.filter((e) => e.date >= startStr);
  const periodTasks = tasks; // tasks 不过滤
  const periodAchievements = achievements.filter((a) => a.date >= startStr);

  // 分类分钟统计
  const categoryMinutes: Record<string, number> = {};
  for (const evt of periodEvents) {
    const minutes = (evt.endHour - evt.startHour) * 60;
    categoryMinutes[evt.category] = (categoryMinutes[evt.category] ?? 0) + minutes;
  }

  // 每日科研分钟
  const eventsByDate: Record<string, ScheduleEvent[]> = {};
  for (const evt of periodEvents) {
    (eventsByDate[evt.date] ??= []).push(evt);
  }

  const dailyResearchMinutes: { date: string; minutes: number }[] = [];
  for (const [date, dayEvts] of Object.entries(eventsByDate)) {
    const researchMin = dayEvts
      .filter((e) => RESEARCH_CATEGORIES.has(e.category))
      .reduce((sum, e) => sum + (e.endHour - e.startHour) * 60, 0);
    if (researchMin > 0) dailyResearchMinutes.push({ date, minutes: Math.round(researchMin) });
  }
  dailyResearchMinutes.sort((a, b) => a.date.localeCompare(b.date));

  // 任务统计
  const allTasks = periodTasks;
  const completedTasks = allTasks.filter((t) => t.done);
  const incompleteTasks = allTasks.filter((t) => !t.done);

  // 优先级统计
  const priorityIncomplete: Record<string, number> = {};
  for (const t of incompleteTasks) {
    priorityIncomplete[t.priority] = (priorityIncomplete[t.priority] ?? 0) + 1;
  }

  // 分类事件数
  const categoryEventCounts: Record<string, number> = {};
  for (const evt of periodEvents) {
    categoryEventCounts[evt.category] = (categoryEventCounts[evt.category] ?? 0) + 1;
  }

  return {
    periodDays: days,
    periodLabel: `过去${days}天`,
    categoryMinutes,
    dailyResearchMinutes,
    taskStats: {
      total: allTasks.length,
      completed: completedTasks.length,
      incomplete: incompleteTasks.length,
    },
    priorityIncomplete,
    dailyTaskCompletions: [],
    moodEntries: extractMoodEntries(periodEvents),
    achievementCount: periodAchievements.length,
    categoryEventCounts,
    attentionFragmentation: calcFragmentation(eventsByDate),
  };
}

/** 构建分析 prompt */
export function buildAnalysisPrompt(stats: AnalysisStats): string {
  const categoryLines = Object.entries(stats.categoryMinutes)
    .sort(([, a], [, b]) => b - a)
    .map(([cat, min]) => `${cat}: ${Math.round(min / 60)}h${min % 60 > 0 ? ` ${Math.round(min % 60)}min` : ""}`)
    .join("\n");

  const researchLines = stats.dailyResearchMinutes
    .map((d) => `${d.date}: ${Math.round(d.minutes / 60)}h${d.minutes % 60 > 0 ? ` ${Math.round(d.minutes % 60)}min` : ""}`)
    .join("\n");

  const moodLines = stats.moodEntries
    .map((m) => `${m.date}: ${m.note}`)
    .join("\n");

  return `以下是我 ${stats.periodLabel} 的科研效率数据，请帮我分析：

## ⏱ 各分类投入时间
${categoryLines || "（无记录）"}

## 📊 每日科研投入
${researchLines || "（无科研类事件记录）"}

## ✅ 任务完成率
总数: ${stats.taskStats.total}
已完成: ${stats.taskStats.completed}
未完成: ${stats.taskStats.incomplete}

## ⚠️ 未完成优先级分布
${Object.entries(stats.priorityIncomplete)
  .map(([p, c]) => `${p}: ${c}项`)
  .join("\n") || "（无）"}

## 🏆 成就: ${stats.achievementCount} 条

## 📝 情绪记录
${moodLines || "（无情绪复盘记录）"}

## 🔄 注意力碎片化
每日平均切换 ${stats.attentionFragmentation.average} 个不同分类
{stats.attentionFragmentation.dailyCategorySwitches.join(", ")}

---

请帮我分析：
1. **投入模式**：哪些方面投入最多？科研占比合理吗？
2. **效率诊断**：任务完成率如何？有哪些任务积压？
3. **情绪关联**：情绪记录和效率之间有什么关联吗？
4. **注意力健康**：碎片化程度是否严重？
5. **改进建议**：给 2-3 条具体可执行的建议，帮我优化下 ${stats.periodDays > 14 ? "一个月" : "一周"} 的工作效率。`;
}
```

## 二、新增组件：`src/components/llm/analysis-dialog.tsx`

分析报告的弹窗 UI。

```tsx
"use client";

import { useState } from "react";
import {
  BarChart3,
  Sparkles,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import Markdown from "react-markdown";
import { buildAnalysisStats, buildAnalysisPrompt } from "@/lib/llm/analysis-prompts";
import type { AnalysisPeriod, AnalysisStats } from "@/lib/llm/analysis-prompts";
import type { ScheduleEvent, LongTask, Achievement } from "@/lib/types";

type AnalysisDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  events: ScheduleEvent[];
  tasks: LongTask[];
  achievements: Achievement[];
};

export function AnalysisDialog({
  open,
  onOpenChange,
  events,
  tasks,
  achievements,
}: AnalysisDialogProps) {
  const [period, setPeriod] = useState<AnalysisPeriod>("14d");
  const [report, setReport] = useState("");
  const [stats, setStats] = useState<AnalysisStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [showStats, setShowStats] = useState(false);

  async function handleAnalyze() {
    setLoading(true);
    setReport("");

    // 1. 构建本地统计数据
    const computedStats = buildAnalysisStats(events, tasks, achievements, period);
    setStats(computedStats);

    // 2. 调用 LLM
    try {
      const prompt = buildAnalysisPrompt(computedStats);

      const res = await fetch("/api/llm/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          temperature: 0.4,
          maxTokens: 2048,
          stream: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "分析失败");
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") break;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) setReport((prev) => prev + delta);
          } catch {
            // skip
          }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "分析失败";
      setReport(`⚠️ ${msg}`);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            科研效率分析
          </DialogTitle>
          <DialogDescription>
            基于你的日程和任务数据，分析投入模式、效率问题并给出建议
          </DialogDescription>
        </DialogHeader>

        {/* 配置区 */}
        <div className="flex items-center gap-3">
          <Select
            value={period}
            onValueChange={(v) => {
              setPeriod(v as AnalysisPeriod);
              setReport("");
              setShowStats(false);
            }}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">过去 7 天</SelectItem>
              <SelectItem value="14d">过去 14 天</SelectItem>
              <SelectItem value="30d">过去 30 天</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            onClick={handleAnalyze}
            disabled={loading}
            size="sm"
          >
            {loading ? (
              <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> 分析中…</>
            ) : (
              <><Sparkles className="mr-1 h-4 w-4" /> 开始分析</>
            )}
          </Button>
        </div>

        {/* 原始统计切换 */}
        {stats && !loading && (
          <button
            type="button"
            className="text-xs text-stone-400 hover:text-stone-600 self-start"
            onClick={() => setShowStats(!showStats)}
          >
            {showStats ? "收起原始数据" : "查看原始统计"}
          </button>
        )}

        {/* 原始统计 */}
        {showStats && stats && (
          <div className="max-h-40 overflow-y-auto rounded-xl bg-stone-50 p-3 text-xs text-stone-500 font-mono">
            <pre>{JSON.stringify(stats, null, 2)}</pre>
          </div>
        )}

        {/* 空状态 */}
        {!loading && !report && (
          <div className="flex flex-col items-center gap-3 py-12 text-stone-400">
            <BarChart3 className="h-10 w-10" />
            <p className="text-sm">选择分析周期后点击「开始分析」</p>
          </div>
        )}

        {/* 加载中 */}
        {loading && !report && (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
            <p className="text-sm text-stone-500">正在计算统计数据 + 生成分析报告…</p>
          </div>
        )}

        {/* 报告区域 */}
        {report && (
          <div className="flex-1 overflow-y-auto min-h-0 rounded-xl bg-stone-50 p-5 prose prose-sm prose-stone max-w-none">
            <Markdown>{report}</Markdown>
          </div>
        )}

        <DialogFooter className="border-t border-stone-100 pt-4">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

## 三、在 `page.tsx` 或 `MonitoringSidebar` 中添加入口

推荐放在**监测侧边栏**附近（比如在导航栏后端增加一个"分析"按钮）：

```tsx
// 在 page.tsx（或 layout.tsx）中添加
import { AnalysisDialog } from "@/components/llm/analysis-dialog";

// 新增状态
const [analysisOpen, setAnalysisOpen] = useState(false);

// 在侧边栏导航按钮附近添加
<button
  type="button"
  onClick={() => setAnalysisOpen(true)}
  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/60 bg-white/45 px-3 text-xs font-medium text-stone-600 hover:border-stone-200 hover:bg-white/80 transition-colors"
>
  <BarChart3 className="h-4 w-4" />
  分析报告
</button>

// 在页面底部添加
<AnalysisDialog
  open={analysisOpen}
  onOpenChange={setAnalysisOpen}
  events={events}
  tasks={tasks}
  achievements={achievements}
/>
```

**注意：** `analysisOpen` 状态需要在 `page.tsx` 的组件内定义，并且需要将 `events`/`tasks`/`achievements` 传入。

## 验收标准

- [ ] `npm run build` 通过
- [ ] 点击"分析报告"按钮弹出弹窗
- [ ] 可以选择 7/14/30 天三种周期
- [ ] 点击"开始分析"后流式输出分析报告
- [ ] 报告包含投入模式、效率诊断、情绪关联、改进建议
- [ ] 可以展开查看原始统计数据
