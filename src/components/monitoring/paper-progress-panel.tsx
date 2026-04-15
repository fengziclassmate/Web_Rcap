"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type PaperPlanItem = {
  id: string;
  date: string;
  content: string;
  done: boolean;
};

export type PaperProgress = {
  title: string;
  totalChapters: number;
  doneChapters: number;
  nextStepPlan: string;
  milestones: string;
  dailyPlans: PaperPlanItem[];
  weeklyPlans: PaperPlanItem[];
  monthlyPlans: PaperPlanItem[];
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function sortPlans(plans: PaperPlanItem[]) {
  return [...plans].sort((a, b) => b.date.localeCompare(a.date));
}

export function PaperProgressPanel({
  value,
  onChange,
}: {
  value: PaperProgress;
  onChange: (value: PaperProgress) => void;
}) {
  const [draft, setDraft] = useState<PaperProgress>(value);

  // sync in when switching users/modules
  useEffect(() => {
    setDraft(value);
  }, [value]);

  function patch(patchValue: Partial<PaperProgress>) {
    setDraft((prev) => ({ ...prev, ...patchValue }));
  }

  function togglePlan(kind: "dailyPlans" | "weeklyPlans" | "monthlyPlans", id: string) {
    setDraft((prev) => ({
      ...prev,
      [kind]: prev[kind].map((p) => (p.id === id ? { ...p, done: !p.done } : p)),
    }));
  }

  function deletePlan(kind: "dailyPlans" | "weeklyPlans" | "monthlyPlans", id: string) {
    setDraft((prev) => ({ ...prev, [kind]: prev[kind].filter((p) => p.id !== id) }));
  }

  function addPlan(kind: "dailyPlans" | "weeklyPlans" | "monthlyPlans", content: string, date: string) {
    const trimmed = content.trim();
    if (!trimmed) return;
    setDraft((prev) => ({
      ...prev,
      [kind]: [{ id: `paper-plan-${Date.now()}`, date, content: trimmed, done: false }, ...prev[kind]],
    }));
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white shadow-md">
      <header className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-semibold tracking-tight text-gray-900">论文进度</h2>
        <p className="mt-1 text-sm text-gray-600">维护论文基础信息与日/周/月写作计划。</p>
      </header>

      <div className="space-y-5 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="paper-title">论文题目</Label>
            <Input
              id="paper-title"
              value={draft.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="例如：……"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="paper-total">总章节数</Label>
              <Input
                id="paper-total"
                inputMode="numeric"
                value={String(draft.totalChapters)}
                onChange={(e) => patch({ totalChapters: Number(e.target.value || 0) })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paper-done">已完成章节</Label>
              <Input
                id="paper-done"
                inputMode="numeric"
                value={String(draft.doneChapters)}
                onChange={(e) => patch({ doneChapters: Number(e.target.value || 0) })}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="paper-next">下一步计划</Label>
            <Textarea
              id="paper-next"
              value={draft.nextStepPlan}
              onChange={(e) => patch({ nextStepPlan: e.target.value })}
              className="min-h-20"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="paper-milestones">时间节点</Label>
            <Textarea
              id="paper-milestones"
              value={draft.milestones}
              onChange={(e) => patch({ milestones: e.target.value })}
              placeholder="可按行写：2026-05-01：完成第 2 章初稿"
              className="min-h-20"
            />
          </div>
        </div>

        <PaperPlanEditor
          title="每日写作计划"
          plans={draft.dailyPlans}
          onAdd={(content, date) => addPlan("dailyPlans", content, date)}
          onToggle={(id) => togglePlan("dailyPlans", id)}
          onDelete={(id) => deletePlan("dailyPlans", id)}
        />
        <PaperPlanEditor
          title="每周写作计划"
          plans={draft.weeklyPlans}
          onAdd={(content, date) => addPlan("weeklyPlans", content, date)}
          onToggle={(id) => togglePlan("weeklyPlans", id)}
          onDelete={(id) => deletePlan("weeklyPlans", id)}
          dateHint="（建议填本周周一日期）"
        />
        <PaperPlanEditor
          title="每月写作计划"
          plans={draft.monthlyPlans}
          onAdd={(content, date) => addPlan("monthlyPlans", content, date)}
          onToggle={(id) => togglePlan("monthlyPlans", id)}
          onDelete={(id) => deletePlan("monthlyPlans", id)}
          dateHint="（建议填当月 01 号日期）"
        />

        <Button
          type="button"
          className="w-full"
          onClick={() => {
            const safe: PaperProgress = {
              ...draft,
              title: draft.title.trim(),
              totalChapters: Math.max(0, Number.isFinite(draft.totalChapters) ? draft.totalChapters : 0),
              doneChapters: Math.max(0, Number.isFinite(draft.doneChapters) ? draft.doneChapters : 0),
            };
            onChange(safe);
          }}
        >
          保存论文进度
        </Button>
      </div>
    </section>
  );
}

function PaperPlanEditor({
  title,
  plans,
  onAdd,
  onToggle,
  onDelete,
  dateHint,
}: {
  title: string;
  plans: PaperPlanItem[];
  onAdd: (content: string, date: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  dateHint?: string;
}) {
  const [draft, setDraft] = useState("");
  const [date, setDate] = useState(todayISO());
  const sorted = useMemo(() => sortPlans(plans), [plans]);

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        {dateHint ? <p className="text-xs text-gray-500">{dateHint}</p> : null}
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="sm:w-44" />
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="输入计划…" />
        <Button
          type="button"
          size="sm"
          onClick={() => {
            onAdd(draft, date);
            setDraft("");
          }}
          className="sm:w-24"
        >
          <Plus className="mr-1 h-4 w-4" />
          添加
        </Button>
      </div>

      {sorted.length === 0 ? (
        <p className="mt-3 text-xs text-gray-500">暂无计划</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {sorted.map((p) => (
            <li
              key={p.id}
              className={cn(
                "flex items-start justify-between gap-2 rounded-md border border-gray-200 bg-white px-3 py-2",
                p.done && "bg-gray-50 text-gray-500",
              )}
            >
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => onToggle(p.id)}
                title="点击切换完成状态"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={cn("h-4 w-4", p.done ? "text-green-600" : "text-gray-300")} aria-hidden />
                  <span className="text-xs text-gray-500">{p.date}</span>
                </div>
                <p className={cn("mt-1 break-words text-sm", p.done && "line-through")}>{p.content}</p>
              </button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-md hover:bg-red-50 hover:text-red-600"
                onClick={() => onDelete(p.id)}
                aria-label="删除计划"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

