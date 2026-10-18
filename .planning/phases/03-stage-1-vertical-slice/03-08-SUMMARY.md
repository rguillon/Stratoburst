---
phase: 03-stage-1-vertical-slice
plan: 08
subsystem: gameplay-core
tags: [lives, game-over, restart, stage-flow, url-flags, python, pyodide]

requires:
  - phase: 03-stage-1-vertical-slice
    provides: "ScoreKeeper (plan 03-07), FlowState and the stage director (03-04), EV_GAME_OVER and the protocol 3 header (03-03)"
provides:
  - "PlayerPhase.OUT (4), PlayerLife.final and PlayerLife.reset()"
  - "ScoreKeeper.lose_life()"
  - "StageFlow state machine (PLAY / GAME_OVER) with one GAME_OVER event and a save request"
  - "EnemyPool.clear(), MissilePool.clear(), PickupPool.clear()"
  - "Game(lives=), Game.flow, Game.save_requested, Game.clear_save_request(), Game.restart(); WebGame.restart()"
  - "?lives=1..9 test flag (parseLives / _lives)"
affects: [03-09 game-over screen and restart input, 03-10 INTRO, 03-17 MIDBOSS, 03-19 WARNING/BOSS/CLEAR, 03-21 TALLY/STAGE_CLEAR, 03-22 high-score adapter]

actuals:
  tokens: 13233
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "life.final is refreshed from score.lives == 0 before every PlayerLife step, so an extend restores a ship up to the end of DYING"
    - "restart() resets in place (pools, life, score, flow, terrain, director) and repacks the header; the gallery raises ValueError"

key-files:
  created:
    - src/scorched_core/stages/stage_flow.py
    - tests/scorched_core/stages/test_stage_flow.py
  modified:
    - src/scorched_core/entities/player_phase.py
    - src/scorched_core/entities/player_life.py
    - src/scorched_core/scoring/score_keeper.py
    - src/scorched_core/stages/flow_state.py
    - src/scorched_core/pools/enemy_pool.py
    - src/scorched_core/pools/missile_pool.py
    - src/scorched_core/pools/pickup_pool.py
    - src/scorched_core/game/game.py
    - src/scorched_web/web_game.py
    - src/scorched_web/entrypoint.py
    - web/src/boot/url_flags.js
    - web/src/main.js

key-decisions:
  - "A life is taken on the confirmed death step (grace expiry) and only in stage mode; a deathbomb save never costs one and the gallery keeps infinite lives"
  - "On the game-over step OUT is reached inside life.step and StageFlow.step (run after the lethal check) flips FLOW to GAME_OVER and pushes the single event in the same step"
  - "StageFlow.spawning is false only in GAME_OVER for now; later plans decide it for INTRO, WARNING, TALLY and the rest as they add those states"
  - "restart() keeps the high score as the new best at start, resets KILLS and MAX_BONUS, and replays the ?at= jump; storm pool and tick_count are deliberately left alone"

requirements-completed: [SCOR-05]

coverage:
  - id: D1
    description: "Stage deaths cost a life; the last one ends the run: PlayerLife reaches OUT, FLOW becomes GAME_OVER and exactly one GAME_OVER event carries the score and the new-record flag"
    requirement: SCOR-05
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_the_last_ship_lost_ends_the_run_in_game_over_lives"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/stages/test_stage_flow.py#test_the_first_step_in_out_ends_the_game_with_one_event_and_a_save_request"
        status: pass
    human_judgment: false
  - id: D2
    description: "Lives edge rules: life taken on the confirmed death, deathbomb save costs none, an extend before the DYING window ends restores a ship, gallery has infinite lives, GAME_OVER event pushed once"
    requirement: SCOR-05
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_a_deathbomb_save_costs_no_life_and_no_game_over_follows_lives"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_an_extend_on_the_step_the_death_is_confirmed_leads_to_a_respawn_lives"
        status: pass
      - kind: e2e
        ref: "tools/e2e/death.spec.js (gallery, infinite lives)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Game.restart() / WebGame.restart() start a fresh run with the starting lives, weapon, level, bombs, empty pools and the high score kept"
    requirement: SCOR-05
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_restart_starts_a_fresh_run_and_keeps_the_high_score_restart"
        status: pass
      - kind: unit
        ref: "tests/scorched_web/test_web_game.py#test_restart_restarts_the_game_and_flushes_every_channel"
        status: pass
    human_judgment: false
  - id: D4
    description: "The ?lives test flag is truncated and clamped to 1..9 in JS and Python, junk means 3"
    requirement: SCOR-05
    verification:
      - kind: unit
        ref: "web/test/boot/url_flags.test.js (lives cases)"
        status: pass
      - kind: unit
        ref: "tests/scorched_web/test_entrypoint.py#test_the_lives_option_is_truncated_and_clamped_and_junk_means_three"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-10-18
plan_head_before: 98c546d0fad0a7012fc097c6851ddf3dc58cc9e2
plan_head_after: b7f4f8a09911a0bb5ab36d0aec5a07a972a8c245
status: complete
---

# Phase 3 Plan 08: Lives, Game Over and Restart Summary

**Stage deaths now cost a life, the last one ends the run through a new StageFlow GAME_OVER state with a single score-carrying event and a save request, and Game.restart() / WebGame.restart() begin a fresh run; `?lives=1..9` makes the flow quick to test.**

## Performance

- **Duration:** ~9 min (start time was not recorded at the beginning of the run; the figure is estimated from the commit timestamps)
- **Completed:** 2026-10-18T17:02:16Z
- **Tasks:** 2 (Task 1 a tracer, both TDD)
- **Files modified:** 24 (13 source and 11 test, one new source file and one new test file)

## Accomplishments

- `PlayerPhase.OUT = 4`: a terminal phase with no control, fire or vulnerability, where `PlayerLife.step` and `hit` change nothing. `PlayerLife.final` makes the DYING window end in OUT instead of a respawn, and `reset()` returns to a fresh ALIVE life.
- `ScoreKeeper.lose_life()` and `StageFlow` (PLAY / GAME_OVER, `spawning`, `save_requested`, `reset`, loud unknown-state arm). Game over is one event (a = score, b = new record) pushed on the step OUT is reached.
- `Game(lives=)` (clamped 1..9), `Game.flow` (None in the gallery), `save_requested` / `clear_save_request()` and `restart()`. The director stops spawning in GAME_OVER (enemies already on screen keep flying).
- `WebGame.restart()` flushes the header and every channel; `?lives` is clamped on both sides (T-03-10 mitigated).
- The ship model hides in OUT (`main.js`), so the last ship does not reappear at its death spot after game over.

## Task Commits

1. **Task 1 (tracer): last ship's death ends the run, restart starts a fresh run**
   - RED `3063abc` (test): 43 new/changed tests failed for the planned reasons (missing `OUT`, `final`, `lose_life`, `clear`, `StageFlow`, `restart`).
   - GREEN `4ba7b45` (feat)
2. **Task 2: ?lives flag, WebGame.restart, edge rules**
   - RED `aee2d14` (test): 11 new tests failed (`_lives`, `parseLives`, `WebGame.restart` missing).
   - GREEN `b7f4f8a` (feat)

**Plan metadata:** the docs commit that follows this SUMMARY (SUMMARY, STATE, ROADMAP, REQUIREMENTS).

Tracer gate: after Task 1, `make lint && make test-python` passed with 100% line and branch coverage before Task 2 began (tracer verified end to end, then expanded).

## Files Created/Modified

- `src/scorched_core/stages/stage_flow.py` - `StageFlow` state machine (PLAY / GAME_OVER)
- `src/scorched_core/entities/player_phase.py`, `player_life.py` - OUT, `final`, `reset()`
- `src/scorched_core/scoring/score_keeper.py` - `lose_life()`
- `src/scorched_core/pools/{enemy,missile,pickup}_pool.py` - `clear()`
- `src/scorched_core/game/game.py` - lives option, flow, `_step_life`, save request, `restart()`
- `src/scorched_web/{entrypoint,web_game}.py`, `web/src/boot/url_flags.js` - `?lives`, `WebGame.restart`
- `web/src/main.js` - hide the ship model in OUT
- Mirrored tests for every module above, including the new `tests/scorched_core/stages/test_stage_flow.py`

## Decisions Made

See `key-decisions` in the frontmatter. In short: a life is taken on the confirmed death; `final` is refreshed before every life step; the game-over step order is OUT, then FLOW GAME_OVER plus one event; `restart()` keeps the high score and replays `?at=`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Hide the ship model in OUT**
- **Found during:** Task 1
- **Issue:** `main.js` hid the ship only for DYING. After game over the ship stays at its death spot, so the last ship would have been drawn again.
- **Fix:** `shipVisible` is also false in `manifest.phases.OUT` (model, hitbox marker and shadow).
- **Files modified:** `web/src/main.js` (not in the plan's `files_modified`)
- **Verification:** vitest and the stage / death e2e specs pass; no unit test covers main.js.
- **Committed in:** `4ba7b45`

**2. [Rule 3 - Blocking] Import order in an existing test**
- **Found during:** Task 1 (`ruff check --fix`)
- **Issue:** `tests/scorched_core/pools/test_enemy_pool.py` had an out-of-order import that ruff flagged once `scorched_core.stages.stage_flow` existed.
- **Fix:** applied the ruff fix (import moved), committed with the Task 2 RED commit.
- **Committed in:** `aee2d14`

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Both are small; no scope creep.

## Issues Encountered

- My first "two lives" test ran 300 steps in the real stage 1 and saw a GAME_OVER: the idle ship was killed again by stage-1 enemies. The test now stops at the respawn; the quiet-stage tests carry the "no game over" assertions.
- **Known edge, not fixed:** `life.step` runs before the kill pass, so an extend that lands on the very last DYING step (the one that enters OUT) is one step too late and the run still ends. An extend on the confirming step, or any step during DYING before the last, restores the ship (both tested). Plan 03-09 or a later plan can move OUT detection after the kill pass if this 1/60 s window matters.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. `StageFlow.timer` counts the steps spent in GAME_OVER but is not published to the FLOW_T header slot yet (plan 03-09 or later decides what to show).

## Threat Flags

None. `lives` is the only new untrusted input and it is clamped on both sides (T-03-10); no packages were added (T-03-SC).

## Next Phase Readiness

- Ready for 03-09 (game-over overlay and restart input): the header carries FLOW 8, LIVES 0, SCORE, HIGH_SCORE and NEW_RECORD, a GAME_OVER event is pushed once, and `WebGame.restart()` is callable from JS.
- Plan 03-22 reads `Game.save_requested` and calls `clear_save_request()`; it must also block high-score writes when `lives` is set.
- Verification run: `make lint` and `make test` green (1479 pytest tests at 100% line and branch coverage, 1116 vitest tests); e2e `death`, `stage` and `score` specs pass (8 tests) against a fresh build.

## TDD Gate Compliance

Both tasks have a `test(03-08)` commit before their `feat(03-08)` commit. No refactor commits.

## Self-Check: PASSED

- Files: `src/scorched_core/stages/stage_flow.py` and `tests/scorched_core/stages/test_stage_flow.py` exist.
- Commits: 3063abc, 4ba7b45, aee2d14 and b7f4f8a are on `main` (`git rev-list --count 98c546d..HEAD` = 4).
- Acceptance greps (`OUT = 4`, `class StageFlow`, `def restart`, `lose_life()`, `def _lives`, `parseLives`) all match.

---
*Phase: 03-stage-1-vertical-slice*
*Completed: 2026-10-18*
