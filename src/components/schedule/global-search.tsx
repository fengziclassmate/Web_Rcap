"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { LogPostRecord } from "@/lib/logs";
import type { AnnualTask, LongTask, ProjectCheckin, ScheduleEvent, ShoppingItem } from "@/lib/types";

export type SearchResult = { collection?: "annual" | "project" | "shopping"; id: string; kind: string; title: string; detail: string; date?: string; task?: LongTask; log?: LogPostRecord; event?: ScheduleEvent };
export function buildSearchIndex(events: ScheduleEvent[], tasks: LongTask[], logs: LogPostRecord[], annualTasks: AnnualTask[], projects: ProjectCheckin[], shopping: ShoppingItem[]): SearchResult[] {
  return [
    ...tasks.map((task) => ({ id: task.id, kind: "任务", title: task.name, date: task.dueDate, detail: [task.done ? "已完成" : "未完成", task.priority, task.notes, ...task.subtasks.map((item) => item.name)].filter(Boolean).join("\n"), task })),
    ...events.map((event) => ({ id: event.id, kind: "日程", title: event.title, date: event.date, detail: [event.category, event.recurrence ? "重复日程" : "单次日程", event.notes, ...event.requirements].filter(Boolean).join("\n"), event })),
    ...logs.map((log) => ({ id: log.id, kind: "日志", title: log.content.slice(0, 60) || "无正文日志", date: log.createdAt.slice(0, 10), detail: [log.content, ...log.tags.map((tag) => tag.name), ...log.links.map((link) => link.title)].join("\n"), log })),
    ...annualTasks.map((task) => ({ id: task.id, kind: "年度目标", collection: "annual" as const, title: task.name, detail: task.done ? "已完成" : "未完成" })),
    ...projects.map((project) => ({ id: project.id, kind: "项目", collection: "project" as const, title: project.name, detail: [project.description, ...project.checkins.map((entry) => `${entry.date} ${entry.note}`)].join("\n") })),
    ...shopping.map((item) => ({ id: item.id, kind: "购物", collection: "shopping" as const, title: item.name, detail: item.done ? "已购" : "待购" })),
  ];
}

export function GlobalSearch({ events, tasks, logs, annualTasks, projects, shopping, logsReady, onLocate }: {
  events: ScheduleEvent[]; tasks: LongTask[]; logs: LogPostRecord[]; annualTasks: AnnualTask[];
  projects: ProjectCheckin[]; shopping: ShoppingItem[]; logsReady: boolean; onLocate: (result: SearchResult) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const deferred = useDeferredValue(query.trim().toLocaleLowerCase());
  const index = useMemo(() => buildSearchIndex(events, tasks, logs, annualTasks, projects, shopping), [events, tasks, logs, annualTasks, projects, shopping]);
  const results = useMemo(() => deferred ? index.filter((item) => deferred.split(/\s+/).every((word) => `${item.title} ${item.detail} ${item.date ?? ""}`.toLocaleLowerCase().includes(word))) : [], [deferred, index]);
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setOpen((value) => !value); }
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);
  return <>
    <Button variant="outline" size="sm" onClick={() => { setOpen(true); setSelected(null); }}><Search className="size-4" />全局搜索 <kbd className="ml-2 text-xs text-muted-foreground">Ctrl K</kbd></Button>
    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) setSelected(null); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>搜索工作台</DialogTitle><DialogDescription>搜索任务、日程、日志、目标、项目和购物清单。点击结果查看详情。</DialogDescription></DialogHeader>
        <Input autoFocus aria-label="搜索工作台内容" placeholder="名称、备注、标签或日期…" value={query} onChange={(event) => { setQuery(event.target.value); setSelected(null); }} />
        {!logsReady && <p className="text-xs text-muted-foreground">日志正在加载，其余内容可先搜索。</p>}
        {selected ? <div className="max-h-[55vh] overflow-y-auto rounded-xl border border-border p-4">
          <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>返回结果</Button>
          <p className="mt-3 text-xs text-muted-foreground">{selected.kind} · {selected.date}</p>
          <h3 className="mt-2 break-words text-lg font-semibold">{selected.title}</h3>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed">{selected.detail}</p>
          {(selected.event || selected.task || selected.log || selected.collection) && <Button className="mt-4" onClick={() => { onLocate(selected); setOpen(false); setSelected(null); }}>打开{selected.kind}</Button>}
        </div> : <div className="max-h-[55vh] overflow-y-auto" aria-live="polite">
          {!deferred ? <p className="py-10 text-center text-muted-foreground">输入关键词，找回需要的记录。</p> : results.length === 0 ? <p className="py-10 text-center text-muted-foreground">没有找到匹配内容，试试更短的关键词。</p> : <>
            <p className="mb-2 text-xs text-muted-foreground">找到 {results.length} 条{results.length > 80 ? "，显示前 80 条，请细化关键词" : ""}</p>
            {results.slice(0, 80).map((result) => <button key={`${result.kind}:${result.id}`} type="button" onClick={() => setSelected(result)} className="search-result">
              <span className="text-xs text-primary">{result.kind}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{result.title}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{result.detail.replaceAll("\n", " · ")}</span></span><span className="text-xs tabular-nums text-muted-foreground">{result.date}</span>
            </button>)}
          </>}
        </div>}
      </DialogContent>
    </Dialog>
  </>;
}
