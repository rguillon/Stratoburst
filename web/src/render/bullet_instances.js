import * as THREE from 'three';

// One draw call for every bullet. `data` is the same Float32Array Python assigns into
// (stride 4: x, y, angle, kind); the GPU composes the world position from aData.xy.
export function createBulletInstances({
  data,
  capacity,
  size = 4,
  color = [4.0, 1.6, 0.4], // HDR (>1) so only bullets cross the bloom threshold
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

  const material = new THREE.ShaderMaterial({
    uniforms: {
      halfW: { value: playfieldW / 2 },
      halfH: { value: playfieldH / 2 },
      uColor: { value: new THREE.Vector3(...color) },
    },
    vertexShader: `
attribute vec4 aData;
uniform float halfW;
uniform float halfH;
void main() {
  vec3 p = position;
  p.x += aData.x - halfW;
  p.z += aData.y - halfH;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`,
    fragmentShader: `
uniform vec3 uColor;
void main() {
  gl_FragColor = vec4(uColor, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'ebullets';
  mesh.frustumCulled = false;

  function update(n) {
    const count = Math.min(n, capacity);
    attribute.clearUpdateRanges();
    attribute.addUpdateRange(0, count * 4);
    attribute.needsUpdate = true;
    geometry.instanceCount = count;
  }

  return { mesh, update };
}
