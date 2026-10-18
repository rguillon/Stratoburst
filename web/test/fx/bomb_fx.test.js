import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  BLOOM_PEAK,
  BLOOM_PULSE_S,
  BURST_FIRE,
  BURST_SMOKE,
  BURST_SPARKS,
  EXHAUST_CADENCE_S,
  FLASH_DURATION_S,
  FLASH_PEAK,
  LICK_CADENCE_S,
  LICK_COUNT,
  SCORCH_SIZE,
  createBombFx,
} from '../../src/fx/bomb_fx.js';
import { PALETTE, hueDistance, hueOf, saturationOf } from '../../src/fx/palette.js';

const W = 240;
const H = 320;
const EVENTS = { EXPLOSION: 1, BOMB_DETONATE: 9 };
const PHASES = { NONE: 0, LAUNCH: 1, BLAST: 2 };
const TUNING = { bomb_radius_min: 20, bomb_radius_max: 230, bomb_grow_ticks: 30, bomb_blast_ticks: 90 };
const BASE_STRENGTH = 0.45;

// A particle layer that only records what is emitted into it.
function recordingLayer() {
  const calls = [];
  return { calls, emit: (...args) => calls.push(args) };
}

function build(extra = {}) {
  const layers = { additive: recordingLayer(), normal: recordingLayer() };
  const bloomPass = { strength: BASE_STRENGTH, baseStrength: BASE_STRENGTH };
  const added = [];
  const flashes = [];
  const fx = createBombFx({
    layers,
    events: EVENTS,
    phases: PHASES,
    tuning: TUNING,
    bloomPass,
    decals: { add: (...args) => added.push(args) },
    lights: { flash: (...args) => flashes.push(args) },
    getScale: () => 1,
    toWorld: (x, y, out) => out.set(x - W / 2, 0, y - H / 2),
    playfieldW: W,
    playfieldH: H,
    ...extra,
  });
  return { fx, layers, bloomPass, added, flashes };
}

const part = (fx, name) => fx.group.getObjectByName(name);
const SIZE_OF = (call) => [call[7], call[8]];

describe('createBombFx', () => {
  it('is a hidden group of a missile and a fireball and counts nothing shown yet', () => {
    const { fx } = build();
    expect(fx.group.isGroup).toBe(true);
    expect(fx.group.children.map((child) => child.name).sort()).toEqual(['bomb-fireball', 'bomb-missile']);
    expect(part(fx, 'bomb-missile').visible).toBe(false);
    expect(part(fx, 'bomb-fireball').visible).toBe(false);
    expect(fx.shown).toBe(0);
  });

  it('draws the fireball additive and HDR, without depth, below the playfield mask', () => {
    const { fx } = build();
    const fireball = part(fx, 'bomb-fireball');
    expect(fireball.material.blending).toBe(THREE.AdditiveBlending);
    expect(fireball.material.transparent).toBe(true);
    expect(fireball.material.depthTest).toBe(false);
    expect(fireball.material.depthWrite).toBe(false);
    expect(fireball.renderOrder).toBe(4);
    expect(fireball.material.uniforms.uCore.value.toArray()).toEqual(PALETTE.BOMB_FIRE.rgb);
    expect(Math.max(...fireball.material.uniforms.uCore.value.toArray())).toBeGreaterThan(1);
  });

  it('shows only the missile, at the bomb position, during LAUNCH', () => {
    const { fx } = build();
    fx.update(PHASES.LAUNCH, 100, 250, 0.5, 0.016, 0);
    expect(part(fx, 'bomb-missile').visible).toBe(true);
    expect(part(fx, 'bomb-fireball').visible).toBe(false);
    expect(part(fx, 'bomb-missile').position.toArray()).toEqual([100 - W / 2, 0, 250 - H / 2]);
    fx.update(PHASES.LAUNCH, 100, 200, 0.9, 0.016, 0.016);
    expect(part(fx, 'bomb-missile').position.z).toBe(200 - H / 2);
  });

  it('shows only the fireball during BLAST and hides both in NONE', () => {
    const { fx } = build();
    fx.update(PHASES.BLAST, 120, 100, 0.1, 0.016, 0);
    expect(part(fx, 'bomb-missile').visible).toBe(false);
    expect(part(fx, 'bomb-fireball').visible).toBe(true);
    expect(part(fx, 'bomb-fireball').position.toArray()).toEqual([120 - W / 2, 0, 100 - H / 2]);
    fx.update(PHASES.NONE, 0, 0, 0, 0.016, 0.016);
    expect(part(fx, 'bomb-missile').visible).toBe(false);
    expect(part(fx, 'bomb-fireball').visible).toBe(false);
  });

  it.each([0, 0.1, 0.25, 1 / 3, 0.5, 0.9])('scales the fireball to the Python radius at progress %f', (t) => {
    const { fx } = build();
    fx.update(PHASES.BLAST, 120, 100, t, 0.016, 0);
    const expected = 20 + (230 - 20) * Math.min(1, (t * 90) / 30);
    const scale = part(fx, 'bomb-fireball').scale;
    expect(scale.x).toBeCloseTo(expected, 5);
    expect(scale.z).toBeCloseTo(expected, 5);
    expect(scale.y).toBeLessThan(scale.x); // a dome, not a ball
  });

  it('reaches the full radius at one third of the blast and stays there', () => {
    const { fx } = build();
    fx.update(PHASES.BLAST, 120, 100, 1 / 3, 0.016, 0);
    expect(part(fx, 'bomb-fireball').scale.x).toBeCloseTo(230, 4);
    fx.update(PHASES.BLAST, 120, 100, 0.7, 0.016, 0.016);
    expect(part(fx, 'bomb-fireball').scale.x).toBeCloseTo(230, 4);
  });

  it('fades the fireball over the last 20% of the blast only', () => {
    const { fx } = build();
    const opacity = () => part(fx, 'bomb-fireball').material.uniforms.uOpacity.value;
    let time = 0;
    for (const [t, expected] of [
      [0, 1],
      [0.5, 1],
      [0.79, 1],
      [0.9, 0.5],
      [0.95, 0.25],
      [1, 0],
    ]) {
      fx.update(PHASES.BLAST, 120, 100, t, 0.016, time);
      time += 0.016;
      expect(opacity()).toBeCloseTo(expected, 5);
    }
  });

  it('counts a detonation displayed once per blast, when its fireball first draws', () => {
    const { fx } = build();
    fx.update(PHASES.LAUNCH, 100, 250, 0.5, 0.016, 0);
    expect(fx.shown).toBe(0);
    fx.update(PHASES.BLAST, 100, 140, 0.0, 0.016, 0.016);
    fx.update(PHASES.BLAST, 100, 140, 0.1, 0.016, 0.032);
    expect(fx.shown).toBe(1);
    fx.update(PHASES.NONE, 0, 0, 0, 0.016, 0.048);
    fx.update(PHASES.LAUNCH, 100, 250, 0.1, 0.016, 0.064);
    fx.update(PHASES.BLAST, 100, 140, 0.0, 0.016, 0.08);
    expect(fx.shown).toBe(2);
  });

  describe('the detonation', () => {
    it('emits the burst once: 60 fire, 30 smoke and 40 sparks at scale 1', () => {
      const { fx, layers } = build();
      fx.handle(EVENTS.BOMB_DETONATE, 100, 140, 0, 0, 0);
      expect(layers.additive.calls).toHaveLength(BURST_FIRE + BURST_SPARKS);
      expect(layers.normal.calls).toHaveLength(BURST_SMOKE);
      expect([BURST_FIRE, BURST_SMOKE, BURST_SPARKS]).toEqual([60, 30, 40]);
    });

    it('ignores every other event', () => {
      const { fx, layers, added, flashes, bloomPass } = build();
      fx.handle(EVENTS.EXPLOSION, 100, 140, 2, 0, 0);
      expect(layers.additive.calls).toHaveLength(0);
      expect(layers.normal.calls).toHaveLength(0);
      expect(added).toHaveLength(0);
      expect(flashes).toHaveLength(0);
      expect(bloomPass.strength).toBe(BASE_STRENGTH);
    });

    it('scales the particle COUNT with the tier and never the sizes', () => {
      const full = build();
      full.fx.handle(EVENTS.BOMB_DETONATE, 100, 140, 0, 0, 0);
      const half = build({ getScale: () => 0.5 });
      half.fx.handle(EVENTS.BOMB_DETONATE, 100, 140, 0, 0, 0);
      expect(half.layers.additive.calls).toHaveLength(30 + 20);
      expect(half.layers.normal.calls).toHaveLength(15);
      const sizes = (layers) =>
        new Set([...layers.additive.calls, ...layers.normal.calls].map((call) => SIZE_OF(call).join()));
      expect(sizes(half.layers)).toEqual(sizes(full.layers));
    });

    it('still bursts at least one particle of each look on a tiny scale', () => {
      const { fx, layers } = build({ getScale: () => 0.001 });
      fx.handle(EVENTS.BOMB_DETONATE, 100, 140, 0, 0, 0);
      expect(layers.additive.calls).toHaveLength(2);
      expect(layers.normal.calls).toHaveLength(1);
    });

    it('starts the burst at the detonation point on the gameplay plane', () => {
      const { fx, layers } = build();
      fx.handle(EVENTS.BOMB_DETONATE, 100, 140, 0, 0, 0);
      for (const call of [...layers.additive.calls, ...layers.normal.calls]) {
        expect([call[0], call[1], call[2]]).toEqual([100 - W / 2, 0, 140 - H / 2]);
      }
    });

    it('adds one large scorch mark at the detonation', () => {
      const { fx, added } = build();
      fx.handle(EVENTS.BOMB_DETONATE, 100, 140, 0, 0, 0);
      expect(added).toEqual([[100, 140, SCORCH_SIZE]]);
      expect(SCORCH_SIZE).toBe(60);
    });

    it('flashes exactly one large light above the blast', () => {
      const { fx, flashes } = build();
      fx.handle(EVENTS.BOMB_DETONATE, 100, 140, 0, 0, 0);
      expect(flashes).toHaveLength(1);
      const [x, y, z, peak, rgb, duration] = flashes[0];
      expect([x, z]).toEqual([100 - W / 2, 140 - H / 2]);
      expect(y).toBeGreaterThan(0);
      expect(peak).toBe(FLASH_PEAK);
      expect(peak).toBeGreaterThan(6); // larger than any ordinary explosion light
      expect(rgb).toEqual(PALETTE.LIGHT_EXPLOSION.rgb);
      expect(duration).toBe(FLASH_DURATION_S);
    });

    it('never uses a colour near the enemy-bullet orange-yellow', () => {
      const bulletHue = hueOf(PALETTE.ENEMY_BULLET_HALO.rgb);
      for (const key of ['BOMB_FIRE', 'FIRE', 'FIRE_CORE', 'SPARK', 'SMOKE', 'LIGHT_EXPLOSION']) {
        const rgb = PALETTE[key].rgb;
        if (saturationOf(rgb) < 0.25) continue;
        expect(hueDistance(hueOf(rgb), bulletHue), key).toBeGreaterThan(35);
      }
    });
  });

  describe('the bloom pulse', () => {
    it('raises the strength to 2.2x its base at the detonation', () => {
      const { fx, bloomPass } = build();
      fx.handle(EVENTS.BOMB_DETONATE, 100, 140, 0, 0, 0);
      expect(bloomPass.strength).toBeCloseTo(BASE_STRENGTH * 2.2, 6);
      expect(BLOOM_PEAK).toBe(2.2);
    });

    it('decays monotonically back to exactly the base within 0.3 s', () => {
      const { fx, bloomPass } = build();
      fx.handle(EVENTS.BOMB_DETONATE, 100, 140, 0, 0, 0);
      let previous = bloomPass.strength;
      let time = 0;
      for (let i = 0; i < 20; i += 1) {
        fx.update(PHASES.BLAST, 100, 140, i / 90, 0.016, time);
        time += 0.016;
        expect(bloomPass.strength).toBeLessThanOrEqual(previous);
        previous = bloomPass.strength;
      }
      expect(time).toBeGreaterThan(BLOOM_PULSE_S);
      expect(bloomPass.strength).toBe(BASE_STRENGTH);
    });

    it('never rises again until the next detonation (no strobe)', () => {
      const { fx, bloomPass } = build();
      fx.handle(EVENTS.BOMB_DETONATE, 100, 140, 0, 0, 0);
      let time = 0;
      let rises = 0;
      let previous = bloomPass.strength;
      for (let i = 0; i < 200; i += 1) {
        fx.update(PHASES.BLAST, 100, 140, Math.min(1, i / 180), 0.016, time);
        time += 0.016;
        if (bloomPass.strength > previous) rises += 1;
        previous = bloomPass.strength;
      }
      expect(rises).toBe(0);
      expect(bloomPass.strength).toBe(BASE_STRENGTH);
    });

    it('pulses again, once, for a second detonation', () => {
      const { fx, bloomPass } = build();
      fx.handle(EVENTS.BOMB_DETONATE, 100, 140, 0, 0, 0);
      fx.update(PHASES.BLAST, 100, 140, 0.1, 1, 0);
      expect(bloomPass.strength).toBe(BASE_STRENGTH);
      fx.handle(EVENTS.BOMB_DETONATE, 100, 140, 0, 0, 0);
      expect(bloomPass.strength).toBeCloseTo(BASE_STRENGTH * 2.2, 6);
    });

    it('peaks at 2.2x a base set after load, not the one seen at creation', () => {
      const { fx, bloomPass } = build();
      bloomPass.strength = 0.6;
      bloomPass.baseStrength = 0.6;
      fx.handle(EVENTS.BOMB_DETONATE, 100, 140, 0, 0, 0);
      expect(bloomPass.strength).toBeCloseTo(0.6 * 2.2, 6);
    });

    it('ends at the live tier strength when the tier drops during the pulse', () => {
      const { fx, bloomPass } = build();
      bloomPass.strength = 0.6;
      bloomPass.baseStrength = 0.6;
      fx.handle(EVENTS.BOMB_DETONATE, 100, 140, 0, 0, 0);
      fx.update(PHASES.BLAST, 100, 140, 0.05, 0.05, 0);
      bloomPass.baseStrength = 0.5; // pipeline.setTier(TIERS.mid) while the pulse runs
      fx.update(PHASES.BLAST, 100, 140, 0.2, 1, 0.05);
      expect(bloomPass.strength).toBe(0.5);
    });

    it('falls back to the current strength when no base was ever published', () => {
      const { fx, bloomPass } = build();
      delete bloomPass.baseStrength;
      fx.handle(EVENTS.BOMB_DETONATE, 100, 140, 0, 0, 0);
      expect(bloomPass.strength).toBeCloseTo(BASE_STRENGTH * 2.2, 6);
      fx.update(PHASES.BLAST, 100, 140, 0.2, 1, 0);
      expect(bloomPass.strength).toBe(BASE_STRENGTH);
    });

    it('leaves the strength alone when nothing detonated', () => {
      const { fx, bloomPass } = build();
      for (let i = 0; i < 10; i += 1) fx.update(PHASES.NONE, 0, 0, 0, 0.016, i * 0.016);
      expect(bloomPass.strength).toBe(BASE_STRENGTH);
    });
  });

  describe('fire licks and exhaust', () => {
    it('licks the blast every 50 ms at points inside the radius', () => {
      const { fx, layers } = build();
      fx.update(PHASES.BLAST, 120, 100, 0.0, 0.016, 0);
      expect(layers.additive.calls).toHaveLength(LICK_COUNT);
      fx.update(PHASES.BLAST, 120, 100, 0.01, 0.016, 0.03); // inside the cadence: nothing
      expect(layers.additive.calls).toHaveLength(LICK_COUNT);
      fx.update(PHASES.BLAST, 120, 100, 0.02, 0.016, LICK_CADENCE_S + 0.001);
      expect(layers.additive.calls).toHaveLength(LICK_COUNT * 2);
      const radius = 20 + 210 * (0.02 * 3);
      for (const call of layers.additive.calls) {
        const dx = call[0] - (120 - W / 2);
        const dz = call[2] - (100 - H / 2);
        expect(Math.hypot(dx, dz)).toBeLessThanOrEqual(radius + 1e-6 + 210 * 0.03);
      }
    });

    it('scales the lick count with the tier', () => {
      const { fx, layers } = build({ getScale: () => 0.35 });
      fx.update(PHASES.BLAST, 120, 100, 0.0, 0.016, 0);
      expect(layers.additive.calls).toHaveLength(Math.round(LICK_COUNT * 0.35));
    });

    it('does not lick outside the blast', () => {
      const { fx, layers } = build();
      fx.update(PHASES.NONE, 0, 0, 0, 0.016, 0);
      expect(layers.additive.calls).toHaveLength(0);
      expect(layers.normal.calls).toHaveLength(0);
    });

    it('puffs a hot exhaust behind the rising missile on a cadence', () => {
      const { fx, layers } = build();
      fx.update(PHASES.LAUNCH, 100, 250, 0.1, 0.016, 0);
      const first = layers.additive.calls.length;
      expect(first).toBeGreaterThan(0);
      fx.update(PHASES.LAUNCH, 100, 245, 0.2, 0.016, EXHAUST_CADENCE_S / 2);
      expect(layers.additive.calls).toHaveLength(first);
      fx.update(PHASES.LAUNCH, 100, 240, 0.3, 0.016, EXHAUST_CADENCE_S + 0.001);
      expect(layers.additive.calls.length).toBe(first * 2);
    });
  });

  it('shows and hides both parts for the shader prewarm', () => {
    const { fx } = build();
    fx.showAll(true);
    expect(part(fx, 'bomb-missile').visible).toBe(true);
    expect(part(fx, 'bomb-fireball').visible).toBe(true);
    expect(part(fx, 'bomb-fireball').scale.toArray()).toEqual([1, 1, 1]);
    fx.showAll(false);
    expect(part(fx, 'bomb-missile').visible).toBe(false);
    expect(part(fx, 'bomb-fireball').visible).toBe(false);
    expect(fx.shown).toBe(0);
  });

  it('allocates no new objects in update', () => {
    const { fx } = build();
    fx.update(PHASES.LAUNCH, 100, 250, 0.5, 0.016, 0);
    fx.update(PHASES.BLAST, 100, 140, 0.2, 0.016, 0.1);
    const before = fx.group.children.map((child) => [child.position, child.scale, child.material]).flat();
    fx.update(PHASES.LAUNCH, 110, 240, 0.7, 0.016, 0.2);
    fx.update(PHASES.BLAST, 110, 130, 0.4, 0.016, 0.3);
    const after = fx.group.children.map((child) => [child.position, child.scale, child.material]).flat();
    after.forEach((object, i) => expect(object).toBe(before[i]));
  });
});
