import { expect, test } from '@playwright/test';
import { bootGame, readSlot } from './helpers.js';

test('a kill is heard: the SFX event plays a synthesized buffer on the unlocked AudioContext', async ({
  page,
}) => {
  await bootGame(page, '?debug&weapon=vulcan&level=5');
  await expect
    .poll(() => page.evaluate(() => globalThis.__scorched.audioState), { timeout: 5_000 })
    .toBe('running');
  expect(await page.evaluate(() => globalThis.__scorched.sfx.played)).toBe(0);

  // Hold fire and sweep the ship left and right until something goes down.
  await page.keyboard.down('Space');
  const deadline = Date.now() + 25_000;
  let key = 'ArrowLeft';
  while (Date.now() < deadline && (await readSlot(page, 'KILLS')) < 1) {
    await page.keyboard.down(key);
    await page.waitForTimeout(600);
    await page.keyboard.up(key);
    key = key === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft';
  }
  await page.keyboard.up('Space');

  expect(await readSlot(page, 'KILLS')).toBeGreaterThanOrEqual(1);
  expect(await page.evaluate(() => globalThis.__scorched.sfx.played)).toBeGreaterThanOrEqual(1);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});
