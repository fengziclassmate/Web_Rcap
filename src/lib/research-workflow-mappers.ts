import type {
  GroupMeetingRecord as WorkflowGroupMeetingRecord,
  MeetingActionItem,
  MeetingAttachment,
  PaperFeedback,
  PaperProjectLink,
  PaperSection,
  ProjectAttachment,
  ProjectLog,
  ResearchPaper,
  ResearchProject as WorkflowResearchProject,
  ReviewComment,
  SubmissionRecord as WorkflowSubmissionRecord,
  SubmissionStatusHistoryEntry,
  TimelineEntry,
} from "@/lib/research-workflow";

export function fromProjectRow(row: Record<string, unknown>): WorkflowResearchProject {
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

export function toProjectRow(item: WorkflowResearchProject) {
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

export function fromProjectLogRow(row: Record<string, unknown>): ProjectLog {
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

export function toProjectLogRow(item: ProjectLog) {
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

export function fromProjectAttachmentRow(row: Record<string, unknown>): ProjectAttachment {
  return {
    id: String(row.id ?? ""),
    projectId: String(row.project_id ?? ""),
    fileName: String(row.file_name ?? ""),
    fileType: String(row.file_type ?? ""),
    fileSize: Number(row.file_size ?? 0),
    storagePath: String(row.storage_path ?? ""),
    fileUrl: String(row.file_url ?? ""),
    createdAt: String(row.created_at ?? ""),
  };
}

export function toProjectAttachmentRow(item: ProjectAttachment) {
  return {
    id: item.id,
    project_id: item.projectId,
    file_name: item.fileName,
    file_type: item.fileType,
    file_size: item.fileSize,
    storage_path: item.storagePath,
    file_url: item.fileUrl,
    created_at: item.createdAt,
  };
}

export function fromPaperRow(row: Record<string, unknown>): ResearchPaper {
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

export function toPaperRow(item: ResearchPaper) {
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

export function fromPaperProjectLinkRow(row: Record<string, unknown>): PaperProjectLink {
  return {
    id: String(row.id ?? ""),
    paperId: String(row.paper_id ?? ""),
    projectId: String(row.project_id ?? ""),
  };
}

export function toPaperProjectLinkRow(item: PaperProjectLink) {
  return { id: item.id, paper_id: item.paperId, project_id: item.projectId };
}

export function fromPaperSectionRow(row: Record<string, unknown>): PaperSection {
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

export function toPaperSectionRow(item: PaperSection) {
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

export function fromPaperFeedbackRow(row: Record<string, unknown>): PaperFeedback {
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

export function toPaperFeedbackRow(item: PaperFeedback) {
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

export function fromSubmissionRow(row: Record<string, unknown>): WorkflowSubmissionRecord {
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

export function toSubmissionRow(item: WorkflowSubmissionRecord) {
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

export function fromSubmissionHistoryRow(
  row: Record<string, unknown>,
): SubmissionStatusHistoryEntry {
  return {
    id: String(row.id ?? ""),
    submissionId: String(row.submission_id ?? ""),
    status: (row.status as SubmissionStatusHistoryEntry["status"]) ?? "submitted",
    changedAt: typeof row.changed_at === "string" ? row.changed_at : "",
    note: String(row.note ?? ""),
  };
}

export function toSubmissionHistoryRow(item: SubmissionStatusHistoryEntry) {
  return {
    id: item.id,
    submission_id: item.submissionId,
    status: item.status,
    changed_at: item.changedAt,
    note: item.note,
  };
}

export function fromReviewCommentRow(row: Record<string, unknown>): ReviewComment {
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

export function toReviewCommentRow(item: ReviewComment) {
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

export function fromMeetingRow(row: Record<string, unknown>): WorkflowGroupMeetingRecord {
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

export function toMeetingRow(item: WorkflowGroupMeetingRecord) {
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

export function fromMeetingAttachmentRow(row: Record<string, unknown>): MeetingAttachment {
  return {
    id: String(row.id ?? ""),
    meetingId: String(row.meeting_id ?? ""),
    fileName: String(row.file_name ?? ""),
    fileType: String(row.file_type ?? ""),
    fileSize: Number(row.file_size ?? 0),
    storagePath: String(row.storage_path ?? ""),
    fileUrl: String(row.file_url ?? ""),
    createdAt: String(row.created_at ?? ""),
  };
}

export function toMeetingAttachmentRow(item: MeetingAttachment) {
  return {
    id: item.id,
    meeting_id: item.meetingId,
    file_name: item.fileName,
    file_type: item.fileType,
    file_size: item.fileSize,
    storage_path: item.storagePath,
    file_url: item.fileUrl,
    created_at: item.createdAt,
  };
}

export function fromMeetingActionRow(row: Record<string, unknown>): MeetingActionItem {
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

export function toMeetingActionRow(item: MeetingActionItem) {
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

export function fromTimelineRow(row: Record<string, unknown>): TimelineEntry {
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

export function toTimelineRow(item: TimelineEntry) {
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
