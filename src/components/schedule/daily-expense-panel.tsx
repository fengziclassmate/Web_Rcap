"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CalendarRange,
  Check,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCw,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";
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

type BudgetPeriodType = "week" | "month";

type ExpenseRecord = {
  id: string;
  amount: number;
  category: string;
  category_main?: string;
  category_sub?: string;
  category_detail?: string;
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

type PeriodBudgetRecord = {
  id: string;
  amount: number;
  budget_type: BudgetPeriodType;
  period_start: string;
  created_at: string;
  updated_at: string;
};

type PeriodSummary = {
  type: BudgetPeriodType;
  periodStart: string;
  periodEnd: string;
  totalExpense: number;
  budget: PeriodBudgetRecord | null;
  remainingBudget: number | null;
};

type DaySummaryResponse = {
  date: string;
  expenses: ExpenseRecord[];
  totalExpense: number;
  dailyBudget: DailyBudgetRecord | null;
  remainingBudget: number | null;
  week: PeriodSummary;
  month: PeriodSummary;
};

type DailyExpensePanelProps = {
  date: string;
  title?: string;
  onChanged?: () => void;
};

type ExpenseCategoryBranch = { name: string; details: string[] };
type ExpenseCategoryGroup = { main: string; branches: ExpenseCategoryBranch[] };

const expenseCategoryTree: ExpenseCategoryGroup[] = [
  {
    main: "餐饮",
    branches: [
      { name: "正餐", details: ["早餐", "午餐", "晚餐", "夜宵"] },
      { name: "水果", details: ["苹果", "香蕉", "草莓", "葡萄", "其他水果"] },
      { name: "饮品", details: ["奶茶", "咖啡", "果茶", "矿泉水", "其他饮品"] },
      { name: "零食", details: ["甜点", "饼干", "坚果", "膨化食品"] },
    ],
  },
  {
    main: "交通",
    branches: [
      { name: "公共交通", details: ["地铁", "公交", "火车", "高铁"] },
      { name: "打车", details: ["网约车", "出租车", "顺风车"] },
      { name: "自驾", details: ["加油", "停车", "高速费", "保养"] },
    ],
  },
  {
    main: "购物",
    branches: [
      { name: "日用品", details: ["纸巾", "洗护", "清洁", "收纳"] },
      { name: "服饰", details: ["衣服", "鞋包", "配饰"] },
      { name: "数码", details: ["配件", "软件", "设备"] },
    ],
  },
  {
    main: "学习",
    branches: [
      { name: "课程", details: ["线上课", "线下课", "训练营"] },
      { name: "资料", details: ["书籍", "论文", "会员", "文具"] },
    ],
  },
  {
    main: "娱乐",
    branches: [
      { name: "休闲", details: ["电影", "游戏", "演出", "旅行"] },
      { name: "社交", details: ["聚餐", "礼物", "活动"] },
    ],
  },
  {
    main: "健康",
    branches: [
      { name: "医疗", details: ["挂号", "药品", "检查", "保险"] },
      { name: "运动", details: ["健身", "装备", "场地"] },
    ],
  },
  { main: "其他", branches: [{ name: "未分类", details: ["临时支出", "其他"] }] },
];

const moneyFormatter = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  minimumFractionDigits: 2,
});
const amountPattern = /^\d{1,10}(\.\d{1,2})?$/;

function getDefaultCategoryPath() {
  const main = expenseCategoryTree[0];
  const branch = main.branches[0];
  return { main: main.main, sub: branch.name, detail: branch.details[0] };
}

const defaultCategoryPath = getDefaultCategoryPath();

function getCategoryGroup(main: string) {
  return expenseCategoryTree.find((group) => group.main === main) ?? expenseCategoryTree[0];
}

function getCategoryBranch(main: string, sub: string) {
  const group = getCategoryGroup(main);
  return group.branches.find((branch) => branch.name === sub) ?? group.branches[0];
}

function getCategoryPathFromExpense(expense: ExpenseRecord) {
  if (expense.category_main) {
    const branch = getCategoryBranch(expense.category_main, expense.category_sub || "");
    return {
      main: expense.category_main,
      sub: expense.category_sub || branch.name,
      detail: expense.category_detail || branch.details[0],
    };
  }

  const [main, sub, detail] = expense.category.split("/").map((part) => part.trim());
  const group = getCategoryGroup(main || defaultCategoryPath.main);
  const branch = getCategoryBranch(group.main, sub || "");
  return { main: group.main, sub: branch.name, detail: detail || branch.details[0] };
}

function buildCategoryLabel(main: string, sub: string, detail: string) {
  return [main, sub, detail].filter(Boolean).join(" / ");
}

function formatMoney(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "未设置";
  return moneyFormatter.format(value);
}

function formatCompactMoney(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return moneyFormatter.format(value);
}

function isPositiveAmount(value: string) {
  if (!amountPattern.test(value.trim())) return false;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0;
}

function parseIsoDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function getBudgetPeriodRange(date: string, type: BudgetPeriodType) {
  const current = parseIsoDate(date);
  if (type === "month") {
    const start = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1));
    const nextMonth = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 1));
    return { periodStart: formatIsoDate(start), periodEnd: formatIsoDate(addDays(nextMonth, -1)) };
  }

  const mondayOffset = (current.getUTCDay() + 6) % 7;
  const start = addDays(current, -mondayOffset);
  return { periodStart: formatIsoDate(start), periodEnd: formatIsoDate(addDays(start, 6)) };
}

function createEmptySummary(date: string): DaySummaryResponse {
  const week = getBudgetPeriodRange(date, "week");
  const month = getBudgetPeriodRange(date, "month");
  return {
    date,
    expenses: [],
    totalExpense: 0,
    dailyBudget: null,
    remainingBudget: null,
    week: { type: "week", periodStart: week.periodStart, periodEnd: week.periodEnd, totalExpense: 0, budget: null, remainingBudget: null },
    month: { type: "month", periodStart: month.periodStart, periodEnd: month.periodEnd, totalExpense: 0, budget: null, remainingBudget: null },
  };
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
export function DailyExpensePanel({ date, title = "今日花销", onChanged }: DailyExpensePanelProps) {
  const [summaryCache, setSummaryCache] = useState<Record<string, DaySummaryResponse>>({});
  const [loadingDates, setLoadingDates] = useState<Record<string, boolean>>({});
  const [savingExpense, setSavingExpense] = useState(false);
  const [savingBudget, setSavingBudget] = useState<"day" | "week" | "month" | null>(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [updatingExpenseId, setUpdatingExpenseId] = useState<string | null>(null);
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategoryMain, setExpenseCategoryMain] = useState(defaultCategoryPath.main);
  const [expenseCategorySub, setExpenseCategorySub] = useState(defaultCategoryPath.sub);
  const [expenseCategoryDetail, setExpenseCategoryDetail] = useState(defaultCategoryPath.detail);
  const [expenseNote, setExpenseNote] = useState("");
  const [editExpenseAmount, setEditExpenseAmount] = useState("");
  const [editExpenseCategoryMain, setEditExpenseCategoryMain] = useState(defaultCategoryPath.main);
  const [editExpenseCategorySub, setEditExpenseCategorySub] = useState(defaultCategoryPath.sub);
  const [editExpenseCategoryDetail, setEditExpenseCategoryDetail] = useState(defaultCategoryPath.detail);
  const [editExpenseNote, setEditExpenseNote] = useState("");
  const [dailyBudgetAmount, setDailyBudgetAmount] = useState("");
  const [weeklyBudgetAmount, setWeeklyBudgetAmount] = useState("");
  const [monthlyBudgetAmount, setMonthlyBudgetAmount] = useState("");

  const summary = summaryCache[date] ?? createEmptySummary(date);
  const loading = Boolean(loadingDates[date]);
  const hasCachedSummary = Boolean(summaryCache[date]);

  const categorySubOptions = useMemo(
    () => getCategoryGroup(expenseCategoryMain).branches,
    [expenseCategoryMain],
  );
  const categoryDetailOptions = useMemo(
    () => getCategoryBranch(expenseCategoryMain, expenseCategorySub).details,
    [expenseCategoryMain, expenseCategorySub],
  );
  const editCategorySubOptions = useMemo(
    () => getCategoryGroup(editExpenseCategoryMain).branches,
    [editExpenseCategoryMain],
  );
  const editCategoryDetailOptions = useMemo(
    () => getCategoryBranch(editExpenseCategoryMain, editExpenseCategorySub).details,
    [editExpenseCategoryMain, editExpenseCategorySub],
  );

  const loadSummary = useCallback(async (targetDate: string, signal?: AbortSignal) => {
    setLoadingDates((prev) => ({ ...prev, [targetDate]: true }));
    try {
      const headers = await getAuthHeaders();
      if (signal?.aborted) return;
      const response = await fetch(`/api/day-summary?date=${encodeURIComponent(targetDate)}`, {
        headers,
        cache: "no-store",
        signal,
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const nextSummary = (await response.json()) as DaySummaryResponse;
      setSummaryCache((prev) => ({ ...prev, [targetDate]: nextSummary }));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      const message = error instanceof Error ? error.message : "加载花销失败。";
      toast.error(message);
    } finally {
      setLoadingDates((prev) => ({ ...prev, [targetDate]: false }));
    }
  }, []);

  useEffect(() => {
    setEditingExpenseId(null);
    const controller = new AbortController();
    void loadSummary(date, controller.signal);
    return () => controller.abort();
  }, [date, loadSummary]);

  useEffect(() => {
    setDailyBudgetAmount(summary.dailyBudget ? String(summary.dailyBudget.amount) : "");
    setWeeklyBudgetAmount(summary.week.budget ? String(summary.week.budget.amount) : "");
    setMonthlyBudgetAmount(summary.month.budget ? String(summary.month.budget.amount) : "");
  }, [date, summary.dailyBudget, summary.month.budget, summary.week.budget]);

  function handleExpenseMainChange(value: string | null) {
    if (!value) return;
    const group = getCategoryGroup(value);
    const branch = group.branches[0];
    setExpenseCategoryMain(group.main);
    setExpenseCategorySub(branch.name);
    setExpenseCategoryDetail(branch.details[0]);
  }

  function handleExpenseSubChange(value: string | null) {
    if (!value) return;
    const branch = getCategoryBranch(expenseCategoryMain, value);
    setExpenseCategorySub(branch.name);
    setExpenseCategoryDetail(branch.details[0]);
  }

  function handleEditExpenseMainChange(value: string | null) {
    if (!value) return;
    const group = getCategoryGroup(value);
    const branch = group.branches[0];
    setEditExpenseCategoryMain(group.main);
    setEditExpenseCategorySub(branch.name);
    setEditExpenseCategoryDetail(branch.details[0]);
  }

  function handleEditExpenseSubChange(value: string | null) {
    if (!value) return;
    const branch = getCategoryBranch(editExpenseCategoryMain, value);
    setEditExpenseCategorySub(branch.name);
    setEditExpenseCategoryDetail(branch.details[0]);
  }

  async function refreshAfterMutation() {
    await loadSummary(date);
    onChanged?.();
  }

  async function handleAddExpense() {
    if (!isPositiveAmount(expenseAmount)) {
      toast.error("支出金额必须大于 0。");
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
          category: buildCategoryLabel(expenseCategoryMain, expenseCategorySub, expenseCategoryDetail),
          category_main: expenseCategoryMain,
          category_sub: expenseCategorySub,
          category_detail: expenseCategoryDetail,
          note: expenseNote,
          expense_date: date,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      setExpenseAmount("");
      setExpenseNote("");
      await refreshAfterMutation();
      toast.success("支出已添加。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "添加支出失败。";
      toast.error(message);
    } finally {
      setSavingExpense(false);
    }
  }

  async function handleSaveDailyBudget() {
    if (!isPositiveAmount(dailyBudgetAmount)) {
      toast.error("每日预算金额必须大于 0。");
      return;
    }

    setSavingBudget("day");
    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/daily-budget", {
        method: "POST",
        headers,
        body: JSON.stringify({ amount: dailyBudgetAmount, budget_date: date }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      await refreshAfterMutation();
      toast.success("每日预算已保存。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存每日预算失败。";
      toast.error(message);
    } finally {
      setSavingBudget(null);
    }
  }

  async function handleSavePeriodBudget(type: BudgetPeriodType, amount: string) {
    if (!isPositiveAmount(amount)) {
      toast.error(type === "week" ? "周预算金额必须大于 0。" : "月预算金额必须大于 0。");
      return;
    }

    setSavingBudget(type);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/period-budget", {
        method: "POST",
        headers,
        body: JSON.stringify({ type, amount, date }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      await refreshAfterMutation();
      toast.success(type === "week" ? "周预算已保存。" : "月预算已保存。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存预算失败。";
      toast.error(message);
    } finally {
      setSavingBudget(null);
    }
  }

  function handleStartEditExpense(expense: ExpenseRecord) {
    const path = getCategoryPathFromExpense(expense);
    setEditingExpenseId(expense.id);
    setEditExpenseAmount(String(expense.amount));
    setEditExpenseCategoryMain(path.main);
    setEditExpenseCategorySub(path.sub);
    setEditExpenseCategoryDetail(path.detail);
    setEditExpenseNote(expense.note ?? "");
  }

  function handleCancelEditExpense() {
    setEditingExpenseId(null);
    setEditExpenseAmount("");
    setEditExpenseCategoryMain(defaultCategoryPath.main);
    setEditExpenseCategorySub(defaultCategoryPath.sub);
    setEditExpenseCategoryDetail(defaultCategoryPath.detail);
    setEditExpenseNote("");
  }

  async function handleUpdateExpense(expenseId: string) {
    if (!isPositiveAmount(editExpenseAmount)) {
      toast.error("支出金额必须大于 0。");
      return;
    }

    setUpdatingExpenseId(expenseId);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/expenses/${expenseId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          amount: editExpenseAmount,
          category: buildCategoryLabel(editExpenseCategoryMain, editExpenseCategorySub, editExpenseCategoryDetail),
          category_main: editExpenseCategoryMain,
          category_sub: editExpenseCategorySub,
          category_detail: editExpenseCategoryDetail,
          note: editExpenseNote,
          expense_date: date,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      handleCancelEditExpense();
      await refreshAfterMutation();
      toast.success("支出已更新。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "更新支出失败。";
      toast.error(message);
    } finally {
      setUpdatingExpenseId(null);
    }
  }

  async function handleDeleteExpense(expenseId: string) {
    setDeletingExpenseId(expenseId);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/expenses/${expenseId}`, { method: "DELETE", headers });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      await refreshAfterMutation();
      toast.success("支出已删除。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除支出失败。";
      toast.error(message);
    } finally {
      setDeletingExpenseId(null);
    }
  }

  const remainingClassName =
    summary.remainingBudget === null
      ? "text-stone-500"
      : summary.remainingBudget < 0
        ? "text-rose-600"
        : "text-emerald-700";
  return (
    <section className="border-t border-gray-200 bg-stone-50/80 px-4 py-4 sm:px-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold text-stone-950">
              <WalletCards className="h-4 w-4 text-stone-700" aria-hidden />
              {title}
            </h3>
            <p className="mt-0.5 text-xs text-stone-500">
              {date}
              {loading ? <span className="ml-2 text-stone-400">同步中</span> : null}
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => void loadSummary(date)} disabled={loading}>
            <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
            刷新
          </Button>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-lg border border-stone-200 bg-white px-3 py-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-stone-500">
              <ReceiptText className="h-3.5 w-3.5" aria-hidden />
              当天支出
            </p>
            <p className="mt-1 text-xl font-semibold text-stone-950">{formatMoney(summary.totalExpense)}</p>
            <p className={`mt-1 text-xs font-medium ${remainingClassName}`}>
              每日预算 {summary.dailyBudget ? formatMoney(summary.dailyBudget.amount) : "未设置"}，剩余 {formatMoney(summary.remainingBudget)}
            </p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white px-3 py-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-stone-500">
              <CalendarRange className="h-3.5 w-3.5" aria-hidden />
              本周预算
            </p>
            <p className="mt-1 text-xl font-semibold text-stone-950">
              {formatMoney(summary.week.totalExpense)}
              <span className="ml-1 text-sm font-medium text-stone-500">
                / {summary.week.budget ? formatMoney(summary.week.budget.amount) : "未设置"}
              </span>
            </p>
            <p className={summary.week.remainingBudget !== null && summary.week.remainingBudget < 0 ? "mt-1 text-xs font-medium text-rose-600" : "mt-1 text-xs font-medium text-emerald-700"}>
              {summary.week.periodStart} 至 {summary.week.periodEnd}，剩余 {formatMoney(summary.week.remainingBudget)}
            </p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white px-3 py-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-stone-500">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden />
              本月预算
            </p>
            <p className="mt-1 text-xl font-semibold text-stone-950">
              {formatMoney(summary.month.totalExpense)}
              <span className="ml-1 text-sm font-medium text-stone-500">
                / {summary.month.budget ? formatMoney(summary.month.budget.amount) : "未设置"}
              </span>
            </p>
            <p className={summary.month.remainingBudget !== null && summary.month.remainingBudget < 0 ? "mt-1 text-xs font-medium text-rose-600" : "mt-1 text-xs font-medium text-emerald-700"}>
              {summary.month.periodStart} 至 {summary.month.periodEnd}，剩余 {formatMoney(summary.month.remainingBudget)}
            </p>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
          <div className="space-y-3 rounded-lg border border-stone-200 bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold text-stone-900">当天支出列表</h4>
              <span className="text-xs text-stone-500">{summary.expenses.length} 条</span>
            </div>
            {loading && !hasCachedSummary ? (
              <p className="rounded-lg border border-dashed border-stone-200 bg-stone-50 px-3 py-6 text-center text-sm text-stone-500">
                正在加载这一天的支出。
              </p>
            ) : summary.expenses.length === 0 ? (
              <p className="rounded-lg border border-dashed border-stone-200 bg-stone-50 px-3 py-6 text-center text-sm text-stone-500">
                这一天还没有记录支出。
              </p>
            ) : (
              <div className="divide-y divide-stone-100">
                {summary.expenses.map((expense) => {
                  const isEditing = editingExpenseId === expense.id;
                  const isDeleting = deletingExpenseId === expense.id;
                  const isUpdating = updatingExpenseId === expense.id;
                  const categoryPath = getCategoryPathFromExpense(expense);

                  return (
                    <div key={expense.id} className="py-2.5">
                      {isEditing ? (
                        <div className="space-y-2 rounded-md border border-stone-200 bg-stone-50 p-2">
                          <div className="grid gap-2 lg:grid-cols-[96px_116px_116px_minmax(0,1fr)]">
                            <Input
                              type="number"
                              min="0.01"
                              step="0.01"
                              inputMode="decimal"
                              value={editExpenseAmount}
                              onChange={(event) => setEditExpenseAmount(event.target.value)}
                              aria-label="支出金额"
                              placeholder="0.00"
                            />
                            <Select value={editExpenseCategoryMain} onValueChange={handleEditExpenseMainChange}>
                              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {expenseCategoryTree.map((category) => (
                                  <SelectItem key={category.main} value={category.main}>{category.main}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select value={editExpenseCategorySub} onValueChange={handleEditExpenseSubChange}>
                              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {editCategorySubOptions.map((category) => (
                                  <SelectItem key={category.name} value={category.name}>{category.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select value={editExpenseCategoryDetail} onValueChange={(value) => value && setEditExpenseCategoryDetail(value)}>
                              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {editCategoryDetailOptions.map((category) => (
                                  <SelectItem key={category} value={category}>{category}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Input
                            value={editExpenseNote}
                            onChange={(event) => setEditExpenseNote(event.target.value)}
                            aria-label="支出备注"
                            placeholder="备注"
                          />
                          <div className="flex justify-end gap-2">
                            <Button type="button" size="sm" variant="ghost" onClick={handleCancelEditExpense} disabled={isUpdating}>
                              <X className="h-3.5 w-3.5" />
                              取消
                            </Button>
                            <Button type="button" size="sm" onClick={() => void handleUpdateExpense(expense.id)} disabled={isUpdating}>
                              <Check className="h-3.5 w-3.5" />
                              {isUpdating ? "保存中..." : "保存"}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-700">{categoryPath.main}</span>
                              <span className="rounded-md bg-stone-50 px-2 py-0.5 text-xs font-medium text-stone-600">
                                {categoryPath.sub} / {categoryPath.detail}
                              </span>
                              <span className="text-sm font-semibold text-stone-950">{formatMoney(expense.amount)}</span>
                            </div>
                            {expense.note ? <p className="mt-1 truncate text-xs text-stone-500">{expense.note}</p> : null}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              onClick={() => handleStartEditExpense(expense)}
                              disabled={Boolean(editingExpenseId) || isDeleting}
                              aria-label="编辑支出"
                            >
                              <Pencil className="h-3.5 w-3.5 text-stone-600" />
                            </Button>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              onClick={() => void handleDeleteExpense(expense.id)}
                              disabled={isDeleting || Boolean(editingExpenseId)}
                              aria-label="删除支出"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
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
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>一级分类</Label>
                    <Select value={expenseCategoryMain} onValueChange={handleExpenseMainChange}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {expenseCategoryTree.map((category) => (
                          <SelectItem key={category.main} value={category.main}>{category.main}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>二级分类</Label>
                    <Select value={expenseCategorySub} onValueChange={handleExpenseSubChange}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {categorySubOptions.map((category) => (
                          <SelectItem key={category.name} value={category.name}>{category.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>三级分类</Label>
                    <Select value={expenseCategoryDetail} onValueChange={(value) => value && setExpenseCategoryDetail(value)}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {categoryDetailOptions.map((category) => (
                          <SelectItem key={category} value={category}>{category}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="expense-note">备注</Label>
                  <Input id="expense-note" value={expenseNote} onChange={(event) => setExpenseNote(event.target.value)} placeholder="可选" />
                </div>
                <Button type="button" className="w-full" onClick={() => void handleAddExpense()} disabled={savingExpense}>
                  <Plus className="h-3.5 w-3.5" />
                  {savingExpense ? "添加中..." : "添加支出"}
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-stone-200 bg-white p-3">
              <h4 className="text-sm font-semibold text-stone-900">预算</h4>
              <div className="mt-3 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="daily-budget-amount">每日预算</Label>
                  <div className="flex gap-2">
                    <Input
                      id="daily-budget-amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      inputMode="decimal"
                      value={dailyBudgetAmount}
                      onChange={(event) => setDailyBudgetAmount(event.target.value)}
                      placeholder="0.00"
                    />
                    <Button type="button" variant="outline" onClick={() => void handleSaveDailyBudget()} disabled={savingBudget === "day"}>
                      {savingBudget === "day" ? "保存中" : "保存"}
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="weekly-budget-amount">周预算</Label>
                  <div className="flex gap-2">
                    <Input
                      id="weekly-budget-amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      inputMode="decimal"
                      value={weeklyBudgetAmount}
                      onChange={(event) => setWeeklyBudgetAmount(event.target.value)}
                      placeholder="0.00"
                    />
                    <Button type="button" variant="outline" onClick={() => void handleSavePeriodBudget("week", weeklyBudgetAmount)} disabled={savingBudget === "week"}>
                      {savingBudget === "week" ? "保存中" : "保存"}
                    </Button>
                  </div>
                  <p className="text-[11px] text-stone-500">
                    {summary.week.periodStart} 至 {summary.week.periodEnd}，当前 {formatCompactMoney(summary.week.totalExpense)}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="monthly-budget-amount">月预算</Label>
                  <div className="flex gap-2">
                    <Input
                      id="monthly-budget-amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      inputMode="decimal"
                      value={monthlyBudgetAmount}
                      onChange={(event) => setMonthlyBudgetAmount(event.target.value)}
                      placeholder="0.00"
                    />
                    <Button type="button" variant="outline" onClick={() => void handleSavePeriodBudget("month", monthlyBudgetAmount)} disabled={savingBudget === "month"}>
                      {savingBudget === "month" ? "保存中" : "保存"}
                    </Button>
                  </div>
                  <p className="text-[11px] text-stone-500">
                    {summary.month.periodStart} 至 {summary.month.periodEnd}，当前 {formatCompactMoney(summary.month.totalExpense)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}