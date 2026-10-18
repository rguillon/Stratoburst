import { describe, expect, it } from 'vitest';
import { createExplosionFx, mulberry32 } from '../../src/fx/explosion_fx.js';

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
  it('turns a SMALL explosion into one core flash plus 20 sparks on the additive layer', () => {
    const { fx, emitted } = build();
    fx.handle(EVENTS.EXPLOSION, 130, 170, BLAST.SMALL, 0, 0);
    expect(emitted.additive).toHaveLength(21);
    expect(emitted.normal).toHaveLength(0);
    const [core] = emitted.additive;
    expect(core.slice(0, 3)).toEqual([10, 0, 10]); // toWorld(130, 170)
    expect(core.slice(7, 9)).toEqual([10, 18]); // core sizes
    expect(core[6]).toBeCloseTo(0.18, 5);
  });

  it('throws sparks in horizontal directions at 30-70 units per second', () => {
    const { fx, emitted } = build();
    fx.handle(EVENTS.EXPLOSION, 120, 160, BLAST.SMALL, 0, 0);
    for (const p of emitted.additive.slice(1)) {
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
    fx.handle(EVENTS.HIT, 1, 2, 0, 0, 0);
    fx.handle(99, 1, 2, 0, 0, 0);
    expect(emitted.additive).toHaveLength(0);
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
