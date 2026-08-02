import { NextRequest, NextResponse } from "next/server";
import {
  EXPENSE_SELECT_COLUMNS,
  jsonError,
  parseDateQuery,
  parseExpenseInput,
  sumBudgetExpenses,
  toExpenseDto,
} from "@/lib/expense-api";
import { getAuthenticatedSupabase } from "@/lib/server/supabase-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedSupabase(request);
  if (auth.error) return auth.error;

  const parsedDate = parseDateQuery(request.nextUrl.searchParams.get("date"));
  if (parsedDate.error) return parsedDate.error;

  const { data, error } = await auth.supabase
    .from("expenses")
    .select(EXPENSE_SELECT_COLUMNS)
    .eq("user_id", auth.user.id)
    .eq("expense_date", parsedDate.date)
    .order("created_at", { ascending: false });

  if (error) return jsonError(`Failed to load expenses: ${error.message}`, 500);

  const expenses = (data ?? []).map(toExpenseDto);
  return NextResponse.json({
    date: parsedDate.date,
    expenses,
    totalAmount: sumBudgetExpenses(expenses),
  });
}

export async function POST(request: NextRequest) {
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
    .insert({
      user_id: auth.user.id,
      ...parsedInput.value,
    })
    .select(EXPENSE_SELECT_COLUMNS)
    .single();

  if (error) return jsonError(`Failed to create expense: ${error.message}`, 500);

  return NextResponse.json({ expense: toExpenseDto(data) }, { status: 201 });
}
