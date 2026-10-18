import * as THREE from 'three';
import { bake, beveledExtrude, capsule, lathe, place, segmentsFor, tint } from './model_kit.js';
import { mirroredShape, polygonShape } from './outline_shapes.js';

// The enemy carrier (VISL-01, D-19, D-24): a big, slow transport that reads as the largest air
// enemy. A wide cargo fuselage with a bright stripe, high wings, four engine pods and a T-tail, in
// khaki. Nose toward +Z. Sized to the CARRIER hitbox radius of 14: a span of 30 and a length of 28.

// Every channel stays below 1.0, the stripe included, so a resting carrier never blooms.
const HULL = [0.46, 0.43, 0.3];
const STRIPE = [0.88, 0.78, 0.42];
const WING = [0.4, 0.38, 0.27];
const POD = [0.3, 0.3, 0.26];
const TAIL = [0.38, 0.36, 0.26];
// HDR accents: bright engine discs and an amber beacon on the spine.
const ENGINE_GLOW = [3.0, 1.3, 0.45];
const BEACON = [3.2, 2.0, 0.3];

// Fuselage profile, [radius, y] from the tail (y = -14) to the nose (y = +14).
const FUSELAGE_PROFILE = [
  [0, -14],
  [1.6, -14],
  [3.4, -11],
  [4.2, -6],
  [4.4, 0],
  [4.2, 7],
  [3.2, 11.5],
  [1.6, 13.2],
  [0, 14],
];

// The cargo stripe is a thin sleeve just proud of the hull between y = 2 and y = 5.
const STRIPE_PROFILE = [
  [4.38, 2],
  [4.38, 5],
];

// Right half of the high wing planform in the XY plane (+Y is the nose).
const HALF_WING = [
  [0, 4],
  [4, 3],
  [15, -3],
  [15, -7],
  [4, -6],
  [0, -6.5],
];

// Right half of the horizontal tail plane, high on the fin.
const HALF_TAIL_PLANE = [
  [0, -9],
  [6, -11.5],
  [6, -13],
  [0, -12.5],
];

// A tall swept tail fin in (length, height); extruded along its thickness.
const FIN_OUTLINE = [
  [0, 0],
  [6.5, 0],
  [5.5, 6],
  [3.8, 6],
];

const ENGINE_X = [6.5, 11];
const ENGINE_Z = -1.8;
const ENGINE_Y = 1.8;
const SPHERE_SEGMENTS = Object.freeze({ high: [14, 10], mid: [10, 7], low: [6, 4] });

function sphere(detail, center, scale, rgb) {
  const [width, height] = segmentsFor(detail, SPHERE_SEGMENTS);
  const part = new THREE.SphereGeometry(1, width, height);
  place(part, { position: center, scale });
  return tint(part, rgb);
}

function bodyGeometry(detail) {
  const fuselage = lathe(FUSELAGE_PROFILE, detail);
  fuselage.rotateX(Math.PI / 2); // lathe axis +Y (nose) -> +Z
  tint(fuselage, HULL);

  const stripe = lathe(STRIPE_PROFILE, detail);
  stripe.rotateX(Math.PI / 2);
  tint(stripe, STRIPE);

  const wings = beveledExtrude(mirroredShape(HALF_WING), 0.7, detail, 0.2);
  wings.rotateX(Math.PI / 2); // shape +Y (nose) -> +Z, extrusion -> -Y
  wings.translate(0, 3.3, 0);
  tint(wings, WING);

  const parts = [fuselage, stripe, wings];

  const fin = beveledExtrude(polygonShape(FIN_OUTLINE), 0.5, detail, 0.12);
  fin.translate(0, 0, -0.25);
  fin.rotateY(Math.PI / 2); // fin length -> -Z (toward the tail), thickness -> X
  fin.translate(0, 3, -7.2);
  parts.push(tint(fin, TAIL));

  const tailPlane = beveledExtrude(mirroredShape(HALF_TAIL_PLANE), 0.4, detail, 0.1);
  tailPlane.rotateX(Math.PI / 2);
  tailPlane.translate(0, 9.4, 0);
  parts.push(tint(tailPlane, TAIL));

  for (const side of [-1, 1]) {
    for (const x of ENGINE_X) {
      const pod = capsule(0.9, 3.5, detail);
      pod.rotateX(Math.PI / 2); // capsule axis +Y -> +Z
      place(pod, { position: [side * x, ENGINE_Y, ENGINE_Z] });
      parts.push(tint(pod, POD));
    }
  }
  return bake(parts, 'enemy-carrier');
}

// Four engine discs behind the pods and an amber beacon on the spine.
function glowGeometry(detail) {
  const parts = [];
  for (const side of [-1, 1]) {
    for (const x of ENGINE_X) {
      parts.push(sphere(detail, [side * x, ENGINE_Y, ENGINE_Z - 2.9], [0.8, 0.8, 0.45], ENGINE_GLOW));
    }
  }
  parts.push(sphere(detail, [0, 4.8, -3], [0.7, 0.7, 0.7], BEACON));
  return bake(parts, 'enemy-carrier-glow');
}

export function buildCarrier(detail) {
  return { body: bodyGeometry(detail), glow: glowGeometry(detail), top: null };
}
