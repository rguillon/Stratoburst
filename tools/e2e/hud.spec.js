import { expect, test } from '@playwright/test';
import { bootGame } from './helpers.js';

// The HUD frames the playfield like an arcade cabinet (D-23) and never hides under the thumb: lives and
// bombs at the bottom-left corner, weapon and level at the bottom-right, score along the top, and on a
// phone the weapon block moves above the touch bomb button when the button overlays its corner.

const box = (page, selector) =>
  page.evaluate((sel) => {
    const r = document.querySelector(sel).getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  }, selector);

const intersects = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

const bombRect = async (page) => {
  const r = await page.evaluate(() => globalThis.__scorched.bombButton.rect);
  return { left: r.left, top: r.top, right: r.left + r.width, bottom: r.top + r.height };
};

const BLOCKS = ['#status-readout .hud-top', '#status-readout .hud-bl', '#status-readout .hud-br'];

async function expectInside(page, width, height) {
  for (const selector of BLOCKS) {
    const b = await box(page, selector);
    expect(b.left, `${selector} left`).toBeGreaterThanOrEqual(0);
    expect(b.top, `${selector} top`).toBeGreaterThanOrEqual(0);
    expect(b.right, `${selector} right`).toBeLessThanOrEqual(width);
    expect(b.bottom, `${selector} bottom`).toBeLessThanOrEqual(height);
  }
}

test.describe('phone, touch session', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test('the weapon block never meets the bomb button and every block is inside the viewport', async ({
    page,
  }) => {
    await bootGame(page, '?debug', { tap: true });
    expect(await page.evaluate(() => globalThis.__scorched.bombButton.visible)).toBe(true);
    await expect(page.locator('#status-readout .weapon')).not.toHaveText('');
    await expectInside(page, 390, 844);
    expect(intersects(await box(page, '#status-readout .hud-br'), await bombRect(page))).toBe(false);
    await expect(page.locator('#error-panel')).toHaveCount(0);
  });

  test('with no letterbox margin the weapon block sits above the bomb button, and returns in keyboard mode', async ({
    page,
  }) => {
    // A short phone viewport leaves no margin below the playfield: the button overlays its corner.
    await page.setViewportSize({ width: 390, height: 520 });
    await bootGame(page, '?debug', { tap: true });
    await expect.poll(() => page.evaluate(() => globalThis.__scorched.bombButton.inMargin)).toBe(false);
    const button = await bombRect(page);
    const above = await box(page, '#status-readout .hud-br');
    expect(intersects(above, button)).toBe(false);
    expect(above.bottom).toBeLessThanOrEqual(button.top);
    await expectInside(page, 390, 520);

    // A key press leaves touch mode: the button hides and the block drops back into the corner.
    await page.evaluate(() =>
      globalThis.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', key: 'd', bubbles: true })),
    );
    await expect.poll(() => page.evaluate(() => globalThis.__scorched.bombButton.visible)).toBe(false);
    await expect.poll(async () => (await box(page, '#status-readout .hud-br')).top).toBeGreaterThan(above.top);
    await page.evaluate(() =>
      globalThis.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD', key: 'd', bubbles: true })),
    );
  });
});

test.describe('desktop, keyboard session', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('the blocks sit at the projected playfield corners and follow a resize', async ({ page }) => {
    await bootGame(page, '?debug');
    expect(await page.evaluate(() => globalThis.__scorched.bombButton.visible)).toBe(false);
    const corners = await page.evaluate(() => globalThis.__scorched.projectPlayfield());
    const nearRight = corners[3];
    const nearLeft = corners[1];
    const br = await box(page, '#status-readout .hud-br');
    expect(Math.abs(br.right - nearRight.x)).toBeLessThan(40);
    expect(Math.abs(br.bottom - nearRight.y)).toBeLessThan(40);
    const bl = await box(page, '#status-readout .hud-bl');
    expect(Math.abs(bl.left - nearLeft.x)).toBeLessThan(40);
    expect(Math.abs(bl.bottom - nearLeft.y)).toBeLessThan(40);
    const top = await box(page, '#status-readout .hud-top');
    expect(top.top).toBeGreaterThanOrEqual(corners[0].y);
    expect(top.top).toBeLessThan(corners[0].y + 40);
    await expectInside(page, 1280, 800);

    // A resize (an orientation change) lays the HUD out again from the new projection.
    await page.setViewportSize({ width: 800, height: 1000 });
    await expect
      .poll(async () => (await box(page, '#status-readout .hud-br')).right, { timeout: 5000 })
      .toBeLessThanOrEqual(800);
    await expectInside(page, 800, 1000);
    const resized = await page.evaluate(() => globalThis.__scorched.projectPlayfield());
    const brAfter = await box(page, '#status-readout .hud-br');
    expect(Math.abs(brAfter.right - resized[3].x)).toBeLessThan(40);
    await expect(page.locator('#error-panel')).toHaveCount(0);
  });
});

test.describe('extend', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('an EXTEND event flashes the banner and pulses the lives, both for a short while only', async ({
    page,
  }) => {
    await bootGame(page, '?debug');
    await expect(page.locator('#extend')).toBeHidden();
    await expect(page.locator('#extend')).toHaveText('EXTEND');
    await page.evaluate(() => {
      const { fx, manifest } = globalThis.__scorched;
      fx.inject(manifest.events.EXTEND, 4);
    });
    await expect(page.locator('#extend')).toBeVisible();
    await expect(page.locator('#status-readout .lives')).toHaveClass(/pulse/);
    await expectInside(page, 390, 844);
    // The pulse is shorter than the banner, and both end on their own (the frame clock advances with frames).
    await expect(page.locator('#status-readout .lives')).not.toHaveClass(/pulse/, { timeout: 15_000 });
    await expect(page.locator('#extend')).toBeHidden({ timeout: 15_000 });
    await expect(page.locator('#error-panel')).toHaveCount(0);
  });
});
