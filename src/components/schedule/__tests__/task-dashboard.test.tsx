import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { defaultDashboardUiPreferences } from "@/lib/normalizers";
import { TaskDashboard } from "../task-dashboard";

describe("TaskDashboard annual section", () => {
  it("keeps the add action in the title row before the collapse affordance", () => {
    const noop = vi.fn();
    render(
      <TaskDashboard
        tasks={[]}
        events={[]}
        onToggleTask={noop}
        onAddTask={noop}
        onUpdateTask={noop}
        onDeleteTask={noop}
        onReorderTask={noop}
        annualTasks={[]}
        onAddAnnualTask={noop}
        onToggleAnnualTask={noop}
        onDeleteAnnualTask={noop}
        onUpdateAnnualTask={noop}
        onReorderAnnualTask={noop}
        shoppingItems={[]}
        onAddShoppingItem={noop}
        onToggleShoppingItem={noop}
        onDeleteShoppingItem={noop}
        logPosts={[]}
        onCreateLogPost={vi.fn(async () => true)}
        onOpenLogs={noop}
        onCreateDailyTaskTimeBlock={noop}
        projectCheckins={[]}
        onAddProjectCheckin={noop}
        onCheckinProject={noop}
        onArchiveProjectCheckin={noop}
        onDeleteProjectCheckin={noop}
        onUpdateProjectCheckin={noop}
        onUpdateRoutineCheckins={noop}
        onUpdateProjectCheckinEntry={noop}
        onDeleteProjectCheckinEntry={noop}
        achievements={[]}
        onAddAchievement={noop}
        onUpdateAchievement={noop}
        onDeleteAchievement={noop}
        footprints={[]}
        onAddFootprint={noop}
        onResetFootprint={noop}
        onDeleteFootprint={noop}
        onUpdateFootprint={noop}
        confirmDangerousActions={false}
        uiPreferences={{ ...defaultDashboardUiPreferences, annualSectionOpen: true }}
        onUiPreferencesChange={noop}
      />,
    );

    const collapseTrigger = screen.getByRole("button", { name: "折叠年度任务清单" });
    const addButton = screen.getByRole("button", { name: "添加年度任务" });

    expect(addButton.parentElement).toBe(collapseTrigger.parentElement);
    expect(addButton.className).toContain("right-9");
    expect(collapseTrigger.querySelector("svg")?.className.baseVal).toContain("right-3");
    expect(
      collapseTrigger.compareDocumentPosition(screen.getByTestId("shopping-list")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    expect(
      screen.getByTestId("shopping-list").compareDocumentPosition(
        screen.getByTestId("research-progress-panel"),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);

    fireEvent.click(addButton);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
