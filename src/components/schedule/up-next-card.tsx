"use client";

import { useEffect, useMemo, useState } from "react";
import { format, isSameDay } from "date-fns";
import { ArrowUpRight, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { nextEventTiming } from "@/lib/event-timing";
import { formatMinutes } from "@/lib/execution-insights";
import type { ScheduleEvent } from "@/lib/types";

export function UpNextCard({ events, onOpenEvent }: { events: ScheduleEvent[]; onOpenEvent: (event: ScheduleEvent) => void }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = window.setInterval(update, 15000);
    window.addEventListener("focus", update);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", update); };
  }, []);
  const next = useMemo(() => nextEventTiming(events, now), [events, now]);
  const stamp = (date: Date) => format(date, isSameDay(date, now) ? "HH:mm" : "M/d HH:mm");
  const until = (date: Date) => formatMinutes(Math.max(0, Math.ceil((+date - +now) / 60000)));
  return <section className="execution-panel" aria-label="接下来">
    <div className="flex items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><Clock3 className="size-4 text-primary" />接下来</h3>
      {next && <span className="rounded-full bg-stone-100 px-2 py-1 text-xs text-primary">{next.phase}</span>}
    </div>
    {next ? <>
      <div className="mt-3 flex items-start justify-between gap-2">
        <p className="min-w-0 break-words text-base font-semibold">{next.event.title}</p>
        <Button size="icon-sm" variant="ghost" aria-label="打开接下来的事件" onClick={() => onOpenEvent(next.event)}><ArrowUpRight /></Button>
      </div>
      <p className="mt-1 text-xs tabular-nums text-muted-foreground">{stamp(next.start)} — {stamp(next.end)}</p>
      <p className="mt-3 text-sm font-medium text-primary">{next.phase === "进行中" ? `还有 ${until(next.end)} 结束` : next.phase === "结束后缓冲" ? `还有 ${until(next.freeAt)} 可安排其他事项` : `${until(next.start)}后开始`}</p>
      {(next.event.bufferBeforeMinutes ?? 0) > 0 && next.start > now && <p className="mt-1 text-xs text-muted-foreground">{stamp(next.prepareAt)} 开始准备{next.prepareAt > now ? ` · 还有 ${until(next.prepareAt)}` : " · 现在该准备了"}</p>}
      {(next.event.bufferAfterMinutes ?? 0) > 0 && <p className="mt-1 text-xs text-muted-foreground">结束后预留 {formatMinutes(next.event.bufferAfterMinutes!)} · {stamp(next.freeAt)} 后空出</p>}
      {next.conflicts > 0 && <p className="mt-2 text-xs text-amber-800">含缓冲时段，与 {next.conflicts} 项安排重叠</p>}
      {next.event.requirements.length > 0 && <ul className="mt-3 space-y-1 border-t border-border pt-3 text-xs text-stone-600">{next.event.requirements.slice(0, 3).map((item, i) => <li key={i} className="break-words">• {item}</li>)}{next.event.requirements.length > 3 && <li>另有 {next.event.requirements.length - 3} 项准备事项</li>}</ul>}
    </> : <p className="mt-3 text-sm text-muted-foreground">未来一年内暂无待进行的事件</p>}
  </section>;
}
