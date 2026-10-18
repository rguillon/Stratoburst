// URL flag grammar (D-15). Only these parameters are read; everything else is ignored:
//   debug, stress, tier, crash (Phase 1), the weapon test flags weapon and level, god
// (presence only; the ship ignores hits so automated runs are never disturbed) and bombs.
// gallery (presence only) brings back the Phase 2 shooting gallery: stage 1 is the default game.
// lives (the starting ships) is truncated and clamped to 1..9, null when absent or not a number.
// at (midboss or boss, allow-listed, else null) starts stage 1 just before that marker; Python
// validates it again and ignores it in the gallery.
// weapon is an allow-listed lowercase name (else null, the default); level is truncated and
// clamped to 1..5 and bombs (the starting stock) to 0..7, both null when absent or not a number.
// Python validates all four again.

export const STRESS_DEFAULT = 500;
export const STRESS_MAX = 5000;

const TIERS = new Set(['low', 'mid', 'high']);
const CRASHES = new Set(['py', 'js']);
const WEAPONS = new Set(['vulcan', 'laser', 'homing']);
const AT_MARKERS = new Set(['midboss', 'boss']);

export const LEVEL_MIN = 1;
export const LEVEL_MAX = 5;
export const BOMBS_MIN = 0;
export const BOMBS_MAX = 7;
export const LIVES_MIN = 1;
export const LIVES_MAX = 9;

function parseLevel(params) {
  if (!params.has('level')) return null;
  const parsed = Number.parseFloat(params.get('level'));
  if (!Number.isFinite(parsed)) return null;
  return Math.min(Math.max(Math.trunc(parsed), LEVEL_MIN), LEVEL_MAX);
}

function parseBombs(params) {
  if (!params.has('bombs')) return null;
  const parsed = Number.parseFloat(params.get('bombs'));
  if (!Number.isFinite(parsed)) return null;
  return Math.min(Math.max(Math.trunc(parsed), BOMBS_MIN), BOMBS_MAX);
}

function parseLives(params) {
  if (!params.has('lives')) return null;
  const parsed = Number.parseFloat(params.get('lives'));
  if (!Number.isFinite(parsed)) return null;
  return Math.min(Math.max(Math.trunc(parsed), LIVES_MIN), LIVES_MAX);
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
    god: params.has('god'),
    bombs: parseBombs(params),
    lives: parseLives(params),
    gallery: params.has('gallery'),
    at: pick(params, 'at', AT_MARKERS),
  });
}
