import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// The model kit (D-24, D-25, VISL-01): smooth, stylized, code-built parts shared by every
// model. A generator asks for parts at a `detail` of 'high' | 'mid' | 'low', tints them with
// vertex colours, places them and bakes the touching parts of one model into a single
// geometry. Everything here is deterministic (no randomness), so two builds are identical.

export const DETAILS = Object.freeze(['low', 'mid', 'high']);

const KEPT_ATTRIBUTES = new Set(['position', 'normal', 'color']);
const NEUTRAL_GREY = [0.5, 0.5, 0.5];

// Anything that is not a known detail level is the cheapest one.
export function normalizeDetail(detail) {
  return DETAILS.includes(detail) ? detail : 'low';
}

// Picks the value for a detail level out of `{ high, mid, low }`.
export function segmentsFor(detail, values) {
  return values[normalizeDetail(detail)];
}

const LATHE_SEGMENTS = Object.freeze({ high: 28, mid: 16, low: 8 });
const CAPSULE_CAP_SEGMENTS = Object.freeze({ high: 8, mid: 4, low: 2 });
const CAPSULE_RADIAL_SEGMENTS = Object.freeze({ high: 24, mid: 14, low: 8 });
const CURVE_SEGMENTS = Object.freeze({ high: 12, mid: 6, low: 2 });
const BEVEL_SEGMENTS = Object.freeze({ high: 3, mid: 1, low: 0 });

// A surface of revolution about the Y axis from a profile of [radius, y] points.
export function lathe(points, detail, segments = LATHE_SEGMENTS) {
  const profile = points.map(([radius, y]) => new THREE.Vector2(radius, y));
  return new THREE.LatheGeometry(profile, segmentsFor(detail, segments));
}

// A rounded cylinder along the Y axis: `length` is the straight section between the caps.
export function capsule(radius, length, detail) {
  return new THREE.CapsuleGeometry(
    radius,
    length,
    segmentsFor(detail, CAPSULE_CAP_SEGMENTS),
    segmentsFor(detail, CAPSULE_RADIAL_SEGMENTS),
  );
}

// A flat shape extruded along +Z, with rounded edges at 'high' and 'mid' and sharp ones at 'low'.
export function beveledExtrude(shape, depth, detail, bevel = 0.3) {
  const bevelSegments = segmentsFor(detail, BEVEL_SEGMENTS);
  const bevelEnabled = bevelSegments > 0;
  return new THREE.ExtrudeGeometry(shape, {
    depth,
    curveSegments: segmentsFor(detail, CURVE_SEGMENTS),
    bevelEnabled,
    bevelSegments,
    bevelThickness: bevel,
    bevelSize: bevel,
  });
}

// Writes the same vertex colour at every vertex (replacing any colour already there).
export function tint(geometry, rgb) {
  const count = geometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) colors.set(rgb, i * 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

const placeMatrix = new THREE.Matrix4();
const placePosition = new THREE.Vector3();
const placeRotation = new THREE.Quaternion();
const placeEuler = new THREE.Euler();
const placeScale = new THREE.Vector3();

// Moves, turns and scales a part in place (rotation is an [x, y, z] Euler in radians).
export function place(geometry, { position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1] } = {}) {
  placePosition.fromArray(position);
  placeRotation.setFromEuler(placeEuler.set(rotation[0], rotation[1], rotation[2]));
  placeScale.fromArray(scale);
  geometry.applyMatrix4(placeMatrix.compose(placePosition, placeRotation, placeScale));
  return geometry;
}

const STRIP_AXIS = new THREE.Vector3(0, 1, 0);
const stripFrom = new THREE.Vector3();
const stripDirection = new THREE.Vector3();
const stripRotation = new THREE.Quaternion();

// A thin glowing capsule running from one end point to the other, tinted with an (HDR) colour:
// the neon trim of the factions (D-38). `radius` is the strip's half-width.
export function neonStrip(from, to, radius, rgb, detail) {
  stripFrom.fromArray(from);
  stripDirection.fromArray(to).sub(stripFrom);
  const length = stripDirection.length();
  const strip = capsule(radius, length, detail);
  strip.applyQuaternion(stripRotation.setFromUnitVectors(STRIP_AXIS, stripDirection.normalize()));
  strip.translate(
    (from[0] + to[0]) / 2,
    (from[1] + to[1]) / 2,
    (from[2] + to[2]) / 2,
  );
  return tint(strip, rgb);
}

// Makes one part mergeable: non-indexed, with exactly position, normal and color. Smooth
// normals survive toNonIndexed because it copies the per-vertex values to every face corner.
function normalized(part) {
  const geometry = part.index === null ? part.clone() : part.toNonIndexed();
  for (const name of Object.keys(geometry.attributes)) {
    if (!KEPT_ATTRIBUTES.has(name)) geometry.deleteAttribute(name);
  }
  if (!geometry.hasAttribute('normal')) geometry.computeVertexNormals();
  if (!geometry.hasAttribute('color')) tint(geometry, NEUTRAL_GREY);
  return geometry;
}

// Merges the parts of one model into a single geometry (one draw call, no seams). A merge
// that still fails throws, naming the model: it must never silently draw nothing (Pitfall 7).
export function bake(parts, name) {
  if (parts.length === 0) throw new Error(`cannot bake model ${name}: no parts`);
  const merged = mergeGeometries(parts.map(normalized), false);
  if (merged === null) throw new Error(`cannot bake model ${name}`);
  merged.computeBoundingSphere();
  return merged;
}
