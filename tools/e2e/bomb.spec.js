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

// VISL-04, D-26, D-27: the detonation freezes the simulation for a few steps (Python's hitstop, header
// slot HITSTOP) and shakes the camera (render-only). Both are counted by debug hooks, so a frame-rate
// dependent poll cannot miss them: a frame is counted whenever it drew with HITSTOP above zero.
test('a detonation shakes the screen and freezes the action for a few frames', async ({ page }) => {
  await bootGame(page, '?debug');
  const fx = () => page.evaluate(() => ({ ...globalThis.__scorched.fx }));
  expect(await fx()).toMatchObject({ shakes: 0, hitstopFrames: 0 });
  await page.keyboard.press('KeyK');
  await expect.poll(async () => (await fx()).shakes, { timeout: 20_000 }).toBeGreaterThanOrEqual(1);
  expect((await fx()).hitstopFrames).toBeGreaterThanOrEqual(1);
  // The freeze is short: the simulation is running again well before the blast ends.
  await expect.poll(() => readSlot(page, 'HITSTOP'), { timeout: 20_000 }).toBe(0);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});

// PLYR-09, D-19: an AA turret drops an amber bomb pickup. The sweep holds the Lv5 vulcan fan until a
// turret dies; a page-side recorder notes every frame that a bomb pickup was live, so catching it
// (the ship sweeps through it) cannot hide it from the poll. The production build runs under
// software GL, so the wait is generous.
test('a shot-down AA turret drops a bomb pickup', async ({ page }) => {
  test.setTimeout(150_000);
  await bootGame(page, '?debug&weapon=vulcan&level=5&tier=low');
  await page.evaluate(() => {
    globalThis.__bombPickupSeen = 0;
    globalThis.__pickupNSeen = 0;
    const sample = () => {
      const s = globalThis.__scorched;
      globalThis.__bombPickupSeen = Math.max(globalThis.__bombPickupSeen, s.fx.bombPickups);
      globalThis.__pickupNSeen = Math.max(globalThis.__pickupNSeen, s.header[s.slots.PICKUP_N]);
      requestAnimationFrame(sample);
    };
    sample();
  });
  const seen = () => page.evaluate(() => globalThis.__bombPickupSeen);
  await page.keyboard.down('Space');
  const deadline = Date.now() + 60_000;
  let key = 'ArrowLeft';
  while (Date.now() < deadline && (await seen()) < 1) {
    await page.keyboard.down(key);
    await page.waitForTimeout(600);
    await page.keyboard.up(key);
    key = key === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft';
  }
  await page.keyboard.up('Space');
  expect(await seen()).toBeGreaterThanOrEqual(1);
  expect(await page.evaluate(() => globalThis.__pickupNSeen)).toBeGreaterThanOrEqual(1);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});

// PLYR-09, PLYR-07: the stock is on screen as one amber pip per bomb, and ?bombs sets it.
test('?bombs=7 starts with seven bombs shown as seven pips', async ({ page }) => {
  await bootGame(page, '?debug&bombs=7');
  expect(await readSlot(page, 'BOMBS')).toBe(7);
  await expect(page.locator('#status-readout .bombs')).toHaveText('●'.repeat(7));
  await expect(page.locator('#error-panel')).toHaveCount(0);
});

test('the pips follow the stock down as bombs are spent', async ({ page }) => {
  await bootGame(page, '?debug');
  await expect(page.locator('#status-readout .bombs')).toHaveText('●'.repeat(3));
  await page.keyboard.press('KeyK');
  await expect(page.locator('#status-readout .bombs')).toHaveText('●'.repeat(2), {
    timeout: 20_000,
  });
  await expect(page.locator('#error-panel')).toHaveCount(0);
});

test('?bombs=0 starts empty: no pips, and K launches nothing', async ({ page }) => {
  await bootGame(page, '?debug&bombs=0');
  expect(await readSlot(page, 'BOMBS')).toBe(0);
  await expect(page.locator('#status-readout .bombs')).toHaveText('');
  await page.keyboard.press('KeyK');
  await page.waitForTimeout(500);
  expect(await readSlot(page, 'BOMB_PHASE')).toBe(0);
  expect(await readSlot(page, 'BOMBS')).toBe(0);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});

test('an out-of-range ?bombs is clamped to the stock cap', async ({ page }) => {
  await bootGame(page, '?debug&bombs=99');
  expect(await readSlot(page, 'BOMBS')).toBe(7);
  await expect(page.locator('#status-readout .bombs')).toHaveText('●'.repeat(7));
});
