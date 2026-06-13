import type { ScheduleEvent } from "@/lib/types";

export type ScheduleEventSegmentRole = "single" | "starts" | "continues";

export type ScheduleEventSegment<TEvent extends ScheduleEvent = ScheduleEvent> = TEvent & {
  segmentId: string;
  sourceId: string;
  sourceDate: string;
  sourceStartHour: number;
  sourceEndHour: number;
  displayDate: string;
  segmentRole: ScheduleEventSegmentRole;
  continuesFromPreviousDay: boolean;
  continuesToNextDay: boolean;
};

export type PositionedScheduleEvent<TEvent extends ScheduleEvent = ScheduleEvent> = TEvent & {
  lane: number;
  laneCount: number;
  conflictGroupId: string;
};

const dayHourCount = 24;

export function doScheduleEventsOverlap(a: ScheduleEvent, b: ScheduleEvent) {
  return a.startHour < b.endHour && b.startHour < a.endHour;
}

export function isCrossDayScheduleEvent(event: Pick<ScheduleEvent, "startHour" | "endHour">) {
  return event.endHour < event.startHour;
}

export function getScheduleEventDurationHour(
  event: Pick<ScheduleEvent, "startHour" | "endHour">,
) {
  if (event.endHour > event.startHour) return event.endHour - event.startHour;
  if (event.endHour < event.startHour) return dayHourCount - event.startHour + event.endHour;
  return 0;
}

function addDaysToIsoDate(dateIso: string, amount: number) {
  const [year, month, day] = dateIso.split("-").map(Number);
  const date = new Date(year, month - 1, day + amount);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function getSegmentBase<TEvent extends ScheduleEvent>(event: TEvent) {
  return {
    sourceId: event.id,
    sourceDate: event.date,
    sourceStartHour: event.startHour,
    sourceEndHour: event.endHour,
  };
}

export function splitScheduleEventByDay<TEvent extends ScheduleEvent>(
  event: TEvent,
): ScheduleEventSegment<TEvent>[] {
  const segmentBase = getSegmentBase(event);
  if (!isCrossDayScheduleEvent(event)) {
    return [
      {
        ...event,
        ...segmentBase,
        segmentId: `${event.id}::${event.date}::single`,
        displayDate: event.date,
        segmentRole: "single",
        continuesFromPreviousDay: false,
        continuesToNextDay: false,
      },
    ];
  }

  const segments: ScheduleEventSegment<TEvent>[] = [];
  if (event.startHour < dayHourCount) {
    segments.push({
      ...event,
      ...segmentBase,
      segmentId: `${event.id}::${event.date}::starts`,
      displayDate: event.date,
      startHour: event.startHour,
      endHour: dayHourCount,
      segmentRole: "starts",
      continuesFromPreviousDay: false,
      continuesToNextDay: true,
    });
  }

  if (event.endHour > 0) {
    const nextDate = addDaysToIsoDate(event.date, 1);
    segments.push({
      ...event,
      ...segmentBase,
      segmentId: `${event.id}::${nextDate}::continues`,
      displayDate: nextDate,
      startHour: 0,
      endHour: event.endHour,
      segmentRole: "continues",
      continuesFromPreviousDay: true,
      continuesToNextDay: false,
    });
  }

  return segments;
}

export function toSourceScheduleEvent<TEvent extends ScheduleEvent>(
  segment: ScheduleEventSegment<TEvent>,
): TEvent {
  const event = { ...segment } as TEvent & Partial<ScheduleEventSegment<TEvent>>;
  delete event.segmentId;
  delete event.sourceId;
  delete event.sourceDate;
  delete event.sourceStartHour;
  delete event.sourceEndHour;
  delete event.displayDate;
  delete event.segmentRole;
  delete event.continuesFromPreviousDay;
  delete event.continuesToNextDay;

  return {
    ...event,
    id: segment.sourceId,
    date: segment.sourceDate,
    startHour: segment.sourceStartHour,
    endHour: segment.sourceEndHour,
  } as TEvent;
}

function sortScheduleEvents<TEvent extends ScheduleEvent>(events: TEvent[]) {
  return [...events].sort((a, b) => {
    if (a.startHour !== b.startHour) return a.startHour - b.startHour;
    if (a.endHour !== b.endHour) return b.endHour - a.endHour;
    return a.id.localeCompare(b.id);
  });
}

function splitConflictGroups<TEvent extends ScheduleEvent>(sortedEvents: TEvent[]) {
  const groups: TEvent[][] = [];
  let currentGroup: TEvent[] = [];
  let currentGroupEndHour = -Infinity;

  sortedEvents.forEach((event) => {
    if (currentGroup.length === 0 || event.startHour < currentGroupEndHour) {
      currentGroup.push(event);
      currentGroupEndHour = Math.max(currentGroupEndHour, event.endHour);
      return;
    }

    groups.push(currentGroup);
    currentGroup = [event];
    currentGroupEndHour = event.endHour;
  });

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

export function layoutOverlappingScheduleEvents<TEvent extends ScheduleEvent>(
  dayEvents: TEvent[],
): PositionedScheduleEvent<TEvent>[] {
  return splitConflictGroups(sortScheduleEvents(dayEvents)).flatMap((group, groupIndex) => {
    const laneEndHours: number[] = [];
    const positioned = group.map((event) => {
      let lane = laneEndHours.findIndex((laneEndHour) => event.startHour >= laneEndHour);
      if (lane === -1) {
        lane = laneEndHours.length;
      }

      laneEndHours[lane] = event.endHour;
      return { event, lane };
    });
    const laneCount = Math.max(1, laneEndHours.length);
    const conflictGroupId = `group-${groupIndex}`;

    return positioned.map(({ event, lane }) => ({
      ...event,
      lane,
      laneCount,
      conflictGroupId,
    }));
  });
}
