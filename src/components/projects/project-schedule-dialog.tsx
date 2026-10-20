"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CalendarDays, ArrowUpRight, Plus } from "lucide-react";
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

export function ProjectScheduleDialog({ title, source, plannedDate, events, onSave, onRemove, onView, onClose }: {
  title: string; source: string; plannedDate: string; events: ScheduleEvent[];
  onSave: (time: ProjectScheduleTime, eventId?: string) => boolean;
  onRemove?: (eventId: string) => void; onView?: (event: ScheduleEvent) => void; onClose: () => void;
}) {
  const [editor, setEditor] = useState<{ eventId?: string } | null>(() => events.length ? null : {});
  const rows = [...events].sort((a, b) => Number(a.isCompleted) - Number(b.isCompleted) || a.date.localeCompare(b.date) || a.startHour - b.startHour);
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="project-schedule-dialog sm:max-w-[480px]">
    <DialogHeader><DialogTitle>日程安排</DialogTitle><DialogDescription>{source}</DialogDescription></DialogHeader>
    <div className="project-schedule-preview"><CalendarDays className="size-4 shrink-0" /><div><p title={title}>{title}</p></div></div>
    {editor ? <ProjectScheduleForm key={editor.eventId ?? "new"} title={title} plannedDate={plannedDate} event={events.find((event) => event.id === editor.eventId)}
      onSave={(time) => { if (onSave(time, editor.eventId)) setEditor(null); }}
      onRemove={editor.eventId && onRemove ? () => { onRemove(editor.eventId!); setEditor(null); } : undefined}
      onView={onView} onBack={events.length ? () => setEditor(null) : undefined} /> : <>
      <div className="project-schedule-list-heading"><span>{events.length} 个时段</span><span>已完成 {events.filter((event) => event.isCompleted).length}/{events.length}</span></div>
      <div className="project-schedule-list" role="list" aria-label="关联时段">
        {rows.map((event) => <div role="listitem" className={`project-schedule-list-row ${event.isCompleted ? "is-completed" : ""}`} key={event.id}>
          <button type="button" className="project-schedule-list-edit" aria-label={`修改时段：${event.date} ${projectScheduleLabel(event)}`} onClick={() => setEditor({ eventId: event.id })}><span>{event.date}</span><strong>{projectScheduleLabel(event)}</strong>{event.title !== title && <span className="project-schedule-custom-title">{event.title}</span>}</button>
          <span className="project-schedule-session-status">{event.isCompleted ? "已完成" : "待完成"}</span>
          {onView && <Button type="button" size="icon-sm" variant="ghost" aria-label={`查看时段：${event.date} ${projectScheduleLabel(event)}`} title="周视图" onClick={() => onView(event)}><ArrowUpRight className="size-3.5" /></Button>}
        </div>)}
      </div>
      <div className="flex justify-end"><Button type="button" onClick={() => setEditor({})}><Plus className="size-3.5" />新增时段</Button></div>
    </>}
  </DialogContent></Dialog>;
}

function ProjectScheduleForm({ title, plannedDate, event, onSave, onRemove, onView, onBack }: {
  title: string; plannedDate: string; event?: ScheduleEvent; onSave: (time: ProjectScheduleTime) => void;
  onRemove?: () => void; onView?: (event: ScheduleEvent) => void; onBack?: () => void;
}) {
  const [baseline] = useState(() => fingerprint(event));
  const [wasEditing] = useState(Boolean(event));
  const [date, setDate] = useState(event?.date || plannedDate || todayISO());
  const [endDate, setEndDate] = useState(() => event ? format(eventTiming(event).end, "yyyy-MM-dd") : plannedDate || todayISO());
  const [start, setStart] = useState(() => timeText(event?.startHour ?? Math.min(22, new Date().getHours() + 1)));
  const [end, setEnd] = useState(() => timeText(event?.endHour ?? Math.min(23, new Date().getHours() + 2)));
  const [removing, setRemoving] = useState(false);
  return <>
    <form onSubmit={(e) => {
      e.preventDefault();
      if (fingerprint(event) !== baseline) { toast.error("该时段已在其他页面修改，请重新打开后安排。"); return; }
      onSave({ date, endDate, startHour: hourValue(start), endHour: hourValue(end) });
    }}>
      <div className="project-schedule-time-fields">
        <fieldset><legend>开始</legend><Input aria-label="安排开始日期" required type="date" value={date} onChange={(e) => { const next = e.target.value; if (endDate === date || endDate < next) setEndDate(next); setDate(next); }} /><Input aria-label="安排开始时间" required type="time" value={start} onChange={(e) => setStart(e.target.value)} /></fieldset>
        <fieldset><legend>结束</legend><Input aria-label="安排结束日期" required type="date" min={date} value={endDate} onChange={(e) => setEndDate(e.target.value)} /><Input aria-label="安排结束时间" required type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></fieldset>
      </div>
      <div className="project-schedule-dialog-actions">{event && onRemove && <Button type="button" variant="ghost" className="text-red-800" onClick={() => setRemoving(true)}>取消此时段</Button>}<div className="ml-auto flex flex-wrap gap-2">{onBack && <Button type="button" variant="ghost" onClick={onBack}>返回</Button>}{event && onView && <Button type="button" variant="outline" onClick={() => onView(event)}>周视图<ArrowUpRight className="size-3.5" /></Button>}<Button type="submit">{wasEditing ? "保存安排" : "添加时段"}</Button></div></div>
    </form>
    <ConfirmDialog open={removing} onOpenChange={setRemoving} title="取消这个时段？" description={title} confirmLabel="取消时段" onConfirm={() => { onRemove?.(); }} />
  </>;
}
