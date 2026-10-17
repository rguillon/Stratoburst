// Automatic quality step-down controller (skeleton: behavior lands in the GREEN commit).
export const WARMUP_MS = 0;
export const WINDOW = 0;
export const EVAL_EVERY = 0;
export const STRIKE_MS = 0;
export const STRIKES = 0;
export const MIN_GAIN = 0;
export const MIN_INTERVAL_MS = 0;

export function median() {
  return 0;
}

export function createQualityController({ initialTier, locked = false }) {
  return {
    update() {
      return { tier: initialTier, changed: false, locked, reason: null };
    },
    resetWarmup() {},
    lock() {},
    get tier() {
      return initialTier;
    },
  };
}
