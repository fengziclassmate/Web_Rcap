import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DailyExpensePanel } from "../daily-expense-panel";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { access_token: "test-token" } },
      })),
    },
  },
}));

const emptySummary = {
  date: "2026-08-02",
  expenses: [],
  totalExpense: 0,
  dailyBudget: null,
  remainingBudget: null,
  week: {
    type: "week",
    periodStart: "2026-07-27",
    periodEnd: "2026-08-02",
    totalExpense: 0,
    budget: null,
    remainingBudget: null,
  },
  month: {
    type: "month",
    periodStart: "2026-08-01",
    periodEnd: "2026-08-31",
    totalExpense: 0,
    budget: null,
    remainingBudget: null,
  },
};

describe("DailyExpensePanel", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify(emptySummary), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
  });

  it("offers a compact tag for expenses that should not use the personal budget", async () => {
    render(<DailyExpensePanel date="2026-08-02" />);

    expect(await screen.findByRole("switch", { name: "不计入个人预算" })).toBeTruthy();
    expect(screen.getByText("适合出差、报销或代垫支出")).toBeTruthy();
  });

  it("collapses and restores the expense details from the title row", async () => {
    render(<DailyExpensePanel date="2026-08-02" title="本周花销" />);

    expect(await screen.findByRole("button", { name: "折叠本周花销" })).toBeTruthy();
    expect(screen.getByText("当天支出列表")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "折叠本周花销" }));
    expect(screen.queryByText("当天支出列表")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "展开本周花销" }));
    expect(screen.getByText("当天支出列表")).toBeTruthy();
  });

  it("sends the budget exclusion tag when adding a business expense", async () => {
    render(<DailyExpensePanel date="2026-08-02" />);

    fireEvent.change(await screen.findByLabelText("金额"), { target: { value: "128.50" } });
    fireEvent.click(screen.getByRole("switch", { name: "不计入个人预算" }));
    fireEvent.click(screen.getByRole("button", { name: "添加支出" }));

    await waitFor(() => {
      const postCall = vi.mocked(fetch).mock.calls.find(
        ([url, init]) => url === "/api/expenses" && init?.method === "POST",
      );
      expect(postCall).toBeTruthy();
      expect(JSON.parse(String(postCall?.[1]?.body))).toEqual(
        expect.objectContaining({
          amount: "128.50",
          excluded_from_budget: true,
        }),
      );
    });
  });
});
