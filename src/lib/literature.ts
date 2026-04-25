"use client";

import { format, isToday, isYesterday, parseISO, startOfDay, subDays } from "date-fns";

export type LiteratureStatus =
  | "to_read"
  | "skimming"
  | "reading"
  | "read"
  | "deep_read"
  | "cited"
  | "archived";

export type LiteratureImportance = "low" | "medium" | "high" | "core";

export type LiteratureExcerptType =
  | "quote"
  | "idea"
  | "method"
  | "data"
  | "finding"
  | "limitation"
  | "definition";

export type LiteraturePaperSection =
  | "introduction"
  | "literature_review"
  | "methodology"
  | "results"
  | "discussion"
  | "conclusion";

export type LiteratureUsageType =
  | "background"
  | "supporting_evidence"
  | "contrast"
  | "method_reference"
  | "data_reference"
  | "definition"
  | "discussion";

export type LiteratureCitationStatus = "planned" | "cited" | "not_used";

export type LiteratureRecord = {
  id: string;
  userId: string;
  title: string;
  authors: string;
  year: number | null;
  venue: string;
  doi: string;
  url: string;
  pdfUrl: string;
  abstract: string;
  keywords: string[];
  status: LiteratureStatus;
  importance: LiteratureImportance;
  summary: string;
  contributions: string;
  limitations: string;
  createdAt: string;
  updatedAt: string;
  linkedTaskIds: string[];
  linkedEventIds: string[];
  linkedMeetingIds: string[];
  linkedLogPostIds: string[];
};

export type LiteratureNote = {
  id: string;
  literatureId: string;
  userId: string;
  researchQuestion: string;
  researchBackground: string;
  dataSource: string;
  method: string;
  findings: string;
  innovations: string;
  shortcomings: string;
  inspiration: string;
  quotableContent: string;
  updatedAt: string;
};

export type LiteratureExcerpt = {
  id: string;
  literatureId: string;
  userId: string;
  content: string;
  page: string;
  note: string;
  excerptType: LiteratureExcerptType;
  paperSection: LiteraturePaperSection;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type LiteratureMethodNote = {
  id: string;
  literatureId: string;
  userId: string;
  name: string;
  description: string;
  requiredData: string;
  strengths: string;
  weaknesses: string;
  applicability: string;
  plannedToUse: boolean;
  projectId: string | null;
  paperId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LiteraturePaperUsage = {
  id: string;
  literatureId: string;
  userId: string;
  paperId: string;
  chapter: string;
  usageType: LiteratureUsageType;
  note: string;
  citationStatus: LiteratureCitationStatus;
  createdAt: string;
  updatedAt: string;
};

export type LiteratureProjectLink = {
  id: string;
  literatureId: string;
  userId: string;
  projectId: string;
  createdAt: string;
};

export type LiteratureReadingLog = {
  id: string;
  literatureId: string;
  userId: string;
  loggedAt: string;
  durationMinutes: number;
  progressText: string;
  statusAfter: LiteratureStatus;
  linkedTaskId: string | null;
  linkedEventId: string | null;
  linkedLogPostId: string | null;
  createdAt: string;
};

export type LiteratureTag = {
  id: string;
  userId: string;
  name: string;
  color: string | null;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
};

export type LiteratureTagLink = {
  literatureId: string;
  tagId: string;
  userId: string;
};

export type LiteratureReferenceOption = {
  id: string;
  title: string;
};

export type LiteratureItem = LiteratureRecord & {
  note: LiteratureNote | null;
  excerpts: LiteratureExcerpt[];
  methodNotes: LiteratureMethodNote[];
  paperUsages: LiteraturePaperUsage[];
  projectLinks: LiteratureProjectLink[];
  readingLogs: LiteratureReadingLog[];
  tags: LiteratureTag[];
};

export type LiteratureFilters = {
  query: string;
  status: LiteratureStatus | "all";
  importance: LiteratureImportance | "all";
  tagId: string | "all";
  projectId: string | "all";
  paperId: string | "all";
};

export type LiteratureFormInput = {
  title: string;
  authors: string;
  year: string;
  venue: string;
  doi: string;
  url: string;
  pdfUrl: string;
  abstract: string;
  keywords: string;
  status: LiteratureStatus;
  importance: LiteratureImportance;
  summary: string;
  contributions: string;
  limitations: string;
  tagNames: string[];
  projectIds: string[];
  paperIds: string[];
};

export type LiteratureNoteInput = {
  researchQuestion: string;
  researchBackground: string;
  dataSource: string;
  method: string;
  findings: string;
  innovations: string;
  shortcomings: string;
  inspiration: string;
  quotableContent: string;
};

export type LiteratureExcerptInput = {
  content: string;
  page: string;
  note: string;
  excerptType: LiteratureExcerptType;
  paperSection: LiteraturePaperSection;
  tags: string[];
};

export type LiteratureStats = {
  total: number;
  active: number;
  cited: number;
  core: number;
  statusCounts: Array<{ status: LiteratureStatus; count: number }>;
  topTags: Array<{ id: string; name: string; count: number }>;
  recentReadingDays: number;
};

export const literatureStatusOptions: Array<{ value: LiteratureStatus; label: string }> = [
  { value: "to_read", label: "待读" },
  { value: "skimming", label: "略读" },
  { value: "reading", label: "阅读中" },
  { value: "read", label: "已读" },
  { value: "deep_read", label: "精读" },
  { value: "cited", label: "已引用" },
  { value: "archived", label: "归档" },
];

export const literatureImportanceOptions: Array<{ value: LiteratureImportance; label: string }> = [
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" },
  { value: "core", label: "核心文献" },
];

export const literatureExcerptTypeOptions: Array<{ value: LiteratureExcerptType; label: string }> = [
  { value: "quote", label: "原文摘录" },
  { value: "idea", label: "观点" },
  { value: "method", label: "方法" },
  { value: "data", label: "数据" },
  { value: "finding", label: "结论" },
  { value: "limitation", label: "局限性" },
  { value: "definition", label: "定义" },
];

export const literaturePaperSectionOptions: Array<{ value: LiteraturePaperSection; label: string }> = [
  { value: "introduction", label: "引言" },
  { value: "literature_review", label: "文献综述" },
  { value: "methodology", label: "方法" },
  { value: "results", label: "结果" },
  { value: "discussion", label: "讨论" },
  { value: "conclusion", label: "结论" },
];

export const literatureUsageTypeOptions: Array<{ value: LiteratureUsageType; label: string }> = [
  { value: "background", label: "背景铺垫" },
  { value: "supporting_evidence", label: "支持证据" },
  { value: "contrast", label: "对比参考" },
  { value: "method_reference", label: "方法参考" },
  { value: "data_reference", label: "数据参考" },
  { value: "definition", label: "定义引用" },
  { value: "discussion", label: "讨论引用" },
];

export const literatureCitationStatusOptions: Array<{ value: LiteratureCitationStatus; label: string }> = [
  { value: "planned", label: "计划引用" },
  { value: "cited", label: "已引用" },
  { value: "not_used", label: "暂未使用" },
];

export const defaultLiteratureFilters: LiteratureFilters = {
  query: "",
  status: "all",
  importance: "all",
  tagId: "all",
  projectId: "all",
  paperId: "all",
};

export function createEmptyLiteratureNoteInput(): LiteratureNoteInput {
  return {
    researchQuestion: "",
    researchBackground: "",
    dataSource: "",
    method: "",
    findings: "",
    innovations: "",
    shortcomings: "",
    inspiration: "",
    quotableContent: "",
  };
}

export function statusLabel(value: LiteratureStatus) {
  return literatureStatusOptions.find((item) => item.value === value)?.label ?? value;
}

export function importanceLabel(value: LiteratureImportance) {
  return literatureImportanceOptions.find((item) => item.value === value)?.label ?? value;
}

export function excerptTypeLabel(value: LiteratureExcerptType) {
  return literatureExcerptTypeOptions.find((item) => item.value === value)?.label ?? value;
}

export function paperSectionLabel(value: LiteraturePaperSection) {
  return literaturePaperSectionOptions.find((item) => item.value === value)?.label ?? value;
}

export function usageTypeLabel(value: LiteratureUsageType) {
  return literatureUsageTypeOptions.find((item) => item.value === value)?.label ?? value;
}

export function citationStatusLabel(value: LiteratureCitationStatus) {
  return literatureCitationStatusOptions.find((item) => item.value === value)?.label ?? value;
}

export function parseKeywordInput(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseTagInput(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function filterLiteratures(items: LiteratureItem[], filters: LiteratureFilters) {
  return items.filter((item) => {
    if (filters.status !== "all" && item.status !== filters.status) return false;
    if (filters.importance !== "all" && item.importance !== filters.importance) return false;
    if (filters.tagId !== "all" && !item.tags.some((tag) => tag.id === filters.tagId)) return false;
    if (filters.projectId !== "all" && !item.projectLinks.some((link) => link.projectId === filters.projectId)) {
      return false;
    }
    if (filters.paperId !== "all" && !item.paperUsages.some((usage) => usage.paperId === filters.paperId)) {
      return false;
    }
    if (!filters.query.trim()) return true;
    const query = filters.query.trim().toLowerCase();
    const haystack = [
      item.title,
      item.authors,
      item.venue,
      item.doi,
      item.abstract,
      item.summary,
      item.contributions,
      item.limitations,
      ...item.keywords,
      ...item.tags.map((tag) => tag.name),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
}

export function sortLiteratures(items: LiteratureItem[]) {
  return [...items].sort((a, b) => {
    const importanceRank: Record<LiteratureImportance, number> = {
      core: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    if (importanceRank[a.importance] !== importanceRank[b.importance]) {
      return importanceRank[a.importance] - importanceRank[b.importance];
    }
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

export function groupReadingLogs(items: LiteratureReadingLog[]) {
  const groups = new Map<string, LiteratureReadingLog[]>();
  items.forEach((item) => {
    const date = parseISO(item.loggedAt);
    const key = isToday(date)
      ? "今天"
      : isYesterday(date)
        ? "昨天"
        : format(date, "yyyy年M月d日");
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  });
  return Array.from(groups.entries()).map(([label, logs]) => ({ label, logs }));
}

export function buildLiteratureStats(items: LiteratureItem[], tags: LiteratureTag[]): LiteratureStats {
  const total = items.length;
  const active = items.filter((item) => item.status === "reading" || item.status === "skimming").length;
  const cited = items.filter((item) => item.status === "cited").length;
  const core = items.filter((item) => item.importance === "core").length;

  const statusCounts = literatureStatusOptions.map((option) => ({
    status: option.value,
    count: items.filter((item) => item.status === option.value).length,
  }));

  const topTags = [...tags]
    .sort((a, b) => b.usageCount - a.usageCount || a.name.localeCompare(b.name))
    .slice(0, 5)
    .map((tag) => ({ id: tag.id, name: tag.name, count: tag.usageCount }));

  const loggedDays = new Set(
    items.flatMap((item) => item.readingLogs.map((log) => log.loggedAt.slice(0, 10))),
  );
  let recentReadingDays = 0;
  let cursor = startOfDay(new Date());
  while (loggedDays.has(format(cursor, "yyyy-MM-dd"))) {
    recentReadingDays += 1;
    cursor = subDays(cursor, 1);
  }

  return {
    total,
    active,
    cited,
    core,
    statusCounts,
    topTags,
    recentReadingDays,
  };
}
