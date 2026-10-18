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
import { createBombButton, readSafeInsets } from './input/bomb_button.js';
import { layoutBombButton } from './input/bomb_button_layout.js';
import { createInputSampler } from './input/input_sampler.js';
import { createRendererRig } from './render/renderer_rig.js';
import { createShipModel, hullVisibleFor } from './render/ship_model.js';
import { projectCorners } from './render/camera_fit.js';
import { createBulletInstances } from './render/bullet_instances.js';
import { createEnemyInstances } from './render/enemy_instances.js';
import { createMissileInstances } from './render/missile_instances.js';
import { createPickupInstances } from './render/pickup_instances.js';
import { createCityLayer } from './render/city_layer.js';
import { createCityGround } from './render/city_ground.js';
import { warmScenery } from './render/models/scenery_models.js';
import { enemyModel, hasModel, warmModels } from './render/models/enemy_models.js';
import { CITY_TARGET_KINDS, buildRubble } from './render/models/city_targets.js';
import { createParticleLayer } from './fx/particle_system.js';
import { createExplosionFx } from './fx/explosion_fx.js';
import { createWreckRing, wreckKindsFor } from './fx/wreck_ring.js';
import { createStumpFx, stumpKindsFor } from './fx/stump_fx.js';
import { createDecalRing } from './fx/decal_ring.js';
import { createLightPool } from './fx/light_pool.js';
import { createShadowInstances } from './fx/shadow_instances.js';
import { createBeamMesh } from './fx/beam_mesh.js';
import { createBombFx } from './fx/bomb_fx.js';
import { createShake, effectClockDelta, withCameraOffset } from './fx/shake.js';
import { createFxDispatcher } from './fx/fx_dispatcher.js';
import { SFX_TABLE } from './audio/sfx_table.js';
import { createSfxBank, synthesizeAll } from './audio/sfx_bank.js';
import { createSfxPlayer } from './audio/sfx_player.js';
import { installAudioKeepalive } from './audio/audio_keepalive.js';
import { TIERS, initialTier } from './quality/tiers.js';
import { createQualityController } from './quality/quality_controller.js';
import { createStatusReadout } from './ui/status_readout.js';
import { createGameOverOverlay } from './ui/game_over_overlay.js';
import { createScorePopups } from './ui/score_popups.js';
import { createBannerOverlay } from './ui/banner_overlay.js';
import { createBossBar } from './ui/boss_bar.js';
import { createDebugSession } from './debug/debug_session.js';
import { buildReport } from './debug/report.js';
import * as THREE from 'three';

const PLAYFIELD_W = 240;
const PLAYFIELD_H = 320;
const LOAD_TIMEOUT_MS = 60_000;
const JS_FAULT_FRAME = 120;
// Filled by the shake each frame and read right before the render call: one object, no allocation.
const shakeScratch = { x: 0, z: 0 };
// What the effect clock and the shake check each frame: { paused, hitstop }, updated in place.
const clockState = { paused: false, hitstop: false };

const panel = installErrorPanel();

// What Copy report appends to the error text: the full device report once a debug session
// exists, otherwise the same report layout with only what is known without one. Registered
// before main() so even a load failure produces it.
let debugSession = null;
// The AudioContext state for the report; replaced once the start gate has made the context.
let getAudioState = () => undefined;
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
    audioState: getAudioState(),
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
  // Sound samples are plain CPU math, so they are rendered now, while the runtime downloads. The
  // AudioBuffers are made after the start tap, on the context the gate unlocked.
  const sfxSamples = synthesizeAll(SFX_TABLE);

  const canvas = document.getElementById('view');
  const rig = createRendererRig(canvas, { playfieldW: PLAYFIELD_W, playfieldH: PLAYFIELD_H });
  const touchPrimary = globalThis.matchMedia?.('(pointer: coarse)').matches ?? false;
  const tier0 = initialTier({ forced: flags.tier, touchPrimary });
  rig.applyTier(TIERS[tier0]);
  rig.prewarm(); // both render paths compile while the runtime downloads
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
  // Every (kind, detail) scenery model is generated now, behind the loading screen.
  warmScenery(Object.keys(manifest.scenery_kinds));
  // The road grid under the blocks: one plane in the same group, scrolled by the same mapping.
  const cityGround = createCityGround({
    ratio: manifest.tuning.ground_scroll_ratio,
    y0: manifest.tuning.ground_y0,
    playfieldW: manifest.playfield.w,
    playfieldH: manifest.playfield.h,
    pitch: manifest.stage.block_pitch,
    block: manifest.stage.block_size,
    length: manifest.stage.length,
    loop: manifest.stage.loop,
  });
  rig.groundLayer.group.add(cityGround.group);
  // The city (D-34): the layout Python shipped in the manifest, drawn in the ground layer so it
  // shares one frame with the ground units, wrecks and scorch marks (RESEARCH Pattern 5).
  const city = createCityLayer({
    layout: manifest.stage.city,
    stride: manifest.stage.city_stride,
    kinds: manifest.scenery_kinds,
    ratio: manifest.tuning.ground_scroll_ratio,
    y0: manifest.tuning.ground_y0,
    playfieldW: manifest.playfield.w,
    playfieldH: manifest.playfield.h,
    loop: manifest.stage.loop,
    length: manifest.stage.length,
    detail: TIERS[tier0].modelDetail,
  });
  rig.groundLayer.group.add(city.group);
  // Everything whose model detail follows the tier. A tier change only swaps cached geometries.
  // The city was created at the starting tier's detail; every detail is applied below, before the
  // first frame.
  const detailViews = [{ setDetail: (detail) => ship.userData.setDetail(detail) }, city];
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
  // Player bolts: HDR tracers stretched along their flight angle, so they bloom and the vulcan fan's
  // angled streams read as streaks.
  const pbullets = createBulletInstances({
    data: bridge.channels.pbullets,
    capacity: manifest.channels.pbullets.cap,
    style: 'bolt',
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
  // The destructible city targets (D-34): they spark when destroyed, leave rubble and flicker when damaged.
  const cityKinds = new Set(
    CITY_TARGET_KINDS.filter((name) => name in manifest.enemy_kinds).map((name) => manifest.enemy_kinds[name]),
  );
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
    flickerKinds: cityKinds,
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
    pickupKinds: manifest.pickup_kinds,
    // A ground explosion bursts on the terrain where the unit was drawn; an air one on the plane.
    toWorld: (x, y, ground, out) =>
      ground ? rig.groundLayer.toWorld(x, y, out) : rig.toWorld(x, y, out),
    getScale: () => TIERS[currentTier].particleScale,
    groundKinds,
    cityKinds,
  });
  // Terrain scroll this frame (steps plus the sub-step alpha); the wrecks read it at a kill.
  let scrollNow = 0;
  // Charred wrecks of ground kills live in the ground layer and scroll away with the terrain.
  // Which ground kills leave a wreck is data (manifest `enemy_wreck`) and needs a JS model: train
  // turrets and stumps have a model but no wreck, and a kind Python adds before its model exists has
  // neither. A destroyed city target is drawn as a charred rubble pile, never as its intact building.
  const wreckKinds = wreckKindsFor(groundKindNames, manifest.tuning.enemy_wreck, hasModel);
  const wrecks = createWreckRing({
    kinds: wreckKinds,
    rubble: { kinds: cityKinds, geometry: buildRubble() },
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
  // A boss part shot off leaves a stump (D-14) that smokes and burns for the rest of the fight; the
  // stump kinds are the manifest names ending in _STUMP, and it reads the same enemies channel.
  const stumpFx = createStumpFx({
    data: bridge.channels.enemies,
    capacity: manifest.channels.enemies.cap,
    stumpKinds: stumpKindsFor(manifest.enemy_kinds),
    groundKinds,
    layers: fxLayers,
    getScale: () => TIERS[currentTier].particleScale,
    toWorld: (x, y, ground, out) =>
      ground ? rig.groundLayer.toWorld(x, y, out) : rig.toWorld(x, y, out),
  });
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
  // Explosion lights: a fixed pool, added to the scene once and never removed, so no lit shader
  // recompiles mid-game. Added before the second prewarm so every lit material compiles with the
  // final light count. The tier only changes how many of them may flash.
  const lightPool = createLightPool({
    events: manifest.events,
    blast: manifest.blast,
    toWorld: (x, y, ground, out) =>
      ground ? rig.groundLayer.toWorld(x, y, out) : rig.toWorld(x, y, out),
  });
  for (const light of lightPool.lights) rig.scene.add(light);
  const applyLights = (tierName) => lightPool.setEnabled(TIERS[tierName].lights);
  // Every aircraft and the ship cast a soft blob on the terrain, displaced along the sun direction
  // by their altitude. They live in the scene, not the ground layer: the offset is the altitude cue.
  const shadows = createShadowInstances({
    data: bridge.channels.enemies,
    capacity: manifest.channels.enemies.cap,
    kinds: manifest.enemy_kinds,
    groundKinds,
    radii: manifest.tuning.enemy_radius,
    sunPosition: rig.sun.position,
    playfieldW: manifest.playfield.w,
    playfieldH: manifest.playfield.h,
  });
  rig.scene.add(shadows.mesh);
  // The blue laser beam: Python publishes only its half-width (0 when off). It is shown once while
  // the shaders compile (hidden again below) so the first shot never pays a compile.
  const beam = createBeamMesh({
    playfieldW: manifest.playfield.w,
    playfieldH: manifest.playfield.h,
  });
  rig.scene.add(beam.group);
  beam.update(1, manifest.playfield.w / 2, manifest.playfield.h / 2, 0);
  // The violet homing missiles and their exhaust trails. The mesh is drawn once (count 1) while the
  // shaders compile, then hidden until the first missile launches.
  const missiles = createMissileInstances({
    data: bridge.channels.missiles,
    capacity: manifest.channels.missiles.cap,
    layers: fxLayers,
    getScale: () => TIERS[currentTier].particleScale,
    playfieldW: manifest.playfield.w,
    playfieldH: manifest.playfield.h,
  });
  rig.scene.add(missiles.mesh);
  missiles.mesh.count = 1;
  // The power-up crystals, coloured by the index Python packs. Drawn once (count 1) while the
  // shaders compile, then hidden until a carrier drops one.
  const pickups = createPickupInstances({
    data: bridge.channels.pickups,
    capacity: manifest.channels.pickups.cap,
    kinds: manifest.pickup_kinds,
    playfieldW: manifest.playfield.w,
    playfieldH: manifest.playfield.h,
  });
  rig.scene.add(pickups.mesh);
  rig.scene.add(pickups.medalMesh);
  pickups.mesh.count = 1;
  pickups.medalMesh.count = 1;
  // The nuke: a rising missile, then a fireball that fills the screen, with one burst, one light, one
  // scorch and one bloom pulse at the detonation. Python owns the bomb; this only draws it. Added
  // before the second prewarm so its shaders compile at load.
  const bombFx = createBombFx({
    layers: fxLayers,
    events: manifest.events,
    phases: manifest.bomb_phases,
    tuning: manifest.tuning,
    bloomPass: rig.pipeline.bloomPass,
    decals,
    lights: lightPool,
    getScale: () => TIERS[currentTier].particleScale,
    toWorld: (x, y, out) => rig.toWorld(x, y, out),
    playfieldW: manifest.playfield.w,
    playfieldH: manifest.playfield.h,
  });
  rig.scene.add(bombFx.group);
  bombFx.showAll(true);
  // Screen shake: only the big events (a bomb detonation, the ship's death, a boss part blowing off) move
  // the camera, and only around the render call. The freeze itself is Python's hitstop.
  const shake = createShake({ events: manifest.events });
  const fx = createFxDispatcher({
    handlers: [explosionFx, wrecks, decals, lightPool, bombFx, shake],
  });
  let fxTime = 0;
  let hitstopFrames = 0; // frames drawn while Python held the simulation frozen (e2e reads it)

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
  applyLights(currentTier);
  // Upload every detail level's geometry now, behind the loading screen, so a tier change
  // during play never uploads or compiles anything.
  for (const { modelDetail } of Object.values(TIERS)) {
    for (const view of detailViews) view.setDetail(modelDetail);
    rig.render();
  }
  applyModelDetail(currentTier);
  rig.render();
  beam.update(0, 0, 0, 0); // compiled and rendered through both paths: hidden until the laser fires
  missiles.update(0, 0); // likewise hidden until a missile launches
  pickups.update(0, 0); // and hidden until a crystal drops
  bombFx.showAll(false); // and the missile and fireball until a bomb flies
  loading.setProgress(1);
  loading.setStatus('Ready');
  const timeToGateMs = performance.now() - t0;
  loading.showGate();
  const app = document.getElementById('app');
  const { audio, pointerType } = await waitForStartGesture(app);
  // iOS: play through the silent switch, and resume a suspended or interrupted context on later gestures.
  installAudioKeepalive({ audio });
  getAudioState = () => audio?.state ?? 'none';
  loading.hide();
  const readout = createStatusReadout({
    weapons: manifest.weapons,
    events: manifest.events,
    maxed: manifest.outcomes.MAXED,
  });
  readout.show();
  // Shown while FLOW is GAME_OVER; a fire key or a tap calls the held restart proxy (Pitfall 9).
  const gameOver = createGameOverOverlay({
    flowStates: manifest.flow_states,
    onRestart: () => bridge.restart(),
  });
  // Shown while FLOW is INTRO (the stage start, D-26): STAGE n fading as the ship flies in.
  const banner = createBannerOverlay({ flowStates: manifest.flow_states });
  // The boss HP bar (D-25): state-driven from BOSS_ACTIVE, with a tick at each phase threshold of the
  // stage's bosses, which Python ships in the manifest.
  const bossBar = createBossBar({ bosses: manifest.stage.bosses });
  fx.add(readout); // the MAX flash listens for the MAXED pickup events
  // A medal catch pops its value up where the medal was (D-20). The projection reuses one vector and
  // one result object, so a catch allocates nothing here.
  const popupPoint = new THREE.Vector3();
  const popupAt = { x: 0, y: 0 };
  const popups = createScorePopups({
    events: manifest.events,
    project(x, y) {
      rig.toWorld(x, y, popupPoint).project(rig.camera);
      popupAt.x = ((popupPoint.x + 1) / 2) * canvas.clientWidth;
      popupAt.y = ((1 - popupPoint.y) / 2) * canvas.clientHeight;
      return popupAt;
    },
  });
  fx.add(popups);
  // Python picks the sound for each event; this plays it on the gate's AudioContext (null = silent).
  const sfxPlayer = createSfxPlayer({
    audio,
    bank: createSfxBank({ audio, samples: sfxSamples }),
    table: SFX_TABLE,
    sfxIds: manifest.sfx,
    events: manifest.events,
  });
  fx.add(sfxPlayer);

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
        getAudioState,
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
  // The bomb button is a touch-mode control: it shows with touch mode and hides in keyboard mode.
  const bombButton = createBombButton(document.getElementById('bomb-button'));
  const setTouchMode = (on) => {
    sampler?.setTouchMode(on);
    bombButton.setVisible(on);
  };
  // Placed in the letterbox margin when there is room, else over the playfield's bottom-right corner.
  // The rig refits the camera on a CSS size change; asking it to resize first makes the projected
  // corners current whichever of the two handlers runs first. Re-laid out on every resize and
  // orientation change (a coalesced rAF, like the rig's own).
  let bombLayout = null;
  const layOutBombButton = () => {
    rig.resize();
    const viewportW = canvas.clientWidth;
    const viewportH = canvas.clientHeight;
    bombLayout = layoutBombButton({
      corners: projectCorners(rig.camera, viewportW, viewportH, PLAYFIELD_W / 2, PLAYFIELD_H / 2),
      viewportW,
      viewportH,
      insets: readSafeInsets(),
    });
    bombButton.place(bombLayout);
  };
  let bombLayoutQueued = false;
  const queueBombLayout = () => {
    if (bombLayoutQueued) return;
    bombLayoutQueued = true;
    requestAnimationFrame(() => {
      bombLayoutQueued = false;
      layOutBombButton();
    });
  };
  window.addEventListener('resize', queueBombLayout);
  window.visualViewport?.addEventListener('resize', queueBombLayout);
  layOutBombButton();
  const keyboard = createKeyboardInput(window, { onKeyDown: () => setTouchMode(false) });
  const touch = createTouchInput(app, {
    onTouchMode: () => setTouchMode(true),
  });
  const mapperArgs = { camera: rig.camera, viewportW: 1, viewportH: 1, shipWorld: ship.position };
  sampler = createInputSampler({
    keyboard,
    touch,
    bombButton,
    buttonBits: manifest.buttons,
    getMapperArgs() {
      mapperArgs.viewportW = canvas.clientWidth;
      mapperArgs.viewportH = canvas.clientHeight;
      return mapperArgs;
    },
  });
  // A touch tap on the gate is already a touch session: steer by drag and auto-fire.
  if (pointerType === 'touch') setTouchMode(true);
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
        applyLights(q.tier);
        tierLog.push({ atMs: ts, from: currentTier, to: q.tier, reason: q.reason });
        currentTier = q.tier;
      }
      const input = sampler.sample();
      const tickStart = debug ? performance.now() : 0;
      tick(dt, input.buttons, input.moveX, input.moveY, input.dragX, input.dragY);
      const tickEnd = debug ? performance.now() : 0;
      // While Python holds the simulation frozen (hitstop) nothing may creep: the extrapolation
      // alpha is 0 and the effect clock stands still, so the ground, the wrecks and the particles
      // hold exactly. The effect clock also holds while the game is paused.
      const hitstop = header[slots.HITSTOP] > 0;
      const paused = (header[slots.FLAGS] & manifest.flags.PAUSED) !== 0;
      clockState.hitstop = hitstop;
      clockState.paused = paused;
      // The laser hums while its beam is on, and pausing or hiding the game silences everything.
      sfxPlayer.setMuted(paused);
      sfxPlayer.setLaser(header[slots.BEAM_W] > 0 && !paused);
      if (hitstop) hitstopFrames += 1;
      const alpha = hitstop ? 0 : header[slots.ALPHA];
      // Extrapolation by the step alpha keeps the ground smooth at 120/144 Hz while the simulation
      // stays at 60 Hz. It uses the live scroll rate, so a crawl or a stop never stutters. One value
      // drives the terrain and the wrecks.
      scrollNow = header[slots.SCROLL_Y] + alpha * header[slots.SCROLL_RATE];
      fx.dispatch(bridge.channels.events, header[slots.EVENT_N]);
      readout.tick(ts);
      // Escape/P pause inside Python; mirror the header FLAGS onto the PAUSED overlay.
      pause.sync(header[slots.FLAGS]);
      rig.toWorld(header[slots.SHIP_X], header[slots.SHIP_Y], world);
      ship.position.copy(world);
      ebullets.update(header[slots.EBULLET_N]);
      pbullets.update(header[slots.PBULLET_N]);
      readout.update(header, slots);
      gameOver.update(header, slots, ts);
      banner.update(header, slots);
      bossBar.update(header, slots);
      beam.update(header[slots.BEAM_W], header[slots.SHIP_X], header[slots.SHIP_Y], fxTime);
      missiles.update(header[slots.MISSILE_N], fxTime);
      pickups.update(header[slots.PICKUP_N], fxTime);
      bombFx.update(
        header[slots.BOMB_PHASE],
        header[slots.BOMB_X],
        header[slots.BOMB_Y],
        header[slots.BOMB_T],
        dt / 1000,
        fxTime,
      );
      // Ground units extrapolate like the terrain, at the ground ratio, so they never stutter
      // against the roads.
      enemies.update(
        header[slots.ENEMY_N],
        fxTime,
        alpha * header[slots.SCROLL_RATE] * manifest.tuning.ground_scroll_ratio,
      );
      // A dying ship is gone: its model, hitbox marker and shadow all hide, and so does the last
      // one after game over (OUT). Otherwise only the hull blinks while invulnerable (hitbox marker
      // always shown, Pitfall 9) and control is untouched.
      const shipVisible =
        header[slots.PLAYER_PHASE] !== manifest.phases.DYING &&
        header[slots.PLAYER_PHASE] !== manifest.phases.OUT;
      ship.visible = shipVisible;
      if (shipVisible) ship.userData.setHullVisible(hullVisibleFor(header[slots.INVULN]));
      shadows.update(header[slots.ENEMY_N], header[slots.SHIP_X], header[slots.SHIP_Y], shipVisible);
      cityGround.update(scrollNow);
      city.update(scrollNow);
      wrecks.update(scrollNow, fxTime);
      decals.update(scrollNow);
      const effectDt = effectClockDelta(dt, clockState);
      fxTime += effectDt;
      stumpFx.update(header[slots.ENEMY_N], effectDt);
      lightPool.update(dt / 1000);
      fxLayers.additive.update(fxTime);
      fxLayers.normal.update(fxTime);
      // The shake runs on real time, hitstop included, and holds only while paused.
      shake.update(paused ? 0 : dt / 1000);
      withCameraOffset(rig.camera, shake.offset(shakeScratch), rig.render);
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
    inputs: [keyboard, touch, bombButton],
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
        return getAudioState();
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
      bombButton: {
        get visible() {
          return !bombButton.el.hidden;
        },
        // Whether the button sits in the letterbox margin, and its box in CSS pixels.
        get inMargin() {
          return bombLayout.inMargin;
        },
        get rect() {
          const { left, top, size } = bombLayout;
          return { left, top, width: size, height: size };
        },
      },
      get tier() {
        return currentTier;
      },
      // Sound voices started so far, and whether the laser hum and the pause mute are on (e2e).
      sfx: {
        get played() {
          return sfxPlayer.played;
        },
        get laser() {
          return sfxPlayer.laser;
        },
        get muted() {
          return sfxPlayer.muted;
        },
      },
      fx: {
        get particlesSpawned() {
          return fxLayers.additive.spawned + fxLayers.normal.spawned;
        },
        // City placements drawn this frame (e2e checks the city is on screen).
        get cityDrawn() {
          return city.drawn;
        },
        // City target bursts played so far (e2e checks a destroyed building sparks).
        get cityBursts() {
          return explosionFx.cityBursts;
        },
        get wrecksSpawned() {
          return wrecks.spawned;
        },
        // Particles the stumps of shot-off boss parts have emitted so far (e2e checks they smoulder).
        get stumpPuffs() {
          return stumpFx.emitted;
        },
        get decals() {
          return decals.live;
        },
        get lightsFlashed() {
          return lightPool.flashes;
        },
        get shadows() {
          return shadows.mesh.count;
        },
        get beamVisible() {
          return beam.group.visible;
        },
        get missilesDrawn() {
          return missiles.mesh.count;
        },
        get pickupsDrawn() {
          return pickups.mesh.count;
        },
        // Medal chips drawn this frame, and medal popups started so far (e2e).
        get medalsDrawn() {
          return pickups.medalMesh.count;
        },
        get popupsShown() {
          return popups.shown;
        },
        get bombsShown() {
          return bombFx.shown;
        },
        // Big-event shakes triggered, and frames drawn while the simulation was frozen.
        get shakes() {
          return shake.count;
        },
        get hitstopFrames() {
          return hitstopFrames;
        },
        // How many of the live pickups are bomb pickups (e2e checks a turret kill drops one).
        get bombPickups() {
          const channel = bridge.channels.pickups;
          let count = 0;
          for (let i = 0; i < header[slots.PICKUP_N]; i += 1) {
            if (channel[i * 4 + 3] === manifest.pickup_kinds.BOMB) count += 1;
          }
          return count;
        },
      },
      // False exactly while the ship is dying (e2e checks the explosion hides it).
      get shipVisible() {
        return ship.visible;
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
