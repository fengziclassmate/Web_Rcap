"use client";

import { useMemo } from "react";
import { ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import type { LongTask, Priority } from "@/lib/types";

type PriorityBubbleChartProps = {
  tasks: LongTask[];
};

const priorityMeta: Record<Priority, { x: number; y: number; color: string; label: string }> = {
  紧急且重要: { x: 2, y: 2, color: "#d96c5f", label: "紧急且重要" },
  紧急不重要: { x: 2, y: 1, color: "#d9a441", label: "紧急不重要" },
  不紧急重要: { x: 1, y: 2, color: "#4f91a3", label: "不紧急重要" },
  不紧急不重要: { x: 1, y: 1, color: "#8aa089", label: "不紧急不重要" },
};

export function PriorityBubbleChart({ tasks }: PriorityBubbleChartProps) {
  const data = useMemo(
    () =>
      (Object.keys(priorityMeta) as Priority[]).map((priority) => {
        const meta = priorityMeta[priority];
        const items = tasks.filter((task) => !task.done && task.priority === priority);
        return { ...meta, priority, count: items.length, z: Math.max(80, items.length * 80) };
      }),
    [tasks],
  );

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-900">优先级分布</h3>
        <p className="text-xs text-gray-500">气泡越大，当前未完成任务越多。</p>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ left: -12, right: 16, top: 10, bottom: 4 }}>
            <XAxis
              type="number"
              dataKey="x"
              domain={[0.5, 2.5]}
              ticks={[1, 2]}
              tickFormatter={(value) => (value === 2 ? "紧急" : "不紧急")}
              tick={{ fontSize: 11 }}
              stroke="#9ca3af"
            />
            <YAxis
              type="number"
              dataKey="y"
              domain={[0.5, 2.5]}
              ticks={[1, 2]}
              tickFormatter={(value) => (value === 2 ? "重要" : "不重要")}
              tick={{ fontSize: 11 }}
              stroke="#9ca3af"
            />
            <ZAxis type="number" dataKey="z" range={[120, 700]} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(_value, _name, item) => [`${item.payload.count} 个`, item.payload.label]} />
            {data.map((item) => (
              <Scatter key={item.priority} data={[item]} fill={item.color} />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
