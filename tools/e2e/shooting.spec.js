import { expect, test } from '@playwright/test';
import { bootGame, readSlot } from './helpers.js';

test('holding Space fires', async ({ page }) => {
  await bootGame(page, '?debug');
  expect(await readSlot(page, 'PBULLET_N')).toBe(0);
  await page.keyboard.down('Space');
  await page.waitForTimeout(1000);
  expect(await readSlot(page, 'PBULLET_N')).toBeGreaterThan(0);
  await page.keyboard.up('Space');
  // Bolts keep flying up and leave the screen within about 0.6 s.
  await expect.poll(() => readSlot(page, 'PBULLET_N'), { timeout: 1500 }).toBe(0);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});
