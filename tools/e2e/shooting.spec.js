import { expect, test } from '@playwright/test';
import { bootGame, readSlot } from './helpers.js';

test('holding Space fires', async ({ page }) => {
  await bootGame(page, '?debug');
  expect(await readSlot(page, 'PBULLET_N')).toBe(0);
  await page.keyboard.down('Space');
  await page.waitForTimeout(1000);
  expect(await readSlot(page, 'PBULLET_N')).toBeGreaterThan(0);
  await page.keyboard.up('Space');
  // Bolts keep flying up and leave the screen after about 36 steps (0.6 s of simulation); the
  // wait is generous because a loaded software-GL runner steps slower than 60 Hz.
  await expect.poll(() => readSlot(page, 'PBULLET_N'), { timeout: 10_000 }).toBe(0);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});

test('drones appear and can be shot down', async ({ page }) => {
  await bootGame(page, '?debug');
  // The first drone appears after 40 simulation steps; on a loaded software-GL runner that
  // can take several wall-clock seconds, so the wait is generous (the timing is not under test).
  await expect.poll(() => readSlot(page, 'DRONE_N'), { timeout: 10_000 }).toBeGreaterThanOrEqual(1);

  // Hold fire and sweep the ship left and right until something goes down.
  await page.keyboard.down('Space');
  const deadline = Date.now() + 15_000;
  let key = 'ArrowLeft';
  while (Date.now() < deadline && (await readSlot(page, 'DRONES_DOWN')) < 1) {
    await page.keyboard.down(key);
    await page.waitForTimeout(600);
    await page.keyboard.up(key);
    key = key === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft';
  }
  await page.keyboard.up('Space');
  expect(await readSlot(page, 'DRONES_DOWN')).toBeGreaterThanOrEqual(1);
  // The kill's EXPLOSION event became GPU particles.
  expect(await page.evaluate(() => globalThis.__scorched.fx.particlesSpawned)).toBeGreaterThan(0);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});
