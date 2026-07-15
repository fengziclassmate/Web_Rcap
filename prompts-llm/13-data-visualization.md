# Prompt 13 — 数据可视化增强：交互式图表

> **依赖：** 不依赖前面的 prompt，可独立执行
> **目标：** 给时间分析面板和任务控制台增加交互式图表，直观展示时间分布和任务进度

---

## 一、新增依赖

```bash
cd "C:\Users\25371\Desktop\日程安排_app"
npm install recharts
```

`recharts` 是基于 React 的图表库，与 Tailwind CSS 兼容，支持响应式。

---

## 二、新增文件：`src/components/schedule/category-pie-chart.tsx`

分类时间占比的环形图（支持交互切换显示/隐藏分类）：

```tsx
"use client";

import { useState, useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from "recharts";
import type { ScheduleEvent } from "@/lib/types";
import { getScheduleCategoryColor, normalizeScheduleCategory } from "@/lib/categories";

type CategoryPieChartProps = {
  events: ScheduleEvent[];
  weekStart: Date;
  viewMode: "week" | "month";
};

/** 颜色映射表：浅色圆环配色 */
const CHART_COLORS = [
  "#5B8DEE", // 蓝色
  "#47C1A8", // 青绿
  "#F5A623", // 琥珀
  "#E8856C", // 珊瑚
  "#A78BDB", // 紫色
  "#6CC4A1", // 森林绿
  "#F4A6A8", // 粉色
  "#8EB9E6", // 天蓝
  "#C9A96E", // 金褐
  "#9DABD4", // 灰蓝
  "#E8B889", // 杏色
  "#7CC5B0", // 薄荷
  "#C4A1D4", // 淡紫
  "#B5B5B5", // 灰色
];

type ChartDataItem = {
  name: string;
  value: number;
  color: string;
  percentage: string;
};

export function CategoryPieChart({ events, weekStart, viewMode }: CategoryPieChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // 按分类汇总时间
  const data = useMemo(() => {
    const timeByCategory = new Map<string, number>();
    const days = viewMode === "week" ? 7 : 30;

    events.forEach((event) => {
      const category = normalizeScheduleCategory(event.category);
      const duration = event.endHour - event.startHour;
      timeByCategory.set(category, (timeByCategory.get(category) ?? 0) + duration);
    });

    const total = Array.from(timeByCategory.values()).reduce((a, b) => a + b, 0);
    if (total === 0) return [];

    return Array.from(timeByCategory.entries())
      .map(([name, hours], index) => ({
        name,
        value: Number(hours.toFixed(1)),
        color: CHART_COLORS[index % CHART_COLORS.length],
        percentage: `${((hours / total) * 100).toFixed(0)}%`,
      }))
      .sort((a, b) => b.value - a.value);
  }, [events, viewMode]);

  // 自定义活动扇区（鼠标悬浮时放大）
  function renderActiveShape(props: any) {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload } = props;
    return (
      <g>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius + 6}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
          style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.15))" }}
        />
        <text x={cx} y={cy - 12} textAnchor="middle" fill="#333" fontSize={13} fontWeight={600}>
          {payload.name}
        </text>
        <text x={cx} y={cy + 8} textAnchor="middle" fill="#666" fontSize={11}>
          {payload.value}h ({payload.percentage})
        </text>
      </g>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex h-[240px] items-center justify-center text-sm text-gray-400">
        暂无数据（当前{viewMode === "week" ? "周" : "月"}无事件）
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      {/* 环形图 */}
      <div className="h-[240px] w-[240px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              activeIndex={activeIndex ?? undefined}
              activeShape={renderActiveShape}
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              dataKey="value"
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* 图例 */}
      <div className="flex-1 space-y-2">
        {data.map((item, index) => (
          <button
            key={item.name}
            type="button"
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm transition-colors
              ${activeIndex === index ? "bg-gray-100" : "hover:bg-gray-50"}`}
            onMouseEnter={() => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="min-w-0 flex-1 truncate text-gray-700">{item.name}</span>
            <span className="shrink-0 font-mono text-xs text-gray-500">
              {item.value}h
            </span>
            <span className="shrink-0 w-10 text-right font-mono text-xs text-gray-400">
              {item.percentage}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

---

## 三、新增文件：`src/components/schedule/weekly-task-trend.tsx`

已完成/未完成任务数趋势折线图：

```tsx
"use client";

import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { addDays, format, startOfWeek, endOfWeek } from "date-fns";
import { zhCN } from "date-fns/locale";
import type { ScheduleEvent } from "@/lib/types";

type WeeklyTaskTrendProps = {
  events: ScheduleEvent[];
  weekStart: Date;
};

export function WeeklyTaskTrend({ events, weekStart, weekEnd }: WeeklyTaskTrendProps) {
  const data = useMemo(() => {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const days: Array<{ date: string; label: string; completed: number; total: number }> = [];

    let current = weekStart;
    while (current <= weekEnd) {
      const dateStr = format(current, "yyyy-MM-dd");
      const dayEvents = events.filter((e) => e.date === dateStr);
      days.push({
        date: dateStr,
        label: format(current, "M/d", { locale: zhCN }),
        completed: dayEvents.filter((e) => e.isCompleted).length,
        total: dayEvents.length,
      });
      current = addDays(current, 1);
    }

    return days;
  }, [events, weekStart]);

  // 自定义 Tooltip
  function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border bg-white/95 px-3 py-2 shadow-lg text-sm">
        <p className="font-medium text-gray-700">{label}</p>
        {payload.map((entry: any) => (
          <p key={entry.name} style={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }

  return (
    <div className="h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#888" }}
            axisLine={{ stroke: "#e5e5e5" }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "#888" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            iconType="circle"
          />
          <Line
            type="monotone"
            dataKey="completed"
            name="已完成"
            stroke="#47C1A8"
            strokeWidth={2}
            dot={{ r: 4, fill: "#47C1A8", strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="total"
            name="总事件数"
            stroke="#8EB9E6"
            strokeWidth={2}
            dot={{ r: 4, fill: "#8EB9E6", strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

---

## 四、新增文件：`src/components/schedule/priority-bubble-chart.tsx`

四象限任务分布气泡图：

```tsx
"use client";

import { useMemo, useState } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, Label,
} from "recharts";
import type { LongTask, Priority } from "@/lib/types";

type PriorityBubbleChartProps = {
  tasks: LongTask[];
};

const QUADRANT_LABELS: Record<Priority, { x: number; y: number; label: string; color: string }> = {
  "紧急且重要": { x: 80, y: 80, label: "紧急且重要", color: "#E8856C" },
  "紧急不重要": { x: 20, y: 80, label: "紧急不重要", color: "#F5A623" },
  "不紧急重要": { x: 80, y: 20, label: "不紧急重要", color: "#47C1A8" },
  "不紧急不重要": { x: 20, y: 20, label: "不紧急不重要", color: "#B5B5B5" },
};

export function PriorityBubbleChart({ tasks }: PriorityBubbleChartProps) {
  const [hoveredQuadrant, setHoveredQuadrant] = useState<string | null>(null);

  const chartData = useMemo(() => {
    const result: Array<{
      priority: Priority;
      x: number;
      y: number;
      z: number;
      label: string;
      items: LongTask[];
      color: string;
    }> = [];

    for (const [priority, config] of Object.entries(QUADRANT_LABELS)) {
      const items = tasks.filter((t) => t.priority === priority && !t.done);
      if (items.length === 0) continue;
      result.push({
        priority: priority as Priority,
        x: config.x,
        y: config.y,
        z: items.length * 100,
        label: config.label,
        items,
        color: config.color,
      });
    }

    return result;
  }, [tasks]);

  function CustomTooltip({ active, payload }: any) {
    if (!active || !payload?.length) return null;
    const entry = payload[0].payload;
    return (
      <div className="rounded-lg border bg-white/95 px-3 py-2 shadow-lg text-sm max-w-[240px]">
        <p className="font-semibold text-gray-800">{entry.label}</p>
        <p className="text-xs text-gray-500 mb-1">{entry.items.length} 个未完成任务</p>
        {entry.items.slice(0, 5).map((item: LongTask) => (
          <p key={item.id} className="truncate text-gray-600 text-xs">
            · {item.name}
          </p>
        ))}
        {entry.items.length > 5 && (
          <p className="text-xs text-gray-400">…还有 {entry.items.length - 5} 个</p>
        )}
      </div>
    );
  }

  return (
    <div className="h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 16, right: 16, bottom: 16, left: 16 }}>
          {/* 象限分隔线 */}
          <CartesianGrid
            horizontalPoints={[50]}
            verticalPoints={[50]}
            stroke="#ddd"
            strokeDasharray="4 4"
          />
          {/* 象限背景色 */}
          <rect x="50%" y="0%" width="50%" height="50%" fill="#47C1A808" />
          <rect x="0%" y="0%" width="50%" height="50%" fill="#B5B5B508" />
          <rect x="50%" y="50%" width="50%" height="50%" fill="#E8856C08" />
          <rect x="0%" y="50%" width="50%" height="50%" fill="#F5A62308" />

          {/* 坐标轴文字 */}
          <XAxis hide domain={[0, 100]} />
          <YAxis hide domain={[0, 100]} reversed />
          <ZAxis range={[40, 200]} />

          {/* 象限标签 */}
          {Object.values(QUADRANT_LABELS).map((q) => (
            <text
              key={q.label}
              x={`${q.x}%`}
              y={`${q.y}%`}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-[11px] font-medium"
              fill={q.color}
              opacity={0.6}
              style={{ pointerEvents: "none" }}
            >
              {q.label}
            </text>
          ))}

          <Tooltip content={<CustomTooltip />} />

          <Scatter
            data={chartData}
            shape="circle"
            onMouseEnter={(data) => setHoveredQuadrant(data.priority)}
            onMouseLeave={() => setHoveredQuadrant(null)}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={index}
                fill={entry.color}
                opacity={hoveredQuadrant && hoveredQuadrant !== entry.priority ? 0.3 : 0.85}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
```

---

## 五、修改 `src/components/schedule/schedule-time-analytics.tsx`

将新增图表集成到分析面板中：

```tsx
"use client";

import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ScheduleEvent } from "@/lib/types";
import { CategoryPieChart } from "./category-pie-chart";
import { WeeklyTaskTrend } from "./weekly-task-trend";
// import { PriorityBubbleChart } from "./priority-bubble-chart";  // 需要在 TaskDashboard 中

type ScheduleTimeAnalyticsProps = {
  events: ScheduleEvent[];
  currentWeekStart: Date;
  viewMode: "week" | "month";
};

export function ScheduleTimeAnalytics({
  events,
  currentWeekStart,
  viewMode = "week",
}: ScheduleTimeAnalyticsProps) {
  return (
    <div className="space-y-6">
      {/* 分类时间占比 */}
      <div className="rounded-2xl border bg-white/60 p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">
          分类时间占比（{viewMode === "week" ? "本周" : "本月"}）
        </h3>
        <CategoryPieChart
          events={events}
          weekStart={currentWeekStart}
          viewMode={viewMode}
        />
      </div>

      {/* 每日完成趋势 */}
      <div className="rounded-2xl border bg-white/60 p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">
          每日事件完成趋势（本周）
        </h3>
        <WeeklyTaskTrend events={events} weekStart={currentWeekStart} />
      </div>

      {/* 时段分布柱状图（保留原有功能） */}
      <div className="rounded-2xl border bg-white/60 p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">
          各时段事件频次
        </h3>
        <HourlyDistributionBar events={events} />
      </div>
    </div>
  );
}

/** 各时段分布柱状图（保留原有，略作修改） */
function HourlyDistributionBar({ events }: { events: ScheduleEvent[] }) {
  const data = useMemo(() => {
    const slots = Array.from({ length: 24 }, (_, h) => ({
      hour: `${String(h).padStart(2, "0")}:00`,
      count: events.filter((e) => e.startHour <= h && e.endHour > h).length,
    }));
    return slots;
  }, [events]);

  return (
    <div className="h-[180px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="hour"
            tick={{ fontSize: 10, fill: "#888" }}
            interval={2}
            axisLine={{ stroke: "#e5e5e5" }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 10, fill: "#888" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid #e0e0e0",
              fontSize: "12px",
            }}
          />
          <Bar
            dataKey="count"
            fill="#8EB9E6"
            radius={[4, 4, 0, 0]}
            maxBarSize={20}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

---

## 六、执行步骤

1. `npm install recharts`
2. 新建 `src/components/schedule/category-pie-chart.tsx`
3. 新建 `src/components/schedule/weekly-task-trend.tsx`
4. 新建 `src/components/schedule/priority-bubble-chart.tsx`
5. 修改 `src/components/schedule/schedule-time-analytics.tsx` 集成新图表
6. 在 `TaskDashboard` 底部添加四象限气泡图面板
7. `npm run build` 验证

## 七、验收标准

- [ ] 环形图正常渲染，鼠标悬浮显示具体数值和百分比
- [ ] 点击图例可切换显示/隐藏分类
- [ ] 趋势折线图显示每日已完成 vs 总数对比
- [ ] 气泡图展示四象限任务分布，悬浮显示任务列表
- [ ] 桌面窗口缩放时保持图表标签与交互区域完整
- [ ] 无数据时显示占位提示
- [ ] `npm run build` 无 TypeScript 错误
