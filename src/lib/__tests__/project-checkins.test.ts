import { describe, expect, it } from "vitest";
import {
  archiveProjectCheckinCycle,
  isProjectCheckinDateInCurrentCycle,
} from "../project-checkins";
import type { ProjectCheckin } from "../types";

describe("project check-in archives", () => {
  it("moves the current cycle into history and restarts the counter", () => {
    const project: ProjectCheckin = {
      id: "fitness",
      name: "健身",
      description: "",
      startDate: "2026-01-01",
      checkins: [
        { date: "2026-01-03", note: "深蹲" },
        { date: "2026-01-02", note: "跑步" },
      ],
      archives: [],
      dailyCheckins: [],
      dailyCompletions: [],
    };

    const restarted = archiveProjectCheckinCycle(project, "2026-08-19", "archive-1");

    expect(restarted.startDate).toBe("2026-08-19");
    expect(restarted.checkins).toEqual([]);
    expect(restarted.archives[0]).toMatchObject({
      id: "archive-1",
      startDate: "2026-01-01",
      endDate: "2026-01-03",
      checkins: [
        { date: "2026-01-02", note: "跑步" },
        { date: "2026-01-03", note: "深蹲" },
      ],
    });
    expect(isProjectCheckinDateInCurrentCycle(restarted, "2026-08-18")).toBe(false);
    expect(isProjectCheckinDateInCurrentCycle(restarted, "2026-08-19")).toBe(true);
  });
});
