import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAuthenticatedSupabase } from "@/lib/server/supabase-auth";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function safeFileName(value: string) {
  const cleaned = value.normalize("NFKC").replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^-+|-+$/g, "");
  return (cleaned || "attachment").slice(-120);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedSupabase(request);
  if (auth.error) return auth.error;
  const { id } = await context.params;
  const { data: record, error: recordError } = await auth.supabase
    .from("relationship_records")
    .select("id")
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (recordError || !record) return NextResponse.json({ error: "往来记录不存在。" }, { status: 404 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "请选择附件。" }, { status: 400 });
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "附件必须小于 10MB。" }, { status: 400 });
  if (!allowedMimeTypes.has(file.type)) return NextResponse.json({ error: "不支持此附件类型。" }, { status: 400 });

  const path = `${auth.user.id}/${id}/${randomUUID()}-${safeFileName(file.name)}`;
  const { error: uploadError } = await auth.supabase.storage.from("relationship-attachments").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) return NextResponse.json({ error: "附件上传失败。" }, { status: 500 });

  const { error: insertError } = await auth.supabase.from("relationship_attachments").insert({
    user_id: auth.user.id,
    relationship_record_id: id,
    file_name: file.name.slice(0, 240),
    mime_type: file.type,
    file_size: file.size,
    storage_path: path,
  });
  if (insertError) {
    const { error: queueError } = await auth.supabase.from("relationship_storage_cleanup").insert({
      user_id: auth.user.id,
      storage_path: path,
    });
    const { error: rollbackError } = await auth.supabase.storage.from("relationship-attachments").remove([path]);
    if (!queueError && !rollbackError) {
      await auth.supabase.from("relationship_storage_cleanup").delete().eq("user_id", auth.user.id).eq("storage_path", path);
    }
    return NextResponse.json({ error: "附件信息保存失败。" }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
