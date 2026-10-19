import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { TERRAIN_DEPTH } from '../render/ground_layer.js';

// The boss's shadow sweep (D-13): during the WARNING the giant bomber's shadow crosses the city from
// the bottom of the playfield to the top, driven by FLOW_T, and then the bomber itself descends into
// view. It is one flat, soft, dark silhouette of the flying wing at terrain depth and drawn with the
// air shadows (renderOrder 3), displaced along the sun direction like they are. The silhouette is an
// alpha texture built once from the wing outline, so a frame only moves one mesh and allocates nothing.

// The right half of the bomber's plan, [x, y] with +y toward the nose: the same outline the model is
// extruded from (render/models/bomber.js), 60 units to a wing tip.
const HALF_PLAN = [
  [0, 28],
  [10, 25],
  [60, 8],
  [60, 1],
  [48, -6],
  [40, -8],
  [34, -16],
  [20, -12],
  [14, -20],
  [0, -16],
];
const PLAN = [
  ...HALF_PLAN,
  ...HALF_PLAN.slice(1, -1)
    .reverse()
    .map(([x, y]) => [-x, y]),
];

// How far the edge of the silhouette is softened, in plan units, either side of the outline.
const SOFT = 8;
// The region of the plan the texture covers, and its resolution.
const PLAN_W = 140;
const PLAN_H = 80;
const TEXTURE_W = 128;
const TEXTURE_H = 64;
// The shadow of something this big, this high, is a little larger than the airframe.
const SIZE_SCALE = 1.15;
const MAX_ALPHA = 0.5;
// How far beyond the playfield the sweep starts and ends, in logical units: wholly out of sight.
const MARGIN = 120;
// Lift above the terrain, with the polygon offset it keeps the silhouette from z-fighting the ground.
const LIFT = 0.3;

function insidePlan(x, y) {
  let inside = false;
  for (let i = 0, j = PLAN.length - 1; i < PLAN.length; j = i++) {
    const [xi, yi] = PLAN[i];
    const [xj, yj] = PLAN[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distanceToPlan(x, y) {
  let best = Infinity;
  for (let i = 0, j = PLAN.length - 1; i < PLAN.length; j = i++) {
    const [ax, ay] = PLAN[j];
    const [bx, by] = PLAN[i];
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.min(Math.max(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy), 0), 1);
    best = Math.min(best, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)));
  }
  return best;
}

// How opaque the shadow is at a point of the plan (x across, y toward the nose): 1 well inside the
// outline, 0 well outside it, and a soft ramp through 0.5 on the outline itself.
export function silhouetteAlpha(x, y) {
  const signed = (insidePlan(x, y) ? 1 : -1) * distanceToPlan(x, y);
  return Math.min(Math.max(0.5 + signed / SOFT, 0), 1);
}

// The silhouette as an alpha map (the green channel). Texture row 0 is the nose side, which lies at the
// bottom of the screen once the quad is laid flat, so the bomber's nose points down the screen at the
// player.
function silhouetteTexture() {
  const pixels = new Uint8Array(TEXTURE_W * TEXTURE_H * 4);
  for (let row = 0; row < TEXTURE_H; row += 1) {
    const y = (0.5 - (row + 0.5) / TEXTURE_H) * PLAN_H;
    for (let column = 0; column < TEXTURE_W; column += 1) {
      const x = ((column + 0.5) / TEXTURE_W - 0.5) * PLAN_W;
      const value = Math.round(silhouetteAlpha(x, y) * 255);
      pixels.fill(value, (row * TEXTURE_W + column) * 4, (row * TEXTURE_W + column) * 4 + 4);
    }
  }
  const texture = new THREE.DataTexture(pixels, TEXTURE_W, TEXTURE_H, THREE.RGBAFormat);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

// `flowStates` is the manifest's flow state name -> id map. `sunPosition` (only its direction matters)
// and `altitude` displace the shadow like the air shadows. `update(flow, flowT)` runs every frame with
// the header FLOW and FLOW_T: the mesh is visible only while FLOW is WARNING, at logical y from
// playfieldH + 120 (below the playfield) at FLOW_T 0 to -120 (above it) at FLOW_T 1.
export function createBossSweep({
  playfieldH,
  flowStates,
  sunPosition = new THREE.Vector3(0, 1, 0),
  altitude = 40,
  terrainDepth = TERRAIN_DEPTH,
}) {
  const width = PLAN_W * SIZE_SCALE;
  const depth = PLAN_H * SIZE_SCALE;
  const offsetX = (-sunPosition.x / sunPosition.y) * altitude;
  const offsetZ = (-sunPosition.z / sunPosition.y) * altitude;
  // The sweep runs down the middle column, which is world x 0 (the playfield is centred on the origin).
  const halfH = playfieldH / 2;
  const startY = playfieldH + MARGIN;
  const endY = -MARGIN;

  const quad = new THREE.PlaneGeometry(1, 1);
  quad.rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color().setRGB(...PALETTE.SHADOW.rgb),
    alphaMap: silhouetteTexture(),
    transparent: true,
    opacity: MAX_ALPHA,
    depthWrite: false,
    fog: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const mesh = new THREE.Mesh(quad, material);
  mesh.name = 'boss-sweep';
  mesh.frustumCulled = false;
  mesh.renderOrder = 3; // above the scorch marks (2), below the dim mask (5)
  mesh.scale.set(width, 1, depth);
  mesh.visible = false;
  mesh.position.set(offsetX, terrainDepth + LIFT, startY - halfH + offsetZ);

  function update(flow, flowT) {
    const warning = flow === flowStates.WARNING;
    mesh.visible = warning;
    if (!warning) return;
    const t = Number.isFinite(flowT) ? Math.min(Math.max(flowT, 0), 1) : 0;
    mesh.position.z = startY + (endY - startY) * t - halfH + offsetZ;
  }

  return { mesh, update, size: { width, depth } };
}
