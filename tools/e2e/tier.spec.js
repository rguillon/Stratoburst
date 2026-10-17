import { expect, test } from '@playwright/test';
import { bootGame } from './helpers.js';

const MAX_PIXELS = { low: 600_000, mid: 1_200_000, high: 2_800_000 };

async function canvasPixels(page) {
  return page.evaluate(() => {
    const canvas = document.getElementById('view');
    return canvas.width * canvas.height;
  });
}

for (const tier of ['low', 'mid', 'high']) {
  test(`?tier=${tier} forces the tier and respects its pixel budget`, async ({ page }) => {
    await bootGame(page, `?debug&stress=500&tier=${tier}`);
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => globalThis.__scorched.tier)).toBe(tier);
    expect(await page.evaluate(() => globalThis.__scorched.lockReason)).toBe('forced');
    expect(await page.evaluate(() => globalThis.__scorched.tierLog)).toEqual([]);
    expect(await canvasPixels(page)).toBeLessThanOrEqual(MAX_PIXELS[tier]);
    await expect(page.locator('#error-panel')).toHaveCount(0);
  });
}

test('an invalid ?tier value means auto: unlocked, high on a desktop pointer', async ({ page }) => {
  await bootGame(page, '?debug&tier=ultra');
  expect(await page.evaluate(() => globalThis.__scorched.lockReason)).toBeNull();
  expect(await page.evaluate(() => globalThis.__scorched.tier)).toBe('high');
});
