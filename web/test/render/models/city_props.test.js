import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PALETTE } from '../../../src/fx/palette.js';
import {
  MAGLEV_SEGMENT,
  buildFire,
  buildLamp,
  buildMaglev,
  buildRunwayLight,
  buildSign,
} from '../../../src/render/models/city_props.js';
import { colours, hasColour } from '../../helpers/vertex_colours.js';

const vertexCount = (geometry) => geometry.getAttribute('position').count;

function box(geometry) {
  geometry.computeBoundingBox();
  return geometry.boundingBox;
}

const whiteKey = (geometry) => colours(geometry).every((rgb) => rgb.every((v) => v === 1));

describe('buildSign', () => {
  it('is a thin panel with a white-key glow of glyph strokes', () => {
    const { body, glow } = buildSign('high');
    const panel = box(body);
    expect(panel.max.x - panel.min.x).toBeGreaterThan(0.6);
    expect(panel.max.z - panel.min.z).toBeLessThan(0.5);
    expect(whiteKey(glow)).toBe(true);
    // The strokes sit in front of the panel (+Z faces the camera).
    expect(box(glow).max.z).toBeGreaterThan(panel.max.z - 0.02);
  });

  it('draws fewer glyph rows as the detail drops', () => {
    const high = vertexCount(buildSign('high').glow);
    const mid = vertexCount(buildSign('mid').glow);
    const low = vertexCount(buildSign('low').glow);
    expect(high).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(low);
    expect(high / 36).toBeGreaterThanOrEqual(10);
  });

  it('is made of shapes only: no text geometry, no fonts, no canvas text anywhere in the scenery code', () => {
    for (const file of ['city_props.js', 'city_buildings.js', 'scenery_models.js']) {
      const source = readFileSync(new URL(`../../../src/render/models/${file}`, import.meta.url), 'utf8');
      for (const banned of ['TextGeometry', 'FontLoader', 'fillText', 'strokeText', 'Font(']) {
        expect(source.includes(banned), `${file} uses ${banned}`).toBe(false);
      }
    }
  });
});

describe('buildMaglev', () => {
  it('has pillars under a track deck, one segment long', () => {
    const { body } = buildMaglev('high');
    const { min, max } = box(body);
    expect(min.y).toBeGreaterThanOrEqual(0);
    expect(max.y).toBeGreaterThan(0.9);
    expect(max.z - min.z).toBeCloseTo(MAGLEV_SEGMENT, 1);
    // A pillar: vertices near the ground close to the centre line.
    const position = body.getAttribute('position');
    let pillar = false;
    let deck = false;
    for (let i = 0; i < position.count; i++) {
      if (position.getY(i) < 0.05 && Math.abs(position.getX(i)) < 0.3) pillar = true;
      if (position.getY(i) > 0.9 && Math.abs(position.getX(i)) > 0.4) deck = true;
    }
    expect(pillar).toBe(true);
    expect(deck).toBe(true);
  });

  it('is exactly the authored feature spacing long, so consecutive segments meet', () => {
    // stage 1 places a maglev segment every 40 units with width 6.
    expect(MAGLEV_SEGMENT).toBeGreaterThanOrEqual(40 / 6);
    expect(MAGLEV_SEGMENT).toBeLessThan(40 / 6 + 0.1);
  });

  it('has cyan rail lights along both edges of the deck', () => {
    const { glow } = buildMaglev('high');
    expect(hasColour(glow, PALETTE.NEON_CYAN.rgb)).toBe(true);
    const position = glow.getAttribute('position');
    const color = glow.getAttribute('color');
    const sides = new Set();
    for (let i = 0; i < position.count; i++) {
      const cyan = Math.abs(color.getX(i) - PALETTE.NEON_CYAN.rgb[0]) < 1e-4;
      if (cyan && Math.abs(position.getX(i)) > 0.3) sides.add(Math.sign(position.getX(i)));
    }
    expect(sides.size).toBe(2);
  });
});

describe('buildRunwayLight', () => {
  it('is a low fixture with a white-key lens that the layer tints blue or green', () => {
    const { body, glow } = buildRunwayLight('high');
    expect(box(body).max.y).toBeLessThan(0.8);
    expect(whiteKey(glow)).toBe(true);
    expect(box(glow).max.y).toBeGreaterThan(box(body).max.y - 0.3);
  });
});

describe('buildLamp', () => {
  it('is a slim pole with a cyan lamp head at the top', () => {
    const { body, glow } = buildLamp('high');
    const pole = box(body);
    expect(pole.max.x - pole.min.x).toBeLessThan(0.7);
    expect(pole.max.y).toBeGreaterThan(0.85);
    expect(hasColour(glow, PALETTE.NEON_CYAN.rgb)).toBe(true);
    expect(box(glow).min.y).toBeGreaterThan(0.7);
  });
});

describe('buildFire', () => {
  it('is a charred ruin with every body channel very dark', () => {
    const { body } = buildFire('high');
    for (const rgb of colours(body)) expect(Math.max(...rgb)).toBeLessThanOrEqual(0.12);
  });

  it('glows with fire and ember red, with fewer embers at lower detail', () => {
    const high = buildFire('high').glow;
    expect(hasColour(high, PALETTE.FIRE.rgb)).toBe(true);
    expect(hasColour(high, PALETTE.EMBER.rgb)).toBe(true);
    expect(vertexCount(buildFire('low').glow)).toBeLessThan(vertexCount(high));
  });
});
