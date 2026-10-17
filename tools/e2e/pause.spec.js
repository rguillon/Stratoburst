import { expect, test } from '@playwright/test';
import { bootGame, readSlot } from './helpers.js';

const isPaused = (page) =>
  page.evaluate(() => {
    const { header, slots, manifest } = globalThis.__scorched;
    return (header[slots.FLAGS] & manifest.flags.PAUSED) !== 0;
  });

// Software GL steps slowly, so waits are polls rather than fixed sleeps.
const WAIT = { timeout: 15_000 };

async function setVisibility(page, state) {
  await page.evaluate((value) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => value === 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  }, state);
}

test('hiding the page pauses: the flag is set, the overlay shows and no step runs', async ({ page }) => {
  await bootGame(page, '?debug');
  await expect.poll(() => readSlot(page, 'TICK_COUNT'), WAIT).toBeGreaterThan(5);
  expect(await isPaused(page)).toBe(false);
  await expect(page.locator('#paused')).toBeHidden();

  await setVisibility(page, 'hidden');
  await expect.poll(() => isPaused(page), WAIT).toBe(true);
  await expect(page.locator('#paused')).toBeVisible();
  const frozen = await readSlot(page, 'TICK_COUNT');
  await page.waitForTimeout(1000);
  expect(await readSlot(page, 'TICK_COUNT')).toBe(frozen);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});

test('coming back stays paused until a tap, then resumes without a catch-up burst', async ({
  page,
}) => {
  await bootGame(page, '?debug');
  await expect.poll(() => readSlot(page, 'TICK_COUNT'), WAIT).toBeGreaterThan(5);
  await setVisibility(page, 'hidden');
  await expect.poll(() => isPaused(page), WAIT).toBe(true);
  await page.waitForTimeout(1500); // time away: the old clock would owe a huge backlog
  await setVisibility(page, 'visible');
  await page.waitForTimeout(300);
  expect(await isPaused(page)).toBe(true);
  await expect(page.locator('#paused')).toBeVisible();

  const before = await readSlot(page, 'TICK_COUNT');
  await page.locator('#paused').click();
  await expect.poll(() => isPaused(page), WAIT).toBe(false);
  await expect(page.locator('#paused')).toBeHidden();
  await page.waitForTimeout(300);
  const after = await readSlot(page, 'TICK_COUNT');
  expect(after - before).toBeLessThanOrEqual(0.3 * 60 + 3);
  await expect.poll(() => readSlot(page, 'TICK_COUNT'), WAIT).toBeGreaterThan(after);
});

test('a key press resumes too', async ({ page }) => {
  await bootGame(page, '?debug');
  await page.evaluate(() => globalThis.dispatchEvent(new Event('blur')));
  await expect.poll(() => isPaused(page), WAIT).toBe(true);
  await page.keyboard.press('Space');
  await expect.poll(() => isPaused(page), WAIT).toBe(false);
});

test('losing focus pauses and clears held keys so none is stuck on return', async ({ page }) => {
  await bootGame(page, '?debug');
  await page.keyboard.down('ArrowLeft');
  await page.evaluate(() => globalThis.dispatchEvent(new Event('blur')));
  await expect.poll(() => isPaused(page), WAIT).toBe(true);
  await page.keyboard.up('ArrowLeft'); // the keyup would be lost while away; clearing covers it
  await page.locator('#paused').click();
  await expect.poll(() => isPaused(page), WAIT).toBe(false);
  const x0 = await readSlot(page, 'SHIP_X');
  await page.waitForTimeout(500);
  expect(await readSlot(page, 'SHIP_X')).toBe(x0);
});

test('Escape toggles pause through Python and shows the overlay', async ({ page }) => {
  await bootGame(page, '?debug');
  await page.keyboard.press('Escape');
  await expect.poll(() => isPaused(page), WAIT).toBe(true);
  await expect(page.locator('#paused')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect.poll(() => isPaused(page), WAIT).toBe(false);
  await expect(page.locator('#paused')).toBeHidden();
  await expect(page.locator('#error-panel')).toHaveCount(0);
});

test('the debug hook reports the paused state', async ({ page }) => {
  await bootGame(page, '?debug');
  expect(await page.evaluate(() => globalThis.__scorched.paused)).toBe(false);
  await page.keyboard.press('KeyP');
  await expect.poll(() => page.evaluate(() => globalThis.__scorched.paused), WAIT).toBe(true);
});
