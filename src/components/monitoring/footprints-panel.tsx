"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type FootprintItem = {
  id: string;
  name: string;
  lastDate: string;
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

export function FootprintsPanel({
  footprints,
  onAdd,
  onReset,
  onUpdate,
  onDelete,
  confirmDangerousActions,
}: {
  footprints: FootprintItem[];
  onAdd: (name: string) => void;
  onReset: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Pick<FootprintItem, "name" | "lastDate">>) => void;
  onDelete: (id: string) => void;
  confirmDangerousActions: boolean;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = footprints.find((x) => x.id === editingId) ?? null;
  const [editName, setEditName] = useState("");
  const [editDate, setEditDate] = useState(todayISO());

  const sorted = useMemo(
    () => [...footprints].sort((a, b) => a.name.localeCompare(b.name)),
    [footprints],
  );

  function withOptionalConfirm(message: string, action: () => void) {
    if (!confirmDangerousActions) {
      action();
      return;
    }
    if (typeof window !== "undefined" && !window.confirm(message)) return;
    action();
  }

  function openEdit(item: FootprintItem) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditDate(item.lastDate);
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white shadow-md">
      <header className="flex items-center justify-between gap-3 border-b border-gray-200 px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-gray-900">足迹跟踪</h2>
          <p className="mt-1 text-sm text-gray-600">记录“上一次做某事”的日期，自动显示间隔天数。</p>
        </div>
        <Button type="button" size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          新增
        </Button>
      </header>

      <div className="p-6">
        {sorted.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-500">
            暂无足迹项。
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((item) => {
              const days = daysBetweenInclusive(item.lastDate, todayISO()) - 1;
              return (
                <div key={item.id} className="rounded-lg border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900" title={item.name}>
                        {item.name}
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-gray-900">{days} 天</p>
                      <p className="text-xs text-gray-500">距上次：{item.lastDate}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-md hover:bg-gray-100"
                        onClick={() => openEdit(item)}
                        aria-label="编辑足迹"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-md hover:bg-red-50 hover:text-red-600"
                        onClick={() =>
                          withOptionalConfirm("确认删除这个足迹项吗？", () => onDelete(item.id))
                        }
                        aria-label="删除足迹"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => onReset(item.id)}
                    >
                      今天重置
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="rounded-lg border-gray-200 shadow-lg sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-900">新增足迹项</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="fp-name">足迹名称</Label>
              <Input
                id="fp-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="例如：换牙刷 / 深度清洁 / 复查某代码"
              />
            </div>
            <Button
              type="button"
              className="w-full"
              onClick={() => {
                if (!newName.trim()) return;
                onAdd(newName.trim());
                setNewName("");
                setAddOpen(false);
              }}
            >
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditingId(null)}>
        {editing ? (
          <DialogContent className="rounded-lg border-gray-200 shadow-lg sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-gray-900">编辑足迹</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="fp-edit-name">名称</Label>
                <Input
                  id="fp-edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fp-edit-date">上次日期</Label>
                <Input
                  id="fp-edit-date"
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                />
              </div>
              <Button
                type="button"
                className="w-full"
                onClick={() => {
                  if (!editingId || !editName.trim() || !editDate) return;
                  onUpdate(editingId, { name: editName.trim(), lastDate: editDate });
                  setEditingId(null);
                }}
              >
                保存
              </Button>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </section>
  );
}

