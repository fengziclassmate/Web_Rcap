import { describe, expect, it } from "vitest";
import { defaultShortcutBindings, findShortcutConflict, formatShortcut, parseShortcutBindings, shortcutError, shortcutFromEvent } from "../shortcuts";

describe("shortcut bindings", () => {
  it("normalizes physical keys, modifiers and macOS Command", () => {
    expect(shortcutFromEvent(new KeyboardEvent("keydown", { key: "?", code: "Slash", ctrlKey: true, shiftKey: true }))).toBe("Mod+Shift+Slash");
    expect(shortcutFromEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))).toBe("Mod+KeyK");
    expect(shortcutFromEvent(new KeyboardEvent("keydown", { key: "Control", code: "ControlLeft", ctrlKey: true }))).toBeNull();
    expect(formatShortcut("Mod+Shift+KeyK", true)).toBe("⌘ + Shift + K");
    expect(formatShortcut("Alt+ArrowLeft")).toBe("Alt + ←");
    expect(formatShortcut(null)).toBe("未设置");
  });

  it("requires a modifier and rejects reserved browser combinations", () => {
    expect(shortcutError("KeyK")).toBeTruthy();
    expect(shortcutError("Shift+KeyK")).toBeTruthy();
    expect(shortcutError("Mod+KeyR")).toContain("保留");
    expect(shortcutError("Mod+Shift+KeyT")).toContain("保留");
    expect(shortcutError("Alt+F4")).toContain("保留");
    expect(shortcutError("Mod+Shift+KeyK")).toBeNull();
  });

  it("detects conflicts against all groups and restores stored remaps and disabled actions", () => {
    expect(findShortcutConflict(defaultShortcutBindings, "search", "Alt+Digit2")?.id).toBe("logs");
    const bindings = parseShortcutBindings(JSON.stringify({ search: "Mod+Shift+KeyK", logs: null }));
    expect(bindings.search).toBe("Mod+Shift+KeyK");
    expect(bindings.logs).toBeNull();
    expect(bindings.undo).toBe(defaultShortcutBindings.undo);
    expect(parseShortcutBindings(null)).toEqual(defaultShortcutBindings);
  });

  it("rejects invalid, unsafe and conflicting local storage data", () => {
    for (const value of ["null", "[]", "{", '{"search":2}', '{"search":"Mod+KeyR"}', '{"search":"Mod+Alt+Alt+KeyK"}', '{"search":"Mod+KeyZ"}']) {
      expect(() => parseShortcutBindings(value)).toThrow();
    }
  });
});
