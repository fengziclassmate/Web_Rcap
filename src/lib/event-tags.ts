// Keep the original values so existing events and templates remain compatible.
export const eventTagOptions = [
  { value: "待定", label: "待确认", icon: "?", color: "text-amber-700", group: "时间安排" },
  { value: "不着急", label: "可调整", icon: "↔", color: "text-sky-700", group: "时间安排" },
  { value: "不可后退", label: "固定时间", icon: "●", color: "text-rose-700", group: "时间安排" },
  { value: "深度专注", label: "深度专注", icon: "◎", color: "text-indigo-700", group: "生活与状态" },
  { value: "充电一下", label: "充电一下", icon: "☀", color: "text-emerald-700", group: "生活与状态" },
  { value: "小挑战", label: "小挑战", icon: "↗", color: "text-orange-700", group: "生活与状态" },
  { value: "期待已久", label: "期待已久", icon: "☆", color: "text-pink-700", group: "生活与状态" },
  { value: "顺路办", label: "顺路办", icon: "➜", color: "text-teal-700", group: "生活与状态" },
  { value: "一起完成", label: "一起完成", icon: "∞", color: "text-violet-700", group: "生活与状态" },
] as const;

export type EventTag = (typeof eventTagOptions)[number]["value"] | null;
export function normalizeEventTag(value: unknown): EventTag {
  return eventTagOptions.find((item) => item.value === value)?.value ?? null;
}
export function getEventTagInfo(value: EventTag) {
  return eventTagOptions.find((item) => item.value === value) ?? { label: "无标记", icon: "", color: "text-stone-500" };
}
