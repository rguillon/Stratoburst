import { describe, expect, it } from 'vitest';
import { PALETTE } from '../../../src/fx/palette.js';
import { buildTurret } from '../../../src/render/models/turret.js';
import {
  expectGunmetal,
  expectNoBulletHue,
  expectRedNeon,
  hasColour,
} from '../../helpers/vertex_colours.js';

const vertexCount = (geometry) => geometry.getAttribute('position').count;
const channels = (geometry) => Array.from(geometry.getAttribute('color').array);

function colours(geometry) {
  const color = geometry.getAttribute('color');
  return Array.from({ length: color.count }, (_, i) => [color.getX(i), color.getY(i), color.getZ(i)]);
}

describe('buildTurret', () => {
  it('returns a body, a glow and a gun top', () => {
    const turret = buildTurret('mid');
    expect(turret.body.isBufferGeometry).toBe(true);
    expect(turret.glow.isBufferGeometry).toBe(true);
    expect(turret.top.isBufferGeometry).toBe(true);
  });

  it('has strictly fewer body vertices at each lower detail', () => {
    const high = vertexCount(buildTurret('high').body);
    const mid = vertexCount(buildTurret('mid').body);
    const low = vertexCount(buildTurret('low').body);
    expect(high).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(low);
  });

  it('has strictly fewer gun vertices at each lower detail', () => {
    const high = vertexCount(buildTurret('high').top);
    const mid = vertexCount(buildTurret('mid').top);
    const low = vertexCount(buildTurret('low').top);
    expect(high).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(low);
  });

  it('keeps every body and gun colour channel below 1.0', () => {
    for (const detail of ['high', 'mid', 'low']) {
      const { body, top } = buildTurret(detail);
      expect(channels(body).every((v) => v < 1)).toBe(true);
      expect(channels(top).every((v) => v < 1)).toBe(true);
    }
  });

  it('matches the TURRET hitbox: half-extent between 0.8x and 1.6x the radius of 10', () => {
    const { body } = buildTurret('high');
    body.computeBoundingBox();
    const { min, max } = body.boundingBox;
    for (const half of [(max.x - min.x) / 2, (max.z - min.z) / 2]) {
      expect(half).toBeGreaterThan(8);
      expect(half).toBeLessThan(16);
    }
  });

  it('has a green HDR status light, and never pink', () => {
    const lights = colours(buildTurret('high').glow);
    expect(lights.some(([r, g, b]) => g > 1 && g > r * 2 && g > b)).toBe(true);
    expect(lights.every(([r, g, b]) => !(r > 1 && b > 1 && g < r * 0.5))).toBe(true);
  });

  it('is dark gunmetal in the base and the gun, with red neon beside the green status light', () => {
    const { body, top, glow } = buildTurret('high');
    expectGunmetal(body, 'turret body');
    expectGunmetal(top, 'turret gun');
    expectRedNeon(glow, 'turret glow');
    expect(hasColour(glow, PALETTE.NEON_RED.rgb)).toBe(true);
    expectNoBulletHue(glow, 'turret glow');
  });

  it('centres the gun on the pedestal axis so it can turn about Y, with both barrels toward +Z', () => {
    const { top } = buildTurret('high');
    top.computeBoundingBox();
    const { min, max } = top.boundingBox;
    expect((min.x + max.x) / 2).toBeCloseTo(0, 5);
    expect(max.x - min.x).toBeGreaterThan(2.5); // twin barrels side by side
    expect(max.z).toBeGreaterThan(8);
    expect(min.z).toBeGreaterThan(-6);
  });

  it('mounts the gun above the base plate', () => {
    const turret = buildTurret('high');
    turret.body.computeBoundingBox();
    turret.top.computeBoundingBox();
    expect(turret.top.boundingBox.min.y).toBeGreaterThan(turret.body.boundingBox.min.y);
    expect(turret.top.boundingBox.max.y).toBeGreaterThan(turret.body.boundingBox.max.y);
  });

  it('is deterministic: two builds have identical positions', () => {
    const a = buildTurret('high');
    const b = buildTurret('high');
    for (const part of ['body', 'glow', 'top']) {
      expect(Array.from(a[part].getAttribute('position').array)).toEqual(
        Array.from(b[part].getAttribute('position').array),
      );
    }
  });
});
