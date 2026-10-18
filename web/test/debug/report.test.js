import { describe, expect, it, vi } from 'vitest';
import { buildReport, copyReport, readGlInfo } from '../../src/debug/report.js';
import { createFakeDocument } from '../helpers/fake_dom.js';

const FULL = {
  ua: 'TestAgent/1.0',
  screen: { width: 1170, height: 2532 },
  css: { width: 390, height: 844 },
  dpr: 3,
  effectiveDpr: 1.5,
  canvas: { width: 586, height: 1266 },
  glRenderer: 'Apple GPU',
  precision: 'highp (23 bits)',
  pyodide: '314.0.7',
  three: '0.186.1',
  build: 'abc1234',
  flags: { debug: true, stress: 500, tier: null, crash: null, weapon: null, level: null, god: false, bombs: null },
  tier: 'mid',
  lockReason: 'refresh-capped-or-cpu-bound',
  elapsedMin: 5.2,
  tierLog: [{ atMs: 3500, from: 'high', to: 'mid', reason: 'step-down' }],
  minutes: [
    { minute: 0, frames: 3000, avgFps: 59.8, p95FrameMs: 17.2, avgTickMs: 0.52, p95TickMs: 0.6 },
    { minute: 1, frames: 1700, avgFps: 28.3, p95FrameMs: 40.1, avgTickMs: 0.9, p95TickMs: 1.4 },
  ],
};

const lines = (text) => text.split('\n');
const hasLine = (text, prefix) => lines(text).some((line) => line.startsWith(prefix));

describe('buildReport', () => {
  it('contains every field the go/no-go decision needs', () => {
    const text = buildReport(FULL);
    for (const prefix of [
      'ua:',
      'screen:',
      'dpr:',
      'gl renderer:',
      'precision:',
      'pyodide: 314.0.7',
      'three: 0.186.1',
      'build:',
      'flags:',
      'tier log:',
    ]) {
      expect(hasLine(text, prefix), prefix).toBe(true);
    }
    expect(text).toContain('ua: TestAgent/1.0');
    expect(text).toContain('gl renderer: Apple GPU');
    expect(text).toContain('build: abc1234');
    expect(text).toContain('tier=auto');
    expect(text).toContain('stress=500');
  });

  describe('flags line', () => {
    const flagsOf = (flags) => lines(buildReport({ flags })).find((l) => l.startsWith('flags:'));

    it('lists every test flag, with default for the unset weapon, level and bombs', () => {
      expect(flagsOf({ debug: true, stress: 0, tier: null, crash: null })).toBe(
        'flags: debug=on stress=0 tier=auto crash=none weapon=default level=default god=off bombs=default',
      );
    });

    it('prints the values of a fully configured run', () => {
      const flags = {
        debug: true,
        stress: 0,
        tier: null,
        crash: null,
        weapon: 'laser',
        level: 3,
        god: false,
        bombs: 5,
      };
      expect(flagsOf(flags)).toBe(
        'flags: debug=on stress=0 tier=auto crash=none weapon=laser level=3 god=off bombs=5',
      );
    });

    it('prints god on, and a stock of zero as 0 rather than default', () => {
      const line = flagsOf({ debug: false, stress: 500, tier: 'low', crash: 'js', god: true, bombs: 0 });
      expect(line).toBe(
        'flags: debug=off stress=500 tier=low crash=js weapon=default level=default god=on bombs=0',
      );
    });
  });

  it('writes one "minute N:" line per aggregated minute', () => {
    const text = buildReport(FULL);
    const minuteLines = lines(text).filter((line) => line.startsWith('minute '));
    expect(minuteLines).toHaveLength(2);
    expect(minuteLines[0]).toContain('minute 0:');
    expect(minuteLines[0]).toContain('59.8');
    expect(minuteLines[0]).toContain('17.2');
    expect(minuteLines[1]).toContain('minute 1:');
  });

  it('lists the tier log with timestamps and reasons', () => {
    const text = buildReport(FULL);
    expect(text).toContain('3.5s');
    expect(text).toContain('high -> mid');
    expect(text).toContain('step-down');
    expect(text).toContain('refresh-capped-or-cpu-bound');
  });

  it('reports the time to the start gate in seconds', () => {
    expect(buildReport({ ...FULL, timeToGateMs: 4210 })).toContain('time to gate: 4.2 s');
  });

  it('shows n/a for the time to the start gate when it was not measured', () => {
    expect(buildReport(FULL)).toContain('time to gate: n/a');
  });

  it('renders missing optional fields as n/a, never undefined or NaN', () => {
    const text = buildReport({});
    expect(text).not.toMatch(/undefined|NaN|null/);
    expect(text).toContain('ua: n/a');
    expect(text).toContain('gl renderer: n/a');
    expect(text).toContain('precision: n/a');
    expect(text).toContain('tier log: none');
    expect(hasLine(text, 'minute ')).toBe(false);
  });
});

describe('readGlInfo', () => {
  const FRAGMENT = 0x8b30;
  const HIGH_FLOAT = 0x8df2;
  const RENDERER = 0x1f01;

  function fakeGl({ extension = null, highp = { precision: 23 }, renderer = 'ANGLE' } = {}) {
    return {
      FRAGMENT_SHADER: FRAGMENT,
      HIGH_FLOAT,
      RENDERER,
      getExtension: (name) => (name === 'WEBGL_debug_renderer_info' ? extension : null),
      getParameter: (p) => (p === 0x9246 ? 'Unmasked GPU' : renderer),
      getShaderPrecisionFormat: () => highp,
    };
  }

  it('prefers the unmasked renderer string', () => {
    const gl = fakeGl({ extension: { UNMASKED_RENDERER_WEBGL: 0x9246 } });
    expect(readGlInfo(gl)).toEqual({ renderer: 'Unmasked GPU', precision: 'highp (23 bits)' });
  });

  it('falls back to the RENDERER parameter, then to masked', () => {
    expect(readGlInfo(fakeGl({ renderer: 'WebKit WebGL' })).renderer).toBe('WebKit WebGL');
    expect(readGlInfo(fakeGl({ renderer: '' })).renderer).toBe('masked');
  });

  it('reports a missing highp fragment precision', () => {
    expect(readGlInfo(fakeGl({ highp: { precision: 0 } })).precision).toBe('highp unsupported');
    expect(readGlInfo(fakeGl({ highp: null })).precision).toBe('highp unsupported');
  });
});

describe('copyReport', () => {
  it('writes to the clipboard from inside the gesture and shows no textarea', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const doc = createFakeDocument({ clipboard: { writeText } });
    const how = await copyReport('hello', doc);
    expect(writeText).toHaveBeenCalledWith('hello');
    expect(how).toBe('clipboard');
    expect(doc.getElementById('report-text')).toBeNull();
  });

  it('calls clipboard.writeText synchronously, before any await', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const doc = createFakeDocument({ clipboard: { writeText } });
    copyReport('hello', doc); // not awaited on purpose
    expect(writeText).toHaveBeenCalledTimes(1);
  });

  it('falls back to a selected readonly textarea when the clipboard rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    const doc = createFakeDocument({ clipboard: { writeText } });
    const how = await copyReport('hello', doc);
    expect(how).toBe('textarea');
    const area = doc.getElementById('report-text');
    expect(area.tag).toBe('textarea');
    expect(area.value).toBe('hello');
    expect(area.readOnly).toBe(true);
    expect(area.focused).toBe(true);
    expect(area.selected).toBe(true);
  });

  it('falls back to the textarea when there is no clipboard API', async () => {
    const doc = createFakeDocument({ clipboard: undefined });
    expect(await copyReport('hello', doc)).toBe('textarea');
    expect(doc.getElementById('report-text').value).toBe('hello');
  });

  it('removes the textarea panel with its close button', async () => {
    const doc = createFakeDocument({ clipboard: undefined });
    await copyReport('hello', doc);
    const close = doc.getElementById('report-close');
    close.click();
    expect(doc.getElementById('report-text')).toBeNull();
    expect(doc.getElementById('report-close')).toBeNull();
  });
});
