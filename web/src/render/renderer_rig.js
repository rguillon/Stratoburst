import * as THREE from 'three';
import { createPostPipeline } from './post_pipeline.js';
import { TIERS, effectiveDpr, renderSize } from '../quality/tiers.js';

export const CAMERA_TILT_DEG = 25; // from vertical, camera on the near (+Z) side (D-08)
export const CAMERA_FOV_DEG = 30;
const CAMERA_DISTANCE = 700; // fixed in the skeleton; plan 01-05 replaces this with a fit

export function createRendererRig(canvas, { playfieldW, playfieldH }) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0a09);
  scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x3a2a1a, 1.2));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.2);
  sun.position.set(-120, 300, 160);
  scene.add(sun);

  // Stand-in ground; plan 01-05 replaces it with terrain. Albedo stays far below 1.0 so only
  // HDR emitters (bullets) cross the bloom threshold.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(playfieldW, playfieldH),
    new THREE.MeshLambertMaterial({ color: 0x3a352c }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1;
  scene.add(ground);

  const camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEG, 1, 10, 4000);
  const tilt = THREE.MathUtils.degToRad(CAMERA_TILT_DEG);
  camera.position.set(0, Math.cos(tilt) * CAMERA_DISTANCE, Math.sin(tilt) * CAMERA_DISTANCE);
  camera.lookAt(0, 0, 0);

  // Bloom pipeline; the quality tier scales or bypasses it through rig.applyTier.
  const pipeline = createPostPipeline(renderer, scene, camera);

  function toWorld(x, y, out) {
    return out.set(x - playfieldW / 2, 0, y - playfieldH / 2);
  }

  const rig = {
    renderer,
    scene,
    camera,
    pipeline,
    toWorld,
    bloomAvailable: true,
    tier: TIERS.high,
    dpr: 1,
    pixels: { width: 1, height: 1 },
  };
  let applied = { dpr: 0, width: 0, height: 0 };
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
    camera.aspect = cssW / cssH;
    camera.updateProjectionMatrix();
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

  function render() {
    if (pipeline.enabled) pipeline.render();
    else renderer.render(scene, camera);
  }

  // Compiles shaders and pushes one frame through both render paths at load, so a tier
  // switch never pays a first-use compile. Without half-float render targets the bloom
  // chain cannot work: report it and let the caller degrade to the low tier (Assumption A12).
  function prewarm() {
    renderer.compile(scene, camera);
    renderer.render(scene, camera);
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

  Object.assign(rig, { resize, applyTier, render, prewarm });
  applyTier(rig.tier);
  return rig;
}
