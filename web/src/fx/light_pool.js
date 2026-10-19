import * as THREE from 'three';
import { PALETTE } from './palette.js';

// Explosion lights (VISL-02, RESEARCH Pattern 10). A fixed pool of PointLights created once and
// never added, removed or hidden: the point-light count is part of every lit material's shader
// program key, so changing it would recompile the scene mid-game. A flash only animates
// intensity. The quality tier changes how many pool lights may flash, never how many exist.

// Peak intensity and pulse length per blast class, and the height above the blast. Tuned on the
// high tier so lit terrain stays under the bloom threshold except near the blast core (Pitfall 5).
export const LIGHT_PEAK_MEDIUM = 3;
export const LIGHT_PEAK_LARGE = 6;
// The boss's death (D-14) is the strongest pulse in the game.
export const LIGHT_PEAK_HUGE = 10;
export const LIGHT_DURATION_MEDIUM = 0.15;
export const LIGHT_DURATION_LARGE = 0.25;
export const LIGHT_DURATION_HUGE = 0.4;
export const LIGHT_LIFT = 20;
const LIGHT_DISTANCE = 140;

// Photosensitivity (WCAG 2.3.1): no more than this many new pulses start within any window of
// FLASH_WINDOW_S seconds. A flash beyond the budget re-triggers the newest light while it is
// still lit and is dropped once it is dark, so continuous explosions never strobe.
const FLASH_BUDGET = 3;
const FLASH_WINDOW_S = 1;

const scratch = new THREE.Vector3();

// `events` and `blast` are the manifest tables; `toWorld(x, y, ground, out)` places a logical
// point in the world, on the terrain when `ground` is set.
export function createLightPool({ count = 3, events, blast, toWorld }) {
  const lights = [];
  for (let i = 0; i < count; i += 1) {
    const light = new THREE.PointLight(0xffffff, 0, LIGHT_DISTANCE, 0);
    light.name = `explosion-light-${i}`;
    light.color.setRGB(...PALETTE.LIGHT_EXPLOSION.rgb);
    lights.push(light);
  }
  const peak = new Float32Array(count);
  const duration = new Float32Array(count);
  const age = new Float32Array(count);
  const active = new Uint8Array(count);
  // Start times of the newest FLASH_BUDGET pulses, as a ring; -Infinity means "never".
  const starts = new Float64Array(FLASH_BUDGET).fill(-Infinity);
  let startCursor = 0;
  let newest = 0; // the light flashed most recently
  let cursor = 0; // the next light round-robin hands out
  let enabled = count;
  let clock = 0;
  let flashes = 0;

  function silence(i) {
    active[i] = 0;
    lights[i].intensity = 0;
  }

  // Starts a pulse of `peak` that decays linearly to exactly zero over `durationS` seconds, at the
  // world point (x, y, z). A light that is still lit restarts from the larger of its current and
  // the new peak, so it never drops to dark and jumps back up.
  function flash(x, y, z, peakIntensity, rgb, durationS) {
    if (enabled === 0) return;
    let i;
    // The oldest pulse start in the ring; if it is inside the window the budget is spent.
    if (clock - starts[startCursor] < FLASH_WINDOW_S) {
      if (active[newest] === 0) return;
      i = newest;
    } else {
      i = cursor % enabled;
      cursor = (i + 1) % enabled;
      starts[startCursor] = clock;
      startCursor = (startCursor + 1) % FLASH_BUDGET;
    }
    const light = lights[i];
    const current = active[i] === 1 ? light.intensity : 0;
    peak[i] = Math.max(current, peakIntensity);
    duration[i] = durationS;
    age[i] = 0;
    active[i] = 1;
    light.color.setRGB(rgb[0], rgb[1], rgb[2]);
    light.position.set(x, y, z);
    light.intensity = peak[i];
    newest = i;
    flashes += 1;
  }

  function pulse(x, y, ground, peakIntensity, durationS) {
    toWorld(x, y, ground, scratch);
    flash(scratch.x, scratch.y + LIGHT_LIFT, scratch.z, peakIntensity, PALETTE.LIGHT_EXPLOSION.rgb, durationS);
  }

  // Only MEDIUM, LARGE and HUGE explosions light the scene; small ones and hits do not.
  function handle(type, x, y, a, b) {
    if (type !== events.EXPLOSION) return;
    if (a === blast.HUGE) pulse(x, y, b, LIGHT_PEAK_HUGE, LIGHT_DURATION_HUGE);
    else if (a === blast.LARGE) pulse(x, y, b, LIGHT_PEAK_LARGE, LIGHT_DURATION_LARGE);
    else if (a === blast.MEDIUM) pulse(x, y, b, LIGHT_PEAK_MEDIUM, LIGHT_DURATION_MEDIUM);
  }

  // `dt` in seconds. A pulse ends at exactly zero intensity.
  function update(dt) {
    clock += dt;
    for (let i = 0; i < count; i += 1) {
      if (active[i] === 0) continue;
      age[i] += dt;
      if (age[i] >= duration[i]) silence(i);
      else lights[i].intensity = peak[i] * (1 - age[i] / duration[i]);
    }
  }

  // The tier's number of lights allowed to flash. Lights above it go dark and stay in the scene.
  function setEnabled(n) {
    enabled = Math.max(0, Math.min(Math.floor(n), count));
    for (let i = enabled; i < count; i += 1) silence(i);
    if (enabled > 0) cursor %= enabled;
    else cursor = 0;
  }

  return {
    lights,
    handle,
    flash,
    update,
    setEnabled,
    get flashes() {
      return flashes;
    },
  };
}
