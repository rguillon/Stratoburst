---
phase: 03-stage-1-vertical-slice
plan: 05
subsystem: enemy-fire
tags: [bullet-patterns, data-driven, enemy-pool, stage-data, tdd]

requires:
  - phase: 03-stage-1-vertical-slice
    provides: StageData, StageDirector, WaveEntry and STAGE_1 from plans 03-01 and 03-04
provides:
  - PatternSpec (frozen, slotted, validated) and the PATTERNS registry with PATTERN_NAMES, PATTERN_TABLE and pattern_index
  - fire_spread and the single run_pattern runner; FirePattern SPREAD 3 and STREAM 4
  - EnemyPool pattern, volley and burst_left columns, bursts, and a column-driven swap-remove (_COLUMNS)
  - tuning ENEMY_PATTERN replacing ENEMY_FIRE_PATTERN, ENEMY_FIRE_INTERVAL, ENEMY_BULLET_SPEED and ENEMY_RING_COUNT
  - WaveEntry.pattern, validated at import and resolved to an index once by StageDirector
  - Stage 1 opening waves with spread3, ring10_slow, aimed_slow and stream3
affects: [03-06, 03-14, 03-19, 03-27]

plan_head_before: 0c47564ab7ca38d8b17cda78e898739e496070f0
plan_head_after: c5dc948e5af931842193e26aca5d0016148cf21d

actuals:
  tokens: 14686
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "A bullet pattern is a PatternSpec registry entry; adding one never touches engine code"
    - "Names resolve to table indices once at import (pool kind defaults, StageData validation, StageDirector)"
    - "Swap-remove is driven by a _COLUMNS tuple and a test compares it with the dataclass fields"

key-files:
  created:
    - src/scorched_core/patterns/pattern_spec.py
    - src/scorched_core/patterns/pattern_library.py
    - tests/scorched_core/patterns/test_pattern_spec.py
    - tests/scorched_core/patterns/test_pattern_library.py
  modified:
    - src/scorched_core/patterns/bullet_patterns.py
    - src/scorched_core/patterns/fire_pattern.py
    - src/scorched_core/pools/enemy_pool.py
    - src/scorched_core/tuning.py
    - src/scorched_core/stages/wave_entry.py
    - src/scorched_core/stages/stage_data.py
    - src/scorched_core/stages/stage_director.py
    - src/scorched_core/stages/stage_1.py

key-decisions:
  - "The ring phase is (volley * phase_step_deg) % (360 / count) in radians, with a per-row volley counter; the gallery digest matched on the first run, so no adjustment was needed"
  - "AIMED and STREAM with a zero aim offset keep calling fire_aimed unchanged (bit parity); a non-zero offset goes through fire_spread with one bullet"
  - "A burst is tracked by burst_left: the timer reloads burst_gap while shots remain, else interval; pattern -1 never fires and a carrier defaults to it"
  - "PatternSpec also rejects non-finite arc, offset and phase step, a negative delay and a burst_gap below 1, on top of the plan's list (T-03-06)"

patterns-established:
  - "Data-first volleys: run_pattern(spec, pool, x, y, target_x, target_y, volley) is the only place a shape is played"
  - "Duck-typed bad spec (SimpleNamespace shape=99) exercises the loud unknown arm in the runner and the pool"

requirements-completed: [ENMY-04]

coverage:
  - id: D1
    description: "PatternSpec registry: aimed, spread, ring and stream defined as validated frozen data, new pattern = new entry"
    requirement: ENMY-04
    verification:
      - kind: unit
        ref: "tests/scorched_core/patterns/test_pattern_spec.py, test_pattern_library.py"
        status: pass
    human_judgment: false
  - id: D2
    description: "One runner plays every shape (aimed, offset aim, spread fan, ring phase, stream, full pool, unknown shape)"
    requirement: ENMY-04
    verification:
      - kind: unit
        ref: "tests/scorched_core/patterns/test_bullet_patterns.py"
        status: pass
    human_judgment: false
  - id: D3
    description: "Per-row pattern, volley and burst state, column-driven swap-remove, gallery fire byte-identical to the pre-change digest"
    requirement: ENMY-04
    verification:
      - kind: unit
        ref: "tests/scorched_core/pools/test_enemy_pool.py; tests/scorched_core/game/test_game.py#test_the_gallery_enemy_fire_matches_the_pre_pattern_digest"
        status: pass
    human_judgment: false
  - id: D4
    description: "Stage waves name their pattern (validated at import, resolved once); stage 1 opening shows spread, ring, stream at Raiden pacing"
    requirement: ENMY-04
    verification:
      - kind: unit
        ref: "tests/scorched_core/stages/*; tests/scorched_core/game/test_game.py#test_the_first_spread_wave_fires_count_bullets_fanned_around_the_ship_direction"
        status: pass
    human_judgment: false
  - id: D5
    description: "The opening patterns feel approachable and readable when played (speed, density, fan width)"
    verification: []
    human_judgment: true
    rationale: "Pacing and readability of bullet patterns is a feel judgement no test asserts; numbers are bounded (speed <= 2.0, interval >= 90) but not tuned by play"

duration: 8min
completed: 2026-10-18
status: complete
---

# Phase 3 Plan 05: Data-driven Enemy Bullet Patterns Summary

**Enemy fire is now a PatternSpec registry (aimed, spread, ring, stream) played by one run_pattern runner from per-row pool state, with the Phase 2 gallery bit-identical and stage 1's opening waves naming spread3, ring10_slow, aimed_slow and stream3.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-10-18T16:25:30Z (approximate, from the previous plan's close)
- **Completed:** 2026-10-18T16:31:00Z
- **Tasks:** 2
- **Files modified:** 21 (10 source, 11 test)

## Accomplishments
- `PatternSpec` (frozen, slotted, validated) and the `PATTERNS` registry; `pattern_index` raises ValueError on an unknown name, so a bad name never reaches the step loop.
- `fire_spread` and `run_pattern` with a `match` on `FirePattern` (NONE 0, AIMED 1, RING 2, SPREAD 3, STREAM 4) and a loud unknown arm.
- `EnemyPool` gains `pattern`, `volley` and `burst_left` columns, burst support (3 shots 8 steps apart, then the interval) and a `_COLUMNS`-driven `_remove_at`; a test compares `_COLUMNS` with the dataclass fields and a randomized spawn/remove run checks every column against a reference model.
- The gallery enemy-bullet floats and event records over 1200 steps (7770 live bullet-steps) hash to the digest recorded from the pre-change code.
- `WaveEntry.pattern`, validated by `StageData` (error names the wave index, `at` and kind) and resolved once in `StageDirector.__post_init__`; stage 1's opening waves use all four shapes.

## Task Commits

1. **Task 1 (tracer): PatternSpec through one runner, gallery unchanged**
   - RED `55c561b` (test), GREEN `46a71a4` (feat)
2. **Task 2: Stage waves name their pattern, stage 1 opening patterned**
   - RED `54eb6aa` (test), GREEN `c5dc948` (feat)

**Plan metadata:** the docs commit that follows this SUMMARY.

## Files Created/Modified
- `src/scorched_core/patterns/pattern_spec.py` - frozen validated PatternSpec
- `src/scorched_core/patterns/pattern_library.py` - PATTERNS, PATTERN_NAMES, PATTERN_TABLE, pattern_index
- `src/scorched_core/patterns/bullet_patterns.py` - fire_spread, run_pattern
- `src/scorched_core/patterns/fire_pattern.py` - SPREAD and STREAM
- `src/scorched_core/pools/enemy_pool.py` - pattern/volley/burst columns, `_COLUMNS`, burst-aware fire
- `src/scorched_core/tuning.py` - ENEMY_PATTERN replaces four fire constants
- `src/scorched_core/stages/{wave_entry,stage_data,stage_director,stage_1}.py` - wave pattern names and the patterned opening
- matching tests under `tests/scorched_core/{patterns,pools,entities,stages,game}/`

## Decisions Made
See `key-decisions` above. Pattern numbers for the stage patterns: aimed_slow 1.3 / 150; spread3 3 bullets over 40 deg at 1.5 / 150; spread5 5 over 70 deg at 1.4 / 180; ring10_slow 10 at 1.0 / 200 stepping 18 deg; stream3 burst 3, gap 8, 1.7 / 170. All are within D-07 (speed at most 2.0, interval at least 90).

## Deviations from Plan

None - plan executed exactly as written.

The plan's step to record the gallery digest before editing was done with a script that also hashes `storm_pool` bullets in front of the gameplay ones (identical to gameplay-only in the gallery). The old 30-slot header digest test from 03-01 stays in place alongside the new fire digest. The tracer's expansion gate was the same `<verify>` command (`make lint && make test-python`), re-run green before Task 2.

**Total deviations:** 0.

## TDD Gate Compliance

Both tasks have a `test(03-05)` commit followed by a `feat(03-05)` commit. RED evidence is pytest output (not a format the TDD classifier supports, so `tdd-red-evidence` was not run; semantic check done by hand): Task 1 failed at collection with `ImportError: cannot import name 'run_pattern'` / missing `pattern_spec` and `pattern_library` modules (the new API did not exist); Task 2 failed on 10 assertions (`WaveEntry` has no `pattern`, no unknown-pattern rejection, director not resolving names, stage 1 unpatterned, first volley not a spread). The gallery parity test passed on the old code, as intended, because it is the guard. No REFACTOR commit.

## Issues Encountered
None. The ring phase arithmetic matched the recorded digest on the first run.

## Known Stubs
None.

## Threat Flags
None. Pattern names resolve at import and invalid specs raise ValueError (T-03-06 mitigated); no packages were installed (T-03-SC).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Ready for 03-06. Boss emitters in 03-14 and 03-19 add entries to `PATTERNS` and reuse `run_pattern`.
- `make lint`, `make test-python` (1238 passed, 100% line+branch), `make perf` (avg about 0.55-0.69 ms) and `npm test` (1089 passed) are green. e2e and build were not re-run: no JS or protocol change (the manifest `fire_patterns` map just gains SPREAD and STREAM).

---
*Phase: 03-stage-1-vertical-slice*
*Completed: 2026-10-18*

## Self-Check: PASSED
