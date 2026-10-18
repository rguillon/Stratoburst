import { describe, expect, it } from 'vitest';
import { createScorePopups } from '../../src/ui/score_popups.js';
import { createFakeDocument } from '../helpers/fake_dom.js';

const EVENTS = { EXPLOSION: 1, MEDAL: 13, EXTEND: 14 };

function build({ withMarkup = true, capacity } = {}) {
  const doc = createFakeDocument();
  const root = doc.createElement('div');
  root.id = 'popups';
  if (withMarkup) doc.body.append(root);
  const projected = [];
  const project = (x, y) => {
    projected.push([x, y]);
    return { x: x * 2, y: y * 3 };
  };
  const options = { doc, events: EVENTS, project };
  if (capacity !== undefined) options.capacity = capacity;
  return { doc, root, projected, make: () => createScorePopups(options) };
}

describe('createScorePopups', () => {
  it('throws when #popups is missing from the page', () => {
    const { make } = build({ withMarkup: false });
    expect(make).toThrow('#popups is missing from the page');
  });

  it('builds a pool of eight hidden popup spans inside #popups', () => {
    const { root, make } = build();
    const popups = make();
    expect(popups.spans).toHaveLength(8);
    expect(root.children).toHaveLength(8);
    for (const span of root.children) {
      expect(span.tag).toBe('span');
      expect(span.className).toBe('popup');
      expect(span.hidden).toBe(true);
    }
  });

  it('shows a medal event as one popup with the value at the projected point', () => {
    const { projected, make } = build();
    const popups = make();
    popups.handle(EVENTS.MEDAL, 80, 120, 100, 1, 0);
    const [first] = popups.spans;
    expect(first.textContent).toBe('100');
    expect(first.hidden).toBe(false);
    expect(first.style.left).toBe('160px');
    expect(first.style.top).toBe('360px');
    expect(projected).toEqual([[80, 120]]);
    expect(popups.spans.filter((span) => !span.hidden)).toHaveLength(1);
    expect(popups.shown).toBe(1);
  });

  it('rounds the value and writes only an integer', () => {
    const { make } = build();
    const popups = make();
    popups.handle(EVENTS.MEDAL, 0, 0, 1999.6);
    expect(popups.spans[0].textContent).toBe('2000');
  });

  it('shows 0 for a value that is not a finite number', () => {
    const { make } = build();
    const popups = make();
    popups.handle(EVENTS.MEDAL, 0, 0, Number.NaN);
    expect(popups.spans[0].textContent).toBe('0');
  });

  it('ignores every other event: regular kills and pickups show no popup', () => {
    const { projected, make } = build();
    const popups = make();
    popups.handle(EVENTS.EXPLOSION, 80, 120, 1, 0, 0);
    popups.handle(EVENTS.EXTEND, 80, 120, 4, 0, 0);
    expect(popups.spans.every((span) => span.hidden)).toBe(true);
    expect(projected).toEqual([]);
    expect(popups.shown).toBe(0);
  });

  it('gives each catch its own span, then reuses the oldest on the ninth', () => {
    const { make } = build();
    const popups = make();
    for (let i = 1; i <= 8; i += 1) popups.handle(EVENTS.MEDAL, i, i, i * 100);
    expect(popups.spans.map((span) => span.textContent)).toEqual([
      '100', '200', '300', '400', '500', '600', '700', '800',
    ]);
    popups.handle(EVENTS.MEDAL, 9, 9, 9000);
    expect(popups.spans[0].textContent).toBe('9000');
    expect(popups.spans[1].textContent).toBe('200');
    expect(popups.spans).toHaveLength(8);
  });

  it('hides a popup when its animation ends', () => {
    const { make } = build();
    const popups = make();
    popups.handle(EVENTS.MEDAL, 80, 120, 100);
    const [span] = popups.spans;
    span.dispatch('animationend');
    expect(span.hidden).toBe(true);
  });

  it('restarts a span that is reused while still showing', () => {
    const { make } = build({ capacity: 1 });
    const popups = make();
    const [span] = popups.spans;
    const states = [];
    Object.defineProperty(span, 'hidden', {
      get: () => states.at(-1) ?? true,
      set: (value) => states.push(value),
    });
    popups.handle(EVENTS.MEDAL, 1, 1, 100);
    popups.handle(EVENTS.MEDAL, 2, 2, 200);
    // Each catch hides then shows the span, which is what restarts the CSS animation.
    expect(states).toEqual([true, false, true, false]);
    expect(span.textContent).toBe('200');
  });
});
