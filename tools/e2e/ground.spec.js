import { expect, test } from '@playwright/test';
import { bootGame } from './helpers.js';

// D-21 / STGE-04 / ENMY-08: ground targets are drawn on the terrain through the ray-compensating
// ground layer, and a ground kill leaves a wreck. The production build runs under software GL, so
// the waits are generous: the timing is not under test.
test('the ground layer scale is in range and a ground kill leaves a wreck', async ({ page }) => {
  test.setTimeout(120_000);
  await bootGame(page, '?debug&weapon=vulcan&level=5');

  const k = await page.evaluate(() => globalThis.__scorched.groundLayerK);
  expect(k).toBeGreaterThanOrEqual(1.03);
  expect(k).toBeLessThanOrEqual(1.09);

  const wrecks = () => page.evaluate(() => globalThis.__scorched.fx.wrecksSpawned);
  // Hold fire with the wide fan and sweep left and right until a tank or turret goes down.
  await page.keyboard.down('Space');
  const deadline = Date.now() + 40_000;
  let key = 'ArrowLeft';
  while (Date.now() < deadline && (await wrecks()) < 1) {
    await page.keyboard.down(key);
    await page.waitForTimeout(600);
    await page.keyboard.up(key);
    key = key === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft';
  }
  await page.keyboard.up('Space');
  expect(await wrecks()).toBeGreaterThanOrEqual(1);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});
