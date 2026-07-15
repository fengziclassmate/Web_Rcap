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
  Coffee,
  Droplets,
  Dumbbell,
  FlaskConical,
  Gamepad2,
  GraduationCap,
  House,
  Moon,
  Palette,
  Pencil,
  Plus,
  Pause,
  Repeat,
  ShieldCheck,
  Trash2,
  Utensils,
  Users,
  Video,
  BookOpen,
  Car,
  Circle,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { EventTag, ScheduleEvent } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { DailyExpensePanel } from "@/components/schedule/daily-expense-panel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { createId } from "@/lib/id";
import { supabase } from "@/lib/supabase";
import {
  getScheduleEventDurationHour,
  layoutOverlappingScheduleEvents,
  type PositionedScheduleEvent,
  type ScheduleEventSegment,
  splitScheduleEventByDay,
  toSourceScheduleEvent,
} from "@/lib/schedule-layout";
import {
  CATEGORY_VISUALS,
  DEFAULT_SCHEDULE_CATEGORY,
  SCHEDULE_CATEGORY_GROUP_LABELS,
  SCHEDULE_CATEGORY_GROUP_ORDER,
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
import type {
  ScheduleCategoryDef,
  ScheduleCategoryIcon,
  ScheduleCategoryVisual,
} from "@/lib/categories";
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

type WeeklyTimeGridProps = {
  currentWeekStart: Date;
  weekRange: string;
  events: ScheduleEvent[];
  onCreateEvent: (event: ScheduleEvent) => void;
  onCreateDailyTask: (name: string, dueDate: string) => string | null;
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
  events: PositionedScheduleEvent<TimelineEventSegment>[];
  laneCount: number;
};

type TimelineEventSegment = ScheduleEventSegment<ScheduleEvent>;

export type ViewMode = "day" | "week" | "month";
export type TimeGranularity = 5 | 15 | 30 | 60 | "45-15" | "50-10";

type TimeGridSlot = {
  startHour: number;
  durationMinutes: number;
};

type MonthlyExpenseSummary = {
  totalExpense: number;
  dailyBudget: number | null;
};

type ExpenseSummaryRow = {
  amount: number | string;
  expense_date: string;
};

type DailyBudgetSummaryRow = {
  amount: number | string;
  budget_date: string;
};

const hourCellHeight = 80;
const minutesPerHour = 60;
const hoursPerDay = 24;
const minutesPerDay = hoursPerDay * minutesPerHour;
const maxStartMinute = minutesPerDay - 1;
const minimumDurationHour = 1 / minutesPerHour;
const contextMenuWidth = 208;
const contextMenuHeight = 360;
const contextMenuViewportPadding = 12;
const recurrenceEditScopeStorageKey = "recurrence-edit-scope";
const hourOptions = Array.from({ length: 24 }, (_, hour) => hour);
const endHourOptions = Array.from({ length: 25 }, (_, hour) => hour);
const minuteOptions = Array.from({ length: 60 }, (_, minute) => minute);
const quickMinuteOptions = [0, 15, 30, 45];
const compactMoneyFormatter = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function getTimeGridSlots(granularity: TimeGranularity): TimeGridSlot[] {
  const splitMinutes =
    granularity === "45-15" ? [45, 15] : granularity === "50-10" ? [50, 10] : null;
  const numericGranularity = typeof granularity === "number" ? granularity : null;

  return Array.from({ length: hoursPerDay }, (_, hour) => {
    const durations =
      splitMinutes ??
      Array.from(
        { length: minutesPerHour / (numericGranularity ?? minutesPerHour) },
        () => numericGranularity ?? minutesPerHour,
      );
    let elapsedMinutes = 0;

    return durations.map((durationMinutes) => {
      const slot = {
        startHour: hour + elapsedMinutes / minutesPerHour,
        durationMinutes,
      };
      elapsedMinutes += durationMinutes;
      return slot;
    });
  }).flat();
}

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
  const totalMinutes = Math.max(0, Math.min(minutesPerDay, Math.round(hour * minutesPerHour)));
  const hours = Math.floor(totalMinutes / minutesPerHour);
  const minutes = totalMinutes % minutesPerHour;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

function formatEventTimeRange(event: Pick<ScheduleEvent, "startHour" | "endHour">) {
  const endLabel =
    event.endHour < event.startHour ? `次日 ${formatHour(event.endHour)}` : formatHour(event.endHour);
  return `${formatHour(event.startHour)}-${endLabel}`;
}

function formatTimelineSegmentTimeRange(event: TimelineEventSegment) {
  if (event.segmentRole === "starts") return `${formatHour(event.startHour)}-${formatHour(24)}`;
  if (event.segmentRole === "continues") return `${formatHour(0)}-${formatHour(event.endHour)}`;
  return formatEventTimeRange(event);
}

function normalizeStartTimeValue(value: number) {
  return Math.max(0, Math.min(maxStartMinute / minutesPerHour, value));
}

function normalizeEndTimeValue(value: number) {
  return Math.max(0, Math.min(hoursPerDay, value));
}

function resolveFormTimeRange(startValue: number, endValue: number) {
  const startHour = normalizeStartTimeValue(startValue);
  const rawEndHour = normalizeEndTimeValue(endValue);
  const endHour =
    rawEndHour === startHour
      ? Math.min(hoursPerDay, startHour + minimumDurationHour)
      : rawEndHour;
  return { startHour, endHour };
}

function getEndHourFromStartAndDuration(startHour: number, durationHour: number) {
  const boundedDuration = Math.max(
    minimumDurationHour,
    Math.min(hoursPerDay - minimumDurationHour, durationHour),
  );
  const absoluteEndHour = startHour + boundedDuration;
  if (absoluteEndHour < hoursPerDay) return absoluteEndHour;
  if (absoluteEndHour === hoursPerDay) return hoursPerDay;
  return absoluteEndHour - hoursPerDay;
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

function getCategoryAccentColor(categoryName: string) {
  return getScheduleCategoryAccentColor(normalizeCategoryName(categoryName));
}

function normalizeCategoryName(categoryName: string) {
  return normalizeScheduleCategory(categoryName);
}

const categoryIconMap: Record<ScheduleCategoryIcon, LucideIcon> = {
  moon: Moon,
  droplets: Droplets,
  coffee: Coffee,
  utensils: Utensils,
  pause: Pause,
  users: Users,
  gamepad: Gamepad2,
  video: Video,
  book: BookOpen,
  graduation: GraduationCap,
  flask: FlaskConical,
  dumbbell: Dumbbell,
  car: Car,
  house: House,
  circle: Circle,
};

function groupCategoriesByScheduleGroup<T extends { name: string }>(items: T[]) {
  return SCHEDULE_CATEGORY_GROUP_ORDER.map((group) => ({
    group,
    categories: items.filter((item) => getCategoryVisualByName(item.name).group === group),
  })).filter((item) => item.categories.length > 0);
}

function CategoryIcon({
  visual,
  className = "",
}: {
  visual: ScheduleCategoryVisual;
  className?: string;
}) {
  const Icon = categoryIconMap[visual.icon];
  return <Icon className={className} aria-hidden />;
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
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-black/10 bg-white"
        style={{ color: visual.hex }}
      >
        <CategoryIcon visual={visual} className="h-3.5 w-3.5" />
      </span>
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

function getTimeSelectParts(value: number, allowEndBoundary = false) {
  const maxMinute = allowEndBoundary ? minutesPerDay : maxStartMinute;
  const totalMinutes = Math.max(0, Math.min(maxMinute, Math.round(value * minutesPerHour)));
  return {
    hours: Math.floor(totalMinutes / minutesPerHour),
    minutes: totalMinutes % minutesPerHour,
  };
}

function getTimeValueFromParts(hours: number, minutes: number, allowEndBoundary = false) {
  if (allowEndBoundary && hours === hoursPerDay) return hoursPerDay;
  return hours + minutes / minutesPerHour;
}

function monthWeekdayHeaders() {
  return ["日", "一", "二", "三", "四", "五", "六"];
}

function normalizeMoneyValue(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function formatCompactMoney(value: number) {
  return `¥${compactMoneyFormatter.format(normalizeMoneyValue(value))}`;
}

function getMonthlyExpenseLabel(summary: MonthlyExpenseSummary) {
  if (summary.dailyBudget === null) {
    return formatCompactMoney(summary.totalExpense);
  }

  return `${formatCompactMoney(summary.totalExpense)} / ${formatCompactMoney(summary.dailyBudget)}`;
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
  onCreateDailyTask,
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
  const groupedCategories = useMemo(() => groupCategoriesByScheduleGroup(categories), [categories]);
  const groupedCategoryDefs = useMemo(
    () =>
      groupCategoriesByScheduleGroup(
        categoryDefs.slice().sort((a, b) => a.sortOrder - b.sortOrder),
      ),
    [categoryDefs],
  );
  const defaultCreateCategory = useMemo(
    () =>
      categories.some((category) => category.name === DEFAULT_SCHEDULE_CATEGORY)
        ? DEFAULT_SCHEDULE_CATEGORY
        : categories[0]?.name ?? defaultForm.category,
    [categories],
  );
  const [newCategory, setNewCategory] = useState<{ name: string; color: string }>({
    name: "",
    color: CATEGORY_VISUALS[0].twClass,
  });
  const [dateExpenseSummaries, setDateExpenseSummaries] = useState<
    Record<string, MonthlyExpenseSummary>
  >({});
  const [selectedExpenseDateIso, setSelectedExpenseDateIso] = useState(() =>
    format(new Date(), "yyyy-MM-dd"),
  );
  const [expenseSummaryRefreshKey, setExpenseSummaryRefreshKey] = useState(0);
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

  const timeGridSlots = useMemo(() => getTimeGridSlots(timeGranularity), [timeGranularity]);

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

  useEffect(() => {
    if ((viewMode !== "month" && viewMode !== "week") || displayDates.length === 0) {
      return;
    }

    let cancelled = false;
    const rangeStart = format(displayDates[0], "yyyy-MM-dd");
    const rangeEnd = format(displayDates[displayDates.length - 1], "yyyy-MM-dd");

    async function loadVisibleExpenseSummaries() {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (cancelled) return;
      if (sessionError || !session?.user) {
        setDateExpenseSummaries({});
        return;
      }

      const [expensesResult, budgetsResult] = await Promise.all([
        supabase
          .from("expenses")
          .select("amount,expense_date")
          .eq("user_id", session.user.id)
          .gte("expense_date", rangeStart)
          .lte("expense_date", rangeEnd),
        supabase
          .from("daily_budgets")
          .select("amount,budget_date")
          .eq("user_id", session.user.id)
          .gte("budget_date", rangeStart)
          .lte("budget_date", rangeEnd),
      ]);

      if (cancelled) return;
      if (expensesResult.error || budgetsResult.error) {
        console.error("Failed to load visible expense summaries", {
          expensesError: expensesResult.error,
          budgetsError: budgetsResult.error,
        });
        setDateExpenseSummaries({});
        return;
      }

      const nextSummaries: Record<string, MonthlyExpenseSummary> = {};

      for (const row of (expensesResult.data ?? []) as ExpenseSummaryRow[]) {
        const current = nextSummaries[row.expense_date] ?? {
          totalExpense: 0,
          dailyBudget: null,
        };
        current.totalExpense = normalizeMoneyValue(current.totalExpense + Number(row.amount));
        nextSummaries[row.expense_date] = current;
      }

      for (const row of (budgetsResult.data ?? []) as DailyBudgetSummaryRow[]) {
        const current = nextSummaries[row.budget_date] ?? {
          totalExpense: 0,
          dailyBudget: null,
        };
        current.dailyBudget = normalizeMoneyValue(Number(row.amount));
        nextSummaries[row.budget_date] = current;
      }

      setDateExpenseSummaries(nextSummaries);
    }

    void loadVisibleExpenseSummaries();

    return () => {
      cancelled = true;
    };
  }, [displayDates, expenseSummaryRefreshKey, viewMode]);

  const expandedEvents = useMemo(() => {
    if (displayDates.length === 0) return [] as ScheduleEvent[];
    const first = format(addDays(displayDates[0], -1), "yyyy-MM-dd");
    const last = format(displayDates[displayDates.length - 1], "yyyy-MM-dd");
    return expandScheduleEvents(events, first, last) as ScheduleEvent[];
  }, [displayDates, events]);

  const displayDateKeys = useMemo(
    () => new Set(displayDates.map((date) => format(date, "yyyy-MM-dd"))),
    [displayDates],
  );

  const displayEventSegments = useMemo(
    () =>
      expandedEvents
        .flatMap((event) => splitScheduleEventByDay(event))
        .filter((segment) => displayDateKeys.has(segment.displayDate)),
    [displayDateKeys, expandedEvents],
  );

  const timelineDayLayouts = useMemo<TimelineDayLayout[]>(() => {
    if (viewMode === "month") return [];

    const eventsByDate = new Map<string, TimelineEventSegment[]>();
    displayEventSegments.forEach((event) => {
      const dayEvents = eventsByDate.get(event.displayDate) ?? [];
      dayEvents.push(event);
      eventsByDate.set(event.displayDate, dayEvents);
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
  }, [displayDates, displayEventSegments, viewMode]);

  const timelineGridTemplateColumns = useMemo(
    () => `${viewMode === "day" ? 72 : 56}px repeat(${timelineDayLayouts.length}, minmax(0, 1fr))`,
    [timelineDayLayouts.length, viewMode],
  );

  const selectedEvent = useMemo(
    () => expandedEvents.find((event) => event.id === editingEventId) ?? null,
    [editingEventId, expandedEvents],
  );
  const todayIso = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const weekExpenseDateOptions = useMemo(
    () =>
      viewMode === "week"
        ? displayDates.map((date) => ({ date, dateIso: format(date, "yyyy-MM-dd") }))
        : [],
    [displayDates, viewMode],
  );
  const selectedWeekExpenseDateIso = useMemo(() => {
    if (viewMode !== "week" || weekExpenseDateOptions.length === 0) return null;
    const visibleDateKeys = new Set(weekExpenseDateOptions.map((item) => item.dateIso));
    if (visibleDateKeys.has(selectedExpenseDateIso)) return selectedExpenseDateIso;
    if (visibleDateKeys.has(todayIso)) return todayIso;
    return weekExpenseDateOptions[0]?.dateIso ?? null;
  }, [selectedExpenseDateIso, todayIso, viewMode, weekExpenseDateOptions]);
  const activeDayIso = viewMode === "day" ? format(currentWeekStart, "yyyy-MM-dd") : null;
  const activeExpenseDateIso = activeDayIso ?? selectedWeekExpenseDateIso;
  const activeExpenseTitle = viewMode === "week" ? "选中日期花销" : "日期花销";

  const gridTemplateRows = timeGridSlots
    .map((slot) => `${(slot.durationMinutes / minutesPerHour) * hourCellHeight}px`)
    .join(" ");

  function handleViewModeChange(mode: ViewMode) {
    onViewModeChange?.(mode);
  }

  function handleGranularityChange(value: string | null) {
    if (!value) return;
    const granularity = value === "45-15" || value === "50-10" ? value : Number(value);
    onTimeGranularityChange?.(granularity as TimeGranularity);
  }

  function handleExpenseChanged() {
    setExpenseSummaryRefreshKey((value) => value + 1);
  }

  function getEventStyle(event: PositionedScheduleEvent) {
    const top = event.startHour * hourCellHeight + 4;
    const height = (event.endHour - event.startHour) * hourCellHeight - 8;
    const minHeight = event.laneCount === 1 ? 30 : 34;
    if (event.laneCount === 1) {
      return {
        top: `${top}px`,
        height: `${Math.max(height, minHeight)}px`,
        left: "4px",
        width: "calc(100% - 8px)",
      };
    }

    const laneWidthPercent = 100 / event.laneCount;
    const leadingInset = event.lane === 0 ? 4 : 2;
    const trailingInset = event.lane === event.laneCount - 1 ? 4 : 2;

    return {
      top: `${top}px`,
      height: `${Math.max(height, minHeight)}px`,
      left: `calc(${event.lane * laneWidthPercent}% + ${leadingInset}px)`,
      width: `calc(${laneWidthPercent}% - ${leadingInset + trailingInset}px)`,
      zIndex: event.lane + 1,
    };
  }

  function getDefaultCreateTimeRange(cell: GridCell) {
    const cellStartHour = normalizeStartTimeValue(cell.startHour);
    const selectedSlot = timeGridSlots.find(
      (slot) => Math.abs(slot.startHour - cellStartHour) < 0.0001,
    );
    const defaultDurationHour = (selectedSlot?.durationMinutes ?? 60) / minutesPerHour;
    const cellEndHour = Math.min(hoursPerDay, cellStartHour + defaultDurationHour);
    let startHour = cellStartHour;
    let nextBusyStartHour: number | null = null;
    const dayEvents = displayEventSegments
      .filter((event) => event.displayDate === cell.date)
      .sort((a, b) => {
        if (a.startHour !== b.startHour) return a.startHour - b.startHour;
        return a.endHour - b.endHour;
      });

    for (const event of dayEvents) {
      if (event.endHour <= startHour) continue;
      if (event.startHour > startHour) {
        nextBusyStartHour = event.startHour;
        break;
      }
      startHour = Math.max(startHour, event.endHour);
    }

    startHour = normalizeStartTimeValue(startHour);
    const endBoundary =
      nextBusyStartHour === null ? cellEndHour : Math.min(cellEndHour, nextBusyStartHour);
    const endHour =
      startHour < endBoundary
        ? endBoundary
        : Math.min(hoursPerDay, startHour + defaultDurationHour);

    return resolveFormTimeRange(startHour, endHour);
  }

  function resetCreateDialog(cell: GridCell) {
    const { startHour, endHour } = getDefaultCreateTimeRange(cell);
    setSelectedCell({ ...cell, startHour });
    const day = parse(cell.date, "yyyy-MM-dd", new Date());
    setCreateForm({
      ...defaultForm,
      startHour,
      endHour,
      category: defaultCreateCategory,
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

  function handleCreateEvent(alsoCreateDailyTask = false) {
    if (!selectedCell || !createForm.title.trim()) return;

    const { startHour, endHour } = resolveFormTimeRange(createForm.startHour, createForm.endHour);

    if (createRecurrence.enabled && createRecurrence.kind === "weekly" && createRecurrence.weekdays.length === 0) {
      toast.error("每周重复至少要选择一个星期。");
      return;
    }

    const linkedDailyTaskId = alsoCreateDailyTask
      ? onCreateDailyTask(createForm.title.trim(), selectedCell.date)
      : null;

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
      ...(linkedDailyTaskId ? { linkedDailyTaskId } : {}),
    };

    if (createRecurrence.enabled) {
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

    if (linkedDailyTaskId) {
      toast.success("已创建行程并加入当日日常任务");
    }

    setCreateDialogOpen(false);
  }

  function handleSaveEdit() {
    if (!selectedEvent || !editForm.title.trim()) return;

    const { startHour, endHour } = resolveFormTimeRange(editForm.startHour, editForm.endHour);

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

  function handleAddSelectedEventToDailyTask() {
    if (!selectedEvent || selectedEvent.linkedDailyTaskId) return;
    const linkedDailyTaskId = onCreateDailyTask(selectedEvent.title, selectedEvent.date);
    if (!linkedDailyTaskId) return;

    const parsed = parseSyntheticEventId(selectedEvent.id);
    onUpdateEvent(
      selectedEvent.id,
      { linkedDailyTaskId },
      parsed ? { scope: "occurrence" } : undefined,
    );
    toast.success("已加入当日日常任务");
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
      time: formatEventTimeRange(target),
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

    const duration = getScheduleEventDurationHour(source);
    const nextStartHour = normalizeStartTimeValue(targetHour);
    const nextEndHour = getEndHourFromStartAndDuration(nextStartHour, duration);

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
      const duration = getScheduleEventDurationHour(target);
      onUpdateEvent(eventId, {
        endHour: getEndHourFromStartAndDuration(target.startHour, duration + 1),
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
    const name = normalizeCategoryName(newCategory.name.trim());
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
    const name = normalizeCategoryName(editingCategoryName.trim());
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
                  <SelectItem value="45-15">45 + 15 分钟</SelectItem>
                  <SelectItem value="50-10">50 + 10 分钟</SelectItem>
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
                  {timeGridSlots.map((slot) => {
                    const isMainHour = Number.isInteger(slot.startHour);
                    return (
                      <div
                        key={`hour-label-${slot.startHour}`}
                        className={`border-r border-b px-1.5 py-1 text-xs ${isMainHour ? "border-gray-200 bg-gray-50 text-gray-500" : "border-gray-100 text-gray-400"}`}
                        style={{
                          height: `${(slot.durationMinutes / minutesPerHour) * hourCellHeight}px`,
                          borderBottomStyle: isMainHour ? "solid" : "dashed",
                        }}
                      >
                        {isMainHour ? formatHour(slot.startHour) : ""}
                      </div>
                    );
                  })}
                </div>

                {timelineDayLayouts.map((dayLayout) => {
                  return (
                    <div key={dayLayout.dateIso} className="relative border-r border-gray-200 last:border-r-0">
                      <div
                        className="grid"
                        style={{ gridTemplateRows }}
                      >
                        {timeGridSlots.map((slot) => {
                          const isMainHour = Number.isInteger(slot.startHour);
                          return (
                            <button
                              key={`${dayLayout.dateIso}-${slot.startHour}`}
                              type="button"
                              className={`border-b transition-colors hover:bg-gray-50 ${isMainHour ? "border-gray-200" : "border-gray-100"}`}
                              style={{
                                height: `${(slot.durationMinutes / minutesPerHour) * hourCellHeight}px`,
                                borderBottomStyle: isMainHour ? "solid" : "dashed",
                              }}
                              onClick={() => {
                                setSelectedExpenseDateIso(dayLayout.dateIso);
                                resetCreateDialog({ date: dayLayout.dateIso, startHour: slot.startHour });
                              }}
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={() => handleDropEvent(dayLayout.dateIso, slot.startHour)}
                            />
                          );
                        })}
                      </div>

                      <div className="pointer-events-none absolute inset-0 p-1">
                        {dayLayout.events.map((event) => {
                          const sourceEvent = toSourceScheduleEvent(event);
                          const durationHour = getScheduleEventDurationHour(event);
                          const denseCard = event.laneCount > 1;
                          const compactCard = durationHour < 0.55;
                          const mediumCard = durationHour < 1;
                          const showDetails = durationHour >= 2 && !denseCard;
                          const timeLabel = formatTimelineSegmentTimeRange(event);
                          const fullTimeLabel = formatEventTimeRange(sourceEvent);
                          const categoryVisual = getCategoryVisualByName(event.category);
                          const segmentLabel =
                            event.segmentRole === "starts"
                              ? "跨日"
                              : event.segmentRole === "continues"
                                ? "延续"
                                : null;
                          return (
                            <div
                              key={event.segmentId}
                              className={`pointer-events-auto absolute group flex min-h-0 flex-col overflow-hidden rounded-lg border text-left text-sm shadow-[0_3px_10px_rgba(68,64,60,0.08)] ring-1 ring-white/70 transition-[border-color,box-shadow,transform] duration-150 hover:z-40 hover:-translate-y-px hover:shadow-[0_8px_20px_rgba(68,64,60,0.12)] focus-within:z-40 ${getCategoryColor(categories, event.category)} ${event.isCompleted ? "border-dashed saturate-[0.96]" : ""}`}
                              style={getEventStyle(event)}
                              draggable={!parseSyntheticEventId(event.id)}
                              onDragStart={() => setDraggingEventId(event.id)}
                              onDragEnd={() => setDraggingEventId(null)}
                              onContextMenu={(mouseEvent) => handleContextMenu(mouseEvent, event.id)}
                            >
                              <div
                                className={`pointer-events-none absolute inset-y-1 left-1 w-1 rounded-full ${getCategoryAccentColor(event.category)} ${event.isCompleted ? "opacity-80" : "opacity-95"}`}
                              />
                              {event.isCompleted ? (
                                <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.22)_0px,rgba(255,255,255,0.22)_1px,transparent_1px,transparent_8px)]" />
                              ) : null}
                              <button
                                type="button"
                                className={`relative z-10 flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden rounded-[inherit] text-left outline-none focus-visible:ring-2 focus-visible:ring-stone-900/20 ${
                                  compactCard
                                    ? "justify-start pb-1.5 pl-4 pr-6 pt-1.5"
                                    : mediumCard
                                      ? "justify-start py-1.5 pl-5 pr-7"
                                      : "justify-start py-2 pl-5 pr-8"
                                }`}
                                onClick={() => handleOpenEdit(sourceEvent)}
                              >
                                <div className={`flex min-h-0 min-w-0 flex-col ${compactCard ? "gap-0.5" : mediumCard ? "flex-1 gap-1" : "flex-1 gap-1.5"}`}>
                                  {compactCard ? (
                                    <div className="flex min-w-0 items-start gap-1.5">
                                      <span
                                        className="shrink-0 whitespace-nowrap rounded-md border border-white/65 bg-white/70 px-1.5 py-0.5 text-[11px] font-semibold leading-tight text-gray-800 shadow-[0_1px_2px_rgba(68,64,60,0.05)] [font-variant-numeric:tabular-nums]"
                                        title={fullTimeLabel}
                                      >
                                        {timeLabel}
                                      </span>
                                      <span
                                        className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-white/65"
                                        title={categoryVisual.name}
                                      >
                                        <CategoryIcon visual={categoryVisual} className="h-3 w-3" />
                                      </span>
                                      {segmentLabel ? (
                                        <span className="mt-0.5 shrink-0 rounded-full border border-white/60 bg-white/55 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-gray-600">
                                          {segmentLabel}
                                        </span>
                                      ) : null}
                                      {event.tag ? (
                                        <span className={`mt-0.5 shrink-0 text-sm font-bold leading-none ${getTagInfo(event.tag).color}`}>
                                          {getTagInfo(event.tag).icon}
                                        </span>
                                      ) : null}
                                      {parseSyntheticEventId(event.id) ? (
                                        <Repeat className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-600" aria-hidden />
                                      ) : null}
                                      <p
                                        className={`min-w-0 flex-1 truncate text-[13px] font-semibold leading-snug ${event.isCompleted ? "line-through decoration-2 decoration-current/55" : ""}`}
                                        title={`${event.title} (${fullTimeLabel})`}
                                      >
                                        {event.title}
                                      </p>
                                      {event.isCompleted ? (
                                        <span
                                          className="inline-flex shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-white/80 p-0.5 text-emerald-700 shadow-sm"
                                          title="已完成"
                                          aria-label="已完成"
                                        >
                                          <Check className="h-3 w-3" aria-hidden />
                                        </span>
                                      ) : null}
                                    </div>
                                  ) : (
                                    <>
                                      <div className="flex min-w-0 items-center gap-1.5">
                                        <span
                                          className="shrink-0 whitespace-nowrap rounded-md border border-white/65 bg-white/70 px-1.5 py-0.5 text-[11px] font-semibold leading-tight text-gray-800 shadow-[0_1px_2px_rgba(68,64,60,0.05)] [font-variant-numeric:tabular-nums]"
                                          title={fullTimeLabel}
                                        >
                                          {timeLabel}
                                        </span>
                                        <span
                                          className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-white/65"
                                          title={categoryVisual.name}
                                        >
                                          <CategoryIcon visual={categoryVisual} className="h-3 w-3" />
                                        </span>
                                        {segmentLabel ? (
                                          <span className="shrink-0 rounded-full border border-white/60 bg-white/55 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-gray-600">
                                            {segmentLabel}
                                          </span>
                                        ) : null}
                                        {event.tag ? (
                                          <span className={`shrink-0 text-sm font-bold leading-none ${getTagInfo(event.tag).color}`}>
                                            {getTagInfo(event.tag).icon}
                                          </span>
                                        ) : null}
                                        {parseSyntheticEventId(event.id) ? (
                                          <Repeat className="h-3.5 w-3.5 shrink-0 text-gray-600" aria-hidden />
                                        ) : null}
                                        <span className="min-w-0 flex-1" />
                                        {denseCard ? (
                                          <span className="shrink-0 rounded-md border border-white/50 bg-white/45 px-1.5 py-0.5 text-[10px] font-medium leading-none text-gray-700">
                                            {event.lane + 1}/{event.laneCount}
                                          </span>
                                        ) : null}
                                        {event.isCompleted ? (
                                          <span
                                            className="inline-flex shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-white/80 p-0.5 text-emerald-700 shadow-sm"
                                            title="已完成"
                                            aria-label="已完成"
                                          >
                                            <Check className="h-3 w-3" aria-hidden />
                                          </span>
                                        ) : null}
                                      </div>

                                      <p
                                        className={`min-w-0 flex-1 overflow-hidden break-words text-sm font-semibold leading-snug ${
                                          mediumCard || denseCard
                                            ? "[display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]"
                                            : ""
                                        } ${event.isCompleted ? "line-through decoration-2 decoration-current/55" : ""}`}
                                        title={`${event.title} (${fullTimeLabel})`}
                                      >
                                        {event.title}
                                      </p>

                                      {showDetails && event.notes ? (
                                        <p className="min-h-0 overflow-hidden text-[11px] leading-snug text-gray-700/80 [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">
                                          {event.notes}
                                        </p>
                                      ) : null}

                                      {durationHour >= 1.5 && event.requirements.length > 0 ? (
                                        <div className="flex shrink-0 justify-end text-[11px] leading-tight text-gray-700">
                                          <span className="truncate rounded-md border border-white/50 bg-white/45 px-1.5 py-0.5">
                                            {event.requirements.length} 项准备
                                          </span>
                                        </div>
                                      ) : null}
                                    </>
                                  )}
                                </div>
                              </button>

                              <button
                                type="button"
                                className="absolute right-1.5 top-1.5 z-20 rounded-full border border-white/80 bg-white/80 p-1 text-stone-700 opacity-0 shadow-sm transition hover:bg-white hover:text-black group-hover:opacity-100 focus-visible:opacity-100"
                                onClick={(mouseEvent) => {
                                  mouseEvent.stopPropagation();
                                  setSelectedExpenseDateIso(event.displayDate);
                                  resetCreateDialog({ date: event.displayDate, startHour: event.startHour });
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
                  const dayEvents = displayEventSegments.filter((event) => event.displayDate === dayIso);
                  const expenseSummary = dateExpenseSummaries[dayIso] ?? {
                    totalExpense: 0,
                    dailyBudget: null,
                  };
                  const isOverBudget =
                    expenseSummary.dailyBudget !== null &&
                    expenseSummary.totalExpense > expenseSummary.dailyBudget;

                  return (
                    <div
                      key={dayIso}
                      className="flex min-h-[180px] flex-col rounded-lg border border-gray-200 p-2 transition-colors hover:bg-gray-50"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-medium">{format(day, "d")}</span>
                        <button
                          type="button"
                          className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          onClick={() => resetCreateDialog({ date: dayIso, startHour: 9 })}
                          aria-label="新增行程"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="min-h-0 flex-1 space-y-1 overflow-hidden">
                        {dayEvents.length === 0 ? (
                          <span className="text-xs text-gray-400">无行程</span>
                        ) : (
                          dayEvents.map((event) => {
                            const sourceEvent = toSourceScheduleEvent(event);
                            const timeLabel = formatTimelineSegmentTimeRange(event);
                            const fullTimeLabel = formatEventTimeRange(sourceEvent);
                            const segmentLabel =
                              event.segmentRole === "starts"
                                ? "跨日"
                                : event.segmentRole === "continues"
                                  ? "延续"
                                  : null;

                            return (
                              <div
                                key={event.segmentId}
                                className={`cursor-pointer rounded border px-2 py-1 text-xs ${getCategoryColor(categories, event.category)}`}
                                title={`${event.title} (${fullTimeLabel})`}
                                onClick={() => handleOpenEdit(sourceEvent)}
                              >
                                <div className="flex min-w-0 items-center gap-1">
                                  {event.isCompleted ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" /> : null}
                                  <span className="shrink-0 text-[10px] font-semibold text-gray-600">{timeLabel}</span>
                                  {segmentLabel ? (
                                    <span className="shrink-0 rounded-full bg-white/60 px-1 text-[10px] font-semibold text-gray-500">
                                      {segmentLabel}
                                    </span>
                                  ) : null}
                                  <span className={`min-w-0 truncate ${event.isCompleted ? "line-through decoration-2" : ""}`}>{event.title}</span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                      <div
                        className={`mt-2 flex min-h-5 items-center justify-between gap-1 rounded-md border px-1.5 py-0.5 text-[11px] leading-none ${
                          isOverBudget
                            ? "border-rose-200 bg-rose-50 text-rose-700"
                            : "border-stone-200 bg-stone-50 text-stone-600"
                        }`}
                        title={isOverBudget ? "当日花销已超支" : "当日花销摘要"}
                      >
                        <span className="min-w-0 truncate font-medium">
                          {getMonthlyExpenseLabel(expenseSummary)}
                        </span>
                        {isOverBudget ? (
                          <span className="shrink-0 rounded-sm bg-rose-100 px-1 py-0.5 font-semibold">
                            超支
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {viewMode === "week" && selectedWeekExpenseDateIso ? (
            <div className="border-t border-gray-200 bg-white px-4 py-4 sm:px-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-stone-950">本周花销</h3>
                  <p className="mt-0.5 text-xs text-stone-500">选择日期后在下方记录支出和预算</p>
                </div>
                <span className="rounded-md border border-stone-200 bg-stone-50 px-2 py-1 text-xs font-medium text-stone-600">
                  {selectedWeekExpenseDateIso}
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
                {weekExpenseDateOptions.map(({ date, dateIso }) => {
                  const summary = dateExpenseSummaries[dateIso] ?? {
                    totalExpense: 0,
                    dailyBudget: null,
                  };
                  const isSelected = selectedWeekExpenseDateIso === dateIso;
                  const isOverBudget =
                    summary.dailyBudget !== null && summary.totalExpense > summary.dailyBudget;

                  return (
                    <button
                      key={dateIso}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setSelectedExpenseDateIso(dateIso)}
                      className={`min-h-20 rounded-lg border px-3 py-2 text-left transition ${
                        isSelected
                          ? "border-stone-900 bg-stone-950 text-white shadow-sm"
                          : "border-stone-200 bg-stone-50 text-stone-700 hover:border-stone-300 hover:bg-white"
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-medium opacity-80">
                          {format(date, "M/d")} {format(date, "EEE", { locale: zhCN })}
                        </span>
                        {isOverBudget ? (
                          <span
                            className={`shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold ${
                              isSelected ? "bg-white/15 text-white" : "bg-rose-100 text-rose-700"
                            }`}
                          >
                            超支
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-2 block truncate text-base font-semibold">
                        {getMonthlyExpenseLabel(summary)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          {activeExpenseDateIso ? (
            <DailyExpensePanel
              date={activeExpenseDateIso}
              title={activeExpenseTitle}
              onChanged={handleExpenseChanged}
            />
          ) : null}
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
                      <SelectTrigger className="w-full justify-between rounded-md border-gray-300 sm:max-w-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent
                        align="start"
                        alignItemWithTrigger={false}
                        sideOffset={6}
                        className="max-h-72 min-w-64"
                      >
                        {groupedCategories.map(({ group, categories: groupItems }) => (
                          <SelectGroup key={group}>
                            <SelectLabel className="px-2 py-1.5 text-[11px] font-semibold text-stone-500">
                              {SCHEDULE_CATEGORY_GROUP_LABELS[group]}
                            </SelectLabel>
                            {groupItems.map((category) => (
                              <SelectItem key={category.id} value={category.name}>
                                <CategorySelectLabel category={category} />
                              </SelectItem>
                            ))}
                          </SelectGroup>
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
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleCreateEvent(true)}
                      disabled={!createForm.title.trim()}
                    >
                      创建并加入当日任务
                    </Button>
                    <Button type="button" onClick={() => handleCreateEvent()} disabled={!createForm.title.trim()}>
                      创建行程
                    </Button>
                  </div>
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
                      <SelectTrigger className="w-full justify-between rounded-md border-gray-300 sm:max-w-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent
                        align="start"
                        alignItemWithTrigger={false}
                        sideOffset={6}
                        className="max-h-72 min-w-64"
                      >
                        {groupedCategories.map(({ group, categories: groupItems }) => (
                          <SelectGroup key={group}>
                            <SelectLabel className="px-2 py-1.5 text-[11px] font-semibold text-stone-500">
                              {SCHEDULE_CATEGORY_GROUP_LABELS[group]}
                            </SelectLabel>
                            {groupItems.map((category) => (
                              <SelectItem key={category.id} value={category.name}>
                                <CategorySelectLabel category={category} />
                              </SelectItem>
                            ))}
                          </SelectGroup>
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

                  {selectedEvent.linkedDailyTaskId ? (
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                      <Check className="h-4 w-4" aria-hidden />
                      已加入当日日常任务
                    </div>
                  ) : (
                    <Button type="button" variant="outline" className="w-full" onClick={handleAddSelectedEventToDailyTask}>
                      <Plus className="h-4 w-4" />
                      加入当日任务
                    </Button>
                  )}

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

                  <div className="max-h-[46vh] space-y-4 overflow-y-auto px-5 pb-5 pr-3 md:max-h-[58vh]">
                    {groupedCategoryDefs.map(({ group, categories: groupItems }) => (
                      <div key={group} className="space-y-2">
                        <p className="px-1 text-[11px] font-semibold text-stone-500">
                          {SCHEDULE_CATEGORY_GROUP_LABELS[group]}
                        </p>
                        {groupItems.map((category) => {
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
                    ))}
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

function HourChoiceGrid({
  value,
  options,
  ariaLabel,
  onChange,
}: {
  value: number;
  options: number[];
  ariaLabel: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="grid grid-cols-6 gap-1" role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const selected = value === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            aria-label={`${ariaLabel} ${option.toString().padStart(2, "0")}`}
            onClick={() => onChange(option)}
            className={`h-8 rounded-md border font-mono text-xs font-semibold transition ${
              selected
                ? "border-stone-900 bg-stone-900 text-white shadow-sm"
                : "border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50"
            }`}
          >
            {option.toString().padStart(2, "0")}
          </button>
        );
      })}
    </div>
  );
}

function MinuteShortcutGroup({
  value,
  availableMinutes,
  ariaPrefix,
  onChange,
}: {
  value: number;
  availableMinutes: number[];
  ariaPrefix: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {quickMinuteOptions.map((minute) => {
        const disabled = !availableMinutes.includes(minute);
        const selected = value === minute;
        return (
          <button
            key={minute}
            type="button"
            disabled={disabled}
            aria-label={`${ariaPrefix}${minute.toString().padStart(2, "0")} 分`}
            onClick={() => onChange(minute)}
            className={`h-8 rounded-md border px-2 font-mono text-xs font-semibold transition ${
              selected
                ? "border-stone-900 bg-stone-900 text-white shadow-sm"
                : "border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50"
            } disabled:cursor-not-allowed disabled:border-stone-100 disabled:bg-stone-50 disabled:text-stone-300`}
          >
            {minute.toString().padStart(2, "0")}
          </button>
        );
      })}
    </div>
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
  const startParts = getTimeSelectParts(startHour);
  const endParts = getTimeSelectParts(endHour, true);
  const endMinuteOptions = endParts.hours === 24 ? [0] : minuteOptions;
  const crossesMidnight = endHour < startHour;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3">
        <div className="flex items-center justify-between gap-3">
          <Label className="text-xs font-semibold uppercase tracking-wide text-stone-600">
            开始时间
          </Label>
          <span className="rounded-md bg-white px-2.5 py-1 font-mono text-lg font-semibold leading-none text-stone-950 shadow-sm">
            {formatHour(startHour)}
          </span>
        </div>
        <div className="mt-3 space-y-2">
          <HourChoiceGrid
            value={startParts.hours}
            options={hourOptions}
            ariaLabel="开始时间小时"
            onChange={(hours) =>
              onStartHourChange(getTimeValueFromParts(hours, startParts.minutes))
            }
          />
          <MinuteShortcutGroup
            value={startParts.minutes}
            availableMinutes={minuteOptions}
            ariaPrefix="设置开始时间为"
            onChange={(minutes) =>
              onStartHourChange(getTimeValueFromParts(startParts.hours, minutes))
            }
          />
          <div className="flex items-center gap-2">
            <Label htmlFor="start-minute-input" className="shrink-0 text-xs text-stone-600">分钟</Label>
            <Input
              id="start-minute-input"
              type="number"
              min="0"
              max="59"
              value={startParts.minutes}
              onChange={(event) => {
                const minutes = Number(event.target.value);
                if (Number.isFinite(minutes)) {
                  onStartHourChange(getTimeValueFromParts(startParts.hours, Math.max(0, Math.min(59, minutes))));
                }
              }}
              className="h-8 font-mono text-xs"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3">
        <div className="flex items-center justify-between gap-3">
          <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-600">
            结束时间
            {crossesMidnight ? (
              <span className="rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-sky-700">
                次日
              </span>
            ) : null}
          </Label>
          <span className="rounded-md bg-white px-2.5 py-1 font-mono text-lg font-semibold leading-none text-stone-950 shadow-sm">
            {formatHour(endHour)}
          </span>
        </div>
        <div className="mt-3 space-y-2">
          <HourChoiceGrid
            value={endParts.hours}
            options={endHourOptions}
            ariaLabel="结束时间小时"
            onChange={(hours) =>
              onEndHourChange(getTimeValueFromParts(hours, endParts.minutes, true))
            }
          />
          <MinuteShortcutGroup
            value={endParts.minutes}
            availableMinutes={endMinuteOptions}
            ariaPrefix="设置结束时间为"
            onChange={(minutes) =>
              onEndHourChange(getTimeValueFromParts(endParts.hours, minutes, true))
            }
          />
          <div className="flex items-center gap-2">
            <Label htmlFor="end-minute-input" className="shrink-0 text-xs text-stone-600">分钟</Label>
            <Input
              id="end-minute-input"
              type="number"
              min="0"
              max="59"
              value={endParts.minutes}
              disabled={endParts.hours === 24}
              onChange={(event) => {
                const minutes = Number(event.target.value);
                if (Number.isFinite(minutes)) {
                  onEndHourChange(getTimeValueFromParts(endParts.hours, Math.max(0, Math.min(59, minutes)), true));
                }
              }}
              className="h-8 font-mono text-xs"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
