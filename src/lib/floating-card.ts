export const FLOATING_VIEWS = ["next", "agenda", "tasks"] as const;
export type FloatingView = typeof FLOATING_VIEWS[number];
export type FloatingCardSettings = {
  view: FloatingView;
  collapsed: boolean;
  hidden: boolean;
  x: number;
  y: number;
};

export function clampFloatingPosition(x: number, y: number, width: number, height: number, viewportWidth: number, viewportHeight: number) {
  return {
    x: Math.max(12, Math.min(x, viewportWidth - width - 12)),
    y: Math.max(12, Math.min(y, viewportHeight - height - 12)),
  };
}

export function normalizeFloatingSettings(value: unknown, viewportWidth: number, viewportHeight = 900): FloatingCardSettings {
  const settings = value && typeof value === "object" ? value as Partial<FloatingCardSettings> : {};
  return {
    view: FLOATING_VIEWS.includes(settings.view as FloatingView) ? settings.view! : "next",
    collapsed: settings.collapsed === true,
    hidden: settings.hidden === true,
    x: typeof settings.x === "number" && Number.isFinite(settings.x) ? settings.x : Math.max(12, viewportWidth - 336),
    y: typeof settings.y === "number" && Number.isFinite(settings.y) ? settings.y : Math.max(12, viewportHeight - 380),
  };
}
