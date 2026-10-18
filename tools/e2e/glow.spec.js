import { expect, test } from '@playwright/test';
import { bootGame, readSlot } from './helpers.js';

// Enemy bullets are drawn after bloom. The composer path puts a bullet pass between bloom and
// output; the low tier has no composer and draws the bullet scene directly over the main one.

test('tier high draws enemy bullets in a pass between bloom and output', async ({ page }) => {
  await bootGame(page, '?debug&stress=500&tier=high');
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => globalThis.__scorched.passes)).toEqual([
    'scene',
    'bloom',
    'bullets',
    'output',
  ]);
  expect(await page.evaluate(() => globalThis.__scorched.bulletPath)).toBe('composer');
  expect(await readSlot(page, 'EBULLET_N')).toBeGreaterThanOrEqual(500);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});

test('tier low draws enemy bullets directly after the main scene', async ({ page }) => {
  await bootGame(page, '?debug&stress=500&tier=low');
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => globalThis.__scorched.bulletPath)).toBe('direct');
  expect(await readSlot(page, 'EBULLET_N')).toBeGreaterThanOrEqual(500);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});
