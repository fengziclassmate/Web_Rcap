"use client";

import { format, isToday, isYesterday, parseISO, startOfDay, subDays } from "date-fns";

export type LogCategory =
  | "life"
  | "research"
  | "paper"
  | "task"
  | "schedule"
  | "meeting"
  | "submission"
  | "health"
  | "mood"
  | "achievement"
  | "reflection"
  | "other";

export type LogMood =
  | "happy"
  | "calm"
  | "tired"
  | "anxious"
  | "stressed"
  | "sad"
  | "excited"
  | "neutral";

export type LinkedEntity = {
  id: string;
  type: string;
  title: string;
};

export type LogPost = {
  id: string;
  userId: string;
  content: string;
  category: LogCategory;
  mood: LogMood | null;
  location: string;
  visibility: "private";
  isPinned: boolean;
  isArchived: boolean;
  sourceType: string;
  sourceId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LogPostImage = {
  id: string;
  postId: string;
  userId: string;
  imageUrl: string;
  storagePath: string | null;
  sortOrder: number;
  createdAt: string;
};

export type LogTag = {
  id: string;
  userId: string;
  name: string;
  color: string | null;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
};

export type LogPostLink = {
  id: string;
  postId: string;
  userId: string;
  targetType: string;
  targetId: string;
  targetTitle: string | null;
  createdAt: string;
};

export type LogPostRecord = LogPost & {
  images: LogPostImage[];
  tags: LogTag[];
  links: LinkedEntity[];
};

export type LogFilters = {
  query: string;
  category: LogCategory | "all";
  mood: LogMood | "all";
  tagId: string | "all";
  startDate: string;
  endDate: string;
  pinnedOnly: boolean;
  archivedOnly: boolean;
  withImagesOnly: boolean;
};

export type LogComposerInput = {
  content: string;
  category: LogCategory;
  mood: LogMood | "";
  location: string;
  tagNames: string[];
  images: File[];
  links: LinkedEntity[];
};

export type LogPostEditorInput = {
  content: string;
  category: LogCategory;
  mood: LogMood | "";
  location: string;
  tagNames: string[];
  keepImageIds: string[];
  newImages: File[];
  links: LinkedEntity[];
};

export type LogStats = {
  weekCount: number;
  monthCount: number;
  categoryCounts: Array<{ category: LogCategory; count: number }>;
  topTags: Array<{ id: string; name: string; count: number; color: string | null }>;
  streakDays: number;
};

export const logCategoryOptions: Array<{ value: LogCategory; label: string }> = [
  { value: "life", label: "生活" },
  { value: "research", label: "科研" },
  { value: "paper", label: "论文" },
  { value: "task", label: "任务" },
  { value: "schedule", label: "日程" },
  { value: "meeting", label: "会议" },
  { value: "submission", label: "投稿" },
  { value: "health", label: "健康" },
  { value: "mood", label: "心情" },
  { value: "achievement", label: "成就" },
  { value: "reflection", label: "复盘" },
  { value: "other", label: "其他" },
];

export const logMoodOptions: Array<{ value: LogMood; label: string }> = [
  { value: "happy", label: "开心" },
  { value: "calm", label: "平静" },
  { value: "tired", label: "疲惫" },
  { value: "anxious", label: "焦虑" },
  { value: "stressed", label: "压力大" },
  { value: "sad", label: "低落" },
  { value: "excited", label: "兴奋" },
  { value: "neutral", label: "一般" },
];

export const defaultLogFilters: LogFilters = {
  query: "",
  category: "all",
  mood: "all",
  tagId: "all",
  startDate: "",
  endDate: "",
  pinnedOnly: false,
  archivedOnly: false,
  withImagesOnly: false,
};

export function categoryLabel(value: LogCategory) {
  return logCategoryOptions.find((item) => item.value === value)?.label ?? value;
}

export function moodLabel(value: LogMood) {
  return logMoodOptions.find((item) => item.value === value)?.label ?? value;
}

export function groupLogsByDate(posts: LogPostRecord[]) {
  const groups = new Map<string, LogPostRecord[]>();
  posts.forEach((post) => {
    const date = parseISO(post.createdAt);
    const key = isToday(date)
      ? "今天"
      : isYesterday(date)
        ? "昨天"
        : format(date, "yyyy年M月d日");
    const list = groups.get(key) ?? [];
    list.push(post);
    groups.set(key, list);
  });
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

export function filterLogPosts(posts: LogPostRecord[], filters: LogFilters) {
  return posts.filter((post) => {
    if (filters.pinnedOnly && !post.isPinned) return false;
    if (filters.archivedOnly && !post.isArchived) return false;
    if (!filters.archivedOnly && post.isArchived) return false;
    if (filters.withImagesOnly && post.images.length === 0) return false;
    if (filters.category !== "all" && post.category !== filters.category) return false;
    if (filters.mood !== "all" && post.mood !== filters.mood) return false;
    if (filters.tagId !== "all" && !post.tags.some((tag) => tag.id === filters.tagId)) return false;
    if (filters.query.trim()) {
      const query = filters.query.trim().toLowerCase();
      const text = [
        post.content,
        post.location,
        post.category,
        post.mood ?? "",
        ...post.tags.map((tag) => tag.name),
      ]
        .join(" ")
        .toLowerCase();
      if (!text.includes(query)) return false;
    }
    if (filters.startDate) {
      const start = startOfDay(parseISO(filters.startDate));
      if (parseISO(post.createdAt) < start) return false;
    }
    if (filters.endDate) {
      const end = startOfDay(parseISO(filters.endDate));
      if (parseISO(post.createdAt) > end) return false;
    }
    return true;
  });
}

export function sortLogPosts(posts: LogPostRecord[]) {
  return [...posts].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export function buildLogStats(posts: LogPostRecord[], tags: LogTag[]): LogStats {
  const now = new Date();
  const weekStart = subDays(startOfDay(now), 6);
  const monthPrefix = format(now, "yyyy-MM");
  const weekCount = posts.filter((post) => parseISO(post.createdAt) >= weekStart).length;
  const monthCount = posts.filter((post) => post.createdAt.startsWith(monthPrefix)).length;

  const categoryMap = new Map<LogCategory, number>();
  posts.forEach((post) => {
    categoryMap.set(post.category, (categoryMap.get(post.category) ?? 0) + 1);
  });

  const categoryCounts = logCategoryOptions.map((option) => ({
    category: option.value,
    count: categoryMap.get(option.value) ?? 0,
  }));

  const topTags = [...tags]
    .sort((a, b) => b.usageCount - a.usageCount || a.name.localeCompare(b.name))
    .slice(0, 5)
    .map((tag) => ({
      id: tag.id,
      name: tag.name,
      count: tag.usageCount,
      color: tag.color,
    }));

  const uniqueDays = Array.from(
    new Set(posts.filter((post) => !post.isArchived).map((post) => post.createdAt.slice(0, 10))),
  ).sort((a, b) => b.localeCompare(a));

  let streakDays = 0;
  let cursor = startOfDay(now);
  while (uniqueDays.includes(format(cursor, "yyyy-MM-dd"))) {
    streakDays += 1;
    cursor = subDays(cursor, 1);
  }

  return {
    weekCount,
    monthCount,
    categoryCounts,
    topTags,
    streakDays,
  };
}
