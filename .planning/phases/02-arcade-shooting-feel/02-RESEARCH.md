# Phase 2: Arcade Shooting Feel - Research

**Researched:** 2026-10-17
**Domain:** Browser shmup juice and combat systems: Python sim (Pyodide) for weapons, bombs, death/respawn, pickups, collision; three.js 0.186.1 for procedural models, GPU particles, lights, bloom, shake; WebAudio/zzfx for SFX
**Confidence:** MEDIUM-HIGH (code seams and three.js facts verified against the repo and the installed package; tuning numbers, mobile cost and several visual-geometry choices are explicitly `[ASSUMED]` and need on-device confirmation)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Weapons & power (PLYR-04, PLYR-05, PLYR-06)**
- **D-01:** **Red vulcan = Raiden fan.** Lv1 is the existing twin shot. Each level adds wider-angled streams, up to a wide fan of about 7 streams at Lv5. Strong crowd control, weaker on a single target. Per-level patterns are data (tunable tables), not code branches.
- **D-02:** **Blue laser = Raiden beam.** A continuous straight beam locked to the ship's x that gets wider and deals more damage per level. Very high single-target DPS with no spread. The beam is a hitscan/segment collision, not pooled bullets.
- **D-03:** **Purple = homing missiles only (Strikers style), with no forward main shot.** Missiles curve toward targets, and the number of missiles per volley goes up with level (about 1 at Lv1 to about 5 at Lv5). Missiles need target acquisition plus a turn-rate-limited steering model.
- **D-04:** **Death costs 2 weapon levels** (minimum Lv1). The weapon type is kept. — **Reversibility:** reversible — tuning constant
- **D-05:** **The recovery pickup is an ordinary +1 level pickup fixed to the current weapon color** (it does not cycle). It drops near the death spot, so catching it limits the net loss to -1.
- **D-06:** **A same-color pickup at Lv5 gives a score bonus plus a "MAX" flash.** No score system exists until Phase 3, so record the event and award points once scoring arrives. The flash and SFX play now.
- **D-07:** **Switching color keeps the level** (Lv4 red → Lv4 blue).

**Bomb, death & respawn (PLYR-07, PLYR-08, PLYR-09, PLYR-10, INPT-03)**
- **D-08:** **The bomb is a Raiden nuke.** A missile launches up the screen, then a huge expanding fireball fills it. This is the main showcase for bloom and particles.
- **D-09:** **Enemy bullets are cleared instantly at detonation.** The fireball then deals damage every tick for about 1.5 s. The player is invulnerable for the whole blast plus a short tail.
- **D-10:** **Bomb stock starts at 3 and is refilled to at least 3 on each new life, max 7.** Bomb pickups add +1.
- **D-11:** **Deathbomb grace window is about 8 frames** (about 0.13 s, tunable constant). A bomb pressed inside the window after a fatal hit cancels the death.
- **D-12:** **Keyboard bomb stays Shift or K** (Phase 1 D-11; already mapped in `keyboard_input.js`, and `Button.BOMB = 2` exists).
- **D-13:** **The touch bomb button is a big circle in the bottom-right.** It sits in the letterbox margin when there's room, otherwise it overlays the playfield corner. Pointers that start on the button are excluded from drag tracking.
- **D-14:** **Respawn flies in from the bottom.** After the death explosion and a short pause, the ship flies up from below the screen. The player takes control once it's on screen. The ship blinks for about 2-3 s of invulnerability.
- **D-15:** **The player can move and fire during the blink invulnerability.**

**Shooting gallery & pickups**
- **D-16:** **Weapon pickups are Raiden color-cycling crystals.** One crystal cycles red → blue → purple about every 1.5 s and bounces around the playfield. The color at the moment of pickup decides the weapon. Exception: the death recovery pickup (D-05) is fixed to one color.
- **D-17:** **The gallery is a mixed, endlessly looping sandbox over the scrolling terrain.** It has air jets and helicopters (with shadows), ground tanks and turrets/AA guns, simple enemy fire (aimed shots and rings), and carrier enemies. Its job is to exercise every weapon, effect, wreck, shadow and death path. Spawning can be simple scripted loops. It is not the Phase 3 data-driven timeline, but it shouldn't block that design either.
- **D-18:** **The player can die in the gallery, with infinite lives.** Enemy bullets and body collisions kill, which exercises death, power loss, deathbomb and respawn. Lives and game over come in Phase 3.
- **D-19:** **Pickups drop from carrier enemies.** A distinctive carrier drops a weapon crystal when destroyed, and some ground targets drop bomb pickups.
- **D-20:** **The gallery is the default game on the live link** and replaces the Phase 1 drones. Stage 1 replaces it in Phase 3. Phase 1 URL flags (`?debug`, `?stress`, `?tier`) keep working.
- **D-21:** **Ground targets, their wrecks and scorch marks are anchored to the terrain and scroll with it** (STGE-04). This is the foundation for ground units in Phase 3.

**Juice, look & sound (VISL-01..06, ENMY-08, STGE-04, AUDI-01, AUDI-03)**
- **D-22:** **Explosions are big and punchy, sized by class.** Small air targets get a bright pop plus sparks. Tanks and heavies get a fireball, rolling smoke, flying debris and a brief light flash on the terrain. Particles are GPU-driven from spawn events (no Python particle sim, per CLAUDE.md).
- **D-23:** **Enemy bullets are hot-pink/magenta orbs with a white core,** drawn above all effects. Pink is reserved: no fire, explosion or weapon effect may use it, so bullets stay readable (VISL-05). The blue laser and purple missiles must stay clearly different from enemy pink.
- **D-24:** **The art direction is smoother and stylized,** not faceted low-poly. Code-built models use more segments, smooth shading and some bevels, in military colors with bright emissive accents (engines, lights). This upgrades the Phase 1 flat-shaded jet. — **Reversibility:** costly — every model generator for ships, enemies and terrain props is written in this style
- **D-25:** **Model detail scales with the quality tier.** Generators take a detail parameter: the low tier gets fewer segments and no bevels, the high tier gets the full smooth look. This hooks into the Phase 1 tier controller.
- **D-26:** **Shake and hitstop happen only on big events.** The bomb gets a strong shake for about 0.5 s and about 3-4 frames of hitstop at detonation. Player death gets a medium shake and about 6 frames of hitstop. Ordinary hits and kills get neither (ROADMAP criterion 5). All values are tunable constants.
- **D-27:** **Shake is a render-only camera offset,** a short positional jitter. Gameplay coordinates and the fixed camera framing (Phase 1 D-09) are unchanged. Hitstop freezes the sim deterministically in Python, and the renderer keeps drawing.
- **D-28:** **Hit feedback is a white flash for a couple of frames plus a few sparks at the impact point.**
- **D-29:** **SFX are crunchy arcade sounds synthesized with zzfx.** Explosions are noisy with a low-end thump, shots are snappy, pickups chime brightly. Shot sounds are mixed quieter so they don't wear the player out. Python emits integer SFX IDs. JS plays pre-rendered buffers with a voice limit and a cooldown per ID (CLAUDE.md stack pattern).
- **D-30:** **Audio must play on iOS Safari after the start tap,** reusing the `AudioContext` that `start_gate.js` already resumes (AUDI-03).

### Claude's Discretion
- Exact per-level patterns, damage, fire rates, beam widths, missile counts and turn rates (all data tables).
- Blink duration within 2-3 s, the bomb invulnerability tail length, crystal bounce speed and cycle timing.
- Gallery enemy roster details, HP, spawn loop and enemy bullet speeds (keep Raiden pacing, not bullet hell).
- Lighting rig, bloom tuning per tier, particle system design (GPU instanced points or sprites), scorch-mark technique (decals vs terrain texture writes), and shadow technique (blob/projected shadows are fine).
- Protocol/buffer layout changes (bump `PROTOCOL_VERSION`; header slots 12-15 are spare) and the event ring for SFX and effect spawns.
- Exact hitstop frame counts and shake amplitudes within D-26.

### Deferred Ideas (OUT OF SCOPE)
- Score values for the Lv5 "MAX" pickup bonus: the event is recorded now and points are awarded once scoring exists (Phase 3).
- An X key as an extra bomb alias for Z/X players: declined for now, could become a Phase 4 option.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLYR-04 | Collect red/blue/purple weapon pickups | `PickupPool` with cycling crystal + fixed-color kinds (Pattern 4); pickup collected by ship body circle (not the 2-unit hitbox) |
| PLYR-05 | Same color levels up to 5, different color switches (keeps level, D-07) | `WeaponLoadout` pure state machine + data tables (Pattern 3) |
| PLYR-06 | Death loses power, recovery pickup drops nearby | Player-life state machine (Pattern 5); death penalty -2 (D-04); fixed-color +1 pickup (D-05) |
| PLYR-07 | Bomb: limited stock, clears bullets, damages enemies, invulnerable | `Bomb` state machine launch -> blast; bullet clear; per-N-tick damage (Pattern 6) |
| PLYR-08 | Deathbomb grace window | GRACE phase of the life state machine; bomb-press latch across frames (Pitfall 1) |
| PLYR-09 | Bomb pickups restock | Bomb pickup kind dropped by ground targets (D-19); stock clamp 7 (D-10) |
| PLYR-10 | Respawn invulnerable and visibly blinking | RESPAWN fly-in + blink ticks in header; JS blinks the hull only (Pitfall 9) |
| INPT-03 | Large on-screen touch bomb button | DOM circle button, pointer-event latch, excluded from drag (Pattern 9) |
| VISL-01 | All models procedural in code | Model kit + per-kind generators with `detail` parameter (Pattern 8) |
| VISL-02 | Dynamic lighting + bloom on emissives | Fixed pool of PointLights (count never changes), HDR emissives, bloom re-tune (Pattern 10, Pitfall 5) |
| VISL-03 | Particle explosions sized by class | GPU ring-buffer particle system driven by events (Pattern 7) |
| VISL-04 | Shake + hitstop on big events only | Python hitstop freeze; render-only shake applied and restored around render (Pattern 11, Pitfall 3) |
| VISL-05 | Enemy bullets readable | Pink reserved palette + dedicated post-bloom bullet pass + palette hue test (Pattern 12) |
| VISL-06 | Air units cast readable shadows | Uncompensated blob shadows on the terrain plane (Pattern 13) |
| ENMY-08 | Hit flash, explosion, wrecks on ground units | `flash` ticks in enemy channel, EXPLOSION events with class + ground flag, wreck ring (Patterns 7, 14) |
| STGE-04 | Persistent scorch marks and burning wrecks | Terrain-anchored decal ring + wreck ring in a ray-compensated ground layer (Pattern 14) |
| AUDI-01 | Synthesized SFX for all events | Vendored zzfx `buildSamples` -> AudioBuffer bank + voice limiter (Pattern 15) |
| AUDI-03 | Audio works on iOS after start tap | Reuse gate `AudioContext`, `audioSession` hint, re-resume on later gestures (Pattern 15, Pitfall 10) |
</phase_requirements>

## Summary

Phase 2 is a large, mostly additive phase on top of a clean Phase 1 seam. The Python core stays a pure deterministic `tick()` that packs float32 channels; everything Phase 2 adds fits the existing pattern (struct-of-arrays pools, grid broadphase, one batched call per frame). The new work splits into five independent-ish workstreams: (1) Python combat core (enemy pool and gallery, weapons/pickups, bomb, player life state machine, collision pairs, event ring); (2) a protocol v2 bump (bigger header, new channels, events); (3) JS rendering of the effect stack (models, particles, lights, shadows, decals, bullet pass, shake, bomb FX); (4) audio (zzfx bank, voice limiter, iOS hardening); (5) touch bomb button and device validation. [VERIFIED: read of game.py, protocol.py, render_sink.py, main.js, renderer_rig.js, post_pipeline.js]

The riskiest items are not algorithmic. They are (a) correctness traps at the sim/render seam: a bomb press edge lost on a 0-step frame, stale events replayed on a 0-step frame, terrain extrapolation jittering during hitstop, storm bullets killing the player; (b) a rendering-geometry problem for ground targets: terrain sits 40 units below the gameplay plane (`depthY = -40`), so a tank drawn on the terrain is visibly offset from where the player's bullets (on the plane) hit it. This needs a ray-compensating "ground layer" transform (derived and measured below: k between 1.04 and 1.08 across aspect ratios); (c) mobile fill-rate: Phase 1 left no recorded phone numbers, so the effect stack has no baseline to be compared against; and (d) bullet readability under bloom: bullets in the same pass as fire get bloom-washed, so they need a dedicated pass after bloom.

Python budget is healthy. Measured in real Pyodide 314.0.7 on Node 24 this session: 128 player bolts vs 40 enemies through the existing grid = 0.70 ms per step, 300 enemy bullets vs the player hitbox = 0.056 ms, 15 homing missiles retargeting every tick against 40 enemies = 0.144 ms. The Phase 1 baseline (`make perf`) re-measured at 0.5804 ms average. The 3 ms average budget holds if the gallery caps live enemies (~40), player shots (128) and enemy bullets (~200 gallery bullets), and if the perf harness is extended to drive each weapon and the bomb.

**Primary recommendation:** Bump the protocol to v2 (header 32 slots, `enemies`/`pickups`/`events` channels, missiles packed into the player-shot channel by kind), build the Python combat core first with exhaustive pytest, keep all visuals event/channel-driven in JS, render enemy bullets in a dedicated pass after bloom, and capture the missing Phase 1 phone baseline before any effect code lands.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Weapon levels, fire patterns, beam/missile logic | Python core | — | Changes gameplay outcomes; must be deterministic and pytest-covered |
| Bomb state machine, invulnerability, bullet clear | Python core | — | Outcome-affecting; fixed-step ticks |
| Player life: hit, deathbomb grace, death, respawn | Python core | JS (blink/hide presentation) | Outcome-affecting; JS only renders header state |
| Hitstop | Python core (freeze `_step`) | JS (freeze particle clock) | D-27: freezes sim deterministically; renderer keeps drawing |
| Screen shake | JS renderer | — | D-27: render-only camera offset |
| Enemy/pickup simulation, gallery spawner, enemy fire | Python core | — | Outcome-affecting |
| Collision (shots, beam, bomb, bullets, bodies, pickups) | Python core | — | Outcome-affecting; goes through grid where it is pairwise |
| Effect/SFX trigger events | Python core (emits semantic events) | JS (maps to visuals/audio) | Python stays free of visual knowledge |
| Particles, lights, shadows, decals, wrecks, bomb fireball | JS renderer (GPU) | — | CLAUDE.md: no Python particle sim; GPU-driven from events |
| Procedural models | JS renderer | Python (kind id table) | Models are presentation; Python owns kinds, radii, HP |
| Enemy-bullet render pass and palette | JS renderer | — | Post-bloom dedicated pass |
| SFX synthesis, voice limit, cooldown, iOS unlock | JS (WebAudio) | Python (event ids) | AudioContext must be created in a gesture handler in JS |
| Touch bomb button and drag exclusion | JS input (DOM) | Python (BOMB bit edge) | Pointer events live in the browser; edge detection already in Python |
| "MAX" flash / readout | JS DOM overlay | Python (event/header) | Presentation only |
| Quality tier knobs for effects/models | JS (`tiers.js`) | — | Phase 1: presentation only, never reaches Python |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Pyodide | 314.0.7 (pinned in package.json) | Python sim in WASM | Locked by CLAUDE.md; unchanged [VERIFIED: package.json] |
| three | 0.186.1 (pinned) | Rendering, `InstancedMesh`, `PointLight`, `EffectComposer`, `RenderPass`, `UnrealBloomPass`, `OutputPass`, `BufferGeometryUtils.mergeGeometries` | Locked; all needed pieces ship in-box [VERIFIED: node_modules/three/package.json version "0.186.1"; examples/jsm/utils/BufferGeometryUtils.js:133 `function mergeGeometries( geometries, useGroups = false ) {`] |
| Vite | 8.3.4 | Build | Unchanged |
| vitest | 5.0.5 | JS unit tests (node env; THREE geometry works headless) | Existing [VERIFIED: package.json] |
| Playwright | 1.64.1 | e2e against production build | Existing [VERIFIED: package.json] |
| pytest + pytest-cov | 9.1.1 / 7.1.0 | 100% line+branch gate | Existing [VERIFIED: pyproject.toml] |
| zzfx synthesis algorithm | 1.4.0 (MIT) | Sample generation for SFX | CLAUDE.md-mandated. **Vendor `buildSamples` instead of `npm install zzfx`** (see Pitfall 11 and the audit below) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `three/addons/utils/BufferGeometryUtils.js` | in three 0.186.1 | `mergeGeometries` for multi-part vertex-colored models | Every model generator (one draw call per kind) |
| Web Audio nodes (`GainNode`, `DynamicsCompressorNode`, `AudioBufferSourceNode`) | platform | SFX mix bus and voices | Always |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vendored zzfx `buildSamples` | `npm install zzfx@1.4.0` | The package's `ZzFX.js` constructs `new AudioContext` at import time (a second, never-unlocked context, and it throws in node/vitest), so it needs a dynamic import after the gate and a context swap. Vendoring ~100 lines of MIT code is simpler and avoids the SUS verdict. |
| Instanced camera-facing quads for particles | `THREE.Points` + `gl_PointSize` | Points are simpler but point-size caps vary by mobile GPU; quads match the existing `bullet_instances.js` pattern. Use quads. |
| Post-bloom bullet `RenderPass` | Same-pass bullets with LDR colors | Cheaper but bloom from fire still adds on top of bullets; low tier has no composer so it needs the renderOrder fallback anyway. Use both (Pattern 12). |
| Decal quads for scorch | Terrain texture writes | Terrain chunks are recycled and regenerated; per-chunk canvases would need re-composition. Decals are simpler. |

**Installation:** nothing to install if zzfx is vendored. If the planner overrides and installs the package:
```bash
npm install zzfx@1.4.0 --save-exact   # only after a checkpoint:human-verify (SUS verdict)
```

**Version verification:** `npm view zzfx version` -> `1.4.0`; modified 2026-10-01. Package files: `ZzFX.js`, `ZzFXMicro.js`, `ZzFXMicro.min.js`, `wav.js` [VERIFIED: npm view + npm pack inspection this session].

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| zzfx | npm | first release 2021-08 (1.1.8); latest 1.4.0 published 2026-10-01 | ~7.3k/wk | github.com/KilledByAPixel/ZzFX | SUS (reason `too-new`, driven by the latest version date, not the package age) | Flagged. Recommended path is to **vendor the algorithm** (no install). If installed instead, planner must add `checkpoint:human-verify` before `npm install`. |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** `zzfx` [WARNING: flagged as suspicious — verify before using.] (seam: `signals.postinstall: null`, `deprecated: false`; version history shows 8 releases since 2021, which is consistent with a real, long-lived package). No other new packages are required by this phase.

*The legitimacy command output was obtained from `gsd-tools query package-legitimacy check --ecosystem npm zzfx` this session.*

## Architecture Patterns

### System Architecture Diagram

```
 keyboard (Shift/K) ──┐
 touch drag ──────────┼─> input_sampler ─> tick(dt, buttons, move, drag)  [1 FFI call/frame]
 touch bomb button ───┘          (BOMB bit latched in JS and again in Python)
                                        │
        ┌───────────────────────────────▼─────────────────────────────────────────┐
        │ PYTHON  Game.tick(): reset EVENT_N=0, latch BOMB edge, FixedStepRunner  │
        │   per 60 Hz _step (skipped entirely while hitstop > 0):                │
        │   terrain.step ─> player life SM (alive/grace/dying/respawn)           │
        │   ─> weapon fire (vulcan fan | beam | missiles) ─> bomb SM             │
        │   ─> integrate pools ─> enemies step + gallery spawner + enemy fire    │
        │   ─> collisions: shots/missiles vs enemies (grid) | beam vs enemies    │
        │      | bomb vs enemies | ebullets vs hitbox | bodies vs ship          │
        │      | pickups vs ship body ─> kills: events + drops                  │
        │   ─> push events (explosion class, hit, pickup, bomb, death, sfx)     │
        └───────────────┬─────────────────────────────────────────────────────────┘
                        │ RenderSink.flush: header always; channels only if steps>0
        ┌───────────────▼─────────────────────────────────────────────────────────┐
        │ JS  per frame                                                          │
        │  header ─> ship pose/blink/hide, beam quad, bomb FX phase, hitstop flag│
        │  channels ─> enemy InstancedMeshes (per kind), pickups, player shots,  │
        │              enemy bullets, shadows (from enemy channel)               │
        │  events ─> fx_dispatcher ─┬─> particle ring (GPU shader, tier-scaled)  │
        │                           ├─> light pool (fixed N PointLights)         │
        │                           ├─> decal ring + wreck ring (ground layer)   │
        │                           ├─> shake state (render-only offset)         │
        │                           ├─> DOM flash ("MAX")                        │
        │                           └─> sfx_player (voice limit + per-id cooldown)│
        │  render: scene ─> bloom ─> bullet pass (clearDepth) ─> OutputPass      │
        │          (low tier: renderer.render(scene) then render(bulletScene))   │
        └─────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
src/scorched_core/
├── protocol.py            # v2: header slots, channel strides/caps, EV_* ids, STATE/PHASE ids (constants only)
├── tuning.py              # all numbers incl. weapon tables, enemy kinds, timings (constants only)
├── weapons/               # weapon_kind.py (IntEnum), weapon_loadout.py, vulcan.py, laser_beam.py, homing_launcher.py
├── pools/                 # bullet_pool.py (+angle column), missile_pool.py, pickup_pool.py, enemy_pool.py
├── entities/              # player_ship.py (existing), player_life.py (state machine); drone_swarm.py REMOVED
├── bombs/                 # bomb.py
├── events/                # event_ring.py (preallocated array('f'), stride 6, cap 128, drop counter)
├── gallery/               # gallery_spawner.py (scripted loop), enemy_ai.py helpers (movement/fire as functions)
├── collision/             # circle_hits.py (+ resolve_* functions), uniform_grid.py (existing)
└── game/game.py           # owns tick, _step order, hitstop, header pack
tests/scorched_core/...    # mirrors exactly (tests/test_conventions.py enforces it)
src/scorched_web/bridge/render_sink.py   # unchanged mechanism; new channel names flow through

web/src/
├── audio/        # zzfx_synth.js (vendored), sfx_table.js, sfx_bank.js, sfx_player.js, audio_keepalive.js
├── fx/           # fx_dispatcher.js, particle_system.js, explosion_recipes.js, light_pool.js, shake.js,
│                 # decal_ring.js, wreck_ring.js, shadow_instances.js, bomb_fx.js, beam_mesh.js, palette.js
├── render/       # ground_layer.js, model_kit.js, models/{jet,helicopter,tank,turret,carrier,heavy}.js,
│                 # enemy_instances.js, pickup_instances.js, bullet_instances.js (upgraded), bullet_layer.js
├── input/        # bomb_button.js, bomb_button_layout.js (pure), touch_input.js (exclusion)
└── quality/      # tiers.js (+ particleScale, lights, modelDetail, maxDecals)
web/test/...      # mirrors
```

### Pattern 1: Protocol v2 (bump, do not squeeze)
**What:** Slots 12-15 are spare, which is not enough. Bump `PROTOCOL_VERSION` to 2, grow `HEADER_LEN` to 32, add channels, and update the single hard-coded check in `python_bridge.js`.
**Verified current state:** `PROTOCOL_VERSION: Final = 1` (protocol.py:5), `HEADER_LEN: Final = 16` (protocol.py:12), `# Slots 12-15 are spare.` (protocol.py:25), `PBULLET_CAP: Final = 128` (protocol.py:32), and `if (manifest.protocol !== 1) {` (python_bridge.js:33). [VERIFIED: files read this session]
**Proposed layout** (names are a recommendation; the manifest exports whatever Python defines, JS never hard-codes numbers):

| Header slot | Name | Meaning |
|---|---|---|
| 0-7, 9, 10 | unchanged | STEPS, SCROLL_Y, ALPHA, SHIP_X, SHIP_Y, FLAGS, PBULLET_N, EBULLET_N, TICK_COUNT, STORM_HITS |
| 8 | ENEMY_N | replaces DRONE_N |
| 11 | KILLS | replaces DRONES_DOWN (e2e currently reads both: `tools/e2e/shooting.spec.js:21,27,34`) |
| 12 | PICKUP_N | live pickups |
| 13 | EVENT_N | events pushed this tick (reset to 0 at the start of every `tick()` call) |
| 14 | EVENT_DROPPED | overflow counter (debug) |
| 15 | WEAPON | 0 red/vulcan, 1 blue/laser, 2 purple/homing |
| 16 | LEVEL | 1..5 |
| 17 | BOMBS | 0..7 |
| 18 | PLAYER_PHASE | ALIVE / GRACE / DYING / RESPAWN |
| 19 | INVULN | ticks of invulnerability left (JS blinks while > 0) |
| 20 | BEAM_W | 0 = off, else beam half-width |
| 21 | BEAM_TOP_Y | where the beam ends (screen-space y of its top) |
| 22 | BOMB_PHASE | NONE / LAUNCH / BLAST |
| 23 | BOMB_X, 24 BOMB_Y, 25 BOMB_T | position and 0..1 progress within the phase |
| 26 | HITSTOP | ticks of hitstop left (JS freezes particle clock and terrain extrapolation) |
| 27 | MAX_BONUS | cumulative D-06 MAX events (recorded for Phase 3) |
| 28 | GRACE_LEFT | deathbomb ticks left (UI/debug) |
| 29-31 | spare | |

**Channels (float32, stride x cap):** `enemies` stride 8 (`x, y, kind, angle, flash, hp_frac, aux, spare`; cap 48), `pickups` stride 4 (`x, y, color_now, kind_flags`; cap 16), `events` stride 6 (`type, x, y, a, b, c`; cap 128), `pbullets` stride 4 unchanged but **cap raised** and **missiles share it** with `kind` in slot 3 (vulcan bolt vs missile), `ebullets` unchanged.
**Why `assign`-only-on-bulk matters:** `RenderSink.flush` assigns the header on every tick but other channels only when `steps > 0` (render_sink.py `flush(self, *, bulk)`). Anything JS must not replay (events) therefore has to be zeroed through the always-written header (Pitfall 2).

### Pattern 2: `_step` order and hitstop gate
**What:** One prescriptive order per step (determinism and test scripting depend on it):
```
if hitstop > 0: hitstop -= 1; return              # no sim at all, tick_count not advanced
terrain.step()
life.step(...)            # includes consuming the latched bomb press
weapon.step(...)          # vulcan | beam | missiles, uses life.can_fire
bomb.step(...)
pools: pbullets.integrate; missiles.steer+integrate; ebullets.integrate; cull
enemies.step(); gallery.step(); enemy fire -> ebullets.spawn
collisions (below)
life.resolve_hit(...)     # enemy bullets / bodies; ignored when invulnerable
events.push(...)
```
**Collision pairs and structure** (each is a function in `collision/`, `rebuild` the grid once per step for enemies):
1. player bolts and missiles vs enemies: generalize `resolve_shots_vs_drones` (grid broadphase, descending bolt order with immediate `remove_at`, which Plan 01-07 chose) to read a per-enemy `radius` column and take a `damage` argument. Grid cell is `GRID_CELL = 32.0`; the 3x3 query requires `enemy_radius + bullet_radius <= cell`, so cap enemy radius at ~28. [VERIFIED: circle_hits.py, tuning.py:36 comment]
2. beam vs enemies: rectangle (x +- half-width, y from beam top to ship) vs enemy circle, O(live enemies <= 48), no grid needed. Applies damage on a fixed cadence (e.g. every 3rd tick) so HP stays integral and spark/SFX rates are bounded. Pierces all enemies in its column (Raiden DX behaviour) `[ASSUMED]`.
3. bomb blast vs enemies: circle of growing radius around the detonation point; damage every N ticks.
4. enemy bullets vs player hitbox: linear scan with a squared-distance early-out. Measured 0.056 ms for 300 bullets in Pyodide. The existing `BulletStorm.step` already does this for storm bullets. [VERIFIED: measured this session]
5. enemy bodies vs ship: <= 48 circle tests. 6. pickups vs **ship body circle** (use a larger "pickup radius" ~ `SHIP_HALF_W`, not the 2.0 hitbox). 

**Hitstop only ends sim, not input latching.** `Game.tick` runs `input.update` outside `_step` (game.py). Keep that, and latch (Pitfall 1).

### Pattern 3: Weapons as data
**What:** `WeaponKind` `IntEnum` (VULCAN=0, LASER=1, HOMING=2) matches the crystal color order red -> blue -> purple and the header `WEAPON` slot. `WeaponLoadout` is a tiny dataclass (`kind`, `level`) with `collect(color) -> Outcome` (RAISED / SWITCHED / MAXED), `penalize()` (-2, floor 1). Per-level tables live in `tuning.py` as nested tuples (the file is on the constants-only allow-list; it may not define classes or functions).
**Starting values** (all `[ASSUMED]` tuning, planner adjusts):

| Level | Vulcan streams (angle deg from straight up) | Fire interval (ticks) | Laser half-width (units) | Laser dmg per 3 ticks | Missiles per volley | Volley interval | Missile dmg |
|---|---|---|---|---|---|---|---|
| 1 | 2 parallel (0, offset +-5, as TwinShot today) | 5 | 2.0 | 1 | 1 | 14 | 3 |
| 2 | 3 (0, +-7) | 5 | 3.0 | 2 | 2 | 14 | 3 |
| 3 | 4 or 5 (0, +-6, +-12) | 5 | 4.0 | 3 | 3 | 13 | 3 |
| 4 | 5 (0, +-8, +-16) | 4 | 5.5 | 4 | 4 | 12 | 3 |
| 5 | 7 (0, +-7, +-14, +-21) | 4 | 7.0 | 5 | 5 | 12 | 4 |

Homing: acquire the nearest live on-screen enemy to the missile (stable `uid`, not an index, because enemy `remove_at` swap-removes), retarget every ~8 ticks or when the target dies, steer by clamping the signed angle delta (wrapped to [-pi, pi]) to a per-tick turn rate (~4-6 degrees), launch with a sideways spread so missiles visibly curve, lifetime ~90 ticks. Cost measured at 0.144 ms for 15 missiles retargeting every tick. [VERIFIED: measured]
**Pickup rules:** same color at Lv5 -> `MAX` event (flash + SFX now; counter for Phase 3); different color -> switch type keep level (D-07); recovery pickup is a fixed-color +1 (D-05); bomb pickup +1 clamp 7 (D-10).

### Pattern 4: Pickups and crystals
Pickup kinds: 0/1/2 fixed red/blue/purple (recovery), 3 cycling crystal, 4 bomb. Python computes `color_now = (age // CRYSTAL_CYCLE_TICKS) % 3` (90 ticks = 1.5 s, D-16) and packs it, so JS never recomputes color (the color at pickup is decided in Python from the same value the player saw in the previous packed frame; accept a one-step skew). Bounce off playfield walls; a lifetime (~10 s) then drift off the bottom so the gallery never fills. Carriers (D-19) drop a crystal on kill, designated ground kinds drop a bomb pickup, death drops the recovery pickup near the death spot (clamped inside the playfield).

### Pattern 5: Player life state machine
`PlayerLife` (class in `entities/player_life.py`) with a `PlayerPhase` `IntEnum`: `ALIVE -> GRACE -> DYING -> RESPAWN -> ALIVE`, driven only by tick counters (`match` on the phase fits here).
- **Hit while ALIVE and not invulnerable** -> `GRACE` for `DEATHBOMB_TICKS` (~8). Further hits are ignored in GRACE.
- **Bomb pressed in GRACE with stock > 0** -> cancel: back to ALIVE, invulnerability from the bomb, stock -1. Order inside the step: resolve the bomb press **before** enemy collision so a same-tick press saves the player. Hitstop does **not** start at the hit; it starts at *confirmed death*, so the grace window is never eaten by the freeze.
- **GRACE expires** -> death: `WeaponLoadout.penalize()`, drop recovery pickup, `EV_PLAYER_DEATH`, hitstop ~6 ticks (D-26), ship hidden, `DYING` for ~45-60 ticks (explosion plays, no control, no fire).
- **RESPAWN:** ship y starts below `PLAYFIELD_H` and rises at a fixed speed to `SHIP_START_Y`; control returns on arrival (D-14). Bomb stock is raised to `max(stock, 3)` at respawn (D-10). Invulnerability ~150 ticks (2.5 s, D-14); movement and fire allowed while blinking (D-15).
- Bomb invulnerability = blast duration + tail; use a shared `invuln` counter taking the max of sources.

### Pattern 6: Bomb state machine
`Bomb` (class in `bombs/bomb.py`): `NONE -> LAUNCH (~25 ticks, missile rises from the ship) -> BLAST (~90 ticks = 1.5 s)`. At the LAUNCH->BLAST transition: clear all gameplay enemy bullets (`ebullets.n = 0` on the gallery pool only, see Pitfall 4), emit `EV_BOMB_DETONATE`, start 3-4 hitstop ticks and shake (JS). During BLAST: damage enemies in the growing radius every N ticks, keep clearing bullets while the radius covers them (recommended; Raiden has no bullets inside the nuke), grant invulnerability through BLAST + tail. A second bomb press while one is active is ignored. Stock check on press.

### Pattern 7: Event ring and GPU particles
**Event ring (Python):** preallocated `array('f')` stride 6 cap 128 (`type, x, y, a, b, c`), `n` reset at the start of **every** `tick()` call, overflow drops low-priority events and increments `EVENT_DROPPED`. Merge noisy events at the source: emit `EV_HIT` only when the enemy's `flash` was 0 (a continuously hit enemy is one spark burst per flash window, not per bullet). Event ids are `protocol.py` constants exported through the manifest.
Suggested types: `EXPLOSION` (a = class small/medium/large, b = ground flag), `HIT`, `SHOT` (a = weapon), `PICKUP` (a = kind), `MAX_BONUS`, `WEAPON_SWITCH`, `BOMB_LAUNCH`, `BOMB_DETONATE`, `PLAYER_HIT` (grace begins), `DEATHBOMB_SAVE`, `PLAYER_DEATH`, `RESPAWN`, `ENEMY_FIRE`.
**Particles (JS):** one `InstancedBufferGeometry` of camera-facing quads, a CPU ring `Float32Array` per attribute (`start xyz, velocity xyz, spawnTime, lifetime, size, colorId`), written when events arrive and uploaded with `addUpdateRange` for the written span only (same technique `bullet_instances.js` already uses). The vertex shader computes `pos = start + vel*t + 0.5*g*t^2`, size/alpha curves from `t/lifetime`; no per-frame JS loop over particles. Two draws: additive (fire, sparks, glow; HDR colors so they bloom) and normal-blend dark (smoke, debris). Capacity by tier (suggest 2048 / 1024 / 512, `[ASSUMED]`); recipes scale **count** by tier but keep the explosion's **size** (Pitfall 9 in PITFALLS: "cut count on low tiers, not the explosion's perceived size"). The shader clock `uTime` is JS-owned and **held while `HITSTOP > 0`**.

### Pattern 8: Procedural model kit (D-24, D-25)
`model_kit.js` exposes small helpers: `lathe(profile, detail)`, `beveledExtrude(shape, depth, detail)`, `capsule`, `tint(geometry, color)` (writes a `color` vertex attribute), `bake(parts)` (apply each part's matrix, then `mergeGeometries`). Each `models/<kind>.js` returns `{ body, glow }` geometries for a `detail` of `'high' | 'mid' | 'low'` (cached per `(kind, detail)`; a tier change swaps `mesh.geometry`, not instance buffers).
- **Gotcha:** `mergeGeometries` returns `null` (and logs) when parts differ in attributes or index presence. Normalize every part to the same attribute set (`position`, `normal`, `uv`, `color`) and index state (call `toNonIndexed()` consistently) in `bake`. [VERIFIED: BufferGeometryUtils.js:158,169,186 error messages]
- Smooth look: `LatheGeometry`/`CapsuleGeometry` bodies, `ExtrudeGeometry` with `bevelEnabled: true, bevelSegments` 3/1/0 and curve segments by detail, normals smooth (`flatShading: false`). Military palette in vertex colors, bright accents in the separate `glow` geometry (HDR `MeshBasicMaterial`, as `engineGlowMesh` does today).
- The enemy hit flash keeps the Phase 1 mechanism: a HDR `instanceColor` multiplier (>1 crosses the bloom threshold). `instanceColor` multiplies `vColor` [VERIFIED: three color_vertex.glsl.js:20 `vColor.rgb *= instanceColor.rgb;`]. A shader-injected white mix is optional polish.
- One `InstancedMesh` per kind for the body plus one for glow; turrets/rotors that rotate independently are a second instanced part driven by the `angle`/`aux` field. Total draw calls stay well under 40.
- The existing `ship_model.test.js` asserts the flat Phase 1 silhouette (e.g. "is flat: thinner than 3 units"); it must be rewritten with the upgraded ship, keeping the hitbox marker (renderOrder 20/21) intact.

### Pattern 9: Touch bomb button (INPT-03)
- A DOM `<button id="bomb-button">` inside `#app`, shown only in touch mode (`sampler.touchMode`). Pointer events (`pointerdown`/`pointerup`/`pointercancel`) set a held flag and a `pressedSinceSample` flag, exactly like keyboard (`keyboard_input.js` `pressedSinceSample`), and `sample()` ORs `buttonBits.BOMB` into `buttons`. [VERIFIED: keyboard_input.js pattern]
- **Drag exclusion:** `touch_input.js` listens for `pointerdown` on `#app`, so a press on the button bubbles up and starts steering. Add an early return in `onDown` when `event.target.closest('[data-no-steer]')` (and have the button not call `setPointerCapture` on `app`). A second finger on the button while another steers works because pointer events are per `pointerId`.
- **Layout (pure function, unit-tested):** from `projectCorners(...)` (already exported by `camera_fit.js`) compute the playfield's screen rect and the free margin. If a margin of at least the button diameter exists to the right/bottom, put the button in it; otherwise overlay the playfield's bottom-right corner (D-13). Size ~ `clamp(15vmin, 72px, 112px)`, `touch-action: none`, ARIA label, respects `env(safe-area-inset-*)`. Position on resize and tier change.
- Keep `-webkit-touch-callout: none; user-select: none` (already on `#app`).

### Pattern 10: Lighting and bloom
- **Fixed light count, always.** Point-light count is part of the shader program key, so adding or removing a light recompiles every lit material: `array.push( parameters.numPointLights );` (WebGLPrograms.js:478) and `hash.pointLength !== pointLength` (WebGLLights.js:497). [VERIFIED: grep of node_modules/three/src/renderers/webgl] Create a pool of 3 `PointLight`s at load, animate **intensity only**, and `prewarm()` once with them present. The low-tier lever, if phones need it, is `visible = false` on pool lights **plus prewarming that state at load** (Phase 1 already prewarms both render paths).
- **Falloff:** `getDistanceAttenuation` is `1.0 / max( pow( lightDistance, decayExponent ), 0.01 )` times a window `pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) )` when `distance > 0` (lights_pars_begin.glsl.js:56-71). With `decay = 0` the intensity is distance-independent inside the cutoff, which is far easier to tune for arcade flashes than physical inverse-square. [VERIFIED: file quoted] Use `decay` 0-1 with a `distance` of ~80-140 units; place lights ~15-25 units above the terrain-facing plane.
- **Bloom washout:** Phase 1 already found strength 1.0 / radius 0.4 washed out a 500-bullet frame and settled on `strength 0.45 / radius 0.25 / threshold 1.0` (STATE.md 01-03). Terrain lit by an explosion light must stay below the threshold except near the core or the whole ground blooms. Tune light intensity against terrain albedo, then re-tune bloom on the high tier only. A bomb can spike `bloomPass.strength` for ~0.3 s (cheap, no new pass).
- **Emissive discipline unchanged:** only HDR emitters exceed 1.0.

### Pattern 11: Shake and hitstop
- **Shake (render-only):** pure state module `shake.js` (`trigger(amplitude, durationS)`, `update(dt)`, decaying amplitude, noise from a render-local PRNG). Apply it by adding the offset to `camera.position` immediately before the render call(s) and **subtracting it right after**, so `touch_mapper`, `projectPoint`, the fit and the debug hooks always see the unshaken camera. Do not parent the camera to a group and do not touch `applyCameraFit`.
- **Hitstop (sim):** the `_step` early-return above. `MAX_STEPS = 3` catch-up (fixed_step_runner.py:8) cannot skip it. JS reads `HITSTOP` and (a) holds the particle clock, (b) holds terrain extrapolation: `rig.terrain.update(SCROLL_Y + ALPHA * scroll_speed)` would otherwise keep animating `ALPHA` against a frozen `SCROLL_Y` and visibly stutter (Pitfall 3).
- Values (D-26): bomb 3-4 ticks + strong shake ~0.5 s; player death ~6 ticks + medium shake; nothing for hits/kills.

### Pattern 12: Bullet readability (VISL-05)
- **Palette module** `web/src/fx/palette.js`: named constants for every effect color (fire, smoke, spark, laser, missile, vulcan tracer, crystal colors, player shield glow). Enemy bullet: hot pink hue ~330 degrees with a white core and a **dark rim** (a dark halo is the standard trick that keeps a pink orb legible over bright fire). Laser blue ~210-225 degrees, missiles violet ~265-275 degrees and elongated with a flame trail (shape also separates them from round orbs), vulcan tracers warm yellow-white, fire orange-yellow-white.
- **Enforcement test:** a vitest that converts every palette color to HSL and asserts a minimum hue distance (suggest >= 35 degrees) from the bullet hue for every entry flagged as "effect", so a future tweak cannot leak pink into fire. (Purple crystal and purple missiles are the closest neighbors; keep saturation/brightness separation too.)
- **Dedicated pass:** in the composer path add a second `RenderPass(bulletScene, camera)` with `clear = false` and `clearDepth = true` **between the bloom pass and `OutputPass`**. Verified behaviour: `RenderPass` has `this.clear = true; this.clearDepth = false; this.needsSwap = false;` and renders into `renderer.setRenderTarget( this.renderToScreen ? null : readBuffer );` (RenderPass.js:87,156-158), and `UnrealBloomPass` also has `this.needsSwap = false` (UnrealBloomPass.js:94), so the bullet pass draws onto the already-bloomed buffer and the bloom halo from fire can no longer wash over bullets. [VERIFIED: files read] In the low tier (no composer) do `renderer.render(scene, camera)` then `renderer.autoClear = false; renderer.clearDepth(); renderer.render(bulletScene, camera)`. Bullet material: LDR colors (<= ~0.98 per channel on the halo), `transparent: true`, `depthTest: false`, plus `renderOrder` high, so both paths agree.
- The bullet pass needs its own unit/perf accounting: `debug_session.js` sets `info.autoReset = false` and reads/resets once per frame (STATE 01-04), so draw-call counts already cover multiple passes.

### Pattern 13: Shadows for air units (VISL-06)
One `InstancedMesh` of soft dark quads on the terrain plane (y = terrain depth + small epsilon), drawn with normal alpha blending before the dim mask (`renderOrder` < 5). Position = unit `(x + SUN_OFFSET_X * altitude, z + SUN_OFFSET_Z * altitude)`. **Do not apply the ground-layer compensation to shadows:** the whole point is that the shadow is displaced from the unit on screen (the unit is 40 units above the terrain, and the 25-degree tilted camera shows that offset), which is the altitude cue. Instances come from the `enemies` channel (air kinds only) plus the player ship. No shadow maps (PITFALLS 9).

### Pattern 14: Ground layer, wrecks, scorch marks (D-21, STGE-04)
**The problem.** Gameplay and bullets live on the `y = 0` plane, but the terrain is at `depthY = -40` (terrain_ring.js:114 `depthY = -40,`). A tank drawn on the terrain at its logical `(x, z)` appears offset from where the player's bullets visibly hit it.
**The fix.** Author all terrain-anchored visuals (ground targets, wrecks, scorch decals) in *logical plane coordinates* inside one `THREE.Group` whose transform is the central projection from the camera onto the terrain plane: `P' = C + k * (P - C)` with `k = (C.y + 40) / C.y`, i.e. `position = C * (1 - k)`, uniform `scale = k`. A plane point then lands on the terrain along the same camera ray, so it projects to the same screen pixel as the bullet plane point. Recompute only when the camera refits (resize).
**Measured k** with the repo's own `fitCamera` (25 degree tilt, 30 degree FOV, playfield 240x320): phone 9:19.5 -> 1.0411; 4:3 portrait -> 1.0646; square, 16:9, ultrawide -> 1.0794 (camera Y 973.5 / 619.0 / 503.6). [VERIFIED: run this session with web/src/render/camera_fit.js]
**Scroll consistency.** Terrain scrolls at `SCROLL_SPEED: Final = 0.8` world units per step (tuning.py:22). A ground unit that moves by 0.8 logical units per step appears, after compensation, to move `k * 0.8` on the terrain, i.e. it slides 4-8% against the roads. Give ground kinds a logical downward speed of `SCROLL_SPEED * GROUND_SCROLL_RATIO` with `GROUND_SCROLL_RATIO ≈ 0.94` (= 1/1.065, a constant in `tuning.py`), leaving a residual slide of about +-2% across aspect ratios. Wrecks and decals created at a kill keep moving with the same ratio, so they remain consistent with where the unit died. `[ASSUMED]`: visual acceptability, needs an early look; the alternative is the simple ratio 1.0 and accepting the slide.
**Scorch marks (decals).** A ring of ~48 dark soft quads (`InstancedMesh`, normal blend, polygon-offset or an epsilon above the terrain, below the shadows), each with `{x, y_at_event, scroll_at_event}`; position each frame = `y_at_event + GROUND_SCROLL_RATIO * (scroll_now - scroll_at_event)`. Oldest overwritten; they scroll off the bottom naturally. Cap and tier-scale (e.g. 48/32/16).
**Wrecks.** A ring of ~12 charred-hull instances (same ground layer) that emit a throttled flame/smoke trickle through the particle system (rate scaled by tier) until they leave the screen. Visual only: no Python state.
**Event contract.** `EXPLOSION.b = 1` marks a ground-anchored kill so JS adds a wreck + scorch; air kills and bombs add particles only (bomb adds one large scorch at the detonation point `[ASSUMED]`).

### Pattern 15: Audio (AUDI-01, AUDI-03)
- **Synthesis:** vendor `buildSamples` (MIT, attribution header kept) into `web/src/audio/zzfx_synth.js` as a pure function returning a `Float32Array`/array of samples. The package's `ZzFXMicro.js` and `ZzFX.js` both construct `new AudioContext` at module scope (`const zzfxX = new AudioContext;` / `audioContext: new AudioContext,`), which creates a second never-unlocked context and breaks in node tests. [VERIFIED: tarball source read this session]
- **Bank:** `sfx_table.js` lists `{ id, params, volume, cooldownMs, priority }` (ids mirrored from the manifest event table, not invented in JS). Synthesize sample arrays **during loading** (overlaps the Pyodide download) and create `AudioBuffer`s on the gate's `AudioContext` right after the tap (`waitForStartGesture` already returns `{ audio }`; `audio` may be `null`, so the player must no-op).
- **Playback (`sfx_player.js`):** `AudioBufferSourceNode -> per-sound GainNode -> sfxBus GainNode -> DynamicsCompressorNode -> destination`. Voice limit (~16-24) with priority stealing, per-id cooldown from the table (shots ~60 ms, hits ~40 ms), shots mixed quieter (D-29). The continuous laser is a looped source started/stopped from `BEAM_W` (not an event per tick).
- **Starter sound parameters** are designer-tuned in the ZzFX sound designer; no parameter values are fabricated here. Required set: shots (vulcan, laser hum, missile), hit tick, explosion small/medium/large (noisy + low thump), pickup chime, bomb pickup, weapon-up, MAX, bomb launch and blast, player hit, death, respawn, deathbomb save, enemy fire (quiet).
- **iOS:** the existing gate already uses `click`/`pointerup` (never `pointerdown`/`touchstart`) and plays a silent one-sample buffer inside the handler (start_gate.js `unlockAudio`). Add in a new `audio_keepalive.js`: (1) `navigator.audioSession.type = 'playback'` when present so the silent switch does not mute Web Audio (feature-detect; avoid `transient` types); (2) re-`resume()` on every later `pointerup`/`keydown` while `audio.state !== 'running'`; (3) a `statechange` listener so an `interrupted` state recovers on the next gesture. (4) A visible mute hint is a Phase 4 concern (AUDI-04) but a one-line "no sound? check the ringer switch" note in the debug report is cheap.

### Anti-Patterns to Avoid
- **Per-entity FFI or Python-side particles:** locked out by CLAUDE.md ("What NOT to Use").
- **Changing the PointLight count at runtime:** shader recompiles mid-game (Pattern 10).
- **`pyodide.runPython` or `create_proxy` in the frame path:** unchanged rule; hold `tick` once.
- **Allocating in the Python step** (new lists/tuples per bullet/event): preallocated rings and pools only.
- **Holding `getBuffer().data` views across frames:** keep the `assign()` copy semantics the sink already uses (views detach when WASM memory grows).
- **Shake by moving the camera permanently or via `applyCameraFit`:** breaks touch mapping and the debug projections (Pattern 11).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sound synthesis | A custom oscillator/envelope engine | zzfx `buildSamples` algorithm (vendored, MIT) | 20-parameter synth already covers explosions/blips; CLAUDE.md mandates zzfx |
| Merging multi-part models | Manual vertex concatenation | `mergeGeometries` from `three/addons/utils/BufferGeometryUtils.js` | Handles attribute/index merge; just normalize attributes first |
| Bloom/tone mapping | A custom glow shader | Existing `EffectComposer` + `ScaledBloomPass` + `OutputPass` | Already tiered and tested in Phase 1 |
| Broadphase | New spatial structure | Existing `UniformGrid` (+ linear scan for the 1-target cases) | Phase 1 chose and tested it; naive all-pairs is forbidden by CLAUDE.md |
| Button-edge handling | New debounce logic | Existing `InputFrame.pressed` + the keyboard `pressedSinceSample` pattern | Python already derives edges from consecutive samples |
| Seeded randomness in gameplay | `Math.random`-style sources in Python | `Game.rng` (`random.Random(seed)`) | Determinism for replay-style tests |
| Camera projection helpers | New math for the button layout | `projectCorners` / `fitCamera` in `camera_fit.js` | Already exported, tested |
| Pause/resume plumbing | Custom freeze logic for hitstop | The `_step` early return | A frozen step is just a step that does nothing |

**Key insight:** every hard thing in this phase is a *composition* of seams that already exist (pools, grid, header/channels, tiers, composer, gate). The failure modes are at the joins (edge latching, event replay, clock freezing, coordinate spaces), not inside the pieces.

## Common Pitfalls

### Pitfall 1: Bomb press lost on a 0-step frame, or consumed by the wrong step
**What goes wrong:** `Game.tick` calls `self.input.update(buttons)` then evaluates `pressed()` once per *call* (game.py, the PAUSE edge). On a 120 Hz display half the frames run zero steps, and during hitstop steps run but do nothing; an edge evaluated in `tick()` and acted on only inside `_step` can vanish.
**How to avoid:** in `tick()` OR the edge into a latched `_bomb_requested`; `_step` consumes and clears it on the first live step. Test: press on a frame with `dt_ms = 0`, assert the bomb fires on the next step; test press during hitstop.
**Warning signs:** "I pressed bomb and nothing happened" on high-refresh phones.

### Pitfall 2: Events replayed on frames that run no step
**What goes wrong:** `RenderSink.flush` assigns non-header channels only when `steps > 0`, so on a 0-step frame the `events` buffer is stale. If `EVENT_N` is not zeroed it is re-dispatched (double explosions, doubled SFX, double hitstop feedback).
**How to avoid:** `EVENT_N = 0` at the start of **every** `tick()` before any early return (pause included), then `_pack_header`. Test: tick with dt 0 after an event tick and assert `header[EVENT_N] == 0`. Same rule for the paused branch.

### Pitfall 3: Terrain/particle clocks keep moving during hitstop
**What goes wrong:** Python freezes `SCROLL_Y` but JS extrapolates `SCROLL_Y + ALPHA * scroll_speed`; `ALPHA` keeps cycling, so the ground visibly jitters during the freeze. Particle time advancing makes explosions play through the "freeze".
**How to avoid:** JS reads `HITSTOP` (header slot above): use `ALPHA = 0` for extrapolation and hold `uTime` while it is > 0. Shake keeps running on real time.

### Pitfall 4: Storm bullets kill the player, or the bomb clears the stress load
**What goes wrong:** `?stress=N` fills the same `ebullets` pool with bouncing storm bullets that are intentionally harmless (`storm_hits` only counts). A generic bullets-vs-player resolver would kill the player in the very run used for the phone performance gate; a bomb clearing `ebullets` would also delete the stress load.
**How to avoid:** keep storm bullets in their **own pool**; pack both into the one `ebullets` render channel (give `BulletPool.pack_into` an `offset` and sum the counts in `EBULLET_N`). The player-death resolver, the bomb clear and the gallery spawner only touch the gameplay pool. Keep `storm_hits` as is.

### Pitfall 5: Bloom + fire swallow bullets; explosion lights wash out the ground
**What goes wrong:** Bullets drawn in the same pass as fire receive bloom from the fire on top; ground lit by a bright point light crosses the bloom threshold and glows.
**How to avoid:** Pattern 12 (post-bloom bullet pass) and Pattern 10 (cap light intensity against terrain albedo, tune on the high tier). Worst-case readability test scene: boss-density bullets + bombs + explosions on the busiest terrain at the low tier (PITFALLS 11 recommendation).

### Pitfall 6: Ground targets "miss" because they are drawn on the terrain
See Pattern 14. Symptoms: bullets visibly pass above tanks that register hits, or hit nothing where they appear to hit.

### Pitfall 7: `mergeGeometries` returns `null`
**What goes wrong:** parts with different attribute sets or mixed indexed/non-indexed geometry fail to merge and the model silently disappears (the error goes to the console).
**How to avoid:** a single `bake()` that normalizes attributes; a vitest per kind asserting non-null, finite bounding box, and `vertexCount(high) > vertexCount(mid) > vertexCount(low)` (D-25).

### Pitfall 8: Stale tier-dependent allocations
**What goes wrong:** rebuilding model geometry or particle buffers on a tier change causes hitches or leaks (the controller steps tiers during play).
**How to avoid:** build per-`detail` geometry lazily once and cache; particle capacity is allocated once at the maximum and only the *spawn count scale* changes by tier. Dispose nothing on tier switch.

### Pitfall 9: Blinking hides the hitbox marker
**What goes wrong:** toggling `ship.visible` for the respawn blink also hides the hitbox marker (child of the ship group), when the marker matters most (D-15: the player can move and fire while invulnerable).
**How to avoid:** blink only the hull/glow meshes (opacity or `visible` on `fuselage`/`engine-glow`), keep `hitbox-marker` always visible while the ship is alive; hide hull entirely only in `DYING`.

### Pitfall 10: iOS audio stays silent
**What goes wrong:** context is created/resumed outside a gesture, the hardware silent switch mutes Web Audio, or the context goes `interrupted` after a call/app switch.
**How to avoid:** Pattern 15 (reuse the gate context, `audioSession.type = 'playback'` where present, re-resume on later gestures). Evidence is community/bug-tracker level, not official docs. Verify on a physical iPhone, with the ringer switch both on and off, as an explicit human-verify task.

### Pitfall 11: `import { zzfx } from 'zzfx'` breaks everything
`ZzFX.js`/`ZzFXMicro.js` create `new AudioContext` at import time. In vitest (node) there is no `AudioContext`, and in the browser it creates a second suspended context before any gesture. Vendor the pure function (Pattern 15).

### Pitfall 12: 100% coverage vs. rendering/math branches
New Python state machines have many small branches (overflow drop, same-tick press, clamp edges). Plan tests alongside each class (TDD), build deterministic scripted-input scenario helpers under `tests/` (non-`test_` filenames such as `conftest.py` are exempt from `test_no_orphan_tests`), and avoid `# pragma: no cover`. JS has no coverage gate, but keep geometry/layout/palette/shake/limiter logic in pure modules so they are vitest-able (the e2e suite runs software GL and is slow).

### Pitfall 13: Bomb/touch drag interplay
A pointer that starts on the bomb button must not steer, and a steering pointer must not release the bomb. Also `pause_controller` clears inputs on pause: the button's held flag must be cleared by the same `clear()` (add the button to the `inputs` list given to `createPauseController`, whose `inputs` each need `.clear()`).

### Pitfall 14: Pause/hitstop/deathbomb counting units
All windows are **steps**, not frames or milliseconds. The deathbomb window (8) and hitstop (3-6) must be decremented only in live steps; hitstop must not decrement while paused (the paused branch already returns before the runner).

## Code Examples

### Ground-layer transform (derived; unit-test it)
```javascript
// Source: derived from camera geometry in web/src/render/camera_fit.js (camera.position =
// (0, cos(tilt)*d, targetZ + sin(tilt)*d)); terrain depth -40 from terrain_ring.js.
// Maps a point P on the gameplay plane (y = 0) to the terrain plane along the camera ray.
export function groundLayerTransform(cameraPos, terrainDepth, out) {
  const depth = -terrainDepth;              // 40
  const k = (cameraPos.y + depth) / cameraPos.y;
  out.scale = k;
  out.position.set(cameraPos.x * (1 - k), cameraPos.y * (1 - k), cameraPos.z * (1 - k));
  // P' = C + k (P - C)  =>  P' = k*P + C*(1-k); for y=0: y' = C.y*(1-k) = -depth
  return out;
}
```

### Render-only shake, applied and restored around the render
```javascript
// Source: design for D-27; keeps touch mapping and debug projections on the unshaken camera.
function renderWithShake(rig, shake) {
  const o = shake.offset();                    // {x, z} in world units, (0,0) when idle
  rig.camera.position.x += o.x;
  rig.camera.position.z += o.z;
  rig.camera.updateMatrixWorld();
  rig.render();                                // composer or direct path, plus the bullet pass
  rig.camera.position.x -= o.x;
  rig.camera.position.z -= o.z;
  rig.camera.updateMatrixWorld();
}
```

### Post-bloom bullet pass (composer path)
```javascript
// Source: three@0.186.1 examples/jsm/postprocessing/RenderPass.js (clear / clearDepth / needsSwap=false)
const bulletPass = new RenderPass(bulletScene, camera);
bulletPass.clear = false;        // keep the bloomed HDR scene
bulletPass.clearDepth = true;    // bullets ignore scene depth
composer.addPass(new RenderPass(scene, camera));
composer.addPass(bloomPass);
composer.addPass(bulletPass);    // between bloom and OutputPass
composer.addPass(new OutputPass());
```

### Event ring on the Python side (preallocated, no per-event allocation)
```python
# Source: design; stride/cap are protocol.py constants, shown here as literals for brevity.
class EventRing:
    __slots__ = ("buf", "dropped", "n")

    def __init__(self) -> None:
        self.buf = array("f", bytes(4 * EVENT_STRIDE * EVENT_CAP))
        self.n = 0
        self.dropped = 0

    def clear(self) -> None:
        self.n = 0
        self.dropped = 0

    def push(self, kind: float, x: float, y: float, a: float = 0.0, b: float = 0.0, c: float = 0.0) -> None:
        i = self.n
        if i >= EVENT_CAP:
            self.dropped += 1
            return
        base = i * EVENT_STRIDE
        self.buf[base : base + EVENT_STRIDE] = array("f", (kind, x, y, a, b, c))  # or six scalar stores
        self.n = i + 1
```
(Use six scalar stores in the real code to avoid the temporary array.)

### Bomb-press latch
```python
# Source: design; Pitfall 1.
self.input.update(buttons)
if self.input.pressed(Button.BOMB):
    self._bomb_requested = True          # consumed (and cleared) by the first live _step
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Physical inverse-square point lights tuned in candela | `decay` 0-1 with a distance cutoff for arcade flashes | three r155+ physically-based lights are the default | Intensity tuning is intuitive; `getDistanceAttenuation` supports `decay = 0` [VERIFIED lights_pars_begin.glsl.js:56-71] |
| Silent-switch hacks (looping hidden `<audio>`) | `navigator.audioSession.type = 'playback'` | Safari audio session API, community reports 2023+ | MDN labels it "Limited availability" and experimental; feature-detect and keep the gesture/resume path as the base [CITED: developer.mozilla.org/en-US/docs/Web/API/AudioSession] |
| `THREE.Points` with large `gl_PointSize` | Instanced camera-facing quads | long-standing | Avoids per-GPU point-size caps; same pattern as existing bullet instances |

**Deprecated/outdated:** nothing in the locked stack changes. WebGPU/TSL stays out of scope (CLAUDE.md).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The per-level weapon numbers in Pattern 3 (streams, intervals, widths, damage, missile counts/rates) feel right | Pattern 3 | Tuning only; they are data tables, easy to change |
| A2 | The laser beam pierces all enemies in its column | Pattern 2 | If it should stop at the first enemy, beam top-Y logic and balance change |
| A3 | `GROUND_SCROLL_RATIO ≈ 0.94` leaves an acceptable residual slide against terrain | Pattern 14 | Visible sliding of tanks vs roads; fall back to ratio 1.0 or a smaller terrain depth |
| A4 | The ray-compensating ground group is the right fix for plane/terrain offset | Pattern 14 | Ground units look offset from hits; needs an early visual check on a real viewport |
| A5 | Particle capacity 2048/1024/512, scorch 48/32/16, 3 pool lights are affordable on phones | Patterns 7, 10, 14 | Frame-time regressions on phones; levers are counts and `visible=false` lights |
| A6 | Voice limit 16-24 and cooldowns (shots ~60 ms, hits ~40 ms) are adequate | Pattern 15 | Audio crackle or sparse SFX; tunable |
| A7 | Bomb should keep clearing bullets during the whole blast, and leaves one large scorch at the detonation point | Pattern 6, 14 | Gameplay/visual nuance; D-09 only guarantees the clear at detonation |
| A8 | `navigator.audioSession.type = 'playback'` fixes silent-switch muting on current iOS | Pattern 15 | Silent on muted phones; sources are WebKit bug threads and developer posts, not Apple docs |
| A9 | Enemy cap ~48 and gallery bullet cap ~200 keep Python under 3 ms with every system active | Summary | Budget breach; mitigated by extending `make perf` first |
| A10 | Crystal color skew of one step between the packed frame and the pickup step is acceptable | Pattern 4 | A player may get the color just after the one displayed; tiny and arcade-typical |
| A11 | Phone fill-rate cost of the full effect stack is acceptable at tier mid | Summary | Needs the Phase 1 phone baseline plus a Phase 2 on-device report |

**If this table is empty:** (not empty) — A1-A11 need user/UAT confirmation before they are locked.

## Open Questions

1. **Phone baseline.** STATE.md notes the Android/iPhone stress reports were never pasted into `01-DEVICE-REPORTS.md` (UAT result was "pass" without numbers).
   - What we know: desktop passes at 60 fps with `?debug&stress=500`; phones passed UAT qualitatively.
   - What's unclear: any phone frame-time or tick-time number to compare the effect stack against.
   - Recommendation: make the first plan a `checkpoint:human-verify` that records both phones' Phase 1 reports **before** effects land; the final plan re-runs the same protocol with the gallery and effects on.
2. **Ground-target compensation visual acceptance (A3/A4).** Recommend a very early spike task that renders one tank in the ground layer and checks hit alignment at portrait and landscape.
3. **Should the beam stop at the first enemy?** Raiden DX pierces; Strikers-style lasers often do not. Defaulting to pierce.
4. **Debug/test URL flags.** The Phase 1 grammar reads exactly four parameters (url_flags.js header: "Only these four parameters are read"). Gallery tuning and e2e need `?weapon=`, `?level=`, `?bombs=`, possibly `?god`. Recommend extending the grammar with allow-listed, clamped values validated on both JS and Python sides (like `crash`). Needs a decision because D-15/Phase 1 documented four flags.
5. **Minimal readout.** No HUD until Phase 3, but testers need weapon/level/bombs visible on the live link. Recommend a tiny DOM readout (colored pip, Lv, bomb count) that Phase 3 replaces; at minimum surface them in the `?debug` overlay.
6. **Vendored zzfx vs dependency.** CLAUDE.md names zzfx 1.4.0. The recommended vendored `buildSamples` satisfies the intent without the SUS install; confirm with the user if a literal dependency is wanted.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | Vite, vitest, perf harness | yes | v24.22.0 (`.node-version` 24.22.0) | — |
| uv + Python | pytest gate | yes | uv 0.13.0; Python 3.14.6 | — |
| Pyodide (npm, Node) | `make perf` | yes | 314.0.7 | — |
| Playwright Chromium | `make e2e` | yes | headless shell 1248 | — |
| Real GPU / phones | VISL perf, audio on iOS | not in this environment | — | Human-verify checkpoints (end-of-phase UAT, per `human_verify_mode`) |

**Missing dependencies with no fallback:** none for development. Physical Android + iPhone are required for success criteria 4 and 5 (human-verify tasks).
**Baseline gates re-run this session:** `pytest --cov --cov-branch --cov-fail-under=100` -> 367 passed, 100.00%; `npm run perf` -> `avg_ms 0.5804, p95_ms 0.7181`; `vitest run` -> 25 files, 373 tests passed.

## Project Constraints (from CLAUDE.md)

- Game logic in Python 3.14; type hints everywhere; dataclasses/`__slots__`, enums, `match` where it helps; **ruff** `check` and `format --check` must pass.
- **One class per file**, named after the class in snake_case; domain subdirectories mirrored by `tests/<same path>/test_<module>.py` (enforced by `tests/test_conventions.py`; constants-only allow-list is `protocol.py` and `tuning.py` only, and the core must not import `js`, `pyodide`, `time`, `datetime`).
- **100% line + branch coverage** (`pytest --cov --cov-branch --cov-fail-under=100`); avoid `# pragma: no cover`, justify each.
- **uv + Makefile only:** every new command gets a root Makefile target (e.g. extending `perf`); never pip/venv directly.
- No per-entity FFI, no Python particle sim, no allocation in the frame loop, no `runPython` in the loop, exact version pins, preallocated pools, uniform grid for collision, 3 ms Python budget (desktop).
- Models generated in code; keyboard and touch both required; must remain responsive on mobile.
- GSD workflow: file edits go through a GSD command.

## Security Domain

`security_enforcement` is enabled (absent = enabled; config shows `true`, ASVS level 1).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | no accounts or backend |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | URL flags (`?weapon`, `?level`, `?bombs`, existing `?stress/tier/crash`) are untrusted: allow-list + clamp on JS (`url_flags.js`) and again in Python (`entrypoint._fault_mode` pattern); non-finite values never cross the boundary (existing T-01-16 rule) |
| V6 Cryptography | no | — |
| V14 Configuration / supply chain | yes | Exact version pins; vendored zzfx code carries its MIT header; no new npm install is required; flagged package `zzfx` only installed behind a human check |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Crafted URL flag values (huge `bombs`, NaN `level`) | Tampering | Clamp to enum ranges in Python (`Game.__init__`) and in JS parsing; unknown -> default |
| DOM injection via flash/readout text | Tampering | `textContent` only, never `innerHTML` (error-panel convention) |
| Event-ring or pool overflow causing out-of-range writes | DoS | Preallocated caps with drop counters; `assign()` length validation already in `RenderSink.attach` |
| Slopsquatted audio package | Tampering | Vendor the algorithm; if installed, verify by hand (SUS) |
| Autoplay-gated audio abuse / blocked context | DoS (UX) | Audio stays optional; null-safe player |

## Sources

### Primary (HIGH confidence)
- Repository files read this session: `.planning/phases/02-arcade-shooting-feel/02-CONTEXT.md`, `REQUIREMENTS.md`, `STATE.md`, `.claude/CLAUDE.md`, `src/scorched_core/**`, `src/scorched_web/**`, `web/src/**` (main.js, renderer_rig.js, post_pipeline.js, bullet_instances.js, drone_instances.js, ship_model.js, terrain_ring.js, camera_fit.js, playfield_mask.js, tiers.js, quality_controller.js, scaled_bloom_pass.js, start_gate.js, python_bridge.js, touch_input.js, input_sampler.js, keyboard_input.js), `tools/perf_node.mjs`, `tools/e2e/*`, `tests/test_conventions.py`, `Makefile`, `pyproject.toml`, `package.json`, `01-DEVICE-REPORTS.md`, `01-UAT.md`, `.planning/research/{SUMMARY,PITFALLS,ARCHITECTURE}.md`.
- `node_modules/three@0.186.1` source: `examples/jsm/postprocessing/RenderPass.js`, `UnrealBloomPass.js`, `examples/jsm/utils/BufferGeometryUtils.js`, `src/renderers/shaders/ShaderChunk/lights_pars_begin.glsl.js`, `color_vertex.glsl.js`, `src/renderers/webgl/WebGLPrograms.js`, `WebGLLights.js`.
- `zzfx@1.4.0` npm tarball (`npm pack`, inspected in an isolated scratch directory): `ZzFXMicro.js`, `ZzFX.js`, `package.json`.
- First-hand measurements this session: Pyodide 314.0.7 on Node 24 micro-benchmark (grid shots, bullet scan, homing), `fitCamera` k factors, `make perf`, pytest, vitest.
- `gsd-tools query package-legitimacy check --ecosystem npm zzfx` (SUS, `too-new`).

### Secondary (MEDIUM confidence)
- MDN AudioSession page (limited availability, experimental, type values): https://developer.mozilla.org/en-US/docs/Web/API/AudioSession

### Tertiary (LOW confidence)
- WebKit bug threads and developer posts on `navigator.audioSession.type = 'playback'` and silent-switch muting (https://bugs.webkit.org/show_bug.cgi?id=251532, https://adactio.com/journal/19929, https://github.com/swevans/unmute) — community-level evidence, no official Apple documentation found; needs physical-iPhone verification.
- General three.js particle/overdraw guidance from forum and skill pages (no mobile measurements); treated as design guidance only.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new runtime dependencies; every API used was read in the installed three source or the repo.
- Architecture (Python core, protocol, event ring, state machines): HIGH — direct extension of verified Phase 1 seams; one measured budget.
- Rendering geometry (ground layer, shadows, bullet pass): MEDIUM — math and pass behaviour verified, visual acceptance not yet seen.
- Tuning numbers, particle/light budgets on phones: LOW-MEDIUM — explicitly `[ASSUMED]`; no phone baseline exists.
- iOS audio: MEDIUM-LOW — community evidence only.
- Pitfalls: HIGH for the sim/render seam traps (derived from reading the actual code paths), MEDIUM for the mobile ones.

**Research date:** 2026-10-17
**Valid until:** 2026-11-16 (stack is pinned; revisit sooner only if three or Pyodide pins change)
