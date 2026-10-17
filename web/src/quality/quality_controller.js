// Automatic quality step-down with verify-and-lock. Pure logic: no DOM, no clock reads.
// The caller supplies frame times and an explicit clock reading on every update.

import { TIER_ORDER } from './tiers.js';

export const WARMUP_MS = 2000; // ignored after start, resume and every tier change
export const WINDOW = 90; // samples in the median window
export const EVAL_EVERY = 30; // frames between evaluations once a window exists
export const STRIKE_MS = 21.5; // a median strictly above this is a strike (below ~46 fps)
export const STRIKES = 3; // consecutive strikes that step down one tier
export const MIN_GAIN = 0.1; // a step-down must improve the median by at least this fraction
export const MIN_INTERVAL_MS = 3000; // minimum time between two tier changes

const LOCK_REASON = 'refresh-capped-or-cpu-bound';

// Order-independent: sorts a copy; an even count averages the two middle values.
export function median(values) {
  const sorted = Float64Array.from(values).sort();
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function createQualityController({ initialTier, locked = false, nowMs = 0 }) {
  let tier = initialTier;
  let isLocked = locked;
  let reason = locked ? 'forced' : null;
  const ring = new Float64Array(WINDOW);
  let warmupUntil = nowMs + WARMUP_MS;
  let samples = 0; // post-warm-up samples since the last reset
  let strikes = 0;
  let lastChangeMs = Number.NEGATIVE_INFINITY;
  let medianBefore = null; // pre-change median while a verify is pending

  const result = (changed) => ({ tier, changed, locked: isLocked, reason });

  function shift(delta) {
    tier = TIER_ORDER[TIER_ORDER.indexOf(tier) + delta];
  }

  function update(dtMs, now) {
    if (isLocked) return result(false);
    if (now < warmupUntil || !(dtMs > 0) || !Number.isFinite(dtMs)) return result(false);

    ring[samples % WINDOW] = dtMs;
    samples += 1;
    if (samples < WINDOW || (samples - WINDOW) % EVAL_EVERY !== 0) return result(false);

    const current = median(ring);
    if (medianBefore !== null) {
      const gain = (medianBefore - current) / medianBefore;
      medianBefore = null;
      if (gain < MIN_GAIN) {
        // Not fill-rate bound (display cap or CPU/tick bound): undo and stop adjusting.
        shift(+1);
        isLocked = true;
        reason = LOCK_REASON;
        lastChangeMs = now;
        return result(true);
      }
    }

    strikes = current > STRIKE_MS ? Math.min(strikes + 1, STRIKES) : 0;
    if (strikes >= STRIKES && tier !== TIER_ORDER[0] && now - lastChangeMs >= MIN_INTERVAL_MS) {
      medianBefore = current;
      shift(-1);
      reason = 'step-down';
      lastChangeMs = now;
      strikes = 0;
      samples = 0;
      warmupUntil = now + WARMUP_MS;
      return result(true);
    }
    return result(false);
  }

  return {
    update,
    resetWarmup(now) {
      warmupUntil = now + WARMUP_MS;
      samples = 0;
      strikes = 0;
      // A pending verification compared against a pre-reset median would be meaningless.
      medianBefore = null;
    },
    // Pins a tier for good (for example when bloom cannot be created).
    lock(name, why) {
      tier = name;
      isLocked = true;
      reason = why;
    },
    get tier() {
      return tier;
    },
    get locked() {
      return isLocked;
    },
    get reason() {
      return reason;
    },
  };
}
