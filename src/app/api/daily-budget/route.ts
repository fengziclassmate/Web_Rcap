import { NextRequest, NextResponse } from "next/server";
import {
  DAILY_BUDGET_SELECT_COLUMNS,
  jsonError,
  parseDailyBudgetInput,
  parseDateQuery,
  toDailyBudgetDto,
} from "@/lib/expense-api";
import { getAuthenticatedSupabase } from "@/lib/server/supabase-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedSupabase(request);
  if (auth.error) return auth.error;

  const parsedDate = parseDateQuery(request.nextUrl.searchParams.get("date"));
  if (parsedDate.error) return parsedDate.error;

  const { data, error } = await auth.supabase
    .from("daily_budgets")
    .select(DAILY_BUDGET_SELECT_COLUMNS)
    .eq("user_id", auth.user.id)
    .eq("budget_date", parsedDate.date)
    .maybeSingle();

  if (error) return jsonError(`Failed to load daily budget: ${error.message}`, 500);

  return NextResponse.json({
    date: parsedDate.date,
    dailyBudget: data ? toDailyBudgetDto(data) : null,
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

  const parsedInput = parseDailyBudgetInput(payload);
  if (parsedInput.error) return parsedInput.error;

  const { data, error } = await auth.supabase
    .from("daily_budgets")
    .upsert(
      {
        user_id: auth.user.id,
        ...parsedInput.value,
      },
      { onConflict: "user_id,budget_date" },
    )
    .select(DAILY_BUDGET_SELECT_COLUMNS)
    .single();

  if (error) return jsonError(`Failed to save daily budget: ${error.message}`, 500);

  return NextResponse.json({ dailyBudget: toDailyBudgetDto(data) });
}
