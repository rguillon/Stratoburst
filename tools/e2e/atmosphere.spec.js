import { expect, test } from '@playwright/test';
import { bootGame } from './helpers.js';

// D-32 / D-36 / STGE-03: the rain-soaked atmosphere follows the quality tier. The production build
// runs under software GL, so the waits are generous: timing is not under test.
const hook = (page, name) => page.evaluate((key) => globalThis.__scorched.fx[key], name);

for (const [tier, rainCount] of [
  ['high', 600],
  ['mid', 300],
  ['low', 0],
]) {
  test(`?tier=${tier} draws ${rainCount} rain streaks on a stage boot`, async ({ page }) => {
    test.setTimeout(120_000);
    await bootGame(page, `?debug&tier=${tier}`, { stage: true });
    await expect.poll(() => hook(page, 'rainCount'), { timeout: 15_000 }).toBe(rainCount);
    await expect(page.locator('#error-panel')).toHaveCount(0);
  });
}

// D-33 / D-36: burning ruins send up plumes at the high tier through the GPU particle layers and
// the low tier sheds them. The first burning lot of stage 1 is a few dozen units into the scroll.
test('?tier=high: burning ruins send up plumes within 20 s of a stage boot', async ({ page }) => {
  test.setTimeout(120_000);
  await bootGame(page, '?debug&tier=high', { stage: true });
  await expect.poll(() => hook(page, 'plumes'), { timeout: 20_000 }).toBeGreaterThan(0);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});

test('?tier=low: no plume is ever emitted', async ({ page }) => {
  test.setTimeout(120_000);
  await bootGame(page, '?debug&tier=low', { stage: true });
  // Long enough for fires to have been in view at the other tier; the count must still be 0.
  await page.waitForTimeout(8_000);
  expect(await hook(page, 'plumes')).toBe(0);
  expect(await hook(page, 'rainCount')).toBe(0);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});
