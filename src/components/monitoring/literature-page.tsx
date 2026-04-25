"use client";

import { useMemo, useState } from "react";
import { Filter, LibraryBig, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
  literatureImportanceOptions,
  literaturePaperSectionOptions,
  literatureStatusOptions,
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
  type LiteratureItem,
  type LiteratureNoteInput,
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
};

type LiteratureView = "list" | "board";
type DetailTab = "overview" | "notes" | "excerpts" | "methods" | "usage" | "links" | "logs";

const detailTabs: Array<{ value: DetailTab; label: string }> = [
  { value: "overview", label: "概览" },
  { value: "notes", label: "阅读笔记" },
  { value: "excerpts", label: "摘录观点" },
  { value: "methods", label: "方法借鉴" },
  { value: "usage", label: "论文使用" },
  { value: "links", label: "关联对象" },
  { value: "logs", label: "阅读记录" },
];

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
}: LiteraturePageProps) {
  const [view, setView] = useState<LiteratureView>("list");
  const [filters, setFilters] = useState<LiteratureFilters>(defaultLiteratureFilters);
  const [activeId, setActiveId] = useState<string | null>(items[0]?.id ?? null);
  const [editingItem, setEditingItem] = useState<LiteratureItem | null>(null);
  const [creating, setCreating] = useState(false);

  const visibleItems = useMemo(() => sortLiteratures(filterLiteratures(items, filters)), [items, filters]);
  const activeItem = useMemo(
    () => visibleItems.find((item) => item.id === activeId) ?? visibleItems[0] ?? null,
    [visibleItems, activeId],
  );
  const stats = useMemo(() => buildLiteratureStats(items, tags), [items, tags]);

  return (
    <section className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="space-y-4">
        <LiteratureStatsPanel stats={stats} />
        <LiteratureFilterPanel
          filters={filters}
          tags={tags}
          projects={projects}
          papers={papers}
          onChange={setFilters}
        />
      </aside>

      <div className="space-y-4">
        <section className="rounded-lg border border-gray-200 bg-white shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">文献阅读管理</h2>
              <p className="mt-1 text-sm text-gray-600">管理阅读状态、结构化笔记、摘录与论文使用位置。</p>
            </div>
            <div className="flex items-center gap-2">
              <ViewSwitch view={view} onChange={setView} />
              <Button type="button" onClick={() => setCreating(true)} className="rounded-sm">
                <Plus className="mr-2 h-4 w-4" />
                新建文献
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-0 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
            <div className="border-b border-gray-200 xl:border-b-0 xl:border-r">
              {view === "list" ? (
                <LiteratureList
                  items={visibleItems}
                  activeId={activeItem?.id ?? null}
                  projects={projects}
                  papers={papers}
                  onSelect={setActiveId}
                  onEdit={setEditingItem}
                  onDelete={onDeleteLiterature}
                />
              ) : (
                <LiteratureBoard
                  items={visibleItems}
                  activeId={activeItem?.id ?? null}
                  onSelect={setActiveId}
                />
              )}
            </div>

            <div className="min-h-[720px]">
              {activeItem ? (
                <LiteratureDetail
                  item={activeItem}
                  projects={projects}
                  papers={papers}
                  onEdit={() => setEditingItem(activeItem)}
                  onSaveNote={onSaveNote}
                  onCreateExcerpt={onCreateExcerpt}
                  onUpdateExcerpt={onUpdateExcerpt}
                  onDeleteExcerpt={onDeleteExcerpt}
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
        open={creating || Boolean(editingItem)}
        item={editingItem}
        projects={projects}
        papers={papers}
        onClose={() => {
          setCreating(false);
          setEditingItem(null);
        }}
        onCreate={async (input) => {
          await onCreateLiterature(input);
          setCreating(false);
        }}
        onUpdate={async (id, input) => {
          await onUpdateLiterature(id, input);
          setEditingItem(null);
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

function LiteratureStatsPanel({
  stats,
}: {
  stats: ReturnType<typeof buildLiteratureStats>;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white shadow-md">
      <div className="border-b border-gray-200 px-4 py-4">
        <div className="flex items-center gap-2">
          <LibraryBig className="h-4 w-4 text-gray-600" />
          <h3 className="text-base font-semibold text-gray-900">阅读统计</h3>
        </div>
      </div>
      <div className="space-y-4 p-4">
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
  return (
    <section className="rounded-lg border border-gray-200 bg-white shadow-md">
      <div className="border-b border-gray-200 px-4 py-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-600" />
          <h3 className="text-base font-semibold text-gray-900">筛选</h3>
        </div>
      </div>
      <div className="space-y-4 p-4">
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
                  "block w-full px-4 py-4 text-left transition hover:bg-gray-50",
                  activeId === item.id && "bg-gray-50",
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
}: {
  items: LiteratureItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="max-h-[760px] overflow-x-auto p-4">
      <div className="grid min-w-[860px] grid-cols-4 gap-4">
        {[
          { key: "to_read", label: "待读" },
          { key: "reading", label: "阅读中" },
          { key: "deep_read", label: "精读/已读" },
          { key: "cited", label: "已引用/归档" },
        ].map((column) => {
          const columnItems = items.filter((item) => {
            if (column.key === "deep_read") return item.status === "deep_read" || item.status === "read";
            if (column.key === "cited") return item.status === "cited" || item.status === "archived";
            return item.status === column.key || (column.key === "reading" && item.status === "skimming");
          });
          return (
            <div key={column.key} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">{column.label}</p>
                <Badge variant="secondary">{columnItems.length}</Badge>
              </div>
              <div className="space-y-3">
                {columnItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={cn(
                      "block w-full rounded-lg border border-gray-200 bg-white p-3 text-left transition hover:border-gray-300",
                      activeId === item.id && "border-black",
                    )}
                    onClick={() => onSelect(item.id)}
                  >
                    <p className="line-clamp-2 text-sm font-medium text-gray-900">{item.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-gray-500">{item.authors || "未填写作者"}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="secondary">{importanceLabel(item.importance)}</Badge>
                    </div>
                  </button>
                ))}
                {columnItems.length === 0 ? <p className="text-xs text-gray-500">暂无文献</p> : null}
              </div>
            </div>
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
  onEdit,
  onSaveNote,
  onCreateExcerpt,
  onUpdateExcerpt,
  onDeleteExcerpt,
}: {
  item: LiteratureItem;
  projects: LiteratureReferenceOption[];
  papers: LiteratureReferenceOption[];
  onEdit: () => void;
  onSaveNote: (literatureId: string, input: LiteratureNoteInput) => Promise<void>;
  onCreateExcerpt: (literatureId: string, input: LiteratureExcerptInput) => Promise<void>;
  onUpdateExcerpt: (excerptId: string, input: LiteratureExcerptInput) => Promise<void>;
  onDeleteExcerpt: (excerptId: string) => Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");

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
          <Button type="button" variant="outline" onClick={onEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            编辑文献
          </Button>
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
        {activeTab === "overview" ? <OverviewTab item={item} projects={projects} papers={papers} /> : null}
        {activeTab === "notes" ? <NoteTab item={item} onSaveNote={onSaveNote} /> : null}
        {activeTab === "excerpts" ? (
          <ExcerptTab
            item={item}
            onCreateExcerpt={onCreateExcerpt}
            onUpdateExcerpt={onUpdateExcerpt}
            onDeleteExcerpt={onDeleteExcerpt}
          />
        ) : null}
        {activeTab === "methods" ? <MethodsTab item={item} projects={projects} papers={papers} /> : null}
        {activeTab === "usage" ? <UsageTab item={item} papers={papers} /> : null}
        {activeTab === "links" ? <LinksTab item={item} projects={projects} papers={papers} /> : null}
        {activeTab === "logs" ? <ReadingLogsTab item={item} /> : null}
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
  const initialValue: LiteratureFormInput = item
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
              const normalized = {
                ...draft,
                title: draft.title.trim(),
                authors: draft.authors.trim(),
                venue: draft.venue.trim(),
                doi: draft.doi.trim(),
                url: draft.url.trim(),
                pdfUrl: draft.pdfUrl.trim(),
                abstract: draft.abstract.trim(),
                keywords: parseKeywordInput(draft.keywords).join(", "),
                summary: draft.summary.trim(),
                contributions: draft.contributions.trim(),
                limitations: draft.limitations.trim(),
                tagNames: parseTagInput(tagInput),
              };
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
