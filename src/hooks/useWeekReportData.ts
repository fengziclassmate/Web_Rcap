"use client";

import { useMemo } from "react";
import type { Achievement } from "@/lib/legacy-research";
import { buildWeeklyReportData } from "@/lib/report/weekly-report";
import type { LongTask, ScheduleEvent } from "@/lib/types";

export function useWeekReportData(
  currentWeekStart: Date,
  events: ScheduleEvent[],
  tasks: LongTask[],
  achievements: Achievement[],
) {
  return useMemo(
    () => buildWeeklyReportData(currentWeekStart, events, tasks, achievements),
    [achievements, currentWeekStart, events, tasks],
  );
}
