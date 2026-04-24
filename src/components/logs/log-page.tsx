"use client";
/* eslint-disable @next/next/no-img-element */

import { useMemo, useState, type ReactNode } from "react";
import { Archive, BarChart3, Image as ImageIcon, MapPin, Pencil, Pin, Plus, Search, Trash2, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  buildLogStats,
  categoryLabel,
  defaultLogFilters,
  filterLogPosts,
  groupLogsByDate,
  logCategoryOptions,
  logMoodOptions,
  moodLabel,
  sortLogPosts,
  type LinkedEntity,
  type LogComposerInput,
  type LogFilters,
  type LogMood,
  type LogPostEditorInput,
  type LogPostRecord,
  type LogTag,
} from "@/lib/logs";

type LogPageProps = {
  posts: LogPostRecord[];
  tags: LogTag[];
  uploading: boolean;
  onCreatePost: (input: LogComposerInput) => Promise<void>;
  onUpdatePost: (postId: string, input: LogPostEditorInput) => Promise<void>;
  onDeletePost: (postId: string) => Promise<void>;
  onTogglePinned: (postId: string) => Promise<void>;
  onToggleArchived: (postId: string) => Promise<void>;
};

type ComposerDraft = {
  content: string;
  category: typeof logCategoryOptions[number]["value"];
  mood: LogMood | "";
  location: string;
  tagInput: string;
  images: File[];
  links: LinkedEntity[];
};

const defaultComposerDraft: ComposerDraft = {
  content: "",
  category: "life",
  mood: "",
  location: "",
  tagInput: "",
  images: [],
  links: [],
};

export function LogPage({
  posts,
  tags,
  uploading,
  onCreatePost,
  onUpdatePost,
  onDeletePost,
  onTogglePinned,
  onToggleArchived,
}: LogPageProps) {
  const [filters, setFilters] = useState<LogFilters>(defaultLogFilters);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [editingPost, setEditingPost] = useState<LogPostRecord | null>(null);

  const visiblePosts = useMemo(() => sortLogPosts(filterLogPosts(posts, filters)), [posts, filters]);
  const groups = useMemo(() => groupLogsByDate(visiblePosts), [visiblePosts]);
  const stats = useMemo(() => buildLogStats(posts, tags), [posts, tags]);

  function openImagePreview(images: string[], index: number) {
    setPreviewImages(images);
    setPreviewIndex(index);
  }

  return (
    <section className="grid grid-cols-1 gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
      <div className="space-y-4 xl:order-2">
        <LogComposer uploading={uploading} onSubmit={onCreatePost} />
        <LogTimeline
          groups={groups}
          onEdit={setEditingPost}
          onDelete={onDeletePost}
          onToggleArchived={onToggleArchived}
          onTogglePinned={onTogglePinned}
          onPreviewImages={openImagePreview}
        />
      </div>

      <aside className="space-y-4 xl:order-1">
        <LogStatsPanel stats={stats} />
        <LogFilterPanel filters={filters} tags={tags} onChange={setFilters} />
      </aside>

      <LogImagePreviewModal
        images={previewImages}
        currentIndex={previewIndex}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewIndex(null);
            setPreviewImages([]);
          }
        }}
        onIndexChange={setPreviewIndex}
      />
      <LogPostEditorModal
        post={editingPost}
        uploading={uploading}
        onClose={() => setEditingPost(null)}
        onSubmit={async (postId, input) => {
          await onUpdatePost(postId, input);
          setEditingPost(null);
        }}
      />
    </section>
  );
}

export function LogComposer({
  uploading,
  onSubmit,
}: {
  uploading: boolean;
  onSubmit: (input: LogComposerInput) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<ComposerDraft>(defaultComposerDraft);

  const previewUrls = useMemo(
    () => draft.images.map((file) => URL.createObjectURL(file)),
    [draft.images],
  );

  async function handleSubmit() {
    if (!draft.content.trim()) return;
    await onSubmit({
      content: draft.content.trim(),
      category: draft.category,
      mood: draft.mood,
      location: draft.location.trim(),
      tagNames: parseTagNames(draft.tagInput),
      images: draft.images,
      links: draft.links,
    });
    setDraft(defaultComposerDraft);
    setExpanded(false);
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white shadow-md">
      <div className="border-b border-gray-200 px-5 py-4">
        <h2 className="text-lg font-semibold text-gray-900">动态日志</h2>
        <p className="mt-1 text-sm text-gray-600">记录生活、科研、论文、任务和情绪变化。</p>
      </div>
      <div className="p-5">
        <button
          type="button"
          className={cn(
            "w-full rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-4 text-left text-sm text-gray-500 transition hover:border-gray-400",
            expanded && "border-gray-200 bg-white",
          )}
          onClick={() => setExpanded(true)}
        >
          记录一下今天的生活、科研或心情……
        </button>

        {expanded ? (
          <div className="mt-4 space-y-4">
            <Textarea
              value={draft.content}
              onChange={(event) => setDraft((prev) => ({ ...prev, content: event.target.value }))}
              placeholder="写点什么……"
              className="min-h-28"
            />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <FieldSelect
                label="分类"
                value={draft.category}
                options={logCategoryOptions}
                onChange={(value) => {
                  if (value) setDraft((prev) => ({ ...prev, category: value as ComposerDraft["category"] }));
                }}
              />
              <FieldSelect
                label="心情"
                value={draft.mood || "none"}
                options={[{ value: "none", label: "不选择" }, ...logMoodOptions]}
                onChange={(value) =>
                  setDraft((prev) => ({
                    ...prev,
                    mood: !value || value === "none" ? "" : (value as LogMood),
                  }))
                }
              />
              <FieldInput
                label="地点"
                value={draft.location}
                onChange={(value) => setDraft((prev) => ({ ...prev, location: value }))}
                placeholder="可选"
              />
              <FieldInput
                label="标签"
                value={draft.tagInput}
                onChange={(value) => setDraft((prev) => ({ ...prev, tagInput: value }))}
                placeholder="多个标签用逗号分隔"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>图片</Label>
                <span className="text-xs text-gray-500">最多 9 张</span>
              </div>
              <div className="flex flex-wrap gap-3">
                <label className="flex h-24 w-24 cursor-pointer items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-gray-500 transition hover:border-gray-400">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                      const nextFiles = Array.from(event.target.files ?? []);
                      setDraft((prev) => ({
                        ...prev,
                        images: [...prev.images, ...nextFiles].slice(0, 9),
                      }));
                      event.target.value = "";
                    }}
                  />
                  <div className="flex flex-col items-center gap-1 text-xs">
                    <ImageIcon className="h-4 w-4" />
                    上传
                  </div>
                </label>
                {previewUrls.map((url, index) => (
                  <div key={`${url}-${index}`} className="relative h-24 w-24 overflow-hidden rounded-lg border border-gray-200">
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white"
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          images: prev.images.filter((_, itemIndex) => itemIndex !== index),
                        }))
                      }
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setExpanded(false);
                  setDraft(defaultComposerDraft);
                }}
              >
                取消
              </Button>
              <Button type="button" onClick={handleSubmit} disabled={uploading || !draft.content.trim()}>
                {uploading ? "发布中..." : "发布动态"}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function LogTimeline({
  groups,
  onEdit,
  onDelete,
  onTogglePinned,
  onToggleArchived,
  onPreviewImages,
}: {
  groups: Array<{ label: string; items: LogPostRecord[] }>;
  onEdit: (post: LogPostRecord) => void;
  onDelete: (postId: string) => Promise<void>;
  onTogglePinned: (postId: string) => Promise<void>;
  onToggleArchived: (postId: string) => Promise<void>;
  onPreviewImages: (images: string[], index: number) => void;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white shadow-md">
      <div className="border-b border-gray-200 px-5 py-4">
        <h3 className="text-lg font-semibold text-gray-900">时间线</h3>
      </div>
      <div className="space-y-6 p-5">
        {groups.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
            还没有动态记录。
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.label}>
              <div className="mb-3 flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">{group.label}</span>
                <span className="h-px flex-1 bg-gray-200" />
              </div>
              <div className="space-y-4">
                {group.items.map((post) => (
                  <LogPostCard
                    key={post.id}
                    post={post}
                    onEdit={() => onEdit(post)}
                    onDelete={() => onDelete(post.id)}
                    onTogglePinned={() => onTogglePinned(post.id)}
                    onToggleArchived={() => onToggleArchived(post.id)}
                    onPreviewImages={onPreviewImages}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export function LogPostCard({
  post,
  onEdit,
  onDelete,
  onTogglePinned,
  onToggleArchived,
  onPreviewImages,
}: {
  post: LogPostRecord;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  onTogglePinned: () => Promise<void>;
  onToggleArchived: () => Promise<void>;
  onPreviewImages: (images: string[], index: number) => void;
}) {
  return (
    <article className="rounded-lg border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span>{format(new Date(post.createdAt), "yyyy-MM-dd HH:mm")}</span>
            <Badge variant="secondary">{categoryLabel(post.category)}</Badge>
            {post.mood ? <Badge variant="secondary">{moodLabel(post.mood)}</Badge> : null}
            {post.isPinned ? <Badge variant="secondary">置顶</Badge> : null}
            {post.isArchived ? <Badge variant="secondary">归档</Badge> : null}
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-800">{post.content}</p>
          {post.location ? (
            <div className="mt-3 flex items-center gap-1 text-xs text-gray-500">
              <MapPin className="h-3.5 w-3.5" />
              <span>{post.location}</span>
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <IconActionButton label="编辑" onClick={onEdit} icon={<Pencil className="h-4 w-4" />} />
          <IconActionButton
            label={post.isPinned ? "取消置顶" : "置顶"}
            onClick={onTogglePinned}
            icon={<Pin className="h-4 w-4" />}
          />
          <IconActionButton
            label={post.isArchived ? "取消归档" : "归档"}
            onClick={onToggleArchived}
            icon={<Archive className="h-4 w-4" />}
          />
          <IconActionButton label="删除" onClick={onDelete} icon={<Trash2 className="h-4 w-4" />} />
        </div>
      </div>

      {post.images.length > 0 ? (
        <div className="mt-4">
          <LogImageGrid images={post.images} onPreviewImages={onPreviewImages} />
        </div>
      ) : null}

      {post.tags.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <Badge
              key={tag.id}
              variant="secondary"
              style={tag.color ? { borderColor: tag.color, color: tag.color } : undefined}
            >
              #{tag.name}
            </Badge>
          ))}
        </div>
      ) : null}

      {post.links.length > 0 ? (
        <div className="mt-4 hidden rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 text-xs text-gray-500">
          关联对象能力已预留。
        </div>
      ) : null}
    </article>
  );
}

export function LogImageGrid({
  images,
  onPreviewImages,
}: {
  images: LogPostRecord["images"];
  onPreviewImages: (images: string[], index: number) => void;
}) {
  const urls = images.map((item) => item.imageUrl);
  return (
    <div className={cn("grid gap-2", images.length === 1 ? "grid-cols-1" : "grid-cols-3")}>
      {images.map((image, index) => (
        <button
          key={image.id}
          type="button"
          className="overflow-hidden rounded-lg border border-gray-200"
          onClick={() => onPreviewImages(urls, index)}
        >
          <img src={image.imageUrl} alt="" className="aspect-square w-full object-cover" />
        </button>
      ))}
    </div>
  );
}

export function LogFilterPanel({
  filters,
  tags,
  onChange,
}: {
  filters: LogFilters;
  tags: LogTag[];
  onChange: (filters: LogFilters) => void;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white shadow-md">
      <div className="border-b border-gray-200 px-4 py-4">
        <h3 className="text-base font-semibold text-gray-900">筛选</h3>
      </div>
      <div className="space-y-4 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={filters.query}
            onChange={(event) => onChange({ ...filters, query: event.target.value })}
            placeholder="搜索关键词"
            className="pl-9"
          />
        </div>
        <FieldSelect
          label="分类"
          value={filters.category}
          options={[{ value: "all", label: "全部" }, ...logCategoryOptions]}
          onChange={(value) => onChange({ ...filters, category: (value || "all") as LogFilters["category"] })}
        />
        <FieldSelect
          label="心情"
          value={filters.mood}
          options={[{ value: "all", label: "全部" }, ...logMoodOptions]}
          onChange={(value) => onChange({ ...filters, mood: (value || "all") as LogFilters["mood"] })}
        />
        <FieldSelect
          label="标签"
          value={filters.tagId}
          options={[{ value: "all", label: "全部" }, ...tags.map((tag) => ({ value: tag.id, label: tag.name }))]}
          onChange={(value) => onChange({ ...filters, tagId: value || "all" })}
        />
        <div className="grid grid-cols-1 gap-3">
          <FieldInput
            label="开始日期"
            type="date"
            value={filters.startDate}
            onChange={(value) => onChange({ ...filters, startDate: value })}
          />
          <FieldInput
            label="结束日期"
            type="date"
            value={filters.endDate}
            onChange={(value) => onChange({ ...filters, endDate: value })}
          />
        </div>
        <ToggleRow label="仅置顶" checked={filters.pinnedOnly} onChange={(checked) => onChange({ ...filters, pinnedOnly: checked })} />
        <ToggleRow label="仅归档" checked={filters.archivedOnly} onChange={(checked) => onChange({ ...filters, archivedOnly: checked })} />
        <ToggleRow label="仅有图片" checked={filters.withImagesOnly} onChange={(checked) => onChange({ ...filters, withImagesOnly: checked })} />
        <Button type="button" variant="outline" className="w-full" onClick={() => onChange(defaultLogFilters)}>
          重置筛选
        </Button>
      </div>
    </section>
  );
}

export function LogStatsPanel({ stats }: { stats: ReturnType<typeof buildLogStats> }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white shadow-md">
      <div className="border-b border-gray-200 px-4 py-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-gray-600" />
          <h3 className="text-base font-semibold text-gray-900">统计</h3>
        </div>
      </div>
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="本周记录" value={String(stats.weekCount)} />
          <StatCard label="本月记录" value={String(stats.monthCount)} />
          <StatCard label="连续记录" value={`${stats.streakDays} 天`} />
          <StatCard
            label="分类总数"
            value={String(stats.categoryCounts.filter((item) => item.count > 0).length)}
          />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-900">分类分布</p>
          {stats.categoryCounts.map((item) => (
            <div key={item.category} className="flex items-center justify-between text-sm text-gray-600">
              <span>{categoryLabel(item.category)}</span>
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
        </div>
      </div>
    </section>
  );
}

export function LogPostEditorModal({
  post,
  uploading,
  onClose,
  onSubmit,
}: {
  post: LogPostRecord | null;
  uploading: boolean;
  onClose: () => void;
  onSubmit: (postId: string, input: LogPostEditorInput) => Promise<void>;
}) {
  return (
    <Dialog
      open={Boolean(post)}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>编辑动态</DialogTitle>
        </DialogHeader>
        {!post ? null : <LogPostEditorForm key={post.id} post={post} uploading={uploading} onClose={onClose} onSubmit={onSubmit} />}
      </DialogContent>
    </Dialog>
  );
}

export function LogImagePreviewModal({
  images,
  currentIndex,
  onOpenChange,
  onIndexChange,
}: {
  images: string[];
  currentIndex: number | null;
  onOpenChange: (open: boolean) => void;
  onIndexChange: (index: number | null) => void;
}) {
  const current = currentIndex !== null ? images[currentIndex] : null;
  return (
    <Dialog open={currentIndex !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl border-none bg-black/95 p-3 shadow-none">
        {!current ? null : (
          <div className="space-y-3">
            <img src={current} alt="" className="max-h-[80vh] w-full rounded-lg object-contain" />
            <div className="flex items-center justify-between text-sm text-white">
              <span>
                {currentIndex! + 1} / {images.length}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentIndex === 0}
                  onClick={() => onIndexChange((currentIndex ?? 0) - 1)}
                >
                  上一张
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentIndex === images.length - 1}
                  onClick={() => onIndexChange((currentIndex ?? 0) + 1)}
                >
                  下一张
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function IconActionButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void | Promise<void>;
}) {
  return (
    <button
      type="button"
      className="rounded-md border border-gray-200 p-2 text-gray-600 transition hover:bg-gray-50 hover:text-black"
      onClick={() => void onClick()}
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  placeholder,
  type,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
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

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
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

function parseTagNames(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function LogPostEditorForm({
  post,
  uploading,
  onClose,
  onSubmit,
}: {
  post: LogPostRecord;
  uploading: boolean;
  onClose: () => void;
  onSubmit: (postId: string, input: LogPostEditorInput) => Promise<void>;
}) {
  const [draft, setDraft] = useState<LogPostEditorInput>({
    content: post.content,
    category: post.category,
    mood: post.mood ?? "",
    location: post.location,
    tagNames: post.tags.map((tag) => tag.name),
    keepImageIds: post.images.map((image) => image.id),
    newImages: [],
    links: post.links,
  });

  const previewImages = useMemo(() => draft.newImages.map((file) => URL.createObjectURL(file)), [draft.newImages]);

  return (
    <div className="space-y-4">
      <Textarea
        value={draft.content}
        onChange={(event) => setDraft((prev) => ({ ...prev, content: event.target.value }))}
        className="min-h-28"
      />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <FieldSelect
          label="分类"
          value={draft.category}
          options={logCategoryOptions}
          onChange={(value) => {
            if (value) setDraft((prev) => ({ ...prev, category: value as LogPostEditorInput["category"] }));
          }}
        />
        <FieldSelect
          label="心情"
          value={draft.mood || "none"}
          options={[{ value: "none", label: "不选择" }, ...logMoodOptions]}
          onChange={(value) =>
            setDraft((prev) => ({
              ...prev,
              mood: !value || value === "none" ? "" : (value as LogMood),
            }))
          }
        />
        <FieldInput
          label="地点"
          value={draft.location}
          onChange={(value) => setDraft((prev) => ({ ...prev, location: value }))}
        />
        <FieldInput
          label="标签"
          value={draft.tagNames.join(", ")}
          onChange={(value) => setDraft((prev) => ({ ...prev, tagNames: parseTagNames(value) }))}
        />
      </div>

      <div className="space-y-3">
        <Label>保留图片</Label>
        <div className="flex flex-wrap gap-3">
          {post.images.map((image) => {
            const checked = draft.keepImageIds.includes(image.id);
            return (
              <label
                key={image.id}
                className={cn(
                  "relative h-24 w-24 overflow-hidden rounded-lg border",
                  checked ? "border-black" : "border-gray-200 opacity-50",
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  className="absolute left-2 top-2 z-10"
                  onChange={() =>
                    setDraft((prev) => ({
                      ...prev,
                      keepImageIds: checked
                        ? prev.keepImageIds.filter((id) => id !== image.id)
                        : [...prev.keepImageIds, image.id],
                    }))
                  }
                />
                <img src={image.imageUrl} alt="" className="h-full w-full object-cover" />
              </label>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <Label>新增图片</Label>
        <label className="flex h-24 w-24 cursor-pointer items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-gray-500">
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              setDraft((prev) => ({
                ...prev,
                newImages: [...prev.newImages, ...files].slice(0, Math.max(0, 9 - prev.keepImageIds.length)),
              }));
              event.target.value = "";
            }}
          />
          <Plus className="h-4 w-4" />
        </label>
        {previewImages.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {previewImages.map((url, index) => (
              <div key={`${url}-${index}`} className="relative overflow-hidden rounded-lg border border-gray-200">
                <img src={url} alt="" className="aspect-square w-full object-cover" />
                <button
                  type="button"
                  className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white"
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      newImages: prev.newImages.filter((_, itemIndex) => itemIndex !== index),
                    }))
                  }
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          取消
        </Button>
        <Button
          type="button"
          disabled={uploading || !draft.content.trim()}
          onClick={async () => {
            await onSubmit(post.id, draft);
          }}
        >
          {uploading ? "保存中..." : "保存"}
        </Button>
      </div>
    </div>
  );
}
