// URL flag grammar (D-15). Only these parameters are read; everything else is ignored:
//   debug, stress, tier, crash (Phase 1) and the weapon test flags weapon and level.
// weapon is an allow-listed lowercase name (else null, the default); level is truncated and
// clamped to 1..5 (null when absent or not a number). Python validates both again.

export const STRESS_DEFAULT = 500;
export const STRESS_MAX = 5000;

const TIERS = new Set(['low', 'mid', 'high']);
const CRASHES = new Set(['py', 'js']);
const WEAPONS = new Set(['vulcan', 'laser', 'homing']);

export const LEVEL_MIN = 1;
export const LEVEL_MAX = 5;

function parseLevel(params) {
  if (!params.has('level')) return null;
  const parsed = Number.parseFloat(params.get('level'));
  if (!Number.isFinite(parsed)) return null;
  return Math.min(Math.max(Math.trunc(parsed), LEVEL_MIN), LEVEL_MAX);
}

function parseStress(params) {
  if (!params.has('stress')) return 0;
  const parsed = Number.parseFloat(params.get('stress'));
  if (!Number.isFinite(parsed)) return STRESS_DEFAULT;
  return Math.min(Math.max(Math.trunc(parsed), 1), STRESS_MAX);
}

function pick(params, key, allowed) {
  const value = params.get(key);
  return allowed.has(value) ? value : null;
}

export function parseUrlFlags(search) {
  const params = new URLSearchParams(search);
  return Object.freeze({
    debug: params.has('debug'),
    stress: parseStress(params),
    tier: pick(params, 'tier', TIERS),
    crash: pick(params, 'crash', CRASHES),
    weapon: pick(params, 'weapon', WEAPONS),
    level: parseLevel(params),
  });
}
