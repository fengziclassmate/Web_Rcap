import { NextRequest, NextResponse } from "next/server";
import {
  DAILY_BUDGET_SELECT_COLUMNS,
  EXPENSE_SELECT_COLUMNS,
  getAuthenticatedSupabase,
  jsonError,
  normalizeMoney,
  parseDateQuery,
  sumExpenses,
  toDailyBudgetDto,
  toExpenseDto,
} from "@/lib/expense-api";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedSupabase(request);
  if (auth.error) return auth.error;

  const parsedDate = parseDateQuery(request.nextUrl.searchParams.get("date"));
  if (parsedDate.error) return parsedDate.error;

  const [expensesResult, budgetResult] = await Promise.all([
    auth.supabase
      .from("expenses")
      .select(EXPENSE_SELECT_COLUMNS)
      .eq("user_id", auth.user.id)
      .eq("expense_date", parsedDate.date)
      .order("created_at", { ascending: false }),
    auth.supabase
      .from("daily_budgets")
      .select(DAILY_BUDGET_SELECT_COLUMNS)
      .eq("user_id", auth.user.id)
      .eq("budget_date", parsedDate.date)
      .maybeSingle(),
  ]);

  if (expensesResult.error) {
    return jsonError(`Failed to load expenses: ${expensesResult.error.message}`, 500);
  }
  if (budgetResult.error) {
    return jsonError(`Failed to load daily budget: ${budgetResult.error.message}`, 500);
  }

  const expenses = (expensesResult.data ?? []).map(toExpenseDto);
  const totalExpense = sumExpenses(expenses);
  const dailyBudget = budgetResult.data ? toDailyBudgetDto(budgetResult.data) : null;

  return NextResponse.json({
    date: parsedDate.date,
    expenses,
    totalExpense,
    dailyBudget,
    remainingBudget: dailyBudget ? normalizeMoney(dailyBudget.amount - totalExpense) : null,
  });
}
