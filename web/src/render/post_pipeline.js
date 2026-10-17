import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import * as THREE from 'three';
import { ScaledBloomPass } from '../quality/scaled_bloom_pass.js';

const BLOOM_SCALE = { full: 1, half: 0.5 };

// Scene -> HDR render target -> bloom (only HDR emitters cross the threshold) -> tone map + sRGB.
// UnrealBloomPass needs renderer.toneMapping to be set; renderer_rig does that.
// A tier either scales the bloom chain ('full' / 'half') or bypasses the composer ('off').
export function createPostPipeline(
  renderer,
  scene,
  camera,
  { strength = 0.45, radius = 0.25, threshold = 1.0 } = {},
) {
  const size = renderer.getSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new ScaledBloomPass(size, strength, radius, threshold);
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
  let enabled = true;

  function setPixelRatio(ratio) {
    composer.setPixelRatio(ratio);
  }

  function setSize(w, h) {
    composer.setSize(w, h);
  }

  function setTier(tier) {
    enabled = tier.bloom !== 'off';
    if (enabled) bloomPass.setScale(BLOOM_SCALE[tier.bloom]);
  }

  function render() {
    composer.render();
  }

  return {
    composer,
    bloomPass,
    setPixelRatio,
    setSize,
    setTier,
    render,
    get enabled() {
      return enabled;
    },
  };
}
