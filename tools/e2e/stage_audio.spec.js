import { expect, test } from '@playwright/test';
import { bootGame } from './helpers.js';

// D-13: the boss WARNING sounds an alarm. At ?at=boss the stage opens just before the boss marker, so
// the WARNING arrives on its own; the sound count must rise as the flow enters it. The production build
// runs under software GL and other specs run beside this one, so the waits are generous.
test.setTimeout(120_000);

test('the boss WARNING starts a voice: the sound count rises as the flow enters WARNING', async ({
  page,
}) => {
  await bootGame(page, '?debug&at=boss', { stage: true });
  await expect
    .poll(() => page.evaluate(() => globalThis.__scorched.audioState), { timeout: 5_000 })
    .toBe('running');

  // Track the voice count on every frame until the flow reaches WARNING, so the baseline is the count
  // just before the alarm's own voice could have started.
  const entry = await page.waitForFunction(
    () => {
      const { header, slots, manifest, sfx } = globalThis.__scorched;
      const seen = (globalThis.__stageAudio ??= { before: sfx.played });
      if (header[slots.FLOW] !== manifest.flow_states.WARNING) {
        seen.before = sfx.played;
        return false;
      }
      return { before: seen.before };
    },
    null,
    { polling: 'raf', timeout: 100_000 },
  );
  const { before } = await entry.jsonValue();

  await expect
    .poll(() => page.evaluate(() => globalThis.__scorched.sfx.played), { timeout: 3_000 })
    .toBeGreaterThan(before);
  await expect(page.locator('#error-panel')).toHaveCount(0);
});
