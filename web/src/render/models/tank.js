import * as THREE from 'three';
import { bake, beveledExtrude, capsule, place, segmentsFor, tint } from './model_kit.js';
import { mirroredShape, polygonShape } from './outline_shapes.js';

// The enemy tank (VISL-01, D-24): a beveled olive hull, two track blocks with road wheels and a
// rounded turret with a barrel. Front toward +Z. Sized to the TANK hitbox radius of 11: the hull
// is about 23 long and the tracks span about 18. The turret is the model's `top`: it is centred
// on the turret ring so it can turn about Y alone, which is how it follows the aim angle.

// Every channel stays below 1.0 so a resting tank never crosses the bloom threshold.
const HULL = [0.3, 0.34, 0.22];
const TRACK = [0.15, 0.16, 0.13];
const WHEEL = [0.2, 0.21, 0.17];
const TURRET = [0.34, 0.38, 0.25];
const BARREL = [0.2, 0.22, 0.17];
// HDR exhaust embers: a channel above 1.0 crosses the bloom threshold, so only the embers bloom.
const EMBER = [2.6, 1.0, 0.2];

// Right half of the hull plan in the XY plane (+Y is the nose): a sloped glacis and a square tail.
const HALF_HULL = [
  [0, 11],
  [4.6, 11],
  [6.4, 7.6],
  [6.4, -10],
  [0, -10],
];

// One track side seen from the side, as (length, height): a long block with chamfered ends.
const TRACK_OUTLINE = [
  [-11, -1.1],
  [-9.4, -2.5],
  [9.4, -2.5],
  [11, -1.1],
  [11, 1.1],
  [9.4, 2.5],
  [-9.4, 2.5],
  [-11, 1.1],
];

const TRACK_X = 7.4;
const TRACK_WIDTH = 3.2;
const HULL_BOTTOM = 1.2;
const HULL_DEPTH = 2.6;
const RING_Y = HULL_BOTTOM + HULL_DEPTH + 0.3;

const SPHERE_SEGMENTS = Object.freeze({ high: [20, 14], mid: [12, 8], low: [7, 5] });
const EMBER_SEGMENTS = Object.freeze({ high: [12, 8], mid: [8, 6], low: [5, 4] });

function sphere(detail, segments, center, scale, rgb) {
  const [width, height] = segmentsFor(detail, segments);
  const part = new THREE.SphereGeometry(1, width, height);
  place(part, { position: center, scale });
  return tint(part, rgb);
}

function bodyGeometry(detail) {
  const bevel = 0.4;
  const hull = beveledExtrude(mirroredShape(HALF_HULL), HULL_DEPTH, detail, bevel);
  hull.rotateX(Math.PI / 2); // shape +Y (nose) -> +Z, extrusion -> -Y
  hull.translate(0, HULL_BOTTOM + HULL_DEPTH + bevel, 0);
  const parts = [tint(hull, HULL)];

  for (const side of [-1, 1]) {
    const track = beveledExtrude(polygonShape(TRACK_OUTLINE), TRACK_WIDTH, detail, 0.3);
    track.translate(0, 0, -TRACK_WIDTH / 2);
    track.rotateY(Math.PI / 2); // track length -> Z, thickness -> X
    track.translate(side * TRACK_X, 2.7, 0);
    parts.push(tint(track, TRACK));

    // Road wheels poke out of the outer face of the track.
    for (const z of [-7.5, -2.5, 2.5, 7.5]) {
      const wheel = capsule(1.3, 0.5, detail);
      wheel.rotateZ(Math.PI / 2); // capsule axis +Y -> X
      place(wheel, { position: [side * (TRACK_X + TRACK_WIDTH / 2 + 0.3), 2.7, z] });
      parts.push(tint(wheel, WHEEL));
    }
  }
  return bake(parts, 'enemy-tank');
}

// Two small embers glowing at the rear deck.
function glowGeometry(detail) {
  return bake(
    [
      sphere(detail, EMBER_SEGMENTS, [-3, 3.9, -10.4], [0.6, 0.6, 0.6], EMBER),
      sphere(detail, EMBER_SEGMENTS, [3, 3.9, -10.4], [0.6, 0.6, 0.6], EMBER),
    ],
    'enemy-tank-glow',
  );
}

// A rounded turret on the ring, a mantlet and a barrel along +Z, centred on the ring axis.
function turretGeometry(detail) {
  const dome = sphere(detail, SPHERE_SEGMENTS, [0, RING_Y + 0.9, -0.6], [4.4, 2.2, 5.4], TURRET);

  const mantlet = capsule(1.1, 1.6, detail);
  mantlet.rotateZ(Math.PI / 2); // capsule axis +Y -> X
  place(mantlet, { position: [0, RING_Y + 1.1, 4.4] });

  const barrel = capsule(0.55, 8.5, detail);
  barrel.rotateX(Math.PI / 2); // capsule axis +Y -> +Z
  place(barrel, { position: [0, RING_Y + 1.1, 9.6] });

  return bake([dome, tint(mantlet, TURRET), tint(barrel, BARREL)], 'enemy-tank-turret');
}

export function buildTank(detail) {
  return { body: bodyGeometry(detail), glow: glowGeometry(detail), top: turretGeometry(detail) };
}
