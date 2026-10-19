import { expect, test } from '@playwright/test';
import { bootGame, readSlot } from './helpers.js';

// STGE-03 (D-33, D-34): the early slums target at x 40 is a neon building. A laser held over it
// destroys it: the blast adds the city sparks, the kill leaves a wreck and a scorch mark, and the
// score rises. The production build runs under software GL, so the waits are generous: timing is
// not under test.
const TARGET_X = 40;

test('a laser at x 40 destroys an early slums target: city burst, wreck and scorch, score', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await bootGame(page, '?debug&weapon=laser&level=5', { stage: true });

  // The intro fly-in ignores the controls; steer once play starts.
  await page.waitForFunction(
    () => {
      const { header, slots, manifest } = globalThis.__scorched;
      return header[slots.FLOW] === manifest.flow_states.PLAY;
    },
    null,
    { polling: 'raf', timeout: 15_000 },
  );

  // A key release lands a frame or two late, so settle within 4 of the target column.
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const x = await readSlot(page, 'SHIP_X');
    if (Math.abs(x - TARGET_X) <= 4) break;
    const key = x > TARGET_X ? 'ArrowLeft' : 'ArrowRight';
    await page.keyboard.down(key);
    await page.waitForFunction(
      ([dir, target]) => {
        const { header, slots } = globalThis.__scorched;
        const ship = header[slots.SHIP_X];
        return dir === 'ArrowLeft' ? ship <= target + 2 : ship >= target - 2;
      },
      [key, TARGET_X],
      { polling: 'raf', timeout: 5_000 },
    );
    await page.keyboard.up(key);
    await page.waitForTimeout(100);
  }
  expect(Math.abs((await readSlot(page, 'SHIP_X')) - TARGET_X)).toBeLessThanOrEqual(4);

  await page.keyboard.down('Space');
  await expect
    .poll(() => page.evaluate(() => globalThis.__scorched.fx.cityBursts), {
      timeout: 60_000,
      intervals: [250],
    })
    .toBeGreaterThanOrEqual(1);
  await page.keyboard.up('Space');

  await expect
    .poll(() => page.evaluate(() => globalThis.__scorched.fx.decals), { timeout: 5_000 })
    .toBeGreaterThanOrEqual(1);
  expect(await page.evaluate(() => globalThis.__scorched.fx.wrecksSpawned)).toBeGreaterThanOrEqual(1);
  expect(await readSlot(page, 'SCORE')).toBeGreaterThan(0);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});
