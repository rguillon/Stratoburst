import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PALETTE } from '../../../src/fx/palette.js';
import {
  CITY_TARGET_KINDS,
  buildBillboard,
  buildDepot,
  buildFuelTank,
  buildHouse,
  buildRubble,
} from '../../../src/render/models/city_targets.js';
import { colours, expectGunmetal, expectNoBulletHue, hasColour } from '../../helpers/vertex_colours.js';

const vertexCount = (geometry) => geometry.getAttribute('position').count;
const DETAILS = ['high', 'mid', 'low'];
const BUILDERS = {
  house: buildHouse,
  fuelTank: buildFuelTank,
  depot: buildDepot,
  billboard: buildBillboard,
};

function box(geometry) {
  geometry.computeBoundingBox();
  return geometry.boundingBox;
}

const NEON_KEYS = ['NEON_CYAN', 'NEON_MAGENTA', 'NEON_RED', 'NEON_VIOLET', 'NEON_BLUE', 'NEON_GREEN'];

describe.each(Object.entries(BUILDERS))('%s', (name, build) => {
  it.each(DETAILS)('returns a body, a glow and no top at %s detail', (detail) => {
    const model = build(detail);
    expect(model.body.isBufferGeometry).toBe(true);
    expect(model.glow.isBufferGeometry).toBe(true);
    expect(model.top).toBeNull();
    expect(vertexCount(model.body)).toBeGreaterThan(0);
    expect(vertexCount(model.glow)).toBeGreaterThan(0);
  });

  it('has strictly fewer body vertices at each lower detail', () => {
    const high = vertexCount(build('high').body);
    const mid = vertexCount(build('mid').body);
    const low = vertexCount(build('low').body);
    expect(high).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(low);
  });

  it('keeps the body dark gunmetal, every channel below 1.0, so only the trim blooms', () => {
    for (const detail of DETAILS) {
      const { body } = build(detail);
      expect(colours(body).every((rgb) => rgb.every((v) => v < 1))).toBe(true);
      expectGunmetal(body, `${name} body`);
    }
  });

  it('paints the glow only with PALETTE neon entries and never in the bullet hue', () => {
    const { glow } = build('high');
    const neon = NEON_KEYS.filter((key) => hasColour(glow, PALETTE[key].rgb));
    expect(neon.length).toBeGreaterThan(0);
    for (const rgb of colours(glow)) {
      const known = NEON_KEYS.some((key) => rgb.every((v, k) => Math.abs(v - PALETTE[key].rgb[k]) < 1e-4));
      expect(known, `${name} glow colour ${rgb}`).toBe(true);
    }
    expectNoBulletHue(glow, `${name} glow`);
  });

  it('stands on the ground with its footprint inside about twice the hitbox radius', () => {
    const { min, max } = box(build('high').body);
    expect(min.y).toBeGreaterThanOrEqual(-1e-6);
    expect(max.y).toBeGreaterThan(5);
    expect(max.x - min.x).toBeLessThan(40);
    expect(max.z - min.z).toBeLessThan(40);
  });

  it('is deterministic: two builds have identical positions', () => {
    const a = build('mid');
    const b = build('mid');
    for (const part of ['body', 'glow']) {
      expect(Array.from(a[part].getAttribute('position').array)).toEqual(
        Array.from(b[part].getAttribute('position').array),
      );
    }
  });
});

describe('CITY_TARGET_KINDS', () => {
  it('names the four city targets, each with a registered builder', () => {
    expect(CITY_TARGET_KINDS).toEqual(['HOUSE', 'FUEL_TANK', 'DEPOT', 'BILLBOARD']);
    expect(Object.keys(BUILDERS)).toHaveLength(CITY_TARGET_KINDS.length);
  });
});

describe('buildHouse', () => {
  it('trims the roof edge in violet', () => {
    expect(hasColour(buildHouse('high').glow, PALETTE.NEON_VIOLET.rgb)).toBe(true);
  });
});

describe('buildFuelTank', () => {
  it('is banded in cyan', () => {
    expect(hasColour(buildFuelTank('high').glow, PALETTE.NEON_CYAN.rgb)).toBe(true);
  });
});

describe('buildDepot', () => {
  it('has magenta door strips', () => {
    expect(hasColour(buildDepot('high').glow, PALETTE.NEON_MAGENTA.rgb)).toBe(true);
  });

  it('is a wide shed, wider than it is deep', () => {
    const { min, max } = box(buildDepot('high').body);
    expect(max.x - min.x).toBeGreaterThan(max.z - min.z);
  });
});

describe('buildBillboard', () => {
  it('is a panel of glyph blocks held up on posts, with a glow made of many small blocks', () => {
    const { body, glow } = buildBillboard('high');
    const posts = box(body);
    expect(posts.max.y).toBeGreaterThan(14);
    // Glyph blocks: a dozen or more boxes of 36 vertices each.
    expect(vertexCount(glow) / 36).toBeGreaterThanOrEqual(12);
  });

  it('draws fewer glyph blocks as the detail drops', () => {
    const high = vertexCount(buildBillboard('high').glow);
    const mid = vertexCount(buildBillboard('mid').glow);
    const low = vertexCount(buildBillboard('low').glow);
    expect(high).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(low);
  });

  it('is shapes only: no text geometry, fonts or canvas text', () => {
    const source = readFileSync(new URL('../../../src/render/models/city_targets.js', import.meta.url), 'utf8');
    for (const banned of ['TextGeometry', 'FontLoader', 'fillText', 'strokeText', 'Font(']) {
      expect(source.includes(banned), `city_targets.js uses ${banned}`).toBe(false);
    }
  });
});

describe('buildRubble', () => {
  it('is a low charred pile that is not an intact building', () => {
    const rubble = buildRubble();
    const { min, max } = box(rubble);
    expect(rubble.isBufferGeometry).toBe(true);
    expect(vertexCount(rubble)).toBeGreaterThan(0);
    expect(min.y).toBeGreaterThanOrEqual(-1e-6);
    expect(max.y).toBeLessThan(6);
    expect(max.x - min.x).toBeGreaterThan(10);
    const house = box(buildHouse('low').body);
    expect(max.y).toBeLessThan(house.max.y / 2);
  });

  it('is dark and deterministic', () => {
    expectGunmetal(buildRubble(), 'rubble');
    expect(Array.from(buildRubble().getAttribute('position').array)).toEqual(
      Array.from(buildRubble().getAttribute('position').array),
    );
  });
});
