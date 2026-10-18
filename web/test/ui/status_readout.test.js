import { describe, expect, it } from 'vitest';
import { hueDistance, hueOf } from '../../src/fx/palette.js';
import { BOMB_PIP, BOMB_PIPS_MAX, WEAPON_CSS, createStatusReadout } from '../../src/ui/status_readout.js';
import { createFakeDocument } from '../helpers/fake_dom.js';

const WEAPONS = { VULCAN: 0, LASER: 1, HOMING: 2 };
const EVENTS = { EXPLOSION: 1, HIT: 2, PICKUP: 4 };
const OUTCOME = { RAISED: 0, SWITCHED: 1, MAXED: 2, STOCKED: 3 };
const OPTIONS = { weapons: WEAPONS, events: EVENTS, maxed: OUTCOME.MAXED };
const FLASH_MS = 900;

// A document holding the same markup as index.html, with writes to textContent counted.
function build() {
  const doc = createFakeDocument();
  const el = doc.createElement('div');
  el.id = 'status-readout';
  el.hidden = true;
  const weapon = doc.createElement('span');
  weapon.className = 'weapon';
  const level = doc.createElement('span');
  level.className = 'level';
  const bombs = doc.createElement('span');
  bombs.className = 'bombs';
  el.append(weapon, level, bombs);
  const flash = doc.createElement('div');
  flash.id = 'max-flash';
  flash.hidden = true;
  doc.body.append(el, flash);
  const writes = { weapon: 0, level: 0, bombs: 0 };
  for (const [key, node] of [
    ['weapon', weapon],
    ['level', level],
    ['bombs', bombs],
  ]) {
    let text = '';
    Object.defineProperty(node, 'textContent', {
      get: () => text,
      set(value) {
        writes[key] += 1;
        text = value;
      },
    });
  }
  return { doc, el, weapon, level, bombs, flash, writes };
}

describe('createStatusReadout', () => {
  it('shows the weapon name in its colour and the level', () => {
    const { doc, weapon, level } = build();
    const readout = createStatusReadout({ doc, ...OPTIONS });
    readout.update(1, 3);
    expect(weapon.textContent).toBe('LASER');
    expect(weapon.style.color).toBe(WEAPON_CSS.LASER);
    expect(level.textContent).toBe('Lv 3');
  });

  it('colours every weapon differently and none orange-yellow', () => {
    expect(new Set(Object.values(WEAPON_CSS)).size).toBe(3);
    expect(WEAPON_CSS.VULCAN).toBe('rgb(255, 28, 64)');
    const [r, g, b] = WEAPON_CSS.VULCAN.match(/\d+/g).map(Number);
    expect(hueDistance(hueOf([r, g, b]), 350)).toBeLessThanOrEqual(15);
    expect(WEAPON_CSS.LASER).toBe('rgb(80, 168, 255)');
    expect(WEAPON_CSS.HOMING).toBe('rgb(170, 110, 255)');
    expect(Object.isFrozen(WEAPON_CSS)).toBe(true);
  });

  it('writes only when a value changes', () => {
    const { doc, writes } = build();
    const readout = createStatusReadout({ doc, ...OPTIONS });
    readout.update(0, 1, 3);
    readout.update(0, 1, 3);
    readout.update(0, 1, 3);
    expect(writes).toEqual({ weapon: 1, level: 1, bombs: 1 });
    readout.update(0, 2, 3);
    expect(writes).toEqual({ weapon: 1, level: 2, bombs: 1 });
    readout.update(2, 2, 3);
    expect(writes).toEqual({ weapon: 2, level: 2, bombs: 1 });
    readout.update(2, 2, 2);
    expect(writes).toEqual({ weapon: 2, level: 2, bombs: 2 });
  });

  it.each([0, 1, 3, 7])('shows %i bombs as that many pips', (stock) => {
    const { doc, bombs } = build();
    createStatusReadout({ doc, ...OPTIONS }).update(0, 1, stock);
    expect(bombs.textContent).toBe(BOMB_PIP.repeat(stock));
  });

  it('shows no pips for a stock of zero and seven for the full stock', () => {
    const { doc, bombs } = build();
    const readout = createStatusReadout({ doc, ...OPTIONS });
    readout.update(0, 1, 0);
    expect(bombs.textContent).toBe('');
    readout.update(0, 1, BOMB_PIPS_MAX);
    expect(bombs.textContent).toHaveLength(7);
  });

  it.each([
    [99, 7],
    [-4, 0],
    [2.9, 2],
    [Number.NaN, 0],
    [undefined, 0],
    [Number.POSITIVE_INFINITY, 0],
  ])('treats a stock of %s as %i pips', (stock, pips) => {
    const { doc, bombs } = build();
    createStatusReadout({ doc, ...OPTIONS }).update(0, 1, stock);
    expect(bombs.textContent).toBe(BOMB_PIP.repeat(pips));
  });

  it('never uses innerHTML for the pips', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(new URL('../../src/ui/status_readout.js', import.meta.url), 'utf8');
    expect(source).not.toContain('innerHTML');
  });

  it('shows a placeholder, uncoloured, for an unknown weapon value', () => {
    const { doc, weapon } = build();
    createStatusReadout({ doc, ...OPTIONS }).update(9, 1);
    expect(weapon.textContent).toBe('?');
    expect(weapon.style.color).toBe('');
  });

  it('show() unhides the element', () => {
    const { doc, el } = build();
    const readout = createStatusReadout({ doc, ...OPTIONS });
    expect(el.hidden).toBe(true);
    readout.show();
    expect(el.hidden).toBe(false);
    expect(readout.el).toBe(el);
  });

  it('fails loudly when the markup is missing', () => {
    expect(() => createStatusReadout({ doc: createFakeDocument(), ...OPTIONS })).toThrow(
      /status-readout/,
    );
  });

  it('accepts a colour override', () => {
    const { doc, weapon } = build();
    createStatusReadout({ doc, ...OPTIONS, colors: { VULCAN: 'red' } }).update(0, 1);
    expect(weapon.style.color).toBe('red');
  });
});

describe('the MAX flash', () => {
  const maxed = (readout) => readout.handle(EVENTS.PICKUP, 100, 100, 3, OUTCOME.MAXED, 0);

  it('is hidden until a PICKUP event with the MAXED outcome arrives', () => {
    const { doc, flash } = build();
    const readout = createStatusReadout({ doc, ...OPTIONS });
    expect(flash.hidden).toBe(true);
    readout.tick(0);
    expect(flash.hidden).toBe(true);
    maxed(readout);
    expect(flash.hidden).toBe(false);
  });

  it('hides again once 900 ms have passed on tick', () => {
    const { doc, flash } = build();
    const readout = createStatusReadout({ doc, ...OPTIONS });
    maxed(readout);
    readout.tick(5000); // the first tick after the catch starts the 900 ms
    readout.tick(5000 + FLASH_MS - 1);
    expect(flash.hidden).toBe(false);
    readout.tick(5000 + FLASH_MS);
    expect(flash.hidden).toBe(true);
  });

  it('fades out over the last part of the flash', () => {
    const { doc, flash } = build();
    const readout = createStatusReadout({ doc, ...OPTIONS });
    maxed(readout);
    readout.tick(0);
    expect(flash.style.opacity).toBe('1.00');
    readout.tick(FLASH_MS - 100);
    expect(Number(flash.style.opacity)).toBeCloseTo(0.25, 2);
  });

  it('shows nothing for RAISED, SWITCHED or STOCKED catches', () => {
    const { doc, flash } = build();
    const readout = createStatusReadout({ doc, ...OPTIONS });
    for (const outcome of [OUTCOME.RAISED, OUTCOME.SWITCHED, OUTCOME.STOCKED]) {
      readout.handle(EVENTS.PICKUP, 100, 100, 3, outcome, 0);
    }
    readout.tick(0);
    expect(flash.hidden).toBe(true);
  });

  it('ignores other event types even with a matching b payload', () => {
    const { doc, flash } = build();
    const readout = createStatusReadout({ doc, ...OPTIONS });
    readout.handle(EVENTS.EXPLOSION, 100, 100, 0, OUTCOME.MAXED, 0);
    readout.handle(EVENTS.HIT, 100, 100, 0, OUTCOME.MAXED, 0);
    expect(flash.hidden).toBe(true);
  });

  it('a second MAX inside the window extends the flash instead of stacking', () => {
    const { doc, flash } = build();
    const readout = createStatusReadout({ doc, ...OPTIONS });
    maxed(readout);
    readout.tick(0);
    readout.tick(600);
    maxed(readout);
    readout.tick(700); // the deadline restarts from this tick
    readout.tick(700 + FLASH_MS - 1);
    expect(flash.hidden).toBe(false);
    readout.tick(700 + FLASH_MS);
    expect(flash.hidden).toBe(true);
  });

  it('can flash again after it has hidden', () => {
    const { doc, flash } = build();
    const readout = createStatusReadout({ doc, ...OPTIONS });
    maxed(readout);
    readout.tick(0);
    readout.tick(FLASH_MS);
    expect(flash.hidden).toBe(true);
    maxed(readout);
    readout.tick(FLASH_MS + 10);
    expect(flash.hidden).toBe(false);
  });

  it('does not touch the DOM on ticks while nothing flashes', () => {
    const { doc, flash } = build();
    const readout = createStatusReadout({ doc, ...OPTIONS });
    for (let t = 0; t < 5; t++) readout.tick(t * 16);
    expect(flash.style.opacity).toBeUndefined();
  });

  it('fails loudly when #max-flash is missing from the page', () => {
    const { doc, flash } = build();
    flash.remove();
    expect(() => createStatusReadout({ doc, ...OPTIONS })).toThrow(/max-flash/);
  });
});
