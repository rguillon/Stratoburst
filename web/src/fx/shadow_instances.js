import * as THREE from 'three';

// Red-phase scaffold: the factory exists so the tests fail on behaviour, not on a missing module.
export function createShadowInstances({ capacity }) {
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial(), capacity);
  return { mesh, update() {} };
}
