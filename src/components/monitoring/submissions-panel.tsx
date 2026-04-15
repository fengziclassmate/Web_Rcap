"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type SubmissionStatus =
  | "准备中"
  | "已投稿"
  | "审稿中"
  | "需要大修"
  | "需要小修"
  | "已接收"
  | "已拒稿"
  | "已撤稿";

export type SubmissionRecord = {
  id: string;
  content: string;
  journal: string;
  submittedAt: string; // yyyy-MM-dd
  status: SubmissionStatus;
  resultNote: string;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const statusOptions: SubmissionStatus[] = [
  "准备中",
  "已投稿",
  "审稿中",
  "需要大修",
  "需要小修",
  "已接收",
  "已拒稿",
  "已撤稿",
];

export function SubmissionsPanel({
  submissions,
  onAdd,
  onUpdate,
  onDelete,
}: {
  submissions: SubmissionRecord[];
  onAdd: (value: Omit<SubmissionRecord, "id">) => void;
  onUpdate: (id: string, patch: Partial<Omit<SubmissionRecord, "id">>) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = submissions.find((x) => x.id === editingId) ?? null;

  const [form, setForm] = useState<Omit<SubmissionRecord, "id">>({
    content: "",
    journal: "",
    submittedAt: todayISO(),
    status: "准备中",
    resultNote: "",
  });

  const sorted = useMemo(
    () => [...submissions].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
    [submissions],
  );

  function openCreate() {
    setEditingId(null);
    setForm({
      content: "",
      journal: "",
      submittedAt: todayISO(),
      status: "准备中",
      resultNote: "",
    });
    setOpen(true);
  }

  function openEdit(item: SubmissionRecord) {
    setEditingId(item.id);
    setForm({
      content: item.content,
      journal: item.journal,
      submittedAt: item.submittedAt,
      status: item.status,
      resultNote: item.resultNote ?? "",
    });
    setOpen(true);
  }

  function save() {
    const content = form.content.trim();
    const journal = form.journal.trim();
    if (!content || !journal) return;
    const payload = { ...form, content, journal, resultNote: form.resultNote.trim() };
    if (editingId) onUpdate(editingId, payload);
    else onAdd(payload);
    setOpen(false);
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white shadow-md">
      <header className="flex items-center justify-between gap-3 border-b border-gray-200 px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-gray-900">投稿记录</h2>
          <p className="mt-1 text-sm text-gray-600">添加投稿信息并跟踪进度。</p>
        </div>
        <Button type="button" size="sm" onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" />
          新增
        </Button>
      </header>

      <div className="p-6">
        {sorted.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-500">
            暂无投稿记录。
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((item) => (
              <div key={item.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold text-gray-900">{item.content}</p>
                    <p className="mt-1 text-sm text-gray-600">
                      期刊：{item.journal} · 投稿时间：{item.submittedAt}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">进度：{item.status}</p>
                    {item.resultNote ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{item.resultNote}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-md hover:bg-gray-100"
                      onClick={() => openEdit(item)}
                      aria-label="编辑投稿记录"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-md hover:bg-red-50 hover:text-red-600"
                      onClick={() => onDelete(item.id)}
                      aria-label="删除投稿记录"
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
        <DialogContent className="rounded-lg border-gray-200 shadow-lg sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-900">
              {editing ? "编辑投稿记录" : "新增投稿记录"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sub-content">投稿内容</Label>
              <Input
                id="sub-content"
                value={form.content}
                onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
                placeholder="例如：某篇论文/某个方向的短文/系统报告"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sub-journal">投稿期刊</Label>
              <Input
                id="sub-journal"
                value={form.journal}
                onChange={(e) => setForm((p) => ({ ...p, journal: e.target.value }))}
                placeholder="例如：XXXX Transactions"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sub-date">投稿时间</Label>
                <Input
                  id="sub-date"
                  type="date"
                  value={form.submittedAt}
                  onChange={(e) => setForm((p) => ({ ...p, submittedAt: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>投稿进度</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    v && setForm((p) => ({ ...p, status: v as SubmissionStatus }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择状态" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sub-note">结果备注</Label>
              <Textarea
                id="sub-note"
                value={form.resultNote}
                onChange={(e) => setForm((p) => ({ ...p, resultNote: e.target.value }))}
                placeholder="例如：收到审稿意见、修改要点、拒稿原因等"
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

