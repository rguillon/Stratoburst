import * as THREE from 'three';
import { PALETTE } from '../fx/palette.js';
import { bake, lathe, tint } from './models/model_kit.js';

// The power-up crystals (PLYR-04, D-16): one InstancedMesh of a smooth glowing gem that spins and
// bobs. `data` is the channel Python assigns into (stride 4: x, y, colour index, kind). The colour
// index is decided in Python (the crystal cycle), so what is drawn is what the catch will give and
// JS never recomputes the cycle.
const STRIDE = 4;
const COLOR = 2;
const KIND = 3;

// The gem is about 7 units tall and 4.4 wide: an elongated six-sided double point, smooth shaded.
const HALF_HEIGHT = 3.6;
const PROFILE = [
  [0, -HALF_HEIGHT],
  [2.0, -0.8],
  [2.2, 0.8],
  [0, HALF_HEIGHT],
];
const GEM_SEGMENTS = Object.freeze({ high: 6, mid: 6, low: 6 });

// Colour index (0 red, 1 blue, 2 purple) -> palette entry, in the order Python's cycle uses.
const CYCLE = Object.freeze([PALETTE.CRYSTAL_RED, PALETTE.CRYSTAL_BLUE, PALETTE.CRYSTAL_PURPLE]);

// Lifted off the gameplay plane so the gem reads as floating, then bobbing around that height.
export const LIFT = 2;
export const BOB_AMPLITUDE = 0.9;
export const BOB_RATE = 4; // radians per second
export const SPIN_RATE = 2.6; // radians per second
const PHASE_STEP = 1.7; // radians of spin and bob offset between neighbouring instances

// Module-level scratch objects: update() runs every frame and must not allocate.
const matrix = new THREE.Matrix4();
const position = new THREE.Vector3();
const quaternion = new THREE.Quaternion();
const scale = new THREE.Vector3(1, 1, 1);
const color = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

function buildGemGeometry() {
  return bake([tint(lathe(PROFILE, 'mid', GEM_SEGMENTS), [1, 1, 1])], 'crystal');
}

// `kinds` is the manifest's pickup name -> value map; only BOMB needs a colour of its own. A colour
// index outside the cycle (a protocol fault) is drawn red rather than not at all.
export function createPickupInstances({ data, capacity, kinds, playfieldW, playfieldH }) {
  const material = new THREE.MeshBasicMaterial({ vertexColors: true });
  const mesh = new THREE.InstancedMesh(buildGemGeometry(), material, capacity);
  mesh.name = 'pickups';
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // Allocate instanceColor up front so the first update never reshapes the buffers (and the
  // shader is compiled with instance colours from the first prewarm).
  mesh.setColorAt(0, color.setRGB(1, 1, 1));
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;

  const halfW = playfieldW / 2;
  const halfH = playfieldH / 2;
  const bombKind = kinds.BOMB;

  function paletteFor(base) {
    if (data[base + KIND] === bombKind) return PALETTE.BOMB_PICKUP;
    return CYCLE[data[base + COLOR]] ?? PALETTE.CRYSTAL_RED;
  }

  // `timeS` is the effect clock in seconds; spin and bob are presentation only.
  function update(n, timeS = 0) {
    const count = Math.min(n, capacity);
    mesh.count = count;
    if (count === 0) return;
    for (let i = 0; i < count; i++) {
      const base = i * STRIDE;
      const phase = timeS + i * PHASE_STEP;
      position.set(data[base] - halfW, LIFT + Math.sin(phase * BOB_RATE) * BOB_AMPLITUDE, data[base + 1] - halfH);
      quaternion.setFromAxisAngle(UP, phase * SPIN_RATE);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(i, matrix);
      const rgb = paletteFor(base).rgb;
      mesh.setColorAt(i, color.setRGB(rgb[0], rgb[1], rgb[2]));
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  }

  return { mesh, update };
}
