import { mulberry32 } from './explosion_fx.js';

// Screen shake (VISL-04, D-26, D-27): a decaying positional jitter on the camera, applied only around
// the render call. Python never sees it: gameplay coordinates, the fixed camera framing, the touch
// mapping and the debug projections all read the camera between frames, when it is back where the
// fit put it. Only the biggest events shake (a bomb detonation and the ship's death); ordinary hits
// and kills never do (ROADMAP Phase 2 criterion 5).

// Amplitude in world units and length in seconds. Tunable.
export const SHAKE_BOMB = Object.freeze({ amplitude: 3.0, durationS: 0.5 });
export const SHAKE_DEATH = Object.freeze({ amplitude: 1.6, durationS: 0.35 });
// Hard ceilings, so no trigger can exceed the comfort limits whatever it asks for.
export const MAX_AMPLITUDE = 3.0;
export const MAX_DURATION_S = 0.5;

const SEED = 0x5ac4e;

// `events` is the manifest event table. `rng` is render-local and seeded, so a replay of the visuals is
// deterministic and the simulation's own random stream is never touched.
export function createShake({ events, rng = mulberry32(SEED) }) {
  let amplitude = 0;
  let durationS = 0;
  let age = 0;
  let active = false;
  let count = 0;
  let x = 0;
  let z = 0;

  // The strength left right now: a quadratic decay from 1 at the trigger to exactly 0 at the end.
  function envelope() {
    const left = 1 - age / durationS;
    return left * left;
  }

  // A new shake replaces the current one unless the current one is still the stronger.
  function trigger(newAmplitude, newDurationS) {
    if (!(newAmplitude > 0) || !(newDurationS > 0)) return;
    const a = Math.min(newAmplitude, MAX_AMPLITUDE);
    count += 1;
    if (active && a < amplitude * envelope()) return;
    amplitude = a;
    durationS = Math.min(newDurationS, MAX_DURATION_S);
    age = 0;
    active = true;
  }

  // Ages the shake by `dt` seconds and picks this frame's jitter. A dt of 0 (paused) holds both the
  // age and the jitter exactly where they are.
  function update(dt) {
    if (!active || dt <= 0) return;
    age += dt;
    if (age >= durationS) {
      active = false;
      age = 0;
      x = 0;
      z = 0;
      return;
    }
    const radius = amplitude * envelope();
    const angle = rng() * Math.PI * 2;
    x = Math.cos(angle) * radius;
    z = Math.sin(angle) * radius;
  }

  // Writes the current camera offset (world x and z) into `out` and returns it. Allocates nothing.
  function offset(out) {
    out.x = x;
    out.z = z;
    return out;
  }

  // Only the two big events shake. Every other kind (hits, kills, shots, pickups, enemy fire) is
  // deliberately ignored, so ordinary action stays smooth.
  function handle(type) {
    if (type === events.BOMB_DETONATE) trigger(SHAKE_BOMB.amplitude, SHAKE_BOMB.durationS);
    else if (type === events.PLAYER_DEATH) trigger(SHAKE_DEATH.amplitude, SHAKE_DEATH.durationS);
  }

  return {
    trigger,
    update,
    offset,
    handle,
    get active() {
      return active;
    },
    get count() {
      return count;
    },
  };
}

// The seconds the effect clock (particles, trails, wreck smoke, beam flicker, rotors) advances this
// frame. It stands still during hitstop and while paused, so nothing jitters in a freeze and effects
// continue from where they stopped after a resume. `state` is `{ paused, hitstop }`; callers reuse one
// object so the frame loop allocates nothing.
export function effectClockDelta(dtMs, state) {
  return state.paused || state.hitstop ? 0 : dtMs / 1000;
}

// Calls `render()` with the camera moved by `offset` ({ x, z }) and puts it back afterwards, even when
// the render throws, so the shake can never leak into the camera the rest of the game reads.
export function withCameraOffset(camera, offset, render) {
  const { x, y, z } = camera.position;
  camera.position.set(x + offset.x, y, z + offset.z);
  camera.updateMatrixWorld();
  try {
    render();
  } finally {
    camera.position.set(x, y, z);
    camera.updateMatrixWorld();
  }
}
