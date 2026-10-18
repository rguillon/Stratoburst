import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CAMERA_FOV_DEG, altitudeScale, applyCameraFit, fitCamera } from '../../src/render/camera_fit.js';
import { createGroundLayer } from '../../src/render/ground_layer.js';
import { TERRAIN_DEPTH } from '../../src/render/terrain_ring.js';

const W = 240;
const H = 320;
const ASPECTS = {
  'phone 9/19.5': 9 / 19.5,
  '4/3 landscape': 4 / 3,
  '3/4 portrait': 3 / 4,
  '16/9': 16 / 9,
};
// Points across the playfield, corners and edges included.
const POINTS = [
  [0, 0],
  [W, 0],
  [0, H],
  [W, H],
  [120, 160],
  [37, 251],
  [200, 12],
];

function fitted(aspect) {
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEG, aspect, 10, 4000);
  applyCameraFit(camera, fitCamera({ aspect, halfW: W / 2, halfH: H / 2 }));
  camera.updateMatrixWorld(true);
  return camera;
}

describe('createGroundLayer', () => {
  for (const [name, aspect] of Object.entries(ASPECTS)) {
    describe(name, () => {
      const camera = fitted(aspect);
      const layer = createGroundLayer({ playfieldW: W, playfieldH: H });
      layer.refit(camera);

      it('scales by the altitude scale of the terrain plane, between 1.03 and 1.09', () => {
        expect(layer.k).toBeCloseTo(altitudeScale(camera.position.y, TERRAIN_DEPTH, 0), 12);
        expect(layer.k).toBeGreaterThan(1.03);
        expect(layer.k).toBeLessThan(1.09);
      });

      it('positions the group at camera * (1 - k) with a uniform scale k', () => {
        const expected = camera.position.clone().multiplyScalar(1 - layer.k);
        expect(layer.group.position.distanceTo(expected)).toBeLessThan(1e-9);
        expect(layer.group.scale.toArray()).toEqual([layer.k, layer.k, layer.k]);
        // The projected plane lands exactly on the terrain plane.
        expect(layer.group.position.y).toBeCloseTo(TERRAIN_DEPTH, 9);
      });

      it('projects a ground point to the same NDC as the gameplay-plane point (1e-6)', () => {
        for (const [x, y] of POINTS) {
          const plane = new THREE.Vector3(x - W / 2, 0, y - H / 2).project(camera);
          const marker = new THREE.Object3D();
          marker.position.set(x - W / 2, 0, y - H / 2);
          layer.group.add(marker);
          layer.group.updateMatrixWorld(true);
          const ground = marker.getWorldPosition(new THREE.Vector3()).project(camera);
          layer.group.remove(marker);
          expect(Math.abs(ground.x - plane.x)).toBeLessThan(1e-6);
          expect(Math.abs(ground.y - plane.y)).toBeLessThan(1e-6);
        }
      });

      it('toWorld matches the world position of a child placed in the layer', () => {
        for (const [x, y] of POINTS) {
          const marker = new THREE.Object3D();
          marker.position.set(x - W / 2, 0, y - H / 2);
          layer.group.add(marker);
          layer.group.updateMatrixWorld(true);
          const expected = marker.getWorldPosition(new THREE.Vector3());
          layer.group.remove(marker);
          expect(layer.toWorld(x, y, new THREE.Vector3()).distanceTo(expected)).toBeLessThan(1e-9);
        }
      });
    });
  }

  it('refits to a new camera when the viewport changes', () => {
    const layer = createGroundLayer({ playfieldW: W, playfieldH: H });
    layer.refit(fitted(16 / 9));
    const wide = layer.k;
    layer.refit(fitted(9 / 19.5));
    expect(layer.k).toBeLessThan(wide);
  });

  it('honours a custom terrain depth', () => {
    const layer = createGroundLayer({ terrainDepth: -80, playfieldW: W, playfieldH: H });
    const camera = fitted(1);
    layer.refit(camera);
    expect(layer.k).toBeCloseTo(altitudeScale(camera.position.y, -80, 0), 12);
    expect(layer.group.position.y).toBeCloseTo(-80, 9);
  });

  it('starts at the identity scale until it is fitted', () => {
    const layer = createGroundLayer({ playfieldW: W, playfieldH: H });
    expect(layer.k).toBe(1);
    expect(layer.group.name).toBe('ground-layer');
  });
});
