---
phase: 03-stage-1-vertical-slice
plan: 17
subsystem: bosses
tags: [mid-boss, armored-train, stage-flow, boss-header, score, hitstop, python-core, tdd]

requires:
  - phase: 03-stage-1-vertical-slice
    provides: BossController, BossSpec, PartSpec, PhaseSpec, EmitterSpec and the train patterns (03-14); the MIDBOSS flow state value, TerrainScroll.set_target and the maglev feature across the marker (03-08, 03-12); the boss header slots, boss events and MIDBOSS_CRAWL_SPEED (03-02)
provides:
  - MIDBOSS_1 BossSpec data (bosses/stage_1_bosses.py) run by the same controller the bomber will use
  - StageData.midboss and StageData.boss, each validated against its marker
  - StageFlow MIDBOSS state that owns the BossController (flow.boss, slot 1), crawls and restores the terrain, and drops the fight on game over and reset
  - Game wiring - boss step after the director, boss settle before remove_dead with its points through score.award, header BOSS_ACTIVE / BOSS_PHASE / BOSS_HP / BOSS_TIMER_S, manifest stage.bosses
affects: [03-18 train models and boss bar, 03-19 giant bomber (adds BOMBER_1 and the WARNING/BOSS/CLEAR states), 03-20 boss e2e, HUD boss timer]

actuals:
  tokens: 10866
  tasks: 2
  commits: 3
plan_head_before: 6f34feb32fce9ab7a82a4e699fa691748e5dad06
plan_head_after: 09cadcd9fe3ac7f80f948c886c61b01bfd9abbce

tech-stack:
  added: []
  patterns:
    - "Boss fights as repository data modules (bosses/stage_1_bosses.py), validated at import; a stage names its fights in StageData and the flow starts them at the markers"
    - "StageFlow owns the running controller; Game only steps and settles whatever flow.boss is, so the bomber reuses the wiring unchanged"
    - "A trigger window past a marker (MIDBOSS_TRIGGER_WINDOW) plus a once-per-run flag, so a debug jump past the marker never starts a skipped fight"

key-files:
  created:
    - src/scorched_core/bosses/stage_1_bosses.py
    - tests/scorched_core/bosses/test_stage_1_bosses.py
  modified:
    - src/scorched_core/stages/stage_data.py
    - src/scorched_core/stages/stage_1.py
    - src/scorched_core/stages/stage_flow.py
    - src/scorched_core/game/game.py
    - src/scorched_core/tuning.py
    - tests/scorched_core/stages/test_stage_data.py
    - tests/scorched_core/stages/test_stage_1.py
    - tests/scorched_core/stages/test_stage_flow.py
    - tests/scorched_core/game/test_game.py

key-decisions:
  - "The mid-boss starts once when the scroll is within MIDBOSS_TRIGGER_WINDOW (80 units) past its marker; a run jumped past it (?at=boss) never starts the skipped fight, and a once-per-run flag stops a quick kill from re-triggering it inside the window"
  - "StageFlow gains terrain, enemies and stage fields with defaults (a fresh TerrainScroll and EnemyPool, stage None), so flows built without a stage keep working; Game passes its own"
  - "Game over drops the controller (no stale controller survives, T-03-22); the frozen shielded train rows stay in the pool until restart clears it"
  - "settle() points are awarded at the spec's x and hold_y (the EXTEND popup position) instead of adding public x/y properties to BossController"
  - "Header BOSS_ACTIVE carries the boss slot (1 for the mid-boss) and reads 0 / 0 / 0 / -1 when no boss is up; manifest stage.bosses is built generically for the midboss (slot 1) and boss (slot 2) data so plan 03-19 only has to set StageData.boss"
  - "MIDBOSS_1 keeps the plan's turret offsets (dx 0, dy -22 and +22), so the aft turret is shadowed from bolts and missiles by the hull circle; see Issues Encountered"
  - "Terrain target is set to MIDBOSS_CRAWL_SPEED only once the train spawned (a refused spawn retries on the next step, the scroll never slows for a fight that did not start)"

patterns-established:
  - "The Game never branches on boss kind: _step_boss and _settle_boss act on flow.boss whatever slot it is"

requirements-completed: [ENMY-06, ENMY-07, ENMY-09, SCOR-01]

coverage:
  - id: D1
    description: "Reaching the midboss marker brings the armored train in on the centre column: FLOW MIDBOSS, BOSS_ACTIVE 1, the terrain crawling at MIDBOSS_CRAWL_SPEED, spawning continues"
    requirement: ENMY-06
    verification:
      - kind: unit
        ref: "tests/scorched_core/stages/test_stage_flow.py#test_reaching_the_midboss_marker_brings_in_the_train_and_slows_the_terrain"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_the_train_comes_in_while_the_terrain_crawls_beneath_it"
        status: pass
    human_judgment: false
  - id: D2
    description: "The train is taken apart turret by turret: two PART_DESTROYED events paying 5000 each with part hitstop, the hull kill paying 20000 with boss hitstop, then BOSS_ACTIVE 0, FLOW PLAY and the scroll back at full speed"
    requirement: SCOR-01
    verification:
      - kind: integration
        ref: "tests/scorched_core/game/test_game.py#test_the_midboss_arrives_is_taken_apart_and_play_resumes"
        status: pass
    human_judgment: false
  - id: D3
    description: "The mid-boss is data (MIDBOSS_1: 500 hp hull, two 120 hp turrets, phase 2 at half hull, 45 s timeout, 20000 kill points) validated against its marker in StageData"
    requirement: ENMY-07
    verification:
      - kind: unit
        ref: "tests/scorched_core/bosses/test_stage_1_bosses.py"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/stages/test_stage_data.py#test_a_midboss_spec_without_a_midboss_marker_is_rejected"
        status: pass
    human_judgment: false
  - id: D4
    description: "Header BOSS_ACTIVE / BOSS_PHASE / BOSS_HP / BOSS_TIMER_S follow the controller and read quiet otherwise; the manifest lists the boss bar thresholds in stage.bosses"
    requirement: ENMY-06
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_the_boss_header_slots_follow_the_hull_while_the_midboss_is_up"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_the_manifest_lists_the_boss_bar_thresholds_of_every_boss_the_stage_has"
        status: pass
    human_judgment: false
  - id: D5
    description: "An unshot mid-boss shows its countdown only in the last 20 s, retreats upward once at 2700 fight steps and pays nothing; pause and hitstop freeze the timer"
    requirement: ENMY-09
    verification:
      - kind: integration
        ref: "tests/scorched_core/game/test_game.py#test_an_unshot_midboss_counts_down_its_last_twenty_seconds_then_retreats_unpaid"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_pause_and_hitstop_freeze_the_fight_timer"
        status: pass
    human_judgment: false
  - id: D6
    description: "Both turrets gone gives one BOSS_PHASE event (a = 2) and the hull fires its spread; a player death keeps the fight running, game over and restart drop it, and it triggers again after a restart"
    requirement: ENMY-06
    verification:
      - kind: integration
        ref: "tests/scorched_core/game/test_game.py#test_both_turrets_gone_pushes_one_phase_two_event_and_the_hull_opens_fire"
        status: pass
      - kind: integration
        ref: "tests/scorched_core/game/test_game.py#test_game_over_during_the_midboss_ends_the_run_and_the_fight_stays_over"
        status: pass
      - kind: integration
        ref: "tests/scorched_core/game/test_game.py#test_a_restart_during_the_midboss_clears_the_fight_and_it_triggers_again"
        status: pass
    human_judgment: false
  - id: D7
    description: "How the fight feels: the pacing of the train's entrance, the bullet density of its patterns and the 45 s timeout are discretion values to tune at the vertical-slice gate"
    verification: []
    human_judgment: true
    rationale: "Feel and pacing cannot be asserted by automated tests; the train has no model or boss bar until plan 03-18"

duration: 6min
completed: 2026-10-18
status: complete
---

# Phase 3 Plan 17: Armored-Train Mid-Boss in Stage 1 Summary

**The stage-1 mid-boss as data: an armored train (500 hp hull, two 120 hp turrets worth 5000 each, 45 s timeout, 20000 kill points) that StageFlow starts at the midboss marker, crawls the terrain under, and that Game steps, settles into the score and publishes in the boss header and manifest.**

## Performance

- **Duration:** about 6 min
- **Started:** 2026-10-18T19:00:41Z
- **Completed:** 2026-10-18T19:06:00Z
- **Tasks:** 2 (a tracer and an auto task, both TDD)
- **Files modified:** 11 (1 new source module, 1 new test module, 9 changed)

## Accomplishments

- `MIDBOSS_1` in `bosses/stage_1_bosses.py` is the same `BossSpec` the controller runs for any boss: TRAIN hull on the maglev column (x 120) entering from y -60 to hold at 96, TRAIN_TURRET parts at dy -22 and +22 (120 hp, 5000 points, stump TRAIN_STUMP), phase 1 aiming both turrets and swaying along y, phase 2 at half hull health (or both turrets gone) with the hull firing `train_hull_spread`, a 2700-step timeout and 20000 kill points.
- `StageData` gains `midboss` and `boss`, each rejected unless the stage also has the marker that starts it; `STAGE_1.midboss` is `MIDBOSS_1`.
- `StageFlow` starts the fight once per run as the scroll crosses the midboss marker (state MIDBOSS, terrain target `MIDBOSS_CRAWL_SPEED`), owns the controller as `flow.boss` (slot 1), and returns to PLAY with the target back at `SCROLL_SPEED` when it is gone. Game over wins over every boss transition and drops the controller; `reset()` clears it and re-arms the trigger.
- `Game` steps the boss after the director and before the enemies move, settles it after the damage passes and before `remove_dead`, and pays the returned points through `score.award` (SCOR-01). Hitstop for parts and the hull comes from the controller. The header carries BOSS_ACTIVE (the slot), BOSS_PHASE, BOSS_HP (hull fraction) and BOSS_TIMER_S (-1 until 20 s remain), and the manifest lists `stage.bosses` as `[{"slot": 1, "name": "midboss", "phase_fracs": [0.5]}]` for stage 1.
- `make lint && make test-python`: 1888 passed, 100% line and branch coverage. `make test-web`: 1319 vitest tests pass (the manifest gained a key; nothing on the JS side broke).

## Task Commits

1. **Task 1 (tracer): reaching the midboss marker brings in the train; shooting off both turrets and the hull ends the fight and play resumes**
   - RED `af23f47` (test): failing tests for the spec data, StageData fields, StageFlow MIDBOSS and the Game wiring
   - GREEN `2821a65` (feat): implementation
2. **Task 2: timeout retreat, last-20-seconds countdown, phase 2 when the turrets are gone, run endings**
   - `09cadcd` (test): tests only; no production change was needed (see TDD Gate Compliance)

**Plan metadata:** the docs commit that adds this SUMMARY, STATE.md and ROADMAP.md.

Tracer feedback gate: `<verify>` is automated-only and was re-run after Task 1 (`make lint && make test-python`, green), so the tracer was verified end-to-end before expanding. The tracer test drives the real laser through the real `Game` from `?at=midboss` to the return to PLAY.

## Files Created/Modified

- `src/scorched_core/bosses/stage_1_bosses.py` - `MIDBOSS_1` data
- `src/scorched_core/stages/stage_data.py` - `midboss` / `boss` fields and marker validation
- `src/scorched_core/stages/stage_1.py` - `midboss=MIDBOSS_1`
- `src/scorched_core/stages/stage_flow.py` - MIDBOSS state, owned controller, trigger window, crawl targets, game-over precedence, reset
- `src/scorched_core/game/game.py` - `_step_boss`, `_settle_boss`, `_pack_boss_header`, `_boss_manifest`, StageFlow wired to terrain / enemies / stage (terrain is now created before the flow)
- `src/scorched_core/tuning.py` - `MIDBOSS_TRIGGER_WINDOW`
- tests mirror each module under `tests/scorched_core/` (`bosses/test_stage_1_bosses.py` is new)

## Decisions Made

See `key-decisions` above. The two later plans must know: `StageFlow.boss` is the single place a running fight lives (plan 03-19 sets `StageData.boss`, adds its states and reuses `_step_boss` / `_settle_boss` / the header / `stage.bosses` unchanged), and the trigger window means any marker-started fight should use the same window-plus-flag pattern so debug jumps stay honest.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] A trigger window so a marker jump never starts a skipped fight**
- **Found during:** Task 1 (designing the StageFlow trigger)
- **Issue:** "Start when the distance reaches the marker" would start the mid-boss at the first PLAY step of a run jumped past it with `?at=boss` (plan 03-19's debug start), and would restart it after a fast kill while the scroll was still near the marker.
- **Fix:** Start only when the scroll is within `MIDBOSS_TRIGGER_WINDOW` (80 units, new in tuning.py) past the marker, with a once-per-run flag cleared by `reset()`.
- **Files modified:** src/scorched_core/tuning.py, src/scorched_core/stages/stage_flow.py
- **Verification:** `test_a_marker_the_run_already_jumped_past_does_not_start_the_midboss`, `test_a_gone_midboss_returns_to_play_at_full_scroll_speed_and_never_starts_twice`
- **Committed in:** 2821a65

**2. [Rule 2 - Missing critical] A refused spawn retries instead of being lost**
- **Found during:** Task 1
- **Issue:** `BossController.start` refuses (returns False) when the pool has no room for the whole boss; ignoring that would enter MIDBOSS with no train and a crawling scroll.
- **Fix:** The flow changes state, sets the scroll target and marks the fight started only after `start` succeeds; otherwise it stays in PLAY and retries on the next step.
- **Files modified:** src/scorched_core/stages/stage_flow.py
- **Verification:** `test_a_full_enemy_pool_delays_the_midboss_until_it_has_room`
- **Committed in:** 2821a65

---

**Total deviations:** 2 auto-fixed (2 missing critical)
**Impact on plan:** Both are correctness requirements of the stated behaviour (a fight that starts once, at its marker, with its whole train). No scope creep. Files stayed within the plan list plus `tuning.py` for the one constant.

## Issues Encountered

- **The aft turret is out of reach of bolts and missiles.** The plan fixes the turrets at dx 0, dy -22 and +22 inside a radius-28 hull, and 03-14's note warned about the hull shadowing parts. A real Lv1 vulcan run confirmed the split: after 300 steps of fire at x 120 the fore turret was at 46/120, the aft turret untouched (120/120). Bolts and missiles are consumed by the first row they touch, and the hull is between them and the aft turret; the laser and the bomb pierce, so they reach both (the tracer test uses the laser). Moving the turrets sideways would fix the vulcan but would take them out of the laser column at x 120, which plan 03-18's e2e relies on, so the plan's numbers were kept and the limit is documented in the data module. Consequences: with vulcan or homing the player can still win (hull to half triggers phase 2, the hull kill pays 20000) but cannot earn the aft turret's 5000. Worth a decision at the vertical-slice gate (for example a sideways offset with a wider laser reach, or a shorter hull radius).
- **The 45 s timeout can outlast the lull.** The 420-unit lull after the marker is 2100 steps at the 0.2 crawl, shorter than a full 2700-step timeout, so a fight nobody finishes sees the next waves arrive around 35 s in. A normal kill ends far sooner and nothing is crowded; if it matters at the gate, hold `flow.spawning` false during MIDBOSS or lengthen the lull.
- After game over the controller is dropped but the shielded, frozen train rows stay in the pool until restart clears it; harmless behind the game-over screen.
- The pre-commit HEAD assertion would normally refuse commits on `main`; the orchestrator pinned sequential mode on main and `git.allow_default_branch_commits` is true, as in the earlier plans.

## Known Stubs

None. The train kinds still have no JS model and the header slots have no consumer yet by design: plan 03-18 draws the train, its stumps and the boss bar.

## Threat Flags

None. T-03-22 (a mid-boss can never stall the stage) is mitigated by the step-counted 2700-step timeout (`test_an_unshot_midboss_counts_down_its_last_twenty_seconds_then_retreats_unpaid`) and by game over overriding every boss transition and dropping the controller (`test_game_over_during_the_midboss_wins_over_every_boss_transition`). T-03-SC: no new packages.

## TDD Gate Compliance

Task 1 has a `test(03-17)` commit (`af23f47`) before its `feat(03-17)` commit (`2821a65`); no refactor commits were needed. The plan type is `execute` (task-level `tdd="true"`), so the RED run was not passed through `gsd check tdd-red-evidence`. Semantic assessment of the RED evidence: the new tests failed at collection with `ModuleNotFoundError: scorched_core.bosses.stage_1_bosses`, the intended failure for a tracer that introduces that module, not a syntax or fixture fault.

Task 2 has a `test(03-17)` commit (`09cadcd`) and no `feat` commit. Its tests passed on first run: the behaviours it pins (game over precedence, `reset()` dropping the controller, the controller's own timeout and phase rules from 03-14) were already produced by Task 1's implementation, because Task 1's 100% coverage gate needed the flow's game-over and reset paths. This is the "unexpected green" case from the TDD reference, investigated rather than ignored: mutation checks confirmed the tests are not vacuous (removing `self.boss = None` from `_game_over` failed the game-over tests in both modules, removing the `_midboss_done` reset failed the restart tests in both modules; source restored). The plan itself anticipated this ("game.py: nothing new unless a behaviour fails").

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 03-18: the header slots (BOSS_ACTIVE slot, BOSS_PHASE, BOSS_HP, BOSS_TIMER_S) are live and the manifest lists `stage.bosses`, so the boss bar, train models, part popups and stump smoulder can render against `?at=midboss`. PART_DESTROYED events carry `(points, part index, slot)`.
- Ready for 03-19: set `StageData.boss`, add the WARNING / BOSS / CLEAR states on top of `flow.boss`; `_boss_manifest` already emits slot 2 when `StageData.boss` is set.
- Requirements ENMY-06, ENMY-07, ENMY-09 and SCOR-01 are declared by later plans of this phase too, so the shared-ID gate (`requirements.ready-ids`) held all four as pending; they are marked complete when the last declaring plan finishes.

## Self-Check: PASSED

All created files exist on disk (`src/scorched_core/bosses/stage_1_bosses.py`, `tests/scorched_core/bosses/test_stage_1_bosses.py`); commits af23f47, 2821a65 and 09cadcd are ancestors of HEAD; `make lint && make test-python` (1888 passed, 100% coverage) and `make test-web` (1319 passed) pass; the acceptance greps (`MIDBOSS_1: Final`, `midboss=MIDBOSS_1`, `H_BOSS_HP`) match and both `-k` pytest selections pass.

---
*Phase: 03-stage-1-vertical-slice*
*Completed: 2026-10-18*
