import { beforeEach, describe, expect, it } from "vitest";
import { defaultDashboardUiPreferences } from "../normalizers";
import {
  getScheduleBackupStorageKey,
  readDashboardUiPreferencesFromLocal,
  readScheduleBackupFromLocal,
  writeScheduleBackupToLocal,
  writeDashboardUiPreferencesToLocal,
} from "../schedule-persistence";

describe("schedule UI preference persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("restores time granularity and every task dashboard expansion state", () => {
    const preferences = {
      ...defaultDashboardUiPreferences,
      timeGranularity: "50-10" as const,
      annualSectionOpen: false,
      shoppingSectionOpen: false,
      longTaskSectionOpen: false,
      dailyArchiveSectionOpen: true,
      projectSectionOpen: false,
      routineCheckinSectionOpen: false,
      achievementSectionOpen: true,
      footprintSectionOpen: false,
      expandedTasks: ["task-1"],
      expandedCompletedTasks: ["task-2"],
      expandedProjects: ["project-1"],
      expandedFootprints: ["footprint-1"],
    };

    writeDashboardUiPreferencesToLocal(preferences);

    expect(readDashboardUiPreferencesFromLocal()).toEqual(preferences);
  });

  it("restores shopping items from the local account backup", () => {
    localStorage.setItem(
      getScheduleBackupStorageKey("user-1"),
      JSON.stringify({
        shopping_items: [
          {
            id: "shopping-1",
            name: "移动硬盘",
            addedAt: "2026-08-03T03:20:00.000Z",
            done: false,
          },
        ],
      }),
    );

    expect(readScheduleBackupFromLocal("user-1")?.shopping_items).toEqual([
      {
        id: "shopping-1",
        name: "移动硬盘",
        addedAt: "2026-08-03T03:20:00.000Z",
        done: false,
      },
    ]);
  });

  it("ignores retired execution continuity data in an older local backup", () => {
    localStorage.setItem(
      getScheduleBackupStorageKey("user-legacy"),
      JSON.stringify({
        events: [],
        tasks: [],
        continuity_state: {
          recoveryPacks: [{ id: "legacy-pack", title: "旧恢复包" }],
          outcomes: [{ id: "legacy-outcome" }],
        },
      }),
    );

    const restored = readScheduleBackupFromLocal("user-legacy");

    expect(restored).not.toBeNull();
    expect(restored).not.toHaveProperty("continuity_state");
    expect(restored?.events).toEqual([]);
    expect(restored?.tasks).toEqual([]);
  });

  it("preserves retired module data when refreshing the active local backup", () => {
    const storageKey = getScheduleBackupStorageKey("user-retired-modules");
    localStorage.setItem(storageKey, JSON.stringify({
      research_projects: [{ id: "research-1", name: "历史项目" }],
      paper_progress: { title: "历史论文" },
      submissions: [{ id: "submission-1" }],
      group_meetings: [{ id: "meeting-1" }],
    }));

    writeScheduleBackupToLocal("user-retired-modules", {
      events: [],
      tasks: [],
      annual_tasks: [],
      shopping_items: [],
      project_checkins: [],
      footprints: [],
      achievements: [],
      ui_preferences: defaultDashboardUiPreferences,
    });

    expect(JSON.parse(localStorage.getItem(storageKey) ?? "{}")).toMatchObject({
      research_projects: [{ id: "research-1", name: "历史项目" }],
      paper_progress: { title: "历史论文" },
      submissions: [{ id: "submission-1" }],
      group_meetings: [{ id: "meeting-1" }],
      events: [],
    });
  });
});
