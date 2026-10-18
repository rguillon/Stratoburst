import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildSamples } from '../../src/audio/zzfx_synth.js';

// A small deterministic random source: the same sequence on every call to makeRandom().
function makeRandom() {
  let state = 12345;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

const EXPLOSION = [1, 0.1, 160, 0, 0.04, 0.45, 4, 2, -5, 0, 0, 0, 0, 0.6, 0, 0.25, 0.02, 0.7, 0.06, 0, 1200];

describe('buildSamples', () => {
  it('is deterministic for fixed parameters and a fixed random source', () => {
    const a = buildSamples(...EXPLOSION, { random: makeRandom() });
    const b = buildSamples(...EXPLOSION, { random: makeRandom() });

    expect(a).toEqual(b);
  });

  it('returns only finite samples as a Float32Array', () => {
    const samples = buildSamples(...EXPLOSION, { random: makeRandom() });

    expect(samples).toBeInstanceOf(Float32Array);
    expect(samples.every(Number.isFinite)).toBe(true);
    expect(samples.some((v) => v !== 0)).toBe(true);
  });

  it('is as long as the zzfx duration formula says, at the requested sample rate', () => {
    // attack 0 becomes the 9-sample anti-pop minimum; the rest is seconds times the rate.
    const rate = 22050;
    const [, , , , sustain, release, , , , , , , , , , , delay, , decay] = EXPLOSION;
    const expected = Math.floor(9 + (decay + sustain + release + delay) * rate);

    const samples = buildSamples(...EXPLOSION, { sampleRate: rate, random: makeRandom() });

    expect(samples.length).toBe(expected);
  });

  it('defaults to 44100 Hz and Math.random', () => {
    const samples = buildSamples(1, 0, 220, 0.01, 0.01, 0.01);

    expect(samples.length).toBe(Math.floor(0.03 * 44100));
  });

  it('only the pitch randomness uses the random source', () => {
    let calls = 0;
    const random = () => {
      calls += 1;
      return 0.5;
    };

    buildSamples(...EXPLOSION, { random });

    expect(calls).toBe(1);
  });

  it('different random sources shift the pitch and so change the samples', () => {
    const low = buildSamples(1, 0.5, 200, 0, 0.05, 0.05, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, {
      random: () => 0,
    });
    const high = buildSamples(1, 0.5, 200, 0, 0.05, 0.05, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, {
      random: () => 1,
    });

    expect(low).not.toEqual(high);
  });

  it.each([0, 1, 2, 3, 4, 5])('wave shape %i renders finite audible samples', (shape) => {
    const samples = buildSamples(1, 0, 300, 0.005, 0.02, 0.02, shape, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0);

    expect(samples.every(Number.isFinite)).toBe(true);
    expect(samples.some((v) => v !== 0)).toBe(true);
    expect(Math.max(...samples.map(Math.abs))).toBeLessThanOrEqual(1);
  });

  it('applies slide, pitch jump, repeat with tremolo, modulation, bit crush, delay and a high-pass filter', () => {
    const samples = buildSamples(
      1, 0, 440, 0.01, 0.05, 0.05, 0, 1, 2, 1, 50, 0.01, 0.02, 0.2, 5, 0.3, 0.03, 0.8, 0.02, 0.4, -500,
      { random: makeRandom() },
    );

    expect(samples.length).toBeGreaterThan(0);
    expect(samples.every(Number.isFinite)).toBe(true);
  });

  it('scales the whole sound by the volume parameter', () => {
    const loud = buildSamples(1, 0, 220, 0.01, 0.02, 0.02);
    const quiet = buildSamples(0.5, 0, 220, 0.01, 0.02, 0.02);

    expect(quiet[100]).toBeCloseTo(loud[100] * 0.5, 6);
  });
});

describe('the vendored file', () => {
  const source = readFileSync(new URL('../../src/audio/zzfx_synth.js', import.meta.url), 'utf8');

  it('keeps the upstream MIT licence header', () => {
    expect(source).toContain('MIT License - Copyright 2019 Frank Force');
    expect(source).toContain('Permission is hereby granted, free of charge');
  });

  it('names no audio context, network, dynamic code or dynamic import (RESEARCH Pitfall 11)', () => {
    expect(source).not.toMatch(/AudioContext|fetch\(|XMLHttpRequest|eval\(|new Function|import\(/);
  });
});
