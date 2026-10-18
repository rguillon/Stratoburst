import { expect, test } from '@playwright/test';
import { bootGame, readSlot } from './helpers.js';

// Enemy bullets are drawn after bloom. The composer path puts a bullet pass between bloom and
// output; the low tier has no composer and draws the bullet scene directly over the main one.

test('tier high draws enemy bullets in a pass between bloom and output', async ({ page }) => {
  await bootGame(page, '?debug&stress=500&tier=high');
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => globalThis.__scorched.passes)).toEqual([
    'scene',
    'bloom',
    'bullets',
    'output',
  ]);
  expect(await page.evaluate(() => globalThis.__scorched.bulletPath)).toBe('composer');
  expect(await readSlot(page, 'EBULLET_N')).toBeGreaterThanOrEqual(500);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});

test('tier low draws enemy bullets directly after the main scene', async ({ page }) => {
  await bootGame(page, '?debug&stress=500&tier=low');
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => globalThis.__scorched.bulletPath)).toBe('direct');
  expect(await readSlot(page, 'EBULLET_N')).toBeGreaterThanOrEqual(500);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});

// VISL-02: a MEDIUM or LARGE kill flashes one of the pooled explosion lights. The production build
// runs under software GL, so the wait is generous: the timing is not under test.
test('a heavy kill flashes a pooled explosion light', async ({ page }) => {
  test.setTimeout(120_000);
  await bootGame(page, '?debug&weapon=vulcan&level=5&tier=high');
  const flashed = () => page.evaluate(() => globalThis.__scorched.fx.lightsFlashed);
  // Hold fire with the wide fan and sweep left and right until a carrier, helicopter, tank or
  // turret goes down.
  await page.keyboard.down('Space');
  const deadline = Date.now() + 40_000;
  let key = 'ArrowLeft';
  while (Date.now() < deadline && (await flashed()) < 1) {
    await page.keyboard.down(key);
    await page.waitForTimeout(600);
    await page.keyboard.up(key);
    key = key === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft';
  }
  await page.keyboard.up('Space');
  expect(await flashed()).toBeGreaterThanOrEqual(1);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});

// VISL-06: every aircraft casts a blob shadow, the player's ship included, so a running game
// always draws at least the ship's.
test('the ship casts a shadow on the terrain', async ({ page }) => {
  await bootGame(page, '?debug&tier=high');
  await expect
    .poll(() => page.evaluate(() => globalThis.__scorched.fx.shadows), { timeout: 10_000 })
    .toBeGreaterThanOrEqual(1);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});
