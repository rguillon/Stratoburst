import { describe, expect, it } from 'vitest';
import {
  TIER_ORDER,
  TIERS,
  effectiveDpr,
  initialTier,
  renderSize,
} from '../../src/quality/tiers.js';

describe('TIERS', () => {
  it('is the frozen ladder high / mid / low', () => {
    expect(TIERS.high).toEqual({
      name: 'high',
      dprCap: 2,
      maxPixels: 2_800_000,
      bloom: 'full',
      particleScale: 1,
      modelDetail: 'high',
      maxDecals: 48,
      lights: 3,
    });
    expect(TIERS.mid).toEqual({
      name: 'mid',
      dprCap: 1.5,
      maxPixels: 1_200_000,
      bloom: 'half',
      particleScale: 0.6,
      modelDetail: 'mid',
      maxDecals: 32,
      lights: 2,
    });
    expect(TIERS.low).toEqual({
      name: 'low',
      dprCap: 1,
      maxPixels: 600_000,
      bloom: 'off',
      particleScale: 0.35,
      modelDetail: 'low',
      maxDecals: 16,
      lights: 0,
    });
    expect(Object.isFrozen(TIERS)).toBe(true);
    expect(TIER_ORDER).toEqual(['low', 'mid', 'high']);
  });
});

describe('effectiveDpr', () => {
  it('caps a DPR 3 phone at the tier cap', () => {
    expect(effectiveDpr(3, TIERS.high, 390, 844)).toBe(2);
    expect(effectiveDpr(3, TIERS.mid, 390, 844)).toBe(1.5);
  });

  it('shrinks the DPR below 1 on a 4K canvas to respect the pixel budget', () => {
    expect(effectiveDpr(1, TIERS.high, 3840, 2160)).toBeCloseTo(0.581, 3);
  });

  it('guards a zero-area canvas', () => {
    expect(effectiveDpr(2, TIERS.high, 0, 0)).toBe(2);
    expect(effectiveDpr(2, TIERS.high, 0, 500)).toBe(2);
  });

  it('treats a missing or invalid devicePixelRatio as 1', () => {
    expect(effectiveDpr(undefined, TIERS.high, 400, 400)).toBe(1);
    expect(effectiveDpr(0, TIERS.high, 400, 400)).toBe(1);
  });
});

describe('renderSize', () => {
  it('floors each axis of css * dpr', () => {
    expect(renderSize(391, 844, 1.5)).toEqual({ width: 586, height: 1266 });
  });

  it('never goes below one pixel', () => {
    expect(renderSize(0.2, 0.2, 1)).toEqual({ width: 1, height: 1 });
  });
});

describe('initialTier', () => {
  it('lets a forced tier win', () => {
    expect(initialTier({ forced: 'low', touchPrimary: false })).toBe('low');
    expect(initialTier({ forced: 'high', touchPrimary: true })).toBe('high');
  });

  it('starts touch-primary devices at mid', () => {
    expect(initialTier({ forced: null, touchPrimary: true })).toBe('mid');
  });

  it('starts everything else at high', () => {
    expect(initialTier({ forced: null, touchPrimary: false })).toBe('high');
  });
});
