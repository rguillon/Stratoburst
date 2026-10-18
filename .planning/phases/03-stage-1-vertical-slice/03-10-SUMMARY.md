---
phase: 03-stage-1-vertical-slice
plan: 10
subsystem: gameplay
tags: [stage-intro, fly-in, banner, flow-state, wrecks, decals, playwright, vitest]

requires:
  - phase: 03-stage-1-vertical-slice
    provides: "StageFlow, FlowState.INTRO, header FLOW/FLOW_T/STAGE, EV_STAGE_START (03-01), Game.restart and the PLAY/GAME_OVER flow (03-08), the state-driven overlay pattern (03-09)"
provides:
  - "PlayerLife.arrival_invuln and PlayerLife.begin_fly_in(ship, invuln)"
  - "StageFlow starts in INTRO, pushes one STAGE_START (a = stage number) on its first step, progress property, PLAY after INTRO_TICKS"
  - "tuning.INTRO_TICKS = 120; header FLOW_T carries the intro progress 0..1"
  - "createBannerOverlay (web/src/ui/banner_overlay.js) and the #banner markup"
  - "wreck_ring and decal_ring clear on events.STAGE_START"
  - "tools/e2e/intro.spec.js"
affects: [03-11 and later (WARNING and STAGE CLEAR banners reuse banner_overlay), phase 4 title screen]

actuals:
  tokens: 14000
  tasks: 2
  commits: 4
plan_head_before: 30dbb0ef72f8210417611ef738e5928052847d6f
plan_head_after: a0bf9b04aad460dcf4b8cebea1fca0754d4d87a1

tech-stack:
  added: []
  patterns:
    - "A fly-in is a RESPAWN phase with a per-fly-in arrival window; the stage intro passes 0, a death respawn keeps the default 150"
    - "Ring-buffer fx clear on a flow event instead of reading the scroll, because the scroll restarts at 0 on every stage start"
    - "Banner is state-driven from FLOW + STAGE + FLOW_T; opacity is written only when it changes"

key-files:
  created:
    - web/src/ui/banner_overlay.js
    - web/test/ui/banner_overlay.test.js
    - tools/e2e/intro.spec.js
  modified:
    - src/scorched_core/entities/player_life.py
    - src/scorched_core/stages/stage_flow.py
    - src/scorched_core/game/game.py
    - src/scorched_core/tuning.py
    - src/scorched_core/protocol.py
    - tests/scorched_core/entities/test_player_life.py
    - tests/scorched_core/stages/test_stage_flow.py
    - tests/scorched_core/game/test_game.py
    - tests/scorched_web/test_entrypoint.py
    - web/src/fx/wreck_ring.js
    - web/src/fx/decal_ring.js
    - web/test/fx/wreck_ring.test.js
    - web/test/fx/decal_ring.test.js
    - index.html
    - web/src/main.js

key-decisions:
  - "StageFlow gets a stage_number field (default 1) set from StageData.number, so the first INTRO step can announce the stage"
  - "Game._open_stage() holds the ?at= jump and the intro fly-in for both __init__ and restart(), which also keeps __init__ under the statement limit"
  - "Ring clears are guarded by events.STAGE_START !== undefined so an older events table keeps the previous behaviour"

patterns-established:
  - "Existing stage-mode Python tests skip the intro through the test helper _skip_intro(game); the intro has its own tests"

requirements-completed: [SCOR-05, ENMY-05]

coverage:
  - id: D1
    description: "Every stage start, including a restart, opens with the ship flying in from below for 120 steps, then FLOW becomes PLAY with the ship ALIVE"
    requirement: SCOR-05
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_the_intro_flows_into_play_with_an_arrived_ship_and_no_blink"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_a_restart_opens_with_the_intro_and_the_fly_in_again"
        status: pass
      - kind: e2e
        ref: "tools/e2e/intro.spec.js#the stage opens with STAGE 1 and the ship flying in, then play begins without a blink"
        status: pass
    human_judgment: false
  - id: D2
    description: "The intro fly-in grants no invulnerability (no blink at stage start) while a death respawn still grants the 150-step blink"
    requirement: SCOR-05
    verification:
      - kind: unit
        ref: "tests/scorched_core/entities/test_player_life.py#test_a_death_respawn_after_the_intro_still_grants_the_blink"
        status: pass
      - kind: e2e
        ref: "tools/e2e/intro.spec.js (INVULN sampled every frame until PLAY stays 0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "One STAGE_START event (a = stage number) is pushed on the first intro step, and the wreck and scorch rings clear on it"
    requirement: ENMY-05
    verification:
      - kind: unit
        ref: "tests/scorched_core/stages/test_stage_flow.py#test_the_first_intro_step_pushes_one_stage_start_with_the_stage_number"
        status: pass
      - kind: unit
        ref: "web/test/fx/wreck_ring.test.js (a stage start)"
        status: pass
      - kind: unit
        ref: "web/test/fx/decal_ring.test.js (a stage start)"
        status: pass
      - kind: e2e
        ref: "tools/e2e/ground.spec.js#the ground layer scale is in range and a ground kill leaves a wreck"
        status: pass
    human_judgment: false
  - id: D4
    description: "The STAGE 1 banner is state-driven from FLOW, STAGE and FLOW_T, built from the integer stage number with textContent, shown exactly during INTRO"
    requirement: SCOR-05
    verification:
      - kind: unit
        ref: "web/test/ui/banner_overlay.test.js"
        status: pass
      - kind: e2e
        ref: "tools/e2e/intro.spec.js#the banner is visible while the intro runs"
        status: pass
    human_judgment: false
  - id: D5
    description: "The gallery has no intro: Game() starts ALIVE at the start position with FLOW -1"
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_the_gallery_has_no_intro_and_starts_alive_at_the_start_position"
        status: pass
      - kind: e2e
        ref: "tools/e2e/intro.spec.js#the shooting gallery has no intro and no banner"
        status: pass
    human_judgment: false
  - id: D6
    description: "The banner looks right: neon cyan glow, legible size, fade timing feels like an arcade stage start"
    verification: []
    human_judgment: true
    rationale: "Visual quality and feel of the banner and fly-in are not asserted by any test; only text, visibility and state are"

duration: 11min
completed: 2026-10-18
status: complete
---

# Phase 3 Plan 10: Stage Intro Summary

**Every stage start (and every restart) opens with the Phase 2 respawn fly-in, no invulnerability, under a fading STAGE 1 banner for 120 steps, and the terrain-anchored wreck and scorch rings clear on the new STAGE_START event.**

## Performance

- **Duration:** ~11 min (start time was not recorded; estimated from the commit timestamps)
- **Completed:** 2026-10-18
- **Tasks:** 2 (Task 1 a tracer, both TDD)
- **Files modified:** 18 (11 source, 7 test); the plan listed 16, the extras are `protocol.py` (comment) and `tests/scorched_web/test_entrypoint.py`

## Accomplishments

- `PlayerLife.begin_fly_in(ship, invuln)` places the ship below the playfield and starts RESPAWN with an arrival window; `arrival_invuln` falls back to the 150-step default once granted, so a later death respawn still blinks.
- `StageFlow` starts in INTRO: the first step pushes `STAGE_START` (a = stage number), `INTRO_TICKS` (120) steps later the state is PLAY. `progress` is `timer / INTRO_TICKS` during INTRO and 0 otherwise; `reset()` returns to INTRO.
- `Game` in stage mode calls `begin_fly_in(ship, 0)` through `_open_stage()` at construction and in `restart()`; header `FLOW_T` is the intro progress. The gallery is untouched (ALIVE, FLOW -1).
- `createBannerOverlay({ doc, flowStates })` shows `STAGE n` while FLOW is INTRO, fully opaque until FLOW_T 0.7 and then fading to 0, hidden otherwise; text and opacity are written only on change. `#banner` is neon cyan, pointer-events none, z-index 4.
- `wreck_ring` and `decal_ring` clear every stored entry on `events.STAGE_START`.
- `intro.spec.js`: STAGE 1 shows, the fly-in is seen, INVULN stays 0 until PLAY, FLOW reaches PLAY, the banner hides; the gallery has no banner.

## Task Commits

1. **Task 1 (tracer): the stage opens with the ship flying in under a fading STAGE 1 banner**
   - RED `8f65a5b` (test): 15 tests failed on the missing behaviour (INTRO not the initial state, `begin_fly_in` and `stage_number` absent, Game starting in PLAY). The `INTRO_TICKS` constant is part of this commit so the failures are assertions and missing attributes, not an import error. The banner JS test file was written next and failed to load because its module did not exist, then passed against the implementation.
   - GREEN `98d8b32` (feat): Python side
   - GREEN `120644d` (feat): banner, markup, main.js wiring and intro.spec.js
2. **Task 2: wrecks and scorch marks are cleared when a stage starts again**
   - RED and GREEN in `a0bf9b0` (feat): 5 new tests failed against the old rings before the clears were added (verified by running the suites between writing the tests and the code).

Tracer gate: lint, `make test` (1490 Python tests at 100% coverage, 1151 vitest tests), `make build`, and the intro, stage and gameover specs all passed before Task 2 began (tracer verified end to end, then expanded).

## Files Created/Modified

See the frontmatter `key-files`.

## Decisions Made

- `StageFlow.stage_number` (default 1) is set by `Game` from `StageData.number`; the flow itself pushes the event.
- The `?at=` jump and the intro fly-in live in `Game._open_stage()`, shared by `__init__` and `restart()`.
- After the fly-in lands (about 29 steps) the ship is ALIVE and steerable under the rest of the banner; FLOW stays INTRO until step 120, as the plan specifies (the ship can already be controlled but the flow has not entered PLAY).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Existing stage-mode tests assumed a stage starts in PLAY with an ALIVE ship**
- **Found during:** Task 1 (GREEN)
- **Issue:** 33 Python tests (test_game.py, test_entrypoint.py) put a bullet on the ship or tick a stage game at step 0; during the intro the ship is in RESPAWN and cannot be hit, and FLOW is INTRO.
- **Fix:** a `_skip_intro(game)` test helper (PLAY, fresh life and ship) used by `_stage_game` and by the few tests that build `Game(stage=STAGE_1, ...)` directly; tests that asserted the post-restart state now assert INTRO, RESPAWN and the below-playfield ship; two entrypoint tests assert INTRO.
- **Files modified:** tests/scorched_core/game/test_game.py, tests/scorched_web/test_entrypoint.py
- **Commit:** 98d8b32

**2. [Rule 3 - Blocking] `Game.__init__` exceeded ruff's statement limit (PLR0915, 52 > 50)**
- **Found during:** Task 1 (GREEN)
- **Fix:** moved the `?at=` jump and the fly-in into `Game._open_stage()`, which `restart()` also uses.
- **Files modified:** src/scorched_core/game/game.py
- **Commit:** 98d8b32

**3. [Rule 1 - Bug] Stale comment on header slot FLOW_T**
- **Found during:** Task 1
- **Issue:** `protocol.py` described FLOW_T as "seconds spent in the current flow state", but the plan defines it as the intro progress 0..1.
- **Fix:** comment corrected (no value or layout change).
- **Files modified:** src/scorched_core/protocol.py
- **Commit:** 98d8b32

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug). **Impact:** none on behaviour; two extra files touched (`protocol.py` comment, `test_entrypoint.py`).

## Deferred Issues

- `tools/e2e/score.spec.js` is flaky (a stale HIGH_SCORE read against a later DOM value, seen once in three runs). It is a race inside the spec, not caused by the intro. Logged in `deferred-items.md`.

## Known Stubs

None.

## Threat Flags

None. T-03-13 is mitigated: the banner text is the constant prefix `STAGE ` plus an integer from the header, written only through `textContent`. T-03-SC: no packages added, lockfiles unchanged.

## Issues Encountered

None beyond the deferred spec flake above.

## Next Phase Readiness

Ready for 03-11. `banner_overlay.js` is the place for the WARNING and STAGE CLEAR banners; FLOW_T currently carries only the INTRO progress and later states can extend `StageFlow.progress`.

## Self-Check: PASSED

- Created files exist: banner_overlay.js, banner_overlay.test.js, intro.spec.js (FOUND).
- Commits exist on the branch: 8f65a5b, 98d8b32, 120644d, a0bf9b0 (FOUND).
- Acceptance criteria re-run: `def begin_fly_in`, `INTRO_TICKS: Final = 120`, `createBannerOverlay` in banner_overlay.js and main.js, `STAGE_START` in both rings (all match); `make lint`, `make test` (100% coverage), `make build`, and the intro, stage, gameover and ground Playwright specs pass.
