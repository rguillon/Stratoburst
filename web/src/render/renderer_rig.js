import * as THREE from 'three';
import { createPostPipeline } from './post_pipeline.js';

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

  // Bloom pipeline; plan 01-04 adds tier-driven bypass and scaling through rig.pipeline.
  const pipeline = createPostPipeline(renderer, scene, camera);

  function toWorld(x, y, out) {
    return out.set(x - playfieldW / 2, 0, y - playfieldH / 2);
  }

  function resize() {
    const w = Math.max(1, canvas.clientWidth);
    const h = Math.max(1, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    pipeline.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function render() {
    pipeline.render();
  }

  window.addEventListener('resize', resize);
  resize();

  return { renderer, scene, camera, pipeline, toWorld, resize, render };
}
