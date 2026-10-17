// URL flag grammar (D-15). Only these four parameters are read; everything else is ignored.

export const STRESS_DEFAULT = 500;
export const STRESS_MAX = 5000;

const TIERS = new Set(['low', 'mid', 'high']);
const CRASHES = new Set(['py', 'js']);

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
  });
}
