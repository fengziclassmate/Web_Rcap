import { describe, expect, it } from "vitest";
import {
  parseExpenseInput,
  parseExpenseUpdateInput,
  sumBudgetExpenses,
  type ExpenseDto,
} from "../expense-api";

function expense(amount: number, excludedFromBudget = false): ExpenseDto {
  return {
    id: `expense-${amount}-${excludedFromBudget}`,
    amount,
    category: "交通 / 打车 / 网约车",
    category_main: "交通",
    category_sub: "打车",
    category_detail: "网约车",
    note: "",
    expense_date: "2026-08-02",
    excluded_from_budget: excludedFromBudget,
    created_at: "2026-08-02T08:00:00.000Z",
    updated_at: "2026-08-02T08:00:00.000Z",
  };
}

describe("expense budget totals", () => {
  it("keeps tagged business expenses out of the personal budget total", () => {
    expect(sumBudgetExpenses([expense(28), expense(360, true), expense(12.5)])).toBe(40.5);
  });

  it("persists the exclusion tag while legacy expense input remains in budget", () => {
    const baseInput = {
      amount: "88.50",
      category_main: "工作",
      category_sub: "差旅",
      category_detail: "交通",
      expense_date: "2026-08-02",
      note: "会议出差",
    };

    expect(
      parseExpenseInput({ ...baseInput, excluded_from_budget: true }).value?.excluded_from_budget,
    ).toBe(true);
    expect(parseExpenseInput(baseInput).value?.excluded_from_budget).toBe(false);
    expect(parseExpenseUpdateInput(baseInput).value).not.toHaveProperty("excluded_from_budget");
    expect(
      parseExpenseUpdateInput({ ...baseInput, excluded_from_budget: false }).value,
    ).toHaveProperty("excluded_from_budget", false);
    expect(
      parseExpenseUpdateInput({ ...baseInput, excludedFromBudget: true }).value,
    ).toHaveProperty("excluded_from_budget", true);
  });
});
