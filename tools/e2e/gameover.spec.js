import { expect, test } from '@playwright/test';
import { bootGame, readSlot } from './helpers.js';

// D-28: losing the last ship ends the run on a minimal GAME OVER screen with the final score, and a
// fire key starts a fresh stage 1. ?lives=1 makes one death enough; the ship stays idle until the
// stage's enemy fire finds it, so reaching GAME_OVER can take a while.
test.setTimeout(240_000);

const GAME_OVER = (page) =>
  page.evaluate(() => {
    const { header, slots, manifest } = globalThis.__scorched;
    return header[slots.FLOW] === manifest.flow_states.GAME_OVER;
  });

async function reachGameOver(page) {
  await bootGame(page, '?debug&lives=1', { mortal: true, stage: true });
  await expect.poll(() => GAME_OVER(page), { timeout: 180_000, intervals: [250] }).toBe(true);
}

test('the last ship lost shows GAME OVER with the score, and a key press starts a fresh stage 1', async ({
  page,
}) => {
  await reachGameOver(page);
  await expect(page.locator('#game-over')).toBeVisible();
  const score = await readSlot(page, 'SCORE');
  await expect(page.locator('#game-over .final')).toHaveText(String(score));
  await expect(page.locator('#game-over .best')).toHaveText(String(await readSlot(page, 'HIGH_SCORE')));
  // A press inside the first 800 ms is ignored, so wait it out before the press that counts.
  await page.waitForTimeout(1000);
  await page.keyboard.press('Space');
  await expect.poll(() => GAME_OVER(page), { timeout: 10_000, intervals: [100] }).toBe(false);
  expect(await readSlot(page, 'LIVES')).toBe(1);
  expect(await readSlot(page, 'SCORE')).toBe(0);
  await expect(page.locator('#game-over')).toBeHidden();
  await expect(page.locator('#error-panel')).toHaveCount(0);
});
