import { describe, expect, it, vi } from 'vitest';
import { warmUp } from '../../src/python/python_bridge.js';

const MANIFEST = {
  header: { len: 4 },
  channels: { pbullets: { stride: 2, cap: 3 }, ebullets: { stride: 4, cap: 5 } },
};

function fakePyodide() {
  const calls = { destroyed: [], attached: [], created: [], ticks: [] };
  const track = (name) => ({ destroy: () => calls.destroyed.push(name) });
  const tick = Object.assign((...args) => calls.ticks.push(args), track('tick'));
  const game = {
    ...track('game'),
    manifest: () => ({ ...track('manifest'), toJs: () => MANIFEST }),
    attach: (name, array) => calls.attached.push([name, array.length]),
    tick,
  };
  const entry = {
    ...track('entry'),
    create_game: (options) => {
      calls.created.push(options);
      return game;
    },
  };
  const pyodide = {
    pyimport: vi.fn(() => entry),
    toPy: (options) => ({ ...track('options'), options }),
  };
  return { pyodide, calls };
}

describe('warmUp', () => {
  it('runs the requested number of ticks at 60 Hz with no input', () => {
    const { pyodide, calls } = fakePyodide();

    warmUp(pyodide, { seed: 1, stress: 0, crash: null }, 120);

    expect(calls.ticks).toHaveLength(120);
    expect(calls.ticks[0]).toEqual([1000 / 60, 0, 0, 0, 0, 0]);
  });

  it('defaults to 120 ticks', () => {
    const { pyodide, calls } = fakePyodide();

    warmUp(pyodide, { seed: 1, stress: 0, crash: null });

    expect(calls.ticks).toHaveLength(120);
  });

  it('builds the throwaway game from the options it was given', () => {
    const { pyodide, calls } = fakePyodide();
    const options = { seed: 1, stress: 500, crash: null };

    warmUp(pyodide, options, 1);

    expect(calls.created).toHaveLength(1);
    expect(calls.created[0].options).toBe(options);
  });

  it('attaches scratch arrays sized from the manifest', () => {
    const { pyodide, calls } = fakePyodide();

    warmUp(pyodide, { seed: 1 }, 1);

    expect(calls.attached).toEqual([
      ['header', 4],
      ['pbullets', 6],
      ['ebullets', 20],
    ]);
  });

  it('destroys every proxy it created', () => {
    const { pyodide, calls } = fakePyodide();

    warmUp(pyodide, { seed: 1 }, 1);

    expect(calls.destroyed.sort()).toEqual(['entry', 'game', 'manifest', 'options', 'tick']);
  });

  it('still destroys the game and options proxies when a tick throws', () => {
    const { pyodide, calls } = fakePyodide();
    const failing = fakePyodide();
    failing.pyodide.pyimport = () => ({
      destroy: () => failing.calls.destroyed.push('entry'),
      create_game: () => ({
        destroy: () => failing.calls.destroyed.push('game'),
        manifest: () => ({ destroy() {}, toJs: () => MANIFEST }),
        attach() {},
        tick: () => {
          throw new Error('python fault');
        },
      }),
    });

    expect(() => warmUp(failing.pyodide, { seed: 1 }, 5)).toThrow('python fault');
    expect(failing.calls.destroyed.sort()).toEqual(['entry', 'game', 'options']);
    expect(calls.destroyed).toEqual([]);
  });
});
