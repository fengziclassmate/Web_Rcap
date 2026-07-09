import { NextRequest, NextResponse } from "next/server";
import {
  DAILY_BUDGET_SELECT_COLUMNS,
  EXPENSE_SELECT_COLUMNS,
  PERIOD_BUDGET_SELECT_COLUMNS,
  getAuthenticatedSupabase,
  getBudgetPeriodRange,
  jsonError,
  normalizeMoney,
  parseDateQuery,
  sumExpenses,
  toDailyBudgetDto,
  toExpenseDto,
  toPeriodBudgetDto,
  type BudgetPeriodType,
  type ExpenseDto,
  type PeriodBudgetDto,
} from "@/lib/expense-api";

export const runtime = "nodejs";

type PeriodSummary = {
  type: BudgetPeriodType;
  periodStart: string;
  periodEnd: string;
  totalExpense: number;
  budget: PeriodBudgetDto | null;
  remainingBudget: number | null;
};

function isInRange(date: string, start: string, end: string) {
  return date >= start && date <= end;
}

function compareIsoDate(a: string, b: string) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function getRangeBounds(...ranges: Array<{ periodStart: string; periodEnd: string }>) {
  return ranges.reduce(
    (bounds, range) => ({
      start: compareIsoDate(range.periodStart, bounds.start) < 0 ? range.periodStart : bounds.start,
      end: compareIsoDate(range.periodEnd, bounds.end) > 0 ? range.periodEnd : bounds.end,
    }),
    { start: ranges[0].periodStart, end: ranges[0].periodEnd },
  );
}

function buildPeriodSummary(
  type: BudgetPeriodType,
  periodStart: string,
  periodEnd: string,
  expenses: ExpenseDto[],
  budget: PeriodBudgetDto | null,
): PeriodSummary {
  const totalExpense = sumExpenses(expenses.filter((expense) => isInRange(expense.expense_date, periodStart, periodEnd)));
  return {
    type,
    periodStart,
    periodEnd,
    totalExpense,
    budget,
    remainingBudget: budget ? normalizeMoney(budget.amount - totalExpense) : null,
  };
}

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedSupabase(request);
  if (auth.error) return auth.error;

  const parsedDate = parseDateQuery(request.nextUrl.searchParams.get("date"));
  if (parsedDate.error) return parsedDate.error;

  const weekRange = getBudgetPeriodRange(parsedDate.date, "week");
  const monthRange = getBudgetPeriodRange(parsedDate.date, "month");
  const queryRange = getRangeBounds(weekRange, monthRange);

  const [expensesResult, dailyBudgetResult, periodBudgetsResult] = await Promise.all([
    auth.supabase
      .from("expenses")
      .select(EXPENSE_SELECT_COLUMNS)
      .eq("user_id", auth.user.id)
      .gte("expense_date", queryRange.start)
      .lte("expense_date", queryRange.end)
      .order("created_at", { ascending: false }),
    auth.supabase
      .from("daily_budgets")
      .select(DAILY_BUDGET_SELECT_COLUMNS)
      .eq("user_id", auth.user.id)
      .eq("budget_date", parsedDate.date)
      .maybeSingle(),
    auth.supabase
      .from("period_budgets")
      .select(PERIOD_BUDGET_SELECT_COLUMNS)
      .eq("user_id", auth.user.id)
      .in("budget_type", ["week", "month"])
      .in("period_start", [weekRange.periodStart, monthRange.periodStart]),
  ]);

  if (expensesResult.error) {
    return jsonError(`Failed to load expenses: ${expensesResult.error.message}`, 500);
  }
  if (dailyBudgetResult.error) {
    return jsonError(`Failed to load daily budget: ${dailyBudgetResult.error.message}`, 500);
  }
  if (periodBudgetsResult.error) {
    return jsonError(`Failed to load period budgets: ${periodBudgetsResult.error.message}`, 500);
  }

  const rangeExpenses = (expensesResult.data ?? []).map(toExpenseDto);
  const expenses = rangeExpenses.filter((expense) => expense.expense_date === parsedDate.date);
  const totalExpense = sumExpenses(expenses);
  const dailyBudget = dailyBudgetResult.data ? toDailyBudgetDto(dailyBudgetResult.data) : null;
  const periodBudgets = (periodBudgetsResult.data ?? []).map(toPeriodBudgetDto);
  const weekBudget =
    periodBudgets.find(
      (budget) => budget.budget_type === "week" && budget.period_start === weekRange.periodStart,
    ) ?? null;
  const monthBudget =
    periodBudgets.find(
      (budget) => budget.budget_type === "month" && budget.period_start === monthRange.periodStart,
    ) ?? null;

  return NextResponse.json({
    date: parsedDate.date,
    expenses,
    totalExpense,
    dailyBudget,
    remainingBudget: dailyBudget ? normalizeMoney(dailyBudget.amount - totalExpense) : null,
    week: buildPeriodSummary("week", weekRange.periodStart, weekRange.periodEnd, rangeExpenses, weekBudget),
    month: buildPeriodSummary(
      "month",
      monthRange.periodStart,
      monthRange.periodEnd,
      rangeExpenses,
      monthBudget,
    ),
  });
}