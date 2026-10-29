export function clampWindowBounds(bounds, area) {
  if (!bounds || ['x', 'y', 'width', 'height'].some((key) => !Number.isFinite(bounds[key]))) throw new Error('窗口尺寸无效。');
  const width = Math.round(Math.min(area.width, Math.max(900, bounds.width)));
  const height = Math.round(Math.min(area.height, Math.max(560, bounds.height)));
  return { width, height,
    x: Math.round(Math.max(area.x, Math.min(area.x + area.width - width, bounds.x))),
    y: Math.round(Math.max(area.y, Math.min(area.y + area.height - height, bounds.y))),
  };
}

export function resizeWindowBounds(bounds, edge, dx, dy, area) {
  let left = bounds.x, top = bounds.y;
  let right = left + bounds.width, bottom = top + bounds.height;
  const minWidth = Math.min(900, area.width), minHeight = Math.min(560, area.height);
  if (edge.includes('w')) left = Math.max(area.x, Math.min(right - minWidth, left + dx));
  if (edge.includes('e')) right = Math.min(area.x + area.width, Math.max(left + minWidth, right + dx));
  if (edge.includes('n')) top = Math.max(area.y, Math.min(bottom - minHeight, top + dy));
  if (edge.includes('s')) bottom = Math.min(area.y + area.height, Math.max(top + minHeight, bottom + dy));
  return { x: left, y: top, width: right - left, height: bottom - top };
}
