import { describe, expect, it } from "vitest";
import {
  doScheduleEventsOverlap,
  findNextAvailableScheduleSlot,
  getCenteredScrollTop,
  getScheduleEventVisualMetrics,
  getScheduleEventDurationHour,
  layoutOverlappingScheduleEvents,
  moveScheduleEvent,
  moveScheduleEvents,
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
  it("does not display zero-minute events left by floating-point time values", () => {
    expect(splitScheduleEventByDay(event({ startHour: 20.416666666666664, endHour: 20.416666666666668 }))).toEqual([]);
    expect(splitScheduleEventByDay(event({ startHour: 9, endHour: 9 }))).toEqual([]);
    expect(splitScheduleEventByDay(event({ startHour: 9, endHour: 9 + 1 / 60 }))).toHaveLength(1);
    expect(splitScheduleEventByDay(event({ startHour: 0, endHour: 24 }))).toHaveLength(1);
  });

  it("moves a group by the grabbed continuation and preserves every interval", () => {
    const events = [
      event({ id: "overnight", startHour: 23, endHour: 2 }),
      event({ id: "next-day", date: "2026-06-12", startHour: 8.25, endHour: 9 }),
      event({ id: "multi-day", endDate: "2026-06-14", startHour: 9, endHour: 10 }),
    ];
    const moved = moveScheduleEvents(events, "overnight", "2026-06-12", "2026-06-13", -0.5);

    expect(moved).toEqual([
      { ...events[0], date: "2026-06-12", startHour: 22.5, endHour: 1.5 },
      { ...events[1], date: "2026-06-13", startHour: 7.75, endHour: 8.5 },
      { ...events[2], date: "2026-06-12", endDate: "2026-06-15", startHour: 8.5, endHour: 9.5 },
    ]);
    expect(moved.map(getScheduleEventDurationHour)).toEqual(events.map(getScheduleEventDurationHour));
    expect(events[0].date).toBe("2026-06-11");
  });

  it("moves a group backwards across a month boundary with minute precision", () => {
    const events = [
      event({ id: "anchor", date: "2026-08-01", startHour: 0.5, endHour: 1 }),
      event({ id: "earlier", date: "2026-07-31", startHour: 1, endHour: 2 }),
    ];
    expect(moveScheduleEvents(events, "anchor", "2026-08-01", "2026-07-31", 23 + 29 / 60)).toEqual([
      { ...events[0], date: "2026-07-31", startHour: 23 + 29 / 60, endHour: 23 + 59 / 60 },
      { ...events[1], date: "2026-07-30", startHour: 23 + 59 / 60, endHour: 59 / 60 },
    ]);
  });

  it("moves a continuation across midnight and preserves the full interval", () => {
    expect(moveScheduleEvent(event({ startHour: 23, endHour: 2 }), "2026-06-12", "2026-06-12", -0.5)).toEqual({ date: "2026-06-11", startHour: 22.5, endHour: 1.5 });
    expect(moveScheduleEvent(event({ endDate: "2026-06-14", startHour: 9, endHour: 10 }), "2026-06-12", "2026-06-13", 2)).toEqual({ date: "2026-06-12", endDate: "2026-06-15", startHour: 11, endHour: 12 });
  });

  it("normalizes a start snapped to midnight and retains an ordinary midnight end", () => {
    expect(moveScheduleEvent(event({ startHour: 9, endHour: 10 }), "2026-06-11", "2026-06-11", 24)).toEqual({ date: "2026-06-12", startHour: 0, endHour: 1 });
    expect(moveScheduleEvent(event({ startHour: 9, endHour: 10 }), "2026-06-11", "2026-06-11", 23)).toEqual({ date: "2026-06-11", startHour: 23, endHour: 24 });
  });

  it("splits one continuous multi-day event and retains its original identity", () => {
    const source = event({ date: "2026-06-11", endDate: "2026-06-14", startHour: 9, endHour: 10 });
    const segments = splitScheduleEventByDay(source);
    expect(segments.map((item) => [item.displayDate, item.startHour, item.endHour])).toEqual([
      ["2026-06-11", 9, 24], ["2026-06-12", 0, 24], ["2026-06-13", 0, 24], ["2026-06-14", 0, 10],
    ]);
    expect(toSourceScheduleEvent(segments[2])).toEqual(source);
    expect(getScheduleEventDurationHour(source)).toBe(73);
  });
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
