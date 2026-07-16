import { NextResponse } from "next/server";
import { z } from "zod";
import { relationshipRecordDetailsUpdateSchema } from "@/lib/relationships-schema";
import { getAuthenticatedSupabase } from "@/lib/server/supabase-auth";
import { deleteRelationshipRecord, updateRelationshipRecord } from "@/lib/server/relationships";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "记录 ID 无效。" }, { status: 400 });
  const auth = await getAuthenticatedSupabase(request);
  if (auth.error) return auth.error;
  const parsed = relationshipRecordDetailsUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "修改内容无效。" }, { status: 400 });
  try {
    await updateRelationshipRecord(auth, id, parsed.data);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "记录不存在或修改失败。" }, { status: 404 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "记录 ID 无效。" }, { status: 400 });
  const auth = await getAuthenticatedSupabase(request);
  if (auth.error) return auth.error;
  try {
    await deleteRelationshipRecord(auth, id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "记录不存在或删除失败。" }, { status: 404 });
  }
}
