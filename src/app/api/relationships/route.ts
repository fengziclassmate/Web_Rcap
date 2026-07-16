import { NextResponse } from "next/server";
import { relationshipRecordInputSchema } from "@/lib/relationships-schema";
import { getAuthenticatedSupabase } from "@/lib/server/supabase-auth";
import { clearRelationshipWorkspace, createRelationshipRecord, loadRelationshipWorkspace } from "@/lib/server/relationships";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await getAuthenticatedSupabase(request);
  if (auth.error) return auth.error;
  try {
    return NextResponse.json(await loadRelationshipWorkspace(auth), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json({ error: "人情往来数据加载失败。" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await getAuthenticatedSupabase(request);
  if (auth.error) return auth.error;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求内容不是有效 JSON。" }, { status: 400 });
  }
  const parsed = relationshipRecordInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "往来记录内容不完整。" }, { status: 400 });
  }
  try {
    const id = await createRelationshipRecord(auth, parsed.data);
    return NextResponse.json({ id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "往来记录保存失败，请检查关联对象后重试。" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await getAuthenticatedSupabase(request);
  if (auth.error) return auth.error;
  try {
    await clearRelationshipWorkspace(auth);
    return new Response(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "人情往来数据清空失败。" }, { status: 500 });
  }
}
