import * as THREE from 'three';

const STRIDE = 8; // x, y, angle, flash, hp, scale, kind, spare
const FLASH_COLOR = [2.0, 2.0, 2.0]; // HDR, so a hit drone crosses the bloom threshold
const BASE_COLOR = [0.42, 0.45, 0.4]; // plain olive grey

// Module-level scratch objects: update() runs every frame and must not allocate.
const matrix = new THREE.Matrix4();
const color = new THREE.Color();

// One InstancedMesh of plain block targets (D-13). `data` is the Float32Array Python assigns
// into (stride 8); a positive flash field turns the instance bright for a few steps (D-14).
export function createDroneInstances({ data, capacity, playfieldW, playfieldH }) {
  const geometry = new THREE.BoxGeometry(14, 6, 14);
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
  const mesh = new THREE.InstancedMesh(geometry, material, capacity);
  mesh.name = 'drones';
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // Allocate instanceColor up front so the first update never reshapes the buffers.
  mesh.setColorAt(0, color.setRGB(...BASE_COLOR));
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;

  const halfW = playfieldW / 2;
  const halfH = playfieldH / 2;

  function update(n) {
    const count = Math.min(n, capacity);
    for (let i = 0; i < count; i++) {
      const base = i * STRIDE;
      matrix.makeTranslation(data[base] - halfW, 0, data[base + 1] - halfH);
      mesh.setMatrixAt(i, matrix);
      const rgb = data[base + 3] > 0 ? FLASH_COLOR : BASE_COLOR;
      mesh.setColorAt(i, color.setRGB(rgb[0], rgb[1], rgb[2]));
    }
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  }

  return { mesh, update };
}
