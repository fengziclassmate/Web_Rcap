"use client";

import { useState } from "react";
import { Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLLMChat } from "@/hooks/useLLMChat";
import { buildTaskDecompositionPrompt, parseTaskSuggestions } from "@/lib/llm/task-prompts";
import type { LongTask } from "@/lib/types";

type TaskDecompositionDialogProps = {
  task: LongTask;
  onImport: (subtasks: string[]) => void;
};

export function TaskDecompositionDialog({ task, onImport }: TaskDecompositionDialogProps) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ name: string; selected: boolean }>>([]);
  const { loading, error, sendMessage } = useLLMChat();

  async function handleGenerate() {
    const result = await sendMessage(buildTaskDecompositionPrompt(task), { temperature: 0.25 });
    const parsed = parseTaskSuggestions(result);
    setSuggestions(parsed.map((name) => ({ name, selected: true })));
  }

  function handleImport() {
    onImport(suggestions.filter((item) => item.selected).map((item) => item.name));
    setOpen(false);
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Wand2 className="h-4 w-4" />
        AI 分解
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>智能任务分解</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm">
              <p className="font-medium">{task.name}</p>
              <p className="mt-1 text-gray-500">截止：{task.dueDate}，优先级：{task.priority}</p>
            </div>
            <Button type="button" onClick={handleGenerate} disabled={loading}>
              {loading ? "分解中..." : "生成子任务建议"}
            </Button>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <div className="space-y-2">
              {suggestions.map((item, index) => (
                <label key={`${item.name}-${index}`} className="flex items-center gap-2 rounded-lg border border-gray-200 p-2 text-sm">
                  <Checkbox
                    checked={item.selected}
                    onCheckedChange={() =>
                      setSuggestions((prev) =>
                        prev.map((suggestion, i) =>
                          i === index ? { ...suggestion, selected: !suggestion.selected } : suggestion,
                        ),
                      )
                    }
                  />
                  {item.name}
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button type="button" onClick={handleImport} disabled={!suggestions.some((item) => item.selected)}>
                导入选中子任务
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
