---
phase: 02-arcade-shooting-feel
plan: 08
subsystem: weapons
tags: [python, vulcan, weapon-loadout, enums, protocol, data-driven]

requires:
  - phase: 02-arcade-shooting-feel
    provides: "Game step order with enemies and the event ring (02-05), EV_SHOT and low-priority events (02-01)"
provides:
  - "Vulcan fan driven by VULCAN_STREAMS / VULCAN_INTERVAL level tables (Lv1 = Phase 1 twin shot, Lv5 = seven streams)"
  - "WeaponKind (VULCAN, LASER, HOMING) and PickupOutcome (RAISED, SWITCHED, MAXED, STOCKED) IntEnums"
  - "WeaponLoadout(kind, level).collect(color) implementing the PLYR-05 / D-07 colour rules"
  - "Game(weapon=, level=) with level clamp 1..5, header WEAPON (16) and LEVEL (17), manifest weapons and outcomes"
affects: [02-10 crystals, 02-11 URL flags and HUD, 02-13 homing, 02-21 laser, 02-26 bomb pickups]

actuals:
  tokens: 9700
  tasks: 2
  commits: 2
plan_head_before: 1c7a86265c13d0e4374942eaf5b988e73c56b47d
plan_head_after: 02b0f5f36302b7c821a83d5f261ce4b95a2cf959

tech-stack:
  added: []
  patterns:
    - "Weapon patterns as data: per-level (x offset, degrees) tuples precomputed once into (dx, vx, vy) streams, no trigonometry per shot"
    - "Every weapon is stepped every step with fire gated by the selected kind, so cooldowns keep running across a switch"

key-files:
  created:
    - src/scorched_core/weapons/weapon_kind.py
    - src/scorched_core/weapons/pickup_outcome.py
    - src/scorched_core/weapons/weapon_loadout.py
    - src/scorched_core/weapons/vulcan.py
    - tests/scorched_core/weapons/test_weapon_kind.py
    - tests/scorched_core/weapons/test_pickup_outcome.py
    - tests/scorched_core/weapons/test_weapon_loadout.py
    - tests/scorched_core/weapons/test_vulcan.py
  modified:
    - src/scorched_core/tuning.py
    - src/scorched_core/protocol.py
    - src/scorched_core/game/game.py
    - tests/scorched_core/game/test_game.py
  deleted:
    - src/scorched_core/weapons/twin_shot.py
    - tests/scorched_core/weapons/test_twin_shot.py

key-decisions:
  - "TwinShot is deleted; Lv1 of the vulcan tables reproduces it exactly (test_twin_shot_parity), and FIRE_INTERVAL_TICKS / TWIN_OFFSET are replaced by the level tables"
  - "Game clamps the starting level to 1..MAX_LEVEL itself, regardless of the caller (T-02-11)"
  - "LASER and HOMING are selectable now and fire nothing until plans 02-21 and 02-13 (intermediate state inside the phase)"

patterns-established:
  - "New weapon = a WeaponKind value + a class stepped every step with fire gated by loadout.kind"
  - "Outcome enums cross the boundary by name through the manifest (weapons, outcomes)"

requirements-completed: [PLYR-05, PLYR-04]

coverage:
  - id: D1
    description: "Vulcan fan from level tables: Lv1 identical to the Phase 1 twin shot, Lv5 seven streams at +-21 degrees, partial volley drop, one low SHOT event per non-empty volley"
    requirement: PLYR-05
    verification:
      - kind: unit
        ref: "tests/scorched_core/weapons/test_vulcan.py"
        status: pass
    human_judgment: false
  - id: D2
    description: "WeaponLoadout colour rules: same colour raises, different colour switches and keeps the level, Lv5 same colour reports MAXED"
    requirement: PLYR-05
    verification:
      - kind: unit
        ref: "tests/scorched_core/weapons/test_weapon_loadout.py"
        status: pass
    human_judgment: false
  - id: D3
    description: "Game(weapon=, level=) with clamped level, header WEAPON and LEVEL, manifest weapons and outcomes, gating of the vulcan by the selected kind"
    requirement: PLYR-04
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py"
        status: pass
    human_judgment: false
  - id: D4
    description: "Browser build still plays at Lv1 and stays within the Python tick budget"
    verification:
      - kind: e2e
        ref: "npx playwright test tools/e2e/shooting.spec.js tools/e2e/keyboard.spec.js"
        status: pass
      - kind: other
        ref: "npm run perf (avg_ms 0.571, budget 3)"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-10-18
status: complete
---

# Phase 2 Plan 08: Vulcan Fan and Weapon Loadout Summary

**Data-driven Raiden vulcan fan (Lv1 = the old twin shot, Lv5 = seven streams) with a WeaponLoadout kind/level state machine implementing the crystal colour rules**

## Performance

- **Duration:** 10 min
- **Completed:** 2026-10-18
- **Tasks:** 2
- **Files modified:** 14 (8 created, 4 modified, 2 deleted)

## Accomplishments
- The vulcan replaces the twin shot: per-level (offset, angle) tables in `tuning.py` are precomputed once into (dx, vx, vy) streams; Lv1 is exactly two parallel bolts 5 units apart every 5 steps (parity test), Lv4 and Lv5 fire every 4 steps, Lv5 spreads seven streams out to +-21 degrees.
- `WeaponLoadout.collect` implements PLYR-05 and D-07: same colour levels up to 5, another colour switches and keeps the level, a same colour crystal at Lv5 reports MAXED and changes nothing. `PickupOutcome.STOCKED` is reserved for plan 02-26.
- `Game(weapon=, level=)` starts at any loadout with the level clamped to 1..5, the vulcan is stepped every step with fire gated by the selected kind (cooldown keeps running across a switch), and the header carries WEAPON (16) and LEVEL (17); the manifest maps `weapons` and `outcomes`.
- Verification: 515 pytest tests, 100% line and branch coverage, ruff check and format clean; `npm run perf` avg_ms 0.571 (p95 0.642, budget 3); `npm run build` ok; Playwright shooting and keyboard specs 7/7 pass.

## Task Commits

1. **Task 1: Tracer: levelled vulcan fan driven by data tables, Lv1 identical to the twin shot** - `606c27b` (feat)
2. **Task 2: Colour rules: level up, switch keeps level, MAXED at Lv5** - `02b0f5f` (feat)

**Plan metadata:** recorded in the docs commit that follows this summary.

## Files Created/Modified
- `src/scorched_core/weapons/vulcan.py` - Vulcan with precomputed streams, partial-volley drop and low SHOT event
- `src/scorched_core/weapons/weapon_kind.py` - WeaponKind IntEnum in crystal colour order
- `src/scorched_core/weapons/pickup_outcome.py` - PickupOutcome IntEnum
- `src/scorched_core/weapons/weapon_loadout.py` - WeaponLoadout state machine with `collect`
- `src/scorched_core/tuning.py` - MAX_LEVEL, VULCAN_STREAMS, VULCAN_INTERVAL; FIRE_INTERVAL_TICKS and TWIN_OFFSET removed
- `src/scorched_core/protocol.py` - H_WEAPON = 16, H_LEVEL = 17
- `src/scorched_core/game/game.py` - loadout, vulcan, constructor keywords, header slots, manifest maps
- `tests/scorched_core/...` - mirrored tests for each new module plus Game tests; the TwinShot test was ported to vulcan Lv1 cases

## Decisions Made
- The tracer's `<verify>` (full pytest gate plus perf, build and the two Playwright specs) passed end to end before Task 2, so expansion went ahead.
- Task 2's tests were written before the implementation, but the first run was a module import failure, which is not a valid RED. Both are in one `feat` commit rather than a separate failing `test` commit.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## Known Stubs
LASER and HOMING can be selected but fire nothing. This is the documented intermediate state in the plan (resolved by plans 02-21 and 02-13 inside this phase), not an accidental stub.

## Threat Flags
None. T-02-10 (overfull volley partially dropped, streams precomputed, perf re-measured) and T-02-11 (level clamped inside Game) are implemented as planned.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 02-10 can call `loadout.collect(color)` for crystals; plan 02-11 can expose weapon and level as URL flags and draw them on screen from header slots 16 and 17.

## Self-Check: PASSED
- Created files present on disk; commits `606c27b` and `02b0f5f` are ancestors of HEAD; `twin_shot.py` is gone; `H_LEVEL: Final = 17` and `STOCKED = 3` greps match.

---
*Phase: 02-arcade-shooting-feel*
*Completed: 2026-10-18*
