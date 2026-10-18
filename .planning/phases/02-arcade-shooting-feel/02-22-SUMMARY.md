---
phase: 02-arcade-shooting-feel
plan: 22
subsystem: gameplay
tags: [bomb, nuke, area-damage, invulnerability, input-latch, protocol, e2e]

requires:
  - phase: 02-arcade-shooting-feel
    provides: "PlayerLife.grant_invuln and can_control (02-15, 02-20), separate gameplay ebullets and storm pools (02-16), area_hits.py with the beam pass and EnemyPool.apply_hit (02-21), keyboard bomb keys (01-05)"
provides:
  - "Bomb state machine: stock 3, try_launch, 24-step LAUNCH, 90-step BLAST with radius 20 to 230 over 30 steps, 4 damage every 6 steps"
  - "BombPhase IntEnum (NONE 0, LAUNCH 1, BLAST 2) exported as manifest bomb_phases"
  - "resolve_bomb_vs_enemies and clear_bullets_in_radius in collision/area_hits.py, BulletPool.clear"
  - "Game bomb press latch (_bomb_requested): an edge is never lost on a zero-step or paused frame"
  - "Header slots BOMBS 25, BOMB_PHASE 26, BOMB_X 27, BOMB_Y 28, BOMB_T 29 and manifest tuning bomb_radius_min/max, bomb_grow_ticks, bomb_blast_ticks"
  - "EV_BOMB_LAUNCH and EV_BOMB_DETONATE are now pushed"
affects: [02-26 bomb visuals, deathbomb and bomb pickups, 02-27 stock readout and ?bombs, 02-28 hitstop and shake, 02-24 audio]

actuals:
  tokens: 11600
  tasks: 2
  commits: 2
plan_head_before: fcdec5bc6b32a2466c6975108fb8af102648651f
plan_head_after: a2d9a64bfdcfe08696798ecdabf89c57f971b402
commits: 2

tech-stack:
  added: []
  patterns:
    - "A button edge that gameplay must never miss is latched in tick() and consumed by the next live step, whether or not it takes effect"
    - "Area passes (beam, blast, bullet clear) are plain linear-scan functions in collision/area_hits.py with no grid and no allocation"
    - "A multi-phase weapon is a slots dataclass with a match on an IntEnum phase and a loud unknown arm, stepped before remove_dead so its kills join the normal kill pass"

key-files:
  created:
    - src/scorched_core/weapons/bomb.py
    - src/scorched_core/weapons/bomb_phase.py
    - tests/scorched_core/weapons/test_bomb.py
    - tests/scorched_core/weapons/test_bomb_phase.py
    - tools/e2e/bomb.spec.js
  modified:
    - src/scorched_core/collision/area_hits.py
    - src/scorched_core/pools/bullet_pool.py
    - src/scorched_core/protocol.py
    - src/scorched_core/tuning.py
    - src/scorched_core/game/game.py
    - tests/scorched_core/collision/test_area_hits.py
    - tests/scorched_core/pools/test_bullet_pool.py
    - tests/scorched_core/game/test_game.py

key-decisions:
  - "The bomb press is latched in tick() before the paused early return and cleared in _step whether or not the launch succeeds, so a refused press (no stock, bomb active, DYING/RESPAWN) never waits and fires later"
  - "The bomb is stepped after the grid rebuild and before remove_dead, so bomb kills share the normal explosion and drop pass"
  - "Radius is 20 on the first blast step and 230 from blast step 30 on (linear in between); damage lands on blast steps 1, 7, 13, ...; the phase returns to NONE on the 90th blast step"
  - "Invulnerability granted before life.step in the same step is protected for 143 steps, one fewer than the 144 nominal, because that step already decrements it; kept as the plan specifies"
  - "BOMB_MAX_STOCK is defined now but unused until 02-26 adds the bomb pickup"

patterns-established:
  - "BOMB_PHASE and BOMB_T (progress 0..1 within the phase) are the single source for the JS side to draw the missile and fireball"

requirements-completed: [PLYR-07]

coverage:
  - id: D1
    description: "Shift or K launches a missile that rises 24 steps to a point 110 units ahead (never above y 90) and detonates into a fireball growing from 20 to 230 units over 30 steps for 90 steps"
    requirement: PLYR-07
    verification:
      - kind: unit
        ref: "tests/scorched_core/weapons/test_bomb.py#test_the_missile_rises_in_a_straight_line_over_24_steps"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/weapons/test_bomb.py#test_the_radius_grows_from_20_to_230_over_30_blast_steps"
        status: pass
      - kind: e2e
        ref: "tools/e2e/bomb.spec.js#K launches a nuke: the phase goes LAUNCH, BLAST, NONE and the stock drops to 2"
        status: pass
    human_judgment: false
  - id: D2
    description: "Detonation clears every gameplay enemy bullet, the fireball keeps clearing bullets inside its radius and burns every air and ground enemy for 4 every 6 steps; the stress storm is never touched"
    requirement: PLYR-07
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_the_detonation_clears_every_gameplay_enemy_bullet_at_once_bomb"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_the_fireball_burns_air_and_ground_enemies_and_the_kills_join_the_kill_pass_bomb"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_the_storm_is_never_touched_by_a_bomb_storm"
        status: pass
      - kind: e2e
        ref: "tools/e2e/bomb.spec.js#a bomb never touches the stress storm"
        status: pass
    human_judgment: false
  - id: D3
    description: "The ship is invulnerable from launch through the blast plus a 30-step tail"
    requirement: PLYR-07
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_the_ship_is_invulnerable_through_the_launch_the_blast_and_a_30_step_tail_bomb"
        status: pass
    human_judgment: false
  - id: D4
    description: "Bombs are a limited stock (3 at the start); a press with no stock, with a bomb active, or while DYING or RESPAWN does nothing and is not remembered"
    requirement: PLYR-07
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_the_stock_counts_down_and_a_press_with_none_left_does_nothing_stock"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_a_press_while_a_bomb_is_active_is_consumed_and_never_fires_later_ignored"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_a_press_while_the_ship_has_no_control_is_consumed_without_effect_ignored"
        status: pass
      - kind: e2e
        ref: "tools/e2e/bomb.spec.js#ShiftLeft is the second bomb key and counts the stock down again"
        status: pass
    human_judgment: false
  - id: D5
    description: "A bomb press is never lost: a press on a zero-step or paused frame fires on the next live step, exactly once, and the run is deterministic"
    requirement: PLYR-07
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_a_bomb_press_on_a_zero_step_frame_still_fires_on_the_next_step_zero_step_latch"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_a_press_while_paused_is_remembered_and_fires_on_the_first_live_step_latch"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_the_bomb_is_deterministic_for_one_seed_and_inputs_determinism"
        status: pass
    human_judgment: false
  - id: D6
    description: "Header slots 25-29 and the manifest report the bomb for the JS side, and make perf stays at or below 3 ms per tick"
    requirement: PLYR-07
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_manifest_contract"
        status: pass
      - kind: other
        ref: "npm run perf (avg 0.60 ms vs 3 ms budget)"
        status: pass
    human_judgment: false

duration: 9 min
completed: 2026-10-18
status: complete
---

# Phase 02 Plan 22: Raiden Nuke Summary

**Shift or K launches a Raiden nuke in the simulation: a missile rises 24 steps, detonates into a 90-step fireball that grows from 20 to 230 units, wipes enemy bullets, burns every air and ground enemy for 4 every 6 steps and keeps the ship invulnerable, from a stock of 3 and with a press that survives zero-step and paused frames.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-10-18T05:59:27Z
- **Completed:** 2026-10-18T06:09:00Z
- **Tasks:** 2
- **Files modified:** 13 (5 created, 8 modified)

## Accomplishments

- `Bomb` (`weapons/bomb.py`) with `BombPhase`: `try_launch` spends a bomb and refuses without stock or while one is in the air; the LAUNCH phase moves the missile linearly to `max(y - 110, 90)`; the 24th step detonates (clears the gameplay bullet pool, pushes `BOMB_DETONATE`); BLAST clears bullets inside the current radius every step and damages enemies on blast steps 1, 7, 13 and so on.
- `resolve_bomb_vs_enemies` and `clear_bullets_in_radius` in `collision/area_hits.py` (edge inclusive, descending swap-remove), plus `BulletPool.clear()`.
- `Game` latches the BOMB edge in `tick()` before the paused early return and consumes it right after the terrain step, launching only when the ship has control and granting 24 + 90 + 30 steps of invulnerability through the shared max-of-sources counter. Header slots 25-29 and manifest `bomb_phases` plus the radius tuning let plan 02-26 draw it.
- `tools/e2e/bomb.spec.js` proves the keyboard path (K and ShiftLeft), the LAUNCH, BLAST, NONE sequence (recorded per animation frame), the stock countdown, the header following the missile and the storm staying at 200. `make check` is green: 100% line and branch coverage over 909 tests, vitest 715, perf 0.60 ms, 55 Playwright specs.

## Task Commits

1. **Task 1: Tracer, K launches a nuke that detonates into a fireball** - `83a722e` (feat)
2. **Task 2: Press latch, ignored presses, fireball clearing, determinism** - `a2d9a64` (test)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## Files Created/Modified

- `src/scorched_core/weapons/bomb.py`, `bomb_phase.py` - bomb state machine and its phase enum
- `src/scorched_core/collision/area_hits.py` - bomb and bullet-clear passes beside the beam pass
- `src/scorched_core/pools/bullet_pool.py` - `clear()`
- `src/scorched_core/protocol.py`, `tuning.py` - header slots 25-29, `BOMB_*` tuning
- `src/scorched_core/game/game.py` - `bomb`, `_bomb_requested`, latch, launch, step, header and manifest
- `tools/e2e/bomb.spec.js` - keyboard bomb e2e
- tests mirror the source tree (`test_bomb.py`, `test_bomb_phase.py`, `test_area_hits.py`, `test_bullet_pool.py`, `test_game.py`)

## Decisions Made

- A refused press is consumed (the latch is cleared either way), so no ignored press can fire later after the stock or control returns.
- The ship invulnerability granted just before `life.step` in the launch step protects 143 steps rather than 144 because that step already decrements the counter; the test pins this exactly. Plan 02-26 can grant one more if the exact 144 matters.
- `BOMB_MAX_STOCK = 7` is defined for the 02-26 pickup path and is not read yet.

## Deviations from Plan

None - plan executed exactly as written.

### TDD note (Task 2, `tdd="true"`)

Task 1's `Bomb` already cleared bullets inside the radius during BLAST and `Game` already cleared the request on every path, so Task 2's tests (zero-step latch, paused latch, ignored presses, fireball clearing, determinism) were green on first run; there was no separate RED. They pin the behaviours and `area_hits.py`/`game.py` needed no change. The Task 2 tests were committed separately as a test commit.

## Issues Encountered

- One test arithmetic slip (damage hits at blast steps 1, 7, 13 and 19 within 19 steps) and one fixture bullet placed beyond the cull margin were fixed in the tests only.

## Known Stubs

None. The browser shows no fireball yet by design: only enemy explosions, vanishing bullets and the header values appear until plan 02-26 draws the showcase visuals.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 02-26 can read `BOMBS`, `BOMB_PHASE`, `BOMB_X`, `BOMB_Y`, `BOMB_T` and the `bomb_*` tuning from the manifest, and the `BOMB_LAUNCH` and `BOMB_DETONATE` events, to draw the missile and fireball; it also adds deathbomb, the bomb pickup (`BOMB_MAX_STOCK`) and respawn refill.
- 02-27 adds the stock readout and the `?bombs` flag; 02-28 adds hitstop and shake.

## Self-Check: PASSED

- All key files exist on disk; commits `83a722e` and `a2d9a64` are ancestors of HEAD; acceptance greps (`_bomb_requested = True`, `H_BOMB_T: Final = 29`) match; `make check` exit 0 (100% coverage, vitest 715, perf 0.60 ms, Playwright 55 passed).

---
*Phase: 02-arcade-shooting-feel*
*Completed: 2026-10-18*
