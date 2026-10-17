import { expect, test } from '@playwright/test';
import { bootGame, readSlot } from './helpers.js';

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

// Failure handling (PLAT-09). Software GL runs slowly, so waits are polls with a generous cap.
const PANEL_WAIT = { timeout: 30_000 };

test('?crash=py shows the error panel with the Python traceback and stops the loop', async ({ page }) => {
  await bootGame(page, '?debug&crash=py');

  const panel = page.locator('#error-panel');
  await expect(panel).toBeVisible(PANEL_WAIT);
  await expect(panel).toContainText('Injected Python fault');
  await expect(panel).toContainText('Traceback');
  await expect(panel).toContainText('tick 120');

  const t0 = await readSlot(page, 'TICK_COUNT');
  await page.waitForTimeout(500);
  const t1 = await readSlot(page, 'TICK_COUNT');
  expect(t1).toBe(t0);
  expect(t0).toBe(120);
});

test('?crash=js shows the error panel with the injected JS fault', async ({ page }) => {
  await bootGame(page, '?debug&crash=js');

  const panel = page.locator('#error-panel');
  await expect(panel).toBeVisible(PANEL_WAIT);
  await expect(panel).toContainText('Injected JS fault (?crash=js) at frame 120');
  const t0 = await readSlot(page, 'TICK_COUNT');
  await page.waitForTimeout(500);
  expect(await readSlot(page, 'TICK_COUNT')).toBe(t0);
});

test('an invalid ?crash value is ignored: no panel and the game keeps running', async ({ page }) => {
  await bootGame(page, '?debug&crash=bogus');
  await expect.poll(() => readSlot(page, 'TICK_COUNT'), PANEL_WAIT).toBeGreaterThan(130);

  await page.waitForTimeout(4_000);
  await expect(page.locator('#error-panel')).toHaveCount(0);
  const t0 = await readSlot(page, 'TICK_COUNT');
  await expect.poll(() => readSlot(page, 'TICK_COUNT'), PANEL_WAIT).toBeGreaterThan(t0);
});

test('the warm-up never trips the crash flag before the gate', async ({ page }) => {
  await page.goto('./?debug&crash=py');
  await page.locator(GATE_READY).waitFor({ timeout: 45_000 });
  await page.waitForTimeout(500);

  await expect(page.locator('#error-panel')).toHaveCount(0);
});

test('the error panel offers Copy report and Reload', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await bootGame(page, '?debug&crash=py');
  const panel = page.locator('#error-panel');
  await expect(panel).toBeVisible(PANEL_WAIT);

  const copy = panel.getByRole('button', { name: 'Copy report' });
  await expect(copy).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Reload' })).toBeVisible();

  await copy.click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain('Injected Python fault');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('pyodide: 314.0.7');
});

test('Reload on the error panel reloads the page back to the loading screen', async ({ page }) => {
  await bootGame(page, '?debug&crash=py');
  const panel = page.locator('#error-panel');
  await expect(panel).toBeVisible(PANEL_WAIT);

  await Promise.all([
    page.waitForNavigation(),
    panel.getByRole('button', { name: 'Reload' }).click(),
  ]);

  await expect(page.locator('#start-gate')).toBeAttached();
  await page.locator(GATE_READY).waitFor({ timeout: 45_000 });
  await expect(page.locator('#error-panel')).toHaveCount(0);
});

test('a blocked CDN ends on the error panel instead of a frozen loading screen', async ({ page }) => {
  await page.route('https://cdn.jsdelivr.net/**', (route) => route.abort());
  await page.goto('./?debug');

  const panel = page.locator('#error-panel');
  await expect(panel).toBeVisible({ timeout: 30_000 });
  await expect(panel.getByRole('button', { name: 'Reload' })).toBeVisible();
  await expect(page.locator('#start-gate')).toBeHidden();
});

test('losing the WebGL context pauses with a notice, restoring clears the notice', async ({ page }) => {
  await bootGame(page, '?debug');
  await expect.poll(() => readSlot(page, 'TICK_COUNT'), PANEL_WAIT).toBeGreaterThan(5);

  await page.evaluate(() => {
    const gl = document.getElementById('view').getContext('webgl2');
    globalThis.__lose = gl.getExtension('WEBGL_lose_context');
    globalThis.__lose.loseContext();
  });
  await expect(page.locator('#error-notice')).toBeVisible(PANEL_WAIT);
  await expect(page.locator('#error-notice')).toContainText('Graphics context lost');
  await expect.poll(() => page.evaluate(() => globalThis.__scorched.paused), PANEL_WAIT).toBe(true);
  await expect(page.locator('#error-panel')).toHaveCount(0);

  await page.evaluate(() => globalThis.__lose.restoreContext());
  await expect(page.locator('#error-notice')).toBeHidden(PANEL_WAIT);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});
