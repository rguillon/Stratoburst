import * as THREE from 'three';
import { mulberry32 } from './explosion_fx.js';
import { PALETTE } from './palette.js';

// The smoulder of a boss part's stump (D-14): a turret shot off the armored train leaves a stump on
// the hull that smokes and burns for the rest of the fight. The stump is an ordinary row of the
// enemies channel (stride 8, kind at slot 5), so this reads the live rows every frame and emits a
// throttled trickle of dark smoke and small flames through the particle layers (T-02-18) from every
// row whose kind is a stump kind. There is no per-stump state: one clock per effect drives a round
// of puffs from all stumps, which keeps update() allocation-free whatever happens to the row order.

const STRIDE = 8; // x, y, angle, flash, hp_frac, kind, aux, spare
const X = 0;
const Y = 1;
const KIND = 5;

const TWO_PI = Math.PI * 2;

// At particleScale 1: a smoke puff every SMOKE_INTERVAL s and a flame every FLAME_INTERVAL s, from
// every live stump, for as long as it lives.
export const SMOKE_INTERVAL = 0.14;
export const FLAME_INTERVAL = 0.22;
// A frame longer than this (a tab returning from the background) counts as this long, so a stump
// never bursts out a backlog of puffs.
export const MAX_DT = 0.25;
// The stump's ember sits about this high above the hull's own plane, so the puffs rise from it.
const STUMP_TOP = 11;
// Emitter looks, as in the wreck smoulder: HDR flame, dark smoke that rises (negative gravity).
const SMOKE_COLOR = [0.14, 0.13, 0.12];
const FLAME_COLOR = PALETTE.FIRE.rgb;
const SMOKE_GRAVITY = -0.15;

const SEED = 0x57a9b;

// Module-level scratch object: update() runs every frame and must not allocate.
const spot = new THREE.Vector3();

// The stump kind values of a manifest: the enemy kind names that end in `_STUMP`, as a Set of values.
// `kindNames` is the manifest's name -> value map.
export function stumpKindsFor(kindNames) {
  return new Set(
    Object.entries(kindNames)
      .filter(([name]) => name.endsWith('_STUMP'))
      .map(([, value]) => value),
  );
}

// `data` is the enemies channel Python assigns into and `capacity` its row capacity. `stumpKinds` and
// `groundKinds` are Sets of kind values. `layers` is `{ additive, normal }` (the particle layers),
// `getScale()` the tier's particleScale and `toWorld(x, y, ground, out)` the explosion projection (the
// ground layer's for a ground kind). `update(n, dtS)` runs every frame with the live row count and the
// effect-clock delta, which is 0 while paused or frozen in hitstop: nothing is emitted then.
export function createStumpFx({
  data,
  capacity,
  stumpKinds,
  groundKinds,
  layers,
  getScale,
  toWorld,
  rng = mulberry32(SEED),
}) {
  let smokeDue = 0; // scaled time accumulated toward the next round of puffs
  let flameDue = 0;
  let emitted = 0;

  function puffSmoke(x, y, z) {
    const angle = rng() * TWO_PI;
    const drift = 2 + rng() * 4;
    layers.normal.emit(
      x,
      y,
      z,
      Math.cos(angle) * drift,
      6 + rng() * 6,
      Math.sin(angle) * drift,
      1.2 + rng() * 0.6,
      3,
      10,
      SMOKE_COLOR[0],
      SMOKE_COLOR[1],
      SMOKE_COLOR[2],
      SMOKE_GRAVITY,
    );
    emitted += 1;
  }

  function flicker(x, y, z) {
    const angle = rng() * TWO_PI;
    const drift = 3 + rng() * 5;
    layers.additive.emit(
      x,
      y,
      z,
      Math.cos(angle) * drift,
      10 + rng() * 12,
      Math.sin(angle) * drift,
      0.3 + rng() * 0.2,
      3.5,
      1,
      FLAME_COLOR[0],
      FLAME_COLOR[1],
      FLAME_COLOR[2],
      0,
    );
    emitted += 1;
  }

  function update(n, dtS) {
    if (!(dtS > 0)) return;
    const count = Math.min(n, capacity);
    let stumps = 0;
    for (let i = 0; i < count; i++) {
      if (stumpKinds.has(data[i * STRIDE + KIND])) stumps += 1;
    }
    if (stumps === 0) {
      // Nothing smoulders, so no time is owed: the first stump starts from nothing, never a burst.
      smokeDue = 0;
      flameDue = 0;
      return;
    }
    const scaled = Math.min(dtS, MAX_DT) * getScale();
    smokeDue += scaled;
    flameDue += scaled;
    const smokeRounds = Math.floor(smokeDue / SMOKE_INTERVAL);
    const flameRounds = Math.floor(flameDue / FLAME_INTERVAL);
    smokeDue -= smokeRounds * SMOKE_INTERVAL;
    flameDue -= flameRounds * FLAME_INTERVAL;
    if (smokeRounds === 0 && flameRounds === 0) return;
    for (let i = 0; i < count; i++) {
      const base = i * STRIDE;
      const kind = data[base + KIND];
      if (!stumpKinds.has(kind)) continue;
      toWorld(data[base + X], data[base + Y], groundKinds.has(kind), spot);
      const y = spot.y + STUMP_TOP;
      for (let k = 0; k < smokeRounds; k++) puffSmoke(spot.x, y, spot.z);
      for (let k = 0; k < flameRounds; k++) flicker(spot.x, y, spot.z);
    }
  }

  return {
    update,
    // How many particles the smoulder has emitted so far (e2e reads it through the debug hooks).
    get emitted() {
      return emitted;
    },
  };
}
