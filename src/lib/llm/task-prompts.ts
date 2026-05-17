import type { LongTask } from "@/lib/types";

export function buildTaskDecompositionPrompt(task: LongTask) {
  return `请将下面的长期任务拆解为 5-10 个可执行子任务。

要求：
1. 每个子任务必须是具体动作，不要空泛。
2. 尽量按执行顺序排列。
3. 只输出 JSON 数组，数组元素为字符串，不要输出解释。

任务名称：${task.name}
截止日期：${task.dueDate}
优先级：${task.priority}
备注：${task.notes || "无"}
注意事项：
${task.precautions.join("\n") || "无"}
已有子任务：
${task.subtasks.map((item) => `- ${item.name}`).join("\n") || "无"}`;
}

export function parseTaskSuggestions(raw: string): string[] {
  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean);
    }
  } catch {
    // Fall through to markdown/list parsing.
  }

  return trimmed
    .split("\n")
    .map((line) => line.replace(/^[-*\d.\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 12);
}
