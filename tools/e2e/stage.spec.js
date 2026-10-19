import { expect, test } from '@playwright/test';
import { bootGame, readSlot } from './helpers.js';

// D-29 / D-30: the link opens on stage 1; the Phase 2 shooting gallery stays behind ?gallery. The
// production build runs under software GL, so the waits are generous: timing is not under test.
test.setTimeout(120_000);

test('the default game is stage 1: the flow runs, the distance grows and enemies arrive', async ({
  page,
}) => {
  await bootGame(page, '?debug', { stage: true });

  expect(await readSlot(page, 'STAGE')).toBe(1);
  expect(await readSlot(page, 'FLOW')).not.toBe(-1);

  const first = await readSlot(page, 'STAGE_DIST');
  await page.waitForTimeout(2_000);
  expect(await readSlot(page, 'STAGE_DIST')).toBeGreaterThan(first);

  await expect
    .poll(() => readSlot(page, 'ENEMY_N'), { timeout: 30_000, intervals: [250] })
    .toBeGreaterThanOrEqual(1);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});

test('?gallery brings back the shooting gallery: no flow and stage 0', async ({ page }) => {
  await bootGame(page, '?debug');

  expect(await readSlot(page, 'FLOW')).toBe(-1);
  expect(await readSlot(page, 'STAGE')).toBe(0);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});

// D-30: ?at= starts the stage just before a marker (AT_LEAD = 320 units); anything else is ignored.
test('?at=boss starts the stage just before the boss marker', async ({ page }) => {
  await bootGame(page, '?debug&at=boss', { stage: true });

  const boss = await page.evaluate(() => globalThis.__scorched.manifest.stage.markers.boss);
  const start = await readSlot(page, 'STAGE_DIST');
  expect(start).toBeGreaterThanOrEqual(boss - 320);
  expect(start).toBeLessThan(boss - 320 + 64);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});

test('an unknown ?at= value is ignored and the stage starts at the beginning', async ({ page }) => {
  await bootGame(page, '?debug&at=bogus', { stage: true });

  expect(await readSlot(page, 'STAGE_DIST')).toBeLessThan(200);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});

// D-34: the authored city layout ships once in the manifest as stride-6 placement records.
test('the manifest carries stage 1\'s expanded city layout', async ({ page }) => {
  await bootGame(page, '?debug', { stage: true });

  const city = await page.evaluate(() => {
    const { manifest } = globalThis.__scorched;
    return {
      length: manifest.stage.city.length,
      stride: manifest.stage.city_stride,
      pitch: manifest.stage.block_pitch,
      size: manifest.stage.block_size,
      maglev: manifest.scenery_kinds.MAGLEV,
      groundY0: manifest.tuning.ground_y0,
    };
  });
  expect(city.stride).toBe(6);
  expect(city.length).toBeGreaterThan(0);
  expect(city.length % city.stride).toBe(0);
  expect(city.pitch).toBe(80);
  expect(city.size).toBe(64);
  expect(city.maglev).toBe(4);
  expect(city.groundY0).toBe(-40);
});
