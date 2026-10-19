import * as THREE from 'three';
import { PALETTE } from '../../fx/palette.js';
import { bake, beveledExtrude, capsule, lathe, neonStrip, place, segmentsFor, tint } from './model_kit.js';
import { mirroredShape, polygonShape } from './outline_shapes.js';

// The stage 1 boss (VISL-01, D-09, D-14, D-38): a giant bomber, a gunmetal flying wing about 120
// units from wing tip to wing tip with red neon along its edges. Five builders share one frame, so
// the parts sit together when the game draws them as separate rows. The airframe (closed in phase
// 1, with an open glowing core in phases 2 and 3) is the hull row; the wing turrets stand on the
// deck at x = +-46, z = +6 and track the player; the engine pods ride at x = +-26, z = -2; and a
// charred stump marks where either was shot off. Front toward +Z, nose toward the player.

// Every body channel stays below 1.0, so a resting bomber never crosses the bloom threshold.
const WING = [0.19, 0.2, 0.23];
const ARMOUR = [0.25, 0.26, 0.29];
const SPINE = [0.15, 0.16, 0.19];
const FIN = [0.13, 0.14, 0.17];
const COLLAR = [0.11, 0.12, 0.14];
const PLATE = [0.22, 0.23, 0.26];
const PEDESTAL = [0.17, 0.18, 0.21];
const HOUSING = [0.25, 0.26, 0.29];
const BARREL = [0.18, 0.19, 0.22];
const POD = [0.21, 0.22, 0.25];
const NOZZLE = [0.1, 0.11, 0.13];
const CHAR = [0.07, 0.07, 0.08];
const CHAR_PEDESTAL = [0.09, 0.09, 0.1];
// HDR accents bloom. The neon and the beacons are the faction red; the exhaust is the engine red;
// the stump's ember is dimmer, with blue at or above green so its hue stays on the crimson side of
// the enemy-bullet band (D-39). The open core is a magenta-white that outshines all of them, and
// keeps its green well above half of its red so it never reads as a pink enemy bullet.
const NEON = PALETTE.NEON_RED.rgb;
const BEACON = PALETTE.BEACON_RED.rgb;
const EXHAUST = PALETTE.ENGINE.rgb;
const EMBER_DIM = [1.9, 0.14, 0.2];
const CORE = [4.4, 2.6, 4.2];
const STRIP_RADIUS = 0.5;

// Right half of the flying wing plan in the XY plane (+Y is the nose): a blunt nose, swept leading
// edges out to 60-unit wing tips and a saw-toothed trailing edge.
const HALF_WING = [
  [0, 28],
  [10, 25],
  [60, 8],
  [60, 1],
  [48, -6],
  [40, -8],
  [34, -16],
  [20, -12],
  [14, -20],
  [0, -16],
];

const DECK_DEPTH = 2.4;
const DECK_BEVEL = 0.5;
// The flat top of the wing: the height every part stands on.
const DECK_TOP = 6.4;

// A tail fin at each wing tip in (length, height), extruded along its thickness.
const FIN_OUTLINE = [
  [0, 0],
  [10, 0],
  [8.4, 8],
  [4, 8],
];
const FIN_X = 57;
const FIN_Z = 9;

// The open core: a collar ring of the given [radius, y] profile, from the inner bottom outward.
const CORE_X = 0;
const CORE_Z = -4;
const COLLAR_PROFILE = [
  [9.5, 0],
  [15.6, 0],
  [14.6, 3],
  [11, 3.8],
  [9.5, 2.6],
];
const COLLAR_RING_RADIUS = 10.4;

const SPHERE_SEGMENTS = Object.freeze({ high: [20, 14], mid: [12, 8], low: [7, 5] });
const LIGHT_SEGMENTS = Object.freeze({ high: [12, 8], mid: [8, 6], low: [5, 4] });
const TORUS_RADIAL_SEGMENTS = Object.freeze({ high: 8, mid: 5, low: 3 });
const TORUS_TUBULAR_SEGMENTS = Object.freeze({ high: 40, mid: 20, low: 10 });

function sphere(detail, segments, center, scale, rgb) {
  const [width, height] = segmentsFor(detail, segments);
  const part = new THREE.SphereGeometry(1, width, height);
  place(part, { position: center, scale });
  return tint(part, rgb);
}

function light(detail, center, size, rgb) {
  return sphere(detail, LIGHT_SEGMENTS, center, [size, size, size], rgb);
}

// A slab lying flat: the outline's +Y becomes +Z and its top face sits exactly at `top`, whatever
// the detail (the bevel is off at low detail).
function flatSlab(shape, depth, detail, bevel, top) {
  const slab = beveledExtrude(shape, depth, detail, bevel);
  slab.rotateX(Math.PI / 2); // shape +Y (nose) -> +Z, extrusion -> -Y
  slab.computeBoundingBox();
  slab.translate(0, top - slab.boundingBox.max.y, 0);
  return slab;
}

// A capsule lying along +Z, centred on `center`.
function barrelAlongZ(radius, length, center, rgb, detail) {
  const part = capsule(radius, length, detail);
  part.rotateX(Math.PI / 2); // capsule axis +Y -> +Z
  place(part, { position: center });
  return tint(part, rgb);
}

function airframeBody(detail, open) {
  const parts = [tint(flatSlab(mirroredShape(HALF_WING), DECK_DEPTH, detail, DECK_BEVEL, DECK_TOP), WING)];
  // The nose spine and a faired root along each side of the centre line.
  parts.push(barrelAlongZ(3.2, 28, [0, DECK_TOP + 1.6, 8], SPINE, detail));
  for (const side of [-1, 1]) {
    parts.push(barrelAlongZ(2.4, 24, [side * 13, DECK_TOP + 0.6, -2], SPINE, detail));
    const fin = beveledExtrude(polygonShape(FIN_OUTLINE), 0.8, detail, 0.2);
    fin.translate(0, 0, -0.4);
    fin.rotateY(Math.PI / 2); // fin length -> -Z (toward the tail), thickness -> X
    place(fin, { position: [side * FIN_X, DECK_TOP - 0.3, FIN_Z], rotation: [0, 0, side * -0.1] });
    parts.push(tint(fin, FIN));
  }
  if (open) {
    // The armour hinges open: a collar ring round the hole and a plate swung up on each side.
    const collar = lathe(COLLAR_PROFILE, detail);
    place(collar, { position: [CORE_X, DECK_TOP, CORE_Z] });
    parts.push(tint(collar, COLLAR));
    for (const side of [-1, 1]) {
      parts.push(
        sphere(detail, SPHERE_SEGMENTS, [side * 19, DECK_TOP + 3.4, CORE_Z], [4.6, 2.2, 13], ARMOUR),
      );
    }
  } else {
    // The closed dome of armour over the core.
    parts.push(sphere(detail, SPHERE_SEGMENTS, [CORE_X, DECK_TOP + 0.6, CORE_Z], [15, 6, 19], ARMOUR));
  }
  return bake(parts, open ? 'enemy-bomber-open' : 'enemy-bomber');
}

// Red neon along both leading edges and the wing-tip trailing edges, a beacon on the nose and a
// light on each wing tip; the open airframe adds the bright core and a red ring round it.
function airframeGlow(detail, open) {
  const parts = [];
  const top = DECK_TOP + 0.3;
  for (const side of [-1, 1]) {
    parts.push(neonStrip([side * 11, top, 23.2], [side * 58, top, 7.2], STRIP_RADIUS, NEON, detail));
    parts.push(neonStrip([side * 58, top, 1.2], [side * 49, top, -4.6], STRIP_RADIUS, NEON, detail));
    parts.push(light(detail, [side * 59, top + 0.8, 4.6], 1.1, BEACON));
  }
  parts.push(light(detail, [0, DECK_TOP + 4.6, 22.6], 1.2, BEACON));
  if (open) {
    parts.push(sphere(detail, SPHERE_SEGMENTS, [CORE_X, DECK_TOP + 1.6, CORE_Z], [7, 3.8, 7], CORE));
    const ring = new THREE.TorusGeometry(
      COLLAR_RING_RADIUS,
      0.5,
      segmentsFor(detail, TORUS_RADIAL_SEGMENTS),
      segmentsFor(detail, TORUS_TUBULAR_SEGMENTS),
    );
    ring.rotateX(Math.PI / 2);
    place(ring, { position: [CORE_X, DECK_TOP + 3.6, CORE_Z] });
    parts.push(tint(ring, NEON));
  }
  return bake(parts, open ? 'enemy-bomber-open-glow' : 'enemy-bomber-glow');
}

export function buildBomber(detail) {
  return { body: airframeBody(detail, false), glow: airframeGlow(detail, false), top: null };
}

// The hull once its core is open (the BOMBER_OPEN kind, phases 2 and 3).
export function buildBomberOpen(detail) {
  return { body: airframeBody(detail, true), glow: airframeGlow(detail, true), top: null };
}

// Wing turret and stump parts stand on the deck, so every height below is measured from DECK_TOP.
const PLATE_RADIUS = 8.4;
const PLATE_DEPTH = 1.2;
const PLATE_BEVEL = 0.3;
const GUN_Y = DECK_TOP + 7.6;

// Pedestal profile, [radius, y] relative to the deck: a wide foot, a waist and a collar.
const PEDESTAL_PROFILE = [
  [0, 1.4],
  [4.8, 1.4],
  [3.9, 2.8],
  [3.2, 3.8],
  [3.0, 5.8],
  [3.7, 6.6],
  [0, 6.6],
];
// The broken pedestal a shot-off turret or engine leaves: a short waist and a ragged, flared top.
const STUMP_PROFILE = [
  [0, 1.4],
  [4.8, 1.4],
  [3.9, 2.8],
  [3.4, 3.6],
  [3.9, 4.2],
  [2.2, 4.6],
  [0, 4.4],
];

function octagon(radius) {
  const corners = [];
  for (let k = 0; k < 8; k++) {
    const angle = (k + 0.5) * (Math.PI / 4); // flat sides face the axes
    corners.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
  }
  return polygonShape(corners);
}

// The octagonal base plate with its bottom on the deck.
function plateGeometry(detail, rgb, radius) {
  const plate = beveledExtrude(octagon(radius), PLATE_DEPTH, detail, PLATE_BEVEL);
  plate.rotateX(-Math.PI / 2); // extrusion +Z -> +Y
  plate.computeBoundingBox(); // the bevel is off at low detail, so seat the plate by its real bottom
  plate.translate(0, DECK_TOP - plate.boundingBox.min.y, 0);
  return tint(plate, rgb);
}

function turretBodyGeometry(detail) {
  const pedestal = lathe(PEDESTAL_PROFILE, detail);
  place(pedestal, { position: [0, DECK_TOP, 0] });
  return bake([plateGeometry(detail, PLATE, PLATE_RADIUS), tint(pedestal, PEDESTAL)], 'enemy-bomber-turret');
}

// A red status lamp and red neon along the front edges of the plate.
function turretGlowGeometry(detail) {
  const y = DECK_TOP + PLATE_DEPTH + PLATE_BEVEL + 0.2;
  const parts = [
    light(detail, [5.4, y, 5.2], 0.7, BEACON),
    neonStrip([-3.6, y, 7.8], [3.6, y, 7.8], 0.35, NEON, detail),
    neonStrip([-7.4, y, 3.4], [-3.8, y, 7.4], 0.35, NEON, detail),
  ];
  return bake(parts, 'enemy-bomber-turret-glow');
}

// A rounded housing on the collar and two heavy parallel barrels along +Z, centred on the pivot.
function turretGunGeometry(detail) {
  const parts = [sphere(detail, SPHERE_SEGMENTS, [0, GUN_Y, -0.4], [4.4, 2.2, 4], HOUSING)];
  for (const side of [-1, 1]) {
    parts.push(barrelAlongZ(0.7, 7.4, [side * 3.4, GUN_Y, 7.6], BARREL, detail));
  }
  return bake(parts, 'enemy-bomber-turret-gun');
}

export function buildBomberTurret(detail) {
  return { body: turretBodyGeometry(detail), glow: turretGlowGeometry(detail), top: turretGunGeometry(detail) };
}

// An engine pod: a nacelle along the flight direction on a faired base, a dark nozzle ring at the
// tail and a red-hot exhaust inside it.
const POD_RADIUS = 4.6;
const POD_Y = DECK_TOP + 4.2;
const POD_LENGTH = 16;
const NOZZLE_Z = -(POD_LENGTH / 2 + POD_RADIUS - 0.6);

function engineBodyGeometry(detail) {
  const parts = [
    sphere(detail, SPHERE_SEGMENTS, [0, DECK_TOP + 1, 0], [7.4, 2, 12.4], PLATE),
    barrelAlongZ(POD_RADIUS, POD_LENGTH, [0, POD_Y, 0], POD, detail),
    barrelAlongZ(POD_RADIUS + 0.5, 0.8, [0, POD_Y, NOZZLE_Z + 0.4], NOZZLE, detail),
  ];
  return bake(parts, 'enemy-bomber-engine');
}

function engineGlowGeometry(detail) {
  const parts = [
    sphere(detail, SPHERE_SEGMENTS, [0, POD_Y, NOZZLE_Z - 0.4], [POD_RADIUS - 0.6, POD_RADIUS - 0.6, 2], EXHAUST),
    neonStrip([0, POD_Y + POD_RADIUS + 0.2, -7], [0, POD_Y + POD_RADIUS + 0.2, 7], 0.35, NEON, detail),
  ];
  return bake(parts, 'enemy-bomber-engine-glow');
}

export function buildBomberEngine(detail) {
  return { body: engineBodyGeometry(detail), glow: engineGlowGeometry(detail), top: null };
}

function stumpBodyGeometry(detail) {
  const pedestal = lathe(STUMP_PROFILE, detail);
  place(pedestal, { position: [0, DECK_TOP, 0] });
  // A torn-off barrel lies across the plate.
  const barrel = capsule(0.7, 5, detail);
  barrel.rotateZ(Math.PI / 2 - 0.3); // capsule axis +Y -> nearly X
  place(barrel, { position: [1.5, DECK_TOP + PLATE_DEPTH + PLATE_BEVEL + 0.8, 4], rotation: [0, 0.5, 0] });
  return bake(
    [plateGeometry(detail, CHAR, 7.2), tint(pedestal, CHAR_PEDESTAL), tint(barrel, CHAR)],
    'enemy-bomber-stump',
  );
}

// A dim red ember in the broken pedestal and one on the plate.
function stumpGlowGeometry(detail) {
  const parts = [
    light(detail, [0, DECK_TOP + 4.6, 0], 1.3, EMBER_DIM),
    light(detail, [-3.4, DECK_TOP + PLATE_DEPTH + PLATE_BEVEL + 0.2, 3], 0.6, EMBER_DIM),
  ];
  return bake(parts, 'enemy-bomber-stump-glow');
}

export function buildBomberStump(detail) {
  return { body: stumpBodyGeometry(detail), glow: stumpGlowGeometry(detail), top: null };
}
