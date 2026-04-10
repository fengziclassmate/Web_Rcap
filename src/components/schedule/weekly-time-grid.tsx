"use client";

import React, { useEffect, useMemo, useState } from "react";
import { addDays, addWeeks, addMonths, addYears, format, isAfter, isBefore, isSameDay, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Clock3, Plus, Smile, Frown, Meh, Angry, Heart, Check, Star, AlertTriangle, AlertCircle, Trash2 } from "lucide-react";
import type { ScheduleEvent, EventTag, RecurrenceType, RecurrenceEndType } from "@/app/page";
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
  recurrence: {
    type: RecurrenceType;
    interval: number;
    endType: RecurrenceEndType;
    endDate?: string;
    endCount?: number;
    exceptions: string[];
    daysOfWeek?: number[];
  };
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
  recurrence: {
    type: 'none',
    interval: 1,
    endType: 'never',
    exceptions: [],
    daysOfWeek: []
  },
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
  timeGranularity = 30,
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
    () => {
      if (!editingEventId) return null;
      // 检查是否是重复事件的实例
      const isInstance = editingEventId.includes('-');
      const eventId = isInstance ? editingEventId.split('-')[0] : editingEventId;
      return events.find((event) => event.id === eventId) ?? null;
    },
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
      recurrence: {
        type: 'none',
        interval: 1,
        endType: 'never',
        exceptions: [],
        daysOfWeek: []
      },
    });
    setCreateDialogOpen(true);
  }

  // 状态管理
  const [editMode, setEditMode] = useState<'single' | 'all' | null>(null);
  const [deleteMode, setDeleteMode] = useState<'single' | 'all' | null>(null);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [selectedEventInstance, setSelectedEventInstance] = useState<ScheduleEvent | null>(null);
  const [showEditModeDialog, setShowEditModeDialog] = useState(false);
  const [showDeleteModeDialog, setShowDeleteModeDialog] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  function handleOpenEdit(event: ScheduleEvent) {
    // 检查是否是重复事件的实例
    const isInstance = event.id.includes('-');
    const originalEventId = event.id.split('-')[0];
    const originalEvent = events.find(e => e.id === originalEventId) || event;
    
    if (isInstance && originalEvent.recurrence.type !== 'none') {
      // 显示编辑模式选择对话框
      setSelectedInstanceId(event.id);
      setSelectedEventInstance(event);
      setShowEditModeDialog(true);
    } else {
      // 直接编辑（非重复事件或原始重复事件）
      setEditingEventId(originalEvent.id);
      setSelectedEventInstance(originalEvent);
      setEditForm({
        title: originalEvent.title,
        startHour: originalEvent.startHour,
        endHour: originalEvent.endHour,
        notes: originalEvent.notes,
        requirements: Array.isArray(originalEvent.requirements) ? originalEvent.requirements.join("\n") : originalEvent.requirements,
        isCompleted: originalEvent.isCompleted,
        category: originalEvent.category,
        tag: originalEvent.tag,
        recurrence: originalEvent.recurrence,
      });
      setEditDialogOpen(true);
    }
  }

  function handleEditModeSelect(mode: 'single' | 'all') {
    if (selectedInstanceId && selectedEventInstance) {
      const originalEventId = selectedInstanceId.split('-')[0];
      const originalEvent = events.find(e => e.id === originalEventId) || selectedEventInstance;
      
      setEditMode(mode);
      setEditingEventId(originalEventId);
      setEditForm({
        title: originalEvent.title,
        startHour: originalEvent.startHour,
        endHour: originalEvent.endHour,
        notes: originalEvent.notes,
        requirements: Array.isArray(originalEvent.requirements) ? originalEvent.requirements.join("\n") : originalEvent.requirements,
        isCompleted: originalEvent.isCompleted,
        category: originalEvent.category,
        tag: originalEvent.tag,
        recurrence: originalEvent.recurrence,
      });
      setEditDialogOpen(true);
    }
    setShowEditModeDialog(false);
  }

  function handleDeleteModeSelect(mode: 'single' | 'all') {
    if (selectedInstanceId) {
      const originalEventId = selectedInstanceId.split('-')[0];
      
      if (mode === 'single') {
        // 删除单个实例：将该实例从重复事件中排除
        const instanceDate = selectedInstanceId.split('-')[1];
        const originalEvent = events.find(e => e.id === originalEventId);
        
        if (originalEvent) {
          const updatedRecurrence = {
            ...originalEvent.recurrence,
            exceptions: [...(originalEvent.recurrence.exceptions || []), instanceDate]
          };
          onUpdateEvent(originalEventId, {
            recurrence: updatedRecurrence
          });
        }
      } else {
        // 删除所有实例：直接删除原始事件
        onDeleteEvent(originalEventId);
      }
    }
    
    setShowDeleteModeDialog(false);
    setEditingEventId(null);
    setDeleteMode(null);
    setSelectedInstanceId(null);
    setSelectedEventInstance(null);
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
      recurrence: createForm.recurrence,
    });
    setCreateDialogOpen(false);
  }

  function handleSaveEdit() {
    if (!editingEventId || !editForm.title.trim()) return;
    const startHour = Math.max(0, Math.min(23.5, editForm.startHour));
    const endHour = Math.max(startHour + 0.5, Math.min(24, editForm.endHour));

    if (editMode === 'single' && selectedInstanceId) {
      // 编辑单个实例：将该实例从重复事件中排除，然后创建一个新的非重复事件
      const originalEventId = selectedInstanceId.split('-')[0];
      const instanceDate = selectedInstanceId.split('-')[1];
      
      // 1. 查找原始事件
      const originalEvent = events.find(e => e.id === originalEventId);
      if (originalEvent) {
        // 更新原始事件，添加例外日期
        const updatedRecurrence = {
          ...originalEvent.recurrence,
          exceptions: [...(originalEvent.recurrence.exceptions || []), instanceDate]
        };
        onUpdateEvent(originalEventId, {
          recurrence: updatedRecurrence
        });
      }

      // 2. 创建一个新的非重复事件
      onCreateEvent({
        id: createId("event"),
        date: instanceDate,
        startHour,
        endHour,
        title: editForm.title.trim(),
        notes: editForm.notes.trim(),
        requirements: typeof editForm.requirements === 'string' ? editForm.requirements
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean) : editForm.requirements,
        isCompleted: editForm.isCompleted,
        category: editForm.category,
        tag: editForm.tag,
        recurrence: {
          type: 'none',
          interval: 1,
          endType: 'never',
          exceptions: [],
          daysOfWeek: []
        }
      });
    } else {
      // 编辑所有实例：直接更新原始事件
      const eventId = editingEventId.includes('-') ? editingEventId.split('-')[0] : editingEventId;
      if (eventId) {
        onUpdateEvent(eventId, {
          title: editForm.title.trim(),
          startHour,
          endHour,
          notes: editForm.notes.trim(),
          requirements: typeof editForm.requirements === 'string' ? editForm.requirements
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean) : editForm.requirements,
          isCompleted: editForm.isCompleted,
          category: editForm.category,
          tag: editForm.tag,
          recurrence: editForm.recurrence,
        });
      }
    }

    setEditDialogOpen(false);
    setEditingEventId(null);
    setEditMode(null);
    setSelectedInstanceId(null);
    setSelectedEventInstance(null);
  }

  function handleDropEvent(targetDate: string, targetHour: number) {
    if (!draggingEventId) return;
    
    // 对于重复事件的实例，使用原始事件的ID
    const originalEventId = draggingEventId.split('-')[0];
    const draggingEvent = events.find((event) => event.id === originalEventId);
    
    if (!draggingEvent) return;
    const duration = Math.max(0.0167, draggingEvent.endHour - draggingEvent.startHour);
    const nextStartHour = Math.min(23.9833, targetHour);
    const nextEndHour = Math.min(24, nextStartHour + duration);

    // 检查是否是重复事件的实例
    if (draggingEventId !== originalEventId) {
      // 拖拽的是重复事件实例：将该实例从重复事件中排除，然后创建一个新的非重复事件
      const instanceDate = draggingEventId.split('-')[1];
      
      // 1. 更新原始事件，添加例外日期
      const updatedRecurrence = {
        ...draggingEvent.recurrence,
        exceptions: [...(draggingEvent.recurrence.exceptions || []), instanceDate]
      };
      onUpdateEvent(originalEventId, {
        recurrence: updatedRecurrence
      });

      // 2. 创建一个新的非重复事件
      onCreateEvent({
        id: createId("event"),
        date: targetDate,
        startHour: nextStartHour,
        endHour: nextEndHour,
        title: draggingEvent.title,
        notes: draggingEvent.notes,
        requirements: draggingEvent.requirements,
        isCompleted: draggingEvent.isCompleted,
        category: draggingEvent.category,
        tag: draggingEvent.tag,
        recurrence: {
          type: 'none',
          interval: 1,
          endType: 'never',
          exceptions: [],
          daysOfWeek: []
        }
      });
    } else {
      // 拖拽的是原始事件：直接更新
      onUpdateEvent(originalEventId, {
        date: targetDate,
        startHour: nextStartHour,
        endHour: nextEndHour,
      });
    }
    
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
    // 对于重复事件的实例，使用原始事件的ID
    const originalEventId = eventId.split('-')[0];
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      eventId: originalEventId,
    });
  }

  function closeContextMenu() {
    setContextMenu(null);
  }

  function handleReschedule(eventId: string) {
    // 对于重复事件的实例，使用原始事件的ID
    const originalEventId = eventId.split('-')[0];
    const event = events.find(e => e.id === originalEventId);
    if (event) {
      handleOpenEdit(event);
    }
    closeContextMenu();
  }

  function handleExtendTime(eventId: string) {
    // 对于重复事件的实例，使用原始事件的ID
    const originalEventId = eventId.split('-')[0];
    const event = events.find(e => e.id === originalEventId);
    if (event) {
      onUpdateEvent(originalEventId, {
        endHour: event.endHour + 1,
      });
    }
    closeContextMenu();
  }

  function handleSetTag(eventId: string, tag: EventTag) {
    // 对于重复事件的实例，使用原始事件的ID
    const originalEventId = eventId.split('-')[0];
    // 直接调用 onUpdateEvent，不需要检查原始事件是否存在
    onUpdateEvent(originalEventId, { tag });
    closeContextMenu();
  }

  function handleToggleComplete(eventId: string) {
    // 对于重复事件的实例，使用原始事件的ID
    const originalEventId = eventId.split('-')[0];
    const event = events.find(e => e.id === originalEventId);
    if (event) {
      onUpdateEvent(originalEventId, {
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

  // 计算重复事件的所有实例
  const getRecurrenceInstances = (event: ScheduleEvent, startDate: Date, endDate: Date): ScheduleEvent[] => {
    if (event.recurrence.type === 'none') {
      // 非重复事件，只在原始日期返回
      const eventDate = parseISO(event.date);
      if (isSameDay(eventDate, startDate)) {
        return [event];
      } else {
        return [];
      }
    }

    const instances: ScheduleEvent[] = [];
    const eventDate = parseISO(event.date);
    
    // 对于每周重复的事件，需要特殊处理
    if (event.recurrence.type === 'weekly') {
      // 检查当前日期是否是重复日期
      const dayOfWeek = startDate.getDay(); // 0-6，0表示周日
      
      // 检查是否设置了重复日期
      if (event.recurrence.daysOfWeek && event.recurrence.daysOfWeek.length > 0) {
        // 检查当前日期是否在重复日期列表中
        if (event.recurrence.daysOfWeek.includes(dayOfWeek)) {
          // 检查是否是例外日期
          const currentDateStr = format(startDate, 'yyyy-MM-dd');
          if (!event.recurrence.exceptions.includes(currentDateStr)) {
            // 检查是否达到结束条件
            let shouldAdd = true;
            
            // 检查是否在结束日期之前
            if (event.recurrence.endType === 'on' && event.recurrence.endDate) {
              const endDateObj = parseISO(event.recurrence.endDate);
              if (isAfter(startDate, endDateObj)) {
                shouldAdd = false;
              }
            }
            
            if (shouldAdd) {
              instances.push({
                ...event,
                id: `${event.id}-${currentDateStr}`,
                date: currentDateStr
              });
            }
          }
        }
      } else {
        // 对于没有设置 daysOfWeek 的现有事件，保持原有行为
        // 只在与原始事件相同的星期几添加
        const originalDayOfWeek = eventDate.getDay();
        if (originalDayOfWeek === dayOfWeek) {
          // 检查是否是例外日期
          const currentDateStr = format(startDate, 'yyyy-MM-dd');
          if (!event.recurrence.exceptions.includes(currentDateStr)) {
            // 检查是否达到结束条件
            let shouldAdd = true;
            
            // 检查是否在结束日期之前
            if (event.recurrence.endType === 'on' && event.recurrence.endDate) {
              const endDateObj = parseISO(event.recurrence.endDate);
              if (isAfter(startDate, endDateObj)) {
                shouldAdd = false;
              }
            }
            
            if (shouldAdd) {
              instances.push({
                ...event,
                id: `${event.id}-${currentDateStr}`,
                date: currentDateStr
              });
            }
          }
        }
      }
    } else {
      // 其他类型的重复事件
      let currentDate = eventDate;
      let count = 0;

      while (true) {
        // 检查当前日期是否在范围内
        if (isAfter(currentDate, endDate)) {
          break;
        }

        let shouldAdd = false;

        // 检查当前日期是否在范围内
        if (isBefore(currentDate, startDate)) {
          // 日期在范围之前，跳过
        } else {
          // 检查是否是例外日期
          const currentDateStr = format(currentDate, 'yyyy-MM-dd');
          if (!event.recurrence.exceptions.includes(currentDateStr)) {
            // 检查是否是原始事件日期或符合重复规则的日期
            
            if (isSameDay(currentDate, eventDate)) {
              // 原始事件日期，总是添加
              shouldAdd = true;
            } else if (count > 0) {
              // 对于重复事件，直接添加
              shouldAdd = true;
            }
            
            if (shouldAdd) {
              instances.push({
                ...event,
                id: `${event.id}-${currentDateStr}`,
                date: currentDateStr
              });
            }
          }
        }

        // 只在添加事件实例时增加计数
        if (shouldAdd) {
          count++;
        }

        // 检查是否达到结束条件
        if (event.recurrence.endType === 'after' && count >= (event.recurrence.endCount || 0)) {
          break;
        }

        if (event.recurrence.endType === 'on' && event.recurrence.endDate) {
          const endDateObj = parseISO(event.recurrence.endDate);
          if (isAfter(currentDate, endDateObj)) {
            break;
          }
        }

        // 计算下一个重复日期
        switch (event.recurrence.type) {
          case 'daily':
            currentDate = addDays(currentDate, event.recurrence.interval);
            break;
          case 'monthly':
            currentDate = addMonths(currentDate, event.recurrence.interval);
            break;
          case 'yearly':
            currentDate = addYears(currentDate, event.recurrence.interval);
            break;
          default:
            break;
        }
      }
    }

    return instances;
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
                  
                  // 计算该日期的所有事件（包括重复事件的实例）
                  const allDayEvents: ScheduleEvent[] = [];
                  events.forEach(event => {
                    const instances = getRecurrenceInstances(event, day, day);
                    allDayEvents.push(...instances);
                  });
                  
                  const dayEvents = layoutDayEvents(allDayEvents);

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
                                  {event.recurrence.type !== 'none' && (
                                    <span className="text-xs text-gray-500 tooltip" title="重复事件">🔄</span>
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
                  
                  // 计算该日期的所有事件（包括重复事件的实例）
                  const allDayEvents: ScheduleEvent[] = [];
                  events.forEach(event => {
                    const instances = getRecurrenceInstances(event, day, day);
                    allDayEvents.push(...instances);
                  });
                  
                  const dayEvents = allDayEvents;
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
                            <div className="flex items-center gap-1">
                              {event.recurrence.type !== 'none' && (
                                <span className="text-xs">🔄</span>
                              )}
                              {event.title}
                            </div>
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
                    <Label className="text-sm font-medium text-gray-700">重复设置</Label>
                    <Select
                      value={createForm.recurrence.type}
                      onValueChange={(value) => setCreateForm((prev) => ({
                        ...prev,
                        recurrence: {
                          ...prev.recurrence,
                          type: value as RecurrenceType
                        }
                      }))}
                    >
                      <SelectTrigger className="rounded-md border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150">
                        <SelectValue placeholder="选择重复类型" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">不重复</SelectItem>
                        <SelectItem value="daily">每天</SelectItem>
                        <SelectItem value="weekly">每周</SelectItem>
                        <SelectItem value="monthly">每月</SelectItem>
                        <SelectItem value="yearly">每年</SelectItem>
                      </SelectContent>
                    </Select>
                    {createForm.recurrence.type !== 'none' && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <Label className="text-sm font-medium text-gray-700">重复间隔</Label>
                          <Input
                            type="number"
                            min="1"
                            value={createForm.recurrence.interval}
                            onChange={(event) => setCreateForm((prev) => ({
                              ...prev,
                              recurrence: {
                                ...prev.recurrence,
                                interval: Number(event.target.value) || 1
                              }
                            }))}
                            className="w-20 rounded-md border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150"
                          />
                          <span className="text-sm text-gray-600">
                            {createForm.recurrence.type === 'daily' ? '天' :
                             createForm.recurrence.type === 'weekly' ? '周' :
                             createForm.recurrence.type === 'monthly' ? '月' : '年'}
                          </span>
                        </div>
                        {createForm.recurrence.type === 'weekly' && (
                          <div className="space-y-3">
                            <Label className="text-sm font-medium text-gray-700">重复日期</Label>
                            <div className="flex flex-wrap gap-2">
                              {['周日', '周一', '周二', '周三', '周四', '周五', '周六'].map((day, index) => (
                                <Button
                                  key={index}
                                  type="button"
                                  variant={createForm.recurrence.daysOfWeek?.includes(index) ? 'default' : 'outline'}
                                  className={`rounded-md ${createForm.recurrence.daysOfWeek?.includes(index) ? 'bg-primary text-white' : 'border-gray-300'}`}
                                  onClick={() => {
                                    const currentDays = createForm.recurrence.daysOfWeek || [];
                                    let newDays;
                                    if (currentDays.includes(index)) {
                                      newDays = currentDays.filter(d => d !== index);
                                    } else {
                                      newDays = [...currentDays, index];
                                    }
                                    setCreateForm((prev) => ({
                                      ...prev,
                                      recurrence: {
                                        ...prev.recurrence,
                                        daysOfWeek: newDays
                                      }
                                    }));
                                  }}
                                >
                                  {day}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="space-y-3">
                          <Label className="text-sm font-medium text-gray-700">结束方式</Label>
                          <Select
                            value={createForm.recurrence.endType}
                            onValueChange={(value) => setCreateForm((prev) => ({
                              ...prev,
                              recurrence: {
                                ...prev.recurrence,
                                endType: value as RecurrenceEndType
                              }
                            }))}
                          >
                            <SelectTrigger className="rounded-md border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150">
                              <SelectValue placeholder="选择结束方式" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="never">永不结束</SelectItem>
                              <SelectItem value="on">在特定日期结束</SelectItem>
                              <SelectItem value="after">重复特定次数后结束</SelectItem>
                            </SelectContent>
                          </Select>
                          {createForm.recurrence.endType === 'on' && (
                            <Input
                              type="date"
                              value={createForm.recurrence.endDate || ''}
                              onChange={(event) => setCreateForm((prev) => ({
                                ...prev,
                                recurrence: {
                                  ...prev.recurrence,
                                  endDate: event.target.value
                                }
                              }))}
                              className="rounded-md border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150"
                            />
                          )}
                          {createForm.recurrence.endType === 'after' && (
                            <Input
                              type="number"
                              min="1"
                              value={createForm.recurrence.endCount || 1}
                              onChange={(event) => setCreateForm((prev) => ({
                                ...prev,
                                recurrence: {
                                  ...prev.recurrence,
                                  endCount: Number(event.target.value) || 1
                                }
                              }))}
                              className="w-20 rounded-md border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150"
                            />
                          )}
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

          <Dialog open={editDialogOpen} onOpenChange={(open) => {
            if (!open) {
              setEditDialogOpen(false);
              setEditingEventId(null);
            }
          }}>
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
                    <Label className="text-sm font-medium text-gray-700">重复设置</Label>
                    <Select
                      value={editForm.recurrence.type}
                      onValueChange={(value) => setEditForm((prev) => ({
                        ...prev,
                        recurrence: {
                          ...prev.recurrence,
                          type: value as RecurrenceType
                        }
                      }))}
                    >
                      <SelectTrigger className="rounded-md border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150">
                        <SelectValue placeholder="选择重复类型" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">不重复</SelectItem>
                        <SelectItem value="daily">每天</SelectItem>
                        <SelectItem value="weekly">每周</SelectItem>
                        <SelectItem value="monthly">每月</SelectItem>
                        <SelectItem value="yearly">每年</SelectItem>
                      </SelectContent>
                    </Select>
                    {editForm.recurrence.type !== 'none' && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <Label className="text-sm font-medium text-gray-700">重复间隔</Label>
                          <Input
                            type="number"
                            min="1"
                            value={editForm.recurrence.interval}
                            onChange={(event) => setEditForm((prev) => ({
                              ...prev,
                              recurrence: {
                                ...prev.recurrence,
                                interval: Number(event.target.value) || 1
                              }
                            }))}
                            className="w-20 rounded-md border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150"
                          />
                          <span className="text-sm text-gray-600">
                            {editForm.recurrence.type === 'daily' ? '天' :
                             editForm.recurrence.type === 'weekly' ? '周' :
                             editForm.recurrence.type === 'monthly' ? '月' : '年'}
                          </span>
                        </div>
                        {editForm.recurrence.type === 'weekly' && (
                          <div className="space-y-3">
                            <Label className="text-sm font-medium text-gray-700">重复日期</Label>
                            <div className="flex flex-wrap gap-2">
                              {['周日', '周一', '周二', '周三', '周四', '周五', '周六'].map((day, index) => (
                                <Button
                                  key={index}
                                  type="button"
                                  variant={editForm.recurrence.daysOfWeek?.includes(index) ? 'default' : 'outline'}
                                  className={`rounded-md ${editForm.recurrence.daysOfWeek?.includes(index) ? 'bg-primary text-white' : 'border-gray-300'}`}
                                  onClick={() => {
                                    const currentDays = editForm.recurrence.daysOfWeek || [];
                                    let newDays;
                                    if (currentDays.includes(index)) {
                                      newDays = currentDays.filter(d => d !== index);
                                    } else {
                                      newDays = [...currentDays, index];
                                    }
                                    setEditForm((prev) => ({
                                      ...prev,
                                      recurrence: {
                                        ...prev.recurrence,
                                        daysOfWeek: newDays
                                      }
                                    }));
                                  }}
                                >
                                  {day}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="space-y-3">
                          <Label className="text-sm font-medium text-gray-700">结束方式</Label>
                          <Select
                            value={editForm.recurrence.endType}
                            onValueChange={(value) => setEditForm((prev) => ({
                              ...prev,
                              recurrence: {
                                ...prev.recurrence,
                                endType: value as RecurrenceEndType
                              }
                            }))}
                          >
                            <SelectTrigger className="rounded-md border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150">
                              <SelectValue placeholder="选择结束方式" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="never">永不结束</SelectItem>
                              <SelectItem value="on">在特定日期结束</SelectItem>
                              <SelectItem value="after">重复特定次数后结束</SelectItem>
                            </SelectContent>
                          </Select>
                          {editForm.recurrence.endType === 'on' && (
                            <Input
                              type="date"
                              value={editForm.recurrence.endDate || ''}
                              onChange={(event) => setEditForm((prev) => ({
                                ...prev,
                                recurrence: {
                                  ...prev.recurrence,
                                  endDate: event.target.value
                                }
                              }))}
                              className="rounded-md border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150"
                            />
                          )}
                          {editForm.recurrence.endType === 'after' && (
                            <Input
                              type="number"
                              min="1"
                              value={editForm.recurrence.endCount || 1}
                              onChange={(event) => setEditForm((prev) => ({
                                ...prev,
                                recurrence: {
                                  ...prev.recurrence,
                                  endCount: Number(event.target.value) || 1
                                }
                              }))}
                              className="w-20 rounded-md border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150"
                            />
                          )}
                        </div>
                        <div className="space-y-3">
                          <Label className="text-sm font-medium text-gray-700">例外日期</Label>
                          <Textarea
                            value={editForm.recurrence.exceptions.join('\n')}
                            onChange={(event) => setEditForm((prev) => ({
                              ...prev,
                              recurrence: {
                                ...prev.recurrence,
                                exceptions: event.target.value.split('\n').filter(Boolean)
                              }
                            }))}
                            placeholder="每行输入一个例外日期，格式：YYYY-MM-DD"
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
                        // 检查是否是重复事件
                        if (editForm.recurrence.type !== 'none' && selectedInstanceId) {
                          // 显示删除模式选择对话框
                          setShowDeleteModeDialog(true);
                        } else {
                          // 直接删除（非重复事件或原始重复事件）
                          const eventId = editingEventId?.includes('-') ? editingEventId.split('-')[0] : editingEventId;
                          if (eventId) {
                            onDeleteEvent(eventId);
                            setEditDialogOpen(false);
                            setEditingEventId(null);
                          }
                        }
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
          </Dialog>

          {/* 编辑模式选择对话框 */}
          <Dialog open={showEditModeDialog} onOpenChange={setShowEditModeDialog}>
            <DialogContent className="rounded-lg border-gray-200 shadow-lg">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-gray-900">编辑重复事件</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <p className="text-sm text-gray-600">您想如何编辑这个重复事件？</p>
                <div className="space-y-3">
                  <Button
                    onClick={() => handleEditModeSelect('single')}
                    className="w-full rounded-md border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 transition-all duration-150 py-2"
                  >
                    仅编辑当前实例
                  </Button>
                  <Button
                    onClick={() => handleEditModeSelect('all')}
                    className="w-full rounded-md bg-primary text-white hover:bg-primary/90 transition-all duration-150 py-2"
                  >
                    编辑所有重复实例
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* 删除模式选择对话框 */}
          <Dialog open={showDeleteModeDialog} onOpenChange={setShowDeleteModeDialog}>
            <DialogContent className="rounded-lg border-gray-200 shadow-lg">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-gray-900">删除重复事件</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <p className="text-sm text-gray-600">您想如何删除这个重复事件？</p>
                <div className="space-y-3">
                  <Button
                    onClick={() => handleDeleteModeSelect('single')}
                    className="w-full rounded-md border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 transition-all duration-150 py-2"
                  >
                    仅删除当前实例
                  </Button>
                  <Button
                    onClick={() => handleDeleteModeSelect('all')}
                    className="w-full rounded-md bg-red-600 text-white hover:bg-red-700 transition-all duration-150 py-2"
                  >
                    删除所有重复实例
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
              {(() => {
                const eventId = contextMenu.eventId.includes('-') ? contextMenu.eventId.split('-')[0] : contextMenu.eventId;
                const event = events.find(e => e.id === eventId);
                return event?.isCompleted ? "标记为未完成" : "标记为已完成";
              })()}
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
