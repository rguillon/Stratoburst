import { expect, test } from '@playwright/test';
import { bootGame } from './helpers.js';

const VIEWPORTS = [
  { name: 'portrait phone', width: 390, height: 844 },
  { name: 'landscape phone', width: 844, height: 390 },
  { name: 'desktop', width: 1280, height: 720 },
];

for (const { name, width, height } of VIEWPORTS) {
  test(`the whole playfield is visible and fitted at ${width}x${height} (${name})`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await bootGame(page, '?debug');

    const corners = await page.evaluate(() => globalThis.__scorched.projectPlayfield());
    expect(corners).toHaveLength(4);
    for (const c of corners) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x).toBeLessThanOrEqual(width);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeLessThanOrEqual(height);
    }

    const xs = corners.map((c) => c.x);
    const ys = corners.map((c) => c.y);
    const fillX = (Math.max(...xs) - Math.min(...xs)) / width;
    const fillY = (Math.max(...ys) - Math.min(...ys)) / height;
    expect(Math.max(fillX, fillY)).toBeGreaterThanOrEqual(0.85);

    const size = await page.evaluate(() => {
      const canvas = document.getElementById('view');
      return { w: canvas.clientWidth, h: canvas.clientHeight };
    });
    expect(size).toEqual({ w: width, h: height });
    await expect(page.locator('#error-panel')).toHaveCount(0);
  });
}

test('python-driven terrain scroll advances 0.8 units per 60 Hz step', async ({ page }) => {
  // The low tier keeps software-GL frames short so the fixed-step catch-up cap (3 steps per
  // frame) never throttles the simulation; tiers are presentation-only, so scroll is unaffected.
  await bootGame(page, '?debug&tier=low');
  await page.waitForTimeout(1500);
  // Both slots are read in one evaluate so the pair is consistent (same JS task).
  const sample = () =>
    page.evaluate(() => {
      const { header, slots } = globalThis.__scorched;
      return { scroll: header[slots.SCROLL_Y], ticks: header[slots.TICK_COUNT] };
    });
  const start = await sample();
  await page.waitForTimeout(1000);
  const end = await sample();
  const scroll = end.scroll - start.scroll;
  const ticks = end.ticks - start.ticks;
  expect(scroll).toBeGreaterThan(42);
  expect(scroll).toBeLessThan(54);
  expect(scroll).toBeCloseTo(ticks * 0.8, 1); // exactly SCROLL_SPEED per simulation step
  await expect(page.locator('#error-panel')).toHaveCount(0);
});
