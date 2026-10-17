import * as THREE from 'three';

// Placeholder low-poly body pointing toward -Z (up the screen). Plan 01-06 makes the real jet.
export function createShipModel() {
  const group = new THREE.Group();
  group.name = 'ship';
  const body = new THREE.Mesh(
    new THREE.ConeGeometry(6, 18, 4),
    new THREE.MeshStandardMaterial({ color: 0x9fb4c8, flatShading: true, roughness: 0.6 }),
  );
  body.rotation.x = -Math.PI / 2; // cone tip (+Y) -> -Z
  group.add(body);
  return group;
}
