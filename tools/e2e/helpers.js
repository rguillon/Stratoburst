export async function bootGame(page, query = '?debug') {
  await page.goto('./' + query);
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
