import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AMOUNT_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

type AuthenticatedSupabase = {
  supabase: SupabaseClient;
  user: User;
};

type AuthResult =
  | (AuthenticatedSupabase & { error?: never })
  | { error: NextResponse; supabase?: never; user?: never };

type ExpenseRow = {
  id: string;
  amount: number | string;
  category: string;
  note: string | null;
  expense_date: string;
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

export type ExpenseDto = {
  id: string;
  amount: number;
  category: string;
  note: string;
  expense_date: string;
  created_at: string;
  updated_at: string;
};

export type DailyBudgetDto = {
  id: string;
  amount: number;
  budget_date: string;
  created_at: string;
  updated_at: string;
};

export type ExpenseInput = {
  amount: string;
  category: string;
  note: string;
  expense_date: string;
};

export type DailyBudgetInput = {
  amount: string;
  budget_date: string;
};

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function isIsoDate(value: unknown): value is string {
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

export async function getAuthenticatedSupabase(request: Request): Promise<AuthResult> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) {
    return { error: jsonError("Authentication required.", 401) };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return { error: jsonError("Supabase environment variables are missing.", 500) };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { error: jsonError("Invalid or expired session.", 401) };
  }

  return { supabase, user: data.user };
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

export function parseExpenseInput(payload: unknown):
  | { value: ExpenseInput; error?: never }
  | { error: NextResponse; value?: never } {
  if (!isRecord(payload)) return { error: jsonError("Invalid JSON body.", 400) };

  const amount = parsePositiveAmount(payload.amount);
  if (!amount) return { error: jsonError("amount must be greater than 0.", 400) };

  const category = typeof payload.category === "string" ? payload.category.trim() : "";
  if (!category) return { error: jsonError("category is required.", 400) };

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
  return { value: { amount, category, note, expense_date: expenseDate } };
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

export function toExpenseDto(row: ExpenseRow): ExpenseDto {
  return {
    id: row.id,
    amount: normalizeMoney(Number(row.amount)),
    category: row.category,
    note: row.note ?? "",
    expense_date: row.expense_date,
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

export function normalizeMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function sumExpenses(expenses: ExpenseDto[]) {
  return normalizeMoney(expenses.reduce((sum, expense) => sum + expense.amount, 0));
}

export const EXPENSE_SELECT_COLUMNS =
  "id,amount,category,note,expense_date,created_at,updated_at";

export const DAILY_BUDGET_SELECT_COLUMNS = "id,amount,budget_date,created_at,updated_at";
