# 日程安排 App — Codex 优化 Prompt 集

> 项目根目录：`C:\Users\25371\Desktop\日程安排_app`
> 技术栈：Next.js 16 + React 19 + TypeScript + Supabase + shadcn/ui + Tailwind CSS 4（仅桌面 Web）
> 当前状态：功能完整可运行，但代码结构混乱，page.tsx 4000+ 行，缺乏测试和规范的状态管理。

---

## 📦 Prompt 1（前置必做）：拆解巨无霸 page.tsx

### 问题
`src/app/page.tsx` 接近 **4000 行**，混合了以下职责：
- 所有类型定义（ScheduleEvent, LongTask, AnnualTask 等 20+ 个类型）
- 所有 normalizer 函数（normalizeEvents, normalizeTasks, normalizeAnnualTasks… 约 20 个）
- 所有 Supabase 数据行转换（toScheduleRow, fromScheduleRow, toTaskRow… 约 25 个）
- 所有数据库读写逻辑（loadScheduleData, handleCreateEvent, handleUpdateEvent… 约 15 个）
- localStorage 备份读写逻辑
- 所有状态管理（useState 定义 + 回调函数）
- 页面布局 JSX（条件渲染 10+ 个面板）

### 目标
将其拆分为以下文件，保持所有功能和类型兼容性不变：

#### 1. `src/lib/types.ts`（新增）
提取所有公共类型定义：
- EventTag, ScheduleEvent, SubTask, Priority, LongTask, AnnualTask, ProjectCheckin, FootprintItem, DashboardUiPreferences, Achievement（已存在的类型）
- 注意：`Achievement` 类型定义来自 `@/components/monitoring/achievements-panel`，需要验证兼容性后引入或重新导出
- 检查 `page.tsx` 中所有 `export type`，迁移到该文件
- 在 `page.tsx` 中改为 `import type` 引用

#### 2. `src/lib/normalizers.ts`（新增）
迁移所有 `normalize*` 函数（约 20 个）：
- normalizeEvents, normalizeTasks, normalizeAnnualTasks, normalizeProjectCheckins, normalizeFootprints, normalizeAchievements, normalizePlanItems, normalizePaperPlanItems, normalizeResearchProjects, normalizePaperProgress, normalizeSubmissions, normalizeGroupMeetings, normalizeDashboardUiPreferences, normalizePersistedSchedulePayload 等
- 同时迁移辅助函数：`normalizeSegmentColors`, `normalizeSegmentLabels`, `normalizeSegments`（如果存在的话）
- 保持函数签名完全一致
- 在 `page.tsx` 中改为 `import { ... } from "@/lib/normalizers"`

#### 3. `src/lib/supabase-queries.ts`（新增）
迁移所有 Supabase 数据行转换函数（约 25 个）：
- toScheduleRow, fromScheduleRow (ScheduleEvent ↔ Supabase row)
- toTaskRow, fromTaskRow (LongTask ↔ Supabase row)
- toAnnualTaskRow, fromAnnualTaskRow
- toProjectCheckinRow, fromProjectCheckinRow
- toFootprintRow, fromFootprintRow
- toAchievementRow, fromAchievementRow
- toResearchProjectRow, fromResearchProjectRow
- toPaperProgressRow, fromPaperProgressRow
- toSubmissionRow, fromSubmissionRow
- toGroupMeetingRow, fromGroupMeetingRow
- toUiPreferencesRow, fromUiPreferencesRow
- 同时迁移以下数据库读写 async 函数：
  - saveScheduleData
  - loadScheduleData（包含 localStorage 备份兜底）
  - importLegacyResearchWorkflow（如果存在）
- 这些函数需要访问 `supabase` client，从 `@/lib/supabase` 导入

#### 4. `src/hooks/useScheduleData.ts`（新增，hooks 目录可能不存在，创建它）
迁移所有状态定义和回调函数，形成一个自定义 Hook：
- 输入：`user: User | null`, `moduleId: MonitoringModuleId`
- 输出（返回对象）：
  - `events`, `tasks`, `annualTasks`, `projectCheckins`, `footprints`, `achievements`, `researchProjects`, `paperProgress`, `submissions`, `groupMeetings`, `uiPreferences` — 所有状态值
  - `loading: boolean`（当前模块加载中标志）
  - 所有对应的 update/delete/create 回调
- 内部逻辑：
  - 切换 module 时触发对应 load 动作
  - 所有写操作同时写 Supabase + localStorage 备份
  - 错误通过 toast 提示
  - 包含前身 page.tsx 中的 `isColumnMissing` / `isUiPreferencesColumnMissing` 处理逻辑
  - 包含前身所有 useEffect（初始化、切换模块时加载、定期自动保存等）

#### 5. `src/app/page.tsx`（重写）
精简为：
```tsx
"use client";

import { useUser } from "@/hooks/useUser";  // 假设存在，需检查实际情况
import { useScheduleData } from "@/hooks/useScheduleData";
import { MonitoringSidebar, type MonitoringModuleId } from "@/components/monitoring/sidebar";
// ... 其他组件 import ...

export default function HomePage() {
  const [activeModule, setActiveModule] = useState<MonitoringModuleId>("schedule");
  const allData = useScheduleData(activeModule);
  // ... 渲染 10+ 个条件模块 + 导航栏 ...
}
```
注意：
- `page.tsx` 中当前直接调用了 `supabase.auth.getUser()`，需要确认 hook 能否处理
- user 状态是从 page.tsx 的 useEffect 中获取的，需要在重构后的架构中保留这个逻辑

### 验收标准
- [ ] `npm run build` 无 TypeScript 错误
- [ ] 所有功能与重构前 100% 一致
- [ ] `page.tsx` 不超过 200 行
- [ ] 所有 normalizer 函数不再与 UI 组件耦合
- [ ] 数据库查询可独立测试

### 注意事项
- 不要修改 `@/components/schedule/weekly-time-grid.tsx` 等组件文件
- 不要修改 `@/lib/recurrence.ts` 或 `@/lib/supabase.ts`
- 不要修改组件签名（这些组件的 props 直接引用 page.tsx 中的类型）
- 可能需要更新 `src/lib/types.ts` 中的类型以确保组件文件仍能正确导入
- 要留意 page.tsx 中是否还有未 export 但被组件使用的类型

---

## 📦 Prompt 2：统一 CSS 系统，消除冗余

### 问题
`globals.css` 中定义了大量自定义 utility class（`glass-panel`, `module-shell`, `workbench-shell`, `interactive-card`, `section-trigger`, `subtle-card` 等），这些组件效果分散在 CSS 和 JSX 中，部分有重复定义。

同时 `schedule-time-analytics.tsx` 和 `weekly-time-grid.tsx` 的文件内各定义了自己的 `categoryVisuals` / `categoryAliasMap`，完全重复。

### 目标
1. **CSS 迁移**：将自定义 panel/utility class 移到 Tailwind CSS 的 `@utility` 指令或定义为一个独立的 CSS 文件
   - 在 `globals.css` 中，将 `glass-panel`, `module-shell` 等改为 `@utility glass-panel { ... }` 形式（Tailwind v4 支持）
   - 如果 Tailwind v4 不兼容 `@utility`，则在 `globals.css` 中保持原样，但确保没有重复定义

2. **消除重复常量**：将 `categoryAliasMap` 和 `categoryVisuals` 提取为共享常量
   - 在 `src/lib` 目录下新建 `src/lib/categories.ts`
   - 定义 `CATEGORY_COLORS`, `CATEGORY_VISUALS`, `CATEGORY_ALIAS_MAP` 三个导出常量
   - 从 `schedule-time-analytics.tsx` 和 `weekly-time-grid.tsx` 中移除各自的内联定义，改为 import
   - 注意：`weekly-time-grid.tsx` 的 `defaultCategoryPalette` 包含了额外的 name+color 结构，需合并兼容

3. **删除 `globals.css` 中多余的选择器**
   - `workbench-shell section.rounded-lg.border` 这类通用覆盖选择器太多，可能导致意外的样式覆盖
   - 建议仅在需要的地方使用 `module-shell` 或 `glass-panel` 类，删除全局覆盖

### 验收标准
- [ ] `npm run build` 通过
- [ ] 视觉对比前后无差异（截图验收）
- [ ] `categoryAliasMap` 和 `categoryVisuals` 只在共享文件定义一次

---

## 📦 Prompt 3：移除硬编码默认数据

### 问题
`page.tsx` 顶部定义了大量硬编码默认数据：
```typescript
const defaultTasks: LongTask[] = [ /* 4 条示例 */ ];
const defaultEvents: ScheduleEvent[] = [ /* 示例事件 */ ];
// ... normalizeEvents 等返回到默认值时会使用这些数据
```
这些数据：
- 用户首次使用看到的是示例数据
- localStorage 清空后又恢复
- 部分中文字段有 UTF-8 编码乱码（注释和默认值中含有乱码字）

### 目标
1. **正常化常量**：将所有 default events/tasks 示例数据改为合理的空数据表示
   ```typescript
   const defaultTasks: LongTask[] = [];
   ```
2. **处理 normalizer**：确保 normalizer 在接收到空数组时返回空数组，而不是返回示例数据
   - 回顾 `normalizeEvents`：传入 `undefined` 时只返回 `[]`，不做假数据填充
   - 回顾 `normalizeTasks`：传入非数组时应该返回 `[]` 而不是 `defaultTasks`
   - 同样检查 `normalizeProjectCheckins`、`normalizeFootprints`、`normalizePaperProgress`（paperProgress 的 default 建议保留为空字段结构）
3. **添加"加载示例数据"按钮**（可选）
   - 在页面底部或初始加载状态提供一个 `<Button>`，点击后初始化一组合理示例
   - 点击后写入 Supabase + localStorage
   - 用 toast 提示"示例数据已加载"

### 验收标准
- [ ] 首次加载不显示任何示例 events/tasks
- [ ] 添加"加载示例数据"按钮（如做了）
- [ ] 所有乱码注释已修复为正确中文

---

## 📦 Prompt 4：添加 vitest 单元测试（核心逻辑）

### 问题
项目零测试。核心逻辑如 `recurrence.ts` 中的 `expandScheduleEvents`、`page.tsx` 中的 normalizer 函数、`weekly-time-grid.tsx` 中的 `layoutDayEvents`、`isOverlap` 等没有任何测试覆盖。

当前项目使用的是 Next.js 16，ESLint 配置在，但无 vitest/ jest 依赖。

### 目标
1. **安装测试依赖**（在项目根目录运行）：
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

2. **创建测试配置文件** `vitest.config.ts`（或 `vitest.config.mts`）：
```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

3. **创建测试 setup 文件** `src/test/setup.ts`：
```typescript
import "@testing-library/jest-dom/vitest";
```

4. **编写测试文件**：

#### `src/lib/__tests__/recurrence.test.ts`
测试 `expandScheduleEvents`：
```typescript
import { describe, it, expect } from "vitest";
import { expandScheduleEvents } from "../recurrence";
// 测试场景：
// - 无 recurrence 的事件，返回自身
// - daily recurrence，展开到范围内
// - weekly recurrence with weekdays
// - 有 exceptionDates 时跳过
// - 有 recurrenceOverrides 时覆盖字段
// - recurrenceEndExclusive 截断
// - 超出范围不展开
// Keep it simple — 每个场景写一个 it()
```

#### `src/lib/__tests__/normalizers.test.ts`
测试 Prompt 1 提取后的 normalizer 函数：
```typescript
import { describe, it, expect } from "vitest";
import { normalizeEvents, normalizeTasks, normalizeAnnualTasks } from "../normalizers";
// 测试场景：
// - 输入 null/undefined → []
// - 输入非数组 → []
// - 输入完整对象 → 正常映射
// - 输入部分字段 → 用默认值填充
// - 测试乱码恢复（确保编码正确）
```

#### `src/components/schedule/__tests__/weekly-time-grid.test.ts`
测试布局函数：
```typescript
import { describe, it, expect } from "vitest";
// isOverlap: 重叠/不重叠/边界
// layoutDayEvents: 同一时间的事件lane分配
// normalizeTimeValue: 边界情况
```

5. **添加 package.json scripts**：
```json
{
  "test": "vitest run",
  "test:watch": "vitest"
}
```

### 验收标准
- [ ] `npm run test` 全部通过
- [ ] 覆盖 `expandScheduleEvents` 的核心分支（最多 8-10 个 it）
- [ ] 覆盖主要 normalizer 的空值和边界情况
- [ ] 测试不需 mock Supabase（normalizer 是纯函数）

---

## 📦 Prompt 5：添加全局 loading/error/empty 骨架层

### 问题
当前切换模块时无加载骨架屏，数据为空时不提示"暂无数据"，错误时仅在 toast 中提示。

### 目标
1. **创建 `src/components/shared/DataBoundary.tsx`**：
```tsx
type DataBoundaryProps = {
  loading: boolean;
  error: Error | null;
  isEmpty: boolean;
  emptyMessage?: string;
  loadingSkeleton?: React.ReactNode;
  children: React.ReactNode;
};
```
- `loading` 时显示骨架屏（预置一个简单的脉冲动画卡片列表）
- `error` 时显示错误信息和重试按钮
- `isEmpty` 时显示空状态和提示文本
- `children` 正常渲染

2. **在 page.tsx（重构后）中使用**：
```tsx
<DataBoundary loading={loading} error={error} isEmpty={events.length === 0}>
  <WeeklyTimeGrid ... />
</DataBoundary>
```

3. **骨架屏预置品字形或卡片列表形**：
- 5 行左右灰色脉冲卡片
- 使用 Tailwind `animate-pulse`

### 验收标准
- [ ] 模块切换时显示骨架屏
- [ ] 无数据时显示空状态提示
- [ ] 网络错误时显示错误视图 + 重试按钮

---

## 📦 Prompt 6：依赖清理与构建配置优化

### 问题
`package.json` 同时依赖了 `shadcn`（v4.2）和独立的 shadcn/ui 组件（`@/components/ui/*`），有混合使用的风险。同时 `@base-ui/react` 已安装但代码中无明显使用。

### 目标
1. 移除不需要的依赖：
```bash
npm uninstall @base-ui/react
```
2. 检查 `shadcn` 包的用途——如果仅作为 CLI 使用，应该是 `devDependencies`
3. 确保 `package.json` 中的 `shadcn` 正确归类

### 验收标准
- [ ] `npm run build` 通过
- [ ] `npm ls @base-ui/react` 返回空（未安装）

---

## 📦 Prompt 7（可选强化）：完整目录结构重构

### 问题
当前目录结构混排，功能模块和 UI 组件混杂，不利于扩展。

### 目标（在完成 Prompt 1-6 之后进行）
重构为 feature-based 目录结构：
```
src/
├── app/                    # Next.js pages
│   ├── layout.tsx
│   ├── page.tsx
│   └── icon.tsx
├── features/
│   ├── schedule/           # 日程日程管理
│   │   ├── weekly-time-grid.tsx
│   │   ├── time-analytics.tsx
│   │   └── index.ts
│   ├── tasks/              # 任务控制台
│   │   ├── task-dashboard.tsx
│   │   └── index.ts
│   ├── research/           # 科研工作流
│   │   ├── research-projects-panel.tsx
│   │   ├── paper-progress-panel.tsx
│   │   ├── research-workflow-panel.tsx
│   │   ├── submissions-panel.tsx
│   │   ├── group-meetings-panel.tsx
│   │   └── index.ts
│   ├── literature/         # 文献阅读
│   │   ├── literature-page.tsx
│   │   └── index.ts
│   ├── logs/               # 日志
│   │   └── log-page.tsx
│   └── monitoring/         # 监控面板
│       ├── sidebar.tsx
│       ├── achievements-panel.tsx
│       ├── footprints-panel.tsx
│       ├── project-checkins-panel.tsx
│       └── index.ts
├── shared/
│   ├── ui/                 # shadcn/ui 组件（不变）
│   ├── lib/                # 通用工具（保持不变）
│   └── hooks/              # 通用 hook（新增）
├── lib/                    # 公共类型/tools（保持不变）
├── hooks/                  # 全局 hook（新增 useScheduleData）
└── test/                   # 测试文件
    ├── setup.ts
    └── __tests__/
```

注意：
- 所有 import 路径需要对应更新
- `.tsx` 文件使用 `@/features/tasks/task-dashboard` 形式
- 子目录的 `index.ts` 重新导出公共组件

### 验收标准
- [ ] `npm run build` 通过
- [ ] 功能完整性无退化
- [ ] 目录结构清晰，一眼能看出功能边界

---

## 执行建议

1. **顺序**：Prompt 1 → Prompt 3 → Prompt 2 → Prompt 6 → Prompt 4 → Prompt 5 → Prompt 7
2. **每个 prompt 执行后**：`npm run build` 验证通过再进入下一个
3. **遇到 TypeScript 错误**：优先解决"@/lib/types 找不到"类基础问题，逐步修复类型依赖
4. **git 分支（推荐）**：为每个 prompt 创建一个独立分支以便回退
