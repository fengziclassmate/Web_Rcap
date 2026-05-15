# Prompt 05 — 智能任务分解

> **依赖：** 必须先完成 Prompt 01（LLM 基础架构）
> **目标：** 用户创建/编辑长期任务时，点击"✨ AI 分解"按钮，LLM 根据任务名称和上下文自动生成
> 子任务列表（含预估时间），用户可一键导入。

---

## 一、新增文件：`src/lib/llm/task-prompts.ts`

任务分解的 prompt 模板。

```typescript
import type { LongTask, SubTask } from "@/lib/types";

export type TaskDecompositionResult = {
  subtasks: { name: string; estimate: string }[];
};

/** 构建任务分解 prompt */
export function buildTaskDecompositionPrompt(taskName: string, context?: {
  notes?: string;
  precautions?: string[];
  projectName?: string;
}): string {
  let contextStr = "";
  if (context?.notes) contextStr += `\n任务备注: ${context.notes}`;
  if (context?.precautions?.length) contextStr += `\n注意事项: ${context.precautions.join("; ")}`;
  if (context?.projectName) contextStr += `\n所属项目: ${context.projectName}`;

  return `请将以下科研任务分解为可执行的子任务列表。

任务名称：${taskName}${contextStr}

要求：
1. 返回纯 JSON 数组，格式：[{"name": "子任务描述", "estimate": "预估时间"}]
2. 子任务 3-8 个，描述具体可执行
3. estimate 写中文如 "1小时" "2天" "30分钟"
4. 只返回 JSON，不要任何解释文字

示例：
[{"name": "确认数据源可用性", "estimate": "30分钟"}, {"name": "编写数据清洗脚本", "estimate": "3小时"}]`;
}

/** 尝试从 LLM 回复中解析子任务 JSON */
export function parseTaskDecompositionResponse(response: string): TaskDecompositionResult | null {
  try {
    // 尝试直接解析
    const parsed = JSON.parse(response.trim());
    if (Array.isArray(parsed)) {
      return {
        subtasks: parsed
          .filter((item: unknown) => {
            const s = item as { name?: string; estimate?: string };
            return typeof s.name === "string" && s.name.trim().length > 0;
          })
          .map((item: unknown) => {
            const s = item as { name?: string; estimate?: string };
            return { name: s.name!.trim(), estimate: s.estimate?.trim() ?? "" };
          }),
      };
    }
  } catch {
    // 尝试从 markdown code block 中提取
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1].trim());
        if (Array.isArray(parsed)) {
          return {
            subtasks: parsed.map((item: { name?: string; estimate?: string }) => ({
              name: item.name?.trim() ?? "",
              estimate: item.estimate?.trim() ?? "",
            })),
          };
        }
      } catch {
        // ignore
      }
    }
  }

  return null;
}
```

## 二、新增组件：`src/components/llm/task-decomposition-dialog.tsx`

任务分解的确认弹窗。

```tsx
"use client";

import { useState } from "react";
import { Sparkles, Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { buildTaskDecompositionPrompt, parseTaskDecompositionResponse } from "@/lib/llm/task-prompts";
import type { SubTask } from "@/lib/types";

type TaskDecompositionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskName: string;
  taskNotes?: string;
  taskPrecautions?: string[];
  projectName?: string;
  /** 用户确认导入子任务时触发 */
  onConfirmImport: (subtasks: SubTask[]) => void;
};

export function TaskDecompositionDialog({
  open,
  onOpenChange,
  taskName,
  taskNotes,
  taskPrecautions,
  projectName,
  onConfirmImport,
}: TaskDecompositionDialogProps) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<{ name: string; estimate: string }[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  async function handleDecompose() {
    setLoading(true);
    setSuggestions([]);

    try {
      const prompt = buildTaskDecompositionPrompt(taskName, {
        notes: taskNotes,
        precautions: taskPrecautions,
        projectName,
      });

      const res = await fetch("/api/llm/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          maxTokens: 2048,
          stream: false,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "分解失败");
      }

      const data = await res.json();
      const result = parseTaskDecompositionResponse(data.content);

      if (!result || result.subtasks.length === 0) {
        throw new Error("AI 返回的格式无法解析，请重试");
      }

      setSuggestions(result.subtasks);
      setSelected(new Set(result.subtasks.map((_, i) => i)));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "分解失败";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  function toggleSelect(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function handleImport() {
    const selectedSubtasks: SubTask[] = suggestions
      .filter((_, i) => selected.has(i))
      .map((s) => ({
        id: crypto.randomUUID(),
        name: `${s.name}${s.estimate ? ` (${s.estimate})` : ""}`,
        done: false,
      }));

    if (selectedSubtasks.length === 0) {
      toast.error("请至少选择一个子任务");
      return;
    }

    onConfirmImport(selectedSubtasks);
    toast.success(`已导入 ${selectedSubtasks.length} 个子任务`);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI 任务分解
          </DialogTitle>
          <DialogDescription>
            正在为「{taskName}」生成子任务建议
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 加载状态 */}
          {loading && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
              <p className="text-sm text-stone-500">AI 正在分析任务…</p>
            </div>
          )}

          {/* 初始空状态 */}
          {!loading && suggestions.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-8">
              <p className="text-sm text-stone-500">
                点击「开始分解」让 AI 分析该任务的子任务结构
              </p>
              <Button type="button" onClick={handleDecompose}>
                <Sparkles className="mr-1.5 h-4 w-4" />
                开始分解
              </Button>
            </div>
          )}

          {/* 建议列表 */}
          {suggestions.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-stone-500">
                选择要导入的子任务（共 {suggestions.length} 项建议）
              </p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {suggestions.map((s, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                      selected.has(i)
                        ? "border-stone-400 bg-stone-50"
                        : "border-stone-200 bg-white hover:border-stone-300"
                    }`}
                    onClick={() => toggleSelect(i)}
                  >
                    <div
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                        selected.has(i)
                          ? "border-stone-950 bg-stone-950 text-white"
                          : "border-stone-300"
                      }`}
                    >
                      {selected.has(i) && <Check className="h-3 w-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-stone-800">{s.name}</p>
                      {s.estimate && (
                        <p className="mt-0.5 text-xs text-stone-400">⏱ {s.estimate}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  className="text-xs text-stone-400 hover:text-stone-600"
                  onClick={() => {
                    if (selected.size === suggestions.length) setSelected(new Set());
                    else setSelected(new Set(suggestions.map((_, i) => i)));
                  }}
                >
                  {selected.size === suggestions.length ? "取消全选" : "全选"}
                </button>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={handleDecompose}>
                    重新生成
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleImport}
                    disabled={selected.size === 0}
                  >
                    导入 {selected.size > 0 ? `(${selected.size})` : ""}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

## 三、修改：`src/components/schedule/task-dashboard.tsx`

在**编辑任务**的弹窗中添加"AI 分解"入口。

需要在任务的编辑 Dialog 中（编辑任务状态时）添加一个"AI 分解"按钮。当前编辑在 `handleOpenEdit` / `TaskDraft` 状态中，在编辑面板中合适位置添加：

```tsx
// 新增 import
import { TaskDecompositionDialog } from "@/components/llm/task-decomposition-dialog";
import { Sparkles } from "lucide-react";

// 新增状态
const [decomposeOpen, setDecomposeOpen] = useState(false);

// 在编辑弹窗的 subtasks 区域附近（"添加子任务"按钮旁边）添加：
<Button
  type="button"
  variant="outline"
  size="sm"
  onClick={() => setDecomposeOpen(true)}
  className="gap-1"
>
  <Sparkles className="h-3.5 w-3.5" />
  AI 分解
</Button>

// 在编辑弹窗内添加 Dialog（与编辑弹窗同级但独立控制）：
<TaskDecompositionDialog
  open={decomposeOpen}
  onOpenChange={setDecomposeOpen}
  taskName={taskDraft?.name ?? ""}
  taskNotes={taskDraft?.notes}
  taskPrecautions={taskDraft?.precautionsText.split("\n").filter(Boolean)}
  onConfirmImport={(newSubtasks) => {
    // 将 LLM 生成的子任务追加到当前 taskDraft 的 subtasks 中
    if (taskDraft) {
      setTaskDraft(prev => prev ? {
        ...prev,
        subtasks: [...prev.subtasks, ...newSubtasks],
      } : prev);
    }
  }}
/>
```

**位置说明：** 找到 `task-dashboard.tsx` 中编辑任务的 Dialog（使用 `editingTaskId`/`taskDraft` 状态控制的那个），在子任务列表的输入框附近添加 AI 分解按钮。

## 验收标准

- [ ] `npm run build` 通过
- [ ] 编辑任务时可以看到"✨ AI 分解"按钮
- [ ] 点击按钮弹出分解弹窗，开始分解——带 loading 动画
- [ ] 分解完成后以 list 形式显示建议子任务
- [ ] 可以勾选/取消勾选子任务
- [ ] 点击"导入"后子任务追加到当前任务
- [ ] 解析失败时有友好错误提示
