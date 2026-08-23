"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";

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
} from "@/lib/project-checkins";
import {
  parseSyntheticEventId,
  pickRecurrenceOverridePatch,
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
  normalizeAchievements,
  normalizeAnnualTasks,
  normalizeDashboardUiPreferences,
  normalizeEvents,
  normalizeFootprints,
  normalizeProjectCheckins,
  normalizeShoppingItems,
  normalizeTasks,
} from "@/lib/normalizers";
import {
  isColumnMissing,
  isUiPreferencesColumnMissing,
  readDashboardUiPreferencesFromLocal,
  readScheduleBackupFromLocal,
  writeScheduleBackupToLocal,
  writeDashboardUiPreferencesToLocal,
  type PersistedSchedulePayload,
} from "@/lib/schedule-persistence";
import {
  composeLogPostRecords,
  fromLogImageRow,
  fromLogLinkRow,
  fromLogPostRow,
  fromLogTagRow,
} from "@/lib/log-mappers";
import { supabase } from "@/lib/supabase";
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
  const canSaveRemoteRef = useRef(false);
  const lastLoadedSnapshotRef = useRef<string | null>(null);
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
  const [logUploading, setLogUploading] = useState(false);
  const [dashboardUiPreferences, setDashboardUiPreferences] = useState<DashboardUiPreferences>(
    defaultDashboardUiPreferences,
  );

  const timeGranularity = dashboardUiPreferences.timeGranularity;
  const [user, setUser] = useState<User | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [sendingLink, setSendingLink] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [confirmDangerousActions, setConfirmDangerousActions] = useState(true);
  const weekRange = useMemo(() => {
    const start = format(currentWeekStart, "yyyy/MM/dd", { locale: zhCN });
    const end = format(addDays(currentWeekStart, 6), "yyyy/MM/dd", { locale: zhCN });
    return `${start} - ${end}`;
  }, [currentWeekStart]);
  const displayRangeLabel = useMemo(() => {
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
  const persistedPayloadJson = useMemo(() => JSON.stringify(persistedPayload), [persistedPayload]);

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

    setLogTags(tags);
    setLogPosts(composeLogPostRecords(posts, signedImages, tags, tagLinks, links));
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
    if (!isBooted) return;
    if (!user) {
      canSaveRemoteRef.current = false;
      lastLoadedSnapshotRef.current = null;
      setEvents(defaultEvents);
      setTasks(defaultTasks);
      setAnnualTasks([]);
      setShoppingItems([]);
      setProjectCheckins([]);
      setFootprints([]);
      setAchievements([]);
      setLogPosts([]);
      setLogTags([]);
      setLogReady(false);
      setDashboardUiPreferences(defaultDashboardUiPreferences);
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
        console.error("鍒涘缓琛ㄥけ璐?", error);
        return false;
      }
      return true;
    }

    async function loadUserData() {
      try {
        if (!user) return;
        type ScheduleDataRow = {
          events: unknown;
          tasks: unknown;
          annual_tasks: unknown;
          shopping_items?: unknown;
          project_checkins: unknown;
          footprints: unknown;
          ui_preferences?: unknown;
          achievements?: unknown;
        };

        const primary = await supabase
          .from("schedule_data")
          .select(
            "events,tasks,annual_tasks,shopping_items,project_checkins,footprints,ui_preferences,achievements",
          )
          .eq("user_id", user.id)
          .maybeSingle();
        let data: ScheduleDataRow | null = primary.data as ScheduleDataRow | null;
        let error = primary.error;

        if (
          error?.message &&
          (isUiPreferencesColumnMissing(error.message) ||
            isColumnMissing(error.message, "achievements") ||
            isColumnMissing(error.message, "shopping_items"))
        ) {
          const onlyShoppingMissing = isColumnMissing(error.message, "shopping_items") &&
            !isUiPreferencesColumnMissing(error.message) &&
            !isColumnMissing(error.message, "achievements");
          const fallback = await supabase
            .from("schedule_data")
            .select(
              onlyShoppingMissing
                ? "events,tasks,annual_tasks,project_checkins,footprints,ui_preferences,achievements"
                : "events,tasks,annual_tasks,project_checkins,footprints",
            )
            .eq("user_id", user.id)
            .maybeSingle();
          data = fallback.data as ScheduleDataRow | null;
          error = fallback.error;
        }

        if (cancelled) return;
        if (error) {
          console.error("Failed to read remote schedule data:", error);
          const localBackup = readScheduleBackupFromLocal(user.id);
          if (localBackup) {
            canSaveRemoteRef.current = true;
            lastLoadedSnapshotRef.current = JSON.stringify(localBackup);
            setEvents(localBackup.events);
            setTasks(localBackup.tasks);
            setAnnualTasks(localBackup.annual_tasks);
            setShoppingItems(localBackup.shopping_items);
            setProjectCheckins(localBackup.project_checkins);
            setFootprints(localBackup.footprints);
            setAchievements(localBackup.achievements);
            setDashboardUiPreferences(localBackup.ui_preferences);
            toast.warning("Remote read failed. Restored from local backup.");
            setDataReady(true);
            return;
          }
          canSaveRemoteRef.current = false;
          lastLoadedSnapshotRef.current = null;
          if (error.message.includes('relation \"schedule_data\" does not exist')) {
            toast.info("Remote table missing. Creating it now...");
            const created = await createScheduleDataTable();
            if (created) {
              await loadUserData();
            } else {
              toast.error("Failed to create remote table.");
              setDataReady(true);
            }
          } else {
            toast.error("Failed to read remote data: " + error.message);
            setDataReady(true);
          }
          return;
        }

        if (data) {
          const normalized: PersistedSchedulePayload = {
            events: normalizeEvents(data.events),
            tasks: normalizeTasks(data.tasks),
            annual_tasks: normalizeAnnualTasks((data as { annual_tasks?: unknown }).annual_tasks),
            shopping_items: normalizeShoppingItems(
              (data as { shopping_items?: unknown }).shopping_items,
            ),
            project_checkins: normalizeProjectCheckins(
              (data as { project_checkins?: unknown }).project_checkins,
            ),
            footprints: normalizeFootprints((data as { footprints?: unknown }).footprints),
            achievements: normalizeAchievements((data as { achievements?: unknown }).achievements),
            ui_preferences: (data as { ui_preferences?: unknown }).ui_preferences
              ? normalizeDashboardUiPreferences((data as { ui_preferences?: unknown }).ui_preferences)
              : readDashboardUiPreferencesFromLocal(),
          };
          canSaveRemoteRef.current = true;
          lastLoadedSnapshotRef.current = JSON.stringify(normalized);
          setEvents(normalized.events);
          setTasks(normalized.tasks);
          setAnnualTasks(normalized.annual_tasks);
          setShoppingItems(normalized.shopping_items);
          setProjectCheckins(normalized.project_checkins);
          setFootprints(normalized.footprints);
          setAchievements(normalized.achievements);
          setDashboardUiPreferences(normalized.ui_preferences);
        } else {
          const localBackup = readScheduleBackupFromLocal(user.id);
          if (localBackup) {
            canSaveRemoteRef.current = true;
            lastLoadedSnapshotRef.current = JSON.stringify(localBackup);
            setEvents(localBackup.events);
            setTasks(localBackup.tasks);
            setAnnualTasks(localBackup.annual_tasks);
            setShoppingItems(localBackup.shopping_items);
            setProjectCheckins(localBackup.project_checkins);
            setFootprints(localBackup.footprints);
            setAchievements(localBackup.achievements);
            setDashboardUiPreferences(localBackup.ui_preferences);
            toast.warning("Remote data was empty. Restored from local backup.");
          } else {
            const emptyState: PersistedSchedulePayload = {
              events: defaultEvents,
              tasks: defaultTasks,
              annual_tasks: [],
              shopping_items: [],
              project_checkins: [],
              footprints: [],
              achievements: [],
              ui_preferences: readDashboardUiPreferencesFromLocal(),
            };
            canSaveRemoteRef.current = false;
            lastLoadedSnapshotRef.current = JSON.stringify(emptyState);
            setEvents(emptyState.events);
            setTasks(emptyState.tasks);
            setAnnualTasks(emptyState.annual_tasks);
            setShoppingItems(emptyState.shopping_items);
            setProjectCheckins(emptyState.project_checkins);
            setFootprints(emptyState.footprints);
            setAchievements(emptyState.achievements);
            setDashboardUiPreferences(emptyState.ui_preferences);
          }
        }
        setDataReady(true);
      } catch (error) {
        console.error("Failed to load schedule data:", error);
        canSaveRemoteRef.current = false;
        lastLoadedSnapshotRef.current = null;
        toast.error("Failed to load schedule data.");
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
    if (!canSaveRemoteRef.current) return;
    if (lastLoadedSnapshotRef.current === persistedPayloadJson) return;
    const currentUser = user;

    async function saveUserData() {
      const payload = {
        user_id: currentUser.id,
        ...persistedPayload,
      };

      const withPreferences = await supabase
        .from("schedule_data")
        .upsert(payload, { onConflict: "user_id" });

      if (!withPreferences.error) {
        lastLoadedSnapshotRef.current = persistedPayloadJson;
        return;
      }

      if (withPreferences.error.message) {
        const missingUi = isUiPreferencesColumnMissing(withPreferences.error.message);
        const missingAchievements = isColumnMissing(withPreferences.error.message, "achievements");
        const missingShopping = isColumnMissing(withPreferences.error.message, "shopping_items");
        if (missingUi || missingAchievements || missingShopping) {
          const fallbackPayload = {
            user_id: payload.user_id,
            events: payload.events,
            tasks: payload.tasks,
            annual_tasks: payload.annual_tasks,
            ...(missingShopping ? {} : { shopping_items: payload.shopping_items }),
            project_checkins: payload.project_checkins,
            footprints: payload.footprints,
            ...(missingAchievements ? {} : { achievements: payload.achievements }),
            ...(missingUi ? {} : { ui_preferences: payload.ui_preferences }),
          };

          const fallbackSave = await supabase
            .from("schedule_data")
            .upsert(fallbackPayload, { onConflict: "user_id" });
          if (fallbackSave.error) {
            console.error("Failed to save schedule data:", fallbackSave.error);
            toast.error("Failed to save remote data: " + fallbackSave.error.message);
            return;
          }
          lastLoadedSnapshotRef.current = persistedPayloadJson;
          toast.warning("Remote schema is behind. Used compatibility save.");
          return;
        }
      }

      console.error("Failed to save schedule data:", withPreferences.error);
      toast.error("Failed to save remote data: " + withPreferences.error.message);
    }

    saveUserData();
  }, [persistedPayload, persistedPayloadJson, user, dataReady]);

  useEffect(() => {
    if (!user || !dataReady) return;
    writeScheduleBackupToLocal(user.id, persistedPayload);
  }, [dataReady, persistedPayload, user]);

  useEffect(() => {
    if (!user || !dataReady) return;
    let cancelled = false;
    const currentUser = user;

    async function loadLogs() {
      try {
        await refreshLogs(currentUser);
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

  async function upsertLogTagsForUser(currentUser: User, tagNames: string[]) {
    const cleaned = Array.from(new Set(tagNames.map((item) => item.trim()).filter(Boolean)));
    if (cleaned.length === 0) return [] as LogTag[];
    const { error } = await supabase.from("log_tags").upsert(
      cleaned.map((name) => ({
        user_id: currentUser.id,
        name,
      })),
      { onConflict: "user_id,name" },
    );
    if (error) throw error;
    const { data, error: selectError } = await supabase
      .from("log_tags")
      .select("*")
      .eq("user_id", currentUser.id)
      .in("name", cleaned);
    if (selectError) throw selectError;
    return (data ?? []).map((item) => fromLogTagRow(item));
  }

  async function recalculateLogTagUsage(currentUser: User) {
    const [{ data: tagLinks, error: linksError }, { data: tagsData, error: tagsError }] = await Promise.all([
      supabase.from("log_post_tags").select("tag_id").eq("user_id", currentUser.id),
      supabase.from("log_tags").select("*").eq("user_id", currentUser.id),
    ]);
    if (linksError) throw linksError;
    if (tagsError) throw tagsError;
    const usageMap = new Map<string, number>();
    (tagLinks ?? []).forEach((item) => {
      const tagId = String(item.tag_id);
      usageMap.set(tagId, (usageMap.get(tagId) ?? 0) + 1);
    });
    for (const row of tagsData ?? []) {
      const count = usageMap.get(String(row.id)) ?? 0;
      const { error } = await supabase
        .from("log_tags")
        .update({ usage_count: count, updated_at: new Date().toISOString() })
        .eq("id", row.id)
        .eq("user_id", currentUser.id);
      if (error) throw error;
    }
  }

  async function uploadLogImages(currentUser: User, postId: string, files: File[]) {
    const rows: Array<Record<string, unknown>> = [];
    for (const [index, file] of files.entries()) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const storagePath = `${currentUser.id}/${postId}/${Date.now()}-${index}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("log-images")
        .upload(storagePath, file, { upsert: false });
      if (uploadError) throw uploadError;
      const { data } = await supabase.storage.from("log-images").createSignedUrl(storagePath, 60 * 60 * 24 * 30);
      rows.push({
        post_id: postId,
        user_id: currentUser.id,
        image_url: data?.signedUrl ?? "",
        storage_path: storagePath,
        sort_order: index,
      });
    }
    if (rows.length > 0) {
      const { error } = await supabase.from("log_post_images").insert(rows);
      if (error) throw error;
    }
  }

  async function syncLogPostTags(currentUser: User, postId: string, tagNames: string[]) {
    const ensuredTags = await upsertLogTagsForUser(currentUser, tagNames);
    const { error: deleteError } = await supabase
      .from("log_post_tags")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", currentUser.id);
    if (deleteError) throw deleteError;
    if (ensuredTags.length > 0) {
      const { error } = await supabase.from("log_post_tags").insert(
        ensuredTags.map((tag) => ({
          post_id: postId,
          tag_id: tag.id,
          user_id: currentUser.id,
        })),
      );
      if (error) throw error;
    }
    await recalculateLogTagUsage(currentUser);
  }

  async function syncLogPostLinks(currentUser: User, postId: string, links: Array<{ id: string; type: string; title: string }>) {
    const { error: deleteError } = await supabase
      .from("log_post_links")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", currentUser.id);
    if (deleteError) throw deleteError;
    if (links.length > 0) {
      const { error } = await supabase.from("log_post_links").insert(
        links.map((item) => ({
          post_id: postId,
          user_id: currentUser.id,
          target_type: item.type,
          target_id: item.id,
          target_title: item.title,
        })),
      );
      if (error) throw error;
    }
  }

  async function handleCreateLogPost(input: LogComposerInput) {
    if (!user) return false;
    setLogUploading(true);
    const currentUser = user;
    const nowDate = new Date();
    const now = nowDate.toISOString();
    const createdAt = input.recordDate
      ? new Date(`${input.recordDate}T${format(nowDate, "HH:mm:ss.SSS")}`).toISOString()
      : now;
    let basePostCreated = false;
    try {
      const { data, error } = await supabase
        .from("log_posts")
        .insert({
          user_id: currentUser.id,
          content: input.content,
          category: input.category,
          mood: input.mood || null,
          location: input.location,
          visibility: "private",
          source_type: "manual",
          created_at: createdAt,
          updated_at: now,
        })
        .select("*")
        .single();
      if (error) throw error;
      const post = fromLogPostRow(data);
      basePostCreated = true;
      await uploadLogImages(currentUser, post.id, input.images.slice(0, 9));
      await syncLogPostTags(currentUser, post.id, input.tagNames);
      await syncLogPostLinks(currentUser, post.id, input.links);
      await refreshLogs(currentUser);
      toast.success("动态日志已保存");
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (basePostCreated) {
        try {
          await refreshLogs(currentUser);
        } catch {
          // The main post is already stored; a later refresh can recover it.
        }
        toast.warning(`日志正文已保存，但部分附属信息同步失败：${message}`);
        return true;
      }
      toast.error(`Failed to create log post: ${message}`);
      return false;
    } finally {
      setLogUploading(false);
    }
  }

  async function handleUpdateLogPost(postId: string, input: LogPostEditorInput) {
    if (!user) return;
    setLogUploading(true);
    const currentUser = user;
    try {
      const { error: updateError } = await supabase
        .from("log_posts")
        .update({
          content: input.content,
          category: input.category,
          mood: input.mood || null,
          location: input.location,
          updated_at: new Date().toISOString(),
        })
        .eq("id", postId)
        .eq("user_id", currentUser.id);
      if (updateError) throw updateError;

      const existingPost = logPosts.find((item) => item.id === postId);
      const removedImages = existingPost?.images.filter((image) => !input.keepImageIds.includes(image.id)) ?? [];
      if (removedImages.length > 0) {
        const storagePaths = removedImages
          .map((image) => image.storagePath)
          .filter((item): item is string => Boolean(item));
        if (storagePaths.length > 0) {
          await supabase.storage.from("log-images").remove(storagePaths);
        }
        const { error: deleteImagesError } = await supabase
          .from("log_post_images")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", currentUser.id)
          .in("id", removedImages.map((item) => item.id));
        if (deleteImagesError) throw deleteImagesError;
      }

      await uploadLogImages(currentUser, postId, input.newImages.slice(0, Math.max(0, 9 - input.keepImageIds.length)));
      await syncLogPostTags(currentUser, postId, input.tagNames);
      await syncLogPostLinks(currentUser, postId, input.links);
      await refreshLogs(currentUser);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to update log post: ${message}`);
    } finally {
      setLogUploading(false);
    }
  }

  async function handleDeleteLogPost(postId: string) {
    if (!user) return;
    const currentUser = user;
    try {
      const existingPost = logPosts.find((item) => item.id === postId);
      const storagePaths = existingPost?.images
        .map((image) => image.storagePath)
        .filter((item): item is string => Boolean(item)) ?? [];
      if (storagePaths.length > 0) {
        await supabase.storage.from("log-images").remove(storagePaths);
      }
      await supabase.from("log_post_images").delete().eq("post_id", postId).eq("user_id", currentUser.id);
      await supabase.from("log_post_tags").delete().eq("post_id", postId).eq("user_id", currentUser.id);
      await supabase.from("log_post_links").delete().eq("post_id", postId).eq("user_id", currentUser.id);
      const { error } = await supabase.from("log_posts").delete().eq("id", postId).eq("user_id", currentUser.id);
      if (error) throw error;
      await recalculateLogTagUsage(currentUser);
      await refreshLogs(currentUser);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to delete log post: ${message}`);
    }
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

  useEffect(() => {
    if (!dataReady) return;
    writeDashboardUiPreferencesToLocal(dashboardUiPreferences);
  }, [dashboardUiPreferences, dataReady]);

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
      toast.error(`鍙戦€佺櫥褰曢摼鎺ュけ璐ワ細${error.message}`);
      return;
    }
    toast.success("登录链接已发送，请检查邮箱。");
  }

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(`閫€鍑哄け璐ワ細${error.message}`);
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
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== taskId) return task;
        const nextDone = !task.done;
        return {
          ...task,
          done: nextDone,
          completedAt: nextDone ? new Date().toISOString() : null,
        };
      }),
    );
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
        const exists = project.checkins.find((c) => c.date === targetDate);
        const nextCheckins = exists
          ? project.checkins.map((c) =>
              c.date === targetDate ? { ...c, note: note.trim() } : c,
            )
          : [...project.checkins, { date: targetDate, note: note.trim() }];
        return { ...project, checkins: nextCheckins };
      }),
    );
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
        isCompleted: false,
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

  const shellClass = "workbench-shell min-h-screen min-w-[1180px] text-stone-950";

  if (!isBooted) {
    return (
      <main className={shellClass}>
        <div className="mx-auto grid max-w-[1880px] grid-cols-[1fr_460px] gap-4 px-4 py-4">
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
          <div className="h-[720px] rounded-sm border border-gray-200 bg-white" />
          <div className="h-[720px] rounded-sm border border-gray-200 bg-white" />
        </div>
      </main>
    );
  }

  return (
    <main className={`${shellClass} pb-4`}>
      <div className="relative z-10 mx-auto flex max-w-[1880px] items-center justify-between gap-3 px-4 pt-4">
        <div className="workbench-hero min-w-0 rounded-2xl px-4 py-2">
          <p className="truncate text-xs uppercase tracking-[0.22em] text-stone-500">Current account</p>
          <p className="mt-0.5 min-w-0 truncate text-sm font-medium text-stone-900">{user.email}</p>
        </div>
        <div className="flex items-center gap-2">
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
            删除确认：{confirmDangerousActions ? "开" : "关"}
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

      <div className="relative z-10 mx-auto flex max-w-[1880px] flex-col gap-4 px-4 py-4">
        <MonitoringSidebar active={activeModule} onChange={setActiveModule} />

        <div className="min-h-0 w-full">
          {activeModule === "schedule" ? (
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(340px,380px)] gap-4">
              <section className="min-h-0">
                <WeeklyTimeGrid
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
                  onCreateDailyTaskTimeBlock={handleCreateDailyTaskTimeBlock}
                  projectCheckins={projectCheckins}
                  onAddProjectCheckin={handleAddProjectCheckin}
                  onCheckinProject={handleCheckinProject}
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
                  showFootprintsSection={false}
                  confirmDangerousActions={confirmDangerousActions}
                  uiPreferences={dashboardUiPreferences}
                  onUiPreferencesChange={setDashboardUiPreferences}
                />
              </section>
            </div>
          ) : (
            logReady ? (
              <LogPage
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
      <LLMChatSidebar />
      <QuickNoteFab />
    </main>
  );
}
