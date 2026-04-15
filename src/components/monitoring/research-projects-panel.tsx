"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, Pencil, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type PlanItem = {
  id: string;
  date: string; // yyyy-MM-dd or yyyy-Wxx or yyyy-MM
  content: string;
  done: boolean;
};

export type ResearchProject = {
  id: string;
  name: string;
  content: string;
  techDetails: string;
  nextStepPlan: string;
  milestones: string;
  dailyPlans: PlanItem[];
  weeklyPlans: PlanItem[];
  monthlyPlans: PlanItem[];
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function sortPlans(plans: PlanItem[]) {
  return [...plans].sort((a, b) => b.date.localeCompare(a.date));
}

export function ResearchProjectsPanel({
  projects,
  onAdd,
  onUpdate,
  onDelete,
}: {
  projects: ResearchProject[];
  onAdd: (value: Omit<ResearchProject, "id">) => void;
  onUpdate: (id: string, patch: Partial<Omit<ResearchProject, "id">>) => void;
  onDelete: (id: string) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = projects.find((p) => p.id === editingId) ?? null;

  const [form, setForm] = useState<Omit<ResearchProject, "id">>({
    name: "",
    content: "",
    techDetails: "",
    nextStepPlan: "",
    milestones: "",
    dailyPlans: [],
    weeklyPlans: [],
    monthlyPlans: [],
  });

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => a.name.localeCompare(b.name)),
    [projects],
  );

  function openCreate() {
    setEditingId(null);
    setForm({
      name: "",
      content: "",
      techDetails: "",
      nextStepPlan: "",
      milestones: "",
      dailyPlans: [],
      weeklyPlans: [],
      monthlyPlans: [],
    });
    setDialogOpen(true);
  }

  function openEdit(project: ResearchProject) {
    setEditingId(project.id);
    setForm({
      name: project.name,
      content: project.content,
      techDetails: project.techDetails,
      nextStepPlan: project.nextStepPlan,
      milestones: project.milestones,
      dailyPlans: project.dailyPlans ?? [],
      weeklyPlans: project.weeklyPlans ?? [],
      monthlyPlans: project.monthlyPlans ?? [],
    });
    setDialogOpen(true);
  }

  function save() {
    const name = form.name.trim();
    if (!name) return;
    if (editingId) {
      onUpdate(editingId, { ...form, name });
    } else {
      onAdd({ ...form, name });
    }
    setDialogOpen(false);
  }

  function togglePlan(kind: "dailyPlans" | "weeklyPlans" | "monthlyPlans", planId: string) {
    setForm((prev) => ({
      ...prev,
      [kind]: prev[kind].map((p) => (p.id === planId ? { ...p, done: !p.done } : p)),
    }));
  }

  function deletePlan(kind: "dailyPlans" | "weeklyPlans" | "monthlyPlans", planId: string) {
    setForm((prev) => ({ ...prev, [kind]: prev[kind].filter((p) => p.id !== planId) }));
  }

  function addPlan(kind: "dailyPlans" | "weeklyPlans" | "monthlyPlans", content: string, date: string) {
    const trimmed = content.trim();
    if (!trimmed) return;
    setForm((prev) => ({
      ...prev,
      [kind]: [{ id: `plan-${Date.now()}`, date, content: trimmed, done: false }, ...prev[kind]],
    }));
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white shadow-md">
      <header className="flex items-center justify-between gap-3 border-b border-gray-200 px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-gray-900">科研项目进度</h2>
          <p className="mt-1 text-sm text-gray-600">维护项目基础信息与日/周/月计划。</p>
        </div>
        <Button type="button" size="sm" onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" />
          新增项目
        </Button>
      </header>

      <div className="p-6">
        {sortedProjects.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-500">
            暂无科研项目。你可以先新增一个项目并录入计划。
          </div>
        ) : (
          <div className="space-y-3">
            {sortedProjects.map((project) => (
              <div key={project.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900" title={project.name}>
                      {project.name}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-gray-600">{project.nextStepPlan || project.content}</p>
                    <p className="mt-2 text-xs text-gray-500">
                      计划：日 {project.dailyPlans.length} / 周 {project.weeklyPlans.length} / 月{" "}
                      {project.monthlyPlans.length}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-md hover:bg-gray-100"
                      onClick={() => openEdit(project)}
                      aria-label="编辑项目"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-md hover:bg-red-50 hover:text-red-600"
                      onClick={() => onDelete(project.id)}
                      aria-label="删除项目"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-lg border-gray-200 shadow-lg sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-900">
              {editing ? "编辑科研项目" : "新增科研项目"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="rp-name">项目名称</Label>
              <Input
                id="rp-name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="例如：基于 X 的模型改进 / 数据集构建 / 系统实现"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rp-content">项目内容</Label>
                <Textarea
                  id="rp-content"
                  value={form.content}
                  onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
                  className="min-h-24"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rp-tech">技术细节</Label>
                <Textarea
                  id="rp-tech"
                  value={form.techDetails}
                  onChange={(e) => setForm((p) => ({ ...p, techDetails: e.target.value }))}
                  className="min-h-24"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rp-next">下一步计划</Label>
                <Textarea
                  id="rp-next"
                  value={form.nextStepPlan}
                  onChange={(e) => setForm((p) => ({ ...p, nextStepPlan: e.target.value }))}
                  className="min-h-20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rp-milestones">时间节点</Label>
                <Textarea
                  id="rp-milestones"
                  value={form.milestones}
                  onChange={(e) => setForm((p) => ({ ...p, milestones: e.target.value }))}
                  placeholder="可按行写：2026-04-20：完成实验 A"
                  className="min-h-20"
                />
              </div>
            </div>

            <PlanEditor
              title="每日完成计划"
              kind="dailyPlans"
              plans={form.dailyPlans}
              onAdd={(content, date) => addPlan("dailyPlans", content, date)}
              onToggle={(id) => togglePlan("dailyPlans", id)}
              onDelete={(id) => deletePlan("dailyPlans", id)}
            />
            <PlanEditor
              title="每周完成计划"
              kind="weeklyPlans"
              plans={form.weeklyPlans}
              onAdd={(content, date) => addPlan("weeklyPlans", content, date)}
              onToggle={(id) => togglePlan("weeklyPlans", id)}
              onDelete={(id) => deletePlan("weeklyPlans", id)}
              dateHint="（建议填本周周一日期）"
            />
            <PlanEditor
              title="每月完成计划"
              kind="monthlyPlans"
              plans={form.monthlyPlans}
              onAdd={(content, date) => addPlan("monthlyPlans", content, date)}
              onToggle={(id) => togglePlan("monthlyPlans", id)}
              onDelete={(id) => deletePlan("monthlyPlans", id)}
              dateHint="（建议填当月 01 号日期）"
            />

            <Button type="button" className="w-full" onClick={save}>
              保存项目
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function PlanEditor({
  title,
  plans,
  onAdd,
  onToggle,
  onDelete,
  dateHint,
}: {
  title: string;
  kind: "dailyPlans" | "weeklyPlans" | "monthlyPlans";
  plans: PlanItem[];
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
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="sm:w-44"
        />
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
                  <CheckCircle2
                    className={cn("h-4 w-4", p.done ? "text-green-600" : "text-gray-300")}
                    aria-hidden
                  />
                  <span className={cn("text-xs text-gray-500")}>{p.date}</span>
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

