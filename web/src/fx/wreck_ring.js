import * as THREE from 'three';
import { mulberry32 } from './explosion_fx.js';
import { PALETTE } from './palette.js';

// Charred wrecks of ground units (STGE-04, ENMY-08). A fixed ring: the oldest wreck is overwritten
// when it is full, one InstancedMesh per ground kind is allocated once, and update() allocates
// nothing (T-02-16). A wreck has no Python state. It is placed in plane coordinates inside the
// ground layer, at the unit's kill position plus the ground scroll since the kill, which is the
// same rate the living unit moved at, so nothing slides against the terrain it died on.
// While a wreck is on screen it smoulders: a throttled trickle of dark smoke, and for its first
// seconds small orange flames, goes through the particle layers (T-02-18), scaled by the tier.

// Instance colour that scales the model's vertex colours down to burnt metal.
const CHAR = [0.12, 0.11, 0.1];
// How far past the bottom edge of the playfield a wreck is still drawn before it is retired.
const EXIT_MARGIN = 40;

const TWO_PI = Math.PI * 2;

// Smouldering, at particleScale 1: a smoke puff every SMOKE_INTERVAL s for as long as the wreck is
// on screen, a flame every FLAME_INTERVAL s during its first FLAME_WINDOW s.
const SMOKE_INTERVAL = 0.18;
const FLAME_INTERVAL = 0.3;
const FLAME_WINDOW = 6;
// A frame longer than this (a tab returning from the background) counts as this long, so a wreck
// never bursts out a backlog of puffs.
const MAX_DT = 0.25;
// Emitter looks, as in the explosion recipes: HDR flame, dark smoke that rises (negative gravity).
const SMOKE_COLOR = [0.14, 0.13, 0.12];
const FLAME_COLOR = PALETTE.FIRE.rgb;
const SMOKE_GRAVITY = -0.15;

// Module-level scratch objects: update() runs every frame and must not allocate.
const matrix = new THREE.Matrix4();
const position = new THREE.Vector3();
const quaternion = new THREE.Quaternion();
const scale = new THREE.Vector3(1, 1, 1);
const color = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);
const spot = new THREE.Vector3();

// `kinds` maps the ground kind names to their channel values; `geometryFor(kindName, detail)`
// returns the model whose `body` is the wreck's shape. `getScroll()` is the terrain scroll at the
// moment an event is handled, and `ratio` is the ground scroll ratio of the living units.
// `layers` ({ additive, normal } particle layers), `getScale()` (the tier's particleScale) and
// `toWorld(x, y, out)` (the ground layer's) drive the smoulder; without `layers` there is none.
export function createWreckRing({
  capacity = 12,
  kinds,
  events,
  geometryFor,
  ratio,
  getScroll,
  playfieldW,
  playfieldH,
  layers = null,
  getScale = () => 1,
  toWorld = null,
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
  const wreckBorn = new Float32Array(capacity); // effect clock at the kill
  const smokeDue = new Float32Array(capacity); // scaled time accumulated toward the next puff
  const flameDue = new Float32Array(capacity);
  const written = new Int32Array(meshByKind.length);
  let next = 0;
  let spawned = 0;
  let live = 0;
  let clock = 0; // the effect clock of the latest update

  // Only a ground-anchored kill (EXPLOSION with b == 1) leaves a wreck; air kills add nothing.
  function handle(type, x, y, a, b, c) {
    if (type !== events.EXPLOSION || b !== 1 || meshByKind[c] === undefined) return;
    wreckX[next] = x;
    wreckY[next] = y;
    wreckScroll[next] = getScroll();
    wreckKind[next] = c;
    wreckYaw[next] = rng() * TWO_PI;
    wreckBorn[next] = clock;
    smokeDue[next] = 0;
    flameDue[next] = 0;
    next = (next + 1) % capacity;
    spawned += 1;
  }

  function puffSmoke(x, y, z) {
    const angle = rng() * TWO_PI;
    const drift = 2 + rng() * 4;
    layers.normal.emit(
      x,
      y,
      z,
      Math.cos(angle) * drift,
      6 + rng() * 6,
      Math.sin(angle) * drift,
      1.2 + rng() * 0.6,
      3,
      10,
      SMOKE_COLOR[0],
      SMOKE_COLOR[1],
      SMOKE_COLOR[2],
      SMOKE_GRAVITY,
    );
  }

  function flicker(x, y, z) {
    const angle = rng() * TWO_PI;
    const drift = 3 + rng() * 5;
    layers.additive.emit(
      x,
      y,
      z,
      Math.cos(angle) * drift,
      10 + rng() * 12,
      Math.sin(angle) * drift,
      0.3 + rng() * 0.2,
      3.5,
      1,
      FLAME_COLOR[0],
      FLAME_COLOR[1],
      FLAME_COLOR[2],
      0,
    );
  }

  // One wreck's share of the trickle for a frame of `dt` seconds at `quality` (the tier's scale).
  function smoulder(i, x, y, dt, quality, timeS) {
    toWorld(x, y, spot);
    smokeDue[i] += dt * quality;
    while (smokeDue[i] >= SMOKE_INTERVAL) {
      smokeDue[i] -= SMOKE_INTERVAL;
      puffSmoke(spot.x, spot.y, spot.z);
    }
    if (timeS - wreckBorn[i] >= FLAME_WINDOW) return;
    flameDue[i] += dt * quality;
    while (flameDue[i] >= FLAME_INTERVAL) {
      flameDue[i] -= FLAME_INTERVAL;
      flicker(spot.x, spot.y, spot.z);
    }
  }

  // `scrollNow` is the terrain scroll this frame and `timeS` the effect clock. A wreck past the
  // bottom edge is not drawn again, and only a wreck inside the playfield smoulders.
  function update(scrollNow, timeS = 0) {
    const dt = Math.min(Math.max(timeS - clock, 0), MAX_DT);
    clock = timeS;
    const quality = layers === null ? 0 : getScale();
    written.fill(0);
    live = 0;
    for (let i = 0; i < capacity; i++) {
      const kind = wreckKind[i];
      if (kind < 0) continue;
      const y = wreckY[i] + ratio * (scrollNow - wreckScroll[i]);
      if (y > playfieldH + EXIT_MARGIN) continue;
      if (layers !== null && y >= 0 && y <= playfieldH) smoulder(i, wreckX[i], y, dt, quality, timeS);
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
