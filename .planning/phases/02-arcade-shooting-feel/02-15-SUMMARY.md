---
phase: 02-arcade-shooting-feel
plan: 15
subsystem: gameplay
tags: [player-life, state-machine, respawn, invulnerability, deathbomb-grace, collision, pytest]

requires:
  - phase: 02-arcade-shooting-feel
    provides: "PlayerShip with step/add_drag (01), resolve_pickups_vs_ship and circles_touch (02-10), BulletPool, EnemyPool with ENEMY_GROUND, EventRing and EV_PLAYER_HIT/EV_PLAYER_DEATH/EV_RESPAWN (02-01)"
provides:
  - "PlayerPhase IntEnum: ALIVE 0, GRACE 1, DYING 2, RESPAWN 3"
  - "PlayerLife(phase, timer, invuln, deaths) with hit(x, y, events) -> bool, step(ship, events) -> bool (True only on the destroying step), grant_invuln(ticks), can_control, can_fire, vulnerable"
  - "PlayerShip.respawn_start() and PlayerShip.fly_in() -> bool"
  - "resolve_bullets_vs_ship(bullets, x, y, radius) and resolve_bodies_vs_ship(enemies, x, y, radius) beside resolve_pickups_vs_ship"
  - "Tuning DEATHBOMB_TICKS 8, DYING_TICKS 50, RESPAWN_START_Y PLAYFIELD_H + 24, RESPAWN_SPEED 2.5, INVULN_RESPAWN_TICKS 150, ENEMY_BULLET_RADIUS 2.5"
affects: [02-20 wires life into Game and makes enemy fire lethal, 02-22 and 02-26 bombs share grant_invuln and cancel the grace window, 02-28 hitstop starts at a confirmed death]

actuals:
  tokens: 5800
  tasks: 2
  commits: 3
plan_head_before: 8f516ab7830a8a7ee34366faa23d7c375b428804
plan_head_after: 7e08b80be6dd695940d7b31ede12667537bf834d
commits: 3

tech-stack:
  added: []
  patterns:
    - "A life-cycle state machine as a dataclass(slots) with a match on an IntEnum phase, every window a step counter, and a loud ValueError arm for an unknown phase"
    - "One invulnerability counter fed by grant_invuln, which takes the larger remaining value instead of adding"
    - "Ship-hit helpers are linear scans over the pools with no allocation, callable from the game loop without a grid"

key-files:
  created:
    - src/scorched_core/entities/player_phase.py
    - src/scorched_core/entities/player_life.py
    - tests/scorched_core/entities/test_player_phase.py
    - tests/scorched_core/entities/test_player_life.py
  modified:
    - src/scorched_core/entities/player_ship.py
    - tests/scorched_core/entities/test_player_ship.py
    - src/scorched_core/collision/ship_hits.py
    - tests/scorched_core/collision/test_ship_hits.py
    - src/scorched_core/tuning.py

key-decisions:
  - "The grace window is exactly DEATHBOMB_TICKS step calls after the hit step: hit() arms the timer, the 8th step() flips to DYING and returns True, so plan 02-26 has eight steps in which a bomb can cancel"
  - "The RESPAWN event is pushed at the ship's position after respawn_start (below the playfield), i.e. where the fly-in begins; the header slots that report life state arrive in 02-20"
  - "Invulnerability counts down only on ALIVE steps, so it does not run while flying in; the 150 steps start on the arrival step and the blink ends exactly when invuln reaches 0"
  - "can_control and can_fire are the same predicate (ALIVE or GRACE) but are separate properties so the game can gate steering and firing independently later"

patterns-established:
  - "Pattern: ignored hits return False and change nothing (no event, no timer, no counter), so callers can try hit() on every contact without pre-checking vulnerable"

requirements-completed: [PLYR-10, PLYR-08]

coverage:
  - id: D1
    description: "A hit on a live ship opens an exact 8-step grace window and pushes PLAYER_HIT; an unanswered hit destroys the ship with PLAYER_DEATH, deaths += 1 and 50 steps of no control and no fire"
    requirement: PLYR-08
    verification:
      - kind: unit
        ref: "tests/scorched_core/entities/test_player_life.py#test_grace_lasts_exactly_the_deathbomb_window"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/entities/test_player_life.py#test_dying_has_no_control_and_no_fire_for_the_dying_window"
        status: pass
    human_judgment: false
  - id: D2
    description: "Respawn flies in from 24 units below the playfield at 2.5 units per step, control returns on arrival, and the ship is invulnerable for 150 steps while it can move and fire"
    requirement: PLYR-10
    verification:
      - kind: unit
        ref: "tests/scorched_core/entities/test_player_life.py#test_full_cycle_runs_hit_grace_death_fly_in_and_a_second_life"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/entities/test_player_ship.py#test_fly_in_rises_at_respawn_speed_and_reports_arrival"
        status: pass
    human_judgment: false
  - id: D3
    description: "Hits are ignored in GRACE, DYING, RESPAWN and while invulnerable, and invulnerability from several sources takes the larger remaining value"
    requirement: PLYR-10
    verification:
      - kind: unit
        ref: "tests/scorched_core/entities/test_player_life.py#test_a_hit_outside_alive_changes_nothing"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/entities/test_player_life.py#test_invuln_max_holds_whichever_order_the_sources_arrive_in"
        status: pass
    human_judgment: false
  - id: D4
    description: "Ship-hit helpers: the first enemy bullet touching the 2-unit hitbox core is removed and reported; a live air enemy's body counts as a hit while ground enemies and dead enemies never do"
    requirement: PLYR-10
    verification:
      - kind: unit
        ref: "tests/scorched_core/collision/test_ship_hits.py#test_a_ground_enemy_never_rams_the_ship"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/collision/test_ship_hits.py#test_only_the_first_touching_bullet_is_removed"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-10-18
status: complete
---

# Phase 2 Plan 15: Player Life Cycle Summary

**PlayerLife state machine (ALIVE, GRACE, DYING, RESPAWN) driven purely by step counters, with an exact 8-step grace window, a 50-step death, a 2.5 units-per-step fly-in from below the playfield, 150 steps of shared invulnerability, and bullet/body ship-hit helpers ready for plan 02-20.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-10-18T04:52:16Z
- **Completed:** 2026-10-18T04:56:24Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- The ship's life runs end to end in tested units: a hit opens the 8-step grace window, an unanswered hit destroys the ship, the wreck lies dead for 50 steps, and the ship flies back in with 2.5 s of invulnerability during which it can move and fire (PLYR-10, PLYR-08 foundation, D-11, D-14, D-15).
- The machine cannot stick: every non-ALIVE phase is bounded by a counter or by a fly-in that always reaches SHIP_START_Y (threat T-02-19), proved by the full-cycle test.
- `grant_invuln` keeps one counter for every source, so the bomb (02-22) and the respawn share it by taking the larger value.
- `resolve_bullets_vs_ship` and `resolve_bodies_vs_ship` give plan 02-20 the two contact tests it needs without touching Game or the boundary.

## Task Commits

1. **Task 1: Tracer, hit through the full cycle to an invulnerable return** - `95339cc` (feat)
2. **Task 2 RED: failing tests for ship-hit helpers and ignored-hit rules** - `2084086` (test)
3. **Task 2 GREEN: bullet and body hit helpers** - `7e08b80` (feat)

**Plan metadata:** the docs commit that adds this SUMMARY, STATE.md and ROADMAP.md.

_Task 2 is TDD. The RED evidence was taken against local stubs returning False (not committed): 5 target tests failed on their assertions while the 28 others passed, so the failures were real assertion failures and not collection errors. The ignored-hit and invuln_max behaviours already passed from Task 1, because the tracer needed `grant_invuln` and the vulnerable guard for the respawn path and coverage; their tests were still added in Task 2 as the plan specifies._

## Files Created/Modified

- `src/scorched_core/entities/player_phase.py` - PlayerPhase IntEnum
- `src/scorched_core/entities/player_life.py` - PlayerLife state machine
- `src/scorched_core/entities/player_ship.py` - respawn_start and fly_in
- `src/scorched_core/collision/ship_hits.py` - resolve_bullets_vs_ship, resolve_bodies_vs_ship
- `src/scorched_core/tuning.py` - life-cycle constants and ENEMY_BULLET_RADIUS
- `tests/scorched_core/entities/test_player_phase.py`, `test_player_life.py`, `test_player_ship.py` and `tests/scorched_core/collision/test_ship_hits.py` - behaviour tests, 100% line and branch

## Decisions Made

See `key-decisions` in the frontmatter. The notable one: invulnerability counts down only on ALIVE steps, so the 150 steps begin on the arrival step and the blink ends exactly when `invuln` reaches 0.

## Deviations from Plan

None - plan executed exactly as written. (`grant_invuln` was implemented in Task 1 rather than Task 2 because the respawn path in Task 1 calls it and the Task 1 gate requires 100% coverage; Task 2 added its dedicated tests.)

## Issues Encountered

None.

## Known Stubs

None. The ship-hit helpers and PlayerLife are intentionally not wired into Game yet; plan 02-20 does that, as the plan states.

## Threat Flags

None - no new endpoints, auth paths or trust-boundary changes; Python-only simulation code, no packages added.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 02-20: wire `PlayerLife.step`/`hit` into Game, call the two ship-hit helpers with `HITBOX_RADIUS`, gate steering and firing on `can_control`/`can_fire`, and add the header slots for the life state.
- No blockers. `make check` (lint, 716 Python tests at 100% line and branch coverage, build, 44 e2e) passes.

## Self-Check: PASSED

- Created files exist: player_phase.py, player_life.py and their tests found on disk.
- Commits `95339cc`, `2084086` and `7e08b80` are ancestors of HEAD; measured count since the plan base is 3.

---
*Phase: 02-arcade-shooting-feel*
*Completed: 2026-10-18*
