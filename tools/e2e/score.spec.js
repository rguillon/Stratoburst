import { expect, test } from '@playwright/test';
import { bootGame, readSlot } from './helpers.js';

// Shooting down enemies pays points (SCOR-01): the SCORE slot rises and the HUD along the top shows it.
test('kills raise SCORE and the HUD score and high score match the header', async ({ page }) => {
  test.setTimeout(120_000);
  await bootGame(page, '?debug&weapon=vulcan&level=5', { stage: true });
  expect(await readSlot(page, 'SCORE')).toBe(0);
  await expect(page.locator('#status-readout .score')).toHaveText('0');

  // Hold fire and sweep left and right until something is shot down.
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
  expect(score).toBeGreaterThan(0);

  // Let the HUD catch up with the header, then compare the two.
  await expect
    .poll(async () => {
      const { shown, header } = await page.evaluate(() => {
        const { header, slots } = globalThis.__scorched;
        return {
          shown: document.querySelector('#status-readout .score').textContent,
          header: header[slots.SCORE],
        };
      });
      return shown === String(header);
    })
    .toBe(true);
  const high = await readSlot(page, 'HIGH_SCORE');
  expect(high).toBeGreaterThanOrEqual(score);
  await expect(page.locator('#status-readout .hiscore')).toHaveText(String(high));
  await expect(page.locator('#error-panel')).toHaveCount(0);
});
