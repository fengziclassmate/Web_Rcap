import { beforeEach, describe, expect, it } from "vitest";
import { defaultDashboardUiPreferences } from "../normalizers";
import {
  getScheduleBackupStorageKey,
  readDashboardUiPreferencesFromLocal,
  readScheduleBackupFromLocal,
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
});
