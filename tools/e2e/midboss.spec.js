import { expect, test } from '@playwright/test';
import { bootGame, readSlot } from './helpers.js';

// D-02 / D-14 / D-25: at ?at=midboss the armored train rolls in with its HP bar. A level 5 laser held
// in the maglev column (x 120) pierces the hull and both turrets; the bar drains and is gone once
// the train is dead and play resumes.
// The production build runs under software GL, so the waits are generous: timing is not under test.
test('the train comes in with its HP bar, which drains and goes with the kill', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await bootGame(page, '?debug&at=midboss&weapon=laser&level=5', { stage: true });

  // The boss bar is state-driven from BOSS_ACTIVE: it appears with the fight.
  await page.waitForFunction(
    () => {
      const { header, slots } = globalThis.__scorched;
      return header[slots.BOSS_ACTIVE] === 1;
    },
    null,
    { polling: 'raf', timeout: 30_000 },
  );
  await expect(page.locator('#boss-bar')).toBeVisible();
  await expect(page.locator('#boss-bar .ticks .tick:not([hidden])')).toHaveCount(1);

  // The intro fly-in ignores the controls; steer once play starts. A key release lands a frame or two
  // late, so settle within 4 of the column, which is well inside the laser and the grab circle.
  await page.waitForFunction(
    () => {
      const { header, slots, manifest } = globalThis.__scorched;
      return header[slots.FLOW] !== manifest.flow_states.INTRO;
    },
    null,
    { polling: 'raf', timeout: 15_000 },
  );
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const x = await readSlot(page, 'SHIP_X');
    if (Math.abs(x - 120) <= 4) break;
    const key = x > 120 ? 'ArrowLeft' : 'ArrowRight';
    await page.keyboard.down(key);
    await page.waitForFunction(
      ([dir]) => {
        const { header, slots } = globalThis.__scorched;
        const ship = header[slots.SHIP_X];
        return dir === 'ArrowLeft' ? ship <= 123 : ship >= 117;
      },
      [key],
      { polling: 'raf', timeout: 5_000 },
    );
    await page.keyboard.up(key);
    await page.waitForTimeout(100);
  }
  expect(Math.abs((await readSlot(page, 'SHIP_X')) - 120)).toBeLessThanOrEqual(4);

  await page.keyboard.down('Space');
  // The hull takes damage: its fraction falls below 1.
  await page.waitForFunction(
    () => {
      const { header, slots } = globalThis.__scorched;
      return header[slots.BOSS_HP] < 1;
    },
    null,
    { polling: 'raf', timeout: 60_000 },
  );

  // The kill: BOSS_ACTIVE drops back to 0 and the bar hides.
  await page.waitForFunction(
    () => {
      const { header, slots } = globalThis.__scorched;
      return header[slots.BOSS_ACTIVE] === 0;
    },
    null,
    { polling: 'raf', timeout: 90_000 },
  );
  await page.keyboard.up('Space');
  await expect(page.locator('#boss-bar')).toBeHidden();
  await expect(page.locator('#error-panel')).toHaveCount(0);
});
