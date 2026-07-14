import type { RecurrenceConfig, RecurrenceInstanceOverride } from "@/lib/recurrence";

export const ROUTINE_CHECKIN_PROJECT_ID = "routine-checkin-task";

export type EventTag = "\u5f85\u5b9a" | "\u4e0d\u7740\u6025" | "\u4e0d\u53ef\u540e\u9000" | null;

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

export type Priority =
  | "\u7d27\u6025\u4e14\u91cd\u8981"
  | "\u7d27\u6025\u4e0d\u91cd\u8981"
  | "\u4e0d\u7d27\u6025\u91cd\u8981"
  | "\u4e0d\u7d27\u6025\u4e0d\u91cd\u8981";

export type TaskType = "daily" | "long";

export type LongTask = {
  id: string;
  name: string;
  dueDate: string;
  createdAt?: string;
  completedAt?: string | null;
  abandonedAt?: string | null;
  done: boolean;
  notes: string;
  precautions: string[];
  completionLog: string;
  priority: Priority;
  subtasks: SubTask[];
  taskType: TaskType;
  isTodayFocus: boolean;
};

export type AnnualTask = {
  id: string;
  name: string;
  done: boolean;
};

export type DailyCheckinSlot = {
  id: string;
  label: string;
  time: string;
};

export type DailyCheckinCompletion = {
  date: string;
  slotId: string;
  completedAt: string;
};

export type ProjectCheckin = {
  id: string;
  name: string;
  description: string;
  startDate: string;
  checkins: { date: string; note: string }[];
  dailyCheckins: DailyCheckinSlot[];
  dailyCompletions: DailyCheckinCompletion[];
};

export type FootprintItem = {
  id: string;
  name: string;
  lastDate: string;
};

export type DashboardUiPreferences = {
  annualSectionOpen: boolean;
  longTaskSectionOpen: boolean;
  completedSectionOpen: boolean;
  projectSectionOpen: boolean;
  routineCheckinSectionOpen: boolean;
  achievementSectionOpen: boolean;
  footprintSectionOpen: boolean;
  expandedTasks: string[];
  expandedCompletedTasks: string[];
  expandedProjects: string[];
  expandedFootprints: string[];
};

export type QuickNote = {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  source: "manual";
};
