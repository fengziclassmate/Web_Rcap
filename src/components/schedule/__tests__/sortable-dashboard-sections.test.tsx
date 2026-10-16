import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SortableDashboardSections } from "../sortable-dashboard-sections";
import { defaultDashboardSectionOrder, moveDashboardSection, normalizeDashboardSectionOrder, type DashboardSectionId } from "@/lib/dashboard-sections";
import { normalizeDashboardUiPreferences } from "@/lib/normalizers";
import { getScheduleBackupStorageKey, readScheduleBackupFromLocal, normalizePersistedSchedulePayload } from "@/lib/schedule-persistence";
import { mergeScheduleChanges } from "@/lib/schedule-merge";

function Console() {
  const [order, setOrder] = useState<DashboardSectionId[]>();
  return <SortableDashboardSections order={order} onOrderChange={setOrder} sections={[
    { id: "daily", content: <input aria-label="未提交的任务" defaultValue="" /> },
    { id: "research", content: <p>科研记录</p> },
    { id: "boards", content: <p>项目表入口</p> },
  ]} />;
}

const visibleOrder = () => Array.from(screen.getByTestId("dashboard-section-list").children).map((node) => node.getAttribute("data-dashboard-section"));

describe("task console module layout", () => {
  it("restores valid saved IDs, removes duplicates and appends newly available modules", () => {
    expect(normalizeDashboardSectionOrder(["research", "retired", "research", null, "daily"])).toEqual(["research", "daily", ...defaultDashboardSectionOrder.filter((id) => id !== "research" && id !== "daily")]);
    expect(normalizeDashboardSectionOrder(null)).toEqual(defaultDashboardSectionOrder);
    expect(moveDashboardSection(defaultDashboardSectionOrder, "research", "daily")[0]).toBe("research");
  });

  it("moves real DOM sections with buttons while retaining unsaved input", () => {
    render(<Console />);
    fireEvent.change(screen.getByLabelText("未提交的任务"), { target: { value: "保留我的草稿" } });
    fireEvent.click(screen.getByRole("button", { name: "调整顺序" }));
    fireEvent.click(screen.getByRole("button", { name: "上移今日科研进展" }));
    expect(visibleOrder()).toEqual(["research", "daily", "boards"]);
    fireEvent.click(screen.getByRole("button", { name: "完成排序" }));
    expect((screen.getByLabelText("未提交的任务") as HTMLInputElement).value).toBe("保留我的草稿");
    expect(screen.getByRole("status").textContent).toContain("今日科研进展已移到第 1 位");
  });

  it("supports keyboard movement and restores the default layout", () => {
    render(<Console />);
    fireEvent.click(screen.getByRole("button", { name: "调整顺序" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "拖动排序：科研与自学" }), { key: "ArrowUp" });
    expect(visibleOrder()).toEqual(["daily", "boards", "research"]);
    fireEvent.click(screen.getByRole("button", { name: "恢复默认模块顺序" }));
    expect(visibleOrder()).toEqual(["daily", "research", "boards"]);
  });

  it("reorders only drags started at a module handle", () => {
    render(<Console />);
    const target = screen.getByTestId("dashboard-section-list").firstElementChild!;
    fireEvent.dragStart(screen.getByLabelText("未提交的任务"));
    fireEvent.drop(target);
    expect(visibleOrder()).toEqual(["daily", "research", "boards"]);
    fireEvent.click(screen.getByRole("button", { name: "调整顺序" }));
    const dataTransfer = { setData: () => {}, effectAllowed: "", dropEffect: "" };
    fireEvent.dragStart(screen.getByRole("button", { name: "拖动排序：今日科研进展" }), { dataTransfer });
    fireEvent.dragOver(target, { dataTransfer, clientY: -1 });
    fireEvent.drop(target, { dataTransfer, clientY: -1 });
    expect(visibleOrder()).toEqual(["research", "daily", "boards"]);
  });

  it("persists order in the account backup and detects competing device layouts", () => {
    const order = moveDashboardSection(defaultDashboardSectionOrder, "research", "daily");
    const prefs = normalizeDashboardUiPreferences({ dashboardSectionOrder: order, projectBoardsSectionOpen: false });
    localStorage.setItem(getScheduleBackupStorageKey("layout-owner"), JSON.stringify({ ui_preferences: prefs }));
    expect(readScheduleBackupFromLocal("layout-owner")?.ui_preferences).toEqual(prefs);
    expect(readScheduleBackupFromLocal("another-owner")).toBeNull();
    const base = normalizePersistedSchedulePayload({})!;
    const local = { ...base, ui_preferences: prefs };
    const remote = { ...base, ui_preferences: { ...base.ui_preferences, dashboardSectionOrder: moveDashboardSection(defaultDashboardSectionOrder, "boards", "daily") } };
    expect(mergeScheduleChanges(base, local, remote).conflicts).toEqual(["schedule.ui_preferences.dashboardSectionOrder"]);
  });
});
