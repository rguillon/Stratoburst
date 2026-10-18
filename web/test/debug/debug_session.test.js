import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDebugSession } from '../../src/debug/debug_session.js';
import { createFakeDocument } from '../helpers/fake_dom.js';

const SLOTS = { STEPS: 0, EBULLET_N: 1, PBULLET_N: 2, ENEMY_N: 3, KILLS: 4 };

function fakeRig() {
  const info = { autoReset: true, render: { calls: 7, triangles: 1234 }, reset: vi.fn() };
  const gl = {
    RENDERER: 1,
    FRAGMENT_SHADER: 2,
    HIGH_FLOAT: 3,
    getExtension: () => null,
    getParameter: () => 'Test GPU',
    getShaderPrecisionFormat: () => ({ precision: 23 }),
  };
  return {
    info,
    rig: {
      renderer: { info, getContext: () => gl },
      dpr: 1.5,
      pixels: { width: 800, height: 600 },
    },
  };
}

function setup(overrides = {}) {
  const doc = createFakeDocument();
  vi.stubGlobal('document', doc);
  const { rig, info } = fakeRig();
  const header = new Float32Array(8);
  header.set([2, 50, 6, 3, 7]);
  const session = createDebugSession({
    rig,
    pyodide: { _module: { HEAPU8: { length: 32 * 1024 * 1024 } } },
    header,
    slots: SLOTS,
    flags: { tier: null },
    tierLog: [],
    getTier: () => 'high',
    getLockReason: () => null,
    versions: { build: 'abc1234', pyodide: '314', three: '0.186.1' },
    startMs: 0,
    timeToGateMs: 1500,
    ...overrides,
  });
  return { doc, rig, info, header, session };
}

beforeEach(() => vi.spyOn(performance, 'now').mockReturnValue(1000));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('createDebugSession', () => {
  it('turns off the renderer info auto reset so passes of one frame accumulate', () => {
    const { info } = setup();
    expect(info.autoReset).toBe(false);
  });

  it('mounts the overlay and exposes the build id as an e2e hook', () => {
    const { doc, session } = setup();
    expect(doc.getElementById('debug-overlay')).not.toBeNull();
    expect(session.hooks.build).toBe('abc1234');
  });

  it('record() reads the draw counters once per frame and then resets the renderer info', () => {
    const { info, session } = setup();

    session.record({ frameMs: 16.7, tickMs: 1, renderMs: 2, nowMs: 1000 });

    expect(info.reset).toHaveBeenCalledTimes(1);
    const summary = session.hooks.stats();
    expect(summary.frame.avg).toBeCloseTo(16.7);
  });

  it('writes the whole-frame draw calls, bullet counts and tier into the overlay text', () => {
    const { doc, session } = setup();

    session.record({ frameMs: 16.7, tickMs: 1, renderMs: 2, nowMs: 1000 });

    const text = doc.getElementById('debug-overlay').textContent;
    expect(text).toContain('draw calls 7   triangles 1234');
    expect(text).toContain('bullets 50 (player 6)   enemies 3   kills 7');
    expect(text).toContain('tier high   dpr 1.50   canvas 800x600');
    expect(text).toContain('wasm heap 32.0 MB');
    expect(text).toContain('build abc1234');
  });

  it('shows the lock reason next to the tier once the controller locked', () => {
    const { doc, session } = setup({ getLockReason: () => 'forced' });

    session.record({ frameMs: 16.7, tickMs: 1, renderMs: 2, nowMs: 1000 });

    expect(doc.getElementById('debug-overlay').textContent).toContain('tier high (locked: forced)');
  });

  it('prints n/a for header slots the manifest does not publish', () => {
    const { doc, session } = setup({ slots: { STEPS: 0 } });

    session.record({ frameMs: 16.7, tickMs: 1, renderMs: 2, nowMs: 1000 });

    expect(doc.getElementById('debug-overlay').textContent).toContain('bullets n/a (player n/a)   enemies n/a   kills n/a');
  });

  it('does not sample a frame without a delta (first frame or first after a resume)', () => {
    const { info, session } = setup();

    session.record({ frameMs: 0, tickMs: 1, renderMs: 2, nowMs: 1000 });

    expect(info.reset).toHaveBeenCalledTimes(1); // the draw counters are still consumed
    expect(session.hooks.stats().frame.avg).toBe(0);
  });

  it('reportText() includes the build, tier and time to gate', () => {
    const { session } = setup();

    const report = session.reportText();

    expect(report).toContain('Scorched device report');
    expect(report).toContain('build: abc1234');
    expect(report).toContain('tier: high');
    expect(report).toContain('time to gate: 1.5 s');
    expect(report).toContain('gl renderer: Test GPU');
  });

  it('feeds the getAudioState value into the report text', () => {
    const { session } = setup({ getAudioState: () => 'suspended' });

    expect(session.reportText()).toContain(
      'audio: suspended (no sound on iPhone? check the silent switch)',
    );
  });

  it('reads the audio state afresh on every report', () => {
    let state = 'suspended';
    const { session } = setup({ getAudioState: () => state });
    expect(session.reportText()).toContain('audio: suspended');

    state = 'running';

    expect(session.reportText()).toContain('audio: running');
  });

  it('reports the audio state as n/a when no getAudioState is given', () => {
    const { session } = setup();

    expect(session.reportText()).toContain('audio: n/a');
  });

  it('copies the report when the overlay button is clicked', () => {
    const clipboard = { writeText: vi.fn(async () => {}) };
    const doc = createFakeDocument({ clipboard });
    vi.stubGlobal('document', doc);
    const { rig } = fakeRig();
    createDebugSession({
      rig,
      pyodide: {},
      header: new Float32Array(8),
      slots: SLOTS,
      flags: {},
      tierLog: [],
      getTier: () => 'mid',
      getLockReason: () => null,
      versions: { build: 'dev', pyodide: '314', three: '0.186.1' },
      startMs: 0,
      timeToGateMs: 1,
    });

    doc.getElementById('copy-report').click();

    expect(clipboard.writeText).toHaveBeenCalledTimes(1);
    expect(clipboard.writeText.mock.calls[0][0]).toContain('tier: mid');
  });
});
