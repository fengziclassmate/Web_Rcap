import { describe, expect, it } from "vitest";
import {
  buildSplitTailPlacements,
  getSplitTailSlot,
  normalizeScheduleTemplates,
} from "../schedule-templates";

describe("schedule templates", () => {
  it("uses a ready-to-apply rest template when storage is empty", () => {
    expect(normalizeScheduleTemplates(null)).toEqual([
      expect.objectContaining({ title: "休息", category: "休息" }),
    ]);
  });

  it("builds the 10-minute tail of every selected hour for a 50+10 grid", () => {
    const result = buildSplitTailPlacements({
      dates: [
        { date: "2026-07-13", weekday: 1 },
        { date: "2026-07-14", weekday: 2 },
      ],
      weekdays: [1, 2],
      startHour: 9,
      endHour: 12,
      granularity: "50-10",
      busyIntervals: [],
    });

    expect(result.placements).toHaveLength(6);
    expect(result.placements[0]).toEqual({
      date: "2026-07-13",
      startHour: 9 + 50 / 60,
      endHour: 10,
    });
    expect(result.skipped).toBe(0);
  });

  it("skips tail slots that already contain another event", () => {
    const result = buildSplitTailPlacements({
      dates: [{ date: "2026-07-13", weekday: 1 }],
      weekdays: [1],
      startHour: 9,
      endHour: 11,
      granularity: "50-10",
      busyIntervals: [{ date: "2026-07-13", startHour: 9.9, endHour: 10.1 }],
    });

    expect(result.placements).toEqual([
      { date: "2026-07-13", startHour: 10 + 50 / 60, endHour: 11 },
    ]);
    expect(result.skipped).toBe(1);
  });

  it("uses a 15-minute tail for a 45+15 grid", () => {
    expect(getSplitTailSlot("45-15")).toEqual({ offsetMinutes: 45, durationMinutes: 15 });
  });
});
