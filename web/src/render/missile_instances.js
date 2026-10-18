import * as THREE from 'three';
import { PALETTE } from '../fx/palette.js';
import { bake, lathe, tint } from './models/model_kit.js';

// The homing missiles (PLYR-05, D-03): one InstancedMesh of a small smooth violet missile, turned by
// the angle Python publishes (0 = up the screen), and a glowing violet exhaust trail puffed into the
// additive particle layer. `data` is the channel Python assigns into (stride 4: x, y, angle, life
// fraction). Violet is far from the reserved enemy-bullet pink (D-23).
const STRIDE = 4;
const ANGLE = 2;

// The missile is about 7 units long and 2.4 wide; the nose points up the screen at angle 0.
const HALF_LENGTH = 3.5;
const PROFILE = [
  [0, -HALF_LENGTH],
  [0.9, -HALF_LENGTH + 0.4],
  [1.2, -HALF_LENGTH + 1.4],
  [1.2, 1.2],
  [0.8, 2.4],
  [0, HALF_LENGTH],
];

// One exhaust puff per live missile about every 50 ms (fewer missiles are puffed at lower tiers).
export const TRAIL_CADENCE_S = 0.05;
const TRAIL_LIFE = 0.35;
const TRAIL_SIZE_START = 2.4;
const TRAIL_SIZE_END = 0.5;
const TRAIL_BACKFLOW = 9; // units per second the puff drifts away from the nose

// Module-level scratch objects: update() runs every frame and must not allocate.
const matrix = new THREE.Matrix4();
const position = new THREE.Vector3();
const quaternion = new THREE.Quaternion();
const scale = new THREE.Vector3(1, 1, 1);
const UP = new THREE.Vector3(0, 1, 0);

// The missile body: a lathe along Y turned so its nose points -Z (up the screen), tinted violet.
// Built once; the HDR vertex colour is what makes it bloom.
function buildMissileGeometry() {
  const body = lathe(PROFILE, 'mid').rotateX(-Math.PI / 2);
  return bake([tint(body, PALETTE.MISSILE.rgb)], 'missile');
}

export function createMissileInstances({ data, capacity, layers, getScale, playfieldW, playfieldH }) {
  const material = new THREE.MeshBasicMaterial({ vertexColors: true });
  const mesh = new THREE.InstancedMesh(buildMissileGeometry(), material, capacity);
  mesh.name = 'missiles';
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;

  const halfW = playfieldW / 2;
  const halfH = playfieldH / 2;
  const [tr, tg, tb] = PALETTE.MISSILE_TRAIL.rgb;
  let nextPuffS = 0;
  let rotation = 0; // which missile the next puffs start with, so a capped count still serves all

  function puff(base) {
    const angle = data[base + ANGLE];
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    // The tail is behind the nose, against the flight direction (sin, -cos) in logical coordinates.
    layers.additive.emit(
      data[base] - sin * HALF_LENGTH - halfW,
      0,
      data[base + 1] + cos * HALF_LENGTH - halfH,
      -sin * TRAIL_BACKFLOW,
      0,
      cos * TRAIL_BACKFLOW,
      TRAIL_LIFE,
      TRAIL_SIZE_START,
      TRAIL_SIZE_END,
      tr,
      tg,
      tb,
      0,
    );
  }

  // `timeS` is the effect clock in seconds; it paces the trail and is presentation only.
  function update(n, timeS = 0) {
    const count = Math.min(n, capacity);
    mesh.count = count;
    if (count === 0) return;
    for (let i = 0; i < count; i++) {
      const base = i * STRIDE;
      position.set(data[base] - halfW, 0, data[base + 1] - halfH);
      // Turning about Y by -angle maps the nose (0, 0, -1) to (sin a, 0, -cos a), the flight direction.
      quaternion.setFromAxisAngle(UP, -data[base + ANGLE]);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(i, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    if (timeS < nextPuffS) return;
    nextPuffS = timeS + TRAIL_CADENCE_S;
    const puffs = Math.min(count, Math.max(1, Math.round(count * getScale())));
    for (let j = 0; j < puffs; j++) puff(((rotation + j) % count) * STRIDE);
    rotation = (rotation + puffs) % count;
  }

  return { mesh, update };
}
