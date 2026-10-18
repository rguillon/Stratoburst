import * as THREE from 'three';
import { PALETTE } from '../../fx/palette.js';
import { bake, place, segmentsFor, tint } from './model_kit.js';
import { boxPart, stripPart, turned } from './city_buildings.js';

// The destructible buildings of the neon city (D-34, STGE-03): a house, a fuel tank, a depot and a
// billboard, plus the charred rubble a destroyed one leaves behind. Each builder returns
// `{ body, glow, top: null }` like the enemy models: a dark gunmetal shell in vertex colours below
// 1.0, and HDR PALETTE neon trim in the glow that blooms (D-38). Unlike the scenery these are enemy
// ground units, so they are drawn in world units on the ground layer, standing on y = 0 and sized
// to their hitbox radius (HOUSE 12, FUEL_TANK 11, DEPOT 14, BILLBOARD 12). The billboard shows
// invented glyph blocks only: there is no text, no font and no real-world mark (a content rule).

// The manifest names of the four destructible city targets: the kinds that explode in sparks, leave
// rubble and flicker when damaged (main.js reads this list rather than repeating the names).
export const CITY_TARGET_KINDS = Object.freeze(['HOUSE', 'FUEL_TANK', 'DEPOT', 'BILLBOARD']);

// Rounded edges for world-scale boxes (the scenery default is for a unit footprint).
const EDGE = 0.6;
const soft = (detail, size, center, rgb) => boxPart(detail, size, center, rgb, EDGE);

// ---- House ------------------------------------------------------------------------------------

const HOUSE_WALL = [0.2, 0.17, 0.16];
const HOUSE_ROOF = [0.1, 0.09, 0.1];
const HOUSE_WINDOWS = Object.freeze({ high: 2, mid: 2, low: 0 });

export function buildHouse(detail) {
  const roof = new THREE.ConeGeometry(15, 6, 4);
  roof.rotateY(Math.PI / 4); // a square pyramid, edges parallel to the walls
  const body = bake(
    [
      soft(detail, [20, 8, 18], [0, 4, 0], HOUSE_WALL),
      turned(roof, [0, 11, 0], HOUSE_ROOF),
      soft(detail, [3, 5, 3], [5.5, 11.5, -4], HOUSE_ROOF),
    ],
    'HOUSE body',
  );
  // A violet line along the eaves and lit windows on the wall that faces the camera.
  const violet = PALETTE.NEON_VIOLET.rgb;
  const parts = [
    stripPart([20.6, 0.5, 0.5], [0, 8.2, 9.1], violet),
    stripPart([20.6, 0.5, 0.5], [0, 8.2, -9.1], violet),
    stripPart([0.5, 0.5, 18.6], [-10.1, 8.2, 0], violet),
    stripPart([0.5, 0.5, 18.6], [10.1, 8.2, 0], violet),
  ];
  const windows = [-5, 5].slice(0, segmentsFor(detail, HOUSE_WINDOWS));
  for (const x of windows) parts.push(stripPart([3.4, 2.6, 0.4], [x, 4.6, 9.05], PALETTE.NEON_CYAN.rgb));
  return { body, glow: bake(parts, 'HOUSE glow'), top: null };
}

// ---- Fuel tank --------------------------------------------------------------------------------

const TANK_SHELL = [0.17, 0.18, 0.2];
const TANK_PIPE = [0.1, 0.11, 0.13];
const TANK_SEGMENTS = Object.freeze({ high: 28, mid: 16, low: 8 });
const DOME_RINGS = Object.freeze({ high: 8, mid: 4, low: 2 });
const BEACON_SEGMENTS = Object.freeze({ high: [10, 6], mid: [6, 4], low: [4, 3] });

// An upright tank: a cylinder with a half-sphere dome, standing on y = 0 at (x, z).
function tankParts(detail, radius, height, x, z) {
  const radial = segmentsFor(detail, TANK_SEGMENTS);
  const cylinder = new THREE.CylinderGeometry(radius, radius, height, radial);
  const dome = new THREE.SphereGeometry(radius, radial, segmentsFor(detail, DOME_RINGS), 0, Math.PI * 2, 0, Math.PI / 2);
  return [turned(cylinder, [x, height / 2, z], TANK_SHELL), turned(dome, [x, height, z], TANK_SHELL)];
}

// An open ring painted around a tank at height y, a hair outside the shell.
function band(detail, radius, y, x, z, rgb) {
  const ring = new THREE.CylinderGeometry(radius + 0.15, radius + 0.15, 0.7, segmentsFor(detail, TANK_SEGMENTS), 1, true);
  return turned(ring, [x, y, z], rgb);
}

export function buildFuelTank(detail) {
  const pipe = new THREE.CylinderGeometry(0.7, 0.7, 8, segmentsFor(detail, BEACON_SEGMENTS)[0]);
  const body = bake(
    [
      soft(detail, [24, 0.8, 22], [0, 0.4, 0], TANK_PIPE),
      ...tankParts(detail, 7.5, 11, -2.5, -1),
      ...tankParts(detail, 4.5, 8, 8, 5),
      turned(pipe, [3, 2.2, 2], TANK_PIPE, [0, 0, Math.PI / 2]),
    ],
    'FUEL_TANK body',
  );
  const cyan = PALETTE.NEON_CYAN.rgb;
  const parts = [band(detail, 7.5, 3, -2.5, -1, cyan), band(detail, 7.5, 8, -2.5, -1, cyan)];
  if (detail !== 'low') {
    parts.push(band(detail, 4.5, 4, 8, 5, cyan));
    const [width, height] = segmentsFor(detail, BEACON_SEGMENTS);
    const beacon = new THREE.SphereGeometry(0.9, width, height);
    parts.push(turned(beacon, [-2.5, 14.8, -1], PALETTE.NEON_MAGENTA.rgb));
  }
  return { body, glow: bake(parts, 'FUEL_TANK glow'), top: null };
}

// ---- Depot ------------------------------------------------------------------------------------

const DEPOT_WALL = [0.15, 0.16, 0.2];
const DEPOT_ROOF = [0.1, 0.11, 0.14];
const DEPOT_DOORS = Object.freeze({ high: [-6, 0, 6], mid: [-6, 0, 6], low: [0] });
const VENT_SEGMENTS = Object.freeze({ high: 12, mid: 8, low: 5 });

export function buildDepot(detail) {
  const vent = () => new THREE.CylinderGeometry(1.1, 1.1, 1.6, segmentsFor(detail, VENT_SEGMENTS));
  const body = bake(
    [
      soft(detail, [26, 7, 15], [0, 3.5, 0], DEPOT_WALL),
      soft(detail, [27, 1.2, 16], [0, 7.6, 0], DEPOT_ROOF),
      soft(detail, [8, 3, 4], [-7, 1.5, 9.5], DEPOT_ROOF),
      turned(vent(), [6, 8.8, -2], DEPOT_ROOF),
      turned(vent(), [-6, 8.8, -2], DEPOT_ROOF),
    ],
    'DEPOT body',
  );
  // Magenta strips down the loading doors and a cyan line along the front of the roof.
  const parts = [stripPart([27, 0.5, 0.5], [0, 8.4, 8.2], PALETTE.NEON_CYAN.rgb)];
  for (const x of segmentsFor(detail, DEPOT_DOORS)) {
    parts.push(stripPart([1.2, 5, 0.4], [x, 3, 7.55], PALETTE.NEON_MAGENTA.rgb));
  }
  return { body, glow: bake(parts, 'DEPOT glow'), top: null };
}

// ---- Billboard --------------------------------------------------------------------------------

const POST = [0.12, 0.12, 0.15];
const PANEL = [0.08, 0.08, 0.1];
const POST_SEGMENTS = Object.freeze({ high: 14, mid: 8, low: 5 });
const GLYPH_ROWS = Object.freeze({ high: 4, mid: 3, low: 2 });
const PANEL_TILT = -0.5; // leans back so the face turns up toward the tilted camera
const PANEL_CENTER_Y = 16;
const GLYPH_FACE_Z = 0.9;
const ROW_PITCH = 2.4;
const CELL_X = Object.freeze([-7.5, 0, 7.5]);
const CELL_COLOURS = Object.freeze([PALETTE.NEON_CYAN.rgb, PALETTE.NEON_MAGENTA.rgb, PALETTE.NEON_VIOLET.rgb]);
// Invented glyphs, a few blocks each as [x, y, width, height] inside a cell about 5 wide and 2 tall.
const GLYPHS = Object.freeze([
  [[-1.8, 0, 0.8, 2], [1.8, 0, 0.8, 2], [0, 0.8, 3.4, 0.6]],
  [[0, 0.9, 4.2, 0.6], [0, 0, 4.2, 0.6], [0, -0.9, 4.2, 0.6], [1.8, 0, 0.7, 2]],
  [[-1.6, 0, 0.8, 2], [0, -0.9, 4, 0.6], [1.8, 0.5, 0.9, 0.9]],
]);

// Turns a part from the panel's local frame (centred on the origin) to its place on the posts.
const tilted = (geometry) =>
  place(geometry, { position: [0, PANEL_CENTER_Y, 0], rotation: [PANEL_TILT, 0, 0] });

export function buildBillboard(detail) {
  const post = () => new THREE.CylinderGeometry(0.9, 1.1, 14, segmentsFor(detail, POST_SEGMENTS));
  const body = bake(
    [
      turned(post(), [-7, 7, 0], POST),
      turned(post(), [7, 7, 0], POST),
      soft(detail, [3, 1, 3], [-7, 0.5, 0], POST),
      soft(detail, [3, 1, 3], [7, 0.5, 0], POST),
      tilted(soft(detail, [24, 11, 1.6], [0, 0, 0], PANEL)),
    ],
    'BILLBOARD body',
  );
  const parts = [];
  if (detail !== 'low') {
    const edge = PALETTE.NEON_CYAN.rgb;
    parts.push(stripPart([24.4, 0.4, 0.4], [0, 5.7, GLYPH_FACE_Z], edge));
    parts.push(stripPart([24.4, 0.4, 0.4], [0, -5.7, GLYPH_FACE_Z], edge));
  }
  const rows = segmentsFor(detail, GLYPH_ROWS);
  for (let row = 0; row < rows; row++) {
    const y = ((rows - 1) / 2 - row) * ROW_PITCH;
    CELL_X.forEach((cx, cell) => {
      const rgb = CELL_COLOURS[(cell + row) % CELL_COLOURS.length];
      for (const [x, dy, w, h] of GLYPHS[(cell + row) % GLYPHS.length]) {
        parts.push(stripPart([w, h, 0.4], [cx + x, y + dy, GLYPH_FACE_Z], rgb));
      }
    });
  }
  return { body, glow: bake(parts.map(tilted), 'BILLBOARD glow'), top: null };
}

// ---- Rubble -----------------------------------------------------------------------------------

const SCORCHED = [
  [0.14, 0.13, 0.12],
  [0.22, 0.2, 0.19],
  [0.28, 0.26, 0.24],
];
// Chunks of fallen wall and beam as [x, z, sx, sy, sz, yaw, tilt, shade]: deterministic, no RNG.
const CHUNKS = Object.freeze([
  [-6, -3, 7, 2.4, 5, 0.4, 0.2, 0],
  [3, -5, 6, 3.2, 4, -0.7, -0.25, 1],
  [7, 3, 5, 2, 6, 1.1, 0.3, 2],
  [-3, 4, 6, 2.6, 4, -0.3, -0.35, 1],
  [0, 0, 4, 3.6, 4, 0.9, 0.15, 0],
  [-8, 4, 3, 1.6, 7, 0.2, 0.4, 2],
  [9, -3, 2.6, 2.2, 2.6, 0.6, -0.2, 1],
  [-1, 8, 7, 1.4, 2.4, -0.5, 0.1, 0],
]);

// A low pile of dark broken chunks on a charred slab, about as wide as the buildings it replaces.
// One shape for all four city kinds; the wreck ring scales it down to burnt metal with CHAR.
export function buildRubble() {
  const parts = [tint(new THREE.BoxGeometry(22, 0.6, 20), SCORCHED[0])];
  parts[0].translate(0, 0.3, 0);
  for (const [x, z, sx, sy, sz, yaw, tilt, shade] of CHUNKS) {
    const chunk = new THREE.BoxGeometry(sx, sy, sz);
    place(chunk, { position: [x, sy / 2 + 0.3, z], rotation: [tilt, yaw, tilt / 2] });
    parts.push(tint(chunk, SCORCHED[shade]));
  }
  const pile = bake(parts, 'RUBBLE');
  // A tilted chunk dips below the slab: stand the whole pile on y = 0.
  pile.computeBoundingBox();
  pile.translate(0, -pile.boundingBox.min.y, 0);
  pile.computeBoundingBox();
  pile.computeBoundingSphere();
  return pile;
}
