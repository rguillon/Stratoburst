---
phase: 02-arcade-shooting-feel
plan: 03
subsystem: simulation-core
tags: [python, enemy-pool, gallery-spawner, struct-of-arrays, grid-broadphase, tracer]

requires:
  - phase: 02-arcade-shooting-feel
    provides: "EventRing, EV_EXPLOSION / EV_HIT, BLAST_* classes and the events channel (plan 02-01)"
provides:
  - "EnemyKind IntEnum (JET, HELI, CARRIER, TANK, TURRET) and per-kind tuning tables (radius, HP, blast class, ground flag)"
  - "EnemyPool: struct-of-arrays enemies with stable uid, sway step, merged HIT events, EXPLOSION on death, kill buffer, stride-8 pack"
  - "GallerySpawner: deterministic, endlessly looping spawn script in stages/"
  - "resolve_shots_vs_enemies over a grid the caller rebuilds once per step"
  - "Game wiring: gallery -> enemies -> grid -> hits -> remove_dead; manifest key enemy_kinds"
affects: [02-04, 02-05, 02-06, 02-07, 02-08, 02-12]

actuals:
  tokens: 20000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Per-kind data tuples indexed by EnemyKind value; no kind branches in code"
    - "The caller rebuilds the broadphase grid once per step; resolve passes only query it"
    - "Dead enemies stay in the pool (absorbing no bolts) until one remove_dead after every damage pass"
    - "Temporary wire names: header DRONE_N / DRONES_DOWN and channel drones now carry enemies and kills (renamed in 02-04)"

key-files:
  created:
    - src/scorched_core/entities/enemy_kind.py
    - src/scorched_core/pools/enemy_pool.py
    - src/scorched_core/stages/gallery_spawner.py
    - tests/scorched_core/entities/test_enemy_kind.py
    - tests/scorched_core/pools/test_enemy_pool.py
    - tests/scorched_core/stages/test_gallery_spawner.py
  modified:
    - src/scorched_core/protocol.py
    - src/scorched_core/tuning.py
    - src/scorched_core/collision/circle_hits.py
    - src/scorched_core/game/game.py
    - tests/scorched_core/collision/test_circle_hits.py
    - tests/scorched_core/game/test_game.py
  deleted:
    - src/scorched_core/entities/drone_swarm.py
    - tests/scorched_core/entities/test_drone_swarm.py

key-decisions:
  - "A killing blow still pushes no HIT event (plan 02-01 decision): apply_hit subtracts damage first and pushes the low-priority HIT only for a resting enemy that survives, so a kill is exactly one event"
  - "The gallery has no RNG: seed no longer influences enemy positions, so determinism is asserted as same inputs give byte-identical buffers (and seed 11 equals seed 12 until the storm)"
  - "tuning.py imports EnemyKind to build GALLERY_SCRIPT; enemy_kind.py imports nothing, so there is no cycle and tuning stays constants-only"

patterns-established:
  - "Spawn script entries are (tick, kind, x, y, vx, vy, drop) tuples sorted by tick; an entry the pool refuses is skipped, never queued"

requirements-completed: [ENMY-08]

coverage:
  - id: D1
    description: "Scripted gallery jets replace the Phase 1 drones; DroneSwarm and resolve_shots_vs_drones are deleted"
    requirement: ENMY-08
    verification:
      - kind: unit
        ref: "tests/scorched_core/stages/test_gallery_spawner.py#test_the_first_jet_spawns_on_tick_thirty_nine_above_the_top_edge"
        status: pass
      - kind: e2e
        ref: "npx playwright test tools/e2e/shooting.spec.js (drones appear and can be shot down)"
        status: pass
    human_judgment: false
  - id: D2
    description: "EnemyPool: capped at 40 alive, stable never-reused uids, sway motion, leavers removed silently"
    requirement: ENMY-08
    verification:
      - kind: unit
        ref: "tests/scorched_core/pools/test_enemy_pool.py#test_the_forty_first_live_spawn_is_refused"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_live_enemies_never_exceed_the_alive_cap_over_two_thousand_steps"
        status: pass
    human_judgment: false
  - id: D3
    description: "Per-kind data tables and the grid-cell invariant (max radius + bolt radius <= GRID_CELL)"
    requirement: ENMY-08
    verification:
      - kind: unit
        ref: "tests/scorched_core/entities/test_enemy_kind.py#test_every_enemy_plus_a_player_bolt_fits_in_one_grid_cell"
        status: pass
    human_judgment: false
  - id: D4
    description: "Hit and kill edges: one HIT per flash window, one EXPLOSION per kill (class, ground flag, kind), overkill is one kill, dead enemies absorb no bolt"
    requirement: ENMY-08
    verification:
      - kind: unit
        ref: "tests/scorched_core/pools/test_enemy_pool.py#test_overkill_in_one_step_still_yields_one_explosion_and_one_kill"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_overkill_two_bolts_on_one_enemy_give_one_explosion_and_one_kill"
        status: pass
    human_judgment: false
  - id: D5
    description: "The gallery is deterministic and a scripted pilot reaches 3 kills inside 1200 steps"
    requirement: ENMY-08
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_the_same_seed_and_inputs_give_byte_identical_buffers_determinism"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_scripted_kill_ship_tracking_the_lowest_enemy_downs_three_within_1200_ticks"
        status: pass
    human_judgment: false
  - id: D6
    description: "Browser build still plays and the Python tick stays inside the budget (make perf 0.57 to 0.60 ms average against 3 ms)"
    verification:
      - kind: e2e
        ref: "make check (39 Playwright specs incl. shooting, stress, debug)"
        status: pass
      - kind: other
        ref: "npm run perf -> avg_ms 0.5686 / 0.6022, budget_ms 3"
        status: pass
    human_judgment: false

duration: 11min
completed: 2026-10-18
status: complete
plan_head_before: e8972532246cbec024cfda21116a694e896093a3
plan_head_after: 09f319f19c984f8d7caba3bbb7bcc8cc5303758a
commits: 2
---

# Phase 2 Plan 03: Gallery Enemy Pool Summary

**Looping scripted gallery jets from a struct-of-arrays EnemyPool with per-kind data tables replace the Phase 1 drones; bolts hit them through the grid broadphase and kills push class-sized EXPLOSION events carrying ground flag and kind.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-10-18T03:05:00Z (approximate)
- **Completed:** 2026-10-18T03:16:00Z
- **Tasks:** 2
- **Files modified:** 14 (6 created, 6 modified, 2 deleted)

## Accomplishments

- `EnemyKind` (JET, HELI, CARRIER, TANK, TURRET) and the `ENEMY_*` tuning tuples: radius 9 / 10 / 14 / 11 / 10, HP 3 / 6 / 12 / 8 / 6, blast SMALL / MEDIUM / MEDIUM / LARGE / MEDIUM, ground flag for TANK and TURRET. A test pins `max(ENEMY_RADIUS) + PBULLET_RADIUS <= GRID_CELL`, so the 3x3 query stays sufficient.
- `EnemyPool` with 15 enemy columns plus a per-step kill buffer (`kill_x/y/kind/drop`, `kill_n`), a strictly increasing never-reused `uid`, swap-remove of every column, a refusal at 40 alive (capacity 48), no allocation in step, hit, removal or pack.
- `GallerySpawner` replays a sorted `(tick, kind, x, y, vx, vy, drop)` script, ten jets 40 ticks apart (the Phase 1 cadence), wrapping at 400 ticks.
- `resolve_shots_vs_enemies(bullets, enemies, grid, scratch, damage, events)` uses each enemy's own radius, queries a grid the caller rebuilt, and never removes dead enemies; `Game._step` runs gallery, enemy step, one grid rebuild, hit pass, then one `remove_dead`.
- The wire names stay `DRONE_N` / `DRONES_DOWN` and channel `drones` (stride 8, cap 48) so the Phase 1 renderer still draws gallery jets; the manifest gains `enemy_kinds`.
- `DroneSwarm`, its test and `resolve_shots_vs_drones` are deleted (D-20).

## Task Commits

1. **Task 1: Tracer: scripted gallery jets replace the drones** - `5e1c695` (feat). The tracer's own verify (ruff, pytest at 100%, vitest, perf, build, shooting + stress + debug e2e) was re-run and passed before expansion: "Tracer verified end-to-end - expanding".
2. **Task 2: Kind tables, grid-cell invariant, merged hits and determinism locked down by tests** - `09f319f` (test). The behaviors were already implemented by the tracer, so these tests passed on first run (characterization, no RED commit). To prove they can fail, two mutations were applied and reverted: allowing spawns up to `ENEMY_CAP` failed the flooded-gallery test, and disabling `remove_dead` failed 18 tests including the overkill and removed-once tests. No production code changed in Task 2.

**Plan metadata:** committed separately (docs: complete plan)

## Files Created/Modified

- `src/scorched_core/entities/enemy_kind.py` - the roster IntEnum
- `src/scorched_core/pools/enemy_pool.py` - EnemyPool
- `src/scorched_core/stages/gallery_spawner.py` - GallerySpawner and the `ScriptEntry` alias
- `src/scorched_core/collision/circle_hits.py` - `resolve_shots_vs_enemies` replaces the drone pass
- `src/scorched_core/game/game.py` - enemies, gallery, grid wiring, `enemy_kinds` manifest key
- `src/scorched_core/protocol.py` - `H_ENEMY_N = 8`, `H_KILLS = 11`, `ENEMY_STRIDE = 8`, `ENEMY_CAP = 48`
- `src/scorched_core/tuning.py` - `DRONE_*` removed; `ENEMY_*`, `GALLERY_*` added
- Tests mirror each module; `test_circle_hits.py` and `test_game.py` ported from the drone scenarios

## Decisions Made

- `apply_hit` subtracts first and pushes the low-priority HIT only for a resting enemy that survives. This keeps the 02-01 decision that a kill is exactly one event; the plan's action text listed push-then-subtract, but the truth statement and the existing Game test (`EVENT_N == 1` on a kill) require this order.
- Because the gallery is scripted, the seed no longer affects enemy placement. The determinism test asserts identical buffers for identical inputs and differing buffers for a different pilot.
- `ScriptEntry` is a PEP 695 `type` alias in `gallery_spawner.py`; the one-class-per-file convention only counts classes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Determinism test expected seed to change a seedless gallery**
- **Found during:** Task 1 (first full pytest run)
- **Issue:** The ported Phase 1 test asserted `run(11) != run(12)`, which only held while drones used the seeded RNG.
- **Fix:** Asserted equal buffers across seeds for the scripted gallery and unequal buffers for a different pilot.
- **Files modified:** `tests/scorched_core/game/test_game.py`
- **Committed in:** `5e1c695`

**2. [Rule 1 - Bug] Float32 comparison of the spawned vy**
- **Found during:** Task 1
- **Issue:** `vy` of 0.9 stored in an `array('f')` reads back as 0.8999999761581421.
- **Fix:** `pytest.approx` in the spawner test.
- **Files modified:** `tests/scorched_core/stages/test_gallery_spawner.py`
- **Committed in:** `5e1c695`

---

**Total deviations:** 2 auto-fixed (2 test-expectation bugs). **Impact on plan:** none on scope; both were test-side.

## Issues Encountered

None in production code. The stale wording "drone" remains in comments of `tools/perf_node.mjs` and `tools/e2e/shooting.spec.js` and in the Phase 1 JS renderer names; the plan keeps those until 02-04.

## Known Stubs

None. `aux` and the spare pack slot are always 0 by design (reserved for plan 02-05's motion data); not UI-facing.

## Threat Flags

None. T-02-05 is mitigated: `ENEMY_MAX_ALIVE` 40 inside preallocated 48-slot columns, refused spawns, grid capacity `ENEMY_CAP`, and a 2000-step test asserts the cap. T-02-SC: no packages added, lockfiles unchanged.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02-04 can render per-kind enemies and rename `DRONE_N`, `DRONES_DOWN`, channel `drones` together with their JS readers; the `enemy_kinds` manifest map is in place.
- Plan 02-05 adds the `motion` column and `match`, and the full roster to `GALLERY_SCRIPT`.
- `make check` is green (ruff, pytest 424 passed at 100% line and branch, vitest 404, build, 39 e2e). `npm run perf`: avg 0.57 to 0.60 ms per tick against the 3 ms budget.

---
*Phase: 02-arcade-shooting-feel*
*Completed: 2026-10-18*

## Self-Check: PASSED

- FOUND: src/scorched_core/entities/enemy_kind.py, src/scorched_core/pools/enemy_pool.py, src/scorched_core/stages/gallery_spawner.py, tests/scorched_core/pools/test_enemy_pool.py, tests/scorched_core/stages/test_gallery_spawner.py, tests/scorched_core/entities/test_enemy_kind.py
- MISSING (intended): src/scorched_core/entities/drone_swarm.py
- FOUND commits: 5e1c695, 09f319f
- Acceptance: `H_ENEMY_N: Final = 8` and `H_KILLS: Final = 11` match in protocol.py; tests named `determinis`, `scripted_kill`, `overkill` pass
