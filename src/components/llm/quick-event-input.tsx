"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useLLMChat } from "@/hooks/useLLMChat";
import { buildScheduleParsePrompt, parseScheduleEventResponse } from "@/lib/llm/schedule-prompts";
import { createId } from "@/lib/id";
import type { ScheduleEvent } from "@/lib/types";

type QuickEventInputProps = {
  onCreateEvent: (event: ScheduleEvent) => void;
};

export function QuickEventInput({ onCreateEvent }: QuickEventInputProps) {
  const [input, setInput] = useState("");
  const [parsed, setParsed] = useState<ScheduleEvent | null>(null);
  const { loading, sendMessage } = useLLMChat();

  async function handleParse() {
    if (!input.trim()) return;
    const result = await sendMessage(buildScheduleParsePrompt(input), { temperature: 0.1, maxTokens: 1000 });
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

  function handleConfirm() {
    if (!parsed) return;
    onCreateEvent(parsed);
    setInput("");
    setParsed(null);
    toast.success("已创建日程");
  }

  return (
    <section className="mb-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="快速创建：明天下午3-5点写论文"
          onKeyDown={(event) => {
            if (event.key === "Enter") void handleParse();
          }}
        />
        <Button type="button" onClick={handleParse} disabled={loading || !input.trim()}>
          <CalendarPlus className="h-4 w-4" />
          {loading ? "解析中" : "解析日程"}
        </Button>
      </div>

      <Dialog open={Boolean(parsed)} onOpenChange={(open) => !open && setParsed(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>确认创建日程</DialogTitle>
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
                <Button type="button" onClick={handleConfirm}>确认创建</Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
