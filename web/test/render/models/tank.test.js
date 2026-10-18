import { describe, expect, it } from 'vitest';
import { buildTank } from '../../../src/render/models/tank.js';

const vertexCount = (geometry) => geometry.getAttribute('position').count;
const channels = (geometry) => Array.from(geometry.getAttribute('color').array);

function colours(geometry) {
  const color = geometry.getAttribute('color');
  return Array.from({ length: color.count }, (_, i) => [color.getX(i), color.getY(i), color.getZ(i)]);
}

describe('buildTank', () => {
  it('returns a body, a glow and a turret top', () => {
    const tank = buildTank('mid');
    expect(tank.body.isBufferGeometry).toBe(true);
    expect(tank.glow.isBufferGeometry).toBe(true);
    expect(tank.top.isBufferGeometry).toBe(true);
  });

  it('has strictly fewer body vertices at each lower detail', () => {
    const high = vertexCount(buildTank('high').body);
    const mid = vertexCount(buildTank('mid').body);
    const low = vertexCount(buildTank('low').body);
    expect(high).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(low);
  });

  it('keeps every body and turret colour channel below 1.0', () => {
    for (const detail of ['high', 'mid', 'low']) {
      const { body, top } = buildTank(detail);
      expect(channels(body).every((v) => v < 1)).toBe(true);
      expect(channels(top).every((v) => v < 1)).toBe(true);
    }
  });

  it('matches the TANK hitbox: half-extent between 0.8x and 1.6x the radius of 11', () => {
    const { body } = buildTank('high');
    body.computeBoundingBox();
    const { min, max } = body.boundingBox;
    for (const half of [(max.x - min.x) / 2, (max.z - min.z) / 2]) {
      expect(half).toBeGreaterThan(8.8);
      expect(half).toBeLessThan(17.6);
    }
  });

  it('has HDR exhaust embers in the glow, and never pink', () => {
    const embers = colours(buildTank('high').glow);
    expect(embers.some(([r, g, b]) => r > 1 && g > 0.5 && b < r)).toBe(true);
    expect(embers.every(([r, g, b]) => !(r > 1 && b > 1 && g < r * 0.5))).toBe(true);
  });

  it('puts the embers at the rear, behind the turret ring', () => {
    const { glow } = buildTank('high');
    glow.computeBoundingBox();
    expect(glow.boundingBox.max.z).toBeLessThan(0);
  });

  it('centres the turret on the ring so it can turn about Y, with the barrel toward +Z', () => {
    const { top } = buildTank('high');
    top.computeBoundingBox();
    const { min, max } = top.boundingBox;
    expect((min.x + max.x) / 2).toBeCloseTo(0, 5);
    expect(max.z).toBeGreaterThan(10);
    expect(min.z).toBeGreaterThan(-8);
  });

  it('sits the turret on top of the hull', () => {
    const tank = buildTank('high');
    tank.body.computeBoundingBox();
    tank.top.computeBoundingBox();
    expect(tank.top.boundingBox.min.y).toBeGreaterThan(tank.body.boundingBox.min.y);
    expect(tank.top.boundingBox.max.y).toBeGreaterThan(tank.body.boundingBox.max.y);
  });

  it('is deterministic: two builds have identical positions', () => {
    const a = buildTank('high');
    const b = buildTank('high');
    for (const part of ['body', 'glow', 'top']) {
      expect(Array.from(a[part].getAttribute('position').array)).toEqual(
        Array.from(b[part].getAttribute('position').array),
      );
    }
  });
});
