import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import * as THREE from 'three';
import { ScaledBloomPass } from '../quality/scaled_bloom_pass.js';

const BLOOM_SCALE = { full: 1, half: 0.5 };

// Scene -> HDR render target -> bloom (only HDR emitters cross the threshold) -> [bullets] ->
// tone map + sRGB. The optional bullet pass redraws `bulletScene` over the bloomed frame (depth
// cleared, colour kept), so fire and explosion bloom can never wash over enemy bullets.
// UnrealBloomPass needs renderer.toneMapping to be set; renderer_rig does that.
// A tier either scales the bloom chain ('full' / 'half') or bypasses the composer ('off').
export function createPostPipeline(
  renderer,
  scene,
  camera,
  { strength = 0.45, radius = 0.25, threshold = 1.0, bulletScene = null } = {},
) {
  const size = renderer.getSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer);
  const scenePass = new RenderPass(scene, camera);
  scenePass.name = 'scene';
  composer.addPass(scenePass);
  const bloomPass = new ScaledBloomPass(size, strength, radius, threshold);
  bloomPass.name = 'bloom';
  composer.addPass(bloomPass);
  if (bulletScene) {
    const bulletPass = new RenderPass(bulletScene, camera);
    bulletPass.name = 'bullets';
    bulletPass.clear = false;
    bulletPass.clearDepth = true;
    composer.addPass(bulletPass);
  }
  const outputPass = new OutputPass();
  outputPass.name = 'output';
  composer.addPass(outputPass);
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

  // The pass order, front to back, for the debug hooks and tests.
  function passNames() {
    return composer.passes.map((pass) => pass.name);
  }

  return {
    composer,
    bloomPass,
    setPixelRatio,
    setSize,
    setTier,
    render,
    passNames,
    get enabled() {
      return enabled;
    },
  };
}
