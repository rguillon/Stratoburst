---
phase: 03-stage-1-vertical-slice
plan: 27
subsystem: performance-gate
tags: [perf, pyodide, node, makefile, ci, full-stage-simulation, refusal-counters, tdd, tracer]

requires:
  - phase: 03-stage-1-vertical-slice
    provides: STAGE_1 with its mid-boss and bomber, StageFlow states, create_game stage and at options, header slots BOSS_ACTIVE and DEATHS (03-04, 03-08, 03-21); the Phase 2 perf harness tools/perf_node.mjs
provides:
  - tools/perf_node.mjs options --stage 0|1, --at midboss|boss, --mortal 0|1, allow-listed, exit 2 on bad usage
  - npm script perf:stage and Makefile target perf-stage; perf chains the gallery runs and the stage runs, so CI (make perf) guards both
  - EnemyPool.refused (spawns refused at the alive cap) and EventRing.dropped_high (refused pushes that were not low priority)
  - native full-stage play-through test with STAGE_BULLET_BUDGET = 180 in tests/scorched_core/stages/test_stage_1.py
affects: [03-28 vertical-slice gate (end-of-phase device check re-measures phone frame rate; this gate is desktop Node only)]

actuals:
  tokens: 2850
  tasks: 2
  commits: 4
plan_head_before: 018c6b6e2d28d87751e057de6d4a670ebea9232a
plan_head_after: 0df9115318f8bfa0e41c3b82470d75c89293404c

tech-stack:
  added: []
  patterns:
    - "A perf gate that cannot measure nothing: a stage run fails when the boss never came up, a mortal run fails when nobody died, a weapon run fails when the weapon produced nothing"
    - "Refusal counters live on the pool or ring that refuses, cumulative like kills and dropped, and a play-through test asserts they stayed at zero"

key-files:
  created: []
  modified:
    - tools/perf_node.mjs
    - package.json
    - Makefile
    - src/scorched_core/pools/enemy_pool.py
    - src/scorched_core/events/event_ring.py
    - tests/scorched_core/pools/test_enemy_pool.py
    - tests/scorched_core/events/test_event_ring.py
    - tests/scorched_core/stages/test_stage_1.py

key-decisions:
  - "A stage run has no stress storm unless --stress is given (stress defaults to 0 for --stage 1, 500 for the gallery): the gate measures the stage's own content, not the synthetic Phase 2 storm"
  - "The mortal run parks the ship instead of sweeping: the sweep dodges the whole opening and never dies, while a parked ship dies three times (ticks about 1905, 2183, 2494 natively) and reaches GAME_OVER, so the death, respawn, hitstop, lives and game-over path is really exercised"
  - "The game-over ticks that follow the last life stay in the mortal average (about 1100 of 3600 are idle game-over ticks); that only lowers the average, and the budget is two orders of magnitude above the measured cost, so it was left as the plan specified rather than adding a lives override"
  - "Stage data needed no tuning: the native play-through reaches STAGE_CLEAR at about step 17300, with a peak of 58 live gameplay enemy bullets (budget 180), zero refused spawns and zero lost events"

patterns-established:
  - "Full-stage native simulation as a module-scoped fixture plus a second run for the determinism digest of header slots 0-49"

requirements-completed: [ENMY-05, ENMY-04, ENMY-06]

coverage:
  - id: D1
    description: "make perf-stage runs stage 1's boss fight in real Pyodide on Node for vulcan, laser and homing at Lv5 with bombs and fails above 3 ms or when the boss never came up"
    requirement: ENMY-05
    verification:
      - kind: other
        ref: "make perf-stage (avg 0.23 / 0.08 / 0.17 ms, peak_boss_active 2); node tools/perf_node.mjs --stage 1 --at boss --ticks 200 --budget-ms 0.001 exits 1 with 'never reached the boss'"
        status: pass
    human_judgment: false
  - id: D2
    description: "A mortal segment (no god, parked ship) is measured through deaths and game over under the same budget and fails when no death happened"
    requirement: ENMY-06
    verification:
      - kind: other
        ref: "make perf-stage (mortal run: avg 0.12 ms, peak_deaths 3)"
        status: pass
    human_judgment: false
  - id: D3
    description: "make perf runs the gallery runs and then the stage runs (CI gate.yml runs make perf); bad --stage/--at/--mortal usage exits 2"
    verification:
      - kind: other
        ref: "make perf exit 0; node tools/perf_node.mjs --stage 1 --at nowhere exits 2"
        status: pass
    human_judgment: false
  - id: D4
    description: "EnemyPool.refused and EventRing.dropped_high count refusals"
    requirement: ENMY-05
    verification:
      - kind: unit
        ref: "tests/scorched_core/pools/test_enemy_pool.py#test_every_spawn_refused_at_the_alive_cap_is_counted"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/events/test_event_ring.py#test_a_refused_high_priority_event_is_counted_apart_from_the_low_ones"
        status: pass
    human_judgment: false
  - id: D5
    description: "A native full-stage run plays from distance 0 through mid-boss, bomber and tally to STAGE_CLEAR deterministically, with no refused spawn, no lost high-priority event and at most 180 live enemy bullets"
    requirement: ENMY-04
    verification:
      - kind: unit
        ref: "tests/scorched_core/stages/test_stage_1.py#test_full_stage_plays_from_the_start_through_both_bosses_to_the_clear"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/stages/test_stage_1.py#test_full_stage_keeps_raiden_pacing_in_the_bullet_count"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/stages/test_stage_1.py#test_full_stage_is_deterministic"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-10-18
status: complete
---

# Phase 3 Plan 27: Full-stage perf gate and play-through Summary

**make perf now guards stage 1 in real Pyodide (boss fight for every weapon at Lv5 plus a mortal run through deaths and game over, all around 0.1-0.2 ms against the 3 ms budget) and a native full-stage simulation proves the content plays to STAGE_CLEAR deterministically with zero refusals and at most 58 of the 180 allowed enemy bullets.**

## Performance

- **Duration:** about 8 min
- **Started:** 2026-10-18T21:10Z (approximate, start time not captured)
- **Completed:** 2026-10-18T21:18Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- `tools/perf_node.mjs` gained `--stage 0|1`, `--at midboss|boss` and `--mortal 0|1`. A stage run drops the gallery flag, passes `at`, keeps god, 7 bombs and the sweep, records the peak BOSS_ACTIVE and fails when it stayed 0. A mortal run plays from the stage start without god, parks the ship, records the peak DEATHS and fails when nobody died.
- `package.json` `perf:stage` runs the three boss-fight runs (1800 ticks, bomb every 600) then the mortal run (3600 ticks, vulcan Lv3); `perf` is the gallery command followed by `npm run perf:stage`; Makefile `perf-stage` wraps it and `perf` help text says it runs both.
- Measured in Pyodide on Node (desktop WSL2): boss fight vulcan 0.23 ms, laser 0.08 ms, homing 0.17 ms average (p95 at most 0.28 ms); mortal 0.12 ms (p95 0.19 ms, 3 deaths); gallery runs unchanged at 0.53-0.69 ms. The stage budget (research A4, about 1.5 ms desktop) holds with a wide margin.
- `EnemyPool.refused` and `EventRing.dropped_high` counters, with unit tests, so a refused spawn or a lost kill/boss event is visible instead of silent.
- Native full-stage simulation (god, Lv5 laser, fire held, 90-step sweep, fixed step): flow runs INTRO, PLAY, MIDBOSS, PLAY, WARNING, BOSS, CLEAR, TALLY, STAGE_CLEAR at about step 17300 (limit 20000); `enemies.refused == 0`, `events.dropped_high == 0`, peak gameplay enemy bullets 58 against `STAGE_BULLET_BUDGET = 180`; a second run gives the same sha256 digest of header slots 0-49 per tick.

## Task Commits

1. **Task 1 (tracer): make perf-stage measures stage 1's boss fight** - `587e32a` (feat). Tracer gate: `make perf-stage` and `make perf` re-run green (automated-only verify, end-of-phase mode), so expansion continued.
2. **Task 2 RED: failing tests for the counters and the full-stage play-through** - `54439bf` (test). The four counter tests fail with AttributeError on the missing `refused` / `dropped_high`; the full-stage refusal test fails the same way. The other three full-stage tests pass at once because they guard existing content (the stage already plays through), which is the point of the plan, not an unexpected green on new behaviour.
3. **Task 2 GREEN: counters** - `9ff2c90` (feat)
4. **Task 2 GREEN: mortal perf run** - `0df9115` (feat)

No refactor commit was needed.

## Files Created/Modified

- `tools/perf_node.mjs` - stage, at and mortal options, boss and death checks
- `package.json` - `perf:stage`, `perf` chain
- `Makefile` - `perf-stage` target, `.PHONY`, help text
- `src/scorched_core/pools/enemy_pool.py` - `refused` counter in `spawn`
- `src/scorched_core/events/event_ring.py` - `dropped_high` counter in `push`
- `tests/scorched_core/pools/test_enemy_pool.py`, `tests/scorched_core/events/test_event_ring.py` - counter tests
- `tests/scorched_core/stages/test_stage_1.py` - full-stage simulation tests and `STAGE_BULLET_BUDGET`

## Decisions Made

See key-decisions in the frontmatter: no stress storm on stage runs, a parked ship for the mortal run, game-over ticks left in the mortal average, and no stage-data tuning needed.

## Deviations from Plan

None - plan executed exactly as written, with two judgement calls inside the plan's latitude (both under key-decisions): the stage run's stress default of 0, and the mortal run's parked ship (the plan did not say how the mortal ship moves; with the shared sweep it never dies, which would have made the gate fail).

**Total deviations:** 0 auto-fixed. **Impact on plan:** none.

## Issues Encountered

- The first mortal attempt with the shared sweep saw no death in 3600 ticks (the sweep dodges the opening), tripping the new "no death" guard. Parking the ship fixed it; the guard did exactly what it was written for.
- The stage boss approach takes about 580 steps from the `at boss` start (320 units of lead at 0.8 per step, plus the 120-tick warmup), and BOSS state then lasts through the whole 1800 measured ticks, so the boss-fight runs measure the fight itself, not the approach.
- Not touched, per the orchestrator's note: the train aft turret shadowed by the hull and the mid-boss timeout outlasting the lull (open user design decisions). The play-through did not run into either: with the Lv5 laser both bosses die and the flow reaches the clear.

## Known Stubs

None.

## Threat Flags

None. Tooling-only change (CLI argument allow-lists, T-03-35 mitigated: bad `--stage`, `--at`, `--mortal` exit 2; a run that never reached the boss or never died fails; no new packages, lockfiles unchanged).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CI already runs `make perf` (gate.yml), so the stage and mortal runs are guarded on every push with no workflow change.
- The numbers are desktop Node only; the phone frame-rate check is the end-of-phase device check (T-03-33), in plan 03-28.

## TDD Gate Compliance

RED commit `54439bf` (test) precedes GREEN commits `9ff2c90` and `0df9115` (feat). Task 1 is a tracer on a CLI tool with no unit-test seam (its verify is the make targets and exit codes), committed as a single feat.

## Self-Check: PASSED

- Files modified exist (tools/perf_node.mjs, package.json, Makefile, the two sources and three test files): FOUND
- Commits `587e32a`, `54439bf`, `9ff2c90`, `0df9115` are ancestors of HEAD: FOUND
- `make lint`, `make test-python` (2101 passed, 100.00% line+branch coverage) and `make perf` (exit 0, every avg_ms below 3): PASSED
- Acceptance criteria (greps for `perf-stage:`, `perf:stage`, `dropped_high`, `refused`, `--mortal`; `--at nowhere` exits 2; `pytest -k full_stage` 4 passed): PASSED

---
*Phase: 03-stage-1-vertical-slice*
*Completed: 2026-10-18*
