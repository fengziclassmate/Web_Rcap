# Prompt 15 — 小 Bug 修复 + 体验打磨

> **依赖：** 无（可独立执行）
> **目标：** 修复项目中已发现的几个烦人小问题，提升日常使用体验

---

## 一、Bug 1：月视图翻页逻辑错误

**症状：** 当前 `currentWeekStart` 在月视图下依然按"周"翻页。用户点了"下个月"，实际只翻了 7 天。

**根源：** `setCurrentWeekStart` 在月视图下调用 `addWeeks(current, 1)`，但在月视图下应该用 `addMonths` 或跳转 28-35 天。

**修复位置：** `src/app/page.tsx`（或 `ui-context.tsx`）中翻页 handler：

```tsx
function handleNextWeek() {
  setCurrentWeekStart((prev) => {
    if (viewMode === "day") return addDays(prev, 1);
    if (viewMode === "week") return addWeeks(prev, 1);
    // 月视图：加 4 周（≈一个月）
    return addWeeks(prev, 4);
  });
}

function handlePrevWeek() {
  setCurrentWeekStart((prev) => {
    if (viewMode === "day") return addDays(prev, -1);
    if (viewMode === "week") return addWeeks(prev, -1);
    return addWeeks(prev, -4);
  });
}
```

**额外改进：** 月视图顶部显示月份标题而非周范围：

```tsx
const monthLabel = useMemo(() => {
  if (viewMode === "month") {
    return format(currentWeekStart, "yyyy 年 M 月", { locale: zhCN });
  }
  return weekRange;
}, [viewMode, currentWeekStart, weekRange]);
```

---

## 二、Bug 2：足迹跟踪天数计算错误

**症状：** `daysBetweenInclusive` 将当天计算为 1 天。例如「距上次跑步：1 天」实际上用户今天刚跑完。

**根源：** `daysBetweenInclusive` 计算时 `+1` 导致当天显示为 1。

**修复位置：** `src/components/schedule/task-dashboard.tsx`

```typescript
// 修改前
function daysBetweenInclusive(startIso: string, endIso: string) {
  // ...
  return Math.floor(ms / (24 * 60 * 60 * 1000)) + 1;  // +1 导致今天显示 1 天
}

// 修改后
function daysSince(startIso: string): number {
  const start = new Date(`${startIso}T00:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const ms = now.getTime() - start.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}
```

同时修改显示逻辑：

```tsx
// 足迹显示处
const days = daysSince(lastDate);
const display = days === 0 ? "今天" : `${days} 天前`;
```

---

## 三、Bug 3：确认弹窗样式不一致

**症状：** `confirmDangerousActions` 使用原生 `window.confirm()`，与其他 UI 风格不统一。

**修复：** 替换为自定义 Dialog 组件。

### 新建 `src/components/ui/confirm-dialog.tsx`

```tsx
"use client";

import { AlertTriangle } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
  onConfirm: () => void;
};

export function ConfirmDialog({
  open, onOpenChange, title, description,
  confirmLabel = "确认删除", cancelLabel = "取消",
  variant = "danger", onConfirm,
}: ConfirmDialogProps) {
  const buttonVariant = variant === "danger" ? "destructive" : variant === "warning" ? "secondary" : "default";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription className="mt-1">{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button variant={buttonVariant} onClick={() => { onConfirm(); onOpenChange(false); }}>
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### 修改 TaskDashboard 中使用 `window.confirm` 的位置

```tsx
// 原代码
function withOptionalConfirm(message: string, action: () => void) {
  if (!confirmDangerousActions) {
    action();
    return;
  }
  if (typeof window !== "undefined" && !window.confirm(message)) {
    return;
  }
  action();
}

// 改为 ConfirmDialog
const [confirmState, setConfirmState] = useState<{
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
} | null>(null);

function showConfirm(title: string, description: string, onConfirm: () => void) {
  if (!confirmDangerousActions) {
    onConfirm();
    return;
  }
  setConfirmState({ open: true, title, description, onConfirm });
}

// 在 JSX 末尾添加
{confirmState && (
  <ConfirmDialog
    open={confirmState.open}
    onOpenChange={(open) => setConfirmState(open ? confirmState : null)}
    title={confirmState.title}
    description={confirmState.description}
    onConfirm={confirmState.onConfirm}
  />
)}
```

然后所有调用了 `withOptionalConfirm` 的地方改为 `showConfirm`。

---

## 四、Bug 4：编辑循环事件 scope 记忆

**症状：** 用户编辑循环事件的实例时，默认 scope 总是 "仅此日"，切换为"整个系列"后下次又变回。

**修复：** 在 `ui-context.tsx` 或 localStorage 中添加记忆：

```tsx
// ui-context.tsx 中
const [recurrenceEditScope, setRecurrenceEditScope] = useState<"occurrence" | "series">(
  () => {
    if (typeof window === "undefined") return "occurrence";
    return (localStorage.getItem("recurrence-edit-scope") as "occurrence" | "series") ?? "occurrence";
  }
);

function saveRecurrenceEditScope(scope: "occurrence" | "series") {
  setRecurrenceEditScope(scope);
  localStorage.setItem("recurrence-edit-scope", scope);
}
```

修改 `WeeklyTimeGrid` 中的编辑弹窗：

```tsx
// 打开编辑时
function handleOpenEdit(event: ScheduleEvent) {
  setEditingEventId(event.id);
  // 根据事件类型决定默认 scope
  const parsed = parseSyntheticEventId(event.id);
  if (parsed) {
    // 循环事件：使用记忆或者默认 occurrence
    setEditScope(savedScope ?? "occurrence");
  } else {
    setEditScope("occurrence");
  }
  // ……填充表单
}
```

---

## 五、Bug 5：首次加载时 layout shift

**症状：** 页面首次加载后，数据从 Supabase 返回前显示空白，然后组件闪烁。

**修复：** 在 `layout.tsx` 或 `page.tsx` 添加骨架屏：

```tsx
// 创建一个最小占位组件
function LoadingSkeleton() {
  return (
    <div className="workbench-shell min-h-screen p-4">
      <div className="animate-pulse space-y-4">
        <div className="h-12 rounded-2xl bg-gray-200/60" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="h-[400px] rounded-2xl bg-gray-200/60 lg:col-span-2" />
          <div className="h-[400px] rounded-2xl bg-gray-200/60" />
        </div>
      </div>
    </div>
  );
}

// 在 page.tsx 中使用
export default function Home() {
  // ...
  if (!dataReady) return <LoadingSkeleton />;
  // ...
}
```

---

## 六、Bug 6：事件编辑弹窗的快速操作改进

**症状：** 编辑事件时，修改标题后需要手动保存，然后关闭。操作链长：改内容 → 点保存 → 点关闭。

**改进：** 点击「保存并关闭」或按 `Ctrl+Enter` / `Cmd+Enter` 保存：

```tsx
// 在编辑弹窗的 DialogContent 中添加键盘监听
function handleKeyDown(e: React.KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
    e.preventDefault();
    handleSaveEdit();
  }
}

// DialogContent 中添加
<DialogContent onKeyDown={handleKeyDown}>
```

---

## 七、Bug 7：事件标签颜色和分类管理的问题

**症状：** 已有的分类管理中，添加新分类后没有关闭对话框，还需要手动操作。

**改进：** 创建分类后自动关闭弹窗 + toast 反馈：

```tsx
function handleAddCategory() {
  if (!newCategory.name.trim()) return;
  if (categories.some((c) => c.name === newCategory.name.trim())) {
    toast.error("分类名已存在");
    return;
  }
  const newCat: Category = {
    id: createId("cat"),
    name: newCategory.name.trim(),
    color: newCategory.color,
  };
  setCategories((prev) => [...prev, newCat]);
  setNewCategory({ name: "", color: selectableColors[0] });
  setShowCategoryManager(false);      // 关闭
  toast.success(`已添加分类「${newCat.name}」`);
}
```

---

## 八、执行步骤

按以下顺序修复，每次修复后编译验证：

1. 修复月视图翻页（最影响日常使用）
2. 修复足迹天数计算
3. 替换 `window.confirm` 为 `ConfirmDialog`
4. 添加编辑 scope 记忆
5. 添加首屏骨架屏
6. 添加快捷键支持
7. 完善分类管理
8. `npm run build` 最终验证

## 九、验收标准

- [ ] 月视图下点击翻页跳转一整月
- [ ] 足迹追踪"距离上次 0 天"正确显示为"今天"
- [ ] 删除任务/事件时弹出自定义确认弹窗（无原生 confirm）
- [ ] 编辑循环事件时 scope 偏好持久化
- [ ] 页面加载时有骨架屏过渡
- [ ] 按 Ctrl+Enter 保存编辑
- [ ] 创建分类成功后自动关闭对话框
