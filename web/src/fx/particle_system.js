import * as THREE from 'three';

// A GPU ring of camera-facing quads. JS only writes the spawn record of a particle (start,
// velocity, spawn time, lifetime, sizes, colour); position, size and fade are evaluated in the
// vertex shader from `uTime`, so there is no per-particle work per frame. Oldest slots are
// overwritten when the ring is full, so a chain of explosions never allocates.
const ATTRIBUTES = [
  ['aStart', 3],
  ['aVel', 4],
  ['aLife', 2],
  ['aSize', 2],
  ['aColor', 3],
];

const VERTEX = `
attribute vec3 aStart;
attribute vec4 aVel;
attribute vec2 aLife;
attribute vec2 aSize;
attribute vec3 aColor;
uniform float uTime;
uniform vec3 uGravity;
varying vec2 vUv;
varying float vAge;
varying vec3 vColor;
void main() {
  float t = uTime - aLife.x;
  vUv = uv;
  vColor = aColor;
  if (aLife.y <= 0.0 || t < 0.0 || t > aLife.y) {
    vAge = 1.0;
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  float age = t / aLife.y;
  vAge = age;
  vec3 world = aStart + aVel.xyz * t + 0.5 * uGravity * aVel.w * t * t;
  vec4 view = modelViewMatrix * vec4(world, 1.0);
  view.xy += position.xy * mix(aSize.x, aSize.y, age);
  gl_Position = projectionMatrix * view;
}`;

const FRAGMENT = `
varying vec2 vUv;
varying float vAge;
varying vec3 vColor;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float alpha = smoothstep(1.0, 0.0, d) * (1.0 - vAge);
  gl_FragColor = vec4(vColor, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createParticleLayer({ capacity, blending = 'additive', name = 'particles' }) {
  const quad = new THREE.PlaneGeometry(1, 1);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = quad.index;
  geometry.setAttribute('position', quad.attributes.position);
  geometry.setAttribute('uv', quad.attributes.uv);
  geometry.instanceCount = capacity;

  const attributes = {};
  for (const [attrName, itemSize] of ATTRIBUTES) {
    const attribute = new THREE.InstancedBufferAttribute(new Float32Array(capacity * itemSize), itemSize);
    attribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute(attrName, attribute);
    attributes[attrName] = attribute;
  }

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uGravity: { value: new THREE.Vector3(0, -60, 0) },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    blending: blending === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.frustumCulled = false;
  mesh.renderOrder = 4; // above the terrain, below the playfield mask (5)

  let head = 0;
  let spawned = 0;
  let dirtyStart = 0;
  let dirtyEnd = 0; // exclusive; dirtyEnd === dirtyStart means nothing written
  let wrapped = false;

  function emit(x, y, z, vx, vy, vz, life, size0, size1, r, g, b, gravity) {
    const slot = head;
    const start = attributes.aStart.array;
    start[slot * 3] = x;
    start[slot * 3 + 1] = y;
    start[slot * 3 + 2] = z;
    const vel = attributes.aVel.array;
    vel[slot * 4] = vx;
    vel[slot * 4 + 1] = vy;
    vel[slot * 4 + 2] = vz;
    vel[slot * 4 + 3] = gravity;
    const lifeArray = attributes.aLife.array;
    lifeArray[slot * 2] = material.uniforms.uTime.value;
    lifeArray[slot * 2 + 1] = life;
    const size = attributes.aSize.array;
    size[slot * 2] = size0;
    size[slot * 2 + 1] = size1;
    const color = attributes.aColor.array;
    color[slot * 3] = r;
    color[slot * 3 + 1] = g;
    color[slot * 3 + 2] = b;

    if (dirtyEnd === dirtyStart) dirtyStart = slot;
    dirtyEnd = slot + 1;
    head += 1;
    if (head === capacity) {
      head = 0;
      wrapped = true;
    }
    spawned += 1;
  }

  function update(timeS) {
    material.uniforms.uTime.value = timeS;
    if (!wrapped && dirtyEnd === dirtyStart) return;
    const first = wrapped ? 0 : dirtyStart;
    const last = wrapped ? capacity : dirtyEnd;
    for (const [attrName, itemSize] of ATTRIBUTES) {
      const attribute = attributes[attrName];
      attribute.clearUpdateRanges();
      attribute.addUpdateRange(first * itemSize, (last - first) * itemSize);
      attribute.needsUpdate = true;
    }
    dirtyStart = 0;
    dirtyEnd = 0;
    wrapped = false;
  }

  return {
    mesh,
    emit,
    update,
    get spawned() {
      return spawned;
    },
    capacity,
  };
}
