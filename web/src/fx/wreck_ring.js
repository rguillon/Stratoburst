import * as THREE from 'three';
import { mulberry32 } from './explosion_fx.js';

// Charred wrecks of ground units (STGE-04, ENMY-08). A fixed ring: the oldest wreck is overwritten
// when it is full, one InstancedMesh per ground kind is allocated once, and update() allocates
// nothing (T-02-16). A wreck has no Python state. It is placed in plane coordinates inside the
// ground layer, at the unit's kill position plus the ground scroll since the kill, which is the
// same rate the living unit moved at, so nothing slides against the terrain it died on.

// Instance colour that scales the model's vertex colours down to burnt metal.
const CHAR = [0.12, 0.11, 0.1];
// How far past the bottom edge of the playfield a wreck is still drawn before it is retired.
const EXIT_MARGIN = 40;

const TWO_PI = Math.PI * 2;

// Module-level scratch objects: update() runs every frame and must not allocate.
const matrix = new THREE.Matrix4();
const position = new THREE.Vector3();
const quaternion = new THREE.Quaternion();
const scale = new THREE.Vector3(1, 1, 1);
const color = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

// `kinds` maps the ground kind names to their channel values; `geometryFor(kindName, detail)`
// returns the model whose `body` is the wreck's shape. `getScroll()` is the terrain scroll at the
// moment an event is handled, and `ratio` is the ground scroll ratio of the living units.
export function createWreckRing({
  capacity = 12,
  kinds,
  events,
  geometryFor,
  ratio,
  getScroll,
  playfieldW,
  playfieldH,
  rng = mulberry32(0x77ec4),
}) {
  const group = new THREE.Group();
  group.name = 'wreck-ring';
  const halfW = playfieldW / 2;
  const halfH = playfieldH / 2;
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.1 });

  // Indexed by the kind value carried in the EXPLOSION event.
  const meshByKind = [];
  const meshes = [];
  for (const [name, value] of Object.entries(kinds)) {
    const mesh = new THREE.InstancedMesh(geometryFor(name, 'low').body, material, capacity);
    mesh.name = `wreck-${name.toLowerCase()}`;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.setColorAt(0, color.setRGB(CHAR[0], CHAR[1], CHAR[2]));
    mesh.count = 0;
    group.add(mesh);
    meshByKind[value] = mesh;
    meshes.push(mesh);
  }

  // Ring storage, one slot per wreck: where and when it died, and its kind and yaw.
  const wreckX = new Float32Array(capacity);
  const wreckY = new Float32Array(capacity);
  const wreckScroll = new Float32Array(capacity);
  const wreckKind = new Int32Array(capacity).fill(-1);
  const wreckYaw = new Float32Array(capacity);
  const written = new Int32Array(meshByKind.length);
  let next = 0;
  let spawned = 0;
  let live = 0;

  // Only a ground-anchored kill (EXPLOSION with b == 1) leaves a wreck; air kills add nothing.
  function handle(type, x, y, a, b, c) {
    if (type !== events.EXPLOSION || b !== 1 || meshByKind[c] === undefined) return;
    wreckX[next] = x;
    wreckY[next] = y;
    wreckScroll[next] = getScroll();
    wreckKind[next] = c;
    wreckYaw[next] = rng() * TWO_PI;
    next = (next + 1) % capacity;
    spawned += 1;
  }

  // `scrollNow` is the terrain scroll this frame. A wreck past the bottom edge is not drawn again.
  // `timeS` (the effect clock) is reserved for the smouldering trickle that plan 02-14 adds.
  function update(scrollNow, timeS = 0) {
    written.fill(0);
    live = 0;
    for (let i = 0; i < capacity; i++) {
      const kind = wreckKind[i];
      if (kind < 0) continue;
      const y = wreckY[i] + ratio * (scrollNow - wreckScroll[i]);
      if (y > playfieldH + EXIT_MARGIN) continue;
      position.set(wreckX[i] - halfW, 0, y - halfH);
      quaternion.setFromAxisAngle(UP, wreckYaw[i]);
      matrix.compose(position, quaternion, scale);
      const mesh = meshByKind[kind];
      const slot = written[kind]++;
      mesh.setMatrixAt(slot, matrix);
      mesh.setColorAt(slot, color.setRGB(CHAR[0], CHAR[1], CHAR[2]));
      live += 1;
    }
    for (let kind = 0; kind < meshByKind.length; kind++) {
      const mesh = meshByKind[kind];
      if (mesh === undefined) continue;
      mesh.count = written[kind];
      if (written[kind] === 0) continue;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
    }
  }

  return {
    group,
    meshes,
    handle,
    update,
    get spawned() {
      return spawned;
    },
    get live() {
      return live;
    },
  };
}
