"use client";

import { useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

export function TaskTagsControl({ tags, title, onChange }: { tags: string[]; title: string; onChange: (update: (previous: string[]) => string[]) => void }) {
  const [editor, setEditor] = useState<{ original: string | null; value: string } | null>(null);
  const closing = useRef(false);
  const addButton = useRef<HTMLButtonElement>(null);

  function start(original: string | null) {
    closing.current = false;
    setEditor({ original, value: original ?? "" });
  }

  function save() {
    if (!editor || closing.current) return false;
    const values = [...new Set(editor.value.split(/[,，、]/).map((value) => value.trim()).filter(Boolean))];
    if (values.length && editor.original !== null && !tags.includes(editor.original)) {
      toast.error("这个标签已在其他页面修改，请核对后重新编辑。");
      return false;
    }
    closing.current = true;
    if (values.length) {
      const original = editor.original;
      onChange((previous) => {
        if (original !== null && !previous.includes(original)) return previous;
        return [...new Set(original === null ? [...previous, ...values] : previous.flatMap((tag) => tag === original ? values : [tag]))];
      });
    }
    setEditor(null);
    return true;
  }

  const input = editor && <input autoFocus className="project-tag-input" aria-label={`${editor.original === null ? "新标签" : `修改标签 ${editor.original}`}：${title}`} value={editor.value} onChange={(event) => setEditor({ ...editor, value: event.target.value })} onBlur={save} onKeyDown={(event) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Escape") {
      event.preventDefault(); event.stopPropagation();
      closing.current = true; setEditor(null); addButton.current?.focus();
    }
    if (event.key === "Enter") {
      event.preventDefault(); event.stopPropagation();
      if (save()) addButton.current?.focus();
    }
  }} />;

  const displayedTags = editor?.original && !tags.includes(editor.original) ? [...tags, editor.original] : tags;
  return <>
    {displayedTags.map((tag) => editor?.original === tag ? <span key={tag} className="project-tag-editor">{input}</span> : <span key={tag} className="project-tag project-editable-tag">
      <button type="button" className="project-tag-label" aria-label={`修改标签 ${tag}：${title}`} onClick={() => start(tag)}>{tag}</button>
      <button type="button" className="project-tag-remove" aria-label={`删除标签 ${tag}：${title}`} onClick={() => { onChange((previous) => previous.filter((value) => value !== tag)); addButton.current?.focus(); }}><X aria-hidden className="size-3" /></button>
    </span>)}
    {editor?.original === null && <span className="project-tag-editor">{input}</span>}
    <button ref={addButton} type="button" className="project-tag-add" aria-label={`添加标签：${title}`} title="添加标签" onClick={() => { if (editor?.original !== null) start(null); }}><Plus aria-hidden className="size-3.5" /></button>
  </>;
}
