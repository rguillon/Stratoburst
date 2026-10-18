import { describe, expect, it } from 'vitest';
import { createTouchInput } from '../../src/input/touch_input.js';

// Fake element: records listeners, lets a test emit pointer events, and can make
// setPointerCapture throw the way a synthetic pointer does.
function fakeElement({ captureThrows = false } = {}) {
  const listeners = {};
  const captured = [];
  return {
    captured,
    addEventListener(type, handler) {
      (listeners[type] ??= new Set()).add(handler);
    },
    removeEventListener(type, handler) {
      listeners[type]?.delete(handler);
    },
    listenerCount: (type) => listeners[type]?.size ?? 0,
    setPointerCapture(id) {
      if (captureThrows) throw new Error('NotFoundError');
      captured.push(id);
    },
    emit(type, init = {}) {
      const event = { type, pointerId: 1, pointerType: 'touch', clientX: 0, clientY: 0, ...init };
      for (const handler of listeners[type] ?? []) handler(event);
    },
  };
}

// A pointerdown target inside the bomb button: closest() finds a [data-no-steer] ancestor.
const onButton = { closest: (selector) => (selector === '[data-no-steer]' ? {} : null) };
const onField = { closest: () => null };

describe('createTouchInput', () => {
  it('a touchstart alone produces no movement', () => {
    const el = fakeElement();
    const touch = createTouchInput(el);
    el.emit('pointerdown', { clientX: 100, clientY: 600 });
    expect(touch.sample()).toEqual({ dxPx: 0, dyPx: 0, active: true });
  });

  it('accumulates clientX/clientY differences of the steering pointer and zeroes on sample', () => {
    const el = fakeElement();
    const touch = createTouchInput(el);
    el.emit('pointerdown', { clientX: 100, clientY: 600 });
    el.emit('pointermove', { clientX: 110, clientY: 596 });
    el.emit('pointermove', { clientX: 125, clientY: 590 });
    expect(touch.sample()).toEqual({ dxPx: 25, dyPx: -10, active: true });
    expect(touch.sample()).toEqual({ dxPx: 0, dyPx: 0, active: true });
  });

  it('keeps the movement of a flick that ends before the next sample', () => {
    const el = fakeElement();
    const touch = createTouchInput(el);
    el.emit('pointerdown', { clientX: 0, clientY: 0 });
    el.emit('pointermove', { clientX: 30, clientY: 0 });
    el.emit('pointerup', { clientX: 30, clientY: 0 });
    expect(touch.sample()).toEqual({ dxPx: 30, dyPx: 0, active: false });
  });

  it('ignores a second finger entirely', () => {
    const el = fakeElement();
    const touch = createTouchInput(el);
    el.emit('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 });
    el.emit('pointerdown', { pointerId: 2, clientX: 200, clientY: 200 });
    el.emit('pointermove', { pointerId: 2, clientX: 260, clientY: 260 });
    el.emit('pointerup', { pointerId: 2, clientX: 260, clientY: 260 });
    el.emit('pointermove', { pointerId: 1, clientX: 5, clientY: 0 });
    expect(touch.sample()).toEqual({ dxPx: 5, dyPx: 0, active: true });
  });

  it.each(['pointerup', 'pointercancel', 'lostpointercapture'])('%s releases the steering pointer', (type) => {
    const el = fakeElement();
    const touch = createTouchInput(el);
    el.emit('pointerdown', { clientX: 0, clientY: 0 });
    el.emit(type);
    expect(touch.sample().active).toBe(false);
    el.emit('pointermove', { clientX: 50, clientY: 50 });
    expect(touch.sample()).toEqual({ dxPx: 0, dyPx: 0, active: false });
  });

  it('adopts a new pointer after the first one is released, without a jump', () => {
    const el = fakeElement();
    const touch = createTouchInput(el);
    el.emit('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 });
    el.emit('pointerup', { pointerId: 1 });
    el.emit('pointerdown', { pointerId: 2, clientX: 300, clientY: 300 });
    expect(touch.sample()).toEqual({ dxPx: 0, dyPx: 0, active: true });
    el.emit('pointermove', { pointerId: 2, clientX: 310, clientY: 300 });
    expect(touch.sample().dxPx).toBe(10);
  });

  it('captures the pointer, and survives a throwing setPointerCapture', () => {
    const ok = fakeElement();
    createTouchInput(ok);
    ok.emit('pointerdown', { pointerId: 7 });
    expect(ok.captured).toEqual([7]);

    const bad = fakeElement({ captureThrows: true });
    const touch = createTouchInput(bad);
    expect(() => bad.emit('pointerdown', { clientX: 1, clientY: 1 })).not.toThrow();
    bad.emit('pointermove', { clientX: 4, clientY: 1 });
    expect(touch.sample().dxPx).toBe(3);
  });

  it('reports touch mode only for touch pointers', () => {
    const el = fakeElement();
    let calls = 0;
    createTouchInput(el, { onTouchMode: () => calls++ });
    el.emit('pointerdown', { pointerId: 1, pointerType: 'mouse' });
    expect(calls).toBe(0);
    el.emit('pointerup', { pointerId: 1, pointerType: 'mouse' });
    el.emit('pointerdown', { pointerId: 2, pointerType: 'touch' });
    expect(calls).toBe(1);
  });

  it('a pointerdown inside [data-no-steer] neither steers, captures nor switches touch mode', () => {
    const el = fakeElement();
    let calls = 0;
    const touch = createTouchInput(el, { onTouchMode: () => calls++ });
    el.emit('pointerdown', { pointerId: 1, clientX: 0, clientY: 0, target: onButton });
    el.emit('pointermove', { pointerId: 1, clientX: 60, clientY: 0, target: onButton });
    expect(calls).toBe(0);
    expect(el.captured).toEqual([]);
    expect(touch.sample()).toEqual({ dxPx: 0, dyPx: 0, active: false });
  });

  it('a pointer that starts on the button leaves the steering pointer alone', () => {
    const el = fakeElement();
    const touch = createTouchInput(el);
    el.emit('pointerdown', { pointerId: 1, clientX: 0, clientY: 0, target: onField });
    el.emit('pointerdown', { pointerId: 2, clientX: 300, clientY: 700, target: onButton });
    el.emit('pointermove', { pointerId: 2, clientX: 360, clientY: 700, target: onButton });
    el.emit('pointerup', { pointerId: 2, target: onButton });
    el.emit('pointermove', { pointerId: 1, clientX: 8, clientY: 0, target: onField });
    expect(touch.sample()).toEqual({ dxPx: 8, dyPx: 0, active: true });
  });

  it('after a press on the button a later pointerdown elsewhere still steers', () => {
    const el = fakeElement();
    const touch = createTouchInput(el);
    el.emit('pointerdown', { pointerId: 1, clientX: 0, clientY: 0, target: onButton });
    el.emit('pointerup', { pointerId: 1, target: onButton });
    el.emit('pointerdown', { pointerId: 2, clientX: 100, clientY: 100, target: onField });
    el.emit('pointermove', { pointerId: 2, clientX: 130, clientY: 100, target: onField });
    expect(touch.sample()).toEqual({ dxPx: 30, dyPx: 0, active: true });
  });

  it('clear() drops the steering pointer and the accumulated movement', () => {
    const el = fakeElement();
    const touch = createTouchInput(el);
    el.emit('pointerdown', { clientX: 0, clientY: 0 });
    el.emit('pointermove', { clientX: 9, clientY: 9 });
    touch.clear();
    expect(touch.sample()).toEqual({ dxPx: 0, dyPx: 0, active: false });
  });

  it('dispose() removes every listener', () => {
    const el = fakeElement();
    const touch = createTouchInput(el);
    touch.dispose();
    const types = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture'];
    expect(types.map((type) => el.listenerCount(type))).toEqual([0, 0, 0, 0, 0]);
  });
});
