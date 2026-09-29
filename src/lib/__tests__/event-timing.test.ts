import { describe, expect, it } from "vitest";
import { eventBufferName, eventTiming, nextEventTiming, normalizeBufferMinutes } from "@/lib/event-timing";
import { normalizeDashboardUiPreferences, normalizeEvents } from "@/lib/normalizers";
import { dailyCapacity } from "@/lib/execution-insights";
import { pickRecurrenceOverridePatch } from "@/lib/recurrence";

const event = (patch = {}) => normalizeEvents([{ id: "event", date: "2026-09-30", startHour: 10, endHour: 11, title: "看牙", bufferBeforeMinutes: 20, bufferAfterMinutes: 15, ...patch }])[0];

describe("event buffers and next event", () => {
  it("normalizes persisted buffers and preserves occurrence overrides", () => {
    expect(normalizeBufferMinutes(-5)).toBe(0);
    expect(normalizeBufferMinutes(Infinity)).toBe(0);
    expect(normalizeBufferMinutes(500)).toBe(180);
    expect(event({ bufferBeforeMinutes: 10.4 }).bufferBeforeMinutes).toBe(10);
    expect(event({ bufferBeforeName: "  通勤 · 去球场  ", bufferAfterName: 12 })).toMatchObject({ bufferBeforeName: "通勤 · 去球场", bufferAfterName: "" });
    expect(eventBufferName(event(), "before")).toBe("提前准备");
    expect(eventBufferName(event({ bufferAfterName: "回实验室" }), "after")).toBe("回实验室");
    expect(pickRecurrenceOverridePatch({ bufferBeforeMinutes: 30, bufferAfterMinutes: 10, bufferBeforeName: "去球场", bufferAfterName: "回实验室" })).toEqual({ bufferBeforeMinutes: 30, bufferAfterMinutes: 10, bufferBeforeName: "去球场", bufferAfterName: "回实验室" });
  });
  it("restores independent panel visibility while keeping older preferences expanded", () => {
    expect(normalizeDashboardUiPreferences({})).toMatchObject({ upNextSectionOpen: true, executionSectionOpen: true });
    expect(normalizeDashboardUiPreferences({ upNextSectionOpen: false, executionSectionOpen: true })).toMatchObject({ upNextSectionOpen: false, executionSectionOpen: true });
  });
  it("reserves buffers once without changing the actual event duration", () => {
    const timing = eventTiming(event());
    expect(timing.prepareAt).toEqual(new Date(2026, 8, 30, 9, 40));
    expect(timing.freeAt).toEqual(new Date(2026, 8, 30, 11, 15));
    const capacity = dailyCapacity([event(), event({ id: "overlap", startHour: 11, endHour: 12, bufferBeforeMinutes: 0, bufferAfterMinutes: 0 })], [], new Date(2026, 8, 30, 9), 9, 13);
    expect(capacity).toMatchObject({ occupied: 140, free: 100 });
  });
  it("includes tomorrow's preparation and yesterday's recovery in today's capacity", () => {
    const tomorrow = event({ date: "2026-10-01", startHour: 0, endHour: 1, bufferBeforeMinutes: 30, bufferAfterMinutes: 0 });
    expect(dailyCapacity([tomorrow], [], new Date(2026, 8, 30, 23), 0, 24).free).toBe(30);
    const yesterday = event({ date: "2026-09-29", startHour: 23, endHour: 24, bufferAfterMinutes: 30 });
    expect(dailyCapacity([yesterday], [], new Date(2026, 8, 30, 0), 0, 1).free).toBe(30);
  });
  it("transitions through preparation, event and recovery, then chooses the next event", () => {
    const events = [event(), event({ id: "later", startHour: 14, endHour: 15 })];
    expect(nextEventTiming(events, new Date(2026, 8, 30, 9))?.phase).toBe("待开始");
    expect(nextEventTiming(events, new Date(2026, 8, 30, 9, 40))?.phase).toBe("该准备了");
    expect(nextEventTiming(events, new Date(2026, 8, 30, 10))?.phase).toBe("进行中");
    expect(nextEventTiming(events, new Date(2026, 8, 30, 11))?.phase).toBe("结束后缓冲");
    expect(nextEventTiming(events, new Date(2026, 8, 30, 11, 15))?.event.id).toBe("later");
  });
  it("includes recovery from an overnight occurrence that began two dates ago", () => {
    const overnight = event({ date: "2026-09-28", startHour: 23.5, endHour: 23, bufferAfterMinutes: 180, recurrence: { kind: "daily" }, exceptionDates: ["2026-09-29", "2026-09-30"] });
    const now = new Date(2026, 8, 30, 0, 30);
    expect(nextEventTiming([overnight], now)?.phase).toBe("结束后缓冲");
    expect(nextEventTiming([overnight], now)?.freeAt).toEqual(new Date(2026, 8, 30, 2));
    expect(dailyCapacity([overnight], [], now, 0, 3)).toMatchObject({ free: 60, occupied: 90 });
  });
  it("respects recurrence exceptions, overrides and completed instances", () => {
    const recurring = event({ recurrence: { kind: "daily" }, exceptionDates: ["2026-10-01"], recurrenceOverrides: { "2026-09-30": { isCompleted: true }, "2026-10-02": { bufferBeforeMinutes: 60, bufferBeforeName: "提前去球场" } } });
    const next = nextEventTiming([recurring], new Date(2026, 8, 30, 9));
    expect(next?.event.id).toBe("event__2026-10-02");
    expect(next?.prepareAt).toEqual(new Date(2026, 9, 2, 9));
    expect(next?.event.bufferBeforeName).toBe("提前去球场");
  });
  it("handles overnight and multi-day events and counts buffer overlaps", () => {
    const overnight = event({ date: "2026-09-29", startHour: 23, endHour: 2 });
    expect(nextEventTiming([overnight], new Date(2026, 8, 30, 1))?.phase).toBe("进行中");
    const multi = event({ date: "2026-09-28", endDate: "2026-10-02" });
    expect(nextEventTiming([multi], new Date(2026, 8, 30, 1))?.phase).toBe("进行中");
    expect(nextEventTiming([event(), event({ id: "other", startHour: 11.1, endHour: 12 })], new Date(2026, 8, 30, 10))?.conflicts).toBe(1);
    expect(nextEventTiming([event({ isCompleted: true })], new Date(2026, 8, 30, 10))).toBeNull();
  });
});
