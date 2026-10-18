import * as THREE from 'three';
import { bake, beveledExtrude, capsule, lathe, place, segmentsFor, tint } from './model_kit.js';
import { mirroredShape, polygonShape } from './outline_shapes.js';

// The enemy helicopter (VISL-01, D-24): a capsule cabin, a tapered tail boom, stub wings with
// rocket pods and skids, in khaki. Nose toward +Z. Sized to the HELI hitbox radius of 10. The
// rotor is the model's `top`: it is centred on the model origin so it can turn about Y alone.

// Every channel stays below 1.0 so a resting helicopter never crosses the bloom threshold.
const CABIN = [0.46, 0.43, 0.3];
const CANOPY = [0.09, 0.12, 0.16];
const BOOM = [0.4, 0.38, 0.27];
const WING = [0.36, 0.34, 0.25];
const POD = [0.26, 0.27, 0.24];
const SKID = [0.2, 0.21, 0.19];
const FIN = [0.38, 0.36, 0.26];
const ROTOR = [0.14, 0.15, 0.13];
// HDR navigation lights: a channel above 1.0 crosses the bloom threshold, so only the lights bloom.
const NAV_WARM = [3.0, 2.6, 1.7];
const NAV_GREEN = [0.4, 3.0, 0.9];

const BOOM_PROFILE = [
  [0, 0],
  [1.3, 0],
  [0.55, 9],
  [0, 9.4],
];

// Right half of the stub wing planform in the XY plane (+Y is the nose).
const HALF_STUB_WING = [
  [0, 1.8],
  [8.5, 1.0],
  [8.5, -0.8],
  [0, -1.8],
];

const FIN_OUTLINE = [
  [0, 0],
  [3.4, 0],
  [2.8, 3.2],
  [1.9, 3.2],
];

const SPHERE_SEGMENTS = Object.freeze({ high: [20, 14], mid: [12, 8], low: [7, 5] });
const LIGHT_SEGMENTS = Object.freeze({ high: [12, 8], mid: [8, 6], low: [5, 4] });

function sphere(detail, segments, center, scale, rgb) {
  const [width, height] = segmentsFor(detail, segments);
  const part = new THREE.SphereGeometry(1, width, height);
  place(part, { position: center, scale });
  return tint(part, rgb);
}

function bodyGeometry(detail) {
  const cabin = capsule(2.2, 5, detail);
  cabin.rotateX(Math.PI / 2); // capsule axis +Y -> +Z
  place(cabin, { position: [0, 0, 0.5], scale: [1, 0.95, 1] });
  tint(cabin, CABIN);

  const boom = lathe(BOOM_PROFILE, detail);
  boom.rotateX(-Math.PI / 2); // lathe axis +Y -> -Z, toward the tail
  boom.translate(0, 0.2, -3.5);
  tint(boom, BOOM);

  const parts = [cabin, boom, sphere(detail, SPHERE_SEGMENTS, [0, 0.7, 3.0], [1.7, 1.3, 2.4], CANOPY)];

  const fin = beveledExtrude(polygonShape(FIN_OUTLINE), 0.3, detail, 0.08);
  fin.translate(0, 0, -0.15);
  fin.rotateY(Math.PI / 2); // fin length -> -Z, thickness -> X
  fin.translate(0, 0.3, -9.4);
  parts.push(tint(fin, FIN));

  const wings = beveledExtrude(mirroredShape(HALF_STUB_WING), 0.5, detail, 0.15);
  wings.rotateX(Math.PI / 2); // shape +Y (nose) -> +Z, extrusion -> -Y
  wings.translate(0, 0.1, 0.5);
  parts.push(tint(wings, WING));

  for (const side of [-1, 1]) {
    const rocketPod = capsule(0.55, 2.2, detail);
    rocketPod.rotateX(Math.PI / 2);
    place(rocketPod, { position: [side * 8, -0.3, 1.2] });
    parts.push(tint(rocketPod, POD));

    const skid = capsule(0.25, 7, detail);
    skid.rotateX(Math.PI / 2);
    place(skid, { position: [side * 1.8, -2.9, 0.5] });
    parts.push(tint(skid, SKID));

    for (const z of [1.8, -1.2]) {
      const strut = capsule(0.2, 1.8, detail);
      place(strut, { position: [side * 1.8, -1.9, z] });
      parts.push(tint(strut, SKID));
    }
  }
  return bake(parts, 'enemy-heli');
}

// A warm white light on the tail fin and a green one on the right wing tip.
function glowGeometry(detail) {
  return bake(
    [
      sphere(detail, LIGHT_SEGMENTS, [0, 3.8, -11.4], [0.45, 0.45, 0.45], NAV_WARM),
      sphere(detail, LIGHT_SEGMENTS, [8.6, 0.2, 0.3], [0.45, 0.45, 0.45], NAV_GREEN),
    ],
    'enemy-heli-glow',
  );
}

// A mast and a thin two-blade rotor (one bar across), centred over the cabin.
function rotorGeometry(detail) {
  const mast = capsule(0.3, 0.8, detail);
  place(mast, { position: [0, 2.6, 0] });
  const blades = capsule(0.35, 19, detail);
  blades.rotateZ(Math.PI / 2); // capsule axis +Y -> X
  place(blades, { position: [0, 3.3, 0] });
  return bake([tint(mast, ROTOR), tint(blades, ROTOR)], 'enemy-heli-rotor');
}

export function buildHeli(detail) {
  return { body: bodyGeometry(detail), glow: glowGeometry(detail), top: rotorGeometry(detail) };
}
