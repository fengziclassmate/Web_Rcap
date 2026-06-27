import { format } from "date-fns";
import type { RecurrenceConfig, RecurrenceInstanceOverride } from "@/lib/recurrence";
import type {
  AnnualTask,
  DashboardUiPreferences,
  EventTag,
  FootprintItem,
  LongTask,
  Priority,
  ProjectCheckin,
  ScheduleEvent,
} from "@/lib/types";
import type { Achievement } from "@/components/monitoring/achievements-panel";
import type { PlanItem, ResearchProject } from "@/components/monitoring/research-projects-panel";
import type { PaperPlanItem, PaperProgress } from "@/components/monitoring/paper-progress-panel";
import type { SubmissionRecord } from "@/components/monitoring/submissions-panel";
import type { GroupMeetingRecord } from "@/components/monitoring/group-meetings-panel";
import { DEFAULT_SCHEDULE_CATEGORY, normalizeScheduleCategory } from "@/lib/categories";

export const defaultDashboardUiPreferences: DashboardUiPreferences = {
  longTaskSectionOpen: true,
  completedSectionOpen: true,
  projectSectionOpen: true,
  footprintSectionOpen: true,
  expandedTasks: [],
  expandedCompletedTasks: [],
  expandedProjects: [],
  expandedFootprints: [],
};

export const defaultTasks: LongTask[] = [];

export const defaultEvents: ScheduleEvent[] = [];

export const defaultPaperProgress: PaperProgress = {
  title: "",
  totalChapters: 0,
  doneChapters: 0,
  nextStepPlan: "",
  milestones: "",
  dailyPlans: [],
  weeklyPlans: [],
  monthlyPlans: [],
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function normalizeAnnualTasks(payload: unknown): AnnualTask[] {
  if (!Array.isArray(payload)) return [];
  return payload.map((item, index) => {
    const value = item as Partial<AnnualTask>;
    return {
      id: value.id ?? `annual-restored-${index}`,
      name: typeof value.name === "string" ? value.name : "\u672a\u547d\u540d\u5e74\u5ea6\u4efb\u52a1",
      done: Boolean(value.done),
    };
  });
}

export function normalizeProjectCheckins(payload: unknown): ProjectCheckin[] {
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
      name: typeof value.name === "string" ? value.name : "\u672a\u547d\u540d\u9879\u76ee",
      description: typeof value.description === "string" ? value.description : "",
      startDate: typeof value.startDate === "string" ? value.startDate : todayIso(),
      checkins,
    };
  });
}

export function normalizeFootprints(payload: unknown): FootprintItem[] {
  if (!Array.isArray(payload)) return [];
  return payload.map((item, index) => {
    const value = item as Partial<FootprintItem>;
    return {
      id: value.id ?? `footprint-restored-${index}`,
      name: typeof value.name === "string" ? value.name : "\u672a\u547d\u540d\u8db3\u8ff9",
      lastDate: typeof value.lastDate === "string" ? value.lastDate : todayIso(),
    };
  });
}

export function normalizeAchievements(payload: unknown): Achievement[] {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((item, index) => {
      const value = item as Partial<Achievement>;
      const title = typeof value.title === "string" ? value.title.trim() : "";
      if (!title) return null;
      const note =
        typeof value.note === "string" && value.note.trim().length > 0 ? value.note.trim() : undefined;
      return {
        id: value.id ?? `achievement-restored-${index}`,
        date: typeof value.date === "string" && value.date.length > 0 ? value.date : todayIso(),
        title,
        ...(note ? { note } : {}),
      } satisfies Achievement;
    })
    .filter((x): x is Achievement => x !== null);
}

export function normalizePlanItems(payload: unknown): PlanItem[] {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((item, index) => {
      const value = item as Partial<PlanItem>;
      const content = typeof value.content === "string" ? value.content.trim() : "";
      if (!content) return null;
      return {
        id: value.id ?? `plan-restored-${index}`,
        date: typeof value.date === "string" && value.date.length > 0 ? value.date : "",
        content,
        done: Boolean(value.done),
      } satisfies PlanItem;
    })
    .filter((x): x is PlanItem => Boolean(x));
}

export function normalizePaperPlanItems(payload: unknown): PaperPlanItem[] {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((item, index) => {
      const value = item as Partial<PaperPlanItem>;
      const content = typeof value.content === "string" ? value.content.trim() : "";
      if (!content) return null;
      return {
        id: value.id ?? `paper-plan-restored-${index}`,
        date: typeof value.date === "string" && value.date.length > 0 ? value.date : "",
        content,
        done: Boolean(value.done),
      } satisfies PaperPlanItem;
    })
    .filter((x): x is PaperPlanItem => Boolean(x));
}

export function normalizeResearchProjects(payload: unknown): ResearchProject[] {
  if (!Array.isArray(payload)) return [];
  return payload.map((item, index) => {
    const value = item as Partial<ResearchProject>;
    return {
      id: value.id ?? `research-restored-${index}`,
      name: typeof value.name === "string" ? value.name : "\u672a\u547d\u540d\u9879\u76ee",
      content: typeof value.content === "string" ? value.content : "",
      techDetails: typeof value.techDetails === "string" ? value.techDetails : "",
      nextStepPlan: typeof value.nextStepPlan === "string" ? value.nextStepPlan : "",
      milestones: typeof value.milestones === "string" ? value.milestones : "",
      dailyPlans: normalizePlanItems(value.dailyPlans),
      weeklyPlans: normalizePlanItems(value.weeklyPlans),
      monthlyPlans: normalizePlanItems(value.monthlyPlans),
    };
  });
}

export function normalizePaperProgress(payload: unknown): PaperProgress {
  if (!payload || typeof payload !== "object") return defaultPaperProgress;
  const value = payload as Partial<PaperProgress>;
  return {
    title: typeof value.title === "string" ? value.title : "",
    totalChapters: typeof value.totalChapters === "number" ? value.totalChapters : 0,
    doneChapters: typeof value.doneChapters === "number" ? value.doneChapters : 0,
    nextStepPlan: typeof value.nextStepPlan === "string" ? value.nextStepPlan : "",
    milestones: typeof value.milestones === "string" ? value.milestones : "",
    dailyPlans: normalizePaperPlanItems(value.dailyPlans),
    weeklyPlans: normalizePaperPlanItems(value.weeklyPlans),
    monthlyPlans: normalizePaperPlanItems(value.monthlyPlans),
  };
}

export function normalizeSubmissions(payload: unknown): SubmissionRecord[] {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((item, index) => {
      const value = item as Partial<SubmissionRecord>;
      const content = typeof value.content === "string" ? value.content.trim() : "";
      const journal = typeof value.journal === "string" ? value.journal.trim() : "";
      if (!content || !journal) return null;
      return {
        id: value.id ?? `submission-restored-${index}`,
        content,
        journal,
        submittedAt:
          typeof value.submittedAt === "string" && value.submittedAt.length > 0
            ? value.submittedAt
            : todayIso(),
        status: (value.status as SubmissionRecord["status"]) ?? "\u51c6\u5907\u4e2d",
        resultNote: typeof value.resultNote === "string" ? value.resultNote : "",
      } satisfies SubmissionRecord;
    })
    .filter((x): x is SubmissionRecord => Boolean(x));
}

export function normalizeGroupMeetings(payload: unknown): GroupMeetingRecord[] {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((item, index) => {
      const value = item as Partial<GroupMeetingRecord>;
      const topic = typeof value.topic === "string" ? value.topic.trim() : "";
      const date = typeof value.date === "string" && value.date.length > 0 ? value.date : todayIso();
      if (!topic) return null;
      return {
        id: value.id ?? `meeting-restored-${index}`,
        date,
        topic,
        attendees: typeof value.attendees === "string" ? value.attendees : "",
        notes: typeof value.notes === "string" ? value.notes : "",
        actionItems: typeof value.actionItems === "string" ? value.actionItems : "",
      } satisfies GroupMeetingRecord;
    })
    .filter((x): x is GroupMeetingRecord => Boolean(x));
}

export function normalizeDashboardUiPreferences(payload: unknown): DashboardUiPreferences {
  if (!payload || typeof payload !== "object") return defaultDashboardUiPreferences;
  const value = payload as Partial<DashboardUiPreferences>;
  return {
    longTaskSectionOpen:
      typeof value.longTaskSectionOpen === "boolean" ? value.longTaskSectionOpen : true,
    completedSectionOpen:
      typeof value.completedSectionOpen === "boolean" ? value.completedSectionOpen : true,
    projectSectionOpen:
      typeof value.projectSectionOpen === "boolean" ? value.projectSectionOpen : true,
    footprintSectionOpen:
      typeof value.footprintSectionOpen === "boolean" ? value.footprintSectionOpen : true,
    expandedTasks: Array.isArray(value.expandedTasks)
      ? value.expandedTasks.filter((item): item is string => typeof item === "string")
      : [],
    expandedCompletedTasks: Array.isArray(value.expandedCompletedTasks)
      ? value.expandedCompletedTasks.filter((item): item is string => typeof item === "string")
      : [],
    expandedProjects: Array.isArray(value.expandedProjects)
      ? value.expandedProjects.filter((item): item is string => typeof item === "string")
      : [],
    expandedFootprints: Array.isArray(value.expandedFootprints)
      ? value.expandedFootprints.filter((item): item is string => typeof item === "string")
      : [],
  };
}

export function normalizeTasks(payload: unknown): LongTask[] {
  if (!Array.isArray(payload)) return [];
  return payload.map((task, index) => {
    const value = task as Partial<LongTask>;
    return {
      id: value.id ?? `task-restored-${index}`,
      name: value.name ?? "\u672a\u547d\u540d\u4efb\u52a1",
      dueDate: value.dueDate ?? new Date().toISOString().slice(0, 10),
      done: Boolean(value.done),
      notes: value.notes ?? "",
      precautions: Array.isArray(value.precautions)
        ? value.precautions.filter((item): item is string => typeof item === "string")
        : [],
      completionLog: value.completionLog ?? "",
      priority: (value.priority as Priority) ?? "\u4e0d\u7d27\u6025\u4e0d\u91cd\u8981",
      subtasks: Array.isArray(value.subtasks)
        ? value.subtasks.map((subtask, subIndex) => ({
            id: subtask.id ?? `subtask-${index}-${subIndex}`,
            name: subtask.name ?? `\u5b50\u4efb\u52a1 ${subIndex + 1}`,
            done: Boolean(subtask.done),
          }))
        : [],
    };
  });
}

export function normalizeRecurrence(value: unknown): RecurrenceConfig | undefined {
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

export function normalizeEvents(payload: unknown): ScheduleEvent[] {
  if (!Array.isArray(payload)) return [];
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
      title: value.title ?? "\u672a\u547d\u540d\u884c\u7a0b",
      notes: value.notes ?? "",
      requirements: Array.isArray(value.requirements)
        ? value.requirements.filter((item): item is string => typeof item === "string")
        : [],
      isCompleted: Boolean(value.isCompleted),
      category: normalizeScheduleCategory(value.category ?? DEFAULT_SCHEDULE_CATEGORY),
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
