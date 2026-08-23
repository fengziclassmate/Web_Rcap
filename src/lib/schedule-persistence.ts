import type { FootprintItem, AnnualTask, DashboardUiPreferences, LongTask, ProjectCheckin, ScheduleEvent, ShoppingItem } from "@/lib/types";
import type { Achievement } from "@/lib/achievements";
import {
  defaultDashboardUiPreferences,
  normalizeAchievements,
  normalizeAnnualTasks,
  normalizeDashboardUiPreferences,
  normalizeEvents,
  normalizeFootprints,
  normalizeProjectCheckins,
  normalizeShoppingItems,
  normalizeTasks,
} from "@/lib/normalizers";

const DASHBOARD_UI_PREFS_STORAGE_KEY = "schedule-dashboard-collapse-state";
const SCHEDULE_DATA_BACKUP_STORAGE_PREFIX = "schedule-data-backup";

export type PersistedSchedulePayload = {
  events: ScheduleEvent[];
  tasks: LongTask[];
  annual_tasks: AnnualTask[];
  shopping_items: ShoppingItem[];
  project_checkins: ProjectCheckin[];
  footprints: FootprintItem[];
  achievements: Achievement[];
  ui_preferences: DashboardUiPreferences;
};

export function getScheduleBackupStorageKey(userId: string) {
  return `${SCHEDULE_DATA_BACKUP_STORAGE_PREFIX}:${userId}`;
}

function normalizePersistedSchedulePayload(
  payload: unknown,
): PersistedSchedulePayload | null {
  if (!payload || typeof payload !== "object") return null;
  const value = payload as Partial<PersistedSchedulePayload>;
  return {
    events: normalizeEvents(value.events),
    tasks: normalizeTasks(value.tasks),
    annual_tasks: normalizeAnnualTasks(value.annual_tasks),
    shopping_items: normalizeShoppingItems(value.shopping_items),
    project_checkins: normalizeProjectCheckins(value.project_checkins),
    footprints: normalizeFootprints(value.footprints),
    achievements: normalizeAchievements(value.achievements),
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

export function writeScheduleBackupToLocal(userId: string, payload: PersistedSchedulePayload) {
  if (typeof window === "undefined") return;
  const storageKey = getScheduleBackupStorageKey(userId);
  try {
    const raw = localStorage.getItem(storageKey);
    const existing = raw ? JSON.parse(raw) : null;
    const preservedFields =
      existing && typeof existing === "object" && !Array.isArray(existing)
        ? existing as Record<string, unknown>
        : {};
    localStorage.setItem(storageKey, JSON.stringify({ ...preservedFields, ...payload }));
  } catch {
    try {
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      // Local backup is best-effort only.
    }
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
