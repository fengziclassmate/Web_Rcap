"use client";

export type WorkflowPriority = "critical" | "high" | "medium" | "low";

export type ResearchProjectStatus =
  | "idea"
  | "design"
  | "running"
  | "blocked"
  | "writing"
  | "completed"
  | "paused";

export type ResearchPaperStatus =
  | "planning"
  | "drafting"
  | "revising"
  | "submitted"
  | "accepted"
  | "published"
  | "archived";

export type SubmissionType = "journal" | "conference" | "workshop" | "preprint" | "other";

export type SubmissionStatus =
  | "preparing"
  | "submitted"
  | "under_review"
  | "major_revision"
  | "minor_revision"
  | "accepted"
  | "rejected"
  | "withdrawn";

export type PaperSectionStatus = "planned" | "drafting" | "revising" | "done";

export type FeedbackSource = "advisor" | "collaborator" | "reviewer" | "self";

export type FeedbackStatus = "open" | "in_progress" | "resolved";

export type MeetingType = "group" | "advisor" | "project" | "review" | "other";

export type ActionItemStatus = "todo" | "doing" | "done" | "blocked";

export type TimelineEntityType =
  | "project"
  | "project_log"
  | "paper"
  | "paper_section"
  | "paper_feedback"
  | "submission"
  | "submission_status"
  | "review_comment"
  | "meeting"
  | "meeting_action";

export type WorkflowLinkState = {
  linkedTaskIds: string[];
  linkedEventIds: string[];
  linkedActivityLogIds: string[];
};

export type ResearchProject = WorkflowLinkState & {
  id: string;
  title: string;
  summary: string;
  status: ResearchProjectStatus;
  priority: WorkflowPriority;
  progress: number;
  startDate: string;
  targetEndDate: string;
  researchQuestion: string;
  hypothesis: string;
  method: string;
  dataSources: string;
  currentIssues: string;
  nextActions: string;
  plannedTaskIds: string[];
  metadata: Record<string, string>;
};

export type ProjectLog = WorkflowLinkState & {
  id: string;
  projectId: string;
  date: string;
  progressText: string;
  issues: string;
  nextActions: string;
  syncToActivityLog: boolean;
};

export type ResearchPaper = WorkflowLinkState & {
  id: string;
  title: string;
  abstract: string;
  keywords: string[];
  status: ResearchPaperStatus;
  targetVenue: string;
  chapterCount: number;
  completedChapters: number;
  overallProgress: number;
  currentIssues: string;
  nextActions: string;
  writingPlan: string;
  metadata: Record<string, string>;
};

export type PaperProjectLink = {
  id: string;
  paperId: string;
  projectId: string;
};

export type PaperSection = WorkflowLinkState & {
  id: string;
  paperId: string;
  title: string;
  sortOrder: number;
  status: PaperSectionStatus;
  targetWords: number;
  currentWords: number;
  notes: string;
  issues: string;
  nextActions: string;
};

export type PaperFeedback = WorkflowLinkState & {
  id: string;
  paperId: string;
  source: FeedbackSource;
  date: string;
  content: string;
  suggestedAction: string;
  status: FeedbackStatus;
  relatedSectionId: string | null;
};

export type SubmissionRecord = WorkflowLinkState & {
  id: string;
  paperId: string;
  venueName: string;
  venueType: SubmissionType;
  submittedAt: string;
  manuscriptId: string;
  status: SubmissionStatus;
  decisionDate: string;
  revisionDueDate: string;
  resultNote: string;
  responseLetterStatus: FeedbackStatus;
  revisionPlan: string;
  materialsChecklist: SubmissionChecklistItem[];
};

export type SubmissionChecklistItem = {
  id: string;
  label: string;
  done: boolean;
};

export type SubmissionStatusHistoryEntry = {
  id: string;
  submissionId: string;
  status: SubmissionStatus;
  changedAt: string;
  note: string;
};

export type ReviewComment = WorkflowLinkState & {
  id: string;
  submissionId: string;
  reviewer: string;
  comment: string;
  response: string;
  status: FeedbackStatus;
  paperSectionId: string | null;
};

export type GroupMeetingRecord = WorkflowLinkState & {
  id: string;
  date: string;
  title: string;
  meetingType: MeetingType;
  attendees: string;
  summary: string;
  discussionNotes: string;
  mentorFeedback: string;
  decisions: string;
  nextMeetingDate: string;
  projectIds: string[];
  paperIds: string[];
  submissionIds: string[];
  followUp: string;
};

export type MeetingActionItem = WorkflowLinkState & {
  id: string;
  meetingId: string;
  content: string;
  owner: string;
  dueDate: string;
  priority: WorkflowPriority;
  status: ActionItemStatus;
  projectId: string | null;
  paperId: string | null;
  submissionId: string | null;
};

export type TimelineEntry = WorkflowLinkState & {
  id: string;
  entityType: TimelineEntityType;
  entityId: string;
  date: string;
  title: string;
  description: string;
};

export type ResearchWorkflowState = {
  projects: ResearchProject[];
  projectLogs: ProjectLog[];
  papers: ResearchPaper[];
  paperProjectLinks: PaperProjectLink[];
  paperSections: PaperSection[];
  paperFeedback: PaperFeedback[];
  submissions: SubmissionRecord[];
  submissionStatusHistory: SubmissionStatusHistoryEntry[];
  reviewComments: ReviewComment[];
  meetings: GroupMeetingRecord[];
  meetingActionItems: MeetingActionItem[];
  timelineEntries: TimelineEntry[];
};

export const researchProjectStatusOptions: Array<{ value: ResearchProjectStatus; label: string }> = [
  { value: "idea", label: "想法" },
  { value: "design", label: "设计中" },
  { value: "running", label: "进行中" },
  { value: "blocked", label: "阻塞" },
  { value: "writing", label: "写作中" },
  { value: "completed", label: "已完成" },
  { value: "paused", label: "暂停" },
];

export const researchPaperStatusOptions: Array<{ value: ResearchPaperStatus; label: string }> = [
  { value: "planning", label: "规划中" },
  { value: "drafting", label: "写作中" },
  { value: "revising", label: "修改中" },
  { value: "submitted", label: "已投稿" },
  { value: "accepted", label: "已接收" },
  { value: "published", label: "已发表" },
  { value: "archived", label: "归档" },
];

export const submissionStatusOptions: Array<{ value: SubmissionStatus; label: string }> = [
  { value: "preparing", label: "准备中" },
  { value: "submitted", label: "已投稿" },
  { value: "under_review", label: "审稿中" },
  { value: "major_revision", label: "大修" },
  { value: "minor_revision", label: "小修" },
  { value: "accepted", label: "接收" },
  { value: "rejected", label: "拒稿" },
  { value: "withdrawn", label: "撤稿" },
];

export const priorityOptions: Array<{ value: WorkflowPriority; label: string }> = [
  { value: "critical", label: "关键" },
  { value: "high", label: "高" },
  { value: "medium", label: "中" },
  { value: "low", label: "低" },
];

export const feedbackStatusOptions: Array<{ value: FeedbackStatus; label: string }> = [
  { value: "open", label: "待处理" },
  { value: "in_progress", label: "处理中" },
  { value: "resolved", label: "已解决" },
];

export const meetingTypeOptions: Array<{ value: MeetingType; label: string }> = [
  { value: "group", label: "组会" },
  { value: "advisor", label: "导师沟通" },
  { value: "project", label: "项目讨论" },
  { value: "review", label: "论文反馈会" },
  { value: "other", label: "其他" },
];

export const submissionTypeOptions: Array<{ value: SubmissionType; label: string }> = [
  { value: "journal", label: "期刊" },
  { value: "conference", label: "会议" },
  { value: "workshop", label: "Workshop" },
  { value: "preprint", label: "预印本" },
  { value: "other", label: "其他" },
];

export const actionItemStatusOptions: Array<{ value: ActionItemStatus; label: string }> = [
  { value: "todo", label: "待办" },
  { value: "doing", label: "进行中" },
  { value: "done", label: "已完成" },
  { value: "blocked", label: "阻塞" },
];

export const paperSectionStatusOptions: Array<{ value: PaperSectionStatus; label: string }> = [
  { value: "planned", label: "规划" },
  { value: "drafting", label: "写作" },
  { value: "revising", label: "修改" },
  { value: "done", label: "完成" },
];

export const feedbackSourceOptions: Array<{ value: FeedbackSource; label: string }> = [
  { value: "advisor", label: "导师" },
  { value: "collaborator", label: "合作者" },
  { value: "reviewer", label: "审稿人" },
  { value: "self", label: "自己" },
];

export const defaultResearchWorkflowState: ResearchWorkflowState = {
  projects: [],
  projectLogs: [],
  papers: [],
  paperProjectLinks: [],
  paperSections: [],
  paperFeedback: [],
  submissions: [],
  submissionStatusHistory: [],
  reviewComments: [],
  meetings: [],
  meetingActionItems: [],
  timelineEntries: [],
};

export function clampProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function emptyLinkState(): WorkflowLinkState {
  return {
    linkedTaskIds: [],
    linkedEventIds: [],
    linkedActivityLogIds: [],
  };
}

export function ensureStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function normalizeChecklistItems(payload: unknown): SubmissionChecklistItem[] {
  if (!Array.isArray(payload)) return [];
  return payload.map((item, index) => {
    const value = item as Partial<SubmissionChecklistItem>;
    return {
      id: typeof value.id === "string" ? value.id : `check-${index}`,
      label: typeof value.label === "string" ? value.label : "",
      done: Boolean(value.done),
    };
  });
}
