import { expect, test } from '@playwright/test';
import { bootGame } from './helpers.js';

// D-34 / D-35 / STGE-03: stage 1's city is drawn in the ground layer from the manifest layout.
// The production build runs under software GL, so the waits are generous: timing is not under test.
const cityDrawn = (page) => page.evaluate(() => globalThis.__scorched.fx.cityDrawn);

test('the city is drawn in stage mode and shares the ground layer scale', async ({ page }) => {
  test.setTimeout(120_000);
  await bootGame(page, '?debug&tier=high', { stage: true });

  await expect.poll(() => cityDrawn(page), { timeout: 15_000 }).toBeGreaterThan(0);
  const k = await page.evaluate(() => globalThis.__scorched.groundLayerK);
  expect(k).toBeGreaterThanOrEqual(1.03);
  expect(k).toBeLessThanOrEqual(1.09);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});

test('the city is drawn when the stage starts at the boss', async ({ page }) => {
  test.setTimeout(120_000);
  await bootGame(page, '?debug&at=boss', { stage: true });

  await expect.poll(() => cityDrawn(page), { timeout: 15_000 }).toBeGreaterThan(0);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});

test('the shooting gallery loops stage 1 city under it', async ({ page }) => {
  test.setTimeout(120_000);
  await bootGame(page, '?debug');

  await expect.poll(() => cityDrawn(page), { timeout: 15_000 }).toBeGreaterThan(0);
  const stage = await page.evaluate(() => globalThis.__scorched.manifest.stage);
  expect(stage.loop).toBe(true);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});
