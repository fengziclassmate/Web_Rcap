"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CalendarDays, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { todayISO } from "@/lib/date-utils";
import { eventTiming } from "@/lib/event-timing";
import { projectScheduleLabel, type ProjectScheduleTime } from "@/lib/project-schedule";
import type { ScheduleEvent } from "@/lib/types";

const timeText = (hour: number) => `${String(Math.floor(hour) % 24).padStart(2, "0")}:${String(Math.round(hour * 60) % 60).padStart(2, "0")}`;
const hourValue = (text: string) => { const [hour, minute] = text.split(":").map(Number); return text ? hour + minute / 60 : NaN; };
const fingerprint = (event?: ScheduleEvent) => JSON.stringify(event && [event.id, event.date, event.endDate, event.startHour, event.endHour]);

export function ProjectScheduleDialog({ title, source, plannedDate, event, onSave, onRemove, onView, onClose }: {
  title: string; source: string; plannedDate: string; event?: ScheduleEvent;
  onSave: (time: ProjectScheduleTime) => boolean;
  onRemove?: () => void; onView?: (event: ScheduleEvent) => void; onClose: () => void;
}) {
  const [baseline] = useState(() => fingerprint(event));
  const [date, setDate] = useState(event?.date || plannedDate || todayISO());
  const [endDate, setEndDate] = useState(() => event ? format(eventTiming(event).end, "yyyy-MM-dd") : plannedDate || todayISO());
  const [start, setStart] = useState(() => timeText(event?.startHour ?? Math.min(22, new Date().getHours() + 1)));
  const [end, setEnd] = useState(() => timeText(event?.endHour ?? Math.min(23, new Date().getHours() + 2)));
  const [removing, setRemoving] = useState(false);
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="project-schedule-dialog sm:max-w-[480px]">
    <DialogHeader><DialogTitle>日程安排</DialogTitle><DialogDescription>{source}</DialogDescription></DialogHeader>
    <div className="project-schedule-preview"><CalendarDays className="size-4 shrink-0" /><div><p title={title}>{title}</p>{event && <span>{event.date} · {projectScheduleLabel(event)}</span>}</div></div>
    <form onSubmit={(e) => {
      e.preventDefault();
      if (fingerprint(event) !== baseline) { toast.error("日程已在其他页面修改，请重新打开后安排。"); return; }
      if (onSave({ date, endDate, startHour: hourValue(start), endHour: hourValue(end) })) onClose();
    }}>
      <div className="project-schedule-time-fields">
        <fieldset><legend>开始</legend><Input aria-label="安排开始日期" required type="date" value={date} onChange={(e) => { const next = e.target.value; if (endDate === date || endDate < next) setEndDate(next); setDate(next); }} /><Input aria-label="安排开始时间" required type="time" value={start} onChange={(e) => setStart(e.target.value)} /></fieldset>
        <fieldset><legend>结束</legend><Input aria-label="安排结束日期" required type="date" min={date} value={endDate} onChange={(e) => setEndDate(e.target.value)} /><Input aria-label="安排结束时间" required type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></fieldset>
      </div>
      <div className="project-schedule-dialog-actions">{event && onRemove && <Button type="button" variant="ghost" className="text-red-800" onClick={() => setRemoving(true)}>取消安排</Button>}<div className="ml-auto flex gap-2">{event && onView && <Button type="button" variant="outline" onClick={() => onView(event)}>周视图<ArrowUpRight className="size-3.5" /></Button>}<Button type="submit">{event ? "保存安排" : "安排日程"}</Button></div></div>
    </form>
    <ConfirmDialog open={removing} onOpenChange={setRemoving} title="取消这项日程安排？" description={title} confirmLabel="取消安排" onConfirm={() => { onRemove?.(); onClose(); }} />
  </DialogContent></Dialog>;
}
