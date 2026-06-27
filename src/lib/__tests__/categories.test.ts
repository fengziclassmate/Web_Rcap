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
    expect(CATEGORY_VISUALS.map((item) => item.name)).toEqual([
      "睡眠",
      "洗漱",
      "早餐",
      "中餐",
      "晚餐",
      "休息",
      "社交",
      "娱乐",
      "会议",
      "文献阅读",
      "学习",
      "科研",
      "运动",
      "通勤",
      "家务",
      "其他",
    ]);
  });

  it("normalizes legacy category aliases", () => {
    expect(normalizeScheduleCategory("life&other")).toBe("其他");
    expect(normalizeScheduleCategory("浠诲姟鎺ㄨ繘")).toBe("科研");
    expect(normalizeScheduleCategory("会议事件")).toBe("会议");
    expect(normalizeScheduleCategory("睡觉")).toBe("睡眠");
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
