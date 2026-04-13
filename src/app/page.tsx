/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, addWeeks, format, startOfWeek } from "date-fns";
import { zhCN } from "date-fns/locale";
import type { User } from "@supabase/supabase-js";
import { TaskDashboard } from "@/components/schedule/task-dashboard";
import { WeeklyTimeGrid, ViewMode, TimeGranularity } from "@/components/schedule/weekly-time-grid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createId } from "@/lib/id";
import {
  type RecurrenceConfig,
  type RecurrenceInstanceOverride,
  parseSyntheticEventId,
  pickRecurrenceOverridePatch,
} from "@/lib/recurrence";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { CalendarDays, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";

export type EventTag = "待定" | "不着急" | "不可后退" | null;

export type ScheduleEvent = {
  id: string;
  date: string;
  startHour: number;
  endHour: number;
  title: string;
  notes: string;
  requirements: string[];
  isCompleted: boolean;
  category: string;
  tag: EventTag;
  /** 仅主事件（非展开实例）使用 */
  recurrence?: RecurrenceConfig | null;
  exceptionDates?: string[];
  recurrenceOverrides?: Record<string, RecurrenceInstanceOverride>;
  recurrenceEndExclusive?: string | null;
};

export type SubTask = {
  id: string;
  name: string;
  done: boolean;
};

export type Priority = '紧急且重要' | '紧急不重要' | '不紧急重要' | '不紧急不重要';

export type LongTask = {
  id: string;
  name: string;
  dueDate: string;
  done: boolean;
  notes: string;
  precautions: string[];
  completionLog: string;
  priority: Priority;
  subtasks: SubTask[];
};

export type AnnualTask = {
  id: string;
  name: string;
  done: boolean;
};

export type ProjectCheckin = {
  id: string;
  name: string;
  description: string;
  startDate: string;
  checkins: { date: string; note: string }[];
};

export type FootprintItem = {
  id: string;
  name: string;
  lastDate: string;
};

const defaultTasks: LongTask[] = [
  {
    id: "task-1",
    name: "重构个人周计划模板",
    dueDate: "2026-04-12",
    done: false,
    notes: "",
    precautions: [],
    completionLog: "",
    priority: "不紧急重要",
    subtasks: [],
  },
  {
    id: "task-2",
    name: "整理读书笔记并归档",
    dueDate: "2026-04-13",
    done: true,
    notes: "已完成初版梳理，待归档。",
    precautions: ["避免重复分类"],
    completionLog: "2026-04-08 完成并同步到知识库",
    priority: "不紧急不重要",
    subtasks: [],
  },
  {
    id: "task-3",
    name: "准备周四项目演示材料",
    dueDate: "2026-04-14",
    done: false,
    notes: "",
    precautions: [],
    completionLog: "",
    priority: "紧急且重要",
    subtasks: [],
  },
  {
    id: "task-4",
    name: "检查本周账单与报销",
    dueDate: "2026-04-15",
    done: false,
    notes: "",
    precautions: [],
    completionLog: "",
    priority: "紧急不重要",
    subtasks: [],
  },
];

const defaultEvents: ScheduleEvent[] = [
  {
    id: "evt-1",
    date: "2026-04-09",
    startHour: 8,
    endHour: 10,
    title: "晨间复盘",
    notes: "明确今日优先级，更新待办。",
    requirements: ["安静环境", "关闭即时通讯"],
    isCompleted: false,
    category: "个人",
    tag: null,
  },
];

function getCurrentWeekStart() {
  return startOfWeek(new Date(), { weekStartsOn: 1 });
}

function normalizeAnnualTasks(payload: unknown): AnnualTask[] {
  if (!Array.isArray(payload)) return [];
  return payload.map((item, index) => {
    const value = item as Partial<AnnualTask>;
    return {
      id: value.id ?? `annual-restored-${index}`,
      name: typeof value.name === "string" ? value.name : "未命名年度任务",
      done: Boolean(value.done),
    };
  });
}

function normalizeProjectCheckins(payload: unknown): ProjectCheckin[] {
  if (!Array.isArray(payload)) return [];
  return payload.map((item, index) => {
    const value = item as Partial<ProjectCheckin>;
    const checkins = Array.isArray(value.checkins)
      ? value.checkins
          .map((checkin) => ({
            date: typeof checkin.date === "string" ? checkin.date : "",
            note: typeof checkin.note === "string" ? checkin.note : "",
          }))
          .filter((checkin) => checkin.date.length > 0)
      : [];
    return {
      id: value.id ?? `project-restored-${index}`,
      name: typeof value.name === "string" ? value.name : "未命名项目",
      description: typeof value.description === "string" ? value.description : "",
      startDate:
        typeof value.startDate === "string"
          ? value.startDate
          : new Date().toISOString().slice(0, 10),
      checkins,
    };
  });
}

function normalizeFootprints(payload: unknown): FootprintItem[] {
  if (!Array.isArray(payload)) return [];
  return payload.map((item, index) => {
    const value = item as Partial<FootprintItem>;
    return {
      id: value.id ?? `footprint-restored-${index}`,
      name: typeof value.name === "string" ? value.name : "未命名足迹",
      lastDate:
        typeof value.lastDate === "string"
          ? value.lastDate
          : new Date().toISOString().slice(0, 10),
    };
  });
}

function normalizeTasks(payload: unknown): LongTask[] {
  if (!Array.isArray(payload)) return defaultTasks;
  return payload.map((task, index) => {
    const value = task as Partial<LongTask>;
    return {
      id: value.id ?? `task-restored-${index}`,
      name: value.name ?? "未命名任务",
      dueDate: value.dueDate ?? getCurrentWeekStart().toISOString().slice(0, 10),
      done: Boolean(value.done),
      notes: value.notes ?? "",
      precautions: Array.isArray(value.precautions)
        ? value.precautions.filter((item): item is string => typeof item === "string")
        : [],
      completionLog: value.completionLog ?? "",
      priority: (value.priority as Priority) ?? "不紧急不重要",
      subtasks: Array.isArray(value.subtasks)
        ? value.subtasks.map((subtask, subIndex) => ({
            id: subtask.id ?? `subtask-${index}-${subIndex}`,
            name: subtask.name ?? `子任务 ${subIndex + 1}`,
            done: Boolean(subtask.done),
          }))
        : [],
    };
  });
}

function normalizeRecurrence(value: unknown): RecurrenceConfig | undefined {
  if (!value || typeof value !== "object") return undefined;
  const r = value as { kind?: string; weekdays?: unknown };
  if (r.kind === "daily") return { kind: "daily" };
  if (r.kind === "weekly") {
    const weekdays = Array.isArray(r.weekdays)
      ? r.weekdays.filter((d): d is number => typeof d === "number" && d >= 0 && d <= 6)
      : [];
    return { kind: "weekly", weekdays };
  }
  return undefined;
}

function normalizeEvents(payload: unknown): ScheduleEvent[] {
  if (!Array.isArray(payload)) return defaultEvents;
  return payload.map((event, index) => {
    const value = event as Partial<ScheduleEvent>;
    const recurrence = normalizeRecurrence(value.recurrence);
    const overridesRaw = value.recurrenceOverrides;
    const recurrenceOverrides =
      overridesRaw && typeof overridesRaw === "object" && !Array.isArray(overridesRaw)
        ? (overridesRaw as Record<string, RecurrenceInstanceOverride>)
        : {};
    return {
      id: value.id ?? `event-restored-${index}`,
      date: value.date ?? format(new Date(), "yyyy-MM-dd"),
      startHour: typeof value.startHour === "number" ? value.startHour : 9,
      endHour: typeof value.endHour === "number" ? value.endHour : 10,
      title: value.title ?? "未命名行程",
      notes: value.notes ?? "",
      requirements: Array.isArray(value.requirements)
        ? value.requirements.filter((item): item is string => typeof item === "string")
        : [],
      isCompleted: Boolean(value.isCompleted),
      category: value.category ?? "个人",
      tag: (value.tag as EventTag) ?? null,
      recurrence: recurrence ?? undefined,
      exceptionDates: Array.isArray(value.exceptionDates)
        ? value.exceptionDates.filter((item): item is string => typeof item === "string")
        : [],
      recurrenceOverrides,
      recurrenceEndExclusive:
        typeof value.recurrenceEndExclusive === "string" ? value.recurrenceEndExclusive : null,
    };
  });
}

export default function Home() {
  const [isBooted, setIsBooted] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getCurrentWeekStart);
  const [events, setEvents] = useState<ScheduleEvent[]>(defaultEvents);
  const [tasks, setTasks] = useState<LongTask[]>(defaultTasks);
  const [annualTasks, setAnnualTasks] = useState<AnnualTask[]>([]);
  const [projectCheckins, setProjectCheckins] = useState<ProjectCheckin[]>([]);
  const [footprints, setFootprints] = useState<FootprintItem[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [sendingLink, setSendingLink] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [timeGranularity, setTimeGranularity] = useState<TimeGranularity>(60);
  const [mobileTab, setMobileTab] = useState<"schedule" | "tasks">("schedule");
  const weekRange = useMemo(() => {
    const start = format(currentWeekStart, "yyyy/MM/dd", { locale: zhCN });
    const end = format(addDays(currentWeekStart, 6), "yyyy/MM/dd", { locale: zhCN });
    return `${start} - ${end}`;
  }, [currentWeekStart]);

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setUser(data.session?.user ?? null);
      setIsBooted(true);
    }

    initAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isBooted) return;
    if (!user) {
      setEvents(defaultEvents);
      setTasks(defaultTasks);
      setAnnualTasks([]);
      setProjectCheckins([]);
      setFootprints([]);
      setDataReady(false);
      return;
    }

    let cancelled = false;

    async function createScheduleDataTable() {
      const { error } = await supabase
        .rpc('postgres_functions', {
          function_name: 'create_schedule_data_table'
        });
      if (error) {
        console.error("创建表失败:", error);
        return false;
      }
      return true;
    }

    async function loadUserData() {
      try {
        if (!user) return;
        const { data, error } = await supabase
          .from("schedule_data")
          .select("events,tasks,annual_tasks,project_checkins,footprints")
          .eq("user_id", user.id)
          .maybeSingle();

        if (cancelled) return;
        if (error) {
          console.error("读取云端数据失败:", error);
          if (error.message.includes("relation \"schedule_data\" does not exist")) {
            toast.info("表不存在，正在创建...");
            const created = await createScheduleDataTable();
            if (created) {
              // 重新尝试加载数据
              await loadUserData();
            } else {
              toast.error("创建表失败");
              setDataReady(true);
            }
          } else {
            toast.error(`读取云端数据失败: ${error.message}`);
            setDataReady(true);
          }
          return;
        }

        if (data) {
          setEvents(normalizeEvents(data.events));
          setTasks(normalizeTasks(data.tasks));
          setAnnualTasks(normalizeAnnualTasks((data as { annual_tasks?: unknown }).annual_tasks));
          setProjectCheckins(
            normalizeProjectCheckins((data as { project_checkins?: unknown }).project_checkins),
          );
          setFootprints(normalizeFootprints((data as { footprints?: unknown }).footprints));
        } else {
          setEvents(defaultEvents);
          setTasks(defaultTasks);
          setAnnualTasks([]);
          setProjectCheckins([]);
          setFootprints([]);
        }
        setDataReady(true);
      } catch (error) {
        console.error("加载数据时出错:", error);
        toast.error("加载数据时出错");
        setDataReady(true);
      }
    }

    loadUserData();
    return () => {
      cancelled = true;
    };
  }, [isBooted, user]);

  useEffect(() => {
    if (!user || !dataReady) return;
    supabase
      .from("schedule_data")
      .upsert(
        {
          user_id: user.id,
          events,
          tasks,
          annual_tasks: annualTasks,
          project_checkins: projectCheckins,
          footprints,
        },
        { onConflict: "user_id" },
      )
      .then(({ error }) => {
        if (error) {
          console.error("保存到云端失败:", error);
          toast.error(`保存到云端失败: ${error.message}`);
        }
      });
  }, [annualTasks, events, footprints, projectCheckins, tasks, user, dataReady]);

  async function handleSendMagicLink() {
    if (!authEmail.trim()) return;
    setSendingLink(true);
    const appUrl =
      typeof process !== "undefined" && process.env.NEXT_PUBLIC_APP_URL
        ? process.env.NEXT_PUBLIC_APP_URL
        : undefined;
    const redirectTo =
      appUrl && appUrl.length > 0
        ? appUrl
        : typeof window !== "undefined"
          ? window.location.origin
          : undefined;

    const { error } = await supabase.auth.signInWithOtp({
      email: authEmail.trim(),
      options: {
        emailRedirectTo: redirectTo,
      },
    });
    setSendingLink(false);
    if (error) {
      toast.error(`发送登录链接失败：${error.message}`);
      return;
    }
    toast.success("登录链接已发送，请检查邮箱");
  }

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(`退出失败：${error.message}`);
      return;
    }
    toast.success("已退出登录");
  }

  function handleGoPrevWeek() {
    if (viewMode === 'day') {
      setCurrentWeekStart((prev) => addDays(prev ?? getCurrentWeekStart(), -1));
    } else if (viewMode === 'week') {
      setCurrentWeekStart((prev) => addWeeks(prev ?? getCurrentWeekStart(), -1));
    } else if (viewMode === 'month') {
      setCurrentWeekStart((prev) => addWeeks(prev ?? getCurrentWeekStart(), -4));
    }
  }

  function handleGoNextWeek() {
    if (viewMode === 'day') {
      setCurrentWeekStart((prev) => addDays(prev ?? getCurrentWeekStart(), 1));
    } else if (viewMode === 'week') {
      setCurrentWeekStart((prev) => addWeeks(prev ?? getCurrentWeekStart(), 1));
    } else if (viewMode === 'month') {
      setCurrentWeekStart((prev) => addWeeks(prev ?? getCurrentWeekStart(), 4));
    }
  }

  function handleViewModeChange(mode: ViewMode) {
    setViewMode(mode);
  }

  function handleTimeGranularityChange(granularity: TimeGranularity) {
    setTimeGranularity(granularity);
  }

  function handleToggleTask(taskId: string) {
    setTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, done: !task.done } : task)),
    );
  }

  function handleAddTask(name: string, dueDate: string) {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setTasks((prev) => [
      ...prev,
      {
        id: createId("task"),
        name: trimmedName,
        dueDate,
        done: false,
        notes: "",
        precautions: [],
        completionLog: "",
        priority: "不紧急不重要",
        subtasks: [],
      },
    ]);
  }

  function handleUpdateTask(taskId: string, patch: Partial<LongTask>) {
    setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, ...patch } : task)));
  }

  function handleDeleteTask(taskId: string) {
    setTasks((prev) => prev.filter((task) => task.id !== taskId));
  }

  function handleReorderTask(sourceTaskId: string, targetTaskId: string) {
    if (!sourceTaskId || !targetTaskId || sourceTaskId === targetTaskId) return;
    setTasks((prev) => {
      const next = [...prev];
      const fromIndex = next.findIndex((task) => task.id === sourceTaskId);
      const toIndex = next.findIndex((task) => task.id === targetTaskId);
      if (fromIndex < 0 || toIndex < 0) return prev;
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  function handleAddAnnualTask(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setAnnualTasks((prev) => [
      ...prev,
      { id: createId("annual"), name: trimmed, done: false },
    ]);
  }

  function handleToggleAnnualTask(taskId: string) {
    setAnnualTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)),
    );
  }

  function handleDeleteAnnualTask(taskId: string) {
    setAnnualTasks((prev) => prev.filter((t) => t.id !== taskId));
  }

  function handleAddProjectCheckin(name: string, description: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setProjectCheckins((prev) => [
      ...prev,
      {
        id: createId("project"),
        name: trimmed,
        description: description.trim(),
        startDate: new Date().toISOString().slice(0, 10),
        checkins: [],
      },
    ]);
  }

  function handleCheckinProject(projectId: string, note: string) {
    const today = new Date().toISOString().slice(0, 10);
    setProjectCheckins((prev) =>
      prev.map((project) => {
        if (project.id !== projectId) return project;
        const exists = project.checkins.find((c) => c.date === today);
        const nextCheckins = exists
          ? project.checkins.map((c) =>
              c.date === today ? { ...c, note: note.trim() } : c,
            )
          : [...project.checkins, { date: today, note: note.trim() }];
        return { ...project, checkins: nextCheckins };
      }),
    );
  }

  function handleDeleteProjectCheckin(projectId: string) {
    setProjectCheckins((prev) => prev.filter((project) => project.id !== projectId));
  }

  function handleAddFootprint(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setFootprints((prev) => [
      ...prev,
      {
        id: createId("footprint"),
        name: trimmed,
        lastDate: new Date().toISOString().slice(0, 10),
      },
    ]);
  }

  function handleResetFootprint(itemId: string) {
    const today = new Date().toISOString().slice(0, 10);
    setFootprints((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, lastDate: today } : item)),
    );
  }

  function handleDeleteFootprint(itemId: string) {
    setFootprints((prev) => prev.filter((item) => item.id !== itemId));
  }

  function handleCreateEvent(event: ScheduleEvent) {
    setEvents((prev) => [...prev, event]);
  }

  function handleUpdateEvent(
    eventId: string,
    patch: Partial<ScheduleEvent>,
    options?: { scope?: "occurrence" | "series" },
  ) {
    const parsed = parseSyntheticEventId(eventId);
    if (parsed) {
      const scope = options?.scope ?? "occurrence";
      if (scope === "series") {
        setEvents((prev) =>
          prev.map((event) => {
            if (event.id !== parsed.masterId) return event;
            return { ...event, ...patch, id: event.id };
          }),
        );
        return;
      }
      setEvents((prev) =>
        prev.map((event) => {
          if (event.id !== parsed.masterId) return event;
          const nextOverrides = { ...(event.recurrenceOverrides ?? {}) };
          const cur = nextOverrides[parsed.occurrenceDate] ?? {};
          const delta = pickRecurrenceOverridePatch(patch);
          nextOverrides[parsed.occurrenceDate] = { ...cur, ...delta };
          return { ...event, recurrenceOverrides: nextOverrides };
        }),
      );
      return;
    }
    setEvents((prev) => prev.map((event) => (event.id === eventId ? { ...event, ...patch } : event)));
  }

  function handleDeleteEvent(
    eventId: string,
    options?: { mode?: "single" | "future" | "all" },
  ) {
    const mode = options?.mode ?? "all";
    const parsed = parseSyntheticEventId(eventId);
    if (parsed) {
      if (mode === "single") {
        setEvents((prev) =>
          prev.map((event) => {
            if (event.id !== parsed.masterId) return event;
            const next = new Set([...(event.exceptionDates ?? []), parsed.occurrenceDate]);
            const nextOverrides = { ...(event.recurrenceOverrides ?? {}) };
            delete nextOverrides[parsed.occurrenceDate];
            return {
              ...event,
              exceptionDates: [...next],
              recurrenceOverrides: nextOverrides,
            };
          }),
        );
        return;
      }
      if (mode === "future") {
        setEvents((prev) =>
          prev.map((event) => {
            if (event.id !== parsed.masterId) return event;
            return { ...event, recurrenceEndExclusive: parsed.occurrenceDate };
          }),
        );
        return;
      }
      setEvents((prev) => prev.filter((event) => event.id !== parsed.masterId));
      return;
    }
    setEvents((prev) => prev.filter((event) => event.id !== eventId));
  }

  const shellClass =
    "min-h-screen bg-white text-black pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]";

  if (!isBooted) {
    return (
      <main className={shellClass}>
        <div className="mx-auto grid max-w-[1520px] grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[1fr_460px]">
          <div className="h-[720px] rounded-sm border border-gray-200 bg-white" />
          <div className="h-[720px] rounded-sm border border-gray-200 bg-white" />
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className={shellClass}>
        <div className="mx-auto max-w-lg px-4 py-16">
          <section className="rounded-sm border border-gray-200 bg-white p-6">
            <h1 className="text-lg font-semibold">邮箱登录</h1>
            <p className="mt-1 text-sm text-gray-600">输入邮箱，使用魔法链接登录，数据将按账号隔离保存。</p>
            <div className="mt-4 space-y-3">
              <Input
                type="email"
                value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)}
                placeholder="you@example.com"
                className="rounded-sm border-gray-200"
              />
              <Button
                type="button"
                onClick={handleSendMagicLink}
                disabled={sendingLink}
                className="w-full rounded-sm bg-black text-white hover:bg-black/90"
              >
                {sendingLink ? "发送中..." : "发送登录链接"}
              </Button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (!dataReady) {
    return (
      <main className={shellClass}>
        <div className="mx-auto grid max-w-[1520px] grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[1fr_460px]">
          <div className="h-[720px] rounded-sm border border-gray-200 bg-white" />
          <div className="h-[720px] rounded-sm border border-gray-200 bg-white" />
        </div>
      </main>
    );
  }

  return (
    <main
      className={cn(
        shellClass,
        "pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-4",
      )}
    >
      <div className="mx-auto flex max-w-[1520px] items-center justify-between gap-3 px-4 pt-4">
        <p className="min-w-0 truncate text-xs text-gray-600">当前账号：{user.email}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSignOut}
          className="shrink-0 rounded-sm border-gray-200"
        >
          退出登录
        </Button>
      </div>
      <div className="mx-auto grid max-w-[1520px] grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[1fr_460px]">
        <section className={cn(mobileTab === "schedule" ? "block" : "hidden", "min-h-0 lg:block")}>
          <WeeklyTimeGrid
            currentWeekStart={currentWeekStart}
            weekRange={weekRange}
            events={events}
            onCreateEvent={handleCreateEvent}
            onUpdateEvent={handleUpdateEvent}
            onDeleteEvent={handleDeleteEvent}
            onPrevWeek={handleGoPrevWeek}
            onNextWeek={handleGoNextWeek}
            onViewModeChange={handleViewModeChange}
            onTimeGranularityChange={handleTimeGranularityChange}
            viewMode={viewMode}
            timeGranularity={timeGranularity}
          />
        </section>
        <section className={cn(mobileTab === "tasks" ? "block" : "hidden", "min-h-0 lg:block")}>
          <TaskDashboard
            tasks={tasks}
            onToggleTask={handleToggleTask}
            onAddTask={handleAddTask}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
            onReorderTask={handleReorderTask}
            annualTasks={annualTasks}
            onAddAnnualTask={handleAddAnnualTask}
            onToggleAnnualTask={handleToggleAnnualTask}
            onDeleteAnnualTask={handleDeleteAnnualTask}
            projectCheckins={projectCheckins}
            onAddProjectCheckin={handleAddProjectCheckin}
            onCheckinProject={handleCheckinProject}
            onDeleteProjectCheckin={handleDeleteProjectCheckin}
            footprints={footprints}
            onAddFootprint={handleAddFootprint}
            onResetFootprint={handleResetFootprint}
            onDeleteFootprint={handleDeleteFootprint}
          />
        </section>
      </div>
      <nav
        className="fixed inset-x-0 bottom-0 z-50 flex border-t border-gray-200 bg-white/95 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur-md supports-[backdrop-filter]:bg-white/80 lg:hidden"
        aria-label="主功能"
      >
        <button
          type="button"
          onClick={() => setMobileTab("schedule")}
          className={cn(
            "flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] text-gray-500 transition-colors",
            mobileTab === "schedule" && "font-medium text-black",
          )}
        >
          <CalendarDays className="size-6 shrink-0" aria-hidden />
          <span>日程</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("tasks")}
          className={cn(
            "flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] text-gray-500 transition-colors",
            mobileTab === "tasks" && "font-medium text-black",
          )}
        >
          <ListTodo className="size-6 shrink-0" aria-hidden />
          <span>任务</span>
        </button>
      </nav>
    </main>
  );
}
