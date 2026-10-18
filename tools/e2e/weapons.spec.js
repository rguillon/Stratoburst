import { expect, test } from '@playwright/test';
import { bootGame, readSlot } from './helpers.js';

test('?weapon=vulcan&level=5 starts with a seven-stream fan and a VULCAN Lv 5 readout', async ({
  page,
}) => {
  await bootGame(page, '?debug&weapon=vulcan&level=5');
  expect(await readSlot(page, 'WEAPON')).toBe(0);
  expect(await readSlot(page, 'LEVEL')).toBe(5);
  const readout = page.locator('#status-readout');
  await expect(readout).toBeVisible();
  await expect(readout).toContainText('VULCAN');
  await expect(readout).toContainText('Lv 5');

  await page.keyboard.down('Space');
  await expect
    .poll(() => page.evaluate(() => globalThis.__scorched.header[globalThis.__scorched.slots.PBULLET_N]), {
      timeout: 10_000,
    })
    .toBeGreaterThanOrEqual(7);
  await page.keyboard.up('Space');
  await expect(page.locator('#error-panel')).toHaveCount(0);
});

test('?weapon=laser&level=3 starts as a level 3 laser', async ({ page }) => {
  await bootGame(page, '?debug&weapon=laser&level=3');
  expect(await readSlot(page, 'WEAPON')).toBe(1);
  expect(await readSlot(page, 'LEVEL')).toBe(3);
  const readout = page.locator('#status-readout');
  await expect(readout).toContainText('LASER');
  await expect(readout).toContainText('Lv 3');
  await expect(page.locator('#error-panel')).toHaveCount(0);
});

test('?weapon=plasma&level=99 falls back to a level 5 vulcan', async ({ page }) => {
  await bootGame(page, '?debug&weapon=plasma&level=99');
  expect(await readSlot(page, 'WEAPON')).toBe(0);
  expect(await readSlot(page, 'LEVEL')).toBe(5);
  await expect(page.locator('#status-readout')).toContainText('VULCAN');
  await expect(page.locator('#error-panel')).toHaveCount(0);
});

test('without flags the readout shows VULCAN Lv 1', async ({ page }) => {
  await bootGame(page, '?debug');
  await expect(page.locator('#status-readout')).toContainText('VULCAN');
  await expect(page.locator('#status-readout')).toContainText('Lv 1');
});

test('holding fire with the level 3 laser opens a half-width 4 beam and releasing closes it', async ({
  page,
}) => {
  await bootGame(page, '?debug&weapon=laser&level=3');
  expect(await readSlot(page, 'BEAM_W')).toBe(0);
  expect(await page.evaluate(() => globalThis.__scorched.fx.beamVisible)).toBe(false);

  await page.keyboard.down('Space');
  await expect.poll(() => readSlot(page, 'BEAM_W'), { timeout: 10_000 }).toBe(4);
  await expect
    .poll(() => page.evaluate(() => globalThis.__scorched.fx.beamVisible), { timeout: 10_000 })
    .toBe(true);
  // A beam is not made of bullets.
  expect(await readSlot(page, 'PBULLET_N')).toBe(0);

  await page.keyboard.up('Space');
  await expect.poll(() => readSlot(page, 'BEAM_W'), { timeout: 10_000 }).toBe(0);
  await expect
    .poll(() => page.evaluate(() => globalThis.__scorched.fx.beamVisible), { timeout: 10_000 })
    .toBe(false);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});

test('holding fire with the level 5 homing weapon launches missiles that are drawn with trails', async ({
  page,
}) => {
  await bootGame(page, '?debug&weapon=homing&level=5');
  expect(await readSlot(page, 'WEAPON')).toBe(2);
  expect(await page.evaluate(() => globalThis.__scorched.fx.missilesDrawn)).toBe(0);

  const particlesBefore = await page.evaluate(() => globalThis.__scorched.fx.particlesSpawned);
  await page.keyboard.down('Space');
  await expect.poll(() => readSlot(page, 'MISSILE_N'), { timeout: 3_000 }).toBeGreaterThan(0);
  await expect
    .poll(() => page.evaluate(() => globalThis.__scorched.fx.missilesDrawn), { timeout: 3_000 })
    .toBeGreaterThan(0);
  // Each live missile leaves an exhaust trail through the particle layers.
  await expect
    .poll(() => page.evaluate(() => globalThis.__scorched.fx.particlesSpawned), { timeout: 3_000 })
    .toBeGreaterThan(particlesBefore);
  await page.keyboard.up('Space');
  await expect(page.locator('#error-panel')).toHaveCount(0);
});

test('a carrier shot down drops a crystal that is drawn', async ({ page }) => {
  test.setTimeout(90_000);
  await bootGame(page, '?debug');
  expect(await page.evaluate(() => globalThis.__scorched.fx.pickupsDrawn)).toBe(0);

  // Hold fire and sweep the ship left and right until a carrier goes down and drops a crystal.
  await page.keyboard.down('Space');
  const deadline = Date.now() + 70_000;
  let key = 'ArrowLeft';
  while (Date.now() < deadline && (await readSlot(page, 'PICKUP_N')) < 1) {
    await page.keyboard.down(key);
    await page.waitForTimeout(600);
    await page.keyboard.up(key);
    key = key === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft';
  }
  await page.keyboard.up('Space');
  expect(await readSlot(page, 'PICKUP_N')).toBeGreaterThanOrEqual(1);
  // The crystal is on screen: one gem instance per live pickup.
  await expect
    .poll(() => page.evaluate(() => globalThis.__scorched.fx.pickupsDrawn), { timeout: 3_000 })
    .toBeGreaterThanOrEqual(1);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});
