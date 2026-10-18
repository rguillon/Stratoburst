import { describe, expect, it } from 'vitest';
import { STRESS_DEFAULT, STRESS_MAX, parseUrlFlags } from '../../src/boot/url_flags.js';

describe('parseUrlFlags', () => {
  it('returns defaults for an empty query', () => {
    expect(parseUrlFlags('')).toEqual({
      debug: false,
      stress: 0,
      tier: null,
      crash: null,
      weapon: null,
      level: null,
    });
  });

  it('detects debug as a bare flag', () => {
    expect(parseUrlFlags('?debug').debug).toBe(true);
  });

  it.each(['?stress', '?stress=', '?stress=abc'])('%s uses the default stress', (query) => {
    expect(parseUrlFlags(query).stress).toBe(STRESS_DEFAULT);
    expect(STRESS_DEFAULT).toBe(500);
  });

  it.each([
    ['?stress=0', 1],
    ['?stress=1', 1],
    ['?stress=750', 750],
    ['?stress=99999', STRESS_MAX],
    ['?stress=12.7', 12],
  ])('%s gives stress %i', (query, expected) => {
    expect(parseUrlFlags(query).stress).toBe(expected);
  });

  it('accepts only the tier enumeration', () => {
    expect(parseUrlFlags('?tier=mid').tier).toBe('mid');
    expect(parseUrlFlags('?tier=ultra').tier).toBeNull();
  });

  it('accepts only the crash enumeration', () => {
    expect(parseUrlFlags('?crash=py').crash).toBe('py');
    expect(parseUrlFlags('?crash=js').crash).toBe('js');
    expect(parseUrlFlags('?crash=%3Cscript%3E').crash).toBeNull();
  });

  it.each([
    ['?weapon=vulcan', 'vulcan'],
    ['?weapon=laser', 'laser'],
    ['?weapon=homing', 'homing'],
    ['?weapon=LASER', null],
    ['?weapon=plasma', null],
    ['?weapon=', null],
    ['', null],
  ])('%s gives weapon %s', (query, expected) => {
    expect(parseUrlFlags(query).weapon).toBe(expected);
  });

  it.each([
    ['?level=3', 3],
    ['?level=1', 1],
    ['?level=5', 5],
    ['?level=0', 1],
    ['?level=-4', 1],
    ['?level=9', 5],
    ['?level=2.9', 2],
    ['?level=abc', null],
    ['?level=', null],
    ['?level=Infinity', null],
    ['', null],
  ])('%s gives level %s', (query, expected) => {
    expect(parseUrlFlags(query).level).toBe(expected);
  });

  it('ignores unknown parameters', () => {
    expect(parseUrlFlags('?evil=1&debug')).toEqual({
      debug: true,
      stress: 0,
      tier: null,
      crash: null,
      weapon: null,
      level: null,
    });
  });

  it('returns a frozen object', () => {
    expect(Object.isFrozen(parseUrlFlags(''))).toBe(true);
  });
});
