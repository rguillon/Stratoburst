import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/fx/explosion_fx.js';
import { PALETTE } from '../../src/fx/palette.js';
import { FLAME_INTERVAL, MAX_DT, SMOKE_INTERVAL, createFirePlumes } from '../../src/fx/fire_plumes.js';

// A fake particle layer that records every emit.
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

function build({ scale = 1, drift = 0, seed = 11 } = {}) {
  const layers = { additive: fakeLayer(), normal: fakeLayer() };
  const asked = [];
  const state = { scale, drift };
  const plumes = createFirePlumes({
    layers,
    getScale: () => state.scale,
    getDrift: () => state.drift,
    toWorld: (x, y, out) => {
      asked.push({ x, y });
      return out.set(x - 120, -40, y - 160);
    },
    rng: mulberry32(seed),
  });
  return { plumes, layers, asked, state };
}

const POSITIONS = Float32Array.from([60, 100, 180, 140, 5, 5]);

describe('createFirePlumes', () => {
  it('emits nothing before an interval has passed', () => {
    const { plumes, layers } = build();
    plumes.update(POSITIONS, 2, Math.min(SMOKE_INTERVAL, FLAME_INTERVAL) * 0.9);
    expect(layers.normal.calls).toHaveLength(0);
    expect(layers.additive.calls).toHaveLength(0);
    expect(plumes.emitted).toBe(0);
  });

  it('puffs smoke on the normal layer, one per fire per smoke interval, in the smoke colour', () => {
    const { plumes, layers } = build();
    plumes.update(POSITIONS, 2, SMOKE_INTERVAL);
    expect(layers.normal.calls).toHaveLength(2);
    for (const puff of layers.normal.calls) {
      expect([puff.r, puff.g, puff.b]).toEqual(PALETTE.SMOKE.rgb);
      expect(puff.vy).toBeGreaterThan(0);
    }
  });

  it('throws flames on the additive layer, one per fire per flame interval, in the fire colour', () => {
    const { plumes, layers } = build();
    plumes.update(POSITIONS, 2, FLAME_INTERVAL);
    expect(layers.additive.calls).toHaveLength(2);
    for (const flame of layers.additive.calls) {
      expect([flame.r, flame.g, flame.b]).toEqual(PALETTE.FIRE.rgb);
      expect(flame.vy).toBeGreaterThan(0);
    }
  });

  it('emits from the ground position of each fire in the count and ignores the rest of the array', () => {
    const { plumes, layers, asked } = build();
    plumes.update(POSITIONS, 2, SMOKE_INTERVAL);
    expect(asked.slice(0, 2)).toEqual([
      { x: 60, y: 100 },
      { x: 180, y: 140 },
    ]);
    expect(asked.every((a) => a.x !== 5)).toBe(true);
    // The first fire sits at world (-60, -40, -60) and its puffs start above it.
    expect(layers.normal.calls[0].x).toBeCloseTo(-60);
    expect(layers.normal.calls[0].z).toBeCloseTo(-60);
    expect(layers.normal.calls[0].y).toBeGreaterThan(-40);
  });

  it('rises through the plume with the ground: the particles carry the ground speed along z', () => {
    const { plumes, layers, state } = build();
    state.drift = 30;
    plumes.update(POSITIONS, 1, Math.max(SMOKE_INTERVAL, FLAME_INTERVAL));
    for (const p of [...layers.normal.calls, ...layers.additive.calls]) expect(p.vz).toBeGreaterThan(20);
  });

  it('adds up time across frames and scales the rate by the tier', () => {
    const full = build({ scale: 1 });
    const third = build({ scale: 0.35 });
    for (let i = 0; i < 60; i++) {
      full.plumes.update(POSITIONS, 1, 1 / 60);
      third.plumes.update(POSITIONS, 1, 1 / 60);
    }
    // One second of play: about 1 / interval puffs at full scale, about a third of that at 0.35.
    expect(full.layers.normal.calls.length).toBeGreaterThanOrEqual(Math.floor(1 / SMOKE_INTERVAL) - 1);
    expect(full.layers.normal.calls.length).toBeLessThanOrEqual(Math.ceil(1 / SMOKE_INTERVAL) + 1);
    expect(third.layers.normal.calls.length).toBeLessThan(full.layers.normal.calls.length * 0.5);
    expect(third.layers.normal.calls.length).toBeGreaterThan(0);
  });

  it('clamps a long frame to MAX_DT, so a tab coming back never bursts a backlog', () => {
    const { plumes, layers } = build();
    plumes.update(POSITIONS, 1, 60);
    expect(layers.normal.calls).toHaveLength(Math.floor(MAX_DT / SMOKE_INTERVAL));
    expect(layers.additive.calls).toHaveLength(Math.floor(MAX_DT / FLAME_INTERVAL));
  });

  it('emits nothing when dt is 0 (hitstop and pause), negative or not a number', () => {
    const { plumes, layers } = build();
    plumes.update(POSITIONS, 2, 0);
    plumes.update(POSITIONS, 2, -1);
    plumes.update(POSITIONS, 2, Number.NaN);
    expect(layers.normal.calls).toHaveLength(0);
    expect(layers.additive.calls).toHaveLength(0);
  });

  it('owes no time while no fire is visible, so the first fire never bursts', () => {
    const { plumes, layers } = build();
    for (let i = 0; i < 100; i++) plumes.update(POSITIONS, 0, 0.1);
    expect(plumes.emitted).toBe(0);
    plumes.update(POSITIONS, 1, 0.01);
    expect(layers.normal.calls).toHaveLength(0);
  });

  it('emits nothing while disabled and resumes when enabled, with no backlog', () => {
    const { plumes, layers } = build();
    plumes.setEnabled(false);
    for (let i = 0; i < 100; i++) plumes.update(POSITIONS, 2, 0.1);
    expect(plumes.emitted).toBe(0);
    expect(layers.normal.calls).toHaveLength(0);
    plumes.setEnabled(true);
    plumes.update(POSITIONS, 2, 0.01);
    expect(layers.normal.calls).toHaveLength(0);
    plumes.update(POSITIONS, 2, SMOKE_INTERVAL);
    expect(layers.normal.calls).toHaveLength(2);
  });

  it('is deterministic: the same seed and inputs give the same particles', () => {
    const a = build({ seed: 5 });
    const b = build({ seed: 5 });
    for (const { plumes } of [a, b]) {
      for (let i = 0; i < 30; i++) plumes.update(POSITIONS, 2, 1 / 60);
    }
    expect(a.layers.normal.calls).toEqual(b.layers.normal.calls);
    expect(a.layers.additive.calls).toEqual(b.layers.additive.calls);
    expect(a.plumes.emitted).toBe(b.plumes.emitted);
  });

  it('counts every particle it emits', () => {
    const { plumes, layers } = build();
    plumes.update(POSITIONS, 2, 0.25);
    expect(plumes.emitted).toBe(layers.normal.calls.length + layers.additive.calls.length);
    expect(plumes.emitted).toBeGreaterThan(0);
  });

  it('works without the optional drift and rng', () => {
    const layers = { additive: fakeLayer(), normal: fakeLayer() };
    const plumes = createFirePlumes({
      layers,
      getScale: () => 1,
      toWorld: (x, y, out) => out.set(x, 0, y),
    });
    plumes.update(POSITIONS, 1, 0.25);
    expect(plumes.emitted).toBeGreaterThan(0);
    expect(layers.normal.calls[0].vz).toBeTypeOf('number');
  });
});
