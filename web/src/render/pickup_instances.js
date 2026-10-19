import * as THREE from 'three';
import { PALETTE } from '../fx/palette.js';
import { bake, lathe, place, tint } from './models/model_kit.js';

// The power-up crystals (PLYR-04, D-16): one InstancedMesh of a smooth glowing gem that spins and
// bobs, and a second one of flat hexagonal holo chips for the medals (SCOR-02, D-15). `data` is the
// channel Python assigns into (stride 4: x, y, colour index, kind). The colour index is decided in
// Python (the crystal cycle, the medal chain tier), so what is drawn is what the catch will give and
// JS never recomputes it.
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

// The medal is a hexagonal chip about 7.6 units across and 1.4 thick, bevelled at the rim. It stands
// on its edge so the spin about the vertical axis flips it like a coin and the tilted camera sees it.
const CHIP_PROFILE = [
  [0, -0.7],
  [3.4, -0.7],
  [3.8, 0],
  [3.4, 0.7],
  [0, 0.7],
];
const CHIP_SEGMENTS = Object.freeze({ high: 6, mid: 6, low: 6 });

// Colour index (0 red, 1 blue, 2 purple) -> palette entry, in the order Python's cycle uses.
const CYCLE = Object.freeze([PALETTE.CRYSTAL_RED, PALETTE.CRYSTAL_BLUE, PALETTE.CRYSTAL_PURPLE]);

// A medal's colour index is the chain tier (0 at the base value up to MEDAL_TIER_MAX at the cap): the
// chip brightens from PALETTE.MEDAL toward white as the chain climbs, never taking on a hue.
export const MEDAL_TIER_MAX = 6;
const MEDAL_FROM = PALETTE.MEDAL.rgb;
const MEDAL_TO = PALETTE.MEDAL_WHITE.rgb;

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
const medalColor = [0, 0, 0];

// The chip colour of a chain tier, as a mix of the two palette ends; an index that is not a number
// or is out of range counts as the nearest valid tier.
export function medalRgb(tier, out) {
  const t = Number.isFinite(tier) ? Math.min(Math.max(tier, 0), MEDAL_TIER_MAX) / MEDAL_TIER_MAX : 0;
  for (let k = 0; k < 3; k++) out[k] = MEDAL_FROM[k] + (MEDAL_TO[k] - MEDAL_FROM[k]) * t;
  return out;
}

function buildGemGeometry() {
  return bake([tint(lathe(PROFILE, 'mid', GEM_SEGMENTS), [1, 1, 1])], 'crystal');
}

function buildChipGeometry() {
  const chip = place(lathe(CHIP_PROFILE, 'mid', CHIP_SEGMENTS), { rotation: [Math.PI / 2, 0, 0] });
  return bake([tint(chip, [1, 1, 1])], 'medal');
}

// One InstancedMesh with instance colours allocated up front, so the first update never reshapes the
// buffers (and the shader is compiled with instance colours from the first prewarm).
function buildInstanced(geometry, name, capacity) {
  const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true }), capacity);
  mesh.name = name;
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.setColorAt(0, color.setRGB(1, 1, 1));
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  return mesh;
}

// `kinds` is the manifest's pickup name -> value map; BOMB and MEDAL need a look of their own. A colour
// index outside the cycle (a protocol fault) is drawn red rather than not at all.
export function createPickupInstances({ data, capacity, kinds, playfieldW, playfieldH }) {
  const mesh = buildInstanced(buildGemGeometry(), 'pickups', capacity);
  const medalMesh = buildInstanced(buildChipGeometry(), 'medals', capacity);

  const halfW = playfieldW / 2;
  const halfH = playfieldH / 2;
  const bombKind = kinds.BOMB;
  const medalKind = kinds.MEDAL;

  function paletteFor(base) {
    if (data[base + KIND] === bombKind) return PALETTE.BOMB_PICKUP;
    return CYCLE[data[base + COLOR]] ?? PALETTE.CRYSTAL_RED;
  }

  function compose(target, slot, base, phase) {
    position.set(data[base] - halfW, LIFT + Math.sin(phase * BOB_RATE) * BOB_AMPLITUDE, data[base + 1] - halfH);
    quaternion.setFromAxisAngle(UP, phase * SPIN_RATE);
    matrix.compose(position, quaternion, scale);
    target.setMatrixAt(slot, matrix);
  }

  // `timeS` is the effect clock in seconds; spin and bob are presentation only. Gems and medals share
  // the channel in any order, so each mesh counts its own instances.
  function update(n, timeS = 0) {
    const count = Math.min(n, capacity);
    let gems = 0;
    let medals = 0;
    for (let i = 0; i < count; i++) {
      const base = i * STRIDE;
      const phase = timeS + i * PHASE_STEP;
      if (data[base + KIND] === medalKind) {
        compose(medalMesh, medals, base, phase);
        const rgb = medalRgb(data[base + COLOR], medalColor);
        medalMesh.setColorAt(medals, color.setRGB(rgb[0], rgb[1], rgb[2]));
        medals += 1;
      } else {
        compose(mesh, gems, base, phase);
        const rgb = paletteFor(base).rgb;
        mesh.setColorAt(gems, color.setRGB(rgb[0], rgb[1], rgb[2]));
        gems += 1;
      }
    }
    mesh.count = gems;
    medalMesh.count = medals;
    if (gems > 0) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
    }
    if (medals > 0) {
      medalMesh.instanceMatrix.needsUpdate = true;
      medalMesh.instanceColor.needsUpdate = true;
    }
  }

  return { mesh, medalMesh, update };
}
