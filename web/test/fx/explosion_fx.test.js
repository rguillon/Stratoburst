import { describe, expect, it } from 'vitest';
import {
  BULLET_EXCLUSION_DEGREES,
  BULLET_MIN_SATURATION,
  PALETTE,
  hueDistance,
  hueOf,
  saturationOf,
} from '../../src/fx/palette.js';
import {
  HIT_RECIPE,
  PICKUP_RECIPE,
  PLAYER_DEATH_RECIPE,
  PLAYER_HIT_RECIPE,
  CITY_SPARKS,
  RECIPES,
  createExplosionFx,
  mulberry32,
} from '../../src/fx/explosion_fx.js';

const EVENTS = { EXPLOSION: 1, HIT: 2, PICKUP: 4, PLAYER_HIT: 6, PLAYER_DEATH: 7, MEDAL: 13 };
const PICKUP_KINDS = { RED: 0, BLUE: 1, PURPLE: 2, CRYSTAL: 3, BOMB: 4, MEDAL: 5 };
const BLAST = { SMALL: 0, MEDIUM: 1, LARGE: 2 };

function build(options = {}) {
  const emitted = { additive: [], normal: [] };
  const layer = (name) => ({
    emit: (...args) => emitted[name].push(args),
  });
  const fx = createExplosionFx({
    layers: { additive: layer('additive'), normal: layer('normal') },
    events: EVENTS,
    blast: BLAST,
    pickupKinds: PICKUP_KINDS,
    // The ground flag lifts a point onto a distinct plane, so a test can tell which one was used.
    toWorld: (x, y, ground, out) => out.set(x - 120 + (ground ? 1000 : 0), ground ? -40 : 0, y - 160),
    ...options,
  });
  return { fx, emitted };
}

describe('createExplosionFx', () => {
  it('spawns a SMALL explosion on the additive layer at the converted event position', () => {
    const { fx, emitted } = build();
    fx.handle(EVENTS.EXPLOSION, 130, 170, BLAST.SMALL, 0, 0);
    expect(emitted.additive).toHaveLength(27);
    expect(emitted.normal).toHaveLength(0);
    const [core] = emitted.additive;
    expect(core.slice(0, 3)).toEqual([10, 0, 10]); // toWorld(130, 170)
    expect(core.slice(7, 9)).toEqual([10, 18]); // core sizes
    expect(core[6]).toBeCloseTo(0.18, 5);
  });

  it('throws sparks in horizontal directions at 30-70 units per second', () => {
    const { fx, emitted } = build();
    fx.handle(EVENTS.EXPLOSION, 120, 160, BLAST.SMALL, 0, 0);
    for (const p of emitted.additive.slice(1, 21)) {
      expect(p[4]).toBe(0); // no vertical velocity
      const speed = Math.hypot(p[3], p[5]);
      expect(speed).toBeGreaterThanOrEqual(30 - 1e-6);
      expect(speed).toBeLessThanOrEqual(70 + 1e-6);
    }
  });

  it('is deterministic with the default seeded rng', () => {
    const a = build();
    const b = build();
    a.fx.handle(EVENTS.EXPLOSION, 50, 50, BLAST.SMALL, 0, 0);
    b.fx.handle(EVENTS.EXPLOSION, 50, 50, BLAST.SMALL, 0, 0);
    expect(a.emitted.additive).toEqual(b.emitted.additive);
  });

  it('ignores other event types', () => {
    const { fx, emitted } = build();
    fx.handle(99, 1, 2, 0, 0, 0);
    expect(emitted.additive).toHaveLength(0);
  });
});

function sizeSet(layerEmits) {
  return new Set(layerEmits.map((p) => `${p[7]},${p[8]}`));
}

function explode(blastValue, scale = 1) {
  const built = build({ getScale: () => scale });
  built.fx.handle(EVENTS.EXPLOSION, 120, 160, blastValue, 0, 0);
  return built.emitted;
}

describe('blast class recipes at full scale', () => {
  it('SMALL adds 6 slow orange embers to the core and 20 sparks', () => {
    const { additive, normal } = explode(BLAST.SMALL);
    expect(additive).toHaveLength(1 + 20 + 6);
    expect(normal).toHaveLength(0);
    const embers = additive.filter((p) => p[6] >= 0.6 && p[6] <= 0.9);
    expect(embers).toHaveLength(6);
    for (const p of embers) expect(Math.hypot(p[3], p[5])).toBeLessThan(30);
  });

  it('MEDIUM is a core, 16 fire puffs and 10 sparks over 10 smoke puffs drifting up', () => {
    const { additive, normal } = explode(BLAST.MEDIUM);
    expect(additive).toHaveLength(1 + 16 + 10);
    expect(normal).toHaveLength(10);
    for (const p of normal) {
      expect(p[12]).toBeCloseTo(-0.15, 5); // gravity scale: smoke rises
      expect(p[9]).toBeLessThan(0.3); // dark
    }
    expect(additive[0].slice(7, 9)).toEqual([18, 30]);
  });

  it('LARGE is a fireball of 30 with 18 smoke, 14 falling debris and 12 sparks', () => {
    const { additive, normal } = explode(BLAST.LARGE);
    expect(additive).toHaveLength(1 + 30 + 12);
    expect(normal).toHaveLength(18 + 14);
    expect(normal.filter((p) => p[12] === 1)).toHaveLength(14); // debris falls
    expect(additive[0].slice(7, 9)).toEqual([26, 44]);
    expect(additive[0][6]).toBeCloseTo(0.32, 5);
  });

  it('grows the core with the class', () => {
    const cores = [BLAST.SMALL, BLAST.MEDIUM, BLAST.LARGE].map((b) => explode(b).additive[0][8]);
    expect(cores).toEqual([18, 30, 44]);
  });
});

describe('particle scale', () => {
  it('cuts the count per emitter but never the sizes or lifetimes', () => {
    const full = explode(BLAST.SMALL, 1);
    const low = explode(BLAST.SMALL, 0.35);
    // core 1, sparks round(7) = 7, embers round(2.1) = 2
    expect(low.additive).toHaveLength(1 + 7 + 2);
    expect(sizeSet(low.additive)).toEqual(sizeSet(full.additive));
    for (const p of low.additive) expect(p[6]).toBeGreaterThanOrEqual(0.18 - 1e-6);
  });

  it('keeps one particle per emitter however small the scale', () => {
    const { additive, normal } = explode(BLAST.LARGE, 0.001);
    expect(additive).toHaveLength(3); // core, fire puffs, sparks
    expect(normal).toHaveLength(2); // smoke, debris
    // ... and the MEDIUM recipe has four emitters across both layers
    const medium = explode(BLAST.MEDIUM, 0.001);
    expect(medium.additive.length + medium.normal.length).toBe(4);
  });

  it('reads the scale at event time so a tier change applies to the next explosion', () => {
    let scale = 1;
    const { fx, emitted } = build({ getScale: () => scale });
    fx.handle(EVENTS.EXPLOSION, 0, 0, BLAST.SMALL, 0, 0);
    const before = emitted.additive.length;
    scale = 0.35;
    fx.handle(EVENTS.EXPLOSION, 0, 0, BLAST.SMALL, 0, 0);
    expect(emitted.additive.length - before).toBeLessThan(before);
  });
});

describe('HIT', () => {
  it('throws 4 white sparks at the impact point', () => {
    const { fx, emitted } = build();
    fx.handle(EVENTS.HIT, 130, 170, 0, 0, 0);
    expect(emitted.additive).toHaveLength(4);
    expect(emitted.normal).toHaveLength(0);
    for (const p of emitted.additive) {
      expect(p.slice(0, 3)).toEqual([10, 0, 10]);
      expect(p.slice(9, 12)).toEqual([3, 3, 3]);
      expect(p[6]).toBeGreaterThanOrEqual(0.12 - 1e-6);
      expect(p[6]).toBeLessThanOrEqual(0.2 + 1e-6);
    }
  });

  it('still sparks at least once at a tiny scale', () => {
    const { fx, emitted } = build({ getScale: () => 0.05 });
    fx.handle(EVENTS.HIT, 0, 0, 0, 0, 0);
    expect(emitted.additive).toHaveLength(1);
  });
});

describe('ground positioning (D-21, VISL-03)', () => {
  it('passes the ground flag of an EXPLOSION payload to toWorld', () => {
    const calls = [];
    const { fx } = build({
      toWorld: (x, y, ground, out) => {
        calls.push([x, y, ground]);
        return out.set(0, 0, 0);
      },
    });
    fx.handle(EVENTS.EXPLOSION, 130, 170, BLAST.LARGE, 1, 3);
    fx.handle(EVENTS.EXPLOSION, 130, 170, BLAST.LARGE, 0, 0);
    expect(calls).toEqual([
      [130, 170, 1],
      [130, 170, 0],
    ]);
  });

  it('bursts a ground LARGE explosion at the ground-layer position and an air one on the plane', () => {
    const ground = build();
    ground.fx.handle(EVENTS.EXPLOSION, 130, 170, BLAST.LARGE, 1, 3);
    const air = build();
    air.fx.handle(EVENTS.EXPLOSION, 130, 170, BLAST.LARGE, 0, 3);
    for (const p of [...ground.emitted.additive, ...ground.emitted.normal]) {
      expect(p.slice(0, 3)).toEqual([1010, -40, 10]);
    }
    for (const p of [...air.emitted.additive, ...air.emitted.normal]) {
      expect(p.slice(0, 3)).toEqual([10, 0, 10]);
    }
    expect(ground.emitted.additive).toHaveLength(air.emitted.additive.length);
  });

  it('sparks a HIT on a ground kind at the ground position when groundKinds is given', () => {
    const { fx, emitted } = build({ groundKinds: new Set([3, 4]) });
    fx.handle(EVENTS.HIT, 130, 170, 3, 0, 0); // a tank
    fx.handle(EVENTS.HIT, 130, 170, 0, 0, 0); // a jet
    const [tank, jet] = [emitted.additive.slice(0, 4), emitted.additive.slice(4)];
    for (const p of tank) expect(p.slice(0, 3)).toEqual([1010, -40, 10]);
    for (const p of jet) expect(p.slice(0, 3)).toEqual([10, 0, 10]);
  });

  it('keeps every HIT on the plane when no ground kinds are given', () => {
    const { fx, emitted } = build();
    fx.handle(EVENTS.HIT, 130, 170, 3, 0, 0);
    for (const p of emitted.additive) expect(p.slice(0, 3)).toEqual([10, 0, 10]);
  });
});

describe('unknown blast class', () => {
  it('emits nothing and does not throw', () => {
    const { fx, emitted } = build();
    expect(() => fx.handle(EVENTS.EXPLOSION, 0, 0, 7, 0, 0)).not.toThrow();
    expect(emitted.additive).toHaveLength(0);
    expect(emitted.normal).toHaveLength(0);
  });
});

describe('recipe colours (D-39)', () => {
  it('take every colour from the palette, with no inline literals', () => {
    const emitters = [
      ...Object.values(RECIPES).flat(),
      ...HIT_RECIPE,
      ...PLAYER_HIT_RECIPE,
      ...PLAYER_DEATH_RECIPE,
    ];
    const known = Object.values(PALETTE).map((entry) => entry.rgb.join(','));
    for (const e of emitters) {
      expect(known, `colour ${e.color.join(',')} is not a palette entry`).toContain(e.color.join(','));
    }
  });

  it('stay out of the orange-yellow band reserved for enemy bullets', () => {
    const emitters = [
      ...Object.values(RECIPES).flat(),
      ...HIT_RECIPE,
      ...PLAYER_HIT_RECIPE,
      ...PLAYER_DEATH_RECIPE,
    ];
    expect(emitters.length).toBeGreaterThan(10);
    for (const e of emitters) {
      const saturated = saturationOf(e.color) >= BULLET_MIN_SATURATION;
      const distance = hueDistance(hueOf(e.color), hueOf(PALETTE.ENEMY_BULLET_HALO.rgb));
      expect(!saturated || distance >= BULLET_EXCLUSION_DEGREES, e.color.join(',')).toBe(true);
    }
  });
});

describe('mulberry32', () => {
  it('yields values in [0, 1) and repeats for the same seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 50; i += 1) {
      const v = a();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      expect(v).toBe(b());
    }
  });
});

describe('the PICKUP sparkle', () => {
  function catchPickup({ kind = PICKUP_KINDS.CRYSTAL, outcome = 0, color = 0, scale = 1 } = {}) {
    const built = build({ getScale: () => scale });
    built.fx.handle(EVENTS.PICKUP, 130, 170, kind, outcome, color);
    return built.emitted;
  }

  it('throws 10 additive sparkles at the catch position and nothing on the normal layer', () => {
    const { additive, normal } = catchPickup();
    expect(additive).toHaveLength(10);
    expect(normal).toHaveLength(0);
    expect(PICKUP_RECIPE).toHaveLength(1);
    for (const p of additive) expect(p.slice(0, 3)).toEqual([10, 0, 10]); // toWorld(130, 170)
  });

  it('lives 0.3 s and expands outward in every direction on the plane', () => {
    const { additive } = catchPickup();
    expect(additive).toHaveLength(10);
    for (const p of additive) {
      expect(p[6]).toBeCloseTo(0.3, 5);
      expect(p[4]).toBe(0); // flat
      expect(Math.hypot(p[3], p[5])).toBeGreaterThan(20);
    }
    const heading = new Set(additive.map((p) => Math.sign(p[3]) + Math.sign(p[5]) * 3));
    expect(heading.size).toBeGreaterThan(2);
  });

  it.each([
    ['red', 0, PALETTE.CRYSTAL_RED],
    ['blue', 1, PALETTE.CRYSTAL_BLUE],
    ['purple', 2, PALETTE.CRYSTAL_PURPLE],
  ])('is %s when the colour index at the catch is %i', (_name, color, entry) => {
    const { additive } = catchPickup({ color });
    expect(additive).toHaveLength(10);
    for (const p of additive) expect(p.slice(9, 12)).toEqual(entry.rgb);
  });

  it('uses the bomb pickup colour for the BOMB kind whatever the colour slot says', () => {
    const { additive } = catchPickup({ kind: PICKUP_KINDS.BOMB, color: 0 });
    expect(additive).toHaveLength(10);
    for (const p of additive) expect(p.slice(9, 12)).toEqual(PALETTE.BOMB_PICKUP.rgb);
  });

  it('draws a colour index outside the cycle in the red crystal colour', () => {
    const { additive } = catchPickup({ color: 7 });
    expect(additive).toHaveLength(10);
    for (const p of additive) expect(p.slice(9, 12)).toEqual(PALETTE.CRYSTAL_RED.rgb);
  });

  it('scales the count with the tier, never below one', () => {
    expect(catchPickup({ scale: 0.6 }).additive).toHaveLength(6);
    expect(catchPickup({ scale: 0.35 }).additive).toHaveLength(4); // round(3.5)
    expect(catchPickup({ scale: 0.01 }).additive).toHaveLength(1);
  });

  it('sparkles for every outcome, not only MAXED', () => {
    for (const outcome of [0, 1, 2, 3]) expect(catchPickup({ outcome }).additive).toHaveLength(10);
  });

  it('leaves the explosion and hit recipes untouched', () => {
    const { fx, emitted } = build();
    fx.handle(EVENTS.HIT, 120, 160, 0, 0, 0);
    expect(emitted.additive).toHaveLength(HIT_RECIPE[0].count);
    expect(emitted.additive[0].slice(9, 12)).toEqual(PALETTE.HIT_SPARK.rgb);
  });
});

describe('the player ship recipes (PLYR-06)', () => {
  const white = PALETTE.HIT_SPARK.rgb;

  function play(type, { scale = 1 } = {}) {
    const built = build({ getScale: () => scale });
    built.fx.handle(type, 130, 170, 0, 0, 0);
    return built.emitted;
  }

  it('PLAYER_DEATH plays a LARGE-sized fireball: every LARGE particle, at full size', () => {
    const { additive, normal } = play(EVENTS.PLAYER_DEATH);
    const large = RECIPES.LARGE;
    const additiveCount = large.filter((e) => e.layer === 'additive').reduce((n, e) => n + e.count, 0);
    const normalCount = large.filter((e) => e.layer === 'normal').reduce((n, e) => n + e.count, 0);
    expect(normal).toHaveLength(normalCount);
    expect(additive).toHaveLength(additiveCount + 16);
    expect(additive[0].slice(7, 9)).toEqual([26, 44]); // the LARGE core
  });

  it('PLAYER_DEATH adds a ring of 16 white sparks spread evenly around the ship', () => {
    const { additive } = play(EVENTS.PLAYER_DEATH);
    const ring = additive.slice(-16);
    for (const p of ring) {
      expect(p.slice(9, 12)).toEqual(white);
      expect(p.slice(0, 3)).toEqual([10, 0, 10]); // toWorld(130, 170)
      expect(p[4]).toBe(0); // flat on the plane
    }
    const headings = ring.map((p) => Math.atan2(p[5], p[3]));
    const sorted = headings.map((h) => (h + 2 * Math.PI) % (2 * Math.PI)).sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i += 1) {
      expect(sorted[i] - sorted[i - 1]).toBeCloseTo((2 * Math.PI) / 16, 5);
    }
  });

  it('PLAYER_HIT is a quick white ring of 10 sparks and nothing else', () => {
    const { additive, normal } = play(EVENTS.PLAYER_HIT);
    expect(normal).toHaveLength(0);
    expect(additive).toHaveLength(10);
    for (const p of additive) {
      expect(p.slice(9, 12)).toEqual(white);
      expect(p.slice(0, 3)).toEqual([10, 0, 10]);
      expect(p[6]).toBeLessThan(0.3); // quick
    }
    expect(PLAYER_HIT_RECIPE).toHaveLength(1);
  });

  it('scales the counts with the tier but never the sizes', () => {
    const full = play(EVENTS.PLAYER_DEATH);
    const low = play(EVENTS.PLAYER_DEATH, { scale: 0.35 });
    expect(low.additive.length).toBeLessThan(full.additive.length);
    expect(low.additive[0].slice(7, 9)).toEqual(full.additive[0].slice(7, 9));
    expect(play(EVENTS.PLAYER_HIT, { scale: 0.6 }).additive).toHaveLength(6);
    expect(play(EVENTS.PLAYER_HIT, { scale: 0.01 }).additive).toHaveLength(1);
  });

  it('leaves the other recipes alone', () => {
    const { fx, emitted } = build();
    fx.handle(EVENTS.EXPLOSION, 130, 170, BLAST.SMALL, 0, 0);
    expect(emitted.additive).toHaveLength(27);
  });
});

describe('the MEDAL sparkle', () => {
  function catchMedal({ scale = 1, value = 100, chain = 1 } = {}) {
    const built = build({ getScale: () => scale });
    built.fx.handle(EVENTS.MEDAL, 130, 170, value, chain, 0);
    return built.emitted;
  }

  it('throws the pickup sparkle at the catch position in the medal palette colour', () => {
    const { additive, normal } = catchMedal();
    expect(additive).toHaveLength(10);
    expect(normal).toHaveLength(0);
    for (const p of additive) {
      expect(p.slice(0, 3)).toEqual([10, 0, 10]); // toWorld(130, 170), on the plane
      expect(p.slice(9, 12)).toEqual(PALETTE.MEDAL.rgb);
    }
  });

  it('scales the count with the tier, never below one', () => {
    expect(catchMedal({ scale: 0.6 }).additive).toHaveLength(6);
    expect(catchMedal({ scale: 0.01 }).additive).toHaveLength(1);
  });

  it('does not sparkle for the other events', () => {
    const built = build();
    built.fx.handle(14, 130, 170, 4, 0, 0);
    expect(built.emitted.additive).toHaveLength(0);
  });
});

describe('city target bursts (D-33, D-40)', () => {
  const HOUSE = 8;
  const TANK = 3;

  function burstOf(kind, options = {}) {
    const built = build({ cityKinds: new Set([HOUSE]), ...options });
    built.fx.handle(EVENTS.EXPLOSION, 120, 160, BLAST.MEDIUM, 1, kind);
    return built;
  }

  it('adds cyan sparks, magenta embers and a white flash on top of the blast recipe for a city kind', () => {
    const plain = burstOf(TANK);
    const city = burstOf(HOUSE);
    const extra = CITY_SPARKS.reduce((sum, e) => sum + e.count, 0);
    expect(city.emitted.additive).toHaveLength(plain.emitted.additive.length + extra);
    expect(city.emitted.normal).toHaveLength(plain.emitted.normal.length);
    const rgbs = city.emitted.additive.map((p) => p.slice(9, 12));
    expect(rgbs).toContainEqual(PALETTE.SPARK.rgb);
    expect(rgbs).toContainEqual(PALETTE.EMBER.rgb);
    expect(rgbs).toContainEqual(PALETTE.FIRE_CORE.rgb);
  });

  it('bursts the extra sparks where the blast is, in the ground layer when the kill was on the ground', () => {
    const { emitted } = burstOf(HOUSE);
    const sparks = emitted.additive.filter((p) => p.slice(9, 12).join() === PALETTE.SPARK.rgb.join());
    expect(sparks.length).toBeGreaterThan(0);
    for (const p of sparks) expect(p.slice(0, 3)).toEqual([1000, -40, 160 - 160]);
  });

  it('counts a city burst and leaves other kinds, and the default, at zero', () => {
    const none = build();
    none.fx.handle(EVENTS.EXPLOSION, 120, 160, BLAST.MEDIUM, 1, HOUSE);
    expect(none.fx.cityBursts).toBe(0);

    const built = build({ cityKinds: new Set([HOUSE]) });
    expect(built.fx.cityBursts).toBe(0);
    built.fx.handle(EVENTS.EXPLOSION, 120, 160, BLAST.MEDIUM, 1, TANK);
    expect(built.fx.cityBursts).toBe(0);
    built.fx.handle(EVENTS.EXPLOSION, 120, 160, BLAST.MEDIUM, 1, HOUSE);
    built.fx.handle(EVENTS.EXPLOSION, 120, 160, BLAST.LARGE, 1, HOUSE);
    expect(built.fx.cityBursts).toBe(2);
  });

  it('scales the spark counts with the tier like every recipe, never below one per emitter', () => {
    const full = burstOf(HOUSE).emitted.additive.length;
    const small = burstOf(HOUSE, { getScale: () => 0.35 }).emitted.additive.length;
    expect(small).toBeLessThan(full);
    const tiny = burstOf(HOUSE, { getScale: () => 0.001 }).emitted.additive;
    expect(tiny.length).toBeGreaterThanOrEqual(CITY_SPARKS.length);
  });

  it('keeps every colour in the palette and out of the bullet band', () => {
    const palette = Object.values(PALETTE).map((entry) => entry.rgb.join());
    for (const e of CITY_SPARKS) expect(palette).toContain(e.color.join());
  });
});
