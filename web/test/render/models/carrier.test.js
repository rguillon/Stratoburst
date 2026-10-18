import { describe, expect, it } from 'vitest';
import { buildCarrier } from '../../../src/render/models/carrier.js';
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

  it('has a bright cargo stripe: some vertex colours above 0.7', () => {
    expect(channels(buildCarrier('high').body).some((v) => v > 0.7)).toBe(true);
  });

  it('has an amber HDR beacon near (3.2, 2.0, 0.3) in the glow', () => {
    const glow = buildCarrier('mid').glow;
    const color = glow.getAttribute('color');
    let found = false;
    for (let i = 0; i < color.count; i++) {
      if (
        Math.abs(color.getX(i) - 3.2) < 0.05 &&
        Math.abs(color.getY(i) - 2.0) < 0.05 &&
        Math.abs(color.getZ(i) - 0.3) < 0.05
      ) {
        found = true;
      }
    }
    expect(found).toBe(true);
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
