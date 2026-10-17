import { expect, test } from '@playwright/test';
import { bootGame, readSlot } from './helpers.js';

test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

const touch = (cdp, type, x, y) =>
  cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }],
  });

// The ship's centre in CSS pixels, from the debug projection hook.
const shipScreenX = (page) =>
  page.evaluate(() => {
    const { header, slots, projectPoint } = globalThis.__scorched;
    return projectPoint(header[slots.SHIP_X], header[slots.SHIP_Y]).x;
  });

test('a finger drag flies the ship 1:1 with no jump, auto-fire and a keydown leaves touch mode', async ({
  page,
}) => {
  await bootGame(page, '?debug');
  const cdp = await page.context().newCDPSession(page);

  const x0 = await readSlot(page, 'SHIP_X');
  const screen0 = await shipScreenX(page);
  expect(await page.evaluate(() => globalThis.__scorched.touchMode)).toBe(false);

  // A touchstart alone must not move the ship (no jump to the finger).
  await touch(cdp, 'touchStart', 100, 600);
  await page.waitForTimeout(200);
  expect(Math.abs((await readSlot(page, 'SHIP_X')) - x0)).toBeLessThan(0.01);

  // Drag 60 px to the right in six paced increments, then lift.
  for (let i = 1; i <= 6; i++) {
    await touch(cdp, 'touchMove', 100 + i * 10, 600);
    await page.waitForTimeout(50);
  }
  await touch(cdp, 'touchEnd');
  await page.waitForTimeout(1200); // the catch-up drains at keyboard speed

  const x1 = await readSlot(page, 'SHIP_X');
  const screen1 = await shipScreenX(page);
  expect(x1).toBeGreaterThan(x0 + 20);
  expect(x1).toBeLessThan(x0 + 60);
  // The ship travelled the same on-screen distance as the finger: 60 px within 25 %.
  expect(screen1 - screen0).toBeGreaterThan(45);
  expect(screen1 - screen0).toBeLessThan(75);

  // Touch mode is on and auto-fire sets the FIRING flag without any key.
  expect(await page.evaluate(() => globalThis.__scorched.touchMode)).toBe(true);
  const firing = await page.evaluate(() => {
    const { header, slots, manifest } = globalThis.__scorched;
    return (header[slots.FLAGS] & manifest.flags.FIRING) !== 0;
  });
  expect(firing).toBe(true);

  // A later keydown switches back to keyboard mode.
  await page.evaluate(() =>
    globalThis.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', key: 'd', bubbles: true })),
  );
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => globalThis.__scorched.touchMode)).toBe(false);
  await page.evaluate(() =>
    globalThis.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD', key: 'd', bubbles: true })),
  );
  await expect(page.locator('#error-panel')).toHaveCount(0);
});
