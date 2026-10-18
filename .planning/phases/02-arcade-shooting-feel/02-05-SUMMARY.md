---
phase: 02-arcade-shooting-feel
plan: 05
subsystem: simulation
tags: [python, enemy-pool, gallery, motion, match, ground-scroll, turret-aim]

requires:
  - phase: 02-arcade-shooting-feel
    provides: "EnemyPool with kinds and sway (02-03), per-kind meshes and aux slot in the enemy channel (02-04), MEDIUM / LARGE blast classes (02-02)"
provides:
  - "MotionKind IntEnum (SWAY, DIVE, HOVER, GROUND) applied by a match in EnemyPool.step"
  - "Helicopter hover (descend to y 96, hold 240 steps drifting, leave downward), diving jets, terrain-anchored ground units"
  - "Turret and tank aim angle in the aux field of the enemy channel"
  - "1200-step endless gallery loop with the full air and ground roster"
  - "Manifest tuning ground_scroll_ratio, enemy_ground, enemy_radius for the JS ground layer and shadows"
affects: [02-12 ground layer, 02-10 drops, 02-14 human check, 02-26 drops, enemy fire plans]

actuals:
  tokens: 12600
  tasks: 3
  commits: 3
plan_head_before: b19e492e054be0a379178630cf52a87ebda48e8c
plan_head_after: e12c25e92c229b3f261ddea80b10ad497ddd79af

tech-stack:
  added: []
  patterns:
    - "Motion as data: one motion column per enemy, behaviour chosen by an exhaustive match with a loud ValueError arm"
    - "Gallery script entries are (tick, kind, x, y, motion, vx, vy, drop) tuples"

key-files:
  created:
    - src/scorched_core/entities/motion_kind.py
    - tests/scorched_core/entities/test_motion_kind.py
  modified:
    - src/scorched_core/pools/enemy_pool.py
    - tests/scorched_core/pools/test_enemy_pool.py
    - src/scorched_core/tuning.py
    - src/scorched_core/stages/gallery_spawner.py
    - tests/scorched_core/stages/test_gallery_spawner.py
    - src/scorched_core/game/game.py
    - tests/scorched_core/game/test_game.py
    - tests/scorched_core/collision/test_circle_hits.py

key-decisions:
  - "Hover state is carried by the timer column alone: a full timer plus y above the stop line means descending, a timer counting down means holding, zero means leaving, so no extra state column is needed"
  - "The match in EnemyPool.step ends in a ValueError arm for an unknown motion value instead of silently standing still"
  - "The ground scroll constant is computed once in the pool as SCROLL_SPEED * GROUND_SCROLL_RATIO (0.752 per step), the same product the JS ground layer will derive from the manifest"

patterns-established:
  - "New motion = new MotionKind value + one match arm + script entries; no per-kind branching in the step loop"
  - "Aim uses a module-level tuple of aiming kinds and math.atan2 on floats only (no allocation in the hot loop)"

requirements-completed: [ENMY-08, STGE-04, VISL-03]

coverage:
  - id: D1
    description: "MotionKind values and the motion/timer pool columns with spawn(kind, x, y, motion, vx, vy, drop)"
    requirement: ENMY-08
    verification:
      - kind: unit
        ref: "tests/scorched_core/entities/test_motion_kind.py"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/pools/test_enemy_pool.py#test_a_hover_spawn_starts_with_the_full_hold_timer_and_other_motions_with_none"
        status: pass
    human_judgment: false
  - id: D2
    description: "Helicopters descend to y 96, hold 240 steps drifting on a sine, leave downward at 1.4, always at angle 0, and die in a MEDIUM air blast"
    requirement: ENMY-08
    verification:
      - kind: unit
        ref: "tests/scorched_core/pools/test_enemy_pool.py#test_hover_stops_exactly_on_the_stop_line_and_holds_for_the_hold_ticks"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/pools/test_enemy_pool.py#test_killing_a_hover_helicopter_pushes_a_medium_air_explosion"
        status: pass
    human_judgment: false
  - id: D3
    description: "Jets dive in as a V and sweep in from both sides along straight lines facing their heading, culled past the far edge without a kill"
    requirement: ENMY-08
    verification:
      - kind: unit
        ref: "tests/scorched_core/pools/test_enemy_pool.py#test_a_dive_jet_crossing_the_field_leaves_on_the_far_side_without_a_kill_or_event"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/stages/test_gallery_spawner.py#test_jets_sweep_in_from_both_sides_and_the_top"
        status: pass
    human_judgment: false
  - id: D4
    description: "Tanks and turrets move 0.752 units per step with the terrain plus their crawl, and tank / turret aux carries the angle to the ship"
    requirement: STGE-04
    verification:
      - kind: unit
        ref: "tests/scorched_core/pools/test_enemy_pool.py#test_ground_without_a_crawl_moves_exactly_the_scaled_scroll_speed_per_step"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/pools/test_enemy_pool.py#test_aim_points_a_tank_or_turret_at_the_ship"
        status: pass
    human_judgment: false
  - id: D5
    description: "Killing a tank pushes a LARGE ground explosion"
    requirement: VISL-03
    verification:
      - kind: unit
        ref: "tests/scorched_core/pools/test_enemy_pool.py#test_killing_a_tank_pushes_a_large_ground_explosion"
        status: pass
    human_judgment: false
  - id: D6
    description: "1200-step gallery loop with at least 13 jets, 3 helicopters, 2 carriers, 4 tanks and 2 turrets; sorted script, safe sway margins, alive cap never exceeded over two loops"
    requirement: ENMY-08
    verification:
      - kind: unit
        ref: "tests/scorched_core/stages/test_gallery_spawner.py#test_the_gallery_never_exceeds_the_alive_cap_over_two_loops_and_never_refuses_a_spawn"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_live_enemies_never_exceed_the_alive_cap_over_two_loops"
        status: pass
    human_judgment: false
  - id: D7
    description: "Manifest tuning exports ground_scroll_ratio 0.94, enemy_ground and enemy_radius"
    requirement: STGE-04
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_the_manifest_exports_the_ground_scroll_ratio_and_per_kind_radii"
        status: pass
    human_judgment: false
  - id: D8
    description: "The 0.94 ground ratio leaves an invisible residual slide against the roads at gameplay speed"
    requirement: STGE-04
    verification: []
    human_judgment: true
    rationale: "Visual judgment against the JS ground layer that lands in plan 02-12; checked by the plan 02-14 human check, fallback is ratio 1.0"

duration: 9min
completed: 2026-10-18
status: complete
---

# Phase 2 Plan 5: Full gallery roster with data-driven enemy motion Summary

**Per-enemy MotionKind (SWAY, DIVE, HOVER, GROUND) applied by a match in the enemy pool: hovering helicopters, V-formation and side-sweeping jets, terrain-anchored tanks and turrets that aim at the ship, in one 1200-step deterministic loop**

## Performance

- **Duration:** 9 min
- **Started:** 2026-10-18T03:30:00Z
- **Completed:** 2026-10-18T03:39:00Z
- **Tasks:** 3
- **Files modified:** 10 (2 created, 8 modified)

## Accomplishments

- Enemies now move by data: the gallery script names a motion per entry and `EnemyPool.step` applies it with a `match`, with a loud `ValueError` arm so a corrupt motion value cannot silently freeze an enemy.
- Helicopters descend at 1.2 to y 96, hold for 240 steps drifting plus or minus 20 units on a 180-step sine, then leave at 1.4; the drift is frozen on the way out and the angle stays 0 (facing the player).
- Jets fly straight dives (V from the top, sweeps from the left and right edges) facing their heading and are culled past the far edge with no kill and no event.
- Ground units move at `SCROLL_SPEED * GROUND_SCROLL_RATIO` = 0.752 units per step plus their own crawl; the ratio, the ground flags and the radii are exported in `manifest()["tuning"]` for plan 02-12's JS ground layer and the shadows.
- Tank and turret `aux` carries `atan2(ship_x - x, ship_y - y)` (0 when the ship is straight below); every other kind keeps 0. `Game._step` passes the ship position.
- The loop is 1200 steps with 13 jets, 3 helicopters, 2 carriers, 4 tanks and 2 turrets; over two loops live enemies stay under the 40 cap and no scripted spawn is refused.

## Task Commits

1. **Task 1: Tracer, hover helicopters from the script** - `742ba9c` (feat)
2. **Task 2: Diving jets and the 1200-step air loop** - `0974c4f` (feat)
3. **Task 3: Ground scroll, turret aim, manifest fields** - `e12c25e` (feat)

**Plan metadata:** the docs commit that carries this file.

## Files Created/Modified

- `src/scorched_core/entities/motion_kind.py` - MotionKind IntEnum
- `src/scorched_core/pools/enemy_pool.py` - motion and timer columns, spawn with motion, DIVE / HOVER / GROUND arms, aim, step(ship_x, ship_y)
- `src/scorched_core/tuning.py` - HOVER_*, GROUND_SCROLL_RATIO, 1200-step GALLERY_SCRIPT
- `src/scorched_core/stages/gallery_spawner.py` - passes each entry's motion through
- `src/scorched_core/game/game.py` - steps enemies with the ship position, manifest tuning fields
- `tests/scorched_core/...` - motion kind, pool motions and aim, script invariants, game and manifest checks; existing enemy spawns updated to the new `spawn` signature

## Decisions Made

- Hover state lives in the `timer` column alone (full timer and above the stop line = descending, counting down = holding, zero = leaving), so no extra state column was needed and a heli spawned below the stop line simply holds at once.
- The `match` in `step` ends in a `ValueError` arm rather than a silent wildcard: it keeps branch coverage honest, and a bad motion value fails loudly in the Pyodide error panel instead of producing a frozen enemy.
- The script is plain literal data (readable, sorted by construction) instead of a generator expression.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Existing tests and callers use the old `spawn` / `step` signatures**
- **Found during:** Task 1 and Task 3
- **Issue:** The new `spawn(kind, x, y, motion, vx, vy, drop)` and `step(ship_x, ship_y)` signatures broke every existing enemy spawn / step call in the pool, collision and game tests, and the header test that assumed the first jet spawns on tick 39.
- **Fix:** Updated those call sites to pass `MotionKind.SWAY` and the ship position, and moved the "first enemy" header test to the new first spawn tick (30).
- **Files modified:** tests/scorched_core/pools/test_enemy_pool.py, tests/scorched_core/collision/test_circle_hits.py, tests/scorched_core/game/test_game.py, tests/scorched_core/stages/test_gallery_spawner.py
- **Verification:** full pytest gate at 100% line and branch coverage
- **Committed in:** 742ba9c, 0974c4f, e12c25e

**2. [Rule 1 - Bug] Unknown motion would silently freeze an enemy and left a partial branch**
- **Found during:** Task 3 (coverage gate: `enemy_pool.py` 179->183 partial branch)
- **Issue:** The `match` had no arm for an unrecognised motion value; the enemy would simply stop moving.
- **Fix:** Added a `case unknown:` arm raising `ValueError`, with a test that corrupts the motion column.
- **Files modified:** src/scorched_core/pools/enemy_pool.py, tests/scorched_core/pools/test_enemy_pool.py
- **Committed in:** e12c25e

### Plan-intermediate state

Task 1 kept a `case _: pass` arm for DIVE and GROUND (as the plan's step 1 described) with a "does not move yet" test; Tasks 2 and 3 replaced those arms and tests. No behaviour left unexercised at the end of the plan.

---

**Total deviations:** 2 auto-fixed (1 blocking signature migration, 1 bug-prevention arm)
**Impact on plan:** Both necessary for correctness and the 100% gate. No scope creep.

## Issues Encountered

- The `<project_root_pin>` guard script in the dispatch prompt could not be run verbatim: its `case "$PINNED_ROOT" in ''|'/home/renaud/scorched') ... pin-unbound` arm matches the real, correctly bound pin because the build-time substitution replaced the `{PINNED_ROOT}` sentinel in that arm too, so the script fails closed on every valid root. I ran an equivalent check instead (the actual `git rev-parse --show-toplevel` equals the pinned root's toplevel) before the first write and before every commit. The orchestrator's guard template should keep the unbound sentinel literal in that arm.
- `npm run perf` is wrapped by `make perf`, and the Playwright specs by `make e2e`; the plan text uses the npm names, the project rule is Makefile targets, so Makefile targets were used.

## Verification Results

- `uv run ruff check .` and `uv run ruff format --check .`: clean
- `uv run pytest --cov --cov-branch --cov-fail-under=100`: 473 passed, 100% line and branch
- `make perf`: avg_ms 0.5648 (p95 0.6286) against the 3 ms budget (tracer run before ground units: 0.5665)
- `make check` (lint, test, build, full Playwright suite): 39 e2e passed, including shooting and stress
- Acceptance greps: `class MotionKind`, `GALLERY_LOOP_TICKS: Final = 1200`, `GROUND_SCROLL_RATIO: Final = 0.94` all match; the `-k "ground or aim or radius"` selection (20 tests) passes

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. (The JS ground layer that consumes `ground_scroll_ratio` lands in plan 02-12; this plan only exports the value.)

## Threat Flags

None. T-02-07 is mitigated by the two-loop alive-cap tests and the unchanged perf budget; no new packages (T-02-SC).

## Next Phase Readiness

- Plan 02-12 can read `ground_scroll_ratio`, `enemy_ground` and `enemy_radius` from the manifest and scroll wrecks and scorch marks at 0.752 per step.
- The 0.94 residual slide still needs the plan 02-14 human check (fallback ratio 1.0).
- `drop` is still -1 on every script entry; plans 02-10 and 02-26 set drops.

---
*Phase: 02-arcade-shooting-feel*
*Completed: 2026-10-18*

## Self-Check: PASSED

- Files exist: motion_kind.py, test_motion_kind.py, and all modified sources and tests
- Commits exist on HEAD: 742ba9c, 0974c4f, e12c25e
- Measured commit count from the ledger: 3 (b19e492..e12c25e)
