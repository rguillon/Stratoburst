import { describe, expect, it } from 'vitest';
import { buildHeli } from '../../../src/render/models/heli.js';

const vertexCount = (geometry) => geometry.getAttribute('position').count;
const channels = (geometry) => Array.from(geometry.getAttribute('color').array);

function colours(geometry) {
  const color = geometry.getAttribute('color');
  return Array.from({ length: color.count }, (_, i) => [color.getX(i), color.getY(i), color.getZ(i)]);
}

describe('buildHeli', () => {
  it('returns a body, a glow and a rotor top', () => {
    const heli = buildHeli('mid');
    expect(heli.body.isBufferGeometry).toBe(true);
    expect(heli.glow.isBufferGeometry).toBe(true);
    expect(heli.top.isBufferGeometry).toBe(true);
  });

  it('has strictly fewer body vertices at each lower detail', () => {
    const high = vertexCount(buildHeli('high').body);
    const mid = vertexCount(buildHeli('mid').body);
    const low = vertexCount(buildHeli('low').body);
    expect(high).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(low);
  });

  it('keeps every body and rotor colour channel below 1.0', () => {
    for (const detail of ['high', 'mid', 'low']) {
      const { body, top } = buildHeli(detail);
      expect(channels(body).every((v) => v < 1)).toBe(true);
      expect(channels(top).every((v) => v < 1)).toBe(true);
    }
  });

  it('matches the HELI hitbox: half-extent between 0.8x and 1.6x the radius of 10', () => {
    const { body } = buildHeli('high');
    body.computeBoundingBox();
    const { min, max } = body.boundingBox;
    for (const half of [(max.x - min.x) / 2, (max.z - min.z) / 2]) {
      expect(half).toBeGreaterThan(8);
      expect(half).toBeLessThan(16);
    }
  });

  it('has a warm white and a green nav light, and never pink', () => {
    const lights = colours(buildHeli('high').glow);
    expect(lights.some(([r, g, b]) => r > 1 && g > 1 && b > 1)).toBe(true);
    expect(lights.some(([r, g, b]) => g > 1 && g > r * 2 && g > b)).toBe(true);
    expect(lights.every(([r, g, b]) => !(r > 1 && b > 1 && g < r * 0.5))).toBe(true);
  });

  it('centres the rotor on the model origin so it can spin about Y', () => {
    const { top } = buildHeli('high');
    top.computeBoundingBox();
    const { min, max } = top.boundingBox;
    expect((min.x + max.x) / 2).toBeCloseTo(0, 5);
    expect((min.z + max.z) / 2).toBeCloseTo(0, 5);
    expect(min.y).toBeGreaterThan(1);
    expect(max.x - min.x).toBeGreaterThan(15);
  });

  it('keeps the rotor above the cabin', () => {
    const heli = buildHeli('high');
    heli.body.computeBoundingBox();
    heli.top.computeBoundingBox();
    expect(heli.top.boundingBox.min.y).toBeGreaterThan(heli.body.boundingBox.min.y);
  });

  it('points its nose toward +Z with the tail boom behind', () => {
    const { body } = buildHeli('high');
    body.computeBoundingBox();
    expect(body.boundingBox.max.z).toBeGreaterThan(4);
    expect(body.boundingBox.min.z).toBeLessThan(-9);
  });

  it('is deterministic: two builds have identical positions', () => {
    const a = buildHeli('high');
    const b = buildHeli('high');
    for (const part of ['body', 'glow', 'top']) {
      expect(Array.from(a[part].getAttribute('position').array)).toEqual(
        Array.from(b[part].getAttribute('position').array),
      );
    }
  });
});
