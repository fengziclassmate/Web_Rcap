import type { Achievement } from "@/components/monitoring/achievements-panel";
import type { FootprintItem, AnnualTask, DashboardUiPreferences, LongTask, ProjectCheckin, ScheduleEvent } from "@/lib/types";
import type { GroupMeetingRecord } from "@/components/monitoring/group-meetings-panel";
import type { PaperProgress } from "@/components/monitoring/paper-progress-panel";
import type { ResearchProject } from "@/components/monitoring/research-projects-panel";
import type { SubmissionRecord } from "@/components/monitoring/submissions-panel";
import {
  defaultDashboardUiPreferences,
  normalizeAchievements,
  normalizeAnnualTasks,
  normalizeDashboardUiPreferences,
  normalizeEvents,
  normalizeFootprints,
  normalizeGroupMeetings,
  normalizePaperProgress,
  normalizeProjectCheckins,
  normalizeResearchProjects,
  normalizeSubmissions,
  normalizeTasks,
} from "@/lib/normalizers";

const DASHBOARD_UI_PREFS_STORAGE_KEY = "schedule-dashboard-collapse-state";
const SCHEDULE_DATA_BACKUP_STORAGE_PREFIX = "schedule-data-backup";

export type PersistedSchedulePayload = {
  events: ScheduleEvent[];
  tasks: LongTask[];
  annual_tasks: AnnualTask[];
  project_checkins: ProjectCheckin[];
  footprints: FootprintItem[];
  achievements: Achievement[];
  research_projects: ResearchProject[];
  paper_progress: PaperProgress;
  submissions: SubmissionRecord[];
  group_meetings: GroupMeetingRecord[];
  ui_preferences: DashboardUiPreferences;
};

export function getScheduleBackupStorageKey(userId: string) {
  return `${SCHEDULE_DATA_BACKUP_STORAGE_PREFIX}:${userId}`;
}

export function normalizePersistedSchedulePayload(
  payload: unknown,
): PersistedSchedulePayload | null {
  if (!payload || typeof payload !== "object") return null;
  const value = payload as Partial<PersistedSchedulePayload>;
  return {
    events: normalizeEvents(value.events),
    tasks: normalizeTasks(value.tasks),
    annual_tasks: normalizeAnnualTasks(value.annual_tasks),
    project_checkins: normalizeProjectCheckins(value.project_checkins),
    footprints: normalizeFootprints(value.footprints),
    achievements: normalizeAchievements(value.achievements),
    research_projects: normalizeResearchProjects(value.research_projects),
    paper_progress: normalizePaperProgress(value.paper_progress),
    submissions: normalizeSubmissions(value.submissions),
    group_meetings: normalizeGroupMeetings(value.group_meetings),
    ui_preferences: normalizeDashboardUiPreferences(value.ui_preferences),
  };
}

export function readScheduleBackupFromLocal(userId: string): PersistedSchedulePayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(getScheduleBackupStorageKey(userId));
    if (!raw) return null;
    return normalizePersistedSchedulePayload(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function readDashboardUiPreferencesFromLocal(): DashboardUiPreferences {
  if (typeof window === "undefined") return defaultDashboardUiPreferences;
  try {
    const raw = localStorage.getItem(DASHBOARD_UI_PREFS_STORAGE_KEY);
    if (!raw) return defaultDashboardUiPreferences;
    return normalizeDashboardUiPreferences(JSON.parse(raw));
  } catch {
    return defaultDashboardUiPreferences;
  }
}

export function writeDashboardUiPreferencesToLocal(value: DashboardUiPreferences) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DASHBOARD_UI_PREFS_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Local backup is best-effort only.
  }
}

export function isColumnMissing(message: string, column: string) {
  return (
    message.includes(column) &&
    (message.includes("schema cache") || message.includes("does not exist"))
  );
}

export function isUiPreferencesColumnMissing(message: string) {
  return isColumnMissing(message, "ui_preferences");
}
