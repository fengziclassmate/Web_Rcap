import { NextRequest, NextResponse } from "next/server";
import {
  EXPENSE_SELECT_COLUMNS,
  getAuthenticatedSupabase,
  isUuid,
  jsonError,
  parseExpenseInput,
  toExpenseDto,
} from "@/lib/expense-api";

export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  if (!isUuid(id)) return jsonError("Invalid expense id.", 400);

  const auth = await getAuthenticatedSupabase(request);
  if (auth.error) return auth.error;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const parsedInput = parseExpenseInput(payload);
  if (parsedInput.error) return parsedInput.error;

  const { data, error } = await auth.supabase
    .from("expenses")
    .update(parsedInput.value)
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select(EXPENSE_SELECT_COLUMNS)
    .maybeSingle();

  if (error) return jsonError(`Failed to update expense: ${error.message}`, 500);
  if (!data) return jsonError("Expense not found.", 404);

  return NextResponse.json({ expense: toExpenseDto(data) });
}

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
