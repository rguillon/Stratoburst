---
phase: 02-arcade-shooting-feel
plan: 25
subsystem: gameplay
tags: [death, respawn, weapon-loadout, pickups, three.js, particles, pytest, vitest, playwright]

requires:
  - phase: 02-arcade-shooting-feel
    provides: "PlayerLife death/respawn cycle and lethal checks (02-20), WeaponLoadout (02-08), PickupPool and PickupKind (02-10), ship model and hitbox marker (02-06), explosion recipes (02-17), air shadows with shipVisible (02-19), crystal visuals (02-24)"
provides:
  - "WeaponLoadout.penalize(): a death costs DEATH_LEVEL_PENALTY (2) levels, floor 1, same weapon kind"
  - "PickupPool.spawn_guaranteed(): evicts the oldest pickup when the pool is full"
  - "Game._on_death: penalises the loadout and leaves a fixed-colour recovery pickup at the clamped death spot"
  - "ship.userData.setHullVisible and hullVisibleFor: hull blink while invulnerable, hitbox marker never hidden"
  - "PLAYER_DEATH (LARGE fireball plus 16 white sparks) and PLAYER_HIT (10-spark white ring) explosion recipes"
  - "main.js hides the ship model and its shadow while DYING; debug hook shipVisible"
affects: [02-26, 02-33, phase-3-scoring]

tech-stack:
  added: []
  patterns:
    - "Ring emitters: a recipe emitter flag spaces particles evenly around the circle instead of at random angles"
    - "Guaranteed spawn by eviction: a fixed-capacity pool keeps its cap and drops its oldest entry for a must-exist spawn"

key-files:
  created: []
  modified:
    - src/scorched_core/tuning.py
    - src/scorched_core/weapons/weapon_loadout.py
    - src/scorched_core/pools/pickup_pool.py
    - src/scorched_core/game/game.py
    - tests/scorched_core/weapons/test_weapon_loadout.py
    - tests/scorched_core/pools/test_pickup_pool.py
    - tests/scorched_core/game/test_game.py
    - web/src/render/ship_model.js
    - web/test/render/ship_model.test.js
    - web/src/fx/explosion_fx.js
    - web/test/fx/explosion_fx.test.js
    - web/src/main.js
    - tools/e2e/death.spec.js

key-decisions:
  - "Death penalty tuning lives in tuning.py: DEATH_LEVEL_PENALTY = 2 plus RECOVERY_VY (-0.5), RECOVERY_MARGIN (4) and RECOVERY_BOTTOM_MARGIN (40) for the recovery pickup, so every number in D-04/D-05 is a reversible constant"
  - "The recovery pickup is spawned in the same step as the death and before pickups.step(), so it has already drifted one step (0.5 units up) when first packed; it cannot be caught on that step because the dying ship cannot collect"
  - "The ship group is hidden (including its hitbox marker) only while DYING; during GRACE, RESPAWN fly-in and ALIVE the marker stays visible, and only the three hull meshes blink"

patterns-established:
  - "Ring emitters in explosion_fx: emitter(..., ring = true) spreads count particles at i / count of a full turn, scaled by tier count"
  - "Visibility rule exported as a pure helper (hullVisibleFor) so main.js stays free of logic that needs unit tests"

requirements-completed: [PLYR-06, PLYR-10]

coverage:
  - id: D1
    description: "A death costs two weapon levels with a floor of 1 and keeps the weapon type"
    requirement: PLYR-06
    verification:
      - kind: unit
        ref: "tests/scorched_core/weapons/test_weapon_loadout.py#penalize cases; tests/scorched_core/game/test_game.py#test_a_death_costs_two_weapon_levels_and_keeps_the_weapon_recovery"
        status: pass
      - kind: e2e
        ref: "tools/e2e/death.spec.js#a death at laser Lv4 drops to Lv2, keeps the laser and leaves a recovery pickup"
        status: pass
    human_judgment: false
  - id: D2
    description: "A fixed-colour recovery pickup drops at the clamped death spot and is guaranteed even with a full pool, evicting the oldest"
    requirement: PLYR-06
    verification:
      - kind: unit
        ref: "tests/scorched_core/pools/test_pickup_pool.py#spawn_guaranteed; tests/scorched_core/game/test_game.py#recovery cases (colour, clamp, full pool, catch to Lv3)"
        status: pass
      - kind: e2e
        ref: "tools/e2e/death.spec.js#a death at laser Lv4 drops to Lv2, keeps the laser and leaves a recovery pickup"
        status: pass
    human_judgment: false
  - id: D3
    description: "The respawned ship blinks its hull while invulnerable with the hitbox marker never hidden"
    requirement: PLYR-10
    verification:
      - kind: unit
        ref: "web/test/render/ship_model.test.js#the respawn blink (PLYR-10, Pitfall 9)"
        status: pass
    human_judgment: true
    rationale: "The 4-step (about 7.5 Hz) blink rate and its readability on phones is a feel judgement that no test asserts; checked in the human-check and the plan 02-33 feel checklist"
  - id: D4
    description: "The ship explodes and disappears on death (LARGE fireball plus white ring, ship and shadow hidden while DYING) and a fatal hit flashes a white warning ring"
    requirement: PLYR-06
    verification:
      - kind: unit
        ref: "web/test/fx/explosion_fx.test.js#the player ship recipes (PLYR-06)"
        status: pass
      - kind: e2e
        ref: "tools/e2e/death.spec.js#a mortal idle ship dies, flies back in and blinks invulnerable"
        status: pass
    human_judgment: true
    rationale: "How the explosion and the white warning ring look and feel next to enemy fire needs a human look; the plan human-check covers it"

duration: 11min
completed: 2026-10-18
status: complete
commits: 3
plan_head_before: 9141a9655e65536aa6b85b8430f1f388c43f57f0
plan_head_after: 56baa11e2e925bd1a3329985ab84797ef250f0d8
actuals:
  tokens: 28000
  tasks: 2
  commits: 3
---

# Phase 2 Plan 25: Death Costs Power and Respawn Blinks Summary

**Dying costs two weapon levels (floor 1, same weapon) and leaves a fixed-colour recovery crystal at the clamped death spot, guaranteed by evicting the oldest pickup; the ship explodes (LARGE fireball plus a 16-spark white ring) and vanishes, then returns blinking its hull while the hitbox dot stays visible.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-10-18T06:32:14Z
- **Completed:** 2026-10-18T06:43:13Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments

- PLYR-06: `WeaponLoadout.penalize()` (-2, floor 1, kind kept), `PickupPool.spawn_guaranteed()` (evicts the largest-age pickup, lowest slot on a tie, so the pool stays at `PICKUP_CAP`), and `Game._on_death()` which runs on the step `PlayerLife.step` returns True. The recovery pickup is the `PickupKind` matching the weapon (never a cycling CRYSTAL), at (0, -0.5) velocity, clamped to [10, W-10] x [10, H-40]. Catching it at Lv2 laser gives Lv3 (tested).
- PLYR-10: `ship.userData.setHullVisible(visible)` toggles fuselage, canopy and engine glow only; `hullVisibleFor(invuln)` is true for 0 or an even `floor(invuln / 4)`. `main.js` drives it from the INVULN header slot each frame, so movement and fire are untouched during the blink (D-15).
- The ship group and its shadow are hidden while `PLAYER_PHASE == DYING`; the `?debug` hook `shipVisible` exposes this to e2e.
- Explosion recipes: `PLAYER_DEATH` reuses every LARGE emitter and adds a ring of 16 white (`HIT_SPARK`) sparks; `PLAYER_HIT` is a quick ring of 10 white sparks. A new `ring` emitter flag spaces particles evenly; counts scale with the tier, sizes never do.
- Gates: pytest 100% line+branch (926 passed at the Task 1 gate), vitest 772 passed, `make perf` 0.5 to 0.7 ms average per weapon (budget 3 ms), `make check` (lint, test, build, 58 Playwright tests) green before the final code commit.

## Task Commits

1. **Task 1: Tracer, death at laser Lv4 drops to Lv2 and leaves a blue recovery crystal** - `338be3f` (feat)
2. **Task 2 RED: failing tests for the hull blink and the player death recipes** - `35ef8fb` (test)
3. **Task 2 GREEN: ship explodes, disappears on death, blinks its hull** - `56baa11` (feat)

**Plan metadata:** recorded by the docs(02-25) commit that follows this file.

## TDD Gate Compliance

Task 2 (`tdd="true"`) followed RED then GREEN. RED evidence (vitest, run on the pre-change `web/src`): 11 target tests failed on the planned assertions: the five new recipe/palette tests (missing `PLAYER_DEATH_RECIPE` / `PLAYER_HIT_RECIPE` exports and unhandled events) and the six respawn-blink tests (`setHullVisible` and `hullVisibleFor` not defined). Semantic assessment: every failure was the intended missing behaviour, not an import, syntax or fixture fault. The `gsd_run check tdd-red-evidence` classifier was not run (vitest's default reporter is not one of its supported formats); the assessment above is manual. No REFACTOR commit was needed.

Task 1 is a `type="tracer"` task: tests were written together with the implementation and committed once. The tracer gate (interactive, `end-of-phase`, automated-only verify) was satisfied by re-running the verify end to end: pytest/ruff/coverage, `make perf`, build and the death and weapons Playwright specs all passed before Task 2 began.

## Files Created/Modified

- `src/scorched_core/tuning.py` - `DEATH_LEVEL_PENALTY`, `RECOVERY_VY`, `RECOVERY_MARGIN`, `RECOVERY_BOTTOM_MARGIN`
- `src/scorched_core/weapons/weapon_loadout.py` - `penalize()`
- `src/scorched_core/pools/pickup_pool.py` - `spawn_guaranteed()`
- `src/scorched_core/game/game.py` - `_on_death()` wired to the death step
- `web/src/render/ship_model.js` - `setHullVisible`, `hullVisibleFor`
- `web/src/fx/explosion_fx.js` - `PLAYER_HIT_RECIPE`, `PLAYER_DEATH_RECIPE`, `ring` emitters, event dispatch
- `web/src/main.js` - hide ship and shadow while DYING, blink the hull, `shipVisible` hook
- `tools/e2e/death.spec.js` - level-loss/recovery-pickup run and ship-visibility assertions
- Matching tests under `tests/scorched_core/` and `web/test/`

## Decisions Made

- The plan's constants (-0.5 pickup velocity, 4 and 40 clamp margins) are named in `tuning.py` rather than inlined, in line with D-04's reversible-constant intent.
- `spawn_guaranteed` returns nothing (it cannot fail), unlike `spawn`.
- Ring emitters skip the random angle draw, so every pre-existing recipe keeps the same rng sequence.

## Deviations from Plan

None - plan executed exactly as written. (Additions within the plan's intent: the three recovery constants in `tuning.py`, and the explicit `ring` emitter flag to realise "ring of white sparks".)

## Issues Encountered

- A first draft of the blink-rule test listed 148 as a visible step; `floor(148 / 4) = 37` is odd, so it is hidden. The test data was corrected before the RED commit; the rule itself was right.

## Known Stubs

None.

## Threat Flags

None. T-02-30 (pickup pool growth) is mitigated and tested: `spawn_guaranteed` evicts instead of growing and a full-pool test asserts `n == PICKUP_CAP` afterwards.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The death loop is complete (hit, grace, explosion, level loss, recovery crystal, fly-in, blinking invulnerability). Plan 02-26 can add the BOMB pickup path.
- Open for the 02-33 feel checklist: the 7.5 Hz blink readability on phones, and whether the white warning ring and death explosion read well against enemy fire (the plan's `human-check`).

## Self-Check: PASSED

Verified: all 13 modified files exist; commits `338be3f`, `35ef8fb`, `56baa11` are ancestors of HEAD; acceptance greps match (`DEATH_LEVEL_PENALTY: Final = 2`, `setHullVisible` in `main.js`); the `penal or recovery or guaranteed` pytest selection passes (17 tests); `make check` passed with 100% coverage.

---
*Phase: 02-arcade-shooting-feel*
*Completed: 2026-10-18*
