"use client";

import { format, isSameDay } from "date-fns";
import { ArrowUpRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { nextEventTiming } from "@/lib/event-timing";
import { formatMinutes } from "@/lib/execution-insights";
import type { ScheduleEvent } from "@/lib/types";

export function UpNextCard({ next, now, onOpenEvent }: {
  next: ReturnType<typeof nextEventTiming>;
  now: Date;
  onOpenEvent: (event: ScheduleEvent) => void;
}) {
  if (!next) return <div className="floating-empty"><CalendarDays className="size-7" /><p>接下来没有待进行的日程</p><span>享受这一段自由时间</span></div>;
  const stamp = (date: Date) => format(date, isSameDay(date, now) ? "HH:mm" : "M/d HH:mm");
  const remaining = Math.max(0, Math.ceil((+(next.phase === "进行中" ? next.end : next.start) - +now) / 60000));
  return <div className="floating-next">
    <div className="flex items-center justify-between gap-2">
      <span className="floating-phase">{next.phase}</span>
      <span className="text-xs tabular-nums text-muted-foreground">{stamp(next.start)} — {stamp(next.end)}</span>
    </div>
    <button type="button" className="mt-3 block w-full break-words text-left text-lg font-semibold leading-snug text-primary hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-primary" onClick={() => onOpenEvent(next.event)}>{next.event.title}</button>
    <p className="floating-countdown"><strong>{formatMinutes(remaining)}</strong><span>{next.phase === "进行中" ? "后结束" : "后开始"}</span></p>
    {next.conflicts > 0 && <p className="mt-3 text-xs text-amber-800">与 {next.conflicts} 项日程时间重叠</p>}
    {next.event.requirements.length > 0 && <div className="mt-3 border-t border-border pt-3">
      <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">准备事项</p>
      <ul className="space-y-1.5 text-xs text-stone-600">{next.event.requirements.slice(0, 3).map((item, i) => <li key={i} className="break-words">· {item}</li>)}</ul>
      {next.event.requirements.length > 3 && <p className="mt-1.5 text-xs text-muted-foreground">另有 {next.event.requirements.length - 3} 项</p>}
    </div>}
    <Button className="mt-4 w-full justify-between" variant="outline" size="sm" onClick={() => onOpenEvent(next.event)}>查看日程<ArrowUpRight className="size-3.5" /></Button>
  </div>;
}
