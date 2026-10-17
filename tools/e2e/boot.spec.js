import { expect, test } from '@playwright/test';

// Boot-path specs: they drive the page by hand instead of through bootGame, because they
// assert what happens before and at the start gate.

const GATE_READY = '#loading[data-gate-ready="true"]';

test('loading shows progress then a start gate', async ({ page }) => {
  await page.goto('./?debug', { waitUntil: 'commit' });

  // The static loading screen exists from first paint, before any module has run.
  await expect(page.locator('#progress')).toHaveAttribute('role', 'progressbar');
  await expect(page.locator('#loading-status')).not.toHaveText('');

  const seen = [];
  let indeterminate = false;
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    const state = await page.evaluate((gate) => {
      const bar = document.querySelector('#progress');
      return {
        now: bar?.getAttribute('aria-valuenow') ?? null,
        indeterminate: bar?.classList.contains('indeterminate') ?? false,
        ready: document.querySelector(gate) !== null,
      };
    }, GATE_READY);
    if (state.now !== null) seen.push(Number(state.now));
    indeterminate ||= state.indeterminate;
    if (state.ready) break;
    await page.waitForTimeout(50);
  }
  await page.locator(GATE_READY).waitFor({ timeout: 1_000 });
  const final = Number(await page.locator('#progress').getAttribute('aria-valuenow'));
  seen.push(final);

  expect(seen.some((v) => v < 80) || indeterminate).toBe(true);
  expect(seen.some((v) => v >= 80) || indeterminate).toBe(true);
  expect(final).toBe(100);

  const gate = page.locator('#start-gate');
  await expect(gate).toBeVisible();
  await expect(gate).toHaveText('TAP / CLICK TO START');
  expect(await page.evaluate(() => globalThis.__scorched?.started === true)).toBe(false);

  await gate.click();

  await page.waitForFunction(() => globalThis.__scorched?.started === true, null, { timeout: 15_000 });
  await expect(page.locator('#loading')).toBeHidden();
  await expect
    .poll(() => page.evaluate(() => globalThis.__scorched.audioState), { timeout: 5_000 })
    .toBe('running');
  const t0 = await page.evaluate(() => {
    const { header, slots } = globalThis.__scorched;
    return header[slots.TICK_COUNT];
  });
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const { header, slots } = globalThis.__scorched;
          return header[slots.TICK_COUNT];
        }),
      { timeout: 15_000 },
    )
    .toBeGreaterThan(t0);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});

test('the game does not run before the gate is used', async ({ page }) => {
  await page.goto('./?debug');
  await page.locator(GATE_READY).waitFor({ timeout: 45_000 });
  await page.waitForTimeout(500);

  expect(await page.evaluate(() => globalThis.__scorched?.ready === true)).toBe(false);
  expect(await page.evaluate(() => globalThis.__scorched?.started === true)).toBe(false);
});

test('pressing Enter also starts the game', async ({ page }) => {
  await page.goto('./?debug');
  await page.locator(GATE_READY).waitFor({ timeout: 45_000 });

  await page.keyboard.press('Enter');

  await page.waitForFunction(() => globalThis.__scorched?.ready === true, null, { timeout: 15_000 });
  await expect(page.locator('#loading')).toBeHidden();
});
