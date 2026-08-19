import { describe, expect, it } from "vitest";
import {
  detachDeletedMeetingRecords,
  reconcileMeetingRecordLinks,
} from "../meeting-record-links";
import type { ScheduleEvent } from "../types";

const baseEvent: ScheduleEvent = {
  id: "meeting-event",
  date: "2026-08-20",
  startHour: 9,
  endHour: 10,
  title: "组会",
  notes: "",
  requirements: [],
  isCompleted: true,
  meetingRecordId: "meeting-1",
  category: "会议",
  tag: null,
};

describe("meeting record links", () => {
  it("reopens direct and recurring meetings when their record is deleted", () => {
    const [direct, recurring] = detachDeletedMeetingRecords([
      baseEvent,
      {
        ...baseEvent,
        id: "recurring-meeting",
        meetingRecordId: undefined,
        recurrence: { kind: "daily" },
        recurrenceOverrides: {
          "2026-08-20": { isCompleted: true, meetingRecordId: "meeting-1" },
        },
      },
    ], new Set(["meeting-1"]));

    expect(direct).toMatchObject({ isCompleted: false, meetingRecordId: undefined });
    expect(recurring.recurrenceOverrides?.["2026-08-20"]).toEqual({ isCompleted: false });
  });

  it("repairs dangling links against the authoritative meeting set", () => {
    const [repaired] = reconcileMeetingRecordLinks([baseEvent], new Set());
    expect(repaired).toMatchObject({ isCompleted: false, meetingRecordId: undefined });
  });
});
