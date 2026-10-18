import { DETAILS, normalizeDetail } from './model_kit.js';
import { buildJet } from './jet.js';
import { buildHeli } from './heli.js';
import { buildCarrier } from './carrier.js';
import { buildTank } from './tank.js';
import { buildTurret } from './turret.js';
import { buildBillboard, buildDepot, buildFuelTank, buildHouse } from './city_targets.js';

// The enemy model registry (VISL-01, D-25). Each builder takes a detail level and returns
// `{ body, glow, top }`: the lit hull, the HDR accents that bloom, and an optional part that
// turns on its own (rotor, turret head). Every (kind, detail) pair is generated once and cached,
// so a tier change swaps geometries that already exist (T-02-09).

// Kinds without a builder keep the primitive geometry of enemy_instances.js.
export const BUILDERS = {
  JET: buildJet,
  HELI: buildHeli,
  CARRIER: buildCarrier,
  TANK: buildTank,
  TURRET: buildTurret,
  // The destructible city targets (D-34), drawn in the ground layer like the other ground kinds.
  HOUSE: buildHouse,
  FUEL_TANK: buildFuelTank,
  DEPOT: buildDepot,
  BILLBOARD: buildBillboard,
};

const cache = new Map();

export function hasModel(kindName) {
  return Object.hasOwn(BUILDERS, kindName);
}

export function enemyModel(kindName, detail) {
  if (!hasModel(kindName)) throw new Error(`unknown enemy kind ${kindName}`);
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
export function warmModels(kindNames) {
  const warmed = kindNames.filter(hasModel);
  for (const name of warmed) {
    for (const detail of DETAILS) enemyModel(name, detail);
  }
  return warmed;
}
