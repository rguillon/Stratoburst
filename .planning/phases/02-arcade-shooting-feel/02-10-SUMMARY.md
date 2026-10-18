---
phase: 02-arcade-shooting-feel
plan: 10
subsystem: simulation
tags: [pickups, crystal, collision, protocol, weapons]

requires:
  - phase: 02-arcade-shooting-feel
    provides: "WeaponLoadout.collect and PickupOutcome (02-08); EnemyPool kill buffer with kill_drop (02-05); GALLERY_SCRIPT drop column (02-03)"
provides:
  - "PickupKind IntEnum (RED, BLUE, PURPLE, CRYSTAL, BOMB)"
  - "PickupPool: SoA crystals and fixed-colour pickups with colour cycle, edge bounce, 600-step life, drift-off and pack"
  - "resolve_pickups_vs_ship(pickups, x, y, collect): ship-body grab circle, each pickup collected once (ship-hit pairs grow here in 02-15)"
  - "Carrier drops: both CARRIER script entries drop a CRYSTAL at the kill position"
  - "PICKUP event (x, y, a = kind, b = outcome, c = colour at the catch); header PICKUP_N (15) and MAX_BONUS (20); pickups channel (stride 4, cap 16); manifest pickup_kinds"
affects: [02-24 crystal drawing and MAX flash, 02-25 fixed-colour recovery pickups, 02-26 bomb pickups, 03 scoring]

actuals:
  tokens: 14000
  tasks: 2
  commits: 2
plan_head_before: a98a90fc8ff93b18d5cabb7ebf4c23990a9608de
plan_head_after: 5dc0d5b6109eca25bc1e3c02dfe4a42f46ce8f0e
commits: 2

tech-stack:
  added: []
  patterns:
    - "pickup colour is decided in Python (colour_at(i)) and packed into the channel, so JS never recomputes the cycle"
    - "the collect callback is bound once in Game.__init__ (self._on_pickup) so no closure is built per step"
    - "swap-remove pools are walked from the highest slot down, so a removal only moves an already-visited item"

key-files:
  created:
    - src/scorched_core/entities/pickup_kind.py
    - src/scorched_core/pools/pickup_pool.py
    - src/scorched_core/collision/ship_hits.py
    - tests/scorched_core/entities/test_pickup_kind.py
    - tests/scorched_core/pools/test_pickup_pool.py
    - tests/scorched_core/collision/test_ship_hits.py
  modified:
    - src/scorched_core/tuning.py
    - src/scorched_core/protocol.py
    - src/scorched_core/game/game.py
    - tests/scorched_core/game/test_game.py
    - tests/scorched_core/stages/test_gallery_spawner.py

key-decisions:
  - "A bouncing pickup reflects when its edge (PICKUP_RADIUS 6) reaches the playfield edge, so a crystal stays fully visible for its whole 600-step life"
  - "After its life a pickup stops bouncing and falls straight down at 0.8 per step; it is removed below PLAYFIELD_H + 16"
  - "A BOMB pickup is not a weapon colour: _collect_pickup has no BOMB path until 02-26 adds STOCKED, and nothing spawns one before then"
  - "MAX bonuses are only counted (game.max_bonus, header slot 20); the score value stays a Phase 3 matter (D-06)"

patterns-established:
  - "Game._step order now ends: remove_dead, drop crystals, pickups.step, resolve_pickups_vs_ship, storm, tick_count"

requirements-completed: [PLYR-04, PLYR-05]

coverage:
  - id: D1
    description: "A destroyed carrier drops a colour-cycling crystal at its kill position; every kill whose drop is CRYSTAL spawns one"
    requirement: PLYR-04
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_a_killed_carrier_drops_one_crystal_at_its_kill_position"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/stages/test_gallery_spawner.py#test_both_carriers_carry_a_crystal_and_nothing_else_drops_anything"
        status: pass
    human_judgment: false
  - id: D2
    description: "The crystal cycles red, blue, purple every 90 steps, bounces for 600 steps, then drifts off the bottom"
    requirement: PLYR-04
    verification:
      - kind: unit
        ref: "tests/scorched_core/pools/test_pickup_pool.py#test_a_crystal_cycles_red_blue_purple_every_ninety_steps_color_cycle"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/pools/test_pickup_pool.py#test_a_crystal_stays_on_screen_while_bouncing_for_its_whole_life_bounce"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/pools/test_pickup_pool.py#test_a_crystal_left_alone_leaves_the_pool_after_its_life_and_the_drift"
        status: pass
    human_judgment: false
  - id: D3
    description: "The ship's body (10-unit grab circle, edge contact counts) catches each pickup exactly once"
    requirement: PLYR-04
    verification:
      - kind: unit
        ref: "tests/scorched_core/collision/test_ship_hits.py"
        status: pass
    human_judgment: false
  - id: D4
    description: "A catch applies the colour rules (raise, switch keeping the level, MAXED) and pushes one PICKUP event; same-colour at Lv5 counts a MAX bonus"
    requirement: PLYR-05
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_scripted_catch_a_red_crystal_from_a_carrier_raises_the_vulcan_one_level"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_a_fifth_same_colour_catch_is_counted_as_a_max_bonus"
        status: pass
    human_judgment: false
  - id: D5
    description: "Header PICKUP_N and MAX_BONUS, the pickups channel and the manifest pickup_kinds cross the boundary; the browser build still boots and plays within the 3 ms budget"
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_manifest_contract"
        status: pass
      - kind: e2e
        ref: "npx playwright test tools/e2e/shooting.spec.js tools/e2e/smoke.spec.js"
        status: pass
      - kind: other
        ref: "npm run perf (avg_ms 0.58, budget 3)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Crystals are not drawn yet (plan 02-24); how the catch feels in play is a later judgement"
    verification: []
    human_judgment: true
    rationale: "This is a simulation-only slice; there is nothing visible to judge until 02-24 draws the crystals"

duration: 4min
completed: 2026-10-18
status: complete
---

# Phase 2 Plan 10: Pickups Summary

**Carrier-dropped, colour-cycling crystals that bounce around the playfield and apply the Raiden colour rules when the ship's body catches them, with a MAX-bonus counter and a pickups channel, all in the Python simulation**

## Performance

- **Duration:** 4 min
- **Started:** 2026-10-18T04:15:34Z
- **Completed:** 2026-10-18T04:19:14Z
- **Tasks:** 2
- **Files modified:** 11 (6 created, 5 modified)

## Accomplishments
- A killed carrier drops a CRYSTAL at its kill position (both carrier entries of `GALLERY_SCRIPT` carry `drop = CRYSTAL`); the pool refuses spawns beyond 16.
- The crystal cycles red, blue, purple every 90 steps, reflects off all four edges for 600 steps, then drifts down and leaves; its colour at the catch decides the weapon and Python packs the same colour for JS.
- `resolve_pickups_vs_ship` catches with the 10-unit body circle (not the 2-unit hitbox), edge contact counts, each pickup exactly once, highest slot first.
- A catch applies `WeaponLoadout.collect` and pushes one PICKUP event (x, y, kind, outcome, colour); a MAXED catch increments `game.max_bonus` (header slot 20) for Phase 3 scoring.
- Boundary: header `PICKUP_N` (15), pickups channel (stride 4, cap 16), manifest `pickup_kinds`; no JS change was needed because the bridge allocates every manifest channel generically.

## Task Commits

1. **Task 1: Tracer: a carrier killed in the simulation drops a crystal, and catching it while red raises the vulcan** - `ccc129c` (feat)
2. **Task 2: Crystals cycle colours, bounce, expire and drift away, the pool stays bounded, MAX bonus counted** - `5dc0d5b` (feat, TDD: the new tests were run and seen failing on their target assertions before the implementation)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## Files Created/Modified
- `src/scorched_core/entities/pickup_kind.py` - PickupKind IntEnum
- `src/scorched_core/pools/pickup_pool.py` - PickupPool (spawn, spawn_crystal, step, color_at, remove_at, pack_into)
- `src/scorched_core/collision/ship_hits.py` - resolve_pickups_vs_ship
- `src/scorched_core/tuning.py` - CRYSTAL_* and PICKUP_* constants, carrier drops in the gallery script
- `src/scorched_core/protocol.py` - H_PICKUP_N, H_MAX_BONUS, PICKUP_STRIDE, PICKUP_CAP
- `src/scorched_core/game/game.py` - pickups pool, drops, catch handling, header, manifest, channel
- `tests/...` - one test module per new source file plus the game and gallery additions

## Decisions Made
See key-decisions above. Edge reflection uses the pickup radius as margin so the crystal never half-leaves the screen.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Allocation-growth test became coverage-sensitive**
- **Found during:** Task 2 (full gate run)
- **Issue:** `test_tick_does_not_grow_allocated_blocks` warmed up 300 ticks, so the first carrier kill, crystal bounce, expiry and drift (new lines first executed under coverage tracing) fell inside the measured window and tipped the 50-block limit (55 under `--cov`). Not a leak: it passed in isolation.
- **Fix:** Warm up through two gallery loops (`2 * GALLERY_LOOP_TICKS`), which is what "warm up pools and caches" means now that a crystal's life spans more than 300 ticks. The limit of 50 is unchanged.
- **Files modified:** tests/scorched_core/game/test_game.py
- **Verification:** full gate green on three consecutive runs
- **Committed in:** 5dc0d5b

**2. [Rule 3 - Blocking] Pool cap implemented in Task 1**
- **Found during:** Task 1
- **Issue:** The plan lists the spawn cap under Task 2, but `spawn` would raise IndexError past the 16 preallocated slots, so the cap is needed for Task 1's pool to be correct.
- **Fix:** Cap check in `spawn` from the start; its test also lives in Task 1.
- **Committed in:** ccc129c

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** No scope change; both keep the 100% coverage gate and the 3 ms budget intact.

## Issues Encountered
- The float32 pickup columns round a one-ulp-past test position back onto the grab-circle edge, so the "just outside" test steps by 0.01 units instead.

## Authentication Gates
None.

## Known Stubs
None. Crystals are intentionally not drawn yet; plan 02-24 renders them and the MAX flash.

## Threat Flags
None. T-02-13 is mitigated: `PICKUP_CAP` 16 refuses extra spawns, pickups leave after 600 steps plus the drift, columns are preallocated and the collect callback is bound once.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Ready for 02-11 and the later pickup consumers: 02-24 draws the crystals from the `pickups` channel and reads `MAX_BONUS`; 02-25 spawns fixed-colour pickups with `PickupPool.spawn`; 02-26 adds the BOMB/STOCKED path in `_collect_pickup`.
- No blockers.

## Self-Check: PASSED
- Created files exist: pickup_kind.py, pickup_pool.py, ship_hits.py and the three new test modules.
- Commits `ccc129c` and `5dc0d5b` are ancestors of HEAD; `git rev-list --count` from the plan base gives 2.
- `uv run ruff check .`, `ruff format --check .`, `pytest --cov --cov-branch --cov-fail-under=100` (568 passed, 100%), `npm test` (551), `npm run perf` (avg 0.58 ms), `npm run build` and the shooting and smoke Playwright specs all pass.

---
*Phase: 02-arcade-shooting-feel*
*Completed: 2026-10-18*
