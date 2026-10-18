import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createBannerOverlay } from '../../src/ui/banner_overlay.js';
import { createFakeDocument } from '../helpers/fake_dom.js';

const FLOW_STATES = { INTRO: 0, PLAY: 1, WARNING: 3 };
const SLOTS = { FLOW: 0, FLOW_T: 1, STAGE: 2 };

// One frame's header and the slot map, as main.js passes them: update(...frame({ t: 0.5 })).
function frame(values = {}) {
  const v = { flow: FLOW_STATES.INTRO, t: 0, stage: 1, ...values };
  const header = new Float32Array(3);
  header[SLOTS.FLOW] = v.flow;
  header[SLOTS.FLOW_T] = v.t;
  header[SLOTS.STAGE] = v.stage;
  return [header, SLOTS];
}

// A document holding the same markup as index.html. Writes to textContent are counted.
function build({ withMarkup = true } = {}) {
  const doc = createFakeDocument();
  const el = doc.createElement('div');
  el.id = 'banner';
  el.hidden = true;
  const writes = { text: 0 };
  let text = '';
  Object.defineProperty(el, 'textContent', {
    get: () => text,
    set(value) {
      text = value;
      writes.text += 1;
    },
  });
  if (withMarkup) doc.body.append(el);
  return { doc, el, writes, make: () => createBannerOverlay({ doc, flowStates: FLOW_STATES }) };
}

describe('createBannerOverlay', () => {
  it('throws when #banner is missing from the page', () => {
    const { make } = build({ withMarkup: false });
    expect(make).toThrow('#banner is missing from the page');
  });

  it('exposes the element it drives', () => {
    const { el, make } = build();
    expect(make().el).toBe(el);
  });

  it('starts hidden', () => {
    const { el, make } = build();
    make();
    expect(el.hidden).toBe(true);
  });

  it('shows STAGE 1 at full opacity at the start of the intro', () => {
    const { el, make } = build();
    make().update(...frame({ t: 0 }));
    expect(el.hidden).toBe(false);
    expect(el.textContent).toBe('STAGE 1');
    expect(el.style.opacity).toBe('1');
  });

  it('builds the text from the integer stage number', () => {
    const { el, make } = build();
    const banner = make();
    banner.update(...frame({ stage: 3.0 }));
    expect(el.textContent).toBe('STAGE 3');
  });

  it('holds full opacity until 70% of the intro, then fades to nothing', () => {
    const { el, make } = build();
    const banner = make();
    banner.update(...frame({ t: 0.7 }));
    expect(Number(el.style.opacity)).toBe(1);
    banner.update(...frame({ t: 0.85 }));
    expect(Number(el.style.opacity)).toBeCloseTo(0.5, 2);
    banner.update(...frame({ t: 1 }));
    expect(Number(el.style.opacity)).toBe(0);
  });

  it('clamps an out-of-range progress', () => {
    const { el, make } = build();
    const banner = make();
    banner.update(...frame({ t: 5 }));
    expect(Number(el.style.opacity)).toBe(0);
    banner.update(...frame({ t: -1 }));
    expect(Number(el.style.opacity)).toBe(1);
    banner.update(...frame({ t: Number.NaN }));
    expect(Number(el.style.opacity)).toBe(1);
  });

  it('is hidden in every other flow state, including the gallery (-1)', () => {
    const { el, make } = build();
    const banner = make();
    banner.update(...frame());
    expect(el.hidden).toBe(false);
    banner.update(...frame({ flow: FLOW_STATES.PLAY }));
    expect(el.hidden).toBe(true);
    banner.update(...frame({ flow: -1, stage: 0 }));
    expect(el.hidden).toBe(true);
  });

  it('is hidden during the intro when the stage number is not a stage (the gallery)', () => {
    const { el, make } = build();
    make().update(...frame({ stage: 0 }));
    expect(el.hidden).toBe(true);
  });

  it('shows again on the next intro (a restart)', () => {
    const { el, make } = build();
    const banner = make();
    banner.update(...frame({ t: 0.9 }));
    banner.update(...frame({ flow: FLOW_STATES.PLAY }));
    banner.update(...frame({ t: 0 }));
    expect(el.hidden).toBe(false);
    expect(el.style.opacity).toBe('1');
  });

  it('writes the text only when it changes', () => {
    const { writes, make } = build();
    const banner = make();
    for (let i = 0; i < 10; i += 1) banner.update(...frame({ t: i / 20 }));
    expect(writes.text).toBe(1);
    banner.update(...frame({ stage: 2 }));
    expect(writes.text).toBe(2);
  });
});

describe('the boss WARNING', () => {
  it('shows WARNING with the warning class exactly while FLOW is WARNING, at full opacity', () => {
    const { el, make } = build();
    const banner = make();
    banner.update(...frame({ flow: FLOW_STATES.WARNING, stage: 1, t: 0.4 }));
    expect(el.hidden).toBe(false);
    expect(el.textContent).toBe('WARNING');
    expect(el.className).toBe('warning');
    expect(el.style.opacity).toBe('1');
  });

  it('shows the WARNING even where the stage number is not a stage', () => {
    const { el, make } = build();
    make().update(...frame({ flow: FLOW_STATES.WARNING, stage: 0 }));
    expect(el.hidden).toBe(false);
    expect(el.textContent).toBe('WARNING');
  });

  it('hides as soon as the WARNING is over and drops the warning class', () => {
    const { el, make } = build();
    const banner = make();
    banner.update(...frame({ flow: FLOW_STATES.WARNING }));
    banner.update(...frame({ flow: FLOW_STATES.PLAY }));
    expect(el.hidden).toBe(true);
    expect(el.className).toBe('');
  });

  it('keeps STAGE n for the intro, without the warning class, after a WARNING', () => {
    const { el, make } = build();
    const banner = make();
    banner.update(...frame({ flow: FLOW_STATES.WARNING }));
    banner.update(...frame({ flow: FLOW_STATES.INTRO, t: 0 }));
    expect(el.hidden).toBe(false);
    expect(el.textContent).toBe('STAGE 1');
    expect(el.className).toBe('');
    expect(el.style.opacity).toBe('1');
  });

  it('shows the full opacity again for a WARNING that follows a faded intro', () => {
    const { el, make } = build();
    const banner = make();
    banner.update(...frame({ t: 1 }));
    expect(el.style.opacity).toBe('0');
    banner.update(...frame({ flow: FLOW_STATES.WARNING }));
    expect(el.style.opacity).toBe('1');
  });

  it('writes the text and the class only when they change', () => {
    const { el, writes, make } = build();
    const banner = make();
    for (let i = 0; i < 10; i += 1) banner.update(...frame({ flow: FLOW_STATES.WARNING, t: i / 10 }));
    expect(writes.text).toBe(1);
    expect(el.className).toBe('warning');
  });
});

describe('the WARNING flash in index.html (photosensitivity)', () => {
  const page = readFileSync(fileURLToPath(new URL('../../../index.html', import.meta.url)), 'utf8');
  const rule = (selectorPattern) => new RegExp(`${selectorPattern}\\s*\\{([^}]*)\\}`).exec(page)?.[1] ?? '';

  it('flashes with a period of at least 0.34 s, so never more than 3 flashes per second', () => {
    const declaration = rule(String.raw`#banner\.warning`);
    const animation = /animation:\s*[\w-]+\s+([\d.]+)(m?s)/.exec(declaration);
    expect(animation, 'no animation on #banner.warning').not.toBeNull();
    const seconds = animation[2] === 'ms' ? Number(animation[1]) / 1000 : Number(animation[1]);
    expect(seconds).toBeGreaterThanOrEqual(0.34);
    expect(1 / seconds).toBeLessThanOrEqual(3);
  });

  it('flashes at 2 Hz, a period of 0.5 s', () => {
    const declaration = rule(String.raw`#banner\.warning`);
    expect(declaration).toMatch(/animation:\s*[\w-]+\s+0\.5s/);
  });

  it('turns the flash off for prefers-reduced-motion', () => {
    const block = /@media \(prefers-reduced-motion: reduce\)\s*\{[^@]*?#banner\.warning\s*\{([^}]*)\}/.exec(page);
    expect(block, 'no reduced-motion rule for #banner.warning').not.toBeNull();
    expect(block[1]).toMatch(/animation:\s*none/);
  });

  it('draws the WARNING in red neon, not the cyan of the stage banner', () => {
    const declaration = rule(String.raw`#banner\.warning`);
    const colour = /color:\s*rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(declaration);
    expect(colour, 'no colour on #banner.warning').not.toBeNull();
    expect(Number(colour[1])).toBeGreaterThan(200);
    expect(Number(colour[2])).toBeLessThan(90);
  });
});
