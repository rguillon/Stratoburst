import * as THREE from 'three';

const STRIDE = 8; // x, y, angle, flash, hp_frac, kind, aux, spare
const ANGLE = 2;
const KIND = 5;

// Military tones, every channel below 1.0 so a resting enemy never crosses the bloom threshold.
const BASE_COLORS = {
  JET: [0.36, 0.42, 0.24], // olive
  HELI: [0.55, 0.5, 0.34], // khaki
  CARRIER: [0.3, 0.36, 0.32], // grey-green
  TANK: [0.62, 0.52, 0.34], // sand
  TURRET: [0.4, 0.44, 0.38], // grey-green
};
const FALLBACK_COLOR = [0.45, 0.45, 0.4];

// Collision radii of the Python kinds (tuning.ENEMY_RADIUS); the primitive shapes are sized to them.
const RADII = { JET: 9, HELI: 10, CARRIER: 14, TANK: 11, TURRET: 10 };
const FALLBACK_RADIUS = 10;

// Module-level scratch objects: update() runs every frame and must not allocate.
const matrix = new THREE.Matrix4();
const position = new THREE.Vector3();
const quaternion = new THREE.Quaternion();
const scale = new THREE.Vector3(1, 1, 1);
const color = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

// The simple shape of each kind, pointing +Z (the direction an angle of 0 heads). Plans 02-07 and
// 02-09 pass the smooth code-built models through the same `geometryFor` seam.
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

// One InstancedMesh per enemy kind (one draw call each). `data` is the Float32Array Python assigns
// into (stride 8); `kinds` is the manifest's name -> kind value map. Each instance is routed to its
// kind's mesh, placed at (x - W/2, 0, y - H/2) and turned about Y by its heading angle.
export function createEnemyInstances({
  data,
  capacity,
  kinds,
  playfieldW,
  playfieldH,
  geometryFor = basicEnemyGeometry,
}) {
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.2 });
  const entries = []; // indexed by the kind value in the channel
  const meshes = [];
  for (const [name, value] of Object.entries(kinds)) {
    const baseColor = BASE_COLORS[name] ?? FALLBACK_COLOR;
    const mesh = new THREE.InstancedMesh(geometryFor(name), material, capacity);
    mesh.name = `enemy-${name.toLowerCase()}`;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Allocate instanceColor up front so the first update never reshapes the buffers.
    mesh.setColorAt(0, color.setRGB(baseColor[0], baseColor[1], baseColor[2]));
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    entries[value] = { mesh, baseColor, index: meshes.length };
    meshes.push(mesh);
  }
  const counts = new Int32Array(meshes.length);

  const halfW = playfieldW / 2;
  const halfH = playfieldH / 2;

  function update(n) {
    const live = Math.min(n, capacity);
    counts.fill(0);
    for (let i = 0; i < live; i++) {
      const base = i * STRIDE;
      const entry = entries[data[base + KIND]];
      if (entry === undefined) continue;
      position.set(data[base] - halfW, 0, data[base + 1] - halfH);
      quaternion.setFromAxisAngle(UP, data[base + ANGLE]);
      matrix.compose(position, quaternion, scale);
      const slot = counts[entry.index]++;
      entry.mesh.setMatrixAt(slot, matrix);
      const rgb = entry.baseColor;
      entry.mesh.setColorAt(slot, color.setRGB(rgb[0], rgb[1], rgb[2]));
    }
    for (let k = 0; k < meshes.length; k++) {
      const mesh = meshes[k];
      mesh.count = counts[k];
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
    }
  }

  return { meshes, update };
}
