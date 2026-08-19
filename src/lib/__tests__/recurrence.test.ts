import { describe, expect, it } from "vitest";
import { expandScheduleEvents, type ExpandableScheduleEvent } from "../recurrence";

function event(patch: Partial<ExpandableScheduleEvent> = {}): ExpandableScheduleEvent {
  return {
    id: "evt-1",
    date: "2026-05-01",
    startHour: 9,
    endHour: 10,
    title: "Base event",
    notes: "",
    requirements: [],
    isCompleted: false,
    category: "task",
    tag: null,
    ...patch,
  };
}

describe("expandScheduleEvents", () => {
  it("returns non-recurring events inside the range", () => {
    const result = expandScheduleEvents([event()], "2026-05-01", "2026-05-07");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("evt-1");
  });

  it("omits non-recurring events outside the range", () => {
    const result = expandScheduleEvents([event()], "2026-05-02", "2026-05-07");
    expect(result).toEqual([]);
  });

  it("expands daily recurrence within the range", () => {
    const result = expandScheduleEvents(
      [event({ recurrence: { kind: "daily" } })],
      "2026-05-01",
      "2026-05-03",
    );
    expect(result.map((item) => item.date)).toEqual(["2026-05-01", "2026-05-02", "2026-05-03"]);
    expect(result[1].id).toBe("evt-1__2026-05-02");
  });

  it("expands weekly recurrence only on selected weekdays", () => {
    const result = expandScheduleEvents(
      [event({ date: "2026-05-04", recurrence: { kind: "weekly", weekdays: [1, 3] } })],
      "2026-05-04",
      "2026-05-10",
    );
    expect(result.map((item) => item.date)).toEqual(["2026-05-04", "2026-05-06"]);
  });

  it("skips exception dates", () => {
    const result = expandScheduleEvents(
      [event({ recurrence: { kind: "daily" }, exceptionDates: ["2026-05-02"] })],
      "2026-05-01",
      "2026-05-03",
    );
    expect(result.map((item) => item.date)).toEqual(["2026-05-01", "2026-05-03"]);
  });

  it("applies recurrence overrides", () => {
    const result = expandScheduleEvents(
      [
        event({
          recurrence: { kind: "daily" },
          recurrenceOverrides: {
            "2026-05-02": { title: "Changed", isCompleted: true, meetingRecordId: "meeting-1" },
          },
        }),
      ],
      "2026-05-02",
      "2026-05-02",
    );
    expect(result[0]).toMatchObject({
      title: "Changed",
      isCompleted: true,
      meetingRecordId: "meeting-1",
      date: "2026-05-02",
    });
  });

  it("respects recurrenceEndExclusive", () => {
    const result = expandScheduleEvents(
      [event({ recurrence: { kind: "daily" }, recurrenceEndExclusive: "2026-05-03" })],
      "2026-05-01",
      "2026-05-05",
    );
    expect(result.map((item) => item.date)).toEqual(["2026-05-01", "2026-05-02"]);
  });
});
