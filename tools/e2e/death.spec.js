import { expect, test } from '@playwright/test';
import { bootGame, readSlot } from './helpers.js';

// An idle ship in the gallery is eventually hit (D-18, infinite lives): it is destroyed after
// the grace window, flies back in and blinks invulnerable. A god ship never dies.
test.setTimeout(120_000);

test('a mortal idle ship dies, flies back in and blinks invulnerable', async ({ page }) => {
  await bootGame(page, '?debug', { mortal: true });
  await expect.poll(() => readSlot(page, 'DEATHS'), { timeout: 90_000, intervals: [250] }).toBeGreaterThanOrEqual(1);
  await expect
    .poll(() => readSlot(page, 'PLAYER_PHASE'), { timeout: 20_000, intervals: [100] })
    .toBe(0);
  expect(await readSlot(page, 'INVULN')).toBeGreaterThan(0);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});

test('a god ship never dies', async ({ page }) => {
  await bootGame(page, '?debug');
  await page.waitForTimeout(20_000);
  expect(await readSlot(page, 'DEATHS')).toBe(0);
  expect(await readSlot(page, 'PLAYER_PHASE')).toBe(0);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});
