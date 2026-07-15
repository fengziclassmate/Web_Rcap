"use client";

import { useState } from "react";
import { CalendarCheck2, CalendarPlus, CheckCircle2, ListTodo, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useLLMChat } from "@/hooks/useLLMChat";
import { createId } from "@/lib/id";
import {
  buildQuickCreatePrompt,
  parseQuickCreateResponse,
  type QuickCreateResult,
} from "@/lib/llm/quick-create-prompts";
import type { ScheduleEvent } from "@/lib/types";

type QuickEventInputProps = {
  onCreateEvent: (event: ScheduleEvent) => void;
  onAddTask: (name: string, dueDate: string) => void;
  onAddAnnualTask: (name: string) => void;
};

function typeLabel(type: QuickCreateResult["type"]) {
  if (type === "event") return "日程";
  if (type === "annual") return "年度计划";
  return "长期任务";
}

function typeIcon(type: QuickCreateResult["type"]) {
  if (type === "event") return <CalendarPlus className="h-4 w-4" />;
  if (type === "annual") return <CheckCircle2 className="h-4 w-4" />;
  return <ListTodo className="h-4 w-4" />;
}

function formatHour(value: number) {
  const hour = Math.floor(value);
  const minute = Math.round((value - hour) * 60);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function QuickEventInput({ onCreateEvent, onAddTask, onAddAnnualTask }: QuickEventInputProps) {
  const [input, setInput] = useState("");
  const [parsed, setParsed] = useState<QuickCreateResult | null>(null);
  const { loading, sendMessage } = useLLMChat();

  async function handleAnalyze() {
    const text = input.trim();
    if (!text) return;

    const result = await sendMessage(buildQuickCreatePrompt(text), { temperature: 0.1, maxTokens: 900 });
    try {
      setParsed(parseQuickCreateResponse(result));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "无法识别要创建的内容");
    }
  }

  function handleConfirm() {
    if (!parsed) return;

    if (parsed.type === "event") {
      onCreateEvent({
        ...parsed,
        id: createId("event"),
        isCompleted: false,
        requirements: [],
        tag: null,
        recurrence: null,
        exceptionDates: [],
        recurrenceOverrides: {},
        recurrenceEndExclusive: null,
      });
      toast.success("已创建日程");
    } else if (parsed.type === "task") {
      onAddTask(parsed.title, parsed.dueDate);
      toast.success("已创建长期任务");
    } else {
      onAddAnnualTask(parsed.title);
      toast.success("已创建年度计划任务");
    }

    setInput("");
    setParsed(null);
  }

  return (
    <>
      <div className="flex min-w-0 items-center gap-2" aria-label="智能快速创建">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stone-950 text-white shadow-sm"
          role="img"
          aria-label="智能快速创建"
        >
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <Input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="输入日程、长期任务或年度计划"
          aria-label="智能快速创建输入"
          className="h-8 min-w-0 flex-1 rounded-lg border-stone-200 bg-white px-3 text-xs shadow-none"
          onKeyDown={(event) => {
            if (event.key === "Enter") void handleAnalyze();
          }}
        />
        <Button
          type="button"
          size="sm"
          onClick={handleAnalyze}
          disabled={loading || !input.trim()}
          className="h-8 shrink-0 rounded-lg px-2.5"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {loading ? "识别中" : "智能识别"}
        </Button>
      </div>

      <Dialog open={Boolean(parsed)} onOpenChange={(open) => !open && setParsed(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarCheck2 className="h-4 w-4" />
              确认创建内容
            </DialogTitle>
          </DialogHeader>
          {parsed ? (
            <div className="space-y-4 text-sm">
              <div className="inline-flex items-center gap-2 rounded-full bg-black px-3 py-1 text-xs font-medium text-white">
                {typeIcon(parsed.type)}
                AI 识别为：{typeLabel(parsed.type)}
              </div>

              <div className="space-y-2 rounded-2xl border border-stone-200 bg-stone-50 p-3">
                <p><span className="text-stone-500">标题：</span>{parsed.title}</p>
                {parsed.type === "event" ? (
                  <>
                    <p><span className="text-stone-500">日期：</span>{parsed.date}</p>
                    <p><span className="text-stone-500">时间：</span>{formatHour(parsed.startHour)} - {formatHour(parsed.endHour)}</p>
                    <p><span className="text-stone-500">分类：</span>{parsed.category}</p>
                  </>
                ) : null}
                {parsed.type === "task" ? (
                  <p><span className="text-stone-500">截止日期：</span>{parsed.dueDate}</p>
                ) : null}
                {parsed.notes ? <p><span className="text-stone-500">备注：</span>{parsed.notes}</p> : null}
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setParsed(null)}>取消</Button>
                <Button type="button" onClick={handleConfirm}>确认创建</Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
