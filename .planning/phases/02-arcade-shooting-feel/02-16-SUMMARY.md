---
phase: 02-arcade-shooting-feel
plan: 16
subsystem: simulation
tags: [bullet-pool, stress-storm, render-channel, protocol, pytest, playwright]

requires:
  - phase: 02-arcade-shooting-feel
    provides: "BulletPool with angle column (02-11), missile pool and header slots up to 20 (02-13), Game facade and ebullets channel (Phase 1)"
provides:
  - "BulletPool.pack_into(out, kind, offset=0): writes from instance offset, earlier slots untouched"
  - "Game.storm_pool: the harmless ?stress load (clamped capacity 600..5000), used only by BulletStorm and storm_hits"
  - "Game.ebullets: the gameplay enemy bullet pool, capacity EBULLET_GAME_CAP 200, integrated and culled 16 units outside the playfield every step"
  - "One ebullets render channel (storm first, gameplay right after) with capacity storm cap + 200; EBULLET_N is the sum of both counts"
  - "Header slot H_STORM_N = 21 reports the storm alone; stress e2e reads STORM_N"
affects: [02-18 enemy fire spawns into Game.ebullets, 02-20 makes Game.ebullets lethal, 02-22 bomb clears Game.ebullets only]

actuals:
  tokens: 2400
  tasks: 2
  commits: 3
plan_head_before: 4f4fad688949b509c4389fe0bd74c54779411d70
plan_head_after: 11144a049c75f8f96454fdaae9e72e4cbea64c66
commits: 3

tech-stack:
  added: []
  patterns:
    - "Two pools, one instanced channel: the lower pool packs at offset 0 and the next at offset = previous.n, so JS keeps a single draw call"
    - "Harmless load kept out of gameplay by construction: lethal-hit, bomb and spawner code only ever receive the gameplay pool"

key-files:
  created: []
  modified:
    - src/scorched_core/pools/bullet_pool.py
    - src/scorched_core/protocol.py
    - src/scorched_core/game/game.py
    - tests/scorched_core/pools/test_bullet_pool.py
    - tests/scorched_core/game/test_game.py
    - tests/scorched_web/test_entrypoint.py
    - tools/e2e/stress.spec.js

key-decisions:
  - "ebullet_cap keeps meaning the storm capacity; the channel capacity (storm cap + 200) is held once in a private _ebullet_channel_cap slot and used by both the buffer and the manifest"
  - "The gameplay pass integrates and culls ebullets in _step beside the player bolts; the storm keeps its own bounce step, so the two never share a loop"
  - "No JS change was needed: main.js already sizes the instanced mesh from manifest.channels.ebullets.cap and draws header EBULLET_N instances"

patterns-established:
  - "Pattern: a test named storm_never_kills asserts the storm only counts hits (storm_hits) and leaves ship, events and the gameplay pool untouched; later plans repeat it"

requirements-completed: [VISL-05, PLYR-07]

coverage:
  - id: D1
    description: "The ?stress storm runs in its own pool; the header reports the storm alone as STORM_N (500, 1 and 0 stay exact) while EBULLET_N is the storm plus gameplay bullets"
    requirement: VISL-05
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_stress_spawns_the_clamped_bullet_count"
        status: pass
      - kind: e2e
        ref: "tools/e2e/stress.spec.js (STORM_N 500, 0, 1 on the production build)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Storm and gameplay bullets share one ebullets channel, storm first and gameplay at offset storm_pool.n, and a full storm (5000) plus a full gameplay pool (200) still fits"
    requirement: VISL-05
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_a_full_storm_plus_gameplay_bullets_pack_in_order_and_fit_the_channel"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/pools/test_bullet_pool.py#test_pack_into_offset_writes_from_that_instance_and_leaves_earlier_ones_alone"
        status: pass
    human_judgment: false
  - id: D3
    description: "Gameplay bullets move by their velocity every step and are culled 16 units outside the playfield; the storm is never made lethal or moved by that pass (RESEARCH Pitfall 4, enforced by construction)"
    requirement: PLYR-07
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_a_gameplay_bullet_is_culled_16_units_outside_the_playfield"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_storm_never_kills_it_only_counts_and_changes_nothing_else"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-10-18
status: complete
---

# Phase 2 Plan 16: Storm and Gameplay Bullet Pools Summary

**The harmless ?stress storm now lives in its own `storm_pool`, enemy gameplay bullets get a separate 200-bullet `ebullets` pool, both are packed into one instanced render channel (storm first, gameplay at `offset=storm_pool.n`), and header slot STORM_N keeps the Phase 1 stress counts exact.**

## Performance

- **Duration:** 7 min (approximate; start time was not recorded at launch)
- **Completed:** 2026-10-18T05:03Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- RESEARCH Pitfall 4 is closed before any bullet can kill: later plans (02-20 lethal hits, 02-22 bomb clear) only receive `Game.ebullets`, so the performance-gate storm can never hurt the player or be cleared by a bomb (threat T-02-20).
- `BulletPool.pack_into` takes an `offset`, so two pools feed the one `ebullets` channel and the JS side still draws one instanced mesh. The channel capacity is the storm capacity plus 200, so even a 5000 storm with a full gameplay pool cannot overrun.
- `?stress=500` reports STORM_N 500, `?stress=1` reports 1 and no flag reports 0 on the production build, whatever the gameplay pool holds; EBULLET_N is the sum for the renderer.
- The gameplay pool integrates and culls 16 units outside the playfield each step; with nothing spawning into it until 02-18 it stays empty and costs one empty integrate call per step (Python tick still 0.58 ms average, budget 3 ms).

## Task Commits

1. **Task 1: Tracer, stress storm in its own pool, one shared channel, exact STORM_N** - `bb015ac` (feat)
2. **Task 2 RED: failing tests for gameplay integrate and cull and full-storm packing** - `c5d3a96` (test)
3. **Task 2 GREEN: gameplay enemy bullets integrate and cull on their own** - `11144a0` (feat)

**Plan metadata:** the docs commit that adds this SUMMARY, STATE.md and ROADMAP.md.

_Task 2 is TDD. RED evidence: 5 target tests failed on their assertions (gameplay bullet not moved, not culled in four directions) while the other 134 game tests passed, so the failures were real assertion failures. The packing, `storm_never_kills` and zero-step tests passed already because Task 1 had wired the pools and header; they were still added in Task 2 as the plan specifies._

## Files Created/Modified

- `src/scorched_core/pools/bullet_pool.py` - `pack_into(out, kind, offset=0)`
- `src/scorched_core/protocol.py` - `H_STORM_N = 21`, `EBULLET_GAME_CAP = 200`
- `src/scorched_core/game/game.py` - `storm_pool`, gameplay `ebullets`, channel capacity, header STORM_N, gameplay integrate and cull in `_step`
- `tests/scorched_core/pools/test_bullet_pool.py`, `tests/scorched_core/game/test_game.py`, `tests/scorched_web/test_entrypoint.py` - offset, packing, cull, `storm_never_kills`, manifest capacities (800 default and stress 100, 950 for stress 750), 20 header slots
- `tools/e2e/stress.spec.js` - exact counts read STORM_N

## Decisions Made

See `key-decisions` in the frontmatter. No JavaScript source change was needed: the renderer already sizes from the manifest channel capacity and draws EBULLET_N instances.

## Deviations from Plan

None - plan executed exactly as written. (The guard script was run before the first commit; the first source edits were made with a short Python script via Bash, which the auto-mode instructions allow, after confirming the pinned root.)

## Issues Encountered

None. Two lines exceeded ruff's 100-column limit after the rename and were wrapped; the channel capacity is held once in `_ebullet_channel_cap` to avoid repeating the sum.

## Known Stubs

None. The gameplay `ebullets` pool is intentionally empty until plan 02-18 spawns enemy fire into it, as the plan states.

## Threat Flags

None - Python-only simulation and test changes, no new endpoints, auth paths or packages.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 02-18: spawn enemy fire into `game.ebullets`; it integrates and culls already and is packed after the storm.
- Ready for 02-20 and 02-22: pass only `game.ebullets` (never `storm_pool`) to the lethal-hit and bomb-clear code.
- No blockers. `make check` (lint, 729 Python tests at 100% line and branch coverage, 649 vitest tests, build, 44 e2e) passes; `make perf` avg 0.58 ms.

## Self-Check: PASSED

- Modified files exist on disk; commits `bb015ac`, `c5d3a96` and `11144a0` are ancestors of HEAD; measured commit count since the plan base is 3.
- Acceptance greps match: `H_STORM_N: Final = 21`, `EBULLET_GAME_CAP: Final = 200`, `STORM_N` in `tools/e2e/stress.spec.js`; tests named `storm_never_kills` and `offset` pass.

---
*Phase: 02-arcade-shooting-feel*
*Completed: 2026-10-18*
