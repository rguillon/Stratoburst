import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import * as THREE from 'three';

// Scene -> HDR render target -> bloom (only HDR emitters cross the threshold) -> tone map + sRGB.
// UnrealBloomPass needs renderer.toneMapping to be set; renderer_rig does that.
export function createPostPipeline(
  renderer,
  scene,
  camera,
  { strength = 0.45, radius = 0.25, threshold = 1.0 } = {},
) {
  const size = renderer.getSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(size, strength, radius, threshold);
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());

  function setSize(w, h) {
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
  }

  function render() {
    composer.render();
  }

  return { composer, bloomPass, setSize, render };
}
