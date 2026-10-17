import { expect, test } from '@playwright/test';
import { bootGame, readSlot } from './helpers.js';

test('python moves the ship with the arrow keys', async ({ page }) => {
  await bootGame(page);
  const x0 = await readSlot(page, 'SHIP_X');
  const t0 = await readSlot(page, 'TICK_COUNT');

  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(500);
  await page.keyboard.up('ArrowRight');

  const x1 = await readSlot(page, 'SHIP_X');
  const t1 = await readSlot(page, 'TICK_COUNT');
  expect(x1 - x0).toBeGreaterThan(20);
  expect(t1).toBeGreaterThan(t0);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});
