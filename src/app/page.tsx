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
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export type EventTag = "待定" | "不着急" | "不可后退" | null;

export type RecurrenceType = "daily" | "weekly" | "monthly";

export type RecurrenceRule = {
  type: RecurrenceType;
  interval: number; // 循环间隔
  endDate?: string; // 循环结束日期
  endCount?: number; // 循环结束次数
  weekdays?: number[]; // 每周循环的星期几 (0-6, 0 是周日)
};

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
  recurrence?: RecurrenceRule;
  exceptionDates?: string[]; // 例外日期列表
  originalId?: string; // 循环事件的原始ID，用于识别同一循环系列的事件
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

function normalizeEvents(payload: unknown): ScheduleEvent[] {
  if (!Array.isArray(payload)) return defaultEvents;
  return payload.map((event, index) => {
    const value = event as Partial<ScheduleEvent>;
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
      recurrence: value.recurrence,
      exceptionDates: Array.isArray(value.exceptionDates)
        ? value.exceptionDates.filter((item): item is string => typeof item === "string")
        : undefined,
      originalId: value.originalId,
    };
  });
}

export default function Home() {
  const [isBooted, setIsBooted] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getCurrentWeekStart);
  const [events, setEvents] = useState<ScheduleEvent[]>(defaultEvents);
  const [tasks, setTasks] = useState<LongTask[]>(defaultTasks);
  const [user, setUser] = useState<User | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [sendingLink, setSendingLink] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [timeGranularity, setTimeGranularity] = useState<TimeGranularity>(30);
  const weekRange = useMemo(() => {
    const start = format(currentWeekStart, "yyyy/MM/dd", { locale: zhCN });
    const end = format(addDays(currentWeekStart, 6), "yyyy/MM/dd", { locale: zhCN });
    return `${start} - ${end}`;
  }, [currentWeekStart]);
  
  // 模拟用户，以便测试循环事件功能
  const mockUser = {
    id: "mock-user-id",
    email: "mock@example.com"
  };
  const testUser = mockUser; // 直接使用模拟用户

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
    if (!testUser) {
      setEvents(defaultEvents);
      setTasks(defaultTasks);
      setDataReady(false);
      return;
    }

    // 模拟加载数据，使用默认数据
    setEvents(defaultEvents);
    setTasks(defaultTasks);
    setDataReady(true);
  }, [isBooted, testUser]);

  useEffect(() => {
    // 模拟保存数据，不实际调用 Supabase
    if (!testUser || !dataReady) return;
    console.log("模拟保存数据:", { events, tasks });
  }, [events, tasks, testUser, dataReady]);

  async function handleSendMagicLink() {
    if (!authEmail.trim()) return;
    setSendingLink(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: authEmail.trim(),
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
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
    // 模拟退出登录，不实际调用 Supabase
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

  function handleCreateEvent(event: ScheduleEvent) {
    setEvents((prev) => [...prev, event]);
  }

  function handleUpdateEvent(eventId: string, patch: Partial<ScheduleEvent>) {
    setEvents((prev) => prev.map((event) => (event.id === eventId ? { ...event, ...patch } : event)));
  }

  function handleDeleteEvent(eventId: string) {
    setEvents((prev) => prev.filter((event) => event.id !== eventId));
  }

  if (!isBooted) {
    return (
      <main className="min-h-screen bg-white text-black">
        <div className="mx-auto grid max-w-[1520px] grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[1fr_460px]">
          <div className="h-[720px] rounded-sm border border-gray-200 bg-white" />
          <div className="h-[720px] rounded-sm border border-gray-200 bg-white" />
        </div>
      </main>
    );
  }

  // 模拟用户，以便测试循环事件功能
  const mockUser = {
    id: "mock-user-id",
    email: "mock@example.com"
  };
  const testUser = mockUser; // 直接使用模拟用户

  if (!testUser) {
    return (
      <main className="min-h-screen bg-white text-black">
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
      <main className="min-h-screen bg-white text-black">
        <div className="mx-auto grid max-w-[1520px] grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[1fr_460px]">
          <div className="h-[720px] rounded-sm border border-gray-200 bg-white" />
          <div className="h-[720px] rounded-sm border border-gray-200 bg-white" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <div className="mx-auto flex max-w-[1520px] items-center justify-between px-4 pt-4">
        <p className="text-xs text-gray-600">当前账号：{testUser.email} (模拟)</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSignOut}
          className="rounded-sm border-gray-200"
        >
          退出登录
        </Button>
      </div>
      <div className="mx-auto grid max-w-[1520px] grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[1fr_460px]">
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
        <TaskDashboard
          tasks={tasks}
          onToggleTask={handleToggleTask}
          onAddTask={handleAddTask}
          onUpdateTask={handleUpdateTask}
          onDeleteTask={handleDeleteTask}
        />
      </div>
    </main>
  );
}
