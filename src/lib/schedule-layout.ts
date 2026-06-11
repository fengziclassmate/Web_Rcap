import type { ScheduleEvent } from "@/lib/types";

export type PositionedScheduleEvent = ScheduleEvent & {
  lane: number;
  laneCount: number;
  conflictGroupId: string;
};

export function doScheduleEventsOverlap(a: ScheduleEvent, b: ScheduleEvent) {
  return a.startHour < b.endHour && b.startHour < a.endHour;
}

function sortScheduleEvents(events: ScheduleEvent[]) {
  return [...events].sort((a, b) => {
    if (a.startHour !== b.startHour) return a.startHour - b.startHour;
    if (a.endHour !== b.endHour) return b.endHour - a.endHour;
    return a.id.localeCompare(b.id);
  });
}

function splitConflictGroups(sortedEvents: ScheduleEvent[]) {
  const groups: ScheduleEvent[][] = [];
  let currentGroup: ScheduleEvent[] = [];
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

export function layoutOverlappingScheduleEvents(
  dayEvents: ScheduleEvent[],
): PositionedScheduleEvent[] {
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
