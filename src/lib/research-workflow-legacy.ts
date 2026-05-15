import type { GroupMeetingRecord } from "@/components/monitoring/group-meetings-panel";
import type { PaperProgress } from "@/components/monitoring/paper-progress-panel";
import type { ResearchProject } from "@/components/monitoring/research-projects-panel";
import type { SubmissionRecord } from "@/components/monitoring/submissions-panel";
import { todayISO } from "@/lib/date-utils";
import {
  defaultResearchWorkflowState,
  type GroupMeetingRecord as WorkflowGroupMeetingRecord,
  type ResearchPaper,
  type ResearchProject as WorkflowResearchProject,
  type ResearchWorkflowState,
  type SubmissionRecord as WorkflowSubmissionRecord,
  type TimelineEntry,
} from "@/lib/research-workflow";

export function buildResearchWorkflowFromLegacy(
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
            title: legacyPaper.title || "\u5386\u53f2\u8bba\u6587",
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
      description: "\u4ece\u5386\u53f2\u79d1\u7814\u9879\u76ee\u8fc1\u79fb",
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
      description: "\u4ece\u5386\u53f2\u8bba\u6587\u8fdb\u5ea6\u8fc1\u79fb",
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
