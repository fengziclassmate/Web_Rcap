import { describe, expect, it } from "vitest";
import {
  doScheduleEventsOverlap,
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
  it("treats touching events as non-overlapping", () => {
    expect(
      doScheduleEventsOverlap(
        event({ id: "a", startHour: 9, endHour: 10 }),
        event({ id: "b", startHour: 10, endHour: 11 }),
      ),
    ).toBe(false);
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
