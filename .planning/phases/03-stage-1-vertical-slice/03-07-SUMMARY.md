---
phase: 03-stage-1-vertical-slice
plan: 07
subsystem: scoring
tags: [scoring, extends, lives, hud, status-readout, header-protocol, playwright]

requires:
  - phase: 03-stage-1-vertical-slice
    provides: "header slots H_SCORE/H_HIGH_SCORE/H_LIVES/H_NEW_RECORD and EV_EXTEND (03-04), the EnemyPool kill buffer and stage timeline (03-06)"
provides:
  - "scorched_core.scoring.ScoreKeeper: int score clamped at SCORE_CAP, lives, high score, best at start, next extend, award(), new_record, reset_run()"
  - "Tuning: ENEMY_POINTS, SCORE_CAP, MAX_BONUS_POINTS, LIVES_START, LIVES_CAP, EXTEND_FIRST, EXTEND_EVERY"
  - "Game(high_score=), Game.score, Game._award_kills; header SCORE, HIGH_SCORE, LIVES, NEW_RECORD written every tick"
  - "HUD root #status-readout with .hud-top (.score, .hiscore) and .hud-bl (.lives, .weapon, .level, .bombs); status_readout.update(header, slots)"
  - "tools/e2e/score.spec.js"
affects: [03-14, 03-15, 03-17, 03-22, 03-26]

actuals:
  tokens: 10500
  tasks: 2
  commits: 4
plan_head_before: 5bb4293d0d6f102ca73118c46dc7903f1a951460
plan_head_after: 3f705db206ece4d8b8f2f91049fc5b036c2b40ac
commits: 4

tech-stack:
  added: []
  patterns:
    - "Score is a Python int clamped at the cap; extends are computed on the int, the float32 header only displays it"
    - "HUD update takes (header, slots) and does change-only textContent writes per field"
    - "Per-kind points live in a tuning table indexed by EnemyKind"

key-files:
  created:
    - src/scorched_core/scoring/__init__.py
    - src/scorched_core/scoring/score_keeper.py
    - tests/scorched_core/scoring/test_score_keeper.py
    - tools/e2e/score.spec.js
  modified:
    - src/scorched_core/tuning.py
    - src/scorched_core/game/game.py
    - tests/scorched_core/game/test_game.py
    - tests/scorched_core/entities/test_enemy_kind.py
    - web/src/ui/status_readout.js
    - web/test/ui/status_readout.test.js
    - web/src/main.js
    - index.html

key-decisions:
  - "Kill payout runs through Game._settle_kills (remove_dead, _award_kills, _drop_pickups) so _step stays under the 50-statement lint limit"
  - "Lives icons are U+25B2 triangles in the player trim cyan set by the stylesheet, capped at 9 icons (LIVES_CAP)"
  - "reset_run keeps the running high score and makes it the new best_at_start, so NEW_RECORD means above the best the run started with"

patterns-established:
  - "Any later scoring source (parts, scenery, medals) calls game.score.award(points, events, x, y) so extends and the cap apply uniformly"

requirements-completed: [SCOR-01, SCOR-04, SCOR-08]

coverage:
  - id: D1
    description: "Each enemy kind pays fixed points from a data table (JET 300, HELI 800, CARRIER 2000, TANK 1000, TURRET 1200), no multiplier, and a MAXED catch pays a flat 10,000"
    requirement: SCOR-01
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_every_kind_pays_its_fixed_points_with_no_multiplier_scoring"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_a_maxed_catch_pays_the_flat_bonus_and_still_counts_scoring"
        status: pass
      - kind: e2e
        ref: "tools/e2e/score.spec.js#kills raise SCORE and the HUD score and high score match the header"
        status: pass
    human_judgment: false
  - id: D2
    description: "Extends at exactly 200,000 and then every 500,000, double crossings, lives cap and score cap behave as specified, and the header SCORE is exact at 9,999,999"
    requirement: SCOR-04
    verification:
      - kind: unit
        ref: "tests/scorched_core/scoring/test_score_keeper.py (extend and cap tests)"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_the_header_reads_back_the_capped_score_exactly_cap"
        status: pass
    human_judgment: false
  - id: D3
    description: "HUD shows score and high score along the top and lives as ship icons at the bottom left, written through textContent only and only on change"
    requirement: SCOR-08
    verification:
      - kind: unit
        ref: "web/test/ui/status_readout.test.js (score, high score and lives suites)"
        status: pass
      - kind: e2e
        ref: "tools/e2e/score.spec.js, weapons.spec.js, bomb.spec.js"
        status: pass
    human_judgment: false
  - id: D4
    description: "HUD placement and look (top-centre score row, bottom-left lives, cyan icons) reads well on desktop and phone"
    requirement: SCOR-08
    verification: []
    human_judgment: true
    rationale: "Layout and legibility are visual; plan 03-26 lays the HUD out from the projected playfield and the vertical-slice gate reviews it"

duration: 9 min
completed: 2026-10-18
status: complete
---

# Phase 3 Plan 07: Scoring, Extends and HUD Score/Lives Summary

**ScoreKeeper pays fixed per-kind kill points (plus a flat MAX bonus), grants extends at 200,000 then every 500,000 with an int score clamped at 9,999,999, and the HUD shows score, high score and lives icons through change-only textContent writes.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-10-18T16:45:00Z
- **Completed:** 2026-10-18T16:54:00Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- Kills show up in the score: `Game._award_kills` pays `ENEMY_POINTS[kind]` for every entry of the per-step kill buffer, and a MAXED pickup also pays `MAX_BONUS_POINTS` (the `max_bonus` counter still counts).
- `ScoreKeeper.award` clamps the int score at 9,999,999, raises the high score, and grants every reached extend threshold: exact landing counts, a double crossing grants two lives and two EXTEND events, and at 9 lives the threshold advances with no life or event.
- Header SCORE, HIGH_SCORE, LIVES and NEW_RECORD are written each tick; `Game(high_score=)` is the hook plan 03-22 feeds from localStorage.
- `status_readout.update(header, slots)` replaces the positional signature and writes score, high score, lives icons, weapon, level and bomb pips only on change; `#status-readout` is now the HUD root with `.hud-top` and `.hud-bl`.
- `score.spec.js` shoots down a real enemy in stage 1 and checks the HUD text equals the header SCORE and HIGH_SCORE.

## Task Commits

1. **Task 1 (tracer): kills raise SCORE and the HUD score updates**
   - RED `12a170e` (test), GREEN `749ac9c` (feat)
2. **Task 2: extends and the lives icons**
   - RED `6a06f88` (test), GREEN `3f705db` (feat)

**Plan metadata:** recorded in the docs commit that follows this file.

Tracer gate: both `<verify>` blocks (lint, pytest 100% coverage, vitest, build, score/weapons/bomb Playwright specs) passed before Task 2 started, so expansion went ahead.

## TDD Gate Compliance

RED then GREEN commits exist for both tasks. RED evidence: Task 1 pytest failed at collection with `ModuleNotFoundError: scorched_core.scoring` (the planned new module) and the vitest run failed 14 assertions on the new `update(header, slots)` contract; Task 2 failed 9 pytest assertions and 8 vitest assertions on the extend loop and the lives icons. Semantic assessment: the Python Task 1 RED is an import failure for a module that did not yet exist, the planned reason; every other RED is an assertion on the planned behaviour. No separate REFACTOR commit was needed.

## Files Created/Modified

- `src/scorched_core/scoring/score_keeper.py` - ScoreKeeper dataclass: award with extend loop, new_record, reset_run
- `src/scorched_core/tuning.py` - ENEMY_POINTS and the score/lives/extend constants
- `src/scorched_core/game/game.py` - ScoreKeeper wiring, `_settle_kills`/`_award_kills`, MAX bonus, header slots, `high_score` option
- `web/src/ui/status_readout.js` - `update(header, slots)`, score/high score/lives fields with change-only writes
- `index.html` - HUD markup and CSS (`.hud-top`, `.score`, `.hiscore`, `.hud-bl`, `.lives`)
- `web/src/main.js` - `readout.update(header, slots)`
- `tools/e2e/score.spec.js` - new e2e spec
- Tests: `test_score_keeper.py` (new), `test_game.py`, `test_enemy_kind.py`, `status_readout.test.js`

## Decisions Made

- Moved remove_dead, `_award_kills` and `_drop_pickups` behind one `_settle_kills` call so `_step` stays within ruff's 50-statement limit; behaviour and order are unchanged.
- `reset_run` makes the running high score the new best at start, so NEW_RECORD stays "above the best the run began with".
- Left the flagged SCOR-01 edge assumption as is: bomb, laser and missile kills all flow through the shared kill buffer and pay like bolt kills; enemies that leave the screen pay nothing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `_step` exceeded the 50-statement lint limit**
- **Found during:** Task 1 GREEN (`ruff check`: PLR0915, 51 > 50)
- **Issue:** Adding `_award_kills()` after `remove_dead` made `Game._step` 51 statements.
- **Fix:** Introduced `Game._settle_kills()` wrapping remove_dead, `_award_kills`, `_drop_pickups`; `_step` calls it once. `_award_kills` and the `score.award(` call still exist as the plan names them.
- **Files modified:** src/scorched_core/game/game.py
- **Verification:** `make lint`, full pytest at 100% coverage
- **Committed in:** 749ac9c

**2. [Rule 3 - Blocking] Test import order after the module existed**
- **Found during:** Task 1 to Task 2 transition
- **Issue:** The RED test file imported `scorched_core.scoring` before it existed, so ruff sorted it as third-party; once the module existed `ruff check` flagged the order.
- **Fix:** `ruff check --fix` re-sorted the imports; folded into the Task 2 RED commit.
- **Files modified:** tests/scorched_core/scoring/test_score_keeper.py
- **Committed in:** 6a06f88

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Lint-driven only; no behaviour or scope change.

## Issues Encountered

None. The commits were made on `main` because the orchestrator ran this plan sequentially on the main working tree, as in the earlier Phase 3 plans.

## Known Stubs

None. `reset_run` has no caller yet (the run-restart flow arrives in a later plan) but is unit tested.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None. T-03-08 (score clamped before the float32 header) and T-03-09 (HUD via textContent only, no innerHTML, asserted by an existing test) are both mitigated.

## Next Phase Readiness

- Later plans (parts 03-14, scenery 03-15, medals 03-17) can call `game.score.award(points, events, x, y)` and get extends and the cap for free.
- Plan 03-22 can pass `high_score=` from localStorage; plan 03-26 can place the HUD blocks and add the EXTEND banner from the EV_EXTEND event.
- Open question from the plan stays: lives shown as total ships including the current one; revisit at the vertical-slice gate.

## Self-Check: PASSED

All created files exist and all four commits (12a170e, 749ac9c, 6a06f88, 3f705db) are ancestors of HEAD. Final `make lint`, `make test` (1404 pytest at 100% line+branch coverage, 1105 vitest) and the score, weapons and bomb Playwright specs passed.

---
*Phase: 03-stage-1-vertical-slice*
*Completed: 2026-10-18*
