import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { TERRAIN_DEPTH } from '../render/ground_layer.js';

// Blob shadows for everything that flies (VISL-06, RESEARCH Pattern 13): one InstancedMesh of soft
// dark quads on the terrain, one per air enemy plus one for the ship. A shadow is displaced from
// its aircraft along the sun direction by the aircraft's altitude. The displacement is
// deliberately not ray-compensated like the ground layer: seen through the tilted camera, the
// gap between an aircraft and its shadow is the altitude cue. Ground units cast none.

const STRIDE = 8; // the enemies channel: x, y, angle, flash, hp_frac, kind, aux, spare
const KIND = 5;
// A shadow is a quad this many radii across, and the ship is drawn as a radius-9 unit.
const SHADOW_SCALE = 1.5;
const SHIP_RADIUS = 9;
// Lift above the terrain, with the polygon offset it keeps the blobs from z-fighting the ground.
const LIFT = 0.3;
const MAX_ALPHA = 0.45;

const VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 p = vec4(position, 1.0);
  #ifdef USE_INSTANCING
  p = instanceMatrix * p;
  #endif
  gl_Position = projectionMatrix * modelViewMatrix * p;
}`;

// A soft disc: fully dark in the middle, fading to nothing at the quad's inscribed circle.
const FRAGMENT = `
uniform vec3 uColor;
uniform float uAlpha;
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5);
  gl_FragColor = vec4(uColor, smoothstep(0.5, 0.0, d) * uAlpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// Module-level scratch objects: update() runs every frame and must not allocate.
const matrix = new THREE.Matrix4();
const position = new THREE.Vector3();
const scale = new THREE.Vector3(1, 1, 1);
const quaternion = new THREE.Quaternion();

// `data` is the enemies channel (stride 8) Python assigns into. `kinds` is the manifest's name ->
// kind value map, `radii` the manifest's unit radius per kind value and `groundKinds` the Set of
// kind values that cast no shadow. `sunPosition` is the sun's position (only its direction
// matters). `altitude` is how high every aircraft flies above the terrain. `sizeScale` maps a kind
// value to a multiplier on its shadow, for the kinds whose airframe is far wider than their collider
// (the giant bomber, D-09): its shadow is sized to the airframe, not to the 28-unit hit circle.
export function createShadowInstances({
  data,
  capacity,
  kinds,
  groundKinds,
  radii,
  sunPosition,
  altitude = 40,
  sizeScale = {},
  terrainDepth = TERRAIN_DEPTH,
  playfieldW,
  playfieldH,
}) {
  // Shadow size per kind value; 0 for ground kinds and for values that are not a kind.
  const sizeOf = new Float32Array(Math.max(0, ...Object.values(kinds)) + 1);
  for (const value of Object.values(kinds)) {
    if (!groundKinds.has(value)) sizeOf[value] = radii[value] * SHADOW_SCALE * (sizeScale[value] ?? 1);
  }
  const shipSize = SHIP_RADIUS * SHADOW_SCALE;

  // Where the sun's ray through a point `altitude` above the terrain lands on it, relative to
  // the point's own x and z.
  const offsetX = (-sunPosition.x / sunPosition.y) * altitude;
  const offsetZ = (-sunPosition.z / sunPosition.y) * altitude;
  const halfW = playfieldW / 2;
  const halfH = playfieldH / 2;
  const y = terrainDepth + LIFT;

  const quad = new THREE.PlaneGeometry(1, 1);
  quad.rotateX(-Math.PI / 2);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Vector3(...PALETTE.SHADOW.rgb) },
      uAlpha: { value: MAX_ALPHA },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const mesh = new THREE.InstancedMesh(quad, material, capacity + 1);
  mesh.name = 'air-shadows';
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  mesh.renderOrder = 3; // above the scorch marks (2), below the dim mask (5)

  let written = 0;
  function put(x, z, size) {
    position.set(x - halfW + offsetX, y, z - halfH + offsetZ);
    scale.set(size, 1, size);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(written, matrix);
    written += 1;
  }

  // `n` is the live enemy count from the header; the ship is drawn at (shipX, shipY) unless it is
  // hidden.
  function update(n, shipX, shipY, shipVisible) {
    const count = Math.min(n, capacity);
    written = 0;
    for (let i = 0; i < count; i += 1) {
      const base = i * STRIDE;
      const size = sizeOf[data[base + KIND]];
      if (!(size > 0)) continue;
      put(data[base], data[base + 1], size);
    }
    if (shipVisible) put(shipX, shipY, shipSize);
    mesh.count = written;
    if (written > 0) mesh.instanceMatrix.needsUpdate = true;
  }

  return { mesh, update };
}
