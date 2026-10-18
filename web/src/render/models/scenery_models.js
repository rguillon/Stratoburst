import { PALETTE } from '../../fx/palette.js';
import { DETAILS, normalizeDetail } from './model_kit.js';
import { buildHangar, buildLowrise, buildSlumHouse, buildTower } from './city_buildings.js';
import { buildFire, buildLamp, buildMaglev, buildRunwayLight, buildSign } from './city_props.js';

// The scenery model registry (D-34, VISL-01), keyed by the SceneryKind names Python ships in
// manifest.scenery_kinds. Each builder takes a detail level and returns `{ body, glow }`; every
// (kind, detail) pair is generated once and cached, so a tier change swaps geometries that already
// exist (T-02-09), exactly like the enemy models.
export const BUILDERS = {
  SLUM_HOUSE: buildSlumHouse,
  LOWRISE: buildLowrise,
  TOWER: buildTower,
  SIGN: buildSign,
  MAGLEV: buildMaglev,
  HANGAR: buildHangar,
  RUNWAY_LIGHT: buildRunwayLight,
  FIRE: buildFire,
  LAMP: buildLamp,
};

const cache = new Map();

export function hasScenery(kindName) {
  return Object.hasOwn(BUILDERS, kindName);
}

export function sceneryModel(kindName, detail) {
  if (!hasScenery(kindName)) throw new Error(`unknown scenery kind ${kindName}`);
  const level = normalizeDetail(detail);
  const key = `${kindName}:${level}`;
  let model = cache.get(key);
  if (model === undefined) {
    model = BUILDERS[kindName](level);
    cache.set(key, model);
  }
  return model;
}

// Builds every detail of every kind that has a builder, at load, and returns the names it warmed.
export function warmScenery(kindNames) {
  const warmed = kindNames.filter(hasScenery);
  for (const name of warmed) {
    for (const detail of DETAILS) sceneryModel(name, detail);
  }
  return warmed;
}

// Instance colour for the glow of kinds whose model glow is white: the placement's variant picks a
// PALETTE neon hue. Python draws a sign's, a tower's and a low-rise's variant from six hues
// (city_builder.NEON_HUES) and alternates the runway lights between two. `null` means the kind has
// no tint. The returned arrays are the PALETTE's own, so choosing a tint allocates nothing.
const NEON_HUES = Object.freeze([
  PALETTE.NEON_CYAN.rgb,
  PALETTE.NEON_MAGENTA.rgb,
  PALETTE.NEON_RED.rgb,
  PALETTE.NEON_VIOLET.rgb,
  PALETTE.NEON_BLUE.rgb,
  PALETTE.NEON_GREEN.rgb,
]);
const RUNWAY_HUES = Object.freeze([PALETTE.NEON_BLUE.rgb, PALETTE.NEON_GREEN.rgb]);
const TINTS = {
  SIGN: NEON_HUES,
  TOWER: NEON_HUES,
  LOWRISE: NEON_HUES,
  RUNWAY_LIGHT: RUNWAY_HUES,
};

export function sceneryTint(kindName, variant) {
  if (!Object.hasOwn(TINTS, kindName)) return null;
  const hues = TINTS[kindName];
  return hues[variant % hues.length];
}
