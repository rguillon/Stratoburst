import * as THREE from 'three';
import { mulberry32 } from './explosion_fx.js';
import { PALETTE } from './palette.js';

// Fire and smoke plumes over the burning ruins (D-33, D-36). The city layer lists the burning ruins
// in view each frame (logical x, y pairs); this turns them into a throttled trickle of flames and
// dark smoke through the existing GPU particle layers (T-02-18). Nothing is simulated here or in
// Python: a particle is a spawn record, and its motion and fade run in the vertex shader. Like the
// wreck and stump smoulder, one clock per effect drives a round of puffs from every visible fire,
// so update() allocates nothing whatever the number of fires, and the effect-clock delta it is fed is
// 0 while the game is paused or frozen in hitstop, so a plume holds still with every other effect.

const TWO_PI = Math.PI * 2;

// At particleScale 1: a smoke puff every SMOKE_INTERVAL s and a flame every FLAME_INTERVAL s from
// every visible fire.
export const SMOKE_INTERVAL = 0.16;
export const FLAME_INTERVAL = 0.11;
// A frame longer than this (a tab returning from the background) counts as this long, so a plume
// never bursts out a backlog of puffs.
export const MAX_DT = 0.25;
// The plume starts this far above the terrain point of the ruin.
const PLUME_BASE = 2;
// Emitter looks: HDR flame in the palette fire colour, dark smoke that rises (negative gravity).
const SMOKE_COLOR = PALETTE.SMOKE.rgb;
const FLAME_COLOR = PALETTE.FIRE.rgb;
const SMOKE_GRAVITY = -0.2;

const SEED = 0x9f1a3;

// Module-level scratch object: update() runs every frame and must not allocate.
const spot = new THREE.Vector3();

// `layers` is `{ additive, normal }` (the particle layers), `getScale()` the tier's particleScale
// and `toWorld(x, y, out)` the ground layer's projection of a logical point. `getDrift()` is the
// speed the ground is moving at along +z in world units per second, so a puff rides with the
// terrain it came from instead of being left behind (0 when the ground is still).
// `update(positions, count, dtS)` takes the city layer's fire buffer and the number of live pairs.
export function createFirePlumes({
  layers,
  getScale,
  toWorld,
  getDrift = () => 0,
  rng = mulberry32(SEED),
}) {
  let enabled = true;
  let smokeDue = 0; // scaled time accumulated toward the next round of puffs
  let flameDue = 0;
  let emitted = 0;

  function puffSmoke(x, y, z, drift) {
    const angle = rng() * TWO_PI;
    const spread = 2 + rng() * 3;
    layers.normal.emit(
      x,
      y,
      z,
      Math.cos(angle) * spread,
      9 + rng() * 6,
      drift + Math.sin(angle) * spread,
      1.8 + rng() * 0.8,
      3,
      13,
      SMOKE_COLOR[0],
      SMOKE_COLOR[1],
      SMOKE_COLOR[2],
      SMOKE_GRAVITY,
    );
    emitted += 1;
  }

  function flicker(x, y, z, drift) {
    const angle = rng() * TWO_PI;
    const spread = 2 + rng() * 3;
    layers.additive.emit(
      x,
      y,
      z,
      Math.cos(angle) * spread,
      14 + rng() * 10,
      drift + Math.sin(angle) * spread,
      0.4 + rng() * 0.3,
      3.5,
      1,
      FLAME_COLOR[0],
      FLAME_COLOR[1],
      FLAME_COLOR[2],
      0,
    );
    emitted += 1;
  }

  function update(positions, count, dtS) {
    if (!enabled || count <= 0) {
      // Nothing burns in view (or nothing may), so no time is owed: the next fire starts from
      // nothing, never a burst.
      smokeDue = 0;
      flameDue = 0;
      return;
    }
    if (!(dtS > 0)) return; // frozen in hitstop or paused (or not a number): nothing moves
    const scaled = Math.min(dtS, MAX_DT) * getScale();
    smokeDue += scaled;
    flameDue += scaled;
    const smokeRounds = Math.floor(smokeDue / SMOKE_INTERVAL);
    const flameRounds = Math.floor(flameDue / FLAME_INTERVAL);
    smokeDue -= smokeRounds * SMOKE_INTERVAL;
    flameDue -= flameRounds * FLAME_INTERVAL;
    if (smokeRounds === 0 && flameRounds === 0) return;
    const drift = getDrift();
    for (let i = 0; i < count; i++) {
      toWorld(positions[i * 2], positions[i * 2 + 1], spot);
      const y = spot.y + PLUME_BASE;
      for (let k = 0; k < smokeRounds; k++) puffSmoke(spot.x, y, spot.z, drift);
      for (let k = 0; k < flameRounds; k++) flicker(spot.x, y, spot.z, drift);
    }
  }

  // The quality tier: off sheds the whole effect and owes it no time when it comes back.
  function setEnabled(on) {
    enabled = Boolean(on);
    if (!enabled) {
      smokeDue = 0;
      flameDue = 0;
    }
  }

  return {
    update,
    setEnabled,
    // How many particles the plumes have emitted so far (e2e reads it through the debug hooks).
    get emitted() {
      return emitted;
    },
  };
}
