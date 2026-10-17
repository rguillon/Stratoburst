import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  CAMERA_FOV_DEG,
  CAMERA_TILT_DEG,
  FIT_PAD,
  altitudeScale,
  applyCameraFit,
  fitCamera,
  projectCorners,
} from '../../src/render/camera_fit.js';

const HALF_W = 120;
const HALF_H = 160;
const ASPECTS = {
  'tall phone 9/19.5': 9 / 19.5,
  '9/16': 9 / 16,
  '3/4': 3 / 4,
  square: 1,
  '16/9': 16 / 9,
  'ultra-wide 21/9': 21 / 9,
};

function fittedCamera(aspect) {
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEG, aspect, 10, 4000);
  applyCameraFit(camera, fitCamera({ aspect }));
  camera.updateMatrixWorld(true);
  return camera;
}

function ndcCorners(camera) {
  const out = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      out.push(new THREE.Vector3(sx * HALF_W, 0, sz * HALF_H).project(camera));
    }
  }
  return out;
}

describe('fixed camera constants (D-08)', () => {
  it('tilts 25 degrees from vertical with a 30 degree vertical field of view', () => {
    expect(CAMERA_TILT_DEG).toBe(25);
    expect(CAMERA_FOV_DEG).toBe(30);
    expect(FIT_PAD).toBe(0.04);
  });
});

describe('fitCamera', () => {
  for (const [name, aspect] of Object.entries(ASPECTS)) {
    describe(name, () => {
      const camera = fittedCamera(aspect);
      const corners = ndcCorners(camera);
      const limit = 1 - FIT_PAD;

      it('keeps all four playfield corners inside the padded viewport', () => {
        expect(corners).toHaveLength(4);
        for (const c of corners) {
          expect(Math.abs(c.x)).toBeLessThanOrEqual(limit + 1e-6);
          expect(Math.abs(c.y)).toBeLessThanOrEqual(limit + 1e-6);
        }
      });

      it('fits tightly on the limiting axis', () => {
        const worst = Math.max(...corners.flatMap((c) => [Math.abs(c.x), Math.abs(c.y)]));
        expect(Math.abs(worst - limit)).toBeLessThan(0.01);
      });

      it('centres the playfield vertically', () => {
        const ys = corners.map((c) => c.y);
        expect(Math.abs((Math.max(...ys) + Math.min(...ys)) / 2)).toBeLessThan(0.01);
      });
    });
  }

  it('uses one orientation for every aspect: only distance and look-at change (D-09)', () => {
    const reference = fittedCamera(ASPECTS['3/4']).quaternion;
    for (const aspect of Object.values(ASPECTS)) {
      const q = fittedCamera(aspect).quaternion;
      for (const key of ['x', 'y', 'z', 'w']) expect(q[key]).toBeCloseTo(reference[key], 9);
    }
  });

  it('is deterministic for the same aspect', () => {
    expect(fitCamera({ aspect: 0.5 })).toEqual(fitCamera({ aspect: 0.5 }));
  });
});

describe('applyCameraFit', () => {
  it('sets the field of view and the camera aspect-independent tilt direction', () => {
    const camera = new THREE.PerspectiveCamera(60, 1, 10, 4000);
    const fit = { distance: 700, targetZ: 12 };
    applyCameraFit(camera, fit);
    const tilt = THREE.MathUtils.degToRad(CAMERA_TILT_DEG);
    expect(camera.fov).toBe(CAMERA_FOV_DEG);
    expect(camera.position.y).toBeCloseTo(700 * Math.cos(tilt), 6);
    expect(camera.position.z).toBeCloseTo(12 + 700 * Math.sin(tilt), 6);
    expect(camera.position.x).toBe(0);
  });

  it('honours explicit tilt and fov overrides', () => {
    const camera = new THREE.PerspectiveCamera(60, 1, 10, 4000);
    applyCameraFit(camera, { distance: 500, targetZ: 0 }, { tiltDeg: 0, fovDeg: 40 });
    expect(camera.fov).toBe(40);
    expect(camera.position.z).toBeCloseTo(0, 6);
    expect(camera.position.y).toBeCloseTo(500, 6);
  });
});

describe('projectCorners', () => {
  it('returns the four playfield corners in CSS pixels', () => {
    const camera = fittedCamera(390 / 844);
    const px = projectCorners(camera, 390, 844);
    expect(px).toHaveLength(4);
    for (const p of px) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(390);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(844);
    }
    // The far (smaller) edge is narrower than the near edge: a trapezoid.
    const xs = (zSign) => px.filter((_, i) => (i % 2 === 0) === (zSign < 0)).map((p) => p.x);
    const far = xs(-1);
    const near = xs(1);
    expect(Math.max(...far) - Math.min(...far)).toBeLessThan(Math.max(...near) - Math.min(...near));
  });
});

describe('altitudeScale (ARCHITECTURE Pattern 8)', () => {
  it('is 1 at the player altitude', () => {
    expect(altitudeScale(1000, 0, 0)).toBe(1);
  });

  it('grows for layers below the player and shrinks for layers above', () => {
    expect(altitudeScale(1000, -40, 0)).toBeCloseTo(1.04, 12);
    expect(altitudeScale(1000, 100, 0)).toBeCloseTo(0.9, 12);
  });
});
