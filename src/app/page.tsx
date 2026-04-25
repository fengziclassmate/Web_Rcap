"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { MonitoringSidebar, type MonitoringModuleId } from "@/components/monitoring/sidebar";
import { AchievementsPanel, type Achievement } from "@/components/monitoring/achievements-panel";
import { FootprintsPanel } from "@/components/monitoring/footprints-panel";
import { ProjectCheckinsPanel } from "@/components/monitoring/project-checkins-panel";
import {
  type ResearchProject,
  type PlanItem,
} from "@/components/monitoring/research-projects-panel";
import {
  type PaperProgress,
  type PaperPlanItem,
} from "@/components/monitoring/paper-progress-panel";
import { type SubmissionRecord } from "@/components/monitoring/submissions-panel";
import {
  type GroupMeetingRecord,
} from "@/components/monitoring/group-meetings-panel";
import { LogPage } from "@/components/logs/log-page";
import { LiteraturePage } from "@/components/monitoring/literature-page";
import { ResearchWorkflowPanel } from "@/components/monitoring/research-workflow-panel";
import {
  defaultResearchWorkflowState,
  type GroupMeetingRecord as WorkflowGroupMeetingRecord,
  type MeetingActionItem,
  type PaperFeedback,
  type PaperProjectLink,
  type PaperSection,
  type ProjectLog,
  type ResearchPaper,
  type ResearchProject as WorkflowResearchProject,
  type ResearchWorkflowState,
  type ReviewComment,
  type SubmissionRecord as WorkflowSubmissionRecord,
  type SubmissionStatusHistoryEntry,
  type TimelineEntry,
} from "@/lib/research-workflow";
import {
  type LogComposerInput,
  type LogPost,
  type LogPostEditorInput,
  type LogPostImage,
  type LogPostLink,
  type LogPostRecord,
  type LogTag,
} from "@/lib/logs";
import {
  type LiteratureExcerpt,
  type LiteratureExcerptInput,
  type LiteratureFormInput,
  type LiteratureItem,
  type LiteratureMethodNote,
  type LiteratureNote,
  type LiteratureNoteInput,
  type LiteraturePaperUsage,
  type LiteratureProjectLink,
  type LiteratureReadingLog,
  type LiteratureRecord,
  type LiteratureTag,
  type LiteratureTagLink,
} from "@/lib/literature";

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

export type DashboardUiPreferences = {
  longTaskSectionOpen: boolean;
  completedSectionOpen: boolean;
  projectSectionOpen: boolean;
  footprintSectionOpen: boolean;
  expandedTasks: string[];
  expandedCompletedTasks: string[];
  expandedProjects: string[];
  expandedFootprints: string[];
};

const DASHBOARD_UI_PREFS_STORAGE_KEY = "schedule-dashboard-collapse-state";
const SCHEDULE_DATA_BACKUP_STORAGE_PREFIX = "schedule-data-backup";

const defaultDashboardUiPreferences: DashboardUiPreferences = {
  longTaskSectionOpen: true,
  completedSectionOpen: true,
  projectSectionOpen: true,
  footprintSectionOpen: true,
  expandedTasks: [],
  expandedCompletedTasks: [],
  expandedProjects: [],
  expandedFootprints: [],
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
    category: "任务推进",
    tag: null,
  },
];

function getCurrentWeekStart() {
  return startOfWeek(new Date(), { weekStartsOn: 1 });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
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

function normalizeAchievements(payload: unknown): Achievement[] {
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
        date:
          typeof value.date === "string" && value.date.length > 0
            ? value.date
            : new Date().toISOString().slice(0, 10),
        title,
        ...(note ? { note } : {}),
      } satisfies Achievement;
    })
    .filter((x): x is Achievement => x !== null);
}

function normalizePlanItems(payload: unknown): PlanItem[] {
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

function normalizePaperPlanItems(payload: unknown): PaperPlanItem[] {
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

function normalizeResearchProjects(payload: unknown): ResearchProject[] {
  if (!Array.isArray(payload)) return [];
  return payload.map((item, index) => {
    const value = item as Partial<ResearchProject>;
    return {
      id: value.id ?? `research-restored-${index}`,
      name: typeof value.name === "string" ? value.name : "未命名项目",
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

const defaultPaperProgress: PaperProgress = {
  title: "",
  totalChapters: 0,
  doneChapters: 0,
  nextStepPlan: "",
  milestones: "",
  dailyPlans: [],
  weeklyPlans: [],
  monthlyPlans: [],
};

function normalizePaperProgress(payload: unknown): PaperProgress {
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

function normalizeSubmissions(payload: unknown): SubmissionRecord[] {
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
            : new Date().toISOString().slice(0, 10),
        status: (value.status as SubmissionRecord["status"]) ?? "准备中",
        resultNote: typeof value.resultNote === "string" ? value.resultNote : "",
      } satisfies SubmissionRecord;
    })
    .filter((x): x is SubmissionRecord => Boolean(x));
}

function normalizeGroupMeetings(payload: unknown): GroupMeetingRecord[] {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((item, index) => {
      const value = item as Partial<GroupMeetingRecord>;
      const topic = typeof value.topic === "string" ? value.topic.trim() : "";
      const date =
        typeof value.date === "string" && value.date.length > 0
          ? value.date
          : new Date().toISOString().slice(0, 10);
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

function buildResearchWorkflowFromLegacy(
  legacyProjects: ResearchProject[],
  legacyPaper: PaperProgress,
  legacySubmissions: SubmissionRecord[],
  legacyMeetings: GroupMeetingRecord[],
): ResearchWorkflowState {
  const projectRows: WorkflowResearchProject[] = legacyProjects.map((project) => ({
    id: project.id,
    title: project.name,
    summary: project.content,
    status: "running",
    priority: "medium",
    progress: 0,
    startDate: "",
    targetEndDate: "",
    researchQuestion: "",
    hypothesis: "",
    method: project.techDetails,
    dataSources: "",
    currentIssues: "",
    nextActions: project.nextStepPlan,
    plannedTaskIds: [],
    metadata: {},
    linkedTaskIds: [],
    linkedEventIds: [],
    linkedActivityLogIds: [],
  }));

  const paperRows: ResearchPaper[] =
    legacyPaper.title || legacyPaper.totalChapters > 0 || legacyPaper.dailyPlans.length > 0
      ? [
          {
            id: "legacy-paper",
            title: legacyPaper.title || "历史论文",
            abstract: "",
            keywords: [],
            status: "drafting",
            targetVenue: "",
            chapterCount: legacyPaper.totalChapters,
            completedChapters: legacyPaper.doneChapters,
            overallProgress:
              legacyPaper.totalChapters > 0
                ? Math.round((legacyPaper.doneChapters / legacyPaper.totalChapters) * 100)
                : 0,
            currentIssues: "",
            nextActions: legacyPaper.nextStepPlan,
            writingPlan: legacyPaper.milestones,
            metadata: {},
            linkedTaskIds: [],
            linkedEventIds: [],
            linkedActivityLogIds: [],
          },
        ]
      : [];

  const submissionRows: WorkflowSubmissionRecord[] = legacySubmissions.map((item) => ({
    id: item.id,
    paperId: paperRows[0]?.id ?? "",
    venueName: item.journal,
    venueType: "journal",
    submittedAt: item.submittedAt,
    manuscriptId: "",
    status: "submitted",
    decisionDate: "",
    revisionDueDate: "",
    resultNote: item.resultNote,
    responseLetterStatus: "open",
    revisionPlan: "",
    materialsChecklist: [],
    linkedTaskIds: [],
    linkedEventIds: [],
    linkedActivityLogIds: [],
  }));

  const meetingRows: WorkflowGroupMeetingRecord[] = legacyMeetings.map((item) => ({
    id: item.id,
    date: item.date,
    title: item.topic,
    meetingType: "group",
    attendees: item.attendees,
    summary: item.notes,
    discussionNotes: item.notes,
    mentorFeedback: "",
    decisions: item.actionItems,
    nextMeetingDate: "",
    projectIds: [],
    paperIds: [],
    submissionIds: [],
    followUp: "",
    linkedTaskIds: [],
    linkedEventIds: [],
    linkedActivityLogIds: [],
  }));

  const timelineEntries: TimelineEntry[] = [
    ...projectRows.map((item) => ({
      id: `timeline-${item.id}`,
      entityType: "project" as const,
      entityId: item.id,
      date: item.startDate || todayISO(),
      title: item.title,
      description: "从历史科研项目迁移",
      linkedTaskIds: [],
      linkedEventIds: [],
      linkedActivityLogIds: [],
    })),
    ...paperRows.map((item) => ({
      id: `timeline-${item.id}`,
      entityType: "paper" as const,
      entityId: item.id,
      date: todayISO(),
      title: item.title,
      description: "从历史论文进度迁移",
      linkedTaskIds: [],
      linkedEventIds: [],
      linkedActivityLogIds: [],
    })),
  ];

  return {
    ...defaultResearchWorkflowState,
    projects: projectRows,
    papers: paperRows,
    submissions: submissionRows,
    meetings: meetingRows,
    timelineEntries,
  };
}

function fromProjectRow(row: Record<string, unknown>): WorkflowResearchProject {
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    summary: String(row.summary ?? ""),
    status: (row.status as WorkflowResearchProject["status"]) ?? "idea",
    priority: (row.priority as WorkflowResearchProject["priority"]) ?? "medium",
    progress: Number(row.progress ?? 0),
    startDate: typeof row.start_date === "string" ? row.start_date : "",
    targetEndDate: typeof row.target_end_date === "string" ? row.target_end_date : "",
    researchQuestion: String(row.research_question ?? ""),
    hypothesis: String(row.hypothesis ?? ""),
    method: String(row.method ?? ""),
    dataSources: String(row.data_sources ?? ""),
    currentIssues: String(row.current_issues ?? ""),
    nextActions: String(row.next_actions ?? ""),
    plannedTaskIds: Array.isArray(row.planned_task_ids) ? (row.planned_task_ids as string[]) : [],
    linkedTaskIds: Array.isArray(row.linked_task_ids) ? (row.linked_task_ids as string[]) : [],
    linkedEventIds: Array.isArray(row.linked_event_ids) ? (row.linked_event_ids as string[]) : [],
    linkedActivityLogIds: Array.isArray(row.linked_activity_log_ids)
      ? (row.linked_activity_log_ids as string[])
      : [],
    metadata: (row.metadata as Record<string, string>) ?? {},
  };
}

function toProjectRow(item: WorkflowResearchProject) {
  return {
    id: item.id,
    title: item.title,
    summary: item.summary,
    status: item.status,
    priority: item.priority,
    progress: item.progress,
    start_date: item.startDate || null,
    target_end_date: item.targetEndDate || null,
    research_question: item.researchQuestion,
    hypothesis: item.hypothesis,
    method: item.method,
    data_sources: item.dataSources,
    current_issues: item.currentIssues,
    next_actions: item.nextActions,
    planned_task_ids: item.plannedTaskIds,
    linked_task_ids: item.linkedTaskIds,
    linked_event_ids: item.linkedEventIds,
    linked_activity_log_ids: item.linkedActivityLogIds,
    metadata: item.metadata,
  };
}

function fromProjectLogRow(row: Record<string, unknown>): ProjectLog {
  return {
    id: String(row.id ?? ""),
    projectId: String(row.project_id ?? ""),
    date: typeof row.entry_date === "string" ? row.entry_date : "",
    progressText: String(row.progress_text ?? ""),
    issues: String(row.issues ?? ""),
    nextActions: String(row.next_actions ?? ""),
    syncToActivityLog: Boolean(row.sync_to_activity_log),
    linkedTaskIds: Array.isArray(row.linked_task_ids) ? (row.linked_task_ids as string[]) : [],
    linkedEventIds: Array.isArray(row.linked_event_ids) ? (row.linked_event_ids as string[]) : [],
    linkedActivityLogIds: Array.isArray(row.linked_activity_log_ids)
      ? (row.linked_activity_log_ids as string[])
      : [],
  };
}

function toProjectLogRow(item: ProjectLog) {
  return {
    id: item.id,
    project_id: item.projectId,
    entry_date: item.date,
    progress_text: item.progressText,
    issues: item.issues,
    next_actions: item.nextActions,
    sync_to_activity_log: item.syncToActivityLog,
    linked_task_ids: item.linkedTaskIds,
    linked_event_ids: item.linkedEventIds,
    linked_activity_log_ids: item.linkedActivityLogIds,
  };
}

function fromPaperRow(row: Record<string, unknown>): ResearchPaper {
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    abstract: String(row.abstract ?? ""),
    keywords: Array.isArray(row.keywords) ? (row.keywords as string[]) : [],
    status: (row.status as ResearchPaper["status"]) ?? "planning",
    targetVenue: String(row.target_venue ?? ""),
    chapterCount: Number(row.chapter_count ?? 0),
    completedChapters: Number(row.completed_chapters ?? 0),
    overallProgress: Number(row.overall_progress ?? 0),
    currentIssues: String(row.current_issues ?? ""),
    nextActions: String(row.next_actions ?? ""),
    writingPlan: String(row.writing_plan ?? ""),
    linkedTaskIds: Array.isArray(row.linked_task_ids) ? (row.linked_task_ids as string[]) : [],
    linkedEventIds: Array.isArray(row.linked_event_ids) ? (row.linked_event_ids as string[]) : [],
    linkedActivityLogIds: Array.isArray(row.linked_activity_log_ids)
      ? (row.linked_activity_log_ids as string[])
      : [],
    metadata: (row.metadata as Record<string, string>) ?? {},
  };
}

function toPaperRow(item: ResearchPaper) {
  return {
    id: item.id,
    title: item.title,
    abstract: item.abstract,
    keywords: item.keywords,
    status: item.status,
    target_venue: item.targetVenue,
    chapter_count: item.chapterCount,
    completed_chapters: item.completedChapters,
    overall_progress: item.overallProgress,
    current_issues: item.currentIssues,
    next_actions: item.nextActions,
    writing_plan: item.writingPlan,
    linked_task_ids: item.linkedTaskIds,
    linked_event_ids: item.linkedEventIds,
    linked_activity_log_ids: item.linkedActivityLogIds,
    metadata: item.metadata,
  };
}

function fromPaperProjectLinkRow(row: Record<string, unknown>): PaperProjectLink {
  return {
    id: String(row.id ?? ""),
    paperId: String(row.paper_id ?? ""),
    projectId: String(row.project_id ?? ""),
  };
}

function toPaperProjectLinkRow(item: PaperProjectLink) {
  return { id: item.id, paper_id: item.paperId, project_id: item.projectId };
}

function fromPaperSectionRow(row: Record<string, unknown>): PaperSection {
  return {
    id: String(row.id ?? ""),
    paperId: String(row.paper_id ?? ""),
    title: String(row.title ?? ""),
    sortOrder: Number(row.sort_order ?? 0),
    status: (row.status as PaperSection["status"]) ?? "planned",
    targetWords: Number(row.target_words ?? 0),
    currentWords: Number(row.current_words ?? 0),
    notes: String(row.notes ?? ""),
    issues: String(row.issues ?? ""),
    nextActions: String(row.next_actions ?? ""),
    linkedTaskIds: Array.isArray(row.linked_task_ids) ? (row.linked_task_ids as string[]) : [],
    linkedEventIds: Array.isArray(row.linked_event_ids) ? (row.linked_event_ids as string[]) : [],
    linkedActivityLogIds: Array.isArray(row.linked_activity_log_ids)
      ? (row.linked_activity_log_ids as string[])
      : [],
  };
}

function toPaperSectionRow(item: PaperSection) {
  return {
    id: item.id,
    paper_id: item.paperId,
    title: item.title,
    sort_order: item.sortOrder,
    status: item.status,
    target_words: item.targetWords,
    current_words: item.currentWords,
    notes: item.notes,
    issues: item.issues,
    next_actions: item.nextActions,
    linked_task_ids: item.linkedTaskIds,
    linked_event_ids: item.linkedEventIds,
    linked_activity_log_ids: item.linkedActivityLogIds,
  };
}

function fromPaperFeedbackRow(row: Record<string, unknown>): PaperFeedback {
  return {
    id: String(row.id ?? ""),
    paperId: String(row.paper_id ?? ""),
    source: (row.source as PaperFeedback["source"]) ?? "advisor",
    date: typeof row.feedback_date === "string" ? row.feedback_date : "",
    content: String(row.content ?? ""),
    suggestedAction: String(row.suggested_action ?? ""),
    status: (row.status as PaperFeedback["status"]) ?? "open",
    relatedSectionId: typeof row.related_section_id === "string" ? row.related_section_id : null,
    linkedTaskIds: Array.isArray(row.linked_task_ids) ? (row.linked_task_ids as string[]) : [],
    linkedEventIds: Array.isArray(row.linked_event_ids) ? (row.linked_event_ids as string[]) : [],
    linkedActivityLogIds: Array.isArray(row.linked_activity_log_ids)
      ? (row.linked_activity_log_ids as string[])
      : [],
  };
}

function toPaperFeedbackRow(item: PaperFeedback) {
  return {
    id: item.id,
    paper_id: item.paperId,
    source: item.source,
    feedback_date: item.date,
    content: item.content,
    suggested_action: item.suggestedAction,
    status: item.status,
    related_section_id: item.relatedSectionId,
    linked_task_ids: item.linkedTaskIds,
    linked_event_ids: item.linkedEventIds,
    linked_activity_log_ids: item.linkedActivityLogIds,
  };
}

function fromSubmissionRow(row: Record<string, unknown>): WorkflowSubmissionRecord {
  return {
    id: String(row.id ?? ""),
    paperId: String(row.paper_id ?? ""),
    venueName: String(row.venue_name ?? ""),
    venueType: (row.venue_type as WorkflowSubmissionRecord["venueType"]) ?? "journal",
    submittedAt: typeof row.submitted_at === "string" ? row.submitted_at : "",
    manuscriptId: String(row.manuscript_id ?? ""),
    status: (row.status as WorkflowSubmissionRecord["status"]) ?? "preparing",
    decisionDate: typeof row.decision_date === "string" ? row.decision_date : "",
    revisionDueDate: typeof row.revision_due_date === "string" ? row.revision_due_date : "",
    resultNote: String(row.result_note ?? ""),
    responseLetterStatus:
      (row.response_letter_status as WorkflowSubmissionRecord["responseLetterStatus"]) ?? "open",
    revisionPlan: String(row.revision_plan ?? ""),
    materialsChecklist: Array.isArray(row.materials_checklist)
      ? (row.materials_checklist as WorkflowSubmissionRecord["materialsChecklist"])
      : [],
    linkedTaskIds: Array.isArray(row.linked_task_ids) ? (row.linked_task_ids as string[]) : [],
    linkedEventIds: Array.isArray(row.linked_event_ids) ? (row.linked_event_ids as string[]) : [],
    linkedActivityLogIds: Array.isArray(row.linked_activity_log_ids)
      ? (row.linked_activity_log_ids as string[])
      : [],
  };
}

function toSubmissionRow(item: WorkflowSubmissionRecord) {
  return {
    id: item.id,
    paper_id: item.paperId,
    venue_name: item.venueName,
    venue_type: item.venueType,
    submitted_at: item.submittedAt || null,
    manuscript_id: item.manuscriptId,
    status: item.status,
    decision_date: item.decisionDate || null,
    revision_due_date: item.revisionDueDate || null,
    result_note: item.resultNote,
    response_letter_status: item.responseLetterStatus,
    revision_plan: item.revisionPlan,
    materials_checklist: item.materialsChecklist,
    linked_task_ids: item.linkedTaskIds,
    linked_event_ids: item.linkedEventIds,
    linked_activity_log_ids: item.linkedActivityLogIds,
  };
}

function fromSubmissionHistoryRow(row: Record<string, unknown>): SubmissionStatusHistoryEntry {
  return {
    id: String(row.id ?? ""),
    submissionId: String(row.submission_id ?? ""),
    status: (row.status as SubmissionStatusHistoryEntry["status"]) ?? "submitted",
    changedAt: typeof row.changed_at === "string" ? row.changed_at : "",
    note: String(row.note ?? ""),
  };
}

function toSubmissionHistoryRow(item: SubmissionStatusHistoryEntry) {
  return {
    id: item.id,
    submission_id: item.submissionId,
    status: item.status,
    changed_at: item.changedAt,
    note: item.note,
  };
}

function fromReviewCommentRow(row: Record<string, unknown>): ReviewComment {
  return {
    id: String(row.id ?? ""),
    submissionId: String(row.submission_id ?? ""),
    reviewer: String(row.reviewer ?? ""),
    comment: String(row.comment ?? ""),
    response: String(row.response ?? ""),
    status: (row.status as ReviewComment["status"]) ?? "open",
    paperSectionId: typeof row.paper_section_id === "string" ? row.paper_section_id : null,
    linkedTaskIds: Array.isArray(row.linked_task_ids) ? (row.linked_task_ids as string[]) : [],
    linkedEventIds: Array.isArray(row.linked_event_ids) ? (row.linked_event_ids as string[]) : [],
    linkedActivityLogIds: Array.isArray(row.linked_activity_log_ids)
      ? (row.linked_activity_log_ids as string[])
      : [],
  };
}

function toReviewCommentRow(item: ReviewComment) {
  return {
    id: item.id,
    submission_id: item.submissionId,
    reviewer: item.reviewer,
    comment: item.comment,
    response: item.response,
    status: item.status,
    paper_section_id: item.paperSectionId,
    linked_task_ids: item.linkedTaskIds,
    linked_event_ids: item.linkedEventIds,
    linked_activity_log_ids: item.linkedActivityLogIds,
  };
}

function fromMeetingRow(row: Record<string, unknown>): WorkflowGroupMeetingRecord {
  return {
    id: String(row.id ?? ""),
    date: typeof row.meeting_date === "string" ? row.meeting_date : "",
    title: String(row.title ?? ""),
    meetingType: (row.meeting_type as WorkflowGroupMeetingRecord["meetingType"]) ?? "group",
    attendees: String(row.attendees ?? ""),
    summary: String(row.summary ?? ""),
    discussionNotes: String(row.discussion_notes ?? ""),
    mentorFeedback: String(row.mentor_feedback ?? ""),
    decisions: String(row.decisions ?? ""),
    nextMeetingDate: typeof row.next_meeting_date === "string" ? row.next_meeting_date : "",
    projectIds: Array.isArray(row.project_ids) ? (row.project_ids as string[]) : [],
    paperIds: Array.isArray(row.paper_ids) ? (row.paper_ids as string[]) : [],
    submissionIds: Array.isArray(row.submission_ids) ? (row.submission_ids as string[]) : [],
    followUp: String(row.follow_up ?? ""),
    linkedTaskIds: Array.isArray(row.linked_task_ids) ? (row.linked_task_ids as string[]) : [],
    linkedEventIds: Array.isArray(row.linked_event_ids) ? (row.linked_event_ids as string[]) : [],
    linkedActivityLogIds: Array.isArray(row.linked_activity_log_ids)
      ? (row.linked_activity_log_ids as string[])
      : [],
  };
}

function toMeetingRow(item: WorkflowGroupMeetingRecord) {
  return {
    id: item.id,
    meeting_date: item.date,
    title: item.title,
    meeting_type: item.meetingType,
    attendees: item.attendees,
    summary: item.summary,
    discussion_notes: item.discussionNotes,
    mentor_feedback: item.mentorFeedback,
    decisions: item.decisions,
    next_meeting_date: item.nextMeetingDate || null,
    project_ids: item.projectIds,
    paper_ids: item.paperIds,
    submission_ids: item.submissionIds,
    follow_up: item.followUp,
    linked_task_ids: item.linkedTaskIds,
    linked_event_ids: item.linkedEventIds,
    linked_activity_log_ids: item.linkedActivityLogIds,
  };
}

function fromMeetingActionRow(row: Record<string, unknown>): MeetingActionItem {
  return {
    id: String(row.id ?? ""),
    meetingId: String(row.meeting_id ?? ""),
    content: String(row.content ?? ""),
    owner: String(row.owner ?? ""),
    dueDate: typeof row.due_date === "string" ? row.due_date : "",
    priority: (row.priority as MeetingActionItem["priority"]) ?? "medium",
    status: (row.status as MeetingActionItem["status"]) ?? "todo",
    projectId: typeof row.project_id === "string" ? row.project_id : null,
    paperId: typeof row.paper_id === "string" ? row.paper_id : null,
    submissionId: typeof row.submission_id === "string" ? row.submission_id : null,
    linkedTaskIds: Array.isArray(row.linked_task_ids) ? (row.linked_task_ids as string[]) : [],
    linkedEventIds: Array.isArray(row.linked_event_ids) ? (row.linked_event_ids as string[]) : [],
    linkedActivityLogIds: Array.isArray(row.linked_activity_log_ids)
      ? (row.linked_activity_log_ids as string[])
      : [],
  };
}

function toMeetingActionRow(item: MeetingActionItem) {
  return {
    id: item.id,
    meeting_id: item.meetingId,
    content: item.content,
    owner: item.owner,
    due_date: item.dueDate || null,
    priority: item.priority,
    status: item.status,
    project_id: item.projectId,
    paper_id: item.paperId,
    submission_id: item.submissionId,
    linked_task_ids: item.linkedTaskIds,
    linked_event_ids: item.linkedEventIds,
    linked_activity_log_ids: item.linkedActivityLogIds,
  };
}

function fromTimelineRow(row: Record<string, unknown>): TimelineEntry {
  return {
    id: String(row.id ?? ""),
    entityType: (row.entity_type as TimelineEntry["entityType"]) ?? "project",
    entityId: String(row.entity_id ?? ""),
    date: typeof row.entry_date === "string" ? row.entry_date : "",
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    linkedTaskIds: Array.isArray(row.linked_task_ids) ? (row.linked_task_ids as string[]) : [],
    linkedEventIds: Array.isArray(row.linked_event_ids) ? (row.linked_event_ids as string[]) : [],
    linkedActivityLogIds: Array.isArray(row.linked_activity_log_ids)
      ? (row.linked_activity_log_ids as string[])
      : [],
  };
}

function toTimelineRow(item: TimelineEntry) {
  return {
    id: item.id,
    entity_type: item.entityType,
    entity_id: item.entityId,
    entry_date: item.date,
    title: item.title,
    description: item.description,
    linked_task_ids: item.linkedTaskIds,
    linked_event_ids: item.linkedEventIds,
    linked_activity_log_ids: item.linkedActivityLogIds,
  };
}

function fromLogPostRow(row: Record<string, unknown>): LogPost {
  return {
    id: String(row.id ?? ""),
    userId: String(row.user_id ?? ""),
    content: String(row.content ?? ""),
    category: (row.category as LogPost["category"]) ?? "life",
    mood: (row.mood as LogPost["mood"]) ?? null,
    location: String(row.location ?? ""),
    visibility: "private",
    isPinned: Boolean(row.is_pinned),
    isArchived: Boolean(row.is_archived),
    sourceType: String(row.source_type ?? "manual"),
    sourceId: typeof row.source_id === "string" ? row.source_id : null,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function fromLogImageRow(row: Record<string, unknown>): LogPostImage {
  return {
    id: String(row.id ?? ""),
    postId: String(row.post_id ?? ""),
    userId: String(row.user_id ?? ""),
    imageUrl: String(row.image_url ?? ""),
    storagePath: typeof row.storage_path === "string" ? row.storage_path : null,
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: String(row.created_at ?? ""),
  };
}

function fromLogTagRow(row: Record<string, unknown>): LogTag {
  return {
    id: String(row.id ?? ""),
    userId: String(row.user_id ?? ""),
    name: String(row.name ?? ""),
    color: typeof row.color === "string" ? row.color : null,
    usageCount: Number(row.usage_count ?? 0),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function fromLogLinkRow(row: Record<string, unknown>): LogPostLink {
  return {
    id: String(row.id ?? ""),
    postId: String(row.post_id ?? ""),
    userId: String(row.user_id ?? ""),
    targetType: String(row.target_type ?? ""),
    targetId: String(row.target_id ?? ""),
    targetTitle: typeof row.target_title === "string" ? row.target_title : null,
    createdAt: String(row.created_at ?? ""),
  };
}

function composeLogPostRecords(
  posts: LogPost[],
  images: LogPostImage[],
  tags: LogTag[],
  tagLinks: Array<{ postId: string; tagId: string }>,
  links: LogPostLink[],
): LogPostRecord[] {
  return posts.map((post) => ({
    ...post,
    images: images
      .filter((image) => image.postId === post.id)
      .sort((a, b) => a.sortOrder - b.sortOrder),
    tags: tagLinks
      .filter((item) => item.postId === post.id)
      .map((item) => tags.find((tag) => tag.id === item.tagId))
      .filter((item): item is LogTag => Boolean(item)),
    links: links
      .filter((item) => item.postId === post.id)
      .map((item) => ({
        id: item.targetId,
        type: item.targetType,
        title: item.targetTitle ?? item.targetType,
      })),
  }));
}

function fromLiteratureRow(row: Record<string, unknown>): LiteratureRecord {
  return {
    id: String(row.id ?? ""),
    userId: String(row.user_id ?? ""),
    title: String(row.title ?? ""),
    authors: String(row.authors ?? ""),
    year: typeof row.publish_year === "number" ? row.publish_year : null,
    venue: String(row.venue ?? ""),
    doi: String(row.doi ?? ""),
    url: String(row.url ?? ""),
    pdfUrl: String(row.pdf_url ?? ""),
    abstract: String(row.abstract ?? ""),
    keywords: Array.isArray(row.keywords) ? (row.keywords as string[]) : [],
    status: (row.status as LiteratureRecord["status"]) ?? "to_read",
    importance: (row.importance as LiteratureRecord["importance"]) ?? "medium",
    summary: String(row.summary ?? ""),
    contributions: String(row.contributions ?? ""),
    limitations: String(row.limitations ?? ""),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    linkedTaskIds: Array.isArray(row.linked_task_ids) ? (row.linked_task_ids as string[]) : [],
    linkedEventIds: Array.isArray(row.linked_event_ids) ? (row.linked_event_ids as string[]) : [],
    linkedMeetingIds: Array.isArray(row.linked_meeting_ids) ? (row.linked_meeting_ids as string[]) : [],
    linkedLogPostIds: Array.isArray(row.linked_log_post_ids) ? (row.linked_log_post_ids as string[]) : [],
  };
}

function fromLiteratureNoteRow(row: Record<string, unknown>): LiteratureNote {
  return {
    id: String(row.id ?? ""),
    literatureId: String(row.literature_id ?? ""),
    userId: String(row.user_id ?? ""),
    researchQuestion: String(row.research_question ?? ""),
    researchBackground: String(row.research_background ?? ""),
    dataSource: String(row.data_source ?? ""),
    method: String(row.method ?? ""),
    findings: String(row.findings ?? ""),
    innovations: String(row.innovations ?? ""),
    shortcomings: String(row.shortcomings ?? ""),
    inspiration: String(row.inspiration ?? ""),
    quotableContent: String(row.quotable_content ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function fromLiteratureExcerptRow(row: Record<string, unknown>): LiteratureExcerpt {
  return {
    id: String(row.id ?? ""),
    literatureId: String(row.literature_id ?? ""),
    userId: String(row.user_id ?? ""),
    content: String(row.content ?? ""),
    page: String(row.page ?? ""),
    note: String(row.note ?? ""),
    excerptType: (row.excerpt_type as LiteratureExcerpt["excerptType"]) ?? "quote",
    paperSection: (row.paper_section as LiteratureExcerpt["paperSection"]) ?? "literature_review",
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function fromLiteratureMethodNoteRow(row: Record<string, unknown>): LiteratureMethodNote {
  return {
    id: String(row.id ?? ""),
    literatureId: String(row.literature_id ?? ""),
    userId: String(row.user_id ?? ""),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    requiredData: String(row.required_data ?? ""),
    strengths: String(row.strengths ?? ""),
    weaknesses: String(row.weaknesses ?? ""),
    applicability: String(row.applicability ?? ""),
    plannedToUse: Boolean(row.planned_to_use),
    projectId: typeof row.project_id === "string" ? row.project_id : null,
    paperId: typeof row.paper_id === "string" ? row.paper_id : null,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function fromLiteraturePaperUsageRow(row: Record<string, unknown>): LiteraturePaperUsage {
  return {
    id: String(row.id ?? ""),
    literatureId: String(row.literature_id ?? ""),
    userId: String(row.user_id ?? ""),
    paperId: String(row.paper_id ?? ""),
    chapter: String(row.chapter ?? ""),
    usageType: (row.usage_type as LiteraturePaperUsage["usageType"]) ?? "background",
    note: String(row.note ?? ""),
    citationStatus: (row.citation_status as LiteraturePaperUsage["citationStatus"]) ?? "planned",
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function fromLiteratureProjectLinkRow(row: Record<string, unknown>): LiteratureProjectLink {
  return {
    id: String(row.id ?? ""),
    literatureId: String(row.literature_id ?? ""),
    userId: String(row.user_id ?? ""),
    projectId: String(row.project_id ?? ""),
    createdAt: String(row.created_at ?? ""),
  };
}

function fromLiteratureReadingLogRow(row: Record<string, unknown>): LiteratureReadingLog {
  return {
    id: String(row.id ?? ""),
    literatureId: String(row.literature_id ?? ""),
    userId: String(row.user_id ?? ""),
    loggedAt: String(row.logged_at ?? ""),
    durationMinutes: Number(row.duration_minutes ?? 0),
    progressText: String(row.progress_text ?? ""),
    statusAfter: (row.status_after as LiteratureReadingLog["statusAfter"]) ?? "to_read",
    linkedTaskId: typeof row.linked_task_id === "string" ? row.linked_task_id : null,
    linkedEventId: typeof row.linked_event_id === "string" ? row.linked_event_id : null,
    linkedLogPostId: typeof row.linked_log_post_id === "string" ? row.linked_log_post_id : null,
    createdAt: String(row.created_at ?? ""),
  };
}

function fromLiteratureTagRow(row: Record<string, unknown>): LiteratureTag {
  return {
    id: String(row.id ?? ""),
    userId: String(row.user_id ?? ""),
    name: String(row.name ?? ""),
    color: typeof row.color === "string" ? row.color : null,
    usageCount: Number(row.usage_count ?? 0),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function composeLiteratureItems(
  records: LiteratureRecord[],
  notes: LiteratureNote[],
  excerpts: LiteratureExcerpt[],
  methodNotes: LiteratureMethodNote[],
  paperUsages: LiteraturePaperUsage[],
  projectLinks: LiteratureProjectLink[],
  readingLogs: LiteratureReadingLog[],
  tags: LiteratureTag[],
  tagLinks: LiteratureTagLink[],
): LiteratureItem[] {
  return records.map((record) => ({
    ...record,
    note: notes.find((note) => note.literatureId === record.id) ?? null,
    excerpts: excerpts
      .filter((item) => item.literatureId === record.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    methodNotes: methodNotes
      .filter((item) => item.literatureId === record.id)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    paperUsages: paperUsages.filter((item) => item.literatureId === record.id),
    projectLinks: projectLinks.filter((item) => item.literatureId === record.id),
    readingLogs: readingLogs
      .filter((item) => item.literatureId === record.id)
      .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt)),
    tags: tagLinks
      .filter((item) => item.literatureId === record.id)
      .map((item) => tags.find((tag) => tag.id === item.tagId))
      .filter((item): item is LiteratureTag => Boolean(item)),
  }));
}

function normalizeDashboardUiPreferences(payload: unknown): DashboardUiPreferences {
  if (!payload || typeof payload !== "object") return defaultDashboardUiPreferences;
  const value = payload as Partial<DashboardUiPreferences>;
  return {
    longTaskSectionOpen: value.longTaskSectionOpen ?? true,
    completedSectionOpen: value.completedSectionOpen ?? true,
    projectSectionOpen: value.projectSectionOpen ?? true,
    footprintSectionOpen: value.footprintSectionOpen ?? true,
    expandedTasks: Array.isArray(value.expandedTasks) ? value.expandedTasks : [],
    expandedCompletedTasks: Array.isArray(value.expandedCompletedTasks)
      ? value.expandedCompletedTasks
      : [],
    expandedProjects: Array.isArray(value.expandedProjects) ? value.expandedProjects : [],
    expandedFootprints: Array.isArray(value.expandedFootprints) ? value.expandedFootprints : [],
  };
}

function readDashboardUiPreferencesFromLocal(): DashboardUiPreferences {
  if (typeof window === "undefined") return defaultDashboardUiPreferences;
  try {
    const raw = localStorage.getItem(DASHBOARD_UI_PREFS_STORAGE_KEY);
    if (!raw) return defaultDashboardUiPreferences;
    return normalizeDashboardUiPreferences(JSON.parse(raw));
  } catch {
    return defaultDashboardUiPreferences;
  }
}

function isUiPreferencesColumnMissing(message: string) {
  return (
    message.includes("ui_preferences") &&
    (message.includes("schema cache") || message.includes("does not exist"))
  );
}

type PersistedSchedulePayload = {
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

function getScheduleBackupStorageKey(userId: string) {
  return `${SCHEDULE_DATA_BACKUP_STORAGE_PREFIX}:${userId}`;
}

function normalizePersistedSchedulePayload(payload: unknown): PersistedSchedulePayload | null {
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

function readScheduleBackupFromLocal(userId: string): PersistedSchedulePayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(getScheduleBackupStorageKey(userId));
    if (!raw) return null;
    return normalizePersistedSchedulePayload(JSON.parse(raw));
  } catch {
    return null;
  }
}

function isColumnMissing(message: string, column: string) {
  return (
    message.includes(column) &&
    (message.includes("schema cache") || message.includes("does not exist"))
  );
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
      category: value.category ?? "任务推进",
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
  const canSaveRemoteRef = useRef(false);
  const lastLoadedSnapshotRef = useRef<string | null>(null);
  const canSyncResearchWorkflowRef = useRef(false);
  const lastResearchWorkflowSnapshotRef = useRef<string | null>(null);
  const [isBooted, setIsBooted] = useState(false);
  const [activeModule, setActiveModule] = useState<MonitoringModuleId>("schedule");
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getCurrentWeekStart);
  const [events, setEvents] = useState<ScheduleEvent[]>(defaultEvents);
  const [tasks, setTasks] = useState<LongTask[]>(defaultTasks);
  const [annualTasks, setAnnualTasks] = useState<AnnualTask[]>([]);
  const [projectCheckins, setProjectCheckins] = useState<ProjectCheckin[]>([]);
  const [footprints, setFootprints] = useState<FootprintItem[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [researchProjects, setResearchProjects] = useState<ResearchProject[]>([]);
  const [paperProgress, setPaperProgress] = useState<PaperProgress>(defaultPaperProgress);
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [groupMeetings, setGroupMeetings] = useState<GroupMeetingRecord[]>([]);
  const [researchWorkflow, setResearchWorkflow] = useState<ResearchWorkflowState>(
    defaultResearchWorkflowState,
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
  const [user, setUser] = useState<User | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [sendingLink, setSendingLink] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [timeGranularity, setTimeGranularity] = useState<TimeGranularity>(60);
  const [confirmDangerousActions, setConfirmDangerousActions] = useState(true);
  const [mobileTab, setMobileTab] = useState<"schedule" | "tasks">("schedule");
  const weekRange = useMemo(() => {
    const start = format(currentWeekStart, "yyyy/MM/dd", { locale: zhCN });
    const end = format(addDays(currentWeekStart, 6), "yyyy/MM/dd", { locale: zhCN });
    return `${start} - ${end}`;
  }, [currentWeekStart]);
  const persistedPayload = useMemo<PersistedSchedulePayload>(
    () => ({
      events,
      tasks,
      annual_tasks: annualTasks,
      project_checkins: projectCheckins,
      footprints,
      achievements,
      research_projects: researchProjects,
      paper_progress: paperProgress,
      submissions,
      group_meetings: groupMeetings,
      ui_preferences: dashboardUiPreferences,
    }),
    [
      achievements,
      annualTasks,
      dashboardUiPreferences,
      events,
      footprints,
      groupMeetings,
      paperProgress,
      projectCheckins,
      researchProjects,
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

  async function refreshLiteratures(currentUser: User) {
    const results = await Promise.all([
      supabase.from("literatures").select("*").eq("user_id", currentUser.id).order("updated_at", { ascending: false }),
      supabase.from("literature_notes").select("*").eq("user_id", currentUser.id),
      supabase.from("literature_excerpts").select("*").eq("user_id", currentUser.id),
      supabase.from("literature_method_notes").select("*").eq("user_id", currentUser.id),
      supabase.from("literature_paper_usages").select("*").eq("user_id", currentUser.id),
      supabase.from("literature_project_links").select("*").eq("user_id", currentUser.id),
      supabase.from("literature_reading_logs").select("*").eq("user_id", currentUser.id),
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
    const tags = (results[7].data ?? []).map((item) => fromLiteratureTagRow(item));
    const tagLinks = (results[8].data ?? []).map((item) => ({
      literatureId: String(item.literature_id),
      tagId: String(item.tag_id),
      userId: String(item.user_id),
    }));

    setLiteratureTags(tags);
    setLiteratureItems(
      composeLiteratureItems(records, notes, excerpts, methodNotes, paperUsages, projectLinks, readingLogs, tags, tagLinks),
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
      setProjectCheckins([]);
      setFootprints([]);
      setAchievements([]);
      setResearchProjects([]);
      setPaperProgress(defaultPaperProgress);
      setSubmissions([]);
      setGroupMeetings([]);
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
        console.error("创建表失败:", error);
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
          project_checkins: unknown;
          footprints: unknown;
          ui_preferences?: unknown;
          achievements?: unknown;
          research_projects?: unknown;
          paper_progress?: unknown;
          submissions?: unknown;
          group_meetings?: unknown;
        };

        const primary = await supabase
          .from("schedule_data")
          .select(
            "events,tasks,annual_tasks,project_checkins,footprints,ui_preferences,achievements,research_projects,paper_progress,submissions,group_meetings",
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
            isColumnMissing(error.message, "group_meetings"))
        ) {
          const fallback = await supabase
            .from("schedule_data")
            .select("events,tasks,annual_tasks,project_checkins,footprints")
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
            setProjectCheckins(localBackup.project_checkins);
            setFootprints(localBackup.footprints);
            setAchievements(localBackup.achievements);
            setResearchProjects(localBackup.research_projects);
            setPaperProgress(localBackup.paper_progress);
            setSubmissions(localBackup.submissions);
            setGroupMeetings(localBackup.group_meetings);
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
            ui_preferences: (data as { ui_preferences?: unknown }).ui_preferences
              ? normalizeDashboardUiPreferences((data as { ui_preferences?: unknown }).ui_preferences)
              : readDashboardUiPreferencesFromLocal(),
          };
          canSaveRemoteRef.current = true;
          lastLoadedSnapshotRef.current = JSON.stringify(normalized);
          setEvents(normalized.events);
          setTasks(normalized.tasks);
          setAnnualTasks(normalized.annual_tasks);
          setProjectCheckins(normalized.project_checkins);
          setFootprints(normalized.footprints);
          setAchievements(normalized.achievements);
          setResearchProjects(normalized.research_projects);
          setPaperProgress(normalized.paper_progress);
          setSubmissions(normalized.submissions);
          setGroupMeetings(normalized.group_meetings);
          setDashboardUiPreferences(normalized.ui_preferences);
        } else {
          const localBackup = readScheduleBackupFromLocal(user.id);
          if (localBackup) {
            canSaveRemoteRef.current = true;
            lastLoadedSnapshotRef.current = JSON.stringify(localBackup);
            setEvents(localBackup.events);
            setTasks(localBackup.tasks);
            setAnnualTasks(localBackup.annual_tasks);
            setProjectCheckins(localBackup.project_checkins);
            setFootprints(localBackup.footprints);
            setAchievements(localBackup.achievements);
            setResearchProjects(localBackup.research_projects);
            setPaperProgress(localBackup.paper_progress);
            setSubmissions(localBackup.submissions);
            setGroupMeetings(localBackup.group_meetings);
            setDashboardUiPreferences(localBackup.ui_preferences);
            toast.warning("Remote data was empty. Restored from local backup.");
          } else {
            const emptyState: PersistedSchedulePayload = {
              events: defaultEvents,
              tasks: defaultTasks,
              annual_tasks: [],
              project_checkins: [],
              footprints: [],
              achievements: [],
              research_projects: [],
              paper_progress: defaultPaperProgress,
              submissions: [],
              group_meetings: [],
              ui_preferences: readDashboardUiPreferencesFromLocal(),
            };
            canSaveRemoteRef.current = false;
            lastLoadedSnapshotRef.current = JSON.stringify(emptyState);
            setEvents(emptyState.events);
            setTasks(emptyState.tasks);
            setAnnualTasks(emptyState.annual_tasks);
            setProjectCheckins(emptyState.project_checkins);
            setFootprints(emptyState.footprints);
            setAchievements(emptyState.achievements);
            setResearchProjects(emptyState.research_projects);
            setPaperProgress(emptyState.paper_progress);
            setSubmissions(emptyState.submissions);
            setGroupMeetings(emptyState.group_meetings);
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
        if (
          missingUi ||
          missingAchievements ||
          missingResearch ||
          missingPaper ||
          missingSubmissions ||
          missingMeetings
        ) {
          const fallbackPayload = {
            user_id: payload.user_id,
            events: payload.events,
            tasks: payload.tasks,
            annual_tasks: payload.annual_tasks,
            project_checkins: payload.project_checkins,
            footprints: payload.footprints,
            ...(missingAchievements ? {} : { achievements: payload.achievements }),
            ...(missingResearch ? {} : { research_projects: payload.research_projects }),
            ...(missingPaper ? {} : { paper_progress: payload.paper_progress }),
            ...(missingSubmissions ? {} : { submissions: payload.submissions }),
            ...(missingMeetings ? {} : { group_meetings: payload.group_meetings }),
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
        supabase.from("research_papers").select("*").eq("user_id", currentUser.id),
        supabase.from("research_paper_project_links").select("*").eq("user_id", currentUser.id),
        supabase.from("research_paper_sections").select("*").eq("user_id", currentUser.id),
        supabase.from("research_paper_feedback").select("*").eq("user_id", currentUser.id),
        supabase.from("research_submissions").select("*").eq("user_id", currentUser.id),
        supabase.from("research_submission_status_history").select("*").eq("user_id", currentUser.id),
        supabase.from("research_review_comments").select("*").eq("user_id", currentUser.id),
        supabase.from("research_meetings").select("*").eq("user_id", currentUser.id),
        supabase.from("research_meeting_action_items").select("*").eq("user_id", currentUser.id),
        supabase.from("research_timeline_entries").select("*").eq("user_id", currentUser.id),
      ]);

      if (cancelled) return;

      const firstError = queries.find((item) => item.error)?.error;
      if (firstError) {
        if (firstError.message.includes("does not exist")) {
          canSyncResearchWorkflowRef.current = false;
          lastResearchWorkflowSnapshotRef.current = JSON.stringify(legacyFallback);
          setResearchWorkflow(legacyFallback);
          setResearchWorkflowReady(true);
          return;
        }
        toast.error(`Failed to load research workflow: ${firstError.message}`);
        canSyncResearchWorkflowRef.current = false;
        lastResearchWorkflowSnapshotRef.current = JSON.stringify(legacyFallback);
        setResearchWorkflow(legacyFallback);
        setResearchWorkflowReady(true);
        return;
      }

      const nextWorkflow: ResearchWorkflowState = {
        projects: (queries[0].data ?? []).map((item) => fromProjectRow(item)),
        projectLogs: (queries[1].data ?? []).map((item) => fromProjectLogRow(item)),
        papers: (queries[2].data ?? []).map((item) => fromPaperRow(item)),
        paperProjectLinks: (queries[3].data ?? []).map((item) => fromPaperProjectLinkRow(item)),
        paperSections: (queries[4].data ?? []).map((item) => fromPaperSectionRow(item)),
        paperFeedback: (queries[5].data ?? []).map((item) => fromPaperFeedbackRow(item)),
        submissions: (queries[6].data ?? []).map((item) => fromSubmissionRow(item)),
        submissionStatusHistory: (queries[7].data ?? []).map((item) => fromSubmissionHistoryRow(item)),
        reviewComments: (queries[8].data ?? []).map((item) => fromReviewCommentRow(item)),
        meetings: (queries[9].data ?? []).map((item) => fromMeetingRow(item)),
        meetingActionItems: (queries[10].data ?? []).map((item) => fromMeetingActionRow(item)),
        timelineEntries: (queries[11].data ?? []).map((item) => fromTimelineRow(item)),
      };

      const hasWorkflowData = Object.values(nextWorkflow).some(
        (value) => Array.isArray(value) && value.length > 0,
      );
      const resolvedWorkflow = hasWorkflowData ? nextWorkflow : legacyFallback;
      canSyncResearchWorkflowRef.current = true;
      lastResearchWorkflowSnapshotRef.current = JSON.stringify(resolvedWorkflow);
      setResearchWorkflow(resolvedWorkflow);
      setResearchWorkflowReady(true);
    }

    loadResearchWorkflow();
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
          "research_meeting_action_items",
          researchWorkflow.meetingActionItems.map((item) => toMeetingActionRow(item)),
        ],
        ["research_timeline_entries", researchWorkflow.timelineEntries.map((item) => toTimelineRow(item))],
      ];

      for (const [table, rows] of syncJobs) {
        const error = await syncTable(table, rows);
        if (error) {
          toast.error(`Failed to sync ${table}: ${error.message}`);
          return;
        }
      }
      lastResearchWorkflowSnapshotRef.current = researchWorkflowJson;
    }

    saveResearchWorkflow();
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
    await supabase.from("literature_paper_usages").delete().eq("literature_id", literatureId).eq("user_id", currentUser.id);
    const cleaned = Array.from(new Set(paperIds.filter(Boolean)));
    if (cleaned.length === 0) return;
    const now = new Date().toISOString();
    const { error } = await supabase.from("literature_paper_usages").insert(
      cleaned.map((paperId) => ({
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
        supabase.from("literature_notes").delete().eq("literature_id", literatureId).eq("user_id", currentUser.id),
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
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        DASHBOARD_UI_PREFS_STORAGE_KEY,
        JSON.stringify(dashboardUiPreferences),
      );
    } catch {
      // ignore
    }
  }, [dashboardUiPreferences]);

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
    if (mode === "week") {
      setCurrentWeekStart((prev) =>
        startOfWeek(prev ?? getCurrentWeekStart(), { weekStartsOn: 1 }),
      );
    }
    if (mode === "month") {
      setCurrentWeekStart((prev) =>
        startOfWeek(prev ?? getCurrentWeekStart(), { weekStartsOn: 1 }),
      );
    }
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
        done: false,
        notes: input.notes?.trim() ?? "",
        precautions: [],
        completionLog: "",
        priority: "涓嶇揣鎬ヤ笉閲嶈" as Priority,
        subtasks: [],
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
        category: "任务推进",
        tag: null,
      },
    ]);
    return id;
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

  function handleUpdateProjectCheckin(
    projectId: string,
    patch: Partial<Pick<ProjectCheckin, "name" | "description" | "startDate">>,
  ) {
    setProjectCheckins((prev) =>
      prev.map((project) => (project.id === projectId ? { ...project, ...patch } : project)),
    );
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
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setConfirmDangerousActions((prev) => !prev)}
            className="shrink-0 rounded-sm border-gray-200"
          >
            删除确认：{confirmDangerousActions ? "开" : "关"}
          </Button>
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
      </div>

      <div className="mx-auto grid max-w-[1520px] grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[260px_1fr]">
        <div className="hidden min-h-0 lg:block">
          <MonitoringSidebar active={activeModule} onChange={setActiveModule} />
        </div>

        <div className="min-h-0">
          {activeModule === "schedule" ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_460px]">
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
                  onUpdateProjectCheckin={handleUpdateProjectCheckin}
                  onUpdateProjectCheckinEntry={handleUpdateProjectCheckinEntry}
                  onDeleteProjectCheckinEntry={handleDeleteProjectCheckinEntry}
                  footprints={footprints}
                  onAddFootprint={handleAddFootprint}
                  onResetFootprint={handleResetFootprint}
                  onDeleteFootprint={handleDeleteFootprint}
                  onUpdateFootprint={handleUpdateFootprint}
                  showProjectSection={false}
                  showFootprintsSection={false}
                  confirmDangerousActions={confirmDangerousActions}
                  uiPreferences={dashboardUiPreferences}
                  onUiPreferencesChange={setDashboardUiPreferences}
                />
              </section>
            </div>
          ) : activeModule === "achievements" ? (
            <AchievementsPanel
              achievements={achievements}
              onAdd={handleAddAchievement}
              onUpdate={handleUpdateAchievement}
              onDelete={handleDeleteAchievement}
            />
          ) : activeModule === "footprints" ? (
            <FootprintsPanel
              footprints={footprints}
              onAdd={handleAddFootprint}
              onReset={handleResetFootprint}
              onUpdate={handleUpdateFootprint}
              onDelete={handleDeleteFootprint}
              confirmDangerousActions={confirmDangerousActions}
            />
          ) : activeModule === "project-checkins" ? (
            <ProjectCheckinsPanel
              projectCheckins={projectCheckins}
              onAddProjectCheckin={handleAddProjectCheckin}
              onCheckinProject={handleCheckinProject}
              onDeleteProjectCheckin={handleDeleteProjectCheckin}
              onUpdateProjectCheckin={handleUpdateProjectCheckin}
              onUpdateProjectCheckinEntry={handleUpdateProjectCheckinEntry}
              onDeleteProjectCheckinEntry={handleDeleteProjectCheckinEntry}
              confirmDangerousActions={confirmDangerousActions}
            />
          ) : activeModule === "research" ? (
            <ResearchWorkflowPanel
              module="research"
              workflow={researchWorkflow}
              onChange={setResearchWorkflow}
              onCreateTask={handleCreateWorkflowTask}
              onCreateEvent={handleCreateWorkflowEvent}
            />
          ) : activeModule === "paper" ? (
            <ResearchWorkflowPanel
              module="paper"
              workflow={researchWorkflow}
              onChange={setResearchWorkflow}
              onCreateTask={handleCreateWorkflowTask}
              onCreateEvent={handleCreateWorkflowEvent}
            />
          ) : activeModule === "submissions" ? (
            <ResearchWorkflowPanel
              module="submissions"
              workflow={researchWorkflow}
              onChange={setResearchWorkflow}
              onCreateTask={handleCreateWorkflowTask}
              onCreateEvent={handleCreateWorkflowEvent}
            />
          ) : activeModule === "meetings" ? (
            <ResearchWorkflowPanel
              module="meetings"
              workflow={researchWorkflow}
              onChange={setResearchWorkflow}
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
              />
            ) : (
              <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-md">
                <p className="text-sm text-gray-600">正在加载文献阅读模块…</p>
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
                <p className="text-sm text-gray-600">正在加载动态日志…</p>
              </section>
            )
          ) : (
            <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-md">
              <p className="text-sm text-gray-600">模块开发中：{activeModule}</p>
            </section>
          )}
        </div>
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
