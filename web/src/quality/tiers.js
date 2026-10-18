// Quality tier ladder. Presentation only: DPR, canvas pixel budget, bloom mode and the share of
// the bloom strength (retuned for the neon night, D-37; low keeps a value but runs without bloom),
// the share of each explosion's particles that is spawned (the explosion's size never changes), the
// level of detail of the procedural models, how many scorch marks are drawn, and how many of the
// pooled explosion lights may flash.
// Nothing here reaches Python, so every device plays the same simulation.

export const TIERS = Object.freeze({
  high: Object.freeze({
    name: 'high',
    dprCap: 2,
    maxPixels: 2_800_000,
    bloom: 'full',
    bloomStrength: 0.6,
    particleScale: 1,
    modelDetail: 'high',
    maxDecals: 48,
    lights: 3,
  }),
  mid: Object.freeze({
    name: 'mid',
    dprCap: 1.5,
    maxPixels: 1_200_000,
    bloom: 'half',
    bloomStrength: 0.5,
    particleScale: 0.6,
    modelDetail: 'mid',
    maxDecals: 32,
    lights: 2,
  }),
  low: Object.freeze({
    name: 'low',
    dprCap: 1,
    maxPixels: 600_000,
    bloom: 'off',
    bloomStrength: 0.5,
    particleScale: 0.35,
    modelDetail: 'low',
    maxDecals: 16,
    lights: 0,
  }),
});

// Lowest to highest; the controller steps down by moving toward index 0.
export const TIER_ORDER = Object.freeze(['low', 'mid', 'high']);

export function effectiveDpr(devicePixelRatio, tier, cssW, cssH) {
  const device = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const capped = Math.min(device, tier.dprCap);
  const area = cssW * cssH;
  if (!(area > 0)) return capped;
  return Math.min(capped, Math.sqrt(tier.maxPixels / area));
}

export function renderSize(cssW, cssH, dpr) {
  return {
    width: Math.max(1, Math.floor(cssW * dpr)),
    height: Math.max(1, Math.floor(cssH * dpr)),
  };
}

export function initialTier({ forced, touchPrimary }) {
  if (forced) return forced;
  return touchPrimary ? 'mid' : 'high';
}
