import type {
  LiteratureAttachment,
  LiteratureExcerpt,
  LiteratureItem,
  LiteratureMethodNote,
  LiteratureNote,
  LiteraturePaperUsage,
  LiteratureProjectLink,
  LiteratureReadingLog,
  LiteratureRecord,
  LiteratureTag,
  LiteratureTagLink,
} from "@/lib/literature";

export function fromLiteratureRow(row: Record<string, unknown>): LiteratureRecord {
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
    linkedMeetingIds: Array.isArray(row.linked_meeting_ids)
      ? (row.linked_meeting_ids as string[])
      : [],
    linkedLogPostIds: Array.isArray(row.linked_log_post_ids)
      ? (row.linked_log_post_ids as string[])
      : [],
  };
}

export function fromLiteratureNoteRow(row: Record<string, unknown>): LiteratureNote {
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

export function fromLiteratureExcerptRow(row: Record<string, unknown>): LiteratureExcerpt {
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

export function fromLiteratureMethodNoteRow(
  row: Record<string, unknown>,
): LiteratureMethodNote {
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

export function fromLiteraturePaperUsageRow(
  row: Record<string, unknown>,
): LiteraturePaperUsage {
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

export function fromLiteratureProjectLinkRow(
  row: Record<string, unknown>,
): LiteratureProjectLink {
  return {
    id: String(row.id ?? ""),
    literatureId: String(row.literature_id ?? ""),
    userId: String(row.user_id ?? ""),
    projectId: String(row.project_id ?? ""),
    createdAt: String(row.created_at ?? ""),
  };
}

export function fromLiteratureReadingLogRow(row: Record<string, unknown>): LiteratureReadingLog {
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

export function fromLiteratureTagRow(row: Record<string, unknown>): LiteratureTag {
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

export function fromLiteratureAttachmentRow(row: Record<string, unknown>): LiteratureAttachment {
  return {
    id: String(row.id ?? ""),
    literatureId: String(row.literature_id ?? ""),
    userId: String(row.user_id ?? ""),
    fileName: String(row.file_name ?? ""),
    fileType: String(row.file_type ?? ""),
    fileSize: Number(row.file_size ?? 0),
    storagePath: String(row.storage_path ?? ""),
    fileUrl: String(row.file_url ?? ""),
    createdAt: String(row.created_at ?? ""),
  };
}

export function composeLiteratureItems(
  records: LiteratureRecord[],
  notes: LiteratureNote[],
  excerpts: LiteratureExcerpt[],
  methodNotes: LiteratureMethodNote[],
  paperUsages: LiteraturePaperUsage[],
  projectLinks: LiteratureProjectLink[],
  readingLogs: LiteratureReadingLog[],
  attachments: LiteratureAttachment[],
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
    attachments: attachments
      .filter((item) => item.literatureId === record.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    tags: tagLinks
      .filter((item) => item.literatureId === record.id)
      .map((item) => tags.find((tag) => tag.id === item.tagId))
      .filter((item): item is LiteratureTag => Boolean(item)),
  }));
}
