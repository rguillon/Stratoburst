import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createBannerOverlay } from '../../src/ui/banner_overlay.js';
import { createFakeDocument } from '../helpers/fake_dom.js';

const FLOW_STATES = { INTRO: 0, PLAY: 1, WARNING: 3, TALLY: 6, STAGE_CLEAR: 7 };
const SLOTS = { FLOW: 0, FLOW_T: 1, STAGE: 2 };
const EVENTS = { EXPLOSION: 1, PICKUP: 4, EXTEND: 14 };
const EXTEND_MS = 1200;

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
function build({ withMarkup = true, withExtend = true } = {}) {
  const doc = createFakeDocument();
  const el = doc.createElement('div');
  el.id = 'banner';
  el.hidden = true;
  const extend = doc.createElement('div');
  extend.id = 'extend';
  extend.hidden = true;
  if (withMarkup && withExtend) doc.body.append(extend);
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
  return {
    doc,
    el,
    extend,
    writes,
    make: () => createBannerOverlay({ doc, flowStates: FLOW_STATES, events: EVENTS }),
  };
}

describe('createBannerOverlay', () => {
  it('throws when #banner is missing from the page', () => {
    const { make } = build({ withMarkup: false });
    expect(make).toThrow('#banner is missing from the page');
  });

  it('throws when #extend is missing from the page', () => {
    const { make } = build({ withExtend: false });
    expect(make).toThrow('#extend is missing from the page');
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

describe('STAGE CLEAR', () => {
  it('shows STAGE CLEAR at full opacity, without the warning class, exactly while FLOW is STAGE_CLEAR', () => {
    const { el, make } = build();
    const banner = make();
    banner.update(...frame({ flow: FLOW_STATES.STAGE_CLEAR, stage: 1, t: 0 }));
    expect(el.hidden).toBe(false);
    expect(el.textContent).toBe('STAGE CLEAR');
    expect(el.className).toBe('');
    expect(el.style.opacity).toBe('1');
    banner.update(...frame({ flow: FLOW_STATES.TALLY }));
    expect(el.hidden).toBe(true);
  });

  it('drops the warning class when it follows a WARNING', () => {
    const { el, make } = build();
    const banner = make();
    banner.update(...frame({ flow: FLOW_STATES.WARNING }));
    banner.update(...frame({ flow: FLOW_STATES.STAGE_CLEAR }));
    expect(el.textContent).toBe('STAGE CLEAR');
    expect(el.className).toBe('');
  });

  it('shows the STAGE n banner again on the intro that follows it', () => {
    const { el, make } = build();
    const banner = make();
    banner.update(...frame({ flow: FLOW_STATES.STAGE_CLEAR }));
    banner.update(...frame({ flow: FLOW_STATES.INTRO, t: 0 }));
    expect(el.textContent).toBe('STAGE 1');
    expect(el.hidden).toBe(false);
  });
});

describe('the EXTEND banner', () => {
  const extendEvent = (banner) => banner.handle(EVENTS.EXTEND, 0, 0, 4, 0, 0);

  it('starts hidden and keeps its static text', () => {
    const { extend, writes, make } = build();
    make();
    expect(extend.hidden).toBe(true);
    expect(writes.text).toBe(0);
  });

  it('shows on an EXTEND event and ignores every other event', () => {
    const { extend, make } = build();
    const banner = make();
    banner.handle(EVENTS.EXPLOSION, 0, 0, 0, 0, 0);
    banner.handle(EVENTS.PICKUP, 0, 0, 0, 2, 0);
    expect(extend.hidden).toBe(true);
    extendEvent(banner);
    expect(extend.hidden).toBe(false);
  });

  it('stays up for 1.2 s counted on the frame clock from the next tick, then hides', () => {
    const { extend, make } = build();
    const banner = make();
    extendEvent(banner);
    banner.tick(5000);
    banner.tick(5000 + EXTEND_MS - 1);
    expect(extend.hidden).toBe(false);
    banner.tick(5000 + EXTEND_MS);
    expect(extend.hidden).toBe(true);
    banner.tick(9000);
    expect(extend.hidden).toBe(true);
  });

  it('does nothing on a tick when no extend is showing', () => {
    const { extend, make } = build();
    make().tick(100);
    expect(extend.hidden).toBe(true);
  });

  it('restarts the timer on a second extend instead of stacking', () => {
    const { extend, make } = build();
    const banner = make();
    extendEvent(banner);
    banner.tick(1000);
    banner.tick(1800);
    extendEvent(banner);
    banner.tick(2000);
    banner.tick(2000 + EXTEND_MS - 1);
    expect(extend.hidden).toBe(false);
    banner.tick(2000 + EXTEND_MS);
    expect(extend.hidden).toBe(true);
    // Still a single element: the page holds one #extend.
    expect(extend.parent.children.filter((c) => c.id === 'extend')).toHaveLength(1);
  });

  it('never touches the stage banner and the stage banner never touches it', () => {
    const { el, extend, make } = build();
    const banner = make();
    extendEvent(banner);
    banner.update(...frame({ flow: FLOW_STATES.PLAY }));
    expect(el.hidden).toBe(true);
    expect(extend.hidden).toBe(false);
  });

  it('shows again for a later extend', () => {
    const { extend, make } = build();
    const banner = make();
    extendEvent(banner);
    banner.tick(0);
    banner.tick(EXTEND_MS);
    expect(extend.hidden).toBe(true);
    extendEvent(banner);
    expect(extend.hidden).toBe(false);
  });
});
