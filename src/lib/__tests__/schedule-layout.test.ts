import { describe, expect, it } from "vitest";
import {
  doScheduleEventsOverlap,
  findNextAvailableScheduleSlot,
  getCenteredScrollTop,
  getScheduleEventVisualMetrics,
  getScheduleEventDurationHour,
  layoutOverlappingScheduleEvents,
  splitScheduleEventByDay,
  toSourceScheduleEvent,
} from "../schedule-layout";
import type { ScheduleEvent } from "../types";

function event(patch: Partial<ScheduleEvent> = {}): ScheduleEvent {
  return {
    id: "evt-1",
    date: "2026-06-11",
    startHour: 9,
    endHour: 10,
    title: "Event",
    notes: "",
    requirements: [],
    isCompleted: false,
    category: "深度科研",
    tag: null,
    ...patch,
  };
}

describe("schedule event layout", () => {
  it("calculates the selected time position within its own dropdown", () => {
    expect(
      getCenteredScrollTop({
        currentScrollTop: 120,
        containerTop: 200,
        containerHeight: 240,
        itemTop: 310,
        itemHeight: 40,
      }),
    ).toBe(130);
  });

  it("treats touching events as non-overlapping", () => {
    expect(
      doScheduleEventsOverlap(
        event({ id: "a", startHour: 9, endHour: 10 }),
        event({ id: "b", startHour: 10, endHour: 11 }),
      ),
    ).toBe(false);
  });

  it("places a short event immediately after an occupied target interval", () => {
    expect(
      findNextAvailableScheduleSlot({
        events: [event({ id: "occupied", startHour: 9, endHour: 9.25 })],
        excludeEventId: "dragged",
        targetDate: "2026-06-11",
        targetStartHour: 9,
        durationHour: 0.25,
      }),
    ).toEqual({
      date: "2026-06-11",
      startHour: 9.25,
      endHour: 9.5,
    });
  });

  it("skips consecutive conflicts but keeps an exact free gap", () => {
    const occupiedEvents = [
      event({ id: "first", startHour: 9, endHour: 9.25 }),
      event({ id: "second", startHour: 9.25, endHour: 9.5 }),
      event({ id: "later", startHour: 10, endHour: 11 }),
    ];

    expect(
      findNextAvailableScheduleSlot({
        events: occupiedEvents,
        excludeEventId: "dragged",
        targetDate: "2026-06-11",
        targetStartHour: 9,
        durationHour: 0.25,
      }),
    ).toEqual({
      date: "2026-06-11",
      startHour: 9.5,
      endHour: 9.75,
    });
  });

  it("does not claim a free slot beyond the expanded collision window", () => {
    expect(
      findNextAvailableScheduleSlot({
        events: [event({ id: "late", startHour: 23.75, endHour: 0 })],
        excludeEventId: "dragged",
        targetDate: "2026-06-11",
        targetStartHour: 23.75,
        durationHour: 0.25,
        searchThroughDate: "2026-06-11",
      }),
    ).toBeNull();
  });

  it("keeps adjacent short event cards inside their real time ranges", () => {
    const shortEvent = getScheduleEventVisualMetrics(
      event({ startHour: 0.75, endHour: 1 }),
      72,
    );
    const nextEvent = getScheduleEventVisualMetrics(
      event({ startHour: 1, endHour: 1.75 }),
      72,
    );

    expect(shortEvent.top + shortEvent.height).toBeLessThanOrEqual(nextEvent.top);
    expect(shortEvent.height).toBeLessThan(18);
  });

  it("keeps a chained conflict group on one consistent lane count", () => {
    const positioned = layoutOverlappingScheduleEvents([
      event({ id: "a", startHour: 9, endHour: 10 }),
      event({ id: "b", startHour: 9.5, endHour: 10.5 }),
      event({ id: "c", startHour: 10, endHour: 11 }),
    ]);

    expect(positioned.map((item) => [item.id, item.lane, item.laneCount])).toEqual([
      ["a", 0, 2],
      ["b", 1, 2],
      ["c", 0, 2],
    ]);
  });

  it("allocates one lane per simultaneous event", () => {
    const positioned = layoutOverlappingScheduleEvents([
      event({ id: "a", startHour: 9, endHour: 11 }),
      event({ id: "b", startHour: 9.25, endHour: 10.25 }),
      event({ id: "c", startHour: 9.5, endHour: 10.5 }),
    ]);

    expect(positioned.map((item) => item.laneCount)).toEqual([3, 3, 3]);
    expect(new Set(positioned.map((item) => item.lane))).toEqual(new Set([0, 1, 2]));
  });

  it("splits a cross-day event into start and continuation display segments", () => {
    const segments = splitScheduleEventByDay(
      event({ id: "sleep", date: "2026-06-11", startHour: 22, endHour: 7 }),
    );

    expect(
      segments.map((segment) => ({
        displayDate: segment.displayDate,
        startHour: segment.startHour,
        endHour: segment.endHour,
        role: segment.segmentRole,
      })),
    ).toEqual([
      { displayDate: "2026-06-11", startHour: 22, endHour: 24, role: "starts" },
      { displayDate: "2026-06-12", startHour: 0, endHour: 7, role: "continues" },
    ]);
    expect(toSourceScheduleEvent(segments[1])).toMatchObject({
      id: "sleep",
      date: "2026-06-11",
      startHour: 22,
      endHour: 7,
    });
  });

  it("calculates duration across midnight", () => {
    expect(getScheduleEventDurationHour(event({ startHour: 22, endHour: 7 }))).toBe(9);
    expect(getScheduleEventDurationHour(event({ startHour: 22, endHour: 24 }))).toBe(2);
  });
});
