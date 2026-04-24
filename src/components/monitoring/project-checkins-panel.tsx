"use client";

import { useMemo, useState } from "react";
import { ChevronDown, KanbanSquare, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type ProjectCheckin = {
  id: string;
  name: string;
  description: string;
  startDate: string;
  checkins: { date: string; note: string }[];
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetweenInclusive(startIso: string, endIso: string) {
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);
  const ms = Math.max(0, end.getTime() - start.getTime());
  return Math.floor(ms / (24 * 60 * 60 * 1000)) + 1;
}

export function ProjectCheckinsPanel({
  projectCheckins,
  onAddProjectCheckin,
  onCheckinProject,
  onDeleteProjectCheckin,
  onUpdateProjectCheckin,
  onUpdateProjectCheckinEntry,
  onDeleteProjectCheckinEntry,
  confirmDangerousActions,
}: {
  projectCheckins: ProjectCheckin[];
  onAddProjectCheckin: (name: string, description: string) => void;
  onCheckinProject: (projectId: string, note: string) => void;
  onDeleteProjectCheckin: (projectId: string) => void;
  onUpdateProjectCheckin: (
    projectId: string,
    patch: Partial<Pick<ProjectCheckin, "name" | "description" | "startDate">>,
  ) => void;
  onUpdateProjectCheckinEntry: (projectId: string, date: string, note: string) => void;
  onDeleteProjectCheckinEntry: (projectId: string, date: string) => void;
  confirmDangerousActions: boolean;
}) {
  const [sectionOpen, setSectionOpen] = useState(true);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [projectNoteDraft, setProjectNoteDraft] = useState<Record<string, string>>({});
  const [checkinDrafts, setCheckinDrafts] = useState<Record<string, string>>({});
  const [showAddProjectDialog, setShowAddProjectDialog] = useState(false);
  const [historyProjectId, setHistoryProjectId] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState("");
  const [editingProjectDesc, setEditingProjectDesc] = useState("");

  const historyProject = useMemo(
    () => projectCheckins.find((project) => project.id === historyProjectId) ?? null,
    [projectCheckins, historyProjectId],
  );

  function withOptionalConfirm(message: string, action: () => void) {
    if (!confirmDangerousActions) {
      action();
      return;
    }
    if (typeof window !== "undefined" && !window.confirm(message)) return;
    action();
  }

  function handleAddProject() {
    if (!newProjectName.trim()) return;
    onAddProjectCheckin(newProjectName.trim(), newProjectDesc.trim());
    setNewProjectName("");
    setNewProjectDesc("");
    setShowAddProjectDialog(false);
  }

  function handleProjectCheckin(projectId: string) {
    onCheckinProject(projectId, projectNoteDraft[projectId] ?? "");
    setProjectNoteDraft((prev) => ({ ...prev, [projectId]: "" }));
  }

  function openEditProject(project: ProjectCheckin) {
    setEditingProjectId(project.id);
    setEditingProjectName(project.name);
    setEditingProjectDesc(project.description);
  }

  function saveEditProject() {
    if (!editingProjectId || !editingProjectName.trim()) return;
    onUpdateProjectCheckin(editingProjectId, {
      name: editingProjectName.trim(),
      description: editingProjectDesc.trim(),
    });
    setEditingProjectId(null);
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white shadow-md">
      <header className="flex items-center justify-between gap-3 border-b border-gray-200 px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-gray-900">Project 打卡记录</h2>
          <p className="mt-1 text-sm text-gray-600">独立管理长期项目的连续打卡、进度和历史记录。</p>
        </div>
        <Button type="button" size="sm" onClick={() => setShowAddProjectDialog(true)}>
          <Plus className="mr-1 h-4 w-4" />
          新增
        </Button>
      </header>

      <div className="p-6">
        <Collapsible open={sectionOpen} onOpenChange={setSectionOpen}>
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-left">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
              <KanbanSquare className="h-4 w-4 text-primary" />
              项目打卡列表
            </h3>
            <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${sectionOpen ? "" : "-rotate-90"}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-3">
            {projectCheckins.map((project) => {
              const projectExpanded = expandedProjects.has(project.id);
              const today = todayISO();
              const doneCount = project.checkins.length;
              const totalDays = daysBetweenInclusive(project.startDate, today);
              const percent = Math.min(100, Math.round((doneCount / Math.max(1, totalDays)) * 100));
              const recentCheckins = [...project.checkins]
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 5);

              return (
                <div key={project.id} className="rounded-lg border border-gray-200 p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      onClick={() =>
                        setExpandedProjects((prev) => {
                          const next = new Set(prev);
                          if (next.has(project.id)) next.delete(project.id);
                          else next.add(project.id);
                          return next;
                        })
                      }
                    >
                      <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${projectExpanded ? "" : "-rotate-90"}`} />
                      <p className="truncate text-sm font-medium text-gray-900" title={project.name}>
                        {project.name}
                      </p>
                    </button>
                    <div className="flex items-center gap-1">
                      <Button type="button" size="sm" variant="ghost" onClick={() => openEditProject(project)}>
                        编辑
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          withOptionalConfirm("确认删除这个 Project 以及其全部打卡记录吗？", () =>
                            onDeleteProjectCheckin(project.id),
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {projectExpanded ? (
                    <>
                      {project.description ? (
                        <p className="mb-2 text-sm text-gray-500">{project.description}</p>
                      ) : null}
                      <div className="mb-2 h-2 rounded bg-gray-100">
                        <div className="h-2 rounded bg-black" style={{ width: `${percent}%` }} />
                      </div>
                      <p className="mb-3 text-xs text-gray-600">
                        进度：{doneCount}/{totalDays}（{percent}%）
                      </p>

                      <div className="flex gap-2">
                        <Input
                          value={projectNoteDraft[project.id] ?? ""}
                          onChange={(event) =>
                            setProjectNoteDraft((prev) => ({ ...prev, [project.id]: event.target.value }))
                          }
                          placeholder="今日描述（可选）"
                        />
                        <Button type="button" size="sm" onClick={() => handleProjectCheckin(project.id)}>
                          打卡
                        </Button>
                      </div>

                      <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-3">
                        <p className="mb-1 text-xs font-medium text-gray-600">最近打卡记录</p>
                        {recentCheckins.length === 0 ? (
                          <p className="text-xs text-gray-500">暂无记录</p>
                        ) : (
                          <ul className="space-y-1">
                            {recentCheckins.map((entry) => (
                              <li key={`${project.id}-${entry.date}`} className="text-xs text-gray-700">
                                <span className="font-medium">{entry.date}</span>
                                <span className="mx-1">·</span>
                                <span className="inline-block max-w-[220px] truncate align-bottom" title={entry.note || "（无描述）"}>
                                  {entry.note || "（无描述）"}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-3 w-full"
                        onClick={() => setHistoryProjectId(project.id)}
                      >
                        查看全部打卡历史
                      </Button>
                    </>
                  ) : null}
                </div>
              );
            })}

            {projectCheckins.length === 0 ? (
              <p className="rounded-lg border border-gray-200 p-4 text-sm text-gray-500">暂无 Project 打卡项。</p>
            ) : null}
          </CollapsibleContent>
        </Collapsible>
      </div>

      <Dialog open={showAddProjectDialog} onOpenChange={setShowAddProjectDialog}>
        <DialogContent className="rounded-sm border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-sm">新增 Project 打卡项</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={newProjectName}
              onChange={(event) => setNewProjectName(event.target.value)}
              placeholder="项目名称"
            />
            <Textarea
              value={newProjectDesc}
              onChange={(event) => setNewProjectDesc(event.target.value)}
              placeholder="项目描述（可选）"
              className="min-h-20"
            />
            <Button type="button" className="w-full" onClick={handleAddProject}>
              添加项目
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(historyProject)} onOpenChange={(open) => !open && setHistoryProjectId(null)}>
        {historyProject ? (
          <DialogContent className="rounded-sm border-gray-200">
            <DialogHeader>
              <DialogTitle className="text-sm">{historyProject.name} · 全部打卡历史</DialogTitle>
            </DialogHeader>
            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {[...historyProject.checkins]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((entry, index) => (
                  <div
                    key={`${historyProject.id}-${entry.date}-${index}`}
                    className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
                  >
                    <p className="text-xs font-medium text-gray-700">{entry.date}</p>
                    <div className="mt-1 flex gap-2">
                      <Input
                        value={checkinDrafts[`${historyProject.id}__${entry.date}`] ?? entry.note}
                        onChange={(event) =>
                          setCheckinDrafts((prev) => ({
                            ...prev,
                            [`${historyProject.id}__${entry.date}`]: event.target.value,
                          }))
                        }
                        placeholder="打卡描述"
                        className="h-8 text-xs"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() =>
                          onUpdateProjectCheckinEntry(
                            historyProject.id,
                            entry.date,
                            checkinDrafts[`${historyProject.id}__${entry.date}`] ?? entry.note,
                          )
                        }
                      >
                        保存
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-red-600"
                        onClick={() =>
                          withOptionalConfirm("确认删除这条打卡记录吗？", () =>
                            onDeleteProjectCheckinEntry(historyProject.id, entry.date),
                          )
                        }
                      >
                        删除
                      </Button>
                    </div>
                  </div>
                ))}
              {historyProject.checkins.length === 0 ? (
                <p className="rounded-md border border-gray-200 p-3 text-sm text-gray-500">暂无打卡记录</p>
              ) : null}
            </div>
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog open={Boolean(editingProjectId)} onOpenChange={(open) => !open && setEditingProjectId(null)}>
        <DialogContent className="rounded-sm border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-sm">编辑 Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={editingProjectName}
              onChange={(event) => setEditingProjectName(event.target.value)}
              placeholder="项目名称"
            />
            <Textarea
              value={editingProjectDesc}
              onChange={(event) => setEditingProjectDesc(event.target.value)}
              placeholder="项目描述"
              className="min-h-20"
            />
            <Button type="button" className="w-full" onClick={saveEditProject}>
              保存修改
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
