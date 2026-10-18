import { expect, test } from '@playwright/test';
import { bootGame, readSlot } from './helpers.js';

// Records every distinct BOMB_PHASE value seen on an animation frame, in order, so a test does
// not depend on polling catching the 0.4 s launch window.
async function startPhaseRecorder(page) {
  await page.evaluate(() => {
    const seen = [];
    globalThis.__bombPhases = seen;
    const sample = () => {
      const { header, slots } = globalThis.__scorched;
      const phase = header[slots.BOMB_PHASE];
      if (seen.at(-1) !== phase) seen.push(phase);
      requestAnimationFrame(sample);
    };
    sample();
  });
}

const phasesSeen = (page) => page.evaluate(() => [...globalThis.__bombPhases]);

test('K launches a nuke: the phase goes LAUNCH, BLAST, NONE and the stock drops to 2', async ({
  page,
}) => {
  await bootGame(page, '?debug');
  expect(await readSlot(page, 'BOMBS')).toBe(3);
  expect(await readSlot(page, 'BOMB_PHASE')).toBe(0);
  await startPhaseRecorder(page);

  await page.keyboard.down('KeyK');
  await page.keyboard.up('KeyK');
  await expect.poll(() => phasesSeen(page), { timeout: 20_000 }).toEqual([0, 1, 2, 0]);
  expect(await readSlot(page, 'BOMBS')).toBe(2);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});

test('ShiftLeft is the second bomb key and counts the stock down again', async ({ page }) => {
  await bootGame(page, '?debug');
  await startPhaseRecorder(page);

  await page.keyboard.press('KeyK');
  await expect.poll(() => phasesSeen(page), { timeout: 20_000 }).toEqual([0, 1, 2, 0]);
  expect(await readSlot(page, 'BOMBS')).toBe(2);

  await page.keyboard.press('ShiftLeft');
  await expect.poll(() => phasesSeen(page), { timeout: 20_000 }).toEqual([0, 1, 2, 0, 1, 2, 0]);
  expect(await readSlot(page, 'BOMBS')).toBe(1);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});

test('the bomb header follows the missile and the blast centre', async ({ page }) => {
  await bootGame(page, '?debug');
  const shipY = await readSlot(page, 'SHIP_Y');
  await page.keyboard.press('KeyK');
  await expect.poll(() => readSlot(page, 'BOMB_PHASE'), { timeout: 20_000 }).toBe(2);
  expect(await readSlot(page, 'BOMB_Y')).toBeCloseTo(shipY - 110, 0);
  expect(await readSlot(page, 'BOMB_T')).toBeGreaterThanOrEqual(0);
  await expect.poll(() => readSlot(page, 'BOMB_PHASE'), { timeout: 20_000 }).toBe(0);
});

test('a bomb never touches the stress storm', async ({ page }) => {
  await bootGame(page, '?debug&stress=200');
  await startPhaseRecorder(page);
  await page.keyboard.press('KeyK');
  await expect.poll(() => phasesSeen(page), { timeout: 20_000 }).toEqual([0, 1, 2, 0]);
  expect(await readSlot(page, 'STORM_N')).toBe(200);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});

// VISL-02: the detonation is drawn. The production build runs under software GL, so the wait is
// generous: the timing is not under test.
test('a detonation is displayed as a fireball and costs no error', async ({ page }) => {
  await bootGame(page, '?debug');
  expect(await page.evaluate(() => globalThis.__scorched.fx.bombsShown)).toBe(0);
  await page.keyboard.press('KeyK');
  await expect
    .poll(() => page.evaluate(() => globalThis.__scorched.fx.bombsShown), { timeout: 20_000 })
    .toBeGreaterThanOrEqual(1);
  await expect.poll(() => readSlot(page, 'BOMB_PHASE'), { timeout: 20_000 }).toBe(0);
  expect(await page.evaluate(() => globalThis.__scorched.fx.bombsShown)).toBe(1);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});
