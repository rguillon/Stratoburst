import * as THREE from 'three';
import { PALETTE } from './palette.js';

// The blue laser beam (PLYR-04, D-02): two additive quads lying in the gameplay plane, a narrow
// white-hot core and a wider blue glow, running from the ship's nose to a little beyond the top of
// the playfield, plus a small flare at the muzzle. Python only publishes the half-width (0 when the
// beam is off); everything else is drawn here. All colours are HDR so the beam blooms, and none of
// them is near the reserved enemy-bullet orange-yellow (D-39).

const GLOW_FACTOR = 3.2; // the glow is this many times as wide as the core
const OVERSHOOT = 8; // units the beam runs past the top edge so it never visibly ends on screen
const MUZZLE_AHEAD = 10; // units from the ship centre to its nose (tuning.MUZZLE_AHEAD)
const FLARE_BASE = 4; // flare size at zero beam width, in units
const FLARE_PER_WIDTH = 4; // and how much it grows per unit of half-width
const RENDER_ORDER = 4; // above the terrain, below the playfield dim mask (5), like the particles

const VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// vUv.x runs across the beam, vUv.y from the nose (0) to the far end (1). The profile is brightest
// on the centre line; two slow sines flicker the intensity and ride up the beam.
const BEAM_FRAGMENT = `
uniform vec3 uColor;
uniform float uTime;
uniform float uPower;
uniform float uGain;
varying vec2 vUv;
void main() {
  float across = abs(vUv.x - 0.5) * 2.0;
  float profile = pow(max(1.0 - across, 0.0), uPower);
  float flicker = 1.0 + 0.08 * sin(uTime * 61.0 - vUv.y * 38.0) + 0.05 * sin(uTime * 23.0 + vUv.y * 11.0);
  float fadeIn = smoothstep(0.0, 0.02, vUv.y);
  gl_FragColor = vec4(uColor * uGain * flicker, profile * fadeIn);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// A round hot spot at the nose.
const FLARE_FRAGMENT = `
uniform vec3 uColor;
uniform float uTime;
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float spot = pow(max(1.0 - d, 0.0), 2.0);
  float flicker = 1.0 + 0.15 * sin(uTime * 73.0);
  gl_FragColor = vec4(uColor * 0.9 * flicker, spot);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function additiveMaterial(fragmentShader, uniforms) {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERTEX,
    fragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
  });
}

// `playfieldW` / `playfieldH` are the logical playfield size. The returned `update` takes the
// half-width Python published (0 hides the beam), the ship's logical position and the effect clock
// in seconds, and allocates nothing.
export function createBeamMesh({ playfieldW, playfieldH, muzzleAhead = MUZZLE_AHEAD }) {
  const halfPlayfieldW = playfieldW / 2;
  const halfPlayfieldH = playfieldH / 2;
  const time = { value: 0 };

  const quad = new THREE.PlaneGeometry(1, 1);
  quad.rotateX(-Math.PI / 2); // flat in the gameplay plane; uv.y grows toward the top of the screen

  const core = new THREE.Mesh(
    quad,
    additiveMaterial(BEAM_FRAGMENT, {
      uColor: { value: new THREE.Vector3(...PALETTE.LASER_CORE.rgb) },
      uTime: time,
      uPower: { value: 1.2 },
      uGain: { value: 0.42 },
    }),
  );
  const glow = new THREE.Mesh(
    quad,
    additiveMaterial(BEAM_FRAGMENT, {
      uColor: { value: new THREE.Vector3(...PALETTE.LASER_GLOW.rgb) },
      uTime: time,
      uPower: { value: 1.6 },
      uGain: { value: 0.5 },
    }),
  );
  const flare = new THREE.Mesh(
    quad,
    additiveMaterial(FLARE_FRAGMENT, {
      uColor: { value: new THREE.Vector3(...PALETTE.LASER_CORE.rgb) },
      uTime: time,
    }),
  );
  core.name = 'beam-core';
  glow.name = 'beam-glow';
  flare.name = 'beam-flare';

  const group = new THREE.Group();
  group.name = 'beam';
  group.visible = false;
  for (const mesh of [glow, core, flare]) {
    mesh.frustumCulled = false;
    mesh.renderOrder = RENDER_ORDER;
    group.add(mesh);
  }

  function update(halfW, shipX, shipY, timeS) {
    const on = halfW > 0;
    group.visible = on;
    if (!on) return;
    time.value = timeS;
    const top = -OVERSHOOT;
    const nose = shipY - muzzleAhead;
    const length = Math.max(nose - top, 0.001);
    const x = shipX - halfPlayfieldW;
    const midZ = (top + nose) / 2 - halfPlayfieldH;
    core.position.set(x, 0, midZ);
    core.scale.set(halfW * 2, 1, length);
    glow.position.set(x, 0, midZ);
    glow.scale.set(halfW * GLOW_FACTOR * 2, 1, length);
    const flareSize = FLARE_BASE + FLARE_PER_WIDTH * halfW;
    flare.position.set(x, 0, nose - halfPlayfieldH);
    flare.scale.set(flareSize, 1, flareSize);
  }

  return { group, update };
}
