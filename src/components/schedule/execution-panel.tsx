"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, format, startOfWeek } from "date-fns";
import { BarChart3, ChevronDown, Pause, Play, Square, Timer } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useFocusTimer } from "@/hooks/useFocusTimer";
import { dailyCapacity, elapsedFocusMs, eventsInDays, formatMinutes, weeklyInsights } from "@/lib/execution-insights";
import type { DashboardUiPreferences, LongTask, ScheduleEvent } from "@/lib/types";

export function ExecutionPanel({ userId, events, tasks, preferences, onPreferencesChange }: {
  userId: string; events: ScheduleEvent[]; tasks: LongTask[];
  preferences: DashboardUiPreferences; onPreferencesChange: (value: DashboardUiPreferences) => void;
}) {
  const timer = useFocusTimer(userId);
  const open = preferences.executionSectionOpen !== false;
  const [now, setNow] = useState(() => new Date());
  const [targetId, setTargetId] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [week, setWeek] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  useEffect(() => {
    const tick = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(tick);
  }, []);
  const today = format(now, "yyyy-MM-dd");
  const startHour = preferences.capacityStartHour ?? 9;
  const endHour = preferences.capacityEndHour ?? 22;
  const minute = Math.floor(now.getTime() / 60000);
  const capacity = useMemo(() => dailyCapacity(events, tasks, new Date(minute * 60000), startHour, endHour), [events, tasks, minute, startHour, endHour]);
  const targets = useMemo(() => [
    ...tasks.filter((task) => !task.done && !task.abandonedAt).map((task) => ({ id: `task:${task.id}`, title: task.name, category: "任务" })),
    ...eventsInDays(events, today, today).filter((event) => !event.isCompleted).map((event) => ({ id: `event:${event.id}`, title: event.title, category: event.category })),
    { id: "free", title: "自由专注", category: "自由专注" },
  ], [tasks, events, today]);
  const selected = targets.find((target) => target.id === targetId) ?? targets[0];
  const elapsed = Math.floor(elapsedFocusMs(timer.state, now.getTime()) / 1000);
  const clock = `${String(Math.floor(elapsed / 3600)).padStart(2, "0")}:${String(Math.floor(elapsed / 60) % 60).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;
  const report = useMemo(() => weeklyInsights(events, tasks, timer.state.sessions, week, new Date(minute * 60000)), [events, tasks, timer.state.sessions, week, minute]);
  const maxMinutes = Math.max(60, ...report.days.flatMap((day) => [day.planned, day.actual]));

  return (
    <section className="execution-panel" aria-label="时间与专注">
      <Collapsible open={open} onOpenChange={(executionSectionOpen) => onPreferencesChange({ ...preferences, executionSectionOpen })}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="min-w-0 flex-1"><CollapsibleTrigger aria-label={open ? "折叠时间与专注" : "展开时间与专注"} className="flex w-full items-center gap-2 rounded text-left text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary"><Timer className="size-4 text-primary" />时间与专注<ChevronDown className={`ml-auto size-4 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} /></CollapsibleTrigger></h3>
        <Button variant="ghost" size="sm" onClick={() => setReviewOpen(true)}><BarChart3 className="size-4" />复盘统计</Button>
      </div>
      <CollapsibleContent>
      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-xs text-muted-foreground">今日剩余空闲</span>
        <strong className="text-xl font-semibold tabular-nums text-primary">{formatMinutes(capacity.free)}</strong>
      </div>
      <div className="my-3 h-1.5 overflow-hidden rounded-full bg-stone-200" aria-hidden>
        <div className={`h-full rounded-full ${capacity.overload ? "bg-amber-600" : "bg-primary"}`} style={{ width: `${capacity.free ? Math.min(100, capacity.demand / capacity.free * 100) : capacity.demand ? 100 : 0}%` }} />
      </div>
      <p className={`text-xs leading-relaxed ${capacity.overload ? "text-amber-800" : "text-muted-foreground"}`}>
        待办仍需安排 {formatMinutes(capacity.demand)}{capacity.overload > 0 ? `，超出 ${formatMinutes(capacity.overload)}` : ""}。
        {capacity.unknown > 0 ? `另有 ${capacity.unknown} 项未估时。` : ""}
      </p>
      <details className="mt-2 text-xs text-muted-foreground">
        <summary className="cursor-pointer py-1">可安排时段</summary>
        <div className="mt-2 flex items-center gap-2">
          <select aria-label="可安排开始时间" value={startHour} onChange={(event) => onPreferencesChange({ ...preferences, capacityStartHour: Number(event.target.value) })} className="rounded border bg-white p-1.5">
            {Array.from({ length: endHour }, (_, hour) => <option key={hour} value={hour}>{String(hour).padStart(2, "0")}:00</option>)}
          </select><span>至</span>
          <select aria-label="可安排结束时间" value={endHour} onChange={(event) => onPreferencesChange({ ...preferences, capacityEndHour: Number(event.target.value) })} className="rounded border bg-white p-1.5">
            {Array.from({ length: 24 - startHour }, (_, i) => startHour + i + 1).map((hour) => <option key={hour} value={hour}>{hour}:00</option>)}
          </select>
        </div>
      </details>
      <div className="mt-4 border-t border-border pt-4">
        {timer.state.active ? <p className="truncate text-sm font-medium" title={timer.state.active.title}>{timer.state.active.title}</p> : (
          <select aria-label="专注任务或日程" value={selected.id} onChange={(event) => setTargetId(event.target.value)} className="w-full rounded-lg border border-border bg-white px-2 py-2 text-sm">
            {targets.map((target) => <option key={target.id} value={target.id}>{target.id.startsWith("event:") ? "日程 · " : target.id.startsWith("task:") ? "任务 · " : ""}{target.title}</option>)}
          </select>
        )}
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="font-mono text-3xl font-medium tracking-tight tabular-nums text-primary" role="timer" aria-label="专注时长">{clock}</span>
          <div className="flex gap-1">
            {!timer.state.active ? <Button size="sm" onClick={() => timer.start(selected)}><Play className="size-4" />开始</Button> : <>
              <Button size="icon-sm" variant="outline" aria-label={timer.state.active.startedAt === null ? "继续专注" : "暂停专注"} onClick={timer.state.active.startedAt === null ? timer.resume : timer.pause}>{timer.state.active.startedAt === null ? <Play /> : <Pause />}</Button>
              <Button size="icon-sm" variant="outline" aria-label="结束并保存专注" onClick={timer.finish}><Square /></Button>
            </>}
          </div>
        </div>
        {timer.state.active && <p className="mt-2 text-xs text-muted-foreground">{timer.state.active.startedAt === null ? "已暂停" : "计时中"}</p>}
      </div>
      </CollapsibleContent>
      </Collapsible>
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader><DialogTitle>每周复盘</DialogTitle></DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" size="sm" onClick={() => setWeek(addDays(week, -7))}>上一周</Button>
            <span className="text-sm tabular-nums">{report.from} — {report.to}</span>
            <Button variant="outline" size="sm" onClick={() => setWeek(addDays(week, 7))}>下一周</Button>
            <Button variant="ghost" size="sm" onClick={() => setWeek(startOfWeek(new Date(), { weekStartsOn: 1 }))}>本周</Button>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[["计划时长", formatMinutes(report.planned)], ["实际专注", formatMinutes(report.actual)], ["完成任务", `${report.completed} 项`], ["本周到期未完成", `${report.overdue} 项`]].map(([label, value]) => <div key={label} className="rounded-xl border border-border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-lg font-semibold text-primary">{value}</p></div>)}
          </div>
          <div className="rounded-xl border border-border p-4">
            <div className="mb-4 flex justify-between text-xs"><span className="font-medium">每日计划与实际</span><span><span className="text-stone-500">■ 计划</span>　<span className="text-primary">■ 实际</span></span></div>
            {report.days.map((day) => <div key={day.date} className="mb-3 grid grid-cols-[48px_1fr_140px] items-center gap-3 text-xs">
              <span className="text-muted-foreground">{day.date.slice(5)}</span>
              <div className="space-y-1" aria-hidden><div className="h-2 rounded-sm bg-stone-300" style={{ width: `${day.planned / maxMinutes * 100}%` }} /><div className="h-2 rounded-sm bg-primary" style={{ width: `${day.actual / maxMinutes * 100}%` }} /></div>
              <span className="text-right tabular-nums">{Math.round(day.planned)} / {Math.round(day.actual)} 分钟</span>
            </div>)}
          </div>
          <table className="w-full text-left text-sm"><caption className="mb-2 text-left font-medium">分类时间分布</caption><thead><tr className="border-b border-border text-muted-foreground"><th className="py-2 font-normal">分类</th><th className="font-normal">计划</th><th className="font-normal">实际专注</th></tr></thead><tbody>{report.categories.map((category) => <tr key={category.name} className="border-b border-border/60"><td className="py-2">{category.name}</td><td>{formatMinutes(category.planned)}</td><td>{formatMinutes(category.actual)}</td></tr>)}</tbody></table>
          {report.categories.length === 0 && <p className="py-4 text-center text-muted-foreground">本周暂无日程或专注记录。</p>}
        </DialogContent>
      </Dialog>
    </section>
  );
}
