---
phase: 03-stage-1-vertical-slice
plan: 14
subsystem: bosses
tags: [boss, enemy-pool, state-machine, phases, stumps, python-core, tdd]

requires:
  - phase: 03-stage-1-vertical-slice
    provides: run_pattern, PATTERN_TABLE and pattern_index (03-05); EnemyPool SCRIPTED motion and index_of_uid (03-06..03-08); protocol boss events EV_PART_DESTROYED / EV_BOSS_PHASE / EV_BOSS_DEFEATED / EV_BOSS_RETREAT and BLAST_HUGE (03-02)
provides:
  - BossController (start, step, settle, active, phase_number, hp_fraction, seconds_left, destroyed, gone) driving ordinary EnemyPool rows from a frozen BossSpec
  - BossSpec, PartSpec, PhaseSpec, EmitterSpec (frozen, validated at construction) and the BossState IntEnum
  - EnemyKind TRAIN 5 / TRAIN_TURRET 6 / TRAIN_STUMP 7 with all per-kind tables, HITSTOP_PART_TICKS, HITSTOP_BOSS_TICKS, BOSS_PHASE_SHIELD_TICKS, BOSS_RETREAT_SPEED, BOSS_TIMER_SHOW_S, BOSS_MAX_RADIUS
  - EnemyPool hp_max and shield columns, spawn hp / radius / shield overrides, become_stump, remove_uid; MissilePool never targets a shielded row
  - Patterns train_turret_aimed and train_hull_spread
affects: [03-15 destructible lots, 03-16 mid-boss rendering, 03-17 stage wiring of the mid-boss data and Game integration, 03-19 giant bomber, 03-2x HUD boss timer]

actuals:
  tokens: 26100
  tasks: 2
  commits: 4
plan_head_before: 737e169327d0a1792fe9e6a5318346d7ef808c27
plan_head_after: c5e42ba7eb678b04885922149db22ff889d38a05

tech-stack:
  added: []
  patterns:
    - "A boss is ordinary EnemyPool rows under a controller: every weapon (bolt, missile, laser, bomb) damages it through apply_hit with no weapon change"
    - "Two-call controller contract: step before EnemyPool.step, settle after the damage passes and before remove_dead; rows found by uid, never by slot"
    - "Integer HP thresholds: phase fractions are precomputed to hit points once, so an exact fraction (0.6 of 500) triggers"
    - "Step-counted fight: fight_ticks counts only simulation steps after the entrance, so hitstop and pause freeze the timeout for free"

key-files:
  created:
    - src/scorched_core/bosses/__init__.py
    - src/scorched_core/bosses/boss_controller.py
    - src/scorched_core/bosses/boss_spec.py
    - src/scorched_core/bosses/part_spec.py
    - src/scorched_core/bosses/phase_spec.py
    - src/scorched_core/bosses/emitter_spec.py
    - src/scorched_core/bosses/boss_state.py
    - tests/scorched_core/bosses/test_boss_controller.py
    - tests/scorched_core/bosses/test_boss_spec.py
    - tests/scorched_core/bosses/test_part_spec.py
    - tests/scorched_core/bosses/test_phase_spec.py
    - tests/scorched_core/bosses/test_emitter_spec.py
    - tests/scorched_core/bosses/test_boss_state.py
  modified:
    - src/scorched_core/entities/enemy_kind.py
    - src/scorched_core/tuning.py
    - src/scorched_core/pools/enemy_pool.py
    - src/scorched_core/pools/missile_pool.py
    - src/scorched_core/patterns/pattern_library.py
    - tests/scorched_core/entities/test_enemy_kind.py
    - tests/scorched_core/pools/test_enemy_pool.py
    - tests/scorched_core/pools/test_missile_pool.py
    - tests/scorched_core/patterns/test_pattern_library.py
    - tests/scorched_core/game/test_game.py
    - tests/scorched_core/stages/test_stage_1.py

key-decisions:
  - "The controller keeps the hull's logical position (_x, _y) itself and writes it into the rows, instead of reading rows back: a row removed by another system is skipped and never mis-read, and a boss with a missing hull still ends through the timeout"
  - "Phase thresholds are compared as integer hit points (int(frac * hull_hp + 1e-6)) so a hull exactly on a fraction triggers the phase without float noise"
  - "On hull death the controller sets the hull row to 1 hp (shielded for good) so remove_dead cannot remove it mid-sequence; the sequence ends with remove_uid, so no kill is counted and nothing is paid twice"
  - "settle order in the fight: parts to stumps, then hull death, then timeout (after damage, so a kill on the timeout step counts), then the phase rule; a timeout step never also changes phase"
  - "Enemy bullets are cleared at the end of the death sequence and on each phase change, as the plan states; the BOSS_DEFEATED, HUGE explosion and part events are not low priority, the chain explosions and ENEMY_FIRE are"
  - "Sway is x = sin(a), y = sin(2a) around the hold point (a figure eight), so both start at zero offset and a fight opens without a position jump"
  - "BOSS_MAX_RADIUS (29.5 = GRID_CELL minus the larger shot radius) lives in tuning.py and is the single limit PartSpec and BossSpec validate against"

patterns-established:
  - "Boss data is repository data validated at construction: radius, hp, hold line, threshold order and emitter part indexes all raise ValueError on import"
  - "A restartable controller: start() resets every field, so one instance can run a fresh fight after GONE"

requirements-completed: [ENMY-06, ENMY-07, ENMY-09]

coverage:
  - id: D1
    description: "A boss hull and its destructible parts are ordinary EnemyPool rows; shielded rows take no damage, flash nothing and are never homing targets"
    requirement: ENMY-07
    verification:
      - kind: unit
        ref: "tests/scorched_core/pools/test_enemy_pool.py#test_a_shielded_row_takes_no_damage_no_flash_and_pushes_no_event"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/pools/test_missile_pool.py#test_nearest_uid_never_picks_a_shielded_enemy"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/bosses/test_boss_controller.py#test_start_spawns_a_shielded_scripted_hull_and_parts_at_the_spec_offsets"
        status: pass
    human_judgment: false
  - id: D2
    description: "A part shot to zero becomes a stump on the hull (explosion, PART_DESTROYED, hitstop, points) before remove_dead, and never counts again"
    requirement: ENMY-07
    verification:
      - kind: unit
        ref: "tests/scorched_core/bosses/test_boss_controller.py#test_a_destroyed_part_becomes_a_stump_pays_its_points_and_asks_for_hitstop"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/bosses/test_boss_controller.py#test_a_stump_never_counts_again_and_takes_no_damage"
        status: pass
    human_judgment: false
  - id: D3
    description: "Phases change by hull threshold (equal triggers, jumps to the deepest) and by the all-parts rule, with one BOSS_PHASE event, a shield, cleared bullets and restarted emitters"
    requirement: ENMY-06
    verification:
      - kind: unit
        ref: "tests/scorched_core/bosses/test_boss_controller.py#test_a_hull_fraction_exactly_on_a_threshold_enters_that_phase_with_one_event"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/bosses/test_boss_controller.py#test_the_last_part_and_the_threshold_on_one_step_give_a_single_transition"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/bosses/test_boss_controller.py#test_a_transition_shields_every_live_row_clears_enemy_bullets_and_restarts_the_emitters"
        status: pass
    human_judgment: false
  - id: D4
    description: "A boss always ends: the step-counted timeout retreats it shielded and silent and removes it (destroyed False); a kill on the timeout step counts as destroyed"
    requirement: ENMY-09
    verification:
      - kind: unit
        ref: "tests/scorched_core/bosses/test_boss_controller.py#test_a_boss_that_nobody_shoots_still_ends"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/bosses/test_boss_controller.py#test_a_hull_destroyed_on_the_timeout_step_counts_as_destroyed"
        status: pass
    human_judgment: false
  - id: D5
    description: "Hull death plays a fixed-length chain of low-priority LARGE explosions, then one HUGE explosion, BOSS_DEFEATED, cleared bullets, boss hitstop and removed rows, paying the kill points once"
    requirement: ENMY-06
    verification:
      - kind: unit
        ref: "tests/scorched_core/bosses/test_boss_controller.py#test_the_end_of_the_sequence_is_one_huge_explosion_and_a_defeat_event"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/bosses/test_boss_controller.py#test_the_final_events_survive_a_nearly_full_ring"
        status: pass
    human_judgment: false
  - id: D6
    description: "Emitters are data: declared-order firing, bursts, part guns stopping at the stump, hull sway, and the slow, sparse train patterns"
    requirement: ENMY-06
    verification:
      - kind: unit
        ref: "tests/scorched_core/bosses/test_boss_controller.py#test_emitters_fire_in_their_declared_order_from_their_own_muzzles"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/patterns/test_pattern_library.py#test_the_train_patterns_are_registered_slow_and_sparse_for_the_mid_boss"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-10-18
status: complete
---

# Phase 3 Plan 14: Composite Boss Engine Summary

**Spec-driven BossController that runs a boss as ordinary shielded EnemyPool rows: turret parts shot off become permanent stumps, hull-threshold and all-parts phase changes, data emitters, a step-counted timeout retreat and a chained death sequence, all deterministic and at 100% coverage.**

## Performance

- **Duration:** about 15 min
- **Started:** 2026-10-18T18:15:00Z (approximate; the start time was not recorded)
- **Completed:** 2026-10-18T18:30:00Z
- **Tasks:** 2 (a tracer and an auto task, both TDD)
- **Files modified:** 24 (13 new, 11 changed), 2262 insertions

## Accomplishments

- The STATE.md blocker is resolved at engine level: hull and parts are `EnemyPool` rows, so vulcan, laser, homing and bomb damage them through `apply_hit` with no weapon change. `hp_max` and `shield` columns, spawn overrides, `become_stump` and `remove_uid` were added to the pool, and `MissilePool._nearest` skips shielded rows.
- ENMY-07: `settle()` runs before `remove_dead`, converts a dead part in place into a stump (kind, hp 1, permanent shield, stump radius, no pattern), pushes EXPLOSION and PART_DESTROYED, requests 4 steps of hitstop and returns the part's points.
- ENMY-06: phases with strictly descending integer-HP thresholds, the deepest satisfied one wins, the all-parts rule from phase 1 (never vacuous for a spec with no parts), one BOSS_PHASE event per change, a 45-step shield, cleared bullets, restarted emitters and an optional hull kind swap; emitters fire in declared order and a part's gun stops at its stump.
- ENMY-09: the fight counts simulation steps from the end of the entrance. At the timeout the boss retreats shielded and silent with one BOSS_RETREAT event and is removed (destroyed False); a hull killed on the timeout step is destroyed. A killed hull plays a fixed-length death chain, then a HUGE explosion, BOSS_DEFEATED, cleared bullets, 8 steps of hitstop and removed rows, paying the kill points once.
- `make lint && make test-python` green: 1772 passed, 100% line and branch coverage. `npm test` (1236 vitest tests) also green.

## Task Commits

1. **Task 1 (tracer): boss rows, stumps, controller entrance and part settle**
   - RED `4041453` (test): failing tests for the kinds, pool columns, stumps, missile rule, specs and controller
   - GREEN `edb8aac` (feat): implementation
2. **Task 2: phases, emitters, timeout retreat, death chain, train patterns**
   - RED `7af93f5` (test): failing tests
   - GREEN `c5e42ba` (feat): implementation

**Plan metadata:** the docs commit that adds this SUMMARY, STATE.md, ROADMAP.md and REQUIREMENTS.md.

Tracer feedback gate: `<verify>` is automated-only and was re-run after Task 1 (`make lint && make test-python`, green), so the tracer was verified end-to-end before expanding.

## Files Created/Modified

- `src/scorched_core/bosses/boss_controller.py` - the controller: start, step, settle, phases, emitters, sway, retreat, death chain
- `src/scorched_core/bosses/{boss_spec,part_spec,phase_spec,emitter_spec,boss_state}.py` - frozen validated data and the state enum
- `src/scorched_core/pools/enemy_pool.py` - hp_max / shield columns, spawn overrides, become_stump, remove_uid, shield countdown, TRAIN_TURRET aims
- `src/scorched_core/pools/missile_pool.py` - shielded rows are never targets
- `src/scorched_core/entities/enemy_kind.py`, `src/scorched_core/tuning.py` - train kinds, tables, hitstop and boss constants
- `src/scorched_core/patterns/pattern_library.py` - train_turret_aimed and train_hull_spread
- tests mirror each module under `tests/scorched_core/`

## Decisions Made

See `key-decisions` above. The two that later plans must know: the controller owns the hull position and writes it into the rows (do not move boss rows elsewhere), and `settle` returns the points to award (the pool pays train kinds 0, so the game must add the return value to the score).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Existing tests pinned the five-kind roster**
- **Found during:** Task 1 (GREEN)
- **Issue:** Extending the per-kind tables and `EnemyKind` broke tests outside the plan's file list that assert the exact roster: `test_game.py` (manifest `enemy_kinds`, `enemy_ground`, `enemy_radius`), `test_stage_1.py` (the opening uses every roster kind), and `test_enemy_pool.py` (expected drops `[0..4]`).
- **Fix:** Updated those assertions to the eight-kind roster; the stage test now asserts the gallery kinds, since the train kinds are boss rows that plan 03-17 places.
- **Files modified:** tests/scorched_core/game/test_game.py, tests/scorched_core/stages/test_stage_1.py, tests/scorched_core/pools/test_enemy_pool.py
- **Verification:** make test-python and npm test green
- **Committed in:** edb8aac

**2. [Rule 2 - Missing critical] Hit-point validation and a shared radius limit**
- **Found during:** Task 1
- **Issue:** `pack_into` now divides by `hp_max`, so a spawn with `hp < 1` would divide by zero or pack nonsense; and the 29.5 limit from RESEARCH Pitfall 2 needed one source of truth.
- **Fix:** `EnemyPool.spawn` raises ValueError for `hp < 1`; added `BOSS_MAX_RADIUS` to tuning.py and used it in `PartSpec` and `BossSpec`.
- **Files modified:** src/scorched_core/pools/enemy_pool.py, src/scorched_core/tuning.py
- **Verification:** `test_a_spawn_with_no_hit_points_is_a_loud_error`, `test_the_largest_legal_radius_leaves_room_for_the_larger_shot_inside_one_cell`
- **Committed in:** edb8aac

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Both necessary for correctness; no scope creep.

## TDD Gate Compliance

Both tasks have a `test(03-14)` commit before their `feat(03-14)` commit (4041453 then edb8aac, 7af93f5 then c5e42ba); no refactor commits were needed. The plan type is `execute` (task-level `tdd="true"`), so the RED runs were not passed through `gsd check tdd-red-evidence`. Semantic assessment of the RED evidence: the new test modules failed to import the missing API (`scorched_core.bosses.*` ModuleNotFoundError, `EnemyKind.TRAIN` AttributeError) or failed on the new table values, which is the intended failure for a tracer that introduces the API, not a syntax or fixture fault.

## Issues Encountered

- A bolt hits the first live row in grid query order. A part whose circle overlaps the hull's circle can be shadowed by the hull (the hull spawns first, so it has the lower pool index). The tests place parts outside the hull circle (offset 36 against radius 28 plus the bolt's 2). Plan 03-17's mid-boss data should do the same, or check with a real bolt. The laser and the bomb hit every overlapping row, so this only affects bolts and missiles.
- The pre-commit HEAD assertion would normally refuse commits on `main`; the orchestrator pinned sequential mode on main and `git.allow_default_branch_commits` is true, so commits went to main as in the earlier plans.

## Known Stubs

None. No placeholder values flow to rendering; the train kinds have no JS model builder yet by design (plan 03-16/03-17 add the mid-boss models; kinds without a builder already fall back to tinted primitives).

## Threat Flags

None. The controller adds no network, auth or file surface. T-03-18 (a boss always ends) is mitigated by the step-counted timeout and the fixed-length death sequence, both tested (`test_a_boss_that_nobody_shoots_still_ends`); T-03-19 by pushing the chain explosions low priority (`test_a_chain_explosion_is_refused_when_the_ring_is_nearly_full`, `test_the_final_events_survive_a_nearly_full_ring`). T-03-SC: no new packages.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 03-17: build the mid-boss `BossSpec` (train hull, gun cars, two or three phases) and wire the controller into `Game`: call `controller.step(...)` after the director and before `enemies.step`, `controller.settle(...)` after the damage passes and before `remove_dead`, add its return to the score, publish `phase_number`, `hp_fraction` and `seconds_left` in the header, and treat `controller.gone` / `destroyed` as the stage-flow trigger.
- Not done here (by design): Game integration, header slots, stage data, JS models for the train kinds, the boss warning and the giant bomber (03-19).

## Self-Check: PASSED

All 13 created files exist on disk; commits 4041453, edb8aac, 7af93f5 and c5e42ba are ancestors of HEAD; `make lint && make test-python` and `npm test` pass; all `<acceptance_criteria>` greps and pytest selections matched.

---
*Phase: 03-stage-1-vertical-slice*
*Completed: 2026-10-18*
