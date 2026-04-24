"use client";

import { useMemo, useState } from "react";
import {
  FileText,
  Filter,
  FlaskConical,
  LayoutGrid,
  List,
  Plus,
  Search,
  Send,
  Table2,
  Users,
} from "lucide-react";
import { createId } from "@/lib/id";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  actionItemStatusOptions,
  clampProgress,
  emptyLinkState,
  feedbackSourceOptions,
  feedbackStatusOptions,
  meetingTypeOptions,
  paperSectionStatusOptions,
  priorityOptions,
  researchPaperStatusOptions,
  researchProjectStatusOptions,
  submissionStatusOptions,
  submissionTypeOptions,
  type ActionItemStatus,
  type FeedbackSource,
  type FeedbackStatus,
  type GroupMeetingRecord,
  type MeetingActionItem,
  type PaperFeedback,
  type PaperSection,
  type PaperSectionStatus,
  type ProjectLog,
  type ResearchPaper,
  type ResearchPaperStatus,
  type ResearchProject,
  type ResearchProjectStatus,
  type ResearchWorkflowState,
  type ReviewComment,
  type SubmissionChecklistItem,
  type SubmissionRecord,
  type SubmissionStatus,
  type SubmissionStatusHistoryEntry,
  type SubmissionType,
  type TimelineEntityType,
  type TimelineEntry,
  type WorkflowPriority,
} from "@/lib/research-workflow";

type WorkflowModule = "research" | "paper" | "submissions" | "meetings";
type ViewMode = "cards" | "table" | "kanban";

type ResearchWorkflowPanelProps = {
  module: WorkflowModule;
  workflow: ResearchWorkflowState;
  onChange: (next: ResearchWorkflowState) => void;
  onCreateTask: (input: { title: string; dueDate?: string; notes?: string }) => string | null;
  onCreateEvent: (input: { title: string; date: string; notes?: string }) => string | null;
};

type ProjectDraft = Omit<ResearchProject, keyof ReturnType<typeof emptyLinkState> | "plannedTaskIds" | "metadata"> & {
  plannedTaskIdsText: string;
};

type PaperDraft = Omit<
  ResearchPaper,
  keyof ReturnType<typeof emptyLinkState> | "metadata" | "keywords"
> & {
  keywordText: string;
  projectIds: string[];
};

type SubmissionDraft = Omit<SubmissionRecord, keyof ReturnType<typeof emptyLinkState> | "materialsChecklist"> & {
  checklistText: string;
};

type MeetingDraft = Omit<GroupMeetingRecord, keyof ReturnType<typeof emptyLinkState>>;

const moduleLabels: Record<WorkflowModule, string> = {
  research: "科研项目",
  paper: "论文进度",
  submissions: "投稿记录",
  meetings: "组会记录",
};

const moduleIcons: Record<WorkflowModule, React.ReactNode> = {
  research: <FlaskConical className="h-4 w-4" aria-hidden />,
  paper: <FileText className="h-4 w-4" aria-hidden />,
  submissions: <Send className="h-4 w-4" aria-hidden />,
  meetings: <Users className="h-4 w-4" aria-hidden />,
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function ensureChecklistFromText(text: string): SubmissionChecklistItem[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((label, index) => ({
      id: `check-${Date.now()}-${index}`,
      label,
      done: false,
    }));
}

function createTimelineEntry(
  entityType: TimelineEntityType,
  entityId: string,
  date: string,
  title: string,
  description: string,
): TimelineEntry {
  return {
    id: createId("timeline"),
    entityType,
    entityId,
    date,
    title,
    description,
    ...emptyLinkState(),
  };
}

function statusLabel(status: string) {
  const entries = [
    ...researchProjectStatusOptions,
    ...researchPaperStatusOptions,
    ...submissionStatusOptions,
    ...paperSectionStatusOptions,
    ...feedbackStatusOptions,
    ...actionItemStatusOptions,
  ] as Array<{ value: string; label: string }>;
  return entries.find((item) => item.value === status)?.label ?? status;
}

function priorityLabel(value: WorkflowPriority) {
  return priorityOptions.find((item) => item.value === value)?.label ?? value;
}

function entityTitle(module: WorkflowModule, entity: ResearchProject | ResearchPaper | SubmissionRecord | GroupMeetingRecord) {
  if (module === "research") return (entity as ResearchProject).title;
  if (module === "paper") return (entity as ResearchPaper).title;
  if (module === "submissions") return (entity as SubmissionRecord).venueName;
  return (entity as GroupMeetingRecord).title;
}

function projectDraftFromValue(value?: ResearchProject): ProjectDraft {
  return {
    id: value?.id ?? "",
    title: value?.title ?? "",
    summary: value?.summary ?? "",
    status: value?.status ?? "idea",
    priority: value?.priority ?? "medium",
    progress: value?.progress ?? 0,
    startDate: value?.startDate ?? todayISO(),
    targetEndDate: value?.targetEndDate ?? "",
    researchQuestion: value?.researchQuestion ?? "",
    hypothesis: value?.hypothesis ?? "",
    method: value?.method ?? "",
    dataSources: value?.dataSources ?? "",
    currentIssues: value?.currentIssues ?? "",
    nextActions: value?.nextActions ?? "",
    plannedTaskIdsText: (value?.plannedTaskIds ?? []).join(", "),
  };
}

function paperDraftFromValue(value: ResearchPaper | undefined, projectIds: string[]): PaperDraft {
  return {
    id: value?.id ?? "",
    title: value?.title ?? "",
    abstract: value?.abstract ?? "",
    keywordText: (value?.keywords ?? []).join(", "),
    status: value?.status ?? "planning",
    targetVenue: value?.targetVenue ?? "",
    chapterCount: value?.chapterCount ?? 0,
    completedChapters: value?.completedChapters ?? 0,
    overallProgress: value?.overallProgress ?? 0,
    currentIssues: value?.currentIssues ?? "",
    nextActions: value?.nextActions ?? "",
    writingPlan: value?.writingPlan ?? "",
    projectIds,
  };
}

function submissionDraftFromValue(value?: SubmissionRecord): SubmissionDraft {
  return {
    id: value?.id ?? "",
    paperId: value?.paperId ?? "",
    venueName: value?.venueName ?? "",
    venueType: value?.venueType ?? "journal",
    submittedAt: value?.submittedAt ?? todayISO(),
    manuscriptId: value?.manuscriptId ?? "",
    status: value?.status ?? "preparing",
    decisionDate: value?.decisionDate ?? "",
    revisionDueDate: value?.revisionDueDate ?? "",
    resultNote: value?.resultNote ?? "",
    responseLetterStatus: value?.responseLetterStatus ?? "open",
    revisionPlan: value?.revisionPlan ?? "",
    checklistText: (value?.materialsChecklist ?? []).map((item) => item.label).join("\n"),
  };
}

function meetingDraftFromValue(value?: GroupMeetingRecord): MeetingDraft {
  return {
    id: value?.id ?? "",
    date: value?.date ?? todayISO(),
    title: value?.title ?? "",
    meetingType: value?.meetingType ?? "group",
    attendees: value?.attendees ?? "",
    summary: value?.summary ?? "",
    discussionNotes: value?.discussionNotes ?? "",
    mentorFeedback: value?.mentorFeedback ?? "",
    decisions: value?.decisions ?? "",
    nextMeetingDate: value?.nextMeetingDate ?? "",
    projectIds: value?.projectIds ?? [],
    paperIds: value?.paperIds ?? [],
    submissionIds: value?.submissionIds ?? [],
    followUp: value?.followUp ?? "",
  };
}

export function ResearchWorkflowPanel({
  module,
  workflow,
  onChange,
  onCreateTask,
  onCreateEvent,
}: ResearchWorkflowPanelProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState("recent");
  const [viewState, setViewState] = useState<Record<WorkflowModule, ViewMode>>({
    research: "cards",
    paper: "cards",
    submissions: "table",
    meetings: "cards",
  });
  const [selectedIdState, setSelectedIdState] = useState<Record<WorkflowModule, string | null>>({
    research: null,
    paper: null,
    submissions: null,
    meetings: null,
  });
  const [detailTabState, setDetailTabState] = useState<Record<WorkflowModule, string>>({
    research: "overview",
    paper: "overview",
    submissions: "basic",
    meetings: "basic",
  });
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [paperDialogOpen, setPaperDialogOpen] = useState(false);
  const [submissionDialogOpen, setSubmissionDialogOpen] = useState(false);
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
  const [projectDraft, setProjectDraft] = useState<ProjectDraft>(projectDraftFromValue());
  const [paperDraft, setPaperDraft] = useState<PaperDraft>(paperDraftFromValue(undefined, []));
  const [submissionDraft, setSubmissionDraft] = useState<SubmissionDraft>(submissionDraftFromValue());
  const [meetingDraft, setMeetingDraft] = useState<MeetingDraft>(meetingDraftFromValue());

  const currentView = viewState[module];
  const selectedId = selectedIdState[module];
  const selectedTab = detailTabState[module];

  const primaryItems = useMemo(() => {
    if (module === "research") return workflow.projects;
    if (module === "paper") return workflow.papers;
    if (module === "submissions") return workflow.submissions;
    return workflow.meetings;
  }, [module, workflow]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = [...primaryItems].filter((item) => {
      const matchesStatus =
        statusFilter === "all" ||
        ("status" in item && item.status === statusFilter) ||
        ("meetingType" in item && item.meetingType === statusFilter);
      if (!matchesStatus) return false;
      if (!q) return true;
      if (module === "research") {
        const value = item as ResearchProject;
        return [value.title, value.summary, value.currentIssues, value.nextActions]
          .join(" ")
          .toLowerCase()
          .includes(q);
      }
      if (module === "paper") {
        const value = item as ResearchPaper;
        return [value.title, value.abstract, value.targetVenue, value.currentIssues, value.nextActions]
          .join(" ")
          .toLowerCase()
          .includes(q);
      }
      if (module === "submissions") {
        const value = item as SubmissionRecord;
        return [value.venueName, value.manuscriptId, value.resultNote].join(" ").toLowerCase().includes(q);
      }
      const value = item as GroupMeetingRecord;
      return [value.title, value.summary, value.discussionNotes, value.decisions]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });

    list.sort((a, b) => {
      if (sortKey === "title") return entityTitle(module, a).localeCompare(entityTitle(module, b));
      if (sortKey === "status") {
        const aStatus = "status" in a ? a.status : "meetingType" in a ? a.meetingType : "";
        const bStatus = "status" in b ? b.status : "meetingType" in b ? b.meetingType : "";
        return aStatus.localeCompare(bStatus);
      }
      const aDate =
        "submittedAt" in a
          ? a.submittedAt
          : "date" in a
            ? a.date
            : "startDate" in a
              ? a.startDate
              : todayISO();
      const bDate =
        "submittedAt" in b
          ? b.submittedAt
          : "date" in b
            ? b.date
            : "startDate" in b
              ? b.startDate
              : todayISO();
      return bDate.localeCompare(aDate);
    });
    return list;
  }, [module, primaryItems, search, sortKey, statusFilter]);

  const effectiveSelectedId =
    selectedId && filteredItems.some((item) => item.id === selectedId)
      ? selectedId
      : filteredItems[0]?.id ?? null;

  const selectedProject = workflow.projects.find((item) => item.id === effectiveSelectedId) ?? null;
  const selectedPaper = workflow.papers.find((item) => item.id === effectiveSelectedId) ?? null;
  const selectedSubmission = workflow.submissions.find((item) => item.id === effectiveSelectedId) ?? null;
  const selectedMeeting = workflow.meetings.find((item) => item.id === effectiveSelectedId) ?? null;

  function commit(updater: (prev: ResearchWorkflowState) => ResearchWorkflowState) {
    onChange(updater(workflow));
  }

  function openCreateDialog() {
    if (module === "research") {
      setProjectDraft(projectDraftFromValue());
      setProjectDialogOpen(true);
      return;
    }
    if (module === "paper") {
      setPaperDraft(paperDraftFromValue(undefined, []));
      setPaperDialogOpen(true);
      return;
    }
    if (module === "submissions") {
      setSubmissionDraft(submissionDraftFromValue());
      setSubmissionDialogOpen(true);
      return;
    }
    setMeetingDraft(meetingDraftFromValue());
    setMeetingDialogOpen(true);
  }

  function openEditDialog(id: string) {
    if (module === "research") {
      setProjectDraft(projectDraftFromValue(workflow.projects.find((item) => item.id === id)));
      setProjectDialogOpen(true);
      return;
    }
    if (module === "paper") {
      const paper = workflow.papers.find((item) => item.id === id);
      const projectIds = workflow.paperProjectLinks
        .filter((item) => item.paperId === id)
        .map((item) => item.projectId);
      setPaperDraft(paperDraftFromValue(paper, projectIds));
      setPaperDialogOpen(true);
      return;
    }
    if (module === "submissions") {
      setSubmissionDraft(submissionDraftFromValue(workflow.submissions.find((item) => item.id === id)));
      setSubmissionDialogOpen(true);
      return;
    }
    setMeetingDraft(meetingDraftFromValue(workflow.meetings.find((item) => item.id === id)));
    setMeetingDialogOpen(true);
  }

  function saveProjectDraft() {
    const id = projectDraft.id || createId("project");
    const value: ResearchProject = {
      id,
      title: projectDraft.title.trim(),
      summary: projectDraft.summary.trim(),
      status: projectDraft.status,
      priority: projectDraft.priority,
      progress: clampProgress(projectDraft.progress),
      startDate: projectDraft.startDate,
      targetEndDate: projectDraft.targetEndDate,
      researchQuestion: projectDraft.researchQuestion.trim(),
      hypothesis: projectDraft.hypothesis.trim(),
      method: projectDraft.method.trim(),
      dataSources: projectDraft.dataSources.trim(),
      currentIssues: projectDraft.currentIssues.trim(),
      nextActions: projectDraft.nextActions.trim(),
      plannedTaskIds: projectDraft.plannedTaskIdsText
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      metadata: {},
      ...emptyLinkState(),
    };
    commit((prev) => ({
      ...prev,
      projects: prev.projects.some((item) => item.id === id)
        ? prev.projects.map((item) => (item.id === id ? { ...item, ...value } : item))
        : [value, ...prev.projects],
      timelineEntries: [
        createTimelineEntry("project", id, value.startDate || todayISO(), value.title, "项目信息已更新"),
        ...prev.timelineEntries.filter((item) => !(item.entityType === "project" && item.entityId === id)),
      ],
    }));
    setSelectedIdState((prev) => ({ ...prev, research: id }));
    setProjectDialogOpen(false);
  }

  function savePaperDraft() {
    const id = paperDraft.id || createId("paper");
    const value: ResearchPaper = {
      id,
      title: paperDraft.title.trim(),
      abstract: paperDraft.abstract.trim(),
      keywords: paperDraft.keywordText
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      status: paperDraft.status,
      targetVenue: paperDraft.targetVenue.trim(),
      chapterCount: Math.max(0, Number(paperDraft.chapterCount) || 0),
      completedChapters: Math.max(0, Number(paperDraft.completedChapters) || 0),
      overallProgress: clampProgress(paperDraft.overallProgress),
      currentIssues: paperDraft.currentIssues.trim(),
      nextActions: paperDraft.nextActions.trim(),
      writingPlan: paperDraft.writingPlan.trim(),
      metadata: {},
      ...emptyLinkState(),
    };
    const links = paperDraft.projectIds.map((projectId) => ({
      id: `${id}-${projectId}`,
      paperId: id,
      projectId,
    }));
    commit((prev) => ({
      ...prev,
      papers: prev.papers.some((item) => item.id === id)
        ? prev.papers.map((item) => (item.id === id ? { ...item, ...value } : item))
        : [value, ...prev.papers],
      paperProjectLinks: [
        ...prev.paperProjectLinks.filter((item) => item.paperId !== id),
        ...links,
      ],
      timelineEntries: [
        createTimelineEntry("paper", id, todayISO(), value.title, "论文信息已更新"),
        ...prev.timelineEntries.filter((item) => !(item.entityType === "paper" && item.entityId === id)),
      ],
    }));
    setSelectedIdState((prev) => ({ ...prev, paper: id }));
    setPaperDialogOpen(false);
  }

  function saveSubmissionDraft() {
    const id = submissionDraft.id || createId("submission");
    const existingChecklist =
      workflow.submissions.find((item) => item.id === id)?.materialsChecklist ?? [];
    const draftChecklist = submissionDraft.checklistText
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    const value: SubmissionRecord = {
      id,
      paperId: submissionDraft.paperId,
      venueName: submissionDraft.venueName.trim(),
      venueType: submissionDraft.venueType,
      submittedAt: submissionDraft.submittedAt,
      manuscriptId: submissionDraft.manuscriptId.trim(),
      status: submissionDraft.status,
      decisionDate: submissionDraft.decisionDate,
      revisionDueDate: submissionDraft.revisionDueDate,
      resultNote: submissionDraft.resultNote.trim(),
      responseLetterStatus: submissionDraft.responseLetterStatus,
      revisionPlan: submissionDraft.revisionPlan.trim(),
      materialsChecklist:
        existingChecklist.length > 0
          ? existingChecklist.filter((item) => draftChecklist.includes(item.label))
          : ensureChecklistFromText(submissionDraft.checklistText),
      ...emptyLinkState(),
    };
    commit((prev) => {
      const historyExists = prev.submissionStatusHistory.some((item) => item.submissionId === id);
      return {
        ...prev,
        submissions: prev.submissions.some((item) => item.id === id)
          ? prev.submissions.map((item) => (item.id === id ? { ...item, ...value } : item))
          : [value, ...prev.submissions],
        submissionStatusHistory: historyExists
          ? prev.submissionStatusHistory
          : [
              {
                id: createId("submission-status"),
                submissionId: id,
                status: value.status,
                changedAt: value.submittedAt || todayISO(),
                note: "创建投稿记录",
              },
              ...prev.submissionStatusHistory,
            ],
        timelineEntries: [
          createTimelineEntry("submission", id, value.submittedAt || todayISO(), value.venueName, "投稿记录已更新"),
          ...prev.timelineEntries.filter((item) => !(item.entityType === "submission" && item.entityId === id)),
        ],
      };
    });
    setSelectedIdState((prev) => ({ ...prev, submissions: id }));
    setSubmissionDialogOpen(false);
  }

  function saveMeetingDraft() {
    const id = meetingDraft.id || createId("meeting");
    const value: GroupMeetingRecord = {
      ...meetingDraft,
      id,
      title: meetingDraft.title.trim(),
      attendees: meetingDraft.attendees.trim(),
      summary: meetingDraft.summary.trim(),
      discussionNotes: meetingDraft.discussionNotes.trim(),
      mentorFeedback: meetingDraft.mentorFeedback.trim(),
      decisions: meetingDraft.decisions.trim(),
      followUp: meetingDraft.followUp.trim(),
      ...emptyLinkState(),
    };
    commit((prev) => ({
      ...prev,
      meetings: prev.meetings.some((item) => item.id === id)
        ? prev.meetings.map((item) => (item.id === id ? { ...item, ...value } : item))
        : [value, ...prev.meetings],
      timelineEntries: [
        createTimelineEntry("meeting", id, value.date, value.title, "组会记录已更新"),
        ...prev.timelineEntries.filter((item) => !(item.entityType === "meeting" && item.entityId === id)),
      ],
    }));
    setSelectedIdState((prev) => ({ ...prev, meetings: id }));
    setMeetingDialogOpen(false);
  }

  function removePrimaryItem(id: string) {
    if (module === "research") {
      commit((prev) => ({
        ...prev,
        projects: prev.projects.filter((item) => item.id !== id),
        projectLogs: prev.projectLogs.filter((item) => item.projectId !== id),
        paperProjectLinks: prev.paperProjectLinks.filter((item) => item.projectId !== id),
        meetings: prev.meetings.map((item) => ({
          ...item,
          projectIds: item.projectIds.filter((projectId) => projectId !== id),
        })),
        meetingActionItems: prev.meetingActionItems.map((item) =>
          item.projectId === id ? { ...item, projectId: null } : item,
        ),
        timelineEntries: prev.timelineEntries.filter((item) => item.entityId !== id),
      }));
      return;
    }
    if (module === "paper") {
      commit((prev) => ({
        ...prev,
        papers: prev.papers.filter((item) => item.id !== id),
        paperProjectLinks: prev.paperProjectLinks.filter((item) => item.paperId !== id),
        paperSections: prev.paperSections.filter((item) => item.paperId !== id),
        paperFeedback: prev.paperFeedback.filter((item) => item.paperId !== id),
        submissions: prev.submissions.filter((item) => item.paperId !== id),
        meetings: prev.meetings.map((item) => ({
          ...item,
          paperIds: item.paperIds.filter((paperId) => paperId !== id),
        })),
        meetingActionItems: prev.meetingActionItems.map((item) =>
          item.paperId === id ? { ...item, paperId: null } : item,
        ),
        timelineEntries: prev.timelineEntries.filter((item) => item.entityId !== id),
      }));
      return;
    }
    if (module === "submissions") {
      commit((prev) => ({
        ...prev,
        submissions: prev.submissions.filter((item) => item.id !== id),
        submissionStatusHistory: prev.submissionStatusHistory.filter((item) => item.submissionId !== id),
        reviewComments: prev.reviewComments.filter((item) => item.submissionId !== id),
        meetings: prev.meetings.map((item) => ({
          ...item,
          submissionIds: item.submissionIds.filter((submissionId) => submissionId !== id),
        })),
        meetingActionItems: prev.meetingActionItems.map((item) =>
          item.submissionId === id ? { ...item, submissionId: null } : item,
        ),
        timelineEntries: prev.timelineEntries.filter((item) => item.entityId !== id),
      }));
      return;
    }
    commit((prev) => ({
      ...prev,
      meetings: prev.meetings.filter((item) => item.id !== id),
      meetingActionItems: prev.meetingActionItems.filter((item) => item.meetingId !== id),
      timelineEntries: prev.timelineEntries.filter((item) => item.entityId !== id),
    }));
  }

  const selectedProjectLogs = selectedProject
    ? workflow.projectLogs.filter((item) => item.projectId === selectedProject.id)
    : [];
  const selectedProjectPapers = selectedProject
    ? workflow.paperProjectLinks
        .filter((link) => link.projectId === selectedProject.id)
        .map((link) => workflow.papers.find((paper) => paper.id === link.paperId))
        .filter((item): item is ResearchPaper => Boolean(item))
    : [];
  const selectedProjectMeetings = selectedProject
    ? workflow.meetings.filter((item) => item.projectIds.includes(selectedProject.id))
    : [];
  const selectedPaperSections = selectedPaper
    ? workflow.paperSections
        .filter((item) => item.paperId === selectedPaper.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
    : [];
  const selectedPaperFeedback = selectedPaper
    ? workflow.paperFeedback.filter((item) => item.paperId === selectedPaper.id)
    : [];
  const selectedPaperSubmissions = selectedPaper
    ? workflow.submissions.filter((item) => item.paperId === selectedPaper.id)
    : [];
  const selectedPaperMeetings = selectedPaper
    ? workflow.meetings.filter((item) => item.paperIds.includes(selectedPaper.id))
    : [];
  const selectedSubmissionHistory = selectedSubmission
    ? workflow.submissionStatusHistory.filter((item) => item.submissionId === selectedSubmission.id)
    : [];
  const selectedSubmissionComments = selectedSubmission
    ? workflow.reviewComments.filter((item) => item.submissionId === selectedSubmission.id)
    : [];
  const selectedMeetingActions = selectedMeeting
    ? workflow.meetingActionItems.filter((item) => item.meetingId === selectedMeeting.id)
    : [];
  const selectedTimelines = workflow.timelineEntries
    .filter((item) => item.entityId === effectiveSelectedId)
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <section className="grid min-h-[720px] grid-cols-1 rounded-lg border border-gray-200 bg-white shadow-md lg:grid-cols-[380px_1fr]">
      <div className="border-b border-gray-200 lg:border-b-0 lg:border-r">
        <header className="border-b border-gray-200 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                {moduleIcons[module]}
                <span>{moduleLabels[module]}</span>
              </div>
              <p className="mt-1 text-sm text-gray-600">搜索、筛选并查看工作流状态。</p>
            </div>
            <Button type="button" size="sm" onClick={openCreateDialog}>
              <Plus className="mr-1 h-4 w-4" />
              新建
            </Button>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={`搜索${moduleLabels[module]}`}
                className="pl-9"
              />
            </div>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <Select value={statusFilter} onValueChange={(value) => value && setStatusFilter(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="筛选状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  {module === "research" &&
                    researchProjectStatusOptions.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  {module === "paper" &&
                    researchPaperStatusOptions.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  {module === "submissions" &&
                    submissionStatusOptions.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  {module === "meetings" &&
                    meetingTypeOptions.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Select value={sortKey} onValueChange={(value) => value && setSortKey(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="排序" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">最近时间</SelectItem>
                  <SelectItem value="title">标题</SelectItem>
                  <SelectItem value="status">状态</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-1">
                <button
                  type="button"
                  onClick={() => setViewState((prev) => ({ ...prev, [module]: "cards" }))}
                  className={cn(
                    "rounded p-1.5 text-gray-500",
                    currentView === "cards" && "bg-white text-black shadow-sm",
                  )}
                  aria-label="卡片视图"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewState((prev) => ({ ...prev, [module]: "table" }))}
                  className={cn(
                    "rounded p-1.5 text-gray-500",
                    currentView === "table" && "bg-white text-black shadow-sm",
                  )}
                  aria-label="表格视图"
                >
                  <Table2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewState((prev) => ({ ...prev, [module]: "kanban" }))}
                  className={cn(
                    "rounded p-1.5 text-gray-500",
                    currentView === "kanban" && "bg-white text-black shadow-sm",
                  )}
                  aria-label="看板视图"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="max-h-[760px] overflow-y-auto p-4">
          {filteredItems.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-500">
              没有符合条件的记录。
            </div>
          ) : currentView === "table" ? (
            <TableList
              module={module}
              items={filteredItems}
              selectedId={effectiveSelectedId}
              onSelect={(id) => setSelectedIdState((prev) => ({ ...prev, [module]: id }))}
              onEdit={openEditDialog}
              onDelete={removePrimaryItem}
            />
          ) : currentView === "kanban" ? (
            <KanbanList
              module={module}
              items={filteredItems}
              selectedId={effectiveSelectedId}
              onSelect={(id) => setSelectedIdState((prev) => ({ ...prev, [module]: id }))}
            />
          ) : (
            <CardList
              module={module}
              items={filteredItems}
              selectedId={effectiveSelectedId}
              onSelect={(id) => setSelectedIdState((prev) => ({ ...prev, [module]: id }))}
              onEdit={openEditDialog}
              onDelete={removePrimaryItem}
            />
          )}
        </div>
      </div>

      <div className="min-h-[720px]">
        {module === "research" && selectedProject ? (
          <ProjectDetails
            project={selectedProject}
            papers={selectedProjectPapers}
            meetings={selectedProjectMeetings}
            logs={selectedProjectLogs}
            timeline={selectedTimelines}
            activeTab={selectedTab}
            onTabChange={(tab) => setDetailTabState((prev) => ({ ...prev, research: tab }))}
            onAddLog={(log) =>
              commit((prev) => ({
                ...prev,
                projectLogs: [log, ...prev.projectLogs],
                timelineEntries: [
                  createTimelineEntry("project_log", log.id, log.date, selectedProject.title, log.progressText),
                  ...prev.timelineEntries,
                ],
              }))
            }
            onCreateTask={(title, dueDate, notes, targetId) => {
              const taskId = onCreateTask({ title, dueDate, notes });
              if (!taskId || !targetId) return;
              commit((prev) => ({
                ...prev,
                projectLogs: prev.projectLogs.map((item) =>
                  item.id === targetId ? { ...item, linkedTaskIds: [...item.linkedTaskIds, taskId] } : item,
                ),
              }));
            }}
          />
        ) : module === "paper" && selectedPaper ? (
          <PaperDetails
            paper={selectedPaper}
            sections={selectedPaperSections}
            feedback={selectedPaperFeedback}
            submissions={selectedPaperSubmissions}
            meetings={selectedPaperMeetings}
            timeline={selectedTimelines}
            projects={workflow.paperProjectLinks
              .filter((item) => item.paperId === selectedPaper.id)
              .map((item) => workflow.projects.find((project) => project.id === item.projectId))
              .filter((item): item is ResearchProject => Boolean(item))}
            activeTab={selectedTab}
            onTabChange={(tab) => setDetailTabState((prev) => ({ ...prev, paper: tab }))}
            onAddSection={(section) =>
              commit((prev) => ({
                ...prev,
                paperSections: [...prev.paperSections, section],
                timelineEntries: [
                  createTimelineEntry("paper_section", section.id, todayISO(), section.title, "新增论文章节"),
                  ...prev.timelineEntries,
                ],
              }))
            }
            onAddFeedback={(item) =>
              commit((prev) => ({
                ...prev,
                paperFeedback: [item, ...prev.paperFeedback],
                timelineEntries: [
                  createTimelineEntry("paper_feedback", item.id, item.date, selectedPaper.title, item.content),
                  ...prev.timelineEntries,
                ],
              }))
            }
            onCreateTask={(title, dueDate, notes, targetId, targetType) => {
              const taskId = onCreateTask({ title, dueDate, notes });
              if (!taskId) return;
              commit((prev) => ({
                ...prev,
                paperSections:
                  targetType === "section"
                    ? prev.paperSections.map((item) =>
                        item.id === targetId ? { ...item, linkedTaskIds: [...item.linkedTaskIds, taskId] } : item,
                      )
                    : prev.paperSections,
                paperFeedback:
                  targetType === "feedback"
                    ? prev.paperFeedback.map((item) =>
                        item.id === targetId ? { ...item, linkedTaskIds: [...item.linkedTaskIds, taskId] } : item,
                      )
                    : prev.paperFeedback,
              }));
            }}
          />
        ) : module === "submissions" && selectedSubmission ? (
          <SubmissionDetails
            submission={selectedSubmission}
            paper={workflow.papers.find((item) => item.id === selectedSubmission.paperId) ?? null}
            history={selectedSubmissionHistory}
            comments={selectedSubmissionComments}
            sections={workflow.paperSections.filter((item) => item.paperId === selectedSubmission.paperId)}
            timeline={selectedTimelines}
            activeTab={selectedTab}
            onTabChange={(tab) => setDetailTabState((prev) => ({ ...prev, submissions: tab }))}
            onAddHistory={(item) =>
              commit((prev) => ({
                ...prev,
                submissionStatusHistory: [item, ...prev.submissionStatusHistory],
                submissions: prev.submissions.map((submission) =>
                  submission.id === selectedSubmission.id ? { ...submission, status: item.status } : submission,
                ),
                timelineEntries: [
                  createTimelineEntry("submission_status", item.id, item.changedAt, selectedSubmission.venueName, item.note),
                  ...prev.timelineEntries,
                ],
              }))
            }
            onAddComment={(item) =>
              commit((prev) => ({
                ...prev,
                reviewComments: [item, ...prev.reviewComments],
                timelineEntries: [
                  createTimelineEntry("review_comment", item.id, todayISO(), item.reviewer, item.comment),
                  ...prev.timelineEntries,
                ],
              }))
            }
            onUpdateSubmission={(patch) =>
              commit((prev) => ({
                ...prev,
                submissions: prev.submissions.map((item) =>
                  item.id === selectedSubmission.id ? { ...item, ...patch } : item,
                ),
              }))
            }
            onCreateTask={(title, dueDate, notes, commentId) => {
              const taskId = onCreateTask({ title, dueDate, notes });
              if (!taskId) return;
              commit((prev) => ({
                ...prev,
                reviewComments: prev.reviewComments.map((item) =>
                  item.id === commentId ? { ...item, linkedTaskIds: [...item.linkedTaskIds, taskId] } : item,
                ),
              }));
            }}
          />
        ) : module === "meetings" && selectedMeeting ? (
          <MeetingDetails
            meeting={selectedMeeting}
            projects={workflow.projects.filter((item) => selectedMeeting.projectIds.includes(item.id))}
            papers={workflow.papers.filter((item) => selectedMeeting.paperIds.includes(item.id))}
            submissions={workflow.submissions.filter((item) => selectedMeeting.submissionIds.includes(item.id))}
            actionItems={selectedMeetingActions}
            timeline={selectedTimelines}
            activeTab={selectedTab}
            onTabChange={(tab) => setDetailTabState((prev) => ({ ...prev, meetings: tab }))}
            onAddAction={(item) =>
              commit((prev) => ({
                ...prev,
                meetingActionItems: [item, ...prev.meetingActionItems],
                timelineEntries: [
                  createTimelineEntry("meeting_action", item.id, item.dueDate || selectedMeeting.date, selectedMeeting.title, item.content),
                  ...prev.timelineEntries,
                ],
              }))
            }
            onUpdateAction={(itemId, patch) =>
              commit((prev) => ({
                ...prev,
                meetingActionItems: prev.meetingActionItems.map((item) =>
                  item.id === itemId ? { ...item, ...patch } : item,
                ),
              }))
            }
            onCreateTask={(title, dueDate, notes, actionId) => {
              const taskId = onCreateTask({ title, dueDate, notes });
              if (!taskId) return;
              commit((prev) => ({
                ...prev,
                meetingActionItems: prev.meetingActionItems.map((item) =>
                  item.id === actionId ? { ...item, linkedTaskIds: [...item.linkedTaskIds, taskId] } : item,
                ),
              }));
            }}
            onCreateEvent={(title, date, notes, actionId) => {
              const eventId = onCreateEvent({ title, date, notes });
              if (!eventId) return;
              commit((prev) => ({
                ...prev,
                meetingActionItems: prev.meetingActionItems.map((item) =>
                  item.id === actionId ? { ...item, linkedEventIds: [...item.linkedEventIds, eventId] } : item,
                ),
              }));
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-sm text-gray-500">
            请选择一条记录查看详情。
          </div>
        )}
      </div>

      <ProjectDialog
        open={projectDialogOpen}
        draft={projectDraft}
        onOpenChange={setProjectDialogOpen}
        onChange={setProjectDraft}
        onSave={saveProjectDraft}
      />
      <PaperDialog
        open={paperDialogOpen}
        draft={paperDraft}
        onOpenChange={setPaperDialogOpen}
        onChange={setPaperDraft}
        onSave={savePaperDraft}
        projects={workflow.projects}
      />
      <SubmissionDialog
        open={submissionDialogOpen}
        draft={submissionDraft}
        onOpenChange={setSubmissionDialogOpen}
        onChange={setSubmissionDraft}
        onSave={saveSubmissionDraft}
        papers={workflow.papers}
      />
      <MeetingDialog
        open={meetingDialogOpen}
        draft={meetingDraft}
        onOpenChange={setMeetingDialogOpen}
        onChange={setMeetingDraft}
        onSave={saveMeetingDraft}
        projects={workflow.projects}
        papers={workflow.papers}
        submissions={workflow.submissions}
      />
    </section>
  );
}

function CardList({
  module,
  items,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
}: {
  module: WorkflowModule;
  items: Array<ResearchProject | ResearchPaper | SubmissionRecord | GroupMeetingRecord>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const selected = item.id === selectedId;
        const title = entityTitle(module, item);
        const secondary =
          module === "research"
            ? (() => {
                const value = item as ResearchProject;
                return value.summary || value.currentIssues || value.nextActions;
              })()
            : module === "paper"
              ? (() => {
                  const value = item as ResearchPaper;
                  return value.abstract || value.currentIssues || value.nextActions;
                })()
              : module === "submissions"
                ? (() => {
                    const value = item as SubmissionRecord;
                    return value.resultNote || value.manuscriptId;
                  })()
                : (() => {
                    const value = item as GroupMeetingRecord;
                    return value.summary || value.discussionNotes || value.decisions;
                  })();
        const badgeText =
          "status" in item ? statusLabel(item.status) : "meetingType" in item ? item.meetingType : "";
        return (
          <div
            key={item.id}
            className={cn(
              "rounded-lg border border-gray-200 p-4 transition",
              selected && "border-black bg-gray-50",
            )}
          >
            <button type="button" className="w-full text-left" onClick={() => onSelect(item.id)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">{title}</p>
                  <p className="mt-2 line-clamp-3 text-sm text-gray-600">{secondary || "暂无补充信息"}</p>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {badgeText}
                </Badge>
              </div>
            </button>
            <div className="mt-3 flex items-center justify-between gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onEdit(item.id)}>
                编辑
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => onDelete(item.id)}>
                删除
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TableList({
  module,
  items,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
}: {
  module: WorkflowModule;
  items: Array<ResearchProject | ResearchPaper | SubmissionRecord | GroupMeetingRecord>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs text-gray-500">
          <tr>
            <th className="px-3 py-2">标题</th>
            <th className="px-3 py-2">状态</th>
            <th className="px-3 py-2">操作</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className={cn("border-t border-gray-200", item.id === selectedId && "bg-gray-50")}
            >
              <td className="px-3 py-3">
                <button type="button" className="font-medium text-gray-900" onClick={() => onSelect(item.id)}>
                  {entityTitle(module, item)}
                </button>
              </td>
              <td className="px-3 py-3 text-gray-600">
                {"status" in item ? statusLabel(item.status) : "meetingType" in item ? item.meetingType : ""}
              </td>
              <td className="px-3 py-3">
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => onEdit(item.id)}>
                    编辑
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => onDelete(item.id)}>
                    删除
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KanbanList({
  module,
  items,
  selectedId,
  onSelect,
}: {
  module: WorkflowModule;
  items: Array<ResearchProject | ResearchPaper | SubmissionRecord | GroupMeetingRecord>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const groups = useMemo(() => {
    const bucket = new Map<string, Array<ResearchProject | ResearchPaper | SubmissionRecord | GroupMeetingRecord>>();
    items.forEach((item) => {
      const key = "status" in item ? statusLabel(item.status) : "meetingType" in item ? item.meetingType : "其他";
      const list = bucket.get(key) ?? [];
      list.push(item);
      bucket.set(key, list);
    });
    return Array.from(bucket.entries());
  }, [items]);

  return (
    <div className="space-y-3">
      {groups.map(([group, groupItems]) => (
        <div key={group} className="rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700">
            <Filter className="h-4 w-4" />
            <span>{group}</span>
            <Badge variant="secondary">{groupItems.length}</Badge>
          </div>
          <div className="space-y-2 p-3">
            {groupItems.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => onSelect(item.id)}
                className={cn(
                  "w-full rounded-md border border-gray-200 px-3 py-2 text-left text-sm",
                  item.id === selectedId && "border-black bg-gray-50",
                )}
              >
                {entityTitle(module, item)}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DetailTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: Array<{ id: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-gray-200 px-5 py-3">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "rounded-full px-3 py-1.5 text-sm text-gray-500",
            value === tab.id && "bg-black text-white",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function DetailSection({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-gray-200 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function TimelineList({ items }: { items: TimelineEntry[] }) {
  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">暂无时间线记录。</p>
      ) : (
        items.map((item) => (
          <div key={item.id} className="rounded-lg border border-gray-200 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-gray-900">{item.title}</p>
              <span className="text-xs text-gray-500">{item.date}</span>
            </div>
            <p className="mt-2 text-sm text-gray-600">{item.description}</p>
          </div>
        ))
      )}
    </div>
  );
}

function LinkedItemList({ labels }: { labels: string[] }) {
  if (labels.length === 0) return <p className="text-sm text-gray-500">暂无关联。</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {labels.map((label) => (
        <Badge key={label} variant="secondary">
          {label}
        </Badge>
      ))}
    </div>
  );
}

function ProjectDetails({
  project,
  papers,
  meetings,
  logs,
  timeline,
  activeTab,
  onTabChange,
  onAddLog,
  onCreateTask,
}: {
  project: ResearchProject;
  papers: ResearchPaper[];
  meetings: GroupMeetingRecord[];
  logs: ProjectLog[];
  timeline: TimelineEntry[];
  activeTab: string;
  onTabChange: (value: string) => void;
  onAddLog: (value: ProjectLog) => void;
  onCreateTask: (title: string, dueDate?: string, notes?: string, targetId?: string) => void;
}) {
  const [logDraft, setLogDraft] = useState({
    date: todayISO(),
    progressText: "",
    issues: "",
    nextActions: "",
    syncToActivityLog: true,
  });

  return (
    <div className="h-full">
      <header className="border-b border-gray-200 px-5 py-4">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">{project.title}</h2>
          <Badge variant="secondary">{statusLabel(project.status)}</Badge>
          <Badge variant="secondary">{priorityLabel(project.priority)}</Badge>
        </div>
        <p className="mt-2 text-sm text-gray-600">{project.summary || "暂无简介"}</p>
      </header>
      <DetailTabs
        tabs={[
          { id: "overview", label: "概览" },
          { id: "plan", label: "计划" },
          { id: "tasks", label: "任务" },
          { id: "logs", label: "日志" },
          { id: "papers", label: "论文" },
          { id: "meetings", label: "组会" },
          { id: "timeline", label: "时间线" },
        ]}
        value={activeTab}
        onChange={onTabChange}
      />
      <div className="space-y-4 p-5">
        {activeTab === "overview" && (
          <>
            <DetailSection title="项目状态">
              <div className="grid grid-cols-2 gap-3 text-sm text-gray-600 sm:grid-cols-4">
                <InfoStat label="进度" value={`${project.progress}%`} />
                <InfoStat label="开始日期" value={project.startDate || "-"} />
                <InfoStat label="目标结束" value={project.targetEndDate || "-"} />
                <InfoStat label="预留任务链接" value={String(project.linkedTaskIds.length)} />
              </div>
            </DetailSection>
            <DetailSection title="核心问题">
              <div className="space-y-3 text-sm text-gray-600">
                <p><span className="font-medium text-gray-900">研究问题：</span>{project.researchQuestion || "-"}</p>
                <p><span className="font-medium text-gray-900">研究假设：</span>{project.hypothesis || "-"}</p>
                <p><span className="font-medium text-gray-900">方法：</span>{project.method || "-"}</p>
                <p><span className="font-medium text-gray-900">数据来源：</span>{project.dataSources || "-"}</p>
              </div>
            </DetailSection>
          </>
        )}
        {activeTab === "plan" && (
          <DetailSection title="当前计划">
            <div className="space-y-3 text-sm text-gray-600">
              <p><span className="font-medium text-gray-900">当前问题：</span>{project.currentIssues || "-"}</p>
              <p><span className="font-medium text-gray-900">下一步行动：</span>{project.nextActions || "-"}</p>
            </div>
          </DetailSection>
        )}
        {activeTab === "tasks" && (
          <DetailSection
            title="任务联动"
            action={
              <Button
                type="button"
                size="sm"
                onClick={() => onCreateTask(project.nextActions || `${project.title} 跟进`, project.targetEndDate, project.currentIssues)}
              >
                一键转任务
              </Button>
            }
          >
            <LinkedItemList labels={project.linkedTaskIds} />
          </DetailSection>
        )}
        {activeTab === "logs" && (
          <>
            <DetailSection
              title="新增项目日志"
              action={
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (!logDraft.progressText.trim()) return;
                    onAddLog({
                      id: createId("project-log"),
                      projectId: project.id,
                      date: logDraft.date,
                      progressText: logDraft.progressText.trim(),
                      issues: logDraft.issues.trim(),
                      nextActions: logDraft.nextActions.trim(),
                      syncToActivityLog: logDraft.syncToActivityLog,
                      ...emptyLinkState(),
                    });
                    setLogDraft({ date: todayISO(), progressText: "", issues: "", nextActions: "", syncToActivityLog: true });
                  }}
                >
                  保存日志
                </Button>
              }
            >
              <div className="grid grid-cols-1 gap-3">
                <Input type="date" value={logDraft.date} onChange={(event) => setLogDraft((prev) => ({ ...prev, date: event.target.value }))} />
                <Textarea value={logDraft.progressText} onChange={(event) => setLogDraft((prev) => ({ ...prev, progressText: event.target.value }))} placeholder="进展内容" />
                <Textarea value={logDraft.issues} onChange={(event) => setLogDraft((prev) => ({ ...prev, issues: event.target.value }))} placeholder="当前问题" />
                <Textarea value={logDraft.nextActions} onChange={(event) => setLogDraft((prev) => ({ ...prev, nextActions: event.target.value }))} placeholder="下一步行动" />
              </div>
            </DetailSection>
            <DetailSection title="日志记录">
              <div className="space-y-3">
                {logs.length === 0 ? (
                  <p className="text-sm text-gray-500">暂无项目日志。</p>
                ) : (
                  logs.map((item) => (
                    <div key={item.id} className="rounded-lg border border-gray-200 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900">{item.date}</p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onCreateTask(item.nextActions || `${project.title} 日志跟进`, item.date, `${item.progressText}\n${item.issues}`, item.id)}
                        >
                          转任务
                        </Button>
                      </div>
                      <p className="mt-2 text-sm text-gray-600">{item.progressText}</p>
                      {item.issues ? <p className="mt-2 text-sm text-gray-500">问题：{item.issues}</p> : null}
                      {item.nextActions ? <p className="mt-2 text-sm text-gray-500">下一步：{item.nextActions}</p> : null}
                    </div>
                  ))
                )}
              </div>
            </DetailSection>
          </>
        )}
        {activeTab === "papers" && (
          <DetailSection title="关联论文">
            <LinkedItemList labels={papers.map((item) => item.title)} />
          </DetailSection>
        )}
        {activeTab === "meetings" && (
          <DetailSection title="关联组会">
            <LinkedItemList labels={meetings.map((item) => `${item.date} ${item.title}`)} />
          </DetailSection>
        )}
        {activeTab === "timeline" && <TimelineList items={timeline} />}
      </div>
    </div>
  );
}

function PaperDetails({
  paper,
  sections,
  feedback,
  submissions,
  meetings,
  timeline,
  projects,
  activeTab,
  onTabChange,
  onAddSection,
  onAddFeedback,
  onCreateTask,
}: {
  paper: ResearchPaper;
  sections: PaperSection[];
  feedback: PaperFeedback[];
  submissions: SubmissionRecord[];
  meetings: GroupMeetingRecord[];
  timeline: TimelineEntry[];
  projects: ResearchProject[];
  activeTab: string;
  onTabChange: (value: string) => void;
  onAddSection: (value: PaperSection) => void;
  onAddFeedback: (value: PaperFeedback) => void;
  onCreateTask: (title: string, dueDate?: string, notes?: string, targetId?: string, targetType?: "section" | "feedback") => void;
}) {
  const [sectionDraft, setSectionDraft] = useState({
    title: "",
    sortOrder: sections.length + 1,
    status: "planned" as PaperSectionStatus,
    targetWords: 0,
    currentWords: 0,
    notes: "",
    issues: "",
    nextActions: "",
  });
  const [feedbackDraft, setFeedbackDraft] = useState({
    source: "advisor" as FeedbackSource,
    date: todayISO(),
    content: "",
    suggestedAction: "",
    status: "open" as FeedbackStatus,
    relatedSectionId: "",
  });

  return (
    <div className="h-full">
      <header className="border-b border-gray-200 px-5 py-4">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">{paper.title}</h2>
          <Badge variant="secondary">{statusLabel(paper.status)}</Badge>
        </div>
        <p className="mt-2 text-sm text-gray-600">{paper.abstract || "暂无摘要"}</p>
      </header>
      <DetailTabs
        tabs={[
          { id: "overview", label: "概览" },
          { id: "chapters", label: "章节" },
          { id: "writing", label: "写作计划" },
          { id: "feedback", label: "反馈修改" },
          { id: "submissions", label: "投稿" },
          { id: "tasks", label: "任务" },
          { id: "meetings", label: "组会" },
          { id: "timeline", label: "时间线" },
        ]}
        value={activeTab}
        onChange={onTabChange}
      />
      <div className="space-y-4 p-5">
        {activeTab === "overview" && (
          <>
            <DetailSection title="论文状态">
              <div className="grid grid-cols-2 gap-3 text-sm text-gray-600 sm:grid-cols-4">
                <InfoStat label="章节" value={`${paper.completedChapters}/${paper.chapterCount}`} />
                <InfoStat label="进度" value={`${paper.overallProgress}%`} />
                <InfoStat label="目标期刊/会议" value={paper.targetVenue || "-"} />
                <InfoStat label="关联项目" value={String(projects.length)} />
              </div>
            </DetailSection>
            <DetailSection title="关联项目">
              <LinkedItemList labels={projects.map((item) => item.title)} />
            </DetailSection>
          </>
        )}
        {activeTab === "chapters" && (
          <>
            <DetailSection
              title="新增章节"
              action={
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (!sectionDraft.title.trim()) return;
                    onAddSection({
                      id: createId("paper-section"),
                      paperId: paper.id,
                      title: sectionDraft.title.trim(),
                      sortOrder: Number(sectionDraft.sortOrder) || sections.length + 1,
                      status: sectionDraft.status,
                      targetWords: Number(sectionDraft.targetWords) || 0,
                      currentWords: Number(sectionDraft.currentWords) || 0,
                      notes: sectionDraft.notes.trim(),
                      issues: sectionDraft.issues.trim(),
                      nextActions: sectionDraft.nextActions.trim(),
                      ...emptyLinkState(),
                    });
                    setSectionDraft({ title: "", sortOrder: sections.length + 2, status: "planned", targetWords: 0, currentWords: 0, notes: "", issues: "", nextActions: "" });
                  }}
                >
                  添加章节
                </Button>
              }
            >
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Input value={sectionDraft.title} onChange={(event) => setSectionDraft((prev) => ({ ...prev, title: event.target.value }))} placeholder="章节标题" />
                <Input type="number" value={sectionDraft.sortOrder} onChange={(event) => setSectionDraft((prev) => ({ ...prev, sortOrder: Number(event.target.value) }))} placeholder="顺序" />
                <Select value={sectionDraft.status} onValueChange={(value) => value && setSectionDraft((prev) => ({ ...prev, status: value as PaperSectionStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{paperSectionStatusOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                </Select>
                <Input type="number" value={sectionDraft.targetWords} onChange={(event) => setSectionDraft((prev) => ({ ...prev, targetWords: Number(event.target.value) }))} placeholder="目标字数" />
                <Input type="number" value={sectionDraft.currentWords} onChange={(event) => setSectionDraft((prev) => ({ ...prev, currentWords: Number(event.target.value) }))} placeholder="当前字数" />
                <Textarea value={sectionDraft.notes} onChange={(event) => setSectionDraft((prev) => ({ ...prev, notes: event.target.value }))} placeholder="备注" />
                <Textarea value={sectionDraft.issues} onChange={(event) => setSectionDraft((prev) => ({ ...prev, issues: event.target.value }))} placeholder="问题" />
                <Textarea value={sectionDraft.nextActions} onChange={(event) => setSectionDraft((prev) => ({ ...prev, nextActions: event.target.value }))} placeholder="下一步行动" />
              </div>
            </DetailSection>
            <DetailSection title="章节列表">
              <div className="space-y-3">
                {sections.length === 0 ? (
                  <p className="text-sm text-gray-500">暂无章节。</p>
                ) : (
                  sections.map((section) => (
                    <div key={section.id} className="rounded-lg border border-gray-200 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{section.sortOrder}. {section.title}</p>
                          <p className="text-xs text-gray-500">{statusLabel(section.status)} · {section.currentWords}/{section.targetWords} 字</p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onCreateTask(section.nextActions || `${paper.title} - ${section.title}`, undefined, `${section.notes}\n${section.issues}`, section.id, "section")}
                        >
                          转任务
                        </Button>
                      </div>
                      {section.issues ? <p className="mt-2 text-sm text-gray-600">问题：{section.issues}</p> : null}
                      {section.nextActions ? <p className="mt-2 text-sm text-gray-600">下一步：{section.nextActions}</p> : null}
                    </div>
                  ))
                )}
              </div>
            </DetailSection>
          </>
        )}
        {activeTab === "writing" && (
          <DetailSection title="写作计划">
            <div className="space-y-3 text-sm text-gray-600">
              <p><span className="font-medium text-gray-900">关键词：</span>{paper.keywords.join(", ") || "-"}</p>
              <p><span className="font-medium text-gray-900">当前问题：</span>{paper.currentIssues || "-"}</p>
              <p><span className="font-medium text-gray-900">下一步行动：</span>{paper.nextActions || "-"}</p>
              <p><span className="font-medium text-gray-900">写作计划：</span>{paper.writingPlan || "-"}</p>
            </div>
          </DetailSection>
        )}
        {activeTab === "feedback" && (
          <>
            <DetailSection
              title="新增反馈"
              action={
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (!feedbackDraft.content.trim()) return;
                    onAddFeedback({
                      id: createId("paper-feedback"),
                      paperId: paper.id,
                      source: feedbackDraft.source,
                      date: feedbackDraft.date,
                      content: feedbackDraft.content.trim(),
                      suggestedAction: feedbackDraft.suggestedAction.trim(),
                      status: feedbackDraft.status,
                      relatedSectionId: feedbackDraft.relatedSectionId || null,
                      ...emptyLinkState(),
                    });
                    setFeedbackDraft({ source: "advisor", date: todayISO(), content: "", suggestedAction: "", status: "open", relatedSectionId: "" });
                  }}
                >
                  添加反馈
                </Button>
              }
            >
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Select value={feedbackDraft.source} onValueChange={(value) => value && setFeedbackDraft((prev) => ({ ...prev, source: value as FeedbackSource }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{feedbackSourceOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                </Select>
                <Input type="date" value={feedbackDraft.date} onChange={(event) => setFeedbackDraft((prev) => ({ ...prev, date: event.target.value }))} />
                <Select value={feedbackDraft.status} onValueChange={(value) => value && setFeedbackDraft((prev) => ({ ...prev, status: value as FeedbackStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{feedbackStatusOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={feedbackDraft.relatedSectionId || "none"} onValueChange={(value) => setFeedbackDraft((prev) => ({ ...prev, relatedSectionId: !value || value === "none" ? "" : value }))}>
                  <SelectTrigger><SelectValue placeholder="关联章节" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不关联章节</SelectItem>
                    {sections.map((section) => <SelectItem key={section.id} value={section.id}>{section.title}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Textarea value={feedbackDraft.content} onChange={(event) => setFeedbackDraft((prev) => ({ ...prev, content: event.target.value }))} placeholder="反馈内容" />
                <Textarea value={feedbackDraft.suggestedAction} onChange={(event) => setFeedbackDraft((prev) => ({ ...prev, suggestedAction: event.target.value }))} placeholder="建议动作" />
              </div>
            </DetailSection>
            <DetailSection title="反馈列表">
              <div className="space-y-3">
                {feedback.length === 0 ? (
                  <p className="text-sm text-gray-500">暂无反馈。</p>
                ) : (
                  feedback.map((item) => (
                    <div key={item.id} className="rounded-lg border border-gray-200 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900">{item.date} · {feedbackSourceOptions.find((option) => option.value === item.source)?.label}</p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onCreateTask(item.suggestedAction || `${paper.title} 反馈处理`, undefined, item.content, item.id, "feedback")}
                        >
                          转任务
                        </Button>
                      </div>
                      <p className="mt-2 text-sm text-gray-600">{item.content}</p>
                      {item.suggestedAction ? <p className="mt-2 text-sm text-gray-500">建议动作：{item.suggestedAction}</p> : null}
                    </div>
                  ))
                )}
              </div>
            </DetailSection>
          </>
        )}
        {activeTab === "submissions" && (
          <DetailSection title="投稿记录">
            <LinkedItemList labels={submissions.map((item) => `${item.venueName} · ${statusLabel(item.status)}`)} />
          </DetailSection>
        )}
        {activeTab === "tasks" && (
          <DetailSection
            title="任务联动"
            action={<Button type="button" size="sm" onClick={() => onCreateTask(paper.nextActions || `${paper.title} 写作推进`, undefined, paper.currentIssues)}>一键转任务</Button>}
          >
            <LinkedItemList labels={paper.linkedTaskIds} />
          </DetailSection>
        )}
        {activeTab === "meetings" && (
          <DetailSection title="关联组会">
            <LinkedItemList labels={meetings.map((item) => `${item.date} ${item.title}`)} />
          </DetailSection>
        )}
        {activeTab === "timeline" && <TimelineList items={timeline} />}
      </div>
    </div>
  );
}

function SubmissionDetails({
  submission,
  paper,
  history,
  comments,
  sections,
  timeline,
  activeTab,
  onTabChange,
  onAddHistory,
  onAddComment,
  onUpdateSubmission,
  onCreateTask,
}: {
  submission: SubmissionRecord;
  paper: ResearchPaper | null;
  history: SubmissionStatusHistoryEntry[];
  comments: ReviewComment[];
  sections: PaperSection[];
  timeline: TimelineEntry[];
  activeTab: string;
  onTabChange: (value: string) => void;
  onAddHistory: (item: SubmissionStatusHistoryEntry) => void;
  onAddComment: (item: ReviewComment) => void;
  onUpdateSubmission: (patch: Partial<SubmissionRecord>) => void;
  onCreateTask: (title: string, dueDate?: string, notes?: string, commentId?: string) => void;
}) {
  const [historyDraft, setHistoryDraft] = useState({
    status: submission.status,
    changedAt: todayISO(),
    note: "",
  });
  const [commentDraft, setCommentDraft] = useState({
    reviewer: "",
    comment: "",
    response: "",
    status: "open" as FeedbackStatus,
    paperSectionId: "",
  });
  const [checklistDraft, setChecklistDraft] = useState("");

  return (
    <div className="h-full">
      <header className="border-b border-gray-200 px-5 py-4">
        <div className="flex items-center gap-2">
          <Send className="h-4 w-4 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">{submission.venueName}</h2>
          <Badge variant="secondary">{statusLabel(submission.status)}</Badge>
        </div>
        <p className="mt-2 text-sm text-gray-600">{paper ? `关联论文：${paper.title}` : "未关联论文"}</p>
      </header>
      <DetailTabs
        tabs={[
          { id: "basic", label: "基本信息" },
          { id: "history", label: "状态历史" },
          { id: "comments", label: "审稿意见" },
          { id: "revision", label: "返修计划" },
          { id: "checklist", label: "材料清单" },
          { id: "timeline", label: "时间线" },
        ]}
        value={activeTab}
        onChange={onTabChange}
      />
      <div className="space-y-4 p-5">
        {activeTab === "basic" && (
          <DetailSection title="投稿信息">
            <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
              <InfoStat label="投稿日期" value={submission.submittedAt || "-"} />
              <InfoStat label="Manuscript ID" value={submission.manuscriptId || "-"} />
              <InfoStat label="决定日期" value={submission.decisionDate || "-"} />
              <InfoStat label="返修截止" value={submission.revisionDueDate || "-"} />
            </div>
            <p className="mt-3 text-sm text-gray-600">{submission.resultNote || "暂无备注"}</p>
          </DetailSection>
        )}
        {activeTab === "history" && (
          <>
            <DetailSection
              title="新增状态变化"
              action={
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    onAddHistory({
                      id: createId("submission-history"),
                      submissionId: submission.id,
                      status: historyDraft.status,
                      changedAt: historyDraft.changedAt,
                      note: historyDraft.note.trim() || "状态更新",
                    });
                    setHistoryDraft({ status: submission.status, changedAt: todayISO(), note: "" });
                  }}
                >
                  添加历史
                </Button>
              }
            >
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Select value={historyDraft.status} onValueChange={(value) => value && setHistoryDraft((prev) => ({ ...prev, status: value as SubmissionStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{submissionStatusOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                </Select>
                <Input type="date" value={historyDraft.changedAt} onChange={(event) => setHistoryDraft((prev) => ({ ...prev, changedAt: event.target.value }))} />
                <Textarea value={historyDraft.note} onChange={(event) => setHistoryDraft((prev) => ({ ...prev, note: event.target.value }))} placeholder="状态变化说明" className="md:col-span-2" />
              </div>
            </DetailSection>
            <TimelineList items={history.map((item) => ({
              id: item.id,
              entityType: "submission_status",
              entityId: item.submissionId,
              date: item.changedAt,
              title: statusLabel(item.status),
              description: item.note,
              ...emptyLinkState(),
            }))} />
          </>
        )}
        {activeTab === "comments" && (
          <>
            <DetailSection
              title="新增审稿意见"
              action={
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (!commentDraft.comment.trim()) return;
                    onAddComment({
                      id: createId("review-comment"),
                      submissionId: submission.id,
                      reviewer: commentDraft.reviewer.trim() || "匿名审稿人",
                      comment: commentDraft.comment.trim(),
                      response: commentDraft.response.trim(),
                      status: commentDraft.status,
                      paperSectionId: commentDraft.paperSectionId || null,
                      ...emptyLinkState(),
                    });
                    setCommentDraft({ reviewer: "", comment: "", response: "", status: "open", paperSectionId: "" });
                  }}
                >
                  添加意见
                </Button>
              }
            >
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Input value={commentDraft.reviewer} onChange={(event) => setCommentDraft((prev) => ({ ...prev, reviewer: event.target.value }))} placeholder="reviewer" />
                <Select value={commentDraft.status} onValueChange={(value) => value && setCommentDraft((prev) => ({ ...prev, status: value as FeedbackStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{feedbackStatusOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={commentDraft.paperSectionId || "none"} onValueChange={(value) => setCommentDraft((prev) => ({ ...prev, paperSectionId: !value || value === "none" ? "" : value }))}>
                  <SelectTrigger><SelectValue placeholder="关联章节" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不关联章节</SelectItem>
                    {sections.map((section) => <SelectItem key={section.id} value={section.id}>{section.title}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Textarea value={commentDraft.comment} onChange={(event) => setCommentDraft((prev) => ({ ...prev, comment: event.target.value }))} placeholder="comment" className="md:col-span-2" />
                <Textarea value={commentDraft.response} onChange={(event) => setCommentDraft((prev) => ({ ...prev, response: event.target.value }))} placeholder="response" className="md:col-span-2" />
              </div>
            </DetailSection>
            <DetailSection title="审稿意见列表">
              <div className="space-y-3">
                {comments.length === 0 ? (
                  <p className="text-sm text-gray-500">暂无审稿意见。</p>
                ) : (
                  comments.map((item) => (
                    <div key={item.id} className="rounded-lg border border-gray-200 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900">{item.reviewer}</p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onCreateTask(`${submission.venueName} 审稿意见处理`, submission.revisionDueDate, `${item.comment}\n回复：${item.response}`, item.id)}
                        >
                          转任务
                        </Button>
                      </div>
                      <p className="mt-2 text-sm text-gray-600">{item.comment}</p>
                      {item.response ? <p className="mt-2 text-sm text-gray-500">回复：{item.response}</p> : null}
                    </div>
                  ))
                )}
              </div>
            </DetailSection>
          </>
        )}
        {activeTab === "revision" && (
          <DetailSection title="返修计划">
            <div className="space-y-3">
              <Select value={submission.responseLetterStatus} onValueChange={(value) => value && onUpdateSubmission({ responseLetterStatus: value as FeedbackStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{feedbackStatusOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
              </Select>
              <Textarea value={submission.revisionPlan} onChange={(event) => onUpdateSubmission({ revisionPlan: event.target.value })} placeholder="返修计划" />
            </div>
          </DetailSection>
        )}
        {activeTab === "checklist" && (
          <>
            <DetailSection
              title="投稿材料 checklist"
              action={
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (!checklistDraft.trim()) return;
                    onUpdateSubmission({
                      materialsChecklist: [
                        ...submission.materialsChecklist,
                        ...checklistDraft
                          .split("\n")
                          .map((line) => line.trim())
                          .filter(Boolean)
                          .map((label) => ({ id: createId("check"), label, done: false })),
                      ],
                    });
                    setChecklistDraft("");
                  }}
                >
                  添加清单
                </Button>
              }
            >
              <Textarea value={checklistDraft} onChange={(event) => setChecklistDraft(event.target.value)} placeholder="每行一条材料" />
            </DetailSection>
            <DetailSection title="清单内容">
              <div className="space-y-2">
                {submission.materialsChecklist.length === 0 ? (
                  <p className="text-sm text-gray-500">暂无清单项。</p>
                ) : (
                  submission.materialsChecklist.map((item) => (
                    <label key={item.id} className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() =>
                          onUpdateSubmission({
                            materialsChecklist: submission.materialsChecklist.map((check) =>
                              check.id === item.id ? { ...check, done: !check.done } : check,
                            ),
                          })
                        }
                      />
                      <span>{item.label}</span>
                    </label>
                  ))
                )}
              </div>
            </DetailSection>
          </>
        )}
        {activeTab === "timeline" && <TimelineList items={timeline} />}
      </div>
    </div>
  );
}

function MeetingDetails({
  meeting,
  projects,
  papers,
  submissions,
  actionItems,
  timeline,
  activeTab,
  onTabChange,
  onAddAction,
  onUpdateAction,
  onCreateTask,
  onCreateEvent,
}: {
  meeting: GroupMeetingRecord;
  projects: ResearchProject[];
  papers: ResearchPaper[];
  submissions: SubmissionRecord[];
  actionItems: MeetingActionItem[];
  timeline: TimelineEntry[];
  activeTab: string;
  onTabChange: (value: string) => void;
  onAddAction: (item: MeetingActionItem) => void;
  onUpdateAction: (itemId: string, patch: Partial<MeetingActionItem>) => void;
  onCreateTask: (title: string, dueDate?: string, notes?: string, actionId?: string) => void;
  onCreateEvent: (title: string, date: string, notes?: string, actionId?: string) => void;
}) {
  const [actionDraft, setActionDraft] = useState({
    content: "",
    owner: "",
    dueDate: meeting.nextMeetingDate || meeting.date,
    priority: "medium" as WorkflowPriority,
    status: "todo" as ActionItemStatus,
    projectId: projects[0]?.id ?? "",
    paperId: papers[0]?.id ?? "",
    submissionId: submissions[0]?.id ?? "",
  });

  return (
    <div className="h-full">
      <header className="border-b border-gray-200 px-5 py-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">{meeting.title}</h2>
          <Badge variant="secondary">{meetingTypeOptions.find((item) => item.value === meeting.meetingType)?.label}</Badge>
        </div>
        <p className="mt-2 text-sm text-gray-600">{meeting.summary || "暂无摘要"}</p>
      </header>
      <DetailTabs
        tabs={[
          { id: "basic", label: "基本信息" },
          { id: "summary", label: "会议摘要" },
          { id: "discussion", label: "讨论内容" },
          { id: "decisions", label: "决定事项" },
          { id: "actions", label: "行动项" },
          { id: "links", label: "关联对象" },
          { id: "timeline", label: "时间线" },
        ]}
        value={activeTab}
        onChange={onTabChange}
      />
      <div className="space-y-4 p-5">
        {activeTab === "basic" && (
          <DetailSection title="会议信息">
            <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
              <InfoStat label="日期" value={meeting.date} />
              <InfoStat label="下次会议" value={meeting.nextMeetingDate || "-"} />
              <InfoStat label="参会人" value={meeting.attendees || "-"} />
              <InfoStat label="关联行动项" value={String(actionItems.length)} />
            </div>
          </DetailSection>
        )}
        {activeTab === "summary" && (
          <DetailSection title="摘要与导师反馈">
            <div className="space-y-3 text-sm text-gray-600">
              <p><span className="font-medium text-gray-900">会议摘要：</span>{meeting.summary || "-"}</p>
              <p><span className="font-medium text-gray-900">导师反馈：</span>{meeting.mentorFeedback || "-"}</p>
              <p><span className="font-medium text-gray-900">后续追踪：</span>{meeting.followUp || "-"}</p>
            </div>
          </DetailSection>
        )}
        {activeTab === "discussion" && (
          <DetailSection title="讨论内容">
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{meeting.discussionNotes || "-"}</p>
          </DetailSection>
        )}
        {activeTab === "decisions" && (
          <DetailSection title="决定事项">
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{meeting.decisions || "-"}</p>
          </DetailSection>
        )}
        {activeTab === "actions" && (
          <>
            <DetailSection
              title="新增行动项"
              action={
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (!actionDraft.content.trim()) return;
                    onAddAction({
                      id: createId("meeting-action"),
                      meetingId: meeting.id,
                      content: actionDraft.content.trim(),
                      owner: actionDraft.owner.trim(),
                      dueDate: actionDraft.dueDate,
                      priority: actionDraft.priority,
                      status: actionDraft.status,
                      projectId: actionDraft.projectId || null,
                      paperId: actionDraft.paperId || null,
                      submissionId: actionDraft.submissionId || null,
                      ...emptyLinkState(),
                    });
                    setActionDraft({
                      content: "",
                      owner: "",
                      dueDate: meeting.nextMeetingDate || meeting.date,
                      priority: "medium",
                      status: "todo",
                      projectId: projects[0]?.id ?? "",
                      paperId: papers[0]?.id ?? "",
                      submissionId: submissions[0]?.id ?? "",
                    });
                  }}
                >
                  添加行动项
                </Button>
              }
            >
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Input value={actionDraft.content} onChange={(event) => setActionDraft((prev) => ({ ...prev, content: event.target.value }))} placeholder="行动项内容" />
                <Input value={actionDraft.owner} onChange={(event) => setActionDraft((prev) => ({ ...prev, owner: event.target.value }))} placeholder="负责人" />
                <Input type="date" value={actionDraft.dueDate} onChange={(event) => setActionDraft((prev) => ({ ...prev, dueDate: event.target.value }))} />
                <Select value={actionDraft.priority} onValueChange={(value) => value && setActionDraft((prev) => ({ ...prev, priority: value as WorkflowPriority }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{priorityOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={actionDraft.status} onValueChange={(value) => value && setActionDraft((prev) => ({ ...prev, status: value as ActionItemStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{actionItemStatusOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={actionDraft.projectId || "none"} onValueChange={(value) => setActionDraft((prev) => ({ ...prev, projectId: !value || value === "none" ? "" : value }))}>
                  <SelectTrigger><SelectValue placeholder="关联项目" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不关联项目</SelectItem>
                    {projects.map((item) => <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={actionDraft.paperId || "none"} onValueChange={(value) => setActionDraft((prev) => ({ ...prev, paperId: !value || value === "none" ? "" : value }))}>
                  <SelectTrigger><SelectValue placeholder="关联论文" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不关联论文</SelectItem>
                    {papers.map((item) => <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={actionDraft.submissionId || "none"} onValueChange={(value) => setActionDraft((prev) => ({ ...prev, submissionId: !value || value === "none" ? "" : value }))}>
                  <SelectTrigger><SelectValue placeholder="关联投稿" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不关联投稿</SelectItem>
                    {submissions.map((item) => <SelectItem key={item.id} value={item.id}>{item.venueName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </DetailSection>
            <DetailSection title="行动项列表">
              <div className="space-y-3">
                {actionItems.length === 0 ? (
                  <p className="text-sm text-gray-500">暂无行动项。</p>
                ) : (
                  actionItems.map((item) => (
                    <div key={item.id} className="rounded-lg border border-gray-200 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{item.content}</p>
                          <p className="mt-1 text-xs text-gray-500">负责人 {item.owner || "-"} · 截止 {item.dueDate || "-"}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{priorityLabel(item.priority)}</Badge>
                          <Badge variant="secondary">{statusLabel(item.status)}</Badge>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => onCreateTask(item.content, item.dueDate, meeting.summary, item.id)}>
                          转长期任务
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => onCreateEvent(item.content, item.dueDate || meeting.date, meeting.summary, item.id)}>
                          转日程事件
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => onUpdateAction(item.id, { status: item.status === "done" ? "todo" : "done" })}>
                          {item.status === "done" ? "标记未完成" : "标记完成"}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </DetailSection>
          </>
        )}
        {activeTab === "links" && (
          <>
            <DetailSection title="关联项目">
              <LinkedItemList labels={projects.map((item) => item.title)} />
            </DetailSection>
            <DetailSection title="关联论文">
              <LinkedItemList labels={papers.map((item) => item.title)} />
            </DetailSection>
            <DetailSection title="关联投稿">
              <LinkedItemList labels={submissions.map((item) => item.venueName)} />
            </DetailSection>
          </>
        )}
        {activeTab === "timeline" && <TimelineList items={timeline} />}
      </div>
    </div>
  );
}

function InfoStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-gray-900">{value}</p>
    </div>
  );
}

function ProjectDialog({
  open,
  draft,
  onOpenChange,
  onChange,
  onSave,
}: {
  open: boolean;
  draft: ProjectDraft;
  onOpenChange: (value: boolean) => void;
  onChange: (value: ProjectDraft) => void;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>科研项目</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <LabeledInput label="标题" value={draft.title} onChange={(value) => onChange({ ...draft, title: value })} />
          <LabeledSelect label="状态" value={draft.status} options={researchProjectStatusOptions} onChange={(value) => onChange({ ...draft, status: value as ResearchProjectStatus })} />
          <LabeledSelect label="优先级" value={draft.priority} options={priorityOptions} onChange={(value) => onChange({ ...draft, priority: value as WorkflowPriority })} />
          <LabeledInput label="进度" type="number" value={String(draft.progress)} onChange={(value) => onChange({ ...draft, progress: Number(value) })} />
          <LabeledInput label="开始日期" type="date" value={draft.startDate} onChange={(value) => onChange({ ...draft, startDate: value })} />
          <LabeledInput label="目标结束日期" type="date" value={draft.targetEndDate} onChange={(value) => onChange({ ...draft, targetEndDate: value })} />
          <LabeledTextarea className="md:col-span-2" label="简介" value={draft.summary} onChange={(value) => onChange({ ...draft, summary: value })} />
          <LabeledTextarea label="研究问题" value={draft.researchQuestion} onChange={(value) => onChange({ ...draft, researchQuestion: value })} />
          <LabeledTextarea label="研究假设" value={draft.hypothesis} onChange={(value) => onChange({ ...draft, hypothesis: value })} />
          <LabeledTextarea label="方法" value={draft.method} onChange={(value) => onChange({ ...draft, method: value })} />
          <LabeledTextarea label="数据来源" value={draft.dataSources} onChange={(value) => onChange({ ...draft, dataSources: value })} />
          <LabeledTextarea label="当前问题" value={draft.currentIssues} onChange={(value) => onChange({ ...draft, currentIssues: value })} />
          <LabeledTextarea label="下一步行动" value={draft.nextActions} onChange={(value) => onChange({ ...draft, nextActions: value })} />
          <LabeledInput className="md:col-span-2" label="预留任务 ID（逗号分隔）" value={draft.plannedTaskIdsText} onChange={(value) => onChange({ ...draft, plannedTaskIdsText: value })} />
        </div>
        <Button type="button" onClick={onSave}>保存项目</Button>
      </DialogContent>
    </Dialog>
  );
}

function PaperDialog({
  open,
  draft,
  onOpenChange,
  onChange,
  onSave,
  projects,
}: {
  open: boolean;
  draft: PaperDraft;
  onOpenChange: (value: boolean) => void;
  onChange: (value: PaperDraft) => void;
  onSave: () => void;
  projects: ResearchProject[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>论文</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <LabeledInput className="md:col-span-2" label="标题" value={draft.title} onChange={(value) => onChange({ ...draft, title: value })} />
          <LabeledTextarea className="md:col-span-2" label="摘要" value={draft.abstract} onChange={(value) => onChange({ ...draft, abstract: value })} />
          <LabeledInput className="md:col-span-2" label="关键词（逗号分隔）" value={draft.keywordText} onChange={(value) => onChange({ ...draft, keywordText: value })} />
          <LabeledSelect label="状态" value={draft.status} options={researchPaperStatusOptions} onChange={(value) => onChange({ ...draft, status: value as ResearchPaperStatus })} />
          <LabeledInput label="目标期刊/会议" value={draft.targetVenue} onChange={(value) => onChange({ ...draft, targetVenue: value })} />
          <LabeledInput label="章节数" type="number" value={String(draft.chapterCount)} onChange={(value) => onChange({ ...draft, chapterCount: Number(value) })} />
          <LabeledInput label="完成章节" type="number" value={String(draft.completedChapters)} onChange={(value) => onChange({ ...draft, completedChapters: Number(value) })} />
          <LabeledInput label="整体进度" type="number" value={String(draft.overallProgress)} onChange={(value) => onChange({ ...draft, overallProgress: Number(value) })} />
          <LabeledTextarea label="当前问题" value={draft.currentIssues} onChange={(value) => onChange({ ...draft, currentIssues: value })} />
          <LabeledTextarea label="下一步行动" value={draft.nextActions} onChange={(value) => onChange({ ...draft, nextActions: value })} />
          <LabeledTextarea className="md:col-span-2" label="写作计划" value={draft.writingPlan} onChange={(value) => onChange({ ...draft, writingPlan: value })} />
          <div className="space-y-2 md:col-span-2">
            <Label>关联项目</Label>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {projects.map((project) => (
                <label key={project.id} className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.projectIds.includes(project.id)}
                    onChange={() =>
                      onChange({
                        ...draft,
                        projectIds: draft.projectIds.includes(project.id)
                          ? draft.projectIds.filter((id) => id !== project.id)
                          : [...draft.projectIds, project.id],
                      })
                    }
                  />
                  <span>{project.title}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <Button type="button" onClick={onSave}>保存论文</Button>
      </DialogContent>
    </Dialog>
  );
}

function SubmissionDialog({
  open,
  draft,
  onOpenChange,
  onChange,
  onSave,
  papers,
}: {
  open: boolean;
  draft: SubmissionDraft;
  onOpenChange: (value: boolean) => void;
  onChange: (value: SubmissionDraft) => void;
  onSave: () => void;
  papers: ResearchPaper[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>投稿记录</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>关联论文</Label>
            <Select value={draft.paperId} onValueChange={(value) => value && onChange({ ...draft, paperId: value })}>
              <SelectTrigger><SelectValue placeholder="选择论文" /></SelectTrigger>
              <SelectContent>{papers.map((paper) => <SelectItem key={paper.id} value={paper.id}>{paper.title}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <LabeledInput label="期刊/会议名称" value={draft.venueName} onChange={(value) => onChange({ ...draft, venueName: value })} />
          <LabeledSelect label="类型" value={draft.venueType} options={submissionTypeOptions} onChange={(value) => onChange({ ...draft, venueType: value as SubmissionType })} />
          <LabeledInput label="投稿日期" type="date" value={draft.submittedAt} onChange={(value) => onChange({ ...draft, submittedAt: value })} />
          <LabeledInput label="Manuscript ID" value={draft.manuscriptId} onChange={(value) => onChange({ ...draft, manuscriptId: value })} />
          <LabeledSelect label="当前状态" value={draft.status} options={submissionStatusOptions} onChange={(value) => onChange({ ...draft, status: value as SubmissionStatus })} />
          <LabeledInput label="决定日期" type="date" value={draft.decisionDate} onChange={(value) => onChange({ ...draft, decisionDate: value })} />
          <LabeledInput label="返修截止日期" type="date" value={draft.revisionDueDate} onChange={(value) => onChange({ ...draft, revisionDueDate: value })} />
          <LabeledSelect label="回复信状态" value={draft.responseLetterStatus} options={feedbackStatusOptions} onChange={(value) => onChange({ ...draft, responseLetterStatus: value as FeedbackStatus })} />
          <LabeledTextarea label="结果备注" value={draft.resultNote} onChange={(value) => onChange({ ...draft, resultNote: value })} />
          <LabeledTextarea label="返修计划" value={draft.revisionPlan} onChange={(value) => onChange({ ...draft, revisionPlan: value })} />
          <LabeledTextarea className="md:col-span-2" label="材料清单（每行一项）" value={draft.checklistText} onChange={(value) => onChange({ ...draft, checklistText: value })} />
        </div>
        <Button type="button" onClick={onSave}>保存投稿记录</Button>
      </DialogContent>
    </Dialog>
  );
}

function MeetingDialog({
  open,
  draft,
  onOpenChange,
  onChange,
  onSave,
  projects,
  papers,
  submissions,
}: {
  open: boolean;
  draft: MeetingDraft;
  onOpenChange: (value: boolean) => void;
  onChange: (value: MeetingDraft) => void;
  onSave: () => void;
  projects: ResearchProject[];
  papers: ResearchPaper[];
  submissions: SubmissionRecord[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>组会记录</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <LabeledInput label="日期" type="date" value={draft.date} onChange={(value) => onChange({ ...draft, date: value })} />
          <LabeledInput label="标题" value={draft.title} onChange={(value) => onChange({ ...draft, title: value })} />
          <LabeledSelect label="会议类型" value={draft.meetingType} options={meetingTypeOptions} onChange={(value) => onChange({ ...draft, meetingType: value as GroupMeetingRecord["meetingType"] })} />
          <LabeledInput label="下次会议日期" type="date" value={draft.nextMeetingDate} onChange={(value) => onChange({ ...draft, nextMeetingDate: value })} />
          <LabeledInput className="md:col-span-2" label="参会人" value={draft.attendees} onChange={(value) => onChange({ ...draft, attendees: value })} />
          <LabeledTextarea className="md:col-span-2" label="摘要" value={draft.summary} onChange={(value) => onChange({ ...draft, summary: value })} />
          <LabeledTextarea label="讨论记录" value={draft.discussionNotes} onChange={(value) => onChange({ ...draft, discussionNotes: value })} />
          <LabeledTextarea label="导师反馈" value={draft.mentorFeedback} onChange={(value) => onChange({ ...draft, mentorFeedback: value })} />
          <LabeledTextarea label="决定事项" value={draft.decisions} onChange={(value) => onChange({ ...draft, decisions: value })} />
          <LabeledTextarea label="后续追踪" value={draft.followUp} onChange={(value) => onChange({ ...draft, followUp: value })} />
          <RelationPicker title="关联项目" items={projects.map((item) => ({ id: item.id, label: item.title }))} values={draft.projectIds} onChange={(values) => onChange({ ...draft, projectIds: values })} />
          <RelationPicker title="关联论文" items={papers.map((item) => ({ id: item.id, label: item.title }))} values={draft.paperIds} onChange={(values) => onChange({ ...draft, paperIds: values })} />
          <RelationPicker title="关联投稿" items={submissions.map((item) => ({ id: item.id, label: item.venueName }))} values={draft.submissionIds} onChange={(values) => onChange({ ...draft, submissionIds: values })} />
        </div>
        <Button type="button" onClick={onSave}>保存组会记录</Button>
      </DialogContent>
    </Dialog>
  );
}

function RelationPicker({
  title,
  items,
  values,
  onChange,
}: {
  title: string;
  items: Array<{ id: string; label: string }>;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <div className="space-y-2 md:col-span-2">
      <Label>{title}</Label>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {items.map((item) => (
          <label key={item.id} className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={values.includes(item.id)}
              onChange={() =>
                onChange(values.includes(item.id) ? values.filter((value) => value !== item.id) : [...values, item.id])
              }
            />
            <span>{item.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  type,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function LabeledTextarea({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label>{label}</Label>
      <Textarea value={value} onChange={(event) => onChange(event.target.value)} className="min-h-24" />
    </div>
  );
}

function LabeledSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={(nextValue) => nextValue && onChange(nextValue)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
