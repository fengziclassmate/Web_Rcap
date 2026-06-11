"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { addDays, format, parse } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Palette,
  Pencil,
  Plus,
  Repeat,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { EventTag, ScheduleEvent } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  layoutOverlappingScheduleEvents,
  type PositionedScheduleEvent,
} from "@/lib/schedule-layout";
import {
  CATEGORY_VISUALS,
  DEFAULT_SCHEDULE_CATEGORY,
  UNCATEGORIZED_SCHEDULE_CATEGORY,
  createCategoryId,
  getCategoryVisualByClass,
  getCategoryVisualByName,
  getScheduleCategoryAccentColor,
  getScheduleCategoryColor,
  isBuiltInCategory,
  isCategoryNameTaken,
  loadCategoryDefs,
  normalizeScheduleCategory,
  saveCategoryDefs,
} from "@/lib/categories";
import type { ScheduleCategoryDef, ScheduleCategoryVisual } from "@/lib/categories";
import {
  expandScheduleEvents,
  parseExceptionDateList,
  parseSyntheticEventId,
  WEEKDAY_SHORT_LABEL,
  WEEKDAY_UI_ORDER,
} from "@/lib/recurrence";

type Category = {
  id: string;
  name: string;
  color: string;
};

type GridCell = {
  date: string;
  startHour: number;
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

type CategoryPalette = {
  name: string;
  color: string;
};

type ResizeState = {
  eventId: string;
  startY: number;
  initialHour: number;
  startHour: number;
  endHour: number;
  direction: "start" | "end";
};

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

type ContextMenuState = {
  x: number;
  y: number;
  eventId: string;
};

type TimelineDayLayout = {
  date: Date;
  dateIso: string;
  events: PositionedScheduleEvent[];
  laneCount: number;
};

export type ViewMode = "day" | "week" | "month";
export type TimeGranularity = 5 | 15 | 30 | 60;

const hourCellHeight = 80;
const contextMenuWidth = 208;
const contextMenuHeight = 360;
const contextMenuViewportPadding = 12;
const recurrenceEditScopeStorageKey = "recurrence-edit-scope";

const defaultCategoryPalette: CategoryPalette[] = [
  { name: "深度科研", color: "bg-sky-50 border-sky-200 text-sky-950" },
  { name: "实验数据", color: "bg-teal-50 border-teal-200 text-teal-950" },
  { name: "论文写作", color: "bg-indigo-50 border-indigo-200 text-indigo-950" },
  { name: "文献阅读", color: "bg-cyan-50 border-cyan-200 text-cyan-950" },
  { name: "课程学习", color: "bg-violet-50 border-violet-200 text-violet-950" },
  { name: "会议沟通", color: "bg-amber-50 border-amber-200 text-amber-950" },
  { name: "任务推进", color: "bg-emerald-50 border-emerald-200 text-emerald-950" },
  { name: "行政事务", color: "bg-stone-50 border-stone-200 text-stone-900" },
  { name: "生活事务", color: "bg-rose-50 border-rose-200 text-rose-950" },
  { name: "健康运动", color: "bg-orange-50 border-orange-200 text-orange-950" },
  { name: "通勤外出", color: "bg-lime-50 border-lime-200 text-lime-950" },
  { name: "情绪复盘", color: "bg-fuchsia-50 border-fuchsia-200 text-fuchsia-950" },
  { name: "休息恢复", color: "bg-slate-100 border-slate-200 text-slate-900" },
  { name: "弹性缓冲", color: "bg-zinc-50 border-zinc-200 text-zinc-900" },
];

const selectableColors = CATEGORY_VISUALS.map((item) => item.twClass);

const defaultCategories: Category[] = CATEGORY_VISUALS.map((item, index) => ({
  id: `__default__${index}`,
  name: item.name,
  color: item.twClass,
}));

const categoryAliasMap: Record<string, string> = {
  个人: "生活事务",
  工作提升: "任务推进",
  运动健康: "健康运动",
  生活运动: "健康运动",
  兴趣爱好: "休息恢复",
  放松休闲: "休息恢复",
  "life&other": "生活事务",
  自我提升: "课程学习",
  计划复盘: "任务推进",
  学习成长: "课程学习",
  娱乐休息: "休息恢复",
  其他: "生活事务",
  数据整理: "实验数据",
  实验分析: "实验数据",
  行政杂务: "行政事务",
  外出通勤: "通勤外出",
  情绪记录: "情绪复盘",
  缓冲时间: "弹性缓冲",
};

const defaultForm: EventFormState = {
  title: "",
  startHour: 8,
  endHour: 9,
  notes: "",
  requirements: "",
  isCompleted: false,
  category: DEFAULT_SCHEDULE_CATEGORY,
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

function getCategoryColor(categories: Category[], categoryName: string) {
  const normalized = normalizeCategoryName(categoryName);
  return (
    categories.find((category) => category.name === normalized)?.color ??
    getScheduleCategoryColor(normalized)
  );
}

function getCategoryAccentColor(categories: Category[], categoryName: string) {
  return getScheduleCategoryAccentColor(normalizeCategoryName(categoryName));
}

function normalizeCategoryName(categoryName: string) {
  return normalizeScheduleCategory(categoryName);
}

function ColorSwatch({
  visual,
  selected,
  onClick,
  size = "md",
}: {
  visual: ScheduleCategoryVisual;
  selected: boolean;
  onClick: () => void;
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border-2 transition ${
        size === "sm" ? "h-6 w-6" : "h-8 w-8"
      } ${selected ? "scale-105 border-stone-950 ring-2 ring-stone-200" : "border-white hover:border-stone-300"}`}
      style={{ backgroundColor: visual.hex }}
      title={visual.name}
    />
  );
}

function CategorySelectLabel({ category }: { category: Category }) {
  const visual = getCategoryVisualByName(category.name);
  return (
    <span className="flex items-center gap-2">
      <span className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: visual.hex }} />
      <span>{category.name}</span>
    </span>
  );
}

function getTagInfo(tag: EventTag) {
  switch (tag) {
    case "待定":
      return { icon: "?", color: "text-amber-600" };
    case "不着急":
      return { icon: "⌛", color: "text-sky-600" };
    case "不可后退":
      return { icon: "⚠", color: "text-rose-600" };
    default:
      return { icon: "", color: "" };
  }
}

function normalizeTimeValue(value: number) {
  return Math.max(0, Math.min(24, value));
}

function monthWeekdayHeaders() {
  return ["日", "一", "二", "三", "四", "五", "六"];
}

function buildRequirementLines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
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
  viewMode = "week",
  timeGranularity = 60,
}: WeeklyTimeGridProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<GridCell | null>(null);
  const [createForm, setCreateForm] = useState<EventFormState>(defaultForm);
  const [editForm, setEditForm] = useState<EventFormState>(defaultForm);
  const [editScope, setEditScope] = useState<"occurrence" | "series">(() => {
    if (typeof window === "undefined") return "occurrence";
    const stored = window.localStorage.getItem(recurrenceEditScopeStorageKey);
    return stored === "series" || stored === "occurrence" ? stored : "occurrence";
  });
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [categoryDefs, setCategoryDefs] = useState<ScheduleCategoryDef[]>(() => loadCategoryDefs());
  const categories = useMemo<Category[]>(
    () =>
      categoryDefs
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item) => ({ id: item.id, name: item.name, color: item.color })),
    [categoryDefs],
  );
  const [newCategory, setNewCategory] = useState<{ name: string; color: string }>({
    name: "",
    color: CATEGORY_VISUALS[0].twClass,
  });
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [editingCategoryColor, setEditingCategoryColor] = useState(CATEGORY_VISUALS[0].twClass);
  const [confirmDeleteCategoryId, setConfirmDeleteCategoryId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
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

  const hours = useMemo(() => {
    const values: number[] = [];
    for (let hour = 0; hour < 24; hour += 1) {
      values.push(hour);
      if (timeGranularity < 60) {
        const intervalCount = 60 / timeGranularity;
        for (let index = 1; index < intervalCount; index += 1) {
          values.push(hour + (index * timeGranularity) / 60);
        }
      }
    }
    return values;
  }, [timeGranularity]);

  useEffect(() => {
    saveCategoryDefs(categoryDefs);
  }, [categoryDefs]);

  const displayDates = useMemo(() => {
    if (viewMode === "day") return [currentWeekStart];
    if (viewMode === "week") {
      return Array.from({ length: 7 }, (_, index) => addDays(currentWeekStart, index));
    }
    return Array.from({ length: 35 }, (_, index) => addDays(currentWeekStart, index));
  }, [currentWeekStart, viewMode]);

  const expandedEvents = useMemo(() => {
    if (displayDates.length === 0) return [] as ScheduleEvent[];
    const first = format(displayDates[0], "yyyy-MM-dd");
    const last = format(displayDates[displayDates.length - 1], "yyyy-MM-dd");
    return expandScheduleEvents(events, first, last) as ScheduleEvent[];
  }, [displayDates, events]);

  const timelineDayLayouts = useMemo<TimelineDayLayout[]>(() => {
    if (viewMode === "month") return [];

    const eventsByDate = new Map<string, ScheduleEvent[]>();
    expandedEvents.forEach((event) => {
      const dayEvents = eventsByDate.get(event.date) ?? [];
      dayEvents.push(event);
      eventsByDate.set(event.date, dayEvents);
    });

    return displayDates.map((date) => {
      const dateIso = format(date, "yyyy-MM-dd");
      const positionedEvents = layoutOverlappingScheduleEvents(eventsByDate.get(dateIso) ?? []);
      const laneCount = positionedEvents.reduce(
        (maxLaneCount, event) => Math.max(maxLaneCount, event.laneCount),
        1,
      );

      return {
        date,
        dateIso,
        events: positionedEvents,
        laneCount,
      };
    });
  }, [displayDates, expandedEvents, viewMode]);

  const timelineGridTemplateColumns = useMemo(
    () => `${viewMode === "day" ? 72 : 56}px repeat(${timelineDayLayouts.length}, minmax(0, 1fr))`,
    [timelineDayLayouts.length, viewMode],
  );

  const selectedEvent = useMemo(
    () => expandedEvents.find((event) => event.id === editingEventId) ?? null,
    [editingEventId, expandedEvents],
  );

  const cellHeight = hourCellHeight / (60 / timeGranularity);

  function handleViewModeChange(mode: ViewMode) {
    onViewModeChange?.(mode);
  }

  function handleGranularityChange(value: string | null) {
    if (!value) return;
    onTimeGranularityChange?.(Number(value) as TimeGranularity);
  }

  function getEventStyle(event: PositionedScheduleEvent) {
    const top = event.startHour * hourCellHeight + 4;
    const height = (event.endHour - event.startHour) * hourCellHeight - 8;
    if (event.laneCount === 1) {
      return {
        top: `${top}px`,
        height: `${Math.max(height, 28)}px`,
        left: "4px",
        width: "calc(100% - 8px)",
      };
    }

    const laneOffsetX = Math.min(14, Math.max(8, 34 / event.laneCount));
    const laneOffsetY = Math.min(20, Math.max(12, 54 / event.laneCount));
    const deckWidthLoss = (event.laneCount - 1) * laneOffsetX;
    const deckHeightLoss = event.lane * Math.min(8, laneOffsetY / 2);

    return {
      top: `${top + event.lane * laneOffsetY}px`,
      height: `${Math.max(height - deckHeightLoss, 36)}px`,
      left: `${4 + event.lane * laneOffsetX}px`,
      width: `calc(100% - ${8 + deckWidthLoss}px)`,
      zIndex: event.lane + 1,
    };
  }

  function resetCreateDialog(cell: GridCell) {
    setSelectedCell(cell);
    const day = parse(cell.date, "yyyy-MM-dd", new Date());
    setCreateForm({
      ...defaultForm,
      startHour: cell.startHour,
      endHour: Math.min(24, cell.startHour + 1),
      category: categories[0]?.name ?? defaultForm.category,
    });
    setCreateRecurrence({
      enabled: false,
      kind: "daily",
      weekdays: [day.getDay()],
      exceptionText: "",
    });
    setCreateDialogOpen(true);
  }

  function handleOpenEdit(event: ScheduleEvent) {
    setEditingEventId(event.id);
    const savedScope =
      typeof window === "undefined" ? null : window.localStorage.getItem(recurrenceEditScopeStorageKey);
    setEditScope((parseSyntheticEventId(event.id) || event.recurrence) && savedScope === "series" ? "series" : "occurrence");
    setEditForm({
      title: event.title,
      startHour: event.startHour,
      endHour: event.endHour,
      notes: event.notes,
      requirements: event.requirements.join("\n"),
      isCompleted: event.isCompleted,
      category: normalizeCategoryName(event.category),
      tag: event.tag,
    });
  }

  function handleCreateEvent() {
    if (!selectedCell || !createForm.title.trim()) return;

    const startHour = normalizeTimeValue(createForm.startHour);
    const endHour = Math.max(startHour + 1 / 60, normalizeTimeValue(createForm.endHour));

    const baseEvent: ScheduleEvent = {
      id: createId("event"),
      date: selectedCell.date,
      startHour,
      endHour,
      title: createForm.title.trim(),
      notes: createForm.notes.trim(),
      requirements: buildRequirementLines(createForm.requirements),
      isCompleted: createForm.isCompleted,
      category: createForm.category,
      tag: createForm.tag,
    };

    if (createRecurrence.enabled) {
      if (createRecurrence.kind === "weekly" && createRecurrence.weekdays.length === 0) {
        toast.error("每周重复至少要选择一个星期。");
        return;
      }

      const weekdays =
        createRecurrence.kind === "weekly"
          ? [...createRecurrence.weekdays].sort((a, b) => a - b)
          : undefined;

      onCreateEvent({
        ...baseEvent,
        recurrence:
          createRecurrence.kind === "daily"
            ? { kind: "daily" }
            : { kind: "weekly", weekdays: weekdays ?? [] },
        exceptionDates: parseExceptionDateList(createRecurrence.exceptionText),
        recurrenceOverrides: {},
        recurrenceEndExclusive: null,
      });
    } else {
      onCreateEvent(baseEvent);
    }

    setCreateDialogOpen(false);
  }

  function handleSaveEdit() {
    if (!selectedEvent || !editForm.title.trim()) return;

    const startHour = normalizeTimeValue(editForm.startHour);
    const endHour = Math.max(startHour + 1 / 60, normalizeTimeValue(editForm.endHour));

    const patch: Partial<ScheduleEvent> = {
      title: editForm.title.trim(),
      startHour,
      endHour,
      notes: editForm.notes.trim(),
      requirements: buildRequirementLines(editForm.requirements),
      isCompleted: editForm.isCompleted,
      category: editForm.category,
      tag: editForm.tag,
    };

    const parsed = parseSyntheticEventId(selectedEvent.id);
    if (parsed) {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(recurrenceEditScopeStorageKey, editScope);
      }
      onUpdateEvent(selectedEvent.id, patch, {
        scope: editScope === "series" ? "series" : "occurrence",
      });
    } else {
      onUpdateEvent(selectedEvent.id, patch);
    }

    setEditingEventId(null);
  }

  function handleAskAiForEvent(eventId: string) {
    const target = expandedEvents.find((event) => event.id === eventId);
    if (!target) return;
    window.__injectLLMContext?.({
      kind: "event",
      id: target.id,
      title: target.title,
      date: target.date,
      category: normalizeCategoryName(target.category),
      time: `${formatHour(target.startHour)}-${formatHour(target.endHour)}`,
    });
    closeContextMenu();
  }

  function handleDropEvent(targetDate: string, targetHour: number) {
    if (!draggingEventId) return;
    if (parseSyntheticEventId(draggingEventId)) {
      toast.info("循环行程暂不支持直接拖拽，请通过编辑修改时间。");
      setDraggingEventId(null);
      return;
    }

    const source = expandedEvents.find((event) => event.id === draggingEventId);
    if (!source) return;

    const duration = Math.max(1 / 60, source.endHour - source.startHour);
    const nextStartHour = Math.min(23.9833, targetHour);
    const nextEndHour = Math.min(24, nextStartHour + duration);

    onUpdateEvent(source.id, {
      date: targetDate,
      startHour: nextStartHour,
      endHour: nextEndHour,
    });
    setDraggingEventId(null);
  }

  function handleContextMenu(event: React.MouseEvent, eventId: string) {
    event.preventDefault();
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const maxX = viewportWidth - contextMenuWidth - contextMenuViewportPadding;
    const maxY = viewportHeight - contextMenuHeight - contextMenuViewportPadding;
    setContextMenu({
      x: Math.max(contextMenuViewportPadding, Math.min(event.clientX, maxX)),
      y: Math.max(contextMenuViewportPadding, Math.min(event.clientY, maxY)),
      eventId,
    });
  }

  function closeContextMenu() {
    setContextMenu(null);
  }

  function handleReschedule(eventId: string) {
    const target = expandedEvents.find((event) => event.id === eventId);
    if (target) handleOpenEdit(target);
    closeContextMenu();
  }

  function handleExtendTime(eventId: string) {
    const target = expandedEvents.find((event) => event.id === eventId);
    if (target) {
      onUpdateEvent(eventId, {
        endHour: Math.min(24, target.endHour + 1),
      });
    }
    closeContextMenu();
  }

  function handleToggleComplete(eventId: string) {
    const target = expandedEvents.find((event) => event.id === eventId);
    if (target) {
      onUpdateEvent(eventId, { isCompleted: !target.isCompleted });
    }
    closeContextMenu();
  }

  function handleSetTag(eventId: string, tag: EventTag) {
    onUpdateEvent(eventId, { tag });
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

  function handleAddCategory() {
    const name = newCategory.name.trim();
    if (!name) {
      toast.error("请输入分类名称");
      return;
    }
    if (isCategoryNameTaken(categoryDefs, name)) {
      toast.error("分类名称已存在");
      return;
    }
    const maxOrder = Math.max(...categoryDefs.map((item) => item.sortOrder), -1);
    setCategoryDefs((prev) => [
      ...prev,
      {
        id: createCategoryId(),
        name,
        color: newCategory.color,
        sortOrder: maxOrder + 1,
      },
    ]);
    setNewCategory({ name: "", color: CATEGORY_VISUALS[0].twClass });
    toast.success(`已添加分类「${name}」`);
  }

  function handleDeleteCategory(categoryId: string) {
    const target = categoryDefs.find((category) => category.id === categoryId);
    if (!target || isBuiltInCategory(target)) return;
    setCategoryDefs((prev) => prev.filter((category) => category.id !== categoryId));
    events
      .filter((event) => normalizeCategoryName(event.category) === target.name)
      .forEach((event) => onUpdateEvent(event.id, { category: UNCATEGORIZED_SCHEDULE_CATEGORY }));
    setConfirmDeleteCategoryId(null);
    toast.success(`已删除分类「${target.name}」`);
  }

  function handleStartEditCategory(category: ScheduleCategoryDef) {
    if (isBuiltInCategory(category)) return;
    setEditingCategoryId(category.id);
    setEditingCategoryName(category.name);
    setEditingCategoryColor(category.color);
  }

  function handleSaveEditCategory(categoryId: string) {
    const name = editingCategoryName.trim();
    if (!name) {
      toast.error("分类名称不能为空");
      return;
    }
    if (isCategoryNameTaken(categoryDefs, name, categoryId)) {
      toast.error("分类名称已存在");
      return;
    }
    const previous = categoryDefs.find((category) => category.id === categoryId);
    setCategoryDefs((prev) =>
      prev.map((category) =>
        category.id === categoryId ? { ...category, name, color: editingCategoryColor } : category,
      ),
    );
    if (previous && previous.name !== name) {
      events
        .filter((event) => normalizeCategoryName(event.category) === previous.name)
        .forEach((event) => onUpdateEvent(event.id, { category: name }));
    }
    setEditingCategoryId(null);
    toast.success("分类已更新");
  }

  function getCategoryUsageCount(categoryName: string) {
    return events.filter((event) => normalizeCategoryName(event.category) === categoryName).length;
  }

  useEffect(() => {
    if (!resizeState) return;
    const activeResize = resizeState;

    function handleMouseMove(event: MouseEvent) {
      const deltaHour = (event.clientY - activeResize.startY) / hourCellHeight;
      if (activeResize.direction === "end") {
        const nextEndHour = Math.min(
          24,
          Math.max(activeResize.startHour + 1 / 60, activeResize.initialHour + deltaHour),
        );
        onUpdateEvent(activeResize.eventId, { endHour: nextEndHour });
        return;
      }

      const nextStartHour = Math.max(
        0,
        Math.min(activeResize.endHour - 1 / 60, activeResize.initialHour + deltaHour),
      );
      onUpdateEvent(activeResize.eventId, { startHour: nextStartHour });
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
    if (!contextMenu) return;

    function handleGlobalClose() {
      setContextMenu(null);
    }

    window.addEventListener("click", handleGlobalClose);
    window.addEventListener("resize", handleGlobalClose);
    window.addEventListener("scroll", handleGlobalClose, true);
    return () => {
      window.removeEventListener("click", handleGlobalClose);
      window.removeEventListener("resize", handleGlobalClose);
      window.removeEventListener("scroll", handleGlobalClose, true);
    };
  }, [contextMenu]);

  const contextMenuEvent = contextMenu
    ? expandedEvents.find((event) => event.id === contextMenu.eventId) ?? null
    : null;

  return (
    <section className="rounded-lg border border-gray-200 bg-white shadow-md">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-6 py-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-gray-900">
            <Clock3 className="h-5 w-5 text-primary" />
            {viewMode === "day" ? "日视图" : viewMode === "week" ? "周视图" : "月视图"}
          </h2>
          <p className="mt-1 text-sm text-gray-600">{weekRange}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant={viewMode === "day" ? "default" : "outline"} onClick={() => handleViewModeChange("day")}>
              日
            </Button>
            <Button type="button" size="sm" variant={viewMode === "week" ? "default" : "outline"} onClick={() => handleViewModeChange("week")}>
              周
            </Button>
            <Button type="button" size="sm" variant={viewMode === "month" ? "default" : "outline"} onClick={() => handleViewModeChange("month")}>
              月
            </Button>
          </div>

          {viewMode !== "month" ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">粒度</span>
              <Select value={String(timeGranularity)} onValueChange={handleGranularityChange}>
                <SelectTrigger className="w-24 rounded-md border-gray-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 分钟</SelectItem>
                  <SelectItem value="15">15 分钟</SelectItem>
                  <SelectItem value="30">30 分钟</SelectItem>
                  <SelectItem value="60">60 分钟</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <Button type="button" variant="outline" size="sm" onClick={onPrevWeek}>
            <ChevronLeft className="h-4 w-4" />
            {viewMode === "day" ? "前一天" : viewMode === "week" ? "前一周" : "前一段"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onNextWeek}>
            {viewMode === "day" ? "后一天" : viewMode === "week" ? "后一周" : "后一段"}
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button type="button" size="sm" onClick={() => setShowCategoryManager(true)}>
            分类管理
          </Button>
        </div>
      </header>

      <div className="overflow-hidden">
        <div className="relative min-w-0">
          {viewMode !== "month" ? (
            <>
              <div
                className="grid border-b border-gray-200 bg-white"
                style={{ gridTemplateColumns: timelineGridTemplateColumns }}
              >
                <div className="border-r border-gray-200 bg-gray-50 px-1.5 py-3 text-xs font-medium text-gray-700">时间</div>
                {timelineDayLayouts.map((day) => (
                  <div
                    key={day.dateIso}
                    className="border-r border-gray-200 bg-gray-50 px-4 py-3 text-center text-sm font-medium text-gray-700 last:border-r-0"
                  >
                    <div>{dayTitle(day.date)}</div>
                    {day.laneCount > 1 ? (
                      <div className="mt-1 text-[11px] font-medium text-gray-500">
                        {day.laneCount} 个并行
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              <div
                className="grid"
                style={{ gridTemplateColumns: timelineGridTemplateColumns }}
              >
                <div>
                  {hours.map((hour) => {
                    const isMainHour = Number.isInteger(hour);
                    return (
                      <div
                        key={`hour-label-${hour}`}
                        className={`border-r border-b px-1.5 py-1 text-xs ${isMainHour ? "border-gray-200 bg-gray-50 text-gray-500" : "border-gray-100 text-gray-400"}`}
                        style={{
                          height: `${cellHeight}px`,
                          borderBottomStyle: isMainHour ? "solid" : "dashed",
                        }}
                      >
                        {isMainHour ? formatHour(hour) : ""}
                      </div>
                    );
                  })}
                </div>

                {timelineDayLayouts.map((dayLayout) => {
                  return (
                    <div key={dayLayout.dateIso} className="relative border-r border-gray-200 last:border-r-0">
                      <div
                        className="grid"
                        style={{ gridTemplateRows: `repeat(${hours.length}, ${cellHeight}px)` }}
                      >
                        {hours.map((hour) => {
                          const isMainHour = Number.isInteger(hour);
                          return (
                            <button
                              key={`${dayLayout.dateIso}-${hour}`}
                              type="button"
                              className={`border-b transition-colors hover:bg-gray-50 ${isMainHour ? "border-gray-200" : "border-gray-100"}`}
                              style={{
                                height: `${cellHeight}px`,
                                borderBottomStyle: isMainHour ? "solid" : "dashed",
                              }}
                              onClick={() => resetCreateDialog({ date: dayLayout.dateIso, startHour: hour })}
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={() => handleDropEvent(dayLayout.dateIso, hour)}
                            />
                          );
                        })}
                      </div>

                      <div className="pointer-events-none absolute inset-0 p-1">
                        {dayLayout.events.map((event) => {
                          const durationHour = event.endHour - event.startHour;
                          const denseCard = event.laneCount > 1;
                          const compactCard = durationHour <= 1.1 || (denseCard && durationHour < 1.6);
                          const showDetails = durationHour >= 2 && !denseCard;
                          const timeLabel = `${formatHour(event.startHour)}-${formatHour(event.endHour)}`;
                          return (
                            <div
                              key={event.id}
                              className={`pointer-events-auto absolute group flex min-h-0 flex-col overflow-hidden rounded-lg border text-left text-sm shadow-[0_3px_10px_rgba(68,64,60,0.08)] ring-1 ring-white/70 transition-[border-color,box-shadow,transform] duration-150 hover:z-40 hover:-translate-y-px hover:shadow-[0_8px_20px_rgba(68,64,60,0.12)] focus-within:z-40 ${getCategoryColor(categories, event.category)} ${event.isCompleted ? "border-dashed saturate-[0.96]" : ""}`}
                              style={getEventStyle(event)}
                              draggable={!parseSyntheticEventId(event.id)}
                              onDragStart={() => setDraggingEventId(event.id)}
                              onDragEnd={() => setDraggingEventId(null)}
                              onContextMenu={(mouseEvent) => handleContextMenu(mouseEvent, event.id)}
                            >
                              <div
                                className={`pointer-events-none absolute inset-y-1 left-1 w-1 rounded-full ${getCategoryAccentColor(categories, event.category)} ${event.isCompleted ? "opacity-80" : "opacity-95"}`}
                              />
                              {event.isCompleted ? (
                                <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.22)_0px,rgba(255,255,255,0.22)_1px,transparent_1px,transparent_8px)]" />
                              ) : null}
                              <button
                                type="button"
                                className={`relative z-10 flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden rounded-[inherit] text-left outline-none focus-visible:ring-2 focus-visible:ring-stone-900/20 ${compactCard ? "justify-start pb-1.5 pl-4 pr-6 pt-1.5" : "justify-start py-2 pl-5 pr-8"}`}
                                onClick={() => handleOpenEdit(event)}
                              >
                                <div className={`flex min-h-0 min-w-0 flex-col ${compactCard ? "gap-0.5" : "flex-1 gap-1.5"}`}>
                                  <div className="flex min-w-0 items-center justify-between gap-1">
                                    <span
                                      className="min-w-0 truncate rounded-md border border-white/65 bg-white/70 px-1.5 py-0.5 text-[11px] font-semibold leading-tight text-gray-800 shadow-[0_1px_2px_rgba(68,64,60,0.05)] [font-variant-numeric:tabular-nums]"
                                      title={timeLabel}
                                    >
                                      {timeLabel}
                                    </span>
                                    <span className="flex shrink-0 items-center gap-1">
                                      {denseCard ? (
                                        <span className="rounded-md border border-white/50 bg-white/45 px-1.5 py-0.5 text-[10px] font-medium leading-none text-gray-700">
                                          {event.lane + 1}/{event.laneCount}
                                        </span>
                                      ) : null}
                                      {event.isCompleted ? (
                                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-white/75 px-1.5 py-0.5 text-[10px] font-medium leading-none text-emerald-700 shadow-sm">
                                          <Check className="h-3 w-3" aria-hidden />
                                          {!compactCard && !denseCard ? "已完成" : ""}
                                        </span>
                                      ) : null}
                                    </span>
                                  </div>

                                  <div className={`min-w-0 ${compactCard ? "" : "flex min-h-0 flex-1 flex-col overflow-hidden"}`}>
                                    <div className="flex items-start gap-1.5">
                                      {event.tag ? (
                                        <span className={`shrink-0 text-sm font-bold ${getTagInfo(event.tag).color}`}>
                                          {getTagInfo(event.tag).icon}
                                        </span>
                                      ) : null}
                                      {parseSyntheticEventId(event.id) ? (
                                        <Repeat className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-600" aria-hidden />
                                      ) : null}
                                      <p
                                        className={`min-w-0 flex-1 overflow-hidden font-semibold leading-snug ${compactCard ? "text-[13px] [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]" : "text-sm [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]"} ${event.isCompleted ? "line-through decoration-2 decoration-current/55" : ""}`}
                                        title={`${event.title} (${timeLabel})`}
                                      >
                                        {event.title}
                                      </p>
                                    </div>
                                    {showDetails && event.notes ? (
                                      <p className="mt-1 min-h-0 overflow-hidden text-[11px] leading-snug text-gray-700/80 [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">
                                        {event.notes}
                                      </p>
                                    ) : null}
                                  </div>
                                  {durationHour >= 1.5 && !compactCard && event.requirements.length > 0 ? (
                                    <div className="flex shrink-0 justify-end text-[11px] leading-tight text-gray-700">
                                      <span className="truncate rounded-md border border-white/50 bg-white/45 px-1.5 py-0.5">
                                        {event.requirements.length} 项准备
                                      </span>
                                    </div>
                                  ) : null}
                                </div>
                              </button>

                              <button
                                type="button"
                                className="absolute right-1.5 top-1.5 z-20 rounded-full border border-white/80 bg-white/80 p-1 text-stone-700 opacity-0 shadow-sm transition hover:bg-white hover:text-black group-hover:opacity-100 focus-visible:opacity-100"
                                onClick={(mouseEvent) => {
                                  mouseEvent.stopPropagation();
                                  resetCreateDialog({ date: event.date, startHour: event.startHour });
                                }}
                                aria-label={`在 ${event.title} 同时段新建行程`}
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
            </>
          ) : (
            <div className="p-4">
              <div className="grid grid-cols-7 gap-2">
                {monthWeekdayHeaders().map((day) => (
                  <div key={day} className="p-2 text-center text-sm font-medium text-gray-700">
                    {day}
                  </div>
                ))}
                {displayDates.map((day) => {
                  const dayIso = format(day, "yyyy-MM-dd");
                  const dayEvents = expandedEvents.filter((event) => event.date === dayIso);

                  return (
                    <div
                      key={dayIso}
                      className="flex min-h-[180px] flex-col rounded-lg border border-gray-200 p-2 transition-colors hover:bg-gray-50"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-medium">{format(day, "d")}</span>
                        <button
                          type="button"
                          className="text-xs text-gray-500 hover:text-black"
                          onClick={() => resetCreateDialog({ date: dayIso, startHour: 9 })}
                        >
                          新建
                        </button>
                      </div>
                      <div className="flex-1 space-y-1 overflow-y-auto pr-1">
                        {dayEvents.length === 0 ? (
                          <div className="text-xs text-gray-400">暂无安排</div>
                        ) : (
                          dayEvents.map((event) => (
                            <div
                              key={event.id}
                              className={`cursor-pointer rounded border px-2 py-1 text-xs ${getCategoryColor(categories, event.category)}`}
                              title={`${event.title} (${formatHour(event.startHour)} - ${formatHour(event.endHour)})`}
                              onClick={() => handleOpenEdit(event)}
                            >
                              <div className="flex items-center gap-1">
                                {event.isCompleted ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" /> : null}
                                <span className={event.isCompleted ? "line-through decoration-2" : ""}>{event.title}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            {selectedCell ? (
              <DialogContent className="rounded-lg border-gray-200 shadow-lg">
                <DialogHeader>
                  <DialogTitle className="text-lg font-semibold text-gray-900">
                    新建行程 - {selectedCell.date} {formatHour(selectedCell.startHour)}
                  </DialogTitle>
                </DialogHeader>
                <div className="mt-4 space-y-5">
                  <div className="space-y-3">
                    <Label htmlFor="create-title">标题</Label>
                    <Input
                      id="create-title"
                      value={createForm.title}
                      onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))}
                      placeholder="输入行程标题"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label>分类</Label>
                    <Select
                      value={createForm.category}
                      onValueChange={(value) => {
                        if (!value) return;
                        setCreateForm((prev) => ({ ...prev, category: value }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.name}>
                            <CategorySelectLabel category={category} />
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <Label>标记</Label>
                    <Select
                      value={createForm.tag ?? "none"}
                      onValueChange={(value) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          tag: value === "none" ? null : (value as EventTag),
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">无标记</SelectItem>
                        <SelectItem value="待定">待定</SelectItem>
                        <SelectItem value="不着急">不着急</SelectItem>
                        <SelectItem value="不可后退">不可后退</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="rounded-lg border border-gray-100 bg-gray-50/80 p-4">
                    <div className="flex items-center gap-3">
                      <Switch
                        id="create-recurring"
                        checked={createRecurrence.enabled}
                        onCheckedChange={(checked) =>
                          setCreateRecurrence((prev) => {
                            const next = { ...prev, enabled: checked };
                            if (checked && prev.kind === "weekly" && prev.weekdays.length === 0) {
                              const weekday = parse(selectedCell.date, "yyyy-MM-dd", new Date()).getDay();
                              next.weekdays = [weekday];
                            }
                            return next;
                          })
                        }
                      />
                      <Label htmlFor="create-recurring">循环行程</Label>
                    </div>
                    {createRecurrence.enabled ? (
                      <div className="mt-4 space-y-4">
                        <div className="space-y-2">
                          <Label>重复方式</Label>
                          <Select
                            value={createRecurrence.kind}
                            onValueChange={(value) =>
                              setCreateRecurrence((prev) => ({
                                ...prev,
                                kind: value as "daily" | "weekly",
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="daily">每天</SelectItem>
                              <SelectItem value="weekly">每周指定星期</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {createRecurrence.kind === "weekly" ? (
                          <div className="space-y-2">
                            <Label>重复的星期</Label>
                            <div className="flex flex-wrap gap-2">
                              {WEEKDAY_UI_ORDER.map((day) => (
                                <Button
                                  key={day}
                                  type="button"
                                  size="sm"
                                  variant={createRecurrence.weekdays.includes(day) ? "default" : "outline"}
                                  onClick={() =>
                                    setCreateRecurrence((prev) => ({
                                      ...prev,
                                      weekdays: prev.weekdays.includes(day)
                                        ? prev.weekdays.filter((item) => item !== day)
                                        : [...prev.weekdays, day],
                                    }))
                                  }
                                >
                                  周{WEEKDAY_SHORT_LABEL[day]}
                                </Button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        <div className="space-y-2">
                          <Label htmlFor="create-exceptions">例外日期</Label>
                          <Textarea
                            id="create-exceptions"
                            value={createRecurrence.exceptionText}
                            onChange={(event) =>
                              setCreateRecurrence((prev) => ({ ...prev, exceptionText: event.target.value }))
                            }
                            placeholder={"每行一个或用逗号分隔"}
                            className="min-h-[72px]"
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <TimeRangeEditor
                    startHour={createForm.startHour}
                    endHour={createForm.endHour}
                    onStartHourChange={(value) => setCreateForm((prev) => ({ ...prev, startHour: value }))}
                    onEndHourChange={(value) => setCreateForm((prev) => ({ ...prev, endHour: value }))}
                  />
                  <div className="space-y-3">
                    <Label htmlFor="create-notes">备注</Label>
                    <Textarea
                      id="create-notes"
                      value={createForm.notes}
                      onChange={(event) => setCreateForm((prev) => ({ ...prev, notes: event.target.value }))}
                      placeholder="输入备注信息"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="create-requirements">所需物品/准备事项</Label>
                    <Textarea
                      id="create-requirements"
                      value={createForm.requirements}
                      onChange={(event) =>
                        setCreateForm((prev) => ({ ...prev, requirements: event.target.value }))
                      }
                      placeholder="每行一项"
                    />
                  </div>
                  <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-4">
                    <Switch
                      id="create-completed"
                      checked={createForm.isCompleted}
                      onCheckedChange={(checked) => setCreateForm((prev) => ({ ...prev, isCompleted: checked }))}
                    />
                    <Label htmlFor="create-completed">标记为已完成</Label>
                  </div>
                  <Button type="button" className="w-full" onClick={handleCreateEvent}>
                    创建行程
                  </Button>
                </div>
              </DialogContent>
            ) : null}
          </Dialog>

          <Dialog open={Boolean(selectedEvent)} onOpenChange={(open) => !open && setEditingEventId(null)}>
            {selectedEvent ? (
              <DialogContent
                className="rounded-lg border-gray-200 shadow-lg"
                onKeyDown={(event) => {
                  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                    event.preventDefault();
                    handleSaveEdit();
                  }
                }}
              >
                <DialogHeader>
                  <DialogTitle className="text-lg font-semibold text-gray-900">编辑行程详情</DialogTitle>
                </DialogHeader>
                <div className="mt-4 space-y-5">
                  <div className="space-y-3">
                    <Label htmlFor="edit-title">标题</Label>
                    <Input
                      id="edit-title"
                      value={editForm.title}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))}
                      placeholder="输入行程标题"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label>分类</Label>
                    <Select
                      value={editForm.category}
                      onValueChange={(value) => {
                        if (!value) return;
                        setEditForm((prev) => ({ ...prev, category: value }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.name}>
                            <CategorySelectLabel category={category} />
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <Label>标记</Label>
                    <Select
                      value={editForm.tag ?? "none"}
                      onValueChange={(value) =>
                        setEditForm((prev) => ({
                          ...prev,
                          tag: value === "none" ? null : (value as EventTag),
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">无标记</SelectItem>
                        <SelectItem value="待定">待定</SelectItem>
                        <SelectItem value="不着急">不着急</SelectItem>
                        <SelectItem value="不可后退">不可后退</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <TimeRangeEditor
                    startHour={editForm.startHour}
                    endHour={editForm.endHour}
                    onStartHourChange={(value) => setEditForm((prev) => ({ ...prev, startHour: value }))}
                    onEndHourChange={(value) => setEditForm((prev) => ({ ...prev, endHour: value }))}
                  />
                  <div className="space-y-3">
                    <Label htmlFor="edit-notes">备注</Label>
                    <Textarea
                      id="edit-notes"
                      value={editForm.notes}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, notes: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="edit-requirements">所需物品/准备事项</Label>
                    <Textarea
                      id="edit-requirements"
                      value={editForm.requirements}
                      onChange={(event) =>
                        setEditForm((prev) => ({ ...prev, requirements: event.target.value }))
                      }
                    />
                  </div>
                  <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-4">
                    <Switch
                      id="edit-completed"
                      checked={editForm.isCompleted}
                      onCheckedChange={(checked) => setEditForm((prev) => ({ ...prev, isCompleted: checked }))}
                    />
                    <Label htmlFor="edit-completed">标记为已完成</Label>
                  </div>

                  {parseSyntheticEventId(selectedEvent.id) ? (
                    <div className="space-y-4 rounded-lg border border-amber-100 bg-amber-50/60 p-4">
                      <p className="text-sm text-gray-800">
                        循环行程 · 当前日期 <span className="font-medium">{selectedEvent.date}</span>
                      </p>
                      <div className="space-y-2">
                        <Label className="text-xs font-medium uppercase tracking-wide text-gray-600">保存范围</Label>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={editScope === "occurrence" ? "default" : "outline"}
                            onClick={() => {
                              setEditScope("occurrence");
                              if (typeof window !== "undefined") {
                                window.localStorage.setItem(recurrenceEditScopeStorageKey, "occurrence");
                              }
                            }}
                          >
                            仅此日
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={editScope === "series" ? "default" : "outline"}
                            onClick={() => {
                              setEditScope("series");
                              if (typeof window !== "undefined") {
                                window.localStorage.setItem(recurrenceEditScopeStorageKey, "series");
                              }
                            }}
                          >
                            整个系列
                          </Button>
                        </div>
                        <p className="text-xs text-gray-600">
                          修改时间、标题等时：选“仅此日”只影响当天；选“整个系列”会更新该循环规则下所有日期。
                        </p>
                      </div>
                      <div className="space-y-2 border-t border-amber-200/80 pt-3">
                        <Label className="text-xs font-medium uppercase tracking-wide text-gray-600">删除</Label>
                        <div className="flex flex-col gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              onDeleteEvent(selectedEvent.id, { mode: "single" });
                              setEditingEventId(null);
                            }}
                          >
                            删除此日
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              onDeleteEvent(selectedEvent.id, { mode: "future" });
                              setEditingEventId(null);
                            }}
                          >
                            删除此日及之后
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
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

                  <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                    {parseSyntheticEventId(selectedEvent.id) ? null : (
                      <Button
                        type="button"
                        className="flex-1 bg-red-600 text-white hover:bg-red-700"
                        onClick={() => {
                          onDeleteEvent(selectedEvent.id, { mode: "all" });
                          setEditingEventId(null);
                        }}
                      >
                        删除行程
                      </Button>
                    )}
                    <Button type="button" className="flex-1" onClick={handleSaveEdit}>
                      保存修改
                    </Button>
                  </div>
                </div>
              </DialogContent>
            ) : null}
          </Dialog>

          <Dialog
            open={showCategoryManager}
            onOpenChange={(open) => {
              setShowCategoryManager(open);
              if (!open) {
                setEditingCategoryId(null);
                setConfirmDeleteCategoryId(null);
              }
            }}
          >
            <DialogContent className="max-h-[84vh] overflow-hidden rounded-3xl border-stone-200 bg-stone-50 p-0 shadow-[0_28px_80px_rgba(28,25,23,0.24)] sm:max-w-4xl">
              <DialogHeader className="border-b border-stone-200 bg-white px-5 py-4">
                <DialogTitle className="flex items-center gap-2 text-base font-semibold text-stone-950">
                  <Palette className="h-4 w-4" />
                  分类管理
                </DialogTitle>
              </DialogHeader>

              <div className="grid min-h-0 grid-cols-1 gap-0 md:grid-cols-[1fr_310px]">
                <section className="min-h-0 border-b border-stone-200 bg-white md:border-b-0 md:border-r">
                  <div className="flex items-center justify-between px-5 py-3">
                    <div>
                      <h3 className="text-sm font-semibold text-stone-900">现有分类</h3>
                    </div>
                    <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-600">
                      {events.length} 个行程
                    </span>
                  </div>

                  <div className="max-h-[46vh] space-y-2 overflow-y-auto px-5 pb-5 pr-3 md:max-h-[58vh]">
                    {categoryDefs
                      .slice()
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map((category) => {
                        const visual = getCategoryVisualByClass(category.color);
                        const builtIn = isBuiltInCategory(category);
                        const eventCount = getCategoryUsageCount(category.name);
                        const isEditing = editingCategoryId === category.id;

                        return (
                          <div
                            key={category.id}
                            className={`rounded-2xl border px-3 py-2.5 transition ${
                              isEditing
                                ? "border-stone-300 bg-stone-50 shadow-sm"
                                : "border-stone-200 bg-white hover:border-stone-300"
                            }`}
                          >
                            {isEditing ? (
                              <div className="space-y-3">
                                <Input
                                  value={editingCategoryName}
                                  onChange={(event) => setEditingCategoryName(event.target.value)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") handleSaveEditCategory(category.id);
                                  }}
                                  autoFocus
                                />
                                <div className="flex flex-wrap gap-1.5">
                                  {CATEGORY_VISUALS.map((item) => (
                                    <ColorSwatch
                                      key={item.hex}
                                      visual={item}
                                      selected={editingCategoryColor === item.twClass}
                                      onClick={() => setEditingCategoryColor(item.twClass)}
                                      size="sm"
                                    />
                                  ))}
                                </div>
                                <div className="flex justify-end gap-2">
                                  <Button type="button" size="sm" variant="outline" onClick={() => setEditingCategoryId(null)}>
                                    取消
                                  </Button>
                                  <Button type="button" size="sm" onClick={() => handleSaveEditCategory(category.id)}>
                                    保存
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3">
                                <span
                                  className="h-8 w-8 shrink-0 rounded-xl border border-black/10"
                                  style={{ backgroundColor: visual.hex }}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex min-w-0 items-center gap-2">
                                    <p className="truncate text-sm font-semibold text-stone-900">{category.name}</p>
                                    {builtIn ? (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] text-stone-500">
                                        <ShieldCheck className="h-3 w-3" />
                                        内置
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="mt-0.5 text-xs text-stone-500">{eventCount} 个行程正在使用</p>
                                </div>
                                {builtIn ? null : (
                                  <div className="flex shrink-0 gap-1">
                                    <Button
                                      type="button"
                                      size="icon-sm"
                                      variant="ghost"
                                      onClick={() => handleStartEditCategory(category)}
                                      title="编辑分类"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      type="button"
                                      size="icon-sm"
                                      variant="ghost"
                                      className="text-red-600 hover:bg-red-50"
                                      onClick={() => setConfirmDeleteCategoryId(category.id)}
                                      title="删除分类"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </section>

                <aside className="max-h-[46vh] overflow-y-auto bg-stone-50 p-5 md:max-h-[58vh]">
                  {confirmDeleteCategoryId ? (
                    <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4">
                      {(() => {
                        const target = categoryDefs.find((item) => item.id === confirmDeleteCategoryId);
                        const eventCount = target ? getCategoryUsageCount(target.name) : 0;
                        return (
                          <>
                            <p className="text-sm font-semibold text-red-800">
                              确认删除「{target?.name ?? "该分类"}」？
                            </p>
                            <p className="mt-1 text-xs leading-5 text-red-700">
                              {eventCount > 0
                                ? `${eventCount} 个行程会自动归入「${UNCATEGORIZED_SCHEDULE_CATEGORY}」。`
                                : "该操作不可撤销。"}
                            </p>
                            <div className="mt-3 flex gap-2">
                              <Button type="button" size="sm" variant="destructive" onClick={() => handleDeleteCategory(confirmDeleteCategoryId)}>
                                确认删除
                              </Button>
                              <Button type="button" size="sm" variant="outline" onClick={() => setConfirmDeleteCategoryId(null)}>
                                取消
                              </Button>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  ) : null}

                  <div className="rounded-2xl border border-stone-200 bg-white p-4">
                    <h3 className="text-sm font-semibold text-stone-900">添加新分类</h3>
                    <div className="mt-4 space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="category-name">分类名称</Label>
                        <Input
                          id="category-name"
                          value={newCategory.name}
                          onChange={(event) => setNewCategory((prev) => ({ ...prev, name: event.target.value }))}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") handleAddCategory();
                          }}
                          placeholder="输入分类名称"
                        />
                      </div>

                      {(["cold", "warm", "neutral"] as const).map((hue) => (
                        <div key={hue}>
                          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">
                            {hue === "cold" ? "冷色 · 科研学习" : hue === "warm" ? "暖色 · 生活沟通" : "中性色 · 事务缓冲"}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {CATEGORY_VISUALS.filter((item) => item.hue === hue).map((item) => (
                              <ColorSwatch
                                key={item.hex}
                                visual={item}
                                selected={newCategory.color === item.twClass}
                                onClick={() => setNewCategory((prev) => ({ ...prev, color: item.twClass }))}
                              />
                            ))}
                          </div>
                        </div>
                      ))}

                      <Button type="button" className="w-full" onClick={handleAddCategory}>
                        <Plus className="mr-1.5 h-4 w-4" />
                        添加分类
                      </Button>
                    </div>
                  </div>
                </aside>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {contextMenu && typeof document !== "undefined" ? createPortal(
          <div
            className="fixed z-[1000] w-52 max-h-[calc(100vh-24px)] overflow-y-auto rounded-2xl border border-stone-200 bg-white/95 p-1.5 shadow-[0_24px_60px_rgba(68,64,60,0.28)] backdrop-blur-md"
            style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-stone-100 px-3 py-2">
              <p className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">Schedule Action</p>
              <p className="mt-1 truncate text-sm font-semibold text-stone-900">{contextMenuEvent?.title ?? "行程操作"}</p>
            </div>
            <button className="mt-1 block w-full rounded-xl px-3 py-2 text-left text-sm transition hover:bg-stone-100" onClick={() => handleReschedule(contextMenu.eventId)}>
              改约
            </button>
            <button className="block w-full rounded-xl px-3 py-2 text-left text-sm transition hover:bg-stone-100" onClick={() => handleExtendTime(contextMenu.eventId)}>
              加时
            </button>
            <button className="block w-full rounded-xl px-3 py-2 text-left text-sm transition hover:bg-stone-100" onClick={() => handleToggleComplete(contextMenu.eventId)}>
              {contextMenuEvent?.isCompleted ? "标记为未完成" : "标记为已完成"}
            </button>
            <button className="block w-full rounded-xl px-3 py-2 text-left text-sm transition hover:bg-stone-100" onClick={() => handleAskAiForEvent(contextMenu.eventId)}>
              问 AI 分析该行程
            </button>
            <button className="block w-full rounded-xl px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50" onClick={() => handleDeleteFromContext(contextMenu.eventId)}>
              删除该行程
            </button>
            <div className="my-1 border-t border-stone-100" />
            <button className="block w-full rounded-xl px-3 py-2 text-left text-sm transition hover:bg-stone-100" onClick={() => handleSetTag(contextMenu.eventId, "待定")}>
              标记为待定
            </button>
            <button className="block w-full rounded-xl px-3 py-2 text-left text-sm transition hover:bg-stone-100" onClick={() => handleSetTag(contextMenu.eventId, "不着急")}>
              标记为不着急
            </button>
            <button className="block w-full rounded-xl px-3 py-2 text-left text-sm transition hover:bg-stone-100" onClick={() => handleSetTag(contextMenu.eventId, "不可后退")}>
              标记为不可后退
            </button>
            <button className="block w-full rounded-xl px-3 py-2 text-left text-sm transition hover:bg-stone-100" onClick={() => handleSetTag(contextMenu.eventId, null)}>
              移除标记
            </button>
          </div>,
          document.body,
        ) : null}
      </div>
    </section>
  );
}

function TimeRangeEditor({
  startHour,
  endHour,
  onStartHourChange,
  onEndHourChange,
}: {
  startHour: number;
  endHour: number;
  onStartHourChange: (value: number) => void;
  onEndHourChange: (value: number) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-3">
        <Label>开始时间</Label>
        <div className="flex gap-3">
          <Select
            value={String(Math.floor(startHour))}
            onValueChange={(value) => {
              const hours = Number(value);
              const minutes = startHour - Math.floor(startHour);
              onStartHourChange(hours + minutes);
            }}
          >
            <SelectTrigger>
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
            value={String(Math.round((startHour - Math.floor(startHour)) * 60))}
            onValueChange={(value) => {
              const hours = Math.floor(startHour);
              onStartHourChange(hours + Number(value) / 60);
            }}
          >
            <SelectTrigger>
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
        <Label>结束时间</Label>
        <div className="flex gap-3">
          <Select
            value={String(Math.floor(endHour))}
            onValueChange={(value) => {
              const hours = Number(value);
              const minutes = endHour - Math.floor(endHour);
              onEndHourChange(hours + minutes);
            }}
          >
            <SelectTrigger>
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
            value={String(Math.round((endHour - Math.floor(endHour)) * 60))}
            onValueChange={(value) => {
              const hours = Math.floor(endHour);
              onEndHourChange(hours + Number(value) / 60);
            }}
          >
            <SelectTrigger>
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
  );
}
