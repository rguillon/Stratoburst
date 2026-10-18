import * as THREE from 'three';
import { PALETTE } from '../../fx/palette.js';
import { bake, beveledExtrude, capsule, lathe, neonStrip, place, segmentsFor, tint } from './model_kit.js';
import { polygonShape } from './outline_shapes.js';

// The enemy anti-air turret (VISL-01, D-24): a beveled octagonal concrete base plate, a lathe
// pedestal and a twin-barrel gun. Front toward +Z. Sized to the TURRET hitbox radius of 10: the
// plate is about 18 across. The gun is the model's `top`: it is centred on the pedestal axis so
// it can turn about Y alone, which is how it follows the aim angle.

// Every channel stays below 1.0 so a resting turret never crosses the bloom threshold.
const CONCRETE = [0.22, 0.23, 0.26];
const PEDESTAL = [0.17, 0.18, 0.21];
const HOUSING = [0.16, 0.17, 0.2];
const BARREL = [0.1, 0.11, 0.13];
// HDR lights: a channel above 1.0 crosses the bloom threshold, so only the lights bloom. The status
// light stays green; the plate edges carry red neon strips (D-38).
const STATUS = [0.6, 3.0, 0.8];
const STRIP_RADIUS = 0.2;
const PLATE_STRIPS = Object.freeze([
  [[-3.4, 2.0, 8.4], [3.4, 2.0, 8.4]],
  [[-8.0, 2.0, 3.4], [-3.4, 2.0, 8.0]],
]);

const PLATE_DEPTH = 1.6;
const PLATE_BEVEL = 0.4;
const PLATE_RADIUS = 9.8;
const GUN_Y = 8.6;

// Pedestal profile, [radius, y]: a wide foot, a waist and a collar under the gun.
const PEDESTAL_PROFILE = [
  [0, 1.2],
  [5.2, 1.2],
  [4.4, 2.6],
  [3.2, 3.6],
  [3.0, 6.0],
  [3.8, 6.8],
  [0, 6.8],
];

const SPHERE_SEGMENTS = Object.freeze({ high: [20, 14], mid: [12, 8], low: [7, 5] });
const LIGHT_SEGMENTS = Object.freeze({ high: [12, 8], mid: [8, 6], low: [5, 4] });

function octagon(radius) {
  const corners = [];
  for (let k = 0; k < 8; k++) {
    const angle = (k + 0.5) * (Math.PI / 4); // flat sides face the axes
    corners.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
  }
  return polygonShape(corners);
}

function sphere(detail, segments, center, scale, rgb) {
  const [width, height] = segmentsFor(detail, segments);
  const part = new THREE.SphereGeometry(1, width, height);
  place(part, { position: center, scale });
  return tint(part, rgb);
}

function bodyGeometry(detail) {
  const plate = beveledExtrude(octagon(PLATE_RADIUS), PLATE_DEPTH, detail, PLATE_BEVEL);
  plate.rotateX(-Math.PI / 2); // extrusion +Z -> +Y
  const pedestal = lathe(PEDESTAL_PROFILE, detail);
  return bake([tint(plate, CONCRETE), tint(pedestal, PEDESTAL)], 'enemy-turret');
}

// A status light on the plate, toward the front-right corner, and red neon along the front edges.
function glowGeometry(detail) {
  const parts = [sphere(detail, LIGHT_SEGMENTS, [5.6, 2.3, 5.6], [0.7, 0.7, 0.7], STATUS)];
  for (const [from, to] of PLATE_STRIPS) {
    parts.push(neonStrip(from, to, STRIP_RADIUS, PALETTE.NEON_RED.rgb, detail));
  }
  return bake(parts, 'enemy-turret-glow');
}

// A rounded housing on the collar and two parallel barrels along +Z, centred on the pedestal axis.
function gunGeometry(detail) {
  const parts = [sphere(detail, SPHERE_SEGMENTS, [0, GUN_Y, -0.4], [3.2, 2.2, 3.8], HOUSING)];
  for (const side of [-1, 1]) {
    const barrel = capsule(0.6, 7, detail);
    barrel.rotateX(Math.PI / 2); // capsule axis +Y -> +Z
    place(barrel, { position: [side * 1.5, GUN_Y, 6.2] });
    parts.push(tint(barrel, BARREL));
  }
  return bake(parts, 'enemy-turret-gun');
}

export function buildTurret(detail) {
  return { body: bodyGeometry(detail), glow: glowGeometry(detail), top: gunGeometry(detail) };
}
