import * as THREE from 'three';

// The neon-night lighting rig (D-32, D-37): a dark blue-violet sky, a cool hemisphere light, one
// moon directional light and one magenta fill, with a light FogExp2 in the sky colour. The light
// count is fixed at three and never changes after load, because adding or removing a light
// recompiles every lit shader mid-game (the Phase 2 02-19 lesson). There is no light per sign or
// per window: emissive materials and bloom carry the neon, the rig only gives the shapes form.

export const NIGHT_SKY = 0x07061a;

// FogExp2 factor 1 - exp(-(density * distance)^2): about 0.14 at 650 units, the fitted camera
// distance, so the playfield stays readable while the far terrain sinks into the sky.
export const FOG_DENSITY = 0.0006;

const HEMI_SKY = 0x5b6cff;
const HEMI_GROUND = 0x1e1a44;
const HEMI_INTENSITY = 0.95;
const MOON_COLOR = 0xc8d4ff;
const MOON_INTENSITY = 1.8;
const FILL_COLOR = 0xff3fd2;
const FILL_INTENSITY = 0.35;
const FILL_POSITION = [120, 200, -160];

// `sunPosition` keeps the old sun's place, so air-shadow displacement (shadow_instances) is
// unchanged. Returns the lights and the fog so the caller can expose them.
export function createNightRig(scene, { sunPosition = [-120, 300, 160] } = {}) {
  scene.background = new THREE.Color(NIGHT_SKY);
  const fog = new THREE.FogExp2(NIGHT_SKY, FOG_DENSITY);
  scene.fog = fog;

  const hemi = new THREE.HemisphereLight(HEMI_SKY, HEMI_GROUND, HEMI_INTENSITY);
  scene.add(hemi);

  const moon = new THREE.DirectionalLight(MOON_COLOR, MOON_INTENSITY);
  moon.position.set(...sunPosition);
  scene.add(moon);

  const fill = new THREE.DirectionalLight(FILL_COLOR, FILL_INTENSITY);
  fill.position.set(...FILL_POSITION);
  scene.add(fill);

  return { hemi, moon, fill, fog };
}
