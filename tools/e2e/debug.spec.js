import { expect, test } from '@playwright/test';
import { bootGame } from './helpers.js';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test('?debug shows a live overlay and Copy report yields the device report', async ({ page }) => {
  await bootGame(page, '?debug&stress=500');
  await page.waitForTimeout(1500);

  const overlay = page.locator('#debug-overlay');
  await expect(overlay).toBeVisible();
  const build = await page.evaluate(() => globalThis.__scorched.build);
  expect(build).toBeTruthy();
  const text = await overlay.textContent();
  for (const needle of ['fps', 'tick', 'tier', build]) expect(text).toContain(needle);

  await expect(page.locator('#copy-report')).toHaveCount(1);
  await page.locator('#copy-report').click();
  await expect
    .poll(async () => {
      const area = page.locator('#report-text');
      if (await area.count()) return area.inputValue();
      return page.evaluate(() => navigator.clipboard.readText());
    })
    .toContain('pyodide: 314.0.7');
  await expect(page.locator('#error-panel')).toHaveCount(0);
});

test('without ?debug there is no overlay and no report button', async ({ page }) => {
  await page.goto('./');
  await page.locator('canvas#view').waitFor({ timeout: 10_000 });
  await page.waitForTimeout(1500);
  await expect(page.locator('#debug-overlay')).toHaveCount(0);
  await expect(page.locator('#copy-report')).toHaveCount(0);
});
