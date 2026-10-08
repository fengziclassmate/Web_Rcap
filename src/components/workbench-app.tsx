"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AccountScope } from "@/components/account-scope";
import { Check, CloudOff, Loader2, RefreshCw, Undo2, Redo2 } from "lucide-react";
import { parseISO } from "date-fns";
import { GlobalSearch, type SearchResult } from "@/components/schedule/global-search";
import { ExecutionPanel } from "@/components/schedule/execution-panel";
import { FloatingScheduleCard } from "@/components/schedule/floating-schedule-card";
import { useScheduleSync } from "@/hooks/useScheduleSync";
import { useUndoHistory } from "@/hooks/useUndoHistory";
import { expandScheduleEvents } from "@/lib/recurrence";

/**
 * 日程管理应用的工作台主组件
 * 展示时间线、任务、日程与动态记录等功能
 */
import { addDays, addMonths, addWeeks, format, startOfMonth, startOfWeek } from "date-fns";
import { zhCN } from "date-fns/locale";
import type { User } from "@supabase/supabase-js";
import { TaskDashboard } from "@/components/schedule/task-dashboard";
import { WeeklyTimeGrid, ViewMode, TimeGranularity } from "@/components/schedule/weekly-time-grid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_SCHEDULE_CATEGORY } from "@/lib/categories";
import { createId } from "@/lib/id";
import {
  archiveProjectCheckinCycle,
  isProjectCheckinDateInCurrentCycle,
  appendProjectCheckin,
} from "@/lib/project-checkins";
import {
  getLinkedDailyTaskIdsForEventUpdate,
  moveRecurrenceOccurrence,
  parseSyntheticEventId,
  pickRecurrenceOverridePatch,
  unlinkDailyTaskFromEvents,
  updateEventsLinkedToDailyTask,
  updateRecurrenceFuture,
  updateTasksLinkedToScheduleEvent,
} from "@/lib/recurrence";
import {
  ROUTINE_CHECKIN_PROJECT_ID,
  type AnnualTask,
  type DashboardUiPreferences,
  type FootprintItem,
  type LongTask,
  type ProjectCheckin,
  type ScheduleEvent,
  type ShoppingItem,
} from "@/lib/types";
import {
  defaultDashboardUiPreferences,
  defaultEvents,
  defaultTasks,
} from "@/lib/normalizers";
import { normalizePersistedSchedulePayload, type PersistedSchedulePayload } from "@/lib/schedule-persistence";
import {
  composeLogPostRecords,
  fromLogImageRow,
  fromLogLinkRow,
  fromLogPostRow,
  fromLogTagRow,
} from "@/lib/log-mappers";
import { supabase } from "@/lib/supabase";
import { saveLogPost, deleteLogPost, retryLogImageCleanup } from "@/lib/log-mutations";
import { toast } from "sonner";
import { todayISO } from "@/lib/date-utils";
import { MonitoringSidebar, type MonitoringModuleId } from "@/components/monitoring/sidebar";
import type { Achievement } from "@/lib/achievements";
import { EfficiencyAnalysisDialog } from "@/components/llm/analysis-dialog";
import { LLMChatSidebar } from "@/components/llm/chat-sidebar";
import { QuickEventInput } from "@/components/llm/quick-event-input";
import { QuickNoteFab } from "@/components/llm/quick-note-fab";
import { LLMSettingsButton } from "@/components/llm/settings-button";
import { WeeklyReportDialog } from "@/components/llm/weekly-report-dialog";
import {
  type LogComposerInput,
  type LogPostEditorInput,
  type LogPostRecord,
  type LogTag,
} from "@/lib/logs";
const LogPage = dynamic(() => import("@/components/logs/log-page").then((module) => module.LogPage), {
  ssr: false,
  loading: ModuleLoadingState,
});
function ModuleLoadingState() {
  return (
    <section className="min-h-[520px] animate-pulse rounded-2xl border border-stone-200 bg-white/70 p-6">
      <div className="h-5 w-44 rounded bg-stone-200" />
      <div className="mt-6 h-28 rounded-xl bg-stone-100" />
      <div className="mt-4 h-64 rounded-xl bg-stone-100" />
    </section>
  );
}

function getCurrentWeekStart() {
  return startOfWeek(new Date(), { weekStartsOn: 1 });
}

export function WorkbenchApp() {
  const [openCollectionRequest, setOpenCollectionRequest] = useState<{ id: string; kind: "annual" | "project" | "shopping"; token: number }>();
  const [openTaskRequest, setOpenTaskRequest] = useState<{ id: string; token: number }>();
  const [openEventRequest, setOpenEventRequest] = useState<{ id: string; token: number }>();
  const [openLogRequest, setOpenLogRequest] = useState<{ id: string; token: number }>();
  const [isBooted, setIsBooted] = useState(false);
  const [activeModule, setActiveModule] = useState<MonitoringModuleId>("schedule");
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getCurrentWeekStart);
  const [events, setEvents] = useState<ScheduleEvent[]>(defaultEvents);
  const [tasks, setTasks] = useState<LongTask[]>(defaultTasks);
  const [annualTasks, setAnnualTasks] = useState<AnnualTask[]>([]);
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([]);
  const [projectCheckins, setProjectCheckins] = useState<ProjectCheckin[]>([]);
  const [footprints, setFootprints] = useState<FootprintItem[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [logPosts, setLogPosts] = useState<LogPostRecord[]>([]);
  const [logTags, setLogTags] = useState<LogTag[]>([]);
  const [logReady, setLogReady] = useState(false);
  const [logHistoryAvailable, setLogHistoryAvailable] = useState(false);
  const [logUploading, setLogUploading] = useState(false);
  const logMutationBusy = useRef(false);
  const [dashboardUiPreferences, setDashboardUiPreferences] = useState<DashboardUiPreferences>(
    defaultDashboardUiPreferences,
  );

  const timeGranularity = dashboardUiPreferences.timeGranularity;
  const [user, setUser] = useState<User | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [sendingLink, setSendingLink] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [confirmDangerousActions, setConfirmDangerousActions] = useState(true);
  const weekRange = useMemo(() => {
    const start = format(currentWeekStart, "yyyy/MM/dd", { locale: zhCN });
    const end = format(addDays(currentWeekStart, 6), "yyyy/MM/dd", { locale: zhCN });
    return `${start} - ${end}`;
  }, [currentWeekStart]);
  const displayRangeLabel = useMemo(() => {
    if (viewMode === "day") return format(currentWeekStart, "yyyy年 M月d日 EEEE", { locale: zhCN });
    if (viewMode === "month") return format(currentWeekStart, "yyyy年 M月", { locale: zhCN });
    return weekRange;
  }, [currentWeekStart, viewMode, weekRange]);
  const persistedPayload = useMemo<PersistedSchedulePayload>(
    () => ({
      events,
      tasks,
      annual_tasks: annualTasks,
      shopping_items: shoppingItems,
      project_checkins: projectCheckins,
      footprints,
      achievements,
      ui_preferences: dashboardUiPreferences,
    }),
    [
      achievements,
      annualTasks,
      dashboardUiPreferences,
      events,
      footprints,
      projectCheckins,
      shoppingItems,
      tasks,
    ],
  );
  const [historyRevision, setHistoryRevision] = useState(0);
  const hydrateSchedule = useCallback((value: PersistedSchedulePayload, externalChange: boolean) => {
    if (externalChange) setHistoryRevision((revision) => revision + 1);
    setEvents(value.events); setTasks(value.tasks); setAnnualTasks(value.annual_tasks);
    setShoppingItems(value.shopping_items); setProjectCheckins(value.project_checkins);
    setFootprints(value.footprints); setAchievements(value.achievements);
    setDashboardUiPreferences(value.ui_preferences);
  }, []);
  const sync = useScheduleSync(user?.id ?? null, persistedPayload, hydrateSchedule);
  const dataReady = sync.ready;
  const currentUserId = useRef<string | null>(null);
  useEffect(() => { currentUserId.current = user?.id ?? null; }, [user?.id]);

  const undoSnapshot = useMemo(() => {
    const value = normalizePersistedSchedulePayload({ events, tasks, annual_tasks: annualTasks, shopping_items: shoppingItems, project_checkins: projectCheckins, footprints, achievements })!;
    return { events: value.events, tasks: value.tasks, annualTasks: value.annual_tasks, shoppingItems: value.shopping_items, projectCheckins: value.project_checkins, footprints: value.footprints, achievements: value.achievements };
  }, [events, tasks, annualTasks, shoppingItems, projectCheckins, footprints, achievements]);
  const restoreSnapshot = useCallback((snapshot: typeof undoSnapshot) => {
    setEvents(snapshot.events); setTasks(snapshot.tasks); setAnnualTasks(snapshot.annualTasks);
    setShoppingItems(snapshot.shoppingItems); setProjectCheckins(snapshot.projectCheckins);
    setFootprints(snapshot.footprints); setAchievements(snapshot.achievements);
  }, []);
  const history = useUndoHistory(undoSnapshot, restoreSnapshot, dataReady && user ? `${user.id}:${historyRevision}` : null);

  function locateSearchResult(result: SearchResult) {
    const token = Date.now();
    if (result.task) {
      setActiveModule("schedule");
      setDashboardUiPreferences((previous) => ({ ...previous, dashboardGroup: result.task!.taskType === "long" ? "goals" : "today" }));
      setOpenTaskRequest({ id: result.id, token });
    } else if (result.event) {
      const event = result.event;
      const next = event.recurrence ? expandScheduleEvents([event], todayISO(), format(addDays(new Date(), 366), "yyyy-MM-dd"))[0] : event;
      const target = next ?? expandScheduleEvents([event], event.date, event.recurrenceEndExclusive ?? todayISO()).at(-1);
      if (!target) { toast.info("此重复日程当前没有可打开的实例"); return; }
      setActiveModule("schedule"); setViewMode("day"); setCurrentWeekStart(parseISO(target.date));
      setOpenEventRequest({ id: target.id, token });
    } else if (result.collection) {
      setActiveModule("schedule");
      const kind = result.collection;
      setDashboardUiPreferences((previous) => ({ ...previous,
        dashboardGroup: kind === "shopping" || result.id === ROUTINE_CHECKIN_PROJECT_ID ? "life" : "goals",
        ...(kind === "annual" ? { annualSectionOpen: true, longTaskSectionOpen: false } : {}),
        ...(kind === "shopping" ? { shoppingSectionOpen: true } : {}),
        ...(kind === "project" ? { projectSectionOpen: true, expandedProjects: [...new Set([...previous.expandedProjects, result.id])] } : {}),
        ...(result.id === ROUTINE_CHECKIN_PROJECT_ID ? { projectSectionOpen: false, routineCheckinSectionOpen: true, achievementSectionOpen: false, footprintSectionOpen: false } : {}),
      }));
      setOpenCollectionRequest({ id: result.id, kind, token });
    } else if (result.log) {
      setActiveModule("logs"); setOpenLogRequest({ id: result.id, token });
    }
  }

  async function refreshLogs(currentUser: User) {
    const results = await Promise.all([
      supabase.from("log_posts").select("*").eq("user_id", currentUser.id).order("created_at", { ascending: false }),
      supabase.from("log_post_images").select("*").eq("user_id", currentUser.id),
      supabase.from("log_tags").select("*").eq("user_id", currentUser.id),
      supabase.from("log_post_tags").select("post_id,tag_id").eq("user_id", currentUser.id),
      supabase.from("log_post_links").select("*").eq("user_id", currentUser.id),
    ]);
    const firstError = results.find((item) => item.error)?.error;
    if (firstError) throw firstError;

    const posts = (results[0].data ?? []).map((item) => fromLogPostRow(item));
    const rawImages = (results[1].data ?? []).map((item) => fromLogImageRow(item));
    const tags = (results[2].data ?? []).map((item) => fromLogTagRow(item));
    const tagLinks = (results[3].data ?? []).map((item) => ({
      postId: String(item.post_id),
      tagId: String(item.tag_id),
    }));
    const links = (results[4].data ?? []).map((item) => fromLogLinkRow(item));

    const signedImages = await Promise.all(
      rawImages.map(async (image) => {
        if (!image.storagePath) return image;
        const { data } = await supabase.storage
          .from("log-images")
          .createSignedUrl(image.storagePath, 60 * 60 * 24 * 30);
        return { ...image, imageUrl: data?.signedUrl ?? image.imageUrl };
      }),
    );

    if (currentUserId.current !== currentUser.id) return;
    const usage = new Map<string, number>();
    for (const link of tagLinks) usage.set(link.tagId, (usage.get(link.tagId) ?? 0) + 1);
    setLogTags(tags.map((tag) => ({ ...tag, usageCount: usage.get(tag.id) ?? 0 })));
    setLogPosts(composeLogPostRecords(posts, signedImages, tags, tagLinks, links));
    setLogHistoryAvailable(true);
  }

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
    setLogPosts([]); setLogTags([]); setLogReady(false); setLogHistoryAvailable(false);
  }, [user?.id]);

  useEffect(() => {
    if (!user || !dataReady) return;
    let cancelled = false;
    const currentUser = user;

    async function loadLogs() {
      try {
        await refreshLogs(currentUser);
        void retryLogImageCleanup(supabase, currentUser.id);
        if (!cancelled) setLogReady(true);
      } catch (firstError) {
        if (cancelled) return;
        const message = firstError instanceof Error ? firstError.message : String(firstError);
        if (message.includes("does not exist")) {
          setLogPosts([]);
          setLogTags([]);
          setLogReady(true);
          return;
        }
        toast.error(`Failed to load logs: ${message}`);
        setLogReady(true);
      }
    }

    loadLogs();
    return () => {
      cancelled = true;
    };
  }, [dataReady, user]);

  async function finishLogSave(currentUser: User, cleanupComplete: boolean) {
    try { await refreshLogs(currentUser); }
    catch { toast.warning("日志已保存，列表刷新失败，请刷新页面查看。"); }
    if (!cleanupComplete) toast.warning("日志已保存，部分旧图片等待联网清理。");
  }

  async function handleCreateLogPost(input: LogComposerInput) {
    if (!user || logMutationBusy.current) return false;
    logMutationBusy.current = true;
    setLogUploading(true);
    const currentUser = user;
    try {
      const now = new Date();
      const createdAt = input.recordDate ? new Date(`${input.recordDate}T${format(now, "HH:mm:ss.SSS")}`).toISOString() : now.toISOString();
      const result = await saveLogPost(supabase, currentUser.id, input.requestId, { ...input, newImages: input.images, keepImageIds: [], createdAt });
      await finishLogSave(currentUser, result.cleanupComplete);
      toast.success("动态日志已保存");
      return true;
    } catch (error) {
      toast.error(`日志未完整保存，草稿已保留；重试会继续保存同一条日志：${error instanceof Error ? error.message : String(error)}`);
      return false;
    } finally { logMutationBusy.current = false; setLogUploading(false); }
  }

  async function handleUpdateLogPost(postId: string, input: LogPostEditorInput) {
    if (!user || logMutationBusy.current) return false;
    logMutationBusy.current = true;
    setLogUploading(true);
    const currentUser = user;
    try {
      const result = await saveLogPost(supabase, currentUser.id, postId, input);
      await finishLogSave(currentUser, result.cleanupComplete);
      toast.success("日志修改已保存");
      return true;
    } catch (error) {
      toast.error(`日志未完整保存，编辑内容已保留：${error instanceof Error ? error.message : String(error)}`);
      return false;
    } finally { logMutationBusy.current = false; setLogUploading(false); }
  }

  async function handleDeleteLogPost(postId: string) {
    if (!user || logMutationBusy.current) return;
    logMutationBusy.current = true;
    const currentUser = user;
    try {
      const result = await deleteLogPost(supabase, currentUser.id, postId);
      await finishLogSave(currentUser, result.cleanupComplete);
    } catch (error) {
      toast.error(`日志删除失败，请重试：${error instanceof Error ? error.message : String(error)}`);
    } finally { logMutationBusy.current = false; }
  }

  async function handleToggleLogPinned(postId: string) {
    if (!user) return;
    const post = logPosts.find((item) => item.id === postId);
    if (!post) return;
    const { error } = await supabase
      .from("log_posts")
      .update({ is_pinned: !post.isPinned, updated_at: new Date().toISOString() })
      .eq("id", postId)
      .eq("user_id", user.id);
    if (error) {
      toast.error(`Failed to update pinned state: ${error.message}`);
      return;
    }
    await refreshLogs(user);
  }

  async function handleToggleLogArchived(postId: string) {
    if (!user) return;
    const post = logPosts.find((item) => item.id === postId);
    if (!post) return;
    const { error } = await supabase
      .from("log_posts")
      .update({ is_archived: !post.isArchived, updated_at: new Date().toISOString() })
      .eq("id", postId)
      .eq("user_id", user.id);
    if (error) {
      toast.error(`Failed to update archived state: ${error.message}`);
      return;
    }
    await refreshLogs(user);
  }

  function handleAddAchievement(value: Omit<Achievement, "id">) {
    setAchievements((prev) => [...prev, { id: createId("achievement"), ...value }]);
  }

  function handleUpdateAchievement(id: string, patch: Partial<Omit<Achievement, "id">>) {
    setAchievements((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  function handleDeleteAchievement(id: string) {
    setAchievements((prev) => prev.filter((x) => x.id !== id));
  }

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
    toast.success("登录链接已发送，请检查邮箱。");
  }

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(`退出登录失败：${error.message}`);
      return;
    }
    toast.success("已退出登录。");
  }

  function handleGoPrevWeek() {
    if (viewMode === 'day') {
      setCurrentWeekStart((prev) => addDays(prev ?? getCurrentWeekStart(), -1));
    } else if (viewMode === 'week') {
      setCurrentWeekStart((prev) => addWeeks(prev ?? getCurrentWeekStart(), -1));
    } else if (viewMode === 'month') {
      setCurrentWeekStart((prev) => startOfMonth(addMonths(prev ?? getCurrentWeekStart(), -1)));
    }
  }

  function handleGoNextWeek() {
    if (viewMode === 'day') {
      setCurrentWeekStart((prev) => addDays(prev ?? getCurrentWeekStart(), 1));
    } else if (viewMode === 'week') {
      setCurrentWeekStart((prev) => addWeeks(prev ?? getCurrentWeekStart(), 1));
    } else if (viewMode === 'month') {
      setCurrentWeekStart((prev) => startOfMonth(addMonths(prev ?? getCurrentWeekStart(), 1)));
    }
  }

  function handleViewModeChange(mode: ViewMode) {
    if (mode === "week") {
      setCurrentWeekStart((prev) =>
        startOfWeek(prev ?? getCurrentWeekStart(), { weekStartsOn: 1 }),
      );
    }
    if (mode === "month") {
      setCurrentWeekStart((prev) =>
        startOfMonth(prev ?? getCurrentWeekStart()),
      );
    }
    setViewMode(mode);
  }

  function handleTimeGranularityChange(granularity: TimeGranularity) {
    setDashboardUiPreferences((previous) => ({ ...previous, timeGranularity: granularity }));
  }

  function handleToggleTask(taskId: string) {
    const target = tasks.find((task) => task.id === taskId);
    if (!target) return;
    const nextDone = !target.done;
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== taskId) return task;
        return {
          ...task,
          done: nextDone,
          completedAt: nextDone ? new Date().toISOString() : null,
        };
      }),
    );
    setEvents((prev) => updateEventsLinkedToDailyTask(prev, taskId, nextDone));
  }

  function handleAddTask(
    name: string,
    dueDate: string,
    taskType: LongTask["taskType"] = "long",
  ): string | null {
    const trimmedName = name.trim();
    if (!trimmedName) return null;
    const id = createId("task");
    setTasks((prev) => [
      ...prev,
      {
        id,
        name: trimmedName,
        dueDate,
        createdAt: new Date().toISOString(),
        completedAt: null,
        done: false,
        notes: "",
        precautions: [],
        completionLog: "",
        priority: "不紧急不重要",
        subtasks: [],
        taskType,
        isTodayFocus: false,
      },
    ]);
    return id;
  }

  function handleUpdateTask(taskId: string, patch: Partial<LongTask>) {
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== taskId) return task;
        const nextTask = { ...task, ...patch };
        if (typeof patch.done === "boolean") {
          return {
            ...nextTask,
            completedAt: patch.done
              ? patch.completedAt ?? task.completedAt ?? new Date().toISOString()
              : null,
          };
        }
        return nextTask;
      }),
    );
    const isCompleted = patch.done;
    if (typeof isCompleted === "boolean") {
      setEvents((prev) => updateEventsLinkedToDailyTask(prev, taskId, isCompleted));
    }
  }

  function handleDeleteTask(taskId: string) {
    setTasks((prev) => prev.filter((task) => task.id !== taskId));
    setEvents((prev) => unlinkDailyTaskFromEvents(prev, taskId));
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

  function handleUpdateAnnualTask(taskId: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setAnnualTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, name: trimmed } : task)),
    );
  }

  function handleReorderAnnualTask(sourceTaskId: string, targetTaskId: string) {
    if (!sourceTaskId || !targetTaskId || sourceTaskId === targetTaskId) return;
    setAnnualTasks((prev) => {
      const next = [...prev];
      const sourceIndex = next.findIndex((task) => task.id === sourceTaskId);
      const targetIndex = next.findIndex((task) => task.id === targetTaskId);
      if (sourceIndex < 0 || targetIndex < 0) return prev;
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  }

  function handleAddShoppingItem(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setShoppingItems((prev) => [
      ...prev,
      {
        id: createId("shopping"),
        name: trimmed,
        addedAt: new Date().toISOString(),
        done: false,
      },
    ]);
  }

  function handleToggleShoppingItem(itemId: string) {
    setShoppingItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, done: !item.done } : item)),
    );
  }

  function handleDeleteShoppingItem(itemId: string) {
    setShoppingItems((prev) => prev.filter((item) => item.id !== itemId));
  }

  function handleReorderShoppingItem(sourceItemId: string, targetItemId: string) {
    if (!sourceItemId || !targetItemId || sourceItemId === targetItemId) return;
    setShoppingItems((prev) => {
      const next = [...prev];
      const sourceIndex = next.findIndex((item) => item.id === sourceItemId);
      const targetIndex = next.findIndex((item) => item.id === targetItemId);
      if (sourceIndex < 0 || targetIndex < 0) return prev;
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
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
        startDate: todayISO(),
        checkins: [],
        archives: [],
        dailyCheckins: [],
        dailyCompletions: [],
      },
    ]);
  }

  function handleCheckinProject(projectId: string, date: string, note: string) {
    const targetDate = date || todayISO();
    const targetProject = projectCheckins.find((project) => project.id === projectId);
    if (targetProject && !isProjectCheckinDateInCurrentCycle(targetProject, targetDate)) {
      toast.error(`新阶段从 ${targetProject.startDate} 开始，不能补打更早的日期`);
      return;
    }
    setProjectCheckins((prev) =>
      prev.map((project) => {
        if (project.id !== projectId) return project;
        return appendProjectCheckin(project, targetDate, note, format(new Date(), "HH:mm"));
      }),
    );
  }

  function handleReorderProjectCheckin(sourceProjectId: string, targetProjectId: string) {
    if (!sourceProjectId || !targetProjectId || sourceProjectId === targetProjectId) return;
    setProjectCheckins((prev) => {
      const next = [...prev];
      const sourceIndex = next.findIndex((project) => project.id === sourceProjectId);
      const targetIndex = next.findIndex((project) => project.id === targetProjectId);
      if (sourceIndex < 0 || targetIndex < 0) return prev;
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  }

  function handleArchiveProjectCheckin(projectId: string) {
    const restartedAt = todayISO();
    setProjectCheckins((prev) =>
      prev.map((project) =>
        project.id === projectId
          ? archiveProjectCheckinCycle(project, restartedAt, createId("project-archive"))
          : project,
      ),
    );
    toast.success("当前阶段已存档，新阶段从今天开始计数");
  }

  function handleDeleteProjectCheckin(projectId: string) {
    setProjectCheckins((prev) => prev.filter((project) => project.id !== projectId));
  }

  function handleUpdateProjectCheckin(
    projectId: string,
    patch: Partial<Omit<ProjectCheckin, "id">>,
  ) {
    setProjectCheckins((prev) =>
      prev.map((project) => (project.id === projectId ? { ...project, ...patch } : project)),
    );
  }

  function handleUpdateRoutineCheckins(
    patch: Partial<Pick<ProjectCheckin, "dailyCheckins" | "dailyCompletions">>,
  ) {
    setProjectCheckins((prev) => {
      const existing = prev.find((project) => project.id === ROUTINE_CHECKIN_PROJECT_ID);
      if (existing) {
        return prev.map((project) =>
          project.id === ROUTINE_CHECKIN_PROJECT_ID ? { ...project, ...patch } : project,
        );
      }
      return [
        ...prev,
        {
          id: ROUTINE_CHECKIN_PROJECT_ID,
          name: "日常时段打卡",
          description: "",
          startDate: todayISO(),
          checkins: [],
          archives: [],
          dailyCheckins: patch.dailyCheckins ?? [],
          dailyCompletions: patch.dailyCompletions ?? [],
        },
      ];
    });
  }

  function handleUpdateProjectCheckinEntry(projectId: string, date: string, note: string) {
    setProjectCheckins((prev) =>
      prev.map((project) => {
        if (project.id !== projectId) return project;
        return {
          ...project,
          checkins: project.checkins.map((entry) =>
            entry.date === date ? { ...entry, note: note.trim() } : entry,
          ),
        };
      }),
    );
  }

  function handleDeleteProjectCheckinEntry(projectId: string, date: string) {
    setProjectCheckins((prev) =>
      prev.map((project) => {
        if (project.id !== projectId) return project;
        return {
          ...project,
          checkins: project.checkins.filter((entry) => entry.date !== date),
        };
      }),
    );
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

  function handleUpdateFootprint(itemId: string, patch: Partial<Pick<FootprintItem, "name" | "lastDate">>) {
    setFootprints((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    );
  }

  function handleCreateEvent(event: ScheduleEvent) {
    setEvents((prev) => [...prev, event]);
  }

  function handleCreateEvents(nextEvents: ScheduleEvent[]) {
    if (nextEvents.length === 0) return;
    setEvents((prev) => [...prev, ...nextEvents]);
  }

  function handleCreateDailyTaskTimeBlock(
    task: LongTask,
    date: string,
    startHour: number,
    durationMinutes: number,
  ) {
    setEvents((prev) => [
      ...prev,
      {
        id: createId("event"),
        date,
        startHour,
        endHour: startHour + durationMinutes / 60,
        title: task.name,
        notes: `来自日常任务：${task.name}`,
        requirements: [],
        isCompleted: task.done,
        category: DEFAULT_SCHEDULE_CATEGORY,
        tag: null,
        linkedDailyTaskId: task.id,
        recurrence: null,
        exceptionDates: [],
        recurrenceOverrides: {},
        recurrenceEndExclusive: null,
      },
    ]);
  }

  function handleUpdateEvent(
    eventId: string,
    patch: Partial<ScheduleEvent>,
    options?: { scope?: "occurrence" | "future" },
  ) {
    const isCompleted = patch.isCompleted;
    const title = patch.title;
    const date = patch.date;
    if (
      typeof isCompleted === "boolean"
      || typeof title === "string"
      || typeof date === "string"
    ) {
      const linkedTaskIds = new Set(
        getLinkedDailyTaskIdsForEventUpdate(
          events,
          eventId,
          options?.scope ?? "occurrence",
        ),
      );
      if (patch.linkedDailyTaskId) linkedTaskIds.add(patch.linkedDailyTaskId);
      if (linkedTaskIds.size > 0) {
        setTasks((prev) =>
          updateTasksLinkedToScheduleEvent(
            prev,
            linkedTaskIds,
            { title, date, isCompleted },
            new Date().toISOString(),
          ),
        );
      }
    }

    const parsed = parseSyntheticEventId(eventId);
    if (parsed) {
      const scope = options?.scope ?? "occurrence";
      if (scope === "future") {
        const futureSeriesId = createId("event");
        setEvents((prev) => updateRecurrenceFuture(prev, eventId, patch, futureSeriesId));
        return;
      }
      if (patch.date && (patch.date !== parsed.occurrenceDate || (patch.endDate && patch.endDate > patch.date))) {
        const detachedEventId = createId("event");
        setEvents((prev) =>
          moveRecurrenceOccurrence(prev, eventId, patch, detachedEventId),
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

  const shellClass = "workbench-shell min-h-screen min-w-[1180px] text-stone-950";

  if (!isBooted) {
    return (
      <main className={shellClass}>
        <div className="mx-auto grid max-w-[1880px] grid-cols-[1fr_460px] gap-4 px-4 py-4">
          <div role="status" aria-label="正在加载工作台" className="h-[720px] animate-pulse rounded-xl border border-stone-200 bg-white p-6"><p className="text-sm text-stone-500">正在加载工作台…</p></div>
          <ModuleLoadingState />
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
        <div className="mx-auto grid max-w-[1880px] grid-cols-[1fr_460px] gap-4 px-4 py-4">
          <div role={sync.message ? "alert" : "status"} className="h-[720px] rounded-xl border border-stone-200 bg-white p-6">
            <p className="text-sm text-stone-500">{sync.message || "正在加载工作台…"}</p>
            {sync.message && <Button className="mt-4" variant="outline" onClick={() => window.location.reload()}>重新加载</Button>}
          </div>
          <ModuleLoadingState />
        </div>
      </main>
    );
  }

  return (
    <AccountScope.Provider key={user.id} value={user.id}>
    <main data-workbench className={`${shellClass} pb-4`}>
      <div className="relative z-10 mx-auto flex max-w-[1880px] items-center justify-between gap-3 px-5 pt-4">
        <div className="min-w-0 px-1 py-1">
          <p className="truncate text-[11px] tracking-wide text-stone-500">当前账号</p>
          <p className="mt-0.5 min-w-0 truncate text-sm font-medium text-stone-900">{user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <GlobalSearch events={events} tasks={tasks} logs={logPosts} annualTasks={annualTasks} projects={projectCheckins} shopping={shoppingItems} logsReady={logReady} onLocate={locateSearchResult} />
          <Button variant="outline" size="icon-sm" disabled={!history.canUndo} onClick={history.undo} aria-label="撤销上一步" title="撤销任务、日程与清单操作（Ctrl+Z）"><Undo2 /></Button>
          <Button variant="outline" size="icon-sm" disabled={!history.canRedo} onClick={history.redo} aria-label="重做上一步" title="重做（Ctrl+Shift+Z）"><Redo2 /></Button>
          <WeeklyReportDialog
            currentWeekStart={currentWeekStart}
            events={events}
            tasks={tasks}
            achievements={achievements}
          />
          <EfficiencyAnalysisDialog
            events={events}
            tasks={tasks}
            achievements={achievements}
            logs={logPosts}
          />
          <LLMSettingsButton />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setConfirmDangerousActions((prev) => !prev)}
            className="shrink-0 rounded-xl border-stone-200/80 bg-white/65 text-stone-700 shadow-sm backdrop-blur hover:bg-white"
          >
            任务删除确认：{confirmDangerousActions ? "开" : "关"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            className="shrink-0 rounded-xl border-stone-200/80 bg-white/65 text-stone-700 shadow-sm backdrop-blur hover:bg-white"
          >
            退出登录
          </Button>
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-[1880px] px-4 pt-0.5">
        <div role="status" aria-live="polite" className={`flex flex-wrap items-center gap-2 rounded-xl px-2 py-1 text-xs ${["error", "offline", "conflict"].includes(sync.status) ? "border border-amber-200 bg-amber-50 text-amber-900" : "text-stone-500"}`}>
          {sync.status === "saving" ? <Loader2 className="size-3.5 animate-spin" /> : sync.status === "saved" ? <Check className="size-3.5 text-emerald-700" /> : <CloudOff className="size-3.5" />}
          <span>{sync.message || ({ loading: "正在读取日程…", saved: "已同步到云端", pending: "已保存在本机，等待同步…", saving: "正在同步…", offline: "离线修改已保存在本机", error: "同步失败", conflict: "需要处理同步冲突" })[sync.status]}</span>
          {["error", "offline"].includes(sync.status) && <Button variant="ghost" size="xs" onClick={() => void sync.retry()}><RefreshCw />重试同步</Button>}
          {sync.status === "conflict" && <><Button variant="outline" size="xs" onClick={() => sync.resolve("local")}>冲突处保留本机</Button><Button variant="outline" size="xs" onClick={() => sync.resolve("remote")}>冲突处保留云端</Button></>}
        </div>
      </div>
      <div className="relative z-10 mx-auto flex max-w-[1880px] flex-col gap-4 px-4 py-3">
        <MonitoringSidebar active={activeModule} onChange={setActiveModule} />

        <div key={activeModule} className="workbench-module min-h-0 w-full">
          {activeModule === "schedule" ? (
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(340px,380px)] gap-4">
              <section className="min-h-0">
                <WeeklyTimeGrid
                  openEventRequest={openEventRequest}
                  onOpenRequestHandled={() => setOpenEventRequest(undefined)}
                  savedCategoryDefs={dashboardUiPreferences.categoryDefs}
                  onCategoryDefsChange={(categoryDefs) => setDashboardUiPreferences((previous) => ({ ...previous, categoryDefs }))}
                  currentWeekStart={currentWeekStart}
                  weekRange={displayRangeLabel}
                  events={events}
                  onCreateEvent={handleCreateEvent}
                  onCreateEvents={handleCreateEvents}
                  onCreateDailyTask={(name, date) => handleAddTask(name, date, "daily")}
                  onUpdateEvent={handleUpdateEvent}
                  onDeleteEvent={handleDeleteEvent}
                  onPrevWeek={handleGoPrevWeek}
                  onNextWeek={handleGoNextWeek}
                  onToday={() => setCurrentWeekStart(viewMode === "day" ? new Date() : viewMode === "month" ? startOfMonth(new Date()) : getCurrentWeekStart())}
                  onViewModeChange={handleViewModeChange}
                  onTimeGranularityChange={handleTimeGranularityChange}
                  onCreateLogPost={handleCreateLogPost}
                  logPosts={logPosts}
                  onOpenLogs={() => setActiveModule("logs")}
                  logSaving={logUploading}
                  toolbarContent={(
                    <QuickEventInput
                      onCreateEvent={handleCreateEvent}
                      onAddTask={handleAddTask}
                      onAddAnnualTask={handleAddAnnualTask}
                    />
                  )}
                  viewMode={viewMode}
                  timeGranularity={timeGranularity}
                />
              </section>
              <section className="min-h-0 space-y-4">
                <TaskDashboard
                  userId={user.id}
                  logsReady={logReady && logHistoryAvailable}
                  openCollectionRequest={openCollectionRequest}
                  onCollectionRequestHandled={() => setOpenCollectionRequest(undefined)}
                  openTaskRequest={openTaskRequest}
                  onOpenRequestHandled={() => setOpenTaskRequest(undefined)}
                  tasks={tasks}
                  events={events}
                  onToggleTask={handleToggleTask}
                  onAddTask={handleAddTask}
                  onUpdateTask={handleUpdateTask}
                  onDeleteTask={handleDeleteTask}
                  onReorderTask={handleReorderTask}
                  annualTasks={annualTasks}
                  onAddAnnualTask={handleAddAnnualTask}
                  onToggleAnnualTask={handleToggleAnnualTask}
                  onDeleteAnnualTask={handleDeleteAnnualTask}
                  onUpdateAnnualTask={handleUpdateAnnualTask}
                  onReorderAnnualTask={handleReorderAnnualTask}
                  shoppingItems={shoppingItems}
                  onAddShoppingItem={handleAddShoppingItem}
                  onToggleShoppingItem={handleToggleShoppingItem}
                  onDeleteShoppingItem={handleDeleteShoppingItem}
                  onReorderShoppingItem={handleReorderShoppingItem}
                  logPosts={logPosts}
                  logSaving={logUploading}
                  onCreateLogPost={handleCreateLogPost}
                  onOpenLogs={() => setActiveModule("logs")}
                  onCreateDailyTaskTimeBlock={handleCreateDailyTaskTimeBlock}
                  projectCheckins={projectCheckins}
                  onAddProjectCheckin={handleAddProjectCheckin}
                  onCheckinProject={handleCheckinProject}
                  onReorderProjectCheckin={handleReorderProjectCheckin}
                  onArchiveProjectCheckin={handleArchiveProjectCheckin}
                  onDeleteProjectCheckin={handleDeleteProjectCheckin}
                  onUpdateProjectCheckin={handleUpdateProjectCheckin}
                  onUpdateRoutineCheckins={handleUpdateRoutineCheckins}
                  onUpdateProjectCheckinEntry={handleUpdateProjectCheckinEntry}
                  onDeleteProjectCheckinEntry={handleDeleteProjectCheckinEntry}
                  achievements={achievements}
                  onAddAchievement={handleAddAchievement}
                  onUpdateAchievement={handleUpdateAchievement}
                  onDeleteAchievement={handleDeleteAchievement}
                  footprints={footprints}
                  onAddFootprint={handleAddFootprint}
                  onResetFootprint={handleResetFootprint}
                  onDeleteFootprint={handleDeleteFootprint}
                  onUpdateFootprint={handleUpdateFootprint}
                  confirmDangerousActions={confirmDangerousActions}
                  uiPreferences={dashboardUiPreferences}
                  onUiPreferencesChange={setDashboardUiPreferences}
                />
                <ExecutionPanel key={user.id} userId={user.id} events={events} tasks={tasks} preferences={dashboardUiPreferences} onPreferencesChange={setDashboardUiPreferences} />
              </section>
            </div>
          ) : (
            logReady ? (
              <LogPage
                openLogRequest={openLogRequest}
                onOpenRequestHandled={() => setOpenLogRequest(undefined)}
                posts={logPosts}
                tags={logTags}
                uploading={logUploading}
                onCreatePost={handleCreateLogPost}
                onUpdatePost={handleUpdateLogPost}
                onDeletePost={handleDeleteLogPost}
                onTogglePinned={handleToggleLogPinned}
                onToggleArchived={handleToggleLogArchived}
              />
            ) : (
              <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-md">
                <p className="text-sm text-gray-600">正在加载动态日志...</p>
              </section>
            )
          )}
        </div>
      </div>
      <FloatingScheduleCard
        key={user.id}
        userId={user.id}
        events={events}
        tasks={tasks}
        preferences={dashboardUiPreferences}
        onOpenEvent={(event) => {
          setActiveModule("schedule");
          setViewMode("day");
          setCurrentWeekStart(parseISO(event.date));
          setOpenEventRequest({ id: event.id, token: Date.now() });
        }}
        onOpenTask={(task) => {
          setActiveModule("schedule");
          setDashboardUiPreferences((previous) => ({ ...previous, dashboardGroup: task.taskType === "long" ? "goals" : "today" }));
          setOpenTaskRequest({ id: task.id, token: Date.now() });
        }}
        onToggleTask={handleToggleTask}
      />
      <LLMChatSidebar />
      <QuickNoteFab />
    </main>
    </AccountScope.Provider>
  );
}
