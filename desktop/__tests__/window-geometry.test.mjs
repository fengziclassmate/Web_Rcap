import { describe, expect, it } from 'vitest';
import { clampWindowBounds, resizeWindowBounds } from '../window-geometry.mjs';

const area = { x: 0, y: 0, width: 1920, height: 1040 };
const bounds = { x: 200, y: 180, width: 1200, height: 760 };

describe('desktop window geometry', () => {
  it.each(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'])('resizes the %s edge while keeping the opposite edge fixed', (edge) => {
    const next = resizeWindowBounds(bounds, edge, 30, 20, area);
    expect(next.x).toBe(edge.includes('w') ? 230 : 200);
    expect(next.y).toBe(edge.includes('n') ? 200 : 180);
    expect(next.width).toBe(edge.includes('w') ? 1170 : edge.includes('e') ? 1230 : 1200);
    expect(next.height).toBe(edge.includes('n') ? 740 : edge.includes('s') ? 780 : 760);
  });
  it('keeps the opposite corner fixed at the minimum size and the screen boundary', () => {
    expect(resizeWindowBounds(bounds, 'nw', 2000, 2000, area)).toEqual({ x: 500, y: 380, width: 900, height: 560 });
    expect(resizeWindowBounds(bounds, 'nw', -2000, -2000, area)).toEqual({ x: 0, y: 0, width: 1400, height: 940 });
  });
  it('restores saved bounds and brings an off-screen window into the current work area', () => {
    expect(clampWindowBounds(bounds, area)).toEqual(bounds);
    expect(clampWindowBounds({ x: -1800, y: 900, width: 1500, height: 1200 }, area)).toEqual({ x: 0, y: 0, width: 1500, height: 1040 });
    expect(() => clampWindowBounds({ ...bounds, width: '1200' }, area)).toThrow('窗口尺寸无效');
  });
});
