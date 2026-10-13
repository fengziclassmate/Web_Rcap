import { useState } from "react";
import { format, subDays } from "date-fns";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { defaultDashboardUiPreferences } from "@/lib/normalizers";
import type { DashboardUiPreferences, ProjectCheckin } from "@/lib/types";
import { TaskDashboard } from "../task-dashboard";

vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }) } },
}));

function ControlledProjectDashboard({ today, initiallyCollapsed = false, archiveDate }: { today: string; initiallyCollapsed?: boolean; archiveDate?: string }) {
  const [projects, setProjects] = useState<ProjectCheckin[]>([
    {
      id: "first",
      name: "受控待打卡项目一",
      description: "",
      startDate: today,
      checkins: [],
      archives: [],
      dailyCheckins: archiveDate ? [{ id: "water", label: "喝水", time: "07:50" }] : [],
      dailyCompletions: archiveDate ? [{ date: archiveDate, slotId: "water", completedAt: `${archiveDate}T07:50:00` }] : [],
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
    projectSectionOpen: !initiallyCollapsed,
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

describe("TaskDashboard task list sections", () => {
  it("opens past daily check-ins from the toolbar without an inline archive", () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const archiveDate = format(subDays(new Date(), 1), "yyyy-MM-dd");
    render(<ControlledProjectDashboard today={today} archiveDate={archiveDate} />);
    const row = screen.getByRole("group", { name: "项目与生活记录" });
    fireEvent.click(within(row).getByRole("button", { name: "日常打卡" }));
    const content = within(screen.getByRole("region", { name: "日常打卡" }));
    expect(content.queryByText("历史归档")).toBeNull();
    expect(content.queryByText(archiveDate)).toBeNull();
    const archiveButton = screen.getByRole("button", { name: "查看日常打卡归档库" });
    expect(row.parentElement!.contains(archiveButton)).toBe(true);
    expect(row.parentElement!.contains(screen.getByRole("button", { name: "添加日常打卡" }))).toBe(true);
    fireEvent.click(archiveButton);
    const archive = within(screen.getByRole("dialog", { name: "日常打卡归档库" }));
    expect(archive.getByText(archiveDate)).toBeTruthy();
    expect(archive.getByText("喝水")).toBeTruthy();
    expect(archive.getByText("已打卡")).toBeTruthy();
    expect(archive.getByText("1/1")).toBeTruthy();
    expect(archive.queryByText(today)).toBeNull();
  });

  it("switches rows independently and allows both rows to collapse", () => {
    render(<ControlledProjectDashboard today="2026-09-29" initiallyCollapsed />);
    expect(screen.queryByRole("button", { name: "今日执行" })).toBeNull();
    expect(screen.queryByRole("button", { name: "目标与项目" })).toBeNull();
    expect(screen.queryByRole("button", { name: "生活记录" })).toBeNull();
    expect(screen.getByPlaceholderText("添加日常任务")).toBeTruthy();
    expect(screen.getByRole("region", { name: "跟进事项" })).toBeTruthy();
    const tasks = within(screen.getByRole("group", { name: "任务与清单" }));
    const utilities = within(screen.getByRole("group", { name: "项目与生活记录" }));
    expect(tasks.getAllByRole("button")).toHaveLength(3);
    expect(utilities.getAllByRole("button")).toHaveLength(4);
    expect([...tasks.getAllByRole("button"), ...utilities.getAllByRole("button")].every((button) => button.getAttribute("aria-expanded") === "false")).toBe(true);
    fireEvent.click(utilities.getByRole("button", { name: "项目" }));
    for (const name of ["长期任务", "年度任务", "购物清单"]) {
      fireEvent.click(tasks.getByRole("button", { name }));
      expect(screen.getByRole("region", { name })).toBeTruthy();
      expect(screen.getByRole("region", { name: "项目" })).toBeTruthy();
      expect(tasks.getAllByRole("button").filter((button) => button.getAttribute("aria-expanded") === "true")).toHaveLength(1);
    }
    expect(screen.getByRole("button", { name: "添加购物项" })).toBeTruthy();
    fireEvent.click(tasks.getByRole("button", { name: "购物清单" }));
    for (const name of ["日常打卡", "成就", "足迹"]) {
      fireEvent.click(utilities.getByRole("button", { name }));
      expect(screen.getByRole("region", { name })).toBeTruthy();
      expect(screen.queryByRole("region", { name: "项目" })).toBeNull();
    }
    fireEvent.click(utilities.getByRole("button", { name: "足迹" }));
    expect([...tasks.getAllByRole("button"), ...utilities.getAllByRole("button")].every((button) => button.getAttribute("aria-expanded") === "false")).toBe(true);
  });

  it("places context actions beside the selectors and research above the task row", () => {
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
        uiPreferences={{ ...defaultDashboardUiPreferences, longTaskSectionOpen: true }}
        onUiPreferencesChange={onUiPreferencesChange}
      />,
    );

    const taskListGroup = screen.getByTestId("task-list-panel-group");
    expect(within(taskListGroup).queryByRole("tablist")).toBeNull();
    expect(within(taskListGroup).queryByRole("heading", { name: "长期任务" })).toBeNull();
    expect(within(taskListGroup).queryByRole("heading", { name: "年度任务" })).toBeNull();
    expect(within(taskListGroup).getByText("当前没有未完成长期任务")).toBeTruthy();

    const addButton = screen.getByRole("button", { name: "添加长期任务" });
    expect(taskListGroup.contains(addButton)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "年度任务" }));
    expect(onUiPreferencesChange).toHaveBeenCalledWith(expect.objectContaining({ annualSectionOpen: true, longTaskSectionOpen: false, shoppingSectionOpen: false }));

    const completedTaskButton = screen.getByRole("button", { name: /查看已完成任务/ });
    const toolbar = screen.getByRole("group", { name: "任务与清单" }).parentElement!;
    expect(toolbar.contains(completedTaskButton)).toBe(true);
    expect(toolbar.contains(addButton)).toBe(true);
    expect(completedTaskButton.textContent?.trim()).toBe("");
    expect(
      screen.getByTestId("research-progress-panel").compareDocumentPosition(
        taskListGroup,
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    expect(screen.getByRole("region", { name: "跟进事项" }).compareDocumentPosition(taskListGroup) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);

    fireEvent.click(addButton);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("opens the shopping add dialog from its visible section", () => {
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
          longTaskSectionOpen: false,
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
    expect(within(movedCard!).queryByRole("button", { name: "打卡日历" })).toBeNull();
    fireEvent.click(titleButton);
    expect(within(movedCard!).getByRole("button", { name: "打卡日历" })).toBeTruthy();
    fireEvent.click(within(movedCard!).getByRole("button", { name: "折叠项目 受控待打卡项目一" }));
    expect(within(movedCard!).queryByRole("button", { name: "打卡日历" })).toBeNull();
  });
});
