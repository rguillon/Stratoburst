// Boots through the start gate like a player: wait for the gate, click it, wait for the game.
// The ship is a god (the ?god flag) unless the spec asks for a mortal one, so enemy fire never
// disturbs movement or shooting checks. The Phase 2 shooting gallery (the ?gallery flag) is booted
// unless the spec asks for the stage: stage 1 is the default game now, and every older spec was
// written against the gallery. `tap` starts with a touch tap on the gate (needs a page with
// touch support) instead of a mouse click, which makes the session a touch session from the start.
export async function bootGame(
  page,
  query = '?debug',
  { mortal = false, tap = false, stage = false } = {},
) {
  const extras = [...(mortal ? [] : ['god']), ...(stage ? [] : ['gallery'])];
  const separator = query.includes('?') ? '&' : '?';
  await page.goto('./' + query + (extras.length > 0 ? separator + extras.join('&') : ''));
  await page.locator('#loading[data-gate-ready="true"]').waitFor({ timeout: 45_000 });
  await (tap ? page.locator('#start-gate').tap() : page.locator('#start-gate').click());
  await page.waitForFunction(() => globalThis.__scorched?.ready === true, null, {
    timeout: 45_000,
  });
}

export async function readSlot(page, name) {
  return page.evaluate((slot) => {
    const { header, slots } = globalThis.__scorched;
    return header[slots[slot]];
  }, name);
}
