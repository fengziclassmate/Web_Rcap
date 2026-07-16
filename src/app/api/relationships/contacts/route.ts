import { NextResponse } from "next/server";
import { z } from "zod";
import { relationshipContactInputSchema } from "@/lib/relationships-schema";
import { getAuthenticatedSupabase } from "@/lib/server/supabase-auth";
import { archiveRelationshipContact, createRelationshipContact } from "@/lib/server/relationships";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await getAuthenticatedSupabase(request);
  if (auth.error) return auth.error;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "请求内容不是有效 JSON。" }, { status: 400 }); }
  const parsed = relationshipContactInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "联系人内容不完整。" }, { status: 400 });
  try {
    return NextResponse.json({ contact: await createRelationshipContact(auth, parsed.data) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "联系人保存失败。" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await getAuthenticatedSupabase(request);
  if (auth.error) return auth.error;
  const parsed = z.object({ id: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "联系人 ID 无效。" }, { status: 400 });
  try {
    await archiveRelationshipContact(auth, parsed.data.id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "联系人归档失败。" }, { status: 404 });
  }
}
