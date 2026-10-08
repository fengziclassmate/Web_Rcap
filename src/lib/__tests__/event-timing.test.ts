import { describe, expect, it } from "vitest";
import { eventTiming, nextEventTiming } from "@/lib/event-timing";
import { normalizeEvents } from "@/lib/normalizers";
import { dailyCapacity } from "@/lib/execution-insights";

const event = (patch = {}) => normalizeEvents([{ id: "event", date: "2026-09-30", startHour: 10, endHour: 11, title: "看牙", ...patch }])[0];

describe("event timing after removing buffers", () => {
  it("discards legacy buffers and preserves ordinary recurrence overrides", () => {
    const restored = event({ bufferBeforeMinutes: 20, bufferAfterMinutes: 15, bufferBeforeName: "通勤", recurrence: { kind: "daily" }, recurrenceOverrides: { "2026-10-01": { bufferBeforeMinutes: 30, bufferAfterName: "休息", title: "复查", startHour: 12 } } });
    expect(restored).not.toHaveProperty("bufferBeforeMinutes");
    expect(restored).not.toHaveProperty("bufferBeforeName");
    expect(restored.recurrenceOverrides?.["2026-10-01"]).toEqual({ title: "复查", startHour: 12 });
    expect(restored).toMatchObject({ startHour: 10, endHour: 11 });
  });
  it("counts only actual occupied time and unions overlapping events", () => {
    const legacy = event({ bufferBeforeMinutes: 20, bufferAfterMinutes: 15 });
    expect(eventTiming(legacy)).toMatchObject({ start: new Date(2026, 8, 30, 10), end: new Date(2026, 8, 30, 11) });
    expect(dailyCapacity([legacy], [], new Date(2026, 8, 30, 9), 9, 13)).toMatchObject({ occupied: 60, free: 180 });
    expect(dailyCapacity([legacy, event({ id: "overlap", startHour: 10.5, endHour: 12 })], [], new Date(2026, 8, 30, 9), 9, 13)).toMatchObject({ occupied: 120, free: 120 });
  });
  it("does not reserve time on adjacent dates from obsolete buffers", () => {
    const tomorrow = event({ date: "2026-10-01", startHour: 0, endHour: 1, bufferBeforeMinutes: 30 });
    expect(dailyCapacity([tomorrow], [], new Date(2026, 8, 30, 23), 0, 24).free).toBe(60);
    const yesterday = event({ date: "2026-09-29", startHour: 23, endHour: 24, bufferAfterMinutes: 30 });
    expect(dailyCapacity([yesterday], [], new Date(2026, 8, 30, 0), 0, 1).free).toBe(60);
  });
  it("moves from upcoming to active and directly to the next event on ending", () => {
    const events = [event(), event({ id: "later", startHour: 14, endHour: 15 })];
    expect(nextEventTiming(events, new Date(2026, 8, 30, 9, 40))?.phase).toBe("待开始");
    expect(nextEventTiming(events, new Date(2026, 8, 30, 10))?.phase).toBe("进行中");
    expect(nextEventTiming(events, new Date(2026, 8, 30, 11))?.event.id).toBe("later");
  });
  it("respects recurrence exceptions, overridden times and completed instances", () => {
    const recurring = event({ recurrence: { kind: "daily" }, exceptionDates: ["2026-10-01"], recurrenceOverrides: { "2026-09-30": { isCompleted: true }, "2026-10-02": { startHour: 12, endHour: 13 } } });
    const next = nextEventTiming([recurring], new Date(2026, 8, 30, 9));
    expect(next?.event.id).toBe("event__2026-10-02");
    expect(next?.start).toEqual(new Date(2026, 9, 2, 12));
  });
  it("handles overnight and multi-day events, including today's capacity", () => {
    const overnight = event({ date: "2026-09-29", startHour: 23, endHour: 2 });
    const now = new Date(2026, 8, 30, 1);
    expect(nextEventTiming([overnight], now)?.phase).toBe("进行中");
    expect(dailyCapacity([overnight], [], now, 0, 3)).toMatchObject({ occupied: 60, free: 60 });
    const multi = event({ date: "2026-09-28", endDate: "2026-10-02" });
    expect(nextEventTiming([multi], now)?.phase).toBe("进行中");
    expect(dailyCapacity([multi], [], now, 0, 3)).toMatchObject({ occupied: 120, free: 0 });
  });
  it("counts real overlaps, accepts adjacent events and excludes completed events", () => {
    const now = new Date(2026, 8, 30, 10);
    expect(nextEventTiming([event(), event({ id: "other", startHour: 10.5, endHour: 12 })], now)?.conflicts).toBe(1);
    expect(nextEventTiming([event(), event({ id: "other", startHour: 11, endHour: 12 })], now)?.conflicts).toBe(0);
    expect(nextEventTiming([event({ isCompleted: true })], now)).toBeNull();
  });
});
