---
phase: 03-stage-1-vertical-slice
plan: 06
subsystem: enemy-motion
tags: [enemy-paths, formations, stage-data, tdd, polyline]

requires:
  - phase: 03-stage-1-vertical-slice
    provides: EnemyPool motions and columns, WaveEntry, StageData, StageDirector and the STAGE_1 opening with named bullet patterns (03-01, 03-05)
provides:
  - PathSpec (frozen, validated, precomputed segment lengths and unit directions) and the PATHS registry with PATH_NAMES, PATH_TABLE, path_index, arc_points, s_curve_points, loop_points
  - MotionKind.PATH 4 and MotionKind.SCRIPTED 5; EnemyPool path, seg, seg_t, base_y, flip columns and spawn(path=, flip=)
  - WaveEntry.path and mirror, validated by StageData and resolved once by StageDirector
  - Formation helpers v_formation, line_formation, column_formation, mirrored
  - The full STAGE_1 timeline (slums, downtown, airbase) up to the boss marker, with MIDBOSS_LULL, BOSS_QUIET, DOWNTOWN_AT, AIRBASE_AT
affects: [03-07, 03-14, 03-19, 03-27]

plan_head_before: aa4e92738f6a9af3ab10f1dad2c377c482321c22
plan_head_after: ed0908a80e21684e215f4c382c43be0af570d8e9

actuals:
  tokens: 21000
  tasks: 2
  commits: 5

tech-stack:
  added: []
  patterns:
    - "A path is a PathSpec registry entry built at import from pure point generators; the pool only indexes tuples"
    - "A formation is a function that expands into plain WaveEntry rows; stage sections are tuples merged with one stable sort on at"
    - "Ground kinds on a PATH ride the ground scroll through base_y, so a road polyline stays terrain-anchored"

key-files:
  created:
    - src/scorched_core/paths/__init__.py
    - src/scorched_core/paths/path_spec.py
    - src/scorched_core/paths/path_library.py
    - src/scorched_core/stages/formations.py
    - tests/scorched_core/paths/test_path_spec.py
    - tests/scorched_core/paths/test_path_library.py
    - tests/scorched_core/stages/test_formations.py
  modified:
    - src/scorched_core/entities/motion_kind.py
    - src/scorched_core/pools/enemy_pool.py
    - src/scorched_core/stages/wave_entry.py
    - src/scorched_core/stages/stage_data.py
    - src/scorched_core/stages/stage_director.py
    - src/scorched_core/stages/stage_1.py
    - tests/scorched_core/entities/test_motion_kind.py
    - tests/scorched_core/pools/test_enemy_pool.py
    - tests/scorched_core/stages/test_wave_entry.py
    - tests/scorched_core/stages/test_stage_data.py
    - tests/scorched_core/stages/test_stage_director.py
    - tests/scorched_core/stages/test_stage_1.py
    - tests/scorched_core/game/test_game.py

key-decisions:
  - "road_bend is a 0.8 units/step path (road_down stays a 0.25 crawl): a path offset rides the scrolling terrain, so at crawl speed the turn would happen near the bottom of the screen and the tank would leave after about 27 units sideways; at 0.8 it turns at y about 60 and crosses the screen"
  - "Arcs use heading degrees with 0 = down and 90 = right and an exact circle formula (sign * r * (cos s - cos h), sign * r * (sin h - sin s)); a negative sweep turns the other way, a closed loop is a 360 sweep"
  - "EnemyPool.spawn raises ValueError for PATH motion with a path index outside the table (after the alive-cap check), so PATH_TABLE[-1] can never silently pick the last path"
  - "A V formation puts the leader on x and fills wings left then right, one rank (spacing_at later, spacing_x wider) per pair; an even count leaves the last rank with only a left wing"
  - "mirrored() returns the originals then reflections about x = 120 (x -> 240 - x, vx negated, mirror toggled); the stage merges sections with a stable sort so ties keep authoring order"
  - "Only the PATH arm has a top exit (y < -2 * ENEMY_EXIT_MARGIN); DIVE and SWAY rows still enter from above; SCRIPTED rows skip every exit check"
  - "The test for turret drops became 'at least three BOMB drops, all on turrets, at most eight' because heavier turret groups now include non-dropping turrets"

patterns-established:
  - "Section tuples + sorted(key=at): each stage section is data, the module merges once"
  - "Monkeypatching enemy_pool.PATH_TABLE in tests gives exact geometry without touching the real registry"

requirements-completed: [ENMY-01, ENMY-02, ENMY-05]

coverage:
  - id: D1
    description: "PathSpec and the path library: validated polylines with precomputed segments, arc / S-curve / loop generators, seven named paths resolved to indices"
    requirement: ENMY-01
    verification:
      - kind: unit
        ref: "tests/scorched_core/paths/test_path_spec.py, tests/scorched_core/paths/test_path_library.py"
        status: pass
    human_judgment: false
  - id: D2
    description: "PATH motion: constant speed along the polyline, carry-over between segments, continuing past the last point, mirror flip, heading, top exit; SCRIPTED rows never move or leave"
    requirement: ENMY-01
    verification:
      - kind: unit
        ref: "tests/scorched_core/pools/test_enemy_pool.py (path and scripted tests)"
        status: pass
      - kind: integration
        ref: "tests/scorched_core/game/test_game.py#test_a_stage_jet_flies_its_authored_path_at_the_path_speed"
        status: pass
    human_judgment: false
  - id: D3
    description: "Tanks follow roads while terrain-anchored: a ground kind on a PATH adds the current ground scroll each step and turrets keep aiming"
    requirement: ENMY-02
    verification:
      - kind: unit
        ref: "tests/scorched_core/pools/test_enemy_pool.py#test_a_ground_kind_on_a_path_adds_the_ground_scroll_to_its_base_row"
        status: pass
      - kind: integration
        ref: "tests/scorched_core/game/test_game.py#test_a_stage_tank_drives_down_its_road_with_the_scroll"
        status: pass
    human_judgment: false
  - id: D4
    description: "Wave path names and mirror validated at import (unknown path, path without PATH motion, PATH motion without path) and resolved once by the director; formation helpers expand into plain rows"
    requirement: ENMY-01
    verification:
      - kind: unit
        ref: "tests/scorched_core/stages/test_stage_data.py, test_stage_director.py, test_wave_entry.py, test_formations.py"
        status: pass
    human_judgment: false
  - id: D5
    description: "Stage 1 timeline from slums through downtown and the airbase to the boss marker: carriers every 1560-1620 units, five bomb turrets, no waves in the mid-boss lull or the pre-boss quiet, two paths per air section, a road_bend tank column, peak 14 live enemies"
    requirement: ENMY-05
    verification:
      - kind: unit
        ref: "tests/scorched_core/stages/test_stage_1.py"
        status: pass
    human_judgment: false
  - id: D6
    description: "The downtown and airbase waves read as dense-but-approachable Raiden pacing, formations look good in 3D, and the road-bend turn looks right with the terrain"
    verification: []
    human_judgment: true
    rationale: "Pacing, formation readability and visual fit with the city roads are feel judgements no unit test asserts; counts, intervals and pattern speeds are pinned but not tuned by play, and the city road grid (plan 03-12) does not exist yet"

duration: 16min
completed: 2026-10-18
status: complete
---

# Phase 3 Plan 06: Enemy Paths, Formations and the Full Stage 1 Timeline Summary

**Jets, helicopters and tanks now fly authored PathSpec polylines (swoops, S-dives, loops, strafes, hover arcs, road drives and bends) in mirrored formations, tanks stay terrain-anchored on their roads, and stage 1 runs from the slums through downtown and the airbase to the boss marker with its pacing pinned by tests.**

## Performance

- **Duration:** 16 min (start time approximate: the start was not recorded, taken from the previous plan's close)
- **Completed:** 2026-10-18T16:44:00Z
- **Tasks:** 2
- **Files modified:** 20 (11 source incl. 4 new, 9 test incl. 3 new)

## Accomplishments
- `PathSpec` precomputes segment lengths and unit directions and rejects fewer than two points, non-finite values, non-positive speed and zero-length segments (T-03-07). The library builds seven named paths at import from `arc_points`, `s_curve_points`, `loop_points` and straight legs: swoop, s_dive, loop_back, strafe, hover_arc, road_down, road_bend.
- `MotionKind.PATH` follows `PATH_TABLE[path[i]]` at constant speed, carries leftover distance across segments, keeps going along the last direction past the final point, faces `atan2(dx, dy)` of the current segment, flips x offsets and direction when mirrored, and adds `ground_scroll` to `base_y` for ground kinds. `MotionKind.SCRIPTED` rows never move and are never removed by the exit margins; PATH rows also leave through the top at `-2 * ENEMY_EXIT_MARGIN`.
- `WaveEntry.path` / `mirror`; `StageData` rejects an unknown path, a path on a non-PATH motion and PATH motion without a path (messages name wave index, `at` and kind); `StageDirector` resolves path indices and flips once.
- `v_formation`, `line_formation`, `column_formation`, `mirrored` return plain `WaveEntry` tuples and forward extra fields.
- STAGE_1 has 179 waves (98 jets, 41 tanks, 18 helicopters, 17 turrets, 5 carriers): slums 0-2600 unchanged, downtown 2600-6500, airbase 6500-8300, boss marker still 8640. Carriers at 600, 2160, 3720, 5340, 6960 (gaps 1560, 1560, 1620, 1620); BOMB on five turrets (1200, 2050, 3440, 5660, 6780); nothing in [4200, 4620) or (8400, 8640]; a headless run of the whole timeline never has a spawn refused and peaks at 14 live enemies (the pool allows 56).

## Task Commits

1. **Task 1 (tracer): paths, PATH / SCRIPTED motion, wave fields**
   - RED `5b4e672` (test), GREEN `64d6af0` (feat)
2. **Task 2: formations and the full stage 1 timeline**
   - RED `674c495` (test), GREEN `8b6aba8` (feat), REFACTOR `ed0908a` (import order of the new test, once its module existed)

**Plan metadata:** the docs commit that follows this SUMMARY.

## Files Created/Modified
- `src/scorched_core/paths/path_spec.py`, `path_library.py` - the path data and registry
- `src/scorched_core/pools/enemy_pool.py` - five columns, PATH and SCRIPTED arms, `_follow_path`, spawn guard, top exit
- `src/scorched_core/entities/motion_kind.py` - PATH 4, SCRIPTED 5
- `src/scorched_core/stages/{wave_entry,stage_data,stage_director}.py` - path and mirror fields, validation, one-time resolution
- `src/scorched_core/stages/formations.py` - formation helpers (functions only)
- `src/scorched_core/stages/stage_1.py` - section tuples, constants, stable merge
- matching tests under `tests/scorched_core/{paths,entities,pools,stages,game}/`

## Decisions Made
See `key-decisions` above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] road_bend turn was off-screen at crawl speed**
- **Found during:** Task 2 (authoring the tank bend columns)
- **Issue:** the plan fixes the road paths as terrain-relative polylines but not their speed. With the 0.25 crawl of road_down the tank would only turn near y 260 and leave after about 27 units sideways, so the bend would never be seen.
- **Fix:** road_bend runs at 0.8 units/step with a 40-unit first leg; a headless trace shows the turn at y about 60 and a clean crossing to the right edge. The path test now allows road_bend up to 1.0 while road_down stays at most 0.5.
- **Files modified:** src/scorched_core/paths/path_library.py, tests/scorched_core/paths/test_path_library.py
- **Verification:** `make test-python`, trace of the tank positions
- **Committed in:** 8b6aba8

**2. [Rule 2 - Missing critical] Spawn guard for PATH motion**
- **Found during:** Task 1
- **Issue:** `PATH_TABLE[-1]` would silently select the last path for a PATH spawn without a path index.
- **Fix:** `EnemyPool.spawn` raises ValueError for PATH motion with an index outside the table (checked after the alive cap, so a full pool still just refuses).
- **Files modified:** src/scorched_core/pools/enemy_pool.py (tests in test_enemy_pool.py)
- **Committed in:** 64d6af0

**3. [Rule 3 - Blocking] Existing stage tests contradicted the new content**
- **Found during:** Task 2
- **Issue:** `test_ground_units_use_the_ground_motion_on_a_road_centre` (tanks are PATH now), `test_an_aa_turret_drops_a_bomb` (all turrets; heavier groups have non-bomb turrets) and `test_the_named_patterns_sit_on_the_opening_waves` (every patterned wave before 1500) described only the opening.
- **Fix:** rewritten to the plan's behaviour list (tanks on road centres with GROUND or road paths, at least three bomb turrets and only turrets drop bombs, the opening names its four patterns).
- **Files modified:** tests/scorched_core/stages/test_stage_1.py
- **Committed in:** 674c495 (RED commit; these assertions were part of the failing set)

**4. [Rule 3 - Blocking] `step()` exceeded the branch lint limit**
- **Found during:** Task 1
- **Issue:** two more match arms took `EnemyPool.step` to 14 branches (PLR0912 limit 12).
- **Fix:** `# noqa: PLR0912` with the reason (one flat match arm per motion kind); the PATH body lives in `_follow_path`.
- **Committed in:** 64d6af0

---

**Total deviations:** 4 auto-fixed (1 bug, 1 missing critical, 2 blocking)
**Impact on plan:** All needed for correctness or the lint gate; no scope creep.

## TDD Gate Compliance

Both tasks have a `test(03-06)` commit followed by a `feat(03-06)` commit, and Task 2 a `refactor(03-06)` commit. RED evidence is pytest output (not a format the TDD classifier supports, so `tdd-red-evidence` was not run; semantic check by hand). Task 1 RED: collection `ModuleNotFoundError: scorched_core.paths` for the path, pool, director and game test modules (the API did not exist), plus assertion failures in `test_motion_kind` (PATH and SCRIPTED missing) and `test_wave_entry` (no `path`, `mirror`). Task 2 RED: `ImportError` for `formations`, and `ImportError` for `AIRBASE_AT` and friends in `test_stage_1`. The tracer gate was the same `<verify>` (`make lint && make test-python`), re-run green before Task 2.

## Issues Encountered
None beyond the deviations above. The only JS-visible change is none: the protocol, manifest and enemy buffer stride are untouched.

## Known Stubs
None.

## Threat Flags
None. PathSpec rejects non-finite points, non-positive speed and zero-length segments at import (T-03-07 mitigated); no packages were installed (T-03-SC).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Ready for 03-07. The mid-boss and boss controllers can spawn `SCRIPTED` rows safely; the lull (4200-4620) and the quiet (8400-8640) are waiting for them.
- The JS renderer is not yet aware of PATH heading for tanks driving sideways (the angle column already carries the heading, so existing enemy sprites should rotate); worth a look in the visual plans, together with the city road grid (plan 03-12) that the road paths assume at x 80 and 160.
- `make lint`, `make test` (1362 Python tests at 100% line+branch, 1089 vitest tests) and `make perf` (avg 0.54-0.68 ms) are green; e2e and build were not re-run because no JS or protocol file changed.

---
*Phase: 03-stage-1-vertical-slice*
*Completed: 2026-10-18*

## Self-Check: PASSED
