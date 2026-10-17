import { describe, expect, it } from 'vitest';
import { KEY_BINDINGS, createKeyboardInput, reduceKey } from '../../src/input/keyboard_input.js';

const BITS = { FIRE: 1, BOMB: 2, PAUSE: 4 };
const axisX = (held) => (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);

// Minimal event target: records listeners and lets a test emit events.
function fakeTarget() {
  const listeners = {};
  return {
    addEventListener(type, handler) {
      (listeners[type] ??= new Set()).add(handler);
    },
    removeEventListener(type, handler) {
      listeners[type]?.delete(handler);
    },
    listenerCount: (type) => listeners[type]?.size ?? 0,
    emit(type, code) {
      const event = { type, code, prevented: false, preventDefault: () => (event.prevented = true) };
      for (const handler of listeners[type] ?? []) handler(event);
      return event;
    },
  };
}

describe('KEY_BINDINGS (D-11, physical codes)', () => {
  it.each([
    ['ArrowUp', 'up'],
    ['KeyW', 'up'],
    ['ArrowDown', 'down'],
    ['KeyS', 'down'],
    ['ArrowLeft', 'left'],
    ['KeyA', 'left'],
    ['ArrowRight', 'right'],
    ['KeyD', 'right'],
    ['Space', 'fire'],
    ['KeyJ', 'fire'],
    ['ShiftLeft', 'bomb'],
    ['ShiftRight', 'bomb'],
    ['KeyK', 'bomb'],
    ['Escape', 'pause'],
    ['KeyP', 'pause'],
  ])('maps %s to %s', (code, action) => {
    expect(KEY_BINDINGS.get(code)).toBe(action);
  });

  it('does not bind letters outside the table', () => {
    expect(KEY_BINDINGS.has('KeyQ')).toBe(false);
    expect(KEY_BINDINGS.has('KeyZ')).toBe(false);
  });
});

describe('reduceKey', () => {
  it('cancels opposing keys on an axis', () => {
    const held = new Set();
    expect(reduceKey(held, 'keydown', 'ArrowLeft')).toBe(true);
    expect(reduceKey(held, 'keydown', 'ArrowRight')).toBe(true);
    expect(axisX(held)).toBe(0);
  });

  it('returns false and changes nothing for an unbound code', () => {
    const held = new Set();
    expect(reduceKey(held, 'keydown', 'KeyQ')).toBe(false);
    expect(held.size).toBe(0);
  });

  it('removes the held key on keyup', () => {
    const held = new Set();
    reduceKey(held, 'keydown', 'ArrowRight');
    expect(axisX(held)).toBe(1);
    reduceKey(held, 'keyup', 'ArrowRight');
    expect(held.size).toBe(0);
  });

  it('records the press edge in the pressed set on keydown only', () => {
    const held = new Set();
    const pressed = new Set();
    reduceKey(held, 'keydown', 'Space', pressed);
    expect(pressed.has('fire')).toBe(true);
    pressed.clear();
    reduceKey(held, 'keyup', 'Space', pressed);
    expect(pressed.size).toBe(0);
  });

  it('ignores an unknown event type for a bound code', () => {
    const held = new Set();
    expect(reduceKey(held, 'keypress', 'Space')).toBe(true);
    expect(held.size).toBe(0);
  });
});

describe('createKeyboardInput', () => {
  it('moves by physical key: KeyW (AZERTY Z) is up, KeyA (AZERTY Q) is left', () => {
    const target = fakeTarget();
    const kb = createKeyboardInput(target);
    target.emit('keydown', 'KeyW');
    target.emit('keydown', 'KeyA');
    expect(kb.sample(BITS)).toMatchObject({ moveX: -1, moveY: -1 });
  });

  it('moves down with KeyS and right with KeyD', () => {
    const target = fakeTarget();
    const kb = createKeyboardInput(target);
    target.emit('keydown', 'KeyS');
    target.emit('keydown', 'KeyD');
    expect(kb.sample(BITS)).toMatchObject({ moveX: 1, moveY: 1 });
  });

  it('cancels all four arrows pressed at once', () => {
    const target = fakeTarget();
    const kb = createKeyboardInput(target);
    for (const code of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) target.emit('keydown', code);
    expect(kb.sample(BITS)).toMatchObject({ moveX: 0, moveY: 0 });
  });

  it.each(['Space', 'KeyJ'])('%s holds FIRE while down', (code) => {
    const target = fakeTarget();
    const kb = createKeyboardInput(target);
    target.emit('keydown', code);
    expect(kb.sample(BITS).buttons).toBe(BITS.FIRE);
    expect(kb.sample(BITS).buttons).toBe(BITS.FIRE);
    target.emit('keyup', code);
    expect(kb.sample(BITS).buttons).toBe(0);
  });

  it.each(['ShiftLeft', 'ShiftRight', 'KeyK'])('%s gives BOMB', (code) => {
    const target = fakeTarget();
    const kb = createKeyboardInput(target);
    target.emit('keydown', code);
    expect(kb.sample(BITS).buttons).toBe(BITS.BOMB);
  });

  it.each(['Escape', 'KeyP'])('%s gives PAUSE', (code) => {
    const target = fakeTarget();
    const kb = createKeyboardInput(target);
    target.emit('keydown', code);
    expect(kb.sample(BITS).buttons).toBe(BITS.PAUSE);
  });

  it('ORs several buttons together', () => {
    const target = fakeTarget();
    const kb = createKeyboardInput(target);
    target.emit('keydown', 'Space');
    target.emit('keydown', 'KeyK');
    expect(kb.sample(BITS).buttons).toBe(BITS.FIRE | BITS.BOMB);
  });

  it('takes bit values from the supplied table, not from constants in JS', () => {
    const target = fakeTarget();
    const kb = createKeyboardInput(target);
    target.emit('keydown', 'Space');
    expect(kb.sample({ FIRE: 64, BOMB: 128, PAUSE: 256 }).buttons).toBe(64);
  });

  it('a press and release between two samples is seen exactly once', () => {
    const target = fakeTarget();
    const kb = createKeyboardInput(target);
    target.emit('keydown', 'Space');
    target.emit('keyup', 'Space');
    expect(kb.sample(BITS).buttons).toBe(BITS.FIRE);
    expect(kb.sample(BITS).buttons).toBe(0);
  });

  it('prevents default on bound keys only', () => {
    const target = fakeTarget();
    createKeyboardInput(target);
    expect(target.emit('keydown', 'Space').prevented).toBe(true);
    expect(target.emit('keydown', 'ArrowUp').prevented).toBe(true);
    expect(target.emit('keydown', 'KeyQ').prevented).toBe(false);
    expect(target.emit('keydown', 'F5').prevented).toBe(false);
  });

  it('an unbound code changes nothing', () => {
    const target = fakeTarget();
    const kb = createKeyboardInput(target);
    target.emit('keydown', 'KeyQ');
    expect(kb.sample(BITS)).toEqual({ buttons: 0, moveX: 0, moveY: 0 });
  });

  it('calls onKeyDown for every keydown, bound or not, and never for keyup', () => {
    const target = fakeTarget();
    const codes = [];
    createKeyboardInput(target, { onKeyDown: (event) => codes.push(event.code) });
    target.emit('keydown', 'KeyD');
    target.emit('keydown', 'KeyQ');
    target.emit('keyup', 'KeyD');
    expect(codes).toEqual(['KeyD', 'KeyQ']);
  });

  it('clears all key state on blur, including pending press edges', () => {
    const target = fakeTarget();
    const kb = createKeyboardInput(target);
    target.emit('keydown', 'KeyD');
    target.emit('keydown', 'Space');
    target.emit('blur');
    expect(kb.sample(BITS)).toEqual({ buttons: 0, moveX: 0, moveY: 0 });
  });

  it('clears all key state on pagehide', () => {
    const target = fakeTarget();
    const kb = createKeyboardInput(target);
    target.emit('keydown', 'KeyD');
    target.emit('keydown', 'Space');
    target.emit('pagehide');
    expect(kb.sample(BITS)).toEqual({ buttons: 0, moveX: 0, moveY: 0 });
  });

  it('clears all key state when the document becomes hidden, but not when it becomes visible', () => {
    const target = fakeTarget();
    const doc = Object.assign(fakeTarget(), { visibilityState: 'visible' });
    target.document = doc;
    const kb = createKeyboardInput(target);
    target.emit('keydown', 'KeyD');
    doc.emit('visibilitychange');
    expect(kb.sample(BITS).moveX).toBe(1);
    doc.visibilityState = 'hidden';
    doc.emit('visibilitychange');
    expect(kb.sample(BITS)).toEqual({ buttons: 0, moveX: 0, moveY: 0 });
  });

  it('dispose() removes the pagehide and visibilitychange listeners too', () => {
    const target = fakeTarget();
    const doc = Object.assign(fakeTarget(), { visibilityState: 'visible' });
    target.document = doc;
    const kb = createKeyboardInput(target);
    expect(doc.listenerCount('visibilitychange')).toBe(1);
    kb.dispose();
    expect(doc.listenerCount('visibilitychange')).toBe(0);
    expect(target.listenerCount('pagehide')).toBe(0);
  });

  it('clear() drops held keys and press edges', () => {
    const target = fakeTarget();
    const kb = createKeyboardInput(target);
    target.emit('keydown', 'Space');
    kb.clear();
    expect(kb.sample(BITS).buttons).toBe(0);
  });

  it('dispose() removes every listener', () => {
    const target = fakeTarget();
    const kb = createKeyboardInput(target);
    kb.dispose();
    expect(['keydown', 'keyup', 'blur'].map((type) => target.listenerCount(type))).toEqual([0, 0, 0]);
  });
});
