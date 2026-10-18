import { expect, test } from '@playwright/test';
import { bootGame, readSlot } from './helpers.js';

// SCOR-03 / D-18 / D-27: killing the bomber leads to a four-line bonus tally that counts up on screen and
// adds to the score, then a brief STAGE CLEAR, then stage 1 starts again with the score and lives kept. A level 5 laser held in the centre column (x 120) pierces the hull and both turrets. The
// production build runs under software GL, and other specs run beside this one, so the waits are
// generous: timing is not under test.

// Settle within 4 of the centre column (a key release lands a frame or two late).
async function steerToCentre(page) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const x = await readSlot(page, 'SHIP_X');
    if (Math.abs(x - 120) <= 4) break;
    const key = x > 120 ? 'ArrowLeft' : 'ArrowRight';
    await page.keyboard.down(key);
    await page.waitForFunction(
      ([dir]) => {
        const { header, slots } = globalThis.__scorched;
        const ship = header[slots.SHIP_X];
        return dir === 'ArrowLeft' ? ship <= 123 : ship >= 117;
      },
      [key],
      { polling: 'raf', timeout: 15_000 },
    );
    await page.keyboard.up(key);
    await page.waitForTimeout(100);
  }
  expect(Math.abs(await readSlot(page, 'SHIP_X') - 120)).toBeLessThanOrEqual(4);
}

const waitForFlow = (page, name, timeout) =>
  page.waitForFunction(
    ([state]) => {
      const { header, slots, manifest } = globalThis.__scorched;
      return header[slots.FLOW] === manifest.flow_states[state];
    },
    [name],
    { polling: 'raf', timeout },
  );

test('the boss kill leads to a counted-up tally, STAGE CLEAR, and a new loop with the score kept', async ({
  page,
}) => {
  test.setTimeout(300_000);
  await bootGame(page, '?debug&at=boss&weapon=laser&level=5', { stage: true });

  await waitForFlow(page, 'WARNING', 120_000);
  await steerToCentre(page);
  await waitForFlow(page, 'BOSS', 60_000);
  await page.keyboard.down('Space');

  // The kill: CLEAR first, with no tally on screen, then the tally.
  await waitForFlow(page, 'CLEAR', 150_000);
  await page.keyboard.up('Space');
  const scoreBefore = await readSlot(page, 'SCORE');
  await expect(page.locator('#tally')).toBeHidden();
  await waitForFlow(page, 'TALLY', 30_000);

  // The tally is state: all four amounts are in the header from its first frame.
  const amounts = await page.evaluate(() => {
    const { header, slots } = globalThis.__scorched;
    return [
      header[slots.TALLY_BOSS],
      header[slots.TALLY_MEDALS],
      header[slots.TALLY_NO_MISS],
      header[slots.TALLY_BOMBS],
    ];
  });
  expect(amounts[0]).toBe(100_000); // the bomber was shot down
  expect(amounts[2]).toBe(50_000); // the ship is a god: no ship was lost

  // The lines appear one by one and the panel shows all four rows at the end.
  await page.waitForFunction(() => globalThis.__scorched.header[globalThis.__scorched.slots.TALLY_N] >= 1, null, {
    polling: 'raf',
    timeout: 30_000,
  });
  await expect(page.locator('#tally')).toBeVisible();
  await page.waitForFunction(() => globalThis.__scorched.header[globalThis.__scorched.slots.TALLY_N] === 4, null, {
    polling: 'raf',
    timeout: 30_000,
  });
  await expect(page.locator('#tally .row:not([hidden])')).toHaveCount(4);
  await expect(page.locator('#tally-boss .amount')).toHaveText('100000', { timeout: 5_000 });

  // Every revealed line has been added to the score.
  const total = amounts.reduce((sum, amount) => sum + amount, 0);
  const scoreAfterTally = await readSlot(page, 'SCORE');
  expect(scoreAfterTally).toBe(scoreBefore + total);

  // STAGE CLEAR: the banner says so and the tally panel is gone.
  await waitForFlow(page, 'STAGE_CLEAR', 30_000);
  await page.waitForFunction(
    () => {
      const banner = document.getElementById('banner');
      return !banner.hidden && banner.textContent === 'STAGE CLEAR';
    },
    null,
    { polling: 'raf', timeout: 10_000 },
  );
  await expect(page.locator('#tally')).toBeHidden();
  // The tally may have paid an extra ship (the 200000 threshold), so the ships are counted here.
  const livesAtClear = await readSlot(page, 'LIVES');

  // The D-27 loop: back through the intro at the start of the stage, with everything kept.
  await waitForFlow(page, 'INTRO', 30_000);
  expect(await readSlot(page, 'STAGE_DIST')).toBeLessThan(100);
  expect(await readSlot(page, 'SCORE')).toBeGreaterThanOrEqual(scoreAfterTally);
  expect(await readSlot(page, 'LIVES')).toBe(livesAtClear);
  expect(await readSlot(page, 'TALLY_N')).toBe(0);
  await expect(page.locator('#banner')).toHaveText('STAGE 1');
  await expect(page.locator('#error-panel')).toHaveCount(0);
});
