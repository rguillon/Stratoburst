---
phase: 03-stage-1-vertical-slice
plan: 01
subsystem: stages
tags: [python, stage-timeline, scroll-distance, data-driven, tdd]

requires:
  - phase: 02-weapons-enemies-and-combat
    provides: GallerySpawner, EnemyPool, TerrainScroll, Game facade
provides:
  - WaveEntry, StageData (validated, with named markers) and StageDirector (distance-keyed cursor with jump/reset)
  - STAGE_1 typed data module with the slums opening and midboss/boss markers
  - Variable scroll speed (TerrainScroll.speed/target/set_target/jump) and speed-following ground units
  - Game(stage=, at=) with the D-30 marker jump
affects: [03-04, 03-05, 03-06, 03-12, 03-15, 03-17, 03-19, 03-27]

actuals:
  tokens: 10426
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Stage content is typed frozen Python data validated at import (D-03)"
    - "Timeline keyed on float scroll distance with a monotonic <= cursor (D-04)"
    - "A refused spawn is skipped, never queued"

key-files:
  created:
    - src/scorched_core/stages/wave_entry.py
    - src/scorched_core/stages/stage_data.py
    - src/scorched_core/stages/stage_director.py
    - src/scorched_core/stages/stage_1.py
    - tests/scorched_core/stages/test_wave_entry.py
    - tests/scorched_core/stages/test_stage_data.py
    - tests/scorched_core/stages/test_stage_director.py
    - tests/scorched_core/stages/test_stage_1.py
  modified:
    - src/scorched_core/stages/terrain_scroll.py
    - src/scorched_core/pools/enemy_pool.py
    - src/scorched_core/tuning.py
    - src/scorched_core/game/game.py
    - tests/scorched_core/stages/test_terrain_scroll.py
    - tests/scorched_core/pools/test_enemy_pool.py
    - tests/scorched_core/game/test_game.py

key-decisions:
  - "StageData validates ordering and ranges in __post_init__, so a stage module that imports is already valid (T-03-01)"
  - "StageDirector.jump uses bisect_right: a row exactly at the jump distance is skipped"
  - "Game._jump_to_marker leaves the director cursor alone when the start clamps to distance 0, so rows at 0.0 are kept"
  - "Gallery parity is proven by a SHA-256 over header slots 0-29 and live enemy rows of a 1200-step run, recorded from the pre-change core"

patterns-established:
  - "Data module with a Final constant and no class (stages/stage_1.py) still gets a mirrored test"
  - "Float-accumulation tests: replay the same repeated += 0.8 the game performs rather than hard-coding a step count"

requirements-completed: [ENMY-05, ENMY-01, ENMY-02]

coverage:
  - id: D1
    description: "Stage 1 is typed frozen data (WaveEntry/StageData/STAGE_1) validated at import; no parser"
    requirement: ENMY-05
    verification:
      - kind: unit
        ref: "tests/scorched_core/stages/test_stage_data.py; tests/scorched_core/stages/test_stage_1.py"
        status: pass
    human_judgment: false
  - id: D2
    description: "Director spawns every entry on the first step whose terrain.distance is >= its at; ties keep declared order; a refused spawn is skipped"
    requirement: ENMY-05
    verification:
      - kind: unit
        ref: "tests/scorched_core/stages/test_stage_director.py"
        status: pass
      - kind: integration
        ref: "tests/scorched_core/game/test_game.py#test_a_stage_game_spawns_the_first_entry_on_the_step_its_distance_is_reached"
        status: pass
    human_judgment: false
  - id: D3
    description: "Game() keeps the Phase 2 gallery byte-identical"
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_the_gallery_is_byte_identical_to_the_phase_two_core_over_1200_steps"
        status: pass
    human_judgment: false
  - id: D4
    description: "Scroll speed ramps to a target by SCROLL_ACCEL per step; ground units move by speed * GROUND_SCROLL_RATIO"
    requirement: ENMY-02
    verification:
      - kind: unit
        ref: "tests/scorched_core/stages/test_terrain_scroll.py; tests/scorched_core/pools/test_enemy_pool.py; tests/scorched_core/game/test_game.py#test_ground_units_follow_the_current_scroll_speed"
        status: pass
    human_judgment: false
  - id: D5
    description: "Game(stage=, at='midboss'|'boss') starts AT_LEAD before the marker and skips earlier rows; bad input raises ValueError"
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_a_jump_skips_every_entry_at_or_before_the_start_distance"
        status: pass
    human_judgment: false
  - id: D6
    description: "Stage 1 opening pacing feels sparse and approachable (D-07) with a carrier every 30-40 s (D-08)"
    requirement: ENMY-01
    verification:
      - kind: unit
        ref: "tests/scorched_core/stages/test_stage_1.py#test_consecutive_carriers_are_thirty_to_forty_seconds_apart"
        status: pass
    human_judgment: true
    rationale: "The numeric spacing is asserted, but whether the opening plays as approachable Raiden-pacing needs a human at the browser stage (plan 03-04 makes it playable)"

duration: 25min
completed: 2026-10-18
status: complete
plan_head_before: 56a6186afdae5769b149d7e447660112a7f98aaf
plan_head_after: 2d207e0b4b95e00e1dd10caf8b2c807f09010ab1
commits: 4
---

# Phase 3 Plan 01: Stage timeline, variable scroll and marker jump Summary

**Scroll-distance stage timeline driven by typed Python data (WaveEntry/StageData/StageDirector/STAGE_1), a ramping scroll speed that ground units follow, and a `Game(stage=, at=)` marker jump.**

## Performance

- **Duration:** about 25 min
- **Completed:** 2026-10-18
- **Tasks:** 2 (a tracer and an auto task, both TDD: 2 RED + 2 GREEN commits)
- **Files modified:** 15 (8 source, 7 test)

## Accomplishments
- `StageDirector` spawns every `WaveEntry` on the first step where the float `terrain.distance` reaches its `at` (`<=` with a monotonic cursor), so a 0.8-unit or crawl-speed step never skips a row; equal-`at` rows spawn together in declared order and a pool-refused row is dropped, not queued.
- `STAGE_1` holds the slums opening (distance 0 to 2550: jet Vs, helicopters, tank columns on the x=80/160 roads, AA turrets dropping BOMB, side sweeps, CARRIER crystal drops at 600 and 2160) plus `midboss` 4200 and `boss` 8640 markers; length 9300.
- `TerrainScroll` gained `speed`/`target`/`set_target`/`jump`; `EnemyPool.step` takes `ground_scroll`, and `Game` passes `terrain.speed * GROUND_SCROLL_RATIO` so ground units stay terrain-anchored during a crawl.
- `Game(stage=STAGE_1, at="boss")` starts `AT_LEAD` (320) units before the marker, skipping earlier rows; unknown markers or `at` without a stage raise `ValueError`. `Game()` is the unchanged gallery, proven by a SHA-256 digest recorded from the pre-change core.

## Tracer feedback gate

Task 1 is `type="tracer"` with an automated-only `<verify>` (`make lint && make test-python`). Re-run after the GREEN commit: lint clean, 1123 passed, 100% coverage. Tracer verified end-to-end, expansion (Task 2) proceeded.

## TDD Gate Compliance

Plan type is `execute` (task-level `tdd="true"`), `workflow.tdd_mode` is not enabled, so the gate classifier was not run. The discipline was followed per task:

- **Task 1 RED** `aba32e9`: tests plus minimal skeletons (so tests fail on assertions rather than at import). 29 tests failed on the planned behaviour (StageData validation/marker, director step/jump/reset, STAGE_1 shape, Game stage spawn). WaveEntry tests and a few vacuous-pass director tests passed against the skeleton (pure data declaration, nothing to fail).
- **Task 1 GREEN** `c0ce61a`: full suite 1123 passed at 100% coverage.
- **Task 2 RED** `750cec8`: 18 tests failed (TerrainScroll ramp/set_target/jump, EnemyPool ground_scroll, Game `at=` and speed-following). The gallery parity digest test passed in RED by design: it is a characterization test whose expected value (`3cf3728a...d2b4`) was recorded from the pre-change code before any edit.
- **Task 2 GREEN** `2d207e0`: full suite 1142 passed at 100% coverage.
- No REFACTOR commits were needed.

## Task Commits

1. **Task 1 RED: failing stage-director tests** - `aba32e9` (test)
2. **Task 1 GREEN: stage timeline director and STAGE_1** - `c0ce61a` (feat)
3. **Task 2 RED: failing scroll-ramp / ground / `?at=` tests** - `750cec8` (test)
4. **Task 2 GREEN: variable scroll, ground follow, marker jump** - `2d207e0` (feat)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## Files Created/Modified
- `src/scorched_core/stages/wave_entry.py` - frozen slotted spawn row (`at`, kind, x, y, motion, vx, vy, drop)
- `src/scorched_core/stages/stage_data.py` - validated stage (number, length, waves, markers) with `marker(name)`
- `src/scorched_core/stages/stage_director.py` - distance-keyed cursor: `step`, `jump`, `reset`
- `src/scorched_core/stages/stage_1.py` - `STAGE_1` data module
- `src/scorched_core/stages/terrain_scroll.py` - ramping speed, target, `set_target`, `jump`
- `src/scorched_core/pools/enemy_pool.py` - `step(..., ground_scroll=)`
- `src/scorched_core/tuning.py` - `SCROLL_ACCEL`, `MIDBOSS_CRAWL_SPEED`, `BOSS_CRAWL_SPEED`, `AT_LEAD`
- `src/scorched_core/game/game.py` - `stage`/`at` options, director branch in `_step`, `_jump_to_marker`
- Mirrored tests for each of the above (`tests/scorched_core/...`)

## Decisions Made
- Validation lives in `StageData.__post_init__` so ordering and range errors surface at import, naming the bad entry (mitigates T-03-01).
- `jump` skips rows with `at <= distance`, matching the plan's "no entry at or below that distance ever spawns".
- Parity digest hashes header slots 0-29 and live enemy rows only, so plan 03-04's header growth cannot break it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A clamped `?at=` start no longer skips rows at distance 0**
- **Found during:** Task 2 (marker jump design)
- **Issue:** The plan calls `director.jump(distance)` unconditionally. When the marker is nearer than `AT_LEAD`, `distance` clamps to 0.0 and `bisect_right` would silently drop any row authored at `at=0.0`, even though nothing precedes the start.
- **Fix:** `Game._jump_to_marker` calls `director.jump` only when `distance > 0.0`; the terrain jump is unconditional.
- **Files modified:** `src/scorched_core/game/game.py`, `tests/scorched_core/game/test_game.py` (`test_a_marker_closer_than_one_lead_starts_at_zero_and_keeps_the_whole_timeline`)
- **Verification:** the new test fails without the guard; full gate green at 100% branch coverage.
- **Committed in:** `2d207e0`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Behaviour for every reachable case in the plan is unchanged; only the degenerate clamped start differs, in the safer direction.

## Issues Encountered
None. The RED commits carry small skeleton modules (no behaviour) so the target tests fail on assertions instead of ImportError.

## Known Stubs
None. `STAGE_1` is intentionally only the opening section; downtown and airbase sections, patterns and paths land in plans 03-05 and 03-06 as the plan states.

## Threat Flags
None. No new network, auth or file surface; `at` only reaches `Game` from tests until plan 03-04.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 03-04 can make `Game(stage=STAGE_1)` the browser default and add the `?at=` URL allow-list; plans 03-05/03-06 append `pattern`, `path`, `mirror` to `WaveEntry` and extend `STAGE_1`.
- Crawl constants for the mid-boss and boss are in `tuning.py`, ready for 03-17 and 03-19 via `TerrainScroll.set_target`.

## Self-Check: PASSED

All created files exist; commits `aba32e9`, `c0ce61a`, `750cec8`, `2d207e0` are ancestors of HEAD; `make lint` and `make test-python` pass at 100% line and branch coverage (1142 tests); measured commit count 4.

---
*Phase: 03-stage-1-vertical-slice*
*Completed: 2026-10-18*
