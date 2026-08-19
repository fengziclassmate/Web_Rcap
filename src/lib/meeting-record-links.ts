import type { ScheduleEvent } from "@/lib/types";

export function detachDeletedMeetingRecords(
  events: ScheduleEvent[],
  removedMeetingIds: ReadonlySet<string>,
) {
  if (removedMeetingIds.size === 0) return events;

  return events.map((event) => {
    let nextEvent = event;
    let changed = false;

    if (event.meetingRecordId && removedMeetingIds.has(event.meetingRecordId)) {
      nextEvent = { ...nextEvent, isCompleted: false, meetingRecordId: undefined };
      changed = true;
    }

    if (event.recurrenceOverrides) {
      const nextOverrides = { ...event.recurrenceOverrides };
      let overridesChanged = false;
      for (const [date, override] of Object.entries(event.recurrenceOverrides)) {
        if (override.meetingRecordId && removedMeetingIds.has(override.meetingRecordId)) {
          const nextOverride = { ...override, isCompleted: false };
          delete nextOverride.meetingRecordId;
          nextOverrides[date] = nextOverride;
          overridesChanged = true;
        }
      }
      if (overridesChanged) {
        nextEvent = { ...nextEvent, recurrenceOverrides: nextOverrides };
        changed = true;
      }
    }

    return changed ? nextEvent : event;
  });
}

export function reconcileMeetingRecordLinks(
  events: ScheduleEvent[],
  availableMeetingIds: ReadonlySet<string>,
) {
  const danglingIds = new Set<string>();
  for (const event of events) {
    if (event.meetingRecordId && !availableMeetingIds.has(event.meetingRecordId)) {
      danglingIds.add(event.meetingRecordId);
    }
    for (const override of Object.values(event.recurrenceOverrides ?? {})) {
      if (override.meetingRecordId && !availableMeetingIds.has(override.meetingRecordId)) {
        danglingIds.add(override.meetingRecordId);
      }
    }
  }
  return detachDeletedMeetingRecords(events, danglingIds);
}
