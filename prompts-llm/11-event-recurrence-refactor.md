# Prompt 11 — 循环事件重构：持久化展开 + 拖拽支持

> **依赖：** 建议先完成 Prompt 09（Context 拆分），让事件管理独立
> **目标：** 重构循环事件系统，消除运行时合成 ID、支持拖拽循环事件实例、优化编辑体验

---

## 一、当前架构问题

**现状：** `expandScheduleEvents()` 在组件渲染时动态展开循环事件，生成带合成 ID 的虚拟实例。

**导致的问题：**
1. `parseSyntheticEventId()` 几乎出现在每个事件操作的入口，条件判断缠绕
2. 拖拽循环事件实例被禁止（`toast.info("循环行程暂不支持直接拖拽")`）
3. 编辑时的 scope 记忆缺失——每次打开弹窗默认是"仅此日"，需要用户手动切换
4. 合成 ID 不稳定——重新渲染后 ID 可能变化
5. 删除逻辑复杂——单次/未来/整个系列三种模式需要分别处理

---

## 二、新架构设计

**核心思路：** 将循环事件的展开过程从**运行时渲染**迁移到**持久化存储**。

```
当前: ScheduleEvent{recurrence} ──[运行时展开]──→ 虚拟实例 (合成 ID)
新:   ScheduleEvent{recurrence} ──[保存时展开]──→ DB 中存储每个实例 (真实 ID) 
                                            ↑ 带 recurrence_group_id 关联回母事件
```

### 数据模型变更

新建子表（或在 schedule_data JSON 中管理，推荐子表方式）：

```sql
-- 如果使用 Supabase 独立表（推荐）
create table recurrence_groups (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id),
  kind        text not null check (kind in ('daily', 'weekly')),
  weekdays    int[] default null,          -- weekly 时有效：[1,3,5] 表示周一周三周五
  week_start  date not null,               -- 循环开始日期
  end_date    date default null,            -- 循环结束日期（null 表示无限）
  created_at  timestamptz default now()
);

create table event_instances (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id),
  group_id    uuid references recurrence_groups(id) on delete cascade, -- null = 非循环事件
  date        date not null,
  start_hour  numeric(4,1) not null,
  end_hour    numeric(4,1) not null,
  title       text not null,
  notes       text default '',
  requirements text[] default '{}',
  is_completed boolean default false,
  category    text default '',
  tag         text default null,
  is_exception boolean default false,       -- true = 对母事件的修改（override）
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
```

**非 SQL 方案**（如果想保持在 localStorage/单行 JSON 中，不影响现有架构）：

```typescript
// 在 PersistedSchedulePayload 中新增字段
export type PersistedSchedulePayload = {
  events: ScheduleEvent[];
  // 新增：已展开的循环事件实例（不再使用合成 ID）
  expanded_instances?: RecurrenceInstance[];
  // ……原有字段不变
};

export type RecurrenceInstance = {
  id: string;                               // 持久化 ID，非合成
  groupId: string;                          // 关联到母事件的 id
  date: string;                             // 实际日期
  startHour: number;
  endHour: number;
  title: string;
  notes: string;
  requirements: string[];
  isCompleted: boolean;
  category: string;
  tag: EventTag;
  isOverride: boolean;                      // 是否为手动修改过的实例
  overrideRoot?: {                          // 如果 isOverride=true，保存原始配置供参考
    title?: string;
    startHour?: number;
    endHour?: number;
  };
};
```

---

## 三、核心实现

### 3.1 展开逻辑迁移到保存时

```typescript
// src/lib/recurrence-expand.ts  — 新的展开模块

import { addDays, format, parse, differenceInDays } from "date-fns";
import { createId } from "@/lib/id";
import type { ScheduleEvent, EventTag } from "@/lib/types";
import type { RecurrenceInstance } from "@/lib/recurrence-instance";

/**
 * 将带 recurrence 的 ScheduleEvent 展开为 RecurrenceInstance 列表
 * 在保存时调用，结果持久化存储
 */
export function expandRecurrenceEvent(event: ScheduleEvent): RecurrenceInstance[] {
  if (!event.recurrence) {
    // 非循环事件：直接返回单条
    return [];
  }

  const instances: RecurrenceInstance[] = [];
  const startDate = parse(event.date, "yyyy-MM-dd", new Date());
  const endDate = event.recurrenceEndExclusive
    ? parse(event.recurrenceEndExclusive, "yyyy-MM-dd", new Date())
    : null;

  // 展开未来约 1 年（或到结束日期）
  const maxDays = endDate
    ? differenceInDays(endDate, startDate)
    : 365;

  const exceptionDates = new Set(event.exceptionDates ?? []);
  const overrides = event.recurrenceOverrides ?? {};

  for (let dayOffset = 0; dayOffset < maxDays; dayOffset++) {
    const currentDate = addDays(startDate, dayOffset);
    const dateStr = format(currentDate, "yyyy-MM-dd");

    // 跳过例外日期
    if (exceptionDates.has(dateStr)) continue;

    // 判断是否在循环规则内
    if (event.recurrence.kind === "daily") {
      // 每日循环：每天都生成
    } else if (event.recurrence.kind === "weekly") {
      const dayOfWeek = currentDate.getDay();
      const adjustedDay = dayOfWeek === 0 ? 7 : dayOfWeek;
      if (!(event.recurrence.weekdays ?? [1,3,5]).includes(adjustedDay)) continue;
    }

    // 检查是否有 override
    const override = overrides[dateStr];
    const instance: RecurrenceInstance = {
      id: createId("recur-inst"),
      groupId: event.id,
      date: dateStr,
      startHour: override?.startHour ?? event.startHour,
      endHour: override?.endHour ?? event.endHour,
      title: override?.title ?? event.title,
      notes: override?.notes ?? event.notes,
      requirements: override?.requirements ?? event.requirements,
      isCompleted: override?.isCompleted ?? event.isCompleted,
      category: override?.category ?? event.category,
      tag: (override?.tag ?? event.tag) as EventTag,
      isOverride: !!override,
      overrideRoot: override ? {
        title: event.title,
        startHour: event.startHour,
        endHour: event.endHour,
      } : undefined,
    };

    instances.push(instance);
  }

  return instances;
}

/**
 * 从事件列表生成当前展现周期内的实例
 * 读取已持久化的 expanded_instances，按日期范围筛选
 */
export function getInstancesInRange(
  instances: RecurrenceInstance[],
  rangeStart: string,
  rangeEnd: string,
): RecurrenceInstance[] {
  return instances.filter((inst) => inst.date >= rangeStart && inst.date <= rangeEnd);
}
```

### 3.2 修改 ScheduleContext — 管理两种类型的事件

```typescript
// ScheduleContext 中新增状态
const [recurrenceInstances, setRecurrenceInstances] = useState<RecurrenceInstance[]>([]);

/** 保存事件时展开循环 */
function handleSaveEventWithRecurrence(event: ScheduleEvent) {
  if (event.recurrence) {
    // 保存母事件 + 展开实例
    setEvents((prev) => [...prev, event]);
    const instances = expandRecurrenceEvent(event);
    setRecurrenceInstances((prev) => [...prev, ...instances]);
  } else {
    setEvents((prev) => [...prev, event]);
  }
  persist();
}

/** 更新母事件时重新展开 */
function handleUpdateRecurrenceSeries(baseEventId: string, patch: Partial<ScheduleEvent>) {
  setEvents((prev) => prev.map((evt) => {
    if (evt.id === baseEventId) {
      // 先清除旧实例
      setRecurrenceInstances((prevInst) =>
        prevInst.filter((inst) => inst.groupId !== baseEventId)
      );
      // 生成新实例
      const updated = { ...evt, ...patch };
      const newInstances = expandRecurrenceEvent(updated);
      setRecurrenceInstances((prevInst) => [...prevInst, ...newInstances]);
      return updated;
    }
    return evt;
  }));
  persist();
}
```

### 3.3 修改 WeeklyTimeGrid — 用持久化实例替换合成事件

```tsx
// 从 props 获取新的 expandedInstances
type WeeklyTimeGridProps = {
  events: ScheduleEvent[];
  recurrenceInstances: RecurrenceInstance[];     // 新：持久化展开后的实例
  // ……原有 props
};

// 生成展现给时间网格的事件列表
const displayEvents = useMemo(() => {
  const start = format(displayDates[0], "yyyy-MM-dd");
  const end = format(displayDates[displayDates.length - 1], "yyyy-MM-dd");

  // 非循环事件 + 循环实例
  const nonRecurring = events.filter((evt) => !evt.recurrence);
  const instancesInRange = getInstancesInRange(recurrenceInstances, start, end);

  // 转换为 ScheduleEvent 格式
  const instanceEvents: ScheduleEvent[] = instancesInRange.map((inst) => ({
    id: inst.id,                              // 真是的持久化 ID，不是合成的
    date: inst.date,
    startHour: inst.startHour,
    endHour: inst.endHour,
    title: inst.title,
    notes: inst.notes,
    requirements: inst.requirements,
    isCompleted: inst.isCompleted,
    category: inst.category,
    tag: inst.tag,
    isRecurrenceInstance: true,               // 新增标记，方便 UI 判断
  }));

  return [...nonRecurring, ...instanceEvents];
}, [events, recurrenceInstances, displayDates]);
```

### 3.4 开启循环事件的拖拽支持

```tsx
// 删除原先的 toast.info 限制，改为正常的拖拽处理

function handleDropEvent(targetDate: string, targetHour: number) {
  if (!draggingEventId) return;

  const source = expandedEvents.find((event) => event.id === draggingEventId);
  if (!source) return;

  const duration = Math.max(1 / 60, source.endHour - source.startHour);
  const nextStartHour = Math.min(23.9833, targetHour);
  const nextEndHour = Math.min(24, nextStartHour + duration);

  if (source.isRecurrenceInstance) {
    // 循环事件实例：保存为 override
    const parent = events.find((evt) =>
      recurrenceInstances.find((inst) =>
        inst.id === source.id && inst.groupId === evt.id
      )
    );
    if (parent) {
      // 在 recurrenceOverrides 中记录此实例的变更
      handleApplyDragOverride(parent.id, source.date, {
        date: targetDate,
        startHour: nextStartHour,
        endHour: nextEndHour,
      });
    }
  } else {
    // 非循环事件：正常更新
    onUpdateEvent(source.id, {
      date: targetDate,
      startHour: nextStartHour,
      endHour: nextEndHour,
    });
  }
  setDraggingEventId(null);
}
```

### 3.5 编辑 scope 记忆

在 `ui-context.tsx` 或 localStorage 中记忆用户的编辑 scope 偏好：

```typescript
// ui-context.tsx 新增
const [editScopePreference, setEditScopePreference] = useState<"occurrence" | "series">(
  () => (typeof window !== "undefined"
    ? (localStorage.getItem("edit-scope-preference") as "occurrence" | "series") ?? "occurrence"
    : "occurrence")
);

function setEditScope(value: "occurrence" | "series") {
  setEditScopePreference(value);
  localStorage.setItem("edit-scope-preference", value);
}
```

然后在编辑弹窗中：

```tsx
// 打开编辑时使用记忆的 scope
function handleOpenEdit(event: ScheduleEvent) {
  setEditingEventId(event.id);
  // 如果有 persistenceId 属性（即循环实例），自动设为 "occurrence"
  // 否则使用记忆的偏好
  setEditScope(event.isRecurrenceInstance ? "occurrence" : editScopePreference);
  // ……填充表单
}
```

---

## 四、迁移步骤

1. 新建 `src/lib/recurrence-expand.ts` — 展开逻辑
2. 新建 `src/lib/recurrence-instance.ts` — `RecurrenceInstance` 类型定义
3. 在 `PersistedSchedulePayload` 中新增 `expanded_instances` 字段
4. 修改 `ScheduleContext`，增加实例管理 State，修改所有 setEvents 的调用处
5. 修改 `WeeklyTimeGrid` props 和内部逻辑
6. 删除 `@/lib/recurrence` 中的 `expandScheduleEvents`、`parseSyntheticEventId` 相关函数（或标记废弃）
7. 删除拖拽时的 toast.info 限制
8. 增加编辑 scope 记忆功能
9. `npm run build` 验证

## 五、验收标准

- [ ] 创建循环事件后，实例列表正常展开并持久化
- [ ] 编辑循环事件系列（scope=series）勾选了周三，不该在周一出现
- [ ] 删除"仅此日"时，其他实例不受影响
- [ ] 拖拽循环事件实例到新时间位置后自动生成 override
- [ ] 编辑弹窗默认 scope 跟随用户上次选择
- [ ] 重新加载页面后，之前展开的实例不丢失（持久化正常）
- [ ] 跨月/跨年展开限制正常（最多 365 天）
- [ ] `npm run build` 无 TypeScript 错误

## 六、注意事项

1. **展开上限**：设置最大展开 365 天是合理权衡。如果用户需要更远的循环，可以每打开一个未展开的时间段时增量展开
2. **增量展开**：当用户翻到下一周/下一个月时，检查是否需要额外展开（如果当前展开范围小于展示范围则补展开）
3. **override 覆盖**：如果用户编辑了整个系列（scope=series），需要**清除之前的所有 override**，因为基础数据变了
4. **与原有代码兼容**：在完全迁移前，`parseSyntheticEventId` 和 `expandScheduleEvents` 可以保留但标记为 `@deprecated`
