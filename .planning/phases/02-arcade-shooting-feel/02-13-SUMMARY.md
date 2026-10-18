---
phase: 02-arcade-shooting-feel
plan: 13
subsystem: simulation
tags: [homing-missiles, weapons, uid-targeting, broadphase, python]

requires:
  - phase: 02-arcade-shooting-feel
    provides: "WeaponKind.HOMING and Game.loadout (02-08), EnemyPool uid column and apply_hit (02-03), resolve_shots_vs_enemies and the per-step grid (01-07), protocol v2 header slot reservations (02-01)"
provides:
  - "MissilePool: x, y, angle, target (uid), life, retarget columns; spawn, nearest_uid, steer(enemies), remove_at, pack_into (stride 4: x, y, angle, life fraction)"
  - "HomingLauncher.step(firing, x, y, level, missiles, enemies, events): centred 22 degree fan of 1 to 5 missiles, one low SHOT event (a = HOMING) per non-empty volley"
  - "EnemyPool.index_of_uid(uid) -> slot or -1"
  - "resolve_shots_vs_enemies(..., radius=PBULLET_RADIUS) keyword, so missiles hit at MISSILE_RADIUS through the same grid pass"
  - "protocol H_MISSILE_N = 19, MISSILE_STRIDE = 4, MISSILE_CAP = 48; manifest channel missiles and header slot MISSILE_N; Game.missiles and Game.homing"
  - "tuning HOMING_VOLLEY, HOMING_INTERVAL, HOMING_DAMAGE, HOMING_SPEED, HOMING_TURN_DEG, HOMING_RETARGET_TICKS, HOMING_LIFE_TICKS, HOMING_FAN_DEG, HOMING_MUZZLE_AHEAD, MISSILE_RADIUS"
affects: [02-23 missile rendering and per-weapon perf sweep, 02-14 and later plans that read the header]

actuals:
  tokens: 28000
  tasks: 2
  commits: 2
plan_head_before: 5910596a1ef9f3d958f5761c2c08975c1c70a29e
plan_head_after: 5c2ab2fdd82bc6bdbdd6418709d77696a1bec20e
commits: 2

tech-stack:
  added: []
  patterns:
    - "Entities that follow another entity over time hold its stable uid and look the slot up each step (index_of_uid), never a pool index"
    - "Steering is angle-based: signed difference wrapped to [-pi, pi] via modulo, clamped to the turn rate, heading re-wrapped so packed angles stay bounded"
    - "Shared hit pass parameterised by shot radius with a keyword-only default, so bolts and missiles use one broadphase loop"

key-files:
  created:
    - src/scorched_core/pools/missile_pool.py
    - src/scorched_core/weapons/homing_launcher.py
    - tests/scorched_core/pools/test_missile_pool.py
    - tests/scorched_core/weapons/test_homing_launcher.py
  modified:
    - src/scorched_core/pools/enemy_pool.py
    - src/scorched_core/collision/circle_hits.py
    - src/scorched_core/protocol.py
    - src/scorched_core/tuning.py
    - src/scorched_core/game/game.py
    - tests/scorched_core/pools/test_enemy_pool.py
    - tests/scorched_core/collision/test_circle_hits.py
    - tests/scorched_core/entities/test_enemy_kind.py
    - tests/scorched_core/game/test_game.py

key-decisions:
  - "Missile life is stored as steps flown and packed as life / 90 (elapsed fraction), so plan 02-23 can fade trails with it directly"
  - "Re-acquisition triggers on the 8-step timer, or at once only when a target uid existed and is gone; a missile with no target waits for its timer, so an empty or off-screen field costs no per-step scans"
  - "Launch angles are ordered middle-outwards so a volley that does not fit in the pool keeps its central missiles"
  - "Missile damage uses the loadout level at resolve time (HOMING_DAMAGE[level - 1]), including for missiles still in flight after a weapon switch"

patterns-established:
  - "Pool columns for entity-following: target uid (0 means none, since enemy uids start at 1) plus a countdown column for periodic re-acquisition"

requirements-completed: [PLYR-04, PLYR-05]

coverage:
  - id: D1
    description: "Purple launches 1 to 5 missiles per volley in a centred 22 degree fan at the per-level intervals, with one low SHOT event per non-empty volley and no forward main shot"
    requirement: PLYR-05
    verification:
      - kind: unit
        ref: "tests/scorched_core/weapons/test_homing_launcher.py#test_every_level_launches_its_count_and_waits_its_interval"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/weapons/test_homing_launcher.py#test_a_level_five_volley_fans_out_at_zero_and_plus_minus_22_and_44_degrees"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_a_laser_or_homing_loadout_fires_no_bolts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Missiles steer with a 5 degree per step turn limit, wrapping the short way across plus or minus pi, and move 4.5 units per step along their heading"
    requirement: PLYR-04
    verification:
      - kind: unit
        ref: "tests/scorched_core/pools/test_missile_pool.py#test_turn_rate_limits_a_missile_to_five_degrees_per_step_until_aligned"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/pools/test_missile_pool.py#test_the_turn_wraps_the_short_way_across_plus_minus_pi"
        status: pass
    human_judgment: false
  - id: D3
    description: "Targets are tracked by uid through swap-removes; re-acquisition is every 8 steps or when the target is gone, live on-screen only, ties to the lower index, straight flight with no target"
    requirement: PLYR-04
    verification:
      - kind: unit
        ref: "tests/scorched_core/pools/test_missile_pool.py#test_a_missile_follows_its_target_by_uid_through_a_swap_remove"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/pools/test_missile_pool.py#test_a_tie_in_distance_goes_to_the_lower_pool_index"
        status: pass
    human_judgment: false
  - id: D4
    description: "Missiles hit through the shared grid pass at radius 2.5, are consumed on their first live enemy, and the largest enemy radius plus the missile radius fits one grid cell"
    requirement: PLYR-04
    verification:
      - kind: unit
        ref: "tests/scorched_core/collision/test_circle_hits.py#test_a_missile_hits_at_its_own_radius_and_is_consumed"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/entities/test_enemy_kind.py#test_every_enemy_plus_a_missile_fits_in_one_grid_cell"
        status: pass
    human_judgment: false
  - id: D5
    description: "The missiles channel (stride 4, cap 48) and MISSILE_N header slot 19 cross the boundary with finite values; make perf stays under 3 ms"
    requirement: PLYR-04
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_manifest_contract"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/pools/test_missile_pool.py#test_pack_into_is_finite_for_every_live_missile_after_a_chase"
        status: pass
      - kind: other
        ref: "npm run perf (avg_ms 0.579, budget_ms 3)"
        status: pass
    human_judgment: false
  - id: D6
    description: "How the homing missiles feel and look in play"
    verification: []
    human_judgment: true
    rationale: "Missiles are invisible in the browser until plan 02-23 draws them; turn rate and fan spread feel can only be judged by playing once they are rendered"

duration: 14 min
completed: 2026-10-18
status: complete
---

# Phase 2 Plan 13: Homing Missiles Summary

**Purple homing missiles in the Python core: a centred 1 to 5 missile fan per volley, each steering at 5 degrees per step onto a target tracked by stable enemy uid, hitting through the shared grid pass at radius 2.5, and crossing the boundary in a new `missiles` channel.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-10-18T04:28:00Z
- **Completed:** 2026-10-18T04:41:00Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments

- `MissilePool` and `HomingLauncher` implement D-03: purple fires no forward shot, only missiles, and the count per volley grows 1 to 5 with the level; every non-empty volley pushes one low-priority SHOT event with `a = HOMING`.
- Steering is limited to 5 degrees per step with the signed difference wrapped to [-pi, pi], so missiles visibly curve; targets are held by uid and looked up each step via the new `EnemyPool.index_of_uid`, so a swap-remove can never redirect a missile.
- Re-acquisition is deterministic: nearest live on-screen enemy every 8 steps or at once when the target is gone, ties to the lower pool index, straight flight when nothing qualifies.
- `resolve_shots_vs_enemies` takes a keyword `radius`, so missiles use the same grid broadphase and first-in-query-order rule as bolts; the invariant "largest enemy radius plus missile radius fits one grid cell" is under test.
- Game wiring: `missiles`/`homing` steppers, the `missiles` channel (stride 4, cap 48) and header slot `MISSILE_N = 19` in the manifest, packed when steps run. A native 1200-tick level-5 homing run with a 500-bullet storm averages 0.24 ms per tick; `npm run perf` (Pyodide) stays at 0.58 ms against the 3 ms budget.

## Task Commits

1. **Task 1: Tracer, held fire launches a missile that curves onto the nearest enemy and damages it** - `d753229` (feat)
2. **Task 2: Missiles track by uid through swap-removes, re-acquire deterministically, expire, fan out wider** - `5c2ab2f` (feat)

**Plan metadata:** recorded in the docs commit that follows this summary.

## Files Created/Modified

- `src/scorched_core/pools/missile_pool.py` - MissilePool: uid targeting, steering, lifetime, cull, pack
- `src/scorched_core/weapons/homing_launcher.py` - HomingLauncher: per-level fan and interval tables
- `src/scorched_core/pools/enemy_pool.py` - `index_of_uid`
- `src/scorched_core/collision/circle_hits.py` - `radius` keyword on the shot pass
- `src/scorched_core/protocol.py`, `src/scorched_core/tuning.py` - slot 19, channel constants, homing tuning
- `src/scorched_core/game/game.py` - wiring, manifest channel and header slot
- `tests/...` - missile pool, launcher, uid lookup, radius pass, grid-cell invariant and Game tests (678 pass, 100% line and branch)

## Decisions Made

See key-decisions in the frontmatter: life packed as elapsed fraction, re-acquisition only on timer or lost target, central-first launch order, damage from the loadout level at resolve time.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Added `HOMING_MUZZLE_AHEAD` and a nearest-slot helper shared by launcher and pool**
- **Found during:** Task 1
- **Issue:** The plan states the launch point as `(x, y - 4)` and a launcher pre-target but lists no constant for the muzzle offset; an inline literal would violate the tuning-constants convention. The launcher and the pool also needed the same on-screen/live/nearest rule.
- **Fix:** Added `HOMING_MUZZLE_AHEAD = 4.0` to tuning; `MissilePool.nearest_uid` (backed by a private `_nearest` slot scan) is used by both the launcher pre-target and re-acquisition.
- **Files modified:** `src/scorched_core/tuning.py`, `src/scorched_core/pools/missile_pool.py`, `src/scorched_core/weapons/homing_launcher.py`
- **Verification:** launcher and pool tests; pre-target test uses the same rule
- **Committed in:** d753229, 5c2ab2f

---

**Total deviations:** 1 auto-fixed (1 missing-critical convention)
**Impact on plan:** None on behaviour; the extra constant only names the plan's literal 4.

## Issues Encountered

None. The first Task 1 draft of two wrap tests had wrong expected angles (a test arithmetic slip, not a code bug); they were corrected against the geometry before the commit.

## Known Stubs

None. Missiles are simulated and packed but not drawn until plan 02-23, which is the documented intermediate state in the plan's edge probe.

## Self-Check: PASSED

- Created files exist (missile_pool.py, homing_launcher.py, both test files): FOUND
- Commits `d753229` and `5c2ab2f` are ancestors of HEAD: FOUND
- `make lint test build` green; `uv run pytest --cov --cov-branch --cov-fail-under=100` 678 passed, 100%; `npm test` 616 passed; `npm run perf` avg 0.579 ms; Playwright weapons and shooting specs 6 passed
- Acceptance criteria: `index_of_uid` in missile_pool.py, `H_MISSILE_N: Final = 19` in protocol.py, tests with `turn_rate`, `uid` and `wrap` in their names pass

## Next Phase Readiness

- Plan 02-23 can render the `missiles` channel (x, y, heading angle, elapsed life fraction) and add homing to the per-weapon perf sweep.
- The full `make check` e2e suite was not run in this plan; only the weapons and shooting specs named by the plan were.

---
*Phase: 02-arcade-shooting-feel*
*Completed: 2026-10-18*
