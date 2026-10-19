import * as THREE from 'three';
import { PALETTE } from '../../fx/palette.js';
import { bake, segmentsFor } from './model_kit.js';
import { boxPart, stripPart, turned } from './city_buildings.js';

// The props of the neon city (D-34, D-35): signs, the elevated maglev, runway lights, street lamps
// and burnt ruins. Same contract as the buildings: `{ body, glow }` in a unit footprint that the
// city layer scales by the placement's width and height. A sign carries only abstract invented
// glyph shapes made of glowing boxes: there is no text, no font and no real-world mark anywhere
// (a content rule, not a rendering one).

const WHITE = [1, 1, 1];

// ---- Sign -------------------------------------------------------------------------------------

const SIGN_PANEL = [0.07, 0.07, 0.1];
const SIGN_MOUNT = [0.12, 0.12, 0.15];
const GLYPH_ROWS = Object.freeze({ high: 4, mid: 3, low: 2 });
const MOUNT_SEGMENTS = Object.freeze({ high: 10, mid: 6, low: 4 });
const GLYPH_FACE_Z = 0.06;
// Three invented glyphs, each a few strokes [x, y, width, height] inside a cell about 0.6 wide and
// 0.16 tall; rows cycle through them.
const GLYPHS = Object.freeze([
  [[-0.24, 0, 0.08, 0.18], [0.24, 0, 0.08, 0.18], [0, 0.08, 0.4, 0.05]],
  [[0, 0.08, 0.5, 0.05], [0, 0, 0.5, 0.05], [0, -0.08, 0.5, 0.05], [0.22, 0, 0.06, 0.18]],
  [[-0.22, 0, 0.08, 0.18], [0, -0.08, 0.5, 0.05], [0.24, 0.05, 0.07, 0.07]],
]);
const ROW_PITCH = 0.2;

export function buildSign(detail) {
  // Two round arms hold the panel off the wall of the building it hangs on.
  const arm = () => new THREE.CylinderGeometry(0.05, 0.05, 0.3, segmentsFor(detail, MOUNT_SEGMENTS));
  const body = bake(
    [
      boxPart(detail, [0.9, 0.96, 0.1], [0, 0.5, 0], SIGN_PANEL),
      turned(arm(), [0, 0.2, -0.18], SIGN_MOUNT, [Math.PI / 2, 0, 0]),
      turned(arm(), [0, 0.8, -0.18], SIGN_MOUNT, [Math.PI / 2, 0, 0]),
    ],
    'SIGN body',
  );
  const parts = [];
  if (detail !== 'low') {
    parts.push(stripPart([0.86, 0.02, 0.02], [0, 0.97, GLYPH_FACE_Z], WHITE));
    parts.push(stripPart([0.86, 0.02, 0.02], [0, 0.03, GLYPH_FACE_Z], WHITE));
    for (const x of [-0.43, 0.43]) parts.push(stripPart([0.02, 0.94, 0.02], [x, 0.5, GLYPH_FACE_Z], WHITE));
  }
  const rows = segmentsFor(detail, GLYPH_ROWS);
  for (let row = 0; row < rows; row++) {
    const y = 0.5 + ((rows - 1) / 2 - row) * ROW_PITCH;
    for (const [x, dy, w, h] of GLYPHS[row % GLYPHS.length]) {
      parts.push(stripPart([w, h, 0.02], [x, y + dy, GLYPH_FACE_Z], WHITE));
    }
  }
  return { body, glow: bake(parts, 'SIGN glow') };
}

// ---- Maglev -----------------------------------------------------------------------------------

// A maglev segment is placed every 40 units and drawn 6 wide; in the unit space the layer scales
// by the width, that is 40 / 6 long, plus a hair so consecutive segments overlap instead of
// leaving a seam.
export const MAGLEV_SEGMENT = 40 / 6 + 0.02;
const DECK = [0.1, 0.11, 0.15];
const PILLAR = [0.09, 0.09, 0.12];
const PILLAR_SEGMENTS = Object.freeze({ high: 12, mid: 8, low: 5 });

export function buildMaglev(detail) {
  const pillar = new THREE.CylinderGeometry(0.11, 0.15, 0.88, segmentsFor(detail, PILLAR_SEGMENTS));
  const body = bake(
    [
      boxPart(detail, [1, 0.07, MAGLEV_SEGMENT], [0, 0.93, 0], DECK),
      boxPart(detail, [0.5, 0.05, MAGLEV_SEGMENT], [0, 0.885, 0], DECK),
      turned(pillar, [0, 0.44, 0], PILLAR),
      boxPart(detail, [0.7, 0.05, 0.4], [0, 0.86, 0], PILLAR),
    ],
    'MAGLEV body',
  );
  // Cyan rail lights along both deck edges; the finer details add magenta under-glow and light pads.
  const parts = [];
  for (const x of [-0.44, 0.44]) parts.push(stripPart([0.05, 0.03, MAGLEV_SEGMENT], [x, 0.975, 0], PALETTE.NEON_CYAN.rgb));
  if (detail !== 'low') {
    for (const x of [-0.46, 0.46]) {
      parts.push(stripPart([0.03, 0.03, MAGLEV_SEGMENT], [x, 0.89, 0], PALETTE.NEON_MAGENTA.rgb));
    }
  }
  if (detail === 'high') {
    for (const z of [-2.2, 0, 2.2]) parts.push(stripPart([0.3, 0.02, 0.4], [0, 0.968, z], PALETTE.NEON_CYAN.rgb));
  }
  return { body, glow: bake(parts, 'MAGLEV glow') };
}

// ---- Runway light -----------------------------------------------------------------------------

const FIXTURE = [0.1, 0.1, 0.13];
const FIXTURE_SEGMENTS = Object.freeze({ high: 12, mid: 8, low: 5 });
const LENS_SEGMENTS = Object.freeze({ high: [12, 8], mid: [8, 6], low: [5, 4] });

export function buildRunwayLight(detail) {
  const fixture = new THREE.CylinderGeometry(0.35, 0.4, 0.5, segmentsFor(detail, FIXTURE_SEGMENTS));
  const [width, height] = segmentsFor(detail, LENS_SEGMENTS);
  const lens = new THREE.SphereGeometry(0.3, width, height);
  return {
    body: bake([turned(fixture, [0, 0.25, 0], FIXTURE)], 'RUNWAY_LIGHT body'),
    // White key: the layer tints it blue or green by the placement's alternating variant.
    glow: bake([turned(lens, [0, 0.62, 0], WHITE)], 'RUNWAY_LIGHT glow'),
  };
}

// ---- Street lamp ------------------------------------------------------------------------------

const LAMP_POST = [0.12, 0.12, 0.15];
const LAMP_SEGMENTS = Object.freeze({ high: 8, mid: 6, low: 4 });

export function buildLamp(detail) {
  const pole = new THREE.CylinderGeometry(0.06, 0.09, 0.9, segmentsFor(detail, LAMP_SEGMENTS));
  const body = bake(
    [
      turned(pole, [0, 0.45, 0], LAMP_POST),
      boxPart(detail, [0.3, 0.06, 0.3], [0, 0.03, 0], LAMP_POST),
      boxPart(detail, [0.4, 0.04, 0.08], [0.18, 0.93, 0], LAMP_POST),
    ],
    'LAMP body',
  );
  const parts = [stripPart([0.2, 0.05, 0.14], [0.34, 0.9, 0], PALETTE.NEON_CYAN.rgb)];
  if (detail === 'high') parts.push(stripPart([0.3, 0.02, 0.2], [0.34, 0.875, 0], PALETTE.NEON_CYAN.rgb));
  return { body, glow: bake(parts, 'LAMP glow') };
}

// ---- Burnt ruin -------------------------------------------------------------------------------

const CHAR = [0.035, 0.032, 0.036];
const CHAR_LIGHT = [0.06, 0.055, 0.06];
// Embers on top of the ruin: [x, y, z, colour]; lower details keep the first few.
const EMBERS = Object.freeze([
  [0.1, 0.48, 0.1, PALETTE.FIRE.rgb],
  [-0.2, 0.5, -0.1, PALETTE.EMBER.rgb],
  [0.25, 0.5, 0.25, PALETTE.EMBER.rgb],
  [-0.3, 0.52, 0.3, PALETTE.FIRE.rgb],
  [0.32, 0.5, -0.25, PALETTE.FIRE.rgb],
  [0, 0.5, -0.32, PALETTE.EMBER.rgb],
]);
const EMBER_COUNT = Object.freeze({ high: 6, mid: 4, low: 2 });

export function buildFire(detail) {
  // One wall leans: turned about its own centre first, then moved so it still stands on the ground.
  const slanted = boxPart(detail, [0.3, 0.9, 0.12], [0, 0, 0], CHAR_LIGHT);
  slanted.rotateZ(0.06);
  slanted.translate(-0.3, 0.47, 0.28);
  const body = bake(
    [
      boxPart(detail, [0.85, 0.45, 0.85], [0, 0.225, 0], CHAR),
      slanted,
      boxPart(detail, [0.12, 0.7, 0.3], [0.4, 0.35, -0.2], CHAR_LIGHT),
      boxPart(detail, [0.25, 0.2, 0.22], [0.15, 0.55, -0.3], CHAR),
      boxPart(detail, [0.2, 0.14, 0.3], [-0.2, 0.52, -0.25], CHAR),
    ],
    'FIRE body',
  );
  const parts = EMBERS.slice(0, segmentsFor(detail, EMBER_COUNT)).map(([x, y, z, rgb]) =>
    stripPart([0.14, 0.06, 0.14], [x, y, z], rgb),
  );
  return { body, glow: bake(parts, 'FIRE glow') };
}
