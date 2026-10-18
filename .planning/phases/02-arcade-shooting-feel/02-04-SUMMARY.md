---
phase: 02-arcade-shooting-feel
plan: 04
subsystem: render
tags: [three.js, instanced-mesh, enemies, boundary, hit-flash, debug-overlay]

requires:
  - phase: 02-arcade-shooting-feel
    provides: "02-03 gallery enemy pool (ENEMY_STRIDE 8, ENEMY_CAP 48, H_ENEMY_N, H_KILLS, enemy_kinds manifest map)"
  - phase: 02-arcade-shooting-feel
    provides: "02-02 fx dispatcher and particle layers (particlesSpawned asserted by the shooting e2e)"
provides:
  - "Boundary wire names enemies / ENEMY_N / KILLS (Phase 1 drones / DRONE_N / DRONES_DOWN gone)"
  - "createEnemyInstances: one InstancedMesh per enemy kind, heading rotation, HDR hit flash"
  - "basicEnemyGeometry(kindName) and the geometryFor seam for the smooth models of plans 02-07 and 02-09"
  - "Debug overlay fields enemies and kills"
affects: [02-07, 02-09, enemy-models, debug-overlay, e2e]

actuals:
  tokens: 14000
  tasks: 2
  commits: 3
plan_head_before: 3f3fcd1887fce4f772a2e0fcdd6baa26432d6ce2
plan_head_after: 56ca38382595ca8d8e490f4ccd654b3a9d192300

tech-stack:
  added: []
  patterns:
    - "One InstancedMesh per kind routed by the kind field; kind value -> entry table; unknown kind skipped"
    - "Module-level scratch Matrix4/Vector3/Quaternion/Color plus a per-kind Int32Array of counters: update allocates nothing"
    - "Only meshes that were written are flagged needsUpdate"

key-files:
  created:
    - web/src/render/enemy_instances.js
    - web/test/render/enemy_instances.test.js
  modified:
    - src/scorched_core/game/game.py
    - tests/scorched_core/game/test_game.py
    - web/src/main.js
    - web/src/debug/debug_session.js
    - web/test/debug/debug_session.test.js
    - tools/e2e/shooting.spec.js
  deleted:
    - web/src/render/drone_instances.js
    - web/test/render/drone_instances.test.js

key-decisions:
  - "Basic per-kind primitives (cone, capsule, boxes, cylinder) sized by a JS-side radius table that mirrors tuning.ENEMY_RADIUS; the manifest does not carry radii"
  - "Flash colour is HDR (2.2, 2.2, 2.2) against a white shared material so instanceColor alone decides the colour; base colours stay below 1.0 so resting enemies never bloom"
  - "A mesh with zero instances this frame is not flagged for upload (its count of 0 already hides it)"

patterns-established:
  - "geometryFor seam: later plans swap in smooth code-built models without touching routing, flash or counters"
  - "Wire rename lands in Python, every JS reader and the e2e in one commit, guarded by a grep for the old names"

requirements-completed: [ENMY-08]

coverage:
  - id: D1
    description: "Boundary speaks enemies / ENEMY_N / KILLS and the old drone names are gone"
    requirement: ENMY-08
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_manifest_contract"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_the_enemy_channel_is_named_enemies_and_no_drones_channel_exists"
        status: pass
      - kind: other
        ref: "grep -rn 'DRONE_N|DRONES_DOWN|channels.drones' src web/src tools (no output)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Each enemy kind is drawn by its own InstancedMesh, placed on the playfield and turned along its heading"
    requirement: ENMY-08
    verification:
      - kind: unit
        ref: "web/test/render/enemy_instances.test.js#routes each instance to its kind mesh and counts per kind"
        status: pass
      - kind: unit
        ref: "web/test/render/enemy_instances.test.js#turns each instance about Y by its heading angle"
        status: pass
      - kind: e2e
        ref: "tools/e2e/shooting.spec.js#gallery enemies appear and can be shot down"
        status: pass
    human_judgment: false
  - id: D3
    description: "A hit enemy flashes HDR white in its kind's mesh; unknown kinds are skipped, counts clamped, update allocates nothing"
    requirement: ENMY-08
    verification:
      - kind: unit
        ref: "web/test/render/enemy_instances.test.js#colours a resting enemy with its kind base colour and a flashing one HDR white"
        status: pass
      - kind: unit
        ref: "web/test/render/enemy_instances.test.js#skips an instance whose kind value is not in the manifest map (T-02-06)"
        status: pass
      - kind: unit
        ref: "web/test/render/enemy_instances.test.js#clamps the count to the capacity"
        status: pass
    human_judgment: false
  - id: D4
    description: "Debug overlay reports enemies and kills from ENEMY_N and KILLS (n/a when missing)"
    verification:
      - kind: unit
        ref: "web/test/debug/debug_session.test.js#prints n/a for header slots the manifest does not publish"
        status: pass
    human_judgment: false
  - id: D5
    description: "The five kinds are readable as distinct silhouettes and the flash reads well on screen (visual quality of the primitive shapes)"
    verification: []
    human_judgment: true
    rationale: "Whether jets, helicopters, carriers, tanks and turrets are easy to tell apart on screen, and whether the flash looks right, is a visual judgement no unit test asserts."

duration: 14min
completed: 2026-10-18
status: complete
---

# Phase 2 Plan 04: Gallery enemy rendering Summary

**One instanced draw call per enemy kind (jet, heli, carrier, tank, turret), turned along their heading and flashing HDR white on hit, with the boundary renamed from drones to enemies/ENEMY_N/KILLS across Python, JS and e2e.**

## Performance

- **Duration:** 14 min
- **Tasks:** 2 (a tracer and a TDD task)
- **Commits:** 3 task commits (feat, test, feat)
- **Files modified:** 10 (2 created, 2 deleted)

## Accomplishments
- `Game.manifest()` exports channel `enemies` and header slots `ENEMY_N` (8) and `KILLS` (11); the temporary 02-03 wire-name note is gone and no `DRONE_N`, `DRONES_DOWN` or `drones` remain in `src`, `web/src` or `tools`.
- `createEnemyInstances` builds `enemy-jet`, `enemy-heli`, `enemy-carrier`, `enemy-tank` and `enemy-turret` meshes from `manifest.enemy_kinds`, all added to the scene before the second prewarm; `basicEnemyGeometry` is the `geometryFor` seam for the smooth models of plans 02-07 and 02-09.
- Hit flash (ENMY-08): instanceColor (2.2, 2.2, 2.2) while the flash field is above zero; resting enemies keep olive, khaki, grey-green or sand tones below 1.0.
- T-02-06 mitigated: unknown, negative, fractional or NaN kind values are skipped and the count is clamped to capacity (unit-tested).
- The Phase 1 drone renderer and its test are deleted (D-20); the debug overlay line now reads `enemies N   kills M`.

## Task Commits

1. **Task 1: Tracer, boundary rename and one mesh per kind** - `15e704a` (feat)
2. **Task 2 (TDD RED): failing tests for flash, upload flags, bad kinds** - `7cfd74f` (test)
3. **Task 2 (TDD GREEN): HDR flash and write-only upload flags** - `56ca383` (feat)

**Plan metadata:** committed with this summary (docs).

## Files Created/Modified
- `web/src/render/enemy_instances.js` - per-kind InstancedMesh factory, heading rotation, HDR flash, `basicEnemyGeometry`
- `web/test/render/enemy_instances.test.js` - routing, placement, rotation, flash, skip, clamp, identity (no allocation), geometry tests
- `src/scorched_core/game/game.py`, `tests/scorched_core/game/test_game.py` - wire rename and its tests
- `web/src/main.js` - builds the enemy renderer, adds every mesh to the scene, updates from `ENEMY_N`
- `web/src/debug/debug_session.js`, `web/test/debug/debug_session.test.js` - overlay `enemies` and `kills`
- `tools/e2e/shooting.spec.js` - "gallery enemies appear and can be shot down" polling `ENEMY_N` and `KILLS`

## Decisions Made
- The primitive shapes use a JS-side radius table mirroring `tuning.ENEMY_RADIUS`; the manifest does not publish radii and the models are replaced by plans 02-07 and 02-09 anyway.
- A mesh with no instances this frame is not flagged for upload; `count = 0` already hides it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Debug overlay rename moved from Task 2 into Task 1**
- **Found during:** Task 1 acceptance criteria
- **Issue:** Task 1's criterion `grep -rn "DRONE_N|DRONES_DOWN|channels.drones" src web/src tools` must print nothing, but `debug_session.js` read `DRONE_N` and was scheduled for Task 2.
- **Fix:** Changed the overlay line and its test fixture in the Task 1 commit. Task 2 then only needed the flash and upload-flag behaviour.
- **Files modified:** web/src/debug/debug_session.js, web/test/debug/debug_session.test.js
- **Committed in:** 15e704a

**2. [Rule 1 - Bug] Test assertion on -0**
- **Found during:** Task 1
- **Issue:** the heading test compared `[1, 0, -0]` with `[1, 0, 0]` using `toEqual`, which distinguishes -0.
- **Fix:** compared by vector distance instead.
- **Committed in:** 15e704a

---

**Total deviations:** 2 auto-fixed (1 blocking ordering, 1 test bug)
**Impact on plan:** None on scope; the overlay change was in the plan, only earlier than scheduled.

## Issues Encountered
- The tracer's early-integration gate ran in the default `end-of-phase` mode with only `<automated>` verification: the Python gate, vitest, build and the shooting, stress and smoke e2e specs passed end to end before expansion, then the full 39-test Playwright suite passed again after Task 2.
- No `tools/e2e/debug.spec.js` exists; the overlay is covered by `debug_session.test.js` and the full e2e suite passed.

## Known Stubs
None. The enemy shapes are intentionally primitive (the plan makes them the seam that plans 02-07 and 02-09 fill).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The renderer takes `geometryFor`, so smooth enemy models (02-07, 02-09) drop in without touching routing or flash.
- `make perf` after the change: 0.569 ms average per tick (budget 3 ms).

## Self-Check: PASSED
- FOUND: web/src/render/enemy_instances.js, web/test/render/enemy_instances.test.js
- Removed as planned: web/src/render/drone_instances.js, web/test/render/drone_instances.test.js
- FOUND commits: 15e704a, 7cfd74f, 56ca383
- `uv run ruff check . && ruff format --check .`, pytest 100% line+branch (425 passed), `npm test` (415 passed), `npm run build`, full Playwright suite (39 passed) and `make perf` all green

---
*Phase: 02-arcade-shooting-feel*
*Completed: 2026-10-18*
