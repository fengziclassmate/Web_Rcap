export type CategoryHue = "cold" | "warm" | "neutral";
export type ScheduleCategoryGroup = "routine" | "meals" | "social" | "academic" | "health" | "other";
export type ScheduleCategoryIcon =
  | "moon"
  | "droplets"
  | "coffee"
  | "utensils"
  | "pause"
  | "users"
  | "gamepad"
  | "video"
  | "book"
  | "graduation"
  | "flask"
  | "dumbbell"
  | "car"
  | "house"
  | "circle";

export type ScheduleCategoryVisual = {
  name: string;
  color: string;
  accent: string;
  twClass: string;
  twAccent: string;
  hex: string;
  hue: CategoryHue;
  group: ScheduleCategoryGroup;
  icon: ScheduleCategoryIcon;
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

export const DEFAULT_SCHEDULE_CATEGORY = "科研";
export const UNCATEGORIZED_SCHEDULE_CATEGORY = "其他";

const names = {
  sleep: "睡眠",
  wash: "洗漱",
  shower: "洗澡",
  breakfast: "早餐",
  lunch: "中餐",
  dinner: "晚餐",
  lateNightSnack: "夜宵",
  groceries: "买菜",
  rest: "休息",
  gathering: "朋友聚会",
  gaming: "打游戏",
  watchingSports: "看比赛",
  shopping: "逛街",
  social: "社交",
  entertainment: "娱乐",
  meeting: "会议",
  literatureReading: "文献阅读",
  privateStudy: "私人学习",
  projectWork: "项目工作",
  experiment: "实验研究",
  paperWriting: "论文写作",
  study: "学习",
  research: "科研",
  fitness: "健身",
  ballSports: "球类运动",
  running: "跑步",
  outdoorSports: "户外运动",
  exercise: "运动",
  commute: "通勤",
  chores: "家务",
  other: "其他",
};

function visual(
  name: string,
  twClass: string,
  twAccent: string,
  hex: string,
  hue: CategoryHue,
  group: ScheduleCategoryGroup,
  icon: ScheduleCategoryIcon,
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
    group,
    icon,
    isBuiltIn,
  };
}

export const SCHEDULE_CATEGORY_GROUP_ORDER: ScheduleCategoryGroup[] = [
  "routine",
  "meals",
  "social",
  "academic",
  "health",
  "other",
];

export const SCHEDULE_CATEGORY_GROUP_LABELS: Record<ScheduleCategoryGroup, string> = {
  routine: "生活作息",
  meals: "饮食与采购",
  social: "休闲社交",
  academic: "学术工作",
  health: "运动健康",
  other: "出行与事务",
};

export const CATEGORY_VISUALS: ScheduleCategoryVisual[] = [
  visual(names.sleep, "bg-indigo-50 border-indigo-300 text-indigo-950", "bg-indigo-500", "#6366f1", "cold", "routine", "moon"),
  visual(names.wash, "bg-sky-50 border-sky-300 text-sky-950", "bg-sky-500", "#0ea5e9", "cold", "routine", "droplets"),
  visual(names.shower, "bg-cyan-50 border-cyan-300 text-cyan-950", "bg-cyan-500", "#06b6d4", "cold", "routine", "droplets"),
  visual(names.rest, "bg-emerald-50 border-emerald-300 text-emerald-950", "bg-emerald-500", "#10b981", "cold", "routine", "pause"),
  visual(names.breakfast, "bg-amber-50 border-amber-300 text-amber-950", "bg-amber-500", "#f59e0b", "warm", "meals", "coffee"),
  visual(names.lunch, "bg-orange-50 border-orange-300 text-orange-950", "bg-orange-500", "#f97316", "warm", "meals", "utensils"),
  visual(names.dinner, "bg-rose-50 border-rose-300 text-rose-950", "bg-rose-500", "#f43f5e", "warm", "meals", "utensils"),
  visual(names.lateNightSnack, "bg-fuchsia-50 border-fuchsia-300 text-fuchsia-950", "bg-fuchsia-500", "#d946ef", "warm", "meals", "moon"),
  visual(names.groceries, "bg-yellow-50 border-yellow-300 text-yellow-950", "bg-yellow-500", "#eab308", "warm", "meals", "utensils"),
  visual(names.gathering, "bg-pink-50 border-pink-300 text-pink-950", "bg-pink-500", "#ec4899", "warm", "social", "users"),
  visual(names.gaming, "bg-violet-50 border-violet-300 text-violet-950", "bg-violet-500", "#8b5cf6", "warm", "social", "gamepad"),
  visual(names.watchingSports, "bg-purple-50 border-purple-300 text-purple-950", "bg-purple-500", "#a855f7", "warm", "social", "video"),
  visual(names.shopping, "bg-fuchsia-50 border-fuchsia-400 text-fuchsia-950", "bg-fuchsia-600", "#c026d3", "warm", "social", "users"),
  visual(names.social, "bg-pink-50 border-pink-200 text-pink-950", "bg-pink-400", "#f472b6", "warm", "social", "users"),
  visual(names.entertainment, "bg-purple-50 border-purple-200 text-purple-950", "bg-purple-400", "#c084fc", "warm", "social", "gamepad"),
  visual(names.meeting, "bg-blue-50 border-blue-300 text-blue-950", "bg-blue-500", "#3b82f6", "cold", "academic", "video"),
  visual(names.literatureReading, "bg-cyan-50 border-cyan-400 text-cyan-950", "bg-cyan-600", "#0891b2", "cold", "academic", "book"),
  visual(names.privateStudy, "bg-violet-50 border-violet-400 text-violet-950", "bg-violet-600", "#7c3aed", "cold", "academic", "graduation"),
  visual(names.projectWork, "bg-indigo-50 border-indigo-400 text-indigo-950", "bg-indigo-600", "#4f46e5", "cold", "academic", "flask"),
  visual(names.experiment, "bg-teal-50 border-teal-400 text-teal-950", "bg-teal-600", "#0d9488", "cold", "academic", "flask"),
  visual(names.paperWriting, "bg-blue-50 border-blue-500 text-blue-950", "bg-blue-700", "#1d4ed8", "cold", "academic", "book"),
  visual(names.study, "bg-violet-50 border-violet-200 text-violet-950", "bg-violet-400", "#a78bfa", "cold", "academic", "graduation"),
  visual(names.research, "bg-blue-50 border-blue-400 text-blue-950", "bg-blue-600", "#2563eb", "cold", "academic", "flask"),
  visual(names.fitness, "bg-lime-50 border-lime-300 text-lime-950", "bg-lime-500", "#84cc16", "cold", "health", "dumbbell"),
  visual(names.ballSports, "bg-green-50 border-green-300 text-green-950", "bg-green-500", "#22c55e", "cold", "health", "dumbbell"),
  visual(names.running, "bg-emerald-50 border-emerald-400 text-emerald-950", "bg-emerald-600", "#059669", "cold", "health", "dumbbell"),
  visual(names.outdoorSports, "bg-teal-50 border-teal-300 text-teal-950", "bg-teal-500", "#14b8a6", "cold", "health", "dumbbell"),
  visual(names.exercise, "bg-lime-50 border-lime-200 text-lime-950", "bg-lime-400", "#a3e635", "cold", "health", "dumbbell"),
  visual(names.commute, "bg-amber-50 border-amber-400 text-amber-950", "bg-amber-600", "#d97706", "warm", "other", "car"),
  visual(names.chores, "bg-stone-50 border-stone-300 text-stone-950", "bg-stone-400", "#a8a29e", "neutral", "other", "house"),
  visual(names.other, "bg-zinc-50 border-zinc-300 text-zinc-950", "bg-zinc-400", "#a1a1aa", "neutral", "other", "circle"),
];

export const CATEGORY_COLORS = CATEGORY_VISUALS.map((item) => item.twClass);
const SCHEDULE_CATEGORY_NAMES = CATEGORY_VISUALS.map((item) => item.name);
export const SCHEDULE_CATEGORY_PROMPT_LIST = SCHEDULE_CATEGORY_NAMES.join("、");


const CATEGORY_ALIAS_MAP: Record<string, string> = {
  睡觉: names.sleep,
  睡觉事件: names.sleep,
  睡眠事件: names.sleep,
  洗漱事件: names.wash,
  洗澡事件: names.shower,
  早餐事件: names.breakfast,
  中餐事件: names.lunch,
  午餐: names.lunch,
  午餐事件: names.lunch,
  晚餐事件: names.dinner,
  夜宵事件: names.lateNightSnack,
  买菜事件: names.groceries,
  休息事件: names.rest,
  社交事件: names.social,
  娱乐事件: names.entertainment,
  聚会: names.gathering,
  朋友聚会事件: names.gathering,
  游戏: names.gaming,
  游戏事件: names.gaming,
  打游戏事件: names.gaming,
  看球: names.watchingSports,
  观看比赛: names.watchingSports,
  看比赛事件: names.watchingSports,
  购物: names.shopping,
  逛街事件: names.shopping,
  会议事件: names.meeting,
  文献阅读事件: names.literatureReading,
  私人学习事件: names.privateStudy,
  项目工作事件: names.projectWork,
  项目推进: names.projectWork,
  实验: names.experiment,
  实验研究事件: names.experiment,
  论文: names.paperWriting,
  论文写作事件: names.paperWriting,
  学习事件: names.study,
  科研事件: names.research,
  运动事件: names.exercise,
  健身事件: names.fitness,
  球类: names.ballSports,
  球类运动事件: names.ballSports,
  跑步事件: names.running,
  户外: names.outdoorSports,
  户外运动事件: names.outdoorSports,
  通勤事件: names.commute,
  家务事件: names.chores,
  个人: names.other,
  工作: names.research,
  工作提升: names.research,
  深度科研: names.research,
  科研深潜: names.research,
  实验数据: names.research,
  数据整理: names.research,
  实验分析: names.research,
  论文写作: names.paperWriting,
  投稿准备: names.research,
  任务推进: names.research,
  计划复盘: names.research,
  课程学习: names.study,
  学习成长: names.study,
  自我提升: names.study,
  组会沟通: names.meeting,
  会议沟通: names.meeting,
  行政事务: names.other,
  行政杂务: names.other,
  吃饭休息: names.rest,
  生活事务: names.chores,
  生活整理: names.chores,
  运动健康: names.exercise,
  健康运动: names.exercise,
  生活运动: names.exercise,
  家务杂事: names.chores,
  社交娱乐: names.social,
  兴趣爱好: names.entertainment,
  娱乐休息: names.entertainment,
  放松休闲: names.rest,
  休息恢复: names.rest,
  外出通勤: names.commute,
  通勤外出: names.commute,
  情绪记录: names.rest,
  情绪复盘: names.rest,
  缓冲时间: names.other,
  弹性缓冲: names.other,
  "life&other": names.other,
  其他: names.other,
  "娣卞害绉戠爺": names.research,
  "瀹為獙鏁版嵁": names.research,
  "璁烘枃鍐欎綔": names.research,
  "鏂囩尞闃呰": names.literatureReading,
  "璇剧▼瀛︿範": names.study,
  "浼氳娌熼€?": names.meeting,
  "浠诲姟鎺ㄨ繘": names.research,
  "琛屾斂浜嬪姟": names.other,
  "鐢熸椿浜嬪姟": names.chores,
  "鍋ュ悍杩愬姩": names.exercise,
  "閫氬嫟澶栧嚭": names.commute,
  "鎯呯华澶嶇洏": names.rest,
  "浼戞伅鎭㈠": names.rest,
  "寮规€х紦鍐?": names.other,
  "娴犺濮熼幒銊ㄧ箻": names.research,
  "閺傚洨灏為梼鍛邦嚢": names.literatureReading,
  "鐎圭偤鐛欓弫鐗堝祦": names.research,
  "濞ｅ崬瀹崇粔鎴犵埡": names.research,
};

const fallbackVisual = visual(
  names.other,
  "bg-white border-gray-300 text-gray-900",
  "bg-zinc-400",
  "#a1a1aa",
  "neutral",
  "other",
  "circle",
  false,
);

function createDefaultCategoryDefs(): ScheduleCategoryDef[] {
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
      const rawName = typeof raw.name === "string" ? raw.name.trim() : "";
      const name = normalizeScheduleCategory(rawName);
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

  const merged: ScheduleCategoryDef[] = [];
  for (const item of custom) {
    if (!isCategoryNameTaken(merged, item.name)) merged.push(item);
  }
  for (const item of defaults) {
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
  const trimmed = value.trim();
  if (!trimmed) return fallbackVisual.name;

  const withoutEventSuffix = trimmed.endsWith("事件") ? trimmed.slice(0, -2) : trimmed;
  const builtIn = CATEGORY_VISUALS.find((item) => item.name === trimmed);
  const builtInWithoutSuffix = CATEGORY_VISUALS.find((item) => item.name === withoutEventSuffix);

  return (
    builtIn?.name ??
    builtInWithoutSuffix?.name ??
    CATEGORY_ALIAS_MAP[trimmed] ??
    CATEGORY_ALIAS_MAP[withoutEventSuffix] ??
    trimmed
  );
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


export function getScheduleCategoryVisual(category: string) {
  return getCategoryVisualByName(category);
}

export function getScheduleCategoryColor(category: string) {
  return getScheduleCategoryVisual(category).twClass;
}

export function getScheduleCategoryAccentColor(category: string) {
  return getScheduleCategoryVisual(category).twAccent;
}
