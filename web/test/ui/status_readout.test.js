import { describe, expect, it } from 'vitest';
import { WEAPON_CSS, createStatusReadout } from '../../src/ui/status_readout.js';
import { createFakeDocument } from '../helpers/fake_dom.js';

const WEAPONS = { VULCAN: 0, LASER: 1, HOMING: 2 };

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
  el.append(weapon, level);
  doc.body.append(el);
  const writes = { weapon: 0, level: 0 };
  for (const [key, node] of [
    ['weapon', weapon],
    ['level', level],
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
  return { doc, el, weapon, level, writes };
}

describe('createStatusReadout', () => {
  it('shows the weapon name in its colour and the level', () => {
    const { doc, weapon, level } = build();
    const readout = createStatusReadout({ doc, weapons: WEAPONS });
    readout.update(1, 3);
    expect(weapon.textContent).toBe('LASER');
    expect(weapon.style.color).toBe(WEAPON_CSS.LASER);
    expect(level.textContent).toBe('Lv 3');
  });

  it('colours every weapon differently and none pink', () => {
    expect(new Set(Object.values(WEAPON_CSS)).size).toBe(3);
    expect(WEAPON_CSS.VULCAN).toBe('rgb(255, 90, 60)');
    expect(WEAPON_CSS.LASER).toBe('rgb(80, 168, 255)');
    expect(WEAPON_CSS.HOMING).toBe('rgb(170, 110, 255)');
    expect(Object.isFrozen(WEAPON_CSS)).toBe(true);
  });

  it('writes only when a value changes', () => {
    const { doc, writes } = build();
    const readout = createStatusReadout({ doc, weapons: WEAPONS });
    readout.update(0, 1);
    readout.update(0, 1);
    readout.update(0, 1);
    expect(writes).toEqual({ weapon: 1, level: 1 });
    readout.update(0, 2);
    expect(writes).toEqual({ weapon: 1, level: 2 });
    readout.update(2, 2);
    expect(writes).toEqual({ weapon: 2, level: 2 });
  });

  it('shows a placeholder, uncoloured, for an unknown weapon value', () => {
    const { doc, weapon } = build();
    createStatusReadout({ doc, weapons: WEAPONS }).update(9, 1);
    expect(weapon.textContent).toBe('?');
    expect(weapon.style.color).toBe('');
  });

  it('show() unhides the element', () => {
    const { doc, el } = build();
    const readout = createStatusReadout({ doc, weapons: WEAPONS });
    expect(el.hidden).toBe(true);
    readout.show();
    expect(el.hidden).toBe(false);
    expect(readout.el).toBe(el);
  });

  it('fails loudly when the markup is missing', () => {
    expect(() => createStatusReadout({ doc: createFakeDocument(), weapons: WEAPONS })).toThrow(
      /status-readout/,
    );
  });

  it('accepts a colour override', () => {
    const { doc, weapon } = build();
    createStatusReadout({ doc, weapons: WEAPONS, colors: { VULCAN: 'red' } }).update(0, 1);
    expect(weapon.style.color).toBe('red');
  });
});
