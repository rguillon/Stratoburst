import * as THREE from 'three';
import { PALETTE } from '../../fx/palette.js';
import { bake, beveledExtrude, capsule, lathe, neonStrip, place, segmentsFor, tint } from './model_kit.js';
import { mirroredShape, polygonShape } from './outline_shapes.js';

// The enemy jet (VISL-01, D-24): the same smooth, stylized family as the player's ship, but in
// dark gunmetal with red neon (D-38) and facing down the screen (nose toward +Z, toward the
// player). Sized to the JET hitbox radius of 9: a span of 18 and a length of 20.

// Every channel stays below 1.0 so a resting jet never crosses the bloom threshold.
const HULL = [0.16, 0.17, 0.2];
const BELLY = [0.09, 0.1, 0.12];
const WING = [0.13, 0.14, 0.17];
const POD = [0.2, 0.21, 0.24];
const FIN = [0.12, 0.13, 0.15];
// Bright HDR red exhaust and wing strips: a channel above 1.0 crosses the bloom threshold, so only
// the engines and the neon bloom.
const STRIP_RADIUS = 0.18;
const WING_STRIPS = Object.freeze([
  [[2.4, 0.45, -0.55], [8.4, 0.45, -6.2]],
]);

// Fuselage profile, [radius, y] from the tail (y = -10) to the nose (y = +10).
const FUSELAGE_PROFILE = [
  [0, -10],
  [0.9, -10],
  [1.5, -8],
  [1.75, -4],
  [1.75, 1],
  [1.35, 5.5],
  [0.7, 8.5],
  [0, 10],
];

// Right half of the swept-back wing planform in the XY plane (+Y is the nose).
const HALF_WING = [
  [0, 3],
  [1.6, 0.5],
  [9, -6.5],
  [9, -8.5],
  [2.2, -6],
  [5, -10],
  [1.2, -9.4],
  [0, -10],
];

// A swept tail fin in (length, height); extruded along its thickness.
const FIN_OUTLINE = [
  [0, 0],
  [3.5, 0],
  [3.0, 3.2],
  [2.2, 3.2],
];

const SPHERE_SEGMENTS = Object.freeze({ high: [14, 10], mid: [10, 7], low: [6, 4] });

// Blends the vertex colour from `belly` to `top` over the height of the part, so the underside
// reads darker without a second part.
function shadeByHeight(geometry, top, belly) {
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const t = THREE.MathUtils.clamp((position.getY(i) + 1.2) / 2.4, 0, 1);
    for (let c = 0; c < 3; c++) colors[i * 3 + c] = belly[c] + (top[c] - belly[c]) * t;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function bodyGeometry(detail) {
  const fuselage = lathe(FUSELAGE_PROFILE, detail);
  fuselage.rotateX(Math.PI / 2); // lathe axis +Y (nose) -> +Z
  shadeByHeight(fuselage, HULL, BELLY);

  const wings = beveledExtrude(mirroredShape(HALF_WING), 0.5, detail, 0.2);
  wings.rotateX(Math.PI / 2); // shape +Y (nose) -> +Z, extrusion -> -Y
  wings.translate(0, 0.25, 0);
  tint(wings, WING);

  const parts = [fuselage, wings];
  for (const side of [-1, 1]) {
    const pod = capsule(0.8, 4.5, detail);
    pod.rotateX(Math.PI / 2); // capsule axis +Y -> +Z
    place(pod, { position: [side * 2.4, -0.3, -3.4] });
    parts.push(tint(pod, POD));

    const fin = beveledExtrude(polygonShape(FIN_OUTLINE), 0.3, detail, 0.08);
    fin.translate(0, 0, -0.15);
    fin.rotateY(Math.PI / 2); // fin length -> -Z (toward the tail), thickness -> X
    place(fin, { position: [side * 1.5, 0.4, -4.6], rotation: [0, 0, side * -0.18] });
    parts.push(tint(fin, FIN));
  }
  return bake(parts, 'enemy-jet');
}

// Two small exhaust discs at the tail and a red neon strip along each wing's leading edge.
function glowGeometry(detail) {
  const [width, height] = segmentsFor(detail, SPHERE_SEGMENTS);
  const parts = [-1, 1].map((side) => {
    const disc = new THREE.SphereGeometry(0.75, width, height);
    place(disc, { position: [side * 2.4, -0.3, -6.9], scale: [1, 1, 0.55] });
    return tint(disc, PALETTE.ENGINE.rgb);
  });
  for (const side of [-1, 1]) {
    for (const [from, to] of WING_STRIPS) {
      const mirrored = (point) => [side * point[0], point[1], point[2]];
      parts.push(neonStrip(mirrored(from), mirrored(to), STRIP_RADIUS, PALETTE.NEON_RED.rgb, detail));
    }
  }
  return bake(parts, 'enemy-jet-glow');
}

export function buildJet(detail) {
  return { body: bodyGeometry(detail), glow: glowGeometry(detail), top: null };
}
