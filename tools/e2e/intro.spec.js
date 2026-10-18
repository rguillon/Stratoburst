import { expect, test } from '@playwright/test';
import { bootGame, readSlot } from './helpers.js';

// D-26: every stage start opens with an intro. The ship flies up from below the playfield under a
// fading STAGE 1 banner for about two seconds of simulation, never blinks, and then play begins.
// The production build runs under software GL, so the waits are generous: timing is not under test.
test.setTimeout(120_000);

const FLOW = (page) =>
  page.evaluate(() => {
    const { header, slots, manifest } = globalThis.__scorched;
    return header[slots.FLOW] === manifest.flow_states.PLAY ? 'PLAY' : header[slots.FLOW];
  });

test('the stage opens with STAGE 1 and the ship flying in, then play begins without a blink', async ({
  page,
}) => {
  await bootGame(page, '?debug', { stage: true });

  // Sample the invulnerability every frame until the flow reaches PLAY: the intro grants none.
  const sampled = page.evaluate(
    () =>
      new Promise((resolve) => {
        let maxInvuln = 0;
        let sawFlyIn = false;
        const sample = () => {
          const { header, slots, manifest } = globalThis.__scorched;
          maxInvuln = Math.max(maxInvuln, header[slots.INVULN]);
          sawFlyIn ||= header[slots.PLAYER_PHASE] === manifest.phases.RESPAWN;
          if (header[slots.FLOW] === manifest.flow_states.PLAY) resolve({ maxInvuln, sawFlyIn });
          else requestAnimationFrame(sample);
        };
        sample();
      }),
  );

  await expect(page.locator('#banner')).toHaveText('STAGE 1');
  const { maxInvuln, sawFlyIn } = await sampled;
  expect(maxInvuln).toBe(0);
  expect(sawFlyIn).toBe(true);

  await expect.poll(() => FLOW(page), { timeout: 6_000, intervals: [100] }).toBe('PLAY');
  expect(await readSlot(page, 'PLAYER_PHASE')).toBe(0);
  expect(await readSlot(page, 'INVULN')).toBe(0);
  await expect(page.locator('#banner')).toBeHidden();
  await expect(page.locator('#error-panel')).toHaveCount(0);
});

test('the banner is visible while the intro runs', async ({ page }) => {
  await bootGame(page, '?debug', { stage: true });

  expect(await readSlot(page, 'STAGE')).toBe(1);
  await expect(page.locator('#banner')).toBeVisible();
  await expect.poll(() => FLOW(page), { timeout: 6_000, intervals: [100] }).toBe('PLAY');
});

test('the shooting gallery has no intro and no banner', async ({ page }) => {
  await bootGame(page, '?debug');

  expect(await readSlot(page, 'FLOW')).toBe(-1);
  expect(await readSlot(page, 'PLAYER_PHASE')).toBe(0);
  await expect(page.locator('#banner')).toBeHidden();
});
