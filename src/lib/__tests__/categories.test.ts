import { describe, expect, it } from "vitest";
import {
  CATEGORY_COLORS,
  CATEGORY_VISUALS,
  SCHEDULE_CATEGORY_GROUP_LABELS,
  getScheduleCategoryAccentColor,
  getScheduleCategoryColor,
  getScheduleCategoryVisual,
  loadCategoryDefs,
  normalizeScheduleCategory,
} from "../categories";

describe("schedule categories", () => {
  it("keeps category visuals and color options aligned", () => {
    expect(CATEGORY_COLORS).toHaveLength(CATEGORY_VISUALS.length);
    expect(CATEGORY_COLORS[0]).toBe(CATEGORY_VISUALS[0].color);
    expect(CATEGORY_VISUALS.map((item) => item.name)).toEqual([
      "睡眠",
      "洗漱",
      "洗澡",
      "休息",
      "早餐",
      "中餐",
      "晚餐",
      "夜宵",
      "买菜",
      "朋友聚会",
      "打游戏",
      "看比赛",
      "逛街",
      "社交",
      "娱乐",
      "会议",
      "文献阅读",
      "私人学习",
      "项目工作",
      "实验研究",
      "论文写作",
      "学习",
      "科研",
      "健身",
      "球类运动",
      "跑步",
      "户外运动",
      "运动",
      "通勤",
      "家务",
      "其他",
    ]);
  });

  it("groups detailed categories by activity domain with distinct visual accents", () => {
    expect(SCHEDULE_CATEGORY_GROUP_LABELS).toMatchObject({
      meals: "饮食与采购",
      social: "休闲社交",
      academic: "学术工作",
      health: "运动健康",
    });

    const requestedCategories = ["夜宵", "洗澡", "打游戏", "看比赛", "逛街", "私人学习", "项目工作", "健身", "球类运动", "买菜"];
    const visuals = requestedCategories.map((name) => getScheduleCategoryVisual(name));
    expect(visuals.map((item) => item.name)).toEqual(requestedCategories);
    expect(new Set(visuals.map((item) => item.hex)).size).toBe(requestedCategories.length);
    expect(Object.fromEntries(visuals.map((item) => [item.name, item.group]))).toMatchObject({
      夜宵: "meals",
      买菜: "meals",
      洗澡: "routine",
      打游戏: "social",
      看比赛: "social",
      逛街: "social",
      私人学习: "academic",
      项目工作: "academic",
      健身: "health",
      球类运动: "health",
    });
  });

  it("normalizes legacy category aliases", () => {
    expect(normalizeScheduleCategory("life&other")).toBe("其他");
    expect(normalizeScheduleCategory("浠诲姟鎺ㄨ繘")).toBe("科研");
    expect(normalizeScheduleCategory("会议事件")).toBe("会议");
    expect(normalizeScheduleCategory("睡觉")).toBe("睡眠");
    expect(normalizeScheduleCategory("论文写作")).toBe("论文写作");
  });

  it("preserves existing custom categories when a new built-in or alias uses the same name", () => {
    window.localStorage.setItem("schedule-user-categories", JSON.stringify([
      {
        id: "custom-fitness",
        name: "健身",
        color: "bg-rose-50 border-rose-300 text-rose-950",
        sortOrder: 2,
      },
      {
        id: "custom-gaming",
        name: "游戏",
        color: "bg-sky-50 border-sky-300 text-sky-950",
        sortOrder: 3,
      },
    ]));

    const definitions = loadCategoryDefs();
    expect(definitions.find((item) => item.name === "健身")).toMatchObject({
      id: "custom-fitness",
      color: "bg-rose-50 border-rose-300 text-rose-950",
    });
    expect(definitions.find((item) => item.name === "打游戏")).toMatchObject({
      id: "custom-gaming",
      color: "bg-sky-50 border-sky-300 text-sky-950",
    });
    expect(definitions.filter((item) => item.name === "健身")).toHaveLength(1);
    window.localStorage.clear();
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
