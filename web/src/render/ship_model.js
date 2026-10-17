import * as THREE from 'three';

// Half of the jet planform in the XY plane (+Y is the nose), right side only; the left side is
// the mirror image. Units match the playfield: the wings span 16, the body is about 20 long.
const HALF_OUTLINE = [
  [0, 11], // nose
  [1.5, 6], // forward fuselage
  [2, 2], // wing root, leading edge
  [8, -4], // wing tip, leading edge
  [8, -6.5], // wing tip, trailing edge
  [2.4, -4.8], // wing root, trailing edge
  [4.6, -8.8], // tailplane tip
  [1.2, -8.2], // tailplane root
  [0, -9], // tail centre
];

const BODY_DEPTH = 2.5;
const MARKER_CORE_SCALE = 1.25;
const MARKER_RING_SCALE = 1.65;
const MARKER_LIFT = 0.6;

function jetShape() {
  const shape = new THREE.Shape();
  const right = HALF_OUTLINE;
  const left = HALF_OUTLINE.slice(1, -1).reverse().map(([x, y]) => [-x, y]);
  const outline = [...right, ...left];
  shape.moveTo(outline[0][0], outline[0][1]);
  for (const [x, y] of outline.slice(1)) shape.lineTo(x, y);
  shape.closePath();
  return shape;
}

function fuselageMesh() {
  const geometry = new THREE.ExtrudeGeometry(jetShape(), { depth: BODY_DEPTH, bevelEnabled: false });
  geometry.rotateX(-Math.PI / 2); // shape +Y (nose) -> -Z, extrusion -> +Y
  geometry.translate(0, -BODY_DEPTH / 2, 0);
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: 0x8a9099,
      metalness: 0.3,
      roughness: 0.6,
      flatShading: true,
    }),
  );
  mesh.name = 'fuselage';
  return mesh;
}

function canopyMesh() {
  const geometry = new THREE.ConeGeometry(1.5, 5.5, 4);
  geometry.rotateX(-Math.PI / 2); // tip (+Y) -> -Z
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: 0x1a2230, metalness: 0.5, roughness: 0.3, flatShading: true }),
  );
  mesh.name = 'canopy';
  mesh.position.set(0, BODY_DEPTH / 2, -1.5);
  return mesh;
}

function tailFinMesh(side) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 3.4, 3),
    new THREE.MeshStandardMaterial({ color: 0x6f7680, metalness: 0.3, roughness: 0.6, flatShading: true }),
  );
  mesh.name = side === -1 ? 'tail-fin-left' : 'tail-fin-right';
  mesh.position.set(side * 2.4, BODY_DEPTH / 2 + 1.2, 6.8);
  mesh.rotation.z = side * -0.18; // canted outward
  return mesh;
}

// An HDR emitter: a channel above 1.0 crosses the bloom threshold, so only the engine blooms.
function engineGlowMesh() {
  const material = new THREE.MeshBasicMaterial();
  material.color.setRGB(3.0, 1.2, 0.4);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1.3, 10, 8), material);
  mesh.name = 'engine-glow';
  mesh.scale.set(1, 0.8, 1.6);
  mesh.position.set(0, 0, 9.6);
  return mesh;
}

function overlayMaterial(color) {
  return new THREE.MeshBasicMaterial({
    color,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    toneMapped: false,
  });
}

// The hitbox core marker (PLYR-02, D-13): a bright disc with a dark ring, lying flat on the
// gameplay plane, drawn after everything else and never depth-occluded (Pitfall 13).
function hitboxMarker(hitboxRadius) {
  const marker = new THREE.Group();
  marker.name = 'hitbox-marker';
  marker.position.y = MARKER_LIFT;

  const coreRadius = hitboxRadius * MARKER_CORE_SCALE;
  const coreGeometry = new THREE.CircleGeometry(coreRadius, 24);
  coreGeometry.rotateX(-Math.PI / 2); // normal +Z -> +Y, facing the camera
  const core = new THREE.Mesh(coreGeometry, overlayMaterial(0xf2f2f2));
  core.name = 'hitbox-core';
  core.renderOrder = 20;

  const ringGeometry = new THREE.RingGeometry(coreRadius, hitboxRadius * MARKER_RING_SCALE, 24);
  ringGeometry.rotateX(-Math.PI / 2);
  const ring = new THREE.Mesh(ringGeometry, overlayMaterial(0x111111));
  ring.name = 'hitbox-ring';
  ring.renderOrder = 21;

  marker.add(ring, core);
  return marker;
}

export function createShipModel({ hitboxRadius = 2 } = {}) {
  const group = new THREE.Group();
  group.name = 'ship';
  group.add(
    fuselageMesh(),
    canopyMesh(),
    tailFinMesh(-1),
    tailFinMesh(1),
    engineGlowMesh(),
    hitboxMarker(hitboxRadius),
  );
  return group;
}
