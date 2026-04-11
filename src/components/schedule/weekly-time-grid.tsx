"use client";

import React, { useEffect, useMemo, useState } from "react";
import { addDays, format, isSameDay, isAfter, isBefore, parseISO, addWeeks, addMonths } from "date-fns";
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

export type ViewMode = 'day' | 'week' | 'month';
export type TimeGranularity = 5 | 15 | 30 | 60;

type WeeklyTimeGridProps = {
  currentWeekStart: Date;
  weekRange: string;
  events: ScheduleEvent[];
  onCreateEvent: (event: ScheduleEvent) => void;
  onUpdateEvent: (eventId: string, patch: Partial<ScheduleEvent>) => void;
  onDeleteEvent: (eventId: string) => void;
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
  recurrence: boolean;
  recurrenceType: "daily" | "weekly" | "monthly";
  interval: number;
  weekdays: number[];
  endDate: string;
  endCount: number;
  exceptionDates: string;
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
  recurrence: false,
  recurrenceType: "daily",
  interval: 1,
  weekdays: [],
  endDate: "",
  endCount: 0,
  exceptionDates: "",
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

function generateRecurrenceEvents(event: ScheduleEvent, startDate: Date, endDate: Date): ScheduleEvent[] {
  const result: ScheduleEvent[] = [];
  
  // 如果没有循环规则，只返回原始事件
  if (!event.recurrence) {
    return [event];
  }
  
  // 如果是循环事件的实例（有originalId），不再次生成循环事件
  if (event.originalId) {
    return [event];
  }
  
  try {
    // 验证日期格式
    if (!event.date) {
      console.error('Event missing date:', event);
      return [event];
    }
    
    const originalDate = parseISO(event.date);
    let currentDate = originalDate;
    let count = 0;
    
    // 生成循环事件实例
    while (currentDate <= endDate) {
      // 检查是否在视图范围内
      if (currentDate >= startDate) {
        // 检查是否是例外日期
        const currentDateStr = format(currentDate, 'yyyy-MM-dd');
        const isException = event.exceptionDates?.includes(currentDateStr);
        if (!isException) {
          // 对于每周循环，检查是否是指定的星期几
          if (event.recurrence.type === 'weekly' && event.recurrence.weekdays) {
            const dayOfWeek = currentDate.getDay(); // 0-6, 0 是周日
            if (event.recurrence.weekdays.includes(dayOfWeek)) {
              result.push({
                ...event,
                id: `${event.id}-${currentDateStr}`,
                date: currentDateStr,
                originalId: event.id
              });
            }
          } else {
            // 每天或每月循环
            result.push({
              ...event,
              id: `${event.id}-${currentDateStr}`,
              date: currentDateStr,
              originalId: event.id
            });
          }
        }
      }
      
      // 计算下一个循环日期
      currentDate = getNextRecurrenceDate(currentDate, event.recurrence);
      count++;
      
      // 检查循环结束条件
      if (event.recurrence.endCount && count >= event.recurrence.endCount) {
        break;
      }
      if (event.recurrence.endDate) {
        try {
          if (currentDate > parseISO(event.recurrence.endDate)) {
            break;
          }
        } catch (e) {
          console.error('Invalid endDate format:', event.recurrence.endDate);
          break;
        }
      }
      
      // 防止无限循环
      if (count > 1000) {
        console.warn('Recurrence event generation limit reached');
        break;
      }
    }
    
    // 如果没有生成任何事件，返回原始事件
    return result.length > 0 ? result : [event];
  } catch (error) {
    // 如果出错，返回原始事件
    console.error('Error generating recurrence events:', error);
    return [event];
  }
}

function getNextRecurrenceDate(currentDate: Date, recurrence: any): Date {
  // 验证参数
  if (!(currentDate instanceof Date) || isNaN(currentDate.getTime())) {
    console.error('Invalid currentDate:', currentDate);
    return new Date();
  }
  
  if (!recurrence || typeof recurrence !== 'object') {
    console.error('Invalid recurrence:', recurrence);
    return addDays(currentDate, 1);
  }
  
  const interval = typeof recurrence.interval === 'number' && recurrence.interval > 0 ? recurrence.interval : 1;
  
  switch (recurrence.type) {
    case "daily":
      return addDays(currentDate, interval);
    case "weekly":
      return addWeeks(currentDate, interval);
    case "monthly":
      return addMonths(currentDate, interval);
    default:
      console.warn('Unknown recurrence type:', recurrence.type);
      return addDays(currentDate, 1);
  }
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
  timeGranularity = 30,
}: WeeklyTimeGridProps) {
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(currentWeekStart, index)),
    [currentWeekStart],
  );
  
  // 计算当前视图的开始和结束日期
  const viewStartDate = useMemo(() => {
    if (viewMode === 'day') return currentWeekStart;
    if (viewMode === 'week') return currentWeekStart;
    if (viewMode === 'month') return currentWeekStart;
    return currentWeekStart;
  }, [currentWeekStart, viewMode]);
  
  const viewEndDate = useMemo(() => {
    if (viewMode === 'day') return addDays(currentWeekStart, 1);
    if (viewMode === 'week') return addDays(currentWeekStart, 7);
    if (viewMode === 'month') return addDays(currentWeekStart, 28);
    return addDays(currentWeekStart, 7);
  }, [currentWeekStart, viewMode]);
  
  // 生成所有循环事件的实例
  const allEvents = useMemo(() => {
    const result: ScheduleEvent[] = [];
    events.forEach(event => {
      const recurrenceEvents = generateRecurrenceEvents(event, viewStartDate, viewEndDate);
      result.push(...recurrenceEvents);
    });
    return result;
  }, [events, viewStartDate, viewEndDate]);
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
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteEventId, setDeleteEventId] = useState<string | null>(null);
  const [deleteOption, setDeleteOption] = useState<'only' | 'all-future' | 'all'>('only');
  
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
  
  const handleViewModeChange = (mode: ViewMode) => {
    onViewModeChange?.(mode);
  };
  
  const handleTimeGranularityChange = (granularity: TimeGranularity) => {
    onTimeGranularityChange?.(granularity);
  };

  const selectedEvent = useMemo(
    () => allEvents.find((event) => event.id === editingEventId) ?? null,
    [allEvents, editingEventId],
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
      recurrence: false,
      recurrenceType: "daily",
      interval: 1,
      weekdays: [],
      endDate: "",
      endCount: 0,
      exceptionDates: "",
    });
    setCreateDialogOpen(true);
  }

  function handleOpenEdit(event: ScheduleEvent) {
    setEditingEventId(event.id);
    // 查找原始事件（如果是循环事件的实例）
    const originalEvent = events.find(e => e.id === event.originalId || e.id === event.id);
    setEditForm({
      title: event.title,
      startHour: event.startHour,
      endHour: event.endHour,
      notes: event.notes,
      requirements: event.requirements.join("\n"),
      isCompleted: event.isCompleted,
      category: event.category,
      tag: event.tag,
      recurrence: !!originalEvent?.recurrence,
      recurrenceType: originalEvent?.recurrence?.type || "daily",
      interval: originalEvent?.recurrence?.interval || 1,
      weekdays: originalEvent?.recurrence?.weekdays || [],
      endDate: originalEvent?.recurrence?.endDate || "",
      endCount: originalEvent?.recurrence?.endCount || 0,
      exceptionDates: originalEvent?.exceptionDates?.join("\n") || "",
    });
  }

  function handleCreateEvent() {
    if (!selectedCell || !createForm.title.trim()) return;
    const startHour = Math.max(0, Math.min(23.5, createForm.startHour));
    const endHour = Math.max(startHour + 0.5, Math.min(24, createForm.endHour));
    const originalId = createId("event");

    const recurrenceRule = createForm.recurrence ? {
      type: createForm.recurrenceType,
      interval: createForm.interval,
      endDate: createForm.endDate || undefined,
      endCount: createForm.endCount > 0 ? createForm.endCount : undefined,
      weekdays: createForm.recurrenceType === "weekly" ? createForm.weekdays : undefined,
    } : undefined;

    const exceptionDates = createForm.exceptionDates
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    onCreateEvent({
      id: originalId,
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
      recurrence: recurrenceRule,
      exceptionDates: exceptionDates.length > 0 ? exceptionDates : undefined,
      originalId: recurrenceRule ? originalId : undefined,
    });
    setCreateDialogOpen(false);
  }

  function handleSaveEdit() {
    if (!selectedEvent || !editForm.title.trim()) return;
    const startHour = Math.max(0, Math.min(23.5, editForm.startHour));
    const endHour = Math.max(startHour + 0.5, Math.min(24, editForm.endHour));
    
    const recurrenceRule = editForm.recurrence ? {
      type: editForm.recurrenceType,
      interval: editForm.interval,
      endDate: editForm.endDate || undefined,
      endCount: editForm.endCount > 0 ? editForm.endCount : undefined,
      weekdays: editForm.recurrenceType === "weekly" ? editForm.weekdays : undefined,
    } : undefined;

    const exceptionDates = editForm.exceptionDates
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    // 检查是否是循环事件的实例
    if (selectedEvent.originalId) {
      // 对于循环事件的实例，我们只修改该实例，不影响整个循环系列
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
        // 对于实例，不修改循环规则，保持独立
      });
    } else {
      // 对于原始事件，修改整个循环系列
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
        recurrence: recurrenceRule,
        exceptionDates: exceptionDates.length > 0 ? exceptionDates : undefined,
        originalId: recurrenceRule ? selectedEvent.id : undefined,
      });
    }
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
  
  function handleDeleteEventClick(eventId: string) {
    setDeleteEventId(eventId);
    setDeleteOption('only');
    setDeleteDialogOpen(true);
  }
  
  function handleConfirmDelete() {
    if (!deleteEventId) return;
    
    const event = allEvents.find(e => e.id === deleteEventId);
    if (!event) return;
    
    switch (deleteOption) {
      case 'only':
        // 只删除当前实例
        onDeleteEvent(deleteEventId);
        break;
      case 'all-future':
        // 删除当前实例及未来的所有循环事件
        // 这里需要实现逻辑，将当前日期及之后的日期添加到例外日期
        const originalEvent = events.find(e => e.id === event.originalId || e.id === event.id);
        if (originalEvent && originalEvent.recurrence) {
          const exceptionDates = [...(originalEvent.exceptionDates || []), event.date];
          onUpdateEvent(originalEvent.id, {
            exceptionDates,
          });
        }
        break;
      case 'all':
        // 删除整个循环系列
        const eventToDelete = events.find(e => e.id === event.originalId || e.id === event.id);
        if (eventToDelete) {
          onDeleteEvent(eventToDelete.id);
        }
        break;
    }
    
    setDeleteDialogOpen(false);
    setDeleteEventId(null);
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
  
  // 根据视图模式获取显示的日期
  const displayDates = useMemo(() => {
    if (viewMode === 'day') {
      return [currentWeekStart];
    } else if (viewMode === 'week') {
      return Array.from({ length: 7 }, (_, index) => addDays(currentWeekStart, index));
    } else { // month
      // 简单实现：显示4周
      return Array.from({ length: 28 }, (_, index) => addDays(currentWeekStart, index));
    }
  }, [currentWeekStart, viewMode]);
  
  // 计算事件的位置和高度
  const getEventStyle = (event: PositionedEvent) => {
    const top = event.startHour * hourCellHeight + 4;
    const height = (event.endHour - event.startHour) * hourCellHeight - 8;
    return {
      top: `${top}px`,
      height: `${height}px`,
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
        <div className="relative min-w-[920px]">
          {/* 日视图和周视图 */}
          {viewMode !== 'month' && (
            <>
              <div className="grid grid-cols-[88px_repeat(auto-fit,minmax(120px,1fr))] border-b border-gray-200 bg-white">
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

              <div className="grid grid-cols-[88px_repeat(auto-fit,minmax(120px,1fr))]">
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
                  const dayEvents = layoutDayEvents(allEvents.filter((event) => event.date === dayIso));

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
                        {dayEvents.map((event) => (
                          <div
                            key={event.id}
                            className={`pointer-events-auto absolute rounded-lg border px-3 py-2 text-left text-sm shadow-md transition-all duration-300 hover:shadow-lg hover:scale-[1.02] ${
                              event.isCompleted
                                ? "border-gray-300 bg-gray-100 text-gray-500 opacity-70"
                                : getCategoryColor(categories, event.category)
                            }`}
                            style={getEventStyle(event)}
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
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium truncate">{event.title}</p>
                                  {event.tag && (
                                    <span className={`text-sm font-bold ${getTagInfo(event.tag).color}`}>
                                      {getTagInfo(event.tag).icon}
                                    </span>
                                  )}
                                </div>
                                {event.isCompleted && (
                                  <Check className="h-4 w-4 text-green-500" />
                                )}
                              </div>
                              <p className="text-xs text-gray-600">
                                {formatHour(event.startHour)} - {formatHour(event.endHour)}
                              </p>
                            </button>
                            <button
                              type="button"
                              className="absolute right-2 top-2 rounded-full border border-gray-300 bg-white p-1 text-black hover:bg-gray-100 transition-colors duration-150"
                              onClick={(mouseEvent) => {
                                mouseEvent.stopPropagation();
                                resetCreateDialog({ date: event.date, startHour: event.startHour });
                              }}
                              aria-label={`在 ${event.title} 同时段新增行程`}
                            >
                              <Plus className="h-3 w-3" />
                            </button>

                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 日记区域 */}
              <div className="border-t border-gray-200 mt-6 bg-gray-50">
                <div className="grid grid-cols-[88px_repeat(auto-fit,minmax(120px,1fr))]">
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
                {displayDates.map((day, index) => {
                  const dayIso = format(day, "yyyy-MM-dd");
                  const dayEvents = allEvents.filter((event) => event.date === dayIso);
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
                            className={`text-xs p-1 rounded ${getCategoryColor(categories, event.category)} truncate`}
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
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium text-gray-700">循环事件</Label>
                      <Switch
                        checked={createForm.recurrence}
                        onCheckedChange={(checked) =>
                          setCreateForm((prev) => ({ ...prev, recurrence: checked }))
                        }
                      />
                    </div>
                    {createForm.recurrence && (
                      <div className="space-y-4 border border-gray-200 rounded-lg p-4">
                        <div className="space-y-3">
                          <Label className="text-sm font-medium text-gray-700">循环类型</Label>
                          <Select
                            value={createForm.recurrenceType}
                            onValueChange={(value) =>
                              setCreateForm((prev) => ({ ...prev, recurrenceType: value as "daily" | "weekly" | "monthly" }))
                            }
                          >
                            <SelectTrigger className="rounded-md border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150">
                              <SelectValue placeholder="选择循环类型" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="daily">每天</SelectItem>
                              <SelectItem value="weekly">每周</SelectItem>
                              <SelectItem value="monthly">每月</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-3">
                          <Label className="text-sm font-medium text-gray-700">循环间隔</Label>
                          <Input
                            type="number"
                            min="1"
                            value={createForm.interval}
                            onChange={(event) =>
                              setCreateForm((prev) => ({ ...prev, interval: Number(event.target.value) || 1 }))
                            }
                            className="rounded-md border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150"
                          />
                        </div>
                        {createForm.recurrenceType === "weekly" && (
                          <div className="space-y-3">
                            <Label className="text-sm font-medium text-gray-700">星期几</Label>
                            <div className="grid grid-cols-7 gap-2">
                              {["日", "一", "二", "三", "四", "五", "六"].map((day, index) => (
                                <button
                                  key={index}
                                  type="button"
                                  className={`rounded-md py-2 text-center text-sm ${createForm.weekdays.includes(index) ? "bg-primary text-white" : "border border-gray-300 hover:bg-gray-50"}`}
                                  onClick={() => {
                                    const newWeekdays = createForm.weekdays.includes(index)
                                      ? createForm.weekdays.filter((d) => d !== index)
                                      : [...createForm.weekdays, index];
                                    setCreateForm((prev) => ({ ...prev, weekdays: newWeekdays }));
                                  }}
                                >
                                  {day}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="space-y-3">
                          <Label className="text-sm font-medium text-gray-700">循环结束</Label>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Input
                                type="date"
                                value={createForm.endDate}
                                onChange={(event) =>
                                  setCreateForm((prev) => ({ ...prev, endDate: event.target.value }))
                                }
                                className="rounded-md border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150"
                              />
                              <span className="text-sm text-gray-600">结束日期</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min="0"
                                value={createForm.endCount}
                                onChange={(event) =>
                                  setCreateForm((prev) => ({ ...prev, endCount: Number(event.target.value) || 0 }))
                                }
                                className="rounded-md border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150"
                              />
                              <span className="text-sm text-gray-600">结束次数（0表示无限制）</span>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <Label className="text-sm font-medium text-gray-700">例外日期（每行一个日期，格式：YYYY-MM-DD）</Label>
                          <Textarea
                            value={createForm.exceptionDates}
                            onChange={(event) =>
                              setCreateForm((prev) => ({ ...prev, exceptionDates: event.target.value }))
                            }
                            placeholder="例如：\n2026-04-15\n2026-04-22"
                            className="rounded-md border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150"
                          />
                        </div>
                      </div>
                    )}
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
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium text-gray-700">循环事件</Label>
                      <Switch
                        checked={editForm.recurrence}
                        onCheckedChange={(checked) =>
                          setEditForm((prev) => ({ ...prev, recurrence: checked }))
                        }
                      />
                    </div>
                    {editForm.recurrence && (
                      <div className="space-y-4 border border-gray-200 rounded-lg p-4">
                        <div className="space-y-3">
                          <Label className="text-sm font-medium text-gray-700">循环类型</Label>
                          <Select
                            value={editForm.recurrenceType}
                            onValueChange={(value) =>
                              setEditForm((prev) => ({ ...prev, recurrenceType: value as "daily" | "weekly" | "monthly" }))
                            }
                          >
                            <SelectTrigger className="rounded-md border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150">
                              <SelectValue placeholder="选择循环类型" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="daily">每天</SelectItem>
                              <SelectItem value="weekly">每周</SelectItem>
                              <SelectItem value="monthly">每月</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-3">
                          <Label className="text-sm font-medium text-gray-700">循环间隔</Label>
                          <Input
                            type="number"
                            min="1"
                            value={editForm.interval}
                            onChange={(event) =>
                              setEditForm((prev) => ({ ...prev, interval: Number(event.target.value) || 1 }))
                            }
                            className="rounded-md border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150"
                          />
                        </div>
                        {editForm.recurrenceType === "weekly" && (
                          <div className="space-y-3">
                            <Label className="text-sm font-medium text-gray-700">星期几</Label>
                            <div className="grid grid-cols-7 gap-2">
                              {["日", "一", "二", "三", "四", "五", "六"].map((day, index) => (
                                <button
                                  key={index}
                                  type="button"
                                  className={`rounded-md py-2 text-center text-sm ${editForm.weekdays.includes(index) ? "bg-primary text-white" : "border border-gray-300 hover:bg-gray-50"}`}
                                  onClick={() => {
                                    const newWeekdays = editForm.weekdays.includes(index)
                                      ? editForm.weekdays.filter((d) => d !== index)
                                      : [...editForm.weekdays, index];
                                    setEditForm((prev) => ({ ...prev, weekdays: newWeekdays }));
                                  }}
                                >
                                  {day}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="space-y-3">
                          <Label className="text-sm font-medium text-gray-700">循环结束</Label>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Input
                                type="date"
                                value={editForm.endDate}
                                onChange={(event) =>
                                  setEditForm((prev) => ({ ...prev, endDate: event.target.value }))
                                }
                                className="rounded-md border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150"
                              />
                              <span className="text-sm text-gray-600">结束日期</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min="0"
                                value={editForm.endCount}
                                onChange={(event) =>
                                  setEditForm((prev) => ({ ...prev, endCount: Number(event.target.value) || 0 }))
                                }
                                className="rounded-md border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150"
                              />
                              <span className="text-sm text-gray-600">结束次数（0表示无限制）</span>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <Label className="text-sm font-medium text-gray-700">例外日期（每行一个日期，格式：YYYY-MM-DD）</Label>
                          <Textarea
                            value={editForm.exceptionDates}
                            onChange={(event) =>
                              setEditForm((prev) => ({ ...prev, exceptionDates: event.target.value }))
                            }
                            placeholder="例如：\n2026-04-15\n2026-04-22"
                            className="rounded-md border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150"
                          />
                        </div>
                      </div>
                    )}
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
                  <div className="flex space-x-4">
                    <Button
                      onClick={() => {
                        handleDeleteEventClick(selectedEvent.id);
                        setEditingEventId(null);
                      }}
                      className="flex-1 rounded-md bg-red-600 text-white hover:bg-red-700 transition-all duration-150 py-2"
                    >
                      删除行程
                    </Button>
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

          {/* 删除循环事件对话框 */}
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogContent className="rounded-lg border-gray-200 shadow-lg">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-gray-900">删除行程</DialogTitle>
              </DialogHeader>
              <div className="space-y-5 mt-4">
                <p className="text-sm text-gray-600">请选择删除方式：</p>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      id="delete-only"
                      name="delete-option"
                      value="only"
                      checked={deleteOption === 'only'}
                      onChange={() => setDeleteOption('only')}
                    />
                    <label htmlFor="delete-only" className="text-sm text-gray-700">只删除当前实例</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      id="delete-all-future"
                      name="delete-option"
                      value="all-future"
                      checked={deleteOption === 'all-future'}
                      onChange={() => setDeleteOption('all-future')}
                    />
                    <label htmlFor="delete-all-future" className="text-sm text-gray-700">删除当前及未来的循环事件</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      id="delete-all"
                      name="delete-option"
                      value="all"
                      checked={deleteOption === 'all'}
                      onChange={() => setDeleteOption('all')}
                    />
                    <label htmlFor="delete-all" className="text-sm text-gray-700">删除整个循环系列</label>
                  </div>
                </div>
                <div className="flex space-x-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 rounded-md border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150 py-2"
                    onClick={() => setDeleteDialogOpen(false)}
                  >
                    取消
                  </Button>
                  <Button
                    type="button"
                    className="flex-1 rounded-md bg-red-600 text-white hover:bg-red-700 transition-all duration-150 py-2"
                    onClick={handleConfirmDelete}
                  >
                    确认删除
                  </Button>
                </div>
              </div>
            </DialogContent>
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
