"use client";

import { useCallback, useEffect, useState } from "react";
import { PiggyBank, Plus, ReceiptText, RefreshCw, Trash2, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";

type ExpenseRecord = {
  id: string;
  amount: number;
  category: string;
  note: string;
  expense_date: string;
  created_at: string;
  updated_at: string;
};

type DailyBudgetRecord = {
  id: string;
  amount: number;
  budget_date: string;
  created_at: string;
  updated_at: string;
};

type DaySummaryResponse = {
  date: string;
  expenses: ExpenseRecord[];
  totalExpense: number;
  dailyBudget: DailyBudgetRecord | null;
  remainingBudget: number | null;
};

type DailyExpensePanelProps = {
  date: string;
};

const expenseCategories = ["餐饮", "交通", "学习", "日用品", "娱乐", "医疗", "其他"];

const moneyFormatter = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  minimumFractionDigits: 2,
});
const amountPattern = /^\d{1,10}(\.\d{1,2})?$/;

function formatMoney(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "未设置";
  return moneyFormatter.format(value);
}

function isPositiveAmount(value: string) {
  if (!amountPattern.test(value.trim())) return false;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0;
}

async function getAuthHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("登录状态已过期，请重新登录。");
  }

  return {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };
}

async function readErrorMessage(response: Response) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error || response.statusText;
  } catch {
    return response.statusText;
  }
}

export function DailyExpensePanel({ date }: DailyExpensePanelProps) {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [dailyBudget, setDailyBudget] = useState<DailyBudgetRecord | null>(null);
  const [totalExpense, setTotalExpense] = useState(0);
  const [remainingBudget, setRemainingBudget] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [savingBudget, setSavingBudget] = useState(false);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState(expenseCategories[0]);
  const [expenseNote, setExpenseNote] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/day-summary?date=${encodeURIComponent(date)}`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const summary = (await response.json()) as DaySummaryResponse;
      setExpenses(summary.expenses ?? []);
      setDailyBudget(summary.dailyBudget);
      setTotalExpense(summary.totalExpense ?? 0);
      setRemainingBudget(summary.remainingBudget);
      setBudgetAmount(summary.dailyBudget ? String(summary.dailyBudget.amount) : "");
    } catch (error) {
      const message = error instanceof Error ? error.message : "加载花销失败。";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  async function handleAddExpense() {
    if (!isPositiveAmount(expenseAmount)) {
      toast.error("支出金额必须大于 0。");
      return;
    }
    if (!expenseCategory.trim()) {
      toast.error("请选择支出分类。");
      return;
    }

    setSavingExpense(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers,
        body: JSON.stringify({
          amount: expenseAmount,
          category: expenseCategory,
          note: expenseNote,
          expense_date: date,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      setExpenseAmount("");
      setExpenseNote("");
      await loadSummary();
      toast.success("支出已添加。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "添加支出失败。";
      toast.error(message);
    } finally {
      setSavingExpense(false);
    }
  }

  async function handleSaveBudget() {
    if (!isPositiveAmount(budgetAmount)) {
      toast.error("预算金额必须大于 0。");
      return;
    }

    setSavingBudget(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/daily-budget", {
        method: "POST",
        headers,
        body: JSON.stringify({
          amount: budgetAmount,
          budget_date: date,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      await loadSummary();
      toast.success("预算已保存。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存预算失败。";
      toast.error(message);
    } finally {
      setSavingBudget(false);
    }
  }

  async function handleDeleteExpense(expenseId: string) {
    setDeletingExpenseId(expenseId);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/expenses/${expenseId}`, {
        method: "DELETE",
        headers,
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      await loadSummary();
      toast.success("支出已删除。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除支出失败。";
      toast.error(message);
    } finally {
      setDeletingExpenseId(null);
    }
  }

  const remainingClassName =
    remainingBudget === null
      ? "text-stone-500"
      : remainingBudget < 0
        ? "text-rose-600"
        : "text-emerald-700";

  return (
    <section className="border-t border-gray-200 bg-stone-50/80 px-4 py-4 sm:px-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold text-stone-950">
              <WalletCards className="h-4 w-4 text-stone-700" aria-hidden />
              今日花销
            </h3>
            <p className="mt-0.5 text-xs text-stone-500">{date}</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void loadSummary()}
            disabled={loading}
          >
            <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
            刷新
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-stone-200 bg-white px-3 py-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-stone-500">
              <ReceiptText className="h-3.5 w-3.5" aria-hidden />
              当天总支出
            </p>
            <p className="mt-1 text-xl font-semibold text-stone-950">{formatMoney(totalExpense)}</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white px-3 py-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-stone-500">
              <PiggyBank className="h-3.5 w-3.5" aria-hidden />
              当天预算
            </p>
            <p className="mt-1 text-xl font-semibold text-stone-950">
              {dailyBudget ? formatMoney(dailyBudget.amount) : "未设置"}
            </p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white px-3 py-3">
            <p className="text-xs font-medium text-stone-500">剩余预算</p>
            <p className={`mt-1 text-xl font-semibold ${remainingClassName}`}>
              {remainingBudget === null ? "未设置" : formatMoney(remainingBudget)}
            </p>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
          <div className="space-y-3 rounded-lg border border-stone-200 bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold text-stone-900">当天支出列表</h4>
              <span className="text-xs text-stone-500">{expenses.length} 条</span>
            </div>
            {expenses.length === 0 ? (
              <p className="rounded-lg border border-dashed border-stone-200 bg-stone-50 px-3 py-6 text-center text-sm text-stone-500">
                今天还没有记录支出。
              </p>
            ) : (
              <div className="divide-y divide-stone-100">
                {expenses.map((expense) => (
                  <div key={expense.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-700">
                          {expense.category}
                        </span>
                        <span className="text-sm font-semibold text-stone-950">
                          {formatMoney(expense.amount)}
                        </span>
                      </div>
                      {expense.note ? (
                        <p className="mt-1 truncate text-xs text-stone-500">{expense.note}</p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => void handleDeleteExpense(expense.id)}
                      disabled={deletingExpenseId === expense.id}
                      aria-label="删除支出"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="rounded-lg border border-stone-200 bg-white p-3">
              <h4 className="text-sm font-semibold text-stone-900">添加支出</h4>
              <div className="mt-3 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="expense-amount">金额</Label>
                  <Input
                    id="expense-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    inputMode="decimal"
                    value={expenseAmount}
                    onChange={(event) => setExpenseAmount(event.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>分类</Label>
                  <Select value={expenseCategory} onValueChange={(value) => value && setExpenseCategory(value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {expenseCategories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="expense-note">备注</Label>
                  <Input
                    id="expense-note"
                    value={expenseNote}
                    onChange={(event) => setExpenseNote(event.target.value)}
                    placeholder="可选"
                  />
                </div>
                <Button
                  type="button"
                  className="w-full"
                  onClick={() => void handleAddExpense()}
                  disabled={savingExpense}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {savingExpense ? "添加中..." : "添加支出"}
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-stone-200 bg-white p-3">
              <h4 className="text-sm font-semibold text-stone-900">当天预算</h4>
              <div className="mt-3 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="daily-budget-amount">预算金额</Label>
                  <Input
                    id="daily-budget-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    inputMode="decimal"
                    value={budgetAmount}
                    onChange={(event) => setBudgetAmount(event.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => void handleSaveBudget()}
                  disabled={savingBudget}
                >
                  {savingBudget ? "保存中..." : dailyBudget ? "修改预算" : "设置预算"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
