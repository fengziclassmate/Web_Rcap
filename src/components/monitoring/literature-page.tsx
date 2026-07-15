"use client";

import { type ClipboardEvent, type Dispatch, type ReactNode, type SetStateAction, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Filter,
  Gauge,
  Image as ImageIcon,
  LibraryBig,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ContextBadge } from "@/components/llm/context-badge";
import { LiteratureAssistantPanel } from "@/components/llm/literature-assistant-panel";
import { cn } from "@/lib/utils";
import {
  buildLiteratureStats,
  citationStatusLabel,
  createEmptyLiteratureNoteInput,
  defaultLiteratureFilters,
  excerptTypeLabel,
  filterLiteratures,
  groupReadingLogs,
  importanceLabel,
  literatureExcerptTypeOptions,
  literatureCitationStatusOptions,
  literatureImportanceOptions,
  literaturePaperSectionOptions,
  literatureStatusOptions,
  literatureUsageTypeOptions,
  paperSectionLabel,
  parseKeywordInput,
  parseTagInput,
  sortLiteratures,
  statusLabel,
  usageTypeLabel,
  type LiteratureExcerpt,
  type LiteratureExcerptInput,
  type LiteratureFilters,
  type LiteratureFormInput,
  type LiteratureAttachment,
  type LiteratureItem,
  type LiteratureMethodNote,
  type LiteratureMethodNoteInput,
  type LiteratureNoteInput,
  type LiteraturePaperUsage,
  type LiteraturePaperUsageInput,
  type LiteratureReadingLog,
  type LiteratureReadingLogInput,
  type LiteratureReferenceOption,
  type LiteratureTag,
} from "@/lib/literature";

type LiteraturePageProps = {
  items: LiteratureItem[];
  tags: LiteratureTag[];
  projects: LiteratureReferenceOption[];
  papers: LiteratureReferenceOption[];
  onCreateLiterature: (input: LiteratureFormInput) => Promise<void>;
  onUpdateLiterature: (id: string, input: LiteratureFormInput) => Promise<void>;
  onDeleteLiterature: (id: string) => Promise<void>;
  onSaveNote: (literatureId: string, input: LiteratureNoteInput) => Promise<void>;
  onCreateExcerpt: (literatureId: string, input: LiteratureExcerptInput) => Promise<void>;
  onUpdateExcerpt: (excerptId: string, input: LiteratureExcerptInput) => Promise<void>;
  onDeleteExcerpt: (excerptId: string) => Promise<void>;
  onCreateMethodNote: (literatureId: string, input: LiteratureMethodNoteInput) => Promise<void>;
  onUpdateMethodNote: (methodId: string, input: LiteratureMethodNoteInput) => Promise<void>;
  onDeleteMethodNote: (methodId: string) => Promise<void>;
  onCreatePaperUsage: (literatureId: string, input: LiteraturePaperUsageInput) => Promise<void>;
  onUpdatePaperUsage: (usageId: string, input: LiteraturePaperUsageInput) => Promise<void>;
  onDeletePaperUsage: (usageId: string) => Promise<void>;
  onCreateReadingLog: (literatureId: string, input: LiteratureReadingLogInput) => Promise<void>;
  onUpdateReadingLog: (logId: string, input: LiteratureReadingLogInput) => Promise<void>;
  onDeleteReadingLog: (logId: string) => Promise<void>;
  onUploadAttachments: (literatureId: string, files: File[]) => Promise<void>;
  onDeleteAttachment: (attachmentId: string) => Promise<void>;
};

type LiteratureView = "list" | "board";
type DetailTab = "overview" | "notes" | "excerpts" | "attachments" | "methods" | "usage" | "links" | "logs";

const detailTabs: Array<{ value: DetailTab; label: string }> = [
  { value: "overview", label: "概览" },
  { value: "notes", label: "阅读笔记" },
  { value: "excerpts", label: "摘录观点" },
  { value: "attachments", label: "附件记录" },
  { value: "methods", label: "方法借鉴" },
  { value: "usage", label: "论文使用" },
  { value: "links", label: "关联对象" },
  { value: "logs", label: "阅读记录" },
];

function literatureFormFromItem(item?: LiteratureItem): LiteratureFormInput {
  return item
    ? {
        title: item.title,
        authors: item.authors,
        year: item.year ? String(item.year) : "",
        venue: item.venue,
        doi: item.doi,
        url: item.url,
        pdfUrl: item.pdfUrl,
        abstract: item.abstract,
        keywords: item.keywords.join(", "),
        status: item.status,
        importance: item.importance,
        summary: item.summary,
        contributions: item.contributions,
        limitations: item.limitations,
        tagNames: item.tags.map((tag) => tag.name),
        projectIds: item.projectLinks.map((link) => link.projectId),
        paperIds: Array.from(new Set(item.paperUsages.map((usage) => usage.paperId))),
      }
    : {
        title: "",
        authors: "",
        year: "",
        venue: "",
        doi: "",
        url: "",
        pdfUrl: "",
        abstract: "",
        keywords: "",
        status: "to_read",
        importance: "medium",
        summary: "",
        contributions: "",
        limitations: "",
        tagNames: [],
        projectIds: [],
        paperIds: [],
      };
}

function normalizeLiteratureForm(draft: LiteratureFormInput, tagInput?: string): LiteratureFormInput {
  return {
    ...draft,
    title: draft.title.trim(),
    authors: draft.authors.trim(),
    year: draft.year.trim(),
    venue: draft.venue.trim(),
    doi: draft.doi.trim(),
    url: draft.url.trim(),
    pdfUrl: draft.pdfUrl.trim(),
    abstract: draft.abstract.trim(),
    keywords: parseKeywordInput(draft.keywords).join(", "),
    summary: draft.summary.trim(),
    contributions: draft.contributions.trim(),
    limitations: draft.limitations.trim(),
    tagNames: parseTagInput(tagInput ?? draft.tagNames.join(", ")),
  };
}

type LiteratureCompleteness = {
  score: number;
  done: number;
  total: number;
  missing: string[];
  strengths: string[];
};

function buildLiteratureCompleteness(item: LiteratureItem | null): LiteratureCompleteness {
  if (!item) return { score: 0, done: 0, total: 0, missing: [], strengths: [] };

  const checks: Array<{ label: string; done: boolean; strength?: string }> = [
    { label: "作者", done: Boolean(item.authors.trim()) },
    { label: "年份", done: Boolean(item.year) },
    { label: "期刊 / 会议", done: Boolean(item.venue.trim()) },
    { label: "摘要", done: Boolean(item.abstract.trim()) },
    { label: "关键词", done: item.keywords.length > 0 },
    { label: "标签", done: item.tags.length > 0, strength: `${item.tags.length} 个标签` },
    { label: "一句话总结", done: Boolean(item.summary.trim()) },
    { label: "主要贡献", done: Boolean(item.contributions.trim()) },
    { label: "局限性", done: Boolean(item.limitations.trim()) },
    { label: "结构化笔记", done: Boolean(item.note), strength: item.note ? "已写阅读笔记" : undefined },
    { label: "摘录观点", done: item.excerpts.length > 0, strength: item.excerpts.length > 0 ? `${item.excerpts.length} 条摘录` : undefined },
    { label: "方法借鉴", done: item.methodNotes.length > 0, strength: item.methodNotes.length > 0 ? `${item.methodNotes.length} 个方法` : undefined },
    { label: "论文使用", done: item.paperUsages.length > 0, strength: item.paperUsages.length > 0 ? `${item.paperUsages.length} 处使用` : undefined },
    { label: "关联项目", done: item.projectLinks.length > 0 },
    { label: "阅读记录", done: item.readingLogs.length > 0, strength: item.readingLogs.length > 0 ? `${item.readingLogs.length} 次阅读` : undefined },
    { label: "附件", done: item.attachments.length > 0 },
  ];
  const done = checks.filter((check) => check.done).length;
  return {
    score: Math.round((done / checks.length) * 100),
    done,
    total: checks.length,
    missing: checks.filter((check) => !check.done).map((check) => check.label).slice(0, 6),
    strengths: checks
      .map((check) => (check.done ? check.strength : null))
      .filter((value): value is string => Boolean(value))
      .slice(0, 4),
  };
}

export function LiteraturePage({
  items,
  tags,
  projects,
  papers,
  onCreateLiterature,
  onUpdateLiterature,
  onDeleteLiterature,
  onSaveNote,
  onCreateExcerpt,
  onUpdateExcerpt,
  onDeleteExcerpt,
  onCreateMethodNote,
  onUpdateMethodNote,
  onDeleteMethodNote,
  onCreatePaperUsage,
  onUpdatePaperUsage,
  onDeletePaperUsage,
  onCreateReadingLog,
  onUpdateReadingLog,
  onDeleteReadingLog,
  onUploadAttachments,
  onDeleteAttachment,
}: LiteraturePageProps) {
  const [view, setView] = useState<LiteratureView>("list");
  const [filters, setFilters] = useState<LiteratureFilters>(defaultLiteratureFilters);
  const [activeId, setActiveId] = useState<string | null>(items[0]?.id ?? null);
  const [creating, setCreating] = useState(false);
  const [collapsedColumns, setCollapsedColumns] = useState<Record<string, boolean>>({
    to_read: false,
    reading: false,
    deep_read: false,
    cited: false,
  });

  const visibleItems = useMemo(() => sortLiteratures(filterLiteratures(items, filters)), [items, filters]);
  const activeItem = useMemo(
    () => visibleItems.find((item) => item.id === activeId) ?? visibleItems[0] ?? null,
    [visibleItems, activeId],
  );
  const stats = useMemo(() => buildLiteratureStats(items, tags), [items, tags]);
  const activeCompleteness = useMemo(() => buildLiteratureCompleteness(activeItem), [activeItem]);

  return (
    <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(320px,360px)_minmax(0,1fr)] 2xl:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="space-y-4">
        <LiteratureStatsPanel stats={stats} activeItem={activeItem} completeness={activeCompleteness} />
        <LiteratureFilterPanel
          filters={filters}
          tags={tags}
          projects={projects}
          papers={papers}
          onChange={setFilters}
        />
      </aside>

      <div className="space-y-4">
        <LiteratureWorkbenchHero
          stats={stats}
          activeItem={activeItem}
          visibleCount={visibleItems.length}
          totalCount={items.length}
          completeness={activeCompleteness}
          onCreate={() => setCreating(true)}
        />
        <section className="module-shell">
          <div className="module-header flex flex-wrap items-center justify-between gap-3 px-5 py-5">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-stone-950">文献阅读管理</h2>
            </div>
            <div className="flex items-center gap-2">
              <ViewSwitch view={view} onChange={setView} />
              <Button type="button" size="icon" onClick={() => setCreating(true)} className="rounded-xl" aria-label="新建文献" title="新建文献">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div
            className={cn(
              "grid grid-cols-1 gap-0",
              view === "board"
                ? "xl:grid-cols-[minmax(0,540px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,640px)_minmax(0,1fr)]"
                : "xl:grid-cols-[minmax(0,400px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,460px)_minmax(0,1fr)]",
            )}
          >
            <div className="border-b border-stone-200/70 xl:border-b-0 xl:border-r">
              {view === "list" ? (
                <LiteratureList
                  items={visibleItems}
                  activeId={activeItem?.id ?? null}
                  projects={projects}
                  papers={papers}
                  onSelect={setActiveId}
                  onEdit={(item) => setActiveId(item.id)}
                  onDelete={onDeleteLiterature}
                />
              ) : (
                <LiteratureBoard
                  items={visibleItems}
                  activeId={activeItem?.id ?? null}
                  onSelect={setActiveId}
                  collapsedColumns={collapsedColumns}
                  onToggleColumn={(columnKey) =>
                    setCollapsedColumns((prev) => ({
                      ...prev,
                      [columnKey]: !prev[columnKey],
                    }))
                  }
                />
              )}
            </div>

            <div className="min-h-[720px]">
              {activeItem ? (
                <LiteratureDetail
                  item={activeItem}
                  projects={projects}
                  papers={papers}
                  onUpdate={onUpdateLiterature}
                  onSaveNote={onSaveNote}
                  onCreateExcerpt={onCreateExcerpt}
                  onUpdateExcerpt={onUpdateExcerpt}
                  onDeleteExcerpt={onDeleteExcerpt}
                  onCreateMethodNote={onCreateMethodNote}
                  onUpdateMethodNote={onUpdateMethodNote}
                  onDeleteMethodNote={onDeleteMethodNote}
                  onCreatePaperUsage={onCreatePaperUsage}
                  onUpdatePaperUsage={onUpdatePaperUsage}
                  onDeletePaperUsage={onDeletePaperUsage}
                  onCreateReadingLog={onCreateReadingLog}
                  onUpdateReadingLog={onUpdateReadingLog}
                  onDeleteReadingLog={onDeleteReadingLog}
                  onUploadAttachments={onUploadAttachments}
                  onDeleteAttachment={onDeleteAttachment}
                />
              ) : (
                <div className="flex h-full min-h-[720px] items-center justify-center p-8 text-sm text-gray-500">
                  当前筛选条件下没有文献记录。
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <LiteratureEditorModal
        open={creating}
        item={null}
        projects={projects}
        papers={papers}
        onClose={() => {
          setCreating(false);
        }}
        onCreate={async (input) => {
          await onCreateLiterature(input);
          setCreating(false);
        }}
        onUpdate={async (id, input) => {
          await onUpdateLiterature(id, input);
        }}
      />
    </section>
  );
}

function ViewSwitch({
  view,
  onChange,
}: {
  view: LiteratureView;
  onChange: (view: LiteratureView) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 p-1">
      <Button type="button" variant={view === "list" ? "default" : "ghost"} size="sm" onClick={() => onChange("list")}>
        列表
      </Button>
      <Button type="button" variant={view === "board" ? "default" : "ghost"} size="sm" onClick={() => onChange("board")}>
        看板
      </Button>
    </div>
  );
}

function LiteratureWorkbenchHero({
  stats,
  activeItem,
  visibleCount,
  totalCount,
  completeness,
  onCreate,
}: {
  stats: ReturnType<typeof buildLiteratureStats>;
  activeItem: LiteratureItem | null;
  visibleCount: number;
  totalCount: number;
  completeness: LiteratureCompleteness;
  onCreate: () => void;
}) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-stone-950">文献阅读研究台</h2>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <HeroMetric label="筛选结果" value={`${visibleCount}/${totalCount}`} />
            <HeroMetric label="核心文献" value={String(stats.core)} />
            <HeroMetric label="阅读中" value={String(stats.active)} />
            <HeroMetric label="连续阅读" value={`${stats.recentReadingDays} 天`} />
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-stone-400">当前文献</p>
              <h3 className="mt-2 line-clamp-2 text-base font-semibold text-stone-950">
                {activeItem?.title ?? "暂无选中文献"}
              </h3>
            </div>
            <div className="shrink-0 text-right">
              <div className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-stone-900">
                <div className="text-lg font-semibold">{completeness.score}%</div>
                <div className="text-[10px] uppercase tracking-wide opacity-90">Ready</div>
              </div>
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-stone-200">
            <div
              className="h-full rounded-full bg-stone-900 transition-all"
              style={{ width: `${completeness.score}%` }}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {completeness.strengths.length > 0 ? (
              completeness.strengths.map((item) => (
                <span key={item} className="rounded-full bg-white px-2.5 py-1 text-xs text-stone-600 shadow-sm">
                  {item}
                </span>
              ))
            ) : (
              <span className="rounded-full bg-white px-2.5 py-1 text-xs text-stone-500 shadow-sm">等待补全阅读信息</span>
            )}
          </div>
          <Button type="button" className="mt-4 w-full rounded-2xl" onClick={onCreate}>
            <Plus className="mr-2 h-4 w-4" />
            新建文献
          </Button>
        </div>
      </div>
    </section>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-3">
      <div className="text-lg font-semibold text-stone-950">{value}</div>
      <div className="mt-1 text-xs text-stone-500">{label}</div>
    </div>
  );
}

function LiteratureStatsPanel({
  stats,
  activeItem,
  completeness,
}: {
  stats: ReturnType<typeof buildLiteratureStats>;
  activeItem: LiteratureItem | null;
  completeness: LiteratureCompleteness;
}) {
  return (
    <section className="module-shell">
      <div className="module-header px-4 py-4">
        <div className="flex items-center gap-2">
          <LibraryBig className="h-4 w-4 text-gray-600" />
          <h3 className="text-base font-semibold text-gray-900">阅读统计</h3>
        </div>
      </div>
      <div className="space-y-4 p-4">
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-stone-500">当前完整度</p>
              <p className="mt-1 line-clamp-1 text-sm font-semibold text-stone-900">{activeItem?.title ?? "未选择文献"}</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-semibold text-stone-950">{completeness.score}%</p>
              <p className="text-[11px] text-stone-500">{completeness.done}/{completeness.total}</p>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-200">
            <div
              className="h-full rounded-full bg-stone-900"
              style={{ width: `${completeness.score}%` }}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="文献总数" value={String(stats.total)} />
          <StatCard label="阅读中" value={String(stats.active)} />
          <StatCard label="已引用" value={String(stats.cited)} />
          <StatCard label="核心文献" value={String(stats.core)} />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-900">状态分布</p>
          {stats.statusCounts.map((item) => (
            <div key={item.status} className="flex items-center justify-between text-sm text-gray-600">
              <span>{statusLabel(item.status)}</span>
              <span>{item.count}</span>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-900">常用标签</p>
          {stats.topTags.length === 0 ? (
            <p className="text-sm text-gray-500">暂无标签</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {stats.topTags.map((tag) => (
                <Badge key={tag.id} variant="secondary">
                  #{tag.name} · {tag.count}
                </Badge>
              ))}
            </div>
          )}
          <p className="text-xs text-gray-500">连续阅读天数：{stats.recentReadingDays}</p>
        </div>
      </div>
    </section>
  );
}

function LiteratureFilterPanel({
  filters,
  tags,
  projects,
  papers,
  onChange,
}: {
  filters: LiteratureFilters;
  tags: LiteratureTag[];
  projects: LiteratureReferenceOption[];
  papers: LiteratureReferenceOption[];
  onChange: (filters: LiteratureFilters) => void;
}) {
  const activeFilters = [
    filters.query.trim() ? `关键词：${filters.query.trim()}` : null,
    filters.status !== "all" ? `状态：${statusLabel(filters.status)}` : null,
    filters.importance !== "all" ? `重要度：${importanceLabel(filters.importance)}` : null,
    filters.tagId !== "all" ? `标签：${tags.find((tag) => tag.id === filters.tagId)?.name ?? filters.tagId}` : null,
    filters.projectId !== "all" ? `项目：${projects.find((project) => project.id === filters.projectId)?.title ?? filters.projectId}` : null,
    filters.paperId !== "all" ? `论文：${papers.find((paper) => paper.id === filters.paperId)?.title ?? filters.paperId}` : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <section className="module-shell">
      <div className="module-header px-4 py-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-600" />
          <h3 className="text-base font-semibold text-gray-900">筛选</h3>
        </div>
      </div>
      <div className="space-y-4 p-4">
        {activeFilters.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {activeFilters.map((filter) => (
              <span key={filter} className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs text-stone-600">
                {filter}
              </span>
            ))}
          </div>
        ) : null}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={filters.query}
            onChange={(event) => onChange({ ...filters, query: event.target.value })}
            placeholder="搜索标题、作者、关键词"
            className="pl-9"
          />
        </div>
        <FieldSelect
          label="阅读状态"
          value={filters.status}
          options={[{ value: "all", label: "全部" }, ...literatureStatusOptions]}
          onChange={(value) => onChange({ ...filters, status: (value || "all") as LiteratureFilters["status"] })}
        />
        <FieldSelect
          label="重要程度"
          value={filters.importance}
          options={[{ value: "all", label: "全部" }, ...literatureImportanceOptions]}
          onChange={(value) =>
            onChange({ ...filters, importance: (value || "all") as LiteratureFilters["importance"] })
          }
        />
        <FieldSelect
          label="标签"
          value={filters.tagId}
          options={[{ value: "all", label: "全部" }, ...tags.map((tag) => ({ value: tag.id, label: tag.name }))]}
          onChange={(value) => onChange({ ...filters, tagId: value || "all" })}
        />
        <FieldSelect
          label="关联项目"
          value={filters.projectId}
          options={[{ value: "all", label: "全部" }, ...projects.map((item) => ({ value: item.id, label: item.title }))]}
          onChange={(value) => onChange({ ...filters, projectId: value || "all" })}
        />
        <FieldSelect
          label="关联论文"
          value={filters.paperId}
          options={[{ value: "all", label: "全部" }, ...papers.map((item) => ({ value: item.id, label: item.title }))]}
          onChange={(value) => onChange({ ...filters, paperId: value || "all" })}
        />
        <Button type="button" variant="outline" className="w-full" onClick={() => onChange(defaultLiteratureFilters)}>
          重置筛选
        </Button>
      </div>
    </section>
  );
}

function LiteratureList({
  items,
  activeId,
  projects,
  papers,
  onSelect,
  onEdit,
  onDelete,
}: {
  items: LiteratureItem[];
  activeId: string | null;
  projects: LiteratureReferenceOption[];
  papers: LiteratureReferenceOption[];
  onSelect: (id: string) => void;
  onEdit: (item: LiteratureItem) => void;
  onDelete: (id: string) => Promise<void>;
}) {
  return (
    <div className="max-h-[760px] overflow-y-auto">
      {items.length === 0 ? (
        <div className="p-6 text-sm text-gray-500">没有可展示的文献。</div>
      ) : (
        <div className="divide-y divide-gray-200">
          {items.map((item) => {
            const projectTitles = item.projectLinks
              .map((link) => projects.find((project) => project.id === link.projectId)?.title)
              .filter((value): value is string => Boolean(value));
            const paperTitles = item.paperUsages
              .map((usage) => papers.find((paper) => paper.id === usage.paperId)?.title)
              .filter((value): value is string => Boolean(value));
            return (
              <button
                key={item.id}
                type="button"
                className={cn(
                  "block w-full px-4 py-4 text-left transition hover:bg-white/65",
                  activeId === item.id && "bg-white/75",
                )}
                onClick={() => onSelect(item.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">{item.title}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {item.authors || "未填写作者"}
                      {item.year ? ` · ${item.year}` : ""}
                      {item.venue ? ` · ${item.venue}` : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="secondary">{statusLabel(item.status)}</Badge>
                      <Badge variant="secondary">{importanceLabel(item.importance)}</Badge>
                      {item.tags.slice(0, 2).map((tag) => (
                        <Badge key={tag.id} variant="outline">
                          #{tag.name}
                        </Badge>
                      ))}
                    </div>
                    {item.summary ? (
                      <p className="mt-3 line-clamp-2 text-xs leading-6 text-gray-600">{item.summary}</p>
                    ) : null}
                    {projectTitles.length > 0 ? (
                      <p className="mt-2 text-xs text-gray-500">项目：{projectTitles.join("、")}</p>
                    ) : null}
                    {paperTitles.length > 0 ? (
                      <p className="mt-1 text-xs text-gray-500">论文：{paperTitles.join("、")}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <IconButton label="编辑" onClick={() => onEdit(item)} icon={<Pencil className="h-4 w-4" />} />
                    <IconButton label="删除" onClick={() => onDelete(item.id)} icon={<Trash2 className="h-4 w-4" />} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LiteratureBoard({
  items,
  activeId,
  onSelect,
  collapsedColumns,
  onToggleColumn,
}: {
  items: LiteratureItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  collapsedColumns: Record<string, boolean>;
  onToggleColumn: (columnKey: string) => void;
}) {
  const columns = [
    { key: "to_read", label: "待读" },
    { key: "reading", label: "阅读中" },
    { key: "deep_read", label: "精读 / 已读" },
    { key: "cited", label: "已引用 / 归档" },
  ] as const;

  return (
    <div className="max-h-[760px] overflow-y-auto p-4">
      <div className="space-y-3">
        {columns.map((column) => {
          const columnItems = items.filter((item) => {
            if (column.key === "deep_read") return item.status === "deep_read" || item.status === "read";
            if (column.key === "cited") return item.status === "cited" || item.status === "archived";
            return item.status === column.key || (column.key === "reading" && item.status === "skimming");
          });
          const collapsed = collapsedColumns[column.key] ?? false;

          return (
            <section key={column.key} className="overflow-hidden rounded-2xl subtle-card">
              <button
                type="button"
                onClick={() => onToggleColumn(column.key)}
                  className="flex w-full items-center justify-between gap-3 border-b border-stone-200/70 bg-white/45 px-4 py-3 text-left transition hover:bg-white/70"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{column.label}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
                    {columnItems.length}
                  </Badge>
                  {collapsed ? (
                    <ChevronRight className="h-4 w-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  )}
                </div>
              </button>

              {collapsed ? null : (
                <div className="p-3">
                  <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
                    {columnItems.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500 2xl:col-span-2">
                        当前没有文献
                      </div>
                    ) : (
                      columnItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={cn(
                            "interactive-card block w-full rounded-2xl px-4 py-3 text-left",
                            activeId === item.id && "border-stone-950 ring-1 ring-stone-950/10",
                          )}
                          onClick={() => onSelect(item.id)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="line-clamp-2 text-sm font-semibold text-gray-900">{item.title}</p>
                            <Badge variant="outline" className="shrink-0">
                              {importanceLabel(item.importance)}
                            </Badge>
                          </div>
                          <p className="mt-2 line-clamp-2 text-xs leading-5 text-gray-500">
                            {item.authors || "未填写作者"}
                          </p>
                          {item.summary ? (
                            <p className="mt-3 line-clamp-3 text-xs leading-5 text-gray-600">{item.summary}</p>
                          ) : null}
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Badge variant="secondary">{statusLabel(item.status)}</Badge>
                            {item.tags.slice(0, 1).map((tag) => (
                              <Badge key={tag.id} variant="outline">
                                #{tag.name}
                              </Badge>
                            ))}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function LiteratureDetail({
  item,
  projects,
  papers,
  onUpdate,
  onSaveNote,
  onCreateExcerpt,
  onUpdateExcerpt,
  onDeleteExcerpt,
  onCreateMethodNote,
  onUpdateMethodNote,
  onDeleteMethodNote,
  onCreatePaperUsage,
  onUpdatePaperUsage,
  onDeletePaperUsage,
  onCreateReadingLog,
  onUpdateReadingLog,
  onDeleteReadingLog,
  onUploadAttachments,
  onDeleteAttachment,
}: {
  item: LiteratureItem;
  projects: LiteratureReferenceOption[];
  papers: LiteratureReferenceOption[];
  onUpdate: (id: string, input: LiteratureFormInput) => Promise<void>;
  onSaveNote: (literatureId: string, input: LiteratureNoteInput) => Promise<void>;
  onCreateExcerpt: (literatureId: string, input: LiteratureExcerptInput) => Promise<void>;
  onUpdateExcerpt: (excerptId: string, input: LiteratureExcerptInput) => Promise<void>;
  onDeleteExcerpt: (excerptId: string) => Promise<void>;
  onCreateMethodNote: (literatureId: string, input: LiteratureMethodNoteInput) => Promise<void>;
  onUpdateMethodNote: (methodId: string, input: LiteratureMethodNoteInput) => Promise<void>;
  onDeleteMethodNote: (methodId: string) => Promise<void>;
  onCreatePaperUsage: (literatureId: string, input: LiteraturePaperUsageInput) => Promise<void>;
  onUpdatePaperUsage: (usageId: string, input: LiteraturePaperUsageInput) => Promise<void>;
  onDeletePaperUsage: (usageId: string) => Promise<void>;
  onCreateReadingLog: (literatureId: string, input: LiteratureReadingLogInput) => Promise<void>;
  onUpdateReadingLog: (logId: string, input: LiteratureReadingLogInput) => Promise<void>;
  onDeleteReadingLog: (logId: string) => Promise<void>;
  onUploadAttachments: (literatureId: string, files: File[]) => Promise<void>;
  onDeleteAttachment: (attachmentId: string) => Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<LiteratureFormInput>(() => literatureFormFromItem(item));
  const [tagInput, setTagInput] = useState(item.tags.map((tag) => tag.name).join(", "));
  const completeness = useMemo(() => buildLiteratureCompleteness(item), [item]);

  useEffect(() => {
    setEditing(false);
    setDraft(literatureFormFromItem(item));
    setTagInput(item.tags.map((tag) => tag.name).join(", "));
  }, [item.id, item.tags]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-200 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{statusLabel(item.status)}</Badge>
              <Badge variant="secondary">{importanceLabel(item.importance)}</Badge>
            </div>
            <h3 className="mt-3 text-xl font-semibold text-gray-900">{item.title}</h3>
            <p className="mt-2 text-sm text-gray-600">
              {item.authors || "未填写作者"}
              {item.year ? ` · ${item.year}` : ""}
              {item.venue ? ` · ${item.venue}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ContextBadge
              source={{
                kind: "literature",
                id: item.id,
                title: item.title,
                authors: item.authors,
                year: item.year ?? undefined,
                status: statusLabel(item.status),
              }}
            />
            <Button type="button" variant="outline" onClick={() => setEditing((value) => !value)}>
              <Pencil className="mr-2 h-4 w-4" />
              编辑文献
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {detailTabs.map((tab) => (
            <Button
              key={tab.value}
              type="button"
              size="sm"
              variant={activeTab === tab.value ? "default" : "outline"}
              onClick={() => setActiveTab(tab.value)}
            >
              {tab.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <LiteratureReadinessStrip
          item={item}
          completeness={completeness}
          onEdit={() => setEditing(true)}
          onJump={setActiveTab}
        />
        <div className="mb-5">
          <LiteratureAssistantPanel
            item={item}
            onInsertToNote={async (content) => {
              const existing = item.note
                ? {
                    researchQuestion: item.note.researchQuestion,
                    researchBackground: item.note.researchBackground,
                    dataSource: item.note.dataSource,
                    method: item.note.method,
                    findings: item.note.findings,
                    innovations: item.note.innovations,
                    shortcomings: item.note.shortcomings,
                    inspiration: item.note.inspiration,
                    quotableContent: item.note.quotableContent,
                  }
                : createEmptyLiteratureNoteInput();
              await onSaveNote(item.id, {
                ...existing,
                inspiration: [existing.inspiration, `AI 分析：\n${content}`].filter(Boolean).join("\n\n"),
              });
              setActiveTab("notes");
            }}
          />
        </div>
        {editing ? (
          <InlineLiteratureEditor
            draft={draft}
            tagInput={tagInput}
            projects={projects}
            papers={papers}
            onDraftChange={setDraft}
            onTagInputChange={(value) => {
              setTagInput(value);
              setDraft((prev) => ({ ...prev, tagNames: parseTagInput(value) }));
            }}
            onCancel={() => {
              setDraft(literatureFormFromItem(item));
              setTagInput(item.tags.map((tag) => tag.name).join(", "));
              setEditing(false);
            }}
            onSave={async () => {
              await onUpdate(item.id, normalizeLiteratureForm(draft, tagInput));
              setEditing(false);
            }}
          />
        ) : null}
        {activeTab === "overview" ? <OverviewTabV2 item={item} projects={projects} papers={papers} /> : null}
        {activeTab === "notes" ? <NoteTab item={item} onSaveNote={onSaveNote} /> : null}
        {activeTab === "excerpts" ? (
          <ExcerptTab
            item={item}
            onCreateExcerpt={onCreateExcerpt}
            onUpdateExcerpt={onUpdateExcerpt}
            onDeleteExcerpt={onDeleteExcerpt}
          />
        ) : null}
        {activeTab === "attachments" ? (
          <AttachmentsTabV2
            item={item}
            onUploadAttachments={onUploadAttachments}
            onDeleteAttachment={onDeleteAttachment}
          />
        ) : null}
        {activeTab === "methods" ? (
          <MethodsTabEditable
            item={item}
            projects={projects}
            papers={papers}
            onCreateMethodNote={onCreateMethodNote}
            onUpdateMethodNote={onUpdateMethodNote}
            onDeleteMethodNote={onDeleteMethodNote}
          />
        ) : null}
        {activeTab === "usage" ? (
          <UsageTabEditable
            item={item}
            papers={papers}
            onCreatePaperUsage={onCreatePaperUsage}
            onUpdatePaperUsage={onUpdatePaperUsage}
            onDeletePaperUsage={onDeletePaperUsage}
          />
        ) : null}
        {activeTab === "links" ? <LinksTab item={item} projects={projects} papers={papers} /> : null}
        {activeTab === "logs" ? (
          <ReadingLogsTabEditable
            item={item}
            onCreateReadingLog={onCreateReadingLog}
            onUpdateReadingLog={onUpdateReadingLog}
            onDeleteReadingLog={onDeleteReadingLog}
          />
        ) : null}
      </div>
    </div>
  );
}

function InlineLiteratureEditor({
  draft,
  tagInput,
  projects,
  papers,
  onDraftChange,
  onTagInputChange,
  onCancel,
  onSave,
}: {
  draft: LiteratureFormInput;
  tagInput: string;
  projects: LiteratureReferenceOption[];
  papers: LiteratureReferenceOption[];
  onDraftChange: Dispatch<SetStateAction<LiteratureFormInput>>;
  onTagInputChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => Promise<void>;
}) {
  return (
    <section className="mb-5 rounded-2xl border border-stone-200 bg-stone-50/80 p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-stone-950">文献信息编辑</h4>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            取消
          </Button>
          <Button type="button" size="sm" disabled={!draft.title.trim()} onClick={() => void onSave()}>
            保存修改
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FieldInput label="标题" value={draft.title} onChange={(value) => onDraftChange((prev) => ({ ...prev, title: value }))} />
        <FieldInput label="作者" value={draft.authors} onChange={(value) => onDraftChange((prev) => ({ ...prev, authors: value }))} />
        <FieldInput label="年份" value={draft.year} onChange={(value) => onDraftChange((prev) => ({ ...prev, year: value }))} />
        <FieldInput label="期刊 / 会议" value={draft.venue} onChange={(value) => onDraftChange((prev) => ({ ...prev, venue: value }))} />
        <FieldInput label="DOI" value={draft.doi} onChange={(value) => onDraftChange((prev) => ({ ...prev, doi: value }))} />
        <FieldInput label="URL" value={draft.url} onChange={(value) => onDraftChange((prev) => ({ ...prev, url: value }))} />
        <FieldInput label="PDF URL / 文件路径" value={draft.pdfUrl} onChange={(value) => onDraftChange((prev) => ({ ...prev, pdfUrl: value }))} />
        <FieldInput label="关键词" value={draft.keywords} onChange={(value) => onDraftChange((prev) => ({ ...prev, keywords: value }))} />
        <FieldSelect
          label="阅读状态"
          value={draft.status}
          options={literatureStatusOptions}
          onChange={(value) => value && onDraftChange((prev) => ({ ...prev, status: value as LiteratureFormInput["status"] }))}
        />
        <FieldSelect
          label="重要程度"
          value={draft.importance}
          options={literatureImportanceOptions}
          onChange={(value) => value && onDraftChange((prev) => ({ ...prev, importance: value as LiteratureFormInput["importance"] }))}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4">
        <FieldTextarea label="摘要" value={draft.abstract} onChange={(value) => onDraftChange((prev) => ({ ...prev, abstract: value }))} />
        <FieldTextarea label="一句话总结" value={draft.summary} onChange={(value) => onDraftChange((prev) => ({ ...prev, summary: value }))} />
        <FieldTextarea label="主要贡献" value={draft.contributions} onChange={(value) => onDraftChange((prev) => ({ ...prev, contributions: value }))} />
        <FieldTextarea label="局限性" value={draft.limitations} onChange={(value) => onDraftChange((prev) => ({ ...prev, limitations: value }))} />
        <FieldInput label="标签" value={tagInput} onChange={onTagInputChange} placeholder="多个标签用英文逗号分隔" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MultiSelectSection
          label="关联项目"
          options={projects}
          selectedIds={draft.projectIds}
          onToggle={(id) =>
            onDraftChange((prev) => ({
              ...prev,
              projectIds: prev.projectIds.includes(id)
                ? prev.projectIds.filter((itemId) => itemId !== id)
                : [...prev.projectIds, id],
            }))
          }
        />
        <MultiSelectSection
          label="关联论文"
          options={papers}
          selectedIds={draft.paperIds}
          onToggle={(id) =>
            onDraftChange((prev) => ({
              ...prev,
              paperIds: prev.paperIds.includes(id)
                ? prev.paperIds.filter((itemId) => itemId !== id)
                : [...prev.paperIds, id],
            }))
          }
        />
      </div>
    </section>
  );
}

function LiteratureReadinessStrip({
  item,
  completeness,
  onEdit,
  onJump,
}: {
  item: LiteratureItem;
  completeness: LiteratureCompleteness;
  onEdit: () => void;
  onJump: (tab: DetailTab) => void;
}) {
  const quickActions: Array<{ label: string; tab: DetailTab; icon: ReactNode }> = [
    { label: "写笔记", tab: "notes", icon: <BookOpenCheck className="h-4 w-4" /> },
    { label: "加摘录", tab: "excerpts", icon: <ClipboardCheck className="h-4 w-4" /> },
    { label: "论文使用", tab: "usage", icon: <ArrowRight className="h-4 w-4" /> },
    { label: "阅读记录", tab: "logs", icon: <Gauge className="h-4 w-4" /> },
  ];

  return (
    <section className="mb-5 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="grid gap-4 p-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-stone-900">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-stone-400">Readiness</p>
              <p className="mt-2 text-3xl font-semibold">{completeness.score}%</p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-stone-500" />
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-stone-200">
            <div
              className="h-full rounded-full bg-stone-900"
              style={{ width: `${completeness.score}%` }}
            />
          </div>
          <p className="mt-3 text-xs text-stone-500">
            已完成 {completeness.done}/{completeness.total} 项文献沉淀。
          </p>
        </div>

        <div className="min-w-0">
          <div className="flex justify-end">
            <Button type="button" size="sm" variant="outline" className="rounded-xl" onClick={onEdit}>
              编辑基础信息
            </Button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {quickActions.map((action) => (
              <button
                key={action.tab}
                type="button"
                className="rounded-xl border border-stone-200 bg-white px-3 py-3 text-left transition hover:border-stone-300 hover:bg-stone-50"
                onClick={() => onJump(action.tab)}
              >
                <div className="flex items-center gap-2 text-stone-900">
                  {action.icon}
                  <span className="text-sm font-semibold">{action.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function OverviewTabV2({
  item,
  projects,
  papers,
}: {
  item: LiteratureItem;
  projects: LiteratureReferenceOption[];
  papers: LiteratureReferenceOption[];
}) {
  const linkedProjects = item.projectLinks
    .map((link) => projects.find((project) => project.id === link.projectId)?.title)
    .filter((value): value is string => Boolean(value));
  const linkedPapers = item.paperUsages
    .map((usage) => papers.find((paper) => paper.id === usage.paperId)?.title)
    .filter((value): value is string => Boolean(value));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
            <BookOpenCheck className="h-4 w-4" />
            Reading abstract
          </div>
          <h4 className="mt-4 text-sm font-semibold text-stone-950">一句话总结</h4>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-stone-700">{item.summary || "未填写"}</p>
          <div className="mt-5 rounded-xl border border-stone-200 bg-stone-50 p-4">
            <h4 className="text-sm font-semibold text-stone-950">摘要</h4>
            <p className="mt-2 max-h-44 overflow-y-auto whitespace-pre-wrap pr-2 text-sm leading-7 text-stone-600">
              {item.abstract || "未填写"}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">Source</p>
          <div className="mt-4 space-y-3">
            <CompactMeta label="DOI" value={item.doi || "未填写"} />
            <CompactMeta label="URL" value={item.url || "未填写"} />
            <CompactMeta label="PDF" value={item.pdfUrl || "未填写"} />
            <CompactMeta label="关键词" value={item.keywords.length > 0 ? item.keywords.join(" / ") : "未填写"} />
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <InsightCard title="主要贡献" content={item.contributions || "未填写"} tone="emerald" />
        <InsightCard title="局限性" content={item.limitations || "未填写"} tone="amber" />
      </div>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-stone-950">写作与项目使用</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{item.excerpts.length} 条摘录</Badge>
            <Badge variant="secondary">{item.methodNotes.length} 个方法</Badge>
            <Badge variant="secondary">{item.paperUsages.length} 处论文使用</Badge>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <RelationBox title="关联项目" items={linkedProjects} emptyText="未关联项目" />
          <RelationBox title="关联论文" items={linkedPapers} emptyText="未关联论文" />
        </div>

        {item.tags.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {item.tags.map((tag) => (
              <Badge key={tag.id} variant="secondary">
                #{tag.name}
              </Badge>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function CompactMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.16em] text-stone-400">{label}</p>
      <p className="mt-1 break-words text-sm text-stone-700">{value}</p>
    </div>
  );
}

function InsightCard({ title, content, tone }: { title: string; content: string; tone: "emerald" | "amber" }) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-stone-200 bg-white p-5 shadow-sm",
      )}
    >
      <h4 className="text-sm font-semibold text-stone-950">{title}</h4>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-700">{content}</p>
    </section>
  );
}

function RelationBox({ title, items, emptyText }: { title: string; items: string[]; emptyText: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4">
      <p className="text-sm font-semibold text-stone-950">{title}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.length > 0 ? (
          items.map((item) => (
            <span key={item} className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs text-stone-600">
              {item}
            </span>
          ))
        ) : (
          <span className="text-sm text-stone-500">{emptyText}</span>
        )}
      </div>
    </div>
  );
}

function OverviewTab({
  item,
  projects,
  papers,
}: {
  item: LiteratureItem;
  projects: LiteratureReferenceOption[];
  papers: LiteratureReferenceOption[];
}) {
  const linkedProjects = item.projectLinks
    .map((link) => projects.find((project) => project.id === link.projectId)?.title)
    .filter((value): value is string => Boolean(value));
  const linkedPapers = item.paperUsages
    .map((usage) => papers.find((paper) => paper.id === usage.paperId)?.title)
    .filter((value): value is string => Boolean(value));

  return (
    <div className="space-y-6">
      <DetailGrid
        items={[
          { label: "DOI", value: item.doi || "未填写" },
          { label: "URL", value: item.url || "未填写" },
          { label: "PDF", value: item.pdfUrl || "未填写" },
          { label: "关键词", value: item.keywords.length > 0 ? item.keywords.join("、") : "未填写" },
        ]}
      />
      <SectionCard title="一句话总结" content={item.summary || "未填写"} />
      <SectionCard title="主要贡献" content={item.contributions || "未填写"} />
      <SectionCard title="局限性" content={item.limitations || "未填写"} />
      <SectionCard title="摘要" content={item.abstract || "未填写"} />
      <SectionCard title="关联项目" content={linkedProjects.length > 0 ? linkedProjects.join("、") : "未关联"} />
      <SectionCard title="关联论文" content={linkedPapers.length > 0 ? linkedPapers.join("、") : "未关联"} />
      {item.tags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {item.tags.map((tag) => (
            <Badge key={tag.id} variant="secondary">
              #{tag.name}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NoteTab({
  item,
  onSaveNote,
}: {
  item: LiteratureItem;
  onSaveNote: (literatureId: string, input: LiteratureNoteInput) => Promise<void>;
}) {
  const [draft, setDraft] = useState<LiteratureNoteInput>(
    item.note
      ? {
          researchQuestion: item.note.researchQuestion,
          researchBackground: item.note.researchBackground,
          dataSource: item.note.dataSource,
          method: item.note.method,
          findings: item.note.findings,
          innovations: item.note.innovations,
          shortcomings: item.note.shortcomings,
          inspiration: item.note.inspiration,
          quotableContent: item.note.quotableContent,
        }
      : createEmptyLiteratureNoteInput(),
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FieldTextarea label="研究问题" value={draft.researchQuestion} onChange={(value) => setDraft((prev) => ({ ...prev, researchQuestion: value }))} />
        <FieldTextarea label="研究背景" value={draft.researchBackground} onChange={(value) => setDraft((prev) => ({ ...prev, researchBackground: value }))} />
        <FieldTextarea label="数据来源" value={draft.dataSource} onChange={(value) => setDraft((prev) => ({ ...prev, dataSource: value }))} />
        <FieldTextarea label="研究方法" value={draft.method} onChange={(value) => setDraft((prev) => ({ ...prev, method: value }))} />
        <FieldTextarea label="主要发现" value={draft.findings} onChange={(value) => setDraft((prev) => ({ ...prev, findings: value }))} />
        <FieldTextarea label="创新点" value={draft.innovations} onChange={(value) => setDraft((prev) => ({ ...prev, innovations: value }))} />
        <FieldTextarea label="不足" value={draft.shortcomings} onChange={(value) => setDraft((prev) => ({ ...prev, shortcomings: value }))} />
        <FieldTextarea label="对我研究的启发" value={draft.inspiration} onChange={(value) => setDraft((prev) => ({ ...prev, inspiration: value }))} />
      </div>
      <FieldTextarea
        label="可引用内容"
        value={draft.quotableContent}
        onChange={(value) => setDraft((prev) => ({ ...prev, quotableContent: value }))}
      />
      <div className="flex justify-end">
        <Button type="button" onClick={() => onSaveNote(item.id, draft)}>
          保存阅读笔记
        </Button>
      </div>
    </div>
  );
}

function ExcerptTab({
  item,
  onCreateExcerpt,
  onUpdateExcerpt,
  onDeleteExcerpt,
}: {
  item: LiteratureItem;
  onCreateExcerpt: (literatureId: string, input: LiteratureExcerptInput) => Promise<void>;
  onUpdateExcerpt: (excerptId: string, input: LiteratureExcerptInput) => Promise<void>;
  onDeleteExcerpt: (excerptId: string) => Promise<void>;
}) {
  const [editingExcerpt, setEditingExcerpt] = useState<LiteratureExcerpt | null>(null);

  return (
    <div className="space-y-4">
      <ExcerptComposer
        key={editingExcerpt?.id ?? `${item.id}-new`}
        initialValue={
          editingExcerpt
            ? {
                content: editingExcerpt.content,
                page: editingExcerpt.page,
                note: editingExcerpt.note,
                excerptType: editingExcerpt.excerptType,
                paperSection: editingExcerpt.paperSection,
                tags: editingExcerpt.tags,
              }
            : undefined
        }
        submitLabel={editingExcerpt ? "保存摘录" : "新增摘录"}
        onSubmit={async (input) => {
          if (editingExcerpt) {
            await onUpdateExcerpt(editingExcerpt.id, input);
            setEditingExcerpt(null);
            return;
          }
          await onCreateExcerpt(item.id, input);
        }}
        onCancel={editingExcerpt ? () => setEditingExcerpt(null) : undefined}
      />

      <div className="space-y-3">
        {item.excerpts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
            还没有摘录记录。
          </div>
        ) : (
          item.excerpts.map((excerpt) => (
            <div key={excerpt.id} className="rounded-lg border border-gray-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{excerptTypeLabel(excerpt.excerptType)}</Badge>
                    <Badge variant="secondary">{paperSectionLabel(excerpt.paperSection)}</Badge>
                    {excerpt.page ? <Badge variant="outline">页码 {excerpt.page}</Badge> : null}
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-800">{excerpt.content}</p>
                  {excerpt.note ? <p className="mt-3 text-sm text-gray-600">{excerpt.note}</p> : null}
                  {excerpt.tags.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {excerpt.tags.map((tag) => (
                        <Badge key={tag} variant="outline">
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-1">
                  <IconButton label="编辑摘录" onClick={() => setEditingExcerpt(excerpt)} icon={<Pencil className="h-4 w-4" />} />
                  <IconButton label="删除摘录" onClick={() => onDeleteExcerpt(excerpt.id)} icon={<Trash2 className="h-4 w-4" />} />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function isImageAttachment(attachment: LiteratureAttachment) {
  return (
    attachment.fileType.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(attachment.fileName)
  );
}

function AttachmentsTabV2({
  item,
  onUploadAttachments,
  onDeleteAttachment,
}: {
  item: LiteratureItem;
  onUploadAttachments: (literatureId: string, files: File[]) => Promise<void>;
  onDeleteAttachment: (attachmentId: string) => Promise<void>;
}) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<LiteratureAttachment | null>(null);
  const imageAttachments = item.attachments.filter(isImageAttachment);
  const fileAttachments = item.attachments.filter((attachment) => !isImageAttachment(attachment));

  async function uploadFiles(files: File[]) {
    if (files.length === 0) return;
    setUploading(true);
    try {
      await onUploadAttachments(item.id, files);
    } finally {
      setUploading(false);
    }
  }

  async function handlePaste(event: ClipboardEvent<HTMLElement>) {
    const files = Array.from(event.clipboardData.items)
      .filter((clipboardItem) => clipboardItem.kind === "file" && clipboardItem.type.startsWith("image/"))
      .map((clipboardItem, index) => {
        const file = clipboardItem.getAsFile();
        if (!file) return null;
        const extension = file.type.split("/")[1] || "png";
        return new File([file], `literature-figure-${Date.now()}-${index}.${extension}`, { type: file.type });
      })
      .filter((file): file is File => Boolean(file));

    if (files.length > 0) {
      event.preventDefault();
      await uploadFiles(files);
    }
  }

  return (
    <div className="space-y-4">
      <section
        tabIndex={0}
        onPaste={(event) => void handlePaste(event)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void uploadFiles(Array.from(event.dataTransfer.files));
        }}
        className="rounded-2xl border border-dashed border-stone-300 bg-white p-5 outline-none transition focus:border-stone-500 focus:ring-2 focus:ring-stone-200"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-stone-50">
              <ImageIcon className="h-5 w-5 text-stone-600" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-stone-950">图表与截图收藏</h4>
            </div>
          </div>
          <label className="inline-flex cursor-pointer items-center rounded-xl border border-stone-200 bg-stone-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-stone-800">
            {uploading ? "上传中..." : "上传文件"}
            <input
              type="file"
              className="hidden"
              multiple
              accept="image/*,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.pdf,.txt,.md,.csv"
              disabled={uploading}
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                void uploadFiles(files);
                event.target.value = "";
              }}
            />
          </label>
        </div>
        <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-500">
          使用方式：点击此区域后按 Ctrl+V 粘贴截图，或把图片文件拖进来。图片会进入下方图表墙，其他文件进入附件列表。
        </div>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-stone-950">图表墙</h4>
            <p className="mt-1 text-xs text-stone-500">{imageAttachments.length} 张图片</p>
          </div>
        </div>

        {imageAttachments.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-stone-300 bg-stone-50 p-6 text-center text-sm text-stone-500">
            还没有保存图片。复制论文中的图表或实验结果截图后，在上方区域粘贴即可保存。
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {imageAttachments.map((attachment) => (
              <figure key={attachment.id} className="overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
                <button type="button" className="block w-full bg-white" onClick={() => setPreview(attachment)}>
                  <img
                    src={attachment.fileUrl}
                    alt={attachment.fileName}
                    className="h-48 w-full object-contain"
                    loading="lazy"
                  />
                </button>
                <figcaption className="flex items-start justify-between gap-2 border-t border-stone-200 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-stone-800" title={attachment.fileName}>
                      {attachment.fileName}
                    </p>
                    <p className="mt-0.5 text-[11px] text-stone-500">
                      {formatFileSize(attachment.fileSize)} · {attachment.createdAt.slice(0, 10)}
                    </p>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={() => void onDeleteAttachment(attachment.id)}>
                    删除
                  </Button>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-stone-500" />
          <h4 className="text-sm font-semibold text-stone-950">普通附件</h4>
          <span className="text-xs text-stone-500">{fileAttachments.length} 个文件</span>
        </div>

        {fileAttachments.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-stone-500">
            还没有普通附件。
          </div>
        ) : (
          <div className="mt-4 divide-y divide-stone-200 rounded-xl border border-stone-200">
            {fileAttachments.map((attachment) => (
              <div key={attachment.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <a
                    href={attachment.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-sm font-medium text-stone-900 underline-offset-4 hover:underline"
                  >
                    {attachment.fileName}
                  </a>
                  <p className="mt-1 text-xs text-stone-500">
                    {attachment.fileType || "未知类型"} · {formatFileSize(attachment.fileSize)} · {attachment.createdAt.slice(0, 10)}
                  </p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => void onDeleteAttachment(attachment.id)}>
                  删除
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <Dialog open={Boolean(preview)} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{preview?.fileName ?? "图片预览"}</DialogTitle>
          </DialogHeader>
          {preview ? (
            <img src={preview.fileUrl} alt={preview.fileName} className="max-h-[76vh] w-full object-contain" />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AttachmentsTab({
  item,
  onUploadAttachments,
  onDeleteAttachment,
}: {
  item: LiteratureItem;
  onUploadAttachments: (literatureId: string, files: File[]) => Promise<void>;
  onDeleteAttachment: (attachmentId: string) => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="flex items-start gap-3">
          <Paperclip className="mt-0.5 h-4 w-4 text-gray-500" />
          <div>
            <p className="text-sm font-medium text-gray-900">附件记录</p>
          </div>
        </div>
        <label className="inline-flex cursor-pointer items-center rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-50">
          上传附件
          <input
            type="file"
            className="hidden"
            multiple
            accept=".doc,.docx,.ppt,.pptx,.xls,.xlsx,.pdf,.txt,.md,.csv"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              if (files.length > 0) {
                void onUploadAttachments(item.id, files);
              }
              event.target.value = "";
            }}
          />
        </label>
      </div>

      {item.attachments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
          当前还没有附件。
        </div>
      ) : (
        <div className="space-y-3">
          {item.attachments.map((attachment) => (
            <div key={attachment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 p-4">
              <div className="min-w-0">
                <a
                  href={attachment.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-sm font-medium text-gray-900 underline-offset-4 hover:underline"
                >
                  {attachment.fileName}
                </a>
                <p className="mt-1 text-xs text-gray-500">
                  {attachment.fileType || "未知类型"} · {formatFileSize(attachment.fileSize)} · 上传于 {attachment.createdAt.slice(0, 10)}
                </p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => void onDeleteAttachment(attachment.id)}>
                删除附件
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function emptyMethodInput(): LiteratureMethodNoteInput {
  return {
    name: "",
    description: "",
    requiredData: "",
    strengths: "",
    weaknesses: "",
    applicability: "",
    plannedToUse: false,
    projectId: null,
    paperId: null,
  };
}

function methodInputFromValue(value?: LiteratureMethodNote): LiteratureMethodNoteInput {
  return value
    ? {
        name: value.name,
        description: value.description,
        requiredData: value.requiredData,
        strengths: value.strengths,
        weaknesses: value.weaknesses,
        applicability: value.applicability,
        plannedToUse: value.plannedToUse,
        projectId: value.projectId,
        paperId: value.paperId,
      }
    : emptyMethodInput();
}

function MethodsTabEditable({
  item,
  projects,
  papers,
  onCreateMethodNote,
  onUpdateMethodNote,
  onDeleteMethodNote,
}: {
  item: LiteratureItem;
  projects: LiteratureReferenceOption[];
  papers: LiteratureReferenceOption[];
  onCreateMethodNote: (literatureId: string, input: LiteratureMethodNoteInput) => Promise<void>;
  onUpdateMethodNote: (methodId: string, input: LiteratureMethodNoteInput) => Promise<void>;
  onDeleteMethodNote: (methodId: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState<LiteratureMethodNote | null>(null);
  const [draft, setDraft] = useState<LiteratureMethodNoteInput>(emptyMethodInput());

  useEffect(() => {
    setDraft(methodInputFromValue(editing ?? undefined));
  }, [editing]);

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <FieldInput label="方法名称" value={draft.name} onChange={(value) => setDraft((prev) => ({ ...prev, name: value }))} />
          <label className="space-y-2">
            <Label>是否计划使用</Label>
            <div className="flex h-10 items-center gap-2 rounded-md border border-gray-200 bg-white px-3 text-sm">
              <input type="checkbox" checked={draft.plannedToUse} onChange={(event) => setDraft((prev) => ({ ...prev, plannedToUse: event.target.checked }))} />
              <span>计划用于自己的项目或论文</span>
            </div>
          </label>
          <FieldSelect
            label="关联项目"
            value={draft.projectId ?? "none"}
            options={[{ value: "none", label: "不关联" }, ...projects.map((project) => ({ value: project.id, label: project.title }))]}
            onChange={(value) => setDraft((prev) => ({ ...prev, projectId: value && value !== "none" ? value : null }))}
          />
          <FieldSelect
            label="关联论文"
            value={draft.paperId ?? "none"}
            options={[{ value: "none", label: "不关联" }, ...papers.map((paper) => ({ value: paper.id, label: paper.title }))]}
            onChange={(value) => setDraft((prev) => ({ ...prev, paperId: value && value !== "none" ? value : null }))}
          />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3">
          <FieldTextarea label="方法描述" value={draft.description} onChange={(value) => setDraft((prev) => ({ ...prev, description: value }))} />
          <FieldTextarea label="所需数据" value={draft.requiredData} onChange={(value) => setDraft((prev) => ({ ...prev, requiredData: value }))} />
          <FieldTextarea label="优点" value={draft.strengths} onChange={(value) => setDraft((prev) => ({ ...prev, strengths: value }))} />
          <FieldTextarea label="缺点" value={draft.weaknesses} onChange={(value) => setDraft((prev) => ({ ...prev, weaknesses: value }))} />
          <FieldTextarea label="适用性" value={draft.applicability} onChange={(value) => setDraft((prev) => ({ ...prev, applicability: value }))} />
        </div>
        <div className="mt-3 flex justify-end gap-2">
          {editing ? (
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>
              取消
            </Button>
          ) : null}
          <Button
            type="button"
            disabled={!draft.name.trim() && !draft.description.trim()}
            onClick={async () => {
              const normalized = {
                ...draft,
                name: draft.name.trim(),
                description: draft.description.trim(),
                requiredData: draft.requiredData.trim(),
                strengths: draft.strengths.trim(),
                weaknesses: draft.weaknesses.trim(),
                applicability: draft.applicability.trim(),
              };
              if (editing) {
                await onUpdateMethodNote(editing.id, normalized);
                setEditing(null);
                return;
              }
              await onCreateMethodNote(item.id, normalized);
              setDraft(emptyMethodInput());
            }}
          >
            {editing ? "保存方法" : "添加方法"}
          </Button>
        </div>
      </section>

      {item.methodNotes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">暂无方法记录。</div>
      ) : (
        item.methodNotes.map((method) => (
          <div key={method.id} className="rounded-lg border border-gray-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-gray-900">{method.name || "未命名方法"}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{method.description || "未填写描述"}</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setEditing(method)}>编辑</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => void onDeleteMethodNote(method.id)}>删除</Button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <MiniField label="所需数据" value={method.requiredData || "未填写"} />
              <MiniField label="适用性" value={method.applicability || "未填写"} />
              <MiniField label="优点" value={method.strengths || "未填写"} />
              <MiniField label="缺点" value={method.weaknesses || "未填写"} />
              <MiniField label="关联项目" value={projects.find((project) => project.id === method.projectId)?.title || "未关联"} />
              <MiniField label="关联论文" value={papers.find((paper) => paper.id === method.paperId)?.title || "未关联"} />
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function MethodsTab({
  item,
  projects,
  papers,
}: {
  item: LiteratureItem;
  projects: LiteratureReferenceOption[];
  papers: LiteratureReferenceOption[];
}) {
  return (
    <div className="space-y-3">
      {item.methodNotes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
          第一版暂未开放编辑，数据结构已预留。
        </div>
      ) : (
        item.methodNotes.map((method) => (
          <div key={method.id} className="rounded-lg border border-gray-200 p-4">
            <p className="text-sm font-semibold text-gray-900">{method.name || "未命名方法"}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{method.description || "未填写描述"}</p>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <MiniField label="所需数据" value={method.requiredData || "未填写"} />
              <MiniField label="适用性" value={method.applicability || "未填写"} />
              <MiniField label="优点" value={method.strengths || "未填写"} />
              <MiniField label="缺点" value={method.weaknesses || "未填写"} />
              <MiniField
                label="关联项目"
                value={projects.find((item) => item.id === method.projectId)?.title || "未关联"}
              />
              <MiniField
                label="关联论文"
                value={papers.find((item) => item.id === method.paperId)?.title || "未关联"}
              />
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function emptyPaperUsageInput(papers: LiteratureReferenceOption[]): LiteraturePaperUsageInput {
  return {
    paperId: papers[0]?.id ?? "",
    chapter: "",
    usageType: "background",
    note: "",
    citationStatus: "planned",
  };
}

function paperUsageInputFromValue(value: LiteraturePaperUsage | undefined, papers: LiteratureReferenceOption[]): LiteraturePaperUsageInput {
  return value
    ? {
        paperId: value.paperId,
        chapter: value.chapter,
        usageType: value.usageType,
        note: value.note,
        citationStatus: value.citationStatus,
      }
    : emptyPaperUsageInput(papers);
}

function UsageTabEditable({
  item,
  papers,
  onCreatePaperUsage,
  onUpdatePaperUsage,
  onDeletePaperUsage,
}: {
  item: LiteratureItem;
  papers: LiteratureReferenceOption[];
  onCreatePaperUsage: (literatureId: string, input: LiteraturePaperUsageInput) => Promise<void>;
  onUpdatePaperUsage: (usageId: string, input: LiteraturePaperUsageInput) => Promise<void>;
  onDeletePaperUsage: (usageId: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState<LiteraturePaperUsage | null>(null);
  const [draft, setDraft] = useState<LiteraturePaperUsageInput>(() => emptyPaperUsageInput(papers));

  useEffect(() => {
    setDraft(paperUsageInputFromValue(editing ?? undefined, papers));
  }, [editing, papers]);

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <FieldSelect
            label="用于论文"
            value={draft.paperId || "none"}
            options={[{ value: "none", label: "请选择论文" }, ...papers.map((paper) => ({ value: paper.id, label: paper.title }))]}
            onChange={(value) => setDraft((prev) => ({ ...prev, paperId: value === "none" || !value ? "" : value }))}
          />
          <FieldInput label="章节 / 位置" value={draft.chapter} onChange={(value) => setDraft((prev) => ({ ...prev, chapter: value }))} />
          <FieldSelect
            label="用途类型"
            value={draft.usageType}
            options={literatureUsageTypeOptions}
            onChange={(value) => value && setDraft((prev) => ({ ...prev, usageType: value as LiteraturePaperUsageInput["usageType"] }))}
          />
          <FieldSelect
            label="引用状态"
            value={draft.citationStatus}
            options={literatureCitationStatusOptions}
            onChange={(value) => value && setDraft((prev) => ({ ...prev, citationStatus: value as LiteraturePaperUsageInput["citationStatus"] }))}
          />
        </div>
        <div className="mt-3">
          <FieldTextarea label="备注" value={draft.note} onChange={(value) => setDraft((prev) => ({ ...prev, note: value }))} />
        </div>
        <div className="mt-3 flex justify-end gap-2">
          {editing ? <Button type="button" variant="outline" onClick={() => setEditing(null)}>取消</Button> : null}
          <Button
            type="button"
            disabled={!draft.paperId}
            onClick={async () => {
              const normalized = { ...draft, chapter: draft.chapter.trim(), note: draft.note.trim() };
              if (editing) {
                await onUpdatePaperUsage(editing.id, normalized);
                setEditing(null);
                return;
              }
              await onCreatePaperUsage(item.id, normalized);
              setDraft(emptyPaperUsageInput(papers));
            }}
          >
            {editing ? "保存使用记录" : "添加使用记录"}
          </Button>
        </div>
      </section>

      {item.paperUsages.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">当前没有论文使用记录。</div>
      ) : (
        item.paperUsages.map((usage) => (
          <div key={usage.id} className="rounded-lg border border-gray-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{papers.find((paper) => paper.id === usage.paperId)?.title || "未命名论文"}</Badge>
                <Badge variant="secondary">{usageTypeLabel(usage.usageType)}</Badge>
                <Badge variant="outline">{citationStatusLabel(usage.citationStatus)}</Badge>
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setEditing(usage)}>编辑</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => void onDeletePaperUsage(usage.id)}>删除</Button>
              </div>
            </div>
            <p className="mt-3 text-sm text-gray-700">章节：{usage.chapter || "未填写"}</p>
            {usage.note ? <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">{usage.note}</p> : null}
          </div>
        ))
      )}
    </div>
  );
}

function UsageTab({
  item,
  papers,
}: {
  item: LiteratureItem;
  papers: LiteratureReferenceOption[];
}) {
  return (
    <div className="space-y-3">
      {item.paperUsages.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
          当前没有论文使用记录。
        </div>
      ) : (
        item.paperUsages.map((usage) => (
          <div key={usage.id} className="rounded-lg border border-gray-200 p-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                {papers.find((paper) => paper.id === usage.paperId)?.title || "未命名论文"}
              </Badge>
              <Badge variant="secondary">{usageTypeLabel(usage.usageType)}</Badge>
              <Badge variant="outline">{citationStatusLabel(usage.citationStatus)}</Badge>
            </div>
            <p className="mt-3 text-sm text-gray-700">章节：{usage.chapter || "未填写"}</p>
            {usage.note ? <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">{usage.note}</p> : null}
          </div>
        ))
      )}
    </div>
  );
}

function LinksTab({
  item,
  projects,
  papers,
}: {
  item: LiteratureItem;
  projects: LiteratureReferenceOption[];
  papers: LiteratureReferenceOption[];
}) {
  const linkedProjects = item.projectLinks
    .map((link) => projects.find((project) => project.id === link.projectId)?.title)
    .filter((value): value is string => Boolean(value));
  const linkedPapers = item.paperUsages
    .map((usage) => papers.find((paper) => paper.id === usage.paperId)?.title)
    .filter((value): value is string => Boolean(value));

  return (
    <div className="space-y-4">
      <SectionCard title="科研项目" content={linkedProjects.length > 0 ? linkedProjects.join("、") : "未关联项目"} />
      <SectionCard title="论文" content={linkedPapers.length > 0 ? linkedPapers.join("、") : "未关联论文"} />
      <SectionCard title="任务联动" content={item.linkedTaskIds.length > 0 ? item.linkedTaskIds.join("、") : "第一版仅预留结构"} />
      <SectionCard title="日程联动" content={item.linkedEventIds.length > 0 ? item.linkedEventIds.join("、") : "第一版仅预留结构"} />
      <SectionCard title="动态日志联动" content={item.linkedLogPostIds.length > 0 ? item.linkedLogPostIds.join("、") : "第一版仅预留结构"} />
    </div>
  );
}

function emptyReadingLogInput(statusAfter: LiteratureReadingLogInput["statusAfter"]): LiteratureReadingLogInput {
  return {
    loggedAt: new Date().toISOString().slice(0, 16),
    durationMinutes: 30,
    progressText: "",
    statusAfter,
    linkedTaskId: "",
    linkedEventId: "",
    linkedLogPostId: "",
  };
}

function readingLogInputFromValue(value: LiteratureReadingLog | undefined, statusAfter: LiteratureReadingLogInput["statusAfter"]): LiteratureReadingLogInput {
  return value
    ? {
        loggedAt: value.loggedAt.slice(0, 16),
        durationMinutes: value.durationMinutes,
        progressText: value.progressText,
        statusAfter: value.statusAfter,
        linkedTaskId: value.linkedTaskId ?? "",
        linkedEventId: value.linkedEventId ?? "",
        linkedLogPostId: value.linkedLogPostId ?? "",
      }
    : emptyReadingLogInput(statusAfter);
}

function ReadingLogsTabEditable({
  item,
  onCreateReadingLog,
  onUpdateReadingLog,
  onDeleteReadingLog,
}: {
  item: LiteratureItem;
  onCreateReadingLog: (literatureId: string, input: LiteratureReadingLogInput) => Promise<void>;
  onUpdateReadingLog: (logId: string, input: LiteratureReadingLogInput) => Promise<void>;
  onDeleteReadingLog: (logId: string) => Promise<void>;
}) {
  const groups = groupReadingLogs(item.readingLogs);
  const [editing, setEditing] = useState<LiteratureReadingLog | null>(null);
  const [draft, setDraft] = useState<LiteratureReadingLogInput>(() => emptyReadingLogInput(item.status));

  useEffect(() => {
    setDraft(readingLogInputFromValue(editing ?? undefined, item.status));
  }, [editing, item.status]);

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label>阅读时间</Label>
            <Input type="datetime-local" value={draft.loggedAt} onChange={(event) => setDraft((prev) => ({ ...prev, loggedAt: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>阅读时长（分钟）</Label>
            <Input type="number" value={String(draft.durationMinutes)} onChange={(event) => setDraft((prev) => ({ ...prev, durationMinutes: Number(event.target.value) || 0 }))} />
          </div>
          <FieldSelect
            label="阅读后状态"
            value={draft.statusAfter}
            options={literatureStatusOptions}
            onChange={(value) => value && setDraft((prev) => ({ ...prev, statusAfter: value as LiteratureReadingLogInput["statusAfter"] }))}
          />
          <FieldInput label="关联任务 ID" value={draft.linkedTaskId} onChange={(value) => setDraft((prev) => ({ ...prev, linkedTaskId: value }))} />
          <FieldInput label="关联日程 ID" value={draft.linkedEventId} onChange={(value) => setDraft((prev) => ({ ...prev, linkedEventId: value }))} />
          <FieldInput label="关联动态日志 ID" value={draft.linkedLogPostId} onChange={(value) => setDraft((prev) => ({ ...prev, linkedLogPostId: value }))} />
        </div>
        <div className="mt-3">
          <FieldTextarea label="阅读进展" value={draft.progressText} onChange={(value) => setDraft((prev) => ({ ...prev, progressText: value }))} />
        </div>
        <div className="mt-3 flex justify-end gap-2">
          {editing ? <Button type="button" variant="outline" onClick={() => setEditing(null)}>取消</Button> : null}
          <Button
            type="button"
            disabled={!draft.progressText.trim()}
            onClick={async () => {
              const normalized = {
                ...draft,
                progressText: draft.progressText.trim(),
                durationMinutes: Math.max(0, Number(draft.durationMinutes) || 0),
                linkedTaskId: draft.linkedTaskId.trim(),
                linkedEventId: draft.linkedEventId.trim(),
                linkedLogPostId: draft.linkedLogPostId.trim(),
              };
              if (editing) {
                await onUpdateReadingLog(editing.id, normalized);
                setEditing(null);
                return;
              }
              await onCreateReadingLog(item.id, normalized);
              setDraft(emptyReadingLogInput(item.status));
            }}
          >
            {editing ? "保存阅读记录" : "添加阅读记录"}
          </Button>
        </div>
      </section>

      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">暂无阅读记录。</div>
      ) : (
        groups.map((group) => (
          <div key={group.label}>
            <div className="mb-3 flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">{group.label}</span>
              <span className="h-px flex-1 bg-gray-200" />
            </div>
            <div className="space-y-3">
              {group.logs.map((log) => (
                <div key={log.id} className="rounded-lg border border-gray-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{statusLabel(log.statusAfter)}</Badge>
                      <Badge variant="outline">{log.durationMinutes} 分钟</Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => setEditing(log)}>编辑</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => void onDeleteReadingLog(log.id)}>删除</Button>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-gray-800">{log.progressText || "未填写阅读进展"}</p>
                  <p className="mt-2 text-xs text-gray-500">{format(new Date(log.loggedAt), "yyyy-MM-dd HH:mm")}</p>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function ReadingLogsTab({ item }: { item: LiteratureItem }) {
  const groups = groupReadingLogs(item.readingLogs);

  return (
    <div className="space-y-4">
      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
          第一版暂未开放阅读记录创建，后续可从任务、日程、动态日志联动生成。
        </div>
      ) : (
        groups.map((group) => (
          <div key={group.label}>
            <div className="mb-3 flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">{group.label}</span>
              <span className="h-px flex-1 bg-gray-200" />
            </div>
            <div className="space-y-3">
              {group.logs.map((log) => (
                <div key={log.id} className="rounded-lg border border-gray-200 p-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{statusLabel(log.statusAfter)}</Badge>
                    <Badge variant="outline">{log.durationMinutes} 分钟</Badge>
                  </div>
                  <p className="mt-3 text-sm text-gray-800">{log.progressText || "未填写阅读进展"}</p>
                  <p className="mt-2 text-xs text-gray-500">{format(new Date(log.loggedAt), "yyyy-MM-dd HH:mm")}</p>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function LiteratureEditorModal({
  open,
  item,
  projects,
  papers,
  onClose,
  onCreate,
  onUpdate,
}: {
  open: boolean;
  item: LiteratureItem | null;
  projects: LiteratureReferenceOption[];
  papers: LiteratureReferenceOption[];
  onClose: () => void;
  onCreate: (input: LiteratureFormInput) => Promise<void>;
  onUpdate: (id: string, input: LiteratureFormInput) => Promise<void>;
}) {
  const initialValue = literatureFormFromItem(item ?? undefined);

  const [draft, setDraft] = useState<LiteratureFormInput>(initialValue);
  const [tagInput, setTagInput] = useState(initialValue.tagNames.join(", "));

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{item ? "编辑文献" : "新增文献"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FieldInput label="标题" value={draft.title} onChange={(value) => setDraft((prev) => ({ ...prev, title: value }))} />
          <FieldInput label="作者" value={draft.authors} onChange={(value) => setDraft((prev) => ({ ...prev, authors: value }))} />
          <FieldInput label="年份" value={draft.year} onChange={(value) => setDraft((prev) => ({ ...prev, year: value }))} />
          <FieldInput label="期刊 / 会议" value={draft.venue} onChange={(value) => setDraft((prev) => ({ ...prev, venue: value }))} />
          <FieldInput label="DOI" value={draft.doi} onChange={(value) => setDraft((prev) => ({ ...prev, doi: value }))} />
          <FieldInput label="URL" value={draft.url} onChange={(value) => setDraft((prev) => ({ ...prev, url: value }))} />
          <FieldInput label="PDF URL / 文件路径" value={draft.pdfUrl} onChange={(value) => setDraft((prev) => ({ ...prev, pdfUrl: value }))} />
          <FieldInput
            label="关键词"
            value={draft.keywords}
            onChange={(value) => setDraft((prev) => ({ ...prev, keywords: value }))}
            placeholder="多个关键词用英文逗号分隔"
          />
          <FieldSelect
            label="阅读状态"
            value={draft.status}
            options={literatureStatusOptions}
            onChange={(value) => value && setDraft((prev) => ({ ...prev, status: value as LiteratureFormInput["status"] }))}
          />
          <FieldSelect
            label="重要程度"
            value={draft.importance}
            options={literatureImportanceOptions}
            onChange={(value) =>
              value && setDraft((prev) => ({ ...prev, importance: value as LiteratureFormInput["importance"] }))
            }
          />
        </div>

        <FieldTextarea label="摘要" value={draft.abstract} onChange={(value) => setDraft((prev) => ({ ...prev, abstract: value }))} />
        <FieldTextarea label="一句话总结" value={draft.summary} onChange={(value) => setDraft((prev) => ({ ...prev, summary: value }))} />
        <FieldTextarea
          label="主要贡献"
          value={draft.contributions}
          onChange={(value) => setDraft((prev) => ({ ...prev, contributions: value }))}
        />
        <FieldTextarea
          label="局限性"
          value={draft.limitations}
          onChange={(value) => setDraft((prev) => ({ ...prev, limitations: value }))}
        />

        <FieldInput
          label="标签"
          value={tagInput}
          onChange={(value) => {
            setTagInput(value);
            setDraft((prev) => ({ ...prev, tagNames: parseTagInput(value) }));
          }}
          placeholder="多个标签用英文逗号分隔"
        />

        <MultiSelectSection
          label="关联项目"
          options={projects}
          selectedIds={draft.projectIds}
          onToggle={(id) =>
            setDraft((prev) => ({
              ...prev,
              projectIds: prev.projectIds.includes(id)
                ? prev.projectIds.filter((itemId) => itemId !== id)
                : [...prev.projectIds, id],
            }))
          }
        />
        <MultiSelectSection
          label="关联论文"
          options={papers}
          selectedIds={draft.paperIds}
          onToggle={(id) =>
            setDraft((prev) => ({
              ...prev,
              paperIds: prev.paperIds.includes(id)
                ? prev.paperIds.filter((itemId) => itemId !== id)
                : [...prev.paperIds, id],
            }))
          }
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            type="button"
            disabled={!draft.title.trim()}
            onClick={async () => {
              const normalized = normalizeLiteratureForm(draft, tagInput);
              if (item) {
                await onUpdate(item.id, normalized);
                return;
              }
              await onCreate(normalized);
            }}
          >
            {item ? "保存" : "创建"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExcerptComposer({
  initialValue,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initialValue?: LiteratureExcerptInput;
  submitLabel: string;
  onSubmit: (input: LiteratureExcerptInput) => Promise<void>;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState<LiteratureExcerptInput>(
    initialValue ?? {
      content: "",
      page: "",
      note: "",
      excerptType: "quote",
      paperSection: "literature_review",
      tags: [],
    },
  );
  const [tagInput, setTagInput] = useState((initialValue?.tags ?? []).join(", "));

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FieldSelect
          label="摘录类型"
          value={draft.excerptType}
          options={literatureExcerptTypeOptions}
          onChange={(value) => value && setDraft((prev) => ({ ...prev, excerptType: value as LiteratureExcerptInput["excerptType"] }))}
        />
        <FieldSelect
          label="可用于论文部分"
          value={draft.paperSection}
          options={literaturePaperSectionOptions}
          onChange={(value) => value && setDraft((prev) => ({ ...prev, paperSection: value as LiteratureExcerptInput["paperSection"] }))}
        />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[160px_minmax(0,1fr)]">
        <FieldInput label="页码" value={draft.page} onChange={(value) => setDraft((prev) => ({ ...prev, page: value }))} />
        <FieldInput
          label="标签"
          value={tagInput}
          onChange={(value) => {
            setTagInput(value);
            setDraft((prev) => ({ ...prev, tags: parseTagInput(value) }));
          }}
          placeholder="多个标签用英文逗号分隔"
        />
      </div>
      <div className="mt-4 space-y-4">
        <FieldTextarea label="内容" value={draft.content} onChange={(value) => setDraft((prev) => ({ ...prev, content: value }))} />
        <FieldTextarea label="备注" value={draft.note} onChange={(value) => setDraft((prev) => ({ ...prev, note: value }))} />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            取消
          </Button>
        ) : null}
        <Button
          type="button"
          disabled={!draft.content.trim()}
          onClick={async () => {
            await onSubmit({
              ...draft,
              content: draft.content.trim(),
              page: draft.page.trim(),
              note: draft.note.trim(),
              tags: parseTagInput(tagInput),
            });
            if (!initialValue) {
              setDraft({
                content: "",
                page: "",
                note: "",
                excerptType: "quote",
                paperSection: "literature_review",
                tags: [],
              });
              setTagInput("");
            }
          }}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

function MultiSelectSection({
  label,
  options,
  selectedIds,
  onToggle,
}: {
  label: string;
  options: LiteratureReferenceOption[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {options.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-500">
          暂无可选对象
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 rounded-md border border-gray-200 p-3">
          {options.map((option) => {
            const selected = selectedIds.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onToggle(option.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm transition",
                  selected
                    ? "border-black bg-black text-white"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300",
                )}
              >
                {option.title}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function IconButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void | Promise<void>;
}) {
  return (
    <button
      type="button"
      className="rounded-md border border-gray-200 p-2 text-gray-600 transition hover:bg-gray-50 hover:text-black"
      onClick={() => void onClick()}
      title={label}
      aria-label={label}
    >
      {icon}
    </button>
  );
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "0 B";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function DetailGrid({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">{item.label}</p>
          <p className="mt-1 break-all text-sm text-gray-800">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

function SectionCard({ title, content }: { title: string; content: string }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <p className="text-sm font-medium text-gray-900">{title}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-gray-700">{content}</p>
    </div>
  );
}

function MiniField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-sm text-gray-700">{value}</p>
    </div>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </div>
  );
}

function FieldTextarea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Textarea value={value} onChange={(event) => onChange(event.target.value)} className="min-h-28" />
    </div>
  );
}

function FieldSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string | null) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
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
