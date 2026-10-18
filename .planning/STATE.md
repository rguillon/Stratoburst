---
gsd_state_version: "1.0"
current_phase: 3
current_phase_name: Stage 1 Vertical Slice
status: planning
stopped_at: Phase 2 complete, ready to plan Phase 3
last_updated: "2026-10-18T13:12:05.281Z"
last_activity: 2026-10-18
last_activity_desc: Phase 2 complete, transitioned to Phase 3
state_head: 422de82ceac2805db602a202d2f72878ca1322ac
progress:
  total_phases: 4
  completed_phases: 2
  total_plans: 43
  completed_plans: 43
  percent: 50
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-17)

**Core value:** Shooting feels great: tight, responsive ship control and punchy 3D feedback (hits, explosions, screen shake) at a smooth framerate in the browser.
**Current focus:** Phase 02 — Arcade Shooting Feel

## Current Position

Phase: 3 — Stage 1 Vertical Slice
Plan: Not started
Status: Ready to plan
Last activity: 2026-10-18 — Phase 2 complete, transitioned to Phase 3

Progress: [█████░░░░░] 50%

## Performance Metrics

**Velocity:**
- Total plans completed: 43
- Average duration: -
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 10 | - | - |
| 2 | 33 | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 25 min | 3 tasks | 47 files |
| Phase 01 P02 | 10min | 3 tasks | 10 files |
| Phase 01 P03 | 15 min | 2 tasks | 20 files |
| Phase 01 P04 | 8min | 2 tasks | 20 files |
| Phase 01 P05 | 16 min | 2 tasks | 15 files |
| Phase 01 P06 | 13 min | 2 tasks | 22 files |
| Phase 01 P07 | 20 min | 2 tasks | 21 files |
| Phase 01 P08 | 22 min | 2 tasks | 17 files |
| Phase 01 P09 | 20 min | 2 tasks | 24 files |
| Phase 01 P10 | 30 min | 3 tasks | 2 files |
| Phase 02 P01 | 6 min | 2 tasks | 11 files |
| Phase 02 P02 | 12 min | 2 tasks | 10 files |
| Phase 02 P03 | 11 min | 2 tasks | 14 files |
| Phase 02 P04 | 14 min | 2 tasks | 10 files |
| Phase 02 P05 | 9 min | 3 tasks | 10 files |
| Phase 02 P06 | 14 min | 2 tasks | 9 files |
| Phase 02 P07 | 8 min | 2 tasks | 13 files |
| Phase 02 P08 | 10 min | 2 tasks | 14 files |
| Phase 02 P09 | 8 min | 2 tasks | 7 files |
| Phase 02 P10 | 4 min | 2 tasks | 11 files |
| Phase 02 P11 | 9 min | 2 tasks | 12 files |
| Phase 02 P12 | 7 min | 2 tasks | 11 files |
| Phase 02 P13 | 14 min | 2 tasks | 13 files |
| Phase 02 P14 | 7 min | 2 tasks | 8 files |
| Phase 02 P15 | 5 min | 2 tasks | 9 files |
| Phase 02 P16 | 7 min | 2 tasks | 7 files |
| Phase 02 P17 | 7 min | 2 tasks | 11 files |
| Phase 02 P18 | 9 min | 2 tasks | 10 files |
| Phase 02 P19 | 10 min | 2 tasks | 8 files |
| Phase 02 P20 | 7 min | 2 tasks | 10 files |
| Phase 02 P21 | 15 min | 2 tasks | 12 files |
| Phase 02 P22 | 9 min | 2 tasks | 13 files |
| Phase 02 P23 | 9 min | 2 tasks | 7 files |
| Phase 02 P24 | 14 min | 2 tasks | 9 files |
| Phase 02 P25 | 11 min | 2 tasks | 13 files |
| Phase 02 P26 | 14 min | 2 tasks | 10 files |
| Phase 02 P27 | 5 min | 2 tasks | 13 files |
| Phase 02 P28 | 18 min | 2 tasks | 11 files |
| Phase 02 P29 | 17 min | 2 tasks | 13 files |
| Phase 02 P30 | 10 min | 2 tasks | 7 files |
| Phase 02 P31 | 18 min | 2 tasks | 10 files |
| Phase 02 P32 | 14 min | 3 tasks | 11 files |
| Phase 02 P33 | 30min | 3 tasks | 3 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: 4 coarse MVP phases. Phase 1 ends in a real-device mobile performance + deploy go/no-go; Phase 3 (stage 1 + boss) is the vertical-slice gate before stages 2-3.
- [Research]: Stack is Pyodide 314.0.7 (Python logic) + three.js 0.186.1 WebGL2 (render) + Vite 8 + zzfx. Babylon.js 9.31.0 is the fallback renderer. No SharedArrayBuffer or Worker design.
- [Research]: From the first commit: fixed 60 Hz sim, seeded RNG, a single batched `tick()` per frame (no per-entity FFI), uniform-grid collision broadphase, and a pure `scorched_core` package testable with pytest.
- [Phase 01]: Python tooling only via Astral uv; every dev command is a root Makefile target (user requirement, Task 1 amendment)
- [Phase 01]: Ruff excludes .planning/.claude (ruff 0.17 formats Python fences in Markdown)
- [Phase 01]: Repo is rguillon/Stratoburst; live URL https://rguillon.github.io/Stratoburst/ derived from origin (case-sensitive); page title stays Scorched
- [Phase 01]: CI workflow steps call Makefile targets (user-requested uv+Makefile tooling); literal gate.yml greps satisfied via Makefile
- [Phase 01]: Plan 01-03: bloom defaults strength 0.45 / radius 0.25 / threshold 1.0, since 1.0 / 0.4 washed out a 500-bullet frame; Python tick for 500 stress bullets measures 0.50 ms avg (budget 3 ms)
- [Phase 01]: 01-04: tier controller strikes need three consecutive evaluations (earliest step-down at the 150th post-warm-up sample); deferred steps keep their strikes; verify-and-lock at <10% gain
- [Phase 01]: 01-04: under ?debug renderer.info.autoReset is off and read/reset once per frame so draw calls cover all composer passes
- [Phase 01]: 01-04: half-float render targets are checked up front; missing support forces and locks the low tier with reason bloom-unavailable
- [Phase 01]: Camera orientation fixed (25 deg tilt, 30 deg FOV); the fit varies only distance and look-at Z, and the playfield is letterboxed by a world-space dimming mask with a hole instead of CSS bars
- [Phase 01]: Terrain is a 4-slot ring (slot = chunkIndex mod 4) rewritten only on chunk-index change, positions relative to the base chunk; scroll rendered as SCROLL_Y + ALPHA * tuning.scroll_speed
- [Phase 01]: Scroll e2e runs at ?tier=low and checks scroll == 0.8 x ticks, since the fixed-step runner caps catch-up at 3 steps per frame and software GL is slow
- [Phase 01]: Button bit values live in Python (Button IntFlag) and reach JS only via manifest.buttons; JS latches press edges and Python derives edges
- [Phase 01]: Touch drag is a pending queue drained at SHIP_SPEED inside the fixed step, capped at TOUCH_LAG_CAP 40, with the wall rule zeroing a blocked axis
- [Phase 01]: Hitbox marker is a depth-test-off core plus dark ring (renderOrder 20/21) built from manifest.tuning.hitbox_radius, never gated behind a focus mode
- [Phase 01]: 01-07: resolve_shots_vs_drones visits bolts descending with immediate swap-remove (no consumed-flag array); drone order is the grid query order
- [Phase 01]: 01-07: make perf holds fire and sweeps (--fire 1) so the 3 ms budget covers bolts, drones and the grid
- [Phase 01]: 01-08: resume drops owed touch drag and app-switcher keys (Alt/Meta/Ctrl/Tab) do not count as the resume press
- [Phase 01]: 01-08: scroll e2e checks per-frame sim progress against rAF dt (plus real-time rate when the 3-step cap is not engaged) instead of a wall-clock floor; gameplay timing unchanged
- [Phase 01]: 01-09: keyboard, touch, sampler and pause controller are created after the start gate, so the gate tap/key never reaches them; only pointerType decides touch mode
- [Phase 01]: 01-09: __scorched.audioState is a live getter on AudioContext.state (resume() settles asynchronously)
- [Phase 01]: 01-09: error panel Copy report appends the device report layout even without a debug session; text via textContent only; ?crash values are allow-listed on JS and Python sides
- [Phase 01]: Plan 01-10 verdict was GO (desktop) with the phone gate deferred; phone gate (PLAT-05) then passed in Phase 1 UAT on 2026-10-17
- [Phase 02]: 02-01: a killing blow pushes no HIT event (the EXPLOSION covers it), so a kill is exactly one event; HIT is pushed only for a surviving hit on a resting drone
- [Phase 02]: 02-01: protocol v2 reserves header slots 14-29 for Phase 2 plans and 30-47 for Phase 3; event ids and blast classes are protocol constants exported by name through the manifest
- [Phase 02]: 02-02: particle layers draw depthTest-off at renderOrder 4 (above terrain, below the playfield mask); explosion size never scales with tier, only particle count (1, 0.6, 0.35)
- [Phase 02]: 02-03: a killing blow pushes no HIT event; apply_hit subtracts first and pushes a low-priority HIT only for a resting survivor, so a kill is exactly one event
- [Phase 02]: 02-03: the gallery has no RNG (scripted GALLERY_SCRIPT), so determinism means same inputs give byte-identical buffers; wire names DRONE_N/DRONES_DOWN/drones stay until 02-04
- [Phase 02]: 02-04: enemy meshes are one InstancedMesh per kind behind a geometryFor seam; flash is HDR (2.2) instanceColor on a white shared material; mesh with zero instances is not re-uploaded
- [Phase 02]: 02-05: enemy motion is data (MotionKind per enemy, applied by a match with a loud unknown arm); hover state lives in the timer column; ground units move at SCROLL_SPEED * 0.94 = 0.752 per step and the ratio is exported in the manifest
- [Phase 02]: 02-06: every model detail level is built eagerly and warmed at load, so a tier change only swaps cached geometry and material; terrain keeps separate smooth and flat materials instead of toggling flatShading
- [Phase 02]: 02-07: air enemy models are { body, glow, top } (HDR accents in a separate glow mesh, optional spinning top); hit flash is a (6, 6, 6) instanceColor multiplier on vertex colours, rest is (1, 1, 1)
- [Phase 02]: 02-07: a HELI top spins by angle + timeS * ROTOR_RATE (30 rad/s) and any other top follows the absolute aux aim angle; kinds without a builder (TANK, TURRET until 02-09) keep tinted primitives
- [Phase 02]: 02-08: TwinShot is deleted; Lv1 of the VULCAN_STREAMS tables reproduces it exactly (parity test), and Game clamps the starting level to 1..5 itself
- [Phase 02]: 02-08: every weapon is stepped every step with fire gated by loadout.kind, so cooldowns keep running and a switch is immediate; LASER and HOMING fire nothing until 02-21 and 02-13
- [Phase 02]: 02-09: tank and AA turret are { body, glow, top } models built only from model_kit parts, with the turret/gun as a pivot-centred top that follows the aux aim angle; all five gallery kinds now have builders
- [Phase 02]: 02-10: pickups bounce with the pickup radius as edge margin, drift off the bottom after 600 steps, and a MAXED catch is only counted (game.max_bonus, header slot 20) for Phase 3 scoring
- [Phase 02]: 02-10: the pickup colour is decided in Python (colour_at) and packed into the pickups channel; the collect callback is bound once so no closure is built per step
- [Phase 02]: 02-11: ?weapon and ?level are allow-listed and clamped in JS and validated again in entrypoint.py; main.js spreads the whole parsed flags object into the Python options, so later flags need no main.js edit
- [Phase 02]: 02-11: BulletPool.angle = atan2(vx, -vy) set at spawn and packed in slot 2 of the pbullets channel (0 = straight up); the status readout writes textContent only, on change
- [Phase 02]: 02-12: tanks and turrets draw inside a ray-compensating ground group (position = camera * (1 - k), scale k), verified by an NDC test at four aspects; ground explosions and hit sparks position through it
- [Phase 02]: 02-12: wreck ring holds 12 low-detail charred hulls placed at y_at_kill + ratio * (scroll_now - scroll_at_kill) from one scrollNow per frame; explosion toWorld takes a ground flag
- [Phase 02]: 02-13: uid-tracked homing missiles steer at 5 degrees per step, re-acquire every 8 steps or at once when the target is gone, ties to the lower pool index
- [Phase 02]: 02-13: missile life is packed as the elapsed fraction life/90 in slot 3 of the missiles channel (stride 4, cap 48, header MISSILE_N = 19); missiles are invisible until 02-23
- [Phase 02]: 02-14: scorch marks are a ring of 48 soft decals (ground MEDIUM 16, LARGE 24) rebuilt each frame from y_at_kill + ratio * scroll delta; the tier cap draws only the newest n and never deletes stored marks
- [Phase 02]: 02-14: wreck smoulder is a per-wreck accumulator trickle (smoke 0.18 s, flames 0.3 s for 6 s) scaled by particleScale, silent off screen, frame time clamped to 0.25 s
- [Phase 02]: 02-15: the grace window is exactly DEATHBOMB_TICKS (8) step calls after the hit step and invulnerability counts down only on ALIVE steps, so the 150-step blink starts on the fly-in arrival step
- [Phase 02]: 02-15: a hit outside ALIVE or while invulnerable returns False and changes nothing; grant_invuln takes the larger remaining value so the bomb and the respawn share one counter
- [Phase 02]: 02-16: the ?stress storm lives in storm_pool and gameplay enemy bullets in a separate 200-bullet ebullets pool; both pack into one ebullets channel (storm first, gameplay at offset storm_pool.n) and header STORM_N (21) keeps stress counts exact
- [Phase 02]: 02-17: Orb bullets are LDR (every channel at most 0.98) and drawn in a separate bulletScene after bloom: the composer gets a second RenderPass (clear false, clearDepth true) before OutputPass and the low tier clears depth and renders the scene directly
- [Phase 02]: 02-17: Pink is reserved by PALETTE: a test fails when a saturated effect, weapon or pickup colour is within 35 degrees of the enemy-bullet hue, and every explosion and hit recipe colour is a palette entry
- [Phase 02]: 02-17: Player bolts use the bolt style (quad stretched 2.5x along aData.z, HDR elliptical streak) in the palette VULCAN_TRACER colour instead of the old cyan override
- [Phase 02]: 02-18: Enemy fire timer counts fire() calls from ENEMY_FIRE_DELAY (45); shots held outside the screen band (top edge to 70% height) fire as soon as the enemy enters it
- [Phase 02]: 02-18: Helicopter rings alternate phase by pi/ENEMY_RING_COUNT via (age // interval) % 2 so consecutive rings interleave; ENEMY_FIRE events are pushed only for volleys that spawned a bullet
- [Phase 02]: 02-19: explosion lights flash one of a fixed pool of 3 PointLights with a budget of 3 fresh pulses per second (re-trigger the lit newest light or drop), tier lights 3/2/0
- [Phase 02]: 02-19: air shadows are uncompensated blob quads at terrain depth + 0.3 displaced along the sun ray by 40 units, renderOrder 3, ship included, shipVisible false hides its own
- [Phase 02]: 02-20: lethal contact checks gameplay bullets then live air bodies only while the ship is vulnerable and not god; ground units and the storm never kill, and drag owed while the ship cannot be controlled is dropped
- [Phase 02]: 02-20: the ?god flag is presence-only in JS and Python accepts only a real boolean True; e2e bootGame boots god unless mortal is asked for and the perf harness always passes god
- [Phase 02]: 02-21: the laser is a pool-free hitscan beam that pierces every enemy in its column (research A2), damaging on the first firing step then every 3rd, with BEAM_W (header 18) carrying its half-width
- [Phase 02]: 02-21: the beam draws additive at renderOrder 4 with gains 0.42 core / 0.5 glow / 0.9 flare (full HDR tone-mapped to white) and is shown once before the second prewarm so its shaders compile at load
- [Phase 02]: 02-22: the bomb press is latched in tick() and cleared in _step whether or not the launch succeeds, so a refused press never fires later; the bomb steps before remove_dead so its kills join the normal kill pass
- [Phase 02]: 02-22: blast radius is 20 on the first blast step and 230 from step 30, damage lands on blast steps 1, 7, 13; the launch-step invulnerability grant protects 143 steps because that step already decrements it
- [Phase 02]: 02-23: homing missiles are a baked violet lathe model turned by minus the angle, with 50 ms trail puffs of min(count, max(1, round(count * particleScale))) from a rotating start index
- [Phase 02]: 02-23: perf_node.mjs validates --weapon itself (exit 2) and fails a held-fire run whose weapon output slot never rises, so the per-weapon gate cannot pass on an idle weapon
- [Phase 02]: 02-24: crystals are a lathe gem drawn with HDR instance colours from Python's packed colour index (bomb kind takes BOMB_PICKUP, an out-of-range index draws red); spin and bob follow the effect clock
- [Phase 02]: 02-24: the MAX flash is static markup armed by the MAXED PICKUP event and started by the next frame tick (900 ms, 400 ms fade, repeat restarts it); createStatusReadout now requires events, maxed and #max-flash
- [Phase 02]: 02-25: death costs DEATH_LEVEL_PENALTY (2) levels with floor 1 and drops a fixed-colour recovery pickup at the clamped death spot, guaranteed by evicting the oldest pickup when the pool is full
- [Phase 02]: 02-25: only the hull (fuselage, canopy, engine glow) blinks from INVULN parity (floor(invuln / 4) even = shown); the whole ship, hitbox marker and shadow hide only while DYING; PLAYER_DEATH is a LARGE fireball plus a 16-spark white ring
- [Phase 02]: 02-26: the deathbomb needs only try_deathbomb after a successful launch, because the bomb press already resolves before life.step; a refused launch never saves
- [Phase 02]: 02-26: the bomb fireball is a squashed front-face additive sphere at gain 0.4 with an EMBER rim (full-gain double-sided tone-mapped to white), and one detonation is one instant-rise linear-decay bloom pulse of 2.2x over 0.3 s
- [Phase 02]: 02-27: the bomb stock is shown as U+25CF pips in amber rgb(255, 191, 32) and ?bombs is clamped to 0..7 in JS, the entrypoint and Game; perf_node always passes bombs 7 and a --bomb run fails if no bomb flew
- [Phase 02]: 02-28: hitstop is a Python gate at the top of _step (4 steps on bomb detonation, 6 on a confirmed death, header slot 14) and the shake is a render-only seeded camera jitter wrapped around the render call; the effect clock and extrapolation alpha hold during hitstop and pause
- [Phase 02]: 02-28: a shake never exceeds 3.0 units or 0.5 s, update(0) holds age and jitter so a paused game stays still, and a new shake replaces the current one only when it is at least as strong as the strength left now
- [Phase 02]: 02-29: the touch bomb button tracks pointer ids and a press latch, carries data-no-steer so touch_input ignores pointers that start on it, and is laid out in the letterbox margin or over the playfield corner from the projected corners
- [Phase 02]: 02-30: the SFX router runs at the end of every live step over only that step's events (frozen hitstop steps route nothing); VULCAN, MISSILE, HIT and ENEMY_FIRE are pushed low priority and a laser shot is silent because the hum follows BEAM_W
- [Phase 02]: 02-31: zzfx 1.4.0 is vendored as a pure generator (no package, lockfile unchanged); samples render at load and AudioBuffers are made on the gate's AudioContext after the tap; every voice runs source -> gain -> bus -> compressor -> destination
- [Phase 02]: 02-32: the laser hum is one dedicated looped source outside the 20 voice slots; voices steal by lowest priority then oldest, a request nothing outranks is dropped, and the cooldown restarts only when a voice starts
- [Phase 02]: 02-32: the iOS keepalive sets audioSession to playback and resumes a suspended or interrupted context on later gestures with a pending-resume guard cleared on settle or statechange; the device report gains an audio: line
- [Phase 02]: Plan 02-33: user waived the Android criterion for Phase 2 (no Android device); verdict GO for desktop + iPhone, Android not measured, carried forward as UAT

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 2]: iOS audio unlock and silent switch behavior; bloom cost on mobile GPUs; bullet palette vs fire backgrounds.
- [Phase 3]: Research needed: boss authoring format and destructible-part model.
- [Phase 4]: Research needed: touch initials-entry UX, music synthesis vs loops. Stages 4-5 (CAMP-01) are a v2 stretch only.
- [Phase 1]: iPhone Phase 1 baseline now pasted into 01-DEVICE-REPORTS.md (02-33); the Android baseline is still missing (no Android device)
- [Phase 2] 02-33 device gate: Android unmeasured (user has no Android device); decide waiver or Android run, then push main (fast-forward) and run make wait-deploy / make e2e-live. Main NOT pushed.

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-10-18T12:22:10.383Z
Stopped at: Phase 2 complete, ready to plan Phase 3
Resume file: None
