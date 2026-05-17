# Prompt 16 — 事件分类管理系统全面重构

> **依赖：** 与前面 prompt 无关，可独立执行
> **目标：** 分类持久化（不会掉自定义分类）+ 统一默认值 + 编辑/删除保护 + 颜色体系升级 + 交互改进

---

## 一、背景与痛点

### 核心问题：分类"虚假"
- `weekly-time-grid.tsx` 中用 `useState<Category[]>` 维护分类列表
- 添加/删除/改名只影响当前 session，**刷新页面全部丢失**
- `CATEGORY_VISUALS`（库里的 14 个硬编码分类）和 `categories state`（UI 维护的分类列表）互不通信
- 删除分类没有检查事件使用情况，会造成孤儿引用

### 次要问题
- `page.tsx` 第 1894 行硬编码了乱码 `"浠诲姟鎺ㄨ繘"` 作为默认分类（依赖别名映射苟活）
- `normalizeEvents` 默认分类是 `"任务推进"`，但创建事件默认是 `categories[0]`（"深度科研"），不一致
- 分类在 select 下拉中没有颜色指示器
- 分类管理弹窗没有编辑功能

---

## 二、修改 `src/lib/categories.ts` — 分类存储层升级

### 2.1 新增 `ScheduleCategoryDef` 类型

```typescript
/** 可持久化的分类定义（用户可自定义） */
export type ScheduleCategoryDef = {
  id: string;
  name: string;
  /** Tailwind class 字符串，指向 CATEGORY_VISUALS 中的配色 */
  color: string;
  /** 排序序号 */
  sortOrder: number;
};

/** 默认分类 ID 命名空间 */
const DEFAULT_CATEGORY_ID_PREFIX = "__default__";
```

### 2.2 将 `ScheduleCategoryVisual` 类型升级（合并颜色方案）

```typescript
/** 分类的完整视觉定义（含 hex 值，供图表/色板预览使用） */
export type ScheduleCategoryVisual = {
  name: string;
  /** Tailwind bg/border/text class（用于时间网格卡片） */
  twClass: string;
  /** Tailwind accent class（用于左侧色条） */
  twAccent: string;
  /** 十六进制色值（用于图表的柱状/饼图、颜色选择器预览） */
  hex: string;
  /** 色系分组（用于色板分组展示） */
  hue: "cold" | "warm" | "neutral";
  /** 是否为核心内置分类（不可删除） */
  isBuiltIn: boolean;
};
```

### 2.3 配色表优化版

区分度优化，冷/暖/中性分组：

```typescript
export const CATEGORY_VISUALS: ScheduleCategoryVisual[] = [
  { name: "深度科研",     twClass: "bg-blue-50 border-blue-300 text-blue-950",       twAccent: "bg-blue-500", hex: "#3b82f6", hue: "cold",    isBuiltIn: true },
  { name: "实验数据",     twClass: "bg-teal-50 border-teal-300 text-teal-950",       twAccent: "bg-teal-500", hex: "#14b8a6", hue: "cold",    isBuiltIn: true },
  { name: "论文写作",     twClass: "bg-indigo-50 border-indigo-300 text-indigo-950", twAccent: "bg-indigo-500", hex: "#6366f1", hue: "cold",    isBuiltIn: true },
  { name: "文献阅读",     twClass: "bg-cyan-50 border-cyan-300 text-cyan-950",       twAccent: "bg-cyan-500", hex: "#06b6d4", hue: "cold",    isBuiltIn: true },
  { name: "课程学习",     twClass: "bg-violet-50 border-violet-300 text-violet-950", twAccent: "bg-violet-500", hex: "#8b5cf6", hue: "cold",    isBuiltIn: true },
  { name: "会议沟通",     twClass: "bg-amber-50 border-amber-300 text-amber-950",     twAccent: "bg-amber-500", hex: "#f59e0b", hue: "warm",    isBuiltIn: true },
  { name: "任务推进",     twClass: "bg-emerald-50 border-emerald-300 text-emerald-950", twAccent: "bg-emerald-500", hex: "#10b981", hue: "cold",  isBuiltIn: true },
  { name: "行政事务",     twClass: "bg-slate-50 border-slate-300 text-slate-950",     twAccent: "bg-slate-400", hex: "#94a3b8", hue: "neutral", isBuiltIn: true },
  { name: "吃饭休息",     twClass: "bg-pink-50 border-pink-300 text-pink-950",        twAccent: "bg-pink-400", hex: "#f472b6", hue: "warm",    isBuiltIn: true },
  { name: "健康运动",     twClass: "bg-orange-50 border-orange-300 text-orange-950",  twAccent: "bg-orange-500", hex: "#f97316", hue: "warm",    isBuiltIn: true },
  { name: "家务杂事",     twClass: "bg-stone-50 border-stone-300 text-stone-950",     twAccent: "bg-stone-400", hex: "#a8a29e", hue: "neutral", isBuiltIn: true },
  { name: "社交娱乐",     twClass: "bg-rose-50 border-rose-300 text-rose-950",        twAccent: "bg-rose-500", hex: "#f43f5e", hue: "warm",    isBuiltIn: true },
  { name: "通勤外出",     twClass: "bg-yellow-50 border-yellow-300 text-yellow-950",  twAccent: "bg-yellow-500", hex: "#eab308", hue: "warm",    isBuiltIn: true },
  { name: "情绪复盘",     twClass: "bg-purple-50 border-purple-300 text-purple-950",  twAccent: "bg-purple-400", hex: "#a855f7", hue: "warm",    isBuiltIn: true },
];

// 保留旧导出兼容，使代码中引用 CATEGORY_COLORS 等的地方不报错
export const CATEGORY_COLORS = CATEGORY_VISUALS.map((item) => item.twClass);
```

### 2.4 新增：默认分类列表生成函数

```typescript
const CATEGORY_STORAGE_KEY = "schedule-user-categories";

/** 生成 15 个核心内置分类（作为默认值） */
export function createDefaultCategoryDefs(): ScheduleCategoryDef[] {
  return CATEGORY_VISUALS.map((v, index) => ({
    id: `${DEFAULT_CATEGORY_ID_PREFIX}${index}`,
    name: v.name,
    color: v.twClass,
    sortOrder: index,
  }));
}

/** 从 localStorage 读取分类列表；如果不存在或解析失败，返回默认列表 */
export function loadCategoryDefs(): ScheduleCategoryDef[] {
  if (typeof window === "undefined") return createDefaultCategoryDefs();
  try {
    const raw = localStorage.getItem(CATEGORY_STORAGE_KEY);
    if (!raw) return createDefaultCategoryDefs();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return createDefaultCategoryDefs();
    return parsed;
  } catch {
    return createDefaultCategoryDefs();
  }
}

/** 持久化分类列表到 localStorage */
export function saveCategoryDefs(defs: ScheduleCategoryDef[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(defs));
  } catch {
    // silently fail
  }
}

/** 生成新分类的 ID */
export function createCategoryId(): string {
  return `cat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 检查分类名是否已被占用（忽略大小写） */
export function isCategoryNameTaken(defs: ScheduleCategoryDef[], name: string, excludeId?: string): boolean {
  return defs.some(
    (d) => d.name.toLowerCase().trim() === name.toLowerCase().trim() && d.id !== excludeId,
  );
}
```

### 2.5 新增：查找函数

```typescript
/** 根据 name 查找 ScheduleCategoryDef */
export function findCategoryDef(defs: ScheduleCategoryDef[], name: string): ScheduleCategoryDef | undefined {
  const normalized = normalizeScheduleCategory(name);
  return defs.find((d) => d.name === normalized);
}

/** 获取分类对应的视觉定义（含 hex/hue），自定义分类从内置分类中继承配色 */
export function getCategoryVisualByName(name: string): ScheduleCategoryVisual {
  // 先精确匹配
  const direct = CATEGORY_VISUALS.find((v) => v.name === name);
  if (direct) return direct;
  // 按别名映射匹配
  const normalized = normalizeScheduleCategory(name);
  const viaAlias = CATEGORY_VISUALS.find((v) => v.name === normalized);
  if (viaAlias) return viaAlias;
  // fallback
  return {
    name,
    twClass: "bg-white border-gray-300 text-gray-900",
    twAccent: "bg-zinc-400",
    hex: "#a1a1aa",
    hue: "neutral",
    isBuiltIn: false,
  };
}

/** 兼容旧导出：查找 CATEGORY_VISUALS */
export function getScheduleCategoryVisual(category: string): ScheduleCategoryVisual {
  const normalized = normalizeScheduleCategory(category);
  const found = CATEGORY_VISUALS.find((v) => v.name === normalized);
  return found ?? {
    name: normalized,
    twClass: "bg-white border-gray-300 text-gray-900",
    twAccent: "bg-zinc-400",
    hex: "#a1a1aa",
    hue: "neutral",
    isBuiltIn: false,
  };
}

export function getScheduleCategoryColor(category: string): string {
  return getScheduleCategoryVisual(category).twClass;
}

export function getScheduleCategoryAccentColor(category: string): string {
  return getScheduleCategoryVisual(category).twAccent;
}

export function getScheduleCategoryHex(category: string): string {
  return getScheduleCategoryVisual(category).hex;
}
```

---

## 三、修改 `weekly-time-grid.tsx` — 分类管理弹窗重构

### 3.1 分类状态改为持久化

```typescript
// 删除原本的 useState<Category[]>(defaultCategories) 和 selectableColors
// 改为：
const [categoryDefs, setCategoryDefs] = useState<ScheduleCategoryDef[]>(() => loadCategoryDefs());

// 持久化副作用
useEffect(() => {
  saveCategoryDefs(categoryDefs);
}, [categoryDefs]);

// 衍生：给当前组件使用的简化格式
const categories: { id: string; name: string; color: string }[] = useMemo(
  () => categoryDefs.map((d) => ({ id: d.id, name: d.name, color: d.color })),
  [categoryDefs],
);
```

### 3.2 删除本地的 categoryAliasMap 和 defaultCategoryPalette

```typescript
// 删除：
// const categoryAliasMap: Record<string, string> = { ... }
// const defaultCategoryPalette: CategoryPalette[] = [ ... ]
// const selectableColors = CATEGORY_COLORS

// normalizeCategoryName 改为直接引用：
import { normalizeScheduleCategory } from "@/lib/categories";
```

### 3.3 分类管理弹窗重写

```tsx
// 分类管理弹窗 state
const [showCategoryManager, setShowCategoryManager] = useState(false);
const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
const [editingCategoryName, setEditingCategoryName] = useState("");
const [editingCategoryColor, setEditingCategoryColor] = useState("");
const [confirmDeleteCategoryId, setConfirmDeleteCategoryId] = useState<string | null>(null);
const [newCategoryName, setNewCategoryName] = useState("");
const [newCategoryColor, setNewCategoryColor] = useState(CATEGORY_VISUALS[0].twClass);

// 分类管理弹窗的 JSX
<Dialog open={showCategoryManager} onOpenChange={(open) => {
  setShowCategoryManager(open);
  if (!open) {
    setEditingCategoryId(null);
    setConfirmDeleteCategoryId(null);
  }
}}>
  <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2 text-lg">
        <Palette className="h-5 w-5 text-primary" />
        分类管理
      </DialogTitle>
    </DialogHeader>

    {/* 现有分类列表 */}
    <div className="space-y-2 mt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">
          现有分类（{categoryDefs.length}）
        </h3>
      </div>

      {categoryDefs
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((def) => {
          const visual = CATEGORY_VISUALS.find((v) => v.twClass === def.color) ?? CATEGORY_VISUALS[0];
          const isBuiltIn = def.id.startsWith("__default__");
          const eventCount = expandedEvents.filter(
            (e) => normalizeScheduleCategory(e.category) === def.name
          ).length;

          return (
            <div
              key={def.id}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors
                ${editingCategoryId === def.id ? "bg-gray-100 ring-1 ring-gray-200" : "hover:bg-gray-50"}`}
            >
              {/* 颜色色块 */}
              <div
                className="h-5 w-5 shrink-0 rounded-md border border-gray-200/50"
                style={{ backgroundColor: visual.hex }}
              />

              {editingCategoryId === def.id ? (
                /* 编辑模式 */
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <Input
                    value={editingCategoryName}
                    onChange={(e) => setEditingCategoryName(e.target.value)}
                    className="h-8 w-40 text-sm"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveEditCategory(def.id); }}
                  />
                  {/* 颜色选择（简洁版） */}
                  <div className="flex gap-1">
                    {CATEGORY_VISUALS.slice(0, 8).map((v) => (
                      <button
                        key={v.hex}
                        type="button"
                        onClick={() => setEditingCategoryColor(v.twClass)}
                        className={`h-6 w-6 rounded-md border-2 transition-all
                          ${editingCategoryColor === v.twClass
                            ? "scale-110 border-gray-900 ring-1 ring-offset-1"
                            : "border-transparent hover:scale-105 hover:border-gray-300"}`}
                        style={{ backgroundColor: v.hex }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="default" onClick={() => handleSaveEditCategory(def.id)}>
                      保存
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingCategoryId(null)}>
                      取消
                    </Button>
                  </div>
                </div>
              ) : (
                /* 显示模式 */
                <>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-800">{def.name}</span>
                    {eventCount > 0 && (
                      <span className="ml-2 text-[11px] text-gray-400">
                        {eventCount} 个事件
                      </span>
                    )}
                    {isBuiltIn && (
                      <span className="ml-2 text-[10px] text-gray-300">内置</span>
                    )}
                  </div>

                  {/* 操作按钮（hover 显示） */}
                  {!isBuiltIn && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCategoryId(def.id);
                          setEditingCategoryName(def.name);
                          setEditingCategoryColor(def.color);
                        }}
                        className="hidden rounded-lg p-1.5 text-gray-400 hover:bg-white hover:text-gray-600 group-hover:block"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteCategoryId(def.id)}
                        className="hidden rounded-lg p-1.5 text-gray-400 hover:bg-white hover:text-red-500 group-hover:block"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          );
        })}
    </div>

    {/* 删除确认 */}
    {confirmDeleteCategoryId && (() => {
      const target = categoryDefs.find((d) => d.id === confirmDeleteCategoryId);
      if (!target) return null;
      const eventCount = expandedEvents.filter(
        (e) => normalizeScheduleCategory(e.category) === target.name
      ).length;

      return (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
          <p className="text-sm font-medium text-red-800">
            确认删除「{target.name}」？
          </p>
          {eventCount > 0 ? (
            <p className="text-sm text-red-600">
              有 <strong>{eventCount}</strong> 个事件正在使用此分类。
              删除后这些事件将自动归为「未分类」。
            </p>
          ) : (
            <p className="text-sm text-red-600">此操作不可撤销。</p>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" onClick={() => handleConfirmDelete(confirmDeleteCategoryId)}>
              确认删除
            </Button>
            <Button size="sm" variant="outline" onClick={() => setConfirmDeleteCategoryId(null)}>
              取消
            </Button>
          </div>
        </div>
      );
    })()}

    {/* 添加新分类 */}
    <div className="mt-6 space-y-4 border-t border-gray-100 pt-4">
      <h3 className="text-sm font-semibold text-gray-700">添加新分类</h3>
      <Input
        value={newCategoryName}
        onChange={(e) => setNewCategoryName(e.target.value)}
        placeholder="输入分类名称"
        onKeyDown={(e) => { if (e.key === "Enter") handleAddCategory(); }}
      />
      <div>
        <p className="mb-2 text-xs font-medium text-gray-500">选择颜色</p>
        <div className="space-y-2">
          {/* 冷色系 */}
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              冷色 · 科研学习
            </p>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_VISUALS.filter((v) => v.hue === "cold").map((v) => (
                <ColorSwatch key={v.hex} visual={v} selected={newCategoryColor === v.twClass} onClick={() => setNewCategoryColor(v.twClass)} />
              ))}
            </div>
          </div>
          {/* 暖色系 */}
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              暖色 · 生活沟通
            </p>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_VISUALS.filter((v) => v.hue === "warm").map((v) => (
                <ColorSwatch key={v.hex} visual={v} selected={newCategoryColor === v.twClass} onClick={() => setNewCategoryColor(v.twClass)} />
              ))}
            </div>
          </div>
          {/* 中性色 */}
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              中性 · 事务缓冲
            </p>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_VISUALS.filter((v) => v.hue === "neutral").map((v) => (
                <ColorSwatch key={v.hex} visual={v} selected={newCategoryColor === v.twClass} onClick={() => setNewCategoryColor(v.twClass)} />
              ))}
            </div>
          </div>
        </div>
      </div>
      <Button type="button" className="w-full" onClick={handleAddCategory}>
        <Plus className="mr-1.5 h-4 w-4" />
        添加分类
      </Button>
    </div>
  </DialogContent>
</Dialog>
```

`ColorSwatch` 组件：

```tsx
function ColorSwatch({
  visual,
  selected,
  onClick,
  small,
}: {
  visual: ScheduleCategoryVisual;
  selected: boolean;
  onClick: () => void;
  small?: boolean;
}) {
  const size = small ? "h-6 w-6" : "h-8 w-8";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${size} rounded-lg border-2 transition-all
        ${selected ? "scale-110 border-gray-900 ring-2 ring-offset-1" : "border-transparent hover:scale-105 hover:border-gray-300"}`}
      style={{ backgroundColor: visual.hex }}
      title={visual.name}
    />
  );
}
```

### 3.4 分类管理 handler 函数

```typescript
function handleAddCategory() {
  const name = newCategoryName.trim();
  if (!name) {
    toast.error("请输入分类名称");
    return;
  }
  if (isCategoryNameTaken(categoryDefs, name)) {
    toast.error("该分类名称已存在");
    return;
  }
  const maxOrder = Math.max(...categoryDefs.map((d) => d.sortOrder), -1);
  setCategoryDefs((prev) => [
    ...prev,
    {
      id: createCategoryId(),
      name,
      color: newCategoryColor,
      sortOrder: maxOrder + 1,
    },
  ]);
  setNewCategoryName("");
  setNewCategoryColor(CATEGORY_VISUALS[0].twClass);
  toast.success(`已添加分类「${name}」`);
}

function handleSaveEditCategory(categoryId: string) {
  const name = editingCategoryName.trim();
  if (!name) {
    toast.error("分类名称不能为空");
    return;
  }
  if (isCategoryNameTaken(categoryDefs, name, categoryId)) {
    toast.error("该分类名称已存在");
    return;
  }
  setCategoryDefs((prev) =>
    prev.map((d) =>
      d.id === categoryId
        ? { ...d, name, color: editingCategoryColor }
        : d,
    ),
  );
  setEditingCategoryId(null);
  toast.success("分类已更新");
}

function handleConfirmDelete(categoryId: string) {
  const target = categoryDefs.find((d) => d.id === categoryId);
  if (!target) return;

  const eventCount = expandedEvents.filter(
    (e) => normalizeScheduleCategory(e.category) === target.name,
  ).length;
  if (eventCount > 0) {
    toast.info(`已删除分类「${target.name}」，${eventCount} 个事件将显示为「未分类」`);
  } else {
    toast.success(`已删除分类「${target.name}」`);
  }

  setCategoryDefs((prev) => prev.filter((d) => d.id !== categoryId));
  setConfirmDeleteCategoryId(null);
}
```

### 3.5 修复创建/编辑事件时的分类默认值

```typescript
// resetCreateDialog - 默认选中第一个分类
function resetCreateDialog(cell: GridCell) {
  setSelectedCell(cell);
  const day = parse(cell.date, "yyyy-MM-dd", new Date());
  const [first] = categories;
  setCreateForm({
    ...defaultForm,
    startHour: cell.startHour,
    endHour: Math.min(24, cell.startHour + 1),
    category: first?.name ?? defaultForm.category,
  });
  // ...
}
```

### 3.6 修复分类 Select 下拉的颜色指示器

```tsx
// 在创建/编辑事件弹窗中
<Select value={editForm.category} onValueChange={(v) => setEditForm((prev) => ({ ...prev, category: v || categories[0]?.name }))}>
  <SelectTrigger>
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    {categories.map((cat) => {
      const visual = getCategoryVisualByName(cat.name);
      return (
        <SelectItem key={cat.id} value={cat.name}>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm border" style={{ backgroundColor: visual.hex }} />
            {cat.name}
          </div>
        </SelectItem>
      );
    })}
  </SelectContent>
</Select>
```

---

## 四、修复 `page.tsx` 中硬编码的脏数据

### 4.1 替换第 1894 行的乱码默认分类

```typescript
// 原来：category: "浠诲姟鎺ㄨ繘",
// 改为：
category: "任务推进",
```

### 4.2 对齐 `normalizeEvents` 的默认分类

```typescript
// src/lib/normalizers.ts
// 原来：category: value.category ?? "任务推进",
// 改为：从 categories.ts 的配置中取第一个默认分类作为 fallback
// 由于 normalizers 是纯函数不依赖 UI state，使用字符串常量
category: value.category ?? "深度科研",
```

---

## 五、修复 `schedule-time-analytics.tsx` 中的分类颜色

当前 `ScheduleTimeAnalytics` 组件中的 `TimelineSegment` 的 `accent` 字段使用了 `getScheduleCategoryAccentColor`，返回的是 Tw class 字符串，但在其 timeline 渲染中可能无法正确渲染。检查并修复为：

```typescript
// 使用 hex 值作为备用
accent: getScheduleCategoryHex(event.category),
```

---

## 六、修复单元测试

原来的测试断言 `CATEGORY_COLORS[0] === CATEGORY_VISUALS[0].color` 在字段改名后需要更新为 `.twClass`：

```typescript
// src/lib/__tests__/categories.test.ts
// 改为：
expect(CATEGORY_COLORS[0]).toBe(CATEGORY_VISUALS[0].twClass);
```

---

## 七、import 变更清单

### weekly-time-grid.tsx 中修改/新增的 import

```typescript
// DELETE
// import { getScheduleCategoryColor, getScheduleCategoryAccentColor, CATEGORY_COLORS, DEFAULT_CATEGORY_PALETTE } from "@/lib/categories";

// ADD/REPLACE
import {
  CATEGORY_VISUALS,
  normalizeScheduleCategory,
  getScheduleCategoryColor,
  getScheduleCategoryAccentColor,
  getScheduleCategoryHex,
  getCategoryVisualByName,
  loadCategoryDefs,
  saveCategoryDefs,
  createCategoryId,
  isCategoryNameTaken,
} from "@/lib/categories";
import type { ScheduleCategoryDef } from "@/lib/categories";
import { Palette, Pencil, GripVertical } from "lucide-react"; // 新增图标
import { Plus } from "lucide-react"; // 已有
```

---

## 八、执行步骤

1. **修改 `src/lib/categories.ts`** — 新增 `ScheduleCategoryDef`、`loadCategoryDefs`、`saveCategoryDefs`、`createCategoryId`、`isCategoryNameTaken`、`getCategoryVisualByName` 等函数；更新 `ScheduleCategoryVisual` 增加 `hex` 和 `hue`；优化配色表
2. **修改 `src/components/schedule/weekly-time-grid.tsx`** — 分类状态改为从 localStorage 加载/保存；删除 `defaultCategoryPalette`、`selectableColors`、`categoryAliasMap`；重写分类管理弹窗（编辑 + 删除确认 + 色板分组 + 颜色指示器）
3. **修复 `src/app/page.tsx` 第 1894 行** — 把 `"浠诲姟鎺ㄨ繘"` 改为 `"任务推进"`
4. **修改 `src/lib/normalizers.ts`** — 统一默认分类为 `"深度科研"`
5. **修改 `src/lib/__tests__/categories.test.ts`** — 适配新字段名 `.twClass`
6. **验证 `ScheduleTimeAnalytics`** — 确保 accent 颜色使用 hex
7. `npm run build` 验证

---

## 九、验收标准

- [ ] 添加新分类后刷新页面，分类依然存在（持久化到 localStorage）
- [ ] 编辑分类名称和颜色后刷新页面，修改不丢失
- [ ] 内置分类不可删除
- [ ] 删除已有事件的分类时，提示受影响的事件数量
- [ ] 颜色选择器展示真实色块，按「冷色/暖色/中性」分组
- [ ] 创建/编辑事件弹窗的 Select 下拉项带颜色圆点
- [ ] 默认分类统一为「深度科研」（`normalizeEvents` + 创建事件 + 自然语言输入）
- [ ] 分类别名映射统一在 `categories.ts` 中定义
- [ ] `npm run build` 无 TypeScript 错误
- [ ] `npm test` 通过（categories 相关测试）
- [ ] 图表组件（CategoryPieChart、ScheduleTimeAnalytics）使用 hex 色值渲染颜色

---

## 十、注意事项

1. **向后兼容** 所有导出函数的签名不变，只是内部实现升级
2. **数据迁移** 老用户可能已有 localStorage 中存了旧版本的分类数据（如果有的话），`loadCategoryDefs` 会做数组校验，失败则回退到默认
3. **`confirm-dialog.tsx`** 删除确认目前用内联确认 UI，后续 Prompt 15 实现 `ConfirmDialog` 后可以替换
4. **排序** 当前实现使用 `sortOrder` 数值排序，未来可以升级为拖拽排序（需要 `@dnd-kit/core` 等库）
