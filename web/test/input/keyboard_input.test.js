import { describe, expect, it } from 'vitest';
import { KEY_BINDINGS, reduceKey } from '../../src/input/keyboard_input.js';

const axisX = (held) => (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);

describe('reduceKey', () => {
  it('binds the four arrows', () => {
    expect([...KEY_BINDINGS.keys()]).toEqual(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  });

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
});
