"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, format, startOfWeek } from "date-fns";
import { BarChart3, ChevronDown, ChevronLeft, ChevronRight, Pause, Play, Settings2, Square, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useFocusTimer } from "@/hooks/useFocusTimer";
import { dailyCapacity, elapsedFocusMs, focusDaySummary, focusHistory, focusTargets, formatMinutes, weeklyInsights } from "@/lib/execution-insights";
import type { DashboardUiPreferences, LongTask, ScheduleEvent } from "@/lib/types";
import type { ProjectBoard } from "@/lib/project-boards";

function clockLabel(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  const minutes = String(Math.floor(value / 60) % 60).padStart(2, "0");
  const remainder = String(value % 60).padStart(2, "0");
  return value >= 3600 ? `${String(Math.floor(value / 3600)).padStart(2, "0")}:${minutes}:${remainder}` : `${minutes}:${remainder}`;
}

const emptyBoards: ProjectBoard[] = [];

export function ExecutionPanel({ userId, events, tasks, boards = emptyBoards, preferences, onPreferencesChange }: {
  userId: string;
  events: ScheduleEvent[];
  tasks: LongTask[];
  boards?: ProjectBoard[];
  preferences: DashboardUiPreferences;
  onPreferencesChange: (value: DashboardUiPreferences) => void;
}) {
  const timer = useFocusTimer(userId);
  const active = timer.state.active;
  const running = active?.startedAt != null;
  const open = preferences.executionSectionOpen !== false;
  const [now, setNow] = useState(() => new Date());
  const [targetId, setTargetId] = useState("free");
  const [goalMinutes, setGoalMinutes] = useState(25);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [week, setWeek] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));

  useEffect(() => {
    const tick = window.setInterval(() => setNow(new Date()), running ? 1000 : 60000);
    return () => window.clearInterval(tick);
  }, [running]);

  const today = format(now, "yyyy-MM-dd");
  const minute = Math.floor(now.getTime() / 60000);
  const startHour = preferences.capacityStartHour ?? 9;
  const endHour = preferences.capacityEndHour ?? 22;
  const targets = useMemo(() => focusTargets(events, tasks, boards, today), [events, tasks, boards, today]);
  const selected = targets.find((target) => target.id === targetId) ?? targets.find((target) => target.id === "free")!;
  const groups = [...new Set(targets.map((target) => target.group))];
  const elapsed = Math.floor(elapsedFocusMs(timer.state, now.getTime()) / 1000);
  const goal = active ? active.goalMinutes ?? 0 : goalMinutes;
  const remaining = goal * 60 - elapsed;
  const reachedGoal = Boolean(active && goal && remaining <= 0);
  const clock = goal ? `${remaining < 0 ? "+" : ""}${clockLabel(Math.abs(remaining))}` : clockLabel(elapsed);
  const summary = focusDaySummary(timer.state, now);
  const capacity = useMemo(() => dailyCapacity(events, tasks, new Date(minute * 60000), startHour, endHour), [events, tasks, minute, startHour, endHour]);
  const report = useMemo(() => weeklyInsights(events, tasks, timer.state.sessions, week, new Date(minute * 60000)), [events, tasks, timer.state.sessions, week, minute]);
  const activeRunId = active?.runId;
  const history = useMemo(() => focusHistory(timer.state.sessions).filter((run) => !activeRunId || run.runId !== activeRunId), [timer.state.sessions, activeRunId]);
  const maxMinutes = Math.max(60, ...report.days.flatMap((day) => [day.planned, day.actual]));

  function start() {
    if (timer.start({ id: selected.id, title: selected.title, category: selected.category, ...(goalMinutes ? { goalMinutes } : {}) })) setNow(new Date());
  }
  function pauseOrResume() {
    if (running) timer.pause(); else timer.resume();
    setNow(new Date());
  }
  function finish() { timer.finish(); setNow(new Date()); }

  return <section className="execution-panel dashboard-section-card focus-panel" aria-label="时间与专注">
    <div className="dashboard-section-heading flex items-center gap-2" data-expanded={open}>
      <Timer className="size-4 shrink-0 text-primary" aria-hidden />
      <h3 className="min-w-0 flex-1 text-sm font-semibold text-stone-800">时间与专注</h3>
      {active && <span className={`focus-state-dot ${running ? "is-running" : ""}`} title={running ? "专注中" : "已暂停"} />}
      <Button size="icon-sm" variant="ghost" aria-label={open ? "折叠时间与专注" : "展开时间与专注"} aria-expanded={open} onClick={() => onPreferencesChange({ ...preferences, executionSectionOpen: !open })}><ChevronDown className={`size-3.5 transition-transform ${open ? "" : "-rotate-90"}`} /></Button>
      <Button size="icon-sm" variant="ghost" aria-label="复盘统计" title="专注记录与统计" onClick={() => setReviewOpen(true)}><BarChart3 className="size-3.5" /></Button>
    </div>

    <div hidden={!open}>
      {active ? <div className="focus-current-target"><span className="truncate font-medium" title={active.title}>{active.title}</span><span className="truncate text-xs text-stone-500">{active.category}</span></div> :
        <select aria-label="专注任务或日程" value={selected.id} onChange={(event) => setTargetId(event.target.value)} className="focus-target-select">
          <option value="free">自由专注</option>
          {groups.filter((group) => group !== "自由专注").map((group) => <optgroup key={group} label={group}>{targets.filter((target) => target.group === group).map((target) => <option key={target.id} value={target.id}>{target.title}</option>)}</optgroup>)}
        </select>}

      <div className="focus-presets" role="group" aria-label="专注目标">
        {[[25, "25 分钟"], [50, "50 分钟"], [0, "自由"]].map(([value, label]) => <button key={value} type="button" disabled={Boolean(active)} aria-pressed={goal === value} onClick={() => setGoalMinutes(Number(value))}>{label}</button>)}
      </div>

      <div className="focus-clock-block" data-running={running}>
        <span className="focus-clock" role="timer" aria-label="专注时长">{clock}</span>
        {active && <span className="focus-clock-state">{!running ? "已暂停" : reachedGoal ? "已达目标" : "专注中"}{goal > 0 && <span className="ml-2 text-stone-400">已投入 {clockLabel(elapsed)}</span>}</span>}
        {goal > 0 && <div className="focus-goal-track" aria-hidden><span style={{ width: `${Math.min(100, elapsed / (goal * 60) * 100)}%` }} /></div>}
      </div>

      <div className="focus-controls">
        {!active ? <Button className="h-10 w-full rounded-lg" onClick={start}><Play className="size-4" />开始专注</Button> : <>
          <Button className="h-10 flex-1 rounded-lg" onClick={pauseOrResume}>{running ? <Pause className="size-4" /> : <Play className="size-4" />}{running ? "暂停" : "继续"}</Button>
          <Button className="h-10 rounded-lg px-4" variant="outline" aria-label="结束并保存专注" onClick={finish}><Square className="size-3.5" />结束</Button>
        </>}
      </div>

      <div className="focus-today-summary"><span>今日 <strong>{formatMinutes(summary.minutes)}</strong></span><span>{summary.completed} 次完成</span></div>
      <details className="focus-capacity">
        <summary><Settings2 className="size-3" /><span>时间安排</span><span className="ml-auto tabular-nums">{String(startHour).padStart(2, "0")}:00–{endHour}:00</span></summary>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="space-y-1 text-xs text-stone-500">开始<select aria-label="可安排开始时间" value={startHour} onChange={(event) => onPreferencesChange({ ...preferences, capacityStartHour: Number(event.target.value) })} className="focus-range-select">{Array.from({ length: endHour }, (_, hour) => <option key={hour} value={hour}>{String(hour).padStart(2, "0")}:00</option>)}</select></label>
          <label className="space-y-1 text-xs text-stone-500">结束<select aria-label="可安排结束时间" value={endHour} onChange={(event) => onPreferencesChange({ ...preferences, capacityEndHour: Number(event.target.value) })} className="focus-range-select">{Array.from({ length: 24 - startHour }, (_, index) => startHour + index + 1).map((hour) => <option key={hour} value={hour}>{hour}:00</option>)}</select></label>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-500"><span>可用 {formatMinutes(capacity.free)}</span><span>待安排 {formatMinutes(capacity.demand)}</span>{capacity.overload > 0 && <span className="text-amber-800">超出 {formatMinutes(capacity.overload)}</span>}{capacity.unknown > 0 && <span>{capacity.unknown} 项未估时</span>}</div>
      </details>
    </div>

    <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
      <DialogContent className="focus-report-dialog sm:max-w-3xl">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Timer className="size-4 text-primary" />专注记录<span className="ml-1 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-normal text-stone-500" title="记录按账号保存在当前浏览器">本机</span></DialogTitle><DialogDescription className="sr-only">专注历史及每周计划与实际统计</DialogDescription></DialogHeader>
        <div className="flex items-center gap-2 border-y border-stone-100 py-3">
          <Button size="icon-sm" variant="ghost" aria-label="上一周" onClick={() => setWeek(addDays(week, -7))}><ChevronLeft className="size-4" /></Button>
          <span className="flex-1 text-sm tabular-nums">{format(week, "M月d日")} – {format(addDays(week, 6), "M月d日")}</span>
          <Button size="sm" variant="ghost" onClick={() => setWeek(startOfWeek(new Date(), { weekStartsOn: 1 }))}>本周</Button>
          <Button size="icon-sm" variant="ghost" aria-label="下一周" onClick={() => setWeek(addDays(week, 7))}><ChevronRight className="size-4" /></Button>
        </div>
        <div className="focus-report-metrics">{[["实际专注", formatMinutes(report.actual)], ["计划时长", formatMinutes(report.planned)], ["完成任务", `${report.completed} 项`]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
        <div className="rounded-lg bg-stone-50 p-4">
          <div className="mb-4 flex items-center justify-between text-xs text-stone-500"><span>每日投入</span><span><i className="mr-1 inline-block size-2 rounded-sm bg-stone-300" />计划 <i className="ml-3 mr-1 inline-block size-2 rounded-sm bg-primary" />实际</span></div>
          {report.days.map((day) => <div key={day.date} className="mb-3 grid grid-cols-[42px_1fr_100px] items-center gap-3 text-xs last:mb-0"><span className="tabular-nums text-stone-500">{day.date.slice(5).replace("-", "/")}</span><div className="space-y-1" aria-hidden><div className="h-1.5 rounded-sm bg-stone-300" style={{ width: `${day.planned / maxMinutes * 100}%` }} /><div className="h-1.5 rounded-sm bg-primary" style={{ width: `${day.actual / maxMinutes * 100}%` }} /></div><span className="text-right tabular-nums text-stone-500">{Math.round(day.planned)} / {Math.round(day.actual)} 分</span></div>)}
        </div>
        <section aria-label="最近专注记录" className="space-y-1"><h3 className="mb-2 text-xs font-medium text-stone-500">最近记录</h3>{history.length ? history.slice(0, 8).map((run) => <div key={run.runId ?? run.sessionId} className="flex items-center gap-4 border-b border-stone-100 py-3 last:border-0"><span className="w-20 shrink-0 text-xs tabular-nums text-stone-400">{format(run.startedAt, "MM/dd HH:mm")}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{run.title}</span><span className="mt-1 block truncate text-xs text-stone-400">{run.category}</span></span><span className="shrink-0 text-sm tabular-nums text-primary">{formatMinutes(run.durationMs / 60000)}</span></div>) : <p className="py-5 text-center text-sm text-stone-400">暂无记录</p>}</section>
        {report.categories.length > 0 && <details className="border-t border-stone-100 pt-3 text-xs text-stone-500"><summary className="cursor-pointer">分类统计</summary><table className="mt-3 w-full text-left"><thead><tr className="border-b border-stone-100"><th className="py-2 font-normal">分类</th><th className="font-normal">计划</th><th className="font-normal">实际</th></tr></thead><tbody>{report.categories.map((category) => <tr key={category.name} className="border-b border-stone-100 last:border-0"><td className="py-2">{category.name}</td><td>{formatMinutes(category.planned)}</td><td>{formatMinutes(category.actual)}</td></tr>)}</tbody></table></details>}
      </DialogContent>
    </Dialog>
  </section>;
}
