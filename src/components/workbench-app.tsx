"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";

/**
 * 日程管理应用的工作台主组件
 * 展示时间线、任务、日程、文献、记录等功能
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
  detachDeletedMeetingRecords,
  reconcileMeetingRecordLinks,
} from "@/lib/meeting-record-links";
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
  type MeetingCompletionInput,
  type Priority,
  type ProjectCheckin,
  type ScheduleEvent,
  type ShoppingItem,
} from "@/lib/types";
import {
  defaultDashboardUiPreferences,
  defaultEvents,
  defaultPaperProgress,
  defaultTasks,
  normalizeAchievements,
  normalizeAnnualTasks,
  normalizeDashboardUiPreferences,
  normalizeEvents,
  normalizeFootprints,
  normalizeGroupMeetings,
  normalizePaperProgress,
  normalizeProjectCheckins,
  normalizeResearchProjects,
  normalizeShoppingItems,
  normalizeSubmissions,
  normalizeTasks,
} from "@/lib/normalizers";
import {
  getScheduleBackupStorageKey,
  isColumnMissing,
  isUiPreferencesColumnMissing,
  readDashboardUiPreferencesFromLocal,
  readScheduleBackupFromLocal,
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
import {
  composeLiteratureItems,
  fromLiteratureAttachmentRow,
  fromLiteratureExcerptRow,
  fromLiteratureMethodNoteRow,
  fromLiteratureNoteRow,
  fromLiteraturePaperUsageRow,
  fromLiteratureProjectLinkRow,
  fromLiteratureReadingLogRow,
  fromLiteratureRow,
  fromLiteratureTagRow,
} from "@/lib/literature-mappers";
import {
  fromMeetingActionRow,
  fromMeetingAttachmentRow,
  fromMeetingRow,
  fromPaperFeedbackRow,
  fromPaperProjectLinkRow,
  fromPaperRow,
  fromPaperSectionRow,
  fromProjectAttachmentRow,
  fromProjectLogRow,
  fromProjectRow,
  fromReviewCommentRow,
  fromSubmissionHistoryRow,
  fromSubmissionRow,
  fromTimelineRow,
  toMeetingActionRow,
  toMeetingAttachmentRow,
  toMeetingRow,
  toPaperFeedbackRow,
  toPaperProjectLinkRow,
  toPaperRow,
  toPaperSectionRow,
  toProjectAttachmentRow,
  toProjectLogRow,
  toProjectRow,
  toReviewCommentRow,
  toSubmissionHistoryRow,
  toSubmissionRow,
  toTimelineRow,
} from "@/lib/research-workflow-mappers";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { todayISO } from "@/lib/date-utils";
import { MonitoringSidebar, type MonitoringModuleId } from "@/components/monitoring/sidebar";
import type {
  Achievement,
  GroupMeetingRecord,
  PaperProgress,
  ResearchProject,
  SubmissionRecord,
} from "@/lib/legacy-research";
import { EfficiencyAnalysisDialog } from "@/components/llm/analysis-dialog";
import { LLMChatSidebar } from "@/components/llm/chat-sidebar";
import { QuickEventInput } from "@/components/llm/quick-event-input";
import { QuickNoteFab } from "@/components/llm/quick-note-fab";
import { LLMSettingsButton } from "@/components/llm/settings-button";
import { WeeklyReportDialog } from "@/components/llm/weekly-report-dialog";
import { buildResearchWorkflowFromLegacy } from "@/lib/research-workflow-legacy";
import {
  defaultResearchWorkflowState,
  emptyLinkState,
  type GroupMeetingRecord as WorkflowGroupMeetingRecord,
  type MeetingAttachment,
  type ProjectAttachment,
  type ResearchWorkflowState,
  type TimelineEntry,
} from "@/lib/research-workflow";
import {
  type LogComposerInput,
  type LogPostEditorInput,
  type LogPostRecord,
  type LogTag,
} from "@/lib/logs";
import {
  type LiteratureExcerptInput,
  type LiteratureFormInput,
  type LiteratureItem,
  type LiteratureMethodNoteInput,
  type LiteratureNoteInput,
  type LiteraturePaperUsageInput,
  type LiteratureReadingLogInput,
  type LiteratureTag,
} from "@/lib/literature";
import {
  defaultExecutionContinuityState,
  normalizeExecutionContinuityState,
  type ExecutionContinuityState,
} from "@/lib/execution-continuity";

const LogPage = dynamic(() => import("@/components/logs/log-page").then((module) => module.LogPage), {
  ssr: false,
  loading: ModuleLoadingState,
});
const LiteraturePage = dynamic(
  () => import("@/components/monitoring/literature-page").then((module) => module.LiteraturePage),
  { ssr: false, loading: ModuleLoadingState },
);
const ResearchWorkflowPanel = dynamic(
  () => import("@/components/monitoring/research-workflow-panel").then((module) => module.ResearchWorkflowPanel),
  { ssr: false, loading: ModuleLoadingState },
);
const RelationshipExchangePanel = dynamic(
  () => import("@/components/relationships/relationship-exchange-panel").then((module) => module.RelationshipExchangePanel),
  { ssr: false, loading: ModuleLoadingState },
);
const ExecutionContinuityPanel = dynamic(
  () => import("@/components/continuity/execution-continuity-panel").then((module) => module.ExecutionContinuityPanel),
  { ssr: false, loading: ModuleLoadingState },
);

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

type ResearchWorkflowModule = "research" | "paper" | "submissions" | "meetings";

function isResearchWorkflowModule(module: MonitoringModuleId): module is ResearchWorkflowModule {
  return module === "research" || module === "paper" || module === "submissions" || module === "meetings";
}

export function WorkbenchApp() {
  const canSaveRemoteRef = useRef(false);
  const lastLoadedSnapshotRef = useRef<string | null>(null);
  const canSyncResearchWorkflowRef = useRef(false);
  const lastResearchWorkflowSnapshotRef = useRef<string | null>(null);
  const researchWorkflowOperationQueueRef = useRef<Promise<void>>(Promise.resolve());
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
  const [researchProjects, setResearchProjects] = useState<ResearchProject[]>([]);
  const [paperProgress, setPaperProgress] = useState<PaperProgress>(defaultPaperProgress);
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [groupMeetings, setGroupMeetings] = useState<GroupMeetingRecord[]>([]);
  const [continuityState, setContinuityState] = useState<ExecutionContinuityState>(
    defaultExecutionContinuityState,
  );
  const [continuityOutcomeTaskId, setContinuityOutcomeTaskId] = useState<string | null>(null);
  const [researchWorkflow, setResearchWorkflow] = useState<ResearchWorkflowState>(
    defaultResearchWorkflowState,
  );
  const researchMeetingRecordIds = useMemo(
    () => new Set(researchWorkflow.meetings.map((meeting) => meeting.id)),
    [researchWorkflow.meetings],
  );
  const [researchWorkflowReady, setResearchWorkflowReady] = useState(false);
  const [logPosts, setLogPosts] = useState<LogPostRecord[]>([]);
  const [logTags, setLogTags] = useState<LogTag[]>([]);
  const [logReady, setLogReady] = useState(false);
  const [logUploading, setLogUploading] = useState(false);
  const [literatureItems, setLiteratureItems] = useState<LiteratureItem[]>([]);
  const [literatureTags, setLiteratureTags] = useState<LiteratureTag[]>([]);
  const [literatureReady, setLiteratureReady] = useState(false);
  const [dashboardUiPreferences, setDashboardUiPreferences] = useState<DashboardUiPreferences>(
    defaultDashboardUiPreferences,
  );

  function enqueueResearchWorkflowOperation<T>(operation: () => Promise<T>): Promise<T> {
    const result = researchWorkflowOperationQueueRef.current
      .catch(() => undefined)
      .then(operation);
    researchWorkflowOperationQueueRef.current = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
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
      research_projects: researchProjects,
      paper_progress: paperProgress,
      submissions,
      group_meetings: groupMeetings,
      continuity_state: continuityState,
      ui_preferences: dashboardUiPreferences,
    }),
    [
      achievements,
      annualTasks,
      continuityState,
      dashboardUiPreferences,
      events,
      footprints,
      groupMeetings,
      paperProgress,
      projectCheckins,
      researchProjects,
      shoppingItems,
      submissions,
      tasks,
    ],
  );
  const persistedPayloadJson = useMemo(() => JSON.stringify(persistedPayload), [persistedPayload]);
  const researchWorkflowJson = useMemo(() => JSON.stringify(researchWorkflow), [researchWorkflow]);
  const literatureProjectOptions = useMemo(
    () => researchWorkflow.projects.map((item) => ({ id: item.id, title: item.title })),
    [researchWorkflow.projects],
  );
  const literaturePaperOptions = useMemo(
    () => researchWorkflow.papers.map((item) => ({ id: item.id, title: item.title })),
    [researchWorkflow.papers],
  );
  const continuityProjectOptions = useMemo(() => {
    const latestActivityByProject = new Map<string, string>();
    for (const log of researchWorkflow.projectLogs) {
      const current = latestActivityByProject.get(log.projectId);
      if (!current || log.date > current) latestActivityByProject.set(log.projectId, log.date);
    }
    return researchWorkflow.projects.map((item) => ({
      id: item.id,
      title: item.title,
      progress: item.progress,
      status: item.status,
      currentIssues: item.currentIssues,
      nextActions: item.nextActions,
      targetEndDate: item.targetEndDate,
      startDate: item.startDate,
      linkedTaskIds: item.linkedTaskIds,
      plannedTaskIds: item.plannedTaskIds,
      lastActivityDate: latestActivityByProject.get(item.id) ?? null,
    }));
  }, [researchWorkflow.projectLogs, researchWorkflow.projects]);

  async function refreshLiteratures(currentUser: User) {
    const results = await Promise.all([
      supabase.from("literatures").select("*").eq("user_id", currentUser.id).order("updated_at", { ascending: false }),
      supabase.from("literature_notes").select("*").eq("user_id", currentUser.id),
      supabase.from("literature_excerpts").select("*").eq("user_id", currentUser.id),
      supabase.from("literature_method_notes").select("*").eq("user_id", currentUser.id),
      supabase.from("literature_paper_usages").select("*").eq("user_id", currentUser.id),
      supabase.from("literature_project_links").select("*").eq("user_id", currentUser.id),
      supabase.from("literature_reading_logs").select("*").eq("user_id", currentUser.id),
      supabase.from("literature_attachments").select("*").eq("user_id", currentUser.id),
      supabase.from("literature_tags").select("*").eq("user_id", currentUser.id),
      supabase.from("literature_tag_links").select("*").eq("user_id", currentUser.id),
    ]);
    const firstError = results.find((item) => item.error)?.error;
    if (firstError) throw firstError;

    const records = (results[0].data ?? []).map((item) => fromLiteratureRow(item));
    const notes = (results[1].data ?? []).map((item) => fromLiteratureNoteRow(item));
    const excerpts = (results[2].data ?? []).map((item) => fromLiteratureExcerptRow(item));
    const methodNotes = (results[3].data ?? []).map((item) => fromLiteratureMethodNoteRow(item));
    const paperUsages = (results[4].data ?? []).map((item) => fromLiteraturePaperUsageRow(item));
    const projectLinks = (results[5].data ?? []).map((item) => fromLiteratureProjectLinkRow(item));
    const readingLogs = (results[6].data ?? []).map((item) => fromLiteratureReadingLogRow(item));
    const rawAttachments = (results[7].data ?? []).map((item) => fromLiteratureAttachmentRow(item));
    const attachments = await Promise.all(
      rawAttachments.map(async (attachment) => {
        if (!attachment.storagePath) return attachment;
        const { data } = await supabase.storage
          .from("literature-attachments")
          .createSignedUrl(attachment.storagePath, 60 * 60 * 24 * 30);
        return { ...attachment, fileUrl: data?.signedUrl ?? attachment.fileUrl };
      }),
    );
    const tags = (results[8].data ?? []).map((item) => fromLiteratureTagRow(item));
    const tagLinks = (results[9].data ?? []).map((item) => ({
      literatureId: String(item.literature_id),
      tagId: String(item.tag_id),
      userId: String(item.user_id),
    }));

    setLiteratureTags(tags);
    setLiteratureItems(
      composeLiteratureItems(records, notes, excerpts, methodNotes, paperUsages, projectLinks, readingLogs, attachments, tags, tagLinks),
    );
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
      canSyncResearchWorkflowRef.current = false;
      lastResearchWorkflowSnapshotRef.current = null;
      setEvents(defaultEvents);
      setTasks(defaultTasks);
      setAnnualTasks([]);
      setShoppingItems([]);
      setProjectCheckins([]);
      setFootprints([]);
      setAchievements([]);
      setResearchProjects([]);
      setPaperProgress(defaultPaperProgress);
      setSubmissions([]);
      setGroupMeetings([]);
      setContinuityState(defaultExecutionContinuityState);
      setContinuityOutcomeTaskId(null);
      setResearchWorkflow(defaultResearchWorkflowState);
      setResearchWorkflowReady(false);
      setLogPosts([]);
      setLogTags([]);
      setLogReady(false);
      setLiteratureItems([]);
      setLiteratureTags([]);
      setLiteratureReady(false);
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
          research_projects?: unknown;
          paper_progress?: unknown;
          submissions?: unknown;
          group_meetings?: unknown;
          continuity_state?: unknown;
        };

        const primary = await supabase
          .from("schedule_data")
          .select(
            "events,tasks,annual_tasks,shopping_items,project_checkins,footprints,ui_preferences,achievements,research_projects,paper_progress,submissions,group_meetings,continuity_state",
          )
          .eq("user_id", user.id)
          .maybeSingle();
        let data: ScheduleDataRow | null = primary.data as ScheduleDataRow | null;
        let error = primary.error;

        if (
          error?.message &&
          (isUiPreferencesColumnMissing(error.message) ||
            isColumnMissing(error.message, "achievements") ||
            isColumnMissing(error.message, "research_projects") ||
            isColumnMissing(error.message, "paper_progress") ||
            isColumnMissing(error.message, "submissions") ||
            isColumnMissing(error.message, "group_meetings") ||
            isColumnMissing(error.message, "continuity_state") ||
            isColumnMissing(error.message, "shopping_items"))
        ) {
          const onlyContinuityMissing = isColumnMissing(error.message, "continuity_state") &&
            !isUiPreferencesColumnMissing(error.message) &&
            !isColumnMissing(error.message, "achievements") &&
            !isColumnMissing(error.message, "research_projects") &&
            !isColumnMissing(error.message, "paper_progress") &&
            !isColumnMissing(error.message, "submissions") &&
            !isColumnMissing(error.message, "group_meetings") &&
            !isColumnMissing(error.message, "shopping_items");
          const onlyShoppingMissing = isColumnMissing(error.message, "shopping_items") &&
            !isUiPreferencesColumnMissing(error.message) &&
            !isColumnMissing(error.message, "achievements") &&
            !isColumnMissing(error.message, "research_projects") &&
            !isColumnMissing(error.message, "paper_progress") &&
            !isColumnMissing(error.message, "submissions") &&
            !isColumnMissing(error.message, "group_meetings") &&
            !isColumnMissing(error.message, "continuity_state");
          const fallback = await supabase
            .from("schedule_data")
            .select(
              onlyContinuityMissing
                ? "events,tasks,annual_tasks,shopping_items,project_checkins,footprints,ui_preferences,achievements,research_projects,paper_progress,submissions,group_meetings"
                : onlyShoppingMissing
                  ? "events,tasks,annual_tasks,project_checkins,footprints,ui_preferences,achievements,research_projects,paper_progress,submissions,group_meetings,continuity_state"
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
            setResearchProjects(localBackup.research_projects);
            setPaperProgress(localBackup.paper_progress);
            setSubmissions(localBackup.submissions);
            setGroupMeetings(localBackup.group_meetings);
            setContinuityState(localBackup.continuity_state);
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
            research_projects: normalizeResearchProjects(
              (data as { research_projects?: unknown }).research_projects,
            ),
            paper_progress: normalizePaperProgress(
              (data as { paper_progress?: unknown }).paper_progress,
            ),
            submissions: normalizeSubmissions((data as { submissions?: unknown }).submissions),
            group_meetings: normalizeGroupMeetings(
              (data as { group_meetings?: unknown }).group_meetings,
            ),
            continuity_state: normalizeExecutionContinuityState(
              (data as { continuity_state?: unknown }).continuity_state,
            ),
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
          setResearchProjects(normalized.research_projects);
          setPaperProgress(normalized.paper_progress);
          setSubmissions(normalized.submissions);
          setGroupMeetings(normalized.group_meetings);
          setContinuityState(normalized.continuity_state);
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
            setResearchProjects(localBackup.research_projects);
            setPaperProgress(localBackup.paper_progress);
            setSubmissions(localBackup.submissions);
            setGroupMeetings(localBackup.group_meetings);
            setContinuityState(localBackup.continuity_state);
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
              research_projects: [],
              paper_progress: defaultPaperProgress,
              submissions: [],
              group_meetings: [],
              continuity_state: defaultExecutionContinuityState,
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
            setResearchProjects(emptyState.research_projects);
            setPaperProgress(emptyState.paper_progress);
            setSubmissions(emptyState.submissions);
            setGroupMeetings(emptyState.group_meetings);
            setContinuityState(emptyState.continuity_state);
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
        const missingResearch = isColumnMissing(withPreferences.error.message, "research_projects");
        const missingPaper = isColumnMissing(withPreferences.error.message, "paper_progress");
        const missingSubmissions = isColumnMissing(withPreferences.error.message, "submissions");
        const missingMeetings = isColumnMissing(withPreferences.error.message, "group_meetings");
        const missingContinuity = isColumnMissing(withPreferences.error.message, "continuity_state");
        const missingShopping = isColumnMissing(withPreferences.error.message, "shopping_items");
        if (
          missingUi ||
          missingAchievements ||
          missingResearch ||
          missingPaper ||
          missingSubmissions ||
          missingMeetings ||
          missingContinuity ||
          missingShopping
        ) {
          const fallbackPayload = {
            user_id: payload.user_id,
            events: payload.events,
            tasks: payload.tasks,
            annual_tasks: payload.annual_tasks,
            ...(missingShopping ? {} : { shopping_items: payload.shopping_items }),
            project_checkins: payload.project_checkins,
            footprints: payload.footprints,
            ...(missingAchievements ? {} : { achievements: payload.achievements }),
            ...(missingResearch ? {} : { research_projects: payload.research_projects }),
            ...(missingPaper ? {} : { paper_progress: payload.paper_progress }),
            ...(missingSubmissions ? {} : { submissions: payload.submissions }),
            ...(missingMeetings ? {} : { group_meetings: payload.group_meetings }),
            ...(missingContinuity ? {} : { continuity_state: payload.continuity_state }),
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
    try {
      localStorage.setItem(getScheduleBackupStorageKey(user.id), persistedPayloadJson);
    } catch {
      // ignore
    }
  }, [dataReady, persistedPayloadJson, user]);

  useEffect(() => {
    if (!user || !dataReady) return;
    let cancelled = false;
    const currentUser = user;

    async function loadResearchWorkflow() {
      const legacyFallback = buildResearchWorkflowFromLegacy(
        researchProjects,
        paperProgress,
        submissions,
        groupMeetings,
      );

      const queries = await Promise.all([
        supabase.from("research_projects").select("*").eq("user_id", currentUser.id),
        supabase.from("research_project_logs").select("*").eq("user_id", currentUser.id),
        supabase.from("research_project_attachments").select("*").eq("user_id", currentUser.id),
        supabase.from("research_papers").select("*").eq("user_id", currentUser.id),
        supabase.from("research_paper_project_links").select("*").eq("user_id", currentUser.id),
        supabase.from("research_paper_sections").select("*").eq("user_id", currentUser.id),
        supabase.from("research_paper_feedback").select("*").eq("user_id", currentUser.id),
        supabase.from("research_submissions").select("*").eq("user_id", currentUser.id),
        supabase.from("research_submission_status_history").select("*").eq("user_id", currentUser.id),
        supabase.from("research_review_comments").select("*").eq("user_id", currentUser.id),
        supabase.from("research_meetings").select("*").eq("user_id", currentUser.id),
        supabase.from("research_meeting_attachments").select("*").eq("user_id", currentUser.id),
        supabase.from("research_meeting_action_items").select("*").eq("user_id", currentUser.id),
        supabase.from("research_timeline_entries").select("*").eq("user_id", currentUser.id),
      ]);

      if (cancelled) return;

      const projectAttachmentQuery = queries[2];
      const meetingAttachmentQuery = queries[11];
      const meetingQuery = queries[10];
      const compatibilityWorkflow = meetingQuery.error
        ? legacyFallback
        : {
            ...legacyFallback,
            meetings: (meetingQuery.data ?? []).map((item) => fromMeetingRow(item)),
          };
      const nonAttachmentQueries = queries.filter((_, index) => index !== 2 && index !== 11);
      const firstError = nonAttachmentQueries.find((item) => item.error)?.error ?? null;
      if (firstError) {
        if (firstError.message.includes("does not exist")) {
          canSyncResearchWorkflowRef.current = false;
          lastResearchWorkflowSnapshotRef.current = JSON.stringify(compatibilityWorkflow);
          setEvents((prev) => reconcileMeetingRecordLinks(
            prev,
            new Set(compatibilityWorkflow.meetings.map((meeting) => meeting.id)),
          ));
          setResearchWorkflow(compatibilityWorkflow);
          setResearchWorkflowReady(true);
          return;
        }
        toast.error(`Failed to load research workflow: ${firstError.message}`);
        canSyncResearchWorkflowRef.current = false;
        lastResearchWorkflowSnapshotRef.current = JSON.stringify(compatibilityWorkflow);
        setEvents((prev) => reconcileMeetingRecordLinks(
          prev,
          new Set(compatibilityWorkflow.meetings.map((meeting) => meeting.id)),
        ));
        setResearchWorkflow(compatibilityWorkflow);
        setResearchWorkflowReady(true);
        return;
      }

      const rawProjectAttachments =
        projectAttachmentQuery.error && projectAttachmentQuery.error.message.includes("does not exist")
          ? []
          : (projectAttachmentQuery.data ?? []).map((item) => fromProjectAttachmentRow(item));
      const signedProjectAttachments = await Promise.all(
        rawProjectAttachments.map(async (attachment) => {
          if (!attachment.storagePath) return attachment;
          const { data } = await supabase.storage
            .from("research-project-attachments")
            .createSignedUrl(attachment.storagePath, 60 * 60 * 24 * 30);
          return { ...attachment, fileUrl: data?.signedUrl ?? attachment.fileUrl };
        }),
      );

      const rawMeetingAttachments =
        meetingAttachmentQuery.error && meetingAttachmentQuery.error.message.includes("does not exist")
          ? []
          : (meetingAttachmentQuery.data ?? []).map((item) => fromMeetingAttachmentRow(item));
      const signedMeetingAttachments = await Promise.all(
        rawMeetingAttachments.map(async (attachment) => {
          if (!attachment.storagePath) return attachment;
          const { data } = await supabase.storage
            .from("research-meeting-attachments")
            .createSignedUrl(attachment.storagePath, 60 * 60 * 24 * 30);
          return { ...attachment, fileUrl: data?.signedUrl ?? attachment.fileUrl };
        }),
      );

      const nextWorkflow: ResearchWorkflowState = {
        projects: (queries[0].data ?? []).map((item) => fromProjectRow(item)),
        projectLogs: (queries[1].data ?? []).map((item) => fromProjectLogRow(item)),
        projectAttachments: signedProjectAttachments,
        papers: (queries[3].data ?? []).map((item) => fromPaperRow(item)),
        paperProjectLinks: (queries[4].data ?? []).map((item) => fromPaperProjectLinkRow(item)),
        paperSections: (queries[5].data ?? []).map((item) => fromPaperSectionRow(item)),
        paperFeedback: (queries[6].data ?? []).map((item) => fromPaperFeedbackRow(item)),
        submissions: (queries[7].data ?? []).map((item) => fromSubmissionRow(item)),
        submissionStatusHistory: (queries[8].data ?? []).map((item) => fromSubmissionHistoryRow(item)),
        reviewComments: (queries[9].data ?? []).map((item) => fromReviewCommentRow(item)),
        meetings: (queries[10].data ?? []).map((item) => fromMeetingRow(item)),
        meetingAttachments: signedMeetingAttachments,
        meetingActionItems: (queries[12].data ?? []).map((item) => fromMeetingActionRow(item)),
        timelineEntries: (queries[13].data ?? []).map((item) => fromTimelineRow(item)),
      };

      const hasWorkflowData = Object.values(nextWorkflow).some(
        (value) => Array.isArray(value) && value.length > 0,
      );
      const resolvedWorkflow = hasWorkflowData ? nextWorkflow : legacyFallback;
      canSyncResearchWorkflowRef.current = true;
      lastResearchWorkflowSnapshotRef.current = JSON.stringify(resolvedWorkflow);
      setEvents((prev) => reconcileMeetingRecordLinks(
        prev,
        new Set(resolvedWorkflow.meetings.map((meeting) => meeting.id)),
      ));
      setResearchWorkflow(resolvedWorkflow);
      setResearchWorkflowReady(true);
    }

    void enqueueResearchWorkflowOperation(loadResearchWorkflow);
    return () => {
      cancelled = true;
    };
  }, [dataReady, groupMeetings, paperProgress, researchProjects, submissions, user]);

  useEffect(() => {
    if (!user || !researchWorkflowReady) return;
    if (!canSyncResearchWorkflowRef.current) return;
    if (lastResearchWorkflowSnapshotRef.current === researchWorkflowJson) return;
    const currentUser = user;

    async function syncTable(table: string, rows: Array<Record<string, unknown>>) {
      if (rows.length > 0) {
        const { error } = await supabase
          .from(table)
          .upsert(rows.map((row) => ({ ...row, user_id: currentUser.id })), { onConflict: "id" });
        if (error) return error;
      }

      const deleteQuery = supabase.from(table).delete().eq("user_id", currentUser.id);
      if (rows.length === 0) {
        return (await deleteQuery).error;
      }
      const ids = rows
        .map((row) => row.id)
        .filter((value): value is string => typeof value === "string")
        .map((value) => `"${value}"`)
        .join(",");
      return (await deleteQuery.not("id", "in", `(${ids})`)).error;
    }

    async function saveResearchWorkflow() {
      const syncJobs: Array<[string, Array<Record<string, unknown>>]> = [
        ["research_projects", researchWorkflow.projects.map((item) => toProjectRow(item))],
        ["research_project_logs", researchWorkflow.projectLogs.map((item) => toProjectLogRow(item))],
        [
          "research_project_attachments",
          researchWorkflow.projectAttachments.map((item) => toProjectAttachmentRow(item)),
        ],
        ["research_papers", researchWorkflow.papers.map((item) => toPaperRow(item))],
        ["research_paper_project_links", researchWorkflow.paperProjectLinks.map((item) => toPaperProjectLinkRow(item))],
        ["research_paper_sections", researchWorkflow.paperSections.map((item) => toPaperSectionRow(item))],
        ["research_paper_feedback", researchWorkflow.paperFeedback.map((item) => toPaperFeedbackRow(item))],
        ["research_submissions", researchWorkflow.submissions.map((item) => toSubmissionRow(item))],
        [
          "research_submission_status_history",
          researchWorkflow.submissionStatusHistory.map((item) => toSubmissionHistoryRow(item)),
        ],
        ["research_review_comments", researchWorkflow.reviewComments.map((item) => toReviewCommentRow(item))],
        ["research_meetings", researchWorkflow.meetings.map((item) => toMeetingRow(item))],
        [
          "research_meeting_attachments",
          researchWorkflow.meetingAttachments.map((item) => toMeetingAttachmentRow(item)),
        ],
        [
          "research_meeting_action_items",
          researchWorkflow.meetingActionItems.map((item) => toMeetingActionRow(item)),
        ],
        ["research_timeline_entries", researchWorkflow.timelineEntries.map((item) => toTimelineRow(item))],
      ];

      for (const [table, rows] of syncJobs) {
        const error = await syncTable(table, rows);
        if (error) {
          if (table === "research_project_attachments" && error.message.includes("does not exist")) {
            continue;
          }
          if (table === "research_meeting_attachments" && error.message.includes("does not exist")) {
            continue;
          }
          toast.error(`Failed to sync ${table}: ${error.message}`);
          return;
        }
      }
      lastResearchWorkflowSnapshotRef.current = researchWorkflowJson;
    }

    void enqueueResearchWorkflowOperation(saveResearchWorkflow);
  }, [researchWorkflow, researchWorkflowJson, researchWorkflowReady, user]);

  useEffect(() => {
    if (!user || !dataReady) return;
    let cancelled = false;
    const currentUser = user;

    async function loadLiteratures() {
      try {
        await refreshLiteratures(currentUser);
        if (!cancelled) setLiteratureReady(true);
      } catch (firstError) {
        if (cancelled) return;
        const message = firstError instanceof Error ? firstError.message : String(firstError);
        if (message.includes("does not exist")) {
          setLiteratureItems([]);
          setLiteratureTags([]);
          setLiteratureReady(true);
          return;
        }
        toast.error(`Failed to load literatures: ${message}`);
        setLiteratureReady(true);
      }
    }

    loadLiteratures();
    return () => {
      cancelled = true;
    };
  }, [dataReady, user]);

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
    if (!user) return;
    setLogUploading(true);
    const currentUser = user;
    const now = new Date().toISOString();
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
          created_at: now,
          updated_at: now,
        })
        .select("*")
        .single();
      if (error) throw error;
      const post = fromLogPostRow(data);
      await uploadLogImages(currentUser, post.id, input.images.slice(0, 9));
      await syncLogPostTags(currentUser, post.id, input.tagNames);
      await syncLogPostLinks(currentUser, post.id, input.links);
      await refreshLogs(currentUser);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to create log post: ${message}`);
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

  async function upsertLiteratureTagsForUser(currentUser: User, tagNames: string[]) {
    const cleaned = Array.from(new Set(tagNames.map((item) => item.trim()).filter(Boolean)));
    if (cleaned.length === 0) return [] as LiteratureTag[];
    const { error } = await supabase.from("literature_tags").upsert(
      cleaned.map((name) => ({
        user_id: currentUser.id,
        name,
      })),
      { onConflict: "user_id,name" },
    );
    if (error) throw error;
    const { data, error: selectError } = await supabase
      .from("literature_tags")
      .select("*")
      .eq("user_id", currentUser.id)
      .in("name", cleaned);
    if (selectError) throw selectError;
    return (data ?? []).map((item) => fromLiteratureTagRow(item));
  }

  async function recalculateLiteratureTagUsage(currentUser: User) {
    const [{ data: links, error: linksError }, { data: tagsData, error: tagsError }] = await Promise.all([
      supabase.from("literature_tag_links").select("tag_id").eq("user_id", currentUser.id),
      supabase.from("literature_tags").select("*").eq("user_id", currentUser.id),
    ]);
    if (linksError) throw linksError;
    if (tagsError) throw tagsError;
    const usageMap = new Map<string, number>();
    (links ?? []).forEach((item) => {
      const tagId = String(item.tag_id);
      usageMap.set(tagId, (usageMap.get(tagId) ?? 0) + 1);
    });
    for (const row of tagsData ?? []) {
      const count = usageMap.get(String(row.id)) ?? 0;
      const { error } = await supabase
        .from("literature_tags")
        .update({ usage_count: count, updated_at: new Date().toISOString() })
        .eq("id", row.id)
        .eq("user_id", currentUser.id);
      if (error) throw error;
    }
  }

  async function syncLiteratureTagLinks(currentUser: User, literatureId: string, tagNames: string[]) {
    await supabase.from("literature_tag_links").delete().eq("literature_id", literatureId).eq("user_id", currentUser.id);
    const tags = await upsertLiteratureTagsForUser(currentUser, tagNames);
    if (tags.length > 0) {
      const { error } = await supabase.from("literature_tag_links").insert(
        tags.map((tag) => ({
          literature_id: literatureId,
          tag_id: tag.id,
          user_id: currentUser.id,
        })),
      );
      if (error) throw error;
    }
    await recalculateLiteratureTagUsage(currentUser);
  }

  async function syncLiteratureProjectLinks(currentUser: User, literatureId: string, projectIds: string[]) {
    await supabase.from("literature_project_links").delete().eq("literature_id", literatureId).eq("user_id", currentUser.id);
    const cleaned = Array.from(new Set(projectIds.filter(Boolean)));
    if (cleaned.length === 0) return;
    const { error } = await supabase.from("literature_project_links").insert(
      cleaned.map((projectId) => ({
        literature_id: literatureId,
        user_id: currentUser.id,
        project_id: projectId,
      })),
    );
    if (error) throw error;
  }

  async function syncLiteraturePaperUsages(currentUser: User, literatureId: string, paperIds: string[]) {
    const cleaned = Array.from(new Set(paperIds.filter(Boolean)));
    const { data: existingRows, error: selectError } = await supabase
      .from("literature_paper_usages")
      .select("id,paper_id")
      .eq("literature_id", literatureId)
      .eq("user_id", currentUser.id);
    if (selectError) throw selectError;

    const existing = (existingRows ?? []).map((row) => ({
      id: String(row.id ?? ""),
      paperId: String(row.paper_id ?? ""),
    }));
    const deleteIds = existing.filter((row) => !cleaned.includes(row.paperId)).map((row) => row.id).filter(Boolean);
    if (deleteIds.length > 0) {
      const { error } = await supabase
        .from("literature_paper_usages")
        .delete()
        .eq("user_id", currentUser.id)
        .in("id", deleteIds);
      if (error) throw error;
    }

    const existingPaperIds = new Set(existing.map((row) => row.paperId));
    const newPaperIds = cleaned.filter((paperId) => !existingPaperIds.has(paperId));
    if (newPaperIds.length === 0) return;
    const now = new Date().toISOString();
    const { error } = await supabase.from("literature_paper_usages").insert(
      newPaperIds.map((paperId) => ({
        literature_id: literatureId,
        user_id: currentUser.id,
        paper_id: paperId,
        chapter: "",
        usage_type: "background",
        note: "",
        citation_status: "planned",
        created_at: now,
        updated_at: now,
      })),
    );
    if (error) throw error;
  }

  async function handleCreateLiterature(input: LiteratureFormInput) {
    if (!user) return;
    const currentUser = user;
    const now = new Date().toISOString();
    try {
      const { data, error } = await supabase
        .from("literatures")
        .insert({
          user_id: currentUser.id,
          title: input.title.trim(),
          authors: input.authors.trim(),
          publish_year: input.year.trim() ? Number(input.year.trim()) : null,
          venue: input.venue.trim(),
          doi: input.doi.trim(),
          url: input.url.trim(),
          pdf_url: input.pdfUrl.trim(),
          abstract: input.abstract.trim(),
          keywords: input.keywords
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          status: input.status,
          importance: input.importance,
          summary: input.summary.trim(),
          contributions: input.contributions.trim(),
          limitations: input.limitations.trim(),
          created_at: now,
          updated_at: now,
          linked_task_ids: [],
          linked_event_ids: [],
          linked_meeting_ids: [],
          linked_log_post_ids: [],
        })
        .select("id")
        .single();
      if (error) throw error;
      const literatureId = String(data.id);
      await Promise.all([
        syncLiteratureTagLinks(currentUser, literatureId, input.tagNames),
        syncLiteratureProjectLinks(currentUser, literatureId, input.projectIds),
        syncLiteraturePaperUsages(currentUser, literatureId, input.paperIds),
      ]);
      await refreshLiteratures(currentUser);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to create literature: ${message}`);
    }
  }

  async function handleUpdateLiterature(literatureId: string, input: LiteratureFormInput) {
    if (!user) return;
    const currentUser = user;
    try {
      const { error } = await supabase
        .from("literatures")
        .update({
          title: input.title.trim(),
          authors: input.authors.trim(),
          publish_year: input.year.trim() ? Number(input.year.trim()) : null,
          venue: input.venue.trim(),
          doi: input.doi.trim(),
          url: input.url.trim(),
          pdf_url: input.pdfUrl.trim(),
          abstract: input.abstract.trim(),
          keywords: input.keywords
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          status: input.status,
          importance: input.importance,
          summary: input.summary.trim(),
          contributions: input.contributions.trim(),
          limitations: input.limitations.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", literatureId)
        .eq("user_id", currentUser.id);
      if (error) throw error;
      await Promise.all([
        syncLiteratureTagLinks(currentUser, literatureId, input.tagNames),
        syncLiteratureProjectLinks(currentUser, literatureId, input.projectIds),
        syncLiteraturePaperUsages(currentUser, literatureId, input.paperIds),
      ]);
      await refreshLiteratures(currentUser);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to update literature: ${message}`);
    }
  }

  async function handleDeleteLiterature(literatureId: string) {
    if (!user) return;
    const currentUser = user;
    try {
      await Promise.all([
        supabase.from("literature_tag_links").delete().eq("literature_id", literatureId).eq("user_id", currentUser.id),
        supabase.from("literature_paper_usages").delete().eq("literature_id", literatureId).eq("user_id", currentUser.id),
        supabase.from("literature_project_links").delete().eq("literature_id", literatureId).eq("user_id", currentUser.id),
        supabase.from("literature_excerpts").delete().eq("literature_id", literatureId).eq("user_id", currentUser.id),
        supabase.from("literature_method_notes").delete().eq("literature_id", literatureId).eq("user_id", currentUser.id),
        supabase.from("literature_reading_logs").delete().eq("literature_id", literatureId).eq("user_id", currentUser.id),
        supabase.from("literature_notes").delete().eq("literature_id", literatureId).eq("user_id", currentUser.id),
        supabase.from("literature_attachments").delete().eq("literature_id", literatureId).eq("user_id", currentUser.id),
      ]);
      const { error } = await supabase.from("literatures").delete().eq("id", literatureId).eq("user_id", currentUser.id);
      if (error) throw error;
      await recalculateLiteratureTagUsage(currentUser);
      await refreshLiteratures(currentUser);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to delete literature: ${message}`);
    }
  }

  async function handleSaveLiteratureNote(literatureId: string, input: LiteratureNoteInput) {
    if (!user) return;
    try {
      const { error } = await supabase.from("literature_notes").upsert(
        {
          literature_id: literatureId,
          user_id: user.id,
          research_question: input.researchQuestion.trim(),
          research_background: input.researchBackground.trim(),
          data_source: input.dataSource.trim(),
          method: input.method.trim(),
          findings: input.findings.trim(),
          innovations: input.innovations.trim(),
          shortcomings: input.shortcomings.trim(),
          inspiration: input.inspiration.trim(),
          quotable_content: input.quotableContent.trim(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "literature_id,user_id" },
      );
      if (error) throw error;
      await refreshLiteratures(user);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to save literature note: ${message}`);
    }
  }

  async function handleCreateLiteratureExcerpt(literatureId: string, input: LiteratureExcerptInput) {
    if (!user) return;
    try {
      const now = new Date().toISOString();
      const { error } = await supabase.from("literature_excerpts").insert({
        literature_id: literatureId,
        user_id: user.id,
        content: input.content.trim(),
        page: input.page.trim(),
        note: input.note.trim(),
        excerpt_type: input.excerptType,
        paper_section: input.paperSection,
        tags: input.tags,
        created_at: now,
        updated_at: now,
      });
      if (error) throw error;
      await refreshLiteratures(user);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to create excerpt: ${message}`);
    }
  }

  async function handleUpdateLiteratureExcerpt(excerptId: string, input: LiteratureExcerptInput) {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("literature_excerpts")
        .update({
          content: input.content.trim(),
          page: input.page.trim(),
          note: input.note.trim(),
          excerpt_type: input.excerptType,
          paper_section: input.paperSection,
          tags: input.tags,
          updated_at: new Date().toISOString(),
        })
        .eq("id", excerptId)
        .eq("user_id", user.id);
      if (error) throw error;
      await refreshLiteratures(user);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to update excerpt: ${message}`);
    }
  }

  async function handleDeleteLiteratureExcerpt(excerptId: string) {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("literature_excerpts")
        .delete()
        .eq("id", excerptId)
        .eq("user_id", user.id);
      if (error) throw error;
      await refreshLiteratures(user);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to delete excerpt: ${message}`);
    }
  }

  async function handleCreateLiteratureMethodNote(literatureId: string, input: LiteratureMethodNoteInput) {
    if (!user) return;
    try {
      const now = new Date().toISOString();
      const { error } = await supabase.from("literature_method_notes").insert({
        literature_id: literatureId,
        user_id: user.id,
        name: input.name.trim(),
        description: input.description.trim(),
        required_data: input.requiredData.trim(),
        strengths: input.strengths.trim(),
        weaknesses: input.weaknesses.trim(),
        applicability: input.applicability.trim(),
        planned_to_use: input.plannedToUse,
        project_id: input.projectId,
        paper_id: input.paperId,
        created_at: now,
        updated_at: now,
      });
      if (error) throw error;
      await refreshLiteratures(user);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to create method note: ${message}`);
    }
  }

  async function handleUpdateLiteratureMethodNote(methodId: string, input: LiteratureMethodNoteInput) {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("literature_method_notes")
        .update({
          name: input.name.trim(),
          description: input.description.trim(),
          required_data: input.requiredData.trim(),
          strengths: input.strengths.trim(),
          weaknesses: input.weaknesses.trim(),
          applicability: input.applicability.trim(),
          planned_to_use: input.plannedToUse,
          project_id: input.projectId,
          paper_id: input.paperId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", methodId)
        .eq("user_id", user.id);
      if (error) throw error;
      await refreshLiteratures(user);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to update method note: ${message}`);
    }
  }

  async function handleDeleteLiteratureMethodNote(methodId: string) {
    if (!user) return;
    try {
      const { error } = await supabase.from("literature_method_notes").delete().eq("id", methodId).eq("user_id", user.id);
      if (error) throw error;
      await refreshLiteratures(user);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to delete method note: ${message}`);
    }
  }

  async function handleCreateLiteraturePaperUsage(literatureId: string, input: LiteraturePaperUsageInput) {
    if (!user) return;
    try {
      const now = new Date().toISOString();
      const { error } = await supabase.from("literature_paper_usages").insert({
        literature_id: literatureId,
        user_id: user.id,
        paper_id: input.paperId,
        chapter: input.chapter.trim(),
        usage_type: input.usageType,
        note: input.note.trim(),
        citation_status: input.citationStatus,
        created_at: now,
        updated_at: now,
      });
      if (error) throw error;
      await refreshLiteratures(user);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to create paper usage: ${message}`);
    }
  }

  async function handleUpdateLiteraturePaperUsage(usageId: string, input: LiteraturePaperUsageInput) {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("literature_paper_usages")
        .update({
          paper_id: input.paperId,
          chapter: input.chapter.trim(),
          usage_type: input.usageType,
          note: input.note.trim(),
          citation_status: input.citationStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", usageId)
        .eq("user_id", user.id);
      if (error) throw error;
      await refreshLiteratures(user);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to update paper usage: ${message}`);
    }
  }

  async function handleDeleteLiteraturePaperUsage(usageId: string) {
    if (!user) return;
    try {
      const { error } = await supabase.from("literature_paper_usages").delete().eq("id", usageId).eq("user_id", user.id);
      if (error) throw error;
      await refreshLiteratures(user);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to delete paper usage: ${message}`);
    }
  }

  async function handleCreateLiteratureReadingLog(literatureId: string, input: LiteratureReadingLogInput) {
    if (!user) return;
    try {
      const { error } = await supabase.from("literature_reading_logs").insert({
        literature_id: literatureId,
        user_id: user.id,
        logged_at: input.loggedAt ? new Date(input.loggedAt).toISOString() : new Date().toISOString(),
        duration_minutes: Math.max(0, Number(input.durationMinutes) || 0),
        progress_text: input.progressText.trim(),
        status_after: input.statusAfter,
        linked_task_id: input.linkedTaskId.trim() || null,
        linked_event_id: input.linkedEventId.trim() || null,
        linked_log_post_id: input.linkedLogPostId.trim() || null,
      });
      if (error) throw error;
      await refreshLiteratures(user);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to create reading log: ${message}`);
    }
  }

  async function handleUpdateLiteratureReadingLog(logId: string, input: LiteratureReadingLogInput) {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("literature_reading_logs")
        .update({
          logged_at: input.loggedAt ? new Date(input.loggedAt).toISOString() : new Date().toISOString(),
          duration_minutes: Math.max(0, Number(input.durationMinutes) || 0),
          progress_text: input.progressText.trim(),
          status_after: input.statusAfter,
          linked_task_id: input.linkedTaskId.trim() || null,
          linked_event_id: input.linkedEventId.trim() || null,
          linked_log_post_id: input.linkedLogPostId.trim() || null,
        })
        .eq("id", logId)
        .eq("user_id", user.id);
      if (error) throw error;
      await refreshLiteratures(user);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to update reading log: ${message}`);
    }
  }

  async function handleDeleteLiteratureReadingLog(logId: string) {
    if (!user) return;
    try {
      const { error } = await supabase.from("literature_reading_logs").delete().eq("id", logId).eq("user_id", user.id);
      if (error) throw error;
      await refreshLiteratures(user);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to delete reading log: ${message}`);
    }
  }

  async function handleUploadLiteratureAttachments(literatureId: string, files: File[]) {
    if (!user || files.length === 0) return;
    const currentUser = user;
    try {
      for (const file of files) {
        const safeName = file.name.replace(/[^\w.\-]+/g, "_");
        const storagePath = `${currentUser.id}/${literatureId}/${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("literature-attachments")
          .upload(storagePath, file, { upsert: false });
        if (uploadError) throw uploadError;

        const { data: signedData } = await supabase.storage
          .from("literature-attachments")
          .createSignedUrl(storagePath, 60 * 60 * 24 * 30);

        const { error: insertError } = await supabase.from("literature_attachments").insert({
          id: createId("literature-attachment"),
          literature_id: literatureId,
          user_id: currentUser.id,
          file_name: file.name,
          file_type: file.type || "application/octet-stream",
          file_size: file.size,
          storage_path: storagePath,
          file_url: signedData?.signedUrl ?? "",
          created_at: new Date().toISOString(),
        });
        if (insertError) throw insertError;
      }
      await refreshLiteratures(currentUser);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to upload literature attachments: ${message}`);
    }
  }

  async function handleDeleteLiteratureAttachment(attachmentId: string) {
    if (!user) return;
    const currentUser = user;
    const attachment = literatureItems
      .flatMap((item) => item.attachments)
      .find((item) => item.id === attachmentId);
    if (!attachment) return;
    try {
      if (attachment.storagePath) {
        const { error: storageError } = await supabase.storage
          .from("literature-attachments")
          .remove([attachment.storagePath]);
        if (storageError) throw storageError;
      }
      const { error } = await supabase
        .from("literature_attachments")
        .delete()
        .eq("id", attachmentId)
        .eq("user_id", currentUser.id);
      if (error) throw error;
      await refreshLiteratures(currentUser);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to delete literature attachment: ${message}`);
    }
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

  function handleCreateWorkflowTask(input: { title: string; dueDate?: string; notes?: string }) {
    const trimmedTitle = input.title.trim();
    if (!trimmedTitle) return null;
    const id = createId("task");
    setTasks((prev) => [
      ...prev,
      {
        id,
        name: trimmedTitle,
        dueDate: input.dueDate || todayISO(),
        createdAt: new Date().toISOString(),
        completedAt: null,
        done: false,
        notes: input.notes?.trim() ?? "",
        precautions: [],
        completionLog: "",
        priority: "不紧急重要" as Priority,
        subtasks: [],
        taskType: "long",
        isTodayFocus: false,
      },
    ]);
    return id;
  }

  function handleCreateWorkflowEvent(input: { title: string; date: string; notes?: string }) {
    const trimmedTitle = input.title.trim();
    if (!trimmedTitle || !input.date) return null;
    const id = createId("evt");
    setEvents((prev) => [
      ...prev,
      {
        id,
        date: input.date,
        startHour: 9,
        endHour: 10,
        title: trimmedTitle,
        notes: input.notes?.trim() ?? "",
        requirements: [],
        isCompleted: false,
        category: DEFAULT_SCHEDULE_CATEGORY,
        tag: null,
      },
    ]);
    return id;
  }

  async function handleUploadProjectAttachments(projectId: string, files: File[]) {
    if (!user || files.length === 0) return;
    const currentUser = user;
    try {
      const uploaded: ProjectAttachment[] = [];
      for (const file of files) {
        const safeName = file.name.replace(/[^\w.\-]+/g, "_");
        const storagePath = `${currentUser.id}/${projectId}/${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("research-project-attachments")
          .upload(storagePath, file, { upsert: false });
        if (uploadError) throw uploadError;

        const { data: signedData } = await supabase.storage
          .from("research-project-attachments")
          .createSignedUrl(storagePath, 60 * 60 * 24 * 30);

        const attachment: ProjectAttachment = {
          id: createId("project-attachment"),
          projectId,
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          fileSize: file.size,
          storagePath,
          fileUrl: signedData?.signedUrl ?? "",
          createdAt: new Date().toISOString(),
        };

        const { error: insertError } = await supabase
          .from("research_project_attachments")
          .insert({ ...toProjectAttachmentRow(attachment), user_id: currentUser.id });
        if (insertError) throw insertError;
        uploaded.push(attachment);
      }

      setResearchWorkflow((prev) => ({
        ...prev,
        projectAttachments: [...uploaded, ...prev.projectAttachments],
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to upload project attachments: ${message}`);
    }
  }

  async function handleDeleteProjectAttachment(attachmentId: string) {
    if (!user) return;
    const attachment = researchWorkflow.projectAttachments.find((item) => item.id === attachmentId);
    if (!attachment) return;
    try {
      if (attachment.storagePath) {
        const { error: storageError } = await supabase.storage
          .from("research-project-attachments")
          .remove([attachment.storagePath]);
        if (storageError) throw storageError;
      }
      const { error } = await supabase
        .from("research_project_attachments")
        .delete()
        .eq("id", attachmentId)
        .eq("user_id", user.id);
      if (error) throw error;
      setResearchWorkflow((prev) => ({
        ...prev,
        projectAttachments: prev.projectAttachments.filter((item) => item.id !== attachmentId),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to delete project attachment: ${message}`);
    }
  }

  async function handleUploadMeetingAttachments(meetingId: string, files: File[]) {
    if (!user || files.length === 0) return;
    const currentUser = user;
    try {
      const uploaded: MeetingAttachment[] = [];
      for (const file of files) {
        const safeName = file.name.replace(/[^\w.\-]+/g, "_");
        const storagePath = `${currentUser.id}/${meetingId}/${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("research-meeting-attachments")
          .upload(storagePath, file, { upsert: false });
        if (uploadError) throw uploadError;

        const { data: signedData } = await supabase.storage
          .from("research-meeting-attachments")
          .createSignedUrl(storagePath, 60 * 60 * 24 * 30);

        const attachment: MeetingAttachment = {
          id: createId("meeting-attachment"),
          meetingId,
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          fileSize: file.size,
          storagePath,
          fileUrl: signedData?.signedUrl ?? "",
          createdAt: new Date().toISOString(),
        };

        const { error: insertError } = await supabase
          .from("research_meeting_attachments")
          .insert({ ...toMeetingAttachmentRow(attachment), user_id: currentUser.id });
        if (insertError) throw insertError;
        uploaded.push(attachment);
      }

      setResearchWorkflow((prev) => ({
        ...prev,
        meetingAttachments: [...uploaded, ...prev.meetingAttachments],
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to upload meeting attachments: ${message}`);
    }
  }

  async function handleDeleteMeetingAttachment(attachmentId: string) {
    if (!user) return;
    const attachment = researchWorkflow.meetingAttachments.find((item) => item.id === attachmentId);
    if (!attachment) return;
    try {
      if (attachment.storagePath) {
        const { error: storageError } = await supabase.storage
          .from("research-meeting-attachments")
          .remove([attachment.storagePath]);
        if (storageError) throw storageError;
      }
      const { error } = await supabase
        .from("research_meeting_attachments")
        .delete()
        .eq("id", attachmentId)
        .eq("user_id", user.id);
      if (error) throw error;
      setResearchWorkflow((prev) => ({
        ...prev,
        meetingAttachments: prev.meetingAttachments.filter((item) => item.id !== attachmentId),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to delete meeting attachment: ${message}`);
    }
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

  async function handleCreateMeetingRecord(
    event: ScheduleEvent,
    input: MeetingCompletionInput,
  ): Promise<string | null> {
    if (!user || !researchWorkflowReady) {
      toast.error("组会记录仍在同步，请稍后再试；日程仍保持未完成");
      return null;
    }
    const currentUser = user;
    return enqueueResearchWorkflowOperation(async () => {
      const meetingId = createId("meeting");
      const linkedEventId = parseSyntheticEventId(event.id)?.masterId ?? event.id;
      const links = { ...emptyLinkState(), linkedEventIds: [linkedEventId] };
      const meeting: WorkflowGroupMeetingRecord = {
        id: meetingId,
        date: input.date,
        title: input.title || event.title,
        meetingType: "group",
        attendees: input.attendees,
        summary: input.summary,
        discussionNotes: input.discussionNotes,
        mentorFeedback: input.mentorFeedback,
        decisions: input.decisions,
        nextMeetingDate: "",
        projectIds: [],
        paperIds: [],
        submissionIds: [],
        followUp: input.followUp,
        ...links,
      };
      const timelineEntry: TimelineEntry = {
        id: createId("timeline"),
        entityType: "meeting",
        entityId: meetingId,
        date: input.date,
        title: `组会记录：${meeting.title}`,
        description: input.summary,
        ...links,
      };

      try {
        const { error: meetingError } = await supabase
          .from("research_meetings")
          .upsert({ ...toMeetingRow(meeting), user_id: currentUser.id }, { onConflict: "id" });
        if (meetingError) throw meetingError;

        const { error: timelineError } = await supabase
          .from("research_timeline_entries")
          .upsert({ ...toTimelineRow(timelineEntry), user_id: currentUser.id }, { onConflict: "id" });
        if (timelineError) {
          console.error("Failed to persist the meeting timeline entry", timelineError);
        }

        setResearchWorkflow((prev) => ({
          ...prev,
          meetings: [meeting, ...prev.meetings],
          timelineEntries: [timelineEntry, ...prev.timelineEntries],
        }));
        return meetingId;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        toast.error(`组会记录保存失败，日程仍保持未完成：${message}`);
        return null;
      }
    });
  }

  function handleResearchWorkflowChange(nextWorkflow: ResearchWorkflowState) {
    const nextMeetingIds = new Set(nextWorkflow.meetings.map((meeting) => meeting.id));
    const removedMeetingIds = new Set(
      researchWorkflow.meetings
        .map((meeting) => meeting.id)
        .filter((meetingId) => !nextMeetingIds.has(meetingId)),
    );

    if (removedMeetingIds.size > 0) {
      setEvents((prev) => detachDeletedMeetingRecords(prev, removedMeetingIds));
      toast.info("已删除关联组会记录，对应会议日程已恢复为未完成");
    }

    setResearchWorkflow(nextWorkflow);
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
                  meetingRecordIds={researchMeetingRecordIds}
                  onCreateEvent={handleCreateEvent}
                  onCreateEvents={handleCreateEvents}
                  onCreateDailyTask={(name, date) => handleAddTask(name, date, "daily")}
                  onCreateMeetingRecord={handleCreateMeetingRecord}
                  onUpdateEvent={handleUpdateEvent}
                  onDeleteEvent={handleDeleteEvent}
                  onPrevWeek={handleGoPrevWeek}
                  onNextWeek={handleGoNextWeek}
                  onViewModeChange={handleViewModeChange}
                  onTimeGranularityChange={handleTimeGranularityChange}
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
                  onRecordTaskOutcome={(taskId) => {
                    setContinuityOutcomeTaskId(taskId);
                    setActiveModule("continuity");
                  }}
                  executionOutcomes={continuityState.outcomes}
                />
              </section>
            </div>
          ) : activeModule === "continuity" ? (
            <ExecutionContinuityPanel
              value={continuityState}
              onChange={setContinuityState}
              projects={continuityProjectOptions}
              tasks={tasks}
              events={events}
              initialOutcomeTaskId={continuityOutcomeTaskId}
              onInitialOutcomeHandled={() => setContinuityOutcomeTaskId(null)}
            />
          ) : isResearchWorkflowModule(activeModule) ? (
            <ResearchWorkflowPanel
              module={activeModule}
              workflow={researchWorkflow}
              onChange={handleResearchWorkflowChange}
              onCreateTask={handleCreateWorkflowTask}
              onCreateEvent={handleCreateWorkflowEvent}
              onUploadProjectAttachments={handleUploadProjectAttachments}
              onDeleteProjectAttachment={handleDeleteProjectAttachment}
              onUploadMeetingAttachments={handleUploadMeetingAttachments}
              onDeleteMeetingAttachment={handleDeleteMeetingAttachment}
            />
          ) : activeModule === "relationships" ? (
            <RelationshipExchangePanel
              userId={user.id}
              tasks={tasks}
              events={events}
              workflow={researchWorkflow}
              onCreateTask={handleCreateWorkflowTask}
              onCreateEvent={handleCreateWorkflowEvent}
            />
          ) : activeModule === "literature" ? (
            literatureReady ? (
              <LiteraturePage
                items={literatureItems}
                tags={literatureTags}
                projects={literatureProjectOptions}
                papers={literaturePaperOptions}
                onCreateLiterature={handleCreateLiterature}
                onUpdateLiterature={handleUpdateLiterature}
                onDeleteLiterature={handleDeleteLiterature}
                onSaveNote={handleSaveLiteratureNote}
                onCreateExcerpt={handleCreateLiteratureExcerpt}
                onUpdateExcerpt={handleUpdateLiteratureExcerpt}
                onDeleteExcerpt={handleDeleteLiteratureExcerpt}
                onCreateMethodNote={handleCreateLiteratureMethodNote}
                onUpdateMethodNote={handleUpdateLiteratureMethodNote}
                onDeleteMethodNote={handleDeleteLiteratureMethodNote}
                onCreatePaperUsage={handleCreateLiteraturePaperUsage}
                onUpdatePaperUsage={handleUpdateLiteraturePaperUsage}
                onDeletePaperUsage={handleDeleteLiteraturePaperUsage}
                onCreateReadingLog={handleCreateLiteratureReadingLog}
                onUpdateReadingLog={handleUpdateLiteratureReadingLog}
                onDeleteReadingLog={handleDeleteLiteratureReadingLog}
                onUploadAttachments={handleUploadLiteratureAttachments}
                onDeleteAttachment={handleDeleteLiteratureAttachment}
              />
            ) : (
              <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-md">
                <p className="text-sm text-gray-600">正在加载文献阅读模块...</p>
              </section>
            )
          ) : activeModule === "logs" ? (
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
          ) : (
            <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-md">
              <p className="text-sm text-gray-600">模块开发中：{activeModule}</p>
            </section>
          )}
        </div>
      </div>
      <LLMChatSidebar />
      <QuickNoteFab />
    </main>
  );
}
