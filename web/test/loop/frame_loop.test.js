import { describe, expect, it, vi } from 'vitest';
import { createFrameLoop } from '../../src/loop/frame_loop.js';

function fakeRaf() {
  let next = 1;
  const queue = new Map();
  return {
    raf: (cb) => {
      queue.set(next, cb);
      return next++;
    },
    caf: (id) => queue.delete(id),
    pending: () => queue.size,
    flush(ts) {
      const [[id, cb]] = [...queue.entries()];
      queue.delete(id);
      cb(ts);
    },
  };
}

describe('createFrameLoop', () => {
  it('passes dt 0 first, then the timestamp difference', () => {
    const clock = fakeRaf();
    const dts = [];
    const loop = createFrameLoop({ onFrame: (dt) => dts.push(dt), onError: vi.fn(), ...clock });
    loop.start();
    clock.flush(1000);
    clock.flush(1016.5);
    expect(dts).toEqual([0, 16.5]);
    expect(loop.isRunning()).toBe(true);
  });

  it('resetClock makes the next dt 0', () => {
    const clock = fakeRaf();
    const dts = [];
    const loop = createFrameLoop({ onFrame: (dt) => dts.push(dt), onError: vi.fn(), ...clock });
    loop.start();
    clock.flush(0);
    clock.flush(16);
    loop.resetClock();
    clock.flush(5000);
    expect(dts).toEqual([0, 16, 0]);
  });

  it('stops and reports once when onFrame throws', () => {
    const clock = fakeRaf();
    const onError = vi.fn();
    const boom = new Error('boom');
    const loop = createFrameLoop({
      onFrame: () => {
        throw boom;
      },
      onError,
      ...clock,
    });
    loop.start();
    clock.flush(0);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(boom);
    expect(clock.pending()).toBe(0);
    expect(loop.isRunning()).toBe(false);
  });

  it('stop cancels the scheduled frame', () => {
    const clock = fakeRaf();
    const loop = createFrameLoop({ onFrame: vi.fn(), onError: vi.fn(), ...clock });
    loop.start();
    loop.stop();
    expect(clock.pending()).toBe(0);
    expect(loop.isRunning()).toBe(false);
  });
});
