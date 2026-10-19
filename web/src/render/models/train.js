import * as THREE from 'three';
import { PALETTE } from '../../fx/palette.js';
import { bake, beveledExtrude, capsule, lathe, neonStrip, place, segmentsFor, tint } from './model_kit.js';
import { mirroredShape, polygonShape } from './outline_shapes.js';

// The stage 1 mid-boss (VISL-01, D-02, D-14, D-24): an armored maglev train. Three builders share one
// frame, so the parts sit together when the game draws them as separate rows. The hull is a long,
// low gunmetal body about 64 units from nose to tail along +Z with red neon strips, a beacon at the
// nose and embers at the tail, and a flat mount deck at z = +-22 for each gun car. The gun car is a
// pivot-centred turret (its `top` follows the aim angle, like turret.js) built to stand on a mount
// deck. The stump is what a shot-off gun car leaves behind: a charred plate with a broken pedestal
// and a dim red ember. Front toward +Z.

// Every body channel stays below 1.0, so a resting train never crosses the bloom threshold.
const HULL = [0.21, 0.22, 0.26];
const ROOF = [0.26, 0.27, 0.29];
const RAIL = [0.08, 0.085, 0.1];
const DECK = [0.12, 0.13, 0.15];
const PLATE = [0.22, 0.23, 0.26];
const PEDESTAL = [0.17, 0.18, 0.21];
const HOUSING = [0.25, 0.26, 0.29];
const BARREL = [0.18, 0.19, 0.22];
const CHAR = [0.07, 0.07, 0.08];
const CHAR_PEDESTAL = [0.09, 0.09, 0.1];
// HDR accents bloom. The neon and the beacon are the faction red; the stump's ember is dimmer, with
// blue at or above green so its hue stays on the crimson side of the enemy-bullet band (D-39).
const NEON = PALETTE.NEON_RED.rgb;
const BEACON = PALETTE.BEACON_RED.rgb;
const EMBER_ENGINE = PALETTE.ENGINE.rgb;
const EMBER_DIM = [1.9, 0.14, 0.2];
const STRIP_RADIUS = 0.35;

// Right half of the hull plan in the XY plane (+Y is the nose): a pointed nose and a squared tail.
const HALF_HULL = [
  [0, 32],
  [5, 31],
  [9.4, 26],
  [10, 20],
  [10, -28.5],
  [8.6, -31.5],
  [0, -31.5],
];
// The roof car over the middle of the train, between the two mount decks.
const HALF_ROOF = [
  [0, 12],
  [7, 12],
  [7.6, 10.5],
  [7.6, -10.5],
  [7, -12],
  [0, -12],
];

const HULL_BOTTOM = 2;
const HULL_DEPTH = 4.2;
const HULL_BEVEL = 0.5;
const HULL_TOP = HULL_BOTTOM + HULL_DEPTH + 2 * HULL_BEVEL;
const ROOF_DEPTH = 1.6;
const ROOF_BEVEL = 0.3;
const ROOF_TOP = HULL_TOP + 1.6;

// Where the two gun cars ride, and the flat deck under each. The top of the deck is where a turret
// or a stump stands.
const MOUNT_Z = 22;
const MOUNT_RADIUS = 7.6;
const MOUNT_TOP = 7.6;
const MOUNT_PROFILE = [
  [0, 6.4],
  [MOUNT_RADIUS, 6.4],
  [MOUNT_RADIUS, 7.2],
  [MOUNT_RADIUS - 0.8, MOUNT_TOP],
  [0, MOUNT_TOP],
];
const RAIL_X = 6.5;
const RAIL_Y = 1.3;
const RAIL_RADIUS = 0.9;
const RAIL_LENGTH = 54;

const SPHERE_SEGMENTS = Object.freeze({ high: [20, 14], mid: [12, 8], low: [7, 5] });
const LIGHT_SEGMENTS = Object.freeze({ high: [12, 8], mid: [8, 6], low: [5, 4] });

function sphere(detail, segments, center, scale, rgb) {
  const [width, height] = segmentsFor(detail, segments);
  const part = new THREE.SphereGeometry(1, width, height);
  place(part, { position: center, scale });
  return tint(part, rgb);
}

function light(detail, center, size, rgb) {
  return sphere(detail, LIGHT_SEGMENTS, center, [size, size, size], rgb);
}

function hullGeometry(detail) {
  const hull = beveledExtrude(mirroredShape(HALF_HULL), HULL_DEPTH, detail, HULL_BEVEL);
  hull.rotateX(Math.PI / 2); // shape +Y (nose) -> +Z, extrusion -> -Y
  hull.translate(0, HULL_TOP - HULL_BEVEL, 0);
  const parts = [tint(hull, HULL)];

  const roof = beveledExtrude(mirroredShape(HALF_ROOF), ROOF_DEPTH, detail, ROOF_BEVEL);
  roof.rotateX(Math.PI / 2);
  roof.translate(0, ROOF_TOP - ROOF_BEVEL, 0);
  parts.push(tint(roof, ROOF));

  // A flat deck for each gun car, fore and aft of the roof car.
  for (const side of [-1, 1]) {
    const deck = lathe(MOUNT_PROFILE, detail);
    place(deck, { position: [0, 0, side * MOUNT_Z] });
    parts.push(tint(deck, DECK));
  }

  // The maglev skids under the hull.
  for (const side of [-1, 1]) {
    const rail = capsule(RAIL_RADIUS, RAIL_LENGTH, detail);
    rail.rotateX(Math.PI / 2); // capsule axis +Y -> +Z
    place(rail, { position: [side * RAIL_X, RAIL_Y, 0] });
    parts.push(tint(rail, RAIL));
  }
  return bake(parts, 'enemy-train');
}

// Red neon along both flanks and the top edges, across the car joints, a beacon at the nose and an
// ember at each tail corner. The top-edge strips sit outside the mount decks, so they run the full length.
function hullGlowGeometry(detail) {
  const parts = [];
  const top = HULL_TOP + 0.2;
  for (const side of [-1, 1]) {
    parts.push(neonStrip([side * 10.2, 4.4, -28], [side * 10.2, 4.4, 26], STRIP_RADIUS, NEON, detail));
    parts.push(neonStrip([side * 9.2, top, -28], [side * 9.2, top, 26], STRIP_RADIUS, NEON, detail));
    parts.push(neonStrip([-8.4, top, side * 13], [8.4, top, side * 13], STRIP_RADIUS, NEON, detail));
    parts.push(light(detail, [side * 3.6, 4.4, -31.8], 0.8, EMBER_ENGINE));
  }
  parts.push(light(detail, [0, 5, 31.4], 0.8, BEACON));
  return bake(parts, 'enemy-train-glow');
}

export function buildTrain(detail) {
  return { body: hullGeometry(detail), glow: hullGlowGeometry(detail), top: null };
}

// A gun car stands on a mount deck, so every height below is measured from MOUNT_TOP.
const PLATE_RADIUS = 8.6;
const PLATE_DEPTH = 1.2;
const PLATE_BEVEL = 0.3;
const GUN_Y = MOUNT_TOP + 8;

// Pedestal profile, [radius, y] relative to the plate bottom: a wide foot, a waist and a collar.
const PEDESTAL_PROFILE = [
  [0, 1.4],
  [4.8, 1.4],
  [3.9, 2.8],
  [3.2, 3.8],
  [3.0, 6.0],
  [3.7, 6.8],
  [0, 6.8],
];
// The broken pedestal a shot-off gun car leaves: a short waist and a ragged, flared top.
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

// The octagonal base plate with its bottom on the mount deck.
function plateGeometry(detail, rgb) {
  const plate = beveledExtrude(octagon(PLATE_RADIUS), PLATE_DEPTH, detail, PLATE_BEVEL);
  plate.rotateX(-Math.PI / 2); // extrusion +Z -> +Y
  plate.computeBoundingBox(); // the bevel is off at low detail, so seat the plate by its real bottom
  plate.translate(0, MOUNT_TOP - plate.boundingBox.min.y, 0);
  return tint(plate, rgb);
}

function turretBodyGeometry(detail) {
  const pedestal = lathe(PEDESTAL_PROFILE, detail);
  place(pedestal, { position: [0, MOUNT_TOP, 0] });
  return bake([plateGeometry(detail, PLATE), tint(pedestal, PEDESTAL)], 'enemy-train-turret');
}

// A red status lamp and red neon along the front edges of the plate.
function turretGlowGeometry(detail) {
  const y = MOUNT_TOP + PLATE_DEPTH + PLATE_BEVEL + 0.2;
  const parts = [
    light(detail, [5.6, y, 5.4], 0.7, BEACON),
    neonStrip([-3.6, y, 8], [3.6, y, 8], STRIP_RADIUS, NEON, detail),
    neonStrip([-7.6, y, 3.4], [-3.8, y, 7.6], STRIP_RADIUS, NEON, detail),
  ];
  return bake(parts, 'enemy-train-turret-glow');
}

// A rounded housing on the collar and two heavy parallel barrels along +Z, centred on the pivot. The
// housing and the barrels are set wide: the elevated maglev deck (6 wide) runs over the train's centre
// line and would hide a narrow gun from the camera.
function turretGunGeometry(detail) {
  const parts = [sphere(detail, SPHERE_SEGMENTS, [0, GUN_Y, -0.4], [5.6, 2.4, 4.6], HOUSING)];
  for (const side of [-1, 1]) {
    const barrel = capsule(0.8, 8, detail);
    barrel.rotateX(Math.PI / 2); // capsule axis +Y -> +Z
    place(barrel, { position: [side * 4.4, GUN_Y, 7.6] });
    parts.push(tint(barrel, BARREL));
  }
  return bake(parts, 'enemy-train-turret-gun');
}

export function buildTrainTurret(detail) {
  return { body: turretBodyGeometry(detail), glow: turretGlowGeometry(detail), top: turretGunGeometry(detail) };
}

function stumpBodyGeometry(detail) {
  const pedestal = lathe(STUMP_PROFILE, detail);
  place(pedestal, { position: [0, MOUNT_TOP, 0] });
  // A torn-off barrel lies across the plate.
  const barrel = capsule(0.7, 5, detail);
  barrel.rotateZ(Math.PI / 2 - 0.3); // capsule axis +Y -> nearly X
  place(barrel, { position: [2, MOUNT_TOP + PLATE_DEPTH + PLATE_BEVEL + 0.8, 5], rotation: [0, 0.5, 0] });
  return bake(
    [plateGeometry(detail, CHAR), tint(pedestal, CHAR_PEDESTAL), tint(barrel, CHAR)],
    'enemy-train-stump',
  );
}

// A dim red ember in the broken pedestal and one on the plate.
function stumpGlowGeometry(detail) {
  const parts = [
    light(detail, [0, MOUNT_TOP + 4.6, 0], 1.3, EMBER_DIM),
    light(detail, [-3.6, MOUNT_TOP + PLATE_DEPTH + PLATE_BEVEL + 0.2, 3.2], 0.6, EMBER_DIM),
  ];
  return bake(parts, 'enemy-train-stump-glow');
}

export function buildTrainStump(detail) {
  return { body: stumpBodyGeometry(detail), glow: stumpGlowGeometry(detail), top: null };
}
