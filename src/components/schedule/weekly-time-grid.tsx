"use client";

import React, { useEffect, useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Clock3, Plus, Smile, Frown, Meh, Angry, Heart, Check, Star, AlertTriangle, AlertCircle, Trash2 } from "lucide-react";
import type { ScheduleEvent, EventTag } from "@/app/page";
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

type Category = {
  id: string;
  name: string;
  color: string;
};

const defaultCategories: Category[] = [
  { id: "1", name: "个人", color: "bg-blue-100 border-blue-300" },
  { id: "2", name: "工作提升", color: "bg-green-100 border-green-300" },
  { id: "3", name: "运动健康", color: "bg-red-100 border-red-300" },
  { id: "4", name: "兴趣爱好", color: "bg-purple-100 border-purple-300" },
  { id: "5", name: "放松休闲", color: "bg-yellow-100 border-yellow-300" },
  { id: "6", name: "life&other", color: "bg-gray-100 border-gray-300" },
  { id: "7", name: "自我提升", color: "bg-indigo-100 border-indigo-300" },
  { id: "8", name: "计划复盘", color: "bg-pink-100 border-pink-300" }
];

function getCategoryColor(categories: Category[], categoryName: string) {
  const category = categories.find(cat => cat.name === categoryName);
  return category?.color || "bg-white border-black";
}

function getTagInfo(tag: EventTag) {
  switch (tag) {
    case "待定":
      return { icon: "?", color: "text-yellow-500" };
    case "不着急":
      return { icon: "⌛", color: "text-blue-500" };
    case "不可后退":
      return { icon: "⚠️", color: "text-red-500" };
    default:
      return { icon: "", color: "" };
  }
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
  tag: EventTag;
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

type Mood = "开心" | "平静" | "难过" | "生气" | "疲惫" | "兴奋" | "焦虑" | "感激" | "无聊" | "惊讶";

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
  { value: "兴奋", icon: <Star className="h-5 w-5 text-yellow-500" />, label: "兴奋" },
  { value: "焦虑", icon: <AlertTriangle className="h-5 w-5 text-orange-500" />, label: "焦虑" },
  { value: "感激", icon: <Heart className="h-5 w-5 text-green-500" />, label: "感激" },
  { value: "无聊", icon: <Meh className="h-5 w-5 text-gray-400" />, label: "无聊" },
  { value: "惊讶", icon: <AlertCircle className="h-5 w-5 text-purple-500" />, label: "惊讶" },
];

// 添加缺失的图标导入

const defaultForm: EventFormState = {
  title: "",
  startHour: 8,
  endHour: 9,
  notes: "",
  requirements: "",
  isCompleted: false,
  category: "个人",
  tag: null,
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
  const [diaries, setDiaries] = useState<DiaryEntry[]>(() => {
    try {
      const saved = localStorage.getItem("schedule-diaries");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [editingDiaryDate, setEditingDiaryDate] = useState<string | null>(null);
  const [diaryForm, setDiaryForm] = useState<{ mood: Mood; content: string }>({
    mood: "平静",
    content: "",
  });
  const [categories, setCategories] = useState<Category[]>(defaultCategories);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategory, setNewCategory] = useState<{ name: string; color: string }>({
    name: "",
    color: "bg-blue-100 border-blue-300",
  });
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    eventId: string;
  } | null>(null);

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
      tag: null,
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
      tag: event.tag,
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
      tag: createForm.tag,
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
      tag: editForm.tag,
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

  function handleAddCategory() {
    if (!newCategory.name.trim()) return;
    const categoryExists = categories.some(cat => cat.name === newCategory.name.trim());
    if (categoryExists) return;
    setCategories((prev) => [...prev, {
      id: createId("category"),
      name: newCategory.name.trim(),
      color: newCategory.color,
    }]);
    setNewCategory({ name: "", color: "bg-blue-100 border-blue-300" });
  }

  function handleDeleteCategory(categoryId: string) {
    setCategories((prev) => prev.filter(cat => cat.id !== categoryId));
  }

  function handleContextMenu(event: React.MouseEvent, eventId: string) {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      eventId,
    });
  }

  function closeContextMenu() {
    setContextMenu(null);
  }

  function handleReschedule(eventId: string) {
    const event = events.find(e => e.id === eventId);
    if (event) {
      handleOpenEdit(event);
    }
    closeContextMenu();
  }

  function handleExtendTime(eventId: string) {
    const event = events.find(e => e.id === eventId);
    if (event) {
      onUpdateEvent(eventId, {
        endHour: event.endHour + 1,
      });
    }
    closeContextMenu();
  }

  function handleSetTag(eventId: string, tag: EventTag) {
    onUpdateEvent(eventId, { tag });
    closeContextMenu();
  }

  function handleToggleComplete(eventId: string) {
    const event = events.find(e => e.id === eventId);
    if (event) {
      onUpdateEvent(eventId, {
        isCompleted: !event.isCompleted,
      });
    }
    closeContextMenu();
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

  useEffect(() => {
    try {
      localStorage.setItem("schedule-diaries", JSON.stringify(diaries));
    } catch {
      // 忽略保存错误
    }
  }, [diaries]);

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
          <Button variant="outline" size="sm" className="rounded-sm border-gray-200" onClick={() => setShowCategoryManager(true)}>
            分类管理
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
                            ? "border-gray-300 bg-gray-100 text-gray-500 opacity-70"
                            : getCategoryColor(categories, event.category)
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
                        onContextMenu={(e) => handleContextMenu(e, event.id)}
                      >
                        <button
                          type="button"
                          className="w-full text-left"
                          onClick={() => handleOpenEdit(event)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{event.title}</p>
                              {event.tag && (
                                <span className={`text-xs font-bold ${getTagInfo(event.tag).color}`}>
                                  {getTagInfo(event.tag).icon}
                                </span>
                              )}
                            </div>
                            {event.isCompleted && (
                              <Check className="h-3 w-3 text-green-500" />
                            )}
                          </div>
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
                        value && setCreateForm((prev) => ({ ...prev, category: value }))
                      }
                    >
                      <SelectTrigger className="rounded-sm border-gray-200">
                        <SelectValue placeholder="选择分类" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.name}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>标记</Label>
                    <Select
                      value={createForm.tag || ""}
                      onValueChange={(value) =>
                        setCreateForm((prev) => ({ ...prev, tag: value as EventTag }))
                      }
                    >
                      <SelectTrigger className="rounded-sm border-gray-200">
                        <SelectValue placeholder="选择标记" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">无标记</SelectItem>
                        <SelectItem value="待定">待定</SelectItem>
                        <SelectItem value="不着急">不着急</SelectItem>
                        <SelectItem value="不可后退">不可后退</SelectItem>
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
                        value && setEditForm((prev) => ({ ...prev, category: value }))
                      }
                    >
                      <SelectTrigger className="rounded-sm border-gray-200">
                        <SelectValue placeholder="选择分类" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.name}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>标记</Label>
                    <Select
                      value={editForm.tag || ""}
                      onValueChange={(value) =>
                        setEditForm((prev) => ({ ...prev, tag: value as EventTag }))
                      }
                    >
                      <SelectTrigger className="rounded-sm border-gray-200">
                        <SelectValue placeholder="选择标记" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">无标记</SelectItem>
                        <SelectItem value="待定">待定</SelectItem>
                        <SelectItem value="不着急">不着急</SelectItem>
                        <SelectItem value="不可后退">不可后退</SelectItem>
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

          {/* 分类管理对话框 */}
          <Dialog open={showCategoryManager} onOpenChange={setShowCategoryManager}>
            <DialogContent className="rounded-sm border-gray-200">
              <DialogHeader>
                <DialogTitle className="text-sm">分类管理</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <h3 className="text-xs font-medium">现有分类</h3>
                  <div className="space-y-1">
                    {categories.map((category) => (
                      <div key={category.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-sm border ${category.color}`} />
                          <span className="text-sm">{category.name}</span>
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 rounded-sm"
                          onClick={() => handleDeleteCategory(category.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xs font-medium">添加新分类</h3>
                  <div className="space-y-1">
                    <Label htmlFor="category-name">分类名称</Label>
                    <Input
                      id="category-name"
                      value={newCategory.name}
                      onChange={(event) => setNewCategory((prev) => ({ ...prev, name: event.target.value }))}
                      placeholder="输入分类名称"
                      className="rounded-sm border-gray-200"
                    />
                    <Label>分类颜色</Label>
                    <div className="grid grid-cols-6 gap-2">
                      {[
                        "bg-blue-100 border-blue-300",
                        "bg-green-100 border-green-300",
                        "bg-red-100 border-red-300",
                        "bg-purple-100 border-purple-300",
                        "bg-yellow-100 border-yellow-300",
                        "bg-gray-100 border-gray-300",
                        "bg-indigo-100 border-indigo-300",
                        "bg-pink-100 border-pink-300",
                        "bg-orange-100 border-orange-300",
                        "bg-teal-100 border-teal-300",
                        "bg-lime-100 border-lime-300",
                        "bg-amber-100 border-amber-300",
                      ].map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setNewCategory((prev) => ({ ...prev, color }))}
                          className={`w-8 h-8 rounded-sm border transition-colors ${
                            newCategory.color === color ? "ring-2 ring-black" : ""
                          } ${color}`}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <Button
                  onClick={handleAddCategory}
                  className="w-full rounded-sm bg-black text-white hover:bg-black/90"
                >
                  添加分类
                </Button>
              </div>
            </DialogContent>
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
                    <div className="flex flex-wrap justify-center gap-3">
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

        {/* 右键菜单 */}
        {contextMenu && (
          <div
            className="fixed z-50 rounded-sm border border-gray-200 bg-white shadow-lg py-1"
            style={{
              left: `${contextMenu.x}px`,
              top: `${contextMenu.y}px`,
            }}
            onMouseLeave={closeContextMenu}
          >
            <button
              className="block w-full px-4 py-2 text-sm text-left hover:bg-gray-100"
              onClick={() => handleReschedule(contextMenu.eventId)}
            >
              改约
            </button>
            <button
              className="block w-full px-4 py-2 text-sm text-left hover:bg-gray-100"
              onClick={() => handleExtendTime(contextMenu.eventId)}
            >
              加时
            </button>
            <button
              className="block w-full px-4 py-2 text-sm text-left hover:bg-gray-100"
              onClick={() => handleToggleComplete(contextMenu.eventId)}
            >
              {events.find(e => e.id === contextMenu.eventId)?.isCompleted ? "标记为未完成" : "标记为已完成"}
            </button>
            <div className="border-t border-gray-200 my-1"></div>
            <button
              className="block w-full px-4 py-2 text-sm text-left hover:bg-gray-100"
              onClick={() => handleSetTag(contextMenu.eventId, "待定")}
            >
              标记为待定
            </button>
            <button
              className="block w-full px-4 py-2 text-sm text-left hover:bg-gray-100"
              onClick={() => handleSetTag(contextMenu.eventId, "不着急")}
            >
              标记为不着急
            </button>
            <button
              className="block w-full px-4 py-2 text-sm text-left hover:bg-gray-100"
              onClick={() => handleSetTag(contextMenu.eventId, "不可后退")}
            >
              标记为不可后退
            </button>
            <button
              className="block w-full px-4 py-2 text-sm text-left hover:bg-gray-100"
              onClick={() => handleSetTag(contextMenu.eventId, null)}
            >
              移除标记
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
