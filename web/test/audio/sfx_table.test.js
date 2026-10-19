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

  it('the huge explosion is longer and lower than the large one', () => {
    const { EXPLODE_LARGE: large, EXPLODE_HUGE: huge } = SFX_TABLE;
    const FREQUENCY = 2;
    const RELEASE = 5;

    expect(huge.params[FREQUENCY]).toBeLessThan(large.params[FREQUENCY]);
    expect(huge.params[RELEASE]).toBeGreaterThan(large.params[RELEASE]);
  });

  it('explosions are noisy', () => {
    const NOISE = 13;
    for (const name of ['EXPLODE_SMALL', 'EXPLODE_MEDIUM', 'EXPLODE_LARGE', 'EXPLODE_HUGE']) {
      expect(SFX_TABLE[name].params[NOISE]).toBeGreaterThan(0);
    }
  });
});

// The 28 names of the Python SfxId enum (src/scorched_core/audio/sfx_id.py), in value order.
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
  'EXPLODE_HUGE',
  'WARNING',
  'EXTEND',
  'MEDAL',
  'PART_DESTROY',
  'BOSS_PHASE',
  'BOSS_DEFEAT',
  'TALLY_TICK',
  'STAGE_CLEAR',
  'GAME_OVER',
];
// The Phase 2 gameplay sounds (values 0-17): the stage sounds below are mixed against these.
const GAMEPLAY_NAMES = SFX_ID_NAMES.slice(0, 18);
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

  it('death, bomb blast and player hit have the highest gameplay priority', () => {
    const top = ['DEATH', 'BOMB_BLAST', 'PLAYER_HIT'];
    const topMin = Math.min(...top.map((n) => SFX_TABLE[n].priority));
    const others = GAMEPLAY_NAMES.filter((n) => !top.includes(n));

    for (const name of others) expect(SFX_TABLE[name].priority).toBeLessThan(topMin);
  });

  it('explosions and pickups sit above the shots, hits and enemy fire', () => {
    const lowest = ['VULCAN', 'MISSILE', 'HIT', 'ENEMY_FIRE'];
    const mid = ['EXPLODE_SMALL', 'EXPLODE_MEDIUM', 'EXPLODE_LARGE', 'WEAPON_UP', 'BOMB_PICKUP'];
    const lowMax = Math.max(...lowest.map((n) => SFX_TABLE[n].priority));

    for (const name of mid) expect(SFX_TABLE[name].priority).toBeGreaterThan(lowMax);
    expect(new Set(lowest.map((n) => SFX_TABLE[n].priority)).size).toBe(1);
  });

  it('the bomb blast is the longest gameplay sound and its launch rises', () => {
    const SLIDE = 8;
    const length = (name) => SFX_TABLE[name].params[RELEASE];

    for (const name of GAMEPLAY_NAMES.filter((n) => n !== 'BOMB_BLAST')) {
      expect(length('BOMB_BLAST')).toBeGreaterThanOrEqual(length(name));
    }
    expect(SFX_TABLE.BOMB_LAUNCH.params[SLIDE]).toBeGreaterThan(0);
  });

  it('LASER_HUM loops without clicks: no attack and no release', () => {
    expect(SFX_TABLE.LASER_HUM.params[ATTACK]).toBe(0);
    expect(SFX_TABLE.LASER_HUM.params[RELEASE]).toBe(0);
  });
});


describe('the stage sounds', () => {
  const FREQUENCY = 2;
  const SUSTAIN = 4;
  const RELEASE_AT = 5;
  const PITCH_JUMP = 10;
  const REPEAT_TIME = 12;
  const seconds = (name) => {
    const p = SFX_TABLE[name].params;
    return p[3] + p[SUSTAIN] + p[RELEASE_AT] + p[18] + p[16];
  };

  it('the WARNING is a two-tone siren that repeats for about a second', () => {
    const { params } = SFX_TABLE.WARNING;

    expect(params[REPEAT_TIME]).toBeGreaterThan(0);
    expect(params[PITCH_JUMP]).not.toBe(0);
    expect(seconds('WARNING')).toBeGreaterThanOrEqual(0.8);
    expect(seconds('WARNING')).toBeLessThanOrEqual(1.5);
  });

  it('the EXTEND chime rises: a positive pitch jump', () => {
    expect(SFX_TABLE.EXTEND.params[PITCH_JUMP]).toBeGreaterThan(0);
  });

  it('the boss defeat has a longer tail than the huge explosion', () => {
    expect(seconds('BOSS_DEFEAT')).toBeGreaterThan(seconds('EXPLODE_HUGE'));
  });

  it('the TALLY_TICK is a crisp tick, shorter than a quarter of a second', () => {
    expect(seconds('TALLY_TICK')).toBeLessThan(0.25);
  });

  it('the PART_DESTROY crunch is noisy and the BOSS_PHASE whoosh rises', () => {
    const NOISE = 13;
    const SLIDE = 8;

    expect(SFX_TABLE.PART_DESTROY.params[NOISE]).toBeGreaterThan(0);
    expect(SFX_TABLE.BOSS_PHASE.params[SLIDE]).toBeGreaterThan(0);
  });

  it('the GAME_OVER sting falls: a negative slide or pitch jump', () => {
    const { params } = SFX_TABLE.GAME_OVER;

    expect(Math.min(params[8], params[PITCH_JUMP])).toBeLessThan(0);
    expect(params[FREQUENCY]).toBeGreaterThan(0);
  });
});

// The least time between two voices of a sound; TALLY_LINE_TICKS is 60 steps, one second, per line.
const TALLY_LINE_MS = 1000;

describe('the stage sounds keep their place in the mix', () => {
  const BIG_MOMENTS = ['WARNING', 'EXTEND', 'BOSS_DEFEAT', 'STAGE_CLEAR', 'GAME_OVER'];

  it.each(BIG_MOMENTS)('%s has a priority strictly above every gameplay sound', (name) => {
    const loudestGameplay = Math.max(...GAMEPLAY_NAMES.map((n) => SFX_TABLE[n].priority));

    expect(SFX_TABLE[name].priority).toBeGreaterThan(loudestGameplay);
  });

  it('EXPLODE_HUGE has at least the priority of the large explosion', () => {
    expect(SFX_TABLE.EXPLODE_HUGE.priority).toBeGreaterThanOrEqual(SFX_TABLE.EXPLODE_LARGE.priority);
  });

  it('every stage sound outranks the shots, hits and enemy fire in priority', () => {
    const noise = Math.max(...['VULCAN', 'MISSILE', 'HIT', 'ENEMY_FIRE'].map((n) => SFX_TABLE[n].priority));

    for (const name of SFX_ID_NAMES.slice(18)) {
      expect(SFX_TABLE[name].priority).toBeGreaterThan(noise);
    }
  });

  it('the TALLY_TICK cooldown is below one tally line so every line ticks', () => {
    expect(SFX_TABLE.TALLY_TICK.cooldownMs).toBeLessThan(TALLY_LINE_MS);
  });

  it('two medal catches 100 ms apart both play', () => {
    expect(SFX_TABLE.MEDAL.cooldownMs).toBeLessThanOrEqual(100);
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
