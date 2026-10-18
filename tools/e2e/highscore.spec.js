import { expect, test } from '@playwright/test';
import { bootGame, readSlot } from './helpers.js';

const WAIT = { timeout: 15_000 };

const isPaused = (page) =>
  page.evaluate(() => {
    const { header, slots, manifest } = globalThis.__scorched;
    return (header[slots.FLAGS] & manifest.flags.PAUSED) !== 0;
  });

// Hold fire and sweep left and right until something is shot down; returns the SCORE read.
async function scoreSomething(page) {
  await page.keyboard.down('Space');
  const deadline = Date.now() + 40_000;
  let score = 0;
  let key = 'ArrowLeft';
  while (score === 0 && Date.now() < deadline) {
    await page.keyboard.down(key);
    await page.waitForTimeout(700);
    await page.keyboard.up(key);
    key = key === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft';
    score = await readSlot(page, 'SCORE');
  }
  await page.keyboard.up('Space');
  return score;
}

// A flag-free run (no god, no gallery): the best score is kept in the browser (D-22).
test('the best score of a flag-free run survives a reload', async ({ page }) => {
  test.setTimeout(150_000);
  await bootGame(page, '?debug', { mortal: true, stage: true });
  expect(await readSlot(page, 'HIGH_SCORE')).toBe(0);
  const score = await scoreSomething(page);
  expect(score).toBeGreaterThan(0);

  // Pausing is a natural flush point: the best is written there.
  await page.keyboard.press('Escape');
  await expect.poll(() => isPaused(page), WAIT).toBe(true);

  await bootGame(page, '?debug', { mortal: true, stage: true });
  expect(await readSlot(page, 'HIGH_SCORE')).toBeGreaterThanOrEqual(score);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});
