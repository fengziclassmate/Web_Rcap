import { NextResponse } from "next/server";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AMOUNT_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

type ExpenseRow = {
  id: string;
  amount: number | string;
  category: string;
  category_main: string | null;
  category_sub: string | null;
  category_detail: string | null;
  note: string | null;
  expense_date: string;
  excluded_from_budget: boolean;
  created_at: string;
  updated_at: string;
};

type DailyBudgetRow = {
  id: string;
  amount: number | string;
  budget_date: string;
  created_at: string;
  updated_at: string;
};

type PeriodBudgetRow = {
  id: string;
  amount: number | string;
  budget_type: BudgetPeriodType;
  period_start: string;
  created_at: string;
  updated_at: string;
};

export type BudgetPeriodType = "week" | "month";

export type ExpenseDto = {
  id: string;
  amount: number;
  category: string;
  category_main: string;
  category_sub: string;
  category_detail: string;
  note: string;
  expense_date: string;
  excluded_from_budget: boolean;
  created_at: string;
  updated_at: string;
};

type DailyBudgetDto = {
  id: string;
  amount: number;
  budget_date: string;
  created_at: string;
  updated_at: string;
};

export type PeriodBudgetDto = {
  id: string;
  amount: number;
  budget_type: BudgetPeriodType;
  period_start: string;
  created_at: string;
  updated_at: string;
};

type ExpenseInput = {
  amount: string;
  category: string;
  category_main: string;
  category_sub: string;
  category_detail: string;
  note: string;
  expense_date: string;
  excluded_from_budget: boolean;
};

type ExpenseUpdateInput = Omit<ExpenseInput, "excluded_from_budget"> & {
  excluded_from_budget?: boolean;
};

type DailyBudgetInput = {
  amount: string;
  budget_date: string;
};

type PeriodBudgetInput = {
  amount: string;
  budget_type: BudgetPeriodType;
  period_start: string;
};

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

export function parseDateQuery(date: string | null) {
  if (!isIsoDate(date)) {
    return { error: jsonError("date must use YYYY-MM-DD format.", 400) };
  }
  return { date };
}

export function parseBudgetPeriodType(value: unknown):
  | { budgetType: BudgetPeriodType; error?: never }
  | { error: NextResponse; budgetType?: never } {
  if (value === "week" || value === "month") return { budgetType: value };
  return { error: jsonError("type must be week or month.", 400) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parsePositiveAmount(value: unknown) {
  const raw = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  if (!AMOUNT_PATTERN.test(raw)) return null;
  if (Number(raw) <= 0) return null;
  return raw;
}

function readString(payload: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string") return value.trim();
  }
  return "";
}

function parseCategoryLabel(label: string) {
  const parts = label
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  return {
    main: parts[0] ?? "",
    sub: parts[1] ?? "",
    detail: parts[2] ?? "",
  };
}

function buildCategoryLabel(main: string, sub: string, detail: string) {
  return [main, sub, detail].filter(Boolean).join(" / ");
}

export function parseExpenseInput(payload: unknown):
  | { value: ExpenseInput; error?: never }
  | { error: NextResponse; value?: never } {
  if (!isRecord(payload)) return { error: jsonError("Invalid JSON body.", 400) };

  const amount = parsePositiveAmount(payload.amount);
  if (!amount) return { error: jsonError("amount must be greater than 0.", 400) };

  const categoryLabel = readString(payload, "category");
  const parsedLabel = parseCategoryLabel(categoryLabel);
  const categoryMain =
    readString(payload, "category_main", "categoryMain") || parsedLabel.main || categoryLabel;
  const categorySub = readString(payload, "category_sub", "categorySub") || parsedLabel.sub;
  const categoryDetail =
    readString(payload, "category_detail", "categoryDetail") || parsedLabel.detail;
  if (!categoryMain) return { error: jsonError("category is required.", 400) };
  const category = buildCategoryLabel(categoryMain, categorySub, categoryDetail);

  const expenseDate =
    typeof payload.expense_date === "string"
      ? payload.expense_date
      : typeof payload.expenseDate === "string"
        ? payload.expenseDate
        : "";
  if (!isIsoDate(expenseDate)) {
    return { error: jsonError("expense_date must use YYYY-MM-DD format.", 400) };
  }

  const note = typeof payload.note === "string" ? payload.note.trim() : "";
  const excludedFromBudget =
    payload.excluded_from_budget === true || payload.excludedFromBudget === true;
  return {
    value: {
      amount,
      category,
      category_main: categoryMain,
      category_sub: categorySub,
      category_detail: categoryDetail,
      note,
      expense_date: expenseDate,
      excluded_from_budget: excludedFromBudget,
    },
  };
}

export function parseExpenseUpdateInput(payload: unknown):
  | { value: ExpenseUpdateInput; error?: never }
  | { error: NextResponse; value?: never } {
  const parsed = parseExpenseInput(payload);
  if (parsed.error) return parsed;

  if (
    isRecord(payload) &&
    (typeof payload.excluded_from_budget === "boolean" ||
      typeof payload.excludedFromBudget === "boolean")
  ) {
    return parsed;
  }

  const value: ExpenseUpdateInput = { ...parsed.value };
  delete value.excluded_from_budget;
  return { value };
}

export function parseDailyBudgetInput(payload: unknown):
  | { value: DailyBudgetInput; error?: never }
  | { error: NextResponse; value?: never } {
  if (!isRecord(payload)) return { error: jsonError("Invalid JSON body.", 400) };

  const amount = parsePositiveAmount(payload.amount);
  if (!amount) return { error: jsonError("amount must be greater than 0.", 400) };

  const budgetDate =
    typeof payload.budget_date === "string"
      ? payload.budget_date
      : typeof payload.budgetDate === "string"
        ? payload.budgetDate
        : typeof payload.date === "string"
          ? payload.date
          : "";
  if (!isIsoDate(budgetDate)) {
    return { error: jsonError("budget_date must use YYYY-MM-DD format.", 400) };
  }

  return { value: { amount, budget_date: budgetDate } };
}

export function parsePeriodBudgetInput(payload: unknown):
  | { value: PeriodBudgetInput; error?: never }
  | { error: NextResponse; value?: never } {
  if (!isRecord(payload)) return { error: jsonError("Invalid JSON body.", 400) };

  const amount = parsePositiveAmount(payload.amount);
  if (!amount) return { error: jsonError("amount must be greater than 0.", 400) };

  const parsedType = parseBudgetPeriodType(
    typeof payload.budget_type === "string" ? payload.budget_type : payload.type,
  );
  if (parsedType.error) return { error: parsedType.error };

  const date =
    typeof payload.period_start === "string"
      ? payload.period_start
      : typeof payload.periodStart === "string"
        ? payload.periodStart
        : typeof payload.date === "string"
          ? payload.date
          : "";
  if (!isIsoDate(date)) {
    return { error: jsonError("date must use YYYY-MM-DD format.", 400) };
  }

  const { periodStart } = getBudgetPeriodRange(date, parsedType.budgetType);
  return {
    value: {
      amount,
      budget_type: parsedType.budgetType,
      period_start: periodStart,
    },
  };
}

export function toExpenseDto(row: ExpenseRow): ExpenseDto {
  const parsedLabel = parseCategoryLabel(row.category);
  const categoryMain = row.category_main ?? parsedLabel.main ?? row.category;
  const categorySub = row.category_sub ?? parsedLabel.sub ?? "";
  const categoryDetail = row.category_detail ?? parsedLabel.detail ?? "";
  return {
    id: row.id,
    amount: normalizeMoney(Number(row.amount)),
    category: row.category || buildCategoryLabel(categoryMain, categorySub, categoryDetail),
    category_main: categoryMain,
    category_sub: categorySub,
    category_detail: categoryDetail,
    note: row.note ?? "",
    expense_date: row.expense_date,
    excluded_from_budget: Boolean(row.excluded_from_budget),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function toDailyBudgetDto(row: DailyBudgetRow): DailyBudgetDto {
  return {
    id: row.id,
    amount: normalizeMoney(Number(row.amount)),
    budget_date: row.budget_date,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function toPeriodBudgetDto(row: PeriodBudgetRow): PeriodBudgetDto {
  return {
    id: row.id,
    amount: normalizeMoney(Number(row.amount)),
    budget_type: row.budget_type,
    period_start: row.period_start,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function normalizeMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function sumBudgetExpenses(expenses: ExpenseDto[]) {
  return normalizeMoney(
    expenses.reduce(
      (sum, expense) => sum + (expense.excluded_from_budget ? 0 : expense.amount),
      0,
    ),
  );
}

function parseIsoDateParts(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

function formatUtcDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function getBudgetPeriodRange(date: string, budgetType: BudgetPeriodType) {
  const { year, month, day } = parseIsoDateParts(date);
  const current = new Date(Date.UTC(year, month - 1, day));

  if (budgetType === "month") {
    const periodStartDate = new Date(Date.UTC(year, month - 1, 1));
    const nextMonthStart = new Date(Date.UTC(year, month, 1));
    return {
      periodStart: formatUtcDate(periodStartDate),
      periodEnd: formatUtcDate(addUtcDays(nextMonthStart, -1)),
    };
  }

  const mondayOffset = (current.getUTCDay() + 6) % 7;
  const periodStartDate = addUtcDays(current, -mondayOffset);
  return {
    periodStart: formatUtcDate(periodStartDate),
    periodEnd: formatUtcDate(addUtcDays(periodStartDate, 6)),
  };
}

export const EXPENSE_SELECT_COLUMNS =
  "id,amount,category,category_main,category_sub,category_detail,note,expense_date,excluded_from_budget,created_at,updated_at";

export const DAILY_BUDGET_SELECT_COLUMNS = "id,amount,budget_date,created_at,updated_at";

export const PERIOD_BUDGET_SELECT_COLUMNS =
  "id,amount,budget_type,period_start,created_at,updated_at";
