import * as THREE from 'three';
import { mulberry32 } from './explosion_fx.js';

// Scorch marks on the terrain (STGE-04, RESEARCH Pattern 14). A fixed ring of decals: the oldest
// mark is overwritten when it is full, one InstancedMesh is allocated once, and update() allocates
// nothing (T-02-18). A mark has no Python state. It remembers where and when it was made, and is
// placed in plane coordinates inside the ground layer at the kill position plus the ground scroll
// since the kill, the same rate the living unit moved at, so it stays locked to the road it
// scorched until it leaves the bottom of the screen.

// Diameter in plane units of the mark for each blast class that comes from a ground kill.
const MARK_SIZE = Object.freeze({ MEDIUM: 16, LARGE: 24 });
// Lift above the terrain plane, in layer units. Together with the polygon offset it keeps the mark
// from z-fighting the ground.
const LIFT = 0.1;

const VERTEX = `
attribute vec4 aMark;
uniform float halfW;
uniform float halfH;
varying vec2 vUv;
varying float vSeed;
void main() {
  vUv = uv;
  vSeed = aMark.w;
  vec3 p = position * aMark.z;
  p.x += aMark.x - halfW;
  p.y += ${LIFT.toFixed(2)};
  p.z += aMark.y - halfH;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

// A soft disc whose edge wobbles with the angle: two sine harmonics phased by the per-mark seed.
const FRAGMENT = `
uniform vec3 uColor;
uniform float uAlpha;
varying vec2 vUv;
varying float vSeed;
void main() {
  vec2 v = vUv - 0.5;
  float d = length(v) * 2.0;
  float a = atan(v.y, v.x);
  float edge = 0.78 + 0.12 * sin(a * 3.0 + vSeed * 6.2831) + 0.07 * sin(a * 5.0 + vSeed * 17.0);
  float alpha = smoothstep(edge, edge * 0.25, d) * uAlpha;
  gl_FragColor = vec4(uColor, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// `events` and `blast` are the manifest tables. `getScroll()` is the terrain scroll at the moment
// an event is handled, and `ratio` is the ground scroll ratio of the living units.
export function createDecalRing({
  capacity = 48,
  events,
  blast,
  ratio,
  getScroll,
  playfieldW,
  playfieldH,
  rng = mulberry32(0x5c02c4),
}) {
  const halfW = playfieldW / 2;
  const quad = new THREE.PlaneGeometry(1, 1);
  quad.rotateX(-Math.PI / 2);

  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = quad.index;
  geometry.setAttribute('position', quad.attributes.position);
  geometry.setAttribute('uv', quad.attributes.uv);
  const marks = new Float32Array(capacity * 4); // x, y now, size, seed
  const attribute = new THREE.InstancedBufferAttribute(marks, 4);
  attribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aMark', attribute);
  geometry.instanceCount = 0;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      halfW: { value: halfW },
      halfH: { value: playfieldH / 2 },
      uColor: { value: new THREE.Vector3(0.04, 0.035, 0.03) },
      uAlpha: { value: 0.85 },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'scorch-decals';
  mesh.frustumCulled = false;
  mesh.renderOrder = 2; // below the air shadows and the dim mask (5)

  // Ring storage, one slot per mark: where and when it was made, its size and its seed.
  const markX = new Float32Array(capacity);
  const markY = new Float32Array(capacity);
  const markScroll = new Float32Array(capacity);
  const markSize = new Float32Array(capacity);
  const markSeed = new Float32Array(capacity);
  let next = 0;
  let stored = 0;
  let limit = capacity;
  let live = 0;

  function add(x, y, size) {
    markX[next] = x;
    markY[next] = y;
    markScroll[next] = getScroll();
    markSize[next] = size;
    markSeed[next] = rng();
    next = (next + 1) % capacity;
    if (stored < capacity) stored += 1;
  }

  // A stage start restarts the scroll at 0, so every stored mark would jump to a wrong place:
  // forget them all (RESEARCH Pattern 1).
  function clear() {
    stored = 0;
    next = 0;
    live = 0;
  }

  // Only a ground-anchored kill (EXPLOSION with b == 1) scorches the terrain; air kills do not. A
  // STAGE_START event clears the ring (an events table without it keeps the old behaviour).
  function handle(type, x, y, a, b) {
    if (events.STAGE_START !== undefined && type === events.STAGE_START) {
      clear();
      return;
    }
    if (type !== events.EXPLOSION || b !== 1) return;
    if (a === blast.LARGE) add(x, y, MARK_SIZE.LARGE);
    else if (a === blast.MEDIUM) add(x, y, MARK_SIZE.MEDIUM);
  }

  // Draws the `limit` newest marks, newest first, skipping any that scrolled past the bottom.
  function update(scrollNow) {
    const visible = Math.min(stored, limit);
    live = 0;
    for (let i = 0; i < visible; i++) {
      const slot = (next - 1 - i + capacity) % capacity;
      const y = markY[slot] + ratio * (scrollNow - markScroll[slot]);
      if (y > playfieldH + markSize[slot] / 2) continue;
      const base = live * 4;
      marks[base] = markX[slot];
      marks[base + 1] = y;
      marks[base + 2] = markSize[slot];
      marks[base + 3] = markSeed[slot];
      live += 1;
    }
    geometry.instanceCount = live;
    if (live === 0) return;
    attribute.clearUpdateRanges();
    attribute.addUpdateRange(0, live * 4);
    attribute.needsUpdate = true;
  }

  // The tier's cap on drawn marks. Stored marks are never deleted, so raising it shows them again.
  function setLimit(n) {
    limit = Math.max(0, Math.min(n, capacity));
  }

  return {
    mesh,
    handle,
    add,
    update,
    setLimit,
    get live() {
      return live;
    },
  };
}
