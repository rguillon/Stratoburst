import { installErrorPanel } from './boot/error_panel.js';
import { parseUrlFlags } from './boot/url_flags.js';
import { PYODIDE_VERSION, loadRuntime } from './boot/runtime_loader.js';
import { startGame } from './python/python_bridge.js';
import { createFrameLoop } from './loop/frame_loop.js';
import { createKeyboardInput } from './input/keyboard_input.js';
import { createTouchInput } from './input/touch_input.js';
import { createInputSampler } from './input/input_sampler.js';
import { createRendererRig } from './render/renderer_rig.js';
import { createShipModel } from './render/ship_model.js';
import { projectCorners } from './render/camera_fit.js';
import { createBulletInstances } from './render/bullet_instances.js';
import { TIERS, initialTier } from './quality/tiers.js';
import { createQualityController } from './quality/quality_controller.js';
import { createDebugSession } from './debug/debug_session.js';
import * as THREE from 'three';

const PLAYFIELD_W = 240;
const PLAYFIELD_H = 320;

const panel = installErrorPanel();

async function main() {
  const flags = parseUrlFlags(globalThis.location.search);
  const canvas = document.getElementById('view');
  const rig = createRendererRig(canvas, { playfieldW: PLAYFIELD_W, playfieldH: PLAYFIELD_H });
  const touchPrimary = globalThis.matchMedia?.('(pointer: coarse)').matches ?? false;
  const tier0 = initialTier({ forced: flags.tier, touchPrimary });
  rig.applyTier(TIERS[tier0]);
  rig.render();

  const pyodide = await loadRuntime();
  const bridge = await startGame(pyodide, { seed: 1, stress: flags.stress });
  const { tick, header, slots, manifest } = bridge;
  const ship = createShipModel({ hitboxRadius: manifest.tuning.hitbox_radius });
  rig.scene.add(ship);
  const ebullets = createBulletInstances({
    data: bridge.channels.ebullets,
    capacity: manifest.channels.ebullets.cap,
    playfieldW: manifest.playfield.w,
    playfieldH: manifest.playfield.h,
  });
  rig.scene.add(ebullets.mesh);

  // Compile and render through both paths now, so a tier switch never compiles a shader.
  rig.prewarm();
  const controller = createQualityController({
    initialTier: tier0,
    locked: flags.tier !== null,
    nowMs: performance.now(),
  });
  const tierLog = [];
  let currentTier = tier0;
  if (!rig.bloomAvailable) {
    // Half-float render targets are unsupported: run without the bloom chain, for good.
    controller.lock('low', 'bloom-unavailable');
    rig.applyTier(TIERS.low);
    if (currentTier !== 'low') {
      tierLog.push({ atMs: performance.now(), from: currentTier, to: 'low', reason: 'bloom-unavailable' });
    }
    currentTier = 'low';
  }
  // Timing, overlay and report exist only under ?debug; nothing is created otherwise.
  const debug = flags.debug
    ? createDebugSession({
        rig,
        pyodide,
        header,
        slots,
        flags,
        tierLog,
        getTier: () => currentTier,
        getLockReason: () => (controller.locked ? controller.reason : null),
        versions: { build: __BUILD_HASH__, pyodide: PYODIDE_VERSION, three: __THREE_VERSION__ },
        startMs: performance.now(),
      })
    : null;
  // Touch mode is decided by the two devices themselves: a touch pointerdown turns it on (and
  // with it auto-fire), any later keydown turns it off. The sampler owns the flag.
  let sampler = null;
  const keyboard = createKeyboardInput(window, { onKeyDown: () => sampler?.setTouchMode(false) });
  const touch = createTouchInput(document.getElementById('app'), {
    onTouchMode: () => sampler?.setTouchMode(true),
  });
  const mapperArgs = { camera: rig.camera, viewportW: 1, viewportH: 1, shipWorld: ship.position };
  sampler = createInputSampler({
    keyboard,
    touch,
    buttonBits: manifest.buttons,
    getMapperArgs() {
      mapperArgs.viewportW = canvas.clientWidth;
      mapperArgs.viewportH = canvas.clientHeight;
      return mapperArgs;
    },
  });
  const world = new THREE.Vector3();

  const loop = createFrameLoop({
    onFrame(dt, ts) {
      const q = controller.update(dt, ts);
      if (q.changed) {
        rig.applyTier(TIERS[q.tier]);
        tierLog.push({ atMs: ts, from: currentTier, to: q.tier, reason: q.reason });
        currentTier = q.tier;
      }
      const input = sampler.sample();
      const tickStart = debug ? performance.now() : 0;
      tick(dt, input.buttons, input.moveX, input.moveY, input.dragX, input.dragY);
      const tickEnd = debug ? performance.now() : 0;
      rig.toWorld(header[slots.SHIP_X], header[slots.SHIP_Y], world);
      ship.position.copy(world);
      ebullets.update(header[slots.EBULLET_N]);
      // Constant-speed extrapolation by the step alpha keeps the ground smooth at 120/144 Hz
      // while the simulation stays at 60 Hz.
      rig.terrain.update(header[slots.SCROLL_Y] + header[slots.ALPHA] * manifest.tuning.scroll_speed);
      rig.render();
      if (debug) {
        const renderEnd = performance.now();
        debug.record({
          frameMs: dt,
          tickMs: tickEnd - tickStart,
          renderMs: renderEnd - tickEnd,
          nowMs: ts,
        });
      }
    },
    onError(error) {
      panel.show(error, 'frame');
    },
  });
  panel.onFatal(() => loop.stop());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    loop.resetClock();
    controller.resetWarmup(performance.now());
  });
  controller.resetWarmup(performance.now());
  loop.start();

  if (debug) {
    globalThis.__scorched = {
      ready: true,
      header,
      slots,
      manifest,
      flags,
      tierLog,
      ...debug.hooks,
      // The four playfield corners in CSS pixels (e2e checks the letterboxing with it).
      projectPlayfield: () =>
        projectCorners(rig.camera, canvas.clientWidth, canvas.clientHeight, PLAYFIELD_W / 2, PLAYFIELD_H / 2),
      // A playfield point (logical x, y) in CSS pixels, to assert 1:1 touch travel in e2e.
      projectPoint(x, y) {
        const p = rig.toWorld(x, y, new THREE.Vector3()).project(rig.camera);
        return { x: ((p.x + 1) / 2) * canvas.clientWidth, y: ((1 - p.y) / 2) * canvas.clientHeight };
      },
      get touchMode() {
        return sampler.touchMode;
      },
      get tier() {
        return currentTier;
      },
      get lockReason() {
        return controller.locked ? controller.reason : null;
      },
    };
  }
}

main().catch((error) => panel.show(error, 'load'));
