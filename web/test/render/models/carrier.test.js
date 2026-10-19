import { describe, expect, it } from 'vitest';
import { PALETTE } from '../../../src/fx/palette.js';
import { buildCarrier } from '../../../src/render/models/carrier.js';
import {
  expectGunmetal,
  expectNoBulletHue,
  expectRedNeon,
  hasColour,
} from '../../helpers/vertex_colours.js';
import { buildJet } from '../../../src/render/models/jet.js';

const vertexCount = (geometry) => geometry.getAttribute('position').count;
const channels = (geometry) => Array.from(geometry.getAttribute('color').array);

function extent(geometry) {
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  return { x: (max.x - min.x) / 2, z: (max.z - min.z) / 2 };
}

describe('buildCarrier', () => {
  it('returns a body and a glow but no top', () => {
    const carrier = buildCarrier('mid');
    expect(carrier.body.isBufferGeometry).toBe(true);
    expect(carrier.glow.isBufferGeometry).toBe(true);
    expect(carrier.top).toBeNull();
  });

  it('has strictly fewer body vertices at each lower detail', () => {
    const high = vertexCount(buildCarrier('high').body);
    const mid = vertexCount(buildCarrier('mid').body);
    const low = vertexCount(buildCarrier('low').body);
    expect(high).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(low);
  });

  it('keeps every body colour channel below 1.0, the cargo stripe included', () => {
    for (const detail of ['high', 'mid', 'low']) {
      expect(channels(buildCarrier(detail).body).every((v) => v < 1)).toBe(true);
    }
  });

  it('has a lighter gunmetal cargo stripe: some channel above 0.25, still at most 0.3', () => {
    const body = buildCarrier('high').body;
    expect(channels(body).some((v) => v > 0.25)).toBe(true);
    expectGunmetal(body, 'carrier body');
  });

  it('has a red HDR beacon (BEACON_RED) and red engine discs in the glow, no orange-yellow', () => {
    const { glow } = buildCarrier('mid');
    expect(hasColour(glow, PALETTE.BEACON_RED.rgb)).toBe(true);
    expect(hasColour(glow, PALETTE.ENGINE.rgb)).toBe(true);
    expectRedNeon(glow, 'carrier glow');
    expectNoBulletHue(glow, 'carrier glow');
  });

  it('matches the CARRIER hitbox: half-extent between 0.8x and 1.6x the radius of 14', () => {
    const { x, z } = extent(buildCarrier('high').body);
    for (const half of [x, z]) {
      expect(half).toBeGreaterThan(11.2);
      expect(half).toBeLessThan(22.4);
    }
  });

  it('is larger than the jet, so it reads as the big one', () => {
    const carrier = extent(buildCarrier('high').body);
    const jet = extent(buildJet('high').body);
    expect(carrier.x).toBeGreaterThan(jet.x);
    expect(carrier.z).toBeGreaterThan(jet.z);
  });

  it('points its nose toward +Z', () => {
    const body = buildCarrier('high').body;
    body.computeBoundingBox();
    expect(body.boundingBox.max.z).toBeGreaterThan(12);
  });

  it('is deterministic: two builds have identical positions', () => {
    const a = buildCarrier('high');
    const b = buildCarrier('high');
    expect(Array.from(a.body.getAttribute('position').array)).toEqual(
      Array.from(b.body.getAttribute('position').array),
    );
    expect(Array.from(a.glow.getAttribute('position').array)).toEqual(
      Array.from(b.glow.getAttribute('position').array),
    );
  });
});
