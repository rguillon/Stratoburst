---
phase: 03-stage-1-vertical-slice
plan: 21
subsystem: stage-flow-scoring
tags: [tally, stage-clear, run-loop, stage-flow, scoring, tally-panel, banner, vitest, playwright, tdd]

requires:
  - phase: 03-stage-1-vertical-slice
    provides: CLEAR state and flow.boss_destroyed (03-19); MedalChain.collected and stage_reset (03-11); ScoreKeeper.award with the cap and extends (03-07); PlayerLife.deaths and begin_fly_in (03-08); banner overlay (03-10, 03-20); header slots H_TALLY_* and events EV_TALLY_LINE / EV_STAGE_CLEAR (03-02)
provides:
  - scoring/stage_tally.py StageTally (compute, reveal_next, reset) and eight tuning constants (CLEAR_TICKS, TALLY_LINE_TICKS, TALLY_HOLD_TICKS, STAGE_CLEAR_TICKS, four bonus amounts)
  - StageFlow CLEAR hold, TALLY (one line per 60 steps through score.award) and STAGE_CLEAR (event, save request, restart callback) states, then the D-27 loop back to INTRO
  - Game._restart_stage and the TALLY_* / TALLY_N header slots written from flow.tally
  - web/src/ui/tally_panel.js createTallyPanel, the #tally markup and CSS, the STAGE CLEAR banner text
  - tools/e2e/flow.spec.js (boss kill to four tally lines to STAGE CLEAR to a new loop with the score kept)
affects: [03-22 onward (run loop is now closed), 03-28 vertical-slice gate (play stage 1 start to boss and round again)]

actuals:
  tokens: 12400
  tasks: 2
  commits: 4
plan_head_before: fdd5bf115f0f24762c3e8cdfe8dca2b39d78fb4f
plan_head_after: b7ae54ed5a249bf4a5bc28a44cefaca95f85e60c

tech-stack:
  added: []
  patterns:
    - "The tally is state, not events: amounts are computed once when TALLY begins and the header carries them with a revealed count, so the panel rebuilds from any frame"
    - "A flow reads game state it does not own through bound callables (get_bombs, on_stage_restart) wired once at Game construction, so a replaced Bomb object never goes stale"
    - "reset() (a new run) and _rewind() (the next loop) share one body; only a new run clears a pending save request"

key-files:
  created:
    - src/scorched_core/scoring/stage_tally.py
    - tests/scorched_core/scoring/test_stage_tally.py
    - web/src/ui/tally_panel.js
    - web/test/ui/tally_panel.test.js
    - tools/e2e/flow.spec.js
  modified:
    - src/scorched_core/tuning.py
    - src/scorched_core/stages/stage_flow.py
    - tests/scorched_core/stages/test_stage_flow.py
    - src/scorched_core/game/game.py
    - tests/scorched_core/game/test_game.py
    - web/src/ui/banner_overlay.js
    - web/test/ui/banner_overlay.test.js
    - web/src/main.js
    - index.html

key-decisions:
  - "The first tally line is paid on the first TALLY step and each next one 60 steps later, so the panel is never empty on screen; the hold after the fourth is 120 steps"
  - "The loop restart keeps save_requested up (only reset() for a new run clears it), so the high-score adapter cannot lose the save the STAGE_CLEAR raised"
  - "Tally lines are announced at the playfield centre for any extend they trigger (the flow has no ship position)"
  - "The loop restarts at distance 0 even for an ?at=boss run (only a game-over restart honours ?at), as the plan accepted"
  - "An extend can fire from the tally (200000 passed), so the e2e compares lives against the value at STAGE_CLEAR, not before the tally"

patterns-established:
  - "Counters a stage tally needs (deaths, medals caught) are re-based on the first INTRO step, so every loop and every restart counts from its own start"

requirements-completed: [SCOR-03, SCOR-05]

coverage:
  - id: D1
    description: "After the boss a four-line tally (boss, medals, no miss, bombs) is computed once and revealed in a fixed order, each line paid exactly once through score.award"
    requirement: SCOR-03
    verification:
      - kind: unit
        ref: "tests/scorched_core/scoring/test_stage_tally.py"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/stages/test_stage_flow.py#test_each_revealed_line_is_added_to_the_score_exactly_once"
        status: pass
      - kind: e2e
        ref: "tools/e2e/flow.spec.js"
        status: pass
    human_judgment: false
  - id: D2
    description: "The tally is state: header TALLY_* amounts and TALLY_N follow it and are zero outside CLEAR / TALLY / STAGE_CLEAR"
    requirement: SCOR-03
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_the_boss_kill_leads_to_clear_then_a_tally_that_adds_four_lines_to_the_score"
        status: pass
    human_judgment: false
  - id: D3
    description: "The tally panel shows rows as they are revealed and counts each number up over half a second"
    requirement: SCOR-03
    verification:
      - kind: unit
        ref: "web/test/ui/tally_panel.test.js"
        status: pass
      - kind: e2e
        ref: "tools/e2e/flow.spec.js"
        status: pass
    human_judgment: true
    rationale: "Whether the count-up pacing, layout and night-palette styling feel like an arcade stage-clear screen is a judgment call; tests pin the mechanics only"
  - id: D4
    description: "STAGE CLEAR then stage 1 restarts at distance 0 through the intro with score, lives, weapon, level and bombs kept and the pools cleared (D-27)"
    requirement: SCOR-05
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_the_boss_kill_runs_through_the_tally_and_stage_clear_back_to_the_intro"
        status: pass
      - kind: e2e
        ref: "tools/e2e/flow.spec.js"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-10-18
status: complete
---

# Phase 3 Plan 21: Stage-Clear Tally and Run Loop Summary

**A four-line bonus tally (boss, medals, no miss, bombs) counted up on screen after the bomber, a brief STAGE CLEAR, and a D-27 loop that restarts stage 1 at distance 0 with score, lives, weapon and bombs kept.**

## Performance

- **Duration:** about 25 min
- **Started:** 2026-10-18 (about 19:58Z, not recorded exactly)
- **Completed:** 2026-10-18T20:25Z
- **Tasks:** 2 (a tracer and an auto task, both TDD)
- **Files modified:** 14 (5 created, 9 modified)

## Accomplishments

- `StageTally` computes the four amounts once (100000 for a destroyed boss, 1000 per medal collected this stage, 50000 only when no ship was lost, 10000 per unused bomb) and reveals them in a fixed order; a fifth reveal raises.
- `StageFlow` holds CLEAR for 120 steps, runs TALLY (a line every 60 steps, each pushing one TALLY_LINE event and paid through `ScoreKeeper.award` so the cap and extends apply), holds 120 steps, then STAGE_CLEAR (one event, one save request, 150 steps) and calls the game's stage restart.
- `Game._restart_stage` puts the scroll at 0 at full speed, resets the director, empties the enemy, bullet, missile and pickup pools and flies the ship in; score, lives, weapon, level and the same Bomb object are untouched.
- The tally is header state (TALLY_BOSS / MEDALS / NO_MISS / BOMBS and TALLY_N), zero outside CLEAR, TALLY and STAGE_CLEAR; `createTallyPanel` rebuilds from any frame and writes a number only when the shown integer changes; the banner says STAGE CLEAR.
- `flow.spec.js` plays the whole chain in the production build: boss kill, four rows counting up, the exact score delta, STAGE CLEAR, INTRO again with STAGE_DIST under 100 and LIVES unchanged.

## TDD Gate Compliance

- **RED (Task 1):** `d762696` `test(03-21)`. StageTally, the flow fields and `createTallyPanel` did not exist, so a clean import-time failure was impossible (INVALID_RED); the RED commit therefore carries the tuning constants (data only), a `StageTally` skeleton whose methods raise `NotImplementedError` and a `createTallyPanel` stub that throws. 24 pytest and 12 vitest tests failed on the missing behaviour (NotImplementedError, AttributeError on the new flow fields, the stub error). Semantic assessment: every failure traces to the planned behaviour being absent, none to a syntax, collection or fixture fault in the tests themselves, but several are attribute or stub errors rather than value assertions.
- **GREEN (Task 1):** `2c05c3e` `feat(03-21)`. All of the above pass, 100% coverage, flow.spec.js and boss.spec.js pass.
- **RED (Task 2):** `c33e685` `test(03-21)`. 12 pytest (flow and game) and 2 vitest (banner) tests failed: no `on_stage_restart`, no STAGE_CLEAR event or save request, no `_restart_stage`, no STAGE CLEAR banner text.
- **GREEN (Task 2):** `b7ae54e` `feat(03-21)`. No REFACTOR commit was needed.

## Task Commits

1. **Task 1 (tracer): killing the bomber leads to a four-line bonus tally** - `d762696` (test), `2c05c3e` (feat)
2. **Task 2: STAGE CLEAR, then stage 1 starts again with everything kept** - `c33e685` (test), `b7ae54e` (feat)

**Plan metadata:** the docs commit that carries this SUMMARY, STATE.md, ROADMAP.md and REQUIREMENTS.md.

The tracer gate ran in auto/end-of-phase mode with an automated-only verify: `make lint && make test` and `make build && npx playwright test tools/e2e/flow.spec.js tools/e2e/boss.spec.js` re-ran green before Task 2 started (tracer verified end to end, expanding).

## Files Created/Modified

- `src/scorched_core/scoring/stage_tally.py` - StageTally and LINES
- `src/scorched_core/tuning.py` - CLEAR_TICKS, TALLY_LINE_TICKS, TALLY_HOLD_TICKS, STAGE_CLEAR_TICKS and the four bonus amounts
- `src/scorched_core/stages/stage_flow.py` - chain, get_bombs, on_stage_restart, tally; CLEAR hold, TALLY and STAGE_CLEAR steps; `_rewind`
- `src/scorched_core/game/game.py` - flow wiring, `_restart_stage`, `_pack_tally_header`
- `web/src/ui/tally_panel.js`, `index.html` (`#tally` markup and CSS), `web/src/main.js` - the panel, driven every frame with the frame clock
- `web/src/ui/banner_overlay.js` - STAGE CLEAR text
- `tests/scorched_core/scoring/test_stage_tally.py`, `tests/scorched_core/stages/test_stage_flow.py`, `tests/scorched_core/game/test_game.py`, `web/test/ui/tally_panel.test.js`, `web/test/ui/banner_overlay.test.js`, `tools/e2e/flow.spec.js`

## Decisions Made

See key-decisions above. The one that touches a plan sentence: the plan says STAGE_CLEAR ends with a `reset()` to INTRO, but `reset()` clears `save_requested`. The loop uses a shared `_rewind()` instead and leaves the request up for the adapter, so a save raised on entering STAGE_CLEAR cannot be silently dropped.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Existing tests assumed CLEAR holds forever**
- **Found during:** Task 1 (GREEN)
- **Issue:** `test_clear_holds_and_pushes_nothing_more` (600 steps in CLEAR) and the game test that watches CLEAR for 120 ticks encoded the 03-19 placeholder behaviour that this plan replaces.
- **Fix:** Both now hold for `CLEAR_TICKS - 1` further steps and still assert nothing is pushed and the field stays empty.
- **Files modified:** tests/scorched_core/stages/test_stage_flow.py, tests/scorched_core/game/test_game.py
- **Committed in:** d762696 (RED commit)

**2. [Rule 1 - Bug] The e2e compared lives from before the tally**
- **Found during:** Task 2 (flow.spec.js)
- **Issue:** The tally's 150000 pushed the score past the 200000 extend, so LIVES rose from 3 to 4 inside the tally and the "lives unchanged" check failed against a pre-tally reading. The game is right (extends can trigger from the tally, as the plan requires); the spec was wrong.
- **Fix:** Lives are read at STAGE_CLEAR and compared after the INTRO.
- **Files modified:** tools/e2e/flow.spec.js
- **Committed in:** b7ae54e

---

**Total deviations:** 2 auto-fixed (2 Rule 1)
**Impact on plan:** Both were test expectations that the plan's own behaviour supersedes. No scope creep. The `_rewind()` choice is a design decision recorded above rather than a bug fix.

## Issues Encountered

- A tally of equal or zero amounts needed a deliberate order rule; the reveal index (not the amount) drives the timing, so equal amounts keep the fixed order.
- The commit protocol's protected-branch assertion would trip on `main`; the orchestrator runs this phase sequentially on `main` by design (no origin remote), as every earlier plan did, so commits were made on `main` with the project-root pin passing before each.

## Known Stubs

None. The only stubs were the RED-commit skeletons, replaced in the GREEN commit.

## Threat Flags

None. T-03-26 is mitigated as planned: every tally amount goes through `ScoreKeeper.award` (cap and extend rules apply) and the panel writes integers through `textContent` only.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Stage 1 plays start to boss, tally, STAGE CLEAR and round again until game over.
- Open from earlier plans and left alone, as instructed: boss data and hit rules (the open user design decision).
- The loop restarts at distance 0 even for an `?at=boss` run, so playtesting the boss repeatedly needs a game-over restart or a page reload.

## Self-Check: PASSED

- Created files present: stage_tally.py, test_stage_tally.py, tally_panel.js, tally_panel.test.js, flow.spec.js (verified with `[ -f ]` below).
- Commits `d762696`, `2c05c3e`, `c33e685`, `b7ae54e` are ancestors of HEAD.
- `make lint` clean, `make test` green at 100% line and branch coverage (2001 pytest, 1560 vitest), `make build` plus flow, boss, intro, gameover, stage, score, midboss and smoke Playwright specs pass, `make perf` averages 0.6 to 0.7 ms against a 3 ms budget.

---
*Phase: 03-stage-1-vertical-slice*
*Completed: 2026-10-18*
