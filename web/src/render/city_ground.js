import * as THREE from 'three';
import { terrainWindow } from './city_layer.js';

// The road grid under the city (D-34, D-35): dark asphalt roads with lane dashes and neon kerb
// lines between the blocks, on one repeating canvas tile. The plane is fixed in the ground layer
// and never moves; only the texture offset scrolls, with the same mapping as the buildings (a point
// at stage distance d is at logical y = y0 + ratio * (scroll - d)), so the roads stay under the
// blocks and under the tanks at every scroll. The authored grid (stage_data / city_builder) puts a
// road centre on x = pitch * c and on every distance that is a multiple of the pitch, and a block
// fills the middle `block` of each cell, so the tile has a road on each of its four edges.

const TILE_PX = 256;
// The tile is dark: albedo stays far below 1.0 and only the kerb lines are bright (still LDR).
const GROUND_FILL = '#1b1932';
const ROAD_FILL = '#0d0d15';
const DASH_FILL = '#3d3d4f';
const KERB_X = '#13a3bd';
const KERB_Y = '#a1138a';
const KERB_PX = 2;
const DASH_PERIOD = 32;
const DASH_LENGTH = 14;
const DASH_FIRST = 8;

const frac = (value) => value - Math.floor(value);

// The texture transform that puts the lanes on x = pitch * c and on y = cityY(scroll, pitch * n).
// Pure, so a test can check the mapping without a renderer. `area` is the plane's logical extent.
// With u = (x - xMin) / w and v = 0.5 - (y - yc) / h across the plane, the tile coordinate is
// t = uv * repeat + offset; picking the offsets below makes t equal x / pitch and d / pitch (mod 1).
// Offsets are wrapped into [0, 1) so they stay small however long the session runs.
export function groundUv({ scroll, y0, ratio, pitch, area }) {
  const width = area.xMax - area.xMin;
  const height = area.yMax - area.yMin;
  const repeatY = height / (pitch * ratio);
  const centreDistance = scroll - ((area.yMin + area.yMax) / 2 - y0) / ratio;
  return {
    repeatX: width / pitch,
    repeatY,
    offsetX: frac(area.xMin / pitch),
    offsetY: frac(centreDistance / pitch - 0.5 * repeatY),
  };
}

export const KERB_COLOURS = Object.freeze([KERB_X, KERB_Y]);

function paintTile(canvas, pitch, block) {
  canvas.width = TILE_PX;
  canvas.height = TILE_PX;
  const ctx = canvas.getContext('2d');
  const half = (TILE_PX * (pitch - block)) / pitch / 2; // half a road, at each tile edge
  const far = TILE_PX - half;
  ctx.fillStyle = GROUND_FILL;
  ctx.fillRect(0, 0, TILE_PX, TILE_PX);
  ctx.fillStyle = ROAD_FILL;
  ctx.fillRect(0, 0, half, TILE_PX);
  ctx.fillRect(far, 0, half, TILE_PX);
  ctx.fillRect(0, 0, TILE_PX, half);
  ctx.fillRect(0, far, TILE_PX, half);
  // Lane dashes down the road centres (the tile edges), skipping the crossings.
  ctx.fillStyle = DASH_FILL;
  for (let p = DASH_FIRST; p < TILE_PX; p += DASH_PERIOD) {
    if (p > half && p + DASH_LENGTH < far) {
      ctx.fillRect(0, p, 1, DASH_LENGTH);
      ctx.fillRect(TILE_PX - 1, p, 1, DASH_LENGTH);
      ctx.fillRect(p, 0, DASH_LENGTH, 1);
      ctx.fillRect(p, TILE_PX - 1, DASH_LENGTH, 1);
    }
  }
  // Neon kerb lines where the road meets the sidewalk.
  ctx.fillStyle = KERB_X;
  ctx.fillRect(half, 0, KERB_PX, TILE_PX);
  ctx.fillRect(far - KERB_PX, 0, KERB_PX, TILE_PX);
  ctx.fillStyle = KERB_Y;
  ctx.fillRect(0, half, TILE_PX, KERB_PX);
  ctx.fillRect(0, far - KERB_PX, TILE_PX, KERB_PX);
}

export function createCityGround({
  ratio,
  y0,
  playfieldW,
  playfieldH,
  pitch,
  block,
  length,
  loop = false,
  createCanvas = () => document.createElement('canvas'),
}) {
  // The roads repeat every `pitch` along the scroll, so a looping layout keeps its blocks between
  // the roads in every cycle only when the loop length is a whole number of pitches. A looping
  // stage whose length is not (the gallery borrows stage 1's 9300) shifts its blocks relative to
  // the roads after the first wrap; `seamAligned` says which case this is.
  const seamAligned = !loop || length % pitch === 0;
  const area = terrainWindow({ playfieldW, playfieldH });
  const width = area.xMax - area.xMin;
  const height = area.yMax - area.yMin;

  const canvas = createCanvas();
  paintTile(canvas, pitch, block);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const start = groundUv({ scroll: 0, y0, ratio, pitch, area });
  texture.repeat.set(start.repeatX, start.repeatY);

  const geometry = new THREE.PlaneGeometry(width, height);
  geometry.rotateX(-Math.PI / 2); // lie flat, facing up, v running away from the camera
  const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ map: texture }));
  mesh.name = 'city-ground-plane';
  mesh.frustumCulled = false;
  // Plane coordinates: x - W/2 across and y - H/2 down, like every other ground-layer child.
  mesh.position.set((area.xMin + area.xMax) / 2 - playfieldW / 2, 0, (area.yMin + area.yMax) / 2 - playfieldH / 2);
  const group = new THREE.Group();
  group.name = 'city-ground';
  group.add(mesh);

  function update(scroll) {
    const uv = groundUv({ scroll, y0, ratio, pitch, area });
    texture.offset.set(uv.offsetX, uv.offsetY);
  }

  update(0);
  return { group, update, texture, seamAligned, kerbColours: KERB_COLOURS };
}
