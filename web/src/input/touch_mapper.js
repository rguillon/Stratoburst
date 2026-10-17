import * as THREE from 'three';

// Module-level scratch objects: the mapper runs once per frame and must not allocate.
const ndc = new THREE.Vector3();
const hit0 = new THREE.Vector3();
const hit1 = new THREE.Vector3();
const point = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const gameplayPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

// Intersects the camera ray through a pixel with the gameplay plane (Y = 0). Returns false
// when the ray never reaches the plane (aimed past the horizon).
function pixelToPlane(camera, viewportW, viewportH, px, py, out) {
  point.set((px / viewportW) * 2 - 1, -((py / viewportH) * 2 - 1));
  raycaster.setFromCamera(point, camera);
  return raycaster.ray.intersectPlane(gameplayPlane, out) !== null;
}

// Converts a finger displacement in CSS pixels into playfield units (INPT-02, D-12): the point
// of the gameplay plane under the ship's pixel, and under that pixel plus the finger delta,
// are unprojected through the camera, so the ship moves exactly as far on screen as the
// finger does. dy is Z, which grows with the logical y, so it carries over unchanged.
export function pixelDeltaToPlayfield({ camera, viewportW, viewportH, shipWorld, dxPx, dyPx }) {
  const zero = { dx: 0, dy: 0 };
  if (!Number.isFinite(dxPx) || !Number.isFinite(dyPx)) return zero;
  if (dxPx === 0 && dyPx === 0) return zero;
  if (!Number.isFinite(shipWorld.x) || !Number.isFinite(shipWorld.y) || !Number.isFinite(shipWorld.z)) {
    return zero;
  }

  ndc.copy(shipWorld).project(camera);
  const px0 = ((ndc.x + 1) / 2) * viewportW;
  const py0 = ((1 - ndc.y) / 2) * viewportH;
  if (!pixelToPlane(camera, viewportW, viewportH, px0, py0, hit0)) return zero;
  if (!pixelToPlane(camera, viewportW, viewportH, px0 + dxPx, py0 + dyPx, hit1)) return zero;

  const dx = hit1.x - hit0.x;
  const dy = hit1.z - hit0.z;
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return zero;
  return { dx, dy };
}
