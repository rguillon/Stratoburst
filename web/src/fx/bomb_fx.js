import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { mulberry32 } from './explosion_fx.js';
import { bake, lathe, tint } from '../render/models/model_kit.js';

// The nuke (PLYR-07, VISL-02, D-08): the showcase for bloom and particles. Python owns the bomb (its
// phase, its centre and the progress through the phase); this module only draws it. A glowing
// missile rises from the ship (LAUNCH), then an expanding HDR fireball fills the screen (BLAST) at
// the radius Python's blast uses. The detonation event adds one big particle burst (its COUNT scales
// with the quality tier, never its size), one large light flash, one scorch mark on the terrain and a
// single bloom pulse. Nothing here is pink and nothing strobes: a detonation is exactly one rising,
// then decaying, pulse (photosensitivity, WCAG 2.3.1).

// One detonation burst at tier scale 1: [fire, smoke, sparks].
export const BURST_FIRE = 60;
export const BURST_SMOKE = 30;
export const BURST_SPARKS = 40;
// The scorch mark's diameter in plane units.
export const SCORCH_SIZE = 60;
// The bloom strength is raised to this multiple of its base at the detonation, then decays linearly
// back to the base within BLOOM_PULSE_S and is not touched again until the next detonation.
export const BLOOM_PEAK = 2.2;
export const BLOOM_PULSE_S = 0.3;
// The one large light flash: peak intensity and length in seconds (decays linearly to dark).
export const FLASH_PEAK = 14;
export const FLASH_DURATION_S = 0.6;
const FLASH_LIFT = 24;
// The fireball fades over the last share of the blast.
const FADE_SHARE = 0.2;
// Fire licks: small flames at random points inside the radius, every 50 ms of the blast.
export const LICK_CADENCE_S = 0.05;
export const LICK_COUNT = 6;
// Exhaust puffs behind the rising missile.
export const EXHAUST_CADENCE_S = 0.03;
const EXHAUST_COUNT = 3;

const MISSILE_SCALE = 2.2;
// The fireball is a dome: a sphere squashed along the vertical so it reads as a mushroom of fire seen
// from the tilted camera instead of a ball standing on the field.
const FIREBALL_HEIGHT = 0.55;
const RENDER_ORDER = 4; // above the terrain, below the playfield dim mask (5), like the particles

// The missile's profile (radius, y) with the nose at +y; it is turned to point up the screen (-z).
const MISSILE_PROFILE = [
  [0, -3.2],
  [0.9, -2.8],
  [1.1, -1.4],
  [1.1, 1.4],
  [0.7, 2.6],
  [0, 4.2],
];
const EXHAUST_PROFILE = [
  [0, -6.5],
  [0.7, -3.6],
  [1.2, -3.2],
  [0, -3.0],
];

const FIREBALL_VERTEX = `
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vec4 view = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = normalize(-view.xyz);
  gl_Position = projectionMatrix * view;
}`;

// The core faces the camera and is the hottest; the rim cools to orange. Two slow sines in the angle
// of the normal make the surface boil. The opacity uniform carries the fade; it only ever falls.
const FIREBALL_FRAGMENT = `
#define GAIN 0.4
uniform vec3 uCore;
uniform vec3 uRim;
uniform float uOpacity;
uniform float uTime;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  float facing = clamp(dot(normalize(vNormal), normalize(vView)), 0.0, 1.0);
  float boil = 1.0 + 0.06 * sin(uTime * 9.0 + vNormal.x * 7.0) + 0.04 * sin(uTime * 14.0 + vNormal.z * 9.0);
  float heat = pow(facing, 1.4);
  vec3 color = mix(uRim, uCore, heat) * boil * GAIN;
  float alpha = uOpacity * (0.18 + 0.42 * heat);
  gl_FragColor = vec4(color, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// The missile: a smooth lathe with a hot HDR exhaust cone, nose toward -z (up the screen).
function buildMissileGeometry() {
  const body = lathe(MISSILE_PROFILE, 'mid').rotateX(-Math.PI / 2);
  const exhaust = lathe(EXHAUST_PROFILE, 'mid').rotateX(-Math.PI / 2);
  return bake([tint(body, PALETTE.FIRE_CORE.rgb), tint(exhaust, PALETTE.BOMB_FIRE.rgb)], 'bomb-missile');
}

const world = new THREE.Vector3();

// `layers` are the fx particle layers; `events` / `phases` / `tuning` the manifest tables; `bloomPass`
// the composer's bloom pass (its `strength` is pulsed); `decals.add(x, y, size)` places the scorch
// and `lights.flash(x, y, z, peak, rgb, durationS)` the light. `getScale()` is the tier's particle
// scale and `toWorld(x, y, out)` places a logical point on the gameplay plane.
export function createBombFx({
  layers,
  events,
  phases,
  tuning,
  bloomPass,
  decals,
  lights,
  getScale = () => 1,
  toWorld,
  playfieldW,
  playfieldH,
  rng = mulberry32(0xb0b0b0),
}) {
  const group = new THREE.Group();
  group.name = 'bomb-fx';

  const missile = new THREE.Mesh(buildMissileGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true }));
  missile.name = 'bomb-missile';
  missile.scale.setScalar(MISSILE_SCALE);
  missile.frustumCulled = false;
  missile.visible = false;
  group.add(missile);

  const uniforms = {
    uCore: { value: new THREE.Vector3(...PALETTE.BOMB_FIRE.rgb) },
    uRim: { value: new THREE.Vector3(...PALETTE.EMBER.rgb) },
    uOpacity: { value: 1 },
    uTime: { value: 0 },
  };
  const fireball = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 16),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: FIREBALL_VERTEX,
      fragmentShader: FIREBALL_FRAGMENT,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    }),
  );
  fireball.name = 'bomb-fireball';
  fireball.frustumCulled = false;
  fireball.renderOrder = RENDER_ORDER;
  fireball.visible = false;
  group.add(fireball);

  const baseStrength = bloomPass.strength;
  const radiusMin = tuning.bomb_radius_min;
  const radiusSpan = tuning.bomb_radius_max - tuning.bomb_radius_min;
  const growShare = tuning.bomb_grow_ticks / tuning.bomb_blast_ticks;
  const halfW = playfieldW / 2;
  const halfH = playfieldH / 2;

  let shown = 0;
  let previousPhase = phases.NONE;
  let pulseAge = BLOOM_PULSE_S; // at BLOOM_PULSE_S the pulse is over
  let nextLickS = 0;
  let nextExhaustS = 0;

  // The fireball radius the Python bomb has at progress t (0..1 of the blast).
  function radiusAt(t) {
    return radiusMin + radiusSpan * Math.min(1, t / growShare);
  }

  function emit(layer, count, life, speed, size, rgb, gravity, spread) {
    const n = Math.max(1, Math.round(count * getScale()));
    for (let i = 0; i < n; i += 1) {
      const angle = rng() * Math.PI * 2;
      const v = speed[0] + (speed[1] - speed[0]) * rng();
      const l = life[0] + (life[1] - life[0]) * rng();
      layer.emit(
        world.x,
        world.y,
        world.z,
        Math.cos(angle) * v,
        v * spread * rng(),
        Math.sin(angle) * v,
        l,
        size[0],
        size[1],
        rgb[0],
        rgb[1],
        rgb[2],
        gravity,
      );
    }
  }

  function detonate(x, y) {
    toWorld(x, y, world);
    emit(layers.additive, BURST_FIRE, [0.8, 1.5], [30, 130], [12, 26], PALETTE.BOMB_FIRE.rgb, 0, 0.35);
    emit(layers.normal, BURST_SMOKE, [1.6, 2.6], [10, 45], [16, 34], PALETTE.SMOKE.rgb, -0.12, 0.5);
    emit(layers.additive, BURST_SPARKS, [0.5, 1.1], [60, 170], [3, 0.5], PALETTE.SPARK.rgb, 0.4, 0.6);
    decals.add(x, y, SCORCH_SIZE);
    lights.flash(world.x, world.y + FLASH_LIFT, world.z, FLASH_PEAK, PALETTE.LIGHT_EXPLOSION.rgb, FLASH_DURATION_S);
    pulseAge = 0;
    bloomPass.strength = baseStrength * BLOOM_PEAK;
  }

  function handle(type, x, y) {
    if (type === events.BOMB_DETONATE) detonate(x, y);
  }

  // One lick of flame at a random point inside the fireball.
  function lick(x, y, radius) {
    const angle = rng() * Math.PI * 2;
    const distance = Math.sqrt(rng()) * radius;
    toWorld(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance, world);
    emit(layers.additive, LICK_COUNT, [0.3, 0.6], [6, 22], [7, 2], PALETTE.FIRE.rgb, -0.1, 0.8);
  }

  function exhaust(x, y) {
    toWorld(x, y + 4, world);
    emit(layers.additive, EXHAUST_COUNT, [0.25, 0.4], [3, 12], [4, 0.8], PALETTE.FIRE_CORE.rgb, 0, 0.2);
  }

  function decayPulse(dt) {
    if (pulseAge >= BLOOM_PULSE_S) return;
    pulseAge += dt;
    if (pulseAge >= BLOOM_PULSE_S) {
      bloomPass.strength = baseStrength;
      return;
    }
    bloomPass.strength = baseStrength * (1 + (BLOOM_PEAK - 1) * (1 - pulseAge / BLOOM_PULSE_S));
  }

  // `phase`, `x`, `y` and `t` come straight from the header (BOMB_PHASE, BOMB_X, BOMB_Y, BOMB_T);
  // `dt` is the frame time and `timeS` the effect clock, both in seconds. Allocates nothing.
  function update(phase, x, y, t, dt, timeS) {
    decayPulse(dt);
    const launching = phase === phases.LAUNCH;
    const blasting = phase === phases.BLAST;
    missile.visible = launching;
    fireball.visible = blasting;
    if (launching) {
      missile.position.set(x - halfW, 0, y - halfH);
      if (timeS >= nextExhaustS) {
        nextExhaustS = timeS + EXHAUST_CADENCE_S;
        exhaust(x, y);
      }
    } else if (blasting) {
      if (previousPhase !== phases.BLAST) {
        shown += 1;
        nextLickS = timeS;
      }
      const radius = radiusAt(t);
      fireball.position.set(x - halfW, 0, y - halfH);
      fireball.scale.set(radius, radius * FIREBALL_HEIGHT, radius);
      uniforms.uOpacity.value = t < 1 - FADE_SHARE ? 1 : Math.max(0, (1 - t) / FADE_SHARE);
      uniforms.uTime.value = timeS;
      if (timeS >= nextLickS) {
        nextLickS = timeS + LICK_CADENCE_S;
        lick(x, y, radius);
      }
    }
    previousPhase = phase;
  }

  // Draws both parts once so their shaders compile behind the loading screen (main.js hides them).
  function showAll(visible) {
    missile.visible = visible;
    fireball.visible = visible;
    if (visible) {
      fireball.scale.set(1, 1, 1);
      uniforms.uOpacity.value = 1;
    }
  }

  return {
    group,
    handle,
    update,
    showAll,
    get shown() {
      return shown;
    },
  };
}
