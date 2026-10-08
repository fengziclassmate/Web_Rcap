import type { SupabaseClient } from "@supabase/supabase-js";
import type { LogComposerInput, LogPostEditorInput } from "./logs";

const bucket = "log-images";
const queueKey = (owner: string) => `log-image-cleanup:v1:${owner}`;
const fileIds = new WeakMap<File, Map<string, string>>();
const message = (error: { message: string } | null) => { if (error) throw new Error(error.message); };

function readCleanup(owner: string): string[] {
  const value: unknown = JSON.parse(localStorage.getItem(queueKey(owner)) ?? "[]");
  if (!Array.isArray(value)) throw new Error("图片清理记录损坏，请先备份浏览器数据。");
  return value.filter((path): path is string => typeof path === "string" && path.startsWith(`${owner}/`));
}

function queueCleanup(owner: string, paths: string[]) {
  if (!paths.length) return;
  localStorage.setItem(queueKey(owner), JSON.stringify([...new Set([...readCleanup(owner), ...paths])]));
}

/** Delete objects only after the database no longer references them. Failed cleanup is retryable. */
export async function retryLogImageCleanup(client: SupabaseClient, owner: string): Promise<boolean> {
  try {
    const paths = readCleanup(owner);
    if (!paths.length) return true;
    const { data, error } = await client.from("log_post_images").select("storage_path").eq("user_id", owner).in("storage_path", paths);
    message(error);
    const referenced = new Set((data ?? []).map((row) => row.storage_path));
    const removable = paths.filter((path) => !referenced.has(path));
    if (removable.length) message((await client.storage.from(bucket).remove(removable)).error);
    // Another operation may have queued new objects while the request was in flight.
    localStorage.setItem(queueKey(owner), JSON.stringify(readCleanup(owner).filter((path) => !paths.includes(path))));
    return true;
  } catch { return false; }
}

async function synchronizeTags(client: SupabaseClient, owner: string, postId: string, names: string[]) {
  const cleaned = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  let tagIds: string[] = [];
  if (cleaned.length) {
    const tags = await client.from("log_tags").upsert(cleaned.map((name) => ({ user_id: owner, name })), { onConflict: "user_id,name" }).select("id");
    message(tags.error);
    tagIds = (tags.data ?? []).map((tag) => String(tag.id));
    const added = await client.from("log_post_tags").upsert(tagIds.map((id) => ({ user_id: owner, post_id: postId, tag_id: id })), { onConflict: "post_id,tag_id" });
    message(added.error);
  }
  const current = await client.from("log_post_tags").select("tag_id").eq("user_id", owner).eq("post_id", postId);
  message(current.error);
  const removed = (current.data ?? []).map((row) => String(row.tag_id)).filter((id) => !tagIds.includes(id));
  if (removed.length) message((await client.from("log_post_tags").delete().eq("user_id", owner).eq("post_id", postId).in("tag_id", removed)).error);
}

async function synchronizeLinks(client: SupabaseClient, owner: string, postId: string, links: LogComposerInput["links"]) {
  const current = await client.from("log_post_links").select("*").eq("user_id", owner).eq("post_id", postId);
  message(current.error);
  const unique = [...new Map(links.map((link) => [`${link.type}:${link.id}`, link])).values()];
  const rows = unique.map((link) => ({
    id: current.data?.find((row) => row.target_type === link.type && row.target_id === link.id)?.id ?? crypto.randomUUID(),
    user_id: owner, post_id: postId, target_type: link.type, target_id: link.id, target_title: link.title,
  }));
  if (rows.length) message((await client.from("log_post_links").upsert(rows, { onConflict: "id" })).error);
  const removed = (current.data ?? []).map((row) => String(row.id)).filter((id) => !rows.some((row) => row.id === id));
  if (removed.length) message((await client.from("log_post_links").delete().eq("user_id", owner).eq("post_id", postId).in("id", removed)).error);
}

type SaveLogInput = Pick<LogPostEditorInput, "content" | "category" | "mood" | "location" | "tagNames" | "links"> & {
  newImages: File[];
  keepImageIds: string[];
  createdAt?: string;
};

/** Stable post/image IDs make retries resume the same mutation after partial or ambiguous failure. */
export async function saveLogPost(client: SupabaseClient, owner: string, postId: string, input: SaveLogInput) {
  const existing = await client.from("log_post_images").select("*").eq("user_id", owner).eq("post_id", postId);
  message(existing.error);
  const body = { content: input.content, category: input.category, mood: input.mood || null, location: input.location, updated_at: new Date().toISOString() };
  const post = input.createdAt
    ? await client.from("log_posts").upsert({ ...body, id: postId, user_id: owner, created_at: input.createdAt, visibility: "private", source_type: "manual" }, { onConflict: "id" }).select("id").single()
    : await client.from("log_posts").update(body).eq("user_id", owner).eq("id", postId).select("id").single();
  message(post.error);
  const keepIds = [...input.keepImageIds];
  for (const [index, file] of input.newImages.slice(0, Math.max(0, 9 - keepIds.length)).entries()) {
    const scope = `${owner}/${postId}`;
    let ids = fileIds.get(file);
    if (!ids) { ids = new Map(); fileIds.set(file, ids); }
    let id = ids.get(scope);
    if (!id) { id = crypto.randomUUID(); ids.set(scope, id); }
    // Scope the stable file token to this post, including when the same File is used elsewhere.
    const path = `${owner}/${postId}/${id}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    const previous = existing.data?.find((row) => row.storage_path === path);
    const imageId = previous?.id ?? id;
    if (!previous) {
      const uploaded = await client.storage.from(bucket).upload(path, file, { upsert: true });
      message(uploaded.error);
      const signed = await client.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 30);
      if (signed.error || !signed.data?.signedUrl) {
        throw new Error(signed.error?.message ?? "无法生成图片预览地址，请重试。");
      }
      const imageRow = await client.from("log_post_images").upsert({ id: imageId, post_id: postId, user_id: owner, image_url: signed.data.signedUrl, storage_path: path, sort_order: input.keepImageIds.length + index }, { onConflict: "id" });
      // Ambiguous failures are still retryable at this path. Never queue them for
      // background deletion: a retry may attach the object after cleanup's read.
      message(imageRow.error);
    }
    keepIds.push(String(imageId));
  }
  await synchronizeTags(client, owner, postId, input.tagNames);
  await synchronizeLinks(client, owner, postId, input.links);
  // Retain old attachments until all replacement content has been saved successfully.
  const removed = (existing.data ?? []).filter((row) => !keepIds.includes(String(row.id)));
  if (removed.length) {
    queueCleanup(owner, removed.map((row) => row.storage_path).filter((path): path is string => typeof path === "string"));
    message((await client.from("log_post_images").delete().eq("user_id", owner).eq("post_id", postId).in("id", removed.map((row) => row.id))).error);
  }
  return { cleanupComplete: await retryLogImageCleanup(client, owner) };
}

export async function deleteLogPost(client: SupabaseClient, owner: string, postId: string) {
  const images = await client.from("log_post_images").select("storage_path").eq("user_id", owner).eq("post_id", postId);
  message(images.error);
  queueCleanup(owner, (images.data ?? []).map((row) => row.storage_path).filter((path): path is string => typeof path === "string"));
  // Existing ON DELETE CASCADE removes metadata in the same database transaction.
  message((await client.from("log_posts").delete().eq("user_id", owner).eq("id", postId)).error);
  return { cleanupComplete: await retryLogImageCleanup(client, owner) };
}
