import { expect, test } from '@playwright/test';
import { bootGame, readSlot } from './helpers.js';

// D-13 / D-14: at ?at=boss a flashing WARNING precedes the giant bomber, the boss bar follows it, and
// the kill brings the stage to its CLEAR state. A level 5 laser held in the centre column (x 120)
// pierces the hull and both turrets. The production build runs under software GL, and other specs run
// beside this one, so the waits are generous: timing is not under test.
test('a flashing WARNING comes first, then the bomber fight, and the kill brings the CLEAR state', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await bootGame(page, '?debug&at=boss&weapon=laser&level=5', { stage: true });

  // The WARNING: state-driven from FLOW, so the banner and the flow state agree on the same frame.
  await page.waitForFunction(
    () => {
      const { header, slots, manifest } = globalThis.__scorched;
      const banner = document.getElementById('banner');
      return (
        header[slots.FLOW] === manifest.flow_states.WARNING &&
        !banner.hidden &&
        banner.textContent === 'WARNING' &&
        banner.classList.contains('warning') &&
        // The bomber's shadow sweeps the city while the WARNING runs.
        globalThis.__scorched.fx.bossSweepVisible === true
      );
    },
    null,
    { polling: 'raf', timeout: 120_000 },
  );
  // The flash is a 2 Hz CSS animation (0.5 s period), well under the 3 flashes per second ceiling.
  const flash = await page.evaluate(() => {
    const animation = document.getElementById('banner').getAnimations()[0];
    return animation?.effect.getTiming().duration ?? null;
  });
  expect(flash).toBeGreaterThanOrEqual(340);
  expect(flash).toBe(500);

  // The intro fly-in is over, so the controls work: settle within 4 of the centre column, which is
  // well inside the laser and the grab circle (a key release lands a frame or two late).
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
      { polling: 'raf', timeout: 15_000 },
    );
    await page.keyboard.up(key);
    await page.waitForTimeout(100);
  }
  expect(Math.abs((await readSlot(page, 'SHIP_X')) - 120)).toBeLessThanOrEqual(4);

  // The bomber arrives: the fight starts and the boss bar reports the boss.
  await page.waitForFunction(
    () => {
      const { header, slots, manifest } = globalThis.__scorched;
      return header[slots.FLOW] === manifest.flow_states.BOSS && header[slots.BOSS_ACTIVE] === 2;
    },
    null,
    { polling: 'raf', timeout: 60_000 },
  );
  await expect(page.locator('#banner')).toBeHidden();
  expect(await page.evaluate(() => globalThis.__scorched.fx.bossSweepVisible)).toBe(false);

  await page.keyboard.down('Space');
  // The death sequence starts when the hull is at zero; the boss's end is the last event of it.
  await page.waitForFunction(
    () => {
      const { header, slots, manifest } = globalThis.__scorched;
      return header[slots.FLOW] === manifest.flow_states.BOSS && header[slots.BOSS_HP] === 0;
    },
    null,
    { polling: 'raf', timeout: 150_000 },
  );
  const shakesBefore = await page.evaluate(() => globalThis.__scorched.fx.shakes);
  // The kill: the boss bar goes and the stage reaches CLEAR.
  await page.waitForFunction(
    () => {
      const { header, slots, manifest } = globalThis.__scorched;
      return header[slots.FLOW] === manifest.flow_states.CLEAR && header[slots.BOSS_ACTIVE] === 0;
    },
    null,
    { polling: 'raf', timeout: 150_000 },
  );
  await page.keyboard.up('Space');
  // D-14: the boss's end is a chain of four ceiling-strength shakes (the ceilings are unit tested).
  await page.waitForFunction(([before]) => globalThis.__scorched.fx.shakes - before >= 4, [shakesBefore], {
    polling: 'raf',
    timeout: 30_000,
  });
  expect(await page.evaluate(() => globalThis.__scorched.fx.lightsFlashed)).toBeGreaterThanOrEqual(1);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});
