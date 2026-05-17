"use client";

import { useMemo } from "react";
import { addDays, format, isSameDay, parseISO } from "date-fns";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { LongTask } from "@/lib/types";

type WeeklyTaskTrendProps = {
  tasks: LongTask[];
  currentWeekStart: Date;
};

export function WeeklyTaskTrend({ tasks, currentWeekStart }: WeeklyTaskTrendProps) {
  const data = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = addDays(currentWeekStart, index);
        const dueTasks = tasks.filter((task) => {
          if (!task.dueDate) return false;
          return isSameDay(parseISO(task.dueDate), date);
        });
        return {
          date: format(date, "MM/dd"),
          total: dueTasks.length,
          done: dueTasks.filter((task) => task.done).length,
          pending: dueTasks.filter((task) => !task.done).length,
        };
      }),
    [currentWeekStart, tasks],
  );

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-900">本周任务趋势</h3>
        <p className="text-xs text-gray-500">按截止日期统计任务完成与待处理数量。</p>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: -22, right: 12, top: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#9ca3af" />
            <Tooltip />
            <Line type="monotone" dataKey="done" name="已完成" stroke="#2f8f72" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="pending" name="待处理" stroke="#d8893a" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
