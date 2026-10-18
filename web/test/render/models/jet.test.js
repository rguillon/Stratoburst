import { describe, expect, it } from 'vitest';
import { buildJet } from '../../../src/render/models/jet.js';

const vertexCount = (geometry) => geometry.getAttribute('position').count;
const channels = (geometry) => Array.from(geometry.getAttribute('color').array);

describe('buildJet', () => {
  it('returns a body, a glow and no top', () => {
    const jet = buildJet('mid');
    expect(jet.body.isBufferGeometry).toBe(true);
    expect(jet.glow.isBufferGeometry).toBe(true);
    expect(jet.top).toBeNull();
  });

  it('has strictly fewer vertices at each lower detail', () => {
    const high = vertexCount(buildJet('high').body);
    const mid = vertexCount(buildJet('mid').body);
    const low = vertexCount(buildJet('low').body);
    expect(high).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(low);
  });

  it('keeps every body colour channel below 1.0 so a resting jet never blooms', () => {
    for (const detail of ['high', 'mid', 'low']) {
      expect(channels(buildJet(detail).body).every((v) => v < 1)).toBe(true);
    }
  });

  it('has a darker belly than back', () => {
    const { body } = buildJet('high');
    const position = body.getAttribute('position');
    const color = body.getAttribute('color');
    let lowest = 0;
    let highest = 0;
    for (let i = 0; i < position.count; i++) {
      if (position.getY(i) < position.getY(lowest)) lowest = i;
      if (position.getY(i) > position.getY(highest)) highest = i;
    }
    expect(color.getX(lowest)).toBeLessThan(color.getX(highest));
  });

  it('puts the HDR accents in the glow geometry, not the body', () => {
    const { glow } = buildJet('mid');
    expect(Math.max(...channels(glow))).toBeGreaterThan(1);
  });

  it('matches the JET hitbox: half-extent between 0.8x and 1.6x the radius of 9', () => {
    const { body } = buildJet('high');
    body.computeBoundingBox();
    const { min, max } = body.boundingBox;
    const halfWidth = (max.x - min.x) / 2;
    const halfLength = (max.z - min.z) / 2;
    for (const half of [halfWidth, halfLength]) {
      expect(half).toBeGreaterThan(7.2);
      expect(half).toBeLessThan(14.4);
    }
  });

  it('points its nose toward +Z, down the screen', () => {
    const { body } = buildJet('high');
    const position = body.getAttribute('position');
    let tip = 0;
    for (let i = 1; i < position.count; i++) if (position.getZ(i) > position.getZ(tip)) tip = i;
    expect(position.getZ(tip)).toBeGreaterThan(9);
    expect(Math.abs(position.getX(tip))).toBeLessThan(0.5);
  });

  it('puts the engine glow at the tail, behind the nose', () => {
    const { glow } = buildJet('mid');
    glow.computeBoundingBox();
    expect(glow.boundingBox.max.z).toBeLessThan(-5);
  });

  it('is deterministic: two builds have identical positions', () => {
    const a = buildJet('high');
    const b = buildJet('high');
    expect(Array.from(a.body.getAttribute('position').array)).toEqual(
      Array.from(b.body.getAttribute('position').array),
    );
    expect(Array.from(a.glow.getAttribute('position').array)).toEqual(
      Array.from(b.glow.getAttribute('position').array),
    );
  });
});
