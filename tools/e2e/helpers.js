// Boots through the start gate like a player: wait for the gate, click it, wait for the game.
export async function bootGame(page, query = '?debug') {
  await page.goto('./' + query);
  await page.locator('#loading[data-gate-ready="true"]').waitFor({ timeout: 45_000 });
  await page.locator('#start-gate').click();
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
