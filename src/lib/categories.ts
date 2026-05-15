export type ScheduleCategoryVisual = {
  name: string;
  color: string;
  accent: string;
  hex: string;
};

const names = {
  deepResearch: "\u6df1\u5ea6\u79d1\u7814",
  experimentData: "\u5b9e\u9a8c\u6570\u636e",
  paperWriting: "\u8bba\u6587\u5199\u4f5c",
  literatureReading: "\u6587\u732e\u9605\u8bfb",
  courseStudy: "\u8bfe\u7a0b\u5b66\u4e60",
  meeting: "\u4f1a\u8bae\u6c9f\u901a",
  taskProgress: "\u4efb\u52a1\u63a8\u8fdb",
  admin: "\u884c\u653f\u4e8b\u52a1",
  life: "\u751f\u6d3b\u4e8b\u52a1",
  health: "\u5065\u5eb7\u8fd0\u52a8",
  commute: "\u901a\u52e4\u5916\u51fa",
  moodReview: "\u60c5\u7eea\u590d\u76d8",
  rest: "\u4f11\u606f\u6062\u590d",
  buffer: "\u5f39\u6027\u7f13\u51b2",
  uncategorized: "\u672a\u5206\u7c7b",
};

export const CATEGORY_VISUALS: ScheduleCategoryVisual[] = [
  { name: names.deepResearch, color: "bg-sky-50 border-sky-200 text-sky-950", accent: "bg-sky-400", hex: "#38bdf8" },
  { name: names.experimentData, color: "bg-teal-50 border-teal-200 text-teal-950", accent: "bg-teal-400", hex: "#2dd4bf" },
  { name: names.paperWriting, color: "bg-indigo-50 border-indigo-200 text-indigo-950", accent: "bg-indigo-400", hex: "#818cf8" },
  { name: names.literatureReading, color: "bg-cyan-50 border-cyan-200 text-cyan-950", accent: "bg-cyan-400", hex: "#22d3ee" },
  { name: names.courseStudy, color: "bg-violet-50 border-violet-200 text-violet-950", accent: "bg-violet-400", hex: "#a78bfa" },
  { name: names.meeting, color: "bg-amber-50 border-amber-200 text-amber-950", accent: "bg-amber-400", hex: "#fbbf24" },
  { name: names.taskProgress, color: "bg-emerald-50 border-emerald-200 text-emerald-950", accent: "bg-emerald-400", hex: "#34d399" },
  { name: names.admin, color: "bg-stone-50 border-stone-200 text-stone-900", accent: "bg-stone-400", hex: "#a8a29e" },
  { name: names.life, color: "bg-rose-50 border-rose-200 text-rose-950", accent: "bg-rose-400", hex: "#fb7185" },
  { name: names.health, color: "bg-orange-50 border-orange-200 text-orange-950", accent: "bg-orange-400", hex: "#fb923c" },
  { name: names.commute, color: "bg-lime-50 border-lime-200 text-lime-950", accent: "bg-lime-400", hex: "#a3e635" },
  { name: names.moodReview, color: "bg-fuchsia-50 border-fuchsia-200 text-fuchsia-950", accent: "bg-fuchsia-400", hex: "#e879f9" },
  { name: names.rest, color: "bg-slate-100 border-slate-200 text-slate-900", accent: "bg-slate-400", hex: "#94a3b8" },
  { name: names.buffer, color: "bg-zinc-50 border-zinc-200 text-zinc-900", accent: "bg-zinc-400", hex: "#a1a1aa" },
];

export const CATEGORY_COLORS = CATEGORY_VISUALS.map((item) => item.color);

export const DEFAULT_CATEGORY_PALETTE = CATEGORY_VISUALS.map((item) => ({
  name: item.name,
  color: item.color,
}));

export const CATEGORY_ALIAS_MAP: Record<string, string> = {
  "\u4e2a\u4eba": names.life,
  "\u5de5\u4f5c\u63d0\u5347": names.taskProgress,
  "\u8fd0\u52a8\u5065\u5eb7": names.health,
  "\u751f\u6d3b\u8fd0\u52a8": names.health,
  "\u5174\u8da3\u7231\u597d": names.rest,
  "\u653e\u677e\u4f11\u95f2": names.rest,
  "life&other": names.life,
  "\u81ea\u6211\u63d0\u5347": names.courseStudy,
  "\u8ba1\u5212\u590d\u76d8": names.taskProgress,
  "\u5b66\u4e60\u6210\u957f": names.courseStudy,
  "\u5a31\u4e50\u4f11\u606f": names.rest,
  "\u5176\u4ed6": names.life,
  "\u6570\u636e\u6574\u7406": names.experimentData,
  "\u5b9e\u9a8c\u5206\u6790": names.experimentData,
  "\u884c\u653f\u6742\u52a1": names.admin,
  "\u5916\u51fa\u901a\u52e4": names.commute,
  "\u60c5\u7eea\u8bb0\u5f55": names.moodReview,
  "\u7f13\u51b2\u65f6\u95f4": names.buffer,
  "浠诲姟鎺ㄨ繘": names.taskProgress,
  "鏂囩尞闃呰": names.literatureReading,
  "瀹為獙鏁版嵁": names.experimentData,
  "娣卞害绉戠爺": names.deepResearch,
};

const fallbackVisual: ScheduleCategoryVisual = {
  name: names.uncategorized,
  color: "bg-white border-gray-300 text-gray-900",
  accent: "bg-zinc-400",
  hex: "#a1a1aa",
};

export function normalizeScheduleCategory(value: string) {
  return CATEGORY_ALIAS_MAP[value] ?? (value || fallbackVisual.name);
}

export function getScheduleCategoryVisual(category: string) {
  const normalized = normalizeScheduleCategory(category);
  return CATEGORY_VISUALS.find((item) => item.name === normalized) ?? { ...fallbackVisual, name: normalized };
}

export function getScheduleCategoryColor(category: string) {
  return getScheduleCategoryVisual(category).color;
}

export function getScheduleCategoryAccentColor(category: string) {
  return getScheduleCategoryVisual(category).accent;
}
