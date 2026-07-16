import { NextResponse } from "next/server";
import { z } from "zod";
import { relationshipFollowUpUpdateSchema } from "@/lib/relationships-schema";
import { getAuthenticatedSupabase } from "@/lib/server/supabase-auth";
import { updateRelationshipFollowUp } from "@/lib/server/relationships";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "后续行动 ID 无效。" }, { status: 400 });
  const auth = await getAuthenticatedSupabase(request);
  if (auth.error) return auth.error;
  const parsed = relationshipFollowUpUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "更新内容无效。" }, { status: 400 });
  try {
    await updateRelationshipFollowUp(auth, id, parsed.data);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "后续行动不存在或更新失败。" }, { status: 404 });
  }
}
