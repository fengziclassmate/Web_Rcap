# Prompt 07 — 日程自然语言创建

> **依赖：** 必须先完成 Prompt 01（LLM 基础架构）
> **目标：** 在日程页面上方添加一个自然语言输入框，用户可以像「明天下午3-5点写论文第二章 深
> 度科研」这样打字，LLM 解析后一键创建事件。

---

## 一、新增文件：`src/lib/llm/schedule-prompts.ts`

自然语言事件解析的 prompt 和 parse 函数。

```typescript
import type { ScheduleEvent } from "@/lib/types";
import { format } from "date-fns";

export type ParsedEventInput = {
  title: string;
  date: string; // yyyy-MM-dd
  startHour: number;
  endHour: number;
  category: string;
  notes?: string;
  tag?: "待定" | "不着急" | "不可后退" | null;
};

/** 构建解析 prompt */
export function buildParseEventPrompt(input: string, today: string): string {
  return `请解析以下"日程创建指令"，返回 JSON 格式的事件。

今天是 ${today}。
时间均按 24 小时制（0-23）。

指令：${input}

要求：
1. 返回纯 JSON，不要任何解释
2. 格式：{"title": "事件标题", "date": "yyyy-MM-dd", "startHour": 数字, "endHour": 数字, "category": "分类", "notes": "备注（可选）"}
3. date 基于今天推算，如"明天"→ ${today} +1天，"后天"→ +2天
4. startHour/endHour 是整数（0-23）
5. category 从以下选一个最匹配的：深度科研、实验数据、论文写作、文献阅读、课程学习、会议沟通、任务推进、行政事务、生活事务、健康运动、通勤外出、情绪复盘、休息恢复、弹性缓冲
6. 如果指令中没有指定分类，根据内容推断最合适的分类
7. 如果指定了时间范围 use X点到Y点，否则默认1小时

示例：
输入：明天下午3点到5点写论文第二章 深度科研
输出：{"title": "写论文第二章", "date": "2026-05-16", "startHour": 15, "endHour": 17, "category": "深度科研", "notes": ""}`;
}

/** 尝试从 LLM 回复解析事件 JSON */
export function parseEventFromLLM(response: string): ParsedEventInput | null {
  try {
    // 直接解析
    const parsed = JSON.parse(response.trim());
    if (
      typeof parsed.title === "string" &&
      typeof parsed.date === "string" &&
      typeof parsed.startHour === "number" &&
      typeof parsed.endHour === "number" &&
      typeof parsed.category === "string"
    ) {
      return {
        title: parsed.title.trim(),
        date: parsed.date.trim(),
        startHour: Math.max(0, Math.min(23, parsed.startHour)),
        endHour: Math.max(1, Math.min(24, parsed.endHour)),
        category: parsed.category.trim(),
        notes: typeof parsed.notes === "string" ? parsed.notes.trim() : "",
        tag: parsed.tag ?? null,
      };
    }
  } catch {
    // 尝试从 code block 提取
    const match = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (match) {
      try {
        const parsed = JSON.parse(match[1].trim());
        if (parsed.title && parsed.date) {
          return {
            title: String(parsed.title).trim(),
            date: String(parsed.date).trim(),
            startHour: Number(parsed.startHour) || 9,
            endHour: Number(parsed.endHour) || 10,
            category: String(parsed.category || "任务推进").trim(),
            notes: String(parsed.notes || "").trim(),
            tag: parsed.tag ?? null,
          };
        }
      } catch {
        // ignore
      }
    }
  }

  return null;
}

/** 将 ParsedEventInput 转换为 ScheduleEvent（需要生成 id） */
export function parsedToScheduleEvent(
  parsed: ParsedEventInput,
  eventId: string,
): ScheduleEvent {
  return {
    id: eventId,
    date: parsed.date,
    startHour: parsed.startHour,
    endHour: parsed.endHour,
    title: parsed.title,
    notes: parsed.notes ?? "",
    requirements: [],
    isCompleted: false,
    category: parsed.category,
    tag: parsed.tag ?? null,
  };
}
```

## 二、新增组件：`src/components/llm/quick-event-input.tsx`

自然语言输入组件。

```tsx
"use client";

import { useState, useRef } from "react";
import { Sparkles, Loader2, Plus, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { buildParseEventPrompt, parseEventFromLLM, parsedToScheduleEvent } from "@/lib/llm/schedule-prompts";
import { createId } from "@/lib/id";
import type { ScheduleEvent } from "@/lib/types";

type QuickEventInputProps = {
  onCreateEvent: (event: ScheduleEvent) => void;
};

export function QuickEventInput({ onCreateEvent }: QuickEventInputProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ScheduleEvent | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleParse() {
    const text = input.trim();
    if (!text) return;

    setLoading(true);
    setPreview(null);

    try {
      const today = new Date().toISOString().slice(0, 10);
      const prompt = buildParseEventPrompt(text, today);

      const res = await fetch("/api/llm/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
          maxTokens: 512,
          stream: false,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "解析失败");
      }

      const data = await res.json();
      const parsed = parseEventFromLLM(data.content);

      if (!parsed) {
        throw new Error("AI 无法理解你的输入，试试更明确的描述，如「明天下午3-5点写论文」");
      }

      const event = parsedToScheduleEvent(parsed, `quick-${Date.now()}`);
      setPreview(event);
      setConfirmOpen(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "解析失败";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleConfirm() {
    if (!preview) return;

    // 生成真实 ID 并创建
    const finalEvent: ScheduleEvent = {
      ...preview,
      id: createId("event"),
    };

    onCreateEvent(finalEvent);
    setInput("");
    setPreview(null);
    setConfirmOpen(false);
    toast.success(`已创建「${finalEvent.title}」`);
  }

  function handleCancel() {
    setPreview(null);
    setConfirmOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleParse();
    }
  }

  return (
    <>
      {/* 输入框 */}
      <div className="relative">
        <div className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-white/80 px-4 py-2 shadow-sm transition-colors focus-within:border-stone-400 focus-within:bg-white">
          <Sparkles className="h-4 w-4 shrink-0 text-stone-400" />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="用文字快速添加事件… 例如「明天下午3-5点写论文第二章 深度科研」"
            className="flex-1 bg-transparent text-sm text-stone-800 outline-none placeholder:text-stone-400"
            disabled={loading}
          />
          <button
            type="button"
            onClick={handleParse}
            disabled={loading || !input.trim()}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-stone-950 text-white hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* 确认弹窗 */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              确认创建事件
            </DialogTitle>
          </DialogHeader>

          {preview && (
            <div className="space-y-3 py-2">
              <div className="rounded-xl bg-stone-50 p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-stone-400">标题</span>
                  <span className="font-medium text-stone-800">{preview.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">日期</span>
                  <span className="text-stone-800">{preview.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">时间</span>
                  <span className="text-stone-800">
                    {preview.startHour}:00 - {preview.endHour}:00
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">分类</span>
                  <span className="text-stone-800">{preview.category}</span>
                </div>
                {preview.notes && (
                  <div className="flex justify-between">
                    <span className="text-stone-400">备注</span>
                    <span className="text-stone-800">{preview.notes}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handleCancel}>
                  <X className="mr-1 h-3.5 w-3.5" />
                  取消
                </Button>
                <Button type="button" size="sm" onClick={handleConfirm}>
                  <Check className="mr-1 h-3.5 w-3.5" />
                  确认创建
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
```

## 三、修改：`src/components/schedule/weekly-time-grid.tsx`

在周视图顶部添加快捷输入组件。

在 WeeklyTimeGrid 组件的 JSX 中，找到日期导航栏（`<div>` 含 `onPrevWeek`/`onNextWeek` 按钮的区域），在其下方添加：

```tsx
import { QuickEventInput } from "@/components/llm/quick-event-input";

// 在导航栏和时间网格之间插入：
<div className="px-4 pb-2">
  <QuickEventInput onCreateEvent={onCreateEvent} />
</div>
```

位置建议：在周视图的日期导航条和时间网格之间，保持视觉连续性。

## 验收标准

- [ ] `npm run build` 通过
- [ ] 日程页面上方出现快速文字输入框
- [ ] 输入「明天下午3-5点写论文」回车后弹出确认弹窗
- [ ] 弹窗显示正确的标题、日期、时间、分类
- [ ] 确认后事件被创建到日程中（时间网格刷新）
- [ ] 输入无法解析的内容时显示友好错误
