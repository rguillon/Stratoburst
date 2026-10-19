import * as THREE from 'three';
import {
  DETAILS,
  bake,
  beveledExtrude,
  capsule,
  lathe,
  neonStrip,
  normalizeDetail,
  place,
  segmentsFor,
  tint,
} from './models/model_kit.js';
import { PALETTE } from '../fx/palette.js';

const BODY_DEPTH = 2.5;
const MARKER_CORE_SCALE = 1.25;
const MARKER_RING_SCALE = 1.65;
const MARKER_LIFT = 0.6;

// The player's white hull family (D-38). Every channel stays below 1.0 so the hull never crosses
// the bloom threshold; the cyan neon trim and engine are the only things that bloom.
const HULL = [0.82, 0.85, 0.9];
const WING = [0.76, 0.79, 0.84];
const NACELLE = [0.6, 0.63, 0.68];
const FIN = [0.7, 0.73, 0.78];
const CANOPY = [0.07, 0.1, 0.17];

// Fuselage profile, [radius, y] from the tail (y = -9) to the nose (y = +11).
const FUSELAGE_PROFILE = [
  [0, -9],
  [0.9, -9],
  [1.5, -7],
  [1.75, -3],
  [1.75, 2],
  [1.35, 6.5],
  [0.7, 9.5],
  [0, 11],
];

// Half of the wing planform in the XY plane (+Y is the nose), right side only; the left side is
// the mirror image. Units match the playfield: the wings span about 16 and the body 20.
const HALF_WING = [
  [0, 6], // wing root, nose side
  [2, 2], // wing root, leading edge
  [8, -4], // wing tip, leading edge
  [8, -6.5], // wing tip, trailing edge
  [2.4, -4.8], // wing root, trailing edge
  [4.6, -8.8], // tailplane tip
  [1.2, -8.2], // tailplane root
  [0, -9], // tail centre
];

// A swept tail fin in (length, height); extruded along its thickness.
const FIN_OUTLINE = [
  [0, 0],
  [3.5, 0],
  [3.0, 3.2],
  [2.2, 3.2],
];

const SPHERE_SEGMENTS = Object.freeze({ high: [24, 16], mid: [14, 9], low: [8, 5] });

function wingShape() {
  const shape = new THREE.Shape();
  const left = HALF_WING.slice(1, -1)
    .reverse()
    .map(([x, y]) => [-x, y]);
  const outline = [...HALF_WING, ...left];
  shape.moveTo(outline[0][0], outline[0][1]);
  for (const [x, y] of outline.slice(1)) shape.lineTo(x, y);
  shape.closePath();
  return shape;
}

function finShape() {
  const shape = new THREE.Shape();
  shape.moveTo(FIN_OUTLINE[0][0], FIN_OUTLINE[0][1]);
  for (const [x, y] of FIN_OUTLINE.slice(1)) shape.lineTo(x, y);
  shape.closePath();
  return shape;
}

// The hull, wings, engine pods and tail fins: parts that touch or overlap, baked into one
// geometry per detail (VISL-01).
function fuselageGeometry(detail) {
  const body = lathe(FUSELAGE_PROFILE, detail);
  body.rotateX(-Math.PI / 2); // lathe axis +Y (nose) -> -Z
  tint(body, HULL);

  const wings = beveledExtrude(wingShape(), BODY_DEPTH * 0.3, detail, 0.25);
  wings.rotateX(-Math.PI / 2); // shape +Y (nose) -> -Z, extrusion -> +Y
  wings.translate(0, -BODY_DEPTH * 0.15, 0);
  tint(wings, WING);

  const parts = [body, wings];
  for (const side of [-1, 1]) {
    const pod = capsule(0.8, 5.5, detail);
    pod.rotateX(Math.PI / 2); // capsule axis +Y -> +Z
    place(pod, { position: [side * 2.9, -0.35, 3.2] });
    parts.push(tint(pod, NACELLE));

    const fin = beveledExtrude(finShape(), 0.3, detail, 0.08);
    fin.translate(0, 0, -0.15);
    fin.rotateY(-Math.PI / 2); // fin length -> +Z, thickness -> X
    place(fin, { position: [side * 1.6, 0.4, 4.9], rotation: [0, 0, side * -0.18] });
    parts.push(tint(fin, FIN));
  }
  return bake(parts, 'player-ship');
}

function canopyGeometry(detail) {
  const [width, height] = segmentsFor(detail, SPHERE_SEGMENTS);
  const dome = new THREE.SphereGeometry(1, width, height);
  place(dome, { position: [0, 1.15, -2.4], scale: [1.05, 0.75, 2.7] });
  return bake([tint(dome, CANOPY)], 'player-canopy');
}

// Cyan neon trim along the wing leading edges and the spine behind the canopy, in the ship's
// own coordinates (nose toward -Z). Built once at the cheapest detail: the strips are thin.
const TRIM_RADIUS = 0.22;
const TRIM_STRIPS = Object.freeze([
  [[2.2, 0.5, -2.1], [7.8, 0.5, 3.8]],
  [[-2.2, 0.5, -2.1], [-7.8, 0.5, 3.8]],
  [[0, 1.75, 0.5], [0, 1.75, 6.5]],
]);

function trimGeometry() {
  return bake(
    TRIM_STRIPS.map(([from, to]) => neonStrip(from, to, TRIM_RADIUS, PALETTE.NEON_CYAN.rgb, 'low')),
    'player-trim',
  );
}

function trimMesh() {
  const mesh = new THREE.Mesh(trimGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true }));
  mesh.name = 'cyan-trim';
  return mesh;
}

const hullMaterial = () =>
  new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: false, metalness: 0.35, roughness: 0.5 });
const canopyMaterial = () =>
  new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: false, metalness: 0.5, roughness: 0.25 });

// An HDR emitter: a channel above 1.0 crosses the bloom threshold, so only the engine blooms.
function engineGlowMesh() {
  const material = new THREE.MeshBasicMaterial();
  material.color.setRGB(...PALETTE.NEON_CYAN.rgb);
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

// The respawn blink (PLYR-10, D-15): the hull is shown for four invulnerable steps, hidden for
// four, and always shown once the invulnerability is spent. Only the hull blinks (Pitfall 9).
const BLINK_STEPS = 4;
export function hullVisibleFor(invuln) {
  return invuln <= 0 || Math.floor(invuln / BLINK_STEPS) % 2 === 0;
}

export function createShipModel({ hitboxRadius = 2, detail = 'high' } = {}) {
  // Every detail level is built once, here, so a tier change only swaps cached geometries: no
  // generator runs and no buffer is allocated mid-game (T-02-08, Pitfall 8).
  const cache = new Map(
    DETAILS.map((level) => [level, { fuselage: fuselageGeometry(level), canopy: canopyGeometry(level) }]),
  );
  const start = cache.get(normalizeDetail(detail));

  const fuselage = new THREE.Mesh(start.fuselage, hullMaterial());
  fuselage.name = 'fuselage';
  const canopy = new THREE.Mesh(start.canopy, canopyMaterial());
  canopy.name = 'canopy';

  const group = new THREE.Group();
  group.name = 'ship';
  const engineGlow = engineGlowMesh();
  const trim = trimMesh();
  group.add(fuselage, canopy, engineGlow, trim, hitboxMarker(hitboxRadius));
  group.userData.detail = normalizeDetail(detail);
  group.userData.setDetail = (next) => {
    const level = normalizeDetail(next);
    const geometries = cache.get(level);
    fuselage.geometry = geometries.fuselage;
    canopy.geometry = geometries.canopy;
    group.userData.detail = level;
  };
  // The blink hides the hull, the canopy, the engine glow and the trim, never the hitbox marker: the
  // player must always see the one spot that can hurt (Pitfall 9).
  group.userData.setHullVisible = (visible) => {
    fuselage.visible = visible;
    canopy.visible = visible;
    engineGlow.visible = visible;
    trim.visible = visible;
  };
  return group;
}
