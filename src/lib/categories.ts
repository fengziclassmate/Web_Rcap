export type CategoryHue = "cold" | "warm" | "neutral";

export type ScheduleCategoryVisual = {
  name: string;
  color: string;
  accent: string;
  twClass: string;
  twAccent: string;
  hex: string;
  hue: CategoryHue;
  isBuiltIn: boolean;
};

export type ScheduleCategoryDef = {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
};

const DEFAULT_CATEGORY_ID_PREFIX = "__default__";
const CATEGORY_STORAGE_KEY = "schedule-user-categories";

export const DEFAULT_SCHEDULE_CATEGORY = "\u6df1\u5ea6\u79d1\u7814";
export const UNCATEGORIZED_SCHEDULE_CATEGORY = "\u672a\u5206\u7c7b";

const names = {
  deepResearch: "\u6df1\u5ea6\u79d1\u7814",
  experimentData: "\u5b9e\u9a8c\u6570\u636e",
  paperWriting: "\u8bba\u6587\u5199\u4f5c",
  literatureReading: "\u6587\u732e\u9605\u8bfb",
  courseStudy: "\u8bfe\u7a0b\u5b66\u4e60",
  meeting: "\u4f1a\u8bae\u6c9f\u901a",
  taskProgress: "\u4efb\u52a1\u63a8\u8fdb",
  admin: "\u884c\u653f\u4e8b\u52a1",
  mealsRest: "\u5403\u996d\u4f11\u606f",
  health: "\u5065\u5eb7\u8fd0\u52a8",
  chores: "\u5bb6\u52a1\u6742\u4e8b",
  social: "\u793e\u4ea4\u5a31\u4e50",
  commute: "\u901a\u52e4\u5916\u51fa",
  moodReview: "\u60c5\u7eea\u590d\u76d8",
  buffer: "\u5f39\u6027\u7f13\u51b2",
  uncategorized: UNCATEGORIZED_SCHEDULE_CATEGORY,
};

function visual(
  name: string,
  twClass: string,
  twAccent: string,
  hex: string,
  hue: CategoryHue,
  isBuiltIn = true,
): ScheduleCategoryVisual {
  return {
    name,
    color: twClass,
    accent: twAccent,
    twClass,
    twAccent,
    hex,
    hue,
    isBuiltIn,
  };
}

export const CATEGORY_VISUALS: ScheduleCategoryVisual[] = [
  visual(names.deepResearch, "bg-blue-50 border-blue-300 text-blue-950", "bg-blue-500", "#3b82f6", "cold"),
  visual(names.experimentData, "bg-teal-50 border-teal-300 text-teal-950", "bg-teal-500", "#14b8a6", "cold"),
  visual(names.paperWriting, "bg-indigo-50 border-indigo-300 text-indigo-950", "bg-indigo-500", "#6366f1", "cold"),
  visual(names.literatureReading, "bg-cyan-50 border-cyan-300 text-cyan-950", "bg-cyan-500", "#06b6d4", "cold"),
  visual(names.courseStudy, "bg-sky-50 border-sky-300 text-sky-950", "bg-sky-500", "#0ea5e9", "cold"),
  visual(names.taskProgress, "bg-emerald-50 border-emerald-300 text-emerald-950", "bg-emerald-500", "#10b981", "cold"),
  visual(names.meeting, "bg-amber-50 border-amber-300 text-amber-950", "bg-amber-500", "#f59e0b", "warm"),
  visual(names.mealsRest, "bg-rose-50 border-rose-300 text-rose-950", "bg-rose-400", "#fb7185", "warm"),
  visual(names.health, "bg-orange-50 border-orange-300 text-orange-950", "bg-orange-500", "#f97316", "warm"),
  visual(names.social, "bg-pink-50 border-pink-300 text-pink-950", "bg-pink-500", "#ec4899", "warm"),
  visual(names.commute, "bg-yellow-50 border-yellow-300 text-yellow-950", "bg-yellow-500", "#eab308", "warm"),
  visual(names.moodReview, "bg-purple-50 border-purple-300 text-purple-950", "bg-purple-500", "#a855f7", "warm"),
  visual(names.admin, "bg-slate-50 border-slate-300 text-slate-950", "bg-slate-400", "#94a3b8", "neutral"),
  visual(names.chores, "bg-stone-50 border-stone-300 text-stone-950", "bg-stone-400", "#a8a29e", "neutral"),
  visual(names.buffer, "bg-zinc-50 border-zinc-300 text-zinc-950", "bg-zinc-400", "#a1a1aa", "neutral"),
];

export const CATEGORY_COLORS = CATEGORY_VISUALS.map((item) => item.twClass);

export const DEFAULT_CATEGORY_PALETTE = CATEGORY_VISUALS.map((item) => ({
  name: item.name,
  color: item.twClass,
}));

export const CATEGORY_ALIAS_MAP: Record<string, string> = {
  "\u4e2a\u4eba": names.mealsRest,
  "\u5de5\u4f5c\u63d0\u5347": names.taskProgress,
  "\u8fd0\u52a8\u5065\u5eb7": names.health,
  "\u751f\u6d3b\u8fd0\u52a8": names.health,
  "\u751f\u6d3b\u4e8b\u52a1": names.mealsRest,
  "\u5174\u8da3\u7231\u597d": names.social,
  "\u653e\u677e\u4f11\u95f2": names.mealsRest,
  "\u4f11\u606f\u6062\u590d": names.mealsRest,
  "life&other": names.mealsRest,
  "\u81ea\u6211\u63d0\u5347": names.courseStudy,
  "\u8ba1\u5212\u590d\u76d8": names.taskProgress,
  "\u5b66\u4e60\u6210\u957f": names.courseStudy,
  "\u5a31\u4e50\u4f11\u606f": names.social,
  "\u5176\u4ed6": names.buffer,
  "\u6570\u636e\u6574\u7406": names.experimentData,
  "\u5b9e\u9a8c\u5206\u6790": names.experimentData,
  "\u884c\u653f\u6742\u52a1": names.admin,
  "\u5916\u51fa\u901a\u52e4": names.commute,
  "\u60c5\u7eea\u8bb0\u5f55": names.moodReview,
  "\u7f13\u51b2\u65f6\u95f4": names.buffer,
  "娣卞害绉戠爺": names.deepResearch,
  "瀹為獙鏁版嵁": names.experimentData,
  "璁烘枃鍐欎綔": names.paperWriting,
  "鏂囩尞闃呰": names.literatureReading,
  "璇剧▼瀛︿範": names.courseStudy,
  "浼氳娌熼€?": names.meeting,
  "浠诲姟鎺ㄨ繘": names.taskProgress,
  "琛屾斂浜嬪姟": names.admin,
  "鐢熸椿浜嬪姟": names.mealsRest,
  "鍋ュ悍杩愬姩": names.health,
  "閫氬嫟澶栧嚭": names.commute,
  "鎯呯华澶嶇洏": names.moodReview,
  "浼戞伅鎭㈠": names.mealsRest,
  "寮规€х紦鍐?": names.buffer,
  "娴犺濮熼幒銊ㄧ箻": names.taskProgress,
  "閺傚洨灏為梼鍛邦嚢": names.literatureReading,
  "鐎圭偤鐛欓弫鐗堝祦": names.experimentData,
  "濞ｅ崬瀹崇粔鎴犵埡": names.deepResearch,
};

const fallbackVisual = visual(
  names.uncategorized,
  "bg-white border-gray-300 text-gray-900",
  "bg-zinc-400",
  "#a1a1aa",
  "neutral",
  false,
);

export function createDefaultCategoryDefs(): ScheduleCategoryDef[] {
  return CATEGORY_VISUALS.map((item, index) => ({
    id: `${DEFAULT_CATEGORY_ID_PREFIX}${index}`,
    name: item.name,
    color: item.twClass,
    sortOrder: index,
  }));
}

function normalizeCategoryDefList(value: unknown): ScheduleCategoryDef[] {
  if (!Array.isArray(value) || value.length === 0) return createDefaultCategoryDefs();
  const defaults = createDefaultCategoryDefs();
  const custom = value
    .map((item, index) => {
      const raw = item as Partial<ScheduleCategoryDef>;
      const name = typeof raw.name === "string" ? raw.name.trim() : "";
      if (!name) return null;
      const visual = getCategoryVisualByClass(typeof raw.color === "string" ? raw.color : "");
      return {
        id: typeof raw.id === "string" ? raw.id : createCategoryId(),
        name,
        color: visual.twClass,
        sortOrder: typeof raw.sortOrder === "number" ? raw.sortOrder : defaults.length + index,
      } satisfies ScheduleCategoryDef;
    })
    .filter((item): item is ScheduleCategoryDef => Boolean(item))
    .filter((item) => !item.id.startsWith(DEFAULT_CATEGORY_ID_PREFIX));

  const merged = [...defaults];
  for (const item of custom) {
    if (!isCategoryNameTaken(merged, item.name)) merged.push(item);
  }
  return merged.sort((a, b) => a.sortOrder - b.sortOrder);
}

export function loadCategoryDefs(): ScheduleCategoryDef[] {
  if (typeof window === "undefined") return createDefaultCategoryDefs();
  try {
    const raw = localStorage.getItem(CATEGORY_STORAGE_KEY);
    return normalizeCategoryDefList(raw ? JSON.parse(raw) : null);
  } catch {
    return createDefaultCategoryDefs();
  }
}

export function saveCategoryDefs(defs: ScheduleCategoryDef[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(defs));
  } catch {
    // localStorage can be unavailable in private mode.
  }
}

export function createCategoryId() {
  return `cat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function isBuiltInCategory(def: Pick<ScheduleCategoryDef, "id">) {
  return def.id.startsWith(DEFAULT_CATEGORY_ID_PREFIX);
}

export function isCategoryNameTaken(defs: ScheduleCategoryDef[], name: string, excludeId?: string) {
  const normalized = name.trim().toLowerCase();
  return defs.some((item) => item.id !== excludeId && item.name.trim().toLowerCase() === normalized);
}

export function normalizeScheduleCategory(value: string) {
  return CATEGORY_ALIAS_MAP[value] ?? (value || fallbackVisual.name);
}

export function getCategoryVisualByClass(twClass: string) {
  return CATEGORY_VISUALS.find((item) => item.twClass === twClass || item.color === twClass) ?? CATEGORY_VISUALS[0];
}

export function getCategoryVisualByName(name: string) {
  const direct = CATEGORY_VISUALS.find((item) => item.name === name);
  if (direct) return direct;
  const normalized = normalizeScheduleCategory(name);
  return CATEGORY_VISUALS.find((item) => item.name === normalized) ?? { ...fallbackVisual, name: normalized };
}

export function findCategoryDef(defs: ScheduleCategoryDef[], name: string) {
  const normalized = normalizeScheduleCategory(name);
  return defs.find((item) => item.name === normalized);
}

export function getScheduleCategoryVisual(category: string) {
  return getCategoryVisualByName(category);
}

export function getScheduleCategoryColor(category: string) {
  return getScheduleCategoryVisual(category).twClass;
}

export function getScheduleCategoryAccentColor(category: string) {
  return getScheduleCategoryVisual(category).twAccent;
}

export function getScheduleCategoryHex(category: string) {
  return getScheduleCategoryVisual(category).hex;
}
