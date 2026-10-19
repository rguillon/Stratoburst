import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PALETTE } from '../../fx/palette.js';
import { bake, place, segmentsFor, tint } from './model_kit.js';

// The buildings of the neon city (D-34, D-37, VISL-01): slum houses, low-rise blocks, towers with
// lit window strips and airbase hangars. Every builder takes a detail level and returns
// `{ body, glow }`: the dark lit shell and the HDR accents that bloom. The shell is in vertex colours
// below 1.0 so only the glow crosses the bloom threshold. The footprint is the unit square centred on
// the origin and the height is 1, standing on y = 0: the city layer scales an instance by its width
// and height. A glow that is white here is a "white key": the layer multiplies it by an instance
// colour (a PALETTE neon hue picked by the placement's variant, see scenery_models.js).

const WHITE = [1, 1, 1];
const ROUND_SEGMENTS = Object.freeze({ high: 2, mid: 1, low: 1 });
const ROUND_RADIUS = 0.02;

// Rounding costs triangles, and it is invisible on a thin part: only boxes at least this thick on
// every side are rounded.
const SOFT_MIN_SIDE = 0.2;

// A box centred on `center`. Sharp at 'low', softly rounded above it for the main masses (the
// Phase 2 smooth style); thin parts stay sharp at every detail.
export function boxPart(detail, size, center, rgb, radius = ROUND_RADIUS) {
  const [sx, sy, sz] = size;
  const soft = detail !== 'low' && Math.min(sx, sy, sz) >= SOFT_MIN_SIDE;
  const geometry = soft
    ? new RoundedBoxGeometry(sx, sy, sz, segmentsFor(detail, ROUND_SEGMENTS), radius)
    : new THREE.BoxGeometry(sx, sy, sz);
  place(geometry, { position: center });
  return tint(geometry, rgb);
}

// A flat glowing strip: always a sharp thin box, because it is only ever a few pixels wide.
export function stripPart(size, center, rgb) {
  const geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
  place(geometry, { position: center });
  return tint(geometry, rgb);
}

// A surface-of-revolution part (cylinder, half-cylinder, sphere) tinted and placed.
export function turned(geometry, center, rgb, rotation = [0, 0, 0]) {
  place(geometry, { position: center, rotation });
  return tint(geometry, rgb);
}

// ---- Slum house -------------------------------------------------------------------------------

const SLUM_WALL = [0.2, 0.17, 0.16];
const SLUM_ROOF = [0.1, 0.09, 0.1];
const SLUM_WINDOWS = Object.freeze({ high: 2, mid: 2, low: 1 });

export function buildSlumHouse(detail) {
  const roof = new THREE.ConeGeometry(0.72, 0.38, 4);
  roof.rotateY(Math.PI / 4); // a square pyramid, edges parallel to the walls
  const body = bake(
    [
      boxPart(detail, [0.9, 0.62, 0.9], [0, 0.31, 0], SLUM_WALL),
      turned(roof, [0, 0.81, 0], SLUM_ROOF),
      boxPart(detail, [0.12, 0.2, 0.12], [0.25, 0.78, -0.2], SLUM_ROOF),
    ],
    'SLUM_HOUSE body',
  );
  // Lit windows on the camera-facing wall: violet, then the blue flicker of a television.
  const windows = [
    [[-0.22, 0.36, 0.46], PALETTE.NEON_VIOLET.rgb],
    [[0.22, 0.36, 0.46], PALETTE.NEON_BLUE.rgb],
  ].slice(0, segmentsFor(detail, SLUM_WINDOWS));
  const glow = bake(
    windows.map(([center, rgb]) => stripPart([0.16, 0.14, 0.02], center, rgb)),
    'SLUM_HOUSE glow',
  );
  return { body, glow };
}

// ---- Low-rise block ---------------------------------------------------------------------------

const LOWRISE_WALL = [0.16, 0.17, 0.21];
const LOWRISE_ROOF = [0.1, 0.11, 0.14];
const LOWRISE_UNIT = [0.14, 0.15, 0.18];
const LOWRISE_BANDS = Object.freeze({ high: 3, mid: 2, low: 1 });
const BAND_HEIGHTS = Object.freeze([0.2, 0.42, 0.64]);

export function buildLowrise(detail) {
  const body = bake(
    [
      boxPart(detail, [0.94, 0.84, 0.94], [0, 0.42, 0], LOWRISE_WALL),
      boxPart(detail, [0.99, 0.06, 0.99], [0, 0.87, 0], LOWRISE_ROOF),
      boxPart(detail, [0.22, 0.1, 0.22], [0.22, 0.95, 0.18], LOWRISE_UNIT),
    ],
    'LOWRISE body',
  );
  // Window bands across the front, a trim line under the roof and, at high detail, along the sides.
  const parts = [stripPart([0.99, 0.02, 0.02], [0, 0.84, 0.5], WHITE)];
  for (const y of BAND_HEIGHTS.slice(0, segmentsFor(detail, LOWRISE_BANDS))) {
    parts.push(stripPart([0.8, 0.035, 0.02], [0, y, 0.48], WHITE));
  }
  if (detail === 'high') {
    for (const x of [-0.495, 0.495]) parts.push(stripPart([0.02, 0.02, 0.99], [x, 0.84, 0], WHITE));
  }
  return { body, glow: bake(parts, 'LOWRISE glow') };
}

// ---- Tower ------------------------------------------------------------------------------------

const TOWER_BASE = [0.12, 0.13, 0.18];
const TOWER_UPPER = [0.14, 0.15, 0.21];
const TOWER_SPIRE = [0.2, 0.21, 0.25];
const SPIRE_SEGMENTS = Object.freeze({ high: 10, mid: 6, low: 4 });
const FRONT_COLUMNS = Object.freeze({ high: [-0.33, -0.11, 0.11, 0.33], mid: [-0.33, -0.11, 0.11, 0.33], low: [-0.11, 0.11] });
const SIDE_COLUMNS = Object.freeze([-0.3, 0, 0.3]);
const UPPER_COLUMNS = Object.freeze({ high: [-0.27, -0.09, 0.09, 0.27], mid: [-0.2, 0.2], low: [] });

export function buildTower(detail) {
  const spire = new THREE.CylinderGeometry(0.025, 0.04, 0.07, segmentsFor(detail, SPIRE_SEGMENTS));
  const body = bake(
    [
      boxPart(detail, [0.96, 0.6, 0.96], [0, 0.3, 0], TOWER_BASE),
      boxPart(detail, [0.78, 0.26, 0.78], [0, 0.73, 0], TOWER_UPPER),
      boxPart(detail, [0.5, 0.1, 0.5], [0, 0.91, 0], TOWER_UPPER),
      turned(spire, [0, 0.965, 0], TOWER_SPIRE),
    ],
    'TOWER body',
  );
  // Vertical window strips up the faces the camera sees (front and both sides); mid and low light
  // fewer of them.
  const parts = [];
  for (const x of segmentsFor(detail, FRONT_COLUMNS)) {
    parts.push(stripPart([0.07, 0.5, 0.02], [x, 0.3, 0.48], WHITE));
  }
  for (const x of segmentsFor(detail, UPPER_COLUMNS)) {
    parts.push(stripPart([0.06, 0.2, 0.02], [x, 0.73, 0.39], WHITE));
  }
  if (detail === 'high') {
    for (const side of [-1, 1]) {
      for (const z of SIDE_COLUMNS) parts.push(stripPart([0.02, 0.5, 0.07], [side * 0.48, 0.3, z], WHITE));
    }
  }
  return { body, glow: bake(parts, 'TOWER glow') };
}

// ---- Hangar -----------------------------------------------------------------------------------

const HANGAR_WALL = [0.15, 0.16, 0.19];
const HANGAR_ROOF = [0.11, 0.12, 0.15];
const HANGAR_DOOR = [0.04, 0.04, 0.06];
const ARCH_SEGMENTS = Object.freeze({ high: 18, mid: 10, low: 6 });

export function buildHangar(detail) {
  // A half cylinder along Z: theta pi/2 .. 3 pi/2 faces -Z before the turn, which then lifts it up.
  const arch = new THREE.CylinderGeometry(0.48, 0.48, 0.96, segmentsFor(detail, ARCH_SEGMENTS), 1, false, Math.PI / 2, Math.PI);
  const body = bake(
    [
      boxPart(detail, [0.96, 0.5, 0.96], [0, 0.25, 0], HANGAR_WALL),
      turned(arch, [0, 0.5, 0], HANGAR_ROOF, [Math.PI / 2, 0, 0]),
      boxPart(detail, [0.6, 0.36, 0.03], [0, 0.19, 0.495], HANGAR_DOOR),
    ],
    'HANGAR body',
  );
  // Neon along the roof ridge and the door, with a red and a white beacon on the front corners.
  const parts = [
    stripPart([0.03, 0.025, 0.94], [0, 0.975, 0], PALETTE.NEON_CYAN.rgb),
    stripPart([0.66, 0.02, 0.02], [0, 0.385, 0.51], PALETTE.NEON_CYAN.rgb),
    stripPart([0.07, 0.07, 0.07], [-0.44, 0.54, 0.44], PALETTE.BEACON_RED.rgb),
    stripPart([0.07, 0.07, 0.07], [0.44, 0.54, 0.44], PALETTE.HIT_SPARK.rgb),
  ];
  if (detail === 'high') {
    for (const x of [-0.32, 0.32]) parts.push(stripPart([0.02, 0.36, 0.02], [x, 0.19, 0.51], PALETTE.NEON_CYAN.rgb));
  }
  return { body, glow: bake(parts, 'HANGAR glow') };
}
