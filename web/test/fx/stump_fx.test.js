import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/fx/explosion_fx.js';
import { PALETTE } from '../../src/fx/palette.js';
import {
  FLAME_INTERVAL,
  MAX_DT,
  SMOKE_INTERVAL,
  createStumpFx,
  stumpKindsFor,
} from '../../src/fx/stump_fx.js';

const STRIDE = 8;
const KIND = { TANK: 3, TRAIN: 5, TRAIN_TURRET: 6, TRAIN_STUMP: 7 };
const STUMP_KINDS = new Set([KIND.TRAIN_STUMP]);
const GROUND_KINDS = new Set([KIND.TANK, KIND.TRAIN, KIND.TRAIN_TURRET, KIND.TRAIN_STUMP]);

// A fake particle layer that records every emit as { x, y, z, vx, vy, vz, life, size0, size1, r, g, b, gravity }.
function fakeLayer() {
  const calls = [];
  return {
    calls,
    emit(...args) {
      const [x, y, z, vx, vy, vz, life, size0, size1, r, g, b, gravity] = args;
      calls.push({ x, y, z, vx, vy, vz, life, size0, size1, r, g, b, gravity });
    },
  };
}

// An enemies channel with one row per [kind, x, y].
function channel(rows, capacity = 8) {
  const data = new Float32Array(capacity * STRIDE);
  rows.forEach(([kind, x, y], i) => {
    data[i * STRIDE] = x;
    data[i * STRIDE + 1] = y;
    data[i * STRIDE + 5] = kind;
  });
  return data;
}

function build({ rows = [[KIND.TRAIN_STUMP, 100, 120]], scale = 1, capacity = 8, seed = 7, groundKinds = GROUND_KINDS } = {}) {
  const layers = { additive: fakeLayer(), normal: fakeLayer() };
  const asked = [];
  const state = { scale };
  const fx = createStumpFx({
    data: channel(rows, capacity),
    capacity,
    stumpKinds: STUMP_KINDS,
    groundKinds,
    layers,
    getScale: () => state.scale,
    toWorld: (x, y, ground, out) => {
      asked.push({ x, y, ground });
      return out.set(x - 120, 0, y - 160);
    },
    rng: mulberry32(seed),
  });
  return { fx, layers, asked, state, n: rows.length };
}

describe('stumpKindsFor', () => {
  it('keeps the kind values whose manifest name ends in _STUMP', () => {
    const kinds = { JET: 0, TRAIN: 5, TRAIN_TURRET: 6, TRAIN_STUMP: 7, BOMBER_STUMP: 9, STUMPY: 10 };
    expect(stumpKindsFor(kinds)).toEqual(new Set([7, 9]));
  });

  it('is empty for a manifest with no stump kind', () => {
    expect(stumpKindsFor({ JET: 0, TANK: 3 })).toEqual(new Set());
  });
});

describe('createStumpFx', () => {
  it('emits nothing before a smoke interval has passed', () => {
    const { fx, layers, n } = build();
    fx.update(n, SMOKE_INTERVAL * 0.9);
    expect(layers.normal.calls).toHaveLength(0);
    expect(layers.additive.calls).toHaveLength(0);
    expect(fx.emitted).toBe(0);
  });

  it('puffs smoke on the normal layer once per smoke interval from a live stump', () => {
    const { fx, layers, n } = build();
    fx.update(n, SMOKE_INTERVAL);
    expect(layers.normal.calls).toHaveLength(1);
    fx.update(n, SMOKE_INTERVAL);
    expect(layers.normal.calls).toHaveLength(2);
  });

  it('throws a flame on the additive layer once per flame interval, in the fire colour', () => {
    const { fx, layers, n } = build();
    fx.update(n, FLAME_INTERVAL);
    expect(layers.additive.calls).toHaveLength(1);
    const [flame] = layers.additive.calls;
    expect([flame.r, flame.g, flame.b]).toEqual(PALETTE.FIRE.rgb);
    expect(flame.vy).toBeGreaterThan(0);
  });

  it('makes dark smoke that rises', () => {
    const { fx, layers, n } = build();
    fx.update(n, SMOKE_INTERVAL);
    const [puff] = layers.normal.calls;
    expect(Math.max(puff.r, puff.g, puff.b)).toBeLessThan(0.3);
    expect(puff.gravity).toBeLessThan(0);
    expect(puff.vy).toBeGreaterThan(0);
  });

  it('keeps smouldering for as long as the stump lives, with no flame window', () => {
    const { fx, layers, n } = build();
    for (let i = 0; i < 600; i += 1) fx.update(n, 0.1); // a minute
    // 60 s of play at the unscaled rate: the late flames still come at the flame rate.
    const expected = Math.floor(60 / FLAME_INTERVAL);
    expect(layers.additive.calls.length).toBeGreaterThanOrEqual(expected - 2);
    expect(layers.additive.calls.length).toBeLessThanOrEqual(expected + 2);
  });

  it('emits from every live stump row', () => {
    const { fx, layers, n } = build({
      rows: [
        [KIND.TRAIN_STUMP, 100, 100],
        [KIND.TRAIN_STUMP, 140, 140],
      ],
    });
    fx.update(n, SMOKE_INTERVAL);
    expect(layers.normal.calls).toHaveLength(2);
  });

  it('ignores rows that are not stumps', () => {
    const { fx, layers, n } = build({
      rows: [
        [KIND.TRAIN, 100, 100],
        [KIND.TRAIN_TURRET, 100, 78],
        [KIND.TANK, 60, 200],
      ],
    });
    fx.update(n, 1);
    expect(layers.normal.calls).toHaveLength(0);
    expect(layers.additive.calls).toHaveLength(0);
  });

  it('reads only the first n rows', () => {
    const rows = [
      [KIND.TRAIN, 100, 100],
      [KIND.TRAIN_STUMP, 100, 100],
    ];
    const { fx, layers } = build({ rows });
    fx.update(1, 1);
    expect(layers.normal.calls).toHaveLength(0);
    fx.update(2, 1);
    expect(layers.normal.calls.length).toBeGreaterThan(0);
  });

  it('never reads past the channel capacity, however large n is', () => {
    const { fx, layers } = build({ rows: [[KIND.TRAIN_STUMP, 100, 100]], capacity: 1 });
    expect(() => fx.update(500, SMOKE_INTERVAL)).not.toThrow();
    expect(layers.normal.calls).toHaveLength(1);
  });

  it('scales the rate by the tier particle scale', () => {
    const full = build({ scale: 1 });
    const half = build({ scale: 0.5 });
    for (let i = 0; i < 100; i += 1) {
      full.fx.update(full.n, 0.05);
      half.fx.update(half.n, 0.05);
    }
    const ratio = half.layers.normal.calls.length / full.layers.normal.calls.length;
    expect(ratio).toBeGreaterThan(0.45);
    expect(ratio).toBeLessThan(0.55);
  });

  it('emits nothing at a particle scale of 0', () => {
    const { fx, layers, n } = build({ scale: 0 });
    for (let i = 0; i < 50; i += 1) fx.update(n, 0.1);
    expect(layers.normal.calls).toHaveLength(0);
    expect(layers.additive.calls).toHaveLength(0);
  });

  it('counts a frame longer than MAX_DT as MAX_DT, so a tab returning never bursts a backlog', () => {
    expect(MAX_DT).toBe(0.25);
    const long = build();
    const clamped = build();
    long.fx.update(long.n, 30);
    clamped.fx.update(clamped.n, MAX_DT);
    expect(long.layers.normal.calls).toHaveLength(clamped.layers.normal.calls.length);
    expect(long.layers.additive.calls).toHaveLength(clamped.layers.additive.calls.length);
    expect(long.layers.normal.calls.length).toBeLessThanOrEqual(2);
  });

  it('emits nothing and keeps its place while paused (dt 0), or for a bad dt', () => {
    const { fx, layers, n } = build();
    fx.update(n, SMOKE_INTERVAL * 0.6);
    for (let i = 0; i < 30; i += 1) fx.update(n, 0);
    fx.update(n, -1);
    fx.update(n, Number.NaN);
    expect(layers.normal.calls).toHaveLength(0);
    fx.update(n, SMOKE_INTERVAL * 0.5); // 0.6 + 0.5 of an interval: the held time counts
    expect(layers.normal.calls).toHaveLength(1);
  });

  it('does not burst when a stump appears after a long time with none', () => {
    const rows = [[KIND.TRAIN, 100, 100]];
    const layers = { additive: fakeLayer(), normal: fakeLayer() };
    const data = channel(rows);
    const fx = createStumpFx({
      data,
      capacity: 8,
      stumpKinds: STUMP_KINDS,
      groundKinds: GROUND_KINDS,
      layers,
      getScale: () => 1,
      toWorld: (x, y, ground, out) => out.set(x, 0, y),
      rng: mulberry32(1),
    });
    for (let i = 0; i < 200; i += 1) fx.update(1, 0.1);
    data[5] = KIND.TRAIN_STUMP; // the hull row's slot now holds a stump
    fx.update(1, 0.016);
    expect(layers.normal.calls).toHaveLength(0);
    expect(layers.additive.calls).toHaveLength(0);
  });

  it('places a ground stump through the ground-layer projection, above the deck', () => {
    const { fx, layers, asked, n } = build({ rows: [[KIND.TRAIN_STUMP, 100, 120]] });
    fx.update(n, SMOKE_INTERVAL);
    expect(asked).toEqual([{ x: 100, y: 120, ground: true }]);
    const [puff] = layers.normal.calls;
    expect(puff.x).toBeCloseTo(-20, 0);
    expect(puff.z).toBeCloseTo(-40, 0);
    expect(puff.y).toBeGreaterThan(5);
  });

  it('places a stump kind that is not a ground kind through the air projection', () => {
    const { fx, asked, n } = build({ groundKinds: new Set() });
    fx.update(n, SMOKE_INTERVAL);
    expect(asked).toEqual([{ x: 100, y: 120, ground: false }]);
  });

  it('is deterministic: the same seed gives the same particles', () => {
    const run = () => {
      const { fx, layers, n } = build({ seed: 99 });
      for (let i = 0; i < 40; i += 1) fx.update(n, 0.05);
      return [layers.normal.calls, layers.additive.calls];
    };
    expect(run()).toEqual(run());
  });

  it('counts what it emitted', () => {
    const { fx, layers, n } = build();
    for (let i = 0; i < 40; i += 1) fx.update(n, 0.05);
    expect(fx.emitted).toBe(layers.normal.calls.length + layers.additive.calls.length);
    expect(fx.emitted).toBeGreaterThan(0);
  });
});
