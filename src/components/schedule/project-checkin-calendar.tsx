"use client";

import { useState } from "react";
import { addDays, addMonths, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek, eachDayOfInterval } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ProjectCheckin } from "@/lib/types";

export function ProjectCheckinCalendar({ project, today }: { project: ProjectCheckin; today: string }) {
  const [mode, setMode] = useState<"week" | "month">("week");
  const [anchor, setAnchor] = useState(today);
  const [selected, setSelected] = useState<string | null>(null);
  const date = parseISO(anchor);
  const start = startOfWeek(mode === "month" ? startOfMonth(date) : date, { weekStartsOn: 1 });
  const end = endOfWeek(mode === "month" ? endOfMonth(date) : date, { weekStartsOn: 1 });
  const archivedEntries = (project.archives ?? []).flatMap((archive) => archive.checkins);
  const records = new Map([...archivedEntries, ...project.checkins].map((entry) => [entry.date, entry.note]));
  const trackedStart = (project.archives ?? []).reduce((earliest, archive) => archive.startDate < earliest ? archive.startDate : earliest, project.startDate);
  const selectedNote = selected ? records.get(selected) : undefined;
  function move(direction: number) {
    setAnchor(format(mode === "week" ? addDays(date, direction * 7) : addMonths(date, direction), "yyyy-MM-dd"));
    setSelected(null);
  }
  return (
    <section className="mb-2 rounded-lg border border-stone-200/80 bg-white/70 p-2" aria-label={`${project.name} 打卡日历`}>
      <div className="mb-2 flex items-center gap-1 text-[11px]">
        <div className="flex rounded bg-stone-100 p-0.5" role="group" aria-label="打卡视图">
          {(["week", "month"] as const).map((value) => <button type="button" key={value} aria-pressed={mode === value} onClick={() => { setMode(value); setSelected(null); }} className={`rounded px-2 py-0.5 ${mode === value ? "bg-white font-semibold shadow-sm" : "text-stone-500"}`}>{value === "week" ? "周" : "月"}</button>)}
        </div>
        <span className="min-w-0 flex-1 text-center font-medium tabular-nums">{mode === "month" ? format(date, "yyyy年M月") : `${format(start, "M/d")}–${format(end, "M/d")}`}</span>
        <button type="button" aria-label="上一期打卡记录" onClick={() => move(-1)} className="rounded p-1 hover:bg-stone-100"><ChevronLeft className="h-3 w-3" /></button>
        <button type="button" onClick={() => { setAnchor(today); setSelected(null); }} className="rounded px-1 py-1 hover:bg-stone-100">今天</button>
        <button type="button" aria-label="下一期打卡记录" onClick={() => move(1)} className="rounded p-1 hover:bg-stone-100"><ChevronRight className="h-3 w-3" /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px]">
        {["一", "二", "三", "四", "五", "六", "日"].map((day) => <span key={day} className="text-stone-400">{day}</span>)}
        {eachDayOfInterval({ start, end }).map((day) => {
          const iso = format(day, "yyyy-MM-dd");
          const outside = mode === "month" && day.getMonth() !== date.getMonth();
          const inactive = iso < trackedStart || iso > today;
          const done = records.has(iso);
          const status = done ? "已打卡" : iso > today ? "未来日期" : iso < trackedStart ? "未开始" : "未打卡";
          return <button type="button" key={iso} disabled={outside || inactive && !done} aria-label={`${iso} ${status}`} aria-pressed={selected === iso} title={`${iso} · ${status}`} onClick={() => setSelected(selected === iso ? null : iso)} className={`h-7 rounded border tabular-nums ${outside ? "invisible" : done ? "border-emerald-700 bg-emerald-700 font-semibold text-white" : inactive ? "border-transparent text-stone-300" : "border-stone-200 bg-stone-50 text-stone-600"} ${iso === today ? "ring-1 ring-stone-500 ring-offset-1" : ""} ${selected === iso ? "outline outline-2 outline-sky-500" : ""}`}>{day.getDate()}</button>;
        })}
      </div>
      <div className="mt-2 flex gap-3 text-[10px] text-stone-500"><span>🟩 已打卡</span><span>□ 未打卡</span><span className="text-stone-400">浅灰：未开始 / 未来</span></div>
      {selected ? <div className="mt-2 max-h-32 overflow-y-auto border-t border-stone-100 pt-2 text-xs leading-5"><p className="font-medium">{selected}</p><p className="whitespace-pre-wrap break-words text-stone-600">{selectedNote ?? "这天未打卡"}</p></div> : null}
    </section>
  );
}
