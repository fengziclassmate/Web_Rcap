"use client";

import { useMemo, useState } from "react";
import { CalendarCheck2, CalendarPlus, CalendarRange, ListTodo } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useLLMChat } from "@/hooks/useLLMChat";
import { buildScheduleParsePrompt, parseScheduleEventResponse } from "@/lib/llm/schedule-prompts";
import { createId } from "@/lib/id";
import type { ScheduleEvent } from "@/lib/types";

type QuickCreateType = "event" | "task" | "annual";

type QuickEventInputProps = {
  onCreateEvent: (event: ScheduleEvent) => void;
  onAddTask: (name: string, dueDate: string) => void;
  onAddAnnualTask: (name: string) => void;
};

const createTypes: Array<{ value: QuickCreateType; label: string; description: string }> = [
  { value: "event", label: "日程", description: "带日期和时间" },
  { value: "task", label: "长期任务", description: "带截止日期" },
  { value: "annual", label: "年度计划", description: "年度目标清单" },
];

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function parseTaskInput(raw: string, explicitDueDate: string) {
  let title = raw.trim();
  if (explicitDueDate) return { title: cleanupTitle(title), dueDate: explicitDueDate };

  const today = new Date();
  let dueDate = toIsoDate(today);

  const isoMatch = title.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (isoMatch) {
    dueDate = `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;
    title = title.replace(isoMatch[0], "");
  } else {
    const shortDateMatch = title.match(/\b(\d{1,2})[/-](\d{1,2})\b/);
    if (shortDateMatch) {
      dueDate = `${today.getFullYear()}-${shortDateMatch[1].padStart(2, "0")}-${shortDateMatch[2].padStart(2, "0")}`;
      title = title.replace(shortDateMatch[0], "");
    } else if (title.includes("后天")) {
      dueDate = toIsoDate(addDays(today, 2));
      title = title.replace("后天", "");
    } else if (title.includes("明天")) {
      dueDate = toIsoDate(addDays(today, 1));
      title = title.replace("明天", "");
    } else if (title.includes("今天")) {
      dueDate = toIsoDate(today);
      title = title.replace("今天", "");
    }
  }

  return { title: cleanupTitle(title), dueDate };
}

function cleanupTitle(value: string) {
  return value
    .replace(/^(长期任务|任务|年度计划|年度任务|年计划|日程)[:：]/, "")
    .replace(/(截止|到期|之前|前完成|完成)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function QuickEventInput({ onCreateEvent, onAddTask, onAddAnnualTask }: QuickEventInputProps) {
  const [createType, setCreateType] = useState<QuickCreateType>("event");
  const [input, setInput] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [parsed, setParsed] = useState<ScheduleEvent | null>(null);
  const { loading, sendMessage } = useLLMChat();

  const placeholder = useMemo(() => {
    if (createType === "task") return "快速创建长期任务：明天完成文献综述";
    if (createType === "annual") return "快速创建年度计划：完成毕业论文初稿";
    return "快速创建日程：明天下午3-5点写论文";
  }, [createType]);

  async function handleCreate() {
    const text = input.trim();
    if (!text) return;

    if (createType === "task") {
      const parsedTask = parseTaskInput(text, taskDueDate);
      if (!parsedTask.title) {
        toast.error("请输入任务名称");
        return;
      }
      onAddTask(parsedTask.title, parsedTask.dueDate);
      setInput("");
      setTaskDueDate("");
      toast.success("已创建长期任务");
      return;
    }

    if (createType === "annual") {
      const title = cleanupTitle(text);
      if (!title) {
        toast.error("请输入年度计划名称");
        return;
      }
      onAddAnnualTask(title);
      setInput("");
      toast.success("已创建年度计划任务");
      return;
    }

    const result = await sendMessage(buildScheduleParsePrompt(text), { temperature: 0.1, maxTokens: 1000 });
    try {
      const parsedEvent = parseScheduleEventResponse(result);
      setParsed({
        ...parsedEvent,
        id: createId("event"),
        isCompleted: false,
        requirements: [],
        tag: null,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "无法解析日程");
    }
  }

  function handleConfirmEvent() {
    if (!parsed) return;
    onCreateEvent(parsed);
    setInput("");
    setParsed(null);
    toast.success("已创建日程");
  }

  return (
    <section className="mb-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className="mb-3 flex flex-wrap gap-2">
        {createTypes.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setCreateType(item.value)}
            className={`rounded-xl border px-3 py-2 text-left transition ${
              createType === item.value
                ? "border-black bg-black text-white"
                : "border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300 hover:bg-white"
            }`}
          >
            <span className="block text-sm font-semibold">{item.label}</span>
            <span className={`block text-[11px] ${createType === item.value ? "text-white/70" : "text-gray-500"}`}>
              {item.description}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 lg:flex-row">
        <Input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={placeholder}
          onKeyDown={(event) => {
            if (event.key === "Enter") void handleCreate();
          }}
        />
        {createType === "task" ? (
          <Input
            type="date"
            value={taskDueDate}
            onChange={(event) => setTaskDueDate(event.target.value)}
            className="lg:w-40"
            title="截止日期，可留空"
          />
        ) : null}
        <Button type="button" onClick={handleCreate} disabled={loading || !input.trim()} className="lg:w-auto">
          {createType === "event" ? <CalendarPlus className="h-4 w-4" /> : null}
          {createType === "task" ? <ListTodo className="h-4 w-4" /> : null}
          {createType === "annual" ? <CalendarRange className="h-4 w-4" /> : null}
          {loading && createType === "event"
            ? "解析中"
            : createType === "event"
              ? "解析日程"
              : createType === "task"
                ? "创建任务"
                : "创建年度计划"}
        </Button>
      </div>

      <Dialog open={Boolean(parsed)} onOpenChange={(open) => !open && setParsed(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarCheck2 className="h-4 w-4" />
              确认创建日程
            </DialogTitle>
          </DialogHeader>
          {parsed ? (
            <div className="space-y-3 text-sm">
              <p><span className="text-gray-500">标题：</span>{parsed.title}</p>
              <p><span className="text-gray-500">日期：</span>{parsed.date}</p>
              <p><span className="text-gray-500">时间：</span>{parsed.startHour}:00 - {parsed.endHour}:00</p>
              <p><span className="text-gray-500">分类：</span>{parsed.category}</p>
              {parsed.notes ? <p><span className="text-gray-500">备注：</span>{parsed.notes}</p> : null}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setParsed(null)}>取消</Button>
                <Button type="button" onClick={handleConfirmEvent}>确认创建</Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
