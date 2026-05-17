"use client";

import { useMemo } from "react";
import { ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import type { LongTask, Priority } from "@/lib/types";

type PriorityBubbleChartProps = {
  tasks: LongTask[];
};

type BubbleDatum = {
  x: number;
  y: number;
  z: number;
  color: string;
  label: Priority;
  count: number;
};

const urgentImportant: Priority = "\u7d27\u6025\u4e14\u91cd\u8981";
const urgentNotImportant: Priority = "\u7d27\u6025\u4e0d\u91cd\u8981";
const notUrgentImportant: Priority = "\u4e0d\u7d27\u6025\u91cd\u8981";
const notUrgentNotImportant: Priority = "\u4e0d\u7d27\u6025\u4e0d\u91cd\u8981";

const priorityMeta: Record<Priority, { x: number; y: number; color: string; label: Priority }> = {
  [urgentImportant]: { x: 2, y: 2, color: "#d96c5f", label: urgentImportant },
  [urgentNotImportant]: { x: 2, y: 1, color: "#d9a441", label: urgentNotImportant },
  [notUrgentImportant]: { x: 1, y: 2, color: "#4f91a3", label: notUrgentImportant },
  [notUrgentNotImportant]: { x: 1, y: 1, color: "#8aa089", label: notUrgentNotImportant },
};

const priorityOrder: Priority[] = [
  urgentImportant,
  notUrgentImportant,
  urgentNotImportant,
  notUrgentNotImportant,
];

function PriorityTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: BubbleDatum }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-lg">
      <p className="font-semibold text-gray-900">{item.label}</p>
      <p className="mt-1 text-xs text-gray-500">未完成任务：{item.count} 个</p>
    </div>
  );
}

export function PriorityBubbleChart({ tasks }: PriorityBubbleChartProps) {
  const data = useMemo(
    () =>
      priorityOrder.map((priority) => {
        const meta = priorityMeta[priority];
        const items = tasks.filter((task) => !task.done && task.priority === priority);
        return { ...meta, count: items.length, z: Math.max(80, items.length * 80) };
      }),
    [tasks],
  );

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-900">优先级分布</h3>
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
            <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<PriorityTooltip />} />
            {data.map((item) => (
              <Scatter key={item.label} data={[item]} fill={item.color} />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
