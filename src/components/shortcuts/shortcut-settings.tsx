"use client";

import { useState, type KeyboardEvent } from "react";
import { Keyboard, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useShortcut, useShortcuts } from "./shortcut-provider";
import { defaultShortcutBindings, findShortcutConflict, formatShortcut, shortcutDefinitions, shortcutError, shortcutFromEvent, type ShortcutAction, type ShortcutBindings } from "@/lib/shortcuts";

export function ShortcutSettings() {
  const shortcuts = useShortcuts()!;
  const [open, setOpen] = useState(false);
  useShortcut("shortcuts", () => setOpen(true));
  return <>
    <Button variant="outline" size="sm" className="border-[0.5px]" onClick={() => setOpen(true)} title={`快捷键设置（${shortcuts.label("shortcuts")}）`}><Keyboard aria-hidden />快捷键</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      {open && <ShortcutSettingsContent bindings={shortcuts.bindings} onSave={(bindings) => { if (shortcuts.save(bindings)) setOpen(false); }} onCancel={() => setOpen(false)} />}
    </Dialog>
  </>;
}

function ShortcutSettingsContent({ bindings, onSave, onCancel }: { bindings: ShortcutBindings; onSave: (bindings: ShortcutBindings) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState({ ...bindings });
  const [query, setQuery] = useState("");
  const [recording, setRecording] = useState<ShortcutAction | null>(null);
  const [error, setError] = useState("");
  const mac = /Mac|iPhone|iPad/.test(navigator.platform);
  const filtered = shortcutDefinitions.filter((item) => `${item.label} ${item.group} ${formatShortcut(draft[item.id], mac)}`.toLowerCase().includes(query.trim().toLowerCase()));

  function assign(action: ShortcutAction, binding: string | null) {
    const conflict = binding ? findShortcutConflict(draft, action, binding) : null;
    if (conflict) { setError(`与「${conflict.label}」冲突，请使用其他按键，或先清除该操作的快捷键。`); return; }
    setDraft((previous) => ({ ...previous, [action]: binding }));
    setRecording(null);
    setError("");
  }

  function record(event: KeyboardEvent) {
    if (!recording) return;
    event.stopPropagation();
    if (event.key === "Tab") { setRecording(null); setError(""); return; }
    event.preventDefault();
    if (event.key === "Escape") { setRecording(null); setError(""); return; }
    if (event.repeat || event.nativeEvent.isComposing || event.getModifierState("AltGraph")) return;
    if (["Control", "Meta", "Alt", "Shift"].includes(event.key)) return;
    if ((event.key === "Backspace" || event.key === "Delete") && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) { assign(recording, null); return; }
    const binding = shortcutFromEvent(event);
    const issue = binding ? shortcutError(binding) : "请选择字母、数字、方向键或符号，并搭配 Ctrl、⌘ 或 Alt。";
    if (issue) { setError(issue); return; }
    assign(recording, binding);
  }

  return <DialogContent className="shortcut-settings ring-0 sm:max-w-[700px]" onKeyDownCapture={record}>
    <DialogHeader>
      <DialogTitle>快捷键设置</DialogTitle>
      <DialogDescription>点击按键后录入新组合。设置仅保存在当前账号的此浏览器中。</DialogDescription>
    </DialogHeader>
    <Input autoFocus aria-label="搜索快捷键" placeholder="搜索操作或按键" value={query} onChange={(event) => setQuery(event.target.value)} />
    <div className="shortcut-list">
      {[...new Set(filtered.map((item) => item.group))].map((group) => <section key={group} aria-label={group}>
        <h3>{group}</h3>
        {filtered.filter((item) => item.group === group).map(({ id, label }) => <div key={id} className="shortcut-row">
          <span>{label}</span>
          <button type="button" className="shortcut-binding" data-recording={recording === id} aria-label={`修改${label}快捷键`} aria-describedby={`shortcut-value-${id}`} aria-pressed={recording === id} onBlur={() => { if (recording === id) { setRecording(null); setError(""); } }} onClick={() => { setRecording(id); setError(""); }}>
            <span id={`shortcut-value-${id}`}>{recording === id ? "请按下组合键…" : <kbd>{formatShortcut(draft[id], mac)}</kbd>}</span>
          </button>
          <button type="button" className="shortcut-icon" aria-label={`清除${label}快捷键`} title="停用此快捷键" disabled={draft[id] === null} onClick={() => assign(id, null)}><X aria-hidden /></button>
          <button type="button" className="shortcut-icon" aria-label={`恢复${label}默认快捷键`} title="恢复默认" disabled={draft[id] === defaultShortcutBindings[id]} onClick={() => assign(id, defaultShortcutBindings[id])}><RotateCcw aria-hidden /></button>
        </div>)}
      </section>)}
      {filtered.length === 0 && <p className="shortcut-empty">没有匹配的快捷键</p>}
    </div>
    <div className="shortcut-feedback" aria-live="polite">
      {error ? <p role="alert">{error}</p> : <p>{recording ? "搭配 Ctrl、⌘ 或 Alt 使用。Esc 取消录入，Delete 清除。" : "编辑文字或打开弹窗时，工作台快捷键暂停。"}</p>}
    </div>
    <footer>
      <Button variant="ghost" onClick={() => { setDraft({ ...defaultShortcutBindings }); setRecording(null); setError(""); }}>恢复全部默认</Button>
      <div><Button variant="outline" onClick={onCancel}>取消</Button><Button onClick={() => onSave(draft)} disabled={recording !== null || !!error}>保存设置</Button></div>
    </footer>
  </DialogContent>;
}
