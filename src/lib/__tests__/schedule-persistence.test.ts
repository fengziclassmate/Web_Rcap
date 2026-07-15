import { beforeEach, describe, expect, it } from "vitest";
import { defaultDashboardUiPreferences } from "../normalizers";
import {
  readDashboardUiPreferencesFromLocal,
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
});
