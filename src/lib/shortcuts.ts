export const shortcutDefinitions = [
  { id: "search", label: "全局搜索", group: "通用", defaultBinding: "Mod+KeyK" },
  { id: "shortcuts", label: "快捷键设置", group: "通用", defaultBinding: "Mod+Slash" },
  { id: "undo", label: "撤销上一步", group: "通用", defaultBinding: "Mod+KeyZ" },
  { id: "redo", label: "重做上一步", group: "通用", defaultBinding: "Mod+Shift+KeyZ" },
  { id: "schedule", label: "个人日程", group: "页面导航", defaultBinding: "Alt+Digit1" },
  { id: "logs", label: "动态日志", group: "页面导航", defaultBinding: "Alt+Digit2" },
  { id: "projects", label: "项目任务表", group: "页面导航", defaultBinding: "Alt+Digit3" },
  { id: "today", label: "回到今天", group: "日程视图", defaultBinding: "Alt+KeyT" },
  { id: "previous", label: "上一天 / 周 / 月", group: "日程视图", defaultBinding: "Alt+ArrowLeft" },
  { id: "next", label: "下一天 / 周 / 月", group: "日程视图", defaultBinding: "Alt+ArrowRight" },
  { id: "dayView", label: "日视图", group: "日程视图", defaultBinding: "Alt+KeyD" },
  { id: "weekView", label: "周视图", group: "日程视图", defaultBinding: "Alt+KeyW" },
  { id: "monthView", label: "月视图", group: "日程视图", defaultBinding: "Alt+KeyM" },
  { id: "newEvent", label: "新建日程", group: "快捷创建", defaultBinding: "Alt+KeyN" },
  { id: "newTask", label: "添加长期任务", group: "快捷创建", defaultBinding: "Alt+Shift+KeyN" },
  { id: "quickNote", label: "打开速记", group: "快捷创建", defaultBinding: "Alt+KeyQ" },
  { id: "assistant", label: "打开 AI 对话", group: "快捷创建", defaultBinding: "Alt+KeyA" },
] as const;

export type ShortcutAction = (typeof shortcutDefinitions)[number]["id"];
export type ShortcutBindings = Record<ShortcutAction, string | null>;
export type ShortcutHandlers = Partial<Record<ShortcutAction, () => void>>;

export const defaultShortcutBindings = Object.fromEntries(
  shortcutDefinitions.map(({ id, defaultBinding }) => [id, defaultBinding]),
) as ShortcutBindings;

const keyNames: Record<string, string> = {
  Slash: "/", Comma: ",", Period: ".", Semicolon: ";", Quote: "'", BracketLeft: "[",
  BracketRight: "]", Backslash: "\\", Minus: "-", Equal: "=", Backquote: "`",
  ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓", Space: "Space",
};

export function formatShortcut(binding: string | null, mac = false): string {
  if (!binding) return "未设置";
  return binding.split("+").map((part) => part === "Mod" ? mac ? "⌘" : "Ctrl" : keyNames[part] ?? part.replace(/^(Key|Digit)/, "")).join(" + ");
}

export function shortcutFromEvent(event: Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">): string | null {
  let code = event.code;
  if (!code) {
    if (/^[a-z]$/i.test(event.key)) code = `Key${event.key.toUpperCase()}`;
    else if (/^\d$/.test(event.key)) code = `Digit${event.key}`;
    else code = Object.keys(keyNames).find((key) => keyNames[key] === event.key) ?? event.key;
  }
  if (!/^(Key[A-Z]|Digit\d|F[1-9]|F1[0-2]|Arrow(Left|Right|Up|Down)|Space|Home|End|PageUp|PageDown|Slash|Comma|Period|Semicolon|Quote|BracketLeft|BracketRight|Backslash|Minus|Equal|Backquote)$/.test(code)) return null;
  if (event.ctrlKey && event.metaKey) return null;
  return [event.ctrlKey || event.metaKey ? "Mod" : "", event.altKey ? "Alt" : "", event.shiftKey ? "Shift" : "", code].filter(Boolean).join("+");
}

export function shortcutError(binding: string): string | null {
  if (!/^(Mod\+|Alt\+)/.test(binding)) return "请搭配 Ctrl、⌘ 或 Alt 使用。";
  const parts = binding.split("+");
  const code = parts.at(-1);
  if (code === "F12" || (parts.includes("Alt") && code === "F4") || (parts.includes("Mod") && !parts.includes("Alt") && ["KeyR", "KeyW", "KeyT", "KeyN", "KeyL", "KeyQ", "F4"].includes(code!))) {
    return "此组合由浏览器或系统保留，请换一个。";
  }
  return null;
}

export function findShortcutConflict(bindings: ShortcutBindings, action: ShortcutAction, binding: string) {
  return shortcutDefinitions.find(({ id }) => id !== action && bindings[id] === binding);
}

export function parseShortcutBindings(value: string | null): ShortcutBindings {
  if (!value) return { ...defaultShortcutBindings };
  const saved: unknown = JSON.parse(value);
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) throw new Error("快捷键设置格式无效");
  const bindings = { ...defaultShortcutBindings };
  for (const { id } of shortcutDefinitions) {
    if (!(id in saved)) continue;
    const binding = (saved as Record<string, unknown>)[id];
    if (binding === null) { bindings[id] = null; continue; }
    if (typeof binding !== "string") throw new Error("快捷键设置格式无效");
    const parts = binding.split("+");
    const code = parts.at(-1)!;
    const normalized = shortcutFromEvent({ key: "", code, ctrlKey: parts.includes("Mod"), metaKey: false, altKey: parts.includes("Alt"), shiftKey: parts.includes("Shift") });
    if (normalized !== binding || shortcutError(binding)) throw new Error("快捷键设置包含无效按键");
    bindings[id] = binding;
  }
  for (const { id } of shortcutDefinitions) {
    if (bindings[id] && findShortcutConflict(bindings, id, bindings[id])) throw new Error("快捷键设置存在冲突");
  }
  return bindings;
}
