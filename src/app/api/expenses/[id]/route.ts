import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabase, isUuid, jsonError } from "@/lib/expense-api";

export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  if (!isUuid(id)) return jsonError("Invalid expense id.", 400);

  const auth = await getAuthenticatedSupabase(request);
  if (auth.error) return auth.error;

  const { data, error } = await auth.supabase
    .from("expenses")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select("id")
    .maybeSingle();

  if (error) return jsonError(`Failed to delete expense: ${error.message}`, 500);
  if (!data) return jsonError("Expense not found.", 404);

  return NextResponse.json({ success: true });
}
