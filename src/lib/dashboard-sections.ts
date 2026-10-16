export const dashboardSections = [
  { id: "daily", title: "日常任务" },
  { id: "research", title: "今日科研进展" },
  { id: "followup", title: "跟进事项" },
  { id: "boards", title: "科研与自学" },
  { id: "taskLists", title: "任务与清单" },
  { id: "utilities", title: "项目与生活记录" },
  { id: "execution", title: "时间与专注" },
] as const;

export type DashboardSectionId = typeof dashboardSections[number]["id"];
export const defaultDashboardSectionOrder = dashboardSections.map(({ id }) => id);

export function normalizeDashboardSectionOrder(value: unknown): DashboardSectionId[] {
  const valid = new Set<string>(defaultDashboardSectionOrder);
  const saved = Array.isArray(value) ? value.filter((id): id is DashboardSectionId => typeof id === "string" && valid.has(id)) : [];
  return [...new Set([...saved, ...defaultDashboardSectionOrder])];
}

export function moveDashboardSection(order: DashboardSectionId[], source: DashboardSectionId, target: DashboardSectionId, after = false) {
  if (source === target || !order.includes(source) || !order.includes(target)) return order;
  const next = order.filter((id) => id !== source);
  next.splice(next.indexOf(target) + (after ? 1 : 0), 0, source);
  return next;
}
