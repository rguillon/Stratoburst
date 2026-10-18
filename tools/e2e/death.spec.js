import { expect, test } from '@playwright/test';
import { bootGame, readSlot } from './helpers.js';

// An idle ship in the gallery is eventually hit (D-18, infinite lives): it is destroyed after
// the grace window, flies back in and blinks invulnerable. A god ship never dies.
test.setTimeout(120_000);

test('a mortal idle ship dies, flies back in and blinks invulnerable', async ({ page }) => {
  await bootGame(page, '?debug', { mortal: true });
  // While the ship is DYING (phase 2) its model is hidden; header and visibility are read in one
  // evaluate so both come from the same frame.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const s = globalThis.__scorched;
          return s.header[s.slots.PLAYER_PHASE] === 2 ? s.shipVisible : null;
        }),
      { timeout: 90_000, intervals: [40] },
    )
    .toBe(false);
  expect(await readSlot(page, 'DEATHS')).toBeGreaterThanOrEqual(1);
  await expect
    .poll(() => readSlot(page, 'PLAYER_PHASE'), { timeout: 20_000, intervals: [100] })
    .toBe(0);
  expect(await readSlot(page, 'INVULN')).toBeGreaterThan(0);
  expect(await page.evaluate(() => globalThis.__scorched.shipVisible)).toBe(true);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});

// D-04, D-05: a death costs two weapon levels, keeps the weapon type, and leaves a recovery pickup.
test('a death at laser Lv4 drops to Lv2, keeps the laser and leaves a recovery pickup', async ({ page }) => {
  await bootGame(page, '?debug&weapon=laser&level=4', { mortal: true });
  await expect.poll(() => readSlot(page, 'DEATHS'), { timeout: 90_000, intervals: [250] }).toBeGreaterThanOrEqual(1);
  expect(await readSlot(page, 'LEVEL')).toBe(2);
  expect(await readSlot(page, 'WEAPON')).toBe(1);
  expect(await readSlot(page, 'PICKUP_N')).toBeGreaterThanOrEqual(1);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});

test('a god ship never dies', async ({ page }) => {
  await bootGame(page, '?debug');
  await page.waitForTimeout(20_000);
  expect(await readSlot(page, 'DEATHS')).toBe(0);
  expect(await readSlot(page, 'PLAYER_PHASE')).toBe(0);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});
