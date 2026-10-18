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
