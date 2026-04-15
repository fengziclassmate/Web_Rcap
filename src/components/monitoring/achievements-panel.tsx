"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type Achievement = {
  id: string;
  date: string; // yyyy-MM-dd
  title: string;
  note?: string;
};

export function AchievementsPanel({
  achievements,
  onAdd,
  onUpdate,
  onDelete,
}: {
  achievements: Achievement[];
  onAdd: (value: Omit<Achievement, "id">) => void;
  onUpdate: (id: string, patch: Partial<Omit<Achievement, "id">>) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = achievements.find((x) => x.id === editingId) ?? null;
  const [form, setForm] = useState<{ date: string; title: string; note: string }>({
    date: new Date().toISOString().slice(0, 10),
    title: "",
    note: "",
  });

  const grouped = useMemo(() => {
    const map = new Map<string, Achievement[]>();
    for (const item of achievements) {
      const arr = map.get(item.date) ?? [];
      arr.push(item);
      map.set(item.date, arr);
    }
    const entries = [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
    for (const [, arr] of entries) {
      arr.sort((a, b) => a.title.localeCompare(b.title));
    }
    return entries;
  }, [achievements]);

  function openCreate() {
    setEditingId(null);
    setForm({
      date: new Date().toISOString().slice(0, 10),
      title: "",
      note: "",
    });
    setOpen(true);
  }

  function openEdit(item: Achievement) {
    setEditingId(item.id);
    setForm({
      date: item.date,
      title: item.title,
      note: item.note ?? "",
    });
    setOpen(true);
  }

  function handleSave() {
    const date = form.date.trim();
    const title = form.title.trim();
    const note = form.note.trim();
    if (!date || !title) return;
    if (editingId) {
      onUpdate(editingId, { date, title, note: note.length > 0 ? note : undefined });
    } else {
      onAdd({ date, title, note: note.length > 0 ? note : undefined });
    }
    setOpen(false);
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white shadow-md">
      <header className="flex items-center justify-between gap-3 border-b border-gray-200 px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-gray-900">成就记录栏</h2>
          <p className="mt-1 text-sm text-gray-600">记录每天完成的亮点，支持云端同步。</p>
        </div>
        <Button type="button" size="sm" onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" />
          新增
        </Button>
      </header>

      <div className="p-6">
        {grouped.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-500">
            暂无成就记录。点右上角新增。
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map(([date, items]) => (
              <div key={date} className="rounded-lg border border-gray-200">
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-2 text-xs font-medium text-gray-700">
                  {date}
                </div>
                <ul className="divide-y divide-gray-200">
                  {items.map((item) => (
                    <li key={item.id} className="flex items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-medium text-gray-900">{item.title}</p>
                        {item.note ? (
                          <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{item.note}</p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-md hover:bg-gray-100"
                          onClick={() => openEdit(item)}
                          aria-label="编辑成就"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className={cn("h-8 w-8 rounded-md hover:bg-red-50 hover:text-red-600")}
                          onClick={() => onDelete(item.id)}
                          aria-label="删除成就"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-lg border-gray-200 shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-900">
              {editing ? "编辑成就" : "新增成就"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ach-date">日期</Label>
              <Input
                id="ach-date"
                type="date"
                value={form.date}
                onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ach-title">成就内容</Label>
              <Input
                id="ach-title"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="例如：完成了某个关键实验 / 读完一章文献 / 跑通某个 pipeline"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ach-note">备注（可选）</Label>
              <Textarea
                id="ach-note"
                value={form.note}
                onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                placeholder="补充说明、感受、证据链接等"
                className="min-h-24"
              />
            </div>
            <Button type="button" className="w-full" onClick={handleSave}>
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

