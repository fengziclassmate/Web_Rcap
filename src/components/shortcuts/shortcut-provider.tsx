"use client";

import { createContext, useCallback, useContext, useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { defaultShortcutBindings, formatShortcut, parseShortcutBindings, shortcutDefinitions, shortcutFromEvent, type ShortcutAction, type ShortcutBindings, type ShortcutHandlers } from "@/lib/shortcuts";

const ShortcutContext = createContext<{
  bindings: ShortcutBindings;
  label: (action: ShortcutAction) => string;
  save: (bindings: ShortcutBindings) => boolean;
  register: (action: ShortcutAction, handler: () => void) => () => void;
} | null>(null);

export function ShortcutProvider({ userId, handlers = {}, children }: { userId: string; handlers?: ShortcutHandlers; children: ReactNode }) {
  const storageKey = `workbench-shortcuts-v1:${userId}`;
  const [initial] = useState(() => {
    try {
      return { bindings: parseShortcutBindings(localStorage.getItem(storageKey)), error: null };
    } catch (error) {
      return { bindings: { ...defaultShortcutBindings }, error };
    }
  });
  const [bindings, setBindings] = useState(initial.bindings);
  const registered = useRef<ShortcutHandlers>({});
  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  useEffect(() => {
    if (initial.error) {
      console.error("读取快捷键设置失败", initial.error);
      toast.error("无法读取本机快捷键设置，当前使用默认按键。可在快捷键设置中重新保存。");
    }
  }, [initial]);

  const register = useCallback((action: ShortcutAction, handler: () => void) => {
    registered.current[action] = handler;
    return () => { delete registered.current[action]; };
  }, []);

  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented || event.repeat || event.isComposing || event.getModifierState("AltGraph")) return;
    const target = event.target;
    if (target instanceof Element && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return;
    if (Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]')).some((element) => !element.closest('[data-closed], [hidden]'))) return;
    const binding = shortcutFromEvent(event);
    const action = shortcutDefinitions.find(({ id }) => bindings[id] === binding && binding !== null)?.id;
    if (!action) return;
    const handler = registered.current[action] ?? handlers[action];
    if (!handler) return;
    event.preventDefault();
    handler();
  });

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function save(next: ShortcutBindings) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch (error) {
      console.error("保存快捷键设置失败", error);
      toast.error("快捷键设置未保存，请检查浏览器的本地存储权限。");
      return false;
    }
    setBindings(next);
    return true;
  }

  return <ShortcutContext.Provider value={{ bindings, label: (action) => formatShortcut(bindings[action], mac), save, register }}>{children}</ShortcutContext.Provider>;
}

export function useShortcuts() {
  return useContext(ShortcutContext);
}

export function useShortcut(action: ShortcutAction, handler: () => void) {
  const shortcuts = useShortcuts();
  const register = shortcuts?.register;
  const onAction = useEffectEvent(handler);
  useEffect(() => register?.(action, () => onAction()), [action, register]);
}
