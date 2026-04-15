"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type GroupMeetingRecord = {
  id: string;
  date: string; // yyyy-MM-dd
  topic: string;
  attendees: string;
  notes: string;
  actionItems: string;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function GroupMeetingsPanel({
  records,
  onAdd,
  onUpdate,
  onDelete,
}: {
  records: GroupMeetingRecord[];
  onAdd: (value: Omit<GroupMeetingRecord, "id">) => void;
  onUpdate: (id: string, patch: Partial<Omit<GroupMeetingRecord, "id">>) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = records.find((x) => x.id === editingId) ?? null;

  const [form, setForm] = useState<Omit<GroupMeetingRecord, "id">>({
    date: todayISO(),
    topic: "",
    attendees: "",
    notes: "",
    actionItems: "",
  });

  const sorted = useMemo(() => [...records].sort((a, b) => b.date.localeCompare(a.date)), [records]);

  function openCreate() {
    setEditingId(null);
    setForm({
      date: todayISO(),
      topic: "",
      attendees: "",
      notes: "",
      actionItems: "",
    });
    setOpen(true);
  }

  function openEdit(item: GroupMeetingRecord) {
    setEditingId(item.id);
    setForm({
      date: item.date,
      topic: item.topic,
      attendees: item.attendees ?? "",
      notes: item.notes ?? "",
      actionItems: item.actionItems ?? "",
    });
    setOpen(true);
  }

  function save() {
    const date = form.date.trim();
    const topic = form.topic.trim();
    if (!date || !topic) return;
    const payload = {
      ...form,
      date,
      topic,
      attendees: form.attendees.trim(),
      notes: form.notes.trim(),
      actionItems: form.actionItems.trim(),
    };
    if (editingId) onUpdate(editingId, payload);
    else onAdd(payload);
    setOpen(false);
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white shadow-md">
      <header className="flex items-center justify-between gap-3 border-b border-gray-200 px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-gray-900">组会记录</h2>
          <p className="mt-1 text-sm text-gray-600">记录每次组会要点与后续行动项。</p>
        </div>
        <Button type="button" size="sm" onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" />
          新增
        </Button>
      </header>

      <div className="p-6">
        {sorted.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-500">
            暂无组会记录。
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((item) => (
              <div key={item.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold text-gray-900">
                      {item.date} · {item.topic}
                    </p>
                    {item.attendees ? <p className="mt-1 text-sm text-gray-600">参会：{item.attendees}</p> : null}
                    {item.notes ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{item.notes}</p>
                    ) : null}
                    {item.actionItems ? (
                      <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                        <p className="text-xs font-medium text-gray-700">行动项</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{item.actionItems}</p>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-md hover:bg-gray-100"
                      onClick={() => openEdit(item)}
                      aria-label="编辑组会记录"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-md hover:bg-red-50 hover:text-red-600"
                      onClick={() => onDelete(item.id)}
                      aria-label="删除组会记录"
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-lg border-gray-200 shadow-lg sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-900">
              {editing ? "编辑组会记录" : "新增组会记录"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="gm-date">日期</Label>
                <Input
                  id="gm-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gm-attendees">参会人员（可选）</Label>
                <Input
                  id="gm-attendees"
                  value={form.attendees}
                  onChange={(e) => setForm((p) => ({ ...p, attendees: e.target.value }))}
                  placeholder="例如：导师A、同学B"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gm-topic">主题</Label>
              <Input
                id="gm-topic"
                value={form.topic}
                onChange={(e) => setForm((p) => ({ ...p, topic: e.target.value }))}
                placeholder="例如：阶段汇报 / 论文讨论 / 实验复盘"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gm-notes">会议要点</Label>
              <Textarea
                id="gm-notes"
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                className="min-h-24"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gm-actions">行动项</Label>
              <Textarea
                id="gm-actions"
                value={form.actionItems}
                onChange={(e) => setForm((p) => ({ ...p, actionItems: e.target.value }))}
                placeholder="可按行写：\n- 补充实验 X\n- 下周提交第 2 章修改稿"
                className="min-h-24"
              />
            </div>
            <Button type="button" className="w-full" onClick={save}>
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

