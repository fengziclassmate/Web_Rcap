import { describe, expect, it } from "vitest";
import {
  buildSplitTailPlacements,
  getSplitTailSlot,
  normalizeScheduleTemplates,
  migrateScheduleTemplates,
} from "../schedule-templates";
import { normalizePersistedSchedulePayload } from "../schedule-persistence";
import { mergeScheduleChanges } from "../schedule-merge";

describe("schedule templates", () => {
  it("imports account-local templates once without resurrecting deleted cloud templates", () => {
    localStorage.clear();
    const local = normalizeScheduleTemplates([{ id: "local", title: "本地模板", notes: "地点", requirements: ["材料"], tag: "深度专注" }]);
    localStorage.setItem("schedule-event-templates-v1:owner", JSON.stringify(local));
    const migrated = migrateScheduleTemplates(undefined, "owner");
    expect(migrated.map((item) => item.title)).toEqual(["休息", "本地模板"]);
    expect(migrateScheduleTemplates([], "owner")).toEqual([]);
    expect(migrateScheduleTemplates(undefined, "another").map((item) => item.title)).toEqual(["休息"]);
  });
  it("retains template content/order in the sync payload and merges additions from two devices", () => {
    const base = normalizePersistedSchedulePayload({})!;
    const first = normalizeScheduleTemplates([{ id: "a", title: "科研", notes: "地点", requirements: ["材料"] }])[0];
    const second = { ...first, id: "b", title: "读书" };
    const local = normalizePersistedSchedulePayload({ ...base, ui_preferences: { ...base.ui_preferences, scheduleTemplates: [first, ...base.ui_preferences.scheduleTemplates!] } })!;
    const remote = normalizePersistedSchedulePayload({ ...base, ui_preferences: { ...base.ui_preferences, scheduleTemplates: [...base.ui_preferences.scheduleTemplates!, second] } })!;
    const result = mergeScheduleChanges(base, local, remote);
    expect(result.conflicts).toEqual([]);
    expect(result.value.ui_preferences.scheduleTemplates).toContainEqual(first);
    expect(result.value.ui_preferences.scheduleTemplates).toContainEqual(second);
    expect(normalizePersistedSchedulePayload(JSON.parse(JSON.stringify(local)))!.ui_preferences.scheduleTemplates?.[0]).toEqual(first);
  });
  it("retains lifestyle tags when loading saved templates", () => {
    const tags = ["深度专注", "充电一下", "小挑战", "期待已久", "顺路办", "一起完成"];
    expect(normalizeScheduleTemplates(tags.map((tag) => ({ title: "活动", tag }))).map((template) => template.tag)).toEqual(tags);
  });
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
