import { describe, expect, it } from 'vitest';
import { SFX_TABLE } from '../../src/audio/sfx_table.js';

describe('SFX_TABLE', () => {
  it.each(Object.entries(SFX_TABLE))('%s has the full entry shape', (name, entry) => {
    expect(entry.params).toHaveLength(21);
    expect(entry.params.every(Number.isFinite)).toBe(true);
    expect(entry.volume).toBeGreaterThan(0);
    expect(entry.volume).toBeLessThanOrEqual(1);
    expect(entry.cooldownMs).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(entry.priority)).toBe(true);
    expect(name).toMatch(/^[A-Z_]+$/);
  });

  it('larger explosions are longer and lower', () => {
    const { EXPLODE_SMALL: small, EXPLODE_MEDIUM: medium, EXPLODE_LARGE: large } = SFX_TABLE;
    const FREQUENCY = 2;
    const RELEASE = 5;

    expect(medium.params[FREQUENCY]).toBeLessThan(small.params[FREQUENCY]);
    expect(large.params[FREQUENCY]).toBeLessThan(medium.params[FREQUENCY]);
    expect(medium.params[RELEASE]).toBeGreaterThan(small.params[RELEASE]);
    expect(large.params[RELEASE]).toBeGreaterThan(medium.params[RELEASE]);
  });

  it('explosions are noisy', () => {
    const NOISE = 13;
    for (const name of ['EXPLODE_SMALL', 'EXPLODE_MEDIUM', 'EXPLODE_LARGE']) {
      expect(SFX_TABLE[name].params[NOISE]).toBeGreaterThan(0);
    }
  });
});
