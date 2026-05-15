import type { LogPost, LogPostImage, LogPostLink, LogPostRecord, LogTag } from "@/lib/logs";

export function fromLogPostRow(row: Record<string, unknown>): LogPost {
  return {
    id: String(row.id ?? ""),
    userId: String(row.user_id ?? ""),
    content: String(row.content ?? ""),
    category: (row.category as LogPost["category"]) ?? "life",
    mood: (row.mood as LogPost["mood"]) ?? null,
    location: String(row.location ?? ""),
    visibility: "private",
    isPinned: Boolean(row.is_pinned),
    isArchived: Boolean(row.is_archived),
    sourceType: String(row.source_type ?? "manual"),
    sourceId: typeof row.source_id === "string" ? row.source_id : null,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export function fromLogImageRow(row: Record<string, unknown>): LogPostImage {
  return {
    id: String(row.id ?? ""),
    postId: String(row.post_id ?? ""),
    userId: String(row.user_id ?? ""),
    imageUrl: String(row.image_url ?? ""),
    storagePath: typeof row.storage_path === "string" ? row.storage_path : null,
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: String(row.created_at ?? ""),
  };
}

export function fromLogTagRow(row: Record<string, unknown>): LogTag {
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

export function fromLogLinkRow(row: Record<string, unknown>): LogPostLink {
  return {
    id: String(row.id ?? ""),
    postId: String(row.post_id ?? ""),
    userId: String(row.user_id ?? ""),
    targetType: String(row.target_type ?? ""),
    targetId: String(row.target_id ?? ""),
    targetTitle: typeof row.target_title === "string" ? row.target_title : null,
    createdAt: String(row.created_at ?? ""),
  };
}

export function composeLogPostRecords(
  posts: LogPost[],
  images: LogPostImage[],
  tags: LogTag[],
  tagLinks: Array<{ postId: string; tagId: string }>,
  links: LogPostLink[],
): LogPostRecord[] {
  return posts.map((post) => ({
    ...post,
    images: images
      .filter((image) => image.postId === post.id)
      .sort((a, b) => a.sortOrder - b.sortOrder),
    tags: tagLinks
      .filter((item) => item.postId === post.id)
      .map((item) => tags.find((tag) => tag.id === item.tagId))
      .filter((item): item is LogTag => Boolean(item)),
    links: links
      .filter((item) => item.postId === post.id)
      .map((item) => ({
        id: item.targetId,
        type: item.targetType,
        title: item.targetTitle ?? item.targetType,
      })),
  }));
}
