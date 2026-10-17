import { expect, test } from '@playwright/test';
import { bootGame, readSlot } from './helpers.js';

// Dispatches a keyboard event on window the way a real layout would: `code` is the physical
// key, `key` is what that key types on the user's layout (D-11: only `code` may be used).
async function dispatchKey(page, type, code, key) {
  await page.evaluate(
    ([t, c, k]) => globalThis.dispatchEvent(new KeyboardEvent(t, { code: c, key: k, bubbles: true })),
    [type, code, key],
  );
}

async function isFiring(page) {
  return page.evaluate(() => {
    const { header, slots, manifest } = globalThis.__scorched;
    return (header[slots.FLAGS] & manifest.flags.FIRING) !== 0;
  });
}

test('AZERTY: the physical KeyW (labelled Z) flies the ship up', async ({ page }) => {
  await bootGame(page);
  const y0 = await readSlot(page, 'SHIP_Y');
  await dispatchKey(page, 'keydown', 'KeyW', 'z');
  await page.waitForTimeout(400);
  await dispatchKey(page, 'keyup', 'KeyW', 'z');
  const y1 = await readSlot(page, 'SHIP_Y');
  expect(y0 - y1).toBeGreaterThan(15);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});

test('AZERTY: the physical KeyA (labelled Q) flies the ship left', async ({ page }) => {
  await bootGame(page);
  const x0 = await readSlot(page, 'SHIP_X');
  await dispatchKey(page, 'keydown', 'KeyA', 'q');
  await page.waitForTimeout(400);
  await dispatchKey(page, 'keyup', 'KeyA', 'q');
  const x1 = await readSlot(page, 'SHIP_X');
  expect(x0 - x1).toBeGreaterThan(15);
});

test('holding Space sets the FIRING flag in the header and releasing clears it', async ({ page }) => {
  await bootGame(page);
  expect(await isFiring(page)).toBe(false);
  await page.keyboard.down('Space');
  await page.waitForTimeout(300);
  expect(await isFiring(page)).toBe(true);
  await page.keyboard.up('Space');
  await page.waitForTimeout(300);
  expect(await isFiring(page)).toBe(false);
});

test('KeyJ also fires', async ({ page }) => {
  await bootGame(page);
  await dispatchKey(page, 'keydown', 'KeyJ', 'j');
  await page.waitForTimeout(300);
  expect(await isFiring(page)).toBe(true);
  await dispatchKey(page, 'keyup', 'KeyJ', 'j');
});

test('the manifest publishes the button bits that JS uses', async ({ page }) => {
  await bootGame(page);
  const buttons = await page.evaluate(() => globalThis.__scorched.manifest.buttons);
  expect(buttons).toEqual({ FIRE: 1, BOMB: 2, PAUSE: 4 });
});
