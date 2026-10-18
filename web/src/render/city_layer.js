import * as THREE from 'three';
import {
  CAMERA_FOV_DEG,
  altitudeScale,
  applyCameraFit,
  fitCamera,
} from './camera_fit.js';
import { TERRAIN_DEPTH } from './ground_layer.js';
import { normalizeDetail, tint } from './models/model_kit.js';

// The city layer (D-34, RESEARCH Pattern 5). Python authors the city as a flat list of records
// (kind, x, distance, width, height, variant) shipped once in the manifest; this module only draws
// it. Everything is placed in plane coordinates inside the ground layer, in the same frame as the
// ground units, wrecks and scorch marks: a placement at stage distance d sits at logical
// y = y0 + ratio * (scroll - d), the mapping Python uses for ground rows, so tanks line up with
// the blocks at every screen shape.

const KIND = 0;
const X = 1;
const DISTANCE = 2;
const WIDTH = 3;
const HEIGHT = 4;
const VARIANT = 5;

// Viewport shapes the draw window must cover: tall phones to wide desktop windows. The window is
// fixed at construction, so a resize or a rotation never rebuilds anything.
const WINDOW_ASPECTS = Object.freeze([9 / 21, 9 / 19.5, 0.6, 3 / 4, 1, 4 / 3, 16 / 9, 21 / 9]);
// Slack in logical units around the visible terrain: half a building footprint plus the lean of a
// tall building toward the camera.
const WINDOW_PAD = 24;
const CORNERS = Object.freeze([
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
]);
// How many records the cursor walks before it gives up and searches (a jump in the scroll).
const WALK_LIMIT = 64;
const MAX_SLOTS = 4;

// The logical y of a placement at stage distance `d` when the scroll is `scroll`.
export function cityY(scroll, d, y0, ratio) {
  return y0 + ratio * (scroll - d);
}

const windows = new Map();
const cornerRay = new THREE.Vector3();

// The terrain area visible through the fitted camera at every aspect in `aspects`, as the bounding
// box { xMin, xMax, yMin, yMax } in logical playfield coordinates, padded. Each frustum corner is
// cast onto the terrain plane and mapped back through the ground layer's inverse transform.
export function terrainWindow({
  playfieldW,
  playfieldH,
  terrainDepth = TERRAIN_DEPTH,
  aspects = WINDOW_ASPECTS,
  pad = WINDOW_PAD,
}) {
  const key = `${playfieldW}x${playfieldH}@${terrainDepth}+${pad}:${aspects.join(',')}`;
  const cached = windows.get(key);
  if (cached !== undefined) return cached;
  const halfW = playfieldW / 2;
  const halfH = playfieldH / 2;
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const aspect of aspects) {
    const camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEG, aspect, 10, 4000);
    applyCameraFit(camera, fitCamera({ aspect, halfW, halfH }));
    camera.updateMatrixWorld(true);
    const eye = camera.position;
    const k = altitudeScale(eye.y, terrainDepth, 0);
    for (const [nx, ny] of CORNERS) {
      cornerRay.set(nx, ny, 0.5).unproject(camera).sub(eye);
      const t = (terrainDepth - eye.y) / cornerRay.y;
      const x = (eye.x + cornerRay.x * t - eye.x * (1 - k)) / k + halfW;
      const y = (eye.z + cornerRay.z * t - eye.z * (1 - k)) / k + halfH;
      xMin = Math.min(xMin, x);
      xMax = Math.max(xMax, x);
      yMin = Math.min(yMin, y);
      yMax = Math.max(yMax, y);
    }
  }
  const result = Object.freeze({
    xMin: xMin - pad,
    xMax: xMax + pad,
    yMin: yMin - pad,
    yMax: yMax + pad,
  });
  windows.set(key, result);
  return result;
}

// The most distances (ascending) inside any closed span of length `span`. With `loop` the list
// repeats every `length`, so a span that crosses the seam counts both sides.
export function windowCapacity(distances, span, loop, length) {
  const n = distances.length;
  if (n === 0) return 0;
  const at = (i) => (loop ? distances[i % n] + Math.floor(i / n) * length : distances[i]);
  let most = 0;
  let hi = 0;
  for (let lo = 0; lo < n; lo++) {
    if (hi < lo) hi = lo;
    const limit = at(lo) + span;
    while ((loop || hi + 1 < n) && at(hi + 1) <= limit) hi++;
    most = Math.max(most, hi - lo + 1);
  }
  return most;
}

const BOX_COLOUR = [0.18, 0.17, 0.22];
const boxModels = new Map();

// The stand-in geometry seam: a dark unit box standing on y = 0 for any kind, no glow. Scenery
// models (scenery_models.js) replace it through the same `geometryFor(kindName, detail)` call.
export function unitBoxModel(kindName) {
  let model = boxModels.get(kindName);
  if (model === undefined) {
    const body = tint(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), BOX_COLOUR);
    model = { body, glow: null };
    boxModels.set(kindName, model);
  }
  return model;
}

// Module-level scratch objects: update() runs every frame and must not allocate.
const matrix = new THREE.Matrix4();
const position = new THREE.Vector3();
const scale = new THREE.Vector3();
const NO_TURN = new THREE.Quaternion();

// `layout` is the manifest's flat record list (stride `stride`, sorted by distance), `kinds` the
// manifest's scenery name -> value map. The returned group holds at most two InstancedMeshes per
// kind that has a placement (body and glow) and is added by the caller to the ground layer's
// group. `update(scroll)` writes only the placements inside the visible window.
export function createCityLayer({
  layout,
  stride = 6,
  kinds,
  ratio,
  y0,
  playfieldW,
  playfieldH,
  loop = false,
  length = 0,
  detail = 'high',
  geometryFor = unitBoxModel,
}) {
  if (loop && !(length > 0)) throw new Error('a looping city needs a positive stage length');
  const data = Float32Array.from(layout);
  const count = Math.floor(data.length / stride);
  for (let i = 1; i < count; i++) {
    if (data[i * stride + DISTANCE] < data[(i - 1) * stride + DISTANCE]) {
      throw new Error('the city layout must be sorted by distance');
    }
  }
  const halfW = playfieldW / 2;
  const halfH = playfieldH / 2;
  const area = terrainWindow({ playfieldW, playfieldH });
  const span = (area.yMax - area.yMin) / ratio;
  const names = new Map(Object.entries(kinds).map(([name, value]) => [value, name]));

  const distances = new Map();
  for (let i = 0; i < count; i++) {
    const value = data[i * stride + KIND];
    if (!names.has(value)) continue;
    if (!distances.has(value)) distances.set(value, []);
    distances.get(value).push(data[i * stride + DISTANCE]);
  }

  const group = new THREE.Group();
  group.name = 'city-layer';
  const bodyMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.6,
    metalness: 0.1,
  });
  const glowMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
  let currentDetail = normalizeDetail(detail);

  function instanced(geometry, material, name, capacity) {
    const mesh = new THREE.InstancedMesh(geometry, material, capacity);
    mesh.name = name;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    group.add(mesh);
    return mesh;
  }

  const byValue = [];
  const entries = [];
  const capacities = {};
  for (const [value, list] of distances) {
    const name = names.get(value);
    const capacity = windowCapacity(list, span, loop, length);
    const model = geometryFor(name, currentDetail);
    const lower = name.toLowerCase().replaceAll('_', '-');
    const entry = {
      name,
      capacity,
      written: 0,
      body: instanced(model.body, bodyMaterial, `city-${lower}`, capacity),
      glow:
        model.glow === null ? null : instanced(model.glow, glowMaterial, `city-${lower}-glow`, capacity),
    };
    byValue[value] = entry;
    entries.push(entry);
    capacities[name] = capacity;
  }

  // First record whose distance is at least `target`. The hint is where the last frame ended: a
  // scroll moves a record or two per frame, so the cursor walks; a jump (restart, ?at=) falls back
  // to a binary search.
  function seek(target, hint) {
    let i = Math.min(hint, count);
    let steps = 0;
    while (i < count && data[i * stride + DISTANCE] < target) {
      i += 1;
      steps += 1;
      if (steps > WALK_LIMIT) return search(target);
    }
    while (i > 0 && data[(i - 1) * stride + DISTANCE] >= target) {
      i -= 1;
      steps += 1;
      if (steps > WALK_LIMIT) return search(target);
    }
    return i;
  }

  function search(target) {
    let lo = 0;
    let hi = count;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (data[mid * stride + DISTANCE] < target) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  const hints = new Array(MAX_SLOTS).fill(0);

  // Writes every placement with a distance in [from, to] (layout distances; `offset` is the
  // distance of the cycle the span belongs to).
  function sweep(from, to, offset, slot, scroll) {
    let i = seek(from, hints[slot]);
    hints[slot] = i;
    for (; i < count; i++) {
      const base = i * stride;
      const d = data[base + DISTANCE];
      if (d > to) break;
      const entry = byValue[data[base + KIND]];
      if (entry === undefined || entry.written >= entry.capacity) continue;
      const y = cityY(scroll, d + offset, y0, ratio);
      const width = data[base + WIDTH];
      position.set(data[base + X] - halfW, 0, y - halfH);
      scale.set(width, data[base + HEIGHT], width);
      matrix.compose(position, NO_TURN, scale);
      entry.body.setMatrixAt(entry.written, matrix);
      if (entry.glow !== null) entry.glow.setMatrixAt(entry.written, matrix);
      entry.written += 1;
    }
  }

  let drawn = 0;

  function update(scroll) {
    for (const entry of entries) entry.written = 0;
    // A placement is in the window when its y is; y falls as the distance grows.
    const low = scroll - (area.yMax - y0) / ratio;
    const high = scroll - (area.yMin - y0) / ratio;
    if (loop) {
      const last = Math.floor(high / length);
      for (let cycle = Math.floor(low / length), slot = 0; cycle <= last; cycle++, slot++) {
        sweep(low - cycle * length, high - cycle * length, cycle * length, Math.min(slot, MAX_SLOTS - 1), scroll);
      }
    } else {
      sweep(low, high, 0, 0, scroll);
    }
    drawn = 0;
    for (const entry of entries) {
      const written = entry.written;
      drawn += written;
      entry.body.count = written;
      if (entry.glow !== null) entry.glow.count = written;
      if (written === 0) continue; // nothing was written, so nothing to upload
      entry.body.instanceMatrix.needsUpdate = true;
      if (entry.glow !== null) entry.glow.instanceMatrix.needsUpdate = true;
    }
  }

  // Swaps the cached geometry of the existing meshes; builds and generates nothing.
  function setDetail(next) {
    currentDetail = normalizeDetail(next);
    for (const entry of entries) {
      const model = geometryFor(entry.name, currentDetail);
      entry.body.geometry = model.body;
      if (entry.glow !== null) entry.glow.geometry = model.glow;
    }
  }

  update(0);
  return {
    group,
    update,
    setDetail,
    window: area,
    capacities,
    get drawn() {
      return drawn;
    },
  };
}
