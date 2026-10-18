---
phase: 02-arcade-shooting-feel
plan: 18
subsystem: gameplay
tags: [enemy-fire, bullet-patterns, struct-of-arrays, pytest, pyodide]

requires:
  - phase: 02-arcade-shooting-feel
    provides: gameplay enemy bullet pool packed after the storm (02-16), pink orb rendering (02-17), EnemyPool columns and EnemyKind tables (02-15)
provides:
  - FirePattern IntEnum (NONE, AIMED, RING) and the patterns package with fire_aimed and fire_ring
  - EnemyPool fire_timer column and fire(bullets, ship_x, ship_y, events) with spawn delay, screen-band gating and low ENEMY_FIRE events
  - Fire tuning tables (delay, band, pattern, interval, speed, ring count) and the fire_patterns manifest map
  - Game wiring: enemies fire into the gameplay pool right after enemies.step
affects: [02-20 lethal enemy bullets, 02-25 pacing human-check, Phase 3 data-driven bullet patterns, any plan that listens to EV_ENEMY_FIRE]

actuals:
  tokens: 6700
  tasks: 2
  commits: 3
plan_head_before: ffc3bc00f4d12b854033fff8f21b67d04ad3bbe5
plan_head_after: 9adae34ca01d743f9644c19426428b5381d58561

tech-stack:
  added: []
  patterns:
    - "Fire patterns are data: a FirePattern per kind indexes interval and speed tuples; EnemyPool.fire dispatches with a match and raises on an unknown pattern"
    - "Pattern helpers are module functions writing through BulletPool.spawn and returning how many bullets fit, so a full pool drops the rest of a volley"
    - "Held shots: out-of-band enemies keep their timer at zero and fire the moment they enter the band"

key-files:
  created:
    - src/scorched_core/patterns/__init__.py
    - src/scorched_core/patterns/fire_pattern.py
    - src/scorched_core/patterns/bullet_patterns.py
    - tests/scorched_core/patterns/test_fire_pattern.py
    - tests/scorched_core/patterns/test_bullet_patterns.py
  modified:
    - src/scorched_core/pools/enemy_pool.py
    - src/scorched_core/tuning.py
    - src/scorched_core/game/game.py
    - tests/scorched_core/pools/test_enemy_pool.py
    - tests/scorched_core/game/test_game.py

key-decisions:
  - "The fire timer counts fire() calls: it starts at ENEMY_FIRE_DELAY (45), the 45th call after spawning shoots, and each volley reloads ENEMY_FIRE_INTERVAL"
  - "An enemy outside the band (above the top edge, or below 70% of the playfield height) holds its shot with the timer at zero and fires as soon as it is inside, rather than skipping a whole interval"
  - "ENEMY_FIRE events are pushed only for a volley that spawned at least one bullet, so a full pool never advertises a shot that did not happen"
  - "Ring phase is (age // interval) % 2 * (pi / ENEMY_RING_COUNT): consecutive helicopter rings interleave by half a ring step"
  - "Ring angles use the bullet-pool convention (0 straight up, positive clockwise to the right)"

patterns-established:
  - "Pattern helpers live in patterns/ as functions (no allocation in the loop) and are the seed of the Phase 3 data-driven bullet patterns"
  - "New per-enemy columns are added to spawn, __post_init__ and the swap-remove together, with a test that the column follows its enemy"

requirements-completed: [VISL-05, PLYR-06]

coverage:
  - id: D1
    description: "Turrets, tanks and jets fire aimed shots into the gameplay bullet pool at their tabled interval and speed, after the 45-step spawn delay, never into the stress storm"
    requirement: VISL-05
    verification:
      - kind: unit
        ref: "tests/scorched_core/pools/test_enemy_pool.py#test_a_turret_fires_its_first_shot_after_delay_then_every_interval"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_a_turret_fires_its_first_shot_after_delay_into_the_gameplay_pool"
        status: pass
      - kind: e2e
        ref: "playwright: tools/e2e/stress.spec.js (STORM_N stays exact while enemies fire)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Helicopters fire interleaved rings of eight; carriers never fire; each volley pushes one low ENEMY_FIRE event"
    requirement: VISL-05
    verification:
      - kind: unit
        ref: "tests/scorched_core/pools/test_enemy_pool.py#test_consecutive_rings_are_rotated_by_half_a_step_so_they_interleave"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_the_enemy_fire_event_reaches_the_event_ring_once"
        status: pass
    human_judgment: false
  - id: D3
    description: "Fire is gated by spawn delay and screen band, and live gameplay enemy bullets never exceed 200 over a 2400-step deterministic run, with the tick average at most 3 ms"
    requirement: PLYR-06
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_a_long_gallery_run_keeps_the_enemy_bullet_cap_and_stays_deterministic"
        status: pass
      - kind: other
        ref: "make perf: avg_ms 0.58 (2400 ticks: 0.57), budget_ms 3"
        status: pass
    human_judgment: false
  - id: D4
    description: "The pacing of enemy fire feels like Raiden and not bullet hell"
    verification: []
    human_judgment: true
    rationale: "Pacing is a feel judgement; the starting tables are tunable data and are checked in the plan 02-25 human-check"

duration: 9min
completed: 2026-10-18
status: complete
---

# Phase 2 Plan 18: Enemy Fire Summary

**Gallery enemies shoot back at Raiden pacing: aimed shots from turrets, tanks and jets and interleaved rings of eight from helicopters, fed through a tabled FirePattern into the capped gameplay bullet pool.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-10-18T05:13:38Z
- **Completed:** 2026-10-18T05:23:00Z
- **Tasks:** 2
- **Files modified:** 10 (5 created, 5 modified)

## Accomplishments

- New `patterns/` package: `FirePattern` (NONE, AIMED, RING), `fire_aimed` and `fire_ring`, the seed of the Phase 3 data-driven bullet patterns.
- `EnemyPool.fire` with a `fire_timer` column that is swapped on removal: 45-step spawn delay, per-kind interval and speed, screen-band gating (top edge down to 70% of the height), one low-priority `ENEMY_FIRE` event per volley.
- Fire tables in `tuning.py` and a `fire_patterns` map in the manifest; `Game._step` fires right after `enemies.step`, into `game.ebullets` only (the stress storm is untouched, `STORM_N` stays exact).
- Tracer verified end to end before expansion: Python gate, vitest, `make perf`, build and the stress and shooting Playwright specs all passed with turrets firing; the full `make check` (ruff, 100% line+branch coverage, vitest, build, perf, all 46 e2e specs) passes at the end.

## Task Commits

1. **Task 1: Tracer, aimed shots through the gameplay pool** - `4fa12ef` (feat)
2. **Task 2: Helicopter rings, band gating and the bullet cap**
   - RED - `bd80fd2` (test)
   - GREEN - `9adae34` (feat)

**Plan metadata:** the docs commit that follows this summary.

## TDD Gate Compliance (Task 2)

- **RED:** `bd80fd2` added tests for `fire_ring`, the HELI ring, the half-step interleave, the nearly-full-pool ring, the game-level helicopter ring, band gating and the 2400-step cap run. Run before the implementation, 7 of the new tests failed: 3 `fire_ring` tests with `AttributeError` (the helper did not exist), the 3 pool ring tests and the game helicopter test on assertions (a helicopter fired nothing: `assert 0 == 8`). The band and cap tests passed already because Task 1's behaviour covered them; they are regression guards. No machine-readable RED record was produced: the classifier supports TAP, JUnit, swift-testing and unittest reports, not pytest output. Semantic assessment: every failure was for the intended reason (missing ring behaviour), none from a syntax, import or fixture fault.
- **GREEN:** `9adae34` implemented `fire_ring` and the RING arm; the full suite passed at 100% coverage.
- **REFACTOR:** none needed.

## Files Created/Modified

- `src/scorched_core/patterns/fire_pattern.py` - `FirePattern` IntEnum.
- `src/scorched_core/patterns/bullet_patterns.py` - `fire_aimed` and `fire_ring` helpers.
- `src/scorched_core/pools/enemy_pool.py` - `fire_timer` column, `fire()`, ring half-step constant.
- `src/scorched_core/tuning.py` - `ENEMY_FIRE_DELAY`, `ENEMY_FIRE_MAX_Y`, `ENEMY_FIRE_PATTERN`, `ENEMY_FIRE_INTERVAL`, `ENEMY_BULLET_SPEED`, `ENEMY_RING_COUNT`.
- `src/scorched_core/game/game.py` - the `fire()` call after `enemies.step`, `fire_patterns` in the manifest.
- Tests mirror each source file; the pool tests cover timer, band, ring, swap-remove and the corrupt-pattern error, the game tests cover the pool split, the event and the 2400-step cap.

## Decisions Made

See `key-decisions` above. The two worth remembering for tuning: shots held outside the band fire the moment the enemy enters it, and a volley that spawns nothing (full pool) pushes no event but still reloads the timer.

## Deviations from Plan

None - plan executed exactly as written.

The Task 1 `<verify>` block lists `npm test && npm run perf && npm run build && npx playwright test ...`; all were run and passed. Measured `make perf`: avg 0.58 ms, p95 0.67 ms (budget 3 ms); a 2400-tick run, which includes the helicopter script entries, averaged 0.57 ms.

## Issues Encountered

None.

## Known Stubs

None. Enemy bullets intentionally do not hurt the player yet (plan 02-20 makes them lethal); this is the plan's accepted edge-probe assumption, not a stub.

## Threat Flags

None. T-02-22 (denial of service) is mitigated as planned: the gameplay pool is a preallocated 200-bullet pool, fire is gated by delay and band, a 2400-step test asserts the cap and perf was re-measured. T-02-SC: no packages added, lockfiles unchanged.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 02-20 (lethal enemy bullets): `game.ebullets` now fills with aimed shots and rings and each volley carries an `ENEMY_FIRE` event (x, y, a = fire pattern) ready for a firing sound or muzzle flash. The fire tables are plain tuples in `tuning.py` for the 02-25 pacing check.

---
*Phase: 02-arcade-shooting-feel*
*Completed: 2026-10-18*

## Self-Check: PASSED
