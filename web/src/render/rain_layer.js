import * as THREE from 'three';
import { mulberry32 } from '../fx/explosion_fx.js';

// The rain over the neon city (D-32, D-36): one instanced draw of streaks. JS writes a seed per
// streak once, at construction; where a streak is at any moment is evaluated in the vertex shader
// from `uTime` and its seed with a fract() wrap, so rain costs no per-frame JS or Python work
// beyond one uniform. The streak is a quad built in view space between its head and tail, so it
// keeps its length whatever the camera foreshortening. `setCount` is the quality tier: it only
// changes how many instances are drawn (and hides the mesh at zero), it never rebuilds anything,
// so no shader compiles after load.

// Pale cool blue-white. Every channel is below the bloom threshold (1.0) so rain never blooms, and
// the hue is far from the orange-yellow reserved for enemy bullets.
export const RAIN_COLOR = Object.freeze([0.5, 0.64, 0.84]);

// The volume the rain falls through, in world units around the playfield: wider than the playfield
// so the streaks reach the edges of the terrain the camera shows, from above the gameplay plane
// down to the terrain.
const SPREAD = 1.7;
const TOP = 90;
const BOTTOM = -40;
// Streak length along its fall direction, width, and falls per second.
const LENGTH = 14;
const WIDTH = 1.1;
const RATE = 1.6;
// Fall direction: slanted so a streak is not foreshortened to a dot by the top-down camera.
const SLANT = Object.freeze([0.2, -1, 0.35]);
// How bright the head of a streak is; the fragment fades it toward the tail and the edges.
const GAIN = 0.7;

const SEED = 0x7a1b5;

const VERTEX = `
attribute vec4 aSeed;
uniform float uTime;
uniform vec2 uBox;
uniform vec3 uDir;
uniform vec2 uSpan;
uniform float uLength;
uniform float uWidth;
uniform float uRate;
varying vec2 vUv;
void main() {
  vUv = uv;
  // aSeed: x and y place the streak across the box, z is its phase, w varies its speed.
  float t = fract(uTime * uRate * (0.8 + 0.4 * aSeed.w) + aSeed.z);
  vec3 head = vec3(
    (aSeed.x - 0.5) * uBox.x,
    mix(uSpan.x, uSpan.y, t),
    (aSeed.y - 0.5) * uBox.y
  );
  // The slant carries the streak sideways as it falls, so it moves along a straight line.
  head.xz += uDir.xz * (uSpan.x - head.y);
  vec4 h = modelViewMatrix * vec4(head, 1.0);
  vec4 tail = modelViewMatrix * vec4(head - uDir * uLength, 1.0);
  vec2 along = tail.xy - h.xy;
  float len = length(along);
  vec2 side = len > 0.0001 ? vec2(-along.y, along.x) / len : vec2(1.0, 0.0);
  vec4 view = h + (tail - h) * (position.y + 0.5);
  view.xy += side * position.x * uWidth;
  gl_Position = projectionMatrix * view;
}`;

const FRAGMENT = `
uniform vec3 uColor;
uniform float uGain;
varying vec2 vUv;
void main() {
  float edge = 1.0 - abs(vUv.x - 0.5) * 2.0;
  // vUv.y is 0 at the head of the streak and 1 at its tail: bright head, fading tail.
  float alpha = edge * mix(1.0, 0.1, vUv.y) * uGain;
  gl_FragColor = vec4(uColor, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createRainLayer({ capacity, playfieldW, playfieldH }) {
  const quad = new THREE.PlaneGeometry(1, 1);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = quad.index;
  geometry.setAttribute('position', quad.attributes.position);
  geometry.setAttribute('uv', quad.attributes.uv);
  geometry.instanceCount = capacity;

  const rng = mulberry32(SEED);
  const seedArray = new Float32Array(capacity * 4);
  for (let i = 0; i < seedArray.length; i += 1) seedArray[i] = rng();
  geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seedArray, 4));

  // Per unit of fall: the sideways drift of the slant, with y fixed at -1.
  const dir = new THREE.Vector3(...SLANT);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBox: { value: new THREE.Vector2(playfieldW * SPREAD, playfieldH * SPREAD) },
      uDir: { value: dir },
      uSpan: { value: new THREE.Vector2(TOP, BOTTOM) },
      uLength: { value: LENGTH },
      uWidth: { value: WIDTH },
      uRate: { value: RATE },
      uColor: { value: new THREE.Vector3(...RAIN_COLOR) },
      uGain: { value: GAIN },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    // The quad is built in view space, so its winding follows the streak's direction on screen: draw
    // both faces rather than depend on which way the sideways axis happens to turn.
    side: THREE.DoubleSide,
    fog: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'rain';
  mesh.frustumCulled = false;
  mesh.renderOrder = 3.5; // above the shadows (3), below the particle layers (4) and the mask (5)

  // The quality tier: how many streaks are drawn. Zero hides the mesh, which also skips the draw.
  function setCount(n) {
    const count = Number.isFinite(n) ? Math.max(0, Math.min(capacity, Math.floor(n))) : 0;
    geometry.instanceCount = count;
    mesh.visible = count > 0;
  }

  // The effect clock: held during hitstop and pause, so the rain holds still with every other effect.
  function update(timeS) {
    material.uniforms.uTime.value = timeS;
  }

  return {
    mesh,
    setCount,
    update,
    capacity,
    get count() {
      return mesh.visible ? geometry.instanceCount : 0;
    },
  };
}
