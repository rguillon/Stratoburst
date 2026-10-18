import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  LIGHT_DURATION_HUGE,
  LIGHT_DURATION_LARGE,
  LIGHT_DURATION_MEDIUM,
  LIGHT_LIFT,
  LIGHT_PEAK_HUGE,
  LIGHT_PEAK_LARGE,
  LIGHT_PEAK_MEDIUM,
  createLightPool,
} from '../../src/fx/light_pool.js';
import { PALETTE } from '../../src/fx/palette.js';

const EVENTS = { EXPLOSION: 1, HIT: 2 };
const BLAST = { SMALL: 0, MEDIUM: 1, LARGE: 2, HUGE: 3 };

function build(options = {}) {
  return createLightPool({
    events: EVENTS,
    blast: BLAST,
    // The ground flag drops a point onto the terrain, so a test can tell which plane was used.
    toWorld: (x, y, ground, out) => out.set(x - 120, ground ? -40 : 0, y - 160),
    ...options,
  });
}

const RED = [1, 0, 0];

describe('createLightPool', () => {
  it('creates exactly 3 dark point lights with no falloff and a 140 unit reach', () => {
    const pool = build();
    expect(pool.lights).toHaveLength(3);
    for (const light of pool.lights) {
      expect(light.isPointLight).toBe(true);
      expect(light.intensity).toBe(0);
      expect(light.decay).toBe(0);
      expect(light.distance).toBe(140);
      expect(light.color.toArray()).toEqual(
        new THREE.Color().setRGB(...PALETTE.LIGHT_EXPLOSION.rgb).toArray(),
      );
    }
    expect(pool.flashes).toBe(0);
  });

  it('honours a different light count', () => {
    expect(build({ count: 2 }).lights).toHaveLength(2);
  });

  it('flashes a pulse that decays linearly to exactly zero within its duration', () => {
    const pool = build();
    pool.flash(1, 2, 3, 4, RED, 0.2);
    const [light] = pool.lights;
    expect(light.intensity).toBe(4);
    expect(light.position.toArray()).toEqual([1, 2, 3]);
    expect(light.color.toArray()).toEqual([1, 0, 0]);
    pool.update(0.1);
    expect(light.intensity).toBeCloseTo(2, 5);
    pool.update(0.05);
    expect(light.intensity).toBeCloseTo(1, 5);
    pool.update(0.05);
    expect(light.intensity).toBe(0);
    pool.update(0.5);
    expect(light.intensity).toBe(0);
    expect(pool.flashes).toBe(1);
  });

  it('hands out the lights round-robin', () => {
    const pool = build();
    pool.flash(10, 0, 0, 1, RED, 1);
    pool.flash(20, 0, 0, 1, RED, 1);
    pool.update(2);
    pool.flash(30, 0, 0, 1, RED, 1);
    pool.update(2);
    pool.flash(40, 0, 0, 1, RED, 1);
    expect(pool.lights.map((light) => light.position.x)).toEqual([40, 20, 30]);
  });

  it('flashes a MEDIUM explosion at peak 3 for 0.15 s, 20 units above the blast', () => {
    const pool = build();
    pool.handle(EVENTS.EXPLOSION, 130, 170, BLAST.MEDIUM, 0, 0);
    const [light] = pool.lights;
    expect(LIGHT_PEAK_MEDIUM).toBe(3);
    expect(LIGHT_DURATION_MEDIUM).toBe(0.15);
    expect(LIGHT_LIFT).toBe(20);
    expect(light.intensity).toBe(3);
    expect(light.position.toArray()).toEqual([10, LIGHT_LIFT, 10]);
    pool.update(0.15);
    expect(light.intensity).toBe(0);
  });

  it('flashes a LARGE explosion at peak 6 for 0.25 s', () => {
    const pool = build();
    pool.handle(EVENTS.EXPLOSION, 130, 170, BLAST.LARGE, 0, 0);
    const [light] = pool.lights;
    expect(LIGHT_PEAK_LARGE).toBe(6);
    expect(LIGHT_DURATION_LARGE).toBe(0.25);
    expect(light.intensity).toBe(6);
    pool.update(0.24);
    expect(light.intensity).toBeGreaterThan(0);
    pool.update(0.01);
    expect(light.intensity).toBe(0);
  });

  it('flashes a HUGE explosion harder and longer than any other class (D-14)', () => {
    const pool = build();
    pool.handle(EVENTS.EXPLOSION, 130, 170, BLAST.HUGE, 0, 0);
    const [light] = pool.lights;
    expect(LIGHT_PEAK_HUGE).toBeGreaterThan(LIGHT_PEAK_LARGE);
    expect(LIGHT_DURATION_HUGE).toBeGreaterThan(LIGHT_DURATION_LARGE);
    expect(light.intensity).toBe(LIGHT_PEAK_HUGE);
    expect(light.position.toArray()).toEqual([10, LIGHT_LIFT, 10]);
    pool.update(LIGHT_DURATION_HUGE - 0.01);
    expect(light.intensity).toBeGreaterThan(0);
    pool.update(0.01);
    expect(light.intensity).toBe(0);
  });

  it('lights a ground blast on the terrain', () => {
    const pool = build();
    pool.handle(EVENTS.EXPLOSION, 130, 170, BLAST.LARGE, 1, 0);
    expect(pool.lights[0].position.toArray()).toEqual([10, -40 + LIGHT_LIFT, 10]);
  });

  it('does not flash for SMALL explosions, hits or other events', () => {
    const pool = build();
    pool.handle(EVENTS.EXPLOSION, 130, 170, BLAST.SMALL, 0, 0);
    pool.handle(EVENTS.HIT, 130, 170, BLAST.LARGE, 0, 0);
    pool.handle(99, 130, 170, BLAST.LARGE, 0, 0);
    expect(pool.flashes).toBe(0);
    expect(pool.lights.every((light) => light.intensity === 0)).toBe(true);
  });

  it('setEnabled(0) darkens every light and ignores later flashes, keeping the lights in place', () => {
    const pool = build();
    pool.flash(0, 0, 0, 5, RED, 1);
    pool.flash(0, 0, 0, 5, RED, 1);
    pool.setEnabled(0);
    expect(pool.lights.map((light) => light.intensity)).toEqual([0, 0, 0]);
    pool.flash(0, 0, 0, 5, RED, 1);
    pool.handle(EVENTS.EXPLOSION, 130, 170, BLAST.LARGE, 0, 0);
    pool.update(0.1);
    expect(pool.lights.map((light) => light.intensity)).toEqual([0, 0, 0]);
    expect(pool.lights).toHaveLength(3);
    expect(pool.lights.every((light) => light.visible)).toBe(true);
    expect(pool.flashes).toBe(2);
  });

  it('limits flashes to the first n lights when the tier allows n', () => {
    const pool = build();
    pool.setEnabled(2);
    pool.flash(1, 0, 0, 1, RED, 1);
    pool.flash(2, 0, 0, 1, RED, 1);
    pool.update(2);
    pool.flash(3, 0, 0, 1, RED, 1);
    pool.update(2);
    pool.flash(4, 0, 0, 1, RED, 1);
    expect(pool.lights.map((light) => light.position.x)).toEqual([3, 4, 0]);
    expect(pool.lights[2].intensity).toBe(0);
  });

  it('darkens the lights that a lower tier switches off, mid pulse', () => {
    const pool = build();
    pool.flash(1, 0, 0, 3, RED, 1);
    pool.flash(2, 0, 0, 3, RED, 1);
    pool.flash(3, 0, 0, 3, RED, 1);
    pool.setEnabled(1);
    expect(pool.lights.map((light) => light.intensity)).toEqual([3, 0, 0]);
    pool.update(0.5);
    expect(pool.lights.map((light) => light.intensity)).toEqual([1.5, 0, 0]);
    pool.setEnabled(3);
    expect(pool.lights.map((light) => light.intensity)).toEqual([1.5, 0, 0]);
  });

  it('clamps setEnabled to the pool size and to zero', () => {
    const pool = build();
    pool.setEnabled(9);
    pool.flash(1, 0, 0, 1, RED, 1);
    pool.flash(2, 0, 0, 1, RED, 1);
    pool.flash(3, 0, 0, 1, RED, 1);
    expect(pool.lights.map((light) => light.intensity)).toEqual([1, 1, 1]);
    pool.setEnabled(-4);
    expect(pool.lights.map((light) => light.intensity)).toEqual([0, 0, 0]);
  });

  it('re-triggers a busy light from the larger of its current and the new peak', () => {
    const pool = build();
    pool.flash(1, 0, 0, 6, RED, 1);
    pool.update(0.5); // intensity 3
    pool.flash(2, 0, 0, 1, RED, 1);
    pool.flash(3, 0, 0, 1, RED, 1);
    // Three lights, three flashes: each took a fresh light. A fourth inside the second re-triggers.
    pool.flash(4, 0, 0, 2, RED, 1);
    const newest = pool.lights[2];
    expect(newest.position.x).toBe(4);
    expect(newest.intensity).toBe(2); // max(its own current 1, new 2)
    pool.update(0.4);
    pool.flash(5, 0, 0, 0.5, RED, 1);
    expect(newest.position.x).toBe(5);
    expect(newest.intensity).toBeCloseTo(1.2, 4); // max(current 1.2, new 0.5): no dip, no jump
  });

  it('never starts more than 3 new pulses inside one second, so continuous explosions cannot strobe', () => {
    const pool = build();
    let darkToLit = 0;
    let wasDark = true;
    for (let step = 0; step < 100; step += 1) {
      // A MEDIUM explosion every 0.05 s for 5 seconds.
      pool.handle(EVENTS.EXPLOSION, 130, 170, BLAST.MEDIUM, 0, 0);
      pool.update(0.05);
      const dark = pool.lights.every((light) => light.intensity === 0);
      if (wasDark && !dark) darkToLit += 1;
      wasDark = dark;
    }
    // Every re-trigger of a still-lit light keeps the scene lit, so the screen never goes
    // dark and bright again more than the budget allows.
    expect(darkToLit).toBeLessThanOrEqual(1);
    expect(pool.flashes).toBe(100);
  });

  it('drops a flash that the budget refuses while the newest light is dark, then flashes again after the window', () => {
    const pool = build();
    pool.flash(1, 0, 0, 1, RED, 0.1);
    pool.flash(2, 0, 0, 1, RED, 0.1);
    pool.flash(3, 0, 0, 1, RED, 0.1);
    pool.update(0.5);
    pool.flash(4, 0, 0, 1, RED, 0.1); // a fourth pulse inside one second, from dark: refused
    expect(pool.flashes).toBe(3);
    expect(pool.lights.map((light) => light.position.x)).toEqual([1, 2, 3]);
    expect(pool.lights.every((light) => light.intensity === 0)).toBe(true);
    pool.update(0.6);
    pool.flash(5, 0, 0, 1, RED, 0.1);
    expect(pool.flashes).toBe(4);
    expect(pool.lights[0].position.x).toBe(5);
    expect(pool.lights[0].intensity).toBe(1);
  });

  it('merges a flash into the newest lit light when the budget is spent', () => {
    const pool = build();
    pool.flash(1, 0, 0, 1, RED, 1);
    pool.flash(2, 0, 0, 1, RED, 1);
    pool.flash(3, 0, 0, 1, RED, 1);
    pool.flash(9, 0, 0, 1, RED, 1);
    expect(pool.lights.map((light) => light.position.x)).toEqual([1, 2, 9]);
  });
});
