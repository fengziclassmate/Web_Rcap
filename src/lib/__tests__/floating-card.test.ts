import { describe, expect, it } from "vitest";
import { clampFloatingPosition, normalizeFloatingSettings } from "@/lib/floating-card";

describe("floating window preferences", () => {
  it("recovers from malformed storage without hiding the window", () => {
    expect(normalizeFloatingSettings({ view: "removed", x: Infinity, y: "offscreen", hidden: "true" }, 1440)).toEqual({ view: "next", collapsed: false, hidden: false, x: 1104, y: 520 });
    expect(normalizeFloatingSettings(null, 320).x).toBe(12);
  });
  it("restores content, visibility and position independently", () => {
    expect(normalizeFloatingSettings({ view: "tasks", hidden: true, collapsed: true, x: 140, y: 240 }, 1440)).toEqual({ view: "tasks", hidden: true, collapsed: true, x: 140, y: 240 });
  });
  it("keeps a previously positioned desktop window reachable on a phone", () => {
    expect(clampFloatingPosition(1104, 750, 312, 300, 390, 844)).toEqual({ x: 66, y: 532 });
    expect(clampFloatingPosition(-200, -300, 296, 400, 320, 600)).toEqual({ x: 12, y: 12 });
    expect(clampFloatingPosition(1104, 750, 296, 376, 320, 400)).toEqual({ x: 12, y: 12 });
  });
});
