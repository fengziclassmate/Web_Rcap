"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Clipboard, FileText } from "lucide-react";
import { toast } from "sonner";
import type { Achievement } from "@/components/monitoring/achievements-panel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useLLMChat } from "@/hooks/useLLMChat";
import { useWeekReportData } from "@/hooks/useWeekReportData";
import { buildWeeklyReportPrompt } from "@/lib/report/weekly-report";
import type { LongTask, ScheduleEvent } from "@/lib/types";

type WeeklyReportDialogProps = {
  currentWeekStart: Date;
  events: ScheduleEvent[];
  tasks: LongTask[];
  achievements: Achievement[];
};

export function WeeklyReportDialog({ currentWeekStart, events, tasks, achievements }: WeeklyReportDialogProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const reportData = useWeekReportData(currentWeekStart, events, tasks, achievements);
  const { loading, sendMessage } = useLLMChat();

  async function handleGenerate() {
    const result = await sendMessage(buildWeeklyReportPrompt(reportData), { temperature: 0.4 });
    if (result) setDraft(result);
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(draft);
    toast.success("周报已复制");
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <FileText className="h-4 w-4" />
        生成周报
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>周报自动生成</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <aside className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm">
              <p className="font-medium">数据范围：{reportData.rangeText}</p>
              <p className="mt-2 text-gray-600">行程 {reportData.events.length} 条，完成行程 {reportData.completedEvents.length} 条。</p>
              <p className="text-gray-600">完成任务 {reportData.completedTasks.length} 条，未完成任务 {reportData.pendingTasks.length} 条。</p>
              <p className="text-gray-600">成就 {reportData.achievements.length} 条。</p>
              <Button type="button" className="mt-4 w-full" onClick={handleGenerate} disabled={loading}>
                {loading ? "生成中..." : "生成周报草稿"}
              </Button>
            </aside>
            <div className="space-y-3">
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="点击生成后，这里会出现可编辑的周报草稿"
                className="min-h-[260px]"
              />
              {draft ? (
                <div className="rounded-xl border border-gray-200 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium">预览</p>
                    <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
                      <Clipboard className="h-4 w-4" />
                      复制
                    </Button>
                  </div>
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown>{draft}</ReactMarkdown>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
