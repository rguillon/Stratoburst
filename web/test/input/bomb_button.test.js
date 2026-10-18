import { describe, expect, it } from 'vitest';
import { createBombButton } from '../../src/input/bomb_button.js';
import { createFakeDocument } from '../helpers/fake_dom.js';

function make() {
  const doc = createFakeDocument();
  const el = doc.createElement('button');
  doc.body.append(el);
  return { doc, el, button: createBombButton(el) };
}

describe('createBombButton', () => {
  it('is not pressed before anything touches it', () => {
    const { button } = make();
    expect(button.sample()).toBe(false);
  });

  it('a held button samples true on every sample', () => {
    const { el, button } = make();
    el.dispatch('pointerdown', { pointerId: 1 });
    expect(button.sample()).toBe(true);
    expect(button.sample()).toBe(true);
    el.dispatch('pointerup', { pointerId: 1 });
  });

  it('latches a tap shorter than one frame: true once after the release, then false', () => {
    const { el, button } = make();
    el.dispatch('pointerdown', { pointerId: 1 });
    el.dispatch('pointerup', { pointerId: 1 });
    expect(button.sample()).toBe(true);
    expect(button.sample()).toBe(false);
  });

  it.each(['pointerup', 'pointercancel', 'lostpointercapture'])('%s releases the held state', (type) => {
    const { el, button } = make();
    el.dispatch('pointerdown', { pointerId: 1 });
    button.sample(); // consume the latch
    el.dispatch(type, { pointerId: 1 });
    expect(button.sample()).toBe(false);
  });

  it('a release of another pointer leaves the button held', () => {
    const { el, button } = make();
    el.dispatch('pointerdown', { pointerId: 1 });
    el.dispatch('pointerdown', { pointerId: 2 });
    button.sample();
    el.dispatch('pointerup', { pointerId: 2 });
    expect(button.sample()).toBe(true);
    el.dispatch('pointerup', { pointerId: 1 });
    expect(button.sample()).toBe(false);
  });

  it('pointerdown prevents the default, stops the event reaching the steering element and captures', () => {
    const { doc, el } = make();
    const reached = [];
    doc.body.addEventListener('pointerdown', () => reached.push('app'));
    const event = el.dispatch('pointerdown', { pointerId: 5 });
    expect(event.defaultPrevented).toBe(true);
    expect(event.propagationStopped).toBe(true);
    expect(reached).toEqual([]);
    expect(el.captured).toEqual([5]);
  });

  it('still counts a press when setPointerCapture throws', () => {
    const { el, button } = make();
    el.setPointerCapture = () => {
      throw new Error('NotFoundError');
    };
    expect(() => el.dispatch('pointerdown', { pointerId: 1 })).not.toThrow();
    expect(button.sample()).toBe(true);
  });

  it('clear() drops both the held state and the latch', () => {
    const { el, button } = make();
    el.dispatch('pointerdown', { pointerId: 1 });
    button.clear();
    expect(button.sample()).toBe(false);
  });

  it('setVisible toggles hidden', () => {
    const { el, button } = make();
    button.setVisible(false);
    expect(el.hidden).toBe(true);
    button.setVisible(true);
    expect(el.hidden).toBe(false);
  });

  it('dispose() removes every listener', () => {
    const { el, button } = make();
    button.dispose();
    const types = ['pointerdown', 'pointerup', 'pointercancel', 'lostpointercapture'];
    expect(types.map((type) => el.listenerCount(type))).toEqual([0, 0, 0, 0]);
    el.dispatch('pointerdown', { pointerId: 1 });
    expect(button.sample()).toBe(false);
  });
});
