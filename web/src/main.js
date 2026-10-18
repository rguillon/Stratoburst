import { installErrorPanel } from './boot/error_panel.js';
import { parseUrlFlags } from './boot/url_flags.js';
import { PYODIDE_VERSION, loadRuntime } from './boot/runtime_loader.js';
import { createLoadingScreen } from './boot/loading_screen.js';
import { waitForStartGesture } from './boot/start_gate.js';
import { startGame, warmUp } from './python/python_bridge.js';
import { createFrameLoop } from './loop/frame_loop.js';
import { createPauseController } from './loop/pause_controller.js';
import { createKeyboardInput } from './input/keyboard_input.js';
import { createTouchInput } from './input/touch_input.js';
import { createInputSampler } from './input/input_sampler.js';
import { createRendererRig } from './render/renderer_rig.js';
import { createShipModel } from './render/ship_model.js';
import { projectCorners } from './render/camera_fit.js';
import { createBulletInstances } from './render/bullet_instances.js';
import { createEnemyInstances } from './render/enemy_instances.js';
import { enemyModel, warmModels } from './render/models/enemy_models.js';
import { createParticleLayer } from './fx/particle_system.js';
import { createExplosionFx } from './fx/explosion_fx.js';
import { createWreckRing } from './fx/wreck_ring.js';
import { createDecalRing } from './fx/decal_ring.js';
import { createFxDispatcher } from './fx/fx_dispatcher.js';
import { TIERS, initialTier } from './quality/tiers.js';
import { createQualityController } from './quality/quality_controller.js';
import { createStatusReadout } from './ui/status_readout.js';
import { createDebugSession } from './debug/debug_session.js';
import { buildReport } from './debug/report.js';
import * as THREE from 'three';

const PLAYFIELD_W = 240;
const PLAYFIELD_H = 320;
const LOAD_TIMEOUT_MS = 60_000;
const JS_FAULT_FRAME = 120;

const panel = installErrorPanel();

// What Copy report appends to the error text: the full device report once a debug session
// exists, otherwise the same report layout with only what is known without one. Registered
// before main() so even a load failure produces it.
let debugSession = null;
function reportText(flags) {
  if (debugSession) return debugSession.reportText();
  return buildReport({
    ua: globalThis.navigator?.userAgent,
    screen: { width: globalThis.screen?.width, height: globalThis.screen?.height },
    css: { width: globalThis.innerWidth, height: globalThis.innerHeight },
    dpr: globalThis.devicePixelRatio,
    pyodide: PYODIDE_VERSION,
    three: __THREE_VERSION__,
    build: __BUILD_HASH__,
    flags,
  });
}

async function main() {
  const t0 = performance.now();
  const flags = parseUrlFlags(globalThis.location.search);
  panel.setReportProvider(() => reportText(flags));
  const loading = createLoadingScreen();
  // Before the gate, a debug page already answers "has the game started?" (e2e reads it).
  if (flags.debug) globalThis.__scorched = { ready: false, started: false };

  // The download is the long pole: start it first, then build the GPU side while it runs. A
  // rejection is handled where it is awaited; this no-op keeps it from also surfacing as an
  // unhandled rejection if the synchronous setup below throws first.
  const runtimeP = loadRuntime({ onProgress: loading.setProgress, timeoutMs: LOAD_TIMEOUT_MS });
  runtimeP.catch(() => {});

  const canvas = document.getElementById('view');
  const rig = createRendererRig(canvas, { playfieldW: PLAYFIELD_W, playfieldH: PLAYFIELD_H });
  const touchPrimary = globalThis.matchMedia?.('(pointer: coarse)').matches ?? false;
  const tier0 = initialTier({ forced: flags.tier, touchPrimary });
  rig.applyTier(TIERS[tier0]);
  rig.prewarm(); // terrain and both render paths compile while the runtime downloads
  rig.render();

  const pyodide = await runtimeP;
  loading.setStatus('Starting Python…');
  loading.setProgress(0.8);
  const bridge = await startGame(pyodide, { seed: 1, ...flags });
  // The throwaway game never carries the injected fault: it must not fire before the gate.
  warmUp(pyodide, { seed: 1, ...flags, crash: null });
  loading.setProgress(0.9);
  loading.setStatus('Warming up graphics…');
  const { tick, header, slots, manifest } = bridge;
  const ship = createShipModel({
    hitboxRadius: manifest.tuning.hitbox_radius,
    detail: TIERS[tier0].modelDetail,
  });
  rig.scene.add(ship);
  // Everything whose model detail follows the tier. A tier change only swaps cached geometries.
  // rig.terrain was created inside the rig at its default detail; the starting tier is applied
  // below, before the first frame.
  const detailViews = [{ setDetail: (detail) => ship.userData.setDetail(detail) }, rig.terrain];
  const applyModelDetail = (tierName) => {
    for (const view of detailViews) view.setDetail(TIERS[tierName].modelDetail);
  };
  const ebullets = createBulletInstances({
    data: bridge.channels.ebullets,
    capacity: manifest.channels.ebullets.cap,
    playfieldW: manifest.playfield.w,
    playfieldH: manifest.playfield.h,
  });
  // Enemy bullets are drawn after bloom, in their own scene.
  rig.bulletScene.add(ebullets.mesh);
  // Player bolts: HDR cyan so they cross the bloom threshold.
  const pbullets = createBulletInstances({
    data: bridge.channels.pbullets,
    capacity: manifest.channels.pbullets.cap,
    size: 3,
    color: [0.6, 2.4, 4.0],
    name: 'pbullets',
    playfieldW: manifest.playfield.w,
    playfieldH: manifest.playfield.h,
  });
  rig.scene.add(pbullets.mesh);
  // Generate every (kind, detail) enemy model now, behind the loading screen: a tier change then
  // only swaps cached geometries.
  warmModels(Object.keys(manifest.enemy_kinds));
  // Ground kinds (tanks, turrets) are drawn inside the ground layer, which projects the gameplay
  // plane onto the terrain along the camera ray, so they are seen where the bolts hit them (D-21).
  const groundKinds = new Set();
  const groundKindNames = {};
  for (const [name, value] of Object.entries(manifest.enemy_kinds)) {
    if (manifest.tuning.enemy_ground[value] === 1) {
      groundKinds.add(value);
      groundKindNames[name] = value;
    }
  }
  // Instanced meshes per gallery kind, all added before the second prewarm.
  const enemies = createEnemyInstances({
    data: bridge.channels.enemies,
    capacity: manifest.channels.enemies.cap,
    kinds: manifest.enemy_kinds,
    playfieldW: manifest.playfield.w,
    playfieldH: manifest.playfield.h,
    detail: TIERS[tier0].modelDetail,
    groundKinds,
    groundGroup: rig.groundLayer.group,
  });
  detailViews.push(enemies);
  for (const mesh of enemies.airMeshes) rig.scene.add(mesh);
  // GPU particle layers for explosions and sparks: spawn records only, motion and fade run in
  // the vertex shader. Added before the second prewarm so their shaders compile at load.
  const fxLayers = {
    additive: createParticleLayer({ capacity: 2048, blending: 'additive', name: 'fx-additive' }),
    normal: createParticleLayer({ capacity: 1024, blending: 'normal', name: 'fx-normal' }),
  };
  rig.scene.add(fxLayers.additive.mesh);
  rig.scene.add(fxLayers.normal.mesh);
  const explosionFx = createExplosionFx({
    layers: fxLayers,
    events: manifest.events,
    blast: manifest.blast,
    // A ground explosion bursts on the terrain where the unit was drawn; an air one on the plane.
    toWorld: (x, y, ground, out) =>
      ground ? rig.groundLayer.toWorld(x, y, out) : rig.toWorld(x, y, out),
    getScale: () => TIERS[currentTier].particleScale,
    groundKinds,
  });
  // Terrain scroll this frame (steps plus the sub-step alpha); the wrecks read it at a kill.
  let scrollNow = 0;
  // Charred wrecks of ground kills live in the ground layer and scroll away with the terrain.
  const wrecks = createWreckRing({
    kinds: groundKindNames,
    events: manifest.events,
    geometryFor: enemyModel,
    ratio: manifest.tuning.ground_scroll_ratio,
    getScroll: () => scrollNow,
    playfieldW: manifest.playfield.w,
    playfieldH: manifest.playfield.h,
    // Wrecks smoulder through the same particle layers, on the terrain where they lie.
    layers: fxLayers,
    getScale: () => TIERS[currentTier].particleScale,
    toWorld: (x, y, out) => rig.groundLayer.toWorld(x, y, out),
  });
  rig.groundLayer.group.add(wrecks.group);
  // Scorch marks of ground kills lie on the terrain below the shadows and the dim mask.
  const decals = createDecalRing({
    events: manifest.events,
    blast: manifest.blast,
    ratio: manifest.tuning.ground_scroll_ratio,
    getScroll: () => scrollNow,
    playfieldW: manifest.playfield.w,
    playfieldH: manifest.playfield.h,
  });
  rig.groundLayer.group.add(decals.mesh);
  // The tier caps how many scorch marks are drawn; the ring keeps them all stored.
  const applyDecalLimit = (tierName) => decals.setLimit(TIERS[tierName].maxDecals);
  const fx = createFxDispatcher({ handlers: [explosionFx, wrecks, decals] });
  let fxTime = 0;

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
    applyModelDetail('low');
  }
  applyDecalLimit(currentTier);
  // Upload every detail level's geometry now, behind the loading screen, so a tier change
  // during play never uploads or compiles anything.
  for (const { modelDetail } of Object.values(TIERS)) {
    for (const view of detailViews) view.setDetail(modelDetail);
    rig.render();
  }
  applyModelDetail(currentTier);
  rig.render();
  loading.setProgress(1);
  loading.setStatus('Ready');
  const timeToGateMs = performance.now() - t0;
  loading.showGate();
  const app = document.getElementById('app');
  const { audio, pointerType } = await waitForStartGesture(app);
  loading.hide();
  const readout = createStatusReadout({ weapons: manifest.weapons });
  readout.show();

  // Timing, overlay and report exist only under ?debug; nothing is created otherwise. They
  // start with play, so the report's elapsed time and minutes exclude the loading screen.
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
        timeToGateMs,
      })
    : null;
  debugSession = debug;
  // Input devices are created after the gate, so the gate tap or key press never reaches them.
  // Touch mode is decided by the two devices themselves: a touch pointerdown turns it on (and
  // with it auto-fire), any later keydown turns it off. The sampler owns the flag.
  let sampler = null;
  const keyboard = createKeyboardInput(window, { onKeyDown: () => sampler?.setTouchMode(false) });
  const touch = createTouchInput(app, {
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
  // A touch tap on the gate is already a touch session: steer by drag and auto-fire.
  if (pointerType === 'touch') sampler.setTouchMode(true);
  const world = new THREE.Vector3();
  let frameCount = 0;
  let pause = null; // created after the loop; onFrame only runs once the loop has started

  const loop = createFrameLoop({
    onFrame(dt, ts) {
      frameCount += 1;
      // ?crash=js proves the error panel for JS faults (PLAT-09); the loop routes it to onError.
      if (flags.crash === 'js' && frameCount === JS_FAULT_FRAME) {
        throw new Error(`Injected JS fault (?crash=js) at frame ${JS_FAULT_FRAME}`);
      }
      const q = controller.update(dt, ts);
      if (q.changed) {
        rig.applyTier(TIERS[q.tier]);
        applyModelDetail(q.tier);
        applyDecalLimit(q.tier);
        tierLog.push({ atMs: ts, from: currentTier, to: q.tier, reason: q.reason });
        currentTier = q.tier;
      }
      const input = sampler.sample();
      const tickStart = debug ? performance.now() : 0;
      tick(dt, input.buttons, input.moveX, input.moveY, input.dragX, input.dragY);
      const tickEnd = debug ? performance.now() : 0;
      // Constant-speed extrapolation by the step alpha keeps the ground smooth at 120/144 Hz
      // while the simulation stays at 60 Hz. One value drives the terrain and the wrecks.
      scrollNow = header[slots.SCROLL_Y] + header[slots.ALPHA] * manifest.tuning.scroll_speed;
      fx.dispatch(bridge.channels.events, header[slots.EVENT_N]);
      // Escape/P pause inside Python; mirror the header FLAGS onto the PAUSED overlay.
      pause.sync(header[slots.FLAGS]);
      rig.toWorld(header[slots.SHIP_X], header[slots.SHIP_Y], world);
      ship.position.copy(world);
      ebullets.update(header[slots.EBULLET_N]);
      pbullets.update(header[slots.PBULLET_N]);
      readout.update(header[slots.WEAPON], header[slots.LEVEL]);
      // Ground units extrapolate like the terrain, at the ground ratio, so they never stutter
      // against the roads.
      enemies.update(
        header[slots.ENEMY_N],
        fxTime,
        header[slots.ALPHA] * manifest.tuning.scroll_speed * manifest.tuning.ground_scroll_ratio,
      );
      rig.terrain.update(scrollNow);
      wrecks.update(scrollNow, fxTime);
      decals.update(scrollNow);
      fxTime += dt / 1000;
      fxLayers.additive.update(fxTime);
      fxLayers.normal.update(fxTime);
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
  pause = createPauseController({
    bridge,
    loop,
    inputs: [keyboard, touch],
    overlayEl: document.getElementById('paused'),
    controller,
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    loop.resetClock();
    controller.resetWarmup(performance.now());
  });
  // A lost GPU context pauses the game behind a notice; three.js re-uploads its resources on
  // restore and the player resumes from the PAUSED overlay.
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault(); // required, or the browser never offers to restore the context
    pause.pause('context-lost');
    panel.showNotice('Graphics context lost: waiting for the browser to restore it');
  });
  canvas.addEventListener('webglcontextrestored', () => panel.hideNotice());
  controller.resetWarmup(performance.now());
  loop.start();

  if (debug) {
    globalThis.__scorched = {
      ready: true,
      started: true,
      timeToGateMs,
      get audioState() {
        return audio?.state ?? 'none';
      },
      header,
      slots,
      manifest,
      flags,
      tierLog,
      ...debug.hooks,
      // The composer's pass order and which path draws the enemy bullets (e2e reads both).
      get passes() {
        return rig.pipeline.passNames();
      },
      get bulletPath() {
        return rig.pipeline.enabled ? 'composer' : 'direct';
      },
      // The four playfield corners in CSS pixels (e2e checks the letterboxing with it).
      projectPlayfield: () =>
        projectCorners(rig.camera, canvas.clientWidth, canvas.clientHeight, PLAYFIELD_W / 2, PLAYFIELD_H / 2),
      // A playfield point (logical x, y) in CSS pixels, to assert 1:1 touch travel in e2e.
      projectPoint(x, y) {
        const p = rig.toWorld(x, y, new THREE.Vector3()).project(rig.camera);
        return { x: ((p.x + 1) / 2) * canvas.clientWidth, y: ((1 - p.y) / 2) * canvas.clientHeight };
      },
      get paused() {
        return (header[slots.FLAGS] & manifest.flags.PAUSED) !== 0;
      },
      get touchMode() {
        return sampler.touchMode;
      },
      get tier() {
        return currentTier;
      },
      fx: {
        get particlesSpawned() {
          return fxLayers.additive.spawned + fxLayers.normal.spawned;
        },
        get wrecksSpawned() {
          return wrecks.spawned;
        },
        get decals() {
          return decals.live;
        },
      },
      // The ground layer's ray-compensation scale (e2e checks it stays within 1.03..1.09).
      get groundLayerK() {
        return rig.groundLayer.k;
      },
      get lockReason() {
        return controller.locked ? controller.reason : null;
      },
    };
  }
}

main().catch((error) => panel.show(error, 'load'));
