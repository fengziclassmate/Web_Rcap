"use client";

import React, { useEffect, useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Clock3, Plus, Smile, Frown, Meh, Angry, Heart } from "lucide-react";
import type { ScheduleEvent } from "@/app/page";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { createId } from "@/lib/id";

const categories = [
  "个人",
  "工作提升",
  "运动健康",
  "兴趣爱好",
  "放松休闲",
  "life&other",
  "自我提升",
  "计划复盘"
];

const categoryColors = {
  "个人": "bg-blue-100 border-blue-300",
  "工作提升": "bg-green-100 border-green-300",
  "运动健康": "bg-red-100 border-red-300",
  "兴趣爱好": "bg-purple-100 border-purple-300",
  "放松休闲": "bg-yellow-100 border-yellow-300",
  "life&other": "bg-gray-100 border-gray-300",
  "自我提升": "bg-indigo-100 border-indigo-300",
  "计划复盘": "bg-pink-100 border-pink-300"
};

function getCategoryColor(category: string) {
  return categoryColors[category as keyof typeof categoryColors] || "bg-white border-black";
}

type GridCell = {
  date: string;
  startHour: number;
};

type WeeklyTimeGridProps = {
  currentWeekStart: Date;
  weekRange: string;
  events: ScheduleEvent[];
  onCreateEvent: (event: ScheduleEvent) => void;
  onUpdateEvent: (eventId: string, patch: Partial<ScheduleEvent>) => void;
  onDeleteEvent: (eventId: string) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
};

type EventFormState = {
  title: string;
  startHour: number;
  endHour: number;
  notes: string;
  requirements: string;
  isCompleted: boolean;
  category: string;
};

type ResizeState = {
  eventId: string;
  startY: number;
  initialHour: number;
  startHour: number;
  endHour: number;
  direction: "start" | "end";
};

type PositionedEvent = ScheduleEvent & {
  lane: number;
  laneCount: number;
};

type Mood = "开心" | "平静" | "难过" | "生气" | "疲惫";

type DiaryEntry = {
  date: string;
  mood: Mood;
  content: string;
};

const hours = Array.from({ length: 24 }, (_, hour) => hour);
const hourCellHeight = 52;

const moodOptions: { value: Mood; icon: React.ReactNode; label: string }[] = [
  { value: "开心", icon: <Smile className="h-5 w-5 text-yellow-500" />, label: "开心" },
  { value: "平静", icon: <Heart className="h-5 w-5 text-pink-500" />, label: "平静" },
  { value: "难过", icon: <Frown className="h-5 w-5 text-blue-500" />, label: "难过" },
  { value: "生气", icon: <Angry className="h-5 w-5 text-red-500" />, label: "生气" },
  { value: "疲惫", icon: <Meh className="h-5 w-5 text-gray-500" />, label: "疲惫" },
];

const defaultForm: EventFormState = {
  title: "",
  startHour: 8,
  endHour: 9,
  notes: "",
  requirements: "",
  isCompleted: false,
  category: "个人",
};

function formatHour(hour: number) {
  const hours = Math.floor(hour);
  const minutes = Math.round((hour - hours) * 60);
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

function dayTitle(date: Date) {
  const weekday = format(date, "EEEE", { locale: zhCN }).replace("星期", "周");
  return `${weekday} ${format(date, "yyyy/MM/dd")}`;
}

function isOverlap(a: ScheduleEvent, b: ScheduleEvent) {
  return a.startHour < b.endHour && b.startHour < a.endHour;
}

function layoutDayEvents(dayEvents: ScheduleEvent[]): PositionedEvent[] {
  const sorted = [...dayEvents].sort((a, b) =>
    a.startHour === b.startHour ? a.endHour - b.endHour : a.startHour - b.startHour,
  );
  const laneEndHours: number[] = [];

  return sorted.map((event) => {
    let lane = laneEndHours.findIndex((laneEnd) => event.startHour >= laneEnd);
    if (lane === -1) {
      lane = laneEndHours.length;
      laneEndHours.push(event.endHour);
    } else {
      laneEndHours[lane] = event.endHour;
    }

    const overlapCount = sorted.filter((other) => isOverlap(event, other)).length;
    return {
      ...event,
      lane,
      laneCount: Math.max(1, overlapCount),
    };
  });
}

export function WeeklyTimeGrid({
  currentWeekStart,
  weekRange,
  events,
  onCreateEvent,
  onUpdateEvent,
  onDeleteEvent,
  onPrevWeek,
  onNextWeek,
}: WeeklyTimeGridProps) {
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(currentWeekStart, index)),
    [currentWeekStart],
  );
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<GridCell | null>(null);
  const [createForm, setCreateForm] = useState<EventFormState>(defaultForm);
  const [editForm, setEditForm] = useState<EventFormState>(defaultForm);
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [diaries, setDiaries] = useState<DiaryEntry[]>([]);
  const [editingDiaryDate, setEditingDiaryDate] = useState<string | null>(null);
  const [diaryForm, setDiaryForm] = useState<{ mood: Mood; content: string }>({
    mood: "平静",
    content: "",
  });

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === editingEventId) ?? null,
    [events, editingEventId],
  );
  function resetCreateDialog(cell: GridCell) {
    setSelectedCell(cell);
    setCreateForm({
      title: "",
      startHour: cell.startHour,
      endHour: Math.min(24, cell.startHour + 1),
      notes: "",
      requirements: "",
      isCompleted: false,
      category: "个人",
    });
    setCreateDialogOpen(true);
  }

  function handleOpenEdit(event: ScheduleEvent) {
    setEditingEventId(event.id);
    setEditForm({
      title: event.title,
      startHour: event.startHour,
      endHour: event.endHour,
      notes: event.notes,
      requirements: event.requirements.join("\n"),
      isCompleted: event.isCompleted,
      category: event.category,
    });
  }

  function handleCreateEvent() {
    if (!selectedCell || !createForm.title.trim()) return;
    const startHour = Math.max(0, Math.min(23.5, createForm.startHour));
    const endHour = Math.max(startHour + 0.5, Math.min(24, createForm.endHour));

    onCreateEvent({
      id: createId("event"),
      date: selectedCell.date,
      startHour,
      endHour,
      title: createForm.title.trim(),
      notes: createForm.notes.trim(),
      requirements: createForm.requirements
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
      isCompleted: createForm.isCompleted,
      category: createForm.category,
    });
    setCreateDialogOpen(false);
  }

  function handleSaveEdit() {
    if (!selectedEvent || !editForm.title.trim()) return;
    const startHour = Math.max(0, Math.min(23.5, editForm.startHour));
    const endHour = Math.max(startHour + 0.5, Math.min(24, editForm.endHour));
    onUpdateEvent(selectedEvent.id, {
      title: editForm.title.trim(),
      startHour,
      endHour,
      notes: editForm.notes.trim(),
      requirements: editForm.requirements
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
      isCompleted: editForm.isCompleted,
      category: editForm.category,
    });
    setEditingEventId(null);
  }

  function handleDropEvent(targetDate: string, targetHour: number) {
    if (!draggingEventId) return;
    const draggingEvent = events.find((event) => event.id === draggingEventId);
    if (!draggingEvent) return;
    const duration = Math.max(0.0167, draggingEvent.endHour - draggingEvent.startHour);
    const nextStartHour = Math.min(23.9833, targetHour);
    const nextEndHour = Math.min(24, nextStartHour + duration);

    onUpdateEvent(draggingEvent.id, {
      date: targetDate,
      startHour: nextStartHour,
      endHour: nextEndHour,
    });
    setDraggingEventId(null);
  }

  function getDiary(date: string): DiaryEntry | undefined {
    return diaries.find((d) => d.date === date);
  }

  function handleOpenDiary(date: string) {
    const existingDiary = getDiary(date);
    setEditingDiaryDate(date);
    setDiaryForm({
      mood: existingDiary?.mood ?? "平静",
      content: existingDiary?.content ?? "",
    });
  }

  function handleSaveDiary() {
    if (!editingDiaryDate) return;
    setDiaries((prev) => {
      const existingIndex = prev.findIndex((d) => d.date === editingDiaryDate);
      const newEntry: DiaryEntry = {
        date: editingDiaryDate,
        mood: diaryForm.mood,
        content: diaryForm.content,
      };
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = newEntry;
        return updated;
      }
      return [...prev, newEntry];
    });
    setEditingDiaryDate(null);
  }

  useEffect(() => {
    if (!resizeState) return;

    function handleMouseMove(event: MouseEvent) {
      if (!resizeState) return;
      const deltaHour = (event.clientY - resizeState.startY) / hourCellHeight;
      if (resizeState.direction === "end") {
        const nextEndHour = Math.min(
          24,
          Math.max(resizeState.startHour + 0.0167, resizeState.initialHour + deltaHour),
        );
        onUpdateEvent(resizeState.eventId, { endHour: nextEndHour });
      } else {
        const nextStartHour = Math.max(
          0,
          Math.min(resizeState.endHour - 0.0167, resizeState.initialHour + deltaHour),
        );
        onUpdateEvent(resizeState.eventId, { startHour: nextStartHour });
      }
    }

    function handleMouseUp() {
      setResizeState(null);
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [onUpdateEvent, resizeState]);

  return (
    <section className="rounded-sm border border-gray-200 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-black">
            <Clock3 className="h-4 w-4" />
            周视图时间网格
          </h2>
          <p className="mt-1 text-xs text-gray-600">{weekRange}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-sm border-gray-200" onClick={onPrevWeek}>
            <ChevronLeft className="h-4 w-4" />
            上一周
          </Button>
          <Button variant="outline" size="sm" className="rounded-sm border-gray-200" onClick={onNextWeek}>
            下一周
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="overflow-x-auto">
        <div className="relative min-w-[920px]">
          <div className="grid grid-cols-[88px_repeat(7,minmax(0,1fr))] border-b border-gray-200 bg-white">
            <div className="border-r border-gray-200 px-3 py-3 text-xs font-medium text-black">时间</div>
            {weekDays.map((day) => (
              <div
                key={day.toISOString()}
                className="border-r border-gray-200 px-3 py-3 text-center text-xs font-medium text-black last:border-r-0"
              >
                {dayTitle(day)}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-[88px_repeat(7,minmax(0,1fr))]">
            <div>
              {hours.map((hour) => (
                <div
                  key={`hour-label-${hour}`}
                  className="border-r border-b border-gray-200 px-3 py-1 text-xs text-gray-500"
                  style={{ height: `${hourCellHeight}px` }}
                >
                  {formatHour(hour)}
                </div>
              ))}
            </div>

            {weekDays.map((day) => {
              const dayIso = format(day, "yyyy-MM-dd");
              const dayEvents = layoutDayEvents(events.filter((event) => event.date === dayIso));

              return (
                <div key={dayIso} className="relative border-r border-gray-200 last:border-r-0">
                  <div className="grid" style={{ gridTemplateRows: `repeat(24, ${hourCellHeight}px)` }}>
                    {hours.map((hour) => (
                      <button
                        key={`${dayIso}-${hour}`}
                        type="button"
                        className="border-b border-gray-200 hover:bg-gray-50"
                        style={{ height: `${hourCellHeight}px` }}
                        onClick={() => resetCreateDialog({ date: dayIso, startHour: hour })}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => handleDropEvent(dayIso, hour)}
                      />
                    ))}
                  </div>

                  <div className="pointer-events-none absolute inset-0 p-1">
                    {dayEvents.map((event) => (
                      <div
                        key={event.id}
                        className={`pointer-events-auto absolute rounded-sm border px-2 py-1 text-left text-xs ${
                          event.isCompleted
                            ? "border-gray-300 bg-gray-100 text-gray-500"
                            : getCategoryColor(event.category)
                        }`}
                        style={{
                          top: `${event.startHour * hourCellHeight + 4}px`,
                          height: `${(event.endHour - event.startHour) * hourCellHeight - 8}px`,
                          left: `calc(${(event.lane / event.laneCount) * 100}% + 4px)`,
                          width: `calc(${100 / event.laneCount}% - 8px)`,
                        }}
                        draggable
                        onDragStart={() => setDraggingEventId(event.id)}
                        onDragEnd={() => setDraggingEventId(null)}
                      >
                        <button
                          type="button"
                          className={`w-full text-left ${event.isCompleted ? "line-through" : ""}`}
                          onClick={() => handleOpenEdit(event)}
                        >
                          <p className="font-medium">{event.title}</p>
                          <p className="text-[11px] text-gray-500">
                            {formatHour(event.startHour)} - {formatHour(event.endHour)}
                          </p>
                        </button>
                        <button
                          type="button"
                          className="absolute right-1 top-1 rounded-sm border border-gray-300 bg-white p-0.5 text-black hover:bg-gray-50"
                          onClick={(mouseEvent) => {
                            mouseEvent.stopPropagation();
                            resetCreateDialog({ date: event.date, startHour: event.startHour });
                          }}
                          aria-label={`在 ${event.title} 同时段新增行程`}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          className="absolute left-0 top-0 h-2 w-full cursor-ns-resize bg-transparent"
                          onMouseDown={(mouseEvent) => {
                            mouseEvent.preventDefault();
                            setResizeState({
                              eventId: event.id,
                              startY: mouseEvent.clientY,
                              initialHour: event.startHour,
                              startHour: event.startHour,
                              endHour: event.endHour,
                              direction: "start",
                            });
                          }}
                          aria-label={`调整 ${event.title} 开始时间`}
                        />
                        <button
                          type="button"
                          className="absolute bottom-0 left-0 h-2 w-full cursor-ns-resize border-t border-gray-300 bg-gray-100/80"
                          onMouseDown={(mouseEvent) => {
                            mouseEvent.preventDefault();
                            setResizeState({
                              eventId: event.id,
                              startY: mouseEvent.clientY,
                              initialHour: event.endHour,
                              startHour: event.startHour,
                              endHour: event.endHour,
                              direction: "end",
                            });
                          }}
                          aria-label={`调整 ${event.title} 时长`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 日记区域 */}
          <div className="border-t border-gray-200 mt-4">
            <div className="grid grid-cols-[88px_repeat(7,minmax(0,1fr))]">
              <div className="border-r border-gray-200 px-3 py-3 text-xs font-medium text-black bg-gray-50">
                日记
              </div>
              {weekDays.map((day) => {
                const dayIso = format(day, "yyyy-MM-dd");
                const diary = getDiary(dayIso);
                const moodOption = moodOptions.find((m) => m.value === diary?.mood);

                return (
                  <div
                    key={`diary-${dayIso}`}
                    className="border-r border-gray-200 last:border-r-0 p-2 min-h-[120px] cursor-pointer hover:bg-gray-50"
                    onClick={() => handleOpenDiary(dayIso)}
                  >
                    {diary ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          {moodOption?.icon}
                          <span className="text-xs text-gray-600">{moodOption?.label}</span>
                        </div>
                        <p className="text-xs text-gray-800 line-clamp-3">{diary.content}</p>
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center text-gray-400">
                        <span className="text-xs">点击记录日记</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            {selectedCell && (
              <DialogContent className="rounded-sm border-gray-200">
                <DialogHeader>
                  <DialogTitle className="text-sm">
                    新建行程 - {selectedCell.date} {formatHour(selectedCell.startHour)}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="create-title">标题</Label>
                    <Input
                      id="create-title"
                      value={createForm.title}
                      onChange={(event) =>
                        setCreateForm((prev) => ({ ...prev, title: event.target.value }))
                      }
                      placeholder="输入行程标题"
                      className="rounded-sm border-gray-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>分类</Label>
                    <Select
                      value={createForm.category}
                      onValueChange={(value) =>
                        setCreateForm((prev) => ({ ...prev, category: value }))
                      }
                    >
                      <SelectTrigger className="rounded-sm border-gray-200">
                        <SelectValue placeholder="选择分类" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>开始时间</Label>
                      <div className="flex space-x-2">
                        <Select
                          value={String(Math.floor(createForm.startHour))}
                          onValueChange={(value) => {
                            const hours = Number(value);
                            const minutes = createForm.startHour - Math.floor(createForm.startHour);
                            setCreateForm((prev) => ({ ...prev, startHour: hours + minutes }));
                          }}
                        >
                          <SelectTrigger className="rounded-sm border-gray-200">
                            <SelectValue placeholder="时" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 24 }, (_, hour) => (
                              <SelectItem key={hour} value={String(hour)}>
                                {hour.toString().padStart(2, "0")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={String(Math.round((createForm.startHour - Math.floor(createForm.startHour)) * 60))}
                          onValueChange={(value) => {
                            const hours = Math.floor(createForm.startHour);
                            const minutes = Number(value) / 60;
                            setCreateForm((prev) => ({ ...prev, startHour: hours + minutes }));
                          }}
                        >
                          <SelectTrigger className="rounded-sm border-gray-200">
                            <SelectValue placeholder="分" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 60 }, (_, minute) => (
                              <SelectItem key={minute} value={String(minute)}>
                                {minute.toString().padStart(2, "0")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>结束时间</Label>
                      <div className="flex space-x-2">
                        <Select
                          value={String(Math.floor(createForm.endHour))}
                          onValueChange={(value) => {
                            const hours = Number(value);
                            const minutes = createForm.endHour - Math.floor(createForm.endHour);
                            setCreateForm((prev) => ({ ...prev, endHour: hours + minutes }));
                          }}
                        >
                          <SelectTrigger className="rounded-sm border-gray-200">
                            <SelectValue placeholder="时" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 24 }, (_, hour) => (
                              <SelectItem key={hour} value={String(hour)}>
                                {hour.toString().padStart(2, "0")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={String(Math.round((createForm.endHour - Math.floor(createForm.endHour)) * 60))}
                          onValueChange={(value) => {
                            const hours = Math.floor(createForm.endHour);
                            const minutes = Number(value) / 60;
                            setCreateForm((prev) => ({ ...prev, endHour: hours + minutes }));
                          }}
                        >
                          <SelectTrigger className="rounded-sm border-gray-200">
                            <SelectValue placeholder="分" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 60 }, (_, minute) => (
                              <SelectItem key={minute} value={String(minute)}>
                                {minute.toString().padStart(2, "0")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={handleCreateEvent}
                    className="w-full rounded-sm bg-black text-white hover:bg-black/90"
                  >
                    创建行程
                  </Button>
                </div>
              </DialogContent>
            )}
          </Dialog>

          <Dialog open={Boolean(selectedEvent)} onOpenChange={(open) => !open && setEditingEventId(null)}>
            {selectedEvent && (
              <DialogContent className="rounded-sm border-gray-200">
                <DialogHeader>
                  <DialogTitle className="text-sm">编辑行程详情</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="edit-title">标题</Label>
                    <Input
                      id="edit-title"
                      value={editForm.title}
                      onChange={(event) =>
                        setEditForm((prev) => ({ ...prev, title: event.target.value }))
                      }
                      placeholder="输入行程标题"
                      className="rounded-sm border-gray-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>分类</Label>
                    <Select
                      value={editForm.category}
                      onValueChange={(value) =>
                        setEditForm((prev) => ({ ...prev, category: value }))
                      }
                    >
                      <SelectTrigger className="rounded-sm border-gray-200">
                        <SelectValue placeholder="选择分类" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>开始时间</Label>
                      <div className="flex space-x-2">
                        <Select
                          value={String(Math.floor(editForm.startHour))}
                          onValueChange={(value) => {
                            const hours = Number(value);
                            const minutes = editForm.startHour - Math.floor(editForm.startHour);
                            setEditForm((prev) => ({ ...prev, startHour: hours + minutes }));
                          }}
                        >
                          <SelectTrigger className="rounded-sm border-gray-200">
                            <SelectValue placeholder="时" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 24 }, (_, hour) => (
                              <SelectItem key={hour} value={String(hour)}>
                                {hour.toString().padStart(2, "0")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={String(Math.round((editForm.startHour - Math.floor(editForm.startHour)) * 60))}
                          onValueChange={(value) => {
                            const hours = Math.floor(editForm.startHour);
                            const minutes = Number(value) / 60;
                            setEditForm((prev) => ({ ...prev, startHour: hours + minutes }));
                          }}
                        >
                          <SelectTrigger className="rounded-sm border-gray-200">
                            <SelectValue placeholder="分" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 60 }, (_, minute) => (
                              <SelectItem key={minute} value={String(minute)}>
                                {minute.toString().padStart(2, "0")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>结束时间</Label>
                      <div className="flex space-x-2">
                        <Select
                          value={String(Math.floor(editForm.endHour))}
                          onValueChange={(value) => {
                            const hours = Number(value);
                            const minutes = editForm.endHour - Math.floor(editForm.endHour);
                            setEditForm((prev) => ({ ...prev, endHour: hours + minutes }));
                          }}
                        >
                          <SelectTrigger className="rounded-sm border-gray-200">
                            <SelectValue placeholder="时" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 24 }, (_, hour) => (
                              <SelectItem key={hour} value={String(hour)}>
                                {hour.toString().padStart(2, "0")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={String(Math.round((editForm.endHour - Math.floor(editForm.endHour)) * 60))}
                          onValueChange={(value) => {
                            const hours = Math.floor(editForm.endHour);
                            const minutes = Number(value) / 60;
                            setEditForm((prev) => ({ ...prev, endHour: hours + minutes }));
                          }}
                        >
                          <SelectTrigger className="rounded-sm border-gray-200">
                            <SelectValue placeholder="分" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 60 }, (_, minute) => (
                              <SelectItem key={minute} value={String(minute)}>
                                {minute.toString().padStart(2, "0")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-notes">备注</Label>
                    <Textarea
                      id="edit-notes"
                      value={editForm.notes}
                      onChange={(event) =>
                        setEditForm((prev) => ({ ...prev, notes: event.target.value }))
                      }
                      placeholder="输入备注信息"
                      className="rounded-sm border-gray-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-requirements">所需物品/准备事项</Label>
                    <Textarea
                      id="edit-requirements"
                      value={editForm.requirements}
                      onChange={(event) =>
                        setEditForm((prev) => ({ ...prev, requirements: event.target.value }))
                      }
                      placeholder="每行一项，例如：笔记本、笔"
                      className="rounded-sm border-gray-200"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="edit-completed"
                      checked={editForm.isCompleted}
                      onCheckedChange={(checked) =>
                        setEditForm((prev) => ({ ...prev, isCompleted: checked }))
                      }
                    />
                    <Label htmlFor="edit-completed">标记为已完成</Label>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      onClick={() => {
                        onDeleteEvent(selectedEvent.id);
                        setEditingEventId(null);
                      }}
                      className="flex-1 rounded-sm bg-red-600 text-white hover:bg-red-700"
                    >
                      删除行程
                    </Button>
                    <Button
                      onClick={handleSaveEdit}
                      className="flex-1 rounded-sm bg-black text-white hover:bg-black/90"
                    >
                      保存修改
                    </Button>
                  </div>
                </div>
              </DialogContent>
            )}
          </Dialog>

          {/* 日记编辑对话框 */}
          <Dialog open={Boolean(editingDiaryDate)} onOpenChange={(open) => !open && setEditingDiaryDate(null)}>
            {editingDiaryDate && (
              <DialogContent className="rounded-sm border-gray-200">
                <DialogHeader>
                  <DialogTitle className="text-sm">
                    日记 - {editingDiaryDate}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>今天的心情</Label>
                    <div className="flex justify-center gap-3">
                      {moodOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setDiaryForm((prev) => ({ ...prev, mood: option.value }))}
                          className={`p-2 rounded-sm border transition-colors ${
                            diaryForm.mood === option.value
                              ? "border-black bg-gray-100"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                          title={option.label}
                        >
                          {option.icon}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="diary-content">日记内容</Label>
                    <Textarea
                      id="diary-content"
                      value={diaryForm.content}
                      onChange={(event) =>
                        setDiaryForm((prev) => ({ ...prev, content: event.target.value }))
                      }
                      placeholder="记录今天的心情和想法..."
                      className="rounded-sm border-gray-200 min-h-[120px]"
                    />
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      onClick={() => setEditingDiaryDate(null)}
                      variant="outline"
                      className="flex-1 rounded-sm border-gray-300"
                    >
                      取消
                    </Button>
                    <Button
                      onClick={handleSaveDiary}
                      className="flex-1 rounded-sm bg-black text-white hover:bg-black/90"
                    >
                      保存日记
                    </Button>
                  </div>
                </div>
              </DialogContent>
            )}
          </Dialog>
        </div>
      </div>
    </section>
  );
}
