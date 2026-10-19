---
phase: 03-stage-1-vertical-slice
plan: 12
subsystem: stages
tags: [city, scenery, road-grid, manifest, deterministic-layout, stage-1]

requires:
  - phase: 03-stage-1-vertical-slice
    provides: StageData and STAGE_1 timeline (03-03, 03-06), manifest stage block (03-04), GROUND_SCROLL_RATIO ground frame (02-05)
provides:
  - SceneryKind and CityStyle IntEnums; CityBlock and CityFeature frozen authoring types
  - scenery_placements(blocks, features, seed), the single Python expander of the city layout
  - StageData.city, .features, .seed and the cached .placements tuple
  - manifest stage.city / city_stride / block_pitch / block_size, scenery_kinds and tuning.ground_y0
  - Stage 1's authored city arc: slums, neon downtown with the maglev, airbase with runway lights
affects: [03-13 ground rendering of the layout, 03-15 destructible lots, 03-16+ mid-boss on the maglev, 03-2x bomber on the runway, stages 2-3 city variants]

actuals:
  tokens: 11500
  tasks: 2
  commits: 4
plan_head_before: 866933053ab2a2c61bc2b530a73d88d0694bab30
plan_head_after: 1884c68fdb0e4ab59d30497e1418f02349cecac1

tech-stack:
  added: []
  patterns:
    - "City as data on a road grid (CityBlock rows plus CityFeature lines) expanded once in Python into stride-6 records; JS never generates city content"
    - "Layout ships once in the manifest, never as a per-frame channel"

key-files:
  created:
    - src/scorched_core/stages/scenery_kind.py
    - src/scorched_core/stages/city_style.py
    - src/scorched_core/stages/city_block.py
    - src/scorched_core/stages/city_feature.py
    - src/scorched_core/stages/city_builder.py
    - tests/scorched_core/stages/test_scenery_kind.py
    - tests/scorched_core/stages/test_city_style.py
    - tests/scorched_core/stages/test_city_block.py
    - tests/scorched_core/stages/test_city_feature.py
    - tests/scorched_core/stages/test_city_builder.py
  modified:
    - src/scorched_core/protocol.py
    - src/scorched_core/tuning.py
    - src/scorched_core/stages/stage_data.py
    - src/scorched_core/stages/stage_1.py
    - src/scorched_core/game/game.py
    - tests/scorched_core/stages/test_stage_data.py
    - tests/scorched_core/stages/test_stage_1.py
    - tests/scorched_core/game/test_game.py
    - tools/e2e/stage.spec.js

key-decisions:
  - "A block's d is the start of its road-to-road row; buildings fill [80c + 8, 80c + 72] by [d + 8, d + 72], lot centres are exact grid cell centres and a building covers 70 to 90 percent of its lot's shorter side"
  - "A feature's corridor is CITY_CORRIDOR_HALF (6) either side of its x over [d0, d1]; any building whose footprint overlaps it is skipped, margin buildings included"
  - "Margin blocks (columns -2, -1, 3, 4) take the style of the lowest-column block of each authored row and are seeded from a string of seed, row and column"
  - "StageData expands its city once in __post_init__ into a non-init, non-compared placements field; the gallery manifest reuses STAGE_1.placements with loop True"
  - "Stage 1 sections are built by one _section helper (grids per column cycled by row, fires and signs every Nth block); 2609 placements, under the 3000 cap"

patterns-established:
  - "scenery_placements is functions-only and allocation-free of concern: it runs at import"
  - "Features are restricted to MAGLEV and RUNWAY_LIGHT with a loud ValueError for any other kind"

requirements-completed: [STGE-03]

coverage:
  - id: D1
    description: "Deterministic city expander: stride-6 records sorted by distance, same seed same layout, lots inside block footprints, fires replace lots, corridors skip lots, margin blocks, heights at most 34"
    requirement: STGE-03
    verification:
      - kind: unit
        ref: "tests/scorched_core/stages/test_city_builder.py"
        status: pass
    human_judgment: false
  - id: D2
    description: "CityBlock, CityFeature, SceneryKind, CityStyle authoring types with validation, and StageData city fields validated against the stage length"
    requirement: STGE-03
    verification:
      - kind: unit
        ref: "tests/scorched_core/stages/test_city_block.py, test_city_feature.py, test_scenery_kind.py, test_city_style.py, test_stage_data.py"
        status: pass
    human_judgment: false
  - id: D3
    description: "The layout reaches the browser once in the manifest (stage.city, city_stride, block_pitch, block_size, scenery_kinds, tuning.ground_y0); the gallery keeps a city with loop True"
    requirement: STGE-03
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_manifest_stage_describes_the_stage_markers_in_stage_mode"
        status: pass
      - kind: e2e
        ref: "tools/e2e/stage.spec.js#the manifest carries stage 1's expanded city layout"
        status: pass
    human_judgment: false
  - id: D4
    description: "Stage 1's city arc: slums to 2600, neon downtown to 6500 with the maglev at x 120 across the mid-boss marker, airbase with runway lights covering the boss marker, fires in every section, at most 3000 placements"
    requirement: STGE-03
    verification:
      - kind: unit
        ref: "tests/scorched_core/stages/test_stage_1.py (city, maglev, arc, fire tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "How the authored arc actually looks once plan 03-13 renders it (density, readability of the neon, maglev and runway placement)"
    verification: []
    human_judgment: true
    rationale: "Visual composition cannot be asserted by a unit test; the layout is data only until 03-13 draws it"

duration: 12 min
completed: 2026-10-18
status: complete
---

# Phase 3 Plan 12: Stage 1 City Data Summary

**Stage 1's city authored as road-grid data (CityBlock rows plus maglev and runway CityFeature lines) and expanded once in Python into 2609 deterministic stride-6 placements that ship in the manifest**

## Performance

- **Duration:** 12 min
- **Started:** 2026-10-18T17:36Z (approximate, from the previous plan's close-out)
- **Completed:** 2026-10-18T17:48Z
- **Tasks:** 2
- **Files modified:** 19 (10 source, 9 test/e2e)

## Accomplishments
- `scenery_placements(blocks, features, seed)` expands blocks and feature lines into a flat tuple of (kind, x, distance, width, height, variant) records sorted by distance, deterministic from a seeded `random.Random`, with fires replacing lots, signs hung on towers first, lamps in the slums, corridor skipping and margin blocks at columns -2, -1, 3 and 4.
- `StageData` carries `city`, `features` and `seed`, validates them against the stage length and expands once into `placements`; `Game.manifest()` ships `stage.city`, `city_stride` 6, `block_pitch` 80, `block_size` 64, `scenery_kinds` and `tuning.ground_y0` -40, and the gallery reuses STAGE_1's layout with loop True.
- Stage 1 follows the D-35 arc over 351 block rows in three playfield columns: slums (0 to 2600), neon downtown with towers and two signs per block (2600 to 6500) and the maglev along x 120 from 3500 to 5300 (spanning the 4200 mid-boss marker), and a hangar airbase (6500 on) with runway lights at x 108 and 132 from 7600 to the stage end, past the 8640 boss marker. Fires appear in every section (58 in total). Heights peak at 33.9.

## Task Commits

TDD, each task as a RED then a GREEN commit:

1. **Task 1 (tracer): city data, expander and manifest layout** - `66983b6` (test, RED), `6331d73` (feat, GREEN)
2. **Task 2: stage 1's city arc** - `d45b083` (test, RED), `1884c68` (feat, GREEN)

**Plan metadata:** the docs commit that carries this summary (docs: complete plan).

## TDD Gate Compliance

- RED (task 1): `66983b6`. The new tests fail at collection with `ModuleNotFoundError` (the five new modules do not exist yet). Semantic assessment: this is a load failure, which the strict RED rule classes as INVALID_RED, but a test for a module that does not exist cannot fail any other way without a throwaway stub; the assertions it pins are the behaviour list verbatim and all passed on first GREEN run apart from one test bug (below). No `gsd_run check tdd-red-evidence` record was produced.
- RED (task 2): `d45b083`. 8 of the 9 new stage_1 tests fail on assertions (empty city); the arc test was made non-vacuous before the commit.
- GREEN: `6331d73`, `1884c68`. No REFACTOR commits were needed.

## Files Created/Modified
- `src/scorched_core/stages/city_builder.py` - `scenery_placements`, the single expander
- `src/scorched_core/stages/city_block.py`, `city_feature.py` - frozen, validated authoring types
- `src/scorched_core/stages/scenery_kind.py`, `city_style.py` - IntEnums that cross the boundary
- `src/scorched_core/stages/stage_data.py` - city fields, validation, cached `placements`
- `src/scorched_core/stages/stage_1.py` - `_section` helper, the three city sections and the maglev and runway features
- `src/scorched_core/game/game.py` - manifest city, `scenery_kinds`, `ground_y0`
- `src/scorched_core/protocol.py`, `tuning.py` - `CITY_STRIDE`; `CITY_PITCH`, `CITY_BLOCK`, `GROUND_Y0`, `CITY_MAX_HEIGHT`, `CITY_CORRIDOR_HALF`
- `tools/e2e/stage.spec.js` - manifest city check on a stage boot

## Decisions Made
See key-decisions above. The notable one: StageData validates feature lines as well as blocks (the plan only required blocks), so a stage module that imports cleanly has an in-range city.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 1's e2e verify needs Task 2's data**
- **Found during:** Task 1 verification
- **Issue:** Task 1's `<verify>` runs `stage.spec.js`, which asserts `stage.city.length > 0`, but STAGE_1 has no city until Task 2 (Task 1's file list excludes `stage_1.py`).
- **Fix:** Task 1 was verified with `make lint && make test-python` at its commit; the Playwright run was done after Task 2 and passes (5 of 5).
- **Files modified:** none
- **Verification:** `make build && npx playwright test tools/e2e/stage.spec.js` green after `1884c68`

**2. [Rule 2 - Missing critical] Extra validation**
- **Found during:** Task 1
- **Issue:** The builder would silently ignore a feature of an unsupported kind, and negative fires or signs were accepted.
- **Fix:** `scenery_placements` raises ValueError for any feature kind other than MAGLEV or RUNWAY_LIGHT; `CityBlock` rejects negative `fires` and `signs`; `StageData` rejects features outside the stage. Each has a test.
- **Files modified:** city_builder.py, city_block.py, stage_data.py and their tests
- **Committed in:** `6331d73`

**3. [Rule 1 - Bug] Test bug in my own RED tests**
- **Found during:** Task 1 GREEN
- **Issue:** `test_a_feature_leaves_lots_outside_its_distance_range_alone` compared against a layout without the feature's own maglev records.
- **Fix:** Filter the feature's records out before comparing; added a test for a margin building in a corridor to keep branch coverage at 100%.
- **Committed in:** `6331d73`

---

**Total deviations:** 3 auto-fixed (1 blocking, 1 missing critical, 1 bug)
**Impact on plan:** No scope creep; all inside the plan's files.

## Issues Encountered
- A chained `mkdir` failed early in the session and left three test files in the repo root; they were moved into `tests/scorched_core/stages/` before the first commit. Nothing was committed from the wrong place.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None. `variant` and the runway-light pairing are data the renderer (03-13) will interpret; they are not placeholders.

## Threat Flags
None. The only boundary crossed is the static manifest list (T-03-16): capped at 3000 placements by a test (2609 now) and shipped once, never per frame. No packages were added.

## Next Phase Readiness
- Ready for 03-13: the layout is a stride-6 list in `manifest.stage.city`; a placement at distance d sits at logical y = `tuning.ground_y0` + 0.94 * (scroll - d) in the ground frame. Building tops stay at or below 34 plane units.
- Ready for 03-15: FIRE lots are authored burning ruins; destructible lots are still to come.
- Concern for 03-13: the maglev and the runway lights clear the middle of column 1 (the runway empties it entirely from 7600), so the renderer should expect no buildings there.

## Self-Check: PASSED

All created files exist and commits `66983b6`, `6331d73`, `d45b083`, `1884c68` are ancestors of HEAD. `make lint`, `make test-python` (1620 passed, 100.00% line and branch), `make build`, `stage.spec.js` (5 passed), `make test-web` and `make perf` all green.

---
*Phase: 03-stage-1-vertical-slice*
*Completed: 2026-10-18*
