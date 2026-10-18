// Every effect, weapon and pickup colour in one table, so hot pink can be reserved for enemy
// bullets (D-23, VISL-05) by a test instead of by convention. Values are linear RGB; anything
// above 1 is HDR and blooms. Roles: 'bullet' (the reserved pink), 'effect', 'weapon', 'pickup'
// and 'neutral' (near-grey colours that carry no hue worth protecting).
const entry = (role, r, g, b) => Object.freeze({ role, rgb: Object.freeze([r, g, b]) });

export const PALETTE = Object.freeze({
  // The enemy bullet: a hot-pink halo around a white core with a near-black rim. LDR on purpose
  // (every channel <= 0.98) because bullets are drawn after bloom and must not bloom themselves.
  ENEMY_BULLET_HALO: entry('bullet', 0.98, 0.16, 0.62),
  ENEMY_BULLET_CORE: entry('neutral', 0.98, 0.98, 0.98),
  ENEMY_BULLET_RIM: entry('neutral', 0.1, 0.02, 0.06),

  FIRE_CORE: entry('effect', 4.0, 2.6, 1.2),
  FIRE: entry('effect', 3.4, 1.6, 0.4),
  EMBER: entry('effect', 2.6, 1.0, 0.2),
  SPARK: entry('effect', 3.2, 2.2, 0.9),
  ENGINE: entry('effect', 3.0, 1.3, 0.45),
  BEACON_AMBER: entry('effect', 3.2, 2.0, 0.3),
  NAV_GREEN: entry('effect', 0.6, 3.0, 0.8),
  LIGHT_EXPLOSION: entry('effect', 1.0, 0.62, 0.3),
  BOMB_FIRE: entry('effect', 4.0, 2.2, 0.7),

  HIT_SPARK: entry('neutral', 3.0, 3.0, 3.0),
  SMOKE: entry('neutral', 0.18, 0.16, 0.15),
  DEBRIS: entry('neutral', 0.1, 0.09, 0.08),
  SCORCH: entry('neutral', 0.04, 0.035, 0.03),
  SHADOW: entry('neutral', 0.0, 0.0, 0.0),

  VULCAN_TRACER: entry('weapon', 3.2, 2.6, 1.2),
  LASER_CORE: entry('weapon', 2.4, 3.2, 4.0),
  LASER_GLOW: entry('weapon', 0.5, 1.4, 4.0),
  MISSILE: entry('weapon', 1.8, 0.9, 4.0),
  MISSILE_TRAIL: entry('weapon', 2.2, 1.2, 3.6),

  CRYSTAL_RED: entry('pickup', 3.0, 0.7, 0.3),
  CRYSTAL_BLUE: entry('pickup', 0.5, 1.4, 4.0),
  CRYSTAL_PURPLE: entry('pickup', 2.0, 0.6, 4.0),
  BOMB_PICKUP: entry('pickup', 3.2, 2.4, 0.4),
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

// Colours at least this saturated must keep this many degrees away from the enemy-bullet pink.
export const PINK_EXCLUSION_DEGREES = 35;
export const PINK_MIN_SATURATION = 0.25;
