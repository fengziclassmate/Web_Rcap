import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShortcutProvider, useShortcut } from "../shortcut-provider";
import { ShortcutSettings } from "../shortcut-settings";

const storageKey = "workbench-shortcuts-v1:account";
function RegisteredAction({ onSearch }: { onSearch: () => void }) {
  useShortcut("search", onSearch);
  return null;
}
function openSettings() { fireEvent.click(screen.getByRole("button", { name: "快捷键" })); }
function changeSearch(key: string, modifiers = { ctrlKey: true, shiftKey: true }) {
  const button = screen.getByRole("button", { name: "修改全局搜索快捷键" });
  fireEvent.click(button);
  fireEvent.keyDown(button, { key, code: `Key${key.toUpperCase()}`, ...modifiers });
}

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("workspace shortcuts", () => {
  it("uses remapped keys, exact modifiers and the latest handler without duplicate listeners", () => {
    localStorage.setItem(storageKey, JSON.stringify({ search: "Mod+Shift+KeyJ" }));
    const first = vi.fn(), latest = vi.fn();
    const { rerender, unmount } = render(<ShortcutProvider userId="account"><RegisteredAction onSearch={first} /></ShortcutProvider>);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    fireEvent.keyDown(window, { key: "j", ctrlKey: true });
    expect(first).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "j", ctrlKey: true, shiftKey: true });
    expect(first).toHaveBeenCalledTimes(1);
    rerender(<ShortcutProvider userId="account"><RegisteredAction onSearch={latest} /></ShortcutProvider>);
    fireEvent.keyDown(window, { key: "j", metaKey: true, shiftKey: true });
    expect(latest).toHaveBeenCalledTimes(1);
    unmount();
    fireEvent.keyDown(window, { key: "j", ctrlKey: true, shiftKey: true });
    expect(latest).toHaveBeenCalledTimes(1);
  });

  it("preserves text editing, composition, held keys, prevented events and open overlays", () => {
    const onSearch = vi.fn();
    render(<ShortcutProvider userId="account" handlers={{ search: onSearch }}><input aria-label="text" /><div contentEditable suppressContentEditableWarning data-testid="editor" /></ShortcutProvider>);
    fireEvent.keyDown(screen.getByLabelText("text"), { key: "k", ctrlKey: true });
    fireEvent.keyDown(screen.getByTestId("editor"), { key: "k", ctrlKey: true });
    fireEvent.keyDown(window, { key: "k", ctrlKey: true, isComposing: true });
    fireEvent.keyDown(window, { key: "k", ctrlKey: true, repeat: true });
    const prevented = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, cancelable: true });
    prevented.preventDefault();
    fireEvent(window, prevented);
    for (const role of ["dialog", "alertdialog", "menu", "listbox"]) {
      const overlay = document.createElement("div"); overlay.setAttribute("role", role); document.body.append(overlay);
      fireEvent.keyDown(window, { key: "k", ctrlKey: true }); overlay.remove();
    }
    expect(onSearch).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(onSearch).toHaveBeenCalledOnce();
  });

  it("saves a recorded binding and uses it after remount, while isolating accounts", () => {
    const onSearch = vi.fn();
    const { unmount } = render(<ShortcutProvider userId="account" handlers={{ search: onSearch }}><ShortcutSettings /></ShortcutProvider>);
    openSettings();
    changeSearch("j");
    fireEvent.click(screen.getByRole("button", { name: "保存设置" }));
    expect(JSON.parse(localStorage.getItem(storageKey)!).search).toBe("Mod+Shift+KeyJ");
    unmount();
    render(<ShortcutProvider userId="account" handlers={{ search: onSearch }}>test</ShortcutProvider>);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    fireEvent.keyDown(window, { key: "j", ctrlKey: true, shiftKey: true });
    expect(onSearch).toHaveBeenCalledTimes(1);
    cleanup();
    render(<ShortcutProvider userId="other" handlers={{ search: onSearch }}>test</ShortcutProvider>);
    fireEvent.keyDown(window, { key: "j", ctrlKey: true, shiftKey: true });
    expect(onSearch).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(onSearch).toHaveBeenCalledTimes(2);
  });

  it("shows conflicts and browser reservations without changing or saving the existing binding", () => {
    render(<ShortcutProvider userId="account"><ShortcutSettings /></ShortcutProvider>);
    openSettings();
    changeSearch("z", { ctrlKey: true, shiftKey: false });
    expect(screen.getByRole("alert").textContent).toContain("撤销上一步");
    expect((screen.getByRole("button", { name: "保存设置" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(screen.getByRole("button", { name: "修改全局搜索快捷键" }), { key: "r", ctrlKey: true });
    expect(screen.getByRole("alert").textContent).toContain("保留");
    fireEvent.keyDown(screen.getByRole("button", { name: "修改全局搜索快捷键" }), { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("button", { name: "修改全局搜索快捷键" }).textContent).toBe("Ctrl + K");
    expect(localStorage.getItem(storageKey)).toBeNull();
  });

  it("discards cancelled edits, supports search, clearing, and restoring defaults", () => {
    render(<ShortcutProvider userId="account"><ShortcutSettings /></ShortcutProvider>);
    openSettings(); changeSearch("j");
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    openSettings();
    expect(screen.getByRole("button", { name: "修改全局搜索快捷键" }).textContent).toBe("Ctrl + K");
    fireEvent.change(screen.getByLabelText("搜索快捷键"), { target: { value: "全局" } });
    expect(screen.queryByRole("button", { name: "修改日视图快捷键" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "清除全局搜索快捷键" }));
    expect(screen.getByRole("button", { name: "修改全局搜索快捷键" }).textContent).toBe("未设置");
    fireEvent.click(screen.getByRole("button", { name: "恢复全局搜索默认快捷键" }));
    changeSearch("j");
    fireEvent.click(screen.getByRole("button", { name: "恢复全部默认" }));
    fireEvent.click(screen.getByRole("button", { name: "保存设置" }));
    expect(JSON.parse(localStorage.getItem(storageKey)!).search).toBe("Mod+KeyK");
  });

  it("persists an individually disabled action and does not trigger it", () => {
    const onSearch = vi.fn();
    render(<ShortcutProvider userId="account" handlers={{ search: onSearch }}><ShortcutSettings /></ShortcutProvider>);
    openSettings();
    const binding = screen.getByRole("button", { name: "修改全局搜索快捷键" });
    fireEvent.click(binding); fireEvent.keyDown(binding, { key: "Delete" });
    fireEvent.click(screen.getByRole("button", { name: "保存设置" }));
    expect(JSON.parse(localStorage.getItem(storageKey)!).search).toBeNull();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(onSearch).not.toHaveBeenCalled();
  });

  it("keeps settings open and reports storage write failures", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ShortcutProvider userId="account"><ShortcutSettings /></ShortcutProvider>);
    openSettings(); changeSearch("j");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota exceeded"); });
    fireEvent.click(screen.getByRole("button", { name: "保存设置" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(console.error).toHaveBeenCalledWith("保存快捷键设置失败", expect.any(Error));
  });
});
