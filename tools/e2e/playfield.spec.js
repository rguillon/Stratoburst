import { expect, test } from '@playwright/test';
import { bootGame } from './helpers.js';

const VIEWPORTS = [
  { name: 'portrait phone', width: 390, height: 844 },
  { name: 'landscape phone', width: 844, height: 390 },
  { name: 'desktop', width: 1280, height: 720 },
];

for (const { name, width, height } of VIEWPORTS) {
  test(`the whole playfield is visible and fitted at ${width}x${height} (${name})`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await bootGame(page, '?debug');

    const corners = await page.evaluate(() => globalThis.__scorched.projectPlayfield());
    expect(corners).toHaveLength(4);
    for (const c of corners) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x).toBeLessThanOrEqual(width);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeLessThanOrEqual(height);
    }

    const xs = corners.map((c) => c.x);
    const ys = corners.map((c) => c.y);
    const fillX = (Math.max(...xs) - Math.min(...xs)) / width;
    const fillY = (Math.max(...ys) - Math.min(...ys)) / height;
    expect(Math.max(fillX, fillY)).toBeGreaterThanOrEqual(0.85);

    const size = await page.evaluate(() => {
      const canvas = document.getElementById('view');
      return { w: canvas.clientWidth, h: canvas.clientHeight };
    });
    expect(size).toEqual({ w: width, h: height });
    await expect(page.locator('#error-panel')).toHaveCount(0);
  });
}

// One simulation step in milliseconds, and the fixed-step runner's catch-up cap (MAX_STEPS).
const STEP_MS = 1000 / 60;
const MAX_STEPS = 3;

test('python-driven terrain scroll advances 0.8 units per 60 Hz step', async ({ page }) => {
  // The low tier keeps software-GL frames short; tiers are presentation-only, so scroll is
  // unaffected.
  await bootGame(page, '?debug&tier=low');
  await page.waitForTimeout(1500);

  // Frame-by-frame record instead of a wall-clock window. The probe is registered after the
  // game's own rAF callback, so within a frame it runs second and sees that frame's header
  // (browsers run rAF callbacks in registration order). It records the same rAF delta the
  // game fed to Python together with the steps Python then ran.
  const frames = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const { header, slots } = globalThis.__scorched;
        const out = [];
        let last = null;
        let first = null;
        const probe = (ts) => {
          if (first === null) first = ts;
          if (last !== null) {
            out.push({
              dt: ts - last,
              steps: header[slots.STEPS],
              scroll: header[slots.SCROLL_Y],
              ticks: header[slots.TICK_COUNT],
            });
          }
          last = ts;
          if (ts - first < 2000) requestAnimationFrame(probe);
          else resolve(out);
        };
        requestAnimationFrame(probe);
      }),
  );
  expect(frames.length).toBeGreaterThan(5);

  // Exactly SCROLL_SPEED per simulation step, however many steps ran.
  const scroll = frames.at(-1).scroll - frames[0].scroll;
  const ticks = frames.at(-1).ticks - frames[0].ticks;
  expect(ticks).toBeGreaterThan(0);
  expect(scroll).toBeCloseTo(ticks * 0.8, 1);

  // Sim progress per frame, independent of how fast this machine renders: a frame owes
  // floor(dt / step) steps, capped at MAX_STEPS (the catch-up cap, by design, slows the game
  // down instead of spiralling). One step of slack covers the accumulator remainder and
  // vsync snapping. Slow software GL cannot fail this; a stalled or runaway sim does.
  for (const { dt, steps } of frames) {
    expect(steps).toBeGreaterThanOrEqual(Math.min(MAX_STEPS, Math.floor(dt / STEP_MS)) - 1);
    expect(steps).toBeLessThanOrEqual(Math.min(MAX_STEPS, Math.ceil(dt / STEP_MS) + 1));
  }

  // When this machine renders fast enough that the cap never engages (every frame under 45 ms),
  // the original wall-clock property is meaningful again: the sim keeps real time at 60 Hz.
  // The summed steps follow the summed frame time, to within 3% and the accumulator remainder.
  const capEngaged = frames.some(({ dt }) => dt > 45);
  test.info().annotations.push({
    type: 'sim-rate-check',
    description: capEngaged ? 'per-frame only (catch-up cap engaged)' : 'per-frame and real-time rate',
  });
  if (!capEngaged) {
    const elapsedMs = frames.reduce((sum, { dt }) => sum + dt, 0);
    const owed = elapsedMs / STEP_MS;
    const stepsRun = frames.reduce((sum, { steps }) => sum + steps, 0);
    expect(Math.abs(stepsRun - owed)).toBeLessThanOrEqual(owed * 0.03 + 3);
  }
  await expect(page.locator('#error-panel')).toHaveCount(0);
});
