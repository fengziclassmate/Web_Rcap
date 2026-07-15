"use client";

import { useMemo, useState } from "react";
import { Clipboard, FileText, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Achievement } from "@/lib/legacy-research";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLLMChat } from "@/hooks/useLLMChat";
import { useWeekReportData } from "@/hooks/useWeekReportData";
import {
  buildWeeklyReportPrompt,
  type SavedWeeklyReport,
} from "@/lib/report/weekly-report";
import type { LongTask, ScheduleEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "schedule-app-saved-weekly-reports";

type WeeklyReportDialogProps = {
  currentWeekStart: Date;
  events: ScheduleEvent[];
  tasks: LongTask[];
  achievements: Achievement[];
};

function readSavedReports(): SavedWeeklyReport[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSavedReports(reports: SavedWeeklyReport[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

function stripMarkdownArtifacts(value: string) {
  return value
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```[a-z]*|```/gi, ""))
    .replace(/^\s*[-*]\s+/gm, "")
    .trim();
}

export function WeeklyReportDialog({
  currentWeekStart,
  events,
  tasks,
  achievements,
}: WeeklyReportDialogProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [title, setTitle] = useState("");
  const [savedReports, setSavedReports] = useState<SavedWeeklyReport[]>([]);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const reportData = useWeekReportData(currentWeekStart, events, tasks, achievements);
  const { loading, sendMessage } = useLLMChat();

  const activeReport = useMemo(
    () => savedReports.find((report) => report.id === activeReportId) ?? null,
    [activeReportId, savedReports],
  );

  async function handleGenerate() {
    const result = await sendMessage(buildWeeklyReportPrompt(reportData), { temperature: 0.35 });
    if (result) {
      setDraft(stripMarkdownArtifacts(result));
      setActiveReportId(null);
      setTitle(`${reportData.rangeText} 周报`);
    }
  }

  async function handleCopy(content = draft) {
    if (!content.trim()) return;
    await navigator.clipboard.writeText(content);
    toast.success("周报已复制");
  }

  function persistReports(nextReports: SavedWeeklyReport[]) {
    const sorted = [...nextReports].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    setSavedReports(sorted);
    writeSavedReports(sorted);
  }

  function handleSave() {
    const content = stripMarkdownArtifacts(draft);
    if (!content) {
      toast.error("没有可保存的周报内容");
      return;
    }
    const now = new Date().toISOString();
    const nextReport: SavedWeeklyReport = {
      id: activeReportId ?? `weekly-report-${Date.now()}`,
      title: title.trim() || `${reportData.rangeText} 周报`,
      rangeText: reportData.rangeText,
      content,
      createdAt: activeReport?.createdAt ?? now,
      updatedAt: now,
    };
    persistReports([
      nextReport,
      ...savedReports.filter((report) => report.id !== nextReport.id),
    ]);
    setActiveReportId(nextReport.id);
    setDraft(content);
    toast.success("周报已保存");
  }

  function handleLoad(report: SavedWeeklyReport) {
    setActiveReportId(report.id);
    setTitle(report.title);
    setDraft(report.content);
  }

  function handleDelete(reportId: string) {
    persistReports(savedReports.filter((report) => report.id !== reportId));
    if (activeReportId === reportId) {
      setActiveReportId(null);
      setDraft("");
      setTitle(`${reportData.rangeText} 周报`);
    }
    toast.success("已删除周报");
  }

  function handleOpen() {
    setSavedReports(readSavedReports());
    if (!activeReportId) setTitle(`${reportData.rangeText} 周报`);
    setOpen(true);
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={handleOpen}>
        <FileText className="h-4 w-4" />
        生成周报
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[88vh] overflow-hidden sm:max-w-5xl">
          <div className="flex min-h-0 w-full flex-col">
            <DialogHeader className="shrink-0">
              <DialogTitle>周报自动生成与归档</DialogTitle>
            </DialogHeader>

            <div className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-[300px_minmax(0,1fr)]">
              <aside className="min-h-0 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm">
                <p className="font-medium">数据范围：{reportData.rangeText}</p>
                <p className="mt-2 text-gray-600">
                  行程 {reportData.events.length} 条，完成行程 {reportData.completedEvents.length} 条。
                </p>
                <p className="text-gray-600">
                  完成任务 {reportData.completedTasks.length} 条，未完成任务 {reportData.pendingTasks.length} 条。
                </p>
                <p className="text-gray-600">成就 {reportData.achievements.length} 条。</p>
                <Button type="button" className="mt-4 w-full" onClick={handleGenerate} disabled={loading}>
                  {loading ? "生成中..." : "生成周报草稿"}
                </Button>

                <div className="mt-5 border-t border-gray-200 pt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-medium">已保存周报</p>
                    <span className="text-xs text-gray-500">{savedReports.length} 篇</span>
                  </div>
                  <div className="space-y-2">
                    {savedReports.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-gray-200 bg-white p-3 text-xs text-gray-500">
                        暂无保存记录。生成后点击“保存周报”即可保留。
                      </p>
                    ) : null}
                    {savedReports.map((report) => (
                      <div
                        key={report.id}
                        className={cn(
                          "rounded-lg border bg-white p-3",
                          report.id === activeReportId ? "border-black" : "border-gray-200",
                        )}
                      >
                        <button
                          type="button"
                          className="block w-full text-left"
                          onClick={() => handleLoad(report)}
                        >
                          <p className="line-clamp-2 text-sm font-medium text-gray-900">{report.title}</p>
                          <p className="mt-1 text-xs text-gray-500">
                            {report.rangeText} · {new Date(report.updatedAt).toLocaleString()}
                          </p>
                        </button>
                        <div className="mt-2 flex gap-2">
                          <Button type="button" size="xs" variant="outline" onClick={() => void handleCopy(report.content)}>
                            复制
                          </Button>
                          <Button type="button" size="xs" variant="ghost" onClick={() => handleDelete(report.id)}>
                            <Trash2 className="h-3 w-3" />
                            删除
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>

              <section className="flex min-h-0 flex-col gap-3 overflow-hidden">
                <div className="grid shrink-0 gap-2 sm:grid-cols-[1fr_auto_auto]">
                  <Input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="周报标题"
                  />
                  <Button type="button" variant="outline" onClick={handleSave} disabled={!draft.trim()}>
                    <Save className="h-4 w-4" />
                    保存周报
                  </Button>
                  <Button type="button" variant="outline" onClick={() => void handleCopy()} disabled={!draft.trim()}>
                    <Clipboard className="h-4 w-4" />
                    复制
                  </Button>
                </div>

                <Textarea
                  value={draft}
                  onChange={(event) => setDraft(stripMarkdownArtifacts(event.target.value))}
                  placeholder="点击生成后，这里会出现可编辑的周报草稿。内容会以纯文本保存，不显示 Markdown 符号。"
                  className="min-h-[240px] shrink-0"
                />

                <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-gray-200 bg-white p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium">纯文本预览</p>
                    {activeReport ? (
                      <span className="text-xs text-gray-500">正在编辑：{activeReport.title}</span>
                    ) : null}
                  </div>
                  {draft ? (
                    <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-gray-800">
                      {stripMarkdownArtifacts(draft)}
                    </pre>
                  ) : (
                    <p className="text-sm text-gray-500">暂无周报内容。</p>
                  )}
                </div>
              </section>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
