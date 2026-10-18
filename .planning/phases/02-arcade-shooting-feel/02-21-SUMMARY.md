---
phase: 02-arcade-shooting-feel
plan: 21
subsystem: gameplay
tags: [laser, hitscan, beam, collision, protocol, three-js, shader, e2e]

requires:
  - phase: 02-arcade-shooting-feel
    provides: "WeaponKind.LASER and Game.loadout (02-08), ?weapon/?level flags (02-11), EnemyPool.apply_hit with merged HIT events (02-03), PALETTE.LASER_CORE/LASER_GLOW (02-17), death/respawn firing gate (02-20)"
provides:
  - "LaserBeam: hitscan with a first-step-then-every-3rd-step damage cadence and a half-width that grows with level"
  - "resolve_beam_vs_enemies in collision/area_hits.py (rectangle vs enemy circle, no grid, piercing)"
  - "Header slot BEAM_W (18) and LASER_HALF_WIDTH / LASER_DAMAGE / LASER_HIT_INTERVAL tuning"
  - "createBeamMesh: HDR blue core, wider glow and muzzle flare, flickering in the shader, hidden at width 0"
  - "Laser e2e case (BEAM_W 4 while held, 0 on release, beamVisible debug hook)"
affects: [02-22 area damage reuses area_hits.py, 02-23 weapon visuals, 02-24 weapon audio, Phase 3 scoring]

actuals:
  tokens: 8700
  tasks: 2
  commits: 3
plan_head_before: 1426d8351a52981d9b504d5aaa291af6ec0d0f71
plan_head_after: 3a9acfe69616055811a65dd6958702f7383e6b51
commits: 3

tech-stack:
  added: []
  patterns:
    - "Hitscan weapons own no pool: a small state object (half_width, timer) stepped every frame and gated by loadout.kind, publishing its width in a header slot"
    - "Area damage passes live as plain functions in collision/area_hits.py and call apply_hit so HIT events keep merging by flash state"
    - "A hidden-at-rest effect group is shown once before the second prewarm so its shaders compile at load, then hidden before the gate"

key-files:
  created:
    - src/scorched_core/weapons/laser_beam.py
    - src/scorched_core/collision/area_hits.py
    - tests/scorched_core/weapons/test_laser_beam.py
    - tests/scorched_core/collision/test_area_hits.py
    - web/src/fx/beam_mesh.js
    - web/test/fx/beam_mesh.test.js
  modified:
    - src/scorched_core/protocol.py
    - src/scorched_core/tuning.py
    - src/scorched_core/game/game.py
    - tests/scorched_core/game/test_game.py
    - web/src/main.js
    - tools/e2e/weapons.spec.js

key-decisions:
  - "The beam pierces every enemy in its column (research assumption A2): a reversible tuning choice, one linear scan of at most 48 enemies"
  - "Cadence is a countdown timer that is 0 on the first firing step, so a press always hits at once and a release resets it"
  - "Beam draws at renderOrder 4 (below the playfield mask) with additive blending and depth test off; gains are 0.42 core, 0.5 glow, 0.9 flare because full HDR gains tone-mapped to white"
  - "The beam is shown once during the second prewarm and hidden before the start gate, so the first shot never compiles a shader"

patterns-established:
  - "BEAM_W (header 18) is the single source of truth for the beam: Python publishes the half-width, JS draws it, 0 means off"

requirements-completed: [PLYR-04, PLYR-05]

coverage:
  - id: D1
    description: "With the laser selected, holding fire opens a beam whose half-width grows 2/3/4/5.5/7 with level and releasing or switching weapon closes it on the next step"
    requirement: PLYR-04
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_a_laser_with_fire_held_publishes_its_half_width_and_hits_the_enemy_above"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_switching_from_the_laser_to_the_vulcan_drops_the_beam_on_the_next_step"
        status: pass
      - kind: e2e
        ref: "tools/e2e/weapons.spec.js#holding fire with the level 3 laser opens a half-width 4 beam and releasing closes it"
        status: pass
    human_judgment: false
  - id: D2
    description: "The beam deals 1/2/3/4/5 damage on its first step and every 3rd step to every enemy it overlaps, air or ground, piercing all of them; edge contact counts and enemies below the nose or beside the beam are not hit"
    requirement: PLYR-05
    verification:
      - kind: unit
        ref: "tests/scorched_core/collision/test_area_hits.py#test_the_beam_pierces_every_enemy_stacked_in_the_column"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/weapons/test_laser_beam.py#test_damage_cadence_is_the_first_step_then_every_third_step_while_fire_is_held"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_the_laser_pierces_every_enemy_in_its_column_through_the_game_step"
        status: pass
    human_judgment: false
  - id: D3
    description: "At Lv5 the laser out-damages the Lv5 vulcan on one target and the Python tick stays within the 3 ms budget"
    requirement: PLYR-05
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_a_level_five_laser_out_damages_a_level_five_vulcan_on_one_target_over_sixty_steps"
        status: pass
      - kind: other
        ref: "npm run perf (avg 0.59 ms vs 3 ms budget); native laser tick 0.20 ms vs vulcan 0.26 ms"
        status: pass
    human_judgment: false
  - id: D4
    description: "The beam looks like a glowing blue Raiden laser, clearly different from the pink enemy bullets, thinner at Lv1, flickering subtly, with a muzzle flare"
    requirement: PLYR-04
    verification:
      - kind: unit
        ref: "web/test/fx/beam_mesh.test.js (geometry, additive HDR material, hide at 0, no allocation)"
        status: pass
    human_judgment: true
    rationale: "Colour, glow and flicker quality are visual judgments; headless screenshots at Lv1 and Lv5 showed a white-hot core with a blue halo, but only a person can sign off that it reads as the Raiden laser on a real display"

duration: 15 min
completed: 2026-10-18
status: complete
---

# Phase 02 Plan 21: Laser Beam Summary

**Blue is now a Raiden laser: a hitscan beam locked to the ship that widens from 2 to 7 units per half-width, pierces every air and ground enemy in its column for 1-5 damage every third step, and is drawn as an HDR blue core with a glow and muzzle flare from header slot BEAM_W.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-10-18T05:43:06Z
- **Completed:** 2026-10-18T05:58:00Z
- **Tasks:** 2
- **Files modified:** 12 (6 created, 6 modified)

## Accomplishments

- LaserBeam and `resolve_beam_vs_enemies`: a rectangle-circle test over the live enemies (no grid), edge contact counts, below-the-nose and beside-by-more-than-radius are misses, and HIT events still merge by flash state. Game steps the beam after the grid rebuild and before `remove_dead`, gated by `firing and loadout.kind is LASER`, and publishes `BEAM_W` (slot 18).
- `createBeamMesh` draws the core (width 2 x half-width), a 3.2x wider glow and a growing muzzle flare as additive HDR quads in the gameplay plane, from 10 units ahead of the ship to 8 units past the top edge, flickering in the shader and hidden at width 0; `main.js` wires it with a one-time prewarm show.
- Lv5 laser deals 100 damage over 60 steps to one target versus a lower vulcan total, a seeded laser run is byte-deterministic, and perf stays at 0.59 ms average (budget 3 ms); `make check` (ruff, 100% line+branch pytest, vitest, build, perf, 51 Playwright specs) is green.

## Task Commits

1. **Task 1: Tracer, hold fire to project a damaging blue beam end to end** - `f7bb884` (feat)
   - Visual tuning after a headless screenshot review: `5ea10c3` (fix)
2. **Task 2: Pierce, ground units, instant switch-off, laser over vulcan** - `3a9acfe` (test)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## Files Created/Modified

- `src/scorched_core/weapons/laser_beam.py` - LaserBeam state and 3-step cadence
- `src/scorched_core/collision/area_hits.py` - `resolve_beam_vs_enemies`
- `src/scorched_core/protocol.py`, `tuning.py` - `H_BEAM_W = 18`; `LASER_HALF_WIDTH`, `LASER_DAMAGE`, `LASER_HIT_INTERVAL`
- `src/scorched_core/game/game.py` - `Game.laser`, BEAM_W in the header and manifest slots
- `web/src/fx/beam_mesh.js` - HDR beam, glow and flare
- `web/src/main.js` - beam creation, prewarm, per-frame update, `fx.beamVisible` debug hook
- `tools/e2e/weapons.spec.js` - held fire gives BEAM_W 4 and a visible beam, release gives 0
- tests mirror the source tree (`test_laser_beam.py`, `test_area_hits.py`, `test_game.py`, `beam_mesh.test.js`)

## Decisions Made

- Pierce is the chosen behaviour (research assumption A2): all enemies in the column take damage every cadence step.
- The cadence countdown is zero on the first firing step, so a fresh press hits immediately and a release resets it; this is the "cadence" the tests pin.
- The beam draws below the playfield dim mask (renderOrder 4), so the 8-unit overshoot is clipped by the mask rather than glowing across the letterbox.
- Shader gains were lowered from the first draft (1.4 / 1.0 / 1.6) to 0.42 / 0.5 / 0.9 because the HDR sum tone-mapped to white and lost its blue.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Beam rendered blown-out white instead of blue**
- **Found during:** Task 2 human-check preparation (headless screenshot at `?weapon=laser&level=5`)
- **Issue:** the first gain values pushed core and glow far above 1 so bloom and tone mapping desaturated the beam to white, failing the plan's "clearly blue, different from pink" truth
- **Fix:** lowered core, glow and flare gains and sharpened the profile exponents; re-screenshotted at Lv1 and Lv5 (blue halo, white-hot centre line, Lv1 visibly thinner)
- **Files modified:** `web/src/fx/beam_mesh.js`
- **Verification:** vitest, build and the weapons e2e case pass; screenshots reviewed
- **Committed in:** `5ea10c3`

**2. [Rule 3 - Blocking] Hidden beam group would skip shader compile at prewarm**
- **Found during:** Task 1 (main.js wiring)
- **Issue:** `renderer.compile` only visits visible objects, so a beam hidden at width 0 would compile its three shaders on the first shot, a mid-game hitch
- **Fix:** `main.js` shows the beam once (`beam.update(1, ...)`) before the second prewarm and the tier geometry loop, then hides it before the start gate
- **Files modified:** `web/src/main.js`
- **Committed in:** `f7bb884`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** both were needed to meet the plan's own truths (blue beam, no first-use hitch). No scope creep.

### TDD note (Task 2, `tdd="true"`)

Task 2's behaviours (pierce, tank in column, switch-off, Lv5 laser over vulcan) were already satisfied by Task 1's implementation, which was written with the rectangle test and the Game wiring in place, so the new tests were green on first run (no separate RED). They still pin the behaviours; `area_hits.py` and the wiring needed no change.

## Issues Encountered

- None beyond the deviations. The `pkill` used to stop the preview server briefly killed the shell (matched its own command line); no state was lost.

## Known Stubs

None. The beam is fully wired from Python to the screen. Laser SHOT events and sound are intentionally left to plan 02-24.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `area_hits.py` is ready for plan 02-22's bomb and blast passes.
- Human check for the end-of-phase UAT: at `http://localhost:4173/?debug&weapon=laser&level=5` (`make preview`) holding fire shows a straight blue beam cutting through every enemy above the ship, thinner at `&level=1`, turning off the instant fire is released.

## Self-Check: PASSED

- All key files exist; commits `f7bb884`, `5ea10c3`, `3a9acfe` are in HEAD's history; `make check` exit 0 (100% coverage, vitest 715, perf 0.59 ms, Playwright 51 passed).

---
*Phase: 02-arcade-shooting-feel*
*Completed: 2026-10-18*
