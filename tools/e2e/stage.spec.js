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
