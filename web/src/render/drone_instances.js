import * as THREE from 'three';

// Skeleton: replaced by the real instanced drones in the GREEN commit.
export function createDroneInstances({ capacity }) {
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(14, 6, 14),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }),
    capacity,
  );
  mesh.name = 'drones';
  mesh.count = 0;
  return { mesh, update() {} };
}
