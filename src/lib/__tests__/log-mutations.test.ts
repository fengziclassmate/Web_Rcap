import { beforeEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteLogPost, retryLogImageCleanup, saveLogPost } from "../log-mutations";

type Row = Record<string, unknown>;
function backend() {
  const tables: Record<string, Row[]> = { log_posts: [], log_post_images: [], log_tags: [], log_post_tags: [], log_post_links: [] };
  const files = new Set<string>();
  const failures = new Map<string, number>();
  let commitThenLoseImageResponse = false;
  const fail = (key: string) => { const n = failures.get(key) ?? 0; if (n) failures.set(key, n - 1); return n > 0; };
  const error = { message: "injected failure" };
  const client = {
    from(table: string) {
      let operation = "select", values: Row[] = [], conflict = "id", single = false;
      const filters: Array<(row: Row) => boolean> = [];
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => { filters.push(row => row[key] === value); return query; },
        in: (key: string, value: unknown[]) => { filters.push(row => value.includes(row[key])); return query; },
        upsert: (input: Row | Row[], options?: { onConflict?: string }) => { operation = "upsert"; values = Array.isArray(input) ? input : [input]; conflict = options?.onConflict ?? "id"; return query; },
        update: (input: Row) => { operation = "update"; values = [input]; return query; },
        delete: () => { operation = "delete"; return query; },
        single: () => { single = true; return query; },
        then(resolve: (result: unknown) => unknown) {
          if (fail(`${table}:${operation}`)) return Promise.resolve(resolve({ data: null, error }));
          const match = (row: Row) => filters.every(filter => filter(row));
          let output = tables[table].filter(match);
          if (operation === "upsert") {
            output = values.map(value => {
              const existing = tables[table].find(row => conflict.split(",").every(key => row[key] === value[key]));
              if (existing) { Object.assign(existing, value); return existing; }
              const row = { id: crypto.randomUUID(), ...value }; tables[table].push(row); return row;
            });
          }
          if (operation === "update") output.forEach(row => Object.assign(row, values[0]));
          if (operation === "delete") {
            tables[table] = tables[table].filter(row => !match(row));
            if (table === "log_posts") for (const child of ["log_post_images", "log_post_tags", "log_post_links"]) tables[child] = tables[child].filter(row => !output.some(post => post.id === row.post_id));
          }
          if (table === "log_post_images" && operation === "upsert" && commitThenLoseImageResponse) { commitThenLoseImageResponse = false; return Promise.resolve(resolve({ data: null, error })); }
          return Promise.resolve(resolve({ data: single ? output[0] : output, error: null }));
        },
      };
      return query;
    },
    storage: { from: () => ({
      upload: async (path: string) => { if (fail("storage:upload")) return { error }; files.add(path); return { error: null }; },
      createSignedUrl: async (path: string) => ({ data: { signedUrl: `https://images.invalid/${path}` }, error: null }),
      remove: async (paths: string[]) => { if (fail("storage:remove")) return { error }; paths.forEach(path => files.delete(path)); return { error: null }; },
    }) },
  } as unknown as SupabaseClient;
  return { client, tables, files, failures, loseImageResponse: () => { commitThenLoseImageResponse = true; } };
}
const input = () => ({ content: "正文", category: "life" as const, mood: "" as const, location: "", tagNames: ["标签"], links: [{ id: "task", type: "task", title: "关联" }], keepImageIds: [], newImages: [new File(["image"], "photo.png", { type: "image/png" })], createdAt: "2026-10-02T00:00:00Z" });
beforeEach(() => localStorage.clear());
describe("retryable log mutations", () => {
  it("preserves every attachment when the parent deletion fails", async () => {
    const db = backend(); await saveLogPost(db.client, "owner", "post", input());
    db.failures.set("log_posts:delete", 1);
    await expect(deleteLogPost(db.client, "owner", "post")).rejects.toThrow();
    expect(db.tables.log_posts).toHaveLength(1); expect(db.tables.log_post_images).toHaveLength(1); expect(db.files.size).toBe(1);
    expect(db.tables.log_post_tags).toHaveLength(1); expect(db.tables.log_post_links).toHaveLength(1);
    await retryLogImageCleanup(db.client, "owner"); expect(db.files.size).toBe(1);
  });
  it("retries partially saved new posts without duplicating the post or photo", async () => {
    const db = backend(), draft = input(); db.failures.set("log_post_tags:upsert", 1);
    await expect(saveLogPost(db.client, "owner", "stable-post", draft)).rejects.toThrow();
    await saveLogPost(db.client, "owner", "stable-post", draft);
    expect(db.tables.log_posts).toHaveLength(1); expect(db.tables.log_post_images).toHaveLength(1); expect(db.files.size).toBe(1);
    expect(db.tables.log_post_tags).toHaveLength(1); expect(db.tables.log_post_links).toHaveLength(1);
  });
  it("never removes the object when image metadata committed but its response was lost", async () => {
    const db = backend(), draft = input(); db.loseImageResponse();
    await expect(saveLogPost(db.client, "owner", "post", draft)).rejects.toThrow();
    expect(db.tables.log_post_images).toHaveLength(1); expect(db.files.size).toBe(1);
    expect(localStorage.getItem("log-image-cleanup:v1:owner")).toBeNull();
    await retryLogImageCleanup(db.client, "owner"); expect(db.files.size).toBe(1);
    await saveLogPost(db.client, "owner", "post", draft);
    expect(db.tables.log_post_images).toHaveLength(1); expect(db.files.size).toBe(1);
  });
  it("retains existing photos when a replacement upload fails", async () => {
    const db = backend(); await saveLogPost(db.client, "owner", "post", input()); const oldPath = [...db.files][0];
    db.failures.set("storage:upload", 1);
    await expect(saveLogPost(db.client, "owner", "post", { ...input(), createdAt: undefined })).rejects.toThrow();
    expect(db.files.has(oldPath)).toBe(true); expect(db.tables.log_post_images).toHaveLength(1);
  });
  it("queues object cleanup after a successful delete and retries it safely", async () => {
    const db = backend(); await saveLogPost(db.client, "owner", "post", input()); db.failures.set("storage:remove", 1);
    expect((await deleteLogPost(db.client, "owner", "post")).cleanupComplete).toBe(false);
    expect(db.tables.log_posts).toHaveLength(0); expect(db.files.size).toBe(1);
    expect(await retryLogImageCleanup(db.client, "owner")).toBe(true); expect(db.files.size).toBe(0);
  });
  it("scopes a reused File to its post so a new post cannot steal another photo", async () => {
    const db = backend(), draft = input(); await saveLogPost(db.client, "owner", "first", draft); await saveLogPost(db.client, "owner", "second", draft);
    expect(db.tables.log_post_images).toHaveLength(2); expect(db.files.size).toBe(2);
  });
});
