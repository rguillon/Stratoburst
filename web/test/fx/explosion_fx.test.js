import { describe, expect, it } from 'vitest';
import { HIT_RECIPE, RECIPES, createExplosionFx, mulberry32 } from '../../src/fx/explosion_fx.js';

const EVENTS = { EXPLOSION: 1, HIT: 2 };
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
    toWorld: (x, y, out) => out.set(x - 120, 0, y - 160),
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

describe('unknown blast class', () => {
  it('emits nothing and does not throw', () => {
    const { fx, emitted } = build();
    expect(() => fx.handle(EVENTS.EXPLOSION, 0, 0, 7, 0, 0)).not.toThrow();
    expect(emitted.additive).toHaveLength(0);
    expect(emitted.normal).toHaveLength(0);
  });
});

describe('recipe colours (D-23)', () => {
  function hue([r, g, b]) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max === min) return 0;
    const d = max - min;
    let h;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return (h * 60 + 360) % 360;
  }

  it('stay out of the hot-pink band reserved for enemy bullets', () => {
    const emitters = [...Object.values(RECIPES).flat(), ...HIT_RECIPE];
    expect(emitters.length).toBeGreaterThan(10);
    for (const e of emitters) {
      const h = hue(e.color);
      expect(h < 310 || h > 350).toBe(true);
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
