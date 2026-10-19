import { describe, expect, it, vi } from 'vitest';
import { PALETTE } from '../../../src/fx/palette.js';
import {
  BUILDERS,
  hasScenery,
  sceneryModel,
  sceneryTint,
  warmScenery,
} from '../../../src/render/models/scenery_models.js';
import { colours, expectNoBulletHue, hasColour } from '../../helpers/vertex_colours.js';

// The nine SceneryKind names Python ships in manifest.scenery_kinds.
const KINDS = [
  'SLUM_HOUSE',
  'LOWRISE',
  'TOWER',
  'SIGN',
  'MAGLEV',
  'HANGAR',
  'RUNWAY_LIGHT',
  'FIRE',
  'LAMP',
];
const DETAILS = ['high', 'mid', 'low'];
// Kinds whose glow is white so that the instance colour (a PALETTE neon hue) sets the hue.
const KEYED = ['SIGN', 'TOWER', 'LOWRISE', 'RUNWAY_LIGHT'];

const vertexCount = (geometry) => geometry.getAttribute('position').count;
const NEON = ['NEON_CYAN', 'NEON_MAGENTA', 'NEON_RED', 'NEON_VIOLET', 'NEON_BLUE', 'NEON_GREEN'];

describe('sceneryModel', () => {
  it('has a builder for exactly the nine scenery kinds', () => {
    expect(Object.keys(BUILDERS).sort()).toEqual([...KINDS].sort());
    for (const name of KINDS) expect(hasScenery(name)).toBe(true);
    expect(hasScenery('NOPE')).toBe(false);
  });

  it('returns a cached { body, glow } for every kind at every detail', () => {
    for (const name of KINDS) {
      for (const detail of DETAILS) {
        const model = sceneryModel(name, detail);
        expect(model.body.isBufferGeometry, `${name} ${detail} body`).toBe(true);
        expect(model.glow.isBufferGeometry, `${name} ${detail} glow`).toBe(true);
        expect(sceneryModel(name, detail)).toBe(model);
      }
      expect(sceneryModel(name, 'high')).not.toBe(sceneryModel(name, 'low'));
    }
  });

  it('throws for an unknown name and treats an unknown detail as low', () => {
    expect(() => sceneryModel('PALACE', 'high')).toThrow(/unknown scenery kind PALACE/);
    expect(sceneryModel('TOWER', 'ultra')).toBe(sceneryModel('TOWER', 'low'));
  });

  it('warmScenery builds every (kind, detail) pair once and names the kinds it warmed', async () => {
    vi.resetModules();
    const fresh = await import('../../../src/render/models/scenery_models.js');
    const spies = {};
    for (const name of KINDS) {
      const real = fresh.BUILDERS[name];
      spies[name] = vi.fn(real);
      fresh.BUILDERS[name] = spies[name];
    }
    const warmed = fresh.warmScenery([...KINDS, 'NOT_A_KIND']);
    expect(warmed.sort()).toEqual([...KINDS].sort());
    for (const name of KINDS) expect(spies[name]).toHaveBeenCalledTimes(DETAILS.length);
    fresh.warmScenery(KINDS);
    for (const name of KINDS) {
      fresh.sceneryModel(name, 'mid');
      expect(spies[name]).toHaveBeenCalledTimes(DETAILS.length);
    }
  });

  it('exports warmScenery for the load sequence', () => {
    expect(warmScenery([])).toEqual([]);
  });
});

describe('every scenery model', () => {
  it('has strictly fewer body vertices at each lower detail', () => {
    for (const name of KINDS) {
      const high = vertexCount(sceneryModel(name, 'high').body);
      const mid = vertexCount(sceneryModel(name, 'mid').body);
      const low = vertexCount(sceneryModel(name, 'low').body);
      expect(high, `${name} high > mid`).toBeGreaterThan(mid);
      expect(mid, `${name} mid > low`).toBeGreaterThan(low);
    }
  });

  it('has no more glow vertices at low than at high, and fewer in total', () => {
    for (const name of KINDS) {
      const high = sceneryModel(name, 'high');
      const low = sceneryModel(name, 'low');
      expect(vertexCount(low.glow)).toBeLessThanOrEqual(vertexCount(high.glow));
      expect(vertexCount(low.body) + vertexCount(low.glow)).toBeLessThan(
        vertexCount(high.body) + vertexCount(high.glow),
      );
    }
  });

  it('keeps every body colour channel below 1.0 so only the glow can bloom', () => {
    for (const name of KINDS) {
      for (const detail of DETAILS) {
        for (const rgb of colours(sceneryModel(name, detail).body)) {
          expect(Math.max(...rgb), `${name} ${detail} ${rgb}`).toBeLessThan(1);
        }
      }
    }
  });

  it('gives every glow HDR colours: from PALETTE entries, or white where an instance colour sets the hue', () => {
    const allowed = Object.values(PALETTE).map((entry) => entry.rgb);
    for (const name of KINDS) {
      for (const detail of DETAILS) {
        const { glow } = sceneryModel(name, detail);
        const palette = colours(glow);
        if (KEYED.includes(name)) {
          expect(palette.every((rgb) => rgb.every((v) => v === 1)), `${name} ${detail} white key`).toBe(true);
        } else {
          expect(Math.max(...palette.flat()), `${name} ${detail} HDR`).toBeGreaterThan(1);
          for (const rgb of palette) {
            const known = allowed.some((entry) => entry.every((v, k) => Math.abs(v - rgb[k]) < 1e-4));
            expect(known, `${name} ${detail} ${rgb} is not a PALETTE entry`).toBe(true);
          }
        }
      }
    }
  });

  it('never uses the enemy-bullet hue', () => {
    for (const name of KINDS) {
      for (const detail of DETAILS) {
        expectNoBulletHue(sceneryModel(name, detail).body, `${name} body`);
        expectNoBulletHue(sceneryModel(name, detail).glow, `${name} glow`);
      }
    }
  });

  it('stands on y = 0 inside a unit footprint, ready to be scaled by width and height', () => {
    for (const name of KINDS) {
      for (const detail of DETAILS) {
        for (const part of ['body', 'glow']) {
          const geometry = sceneryModel(name, detail)[part];
          geometry.computeBoundingBox();
          const { min, max } = geometry.boundingBox;
          expect(min.y, `${name} ${detail} ${part} bottom`).toBeGreaterThanOrEqual(-1e-6);
          expect(max.y, `${name} ${detail} ${part} top`).toBeLessThanOrEqual(1 + 1e-6);
          expect(Math.abs(min.x) + Math.abs(max.x), `${name} ${part} x`).toBeLessThanOrEqual(1.2);
          if (name !== 'MAGLEV') {
            expect(Math.abs(min.z) + Math.abs(max.z), `${name} ${part} z`).toBeLessThanOrEqual(1.2);
          }
        }
      }
    }
  });
});

describe('sceneryTint', () => {
  it('colours SIGN, TOWER and LOWRISE glows by variant across the six NEON hues', () => {
    for (const name of ['SIGN', 'TOWER', 'LOWRISE']) {
      NEON.forEach((entry, variant) => {
        expect(sceneryTint(name, variant)).toBe(PALETTE[entry].rgb);
      });
      expect(sceneryTint(name, 6)).toBe(sceneryTint(name, 0));
    }
  });

  it('alternates the runway lights between blue and green', () => {
    expect(sceneryTint('RUNWAY_LIGHT', 0)).toBe(PALETTE.NEON_BLUE.rgb);
    expect(sceneryTint('RUNWAY_LIGHT', 1)).toBe(PALETTE.NEON_GREEN.rgb);
    expect(sceneryTint('RUNWAY_LIGHT', 2)).toBe(PALETTE.NEON_BLUE.rgb);
  });

  it('gives every other kind no tint', () => {
    for (const name of KINDS.filter((kind) => !KEYED.includes(kind))) {
      expect(sceneryTint(name, 0)).toBeNull();
    }
    expect(sceneryTint('UNKNOWN', 0)).toBeNull();
  });

  it('keeps hasColour usable on the glow of a tinted kind (white key)', () => {
    expect(hasColour(sceneryModel('SIGN', 'high').glow, [1, 1, 1])).toBe(true);
  });
});
