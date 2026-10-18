import { expect, test } from '@playwright/test';
import { bootGame, readSlot } from './helpers.js';

test('stress=500 puts exactly 500 python bullets on screen', async ({ page }) => {
  await bootGame(page, '?debug&stress=500');
  await page.waitForTimeout(1000);
  expect(await readSlot(page, 'STORM_N')).toBe(500);
  const t0 = await readSlot(page, 'TICK_COUNT');
  await page.waitForTimeout(300);
  expect(await readSlot(page, 'TICK_COUNT')).toBeGreaterThan(t0);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});

test('no stress flag leaves the storm empty', async ({ page }) => {
  await bootGame(page, '?debug');
  await page.waitForTimeout(300);
  expect(await readSlot(page, 'STORM_N')).toBe(0);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});

test('stress=1 spawns exactly one bullet', async ({ page }) => {
  await bootGame(page, '?debug&stress=1');
  await page.waitForTimeout(300);
  expect(await readSlot(page, 'STORM_N')).toBe(1);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});
