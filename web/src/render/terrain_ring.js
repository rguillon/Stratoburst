import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { normalizeDetail } from './models/model_kit.js';

// Terrain as a ring of recycled chunks (RESEARCH Pattern 6, D-13). Chunk `i` covers terrain
// distance [i * CHUNK_LEN, (i + 1) * CHUNK_LEN); scrolling by `s` puts it at world Z
// `s - (i + 0.5) * CHUNK_LEN`, so the world moves toward +Z (the ship flies screen-up). One ring
// slot per `chunkIndex mod CHUNK_COUNT`: when a chunk scrolls past the camera its slot is
// regenerated for the chunk entering at the far end, from a seeded PRNG, with no assets.
export const CHUNK_LEN = 400;
export const TERRAIN_WIDTH = 1200;
export const CHUNK_COUNT = 4;
export const BUILDINGS_PER_CHUNK = 40;
// Y of the ground layer; the buildings stand on it and the ground-unit shadows share it.
export const TERRAIN_DEPTH = -40;

const TILE_UNITS = 100; // one texture tile covers 100 x 100 terrain units
const LANES = [-80, 0, 80]; // open lanes kept free for later ground units
const LANE_HALF_WIDTH = 14;
const MAX_BUILDING_HEIGHT = 30; // terrain sits at -40, so tops stay below the gameplay plane

// mulberry32: tiny seeded PRNG returning floats in [0, 1).
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The chunks to draw for a scroll distance, as [{ chunkIndex, z }] from nearest to farthest.
// Positions are computed relative to the base chunk so the values stay small however long the
// session runs (Pitfall 10).
export function chunkLayout(scroll, chunkLen, chunks) {
  const base = Math.floor(scroll / chunkLen);
  const offset = scroll - base * chunkLen;
  const layout = [];
  for (let k = 0; k < chunks; k++) {
    const rel = k - 1; // slots base - 1 .. base + chunks - 2
    layout.push({ chunkIndex: base + rel, z: offset - (rel + 0.5) * chunkLen });
  }
  return layout;
}

// Deterministic block buildings for one chunk, in chunk-local coordinates (x across, z along).
export function generateChunkBuildings(
  seed,
  chunkIndex,
  { width = TERRAIN_WIDTH, chunkLen = CHUNK_LEN } = {},
) {
  const rand = mulberry32((seed ^ Math.imul(chunkIndex, 0x9e3779b1)) >>> 0);
  const buildings = [];
  for (let i = 0; i < BUILDINGS_PER_CHUNK; i++) {
    const w = 8 + rand() * 20;
    const d = 8 + rand() * 20;
    const h = 5 + rand() * (MAX_BUILDING_HEIGHT - 5);
    // Two uniforms summed: denser near the middle, where the playfield is.
    let x = (rand() + rand() - 1) * (width / 2);
    // A building that overlaps a lane is pushed to the lane's edge, which lines the lanes
    // like streets.
    for (const lane of LANES) {
      const gap = LANE_HALF_WIDTH + w / 2;
      if (Math.abs(x - lane) < gap) x = lane + (x >= lane ? gap : -gap);
    }
    const z = (rand() - 0.5) * (chunkLen - d);
    buildings.push({ x, z, w, h, d, shade: rand() });
  }
  return buildings;
}

// One procedurally drawn 256 x 256 tile: sand blocks, dark asphalt roads with a dashed line.
// Everything stays dark so that only HDR emitters (bullets) cross the bloom threshold.
function createGroundTexture(createCanvas, seed) {
  const canvas = createCanvas();
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const rand = mulberry32(seed ^ 0x51ed);
  const sands = ['#5a5040', '#53493a', '#615643', '#4d4436'];
  ctx.fillStyle = sands[0];
  ctx.fillRect(0, 0, 256, 256);
  for (let by = 0; by < 2; by++) {
    for (let bx = 0; bx < 2; bx++) {
      ctx.fillStyle = sands[Math.floor(rand() * sands.length)];
      ctx.fillRect(bx * 128 + 18, by * 128 + 18, 110 - 18, 110 - 18);
    }
  }
  ctx.fillStyle = '#2b2b2d';
  ctx.fillRect(0, 0, 256, 18); // road along the tile's top edge
  ctx.fillRect(0, 0, 18, 256); // road along the tile's left edge
  ctx.fillRect(0, 118, 256, 10);
  ctx.fillRect(118, 0, 10, 256);
  ctx.fillStyle = '#6a6552';
  for (let p = 8; p < 256; p += 32) {
    ctx.fillRect(p, 8, 14, 2); // dashes on the top road
    ctx.fillRect(8, p, 2, 14); // dashes on the left road
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(TERRAIN_WIDTH / TILE_UNITS, CHUNK_LEN / TILE_UNITS);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// Building corner softening per detail (D-24, D-25): segments across each rounded edge, and a
// plain hard-edged box at 'low'.
const BUILDING_SEGMENTS = Object.freeze({ high: 3, mid: 2 });
const BUILDING_RADIUS = 0.08;

const LOW = new THREE.Color(0x3b3833);
const HIGH = new THREE.Color(0x77705f);

export function createTerrainRing({
  seed = 1,
  chunkLen = CHUNK_LEN,
  chunks = CHUNK_COUNT,
  width = TERRAIN_WIDTH,
  depthY = TERRAIN_DEPTH,
  detail = 'high',
  createCanvas = () => document.createElement('canvas'),
} = {}) {
  const group = new THREE.Group();
  group.name = 'terrain-ring';
  group.position.y = depthY;

  const groundMaterial = new THREE.MeshLambertMaterial({
    map: createGroundTexture(createCanvas, seed),
    flatShading: true,
  });
  const groundGeometry = new THREE.PlaneGeometry(width, chunkLen);
  groundGeometry.rotateX(-Math.PI / 2);
  // Every detail's building geometry and material is built once, here. A tier change swaps
  // these cached objects and never builds, compiles or disposes anything mid-game (Pitfall 8).
  const buildingGeometries = {
    high: new RoundedBoxGeometry(1, 1, 1, BUILDING_SEGMENTS.high, BUILDING_RADIUS),
    mid: new RoundedBoxGeometry(1, 1, 1, BUILDING_SEGMENTS.mid, BUILDING_RADIUS),
    low: new THREE.BoxGeometry(1, 1, 1),
  };
  const smoothMaterial = new THREE.MeshLambertMaterial({ flatShading: false });
  const buildingMaterials = {
    high: smoothMaterial,
    mid: smoothMaterial,
    low: new THREE.MeshLambertMaterial({ flatShading: true }),
  };
  let currentDetail = normalizeDetail(detail);

  const slots = [];
  for (let s = 0; s < chunks; s++) {
    const chunk = new THREE.Group();
    chunk.name = `terrain-chunk-${s}`;
    chunk.add(new THREE.Mesh(groundGeometry, groundMaterial));
    const buildings = new THREE.InstancedMesh(
      buildingGeometries[currentDetail],
      buildingMaterials[currentDetail],
      BUILDINGS_PER_CHUNK,
    );
    // Instances are rewritten on recycle, so the bounding sphere cached at first render would
    // go stale; the chunk is always near the camera, so culling buys nothing.
    buildings.frustumCulled = false;
    chunk.add(buildings);
    group.add(chunk);
    slots.push({ chunk, buildings, chunkIndex: null });
  }

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const color = new THREE.Color();

  function fillSlot(slot, chunkIndex) {
    const list = generateChunkBuildings(seed, chunkIndex, { width, chunkLen });
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      position.set(b.x, b.h / 2, b.z);
      scale.set(b.w, b.h, b.d);
      matrix.compose(position, rotation, scale);
      slot.buildings.setMatrixAt(i, matrix);
      slot.buildings.setColorAt(i, color.copy(LOW).lerp(HIGH, b.shade));
    }
    slot.buildings.instanceMatrix.needsUpdate = true;
    slot.buildings.instanceColor.needsUpdate = true;
    slot.chunkIndex = chunkIndex;
  }

  function update(scroll) {
    for (const { chunkIndex, z } of chunkLayout(scroll, chunkLen, chunks)) {
      const slot = slots[((chunkIndex % chunks) + chunks) % chunks];
      if (slot.chunkIndex !== chunkIndex) fillSlot(slot, chunkIndex);
      slot.chunk.position.z = z;
    }
  }

  // Swaps the cached geometry and material on every chunk; building placement (the instance
  // matrices) is untouched.
  function setDetail(next) {
    currentDetail = normalizeDetail(next);
    for (const slot of slots) {
      slot.buildings.geometry = buildingGeometries[currentDetail];
      slot.buildings.material = buildingMaterials[currentDetail];
    }
  }

  update(0);
  return { group, update, setDetail };
}
