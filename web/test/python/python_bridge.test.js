import { describe, expect, it, vi } from 'vitest';
import { PY_SOURCES, installSources, startGame, warmUp } from '../../src/python/python_bridge.js';

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

// A fake Pyodide FS and sys.path that record what installSources does to them.
function fakeFilesystem() {
  const log = { dirs: [], files: {}, sysPath: [] };
  const pyodide = {
    FS: {
      mkdirTree: (dir) => log.dirs.push(dir),
      writeFile: (path, text) => {
        log.files[path] = text;
      },
    },
    pyimport: (name) => {
      expect(name).toBe('sys');
      return { path: { insert: (index, value) => log.sysPath.push([index, value]) } };
    },
  };
  return { pyodide, log };
}

describe('PY_SOURCES', () => {
  it('bundles the game sources under /src, including both packages', () => {
    const keys = Object.keys(PY_SOURCES);
    expect(keys).toContain('/src/scorched_core/game/game.py');
    expect(keys).toContain('/src/scorched_web/entrypoint.py');
    expect(keys.every((key) => key.startsWith('/src/') && key.endsWith('.py'))).toBe(true);
  });
});

describe('installSources', () => {
  it('maps /src/<pkg>/... to /lib/<pkg>/... and creates the parent directory first', () => {
    const { pyodide, log } = fakeFilesystem();

    installSources(pyodide, {
      '/src/scorched_core/game/game.py': 'GAME',
      '/src/scorched_web/entrypoint.py': 'ENTRY',
    });

    expect(log.files).toEqual({
      '/lib/scorched_core/game/game.py': 'GAME',
      '/lib/scorched_web/entrypoint.py': 'ENTRY',
    });
    expect(log.dirs).toEqual(['/lib/scorched_core/game', '/lib/scorched_web']);
  });

  it('puts /lib at the front of sys.path exactly once', () => {
    const { pyodide, log } = fakeFilesystem();

    installSources(pyodide, { '/src/a/b.py': 'x', '/src/a/c.py': 'y' });

    expect(log.sysPath).toEqual([[0, '/lib']]);
  });

  it('still prepares sys.path when there is nothing to write', () => {
    const { pyodide, log } = fakeFilesystem();

    installSources(pyodide, {});

    expect(log.files).toEqual({});
    expect(log.sysPath).toEqual([[0, '/lib']]);
  });
});

describe('startGame', () => {
  const GAME_MANIFEST = {
    protocol: 3,
    header: { len: 64, slots: { STEPS: 0, ALPHA: 2, EVENT_N: 12 } },
    channels: {
      pbullets: { stride: 4, cap: 64 },
      ebullets: { stride: 4, cap: 600 },
      events: { stride: 6, cap: 128 },
    },
  };

  function fakeGamePyodide(manifest = GAME_MANIFEST) {
    const calls = { attached: [], destroyed: [], writes: 0 };
    const tick = () => {};
    const restart = () => {};
    const game = {
      manifest: () => ({ destroy: () => calls.destroyed.push('manifest'), toJs: () => manifest }),
      attach: (name, array) => calls.attached.push([name, array]),
      tick,
      restart,
    };
    const pyodide = {
      FS: { mkdirTree() {}, writeFile: () => (calls.writes += 1) },
      pyimport: (name) =>
        name === 'sys' ? { path: { insert() {} } } : { create_game: () => game },
      toPy: (options) => options,
    };
    return { pyodide, calls, game, tick, restart };
  }

  it('installs the sources, then allocates one Float32Array per channel sized stride * cap', async () => {
    const { pyodide, calls } = fakeGamePyodide();

    const started = await startGame(pyodide, { seed: 1 });

    expect(calls.writes).toBe(Object.keys(PY_SOURCES).length);
    expect(started.header).toBeInstanceOf(Float32Array);
    expect(started.header.length).toBe(64);
    expect(started.channels.pbullets.length).toBe(4 * 64);
    expect(started.channels.ebullets.length).toBe(4 * 600);
    expect(started.channels.events.length).toBe(6 * 128);
  });

  it('attaches the header first, then each channel in manifest order, with the same arrays', async () => {
    const { pyodide, calls } = fakeGamePyodide();

    const started = await startGame(pyodide, { seed: 1 });

    expect(calls.attached.map(([name]) => name)).toEqual([
      'header',
      'pbullets',
      'ebullets',
      'events',
    ]);
    expect(calls.attached[0][1]).toBe(started.header);
    expect(calls.attached[1][1]).toBe(started.channels.pbullets);
    expect(calls.attached[2][1]).toBe(started.channels.ebullets);
    expect(calls.attached[3][1]).toBe(started.channels.events);
  });

  it('returns the manifest, its header slots, the game and the held tick function', async () => {
    const { pyodide, game, tick } = fakeGamePyodide();

    const started = await startGame(pyodide, { seed: 1 });

    expect(started.manifest).toBe(GAME_MANIFEST);
    expect(started.slots).toBe(GAME_MANIFEST.header.slots);
    expect(started.game).toBe(game);
    expect(started.tick).toBe(tick);
  });

  it('holds the restart function once, next to tick, so no proxy is looked up per call', async () => {
    const { pyodide, game, restart } = fakeGamePyodide();

    const started = await startGame(pyodide, { seed: 1 });

    expect(started.restart).toBe(restart);
    expect(started.restart).toBe(game.restart);
  });

  it('destroys the manifest proxy once it has been converted', async () => {
    const { pyodide, calls } = fakeGamePyodide();

    await startGame(pyodide, { seed: 1 });

    expect(calls.destroyed).toEqual(['manifest']);
  });

  it.each([1, 2, 4])(
    'rejects protocol version %i before allocating or attaching anything',
    async (protocol) => {
      const { pyodide, calls } = fakeGamePyodide({ ...GAME_MANIFEST, protocol });

      await expect(startGame(pyodide, { seed: 1 })).rejects.toThrow(
        `Unsupported protocol version ${protocol} (expected 3)`,
      );
      expect(calls.attached).toEqual([]);
    },
  );
});
