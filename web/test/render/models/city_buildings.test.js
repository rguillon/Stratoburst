import { describe, expect, it } from 'vitest';
import { PALETTE } from '../../../src/fx/palette.js';
import {
  boxPart,
  buildHangar,
  buildLowrise,
  buildSlumHouse,
  buildTower,
} from '../../../src/render/models/city_buildings.js';
import { colours, hasColour } from '../../helpers/vertex_colours.js';

const vertexCount = (geometry) => geometry.getAttribute('position').count;

function box(geometry) {
  geometry.computeBoundingBox();
  return geometry.boundingBox;
}

describe('boxPart', () => {
  it('is a sharp box at low detail and a rounded box above it', () => {
    const low = boxPart('low', [1, 1, 1], [0, 0.5, 0], [0.1, 0.1, 0.1]);
    const mid = boxPart('mid', [1, 1, 1], [0, 0.5, 0], [0.1, 0.1, 0.1]);
    const high = boxPart('high', [1, 1, 1], [0, 0.5, 0], [0.1, 0.1, 0.1]);
    expect(vertexCount(high)).toBeGreaterThan(vertexCount(mid));
    expect(vertexCount(mid)).toBeGreaterThan(vertexCount(low));
  });

  it('is centred where it is asked to be, sized as asked, and tinted', () => {
    const part = boxPart('low', [2, 4, 6], [1, 2, 3], [0.2, 0.3, 0.4]);
    const { min, max } = box(part);
    expect([min.x, min.y, min.z]).toEqual([0, 0, 0]);
    expect([max.x, max.y, max.z]).toEqual([2, 4, 6]);
    expect(hasColour(part, [0.2, 0.3, 0.4])).toBe(true);
  });
});

describe('buildSlumHouse', () => {
  it('is a low house with a pitched roof and violet and blue lit windows', () => {
    const { body, glow } = buildSlumHouse('high');
    expect(box(body).max.y).toBeGreaterThan(0.8);
    expect(hasColour(glow, PALETTE.NEON_VIOLET.rgb)).toBe(true);
    expect(hasColour(glow, PALETTE.NEON_BLUE.rgb)).toBe(true);
  });

  it('lights fewer windows at low detail', () => {
    expect(vertexCount(buildSlumHouse('low').glow)).toBeLessThan(vertexCount(buildSlumHouse('high').glow));
  });
});

describe('buildLowrise', () => {
  it('has a roof slab and trim and window bands in a white-key glow', () => {
    const { body, glow } = buildLowrise('high');
    expect(box(body).max.y).toBeGreaterThan(0.9);
    expect(colours(glow).every((rgb) => rgb.every((v) => v === 1))).toBe(true);
    expect(vertexCount(buildLowrise('mid').glow)).toBeLessThan(vertexCount(glow));
    expect(vertexCount(buildLowrise('low').glow)).toBeLessThan(vertexCount(buildLowrise('mid').glow));
  });
});

describe('buildTower', () => {
  it('is a stepped tower that reaches the top of the unit height', () => {
    const { body } = buildTower('high');
    const { min, max } = box(body);
    expect(min.y).toBeGreaterThanOrEqual(0);
    expect(max.y).toBeGreaterThan(0.95);
    expect(max.y).toBeLessThanOrEqual(1 + 1e-6);
  });

  it('carries lit window strips: many thin glow boxes that shrink in number with the detail', () => {
    const high = buildTower('high').glow;
    const mid = buildTower('mid').glow;
    const low = buildTower('low').glow;
    // 36 vertices per box, a strip each.
    expect(vertexCount(high) / 36).toBeGreaterThanOrEqual(12);
    expect(vertexCount(mid)).toBeLessThan(vertexCount(high));
    expect(vertexCount(low)).toBeLessThan(vertexCount(mid));
    expect(colours(high).every((rgb) => rgb.every((v) => v === 1))).toBe(true);
    // The strips sit on the faces: some reach the front of the base.
    expect(box(high).max.z).toBeGreaterThan(0.45);
  });
});

describe('buildHangar', () => {
  it('has an arched roof over the walls and a dark door', () => {
    const { body } = buildHangar('high');
    const { max } = box(body);
    expect(max.y).toBeGreaterThan(0.9);
    expect(max.y).toBeLessThanOrEqual(1 + 1e-6);
  });

  it('has red and white beacons and a cyan neon ridge in the glow', () => {
    const { glow } = buildHangar('high');
    expect(hasColour(glow, PALETTE.BEACON_RED.rgb)).toBe(true);
    expect(hasColour(glow, PALETTE.HIT_SPARK.rgb)).toBe(true);
    expect(hasColour(glow, PALETTE.NEON_CYAN.rgb)).toBe(true);
  });
});
