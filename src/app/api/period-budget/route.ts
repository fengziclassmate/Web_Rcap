import { NextRequest, NextResponse } from "next/server";
import {
  PERIOD_BUDGET_SELECT_COLUMNS,
  getBudgetPeriodRange,
  jsonError,
  parseBudgetPeriodType,
  parseDateQuery,
  parsePeriodBudgetInput,
  toPeriodBudgetDto,
} from "@/lib/expense-api";
import { getAuthenticatedSupabase } from "@/lib/server/supabase-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedSupabase(request);
  if (auth.error) return auth.error;

  const parsedDate = parseDateQuery(request.nextUrl.searchParams.get("date"));
  if (parsedDate.error) return parsedDate.error;

  const parsedType = parseBudgetPeriodType(
    request.nextUrl.searchParams.get("type") ?? request.nextUrl.searchParams.get("budget_type"),
  );
  if (parsedType.error) return parsedType.error;

  const { periodStart, periodEnd } = getBudgetPeriodRange(parsedDate.date, parsedType.budgetType);
  const { data, error } = await auth.supabase
    .from("period_budgets")
    .select(PERIOD_BUDGET_SELECT_COLUMNS)
    .eq("user_id", auth.user.id)
    .eq("budget_type", parsedType.budgetType)
    .eq("period_start", periodStart)
    .maybeSingle();

  if (error) return jsonError(`Failed to load period budget: ${error.message}`, 500);

  return NextResponse.json({
    date: parsedDate.date,
    budgetType: parsedType.budgetType,
    periodStart,
    periodEnd,
    periodBudget: data ? toPeriodBudgetDto(data) : null,
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

  const parsedInput = parsePeriodBudgetInput(payload);
  if (parsedInput.error) return parsedInput.error;

  const { data, error } = await auth.supabase
    .from("period_budgets")
    .upsert(
      {
        user_id: auth.user.id,
        ...parsedInput.value,
      },
      { onConflict: "user_id,budget_type,period_start" },
    )
    .select(PERIOD_BUDGET_SELECT_COLUMNS)
    .single();

  if (error) return jsonError(`Failed to save period budget: ${error.message}`, 500);

  const { periodEnd } = getBudgetPeriodRange(data.period_start, data.budget_type);
  return NextResponse.json({
    periodBudget: toPeriodBudgetDto(data),
    periodStart: data.period_start,
    periodEnd,
  });
}
