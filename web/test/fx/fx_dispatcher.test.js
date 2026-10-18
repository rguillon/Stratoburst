import { describe, expect, it } from 'vitest';
import { createFxDispatcher } from '../../src/fx/fx_dispatcher.js';

function recorder() {
  const calls = [];
  return { calls, handle: (...args) => calls.push(args) };
}

// Two events at stride 6: (type, x, y, a, b, c).
const DATA = new Float32Array([1, 10, 20, 0, 1, 7, 2, 30, 40, 5, 0, 9]);

describe('createFxDispatcher', () => {
  it('decodes each event once and calls every handler with (type, x, y, a, b, c)', () => {
    const first = recorder();
    const second = recorder();
    createFxDispatcher({ handlers: [first, second] }).dispatch(DATA, 2);
    expect(first.calls).toEqual([
      [1, 10, 20, 0, 1, 7],
      [2, 30, 40, 5, 0, 9],
    ]);
    expect(second.calls).toEqual(first.calls);
  });

  it('clamps a count larger than the channel to what the array holds', () => {
    const handler = recorder();
    createFxDispatcher({ handlers: [handler] }).dispatch(DATA, 1000);
    expect(handler.calls).toHaveLength(2);
  });

  it('calls nothing for a count of zero', () => {
    const handler = recorder();
    createFxDispatcher({ handlers: [handler] }).dispatch(DATA, 0);
    expect(handler.calls).toEqual([]);
  });

  it('casts the type to an integer', () => {
    const handler = recorder();
    const data = new Float32Array([2.0000002, 0, 0, 0, 0, 0]);
    createFxDispatcher({ handlers: [handler] }).dispatch(data, 1);
    expect(handler.calls[0][0]).toBe(2);
  });

  it('appends handlers with add and works with none', () => {
    const dispatcher = createFxDispatcher();
    expect(() => dispatcher.dispatch(DATA, 2)).not.toThrow();
    const late = recorder();
    dispatcher.add(late);
    dispatcher.dispatch(DATA, 1);
    expect(late.calls).toHaveLength(1);
  });
});
