import * as THREE from 'three';
import { PALETTE } from '../fx/palette.js';

// One draw call for every bullet. `data` is the same Float32Array Python assigns into
// (stride 4: x, y, angle, kind); the GPU composes the world position from aData.xy.
//
// Styles:
//   'flat' - a solid HDR square (the original look; `color` is HDR so it crosses the bloom threshold)
//   'orb'  - the enemy bullet: hot-pink halo, white core, dark rim, LDR, drawn in the post-bloom pass
const ORB_RENDER_ORDER = 30;

const FLAT_FRAGMENT = `
uniform vec3 uColor;
void main() {
  gl_FragColor = vec4(uColor, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const FLAT_VERTEX = `
attribute vec4 aData;
uniform float halfW;
uniform float halfH;
void main() {
  vec3 p = position;
  p.x += aData.x - halfW;
  p.z += aData.y - halfH;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

// vLocal runs -1..1 across the quad; the orb is a disc of radius 1 in that space.
const ORB_VERTEX = `
attribute vec4 aData;
uniform float halfW;
uniform float halfH;
uniform float uInvHalf;
varying vec2 vLocal;
void main() {
  vec3 p = position;
  vLocal = p.xz * uInvHalf;
  p.x += aData.x - halfW;
  p.z += aData.y - halfH;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

// White core below radius 0.3, pink halo out to the rim band, near-black rim from 0.72 to the edge.
// Hue alone never carries the bullet: the core is the brightest thing on screen and the rim is
// darker than any fire behind it.
const ORB_FRAGMENT = `
uniform vec3 uCore;
uniform vec3 uHalo;
uniform vec3 uRim;
varying vec2 vLocal;
void main() {
  float r = length(vLocal);
  if (r > 1.0) discard;
  vec3 colour = mix(uCore, uHalo, smoothstep(0.26, 0.38, r));
  colour = mix(colour, uRim, smoothstep(0.68, 0.76, r));
  gl_FragColor = vec4(colour, 1.0 - smoothstep(0.92, 1.0, r));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function vec3(rgb) {
  return new THREE.Vector3(...rgb);
}

function buildMaterial(style, { color, size, halfW, halfH }) {
  const base = { halfW: { value: halfW }, halfH: { value: halfH } };
  switch (style) {
    case 'flat':
      return new THREE.ShaderMaterial({
        uniforms: { ...base, uColor: { value: vec3(color ?? [4.0, 1.6, 0.4]) } },
        vertexShader: FLAT_VERTEX,
        fragmentShader: FLAT_FRAGMENT,
        depthWrite: false,
      });
    case 'orb':
      return new THREE.ShaderMaterial({
        uniforms: {
          ...base,
          uInvHalf: { value: 2 / size },
          uCore: { value: vec3(PALETTE.ENEMY_BULLET_CORE.rgb) },
          uHalo: { value: vec3(PALETTE.ENEMY_BULLET_HALO.rgb) },
          uRim: { value: vec3(PALETTE.ENEMY_BULLET_RIM.rgb) },
        },
        vertexShader: ORB_VERTEX,
        fragmentShader: ORB_FRAGMENT,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
    default:
      throw new Error(`unknown bullet style: ${style}`);
  }
}

export function createBulletInstances({
  data,
  capacity,
  name = 'ebullets',
  style = name === 'ebullets' ? 'orb' : 'flat',
  size = style === 'orb' ? 6 : 4,
  color,
  playfieldW,
  playfieldH,
}) {
  const quad = new THREE.PlaneGeometry(size, size);
  quad.rotateX(-Math.PI / 2);

  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = quad.index;
  geometry.setAttribute('position', quad.attributes.position);
  const attribute = new THREE.InstancedBufferAttribute(data, 4);
  attribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aData', attribute);
  geometry.instanceCount = 0;

  const material = buildMaterial(style, {
    color,
    size,
    halfW: playfieldW / 2,
    halfH: playfieldH / 2,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.frustumCulled = false;
  if (style === 'orb') mesh.renderOrder = ORB_RENDER_ORDER;

  function update(n) {
    const count = Math.min(n, capacity);
    attribute.clearUpdateRanges();
    attribute.addUpdateRange(0, count * 4);
    attribute.needsUpdate = true;
    geometry.instanceCount = count;
  }

  return { mesh, update };
}
