import { expect, test } from '@playwright/test';
import { bootGame } from './helpers.js';

// The HUD and the overlays use the self-hosted arcade pixel font (D-24): Press Start 2P, vendored
// from the repository, loaded while the loading screen is up and never swapped during play.
test('the self-hosted Press Start 2P is loaded and applied to the HUD and the overlays', async ({
  page,
}) => {
  // Every font request stays on this origin: no CDN, no third-party request (T-03-31).
  const origin = new URL(process.env.BASE_URL ?? 'http://localhost:4173/').origin;
  const fontRequests = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'font') fontRequests.push(request.url());
  });

  await bootGame(page, '?debug', { stage: true });

  expect(await page.evaluate(() => document.fonts.check('12px "Press Start 2P"'))).toBe(true);
  const loaded = await page.evaluate(() =>
    [...document.fonts].filter((face) => face.family.includes('Press Start 2P')).map((face) => face.status),
  );
  expect(loaded).toEqual(['loaded']);

  // Every HUD and overlay text style resolves to the pixel font first.
  const families = await page.evaluate(() => {
    // A world score popup only exists for a moment after a medal catch, so probe one the way the UI builds it.
    const probe = document.createElement('span');
    probe.className = 'popup';
    probe.hidden = true;
    document.querySelector('#popups').append(probe);
    const result = Object.fromEntries(
      [
        '#loading .title',
        '#status-readout .score',
        '#status-readout .hud-bl',
        '#boss-bar .timer',
        '#popups .popup',
        '#max-flash',
        '#banner',
        '#tally',
        '#game-over',
        '#game-over .title',
      ].map((selector) => [
        selector,
        getComputedStyle(document.querySelector(selector)).fontFamily,
      ]),
    );
    probe.remove();
    return result;
  });
  for (const [selector, family] of Object.entries(families)) {
    expect(family, selector).toMatch(/^"?Press Start 2P"?,/);
  }

  // The font file is served by the build, hashed into assets, and only that one is requested.
  expect(fontRequests).toHaveLength(1);
  expect(fontRequests[0].startsWith(origin)).toBe(true);
  expect(fontRequests[0]).toMatch(/\/assets\/press-start-2p-latin-400-normal-[\w-]+\.woff2$/);
});
