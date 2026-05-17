import { describe, expect, it } from "vitest";
import {
  CATEGORY_COLORS,
  CATEGORY_VISUALS,
  getScheduleCategoryAccentColor,
  getScheduleCategoryColor,
  getScheduleCategoryVisual,
  normalizeScheduleCategory,
} from "../categories";

describe("schedule categories", () => {
  it("keeps category visuals and color options aligned", () => {
    expect(CATEGORY_COLORS).toHaveLength(CATEGORY_VISUALS.length);
    expect(CATEGORY_COLORS[0]).toBe(CATEGORY_VISUALS[0].color);
  });

  it("normalizes legacy category aliases", () => {
    expect(normalizeScheduleCategory("life&other")).toBe("\u5403\u996d\u4f11\u606f");
    expect(normalizeScheduleCategory("浠诲姟鎺ㄨ繘")).toBe("\u4efb\u52a1\u63a8\u8fdb");
  });

  it("returns visual styles for known categories", () => {
    const visual = getScheduleCategoryVisual("\u6587\u732e\u9605\u8bfb");
    expect(visual.color).toContain("cyan");
    expect(getScheduleCategoryColor("\u6587\u732e\u9605\u8bfb")).toBe(visual.color);
    expect(getScheduleCategoryAccentColor("\u6587\u732e\u9605\u8bfb")).toBe(visual.accent);
  });

  it("falls back safely for unknown categories", () => {
    const visual = getScheduleCategoryVisual("custom");
    expect(visual.name).toBe("custom");
    expect(visual.color).toContain("bg-white");
  });
});
