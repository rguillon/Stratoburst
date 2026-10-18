import * as THREE from 'three';
import { altitudeScale } from './camera_fit.js';
import { TERRAIN_DEPTH } from './terrain_ring.js';

// The ground layer (D-21, RESEARCH Pattern 14). Gameplay and bullets live on the y = 0 plane but
// the terrain sits at TERRAIN_DEPTH, so a tank drawn at its logical (x, z) on the terrain would
// appear offset from where the bolts visibly hit it. Everything anchored to the terrain is
// authored in plane coordinates (x - W/2, 0, y - H/2) inside one group whose transform is the
// central projection from the camera onto the terrain plane: P' = C + k (P - C), that is
// position = C * (1 - k) and a uniform scale k. A plane point then lands on the terrain along the
// same camera ray, so it projects to the same pixel as the bullet-plane point.
export function createGroundLayer({ terrainDepth = TERRAIN_DEPTH, playfieldW, playfieldH }) {
  const group = new THREE.Group();
  group.name = 'ground-layer';
  const halfW = playfieldW / 2;
  const halfH = playfieldH / 2;
  let k = 1;

  // Recomputed whenever the camera refits; reads only the camera position.
  function refit(camera) {
    k = altitudeScale(camera.position.y, terrainDepth, 0);
    group.position.copy(camera.position).multiplyScalar(1 - k);
    group.scale.setScalar(k);
    group.updateMatrixWorld(true);
  }

  // The world position of a logical playfield point placed in the layer (used by particles).
  function toWorld(x, y, out) {
    return out.set(
      (x - halfW) * k + group.position.x,
      group.position.y,
      (y - halfH) * k + group.position.z,
    );
  }

  return {
    group,
    refit,
    toWorld,
    get k() {
      return k;
    },
  };
}
