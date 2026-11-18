type LinkedEvent = {
  isCompleted: boolean;
  linkedDailyTaskId?: string;
  recurrenceOverrides?: Record<string, {
    isCompleted?: boolean;
    linkedDailyTaskId?: string;
    [field: string]: unknown;
  }>;
};

export function updateEventsLinkedToDailyTask<T extends LinkedEvent>(
  events: T[],
  taskId: string,
  isCompleted: boolean,
): T[] {
  return events.map((event) => {
    const baseChanged = event.linkedDailyTaskId === taskId && event.isCompleted !== isCompleted;
    let overridesChanged = false;
    const nextOverrides = Object.fromEntries(
      Object.entries(event.recurrenceOverrides ?? {}).map(([date, override]) => {
        const effectiveTaskId = override.linkedDailyTaskId ?? event.linkedDailyTaskId;
        if (effectiveTaskId !== taskId || override.isCompleted === isCompleted) {
          return [date, override];
        }
        overridesChanged = true;
        return [date, { ...override, isCompleted }];
      }),
    );

    if (!baseChanged && !overridesChanged) return event;
    return {
      ...event,
      ...(baseChanged ? { isCompleted } : {}),
      ...(overridesChanged ? { recurrenceOverrides: nextOverrides } : {}),
    };
  });
}
