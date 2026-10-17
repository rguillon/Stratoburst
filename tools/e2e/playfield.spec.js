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
