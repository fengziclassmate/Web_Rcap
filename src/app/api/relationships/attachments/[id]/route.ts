import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedSupabase } from "@/lib/server/supabase-auth";
import { deleteRelationshipAttachment } from "@/lib/server/relationships";

export const runtime = "nodejs";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "附件 ID 无效。" }, { status: 400 });
  const auth = await getAuthenticatedSupabase(request);
  if (auth.error) return auth.error;
  try {
    await deleteRelationshipAttachment(auth, id);
    return new Response(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "附件不存在或删除失败。" }, { status: 404 });
  }
}
