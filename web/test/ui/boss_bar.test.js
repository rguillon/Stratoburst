import { describe, expect, it } from 'vitest';
import { createBossBar } from '../../src/ui/boss_bar.js';
import { createFakeDocument } from '../helpers/fake_dom.js';

const SLOTS = { BOSS_ACTIVE: 0, BOSS_PHASE: 1, BOSS_HP: 2, BOSS_TIMER_S: 3 };
const BOSSES = [
  { slot: 1, name: 'midboss', phase_fracs: [0.5] },
  { slot: 2, name: 'boss', phase_fracs: [0.66, 0.33] },
];

// One frame's header, as main.js passes it: update(frame({ active: 1, hp: 0.5 }), SLOTS).
function frame(values = {}) {
  const v = { active: 0, phase: 0, hp: 0, timer: -1, ...values };
  const header = new Float32Array(4);
  header[SLOTS.BOSS_ACTIVE] = v.active;
  header[SLOTS.BOSS_PHASE] = v.phase;
  header[SLOTS.BOSS_HP] = v.hp;
  header[SLOTS.BOSS_TIMER_S] = v.timer;
  return header;
}

// A document holding the same markup as index.html. Writes to the text, the hidden flags and the
// fill transform are counted, so "written only on change" can be asserted.
function build({ withMarkup = true, bosses = BOSSES } = {}) {
  const doc = createFakeDocument();
  const el = doc.createElement('div');
  el.id = 'boss-bar';
  el.hidden = true;
  const fill = doc.createElement('div');
  fill.className = 'fill';
  const ticks = doc.createElement('div');
  ticks.className = 'ticks';
  const timer = doc.createElement('span');
  timer.className = 'timer';
  timer.hidden = true;
  el.append(fill, ticks, timer);

  const writes = { text: 0, barHidden: 0, timerHidden: 0, fill: 0 };
  let text = '';
  Object.defineProperty(timer, 'textContent', {
    get: () => text,
    set(value) {
      text = value;
      writes.text += 1;
    },
  });
  for (const [target, key] of [
    [el, 'barHidden'],
    [timer, 'timerHidden'],
  ]) {
    let hidden = target.hidden;
    Object.defineProperty(target, 'hidden', {
      get: () => hidden,
      set(value) {
        hidden = value;
        writes[key] += 1;
      },
    });
  }
  let transform = '';
  Object.defineProperty(fill.style, 'transform', {
    get: () => transform,
    set(value) {
      transform = value;
      writes.fill += 1;
    },
  });
  if (withMarkup) doc.body.append(el);
  return { doc, el, fill, ticks, timer, writes, make: () => createBossBar({ doc, bosses }) };
}

const tickLefts = (ticks) => ticks.children.filter((tick) => !tick.hidden).map((tick) => tick.style.left);

describe('createBossBar', () => {
  it('throws when #boss-bar is missing from the page', () => {
    const { make } = build({ withMarkup: false });
    expect(make).toThrow('#boss-bar is missing from the page');
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

  it('builds one tick per phase threshold of every boss once, with createElement, hidden until its boss is up', () => {
    const { ticks, make } = build();
    make();
    expect(ticks.children).toHaveLength(3);
    for (const tick of ticks.children) {
      expect(tick.tag).toBe('span');
      expect(tick.className).toBe('tick');
      expect(tick.hidden).toBe(true);
    }
  });

  it('stays hidden while BOSS_ACTIVE is 0', () => {
    const { el, make } = build();
    const bar = make();
    bar.update(frame({ active: 0, hp: 0.7 }), SLOTS);
    expect(el.hidden).toBe(true);
  });

  it('shows while BOSS_ACTIVE is 1 or 2', () => {
    const { el, make } = build();
    const bar = make();
    bar.update(frame({ active: 1, hp: 1 }), SLOTS);
    expect(el.hidden).toBe(false);
    bar.update(frame({ active: 2, hp: 1 }), SLOTS);
    expect(el.hidden).toBe(false);
    bar.update(frame({ active: 0 }), SLOTS);
    expect(el.hidden).toBe(true);
  });

  it('scales the fill by BOSS_HP', () => {
    const { fill, make } = build();
    const bar = make();
    bar.update(frame({ active: 1, hp: 1 }), SLOTS);
    expect(fill.style.transform).toBe('scaleX(1)');
    bar.update(frame({ active: 1, hp: 0.5 }), SLOTS);
    expect(fill.style.transform).toBe('scaleX(0.5)');
    bar.update(frame({ active: 1, hp: 0 }), SLOTS);
    expect(fill.style.transform).toBe('scaleX(0)');
  });

  it('clamps the fill to 0..1 and treats a non-finite hp as empty', () => {
    const { fill, make } = build();
    const bar = make();
    const header = frame({ active: 1, hp: 1.7 });
    bar.update(header, SLOTS);
    expect(fill.style.transform).toBe('scaleX(1)');
    header[SLOTS.BOSS_HP] = -0.4;
    bar.update(header, SLOTS);
    expect(fill.style.transform).toBe('scaleX(0)');
    header[SLOTS.BOSS_HP] = Number.NaN;
    bar.update(header, SLOTS);
    expect(fill.style.transform).toBe('scaleX(0)');
  });

  it('shows only the ticks of the active boss, at their threshold percentages', () => {
    const { ticks, make } = build();
    const bar = make();
    bar.update(frame({ active: 1, hp: 1 }), SLOTS);
    expect(tickLefts(ticks)).toEqual(['50%']);
    bar.update(frame({ active: 2, hp: 1 }), SLOTS);
    expect(tickLefts(ticks)).toEqual(['66%', '33%']);
    bar.update(frame({ active: 0 }), SLOTS);
    expect(tickLefts(ticks)).toEqual([]);
  });

  it('shows no ticks, but still the bar, for a boss slot the manifest does not list', () => {
    const { el, ticks, make } = build();
    const bar = make();
    bar.update(frame({ active: 7, hp: 1 }), SLOTS);
    expect(el.hidden).toBe(false);
    expect(tickLefts(ticks)).toEqual([]);
  });

  it('works for a stage with no boss data at all', () => {
    const { el, ticks, make } = build({ bosses: [] });
    const bar = make();
    expect(ticks.children).toHaveLength(0);
    bar.update(frame({ active: 1, hp: 1 }), SLOTS);
    expect(el.hidden).toBe(false);
  });

  describe('the timeout readout', () => {
    it('is hidden at BOSS_TIMER_S -1', () => {
      const { timer, make } = build();
      make().update(frame({ active: 1, hp: 1, timer: -1 }), SLOTS);
      expect(timer.hidden).toBe(true);
    });

    it('shows "20" at exactly 20', () => {
      const { timer, make } = build();
      make().update(frame({ active: 1, hp: 1, timer: 20 }), SLOTS);
      expect(timer.hidden).toBe(false);
      expect(timer.textContent).toBe('20');
    });

    it('shows "1" at 1 and "0" at 0', () => {
      const { timer, make } = build();
      const bar = make();
      bar.update(frame({ active: 1, hp: 1, timer: 1 }), SLOTS);
      expect(timer.textContent).toBe('1');
      bar.update(frame({ active: 1, hp: 1, timer: 0 }), SLOTS);
      expect(timer.hidden).toBe(false);
      expect(timer.textContent).toBe('0');
    });

    it('rounds a partial second up and writes only a whole number', () => {
      const { timer, make } = build();
      make().update(frame({ active: 1, hp: 1, timer: 3.5 }), SLOTS);
      expect(timer.textContent).toBe('4');
    });

    it('hides again when the timer drops back to -1', () => {
      const { timer, make } = build();
      const bar = make();
      bar.update(frame({ active: 1, hp: 1, timer: 5 }), SLOTS);
      bar.update(frame({ active: 1, hp: 1, timer: -1 }), SLOTS);
      expect(timer.hidden).toBe(true);
    });

    it('reads a non-finite timer as not shown', () => {
      const { timer, make } = build();
      make().update(frame({ active: 1, hp: 1, timer: Number.NaN }), SLOTS);
      expect(timer.hidden).toBe(true);
    });
  });

  it('writes the DOM only when something changes', () => {
    const { writes, make } = build();
    const bar = make();
    const header = frame({ active: 1, hp: 0.6, timer: 12 });
    bar.update(header, SLOTS);
    const after = { ...writes };
    for (let i = 0; i < 30; i += 1) bar.update(header, SLOTS);
    expect(writes).toEqual(after);
    header[SLOTS.BOSS_HP] = 0.55;
    bar.update(header, SLOTS);
    expect(writes.fill).toBe(after.fill + 1);
    expect(writes.text).toBe(after.text);
    header[SLOTS.BOSS_TIMER_S] = 11;
    bar.update(header, SLOTS);
    expect(writes.text).toBe(after.text + 1);
  });

  it('writes nothing while no boss is up', () => {
    const { writes, make } = build();
    const bar = make();
    const header = frame({ active: 0 });
    for (let i = 0; i < 10; i += 1) bar.update(header, SLOTS);
    expect(writes.fill).toBe(0);
    expect(writes.text).toBe(0);
  });

  it('is state-driven: a later frame with no boss hides a bar that missed its event', () => {
    const { el, make } = build();
    const bar = make();
    bar.update(frame({ active: 1, hp: 0.2, timer: 4 }), SLOTS);
    expect(el.hidden).toBe(false);
    bar.update(frame({ active: 0, hp: 0, timer: -1 }), SLOTS);
    expect(el.hidden).toBe(true);
  });
});
