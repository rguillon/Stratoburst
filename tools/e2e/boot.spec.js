import { expect, test } from '@playwright/test';

// Boot-path specs: they drive the page by hand instead of through bootGame, because they
// assert what happens before and at the start gate.

const GATE_READY = '#loading[data-gate-ready="true"]';

test('loading shows progress then a start gate', async ({ page }) => {
  // Record every progress change from the first paint on, so a fast load cannot hide the bar.
  await page.addInitScript(() => {
    globalThis.__progressSeen = [];
    globalThis.__sawIndeterminate = false;
    document.addEventListener('DOMContentLoaded', () => {
      const bar = document.getElementById('progress');
      const record = () => {
        const now = bar.getAttribute('aria-valuenow');
        if (now !== null) globalThis.__progressSeen.push(Number(now));
        if (bar.classList.contains('indeterminate')) globalThis.__sawIndeterminate = true;
      };
      record();
      new MutationObserver(record).observe(bar, {
        attributes: true,
        attributeFilter: ['aria-valuenow', 'class'],
      });
    });
  });
  await page.goto('./?debug');

  // The static loading screen exists from first paint, before any module has run.
  await expect(page.locator('#progress')).toHaveAttribute('role', 'progressbar');
  await expect(page.locator('#loading-status')).not.toHaveText('');

  await page.locator(GATE_READY).waitFor({ timeout: 45_000 });
  const { seen, indeterminate } = await page.evaluate(() => ({
    seen: globalThis.__progressSeen,
    indeterminate: globalThis.__sawIndeterminate,
  }));
  const final = Number(await page.locator('#progress').getAttribute('aria-valuenow'));

  expect(seen.some((v) => v < 80) || indeterminate).toBe(true);
  expect(seen.some((v) => v >= 80) || indeterminate).toBe(true);
  expect(final).toBe(100);
  // The bar never goes backwards.
  expect(seen).toEqual([...seen].sort((a, b) => a - b));

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
