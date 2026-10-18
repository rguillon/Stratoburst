// Boots through the start gate like a player: wait for the gate, click it, wait for the game.
// The ship is a god (the ?god flag) unless the spec asks for a mortal one, so enemy fire never
// disturbs movement or shooting checks. `tap` starts with a touch tap on the gate (needs a page with
// touch support) instead of a mouse click, which makes the session a touch session from the start.
export async function bootGame(page, query = '?debug', { mortal = false, tap = false } = {}) {
  await page.goto('./' + query + (mortal ? '' : (query.includes('?') ? '&' : '?') + 'god'));
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
