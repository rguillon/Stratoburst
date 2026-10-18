---
phase: 03-stage-1-vertical-slice
plan: 19
subsystem: bosses
tags: [boss, bomber, warning, stage-flow, clear-state, patterns, python-core, tdd]

requires:
  - phase: 03-stage-1-vertical-slice
    provides: BossController, BossSpec, PartSpec, PhaseSpec, EmitterSpec (03-14); StageFlow MIDBOSS state, flow.boss, StageData.boss, generic header and manifest boss wiring (03-17); BOSS_CRAWL_SPEED, EV_BOSS_WARNING, FlowState.WARNING / BOSS / CLEAR values (03-02, 03-08)
provides:
  - EnemyKind BOMBER 12, BOMBER_TURRET 13, BOMBER_ENGINE 14, BOMBER_STUMP 15, BOMBER_OPEN 16 with every per-kind table row (air units) and WARNING_TICKS 180
  - Six bomber patterns (bomber_turret_spread, bomber_nose_ring, bomber_core_ring, bomber_core_stream, bomber_desperation_ring, bomber_desperation_spread), all at most 2.0 units per step and 45 steps apart
  - BOMBER_1 BossSpec (1400 hp hull, two 200 hp wing turrets worth 8000, two 220 hp engines worth 6000, three phases, 6000-step timeout, kill pays 0) and STAGE_1.boss
  - StageFlow WARNING, BOSS and CLEAR states, boss_destroyed, EnemyPool.detonate_all
  - Header reports BOSS_ACTIVE 2 / BOSS_HP 1.0 from the WARNING on; manifest stage.bosses lists slot 2 with phase_fracs [0.6, 0.25]
affects: [03-20 bomber models, WARNING banner and death chain, 03-21 tally and restart loop, 03-28 vertical-slice gate tuning]

actuals:
  tokens: 14161
  tasks: 2
  commits: 4
plan_head_before: 3b2fa9cfe39625a8a8b542c48e5dac016181720d
plan_head_after: 5c8e3c0ffa6090cdfa08e5737d03cf691b3928a2

tech-stack:
  added: []
  patterns:
    - "A boss marker raises a WARNING state with a trigger window past the marker (BOSS_TRIGGER_WINDOW), mirroring the mid-boss, so a debug jump never starts a skipped fight"
    - "StageFlow owns every fight state (MIDBOSS, WARNING, BOSS, CLEAR) and game over wins in all of them; Game only steps and settles whatever flow.boss is"
    - "The stage clear empties the field without paying: EnemyPool.detonate_all pushes low-priority explosions and no kills"

key-files:
  created: []
  modified:
    - src/scorched_core/entities/enemy_kind.py
    - src/scorched_core/tuning.py
    - src/scorched_core/pools/enemy_pool.py
    - src/scorched_core/patterns/pattern_library.py
    - src/scorched_core/bosses/stage_1_bosses.py
    - src/scorched_core/bosses/boss_controller.py
    - src/scorched_core/stages/stage_1.py
    - src/scorched_core/stages/stage_flow.py
    - src/scorched_core/game/game.py
    - tests/scorched_core/entities/test_enemy_kind.py
    - tests/scorched_core/pools/test_enemy_pool.py
    - tests/scorched_core/patterns/test_pattern_library.py
    - tests/scorched_core/bosses/test_stage_1_bosses.py
    - tests/scorched_core/bosses/test_boss_controller.py
    - tests/scorched_core/stages/test_stage_1.py
    - tests/scorched_core/stages/test_stage_flow.py
    - tests/scorched_core/game/test_game.py

key-decisions:
  - "The plan's part positions were kept (turrets at +-46,6; engines at +-26,-2): the turrets stand clear of the hull circle, the engine pods sit partly inside it. Measured with the real game, a tracking Lv1 vulcan still shoots both turrets off and dents an engine, homing reaches the engines, and the laser and bomb pierce, so no part is unhittable; see Issues Encountered for the narrow window"
  - "Parts are ordered turret left, turret right, engine left, engine right (indexes 0..3 in PART_DESTROYED events)"
  - "A phase jump keeps the deepest hull_kind named so far (controller fix), so a hit from 70% to 20% still opens the core; phase 3 therefore needs no hull_kind of its own"
  - "The CLEAR state also yields to GAME_OVER when the ship is OUT, so a ship that was already dying when the bomber fell cannot sit in a stage clear with no controls"
  - "The WARNING reports BOSS_ACTIVE 2, BOSS_PHASE 1, BOSS_HP 1.0 and BOSS_TIMER_S -1 straight from the flow, since there is no controller yet; the WARNING clock stops at WARNING_TICKS while a crowded pool makes the bomber wait for room (progress stays 1.0)"
  - "BOSS_TRIGGER_WINDOW (80 units) is a separate constant from MIDBOSS_TRIGGER_WINDOW so each marker can be tuned alone"
  - "Phase sway periods (360 / 300 / 240 steps) and the bomber's 150-step death are discretion values for the vertical-slice gate to tune with ?at=boss"

patterns-established:
  - "Per-kind table rows for a new boss are appended in EnemyKind order and every roster-pinning test is updated with them"
  - "Bomber tests drive the real Game from ?at=boss: laser kill to CLEAR, unshot timeout to CLEAR with boss_destroyed False, game over in WARNING and in BOSS"

requirements-completed: [ENMY-06, ENMY-07, ENMY-09]

coverage:
  - id: D1
    description: "The boss marker raises a WARNING for 180 steps (one BOSS_WARNING event, scroll slowing to the 0.12 crawl and still moving, spawning stopped, boss bar reported full with FLOW_T rising 0 to 1), then the bomber starts in boss slot 2"
    requirement: ENMY-06
    verification:
      - kind: unit
        ref: "tests/scorched_core/stages/test_stage_flow.py#test_the_boss_marker_raises_one_warning_and_slows_the_scroll_to_the_boss_crawl"
        status: pass
      - kind: integration
        ref: "tests/scorched_core/game/test_game.py#test_the_warning_shows_the_boss_bar_full_and_the_flow_clock_rising"
        status: pass
      - kind: integration
        ref: "tests/scorched_core/game/test_game.py#test_the_scroll_slows_to_the_boss_crawl_and_keeps_moving"
        status: pass
      - kind: integration
        ref: "tests/scorched_core/game/test_game.py#test_nothing_new_spawns_from_the_warning_on"
        status: pass
    human_judgment: false
  - id: D2
    description: "The bomber is data: 1400 hp hull, wing turrets (200 hp, 8000) and engines (220 hp, 6000) that become stumps, three phases at 60% and 25%, phase 2 opens the core (BOMBER_OPEN), total hp 2240 inside the 2000-2500 research range"
    requirement: ENMY-07
    verification:
      - kind: unit
        ref: "tests/scorched_core/bosses/test_stage_1_bosses.py"
        status: pass
      - kind: integration
        ref: "tests/scorched_core/game/test_game.py#test_the_four_parts_pay_their_points_and_become_stumps"
        status: pass
    human_judgment: false
  - id: D3
    description: "Phase 2 starts at exactly 60% hull or when all four parts are destroyed, a 70% to 20% hit jumps to phase 3 with one BOSS_PHASE event and the core still opens, live turrets keep firing in phase 2"
    requirement: ENMY-06
    verification:
      - kind: unit
        ref: "tests/scorched_core/bosses/test_boss_controller.py#test_destroying_all_four_bomber_parts_at_full_hull_health_opens_the_core"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/bosses/test_boss_controller.py#test_the_bomber_hull_at_exactly_sixty_percent_enters_phase_two_and_opens"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/bosses/test_boss_controller.py#test_one_hit_from_seventy_to_twenty_percent_jumps_to_phase_three_with_one_event"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every bomber pattern is at most 2.0 units per step and at least 45 steps apart; the peak live enemy bullets measured per phase (26, 41, 59) stay far under the 400 cap"
    requirement: ENMY-06
    verification:
      - kind: unit
        ref: "tests/scorched_core/patterns/test_pattern_library.py#test_every_bomber_pattern_is_slow_and_sparse_so_the_fight_is_not_bullet_hell"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/bosses/test_stage_1_bosses.py#test_no_bomber_gun_in_any_phase_is_faster_than_two_or_closer_than_forty_five_steps"
        status: pass
    human_judgment: false
  - id: D5
    description: "An unshot bomber counts down BOSS_TIMER_S 20..1, retreats once at 6000 fight steps, the flow reaches CLEAR with boss_destroyed False and the score unchanged; a kill pays only the parts"
    requirement: ENMY-09
    verification:
      - kind: integration
        ref: "tests/scorched_core/game/test_game.py#test_an_unshot_bomber_counts_down_its_last_twenty_seconds_then_retreats_unpaid"
        status: pass
      - kind: integration
        ref: "tests/scorched_core/game/test_game.py#test_shooting_the_bomber_down_pays_only_its_parts_not_the_kill"
        status: pass
    human_judgment: false
  - id: D6
    description: "When the bomber is gone the flow enters CLEAR with boss_destroyed recorded, every remaining enemy explodes unpaid and enemy bullets are cleared; game over during WARNING or the fight is never replaced by CLEAR"
    requirement: ENMY-09
    verification:
      - kind: integration
        ref: "tests/scorched_core/game/test_game.py#test_the_bomber_is_destroyed_by_the_laser_and_the_stage_goes_on_to_clear"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/stages/test_stage_flow.py#test_clear_explodes_every_remaining_enemy_unpaid_and_clears_the_enemy_bullets"
        status: pass
      - kind: integration
        ref: "tests/scorched_core/game/test_game.py#test_game_over_during_the_boss_fight_is_never_replaced_by_clear"
        status: pass
      - kind: integration
        ref: "tests/scorched_core/game/test_game.py#test_game_over_during_the_warning_wins_and_no_bomber_ever_comes"
        status: pass
    human_judgment: false
  - id: D7
    description: "How the fight feels: HP split, sway periods, pattern density, the 3 s WARNING and the 150-step death are discretion values; the engine pods are reachable by plain bolts only through a narrow gap"
    verification: []
    human_judgment: true
    rationale: "Pacing, difficulty and fairness of the part geometry are felt, not asserted; the bomber has no model until plan 03-20, so they are tuned at the vertical-slice gate (03-28) with ?at=boss"

duration: 12min
completed: 2026-10-18
status: complete
---

# Phase 3 Plan 19: Giant Bomber Boss, WARNING and CLEAR Summary

**Stage 1 now ends with a 3-second WARNING and a three-phase giant bomber (1400 hp hull, shootable wing turrets and engine pods, an opening core, a 100-second timeout retreat) that StageFlow runs through new WARNING, BOSS and CLEAR states, with the field blown up unpaid and `boss_destroyed` recorded for the tally.**

## Performance

- **Duration:** about 12 min (start time not recorded programmatically; estimated from the previous plan's commit)
- **Started:** about 2026-10-18T19:38:00Z
- **Completed:** 2026-10-18T19:52:00Z
- **Tasks:** 2 (a tracer and an auto task, both TDD)
- **Files modified:** 17 (9 source, 8 test), 1314 insertions and 76 deletions

## Accomplishments

- The five bomber kinds (air units, no wreck, no default fire, `BOMBER_TURRET` aims at the ship) and `WARNING_TICKS` 180, with every pinned roster test updated.
- `StageFlow` raises the WARNING at the boss marker (one `BOSS_WARNING`, scroll target `BOSS_CRAWL_SPEED`, director stopped, `progress` 0 to 1), starts `BossController(BOMBER_1, slot 2)` after 180 steps (retrying if the pool is full), and on the bomber being gone enters CLEAR with `boss_destroyed`, `EnemyPool.detonate_all` and the enemy bullets cleared. Game over wins in every one of these states.
- `Game` reports the boss bar from the WARNING (BOSS_ACTIVE 2, BOSS_HP 1.0); the manifest `stage.bosses` already generic from 03-17 now lists `{slot 2, name boss, phase_fracs [0.6, 0.25]}` with no code change.
- `BOMBER_1` has three phases: parts intact with turret spreads and a nose ring; at 60% (or all four parts gone) the hull row switches to `BOMBER_OPEN` with a rotating core ring and stream while live turrets keep firing; at 25% a faster, denser desperation ring and spread with a wider sway. Peak enemy bullets measured per phase: 26, 41, 59 (cap 400).
- The unshot bomber retreats once at exactly 6000 fight steps (countdown 20..1), the flow reaches CLEAR with `boss_destroyed` False and the score untouched; a laser kill from `?at=boss` runs WARNING, BOSS, one `BOSS_DEFEATED`, CLEAR with `boss_destroyed` True.
- `make lint && make test-python`: 1955 passed, 100% line and branch coverage. `make test-web`: 1419 vitest tests pass.

## Task Commits

1. **Task 1 (tracer): the boss marker raises a WARNING, the bomber descends, destroying it ends in CLEAR**
   - RED `6b0e66a` (test): failing tests for the kinds, pool, patterns, BOMBER_1, flow states and Game wiring
   - GREEN `aae8006` (feat): implementation
2. **Task 2: three phases, open core, retreat at 100 seconds, edge rules**
   - RED `96a8264` (test): failing tests
   - GREEN `5c8e3c0` (feat): implementation

**Plan metadata:** the docs commit that adds this SUMMARY, STATE.md, ROADMAP.md and REQUIREMENTS.md.

Tracer feedback gate: `<verify>` is automated-only; `make lint && make test-python` was re-run after Task 1 (green, 100% coverage), so the tracer was verified end-to-end before expanding. The tracer test drives the real laser through the real `Game` from `?at=boss` to CLEAR.

## Files Created/Modified

- `src/scorched_core/entities/enemy_kind.py`, `src/scorched_core/tuning.py` - bomber kinds, table rows, `WARNING_TICKS`, `BOSS_TRIGGER_WINDOW`
- `src/scorched_core/pools/enemy_pool.py` - `BOMBER_TURRET` aims; `detonate_all`
- `src/scorched_core/patterns/pattern_library.py` - six bomber patterns
- `src/scorched_core/bosses/stage_1_bosses.py` - `BOMBER_1`
- `src/scorched_core/bosses/boss_controller.py` - phase jumps keep the deepest hull kind
- `src/scorched_core/stages/stage_1.py` - `boss=BOMBER_1`
- `src/scorched_core/stages/stage_flow.py` - WARNING / BOSS / CLEAR, `boss_destroyed`, `ebullets`, `BOSS_SLOT`
- `src/scorched_core/game/game.py` - `ebullets` passed to the flow, WARNING header slots
- tests mirror each module under `tests/scorched_core/`

## Decisions Made

See `key-decisions` above. The ones later plans must know: `StageFlow.boss_destroyed` is the tally's boss line input (03-21); CLEAR currently only counts `timer` and holds (03-21 adds `CLEAR_TICKS` and TALLY on top, and CLEAR already yields to GAME_OVER); the WARNING `progress` (FLOW_T) is what 03-20's shadow sweep reads; part indexes in `PART_DESTROYED` are 0/1 wing turrets, 2/3 engines.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A phase jump skipped the core opening**
- **Found during:** Task 2 (GREEN, the 70% to 20% behaviour)
- **Issue:** `_change_phase` applied only the target phase's own `hull_kind`, so a hit that jumped from phase 1 straight to phase 3 left the hull as the closed `BOMBER` in the desperation phase (phase 3 names no kind).
- **Fix:** the hull takes the deepest `hull_kind` named by any phase up to the target; behaviour for a normal step-by-step change is unchanged.
- **Files modified:** src/scorched_core/bosses/boss_controller.py
- **Verification:** `test_one_hit_from_seventy_to_twenty_percent_jumps_to_phase_three_with_one_event`; the 03-14 swap tests still pass.
- **Committed in:** 5c8e3c0

**2. [Rule 2 - Missing critical] CLEAR yields to game over**
- **Found during:** Task 1 (designing CLEAR)
- **Issue:** the plan names game-over precedence only for WARNING and BOSS. A ship already dying with no lives when the bomber falls would reach OUT inside CLEAR and leave the run in a stage clear with a dead ship.
- **Fix:** an OUT ship in CLEAR enters GAME_OVER like every other run state.
- **Files modified:** src/scorched_core/stages/stage_flow.py
- **Verification:** `test_a_ship_lost_during_the_clear_ends_the_run_instead_of_the_stage`
- **Committed in:** aae8006

**3. [Rule 3 - Blocking] Roster-pinning tests outside the behaviour list**
- **Found during:** Task 1
- **Issue:** the manifest roster, the per-kind tuning arrays and the stage-opening roster assertions pinned twelve kinds.
- **Fix:** updated those assertions in `test_game.py`, `test_stage_1.py` and `test_enemy_kind.py` (all in the plan's file list).
- **Committed in:** 6b0e66a

**4. [Rule 2 - Missing critical] Flow needs the enemy bullet pool**
- **Found during:** Task 1
- **Issue:** the plan makes CLEAR clear the enemy bullets, but `StageFlow` held no bullet pool.
- **Fix:** a defaulted `ebullets` field that `Game` passes its own pool into, plus `EnemyPool.detonate_all` for the unpaid explosions (both inside the planned files).
- **Committed in:** aae8006

---

**Total deviations:** 4 auto-fixed (1 bug, 2 missing critical, 1 blocking)
**Impact on plan:** all necessary for correctness of the stated behaviours; no scope creep, no files outside the plan list.

## Issues Encountered

- **Engine pods are only partly reachable by plain bolts (concern for the vertical-slice gate).** The plan fixes the engines at (+-26, -2) with radius 12 inside a radius-28 hull, so each engine centre is inside the hull circle (26.08 < 28) and the engine and the wing turret circles overlap by half a unit. Bolts and missiles stop at the first row they touch and the hull spawns first, so a straight bolt reaches an engine only in a gap about 4 units wide between the hull and the wing turret. The wing turrets are fully clear of the hull (gap 36.4 against 30). Nothing is unhittable: measured with the real game and a bolt-tracking ship, a Lv1 vulcan shoots the wing turret off and takes 77 to 158 of an engine's 220 hp in 20 seconds (the sway sweeps the gap across), Lv3/Lv5 vulcan and Lv3 homing also damage or destroy engines, and the laser and bomb pierce. A test pins this (`test_a_level_one_vulcan_reaches_a_wing_turret_and_an_engine_pod`). With a non-piercing weapon the player may skip the engines and still win (hull to 60% opens phase 2), at the cost of the 6000-point engine bonuses. If it plays unfairly, options for 03-28: a smaller `hull_radius`, engines moved outward, or smaller turret radii; plan 03-20's model assumes the +-26 / +-46 positions, so any change must be coordinated with it.
- **Unexpected greens in Task 2.** Two game-level tests (the unshot-bomber timeout and the parts-only payout) passed on their first run: the 6000-step timeout and 0 kill points are Task 1 data and the retreat, countdown and phase rules come from 03-14's controller. The phase, pattern and manifest tests did fail first (12 failures: KeyError on missing patterns, wrong phase lists, `phase_fracs`), which is the planned RED.
- The pre-commit HEAD assertion would normally refuse commits on `main`; the orchestrator pinned sequential mode on main and `git.allow_default_branch_commits` is true, as in the earlier plans.
- The bomber has no JS model, WARNING banner or shadow sweep yet: the new kinds render as tinted primitives (`BASE_COLORS[kindName] ?? FALLBACK_COLOR`) until plan 03-20. The e2e suite was not run for this Python-only plan.

## Known Stubs

None. `kill_points` 0 is intentional (D-18: the stage tally pays the boss bonus; plan 03-21 adds it). The CLEAR state is a deliberate hold that plan 03-21 extends with the tally.

## Threat Flags

None. T-03-24 (the flow always reaches CLEAR) is mitigated by the step-counted 6000-step timeout and the fixed 150-step death (`test_an_unshot_bomber_counts_down_its_last_twenty_seconds_then_retreats_unpaid`), and game over overrides every boss state (`test_game_over_during_the_warning_wins_and_no_bomber_ever_comes`, `test_game_over_during_the_boss_fight_is_never_replaced_by_clear`). T-03-SC: no new packages, lockfiles unchanged.

## TDD Gate Compliance

Both tasks have a `test(03-19)` commit before their `feat(03-19)` commit (6b0e66a then aae8006, 96a8264 then 5c8e3c0); no refactor commits were needed. The plan type is `execute` (task-level `tdd="true"`), so the RED runs were not passed through `gsd check tdd-red-evidence`. Semantic assessment of the RED evidence: Task 1's tests failed at collection with `ImportError: cannot import name 'BOMBER_1'` and `AttributeError` on the missing `EnemyKind.BOMBER_TURRET`, the intended failure for a tracer that introduces that API, not a syntax or fixture fault. Task 2's tests ran (no collection error) and failed on the planned assertions: `KeyError: 'bomber_core_ring'`, a phase list of length 1 against three, `phase_fracs` `[]` against `[0.6, 0.25]` and the phase-2 and phase-3 controller expectations.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 03-20: `?at=boss` shows FLOW WARNING (FLOW_T 0 to 1), then BOSS with BOSS_ACTIVE 2 and the five bomber kinds in the manifest, then CLEAR; models, the WARNING banner, the shadow sweep and the death chain can be drawn against it.
- Ready for 03-21: `flow.boss_destroyed` and the CLEAR state are in place for the tally; CLEAR needs `CLEAR_TICKS`, TALLY and the restart loop added on top.
- For 03-28: tune HP split, sway periods and pattern density with `?at=boss`, and decide on the engine-pod reach noted above.

## Self-Check: PASSED

Modified files all exist on disk (the 17 files above); commits 6b0e66a, aae8006, 96a8264 and 5c8e3c0 are ancestors of HEAD; `make lint && make test-python` (1955 passed, 100% line and branch coverage) and `make test-web` (1419 passed) pass; the acceptance greps (`BOMBER_OPEN = 16`, `BOMBER_1: Final`, `WARNING_TICKS: Final = 180`, `bomber_core_ring`, `bomber_desperation_ring`, `EnemyKind.BOMBER_OPEN`) match and both `-k` pytest selections pass.

---
*Phase: 03-stage-1-vertical-slice*
*Completed: 2026-10-18*
