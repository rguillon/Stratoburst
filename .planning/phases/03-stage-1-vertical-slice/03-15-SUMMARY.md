---
phase: 03-stage-1-vertical-slice
plan: 15
subsystem: stages
tags: [city-targets, ground-entries, stage-director, enemy-kinds, scoring, medals, python]

requires:
  - phase: 03-stage-1-vertical-slice
    provides: "CityBlock lot grid and scenery_placements (03-12), StageDirector and EnemyPool.spawn(drop=) (03-11), MEDAL drops via Game._drop_pickups (03-11), train kinds 5-7 (03-14)"
provides:
  - "EnemyKind HOUSE 8, FUEL_TANK 9, DEPOT 10, BILLBOARD 11 with radius, HP, blast, ground, pattern and points rows"
  - "ENEMY_WRECK per-kind table, published as manifest tuning enemy_wreck"
  - "GroundEntry (frozen): at, kind, x, drop"
  - "CityBlock.targets and target_entries(blocks); flagged lots are left out of scenery_placements"
  - "StageData.ground with sorted/in-range validation"
  - "StageDirector ground cursor spawning terrain-anchored GROUND rows aligned with their blocks"
  - "Stage 1 targets in every section (44 rows, 30 carrying a medal)"
affects: [03-16, 03-27, ground-layer rendering, wreck ring, scorch decals]

actuals:
  tokens: 16000
  tasks: 2
  commits: 4
plan_head_before: 73fb62465b639c2087a8a2267f0d052f8a6bc5a2
plan_head_after: 8d66e05c4ac4b0780af9b4921b0686394e1e8d1a

tech-stack:
  added: []
  patterns:
    - "Flagged scenery lots become enemy rows: the block data is the single source for both the drawn building and the target"
    - "A second cursor over a distance-keyed tuple, spawning at the y the scenery of that distance occupies"
    - "Per-kind wreck behaviour as a manifest-published table, so the renderer never hardcodes kinds"

key-files:
  created:
    - src/scorched_core/stages/ground_entry.py
    - tests/scorched_core/stages/test_ground_entry.py
  modified:
    - src/scorched_core/entities/enemy_kind.py
    - src/scorched_core/tuning.py
    - src/scorched_core/stages/city_block.py
    - src/scorched_core/stages/city_builder.py
    - src/scorched_core/stages/stage_data.py
    - src/scorched_core/stages/stage_director.py
    - src/scorched_core/stages/stage_1.py
    - src/scorched_core/game/game.py
    - tests/scorched_core/entities/test_enemy_kind.py
    - tests/scorched_core/stages/test_city_block.py
    - tests/scorched_core/stages/test_city_builder.py
    - tests/scorched_core/stages/test_stage_data.py
    - tests/scorched_core/stages/test_stage_director.py
    - tests/scorched_core/stages/test_stage_1.py
    - tests/scorched_core/game/test_game.py

key-decisions:
  - "Target lots are excluded from the fire sample too (fires burn only free lots), so a block's fires count is never silently lost to a target"
  - "StageDirector.jump rewinds the ground cursor to the first entry still on screen at the jump distance (bisect_left with the visible span) instead of skipping every entry at or before it, so a ?at= start does not show holes where targets belong"
  - "Stage 1 flags the middle lot of every Nth block (7 slums, 6 downtown, 6 airbase), skipping blocks crossed by a maglev or runway corridor and blocks in the BOSS_QUIET window; kinds cycle per section and drops cycle MEDAL, MEDAL, none"
  - "GroundEntry only requires a ground kind (ENEMY_GROUND); the four-target-kind restriction lives in CityBlock.TARGET_KINDS"

patterns-established:
  - "Pattern: authored city data stays in CityBlock rows; stage_1.py derives the ground timeline with target_entries(_CITY) rather than listing coordinates twice"
  - "Pattern: tests that read the first live enemy of STAGE_1 filter out target rows (_wave_rows)"

requirements-completed: [STGE-03, SCOR-01, SCOR-02]

coverage:
  - id: D1
    description: "Selected buildings are destructible: flagged lots become GROUND enemy rows and leave the static scenery"
    requirement: STGE-03
    verification:
      - kind: unit
        ref: "tests/scorched_core/stages/test_city_builder.py#test_a_target_lot_is_left_out_of_the_scenery"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/stages/test_city_builder.py#test_a_flagged_lot_becomes_one_ground_entry_at_the_lot_centre"
        status: pass
    human_judgment: false
  - id: D2
    description: "A target row spawns exactly where its lot is drawn (GROUND_Y0 + GROUND_SCROLL_RATIO * (distance - at)), glued to its block while the terrain scrolls"
    requirement: STGE-03
    verification:
      - kind: unit
        ref: "tests/scorched_core/stages/test_stage_director.py#test_a_ground_entry_spawns_aligned_with_its_scenery_row"
        status: pass
      - kind: integration
        ref: "tests/scorched_core/game/test_game.py#test_a_house_stays_glued_to_its_block_while_the_terrain_scrolls"
        status: pass
    human_judgment: false
  - id: D3
    description: "A destroyed target pays its ENEMY_POINTS (house 500), drops a medal and explodes as a ground kill of its kind"
    requirement: SCOR-01
    verification:
      - kind: integration
        ref: "tests/scorched_core/game/test_game.py#test_destroying_a_house_pays_500_leaves_a_medal_and_explodes_as_a_ground_kill"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/entities/test_enemy_kind.py#test_the_four_target_kinds_are_tougher_than_a_tank_and_pay_by_their_size"
        status: pass
    human_judgment: false
  - id: D4
    description: "Stage 1 has targets in every section (houses/fuel tanks slums, billboards/depots downtown, fuel tanks/depots airbase), an early x 40 target, at least half dropping medals, within the ground-row budget"
    requirement: SCOR-02
    verification:
      - kind: unit
        ref: "tests/scorched_core/stages/test_stage_1.py#test_at_least_half_of_the_targets_drop_a_medal"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/stages/test_stage_1.py#test_every_target_spawns_and_an_undamaged_one_scrolls_off_and_is_gone"
        status: pass
    human_judgment: false
  - id: D5
    description: "ENEMY_WRECK is published as manifest tuning enemy_wreck (tanks, turrets, train hull and the four targets leave a wreck)"
    requirement: STGE-03
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_the_manifest_lists_which_kinds_leave_a_wreck"
        status: pass
    human_judgment: false
  - id: D6
    description: "Targets read as buildings worth shooting in the browser (drawn, wrecked, scorched); this plan is the Python side only"
    verification: []
    human_judgment: true
    rationale: "Rendering and destruction visuals land in plan 03-16; nothing here is drawable yet, so only the data and simulation are automated"

duration: 7min
completed: 2026-10-18
status: complete
---

# Phase 3 Plan 15: Destructible City Targets Summary

**Flagged city lots become terrain-anchored GROUND enemy rows (houses, fuel tanks, depots, billboards) that spawn exactly on their blocks, pay 500-2000 points and drop medals, with 44 targets authored across stage 1's three sections.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-10-18T18:32:53Z
- **Completed:** 2026-10-18T18:39:27Z
- **Tasks:** 2
- **Files modified:** 17 (9 source, 8 test)

## Accomplishments

- Four new enemy kinds (HOUSE 8, FUEL_TANK 9, DEPOT 10, BILLBOARD 11) with full table rows (radius 12/11/14/12 inside the grid rule, HP 8/6/16/10, points 500/1500/2000/1000, no pattern) and `ENEMY_WRECK`, published to the renderer as manifest `tuning.enemy_wreck`.
- `GroundEntry`, `CityBlock.targets` (validated lot, uniqueness and kind) and `target_entries(blocks)`: one entry per flagged lot at the lot centre and lot distance, sorted; `scenery_placements` no longer builds those lots (fires and signs also avoid them).
- `StageData.ground` (sorted, inside the stage) and a second `StageDirector` cursor that spawns `GROUND` rows with zero velocity at `GROUND_Y0 + GROUND_SCROLL_RATIO * (distance - at)`, carrying their drop.
- Through the real `Game`: a laser kills a flagged house, SCORE rises by 500, a medal appears at the kill position and the EXPLOSION event carries ground flag 1 and kind HOUSE.
- Stage 1: 44 targets (slums 13 houses/fuel tanks, downtown 20 billboards/depots, airbase 10 fuel tanks/depots, plus one downtown-block billboard past 6500), 30 carrying a medal, an early x 40 house at distance 56 and another at 1176, at most 4 ground rows per screen against a limit of 20.

## Task Commits

1. **Task 1: Tracer, a flagged lot becomes a target row on its block** - RED `3d6f2e5` (test), GREEN `4b15e87` (feat)
2. **Task 2: Stage 1's city gets its targets** - RED `eae9f12` (test), GREEN `8d66e05` (feat)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## TDD Notes

- Task 1 RED (`3d6f2e5`): the new tests fail at collection with ImportError/AttributeError for the planned API (`ENEMY_WRECK`, `GroundEntry`, `target_entries`, `CityBlock.targets`, `EnemyKind.HOUSE`). That is a load failure, not an assertion on behaviour, so by the strict `INVALID_RED` definition it is weak RED evidence. This plan is `type: execute`, not `type: tdd`, so the plan-level gate is not enforced; the RED/GREEN commit order is still intact.
- Task 2 RED (`eae9f12`): produced by temporarily restoring the old `stage_1.py`; 7 target tests failed on their planned assertions, then GREEN restored the authored data.
- Task 1 is a `tracer`: its `<verify>` (`make lint && make test-python`) was re-run end to end after GREEN and again after Task 2 before expansion, both green with 100% coverage.

## Files Created/Modified

- `src/scorched_core/stages/ground_entry.py` - frozen `GroundEntry(at, kind, x, drop)`; rejects non-ground kinds
- `src/scorched_core/entities/enemy_kind.py`, `src/scorched_core/tuning.py` - four target kinds, extended per-kind tables, `ENEMY_WRECK`
- `src/scorched_core/stages/city_block.py` - `targets` field, `TARGET_KINDS`, validation
- `src/scorched_core/stages/city_builder.py` - `target_entries`; scenery skips flagged lots; fires sample only free lots
- `src/scorched_core/stages/stage_data.py` - `ground` field and `_check_ground`
- `src/scorched_core/stages/stage_director.py` - ground cursor, aligned spawn, jump and reset for both cursors
- `src/scorched_core/stages/stage_1.py` - `_section` flags targets; `ground=target_entries(_CITY)`; features defined before the city
- `src/scorched_core/game/game.py` - manifest tuning `enemy_wreck`
- Tests mirror each source file; `test_game.py` also gains the house end-to-end tests

## Decisions Made

See `key-decisions` in the frontmatter. In short: fires never land on target lots; a debug jump keeps the targets that are still on screen; stage 1 targets are procedural-by-rule data (every Nth block's middle lot) rather than a hand-listed coordinate table, so the lot layout stays defined once in `CityBlock`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Existing tests broke on the enlarged roster and the new stage rows**
- **Found during:** Task 1 and Task 2 (full `make test-python`)
- **Issue:** `test_manifest_contract` (enemy_kinds map), `test_the_opening_uses_every_gallery_kind`, `test_the_whole_timeline_never_fills_the_enemy_pool`, and three STAGE_1 game tests (first spawned entry, first spread wave, restart at marker) assumed enemy slot 0 was always a wave and the roster ended at TRAIN_STUMP.
- **Fix:** Updated expectations to include the four target kinds; the three game tests now look at wave rows only (`_wave_rows` filters out target kinds); the pool-budget test counts waves plus ground rows.
- **Files modified:** tests/scorched_core/game/test_game.py, tests/scorched_core/stages/test_stage_1.py
- **Committed in:** 4b15e87, eae9f12

**2. [Rule 1 - Bug] A flagged lot near the stage end was past the stage length**
- **Found during:** Task 2 (first import of STAGE_1)
- **Issue:** The last airbase block row's lot fell at 9336, outside the 9300 stage, so `StageData` rejected the ground rows.
- **Fix:** Blocks at or past the BOSS_QUIET window are not flagged. This also keeps the boss room free of ground rows, consistent with the existing "nothing spawns this close before the boss" rule.
- **Files modified:** src/scorched_core/stages/stage_1.py
- **Committed in:** 8d66e05

**3. [Rule 2 - Missing critical] Debug jump would leave holes where targets belong**
- **Found during:** Task 1 (designing `jump`)
- **Issue:** Plan says `jump` and `reset` "handle both cursors"; skipping every ground entry at or before the jump distance (as for waves) would leave target lots empty on the first screen of a `?at=` start, because target lots are not drawn as scenery.
- **Fix:** `jump` sets the ground cursor with `bisect_left(ground_ats, distance - (PLAYFIELD_H - GROUND_Y0) / GROUND_SCROLL_RATIO)`, keeping entries that are still on screen; they spawn on the next step at their aligned y. Covered by two director tests.
- **Files modified:** src/scorched_core/stages/stage_director.py
- **Committed in:** 4b15e87

---

**Total deviations:** 3 auto-fixed (2 Rule 1, 1 Rule 2)
**Impact on plan:** All necessary for correctness; no scope creep, no new packages.

## Issues Encountered

- **One-step offset (noted for 03-16):** `Game._step` runs `director.step` and then `enemies.step` in the same tick, so a target is already scrolled one ground step (about 0.75 units) past the spawn formula when it is first seen. It stays constant afterwards (both scroll with the same speed ratio) and is well inside the documented 2% ground-layer tolerance; the game test asserts alignment within 1 unit and a constant offset over 60 steps.
- The Edge Probe assumption (bombs damage targets like any ground unit; an unshot target that scrolls off is simply gone) holds with the current simulation: the bomb damages every enemy row in its radius and the whole-stage test confirms an undamaged target leaves silently with no kill or penalty.

## Known Stubs

None. No placeholder values or TODO markers were introduced.

## Threat Flags

None. No new network, auth or file surface; target data is repository code validated at import. Threat T-03-20 is mitigated by `test_ground_rows_per_screen_budget_never_exceeds_twenty` and the whole-stage run (peak 4 live target rows).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03-16 can draw the four target models in the ground layer (they currently fall back to the tinted primitive in `enemy_instances.js`), read `tuning.enemy_wreck` for the wreck ring and add scorch marks.
- Plan 03-27 can count refused spawns over a full stage; this plan already shows none for targets.
- Gate: `make lint && make test-python` green (1845 tests, 100% line and branch coverage); `npm test` (1236 vitest) still green.

## Self-Check: PASSED

- Created files exist: `src/scorched_core/stages/ground_entry.py`, `tests/scorched_core/stages/test_ground_entry.py`, this SUMMARY.
- Commits `3d6f2e5`, `4b15e87`, `eae9f12`, `8d66e05` are ancestors of HEAD.
- Acceptance greps match (`BILLBOARD = 11`, `ENEMY_WRECK: Final`, `def target_entries`, `GROUND_Y0` in the director, `EnemyKind.FUEL_TANK` and `target_entries` in stage_1); the two `-k` pytest selections pass.

---
*Phase: 03-stage-1-vertical-slice*
*Completed: 2026-10-18*
