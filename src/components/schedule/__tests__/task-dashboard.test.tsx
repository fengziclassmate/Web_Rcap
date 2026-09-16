import { useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { defaultDashboardUiPreferences } from "@/lib/normalizers";
import type { DashboardUiPreferences, ProjectCheckin } from "@/lib/types";
import { TaskDashboard } from "../task-dashboard";

function ControlledProjectDashboard({ today }: { today: string }) {
  const [projects, setProjects] = useState<ProjectCheckin[]>([
    {
      id: "first",
      name: "受控待打卡项目一",
      description: "",
      startDate: today,
      checkins: [],
      archives: [],
      dailyCheckins: [],
      dailyCompletions: [],
    },
    {
      id: "second",
      name: "受控待打卡项目二",
      description: "",
      startDate: today,
      checkins: [],
      archives: [],
      dailyCheckins: [],
      dailyCompletions: [],
    },
  ]);
  const [preferences, setPreferences] = useState<DashboardUiPreferences>({
    ...defaultDashboardUiPreferences,
    projectSectionOpen: true,
    expandedProjects: ["first"],
  });
  const noop = () => undefined;

  return (
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
      onReorderShoppingItem={noop}
      logPosts={[]}
      onCreateLogPost={async () => true}
      onOpenLogs={noop}
      onCreateDailyTaskTimeBlock={noop}
      projectCheckins={projects}
      onAddProjectCheckin={noop}
      onCheckinProject={(projectId, date, note) => {
        setProjects((current) =>
          current.map((project) =>
            project.id === projectId
              ? { ...project, checkins: [...project.checkins, { date, note }] }
              : project,
          ),
        );
      }}
      onReorderProjectCheckin={noop}
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
      uiPreferences={preferences}
      onUiPreferencesChange={setPreferences}
    />
  );
}

describe("TaskDashboard annual section", () => {
  it("groups annual and shopping lists and places completed tasks beside long tasks", () => {
    const noop = vi.fn();
    const onUiPreferencesChange = vi.fn();
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
        onReorderShoppingItem={noop}
        logPosts={[]}
        onCreateLogPost={vi.fn(async () => true)}
        onOpenLogs={noop}
        onCreateDailyTaskTimeBlock={noop}
        projectCheckins={[]}
        onAddProjectCheckin={noop}
        onCheckinProject={noop}
        onReorderProjectCheckin={noop}
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
        onUiPreferencesChange={onUiPreferencesChange}
      />,
    );

    const planningGroup = screen.getByTestId("annual-shopping-panel-group");
    const planningTabs = within(planningGroup).getByRole("tablist", { name: "年度任务与购物清单" });
    expect(within(planningTabs).getByRole("tab", { name: /年度任务/ }).getAttribute("aria-selected")).toBe("true");
    expect(within(planningTabs).getByRole("tab", { name: /购物清单/ }).getAttribute("aria-selected")).toBe("false");

    const addButton = screen.getByRole("button", { name: "添加年度任务" });
    expect(planningGroup.contains(addButton)).toBe(true);
    fireEvent.click(within(planningTabs).getByRole("tab", { name: /购物清单/ }));
    expect(onUiPreferencesChange).toHaveBeenCalledWith(
      expect.objectContaining({ annualSectionOpen: false, shoppingSectionOpen: true }),
    );

    const longTaskTrigger = screen.getByRole("button", { name: "折叠长期任务" });
    const completedTaskButton = screen.getByRole("button", { name: /查看已完成任务/ });
    expect(completedTaskButton.parentElement).toBe(longTaskTrigger.parentElement);
    expect(
      planningGroup.compareDocumentPosition(
        screen.getByTestId("research-progress-panel"),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);

    fireEvent.click(addButton);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("opens the shopping add dialog from the shared planning controls", () => {
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
        onReorderShoppingItem={noop}
        logPosts={[]}
        onCreateLogPost={vi.fn(async () => true)}
        onOpenLogs={noop}
        onCreateDailyTaskTimeBlock={noop}
        projectCheckins={[]}
        onAddProjectCheckin={noop}
        onCheckinProject={noop}
        onReorderProjectCheckin={noop}
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
        uiPreferences={{
          ...defaultDashboardUiPreferences,
          annualSectionOpen: false,
          shoppingSectionOpen: true,
        }}
        onUiPreferencesChange={noop}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "添加购物项" }));
    expect(screen.getByRole("dialog", { name: "添加购物项" })).toBeTruthy();
  });

  it("prioritizes unchecked projects, collapses today's check-in, and reorders pending projects", async () => {
    const noop = vi.fn();
    const onCheckinProject = vi.fn();
    const onReorderProjectCheckin = vi.fn();
    const onUiPreferencesChange = vi.fn();
    const now = new Date();
    const today = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
    const projectBase = {
      description: "",
      startDate: today,
      archives: [],
      dailyCheckins: [],
      dailyCompletions: [],
    };

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
        onReorderShoppingItem={noop}
        logPosts={[]}
        onCreateLogPost={vi.fn(async () => true)}
        onOpenLogs={noop}
        onCreateDailyTaskTimeBlock={noop}
        projectCheckins={[
          { ...projectBase, id: "done", name: "今日已打卡项目", checkins: [{ date: today, note: "" }] },
          { ...projectBase, id: "first", name: "待打卡项目一", checkins: [] },
          { ...projectBase, id: "second", name: "待打卡项目二", checkins: [] },
        ]}
        onAddProjectCheckin={noop}
        onCheckinProject={onCheckinProject}
        onReorderProjectCheckin={onReorderProjectCheckin}
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
        uiPreferences={{
          ...defaultDashboardUiPreferences,
          projectSectionOpen: true,
          expandedProjects: ["first"],
        }}
        onUiPreferencesChange={onUiPreferencesChange}
      />,
    );

    const cards = screen.getAllByTestId("project-checkin-card");
    expect(cards.map((card) => card.textContent)).toEqual([
      expect.stringContaining("待打卡项目一"),
      expect.stringContaining("待打卡项目二"),
      expect.stringContaining("今日已打卡项目"),
    ]);

    fireEvent.dragStart(screen.getByRole("button", { name: /移动项目 待打卡项目二/ }), {
      dataTransfer: {
        effectAllowed: "none",
        setData: vi.fn(),
      },
    });
    fireEvent.dragOver(cards[0]);
    fireEvent.drop(cards[0]);
    expect(onReorderProjectCheckin).toHaveBeenCalledWith("second", "first");

    fireEvent.keyDown(screen.getByRole("button", { name: /移动项目 待打卡项目一/ }), {
      key: "ArrowDown",
    });
    expect(onReorderProjectCheckin).toHaveBeenNthCalledWith(2, "first", "second");

    fireEvent.click(within(cards[0]).getByRole("button", { name: "打卡" }));
    expect(onCheckinProject).toHaveBeenCalledWith("first", today, "");
    expect(onUiPreferencesChange).toHaveBeenCalledWith(
      expect.objectContaining({ expandedProjects: [] }),
    );
    expect(screen.getByTestId("project-sort-status").textContent).toContain(
      "待打卡项目一已打卡、已收起并移到下方",
    );
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: /项目 待打卡项目一$/ }),
      );
    });
  });

  it("keeps focus after a controlled checked project collapses and moves", async () => {
    const now = new Date();
    const today = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
    render(<ControlledProjectDashboard today={today} />);

    const firstCard = document.querySelector<HTMLElement>(
      '[data-project-checkin-id="first"]',
    );
    expect(firstCard).toBeTruthy();
    fireEvent.click(within(firstCard!).getByRole("button", { name: "打卡" }));

    await waitFor(() => {
      expect(
        screen
          .getAllByTestId("project-checkin-card")
          .map((card) => card.getAttribute("data-project-checkin-id")),
      ).toEqual(["second", "first"]);
    });

    const movedCard = document.querySelector<HTMLElement>(
      '[data-project-checkin-id="first"]',
    );
    expect(movedCard).toBeTruthy();
    expect(within(movedCard!).queryByRole("button", { name: "打卡" })).toBeNull();
    const titleButton = within(movedCard!).getByRole("button", {
      name: "展开项目 受控待打卡项目一",
    });
    await waitFor(() => expect(document.activeElement).toBe(titleButton));
  });
});
