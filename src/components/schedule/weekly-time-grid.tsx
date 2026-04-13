"use client";

import React, { useEffect, useMemo, useState } from "react";
import { addDays, format, parse } from "date-fns";
import { zhCN } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Clock3, Plus, Smile, Frown, Meh, Angry, Heart, Check, Star, AlertTriangle, AlertCircle, Trash2, Repeat } from "lucide-react";
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
import {
  expandScheduleEvents,
  parseExceptionDateList,
  parseSyntheticEventId,
  WEEKDAY_SHORT_LABEL,
  WEEKDAY_UI_ORDER,
} from "@/lib/recurrence";
import { toast } from "sonner";

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

export type ViewMode = 'day' | 'week' | 'month';
export type TimeGranularity = 5 | 15 | 30 | 60;

type WeeklyTimeGridProps = {
  currentWeekStart: Date;
  weekRange: string;
  events: ScheduleEvent[];
  onCreateEvent: (event: ScheduleEvent) => void;
  onUpdateEvent: (
    eventId: string,
    patch: Partial<ScheduleEvent>,
    options?: { scope?: "occurrence" | "series" },
  ) => void;
  onDeleteEvent: (eventId: string, options?: { mode?: "single" | "future" | "all" }) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onViewModeChange?: (mode: ViewMode) => void;
  onTimeGranularityChange?: (granularity: TimeGranularity) => void;
  viewMode?: ViewMode;
  timeGranularity?: TimeGranularity;
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

const hourCellHeight = 60;

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
  onViewModeChange,
  onTimeGranularityChange,
  viewMode = 'week',
  timeGranularity = 60,
}: WeeklyTimeGridProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<GridCell | null>(null);
  const [createForm, setCreateForm] = useState<EventFormState>(defaultForm);
  const [createRecurrence, setCreateRecurrence] = useState<{
    enabled: boolean;
    kind: "daily" | "weekly";
    weekdays: number[];
    exceptionText: string;
  }>({
    enabled: false,
    kind: "daily",
    weekdays: [],
    exceptionText: "",
  });
  const [editForm, setEditForm] = useState<EventFormState>(defaultForm);
  const [editScope, setEditScope] = useState<"occurrence" | "series">("occurrence");
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
  
  const hours = useMemo(() => {
    const hoursArray: number[] = [];
    for (let hour = 0; hour < 24; hour++) {
      hoursArray.push(hour);
      if (timeGranularity < 60) {
        const intervals = 60 / timeGranularity;
        for (let i = 1; i < intervals; i++) {
          hoursArray.push(hour + (i * timeGranularity) / 60);
        }
      }
    }
    return hoursArray;
  }, [timeGranularity]);

  const displayDates = useMemo(() => {
    if (viewMode === "day") {
      return [currentWeekStart];
    }
    if (viewMode === "week") {
      return Array.from({ length: 7 }, (_, index) => addDays(currentWeekStart, index));
    }
    return Array.from({ length: 28 }, (_, index) => addDays(currentWeekStart, index));
  }, [currentWeekStart, viewMode]);

  const expandedEvents = useMemo(() => {
    if (displayDates.length === 0) return [] as ScheduleEvent[];
    const first = format(displayDates[0], "yyyy-MM-dd");
    const last = format(displayDates[displayDates.length - 1], "yyyy-MM-dd");
    return expandScheduleEvents(events, first, last) as ScheduleEvent[];
  }, [events, displayDates]);

  const handleViewModeChange = (mode: ViewMode) => {
    onViewModeChange?.(mode);
  };
  
  const handleTimeGranularityChange = (granularity: TimeGranularity) => {
    onTimeGranularityChange?.(granularity);
  };

  const selectedEvent = useMemo(
    () => expandedEvents.find((event) => event.id === editingEventId) ?? null,
    [expandedEvents, editingEventId],
  );
  function resetCreateDialog(cell: GridCell) {
    setSelectedCell(cell);
    const day = parse(cell.date, "yyyy-MM-dd", new Date());
    setCreateRecurrence({
      enabled: false,
      kind: "daily",
      weekdays: [day.getDay()],
      exceptionText: "",
    });
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
    setEditScope("occurrence");
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
    const minDuration = 1 / 60;
    const startHour = Math.max(0, Math.min(23.9833, createForm.startHour));
    const endHour = Math.max(startHour + minDuration, Math.min(24, createForm.endHour));

    if (createRecurrence.enabled) {
      if (createRecurrence.kind === "weekly") {
        if (createRecurrence.weekdays.length === 0) {
          toast.error("每周重复请至少选择一个星期");
          return;
        }
      }
      const exceptionDates = parseExceptionDateList(createRecurrence.exceptionText);
      const weekdays =
        createRecurrence.kind === "weekly"
          ? [...createRecurrence.weekdays].sort((a, b) => a - b)
          : undefined;
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
        recurrence:
          createRecurrence.kind === "daily"
            ? { kind: "daily" }
            : { kind: "weekly", weekdays: weekdays ?? [] },
        exceptionDates,
        recurrenceOverrides: {},
        recurrenceEndExclusive: null,
      });
    } else {
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
    }
    setCreateDialogOpen(false);
  }

  function handleSaveEdit() {
    if (!selectedEvent || !editForm.title.trim()) return;
    const minDuration = 1 / 60;
    const startHour = Math.max(0, Math.min(23.9833, editForm.startHour));
    const endHour = Math.max(startHour + minDuration, Math.min(24, editForm.endHour));
    const patch: Partial<ScheduleEvent> = {
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
    };
    const parsed = parseSyntheticEventId(selectedEvent.id);
    if (parsed) {
      onUpdateEvent(selectedEvent.id, patch, {
        scope: editScope === "series" ? "series" : "occurrence",
      });
    } else {
      onUpdateEvent(selectedEvent.id, patch);
    }
    setEditingEventId(null);
  }

  function handleDropEvent(targetDate: string, targetHour: number) {
    if (!draggingEventId) return;
    if (parseSyntheticEventId(draggingEventId)) {
      toast.info("循环行程请使用编辑修改时间；拖拽移动暂未支持。");
      setDraggingEventId(null);
      return;
    }
    const draggingEvent = expandedEvents.find((event) => event.id === draggingEventId);
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
    const event = expandedEvents.find((e) => e.id === eventId);
    if (event) {
      handleOpenEdit(event);
    }
    closeContextMenu();
  }

  function handleExtendTime(eventId: string) {
    const event = expandedEvents.find((e) => e.id === eventId);
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
    const event = expandedEvents.find((e) => e.id === eventId);
    if (event) {
      onUpdateEvent(eventId, {
        isCompleted: !event.isCompleted,
      });
    }
    closeContextMenu();
  }

  function handleDeleteFromContext(eventId: string) {
    if (parseSyntheticEventId(eventId)) {
      onDeleteEvent(eventId, { mode: "single" });
    } else {
      onDeleteEvent(eventId, { mode: "all" });
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

  // 计算时间网格的高度和间隔
  const cellHeight = hourCellHeight / (60 / timeGranularity);
  
  // 计算事件的位置和高度
  const getEventStyle = (event: PositionedEvent) => {
    const top = event.startHour * hourCellHeight + 4;
    const height = (event.endHour - event.startHour) * hourCellHeight - 8;
    return {
      top: `${top}px`,
      height: `${Math.max(height, 28)}px`,
      left: `calc(${(event.lane / event.laneCount) * 100}% + 4px)`,
      width: `calc(${100 / event.laneCount}% - 8px)`,
    };
  };

  return (
    <section className="rounded-lg border border-gray-200 bg-white shadow-md">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-6 py-4 bg-gray-50">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-gray-900">
            <Clock3 className="h-5 w-5 text-primary" />
            {viewMode === 'day' ? '日视图' : viewMode === 'week' ? '周视图' : '月视图'}
          </h2>
          <p className="mt-1 text-sm text-gray-600">{weekRange}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Button 
              variant={viewMode === 'day' ? 'default' : 'outline'} 
              size="sm" 
              className="rounded-md transition-all duration-150"
              onClick={() => handleViewModeChange('day')}
            >
              日
            </Button>
            <Button 
              variant={viewMode === 'week' ? 'default' : 'outline'} 
              size="sm" 
              className="rounded-md transition-all duration-150"
              onClick={() => handleViewModeChange('week')}
            >
              周
            </Button>
            <Button 
              variant={viewMode === 'month' ? 'default' : 'outline'} 
              size="sm" 
              className="rounded-md transition-all duration-150"
              onClick={() => handleViewModeChange('month')}
            >
              月
            </Button>
          </div>
          {viewMode !== 'month' && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">时间粒度:</span>
              <Select 
                value={String(timeGranularity)}
                onValueChange={(value) => handleTimeGranularityChange(Number(value) as TimeGranularity)}
              >
                <SelectTrigger className="w-24 rounded-md border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150">
                  <SelectValue placeholder="选择" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5分钟</SelectItem>
                  <SelectItem value="15">15分钟</SelectItem>
                  <SelectItem value="30">30分钟</SelectItem>
                  <SelectItem value="60">60分钟</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <Button variant="outline" size="sm" className="rounded-md border-gray-300 hover:bg-gray-100 transition-all duration-150" onClick={onPrevWeek}>
            <ChevronLeft className="h-4 w-4" />
            {viewMode === 'day' ? '上一天' : viewMode === 'week' ? '上一周' : '上一月'}
          </Button>
          <Button variant="outline" size="sm" className="rounded-md border-gray-300 hover:bg-gray-100 transition-all duration-150" onClick={onNextWeek}>
            {viewMode === 'day' ? '下一天' : viewMode === 'week' ? '下一周' : '下一月'}
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="default" size="sm" className="rounded-md bg-primary text-white hover:bg-primary/90 transition-all duration-150" onClick={() => setShowCategoryManager(true)}>
            分类管理
          </Button>
        </div>
      </header>

      <div className="overflow-x-auto">
        <div className="relative min-w-[1120px]">
          {/* 日视图和周视图 */}
          {viewMode !== 'month' && (
            <>
              <div className="grid grid-cols-[96px_repeat(auto-fit,minmax(140px,1fr))] border-b border-gray-200 bg-white">
                <div className="border-r border-gray-200 px-3 py-3 text-sm font-medium text-gray-700 bg-gray-50">时间</div>
                {displayDates.map((day) => (
                  <div
                    key={day.toISOString()}
                    className="border-r border-gray-200 px-4 py-3 text-center text-sm font-medium text-gray-700 last:border-r-0 bg-gray-50"
                  >
                    {dayTitle(day)}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-[96px_repeat(auto-fit,minmax(140px,1fr))]">
                <div>
                  {hours.map((hour) => {
                    const isMainHour = Number.isInteger(hour);
                    return (
                      <div
                        key={`hour-label-${hour}`}
                        className={`border-r border-b border-gray-200 px-3 py-1 text-sm ${isMainHour ? 'text-gray-500 bg-gray-50' : 'text-gray-400'}`}
                        style={{ 
                          height: `${cellHeight}px`,
                          borderBottomWidth: isMainHour ? '1px' : '0.5px',
                          borderBottomStyle: isMainHour ? 'solid' : 'dashed'
                        }}
                      >
                        {isMainHour ? formatHour(hour) : ''}
                      </div>
                    );
                  })}
                </div>

                {displayDates.map((day) => {
                  const dayIso = format(day, "yyyy-MM-dd");
                  const dayEvents = layoutDayEvents(expandedEvents.filter((event) => event.date === dayIso));

                  return (
                    <div key={dayIso} className="relative border-r border-gray-200 last:border-r-0">
                      <div className="grid" style={{ 
                        gridTemplateRows: `repeat(${hours.length}, ${cellHeight}px)` 
                      }}>
                        {hours.map((hour) => {
                          const isMainHour = Number.isInteger(hour);
                          return (
                            <button
                              key={`${dayIso}-${hour}`}
                              type="button"
                              className={`border-b transition-colors duration-150 ${isMainHour ? 'border-gray-200' : 'border-gray-100'} hover:bg-gray-50`}
                              style={{ 
                                height: `${cellHeight}px`,
                                borderBottomWidth: isMainHour ? '1px' : '0.5px',
                                borderBottomStyle: isMainHour ? 'solid' : 'dashed'
                              }}
                              onClick={() => resetCreateDialog({ date: dayIso, startHour: hour })}
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={() => handleDropEvent(dayIso, hour)}
                            />
                          );
                        })}
                      </div>

                      <div className="pointer-events-none absolute inset-0 p-1">
                        {dayEvents.map((event) => {
                          const durationHours = event.endHour - event.startHour;
                          const compactCard = durationHours < 1.25;
                          return (
                          <div
                            key={event.id}
                            className={`pointer-events-auto absolute flex min-h-0 flex-col overflow-hidden rounded-lg border text-left text-sm shadow-md transition-all duration-300 hover:shadow-lg hover:scale-[1.02] ${
                              event.isCompleted
                                ? "border-gray-300 bg-gray-100 text-gray-500 opacity-70"
                                : getCategoryColor(categories, event.category)
                            }`}
                            style={getEventStyle(event)}
                            draggable={!parseSyntheticEventId(event.id)}
                            onDragStart={() => setDraggingEventId(event.id)}
                            onDragEnd={() => setDraggingEventId(null)}
                            onContextMenu={(e) => handleContextMenu(e, event.id)}
                          >
                            <button
                              type="button"
                              className={`flex min-h-0 w-full min-w-0 flex-1 flex-col text-left ${
                                compactCard
                                  ? "items-stretch justify-start px-2 pb-1 pt-1"
                                  : "items-stretch justify-center px-2 py-1.5"
                              }`}
                              onClick={() => handleOpenEdit(event)}
                            >
                              <div
                                className={`flex min-h-0 min-w-0 flex-col gap-1 ${
                                  compactCard ? "" : "flex-1"
                                }`}
                              >
                                <div
                                  className={`min-w-0 ${
                                    compactCard
                                      ? ""
                                      : "flex flex-1 flex-col justify-center overflow-y-auto"
                                  }`}
                                >
                                  <div className="flex items-start gap-1.5">
                                    {event.tag ? (
                                      <span
                                        className={`shrink-0 text-sm font-bold ${getTagInfo(event.tag).color}`}
                                      >
                                        {getTagInfo(event.tag).icon}
                                      </span>
                                    ) : null}
                                    {parseSyntheticEventId(event.id) ? (
                                      <Repeat
                                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-600"
                                        aria-hidden
                                      />
                                    ) : null}
                                    <p
                                      className="min-w-0 flex-1 truncate font-medium leading-snug"
                                      title={`${event.title} (${formatHour(event.startHour)} - ${formatHour(event.endHour)})`}
                                    >
                                      {event.title}
                                    </p>
                                    {event.isCompleted ? (
                                      <Check className="h-4 w-4 shrink-0 text-green-600" aria-hidden />
                                    ) : null}
                                  </div>
                                </div>
                                <p className="shrink-0 text-xs leading-tight text-gray-700">
                                  {formatHour(event.startHour)} – {formatHour(event.endHour)}
                                </p>
                              </div>
                            </button>
                            <button
                              type="button"
                              className="absolute right-1 top-1 z-10 rounded-full border border-gray-300 bg-white p-1 text-black shadow-sm hover:bg-gray-100 transition-colors duration-150"
                              onClick={(mouseEvent) => {
                                mouseEvent.stopPropagation();
                                resetCreateDialog({ date: event.date, startHour: event.startHour });
                              }}
                              aria-label={`在 ${event.title} 同时段新增行程`}
                            >
                              <Plus className="h-3 w-3" />
                            </button>

                          </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 日记区域 */}
              <div className="border-t border-gray-200 mt-6 bg-gray-50">
                <div className="grid grid-cols-[96px_repeat(auto-fit,minmax(140px,1fr))]">
                  <div className="border-r border-gray-200 px-3 py-4 text-sm font-medium text-gray-700 bg-gray-100">
                    日记
                  </div>
                  {displayDates.map((day) => {
                    const dayIso = format(day, "yyyy-MM-dd");
                    const diary = getDiary(dayIso);
                    const moodOption = moodOptions.find((m) => m.value === diary?.mood);

                    return (
                      <div
                        key={`diary-${dayIso}`}
                        className="border-r border-gray-200 last:border-r-0 p-4 min-h-[140px] cursor-pointer hover:bg-gray-100 transition-colors duration-150 rounded-md mx-1 my-2"
                        onClick={() => handleOpenDiary(dayIso)}
                      >
                        {diary ? (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              {moodOption?.icon}
                              <span className="text-sm font-medium text-gray-700">{moodOption?.label}</span>
                            </div>
                            <p className="text-sm text-gray-800 line-clamp-3 leading-relaxed">{diary.content}</p>
                          </div>
                        ) : (
                          <div className="h-full flex items-center justify-center text-gray-400">
                            <span className="text-sm">点击记录日记</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
          
          {/* 月视图 */}
          {viewMode === 'month' && (
            <div className="p-4">
              <div className="grid grid-cols-7 gap-2">
                {['日', '一', '二', '三', '四', '五', '六'].map((day) => (
                  <div key={day} className="text-center text-sm font-medium text-gray-700 p-2">
                    {day}
                  </div>
                ))}
                {displayDates.map((day) => {
                  const dayIso = format(day, "yyyy-MM-dd");
                  const dayEvents = expandedEvents.filter((event) => event.date === dayIso);
                  const diary = getDiary(dayIso);
                  
                  return (
                    <div 
                      key={dayIso} 
                      className="border border-gray-200 rounded-lg p-2 min-h-[100px] hover:bg-gray-50 transition-colors duration-150"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">{format(day, 'd')}</span>
                        {diary && (
                          <span className="text-xs text-gray-600">有日记</span>
                        )}
                      </div>
                      <div className="space-y-1">
                        {dayEvents.slice(0, 3).map((event) => (
                          <div 
                            key={event.id}
                            className={`cursor-pointer truncate text-xs p-1 rounded ${getCategoryColor(categories, event.category)}`}
                            title={`${event.title} (${formatHour(event.startHour)} - ${formatHour(event.endHour)})`}
                            onClick={() => handleOpenEdit(event)}
                          >
                            {event.title}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-xs text-gray-500">+{dayEvents.length - 3} 更多</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            {selectedCell && (
              <DialogContent className="rounded-lg border-gray-200 shadow-lg">
                <DialogHeader>
                  <DialogTitle className="text-lg font-semibold text-gray-900">
                    新建行程 - {selectedCell.date} {formatHour(selectedCell.startHour)}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-5 mt-4">
                  <div className="space-y-3">
                    <Label htmlFor="create-title" className="text-sm font-medium text-gray-700">标题</Label>
                    <Input
                      id="create-title"
                      value={createForm.title}
                      onChange={(event) =>
                        setCreateForm((prev) => ({ ...prev, title: event.target.value }))
                      }
                      placeholder="输入行程标题"
                      className="rounded-md border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-gray-700">分类</Label>
                    <Select
                      value={createForm.category}
                      onValueChange={(value) =>
                        value && setCreateForm((prev) => ({ ...prev, category: value }))
                      }
                    >
                      <SelectTrigger className="rounded-md border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150">
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
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-gray-700">标记</Label>
                    <Select
                      value={createForm.tag || ""}
                      onValueChange={(value) =>
                        setCreateForm((prev) => ({ ...prev, tag: value as EventTag }))
                      }
                    >
                      <SelectTrigger className="rounded-md border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150">
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
                  <div className="space-y-3 rounded-lg border border-gray-100 bg-gray-50/80 p-4">
                    <div className="flex items-center gap-3">
                      <Switch
                        id="create-recurring"
                        checked={createRecurrence.enabled}
                        onCheckedChange={(checked) =>
                          setCreateRecurrence((prev) => {
                            const next = { ...prev, enabled: checked };
                            if (
                              checked &&
                              prev.kind === "weekly" &&
                              prev.weekdays.length === 0 &&
                              selectedCell
                            ) {
                              next.weekdays = [
                                parse(selectedCell.date, "yyyy-MM-dd", new Date()).getDay(),
                              ];
                            }
                            return next;
                          })
                        }
                      />
                      <Label htmlFor="create-recurring" className="text-sm font-medium text-gray-800">
                        循环行程
                      </Label>
                    </div>
                    {createRecurrence.enabled ? (
                      <div className="space-y-4 pt-1">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-gray-700">重复方式</Label>
                          <Select
                            value={createRecurrence.kind}
                            onValueChange={(value) =>
                              value &&
                              setCreateRecurrence((prev) => ({
                                ...prev,
                                kind: value as "daily" | "weekly",
                              }))
                            }
                          >
                            <SelectTrigger className="rounded-md border-gray-300">
                              <SelectValue placeholder="选择" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="daily">每天</SelectItem>
                              <SelectItem value="weekly">每周指定星期</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {createRecurrence.kind === "weekly" ? (
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-gray-700">重复的星期</Label>
                            <div className="flex flex-wrap gap-2">
                              {WEEKDAY_UI_ORDER.map((d) => (
                                <Button
                                  key={d}
                                  type="button"
                                  size="sm"
                                  variant={createRecurrence.weekdays.includes(d) ? "default" : "outline"}
                                  className="rounded-md"
                                  onClick={() =>
                                    setCreateRecurrence((prev) => {
                                      const has = prev.weekdays.includes(d);
                                      return {
                                        ...prev,
                                        weekdays: has
                                          ? prev.weekdays.filter((x) => x !== d)
                                          : [...prev.weekdays, d],
                                      };
                                    })
                                  }
                                >
                                  周{WEEKDAY_SHORT_LABEL[d]}
                                </Button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        <div className="space-y-2">
                          <Label htmlFor="create-exceptions" className="text-sm font-medium text-gray-700">
                            例外日期（可选）
                          </Label>
                          <Textarea
                            id="create-exceptions"
                            value={createRecurrence.exceptionText}
                            onChange={(event) =>
                              setCreateRecurrence((prev) => ({
                                ...prev,
                                exceptionText: event.target.value,
                              }))
                            }
                            placeholder={
                              "每行一个或用逗号分隔，例如：\n2026-04-12\n2026-04-20"
                            }
                            className="min-h-[72px] rounded-md border-gray-300 text-sm"
                          />
                          <p className="text-xs text-gray-500">这些日期不会生成该循环行程。</p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <Label className="text-sm font-medium text-gray-700">开始时间</Label>
                      <div className="flex space-x-3">
                        <Select
                          value={String(Math.floor(createForm.startHour))}
                          onValueChange={(value) => {
                            const hours = Number(value);
                            const minutes = createForm.startHour - Math.floor(createForm.startHour);
                            setCreateForm((prev) => ({ ...prev, startHour: hours + minutes }));
                          }}
                        >
                          <SelectTrigger className="rounded-md border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150">
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
                          <SelectTrigger className="rounded-md border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150">
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
                    <div className="space-y-3">
                      <Label className="text-sm font-medium text-gray-700">结束时间</Label>
                      <div className="flex space-x-3">
                        <Select
                          value={String(Math.floor(createForm.endHour))}
                          onValueChange={(value) => {
                            const hours = Number(value);
                            const minutes = createForm.endHour - Math.floor(createForm.endHour);
                            setCreateForm((prev) => ({ ...prev, endHour: hours + minutes }));
                          }}
                        >
                          <SelectTrigger className="rounded-md border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150">
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
                          <SelectTrigger className="rounded-md border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150">
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
                    className="w-full rounded-md bg-primary text-white hover:bg-primary/90 transition-all duration-150 py-2"
                  >
                    创建行程
                  </Button>
                </div>
              </DialogContent>
            )}
          </Dialog>

          <Dialog open={Boolean(selectedEvent)} onOpenChange={(open) => !open && setEditingEventId(null)}>
            {selectedEvent && (
              <DialogContent className="rounded-lg border-gray-200 shadow-lg">
                <DialogHeader>
                  <DialogTitle className="text-lg font-semibold text-gray-900">编辑行程详情</DialogTitle>
                </DialogHeader>
                <div className="space-y-5 mt-4">
                  <div className="space-y-3">
                    <Label htmlFor="edit-title" className="text-sm font-medium text-gray-700">标题</Label>
                    <Input
                      id="edit-title"
                      value={editForm.title}
                      onChange={(event) =>
                        setEditForm((prev) => ({ ...prev, title: event.target.value }))
                      }
                      placeholder="输入行程标题"
                      className="rounded-md border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-gray-700">分类</Label>
                    <Select
                      value={editForm.category}
                      onValueChange={(value) =>
                        value && setEditForm((prev) => ({ ...prev, category: value }))
                      }
                    >
                      <SelectTrigger className="rounded-md border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150">
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
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-gray-700">标记</Label>
                    <Select
                      value={editForm.tag || ""}
                      onValueChange={(value) =>
                        setEditForm((prev) => ({ ...prev, tag: value as EventTag }))
                      }
                    >
                      <SelectTrigger className="rounded-md border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150">
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <Label className="text-sm font-medium text-gray-700">开始时间</Label>
                      <div className="flex space-x-3">
                        <Select
                          value={String(Math.floor(editForm.startHour))}
                          onValueChange={(value) => {
                            const hours = Number(value);
                            const minutes = editForm.startHour - Math.floor(editForm.startHour);
                            setEditForm((prev) => ({ ...prev, startHour: hours + minutes }));
                          }}
                        >
                          <SelectTrigger className="rounded-md border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150">
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
                          <SelectTrigger className="rounded-md border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150">
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
                    <div className="space-y-3">
                      <Label className="text-sm font-medium text-gray-700">结束时间</Label>
                      <div className="flex space-x-3">
                        <Select
                          value={String(Math.floor(editForm.endHour))}
                          onValueChange={(value) => {
                            const hours = Number(value);
                            const minutes = editForm.endHour - Math.floor(editForm.endHour);
                            setEditForm((prev) => ({ ...prev, endHour: hours + minutes }));
                          }}
                        >
                          <SelectTrigger className="rounded-md border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150">
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
                          <SelectTrigger className="rounded-md border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150">
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
                  <div className="space-y-3">
                    <Label htmlFor="edit-notes" className="text-sm font-medium text-gray-700">备注</Label>
                    <Textarea
                      id="edit-notes"
                      value={editForm.notes}
                      onChange={(event) =>
                        setEditForm((prev) => ({ ...prev, notes: event.target.value }))
                      }
                      placeholder="输入备注信息"
                      className="rounded-md border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="edit-requirements" className="text-sm font-medium text-gray-700">所需物品/准备事项</Label>
                    <Textarea
                      id="edit-requirements"
                      value={editForm.requirements}
                      onChange={(event) =>
                        setEditForm((prev) => ({ ...prev, requirements: event.target.value }))
                      }
                      placeholder="每行一项，例如：笔记本、笔"
                      className="rounded-md border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150"
                    />
                  </div>
                  <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
                    <Switch
                      id="edit-completed"
                      checked={editForm.isCompleted}
                      onCheckedChange={(checked) =>
                        setEditForm((prev) => ({ ...prev, isCompleted: checked }))
                      }
                    />
                    <Label htmlFor="edit-completed" className="text-sm font-medium text-gray-700">标记为已完成</Label>
                  </div>
                  {parseSyntheticEventId(selectedEvent.id) ? (
                    <div className="space-y-4 rounded-lg border border-amber-100 bg-amber-50/60 p-4">
                      <p className="text-sm text-gray-800">
                        循环行程 · 当前日期 <span className="font-medium">{selectedEvent.date}</span>
                      </p>
                      <div className="space-y-2">
                        <Label className="text-xs font-medium uppercase tracking-wide text-gray-600">
                          保存范围
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={editScope === "occurrence" ? "default" : "outline"}
                            className="rounded-md"
                            onClick={() => setEditScope("occurrence")}
                          >
                            仅此日
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={editScope === "series" ? "default" : "outline"}
                            className="rounded-md"
                            onClick={() => setEditScope("series")}
                          >
                            整个系列
                          </Button>
                        </div>
                        <p className="text-xs text-gray-600">
                          修改时间、标题等时：选「仅此日」只影响当天；选「整个系列」会更新该循环规则下所有日期（已单独改过的那一天仍以「仅此日」覆盖为准）。
                        </p>
                      </div>
                      <div className="space-y-2 border-t border-amber-200/80 pt-3">
                        <Label className="text-xs font-medium uppercase tracking-wide text-gray-600">
                          删除
                        </Label>
                        <div className="flex flex-col gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full rounded-md border-gray-300"
                            onClick={() => {
                              onDeleteEvent(selectedEvent.id, { mode: "single" });
                              setEditingEventId(null);
                            }}
                          >
                            删除此日（其余日期保留）
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full rounded-md border-gray-300"
                            onClick={() => {
                              onDeleteEvent(selectedEvent.id, { mode: "future" });
                              setEditingEventId(null);
                            }}
                          >
                            删除此日及之后的循环（已过去的保留）
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            className="w-full rounded-md"
                            onClick={() => {
                              onDeleteEvent(selectedEvent.id, { mode: "all" });
                              setEditingEventId(null);
                            }}
                          >
                            删除整个系列
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-3 sm:flex-row sm:space-x-4 sm:gap-0">
                    {parseSyntheticEventId(selectedEvent.id) ? null : (
                      <Button
                        onClick={() => {
                          onDeleteEvent(selectedEvent.id, { mode: "all" });
                          setEditingEventId(null);
                        }}
                        className="flex-1 rounded-md bg-red-600 text-white hover:bg-red-700 transition-all duration-150 py-2"
                      >
                        删除行程
                      </Button>
                    )}
                    <Button
                      onClick={handleSaveEdit}
                      className="flex-1 rounded-md bg-primary text-white hover:bg-primary/90 transition-all duration-150 py-2"
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
            <DialogContent className="rounded-lg border-gray-200 shadow-lg">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-gray-900">分类管理</DialogTitle>
              </DialogHeader>
              <div className="space-y-5 mt-4">
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">现有分类</h3>
                  <div className="space-y-3">
                    {categories.map((category) => (
                      <div key={category.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors duration-150">
                        <div className="flex items-center gap-4">
                          <div className={`w-6 h-6 rounded-md border ${category.color}`} />
                          <span className="text-sm font-medium text-gray-800">{category.name}</span>
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 rounded-md hover:bg-red-50 hover:text-red-500 transition-colors duration-150"
                          onClick={() => handleDeleteCategory(category.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">添加新分类</h3>
                  <div className="space-y-3">
                    <Label htmlFor="category-name" className="text-sm font-medium text-gray-700">分类名称</Label>
                    <Input
                      id="category-name"
                      value={newCategory.name}
                      onChange={(event) => setNewCategory((prev) => ({ ...prev, name: event.target.value }))}
                      placeholder="输入分类名称"
                      className="rounded-md border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150"
                    />
                    <Label className="text-sm font-medium text-gray-700">分类颜色</Label>
                    <div className="grid grid-cols-6 gap-4">
                      {
                        [
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
                            className={`w-12 h-12 rounded-md border transition-all duration-200 ${
                              newCategory.color === color ? "ring-2 ring-primary ring-offset-2 scale-110" : "hover:ring-1 hover:ring-gray-300 hover:scale-105"
                            } ${color}`}
                            title={color}
                          />
                        ))
                      }
                    </div>
                  </div>
                </div>
                <Button
                  onClick={handleAddCategory}
                  className="w-full rounded-md bg-primary text-white hover:bg-primary/90 transition-all duration-150 py-2"
                >
                  添加分类
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* 日记编辑对话框 */}
          <Dialog open={Boolean(editingDiaryDate)} onOpenChange={(open) => !open && setEditingDiaryDate(null)}>
            {editingDiaryDate && (
              <DialogContent className="rounded-lg border-gray-200 shadow-lg">
                <DialogHeader>
                  <DialogTitle className="text-lg font-semibold text-gray-900">
                    日记 - {editingDiaryDate}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-5 mt-4">
                  <div className="space-y-4">
                    <Label className="text-sm font-medium text-gray-700">今天的心情</Label>
                    <div className="flex flex-wrap justify-center gap-5">
                      {moodOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setDiaryForm((prev) => ({ ...prev, mood: option.value }))}
                          className={`p-4 rounded-lg border transition-all duration-300 ${
                            diaryForm.mood === option.value
                              ? "border-primary bg-primary/5 ring-2 ring-primary/20 scale-105"
                              : "border-gray-200 hover:border-gray-300 hover:bg-gray-50 hover:scale-105"
                          }`}
                          title={option.label}
                        >
                          {option.icon}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="diary-content" className="text-sm font-medium text-gray-700">日记内容</Label>
                    <Textarea
                      id="diary-content"
                      value={diaryForm.content}
                      onChange={(event) =>
                        setDiaryForm((prev) => ({ ...prev, content: event.target.value }))
                      }
                      placeholder="记录今天的心情和想法..."
                      className="rounded-md border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150 min-h-[180px]"
                    />
                  </div>
                  <div className="flex space-x-4">
                    <Button
                      onClick={() => setEditingDiaryDate(null)}
                      variant="outline"
                      className="flex-1 rounded-md border-gray-300 hover:bg-gray-50 transition-all duration-150 py-2"
                    >
                      取消
                    </Button>
                    <Button
                      onClick={handleSaveDiary}
                      className="flex-1 rounded-md bg-primary text-white hover:bg-primary/90 transition-all duration-150 py-2"
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
              {expandedEvents.find((e) => e.id === contextMenu.eventId)?.isCompleted
                ? "标记为未完成"
                : "标记为已完成"}
            </button>
            <button
              className="block w-full px-4 py-2 text-sm text-left text-red-600 hover:bg-red-50"
              onClick={() => handleDeleteFromContext(contextMenu.eventId)}
            >
              删除该行程
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
