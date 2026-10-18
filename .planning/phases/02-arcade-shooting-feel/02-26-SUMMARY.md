---
phase: 02-arcade-shooting-feel
plan: 26
subsystem: bomb-fx-and-deathbomb
tags: [three.js, bloom, particles, deathbomb, pickups, python, pytest]

requires:
  - phase: 02-arcade-shooting-feel
    provides: "02-22 bomb core and header BOMB_* slots, 02-25 death and respawn, 02-19 light pool, 02-14 scorch decals, 02-08 PickupKind.BOMB and PickupOutcome.STOCKED"
provides:
  - "createBombFx: rising missile, HDR dome fireball at the Python radius, detonation burst, one light, one scorch, one bloom pulse"
  - "PlayerLife.try_deathbomb and the deathbomb resolution before life.step (DEATHBOMB_SAVE event)"
  - "Bomb pickups dropped by both gallery AA turrets (STOCKED, clamped to 7) and the respawn restock to at least 3"
  - "Game(bombs=) starting stock clamped to 0..7"
affects: [02-27-bomb-readout-and-flag, 02-28-hitstop-and-shake, phase-3-stage-timeline]

actuals:
  tokens: 12000
  tasks: 2
  commits: 3
plan_head_before: 4ee3f807c3f39162f342ef4b8d110484728cab61
plan_head_after: cdae681bed178c373e1cd6d9a0039cf71093ff95

tech-stack:
  added: []
  patterns:
    - "Fire-and-forget fx module fed by header slots plus one event handler (bombFx.update every frame, handle on BOMB_DETONATE)"
    - "Single decaying bloom pulse: strength set to 2.2x base at the event, linear decay, never touched otherwise"
    - "Press resolved before the call that expires the window (deathbomb ordering)"

key-files:
  created:
    - web/src/fx/bomb_fx.js
    - web/test/fx/bomb_fx.test.js
  modified:
    - web/src/main.js
    - tools/e2e/bomb.spec.js
    - src/scorched_core/entities/player_life.py
    - src/scorched_core/game/game.py
    - src/scorched_core/tuning.py
    - tests/scorched_core/entities/test_player_life.py
    - tests/scorched_core/game/test_game.py
    - tests/scorched_core/stages/test_gallery_spawner.py

key-decisions:
  - "The deathbomb needs no new ordering code beyond the existing top-of-step bomb resolution: it already runs before life.step, so try_deathbomb after a successful launch makes a press on step k+8 save and k+9 not"
  - "A refused launch (no stock, or a bomb still burning) never saves: try_deathbomb is only called after Bomb.try_launch succeeded"
  - "The fireball is a squashed (0.55 high) additive sphere, front faces only, gain 0.4 with an EMBER rim: the first double-sided full-gain version tone-mapped to a white screen"
  - "fx.shown counts a detonation when its fireball first draws (the transition into BLAST), not when the event arrives"

patterns-established:
  - "Prewarm by showAll(true) before the second rig.prewarm and showAll(false) after the tier-detail render loop, like the beam and the missiles"
  - "BOMB_DROP_VY lives in tuning.py next to the other pickup constants"

requirements-completed: [PLYR-07, PLYR-08, PLYR-09, VISL-02]

coverage:
  - id: D1
    description: "Bomb showcase: glowing missile, expanding HDR fireball at the Python radius, tier-scaled burst, one light, one scorch, single bloom pulse"
    requirement: VISL-02
    verification:
      - kind: unit
        ref: "web/test/fx/bomb_fx.test.js#createBombFx"
        status: pass
      - kind: e2e
        ref: "tools/e2e/bomb.spec.js#a detonation is displayed as a fireball and costs no error"
        status: pass
    human_judgment: true
    rationale: "How the fireball and bloom look and feel (no strobing, colour, size) is a visual judgment"
  - id: D2
    description: "Deathbomb inside the 8-step grace window (last grace step saves, one step later does not, zero-step latch saves, no stock does not)"
    requirement: PLYR-08
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_deathbomb_last_grace_step_still_saves_the_ship"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_deathbomb_one_step_late_the_ship_is_destroyed"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/entities/test_player_life.py#test_a_deathbomb_in_grace_cancels_the_death_and_returns_to_alive"
        status: pass
    human_judgment: false
  - id: D3
    description: "AA turrets drop bomb pickups; catching one stocks a bomb (7 stays 7) and pushes PICKUP/STOCKED"
    requirement: PLYR-09
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_stocked_a_bomb_pickup_at_seven_is_consumed_without_raising_the_stock"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/stages/test_gallery_spawner.py#test_both_aa_turret_entries_carry_a_bomb_drop"
        status: pass
      - kind: e2e
        ref: "tools/e2e/bomb.spec.js#a shot-down AA turret drops a bomb pickup"
        status: pass
    human_judgment: false
  - id: D4
    description: "Respawn restocks to at least 3 and Game(bombs=) starts with a stock clamped to 0..7"
    requirement: PLYR-07
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_refill_the_stock_becomes_at_least_three_when_the_ship_respawns"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_bombs_sets_the_starting_stock_clamped_to_zero_through_seven"
        status: pass
    human_judgment: false

duration: 14min
completed: 2026-10-18
status: complete
---

# Phase 2 Plan 26: Bomb showcase, deathbomb and bomb pickups Summary

**A glowing missile and screen-filling HDR fireball with one burst, light, scorch and bloom pulse, a last-moment bomb that cancels a death inside the 8-step grace window, AA-turret bomb pickups, and a restock to three on every new life.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-10-18T06:46:15Z
- **Completed:** 2026-10-18T06:59:53Z
- **Tasks:** 2 (tracer + TDD auto)
- **Files modified:** 10

## Accomplishments
- `createBombFx` draws the missile (LAUNCH) and a squashed additive HDR dome at exactly the Python radius (BLAST) with a fade over the last 20%. The detonation event emits 60 fire, 30 smoke and 40 sparks (counts scale by tier, sizes never), flashes one large light, adds one 60-unit scorch and raises bloom to 2.2x then decays it in 0.3 s without ever rising again. Fire licks every 50 ms and an exhaust trail round it off. All colours come from PALETTE, none pink.
- Deathbomb: `PlayerLife.try_deathbomb()` cancels GRACE; `Game._step` resolves the press before `life.step`, so a press on step k+8 still saves and k+9 does not, and a press latched on a zero-step frame inside the window still saves. It pushes `DEATHBOMB_SAVE`, spends a bomb and grants the bomb invulnerability.
- Both gallery TURRET entries drop a BOMB pickup (falling 0.5 per step); catching one adds a bomb up to 7 and pushes PICKUP with STOCKED (consumed even at 7).
- The stock becomes `max(stock, 3)` on DYING to RESPAWN; `Game(bombs=)` starts with any stock clamped to 0..7.
- Perf unchanged (vulcan 0.69 ms, laser 0.55 ms, homing 0.64 ms average, budget 3 ms).

## Task Commits

1. **Task 1: Tracer, bomb fireball, burst, light, scorch, bloom pulse** - `a9713b7` (feat)
2. **Task 2: Deathbomb, bomb pickups, respawn refill, Game(bombs=)** - `218f236` (test, RED) and `cdae681` (feat, GREEN)

**Plan metadata:** the docs commit that follows this SUMMARY.

## Files Created/Modified
- `web/src/fx/bomb_fx.js` - missile, fireball, burst, light, scorch, single bloom pulse, licks, exhaust
- `web/test/fx/bomb_fx.test.js` - 32 tests: phases, radius formula, fade, burst counts and sizes, single pulse, no strobe, no allocation
- `web/src/main.js` - creates and wires the bomb fx (group in scene before the second prewarm, dispatcher handler, per-frame update), debug hooks `fx.bombsShown` and `fx.bombPickups`
- `tools/e2e/bomb.spec.js` - detonation displayed, turret drops a bomb pickup
- `src/scorched_core/entities/player_life.py` - `try_deathbomb`
- `src/scorched_core/game/game.py` - deathbomb resolution, BOMB drops and STOCKED catch, respawn refill, `bombs=`
- `src/scorched_core/tuning.py` - turret BOMB drops in `GALLERY_SCRIPT`, `BOMB_DROP_VY`
- `tests/...` - player life, game and gallery spawner tests

## Decisions Made
See key-decisions. Followed the plan; the notable choice is that the plan's "resolve before life.step" ordering was already in place from 02-22, so the deathbomb is a one-call extension of that block.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The first fireball tone-mapped to a flat white screen**
- **Found during:** Task 1 (screenshot of the detonation under software GL)
- **Issue:** Double-sided additive sphere at full HDR gain stacked to white, hiding the whole field
- **Fix:** Front faces only, GAIN 0.4, EMBER rim, lower alpha; the dome now reads as orange fire over the terrain
- **Files modified:** web/src/fx/bomb_fx.js
- **Committed in:** a9713b7

**2. [Rule 3 - Blocking] Existing invariant test contradicted turret bomb drops**
- **Found during:** Task 2 (full pytest after GREEN)
- **Issue:** `test_both_carriers_carry_a_crystal_and_nothing_else_drops_anything` required every non-carrier drop to be -1
- **Fix:** Extended it to allow the turret BOMB drops (the plan asks to extend the script invariant test)
- **Files modified:** tests/scorched_core/stages/test_gallery_spawner.py
- **Committed in:** cdae681

**3. [Rule 2 - Missing critical] Debug hook to prove the turret drop is a bomb**
- **Found during:** Task 2 (e2e)
- **Issue:** `PICKUP_N >= 1` alone cannot tell a turret's bomb from a carrier's crystal, and a swept ship catches the pickup within frames
- **Fix:** Added the debug-only `fx.bombPickups` hook and a page-side frame recorder in the e2e; the spec still asserts `PICKUP_N >= 1`
- **Files modified:** web/src/main.js, tools/e2e/bomb.spec.js
- **Committed in:** cdae681

---

**Total deviations:** 3 auto-fixed (1 bug, 1 blocking, 1 missing critical)
**Impact on plan:** All needed for correctness or to make the planned assertions meaningful. No scope creep.

## Issues Encountered
- The chunk-size warning from `vite build` is pre-existing.
- Small additions beyond the plan text: `showAll` prewarm on the fx, `BOMB_DROP_VY` constant, `_drop_crystals` renamed `_drop_pickups`.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- 02-27 can show the stock readout and add the `?bombs` flag (Python and `Game(bombs=)` are ready; main.js already spreads parsed flags).
- 02-28 can add hitstop and shake; the bomb fx exposes nothing it needs to change.
- Human check at phase end: the look of the fireball and the single bloom pulse (no strobing) on a real GPU, and the deathbomb feel when mortal.

## Self-Check: PASSED

All created files exist and the three task commits are on HEAD; `make check` (ruff, pytest 100% line+branch, vitest, build, 60 Playwright specs) passed before this commit.

---
*Phase: 02-arcade-shooting-feel*
*Completed: 2026-10-18*
