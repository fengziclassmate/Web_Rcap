"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { format, isSameDay } from "date-fns";
import { ArrowUpRight, CalendarDays, Check, ChevronDown, ChevronUp, Clock3, GripHorizontal, ListTodo, RotateCcw, X } from "lucide-react";
import { UpNextCard } from "@/components/schedule/up-next-card";
import { dailyCapacity, formatMinutes } from "@/lib/execution-insights";
import { eventTimingsInRange, nextEventTiming } from "@/lib/event-timing";
import { clampFloatingPosition, normalizeFloatingSettings, type FloatingCardSettings } from "@/lib/floating-card";
import type { DashboardUiPreferences, LongTask, ScheduleEvent } from "@/lib/types";

const views = [
  { value: "next", label: "接下来", icon: Clock3 },
  { value: "agenda", label: "今日日程", icon: CalendarDays },
  { value: "tasks", label: "今日待办", icon: ListTodo },
] as const;

function visibleViewport() {
  const viewport = window.visualViewport;
  return {
    width: viewport?.width ?? (document.documentElement.clientWidth || window.innerWidth),
    height: viewport?.height ?? (document.documentElement.clientHeight || window.innerHeight),
    left: viewport?.offsetLeft ?? 0,
    top: viewport?.offsetTop ?? 0,
  };
}

function fitPosition(x: number, y: number, panel: HTMLElement) {
  const viewport = visibleViewport();
  const position = clampFloatingPosition(x - viewport.left, y - viewport.top, panel.offsetWidth, panel.offsetHeight, viewport.width, viewport.height);
  return { x: position.x + viewport.left, y: position.y + viewport.top };
}

export function FloatingScheduleCard({ userId, events, tasks, preferences, onOpenEvent, onOpenTask, onToggleTask }: {
  userId: string;
  events: ScheduleEvent[];
  tasks: LongTask[];
  preferences: DashboardUiPreferences;
  onOpenEvent: (event: ScheduleEvent) => void;
  onOpenTask: (task: LongTask) => void;
  onToggleTask: (id: string) => void;
}) {
  const storageKey = `schedule-floating-card:${userId}`;
  const [settings, setSettings] = useState<FloatingCardSettings | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [dragging, setDragging] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ pointerId: number; clientX: number; clientY: number; x: number; y: number } | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      let saved: unknown;
      try { saved = JSON.parse(localStorage.getItem(storageKey) ?? "null"); } catch {}
      const viewport = visibleViewport();
      setSettings(normalizeFloatingSettings(saved, viewport.width, viewport.height));
    });
    return () => cancelAnimationFrame(frame);
  }, [storageKey]);

  useEffect(() => {
    if (!settings || dragging) return;
    const timer = window.setTimeout(() => {
      try { localStorage.setItem(storageKey, JSON.stringify(settings)); } catch {}
    }, 150);
    return () => window.clearTimeout(timer);
  }, [settings, dragging, storageKey]);

  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = window.setInterval(update, 15000);
    window.addEventListener("focus", update);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", update); };
  }, []);

  const visible = settings !== null && !settings.hidden;
  useEffect(() => {
    if (!visible) return;
    function keepInViewport() {
      const panel = panelRef.current;
      if (!panel) return;
      const viewport = visibleViewport();
      panel.style.maxHeight = `${Math.max(0, viewport.height - 24)}px`;
      panel.style.maxWidth = `${Math.max(0, viewport.width - 24)}px`;
      setSettings((previous) => {
        if (!previous) return previous;
        const position = fitPosition(previous.x, previous.y, panel);
        return position.x === previous.x && position.y === previous.y ? previous : { ...previous, ...position };
      });
    }
    const observer = new ResizeObserver(keepInViewport);
    if (panelRef.current) observer.observe(panelRef.current);
    window.addEventListener("resize", keepInViewport);
    window.visualViewport?.addEventListener("resize", keepInViewport);
    window.visualViewport?.addEventListener("scroll", keepInViewport);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", keepInViewport);
      window.visualViewport?.removeEventListener("resize", keepInViewport);
      window.visualViewport?.removeEventListener("scroll", keepInViewport);
    };
  }, [visible]);

  const today = format(now, "yyyy-MM-dd");
  const next = useMemo(() => nextEventTiming(events, now), [events, now]);
  const agenda = useMemo(() => {
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    return eventTimingsInRange(events, today, today).filter((item) => item.start < end && item.end > start).sort((a, b) => +a.start - +b.start);
  }, [events, today, now]);
  const pending = useMemo(() => tasks.filter((task) => !task.done && !task.abandonedAt && (task.isTodayFocus || (task.taskType === "daily" && task.dueDate <= today)))
    .sort((a, b) => Number(b.isTodayFocus) - Number(a.isTodayFocus) || a.dueDate.localeCompare(b.dueDate) || (a.plannedTime || "99:99").localeCompare(b.plannedTime || "99:99")), [tasks, today]);
  const capacity = useMemo(() => dailyCapacity(events, tasks, now, preferences.capacityStartHour ?? 9, preferences.capacityEndHour ?? 22), [events, tasks, now, preferences.capacityStartHour, preferences.capacityEndHour]);

  function moveTo(x: number, y: number) {
    const panel = panelRef.current;
    if (!panel) return;
    const position = fitPosition(x, y, panel);
    setSettings((previous) => previous ? { ...previous, ...position } : previous);
  }
  function startDrag(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || !event.isPrimary || !settings) return;
    event.preventDefault();
    event.currentTarget.focus();
    dragRef.current = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, x: settings.x, y: settings.y };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }
  function drag(event: PointerEvent<HTMLButtonElement>) {
    const origin = dragRef.current;
    if (!origin || origin.pointerId !== event.pointerId) return;
    moveTo(origin.x + event.clientX - origin.clientX, origin.y + event.clientY - origin.clientY);
  }
  function finishDrag(event: PointerEvent<HTMLButtonElement>, cancelled = false) {
    const origin = dragRef.current;
    if (!origin || origin.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (cancelled) moveTo(origin.x, origin.y);
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function moveWithKeyboard(event: KeyboardEvent<HTMLButtonElement>) {
    if (!settings) return;
    if (event.key === "Escape" && dragRef.current) {
      const origin = dragRef.current;
      dragRef.current = null;
      moveTo(origin.x, origin.y); setDragging(false);
      if (event.currentTarget.hasPointerCapture(origin.pointerId)) event.currentTarget.releasePointerCapture(origin.pointerId);
      return;
    }
    const step = event.shiftKey ? 40 : 10;
    const offsets: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const offset = offsets[event.key];
    if (offset) { event.preventDefault(); moveTo(settings.x + offset[0], settings.y + offset[1]); }
    if (event.key === "Home") { event.preventDefault(); resetPosition(); }
  }
  function resetPosition() {
    const viewport = visibleViewport();
    moveTo(viewport.left + viewport.width - 336, viewport.top + viewport.height - 380);
  }
  function update(patch: Partial<FloatingCardSettings>) {
    setSettings((previous) => previous ? { ...previous, ...patch } : previous);
  }

  if (!settings) return null;
  const current = views.find((view) => view.value === settings.view)!;
  const summary = settings.view === "next" ? next?.event.title ?? "暂无待进行日程" : settings.view === "agenda" ? `今天 ${agenda.length} 项日程` : `${pending.length} 项待办 · 空闲 ${formatMinutes(capacity.free)}`;
  const stamp = (date: Date) => isSameDay(date, now) ? format(date, "HH:mm") : format(date, "M/d HH:mm");

  return createPortal(settings.hidden ? (
    <button type="button" className="floating-restore" aria-label="显示悬浮窗口" onClick={() => update({ hidden: false })}><Clock3 className="size-4" /><span>悬浮窗口</span></button>
  ) : (
    <aside ref={panelRef} className={`floating-schedule-card ${dragging ? "is-dragging" : ""}`} aria-label="日程悬浮窗口" style={{ left: settings.x, top: settings.y }}>
      <header className="floating-card-header">
        <button type="button" className="floating-drag-handle" aria-label="拖动悬浮窗口" title="拖动移动；方向键微调，Home 恢复位置" onPointerDown={startDrag} onPointerMove={drag} onPointerUp={finishDrag} onPointerCancel={(event) => finishDrag(event, true)} onLostPointerCapture={finishDrag} onKeyDown={moveWithKeyboard}>
          <GripHorizontal className="size-4 opacity-60" /><span>{current.label}</span>
        </button>
        <div className="flex gap-0.5">
          <button type="button" className="floating-icon-button" aria-label="重置悬浮窗口位置" title="恢复默认位置" onClick={resetPosition}><RotateCcw className="size-3.5" /></button>
          <button type="button" className="floating-icon-button" aria-label={settings.collapsed ? "展开悬浮窗口" : "收起悬浮窗口"} aria-expanded={!settings.collapsed} onClick={() => update({ collapsed: !settings.collapsed })}>{settings.collapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}</button>
          <button type="button" className="floating-icon-button" aria-label="隐藏悬浮窗口" onClick={() => update({ hidden: true })}><X className="size-4" /></button>
        </div>
      </header>
      {settings.collapsed ? <button type="button" className="floating-collapsed-summary" onClick={() => update({ collapsed: false })}>{summary}</button> : <>
        <div className="floating-view-switch" role="group" aria-label="悬浮窗口展示内容">
          {views.map(({ value, label, icon: Icon }) => <button key={value} type="button" aria-pressed={settings.view === value} onClick={() => update({ view: value })}><Icon className="size-3.5" />{label}</button>)}
        </div>
        <div className="floating-card-body">
          {settings.view === "next" && <UpNextCard next={next} now={now} onOpenEvent={onOpenEvent} />}
          {settings.view === "agenda" && <>
            <p className="floating-section-caption">{format(now, "M月d日")}<span>{agenda.length} 项日程</span></p>
            {agenda.length === 0 ? <div className="floating-empty"><CalendarDays className="size-7" /><p>今天还没有安排</p><span>可以留白，也可以开始新的计划</span></div> : <ul className="floating-agenda">
              {agenda.map((item) => <li key={item.event.id} className={item.event.isCompleted || item.end <= now ? "is-finished" : ""}>
                <button type="button" onClick={() => onOpenEvent(item.event)} className={item.start <= now && item.end > now && !item.event.isCompleted ? "is-current" : ""}>
                  <span className="floating-agenda-time">{stamp(item.start)}<small>{stamp(item.end)}</small></span>
                  <span className="min-w-0 flex-1"><span className="block break-words font-medium">{item.event.title}</span><small className="mt-1 block text-muted-foreground">{item.event.isCompleted ? "已完成" : item.end <= now ? "已结束" : item.start <= now ? "进行中" : item.event.category}</small></span>
                  <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" />
                </button>
              </li>)}
            </ul>}
          </>}
          {settings.view === "tasks" && <>
            <div className="floating-capacity"><span>今日剩余空闲</span><strong>{formatMinutes(capacity.free)}</strong></div>
            <p className="floating-section-caption">今日重点与日常任务<span>{pending.length} 项待办</span></p>
            {pending.length === 0 ? <div className="floating-empty"><Check className="size-7" /><p>今天的待办已清空</p><span>给自己一点休息时间</span></div> : <ul className="floating-tasks">
              {pending.map((task) => <li key={task.id}>
                <input type="checkbox" checked={false} aria-label={`完成待办：${task.name}`} onChange={() => onToggleTask(task.id)} />
                <button type="button" onClick={() => onOpenTask(task)}><span className="block break-words text-sm font-medium">{task.name}</span><span className="mt-1 block text-[11px] text-muted-foreground">{task.isTodayFocus ? "今日重点 · " : ""}{task.taskType === "followup" ? "跟进事项" : task.dueDate < today ? `逾期 · ${task.dueDate}` : task.dueDate === today ? "今天到期" : `${task.dueDate} 到期`}{task.plannedTime ? ` · ${task.plannedTime}` : ""}</span></button>
              </li>)}
            </ul>}
          </>}
        </div>
      </>}
    </aside>
  ), document.body);
}
