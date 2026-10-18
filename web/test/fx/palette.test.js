import { describe, expect, it } from 'vitest';
import {
  BULLET_EXCLUSION_DEGREES,
  BULLET_MIN_SATURATION,
  PALETTE,
  hueDistance,
  hueOf,
  saturationOf,
} from '../../src/fx/palette.js';

describe('hueOf', () => {
  it('reads the primary and secondary hues', () => {
    expect(hueOf([1, 0, 0])).toBeCloseTo(0);
    expect(hueOf([1, 1, 0])).toBeCloseTo(60);
    expect(hueOf([0, 1, 0])).toBeCloseTo(120);
    expect(hueOf([0, 1, 1])).toBeCloseTo(180);
    expect(hueOf([0, 0, 1])).toBeCloseTo(240);
    expect(hueOf([1, 0, 1])).toBeCloseTo(300);
  });

  it('wraps a magenta-leaning red into the upper half of the circle', () => {
    expect(hueOf([1, 0, 0.5])).toBeCloseTo(330);
  });

  it('gives HDR colours the hue of their normalised form', () => {
    expect(hueOf([4, 2, 0])).toBeCloseTo(hueOf([1, 0.5, 0]));
    expect(hueOf([2.4, 3.2, 4.0])).toBeCloseTo(hueOf([0.6, 0.8, 1.0]));
  });

  it('is 0 for colours with no spread', () => {
    expect(hueOf([0, 0, 0])).toBe(0);
    expect(hueOf([3, 3, 3])).toBe(0);
  });
});

describe('saturationOf', () => {
  it('is 0 for black and greys and 1 for a pure hue', () => {
    expect(saturationOf([0, 0, 0])).toBe(0);
    expect(saturationOf([0.5, 0.5, 0.5])).toBe(0);
    expect(saturationOf([2, 0, 0])).toBe(1);
  });

  it('normalises by the largest channel, so HDR does not change it', () => {
    expect(saturationOf([4, 2, 0])).toBeCloseTo(saturationOf([1, 0.5, 0]));
    expect(saturationOf([1, 0.5, 0.5])).toBeCloseTo(0.5);
  });
});

describe('hueDistance', () => {
  it('is circular and symmetric', () => {
    expect(hueDistance(10, 350)).toBe(20);
    expect(hueDistance(350, 10)).toBe(20);
    expect(hueDistance(0, 180)).toBe(180);
    expect(hueDistance(90, 90)).toBe(0);
    expect(hueDistance(30, 330)).toBe(60);
  });
});

describe('PALETTE', () => {
  const halo = PALETTE.ENEMY_BULLET_HALO.rgb;
  const luma = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

  it('is frozen, all the way down', () => {
    expect(Object.isFrozen(PALETTE)).toBe(true);
    expect(Object.isFrozen(PALETTE.FIRE)).toBe(true);
    expect(Object.isFrozen(PALETTE.FIRE.rgb)).toBe(true);
  });

  it('only uses the known roles', () => {
    const roles = new Set(['bullet', 'effect', 'weapon', 'pickup', 'scene', 'neutral']);
    for (const [name, { role }] of Object.entries(PALETTE)) {
      expect(roles.has(role), `${name} has role ${role}`).toBe(true);
    }
  });

  it('exports the reservation constants under their bullet names', () => {
    expect(BULLET_EXCLUSION_DEGREES).toBe(35);
    expect(BULLET_MIN_SATURATION).toBe(0.25);
  });

  it('keeps the enemy bullet halo orange-yellow and low dynamic range (it is drawn after bloom)', () => {
    const hue = hueOf(halo);
    expect(hue).toBeGreaterThanOrEqual(36);
    expect(hue).toBeLessThanOrEqual(46);
    expect(Math.max(...halo)).toBeLessThanOrEqual(0.98);
    expect(Math.max(...PALETTE.ENEMY_BULLET_CORE.rgb)).toBeLessThanOrEqual(0.98);
  });

  it('gives each orb layer a distinct luminance so it reads without hue: white core, dark rim', () => {
    expect(luma(PALETTE.ENEMY_BULLET_CORE.rgb)).toBeGreaterThan(luma(halo));
    expect(luma(halo)).toBeGreaterThan(luma(PALETTE.ENEMY_BULLET_RIM.rgb) * 3);
  });

  it('reserves orange-yellow: no saturated effect, weapon, pickup or scene colour is within 35 degrees of it', () => {
    const guarded = Object.entries(PALETTE).filter(([, { role }]) =>
      ['effect', 'weapon', 'pickup', 'scene'].includes(role),
    );
    expect(guarded.length).toBeGreaterThan(20);
    const offenders = guarded
      .filter(([, { rgb }]) => saturationOf(rgb) >= BULLET_MIN_SATURATION)
      .filter(([, { rgb }]) => hueDistance(hueOf(rgb), hueOf(halo)) < BULLET_EXCLUSION_DEGREES)
      .map(([name]) => name);
    expect(offenders, `colours too close to the enemy-bullet hue: ${offenders.join(', ')}`).toEqual([]);
  });

  it('moves fire and explosions off orange: white-hot core, red fire, magenta embers, cyan sparks', () => {
    expect(saturationOf(PALETTE.FIRE_CORE.rgb)).toBeLessThan(0.25);
    expect(hueDistance(hueOf(PALETTE.FIRE.rgb), 355)).toBeLessThanOrEqual(10);
    expect(hueDistance(hueOf(PALETTE.EMBER.rgb), 313)).toBeLessThanOrEqual(15);
    expect(hueDistance(hueOf(PALETTE.SPARK.rgb), 195)).toBeLessThanOrEqual(15);
  });

  it('retints the vulcan tracer and red crystal crimson, the bomb pickup acid green, the medal white-cyan', () => {
    expect(hueDistance(hueOf(PALETTE.VULCAN_TRACER.rgb), 350)).toBeLessThanOrEqual(15);
    expect(hueDistance(hueOf(PALETTE.CRYSTAL_RED.rgb), 350)).toBeLessThanOrEqual(15);
    expect(hueDistance(hueOf(PALETTE.BOMB_PICKUP.rgb), 114)).toBeLessThanOrEqual(15);
    expect(hueDistance(hueOf(PALETTE.MEDAL.rgb), 190)).toBeLessThanOrEqual(15);
  });

  it('defines the neon scene entries and the red beacon', () => {
    for (const name of [
      'NEON_CYAN',
      'NEON_MAGENTA',
      'NEON_RED',
      'NEON_VIOLET',
      'NEON_BLUE',
      'NEON_GREEN',
    ]) {
      expect(PALETTE[name]?.role, name).toBe('scene');
    }
    expect(PALETTE.BEACON_RED.role).toBe('effect');
    expect(PALETTE.BEACON_AMBER).toBeUndefined();
  });

  it('places the blue laser near 215 and the purple missiles near 257 degrees', () => {
    expect(hueOf(PALETTE.LASER_GLOW.rgb)).toBeGreaterThan(205);
    expect(hueOf(PALETTE.LASER_GLOW.rgb)).toBeLessThan(235);
    expect(hueOf(PALETTE.MISSILE.rgb)).toBeGreaterThan(245);
    expect(hueOf(PALETTE.MISSILE.rgb)).toBeLessThan(270);
  });
});
