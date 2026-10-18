---
phase: 02-arcade-shooting-feel
plan: 02
subsystem: fx-particles
tags: [three.js, gpu-particles, instanced-quads, explosions, quality-tiers, tdd]

requires:
  - phase: 02-arcade-shooting-feel
    provides: "Protocol v2 events channel (stride 6, cap 128), EVENT_N header slot, events/blast manifest name maps (plan 02-01)"
provides:
  - "createFxDispatcher: decodes the events channel once per frame, count clamped to the channel length"
  - "createParticleLayer: GPU ring of billboard quads (additive or normal blending), motion and fade in the vertex shader"
  - "createExplosionFx with a RECIPES data table (SMALL, MEDIUM, LARGE) and HIT_RECIPE"
  - "TIERS.*.particleScale (1, 0.6, 0.35): fewer particles on weaker tiers, same explosion size"
  - "main.js fxLayers / fx / fxTime wiring and the __scorched.fx.particlesSpawned debug hook"
affects: [02-03, 02-08, 02-10, 02-17, 02-18, 02-20, 02-22]

actuals:
  tokens: 7700
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Particles are spawn records only: JS writes start, velocity, spawn time, lifetime, sizes and colour once; the vertex shader evaluates position, size and fade from uTime"
    - "Recipes are frozen data tables of emitters; later plans add PICKUP and PLAYER_DEATH entries without touching the engine"
    - "Quality tiers cut particle count, never size or lifetime"

key-files:
  created:
    - web/src/fx/fx_dispatcher.js
    - web/src/fx/particle_system.js
    - web/src/fx/explosion_fx.js
    - web/test/fx/fx_dispatcher.test.js
    - web/test/fx/particle_system.test.js
    - web/test/fx/explosion_fx.test.js
  modified:
    - web/src/main.js
    - web/src/quality/tiers.js
    - web/test/quality/tiers.test.js
    - tools/e2e/shooting.spec.js

key-decisions:
  - "Particle layers draw with depthTest off at renderOrder 4 (above terrain, below the playfield mask), so billboards never z-fight the ground plane and the letterbox mask still dims anything outside the playfield"
  - "RECIPES is keyed by the manifest blast class names (SMALL, MEDIUM, LARGE) and resolved to blast values through manifest.blast at construction"
  - "A particle's spawn time is the layer's last uTime (previous frame), so a burst is at most one frame old when first drawn; avoids a second time uniform path"

patterns-established:
  - "Event handler contract: handle(type, x, y, a, b, c); dispatcher fans every event out to all handlers"
  - "Ring buffer upload: only the slots written since the last update go to the GPU, the whole buffer after a wrap"

requirements-completed: [VISL-03, ENMY-08]

coverage:
  - id: D1
    description: "Dispatcher decodes the stride-6 events channel once per frame and clamps a corrupt count to the channel length"
    requirement: VISL-03
    verification:
      - kind: unit
        ref: "web/test/fx/fx_dispatcher.test.js#clamps a count larger than the channel to what the array holds"
        status: pass
    human_judgment: false
  - id: D2
    description: "GPU particle ring: wraps over the oldest slots, uploads only the dirty slots, never allocates per emit"
    requirement: VISL-03
    verification:
      - kind: unit
        ref: "web/test/fx/particle_system.test.js#wraps to slot 0 after capacity, overwriting the oldest, and uploads the whole buffer"
        status: pass
    human_judgment: false
  - id: D3
    description: "A kill in the production build raises an EXPLOSION that becomes particles"
    requirement: VISL-03
    verification:
      - kind: e2e
        ref: "npx playwright test tools/e2e/shooting.spec.js (drones appear and can be shot down, particlesSpawned > 0)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Explosion recipes grow with the blast class (SMALL 27, MEDIUM 37, LARGE 75 particles at full scale) and HIT throws 4 white sparks"
    requirement: ENMY-08
    verification:
      - kind: unit
        ref: "web/test/fx/explosion_fx.test.js#blast class recipes at full scale"
        status: pass
      - kind: unit
        ref: "web/test/fx/explosion_fx.test.js#HIT"
        status: pass
    human_judgment: false
  - id: D5
    description: "Particle scale cuts counts only: sizes and lifetimes identical on every tier, never below one per emitter"
    requirement: VISL-03
    verification:
      - kind: unit
        ref: "web/test/fx/explosion_fx.test.js#particle scale"
        status: pass
      - kind: unit
        ref: "web/test/quality/tiers.test.js#is the frozen ladder high / mid / low"
        status: pass
    human_judgment: false
  - id: D6
    description: "How the bursts look: bright bloomed pops, readable class sizes, white hit sparks, same pop size with fewer sparks at tier=low"
    requirement: VISL-03
    verification: []
    human_judgment: true
    rationale: "Visual punch and perceived size are judgment calls no unit test asserts; the plan's human-check covers them at ?debug and &tier=low"
  - id: D7
    description: "Recipe colours stay out of the hot-pink band (310 to 350 degrees) reserved for enemy bullets"
    requirement: VISL-03
    verification:
      - kind: unit
        ref: "web/test/fx/explosion_fx.test.js#recipe colours (D-23)"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-10-18
status: complete
plan_head_before: af8843e4a07c72cb30f97b92920249a2b29de82c
plan_head_after: 2ba1439835f686651f4d911349282004abfc49ec
commits: 3
---

# Phase 2 Plan 02: GPU Particle Explosions Summary

**Python EXPLOSION and HIT events become GPU-driven particle bursts: an instanced billboard ring with all motion and fade in the vertex shader, class-sized recipes (SMALL, MEDIUM, LARGE) in a data table, white hit sparks, and a per-tier particle scale that keeps explosion size constant.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-10-18T02:55:00Z (approximate)
- **Completed:** 2026-10-18T03:08:00Z
- **Tasks:** 2
- **Files modified:** 10 (6 created, 4 modified)

## Accomplishments

- `createParticleLayer` is a single instanced draw per blend mode (2048 additive, 1024 normal slots). JS writes a spawn record per particle; the vertex shader evaluates position (with per-particle gravity scale), size and fade from `uTime`, so there is no per-particle loop in Python or per-frame JS. Only the slots written since the last update are uploaded, the whole buffer after a wrap.
- `createFxDispatcher` decodes the events channel exactly once per frame from `EVENT_N`, clamped to the channel length, and fans each event out to its handlers without allocating.
- `createExplosionFx` keeps SMALL, MEDIUM and LARGE as frozen emitter tables plus `HIT_RECIPE`. At full scale SMALL is core + 20 sparks + 6 embers, MEDIUM adds fire puffs and rising smoke on the normal-blend layer, LARGE adds falling debris and a bigger fireball. Every HIT throws 4 white sparks.
- Tiers gained `particleScale` (1, 0.6, 0.35); counts are `max(1, round(count * scale))` and sizes and lifetimes never scale. main.js reads the scale at event time so a tier change applies to the next explosion.
- `make check` is green (ruff, pytest at 100% line and branch, 404 vitest tests, build, all 39 e2e). The shader compiles without console errors in the production build.

## Task Commits

1. **Task 1: Tracer: a target that is shot down bursts into glowing GPU particles** - `93f8e11` (feat). The tracer's own verify (vitest, build, shooting + smoke e2e) was re-run and passed before expansion: "Tracer verified end-to-end - expanding".
2. **Task 2: Class-sized explosions, hit sparks, tier particle scale (TDD)**
   - RED: `cd93c78` (test) - 9 target tests in explosion_fx.test.js and the tiers ladder test failed on the planned assertions (emitted counts 21 vs 27, 0 vs 27/43, 0 vs 4 HIT sparks, tier objects lacking particleScale); the hue test failed with a TypeError on the missing `HIT_RECIPE` export
   - GREEN: `2ba1439` (feat)

**Plan metadata:** committed separately (docs: complete plan)

## Files Created/Modified

- `web/src/fx/fx_dispatcher.js` - events channel decoder and fan-out
- `web/src/fx/particle_system.js` - instanced GPU particle ring (additive or normal blending)
- `web/src/fx/explosion_fx.js` - RECIPES, HIT_RECIPE, seeded mulberry32, tier-scaled bursts
- `web/src/quality/tiers.js` - `particleScale` per tier
- `web/src/main.js` - fx layers, dispatcher, per-frame update, `__scorched.fx.particlesSpawned`
- `tools/e2e/shooting.spec.js` - asserts a kill spawned particles
- Tests: `web/test/fx/{fx_dispatcher,particle_system,explosion_fx}.test.js`, `web/test/quality/tiers.test.js`

## Decisions Made

- Particle layers use `depthTest: false` at `renderOrder 4`: billboards centred on the ground plane would otherwise be half-clipped by the terrain, and drawing before the playfield mask (5) lets the letterbox dim anything outside the playfield.
- `RECIPES` is keyed by the manifest blast class names and mapped to blast values via `manifest.blast`, so JS never hard-codes the numbers.
- Spawn time uses the layer's last `uTime`, so a burst is at most one frame old when first drawn; accepted rather than adding a second time path.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Task 1 explosion tests contradicted the Task 2 recipes**
- **Found during:** Task 2 (GREEN run: 3 Task 1 tests failed)
- **Issue:** Task 1 tests asserted SMALL = 21 particles, sparks all flat, and "HIT emits nothing"; Task 2's specified behavior (embers, HIT sparks) supersedes all three.
- **Fix:** Updated those three assertions to the Task 2 behavior (27 particles; flat check scoped to the 20 sparks; HIT test removed from the ignore case and covered by the HIT suite).
- **Files modified:** `web/test/fx/explosion_fx.test.js`
- **Verification:** `npm test` 404 passed
- **Committed in:** `2ba1439`

---

**Total deviations:** 1 auto-fixed (1 test-expectation conflict inside the plan)
**Impact on plan:** None on scope; the plan's own two task behaviors overlapped on SMALL and HIT.

## Issues Encountered

None. Note: the plan's `<verify>` uses `npm test`/`npm run build`/`npx playwright`; the project's Makefile wraps these, and `make check` was run as the final gate.

## Known Stubs

None. Reserved recipes for PICKUP and PLAYER_DEATH are not present yet; plans named in the PATTERNS file add them to the same table.

## TDD Gate Compliance

Task 2 (`tdd="true"`): RED `cd93c78`, GREEN `2ba1439`, no REFACTOR needed. The plan itself is `type: execute`, so the plan-level gate sequence does not apply.

## Threat Flags

None. T-02-03 (fixed-capacity rings, count scale, no per-frame allocation) and T-02-04 (count clamped to the channel, integer-cast type) are implemented and unit tested; no new trust boundary was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Later plans can add event handlers with `fx.add(handler)` and recipes to the same tables; the additive and normal layers are in `fxLayers`.
- Human check pending (verifier batch): at `http://localhost:4173/?debug` sweep under the targets (hit sparks, kill pops that bloom) and confirm `&tier=low` keeps the pop size with fewer sparks.
- Plan 02-17 moves the recipe colours into the palette module that enforces the pink-band rule.
- No blockers.

---
*Phase: 02-arcade-shooting-feel*
*Completed: 2026-10-18*

## Self-Check: PASSED

- FOUND: web/src/fx/fx_dispatcher.js, web/src/fx/particle_system.js, web/src/fx/explosion_fx.js, web/test/fx/fx_dispatcher.test.js, web/test/fx/particle_system.test.js, web/test/fx/explosion_fx.test.js
- FOUND commits: 93f8e11, cd93c78, 2ba1439
- `make check` green (ruff, pytest 100% line and branch, vitest 404 passed, build, 39 e2e)
- Acceptance: `grep -n "dispatch(bridge.channels.events" web/src/main.js` matches; `grep -n "particleScale" web/src/quality/tiers.js` shows 1, 0.6, 0.35
