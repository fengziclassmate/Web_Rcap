"use client";

import React, { useEffect, useMemo, useState } from "react";
import { addDays, format, parse } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Plus,
  Repeat,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { EventTag, ScheduleEvent } from "@/app/page";
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

type CategoryPalette = {
  name: string;
  color: string;
};

type ContextMenuState = {
  x: number;
  y: number;
  eventId: string;
};

export type ViewMode = "day" | "week" | "month";
export type TimeGranularity = 5 | 15 | 30 | 60;

const hourCellHeight = 60;

const defaultCategoryPalette: CategoryPalette[] = [
  { name: "深度科研", color: "bg-sky-50 border-sky-300 text-sky-950" },
  { name: "论文写作", color: "bg-indigo-50 border-indigo-300 text-indigo-950" },
  { name: "文献阅读", color: "bg-cyan-50 border-cyan-300 text-cyan-950" },
  { name: "课程学习", color: "bg-violet-50 border-violet-300 text-violet-950" },
  { name: "会议沟通", color: "bg-amber-50 border-amber-300 text-amber-950" },
  { name: "任务推进", color: "bg-emerald-50 border-emerald-300 text-emerald-950" },
  { name: "生活事务", color: "bg-rose-50 border-rose-300 text-rose-950" },
  { name: "健康运动", color: "bg-orange-50 border-orange-300 text-orange-950" },
  { name: "休息恢复", color: "bg-slate-100 border-slate-300 text-slate-900" },
];

const selectableColors = [
  "bg-sky-50 border-sky-300 text-sky-950",
  "bg-indigo-50 border-indigo-300 text-indigo-950",
  "bg-cyan-50 border-cyan-300 text-cyan-950",
  "bg-violet-50 border-violet-300 text-violet-950",
  "bg-amber-50 border-amber-300 text-amber-950",
  "bg-emerald-50 border-emerald-300 text-emerald-950",
  "bg-rose-50 border-rose-300 text-rose-950",
  "bg-orange-50 border-orange-300 text-orange-950",
  "bg-slate-100 border-slate-300 text-slate-900",
  "bg-teal-50 border-teal-300 text-teal-950",
  "bg-lime-50 border-lime-300 text-lime-950",
  "bg-fuchsia-50 border-fuchsia-300 text-fuchsia-950",
] as const;

const defaultCategories: Category[] = defaultCategoryPalette.map((item, index) => ({
  id: String(index + 1),
  name: item.name,
  color: item.color,
}));

const categoryAliasMap: Record<string, string> = {
  个人: "生活事务",
  工作提升: "任务推进",
  运动健康: "健康运动",
  兴趣爱好: "休息恢复",
  放松休闲: "休息恢复",
  "life&other": "生活事务",
  自我提升: "课程学习",
  计划复盘: "任务推进",
};

const defaultForm: EventFormState = {
  title: "",
  startHour: 8,
  endHour: 9,
  notes: "",
  requirements: "",
  isCompleted: false,
  category: defaultCategories[0].name,
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
    "bg-white border-gray-300 text-gray-900"
  );
}

function normalizeCategoryName(categoryName: string) {
  return categoryAliasMap[categoryName] ?? categoryName;
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
  const [editScope, setEditScope] = useState<"occurrence" | "series">("occurrence");
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [categories, setCategories] = useState<Category[]>(defaultCategories);
  const [newCategory, setNewCategory] = useState<{ name: string; color: string }>({
    name: "",
    color: selectableColors[0],
  });
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

  function getEventStyle(event: PositionedEvent) {
    const top = event.startHour * hourCellHeight + 4;
    const height = (event.endHour - event.startHour) * hourCellHeight - 8;
    return {
      top: `${top}px`,
      height: `${Math.max(height, 28)}px`,
      left: `calc(${(event.lane / event.laneCount) * 100}% + 4px)`,
      width: `calc(${100 / event.laneCount}% - 8px)`,
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
    setEditScope("occurrence");
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
    if (!name) return;
    if (categories.some((category) => category.name === name)) {
      toast.error("分类名称已存在。");
      return;
    }
    setCategories((prev) => [
      ...prev,
      {
        id: createId("category"),
        name,
        color: newCategory.color,
      },
    ]);
    setNewCategory({ name: "", color: selectableColors[0] });
  }

  function handleDeleteCategory(categoryId: string) {
    setCategories((prev) => prev.filter((category) => category.id !== categoryId));
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

      <div className="overflow-x-auto">
        <div className="relative min-w-[1120px]">
          {viewMode !== "month" ? (
            <>
              <div className="grid grid-cols-[96px_repeat(auto-fit,minmax(140px,1fr))] border-b border-gray-200 bg-white">
                <div className="border-r border-gray-200 bg-gray-50 px-3 py-3 text-sm font-medium text-gray-700">时间</div>
                {displayDates.map((day) => (
                  <div
                    key={day.toISOString()}
                    className="border-r border-gray-200 bg-gray-50 px-4 py-3 text-center text-sm font-medium text-gray-700 last:border-r-0"
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
                        className={`border-r border-b px-3 py-1 text-sm ${isMainHour ? "border-gray-200 bg-gray-50 text-gray-500" : "border-gray-100 text-gray-400"}`}
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

                {displayDates.map((day) => {
                  const dayIso = format(day, "yyyy-MM-dd");
                  const dayEvents = layoutDayEvents(expandedEvents.filter((event) => event.date === dayIso));

                  return (
                    <div key={dayIso} className="relative border-r border-gray-200 last:border-r-0">
                      <div
                        className="grid"
                        style={{ gridTemplateRows: `repeat(${hours.length}, ${cellHeight}px)` }}
                      >
                        {hours.map((hour) => {
                          const isMainHour = Number.isInteger(hour);
                          return (
                            <button
                              key={`${dayIso}-${hour}`}
                              type="button"
                              className={`border-b transition-colors hover:bg-gray-50 ${isMainHour ? "border-gray-200" : "border-gray-100"}`}
                              style={{
                                height: `${cellHeight}px`,
                                borderBottomStyle: isMainHour ? "solid" : "dashed",
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
                          const compactCard = event.endHour - event.startHour < 1.25;
                          return (
                            <div
                              key={event.id}
                              className={`pointer-events-auto absolute flex min-h-0 flex-col overflow-hidden rounded-lg border text-left text-sm shadow-md transition-all hover:shadow-lg ${getCategoryColor(categories, event.category)}`}
                              style={getEventStyle(event)}
                              draggable={!parseSyntheticEventId(event.id)}
                              onDragStart={() => setDraggingEventId(event.id)}
                              onDragEnd={() => setDraggingEventId(null)}
                              onContextMenu={(mouseEvent) => handleContextMenu(mouseEvent, event.id)}
                            >
                              <button
                                type="button"
                                className={`flex min-h-0 w-full min-w-0 flex-1 flex-col text-left ${compactCard ? "justify-start px-2 pb-1 pt-1" : "justify-center px-2 py-1.5"}`}
                                onClick={() => handleOpenEdit(event)}
                              >
                                <div className={`flex min-h-0 min-w-0 flex-col gap-1 ${compactCard ? "" : "flex-1"}`}>
                                  <div className={`min-w-0 ${compactCard ? "" : "flex flex-1 flex-col justify-center overflow-y-auto"}`}>
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
                                        className={`min-w-0 flex-1 truncate font-medium leading-snug ${event.isCompleted ? "line-through decoration-2" : ""}`}
                                        title={`${event.title} (${formatHour(event.startHour)} - ${formatHour(event.endHour)})`}
                                      >
                                        {event.title}
                                      </p>
                                      {event.isCompleted ? <Check className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden /> : null}
                                    </div>
                                  </div>
                                  <p className="shrink-0 text-xs leading-tight text-gray-700">
                                    {formatHour(event.startHour)} - {formatHour(event.endHour)}
                                  </p>
                                </div>
                              </button>

                              <button
                                type="button"
                                className="absolute right-1 top-1 z-10 rounded-full border border-gray-300 bg-white p-1 text-black shadow-sm hover:bg-gray-100"
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
                            {category.name}
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
                            placeholder={"每行一个或用逗号分隔，例如：\n2026-04-12\n2026-04-20"}
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
                      placeholder="每行一项，例如：笔记本、笔"
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
              <DialogContent className="rounded-lg border-gray-200 shadow-lg">
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
                            {category.name}
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
                            onClick={() => setEditScope("occurrence")}
                          >
                            仅此日
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={editScope === "series" ? "default" : "outline"}
                            onClick={() => setEditScope("series")}
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

          <Dialog open={showCategoryManager} onOpenChange={setShowCategoryManager}>
            <DialogContent className="rounded-lg border-gray-200 shadow-lg">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-gray-900">分类管理</DialogTitle>
              </DialogHeader>
              <div className="mt-4 space-y-5">
                <div className="space-y-4">
                  <h3 className="text-sm font-medium uppercase tracking-wide text-gray-700">现有分类</h3>
                  <div className="space-y-3">
                    {categories.map((category) => (
                      <div key={category.id} className="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-gray-50">
                        <div className="flex items-center gap-4">
                          <div className={`h-6 w-6 rounded-md border ${category.color}`} />
                          <span className="text-sm font-medium text-gray-800">{category.name}</span>
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 hover:bg-red-50 hover:text-red-500"
                          onClick={() => handleDeleteCategory(category.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-medium uppercase tracking-wide text-gray-700">添加新分类</h3>
                  <div className="space-y-3">
                    <Label htmlFor="category-name">分类名称</Label>
                    <Input
                      id="category-name"
                      value={newCategory.name}
                      onChange={(event) => setNewCategory((prev) => ({ ...prev, name: event.target.value }))}
                      placeholder="输入分类名称"
                    />
                    <Label>分类颜色</Label>
                    <div className="grid grid-cols-6 gap-4">
                      {selectableColors.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setNewCategory((prev) => ({ ...prev, color }))}
                          className={`h-12 w-12 rounded-md border transition-all ${newCategory.color === color ? "scale-110 ring-2 ring-primary ring-offset-2" : "hover:scale-105 hover:ring-1 hover:ring-gray-300"} ${color}`}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <Button type="button" className="w-full" onClick={handleAddCategory}>
                  添加分类
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {contextMenu ? (
          <div
            className="fixed z-50 rounded-sm border border-gray-200 bg-white py-1 shadow-lg"
            style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
            onMouseLeave={closeContextMenu}
          >
            <button className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100" onClick={() => handleReschedule(contextMenu.eventId)}>
              改约
            </button>
            <button className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100" onClick={() => handleExtendTime(contextMenu.eventId)}>
              加时
            </button>
            <button className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100" onClick={() => handleToggleComplete(contextMenu.eventId)}>
              {expandedEvents.find((event) => event.id === contextMenu.eventId)?.isCompleted ? "标记为未完成" : "标记为已完成"}
            </button>
            <button className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50" onClick={() => handleDeleteFromContext(contextMenu.eventId)}>
              删除该行程
            </button>
            <div className="my-1 border-t border-gray-200" />
            <button className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100" onClick={() => handleSetTag(contextMenu.eventId, "待定")}>
              标记为待定
            </button>
            <button className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100" onClick={() => handleSetTag(contextMenu.eventId, "不着急")}>
              标记为不着急
            </button>
            <button className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100" onClick={() => handleSetTag(contextMenu.eventId, "不可后退")}>
              标记为不可后退
            </button>
            <button className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100" onClick={() => handleSetTag(contextMenu.eventId, null)}>
              移除标记
            </button>
          </div>
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
