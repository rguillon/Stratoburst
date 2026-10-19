import { expect, test } from '@playwright/test';
import { bootGame, readSlot } from './helpers.js';

// Raiden II medals (SCOR-02, D-15, D-20): the opening tank column on the left road (x 80) carries
// medals. A laser held under that column shoots the first tank down, its medal drifts down the road
// with the city, the ship catches it, the chain starts and the value pops up where it was caught.
test('a laser under the medal tank column catches a medal: chain 1 and a "100" popup', async ({
  page,
}) => {
  test.setTimeout(160_000);
  await bootGame(page, '?debug&weapon=laser&level=5', { stage: true });
  expect(await readSlot(page, 'MEDAL_CHAIN')).toBe(0);
  expect(await readSlot(page, 'MEDAL_VALUE')).toBe(100);

  // The intro fly-in ignores the controls; steer once play starts.
  await page.waitForFunction(
    () => {
      const { header, slots, manifest } = globalThis.__scorched;
      return header[slots.FLOW] === manifest.flow_states.PLAY;
    },
    null,
    { polling: 'raf', timeout: 15_000 },
  );

  // Steer onto the left road (x 80). A key release lands a frame or two late, so the ship may run on
  // by a few units: settle within 10, which is still inside the laser column and the grab circle.
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const x = await readSlot(page, 'SHIP_X');
    if (Math.abs(x - 80) <= 10) break;
    const key = x > 80 ? 'ArrowLeft' : 'ArrowRight';
    await page.keyboard.down(key);
    await page.waitForFunction(
      ([dir]) => {
        const { header, slots } = globalThis.__scorched;
        const ship = header[slots.SHIP_X];
        return dir === 'ArrowLeft' ? ship <= 86 : ship >= 74;
      },
      [key],
      { polling: 'raf', timeout: 5_000 },
    );
    await page.keyboard.up(key);
    await page.waitForTimeout(100);
  }
  expect(Math.abs((await readSlot(page, 'SHIP_X')) - 80)).toBeLessThanOrEqual(10);

  await page.keyboard.down('Space');
  // The popup is up for under a second: watch for it with every frame instead of sampling. The wait is
  // generous because the simulation only advances with the frames software GL manages (about 50 s
  // alone, more when the whole suite loads the machine, and the high tier's rain and plumes cost frames).
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('#popups .popup')].some(
        (span) => !span.hidden && span.textContent === '100',
      ),
    null,
    { polling: 'raf', timeout: 100_000 },
  );
  await page.keyboard.up('Space');

  expect(await readSlot(page, 'MEDAL_CHAIN')).toBeGreaterThanOrEqual(1);
  expect(await readSlot(page, 'SCORE')).toBeGreaterThanOrEqual(100);
  await expect(page.locator('#popups .popup').first()).toHaveText('100');
  expect(await page.evaluate(() => globalThis.__scorched.fx.popupsShown)).toBeGreaterThanOrEqual(1);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});
