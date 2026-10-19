import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { cityY, terrainWindow } from '../../src/render/city_layer.js';
import { createCityGround, groundUv } from '../../src/render/city_ground.js';

const W = 240;
const H = 320;
const RATIO = 0.94;
const Y0 = -40;
const PITCH = 80;
const BLOCK = 64;
const area = terrainWindow({ playfieldW: W, playfieldH: H });

// A canvas stand-in that records what is painted: node has no DOM.
function fakeCanvas() {
  const fills = [];
  let style = '';
  const ctx = {
    set fillStyle(value) {
      style = value;
    },
    get fillStyle() {
      return style;
    },
    fillRect: (...rect) => fills.push({ style, rect }),
  };
  const canvas = { width: 0, height: 0, getContext: () => ctx, fills };
  return canvas;
}

function build(extra = {}) {
  const canvas = fakeCanvas();
  const ground = createCityGround({
    ratio: RATIO,
    y0: Y0,
    playfieldW: W,
    playfieldH: H,
    pitch: PITCH,
    block: BLOCK,
    length: 8640,
    loop: false,
    createCanvas: () => canvas,
    ...extra,
  });
  return { ground, canvas };
}

const frac = (value) => value - Math.floor(value);
// Distance from the nearest integer.
const offInteger = (value) => Math.abs(value - Math.round(value));

// The texture coordinate (in tiles) a logical point gets, from the plane's UV and the texture
// transform: t = uv * repeat + offset.
function tiles(uv, x, y) {
  const u = (x - area.xMin) / (area.xMax - area.xMin);
  const v = 0.5 - (y - (area.yMin + area.yMax) / 2) / (area.yMax - area.yMin);
  return { u: u * uv.repeatX + uv.offsetX, v: v * uv.repeatY + uv.offsetY };
}

function hexOf(style) {
  const digits = style.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16) / 255);
}

describe('groundUv', () => {
  const base = { y0: Y0, ratio: RATIO, pitch: PITCH, area };

  it('repeats the tile once per pitch across and once per pitch * ratio down', () => {
    const uv = groundUv({ ...base, scroll: 0 });
    expect(uv.repeatX).toBeCloseTo((area.xMax - area.xMin) / PITCH, 12);
    expect(uv.repeatY).toBeCloseTo((area.yMax - area.yMin) / (PITCH * RATIO), 12);
  });

  it('puts the lanes on x = 80 * c and on y = cityY(scroll, 80 * n) for every scroll', () => {
    for (const scroll of [0, 13.3, 80, 1234.5, 8639.9, 99999.9]) {
      const uv = groundUv({ ...base, scroll });
      for (let n = -3; n <= 12; n++) {
        const y = cityY(scroll, PITCH * n, Y0, RATIO);
        expect(offInteger(tiles(uv, 0, y).v), `scroll ${scroll} row ${n}`).toBeLessThan(1e-6);
        // Halfway between two roads is the middle of a block.
        const mid = cityY(scroll, PITCH * n + PITCH / 2, Y0, RATIO);
        expect(Math.abs(frac(tiles(uv, 0, mid).v) - 0.5)).toBeLessThan(1e-6);
      }
      for (let c = -3; c <= 5; c++) {
        expect(offInteger(tiles(uv, PITCH * c, 0).u), `column ${c}`).toBeLessThan(1e-6);
        expect(Math.abs(frac(tiles(uv, PITCH * c + PITCH / 2, 0).u) - 0.5)).toBeLessThan(1e-6);
      }
    }
  });

  it('keeps the offsets small however long the session runs (base-relative)', () => {
    for (const scroll of [0, 1e4, 1e6, 1e8]) {
      const uv = groundUv({ ...base, scroll });
      expect(uv.offsetY).toBeGreaterThanOrEqual(0);
      expect(uv.offsetY).toBeLessThan(1);
      expect(uv.offsetX).toBeGreaterThanOrEqual(0);
      expect(uv.offsetX).toBeLessThan(1);
    }
  });

  it('moves a road down the screen at the ground ratio as the scroll grows', () => {
    const a = groundUv({ ...base, scroll: 100 });
    const b = groundUv({ ...base, scroll: 110 });
    // The same texture row is 10 * ratio logical units further down: the offsets differ by 10 / pitch.
    expect(frac(b.offsetY - a.offsetY + 1)).toBeCloseTo(10 / PITCH, 9);
  });
});

describe('createCityGround', () => {
  it('draws one plane that covers the same window as the city layer', () => {
    const { ground } = build();
    expect(ground.group.name).toBe('city-ground');
    expect(ground.group.children).toHaveLength(1);
    const mesh = ground.group.children[0];
    mesh.geometry.computeBoundingBox();
    const { min, max } = mesh.geometry.boundingBox;
    // Plane coordinates: x - W/2 across and y - H/2 down (mesh position carries the centre).
    expect(mesh.position.x + min.x).toBeLessThanOrEqual(area.xMin - W / 2 + 1e-6);
    expect(mesh.position.x + max.x).toBeGreaterThanOrEqual(area.xMax - W / 2 - 1e-6);
    expect(mesh.position.z + min.z).toBeLessThanOrEqual(area.yMin - H / 2 + 1e-6);
    expect(mesh.position.z + max.z).toBeGreaterThanOrEqual(area.yMax - H / 2 - 1e-6);
    expect(mesh.position.y).toBe(0);
    expect(min.y).toBeCloseTo(0, 9);
    expect(max.y).toBeCloseTo(0, 9);
    // It lies flat, facing up.
    const normal = mesh.geometry.getAttribute('normal');
    expect(normal.getY(0)).toBeCloseTo(1, 6);
  });

  it('scrolls by the texture offset only, through the same mapping as the city layer', () => {
    const { ground } = build();
    const texture = ground.texture;
    const mesh = ground.group.children[0];
    const where = mesh.position.clone();
    for (const scroll of [0, 55.5, 4000, 123456.7]) {
      ground.update(scroll);
      const uv = groundUv({ y0: Y0, ratio: RATIO, pitch: PITCH, area, scroll });
      expect(texture.offset.x).toBeCloseTo(uv.offsetX, 12);
      expect(texture.offset.y).toBeCloseTo(uv.offsetY, 12);
      expect(texture.repeat.x).toBeCloseTo(uv.repeatX, 12);
      expect(texture.repeat.y).toBeCloseTo(uv.repeatY, 12);
      expect(mesh.position.equals(where)).toBe(true);
    }
  });

  it('is a dark lit asphalt surface: albedo below 1.0 everywhere except the LDR kerb lines', () => {
    const { ground, canvas } = build();
    const mesh = ground.group.children[0];
    expect(mesh.material.isMeshLambertMaterial).toBe(true);
    expect(Math.max(mesh.material.color.r, mesh.material.color.g, mesh.material.color.b)).toBeLessThanOrEqual(1);
    expect(mesh.material.map).toBe(ground.texture);
    expect(ground.texture.wrapS).toBe(THREE.RepeatWrapping);
    expect(ground.texture.wrapT).toBe(THREE.RepeatWrapping);
    expect(ground.texture.colorSpace).toBe(THREE.SRGBColorSpace);
    const kerb = ground.kerbColours;
    expect(kerb.length).toBeGreaterThan(0);
    for (const { style } of canvas.fills) {
      const rgb = hexOf(style);
      if (kerb.includes(style)) {
        expect(Math.max(...rgb)).toBeLessThanOrEqual(1);
      } else {
        expect(Math.max(...rgb), `${style} is not a dark surface colour`).toBeLessThan(0.35);
      }
    }
  });

  it('paints roads of width pitch - block along the tile edges with kerb lines at their sides', () => {
    const { canvas } = build();
    const size = canvas.width;
    expect(size).toBe(256);
    const roadHalf = (size * (PITCH - BLOCK)) / PITCH / 2;
    const widths = canvas.fills.map((fill) => fill.rect[2]);
    expect(widths.some((w) => Math.abs(w - roadHalf) < 1e-9)).toBe(true);
    // A kerb line sits on the sidewalk edge of the road, one for each side of each axis.
    const kerbRects = canvas.fills.filter((fill) => fill.rect[2] <= 3 || fill.rect[3] <= 3);
    const atEdge = kerbRects.filter(
      (fill) =>
        Math.abs(fill.rect[0] - roadHalf) < 2.5 ||
        Math.abs(fill.rect[0] - (size - roadHalf)) < 2.5 ||
        Math.abs(fill.rect[1] - roadHalf) < 2.5 ||
        Math.abs(fill.rect[1] - (size - roadHalf)) < 2.5,
    );
    expect(atEdge.length).toBeGreaterThanOrEqual(4);
  });

  it('reports whether a loop seam keeps the blocks between the roads', () => {
    expect(build({ loop: false, length: 9300 }).ground.seamAligned).toBe(true);
    expect(build({ loop: true, length: 8640 }).ground.seamAligned).toBe(true);
    // stage 1's length (the gallery loops it) is not a whole number of pitches: the first wrap shifts the blocks.
    expect(build({ loop: true, length: 9300 }).ground.seamAligned).toBe(false);
  });
});
