import * as THREE from 'three';
import { createPostPipeline } from './post_pipeline.js';
import { TIERS, effectiveDpr, renderSize } from '../quality/tiers.js';
import { CAMERA_FOV_DEG, CAMERA_TILT_DEG, applyCameraFit, fitCamera } from './camera_fit.js';
import { createPlayfieldMask } from './playfield_mask.js';
import { createTerrainRing } from './terrain_ring.js';
import { createGroundLayer } from './ground_layer.js';
import { createNightRig } from './night_rig.js';

export { CAMERA_FOV_DEG, CAMERA_TILT_DEG };

export function createRendererRig(canvas, { playfieldW, playfieldH }) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  // Neon night (D-32): three fixed lights and light fog. The moon sits where the sun used to, so
  // rig.sun (read by the air shadows) keeps its position.
  const night = createNightRig(scene);

  // Procedural terrain below the gameplay plane; Python's scroll drives it from main.js.
  // Albedo stays far below 1.0 so only HDR emitters (bullets) cross the bloom threshold.
  const terrain = createTerrainRing({ seed: 1 });
  scene.add(terrain.group);

  // Terrain-anchored visuals (ground units, wrecks) live in this ray-compensating group so they
  // are drawn where the bolts on the gameplay plane visibly hit them (D-21).
  const groundLayer = createGroundLayer({ playfieldW, playfieldH });
  scene.add(groundLayer.group);

  // Fixed orientation (D-08, D-09); resize refits only the distance and the look-at target.
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEG, 1, 10, 4000);
  scene.add(createPlayfieldMask({ halfW: playfieldW / 2, halfH: playfieldH / 2 }));

  // Enemy bullets live in their own scene, drawn after bloom (composer) or after the main scene with
  // a depth clear (low tier), so fire and bloom never wash over them (D-23).
  const bulletScene = new THREE.Scene();

  // Bloom pipeline; the quality tier scales or bypasses it through rig.applyTier.
  const pipeline = createPostPipeline(renderer, scene, camera, { bulletScene });

  function toWorld(x, y, out) {
    return out.set(x - playfieldW / 2, 0, y - playfieldH / 2);
  }

  const rig = {
    renderer,
    scene,
    bulletScene,
    sun: night.moon,
    night,
    camera,
    pipeline,
    terrain,
    groundLayer,
    toWorld,
    bloomAvailable: true,
    tier: TIERS.high,
    dpr: 1,
    pixels: { width: 1, height: 1 },
  };
  let applied = { dpr: 0, width: 0, height: 0 };
  let fitted = { cssW: 0, cssH: 0 };
  let resizeQueued = false;

  // Reallocates only when the integer backing size or the DPR changes (Pitfall 10).
  function applyTier(tier) {
    rig.tier = tier;
    const cssW = Math.max(1, canvas.clientWidth);
    const cssH = Math.max(1, canvas.clientHeight);
    const dpr = effectiveDpr(globalThis.devicePixelRatio, tier, cssW, cssH);
    const target = renderSize(cssW, cssH, dpr);
    if (dpr !== applied.dpr || target.width !== applied.width || target.height !== applied.height) {
      renderer.setPixelRatio(dpr);
      renderer.setSize(cssW, cssH, false);
      pipeline.setPixelRatio(dpr);
      pipeline.setSize(cssW, cssH);
      applied = { dpr, width: target.width, height: target.height };
      rig.dpr = dpr;
      rig.pixels = target;
    }
    // Refit only when the integer CSS size changed (a hiding address bar changes it; a tier
    // change does not).
    if (cssW !== fitted.cssW || cssH !== fitted.cssH) {
      camera.aspect = cssW / cssH;
      applyCameraFit(camera, fitCamera({ aspect: camera.aspect, halfW: playfieldW / 2, halfH: playfieldH / 2 }));
      fitted = { cssW, cssH };
      groundLayer.refit(camera);
    }
    pipeline.setTier(tier);
  }

  function resize() {
    applyTier(rig.tier);
  }

  // Coalesces resize storms (window and visualViewport) into one reallocation per frame.
  function queueResize() {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => {
      resizeQueued = false;
      resize();
    });
  }

  // The direct path draws the bullet scene over the main one: depth is cleared, colour is kept.
  function renderDirect() {
    renderer.render(scene, camera);
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(bulletScene, camera);
    renderer.autoClear = true;
  }

  function render() {
    if (pipeline.enabled) pipeline.render();
    else renderDirect();
  }

  // Compiles shaders and pushes one frame through both render paths at load, so a tier
  // switch never pays a first-use compile. Without half-float render targets the bloom
  // chain cannot work: report it and let the caller degrade to the low tier (Assumption A12).
  function prewarm() {
    renderer.compile(scene, camera);
    renderer.compile(bulletScene, camera);
    renderDirect();
    try {
      const halfFloat =
        renderer.extensions.has('EXT_color_buffer_float') ||
        renderer.extensions.has('EXT_color_buffer_half_float');
      if (!halfFloat) throw new Error('half-float render targets unsupported');
      pipeline.render();
    } catch {
      rig.bloomAvailable = false;
    }
  }

  window.addEventListener('resize', queueResize);
  window.visualViewport?.addEventListener('resize', queueResize);
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(queueResize).observe(canvas.parentElement ?? canvas);
  }

  Object.assign(rig, { resize, applyTier, render, prewarm });
  applyTier(rig.tier);
  return rig;
}
