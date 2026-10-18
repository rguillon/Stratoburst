import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  MAX_AMPLITUDE,
  MAX_DURATION_S,
  SHAKE_BOMB,
  SHAKE_DEATH,
  createShake,
  withCameraOffset,
} from '../../src/fx/shake.js';

const EVENTS = { EXPLOSION: 1, HIT: 2, BOMB_DETONATE: 10 };
const STEP = 1 / 60;

function build() {
  return createShake({ events: EVENTS });
}

const magnitude = (out) => Math.hypot(out.x, out.z);

describe('the tuned shakes', () => {
  it('shakes a bomb strongly for half a second and never beyond the comfort ceilings', () => {
    expect(SHAKE_BOMB).toEqual({ amplitude: 3.0, durationS: 0.5 });
    expect(SHAKE_DEATH).toEqual({ amplitude: 1.6, durationS: 0.35 });
    expect(MAX_AMPLITUDE).toBe(3.0);
    expect(MAX_DURATION_S).toBe(0.5);
    expect(SHAKE_DEATH.amplitude).toBeLessThan(SHAKE_BOMB.amplitude);
  });
});

describe('createShake', () => {
  it('starts idle with a zero offset and no shakes counted', () => {
    const shake = build();
    const out = { x: 9, z: 9 };
    expect(shake.offset(out)).toBe(out);
    expect(out).toEqual({ x: 0, z: 0 });
    expect(shake.active).toBe(false);
    expect(shake.count).toBe(0);
  });

  it('never exceeds its amplitude and decays to exactly zero at its duration', () => {
    const shake = build();
    const out = { x: 0, z: 0 };
    shake.trigger(3, 0.5);
    expect(shake.active).toBe(true);
    let elapsed = 0;
    let peak = 0;
    let previousBound = Infinity;
    for (let frame = 0; frame < 29; frame += 1) {
      shake.update(STEP);
      elapsed += STEP;
      shake.offset(out);
      const m = magnitude(out);
      peak = Math.max(peak, m);
      expect(m).toBeLessThanOrEqual(3 + 1e-9);
      // The envelope is the bound the magnitude sits at: it only ever falls.
      const bound = 3 * (1 - elapsed / 0.5) ** 2;
      expect(m).toBeCloseTo(bound, 6);
      expect(bound).toBeLessThan(previousBound);
      previousBound = bound;
    }
    expect(peak).toBeGreaterThan(2);
    shake.update(STEP);
    shake.update(STEP);
    shake.offset(out);
    expect(out).toEqual({ x: 0, z: 0 });
    expect(shake.active).toBe(false);
  });

  it('is exactly zero when the duration has passed in one big step', () => {
    const shake = build();
    const out = { x: 0, z: 0 };
    shake.trigger(3, 0.5);
    shake.update(0.01);
    shake.update(0.5);
    expect(shake.offset(out)).toEqual({ x: 0, z: 0 });
    expect(shake.active).toBe(false);
  });

  it('jitters in both axes and in both directions while it runs', () => {
    const shake = build();
    const out = { x: 0, z: 0 };
    shake.trigger(3, 0.5);
    const xs = new Set();
    const zs = new Set();
    for (let frame = 0; frame < 10; frame += 1) {
      shake.update(STEP);
      shake.offset(out);
      xs.add(Math.sign(out.x));
      zs.add(Math.sign(out.z));
    }
    expect(xs.has(1) && xs.has(-1)).toBe(true);
    expect(zs.has(1) && zs.has(-1)).toBe(true);
  });

  it('is deterministic: the same seed gives the same jitter', () => {
    const run = () => {
      const shake = build();
      const out = { x: 0, z: 0 };
      shake.trigger(3, 0.5);
      const seen = [];
      for (let frame = 0; frame < 12; frame += 1) {
        shake.update(STEP);
        seen.push({ ...shake.offset(out) });
      }
      return seen;
    };
    expect(run()).toEqual(run());
  });

  it('keeps the stronger shake when a weaker one arrives during it', () => {
    const shake = build();
    const out = { x: 0, z: 0 };
    shake.trigger(3, 0.5);
    shake.update(0.05);
    shake.trigger(1.6, 0.35);
    for (let frame = 0; frame < 3; frame += 1) shake.update(STEP);
    shake.offset(out);
    // Still the 3.0 / 0.5 envelope, aged by 0.05 + 3 steps.
    expect(magnitude(out)).toBeCloseTo(3 * (1 - (0.05 + 3 * STEP) / 0.5) ** 2, 6);
    expect(shake.count).toBe(2);
  });

  it('replaces a shake that has faded below the new one', () => {
    const shake = build();
    const out = { x: 0, z: 0 };
    shake.trigger(3, 0.5);
    shake.update(0.45);
    shake.trigger(1.6, 0.35);
    shake.update(STEP);
    shake.offset(out);
    expect(magnitude(out)).toBeCloseTo(1.6 * (1 - STEP / 0.35) ** 2, 6);
  });

  it('restarts from full strength when a new trigger is at least as strong', () => {
    const shake = build();
    const out = { x: 0, z: 0 };
    shake.trigger(3, 0.5);
    shake.update(0.3);
    shake.trigger(3, 0.5);
    shake.update(STEP);
    shake.offset(out);
    expect(magnitude(out)).toBeCloseTo(3 * (1 - STEP / 0.5) ** 2, 6);
  });

  it('clamps an oversized trigger to the amplitude and duration ceilings', () => {
    const shake = build();
    const out = { x: 0, z: 0 };
    shake.trigger(50, 9);
    shake.update(STEP);
    shake.offset(out);
    expect(magnitude(out)).toBeLessThanOrEqual(MAX_AMPLITUDE + 1e-9);
    for (let frame = 0; frame < 31; frame += 1) shake.update(STEP);
    expect(shake.active).toBe(false);
  });

  it('ignores a trigger with no strength or no length', () => {
    const shake = build();
    shake.trigger(0, 0.5);
    shake.trigger(3, 0);
    shake.trigger(-1, 0.5);
    shake.trigger(Number.NaN, 0.5);
    expect(shake.active).toBe(false);
    expect(shake.count).toBe(0);
  });

  it('holds still when no time passes (paused) and continues where it stopped', () => {
    const shake = build();
    const first = { x: 0, z: 0 };
    const held = { x: 0, z: 0 };
    shake.trigger(3, 0.5);
    shake.update(0.1);
    shake.offset(first);
    for (let frame = 0; frame < 20; frame += 1) shake.update(0);
    shake.offset(held);
    expect(held).toEqual(first);
    expect(shake.active).toBe(true);
    shake.update(0.1);
    shake.offset(held);
    expect(magnitude(held)).toBeCloseTo(3 * (1 - 0.2 / 0.5) ** 2, 6);
  });

  it('does not move before the first update after a trigger', () => {
    const shake = build();
    const out = { x: 0, z: 0 };
    shake.trigger(3, 0.5);
    shake.offset(out);
    expect(out).toEqual({ x: 0, z: 0 });
    expect(shake.active).toBe(true);
  });

  describe('handle', () => {
    it('triggers the bomb shake on BOMB_DETONATE and counts it', () => {
      const shake = build();
      const out = { x: 0, z: 0 };
      shake.handle(EVENTS.BOMB_DETONATE, 120, 90, 0, 0, 0);
      expect(shake.active).toBe(true);
      expect(shake.count).toBe(1);
      shake.update(STEP);
      shake.offset(out);
      expect(magnitude(out)).toBeCloseTo(SHAKE_BOMB.amplitude * (1 - STEP / SHAKE_BOMB.durationS) ** 2, 6);
    });

    it('leaves the shake idle for ordinary events', () => {
      const shake = build();
      for (const type of [EVENTS.EXPLOSION, EVENTS.HIT]) shake.handle(type, 10, 10, 2, 0, 0);
      expect(shake.active).toBe(false);
      expect(shake.count).toBe(0);
    });
  });
});

describe('withCameraOffset', () => {
  function camera() {
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 1000);
    cam.position.set(1.5, 200, 260);
    cam.lookAt(0, 0, 10);
    cam.updateMatrixWorld();
    return cam;
  }

  it('renders once with the camera moved by the offset', () => {
    const cam = camera();
    const seen = [];
    withCameraOffset(cam, { x: 2, z: -3 }, () => {
      seen.push([cam.position.x, cam.position.y, cam.position.z, cam.matrixWorld.elements[12]]);
    });
    expect(seen).toEqual([[3.5, 200, 257, 3.5]]);
  });

  it('restores the exact position and matrix afterwards', () => {
    const cam = camera();
    const position = cam.position.toArray();
    const matrix = cam.matrixWorld.toArray();
    const inverse = cam.matrixWorldInverse.toArray();
    withCameraOffset(cam, { x: 2.7, z: -1.3 }, () => {});
    expect(cam.position.toArray()).toEqual(position);
    expect(cam.matrixWorld.toArray()).toEqual(matrix);
    expect(cam.matrixWorldInverse.toArray()).toEqual(inverse);
  });

  it('restores the camera even when the render throws, and lets the error through', () => {
    const cam = camera();
    const position = cam.position.toArray();
    const matrix = cam.matrixWorld.toArray();
    expect(() =>
      withCameraOffset(cam, { x: 5, z: 5 }, () => {
        throw new Error('render failed');
      }),
    ).toThrow('render failed');
    expect(cam.position.toArray()).toEqual(position);
    expect(cam.matrixWorld.toArray()).toEqual(matrix);
  });

  it('works with a render that is a bare method of an object', () => {
    const cam = camera();
    const rig = { calls: 0, render() { rig.calls += 1; } };
    withCameraOffset(cam, { x: 0, z: 0 }, rig.render);
    expect(rig.calls).toBe(1);
  });
});
