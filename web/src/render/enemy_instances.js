import * as THREE from 'three';
import { enemyModel, hasModel } from './models/enemy_models.js';
import { tint } from './models/model_kit.js';

const STRIDE = 8; // x, y, angle, flash, hp_frac, kind, aux, spare
const ANGLE = 2;
const FLASH = 3;
const KIND = 5;

// Military tones for the primitive stand-ins, every channel below 1.0.
const BASE_COLORS = {
  JET: [0.36, 0.42, 0.24], // olive
  HELI: [0.55, 0.5, 0.34], // khaki
  CARRIER: [0.3, 0.36, 0.32], // grey-green
  TANK: [0.62, 0.52, 0.34], // sand
  TURRET: [0.4, 0.44, 0.38], // grey-green
};
const FALLBACK_COLOR = [0.45, 0.45, 0.4];

// The body colour comes from the model's vertex colours; the instance colour only scales it. A hit
// multiplies by 6, which pushes the desaturated military colours past the bloom threshold: the
// Phase 1 HDR flash mechanism (ENMY-08).
const REST_COLOR = [1, 1, 1];
const FLASH_COLOR = [6, 6, 6];

// How fast a helicopter rotor spins, in radians per second of the effect clock.
export const ROTOR_RATE = 30;

// Collision radii of the Python kinds (tuning.ENEMY_RADIUS); the primitive shapes are sized to them.
const RADII = { JET: 9, HELI: 10, CARRIER: 14, TANK: 11, TURRET: 10 };
const FALLBACK_RADIUS = 10;

// Module-level scratch objects: update() runs every frame and must not allocate.
const matrix = new THREE.Matrix4();
const position = new THREE.Vector3();
const quaternion = new THREE.Quaternion();
const topQuaternion = new THREE.Quaternion();
const scale = new THREE.Vector3(1, 1, 1);
const color = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

// The simple shape of each kind, pointing +Z (the direction an angle of 0 heads). It stands in for
// every kind that has no code-built model yet.
export function basicEnemyGeometry(kindName) {
  const r = RADII[kindName] ?? FALLBACK_RADIUS;
  switch (kindName) {
    case 'JET':
      return new THREE.ConeGeometry(r * 0.7, r * 2, 8).rotateX(Math.PI / 2);
    case 'HELI':
      return new THREE.CapsuleGeometry(r * 0.5, r, 4, 8).rotateX(Math.PI / 2);
    case 'CARRIER':
      return new THREE.BoxGeometry(r * 1.2, r * 0.5, r * 2);
    case 'TANK':
      return new THREE.BoxGeometry(r * 1.3, r * 0.6, r * 1.8);
    case 'TURRET':
      return new THREE.CylinderGeometry(r * 0.6, r * 0.8, r * 0.7, 12);
    default:
      return new THREE.BoxGeometry(r, r * 0.6, r);
  }
}

// The default model source: the code-built model when the kind has one, else a tinted primitive
// (built once per kind, so a detail change never generates anything).
function defaultGeometryFor() {
  const primitives = new Map();
  return (kindName, detail) => {
    if (hasModel(kindName)) return enemyModel(kindName, detail);
    if (!primitives.has(kindName)) {
      const body = tint(basicEnemyGeometry(kindName), BASE_COLORS[kindName] ?? FALLBACK_COLOR);
      primitives.set(kindName, { body, glow: null, top: null });
    }
    return primitives.get(kindName);
  };
}

// Each enemy kind is drawn by a body InstancedMesh (lit hull), a glow InstancedMesh (HDR accents,
// when the model has any) written with the same matrix, and a third mesh for a part that turns
// (when the model has one). `data` is the Float32Array Python assigns into (stride 8); `kinds` is
// the manifest's name -> kind value map. Each instance is routed to its kind's meshes, placed at
// (x - W/2, 0, y - H/2) and turned about Y by its heading angle.
export function createEnemyInstances({
  data,
  capacity,
  kinds,
  playfieldW,
  playfieldH,
  detail = 'high',
  geometryFor = defaultGeometryFor(),
}) {
  const bodyMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.55,
    metalness: 0.25,
  });
  const glowMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
  const entries = []; // indexed by the kind value in the channel
  const meshes = [];

  function instanced(geometry, material, name) {
    const mesh = new THREE.InstancedMesh(geometry, material, capacity);
    mesh.name = name;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    meshes.push(mesh);
    return mesh;
  }

  for (const [name, value] of Object.entries(kinds)) {
    const model = geometryFor(name, detail);
    const lower = name.toLowerCase();
    const body = instanced(model.body, bodyMaterial, `enemy-${lower}`);
    // Allocate instanceColor up front so the first update never reshapes the buffers.
    body.setColorAt(0, color.setRGB(REST_COLOR[0], REST_COLOR[1], REST_COLOR[2]));
    body.instanceColor.setUsage(THREE.DynamicDrawUsage);
    const glow = model.glow === null ? null : instanced(model.glow, glowMaterial, `enemy-${lower}-glow`);
    entries[value] = { name, body, glow, index: value };
  }
  const slotCount = entries.length;
  const counts = new Int32Array(slotCount);
  const live = entries.filter((entry) => entry !== undefined);

  const halfW = playfieldW / 2;
  const halfH = playfieldH / 2;

  // Swaps the geometries of the existing meshes for the cached ones of `next`; creates no mesh and
  // generates nothing (T-02-09).
  function setDetail(next) {
    for (const entry of live) {
      const model = geometryFor(entry.name, next);
      entry.body.geometry = model.body;
      if (entry.glow !== null) entry.glow.geometry = model.glow;
    }
  }

  function update(n) {
    const count = Math.min(n, capacity);
    counts.fill(0);
    for (let i = 0; i < count; i++) {
      const base = i * STRIDE;
      const entry = entries[data[base + KIND]];
      if (entry === undefined) continue;
      position.set(data[base] - halfW, 0, data[base + 1] - halfH);
      quaternion.setFromAxisAngle(UP, data[base + ANGLE]);
      matrix.compose(position, quaternion, scale);
      const slot = counts[entry.index]++;
      entry.body.setMatrixAt(slot, matrix);
      if (entry.glow !== null) entry.glow.setMatrixAt(slot, matrix);
      const rgb = data[base + FLASH] > 0 ? FLASH_COLOR : REST_COLOR;
      entry.body.setColorAt(slot, color.setRGB(rgb[0], rgb[1], rgb[2]));
    }
    for (let k = 0; k < live.length; k++) {
      const entry = live[k];
      const written = counts[entry.index];
      entry.body.count = written;
      if (entry.glow !== null) entry.glow.count = written;
      if (written === 0) continue; // nothing was written, so nothing to upload
      entry.body.instanceMatrix.needsUpdate = true;
      entry.body.instanceColor.needsUpdate = true;
      if (entry.glow !== null) entry.glow.instanceMatrix.needsUpdate = true;
    }
  }

  return { meshes, update, setDetail };
}
