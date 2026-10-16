"use client";

import { useRef, type ReactNode } from "react";
import { Bold, CheckSquare, Highlighter, Strikethrough, Underline } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleChecklistLine } from "@/lib/project-boards";

// Render an explicit set of text marks. User HTML is always ordinary React text.
function inline(text: string, depth = 0): ReactNode {
  if (depth > 8) return text;
  const pattern = /\*\*([\s\S]+?)\*\*|==([\s\S]+?)==|~~([\s\S]+?)~~|__([\s\S]+?)__|\{(red|blue|green)\}([\s\S]+?)\{\/\5\}|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g;
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    parts.push(text.slice(cursor, match.index));
    const inner = inline(match[1] ?? match[2] ?? match[3] ?? match[4] ?? match[6] ?? match[7], depth + 1);
    const key = `${match.index}:${depth}`;
    if (match[1]) parts.push(<strong key={key}>{inner}</strong>);
    else if (match[2]) parts.push(<mark key={key} className="rounded-sm bg-yellow-200 px-0.5 text-stone-900">{inner}</mark>);
    else if (match[3]) parts.push(<del key={key} className="text-stone-500">{inner}</del>);
    else if (match[4]) parts.push(<u key={key}>{inner}</u>);
    else if (match[5]) parts.push(<span key={key} className={{ red: "text-red-700", blue: "text-blue-700", green: "text-emerald-700" }[match[5]]}>{inner}</span>);
    else parts.push(<a key={key} href={match[8]} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline underline-offset-2">{inner}</a>);
    cursor = match.index + match[0].length;
  }
  parts.push(text.slice(cursor));
  return parts;
}

export function AnnotatedContent({ value, onChange, compact = false }: { value: string; onChange?: (value: string) => void; compact?: boolean }) {
  if (!value.trim()) return <span className="text-stone-400">尚未填写内容</span>;
  return <div className={`space-y-1.5 whitespace-pre-wrap break-words text-sm leading-6 ${compact ? "line-clamp-3" : ""}`}>
    {value.split("\n").map((line, index) => {
      const item = line.match(/^\s*- \[([ xX])\] (.*)$/);
      if (item) return <label key={index} className="flex items-start gap-2">
        <input type="checkbox" checked={item[1] !== " "} disabled={!onChange} aria-label={`子任务：${item[2]}`} onChange={() => onChange?.(toggleChecklistLine(value, index))} className="mt-1.5 size-3.5 shrink-0 accent-emerald-800" />
        <span className={item[1] !== " " ? "text-stone-500 line-through" : ""}>{inline(item[2])}</span>
      </label>;
      if (/^#{1,3} /.test(line)) return <p key={index} className="pt-1 font-semibold text-stone-900">{inline(line.replace(/^#{1,3} /, ""))}</p>;
      if (/^- /.test(line)) return <div key={index} className="flex gap-2"><span aria-hidden>·</span><span>{inline(line.slice(2))}</span></div>;
      return <div key={index} className="min-h-3">{inline(line)}</div>;
    })}
  </div>;
}

export function AnnotatedEditor({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  const editor = useRef<HTMLTextAreaElement>(null);
  function wrap(before: string, after: string) {
    const input = editor.current;
    if (!input) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const selected = value.slice(start, end);
    const replacement = before + selected + after;
    onChange(value.slice(0, start) + replacement + value.slice(end));
    requestAnimationFrame(() => { input.focus(); input.setSelectionRange(start + before.length, start + before.length + selected.length); });
  }
  function checklist() {
    const input = editor.current;
    if (!input) return;
    const start = value.lastIndexOf("\n", input.selectionStart - 1) + 1;
    let end = value.indexOf("\n", input.selectionEnd);
    if (end < 0) end = value.length;
    const lines = value.slice(start, end).split("\n").map((line) => /^\s*- \[[ xX]\] /.test(line) ? line : `- [ ] ${line.replace(/^- /, "")}`).join("\n");
    onChange(value.slice(0, start) + lines + value.slice(end));
    requestAnimationFrame(() => input.focus());
  }
  const actions = [
    { name: "加粗", icon: Bold, before: "**", after: "**" },
    { name: "高亮", icon: Highlighter, before: "==", after: "==" },
    { name: "删除线／标注完成", icon: Strikethrough, before: "~~", after: "~~" },
    { name: "下划线", icon: Underline, before: "__", after: "__" },
  ];
  return <div className="space-y-3">
    <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
      <div className="flex flex-wrap items-center gap-1 border-b border-stone-200 bg-stone-50 p-1.5" role="toolbar" aria-label={`${label}标注工具`}>
        {actions.map(({ name, icon: Icon, before, after }) => <Button key={name} type="button" variant="ghost" size="icon-sm" aria-label={name} title={name} onMouseDown={(event) => event.preventDefault()} onClick={() => wrap(before, after)}><Icon className="size-4" /></Button>)}
        <span className="mx-1 h-4 border-l border-stone-200" />
        {([['red', '红色', 'bg-red-600'], ['blue', '蓝色', 'bg-blue-600'], ['green', '绿色', 'bg-emerald-700']] as const).map(([color, name, style]) => <button key={color} type="button" aria-label={`${name}文字`} title={`${name}文字`} onMouseDown={(event) => event.preventDefault()} onClick={() => wrap(`{${color}}`, `{/${color}}`)} className="flex size-7 items-center justify-center rounded hover:bg-stone-200 focus-visible:outline-2"><span className={`size-3 rounded-full ${style}`} /></button>)}
        <Button type="button" variant="ghost" size="sm" onMouseDown={(event) => event.preventDefault()} onClick={checklist}><CheckSquare className="size-4" />子任务</Button>
        <span className="ml-auto pr-2 text-xs text-stone-500">选中文字后标注</span>
      </div>
      <textarea ref={editor} aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b") { event.preventDefault(); wrap("**", "**"); } }} className="min-h-48 w-full resize-y bg-transparent p-3 text-sm leading-7 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-700/40" />
    </div>
    <div className="rounded-lg border border-dashed border-stone-200 bg-stone-50/60 p-3">
      <p className="mb-3 text-[11px] font-semibold tracking-wide text-stone-500">实时预览 · 可直接勾选子任务</p>
      <AnnotatedContent value={value} onChange={onChange} />
    </div>
    <details className="text-xs text-stone-500"><summary className="cursor-pointer">查看符号用法</summary><p className="mt-2 leading-6">**加粗**　==高亮==　~~已完成的文字~~　__下划线__<br />{'{red}红色{/red}　{blue}蓝色{/blue}　{green}绿色{/green}'}<br />- [ ] 待办子任务　- [x] 已完成子任务<br />[资料名称](https://example.com)　# 小标题</p></details>
  </div>;
}
