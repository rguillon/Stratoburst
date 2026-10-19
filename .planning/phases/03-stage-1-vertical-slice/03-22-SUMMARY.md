---
phase: 03-stage-1-vertical-slice
plan: 22
subsystem: persistence-bridge
tags: [high-score, localStorage, pyodide-adapter, test-flags, untrusted-input, tdd, playwright]

requires:
  - phase: 03-stage-1-vertical-slice
    provides: Game(high_score=), Game.score.high_score, Game.save_requested and clear_save_request (03-07, 03-08, 03-21); SCORE_CAP (03-07); WebGame and create_game option helpers (03-04, 03-08); the HIGH_SCORE header slot and HUD (03-10)
provides:
  - bridge/high_score_store.py HighScoreStore (load, save), KEY "scorched:best:1", browser_storage()
  - create_game(options, get_storage=browser_storage) that starts Game with the stored best, and _TEST_FLAGS that make the store read-only
  - WebGame(game, sink, store) saving at save requests and on the pause transition (tick and set_paused), never per frame
  - tools/e2e/highscore.spec.js (an honest run's best survives a reload; a god-flagged run's never does)
affects: [04 top-10 table (the key is versioned), 03-28 vertical-slice gate]

actuals:
  tokens: 9800
  tasks: 2
  commits: 4
plan_head_before: efc3f9803d701d01c3f96c71d23e5173652ed2f6
plan_head_after: 4b96977f8889374e9d2f3ba0cb0f3c63232d4ca2

tech-stack:
  added: []
  patterns:
    - "Browser storage is optional and untrusted: every access (getter, getItem, setItem) sits in one try, and a stored value is accepted only as 1 to 8 ASCII digits clamped to SCORE_CAP"
    - "The store remembers the best it last read or wrote and writes only when a score beats it; a failed write leaves that unchanged so a later flush retries"
    - "A session is a test run when any gameplay flag is truthy; the store is then read-only (loads, never saves)"

key-files:
  created:
    - src/scorched_web/bridge/high_score_store.py
    - tests/scorched_web/bridge/test_high_score_store.py
    - tools/e2e/highscore.spec.js
  modified:
    - src/scorched_web/entrypoint.py
    - tests/scorched_web/test_entrypoint.py
    - src/scorched_web/web_game.py
    - tests/scorched_web/test_web_game.py

key-decisions:
  - "A save request is always acknowledged by WebGame (clear_save_request), with or without a store, so the request can never stay up forever"
  - "Test-flag detection uses truthiness (gallery, god, weapon, level, bombs, lives, at, stress, crash): any non-empty value counts even if Game would ignore it, the conservative reading of 'never persist a cheat run'"
  - "A failed read leaves the baseline at 0, so a later honest score can overwrite a poisoned or unreadable value"
  - "No BLE001 noqa: the project ruff selection does not enable BLE, so the broad except carries a comment instead of an (unused, RUF100) noqa"

patterns-established:
  - "Adapter-side persistence lives in scorched_web/bridge behind an injected getter; scorched_core stays free of js (tests/test_conventions.py still passes)"

requirements-completed: [SCOR-08]

coverage:
  - id: D1
    description: "The best score of a flag-free run is read once at start through js.localStorage, fed to Game as the starting best, and is the HIGH_SCORE again after a reload"
    requirement: SCOR-08
    verification:
      - kind: unit
        ref: "tests/scorched_web/test_entrypoint.py#test_the_stored_best_is_the_starting_high_score"
        status: pass
      - kind: e2e
        ref: "tools/e2e/highscore.spec.js#the best score of a flag-free run survives a reload"
        status: pass
    human_judgment: false
  - id: D2
    description: "The best is written only at natural flush points (save request, pause transition, set_paused(True)) and only when it beats the stored value"
    requirement: SCOR-08
    verification:
      - kind: unit
        ref: "tests/scorched_web/test_web_game.py"
        status: pass
      - kind: unit
        ref: "tests/scorched_web/bridge/test_high_score_store.py#test_a_worse_or_equal_score_afterwards_writes_nothing"
        status: pass
    human_judgment: false
  - id: D3
    description: "Missing js, a throwing localStorage / getItem / setItem and poisoned stored values never break the game; values are digits-only and clamped, junk reads as 0"
    requirement: SCOR-08
    verification:
      - kind: unit
        ref: "tests/scorched_web/bridge/test_high_score_store.py"
        status: pass
    human_judgment: false
  - id: D4
    description: "A run using any test flag never writes a high score; ?debug alone does not block writes"
    requirement: SCOR-08
    verification:
      - kind: unit
        ref: "tests/scorched_web/test_entrypoint.py#test_a_run_with_any_test_flag_is_read_only_and_never_writes_a_best"
        status: pass
      - kind: e2e
        ref: "tools/e2e/highscore.spec.js#a god-flagged run never saves a best score"
        status: pass
    human_judgment: false

duration: 14min
completed: 2026-10-18
status: complete
---

# Phase 3 Plan 22: Persisted Best Score Summary

**The single best score now survives closing the browser: a tolerant localStorage store behind the Pyodide adapter, saved at save requests and pauses, digits-only on read, and read-only for any run that used a test flag.**

## Performance

- **Duration:** about 14 min
- **Started:** 2026-10-18T20:18Z (approximate)
- **Completed:** 2026-10-18T20:32Z
- **Tasks:** 2 (a tracer and an auto task, both TDD)
- **Files modified:** 7 (3 created, 4 modified)

## Accomplishments

- `HighScoreStore(get_storage, enabled=)` with `KEY = "scorched:best:1"`: `load()` accepts only 1 to 8 ASCII digits (clamped to 9,999,999, everything else including non-strings, signs, spaces, exponents and non-ASCII digits reads as 0); `save()` writes only a better score and only the digit string; any exception from the getter, getItem or setItem is swallowed.
- `create_game(options, get_storage=browser_storage)` starts Game with `high_score=store.load()`; `browser_storage()` imports `js` lazily so native runs and Node simply get no storage.
- `WebGame` saves `game.score.high_score` after a tick with `save_requested` (then clears the request), across a tick where `game.paused` turned True, and on `set_paused(True)`; ordinary ticks never touch storage.
- `_TEST_FLAGS` (gallery, god, weapon, level, bombs, lives, at, stress, crash) makes the store read-only for the session; `?debug` alone still saves (Phase 2 IN-05).
- `highscore.spec.js` proves both directions in the production build: an honest stage run's score is the HIGH_SCORE after a reload, a god-flagged run leaves the key unset and HIGH_SCORE at 0.

## TDD Gate Compliance

- **RED (Task 1):** `d5090bc` `test(03-22)`. A `HighScoreStore` skeleton (methods raise `NotImplementedError`, `browser_storage` too) was committed with the tests so the failures are behavioural rather than an import error. 16 pytest tests failed: the store tests on `NotImplementedError`, the WebGame and create_game tests on the missing `store` / `get_storage` parameters (TypeError). Semantic assessment: every failure traces to the planned behaviour being absent; none is a syntax, collection or fixture fault, but several are signature errors rather than value assertions. pytest's text format is not one of the classifier's supported report formats, so `tdd-red-evidence` was not run (same as earlier plans).
- **GREEN (Task 1):** `5bafed6` `feat(03-22)`. All pass, 100% line and branch coverage, `highscore.spec.js` and `pause.spec.js` pass.
- **RED (Task 2):** `aa808d0` `test(03-22)`. 19 pytest tests failed on value assertions: the naive parse loaded " 42", "42 ", "+7", a 9-digit and an 11-digit value, and an int `42` instead of 0; `enabled=False` still wrote; all eleven test-flag runs still wrote a best.
- **GREEN (Task 2):** `4b96977` `feat(03-22)`. No REFACTOR commit was needed.

## Task Commits

1. **Task 1 (tracer): a flag-free run's best score is saved at pause and is the HIGH_SCORE after a reload** - `d5090bc` (test), `5bafed6` (feat)
2. **Task 2: test-flag runs never write; broken or poisoned storage never breaks the game** - `aa808d0` (test), `4b96977` (feat)

**Plan metadata:** the docs commit that carries this SUMMARY, STATE.md, ROADMAP.md and REQUIREMENTS.md.

The tracer gate re-ran `make lint && make test-python` and `make build && npx playwright test tools/e2e/highscore.spec.js tools/e2e/pause.spec.js` green before Task 2 (tracer verified end to end, expanding).

## Files Created/Modified

- `src/scorched_web/bridge/high_score_store.py` - KEY, browser_storage, digits-only parse, HighScoreStore
- `src/scorched_web/entrypoint.py` - get_storage injection, `_TEST_FLAGS`, `_test_run`, `high_score=store.load()`
- `src/scorched_web/web_game.py` - optional store, `_save_best`, flush points in `tick` and `set_paused`
- `tests/scorched_web/bridge/test_high_score_store.py`, `tests/scorched_web/test_entrypoint.py`, `tests/scorched_web/test_web_game.py` - the behaviour lists of both tasks
- `tools/e2e/highscore.spec.js` - reload persistence and the cheat-run case

## Decisions Made

See key-decisions above. Two touch plan sentences: the plan asks for a justified `noqa` on the broad except, but the project's ruff selection does not enable BLE, so a `noqa: BLE001` is flagged RUF100 (unused); a comment states the justification instead. And the plan says "when the flow raises a save request"; `WebGame` clears the request whether or not a store exists, so a store-less game cannot leave it raised.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] My own test asserted the wrong behaviour for a store-less WebGame**
- **Found during:** Task 1 (GREEN)
- **Issue:** `test_without_a_store_pausing_and_save_requests_are_harmless` asserted `clear_save_request` is not called without a store, which would leave a request raised forever.
- **Fix:** The request is acknowledged regardless; the test now asserts it is cleared exactly once.
- **Files modified:** tests/scorched_web/test_web_game.py
- **Committed in:** 5bafed6

**2. [Rule 3 - Blocking] Unused BLE001 noqa directives failed `ruff check` (RUF100)**
- **Found during:** Task 1 (GREEN)
- **Fix:** Replaced them with explanatory comments on the broad excepts (see Decisions Made).
- **Files modified:** src/scorched_web/bridge/high_score_store.py
- **Committed in:** 5bafed6

---

**Total deviations:** 2 auto-fixed (1 Rule 1, 1 Rule 3)
**Impact on plan:** Both were small. No scope creep.

## Issues Encountered

- The commit protocol's protected-branch assertion would trip on `main`; the orchestrator runs this phase sequentially on `main` by design (no origin remote), as every earlier plan did, so commits were made on `main` with the project-root pin passing before each.

## Known Stubs

None. The only stub was the RED-commit skeleton of `high_score_store.py`, replaced in the GREEN commit.

## Threat Flags

None. T-03-27 to T-03-30 are mitigated as planned: digits-only clamped parse with no eval or JSON (T-03-27), every storage access in a try (T-03-28), test flags make the store read-only (T-03-29), and only `scorched:best:1` with a digit string is ever written, asserted by tests (T-03-30). No packages were added.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The HUD high score now persists across browser sessions; Phase 4's top-10 table can read the versioned key and write a new one without a migration break.
- Nothing is saved on `beforeunload`: a tab closed mid-run keeps the best from the last pause, game over or stage clear (browsers pause on hide, which covers most closes).

## Self-Check: PASSED

- Created files present: high_score_store.py, test_high_score_store.py, highscore.spec.js (verified with `[ -f ]`).
- Commits `d5090bc`, `5bafed6`, `aa808d0`, `4b96977` are ancestors of HEAD.
- `make lint` clean, `make test` green at 100% line and branch coverage (2070 pytest, 1560 vitest), `tests/test_conventions.py` passes (core still pure), `make build` plus highscore, pause, smoke, gameover, score and flow Playwright specs pass, `make perf` averages 0.5 to 0.7 ms against a 3 ms budget.

---
*Phase: 03-stage-1-vertical-slice*
*Completed: 2026-10-18*
