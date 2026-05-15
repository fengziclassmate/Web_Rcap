# Prompt 08 — 脑洞捕获器（速记/便签）

> **依赖：** 不依赖 LLM，独立功能
> **目标：** 页面右下角固定一个浮动按钮，点击后快速记录一条速记（不需要标题、不需要分类）。
> 速记列表在"日志"模块中以时间线展示，支持归档到科研笔记。

---

## 一、新增类型：`src/lib/types.ts`（追加）

```typescript
/** 速记（脑洞捕获） */
export type QuickNote = {
  id: string;
  /** ISO 时间戳（精确到秒） */
  createdAt: string;
  content: string;
  /** 速记来源页面的模块 id（可选，追踪用户在哪个模块时记的） */
  sourceModule?: string;
  /** 关联的文献 id（可选，在文献模块中记录时自动关联） */
  linkedLiteratureId?: string;
};
```

## 二、新增 Hook：`src/hooks/useQuickNotes.ts`

```typescript
"use client";

import { useState, useCallback, useSyncExternalStore } from "react";
import type { QuickNote } from "@/lib/types";

const STORAGE_KEY = "quicknotes";
const MAX_NOTES = 200;

function getStoredNotes(): QuickNote[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QuickNote[];
  } catch {
    return [];
  }
}

function storeNotes(notes: QuickNote[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    window.dispatchEvent(new CustomEvent("quicknotes-changed"));
  } catch {
    // localStorage full — 清理最旧的
  }
}

// 跨组件同步用的 subscribe
function subscribeToNotes(callback: () => void) {
  window.addEventListener("quicknotes-changed", callback);
  return () => window.removeEventListener("quicknotes-changed", callback);
}

export function useQuickNotes() {
  const notes = useSyncExternalStore(subscribeToNotes, getStoredNotes, () => []);

  const addNote = useCallback((content: string, options?: {
    sourceModule?: string;
    linkedLiteratureId?: string;
  }) => {
    if (!content.trim()) return;

    const note: QuickNote = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString().replace("T", " ").slice(0, 19),
      content: content.trim(),
      sourceModule: options?.sourceModule,
      linkedLiteratureId: options?.linkedLiteratureId,
    };

    const next = [note, ...getStoredNotes()].slice(0, MAX_NOTES);
    storeNotes(next);
  }, []);

  const deleteNote = useCallback((id: string) => {
    const next = getStoredNotes().filter((n) => n.id !== id);
    storeNotes(next);
  }, []);

  const clearAll = useCallback(() => {
    storeNotes([]);
  }, []);

  return { notes, addNote, deleteNote, clearAll };
}
```

## 三、新增组件：`src/components/llm/quick-note-fab.tsx`

右下角浮动泡泡按钮。

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { Lightbulb, Send, X } from "lucide-react";
import { useQuickNotes } from "@/hooks/useQuickNotes";
import { toast } from "sonner";

type QuickNoteFABProps = {
  /** 当前页面模块 id（可选，用于标记速记来源） */
  sourceModule?: string;
  /** 关联的文献 id（可选） */
  linkedLiteratureId?: string;
};

export function QuickNoteFAB({
  sourceModule,
  linkedLiteratureId,
}: QuickNoteFABProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const { addNote } = useQuickNotes();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);

  // 打开时自动聚焦
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // 在"日志"模块中不显示浮动按钮（因为日志页已经有速记列表了）
  if (sourceModule === "logs") return null;

  function handleAdd() {
    const text = input.trim();
    if (!text) return;

    addNote(text, { sourceModule, linkedLiteratureId });
    setInput("");
    setOpen(false);
    toast.success("速记已保存");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
    if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <>
      {/* 遮罩层 */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* 浮动输入面板 */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 w-80 animate-in fade-in slide-in-from-bottom-4 duration-200"
          style={{ animation: "none" /* fallback */ }}
        >
          <div className="rounded-2xl border border-stone-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-medium text-stone-700">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                速记
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-6 w-6 items-center justify-center rounded-md text-stone-400 hover:bg-stone-100 hover:text-stone-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="p-3">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="想到什么？先记下来…"
                rows={3}
                className="w-full resize-none rounded-xl border-0 bg-stone-50 px-3 py-2.5 text-sm text-stone-800 outline-none placeholder:text-stone-400 focus:bg-white focus:ring-1 focus:ring-stone-300"
              />

              <div className="mt-2 flex items-center justify-between">
                <span className="text-[11px] text-stone-400">
                  Enter 保存 · Esc 取消 · 支持 Shift+Enter 换行
                </span>
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={!input.trim()}
                  className="flex h-7 items-center gap-1 rounded-lg bg-stone-950 px-3 text-xs font-medium text-white hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="h-3 w-3" />
                  记录
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        ref={fabRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 left-6 z-50 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-lg hover:bg-amber-600 active:bg-amber-700 transition-all hover:scale-105 active:scale-95"
        title="速记（脑洞捕获器）"
        style={{ zIndex: 45 }}
      >
        <Lightbulb className={`h-5 w-5 transition-transform duration-200 ${open ? "rotate-45" : ""}`} />
      </button>
    </>
  );
}
```

## 四、修改 `src/components/logs/log-page.tsx`：添加速记列表

在日志页面中添加一个"速记"标签/区块，显示所有速记。

```tsx
import { useQuickNotes } from "@/hooks/useQuickNotes";
import { Lightbulb, Trash2 } from "lucide-react";

// 在组件内部：
const { notes, deleteNote, clearAll } = useQuickNotes();

// 在日志页面的 UI 合适位置添加速记区块：
<div className="module-shell">
  <div className="module-header px-6 py-5">
    <h3 className="flex items-center gap-2 text-base font-semibold text-stone-900">
      <Lightbulb className="h-4 w-4 text-amber-500" />
      速记 / 脑洞捕获
      <span className="ml-1 text-xs font-normal text-stone-400">
        ({notes.length} 条)
      </span>
    </h3>
  </div>

  <div className="px-6 py-4">
    {notes.length === 0 ? (
      <p className="text-sm text-stone-400 text-center py-8">
        暂无速记。点击左下角的 💡 按钮随时记录灵感。
      </p>
    ) : (
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {notes.map((note) => (
          <div
            key={note.id}
            className="flex items-start gap-3 rounded-xl border border-stone-100 bg-white p-3 group"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm text-stone-800 whitespace-pre-wrap break-words">
                {note.content}
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-[11px] text-stone-400">
                  {note.createdAt}
                </span>
                {note.sourceModule && (
                  <span className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500">
                    {note.sourceModule}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => deleteNote(note.id)}
              className="mt-0.5 hidden shrink-0 items-center justify-center rounded-lg p-1.5 text-stone-300 hover:bg-red-50 hover:text-red-500 group-hover:flex transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    )}

    {notes.length > 0 && (
      <button
        type="button"
        onClick={clearAll}
        className="mt-3 text-xs text-stone-400 hover:text-red-500 transition-colors"
      >
        清空所有速记
      </button>
    )}
  </div>
</div>
```

## 五、修改 `src/app/page.tsx` 或 `src/app/layout.tsx`

在全局渲染 FAB：

```tsx
import { QuickNoteFAB } from "@/components/llm/quick-note-fab";

// 在页面底部（ChatSidebar 旁边或 layout.tsx 的 body 内）
<QuickNoteFAB sourceModule={activeModule} />
```

## 验收标准

- [ ] `npm run build` 通过
- [ ] 页面左下角出现 💡 灯泡按钮
- [ ] 点击后弹出输入窗口
- [ ] 输入内容后按 Enter 保存
- [ ] 日志页面中的"速记"区块显示所有速记
- [ ] 速记按时间倒序排列（最新的在最上面）
- [ ] 鼠标悬停时显示删除按钮
- [ ] 可以清空所有速记
- [ ] 数据跨页面访问一致（存 localStorage）
