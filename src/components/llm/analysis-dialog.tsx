"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { BarChart3 } from "lucide-react";
import type { Achievement } from "@/components/monitoring/achievements-panel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLLMChat } from "@/hooks/useLLMChat";
import { buildEfficiencyAnalysisPrompt, buildEfficiencyStats } from "@/lib/llm/analysis-prompts";
import type { LogPostRecord } from "@/lib/logs";
import type { LongTask, ScheduleEvent } from "@/lib/types";

type EfficiencyAnalysisDialogProps = {
  events: ScheduleEvent[];
  tasks: LongTask[];
  achievements: Achievement[];
  logs: LogPostRecord[];
};

export function EfficiencyAnalysisDialog({ events, tasks, achievements, logs }: EfficiencyAnalysisDialogProps) {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(30);
  const [report, setReport] = useState("");
  const { loading, sendMessage } = useLLMChat();
  const stats = useMemo(
    () => buildEfficiencyStats(days, events, tasks, achievements, logs),
    [achievements, days, events, logs, tasks],
  );

  async function handleAnalyze() {
    const result = await sendMessage(buildEfficiencyAnalysisPrompt(stats), { temperature: 0.35 });
    if (result) setReport(result);
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <BarChart3 className="h-4 w-4" />
        效率分析
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>情绪 / 效率模式分析</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {[7, 14, 30].map((item) => (
                <Button key={item} type="button" size="sm" variant={days === item ? "default" : "outline"} onClick={() => setDays(item)}>
                  {item} 天
                </Button>
              ))}
              <Button type="button" onClick={handleAnalyze} disabled={loading}>
                {loading ? "分析中..." : "开始分析"}
              </Button>
            </div>
            <details className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm">
              <summary className="cursor-pointer font-medium">查看原始统计数据</summary>
              <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(stats, null, 2)}</pre>
            </details>
            {report ? (
              <div className="prose prose-sm max-w-none rounded-xl border border-gray-200 p-4">
                <ReactMarkdown>{report}</ReactMarkdown>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
