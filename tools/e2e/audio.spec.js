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

const sfx = (page, name) => page.evaluate((key) => globalThis.__scorched.sfx[key], name);

test('the laser hums only while it fires: holding fire starts the loop and releasing stops it', async ({
  page,
}) => {
  await bootGame(page, '?debug&weapon=laser');
  await expect
    .poll(() => page.evaluate(() => globalThis.__scorched.audioState), { timeout: 5_000 })
    .toBe('running');
  expect(await sfx(page, 'laser')).toBe(false);

  await page.keyboard.down('Space');
  await expect.poll(() => sfx(page, 'laser'), { timeout: 15_000 }).toBe(true);
  await page.keyboard.up('Space');
  await expect.poll(() => sfx(page, 'laser'), { timeout: 15_000 }).toBe(false);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});

test('pausing mutes the whole game and silences the laser; resuming brings the sound back', async ({
  page,
}) => {
  await bootGame(page, '?debug&weapon=laser');
  expect(await sfx(page, 'muted')).toBe(false);

  await page.keyboard.down('Space');
  await expect.poll(() => sfx(page, 'laser'), { timeout: 15_000 }).toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(() => sfx(page, 'muted'), { timeout: 15_000 }).toBe(true);
  expect(await sfx(page, 'laser')).toBe(false);

  await page.keyboard.press('Escape');
  await expect.poll(() => sfx(page, 'muted'), { timeout: 15_000 }).toBe(false);
  // Pausing drops the held keys, so fire again: the hum returns once the sound is unmuted.
  await page.keyboard.up('Space');
  await page.keyboard.down('Space');
  await expect.poll(() => sfx(page, 'laser'), { timeout: 15_000 }).toBe(true);
  await page.keyboard.up('Space');
  await expect(page.locator('#error-panel')).toHaveCount(0);
});
