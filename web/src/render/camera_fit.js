import * as THREE from 'three';

// The camera is fully fixed in orientation (D-08, D-09): 25 degrees from vertical, 30 degree
// vertical FOV. Only the distance and the look-at target change with the viewport aspect.
export const CAMERA_TILT_DEG = 25;
export const CAMERA_FOV_DEG = 30;
export const FIT_PAD = 0.04;

const DEFAULT_HALF_W = 120;
const DEFAULT_HALF_H = 160;
const MIN_DISTANCE = 10;
const MAX_DISTANCE = 20000;
const TARGET_Z_RANGE = 600;
const SEARCH_STEPS = 60;
const OUTER_PASSES = 4;

function placeCamera(camera, distance, targetZ, tiltDeg) {
  const tilt = THREE.MathUtils.degToRad(tiltDeg);
  camera.position.set(0, Math.cos(tilt) * distance, targetZ + Math.sin(tilt) * distance);
  camera.lookAt(0, 0, targetZ);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
}

// Playfield corners in world space: indexed [-x far, -x near, +x far, +x near].
function cornerPoints(halfW, halfH) {
  return [
    new THREE.Vector3(-halfW, 0, -halfH),
    new THREE.Vector3(-halfW, 0, halfH),
    new THREE.Vector3(halfW, 0, -halfH),
    new THREE.Vector3(halfW, 0, halfH),
  ];
}

// Returns {distance, targetZ}. Pure given the viewport aspect: a scratch camera is used.
export function fitCamera({
  aspect,
  halfW = DEFAULT_HALF_W,
  halfH = DEFAULT_HALF_H,
  tiltDeg = CAMERA_TILT_DEG,
  fovDeg = CAMERA_FOV_DEG,
  pad = FIT_PAD,
}) {
  const camera = new THREE.PerspectiveCamera(fovDeg, aspect, 1, 100000);
  const corners = cornerPoints(halfW, halfH);
  const scratch = new THREE.Vector3();
  const limit = 1 - pad;

  function bounds(distance, targetZ) {
    placeCamera(camera, distance, targetZ, tiltDeg);
    let worst = 0;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const corner of corners) {
      scratch.copy(corner).project(camera);
      worst = Math.max(worst, Math.abs(scratch.x), Math.abs(scratch.y));
      minY = Math.min(minY, scratch.y);
      maxY = Math.max(maxY, scratch.y);
    }
    return { worst, centreY: (minY + maxY) / 2 };
  }

  // Smallest distance that keeps every corner inside the padded NDC box.
  function searchDistance(targetZ) {
    let lo = MIN_DISTANCE;
    let hi = MAX_DISTANCE;
    for (let i = 0; i < SEARCH_STEPS; i++) {
      const mid = (lo + hi) / 2;
      if (bounds(mid, targetZ).worst <= limit) hi = mid;
      else lo = mid;
    }
    return hi;
  }

  // Look-at Z that centres the projected box vertically at a given distance. The centre moves
  // monotonically with the target, so the direction is read from the lower end.
  function searchTargetZ(distance) {
    let lo = -TARGET_Z_RANGE;
    let hi = TARGET_Z_RANGE;
    const loSign = Math.sign(bounds(distance, lo).centreY);
    for (let i = 0; i < SEARCH_STEPS; i++) {
      const mid = (lo + hi) / 2;
      if (Math.sign(bounds(distance, mid).centreY) === loSign) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  }

  let targetZ = 0;
  let distance = searchDistance(targetZ);
  for (let pass = 0; pass < OUTER_PASSES; pass++) {
    targetZ = searchTargetZ(distance);
    distance = searchDistance(targetZ);
  }
  return { distance, targetZ };
}

export function applyCameraFit(
  camera,
  fit,
  { tiltDeg = CAMERA_TILT_DEG, fovDeg = CAMERA_FOV_DEG } = {},
) {
  camera.fov = fovDeg;
  placeCamera(camera, fit.distance, fit.targetZ, tiltDeg);
}

// The four playfield corners in CSS pixels, for debug and e2e: [-x far, -x near, +x far, +x near].
export function projectCorners(
  camera,
  viewportW,
  viewportH,
  halfW = DEFAULT_HALF_W,
  halfH = DEFAULT_HALF_H,
) {
  camera.updateMatrixWorld(true);
  return cornerPoints(halfW, halfH).map((corner) => {
    corner.project(camera);
    return { x: ((corner.x + 1) / 2) * viewportW, y: ((1 - corner.y) / 2) * viewportH };
  });
}

// The single altitude-mapping function (ARCHITECTURE Pattern 8, D-08): the on-screen scale of
// a layer at layerHeight relative to the gameplay plane at playerHeight. Phase 1 gameplay all
// sits on the player plane, so nothing applies it yet; Phase 2 shadows and Phase 3 ground
// units will.
export function altitudeScale(cameraHeight, layerHeight, playerHeight) {
  return (cameraHeight - layerHeight) / (cameraHeight - playerHeight);
}
