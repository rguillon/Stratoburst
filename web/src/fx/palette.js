// Every effect, weapon, pickup and scene colour in one table, so hot orange-yellow can be
// reserved for enemy bullets (D-39, VISL-05; supersedes the Phase 2 pink of D-23) by a test
// instead of by convention. Values are linear RGB; anything above 1 is HDR and blooms. Roles:
// 'bullet' (the reserved orange-yellow), 'effect', 'weapon', 'pickup', 'scene' (neon city and
// faction trim) and 'neutral' (near-grey colours that carry no hue worth protecting).
const entry = (role, r, g, b) => Object.freeze({ role, rgb: Object.freeze([r, g, b]) });

export const PALETTE = Object.freeze({
  // The enemy bullet: a hot orange-yellow halo around a white core with a near-black rim. LDR on
  // purpose (every channel <= 0.98) because bullets are drawn after bloom and must not bloom.
  ENEMY_BULLET_HALO: entry('bullet', 0.98, 0.66, 0.06),
  ENEMY_BULLET_CORE: entry('neutral', 0.98, 0.98, 0.98),
  ENEMY_BULLET_RIM: entry('neutral', 0.07, 0.05, 0.04),

  // Fire and explosions leave orange-yellow behind (D-40): white-hot core, red fire, magenta
  // embers, cyan electrical sparks.
  FIRE_CORE: entry('effect', 4.0, 3.8, 3.7),
  FIRE: entry('effect', 3.6, 0.35, 0.7),
  EMBER: entry('effect', 3.2, 0.4, 2.6),
  SPARK: entry('effect', 0.7, 3.0, 3.8),
  ENGINE: entry('effect', 3.2, 0.3, 0.5),
  BEACON_RED: entry('effect', 3.4, 0.3, 0.55),
  NAV_GREEN: entry('effect', 0.6, 3.0, 0.8),
  LIGHT_EXPLOSION: entry('effect', 1.0, 0.55, 0.9),
  BOMB_FIRE: entry('effect', 2.6, 3.4, 4.0),

  HIT_SPARK: entry('neutral', 3.0, 3.0, 3.0),
  SMOKE: entry('neutral', 0.14, 0.14, 0.17),
  DEBRIS: entry('neutral', 0.08, 0.08, 0.1),
  SCORCH: entry('neutral', 0.03, 0.03, 0.04),
  SHADOW: entry('neutral', 0.0, 0.0, 0.0),

  VULCAN_TRACER: entry('weapon', 3.2, 0.5, 1.0),
  LASER_CORE: entry('weapon', 2.4, 3.2, 4.0),
  LASER_GLOW: entry('weapon', 0.5, 1.4, 4.0),
  MISSILE: entry('weapon', 1.8, 0.9, 4.0),
  MISSILE_TRAIL: entry('weapon', 2.2, 1.2, 3.6),

  CRYSTAL_RED: entry('pickup', 3.2, 0.35, 0.8),
  CRYSTAL_BLUE: entry('pickup', 0.5, 1.4, 4.0),
  CRYSTAL_PURPLE: entry('pickup', 2.0, 0.6, 4.0),
  BOMB_PICKUP: entry('pickup', 0.8, 3.6, 0.5),
  MEDAL: entry('pickup', 2.6, 3.6, 3.8),

  // Neon city and faction trim.
  NEON_CYAN: entry('scene', 0.4, 3.2, 3.8),
  NEON_MAGENTA: entry('scene', 3.4, 0.4, 3.0),
  NEON_RED: entry('scene', 3.4, 0.25, 0.45),
  NEON_VIOLET: entry('scene', 1.6, 0.6, 3.8),
  NEON_BLUE: entry('scene', 0.5, 1.4, 3.8),
  NEON_GREEN: entry('scene', 0.6, 3.4, 1.4),
});

// Hue in degrees [0, 360). HDR colours are normalised to their largest channel first, so (4, 2, 0)
// and (1, 0.5, 0) share a hue; a colour with no spread (grey, black) has hue 0.
export function hueOf([r, g, b]) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h;
  if (max === r) h = (g - b) / d;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return (((h * 60) % 360) + 360) % 360;
}

// HSV saturation of the colour normalised to its largest channel; 0 for black and greys.
export function saturationOf([r, g, b]) {
  const max = Math.max(r, g, b);
  if (max <= 0) return 0;
  return (max - Math.min(r, g, b)) / max;
}

// Circular distance between two hues in degrees, 0..180.
export function hueDistance(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// Colours at least this saturated must keep this many degrees away from the enemy-bullet hue.
export const BULLET_EXCLUSION_DEGREES = 35;
export const BULLET_MIN_SATURATION = 0.25;
