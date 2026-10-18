import { describe, expect, it } from 'vitest';
import { SFX_TABLE } from '../../src/audio/sfx_table.js';
import { buildSamples } from '../../src/audio/zzfx_synth.js';

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

// The 18 names of the Python SfxId enum (src/scorched_core/audio/sfx_id.py), in value order.
const SFX_ID_NAMES = [
  'EXPLODE_SMALL',
  'EXPLODE_MEDIUM',
  'EXPLODE_LARGE',
  'VULCAN',
  'MISSILE',
  'HIT',
  'WEAPON_UP',
  'WEAPON_SWITCH',
  'MAX',
  'BOMB_PICKUP',
  'BOMB_LAUNCH',
  'BOMB_BLAST',
  'PLAYER_HIT',
  'DEATH',
  'RESPAWN',
  'DEATHBOMB',
  'ENEMY_FIRE',
  'LASER_HUM',
];
const ATTACK = 3;
const RELEASE = 5;

describe('SFX_TABLE covers every sound', () => {
  it('has an entry for every SfxId name and no other', () => {
    expect(Object.keys(SFX_TABLE)).toEqual(SFX_ID_NAMES);
  });

  it.each([
    ['VULCAN', 0.35, 60],
    ['MISSILE', 0.35, 80],
    ['HIT', 0.3, 40],
    ['ENEMY_FIRE', 0.2, 50],
  ])('%s is mixed quiet (volume <= %f) with a %i ms cooldown', (name, maxVolume, cooldownMs) => {
    expect(SFX_TABLE[name].volume).toBeLessThanOrEqual(maxVolume);
    expect(SFX_TABLE[name].cooldownMs).toBe(cooldownMs);
  });

  it('shots and enemy fire are quieter than every explosion and pickup', () => {
    const quiet = ['VULCAN', 'MISSILE', 'HIT', 'ENEMY_FIRE'].map((n) => SFX_TABLE[n].volume);
    const loud = ['EXPLODE_SMALL', 'EXPLODE_MEDIUM', 'EXPLODE_LARGE', 'WEAPON_UP', 'BOMB_PICKUP'].map(
      (n) => SFX_TABLE[n].volume,
    );

    expect(Math.max(...quiet)).toBeLessThan(Math.min(...loud));
  });

  it('death, bomb blast and player hit have the highest priority', () => {
    const top = ['DEATH', 'BOMB_BLAST', 'PLAYER_HIT'];
    const topMin = Math.min(...top.map((n) => SFX_TABLE[n].priority));
    const others = SFX_ID_NAMES.filter((n) => !top.includes(n));

    for (const name of others) expect(SFX_TABLE[name].priority).toBeLessThan(topMin);
  });

  it('explosions and pickups sit above the shots, hits and enemy fire', () => {
    const lowest = ['VULCAN', 'MISSILE', 'HIT', 'ENEMY_FIRE'];
    const mid = ['EXPLODE_SMALL', 'EXPLODE_MEDIUM', 'EXPLODE_LARGE', 'WEAPON_UP', 'BOMB_PICKUP'];
    const lowMax = Math.max(...lowest.map((n) => SFX_TABLE[n].priority));

    for (const name of mid) expect(SFX_TABLE[name].priority).toBeGreaterThan(lowMax);
    expect(new Set(lowest.map((n) => SFX_TABLE[n].priority)).size).toBe(1);
  });

  it('the bomb blast is the longest sound and its launch rises', () => {
    const SLIDE = 8;
    const length = (name) => SFX_TABLE[name].params[RELEASE];

    for (const name of SFX_ID_NAMES.filter((n) => n !== 'BOMB_BLAST')) {
      expect(length('BOMB_BLAST')).toBeGreaterThanOrEqual(length(name));
    }
    expect(SFX_TABLE.BOMB_LAUNCH.params[SLIDE]).toBeGreaterThan(0);
  });

  it('LASER_HUM loops without clicks: no attack and no release', () => {
    expect(SFX_TABLE.LASER_HUM.params[ATTACK]).toBe(0);
    expect(SFX_TABLE.LASER_HUM.params[RELEASE]).toBe(0);
  });
});


describe('every SFX_TABLE sound renders', () => {
  it.each(SFX_ID_NAMES)('%s synthesizes finite, audible samples', (name) => {
    const samples = buildSamples(...SFX_TABLE[name].params, { random: () => 0.5 });
    let peak = 0;
    for (const v of samples) peak = Math.max(peak, Math.abs(v));

    expect(samples.every(Number.isFinite)).toBe(true);
    expect(peak).toBeGreaterThan(0.05);
    expect(peak).toBeLessThanOrEqual(2);
  });
});
