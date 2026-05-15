# Prompt 03 — 周报自动生成

> **依赖：** 必须先完成 Prompt 01（LLM 基础架构）
> **目标：** 用户点击"生成周报"按钮，自动收集本周所有日程/task/achievement 数据，发送给 LLM 生
> 成结构化周报草稿，支持编辑后一键发布到"动态日志"或复制。

---

## 一、新增文件：`src/lib/report/weekly-report.ts`

数据收集函数（纯函数，不涉及 UI 也不涉及 LLM）。

```typescript
import { format, startOfWeek, endOfWeek, addDays } from "date-fns";
import type { ScheduleEvent, LongTask, Achievement, ProjectCheckin } from "@/lib/types";
import type { SubmissionRecord } from "@/components/monitoring/submissions-panel";
import type { GroupMeetingRecord } from "@/components/monitoring/group-meetings-panel";

/** 汇总数据输入 */
export type WeeklyReportData = {
  events: ScheduleEvent[];
  tasks: LongTask[];
  achievements: Achievement[];
  projectCheckins: ProjectCheckin[];
  submissions: SubmissionRecord[];
  meetings: GroupMeetingRecord[];
  weekStart: Date;
};

/** 将周报数据格式化为 LLM prompt 可读的纯文本 */
export function formatWeeklyDataForLLM(data: WeeklyReportData): string {
  const { events, tasks, achievements, projectCheckins, submissions, meetings, weekStart } = data;
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const rangeStr = `${format(weekStart, "yyyy-MM-dd")} ~ ${format(weekEnd, "yyyy-MM-dd")}`;

  // 事件按日期分组
  const dailyEvents = new Map<string, ScheduleEvent[]>();
  for (const evt of events) {
    const existing = dailyEvents.get(evt.date) ?? [];
    existing.push(evt);
    dailyEvents.set(evt.date, existing);
  }

  const lines: string[] = [];
  lines.push(`# 周报数据 (${rangeStr})\n`);

  // 日程事件
  lines.push("## 📅 本周事件");
  for (const [date, dayEvts] of [...dailyEvents.entries()].sort()) {
    lines.push(`\n### ${date}`);
    for (const evt of dayEvts) {
      const status = evt.isCompleted ? "[完成]" : "[待办]";
      lines.push(`- ${status} ${evt.startHour}:00-${evt.endHour}:00 ${evt.title} (${evt.category})`);
      if (evt.notes) lines.push(`  - 备注: ${evt.notes}`);
    }
  }

  // 任务
  lines.push("\n## 📋 长期任务");
  const incomplete = tasks.filter((t) => !t.done);
  const completed = tasks.filter((t) => t.done);
  lines.push(`未完成 (${incomplete.length}):`);
  for (const task of incomplete) {
    lines.push(`- [${task.priority}] ${task.name} (截止: ${task.dueDate})`);
  }
  lines.push(`已完成 (${completed.length}):`);
  for (const task of completed) {
    lines.push(`- ✅ ${task.name}`);
  }

  // 成就
  if (achievements.length > 0) {
    lines.push("\n## 🏆 成就记录");
    for (const ach of achievements) {
      lines.push(`- ${ach.date}: ${ach.title}${ach.note ? ` — ${ach.note}` : ""}`);
    }
  }

  // 项目打卡
  if (projectCheckins.length > 0) {
    lines.push("\n## 📌 项目打卡");
    for (const proj of projectCheckins) {
      if (proj.checkins.length > 0) {
        lines.push(`- ${proj.name}:`);
        for (const c of proj.checkins) {
          lines.push(`  - ${c.date}: ${c.note}`);
        }
      }
    }
  }

  // 投稿
  if (submissions.length > 0) {
    lines.push("\n## 📤 投稿记录");
    for (const sub of submissions) {
      lines.push(`- ${sub.journal}: ${sub.status}`);
    }
  }

  // 组会
  if (meetings.length > 0) {
    lines.push("\n## 👥 组会记录");
    for (const mtg of meetings) {
      lines.push(`- ${mtg.date} ${mtg.topic ?? ""}: ${mtg.notes?.slice(0, 100) ?? ""}`);
    }
  }

  return lines.join("\n");
}

/** 生成提交给 LLM 的 messages */
export function buildWeeklyReportPrompt(data: WeeklyReportData) {
  const dataText = formatWeeklyDataForLLM(data);
  return {
    role: "user" as const,
    content: `以下是我本周的日程数据，请帮我生成一份科研周报草稿。要求：

1. 结构清晰：本周概述 → 核心科研进展 → 其它事务 → 下周计划
2. 按类别归类（科研/论文/文献/行政/生活等），不要只列流水账
3. 如果数据中有未完成的紧急重要任务，在"下周计划"中突出
4. 语气简洁、客观，适合直接发给导师或发在小组中
5. 最后加一段"自我反思"（20字左右即可）

数据：
${dataText}`,
  };
}
```

## 二、新增 hook：`src/hooks/useWeekReportData.ts`

从当前状态收集本周数据的 hook。

```typescript
"use client";

import { useMemo } from "react";
import { startOfWeek, endOfWeek } from "date-fns";
import type { WeeklyReportData } from "@/lib/report/weekly-report";
import type { ScheduleEvent, LongTask, Achievement, ProjectCheckin } from "@/lib/types";
import type { SubmissionRecord } from "@/components/monitoring/submissions-panel";
import type { GroupMeetingRecord } from "@/components/monitoring/group-meetings-panel";

type UseWeekReportDataInput = {
  events: ScheduleEvent[];
  tasks: LongTask[];
  achievements: Achievement[];
  projectCheckins: ProjectCheckin[];
  submissions: SubmissionRecord[];
  meetings: GroupMeetingRecord[];
  /** 当前周起点（一般是周一） */
  currentWeekStart: Date;
};

export function useWeekReportData(input: UseWeekReportDataInput): WeeklyReportData | null {
  return useMemo(() => {
    const { events, tasks, achievements, projectCheckins, submissions, meetings, currentWeekStart } = input;
    const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });

    const weekStartStr = currentWeekStart.toISOString().slice(0, 10);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);

    return {
      events: events.filter((e) => e.date >= weekStartStr && e.date <= weekEndStr),
      tasks,
      achievements: achievements.filter((a) => a.date >= weekStartStr && a.date <= weekEndStr),
      projectCheckins: projectCheckins.map((p) => ({
        ...p,
        checkins: p.checkins.filter((c) => c.date >= weekStartStr && c.date <= weekEndStr),
      })),
      submissions,
      meetings: meetings.filter((m) => m.date >= weekStartStr && m.date <= weekEndStr),
      weekStart: currentWeekStart,
    };
  }, [input.events, input.tasks, input.achievements, input.projectCheckins, input.submissions, input.meetings, input.currentWeekStart]);
}
```

## 三、新增组件：`src/components/llm/weekly-report-dialog.tsx`

周报生成的弹窗 UI。

```tsx
"use client";

import { useState, useCallback } from "react";
import { FileText, Sparkles, Copy, Check, Loader2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { buildWeeklyReportPrompt } from "@/lib/report/weekly-report";
import type { WeeklyReportData } from "@/lib/report/weekly-report";

type WeeklyReportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weekReportData: WeeklyReportData | null;
};

export function WeeklyReportDialog({
  open,
  onOpenChange,
  weekReportData,
}: WeeklyReportDialogProps) {
  const [report, setReport] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!weekReportData) {
      toast.error("暂无本周数据");
      return;
    }

    setLoading(true);
    setReport("");

    try {
      const prompt = buildWeeklyReportPrompt(weekReportData);

      const res = await fetch("/api/llm/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [prompt],
          temperature: 0.5,
          maxTokens: 2048,
          stream: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "生成失败");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("响应体不可读");

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
            if (delta) {
              setReport((prev) => prev + delta);
            }
          } catch {
            // skip
          }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "生成失败";
      setReport(`⚠️ ${msg}`);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [weekReportData]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      toast.success("已复制到剪贴板");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("复制失败");
    }
  }

  function handleReset() {
    setReport("");
    setCopied(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            周报生成器
          </DialogTitle>
          <DialogDescription>
            基于本周的日程、任务、成就等数据自动生成周报草稿。生成后可以编辑。
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-3 min-h-0">
          {!report && !loading && (
            <div className="flex flex-col items-center justify-center gap-4 py-12 text-center text-stone-500">
              <BookOpen className="h-10 w-10 text-stone-300" />
              <p className="text-sm">点击生成按钮，AI 将基于本周数据生成周报草稿</p>
            </div>
          )}

          {(loading || report) && (
            <Textarea
              value={report}
              onChange={(e) => setReport(e.target.value)}
              className="flex-1 min-h-[400px] resize-y font-mono text-sm leading-relaxed"
              placeholder="生成的周报将显示在这里…"
              disabled={loading}
            />
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-stone-100">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={!report && !loading}
          >
            清空
          </Button>
          <div className="flex items-center gap-2">
            {report && (
              <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
                {copied ? (
                  <><Check className="mr-1 h-4 w-4" /> 已复制</>
                ) : (
                  <><Copy className="mr-1 h-4 w-4" /> 复制</>
                )}
              </Button>
            )}
            <Button
              type="button"
              onClick={handleGenerate}
              disabled={loading || !weekReportData}
            >
              {loading ? (
                <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> 生成中…</>
              ) : (
                <><Sparkles className="mr-1 h-4 w-4" /> 生成周报</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

## 四、在 `page.tsx` 或 `schedule-time-analytics.tsx` 中添加入口

推荐放在**统计面板** `src/components/schedule/schedule-time-analytics.tsx` 的顶部或**个人日程**页面的导航区域。

修改 `schedule-time-analytics.tsx`：

```tsx
// 新增 import
import { WeeklyReportDialog } from "@/components/llm/weekly-report-dialog";
import { useWeekReportData } from "@/hooks/useWeekReportData";
import { FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

// 在组件内部新增状态
const [reportOpen, setReportOpen] = useState(false);

// 用 useWeekReportData 收集数据（注意：props 需要传入 events/tasks 等）
// 如果当前组件没有这些 props，需要从外部传入或从 parent 获取
// 假设这些数据作为 props 传入
const weekReportData = useWeekReportData({
  events,
  tasks,
  achievements,
  projectCheckins,
  submissions,
  meetings,
  currentWeekStart,
});

// 在 UI 适当位置（比如统计面板的 header 区域）添加按钮：
<div className="flex items-center justify-between mb-4">
  <h3 className="text-sm font-semibold text-stone-700">⏱ 时间分析</h3>
  <Button
    type="button"
    variant="outline"
    size="sm"
    onClick={() => setReportOpen(true)}
    className="gap-1.5"
  >
    <Sparkles className="h-3.5 w-3.5" />
    生成周报
  </Button>
</div>

// 在组件 return 内添加：
<WeeklyReportDialog
  open={reportOpen}
  onOpenChange={setReportOpen}
  weekReportData={weekReportData}
/>
```

**注意：** `ScheduleTimeAnalytics` 组件当前的 props 签名是：
```typescript
type ScheduleTimeAnalyticsProps = {
  events: ScheduleEvent[];
  currentWeekStart: Date;
};
```
需要扩展为：
```typescript
type ScheduleTimeAnalyticsProps = {
  events: ScheduleEvent[];
  tasks: LongTask[];
  achievements: Achievement[];
  projectCheckins: ProjectCheckin[];
  submissions: SubmissionRecord[];
  meetings: GroupMeetingRecord[];
  currentWeekStart: Date;
};
```
相应的，在 `page.tsx`（或 `useScheduleData` hook）中调用 `ScheduleTimeAnalytics` 时需要传入这些新 props。需要同步修改调用处。

## 验收标准

- [ ] `npm run build` 通过
- [ ] 统计面板上出现"生成周报"按钮
- [ ] 点击后弹窗，再点击"生成"按钮，流式输出周报草稿
- [ ] 周报内容包含本周事件、未完成任务、已完成任务、成就等
- [ ] 可以手动编辑草稿
- [ ] 复制按钮可将内容复制到剪贴板
