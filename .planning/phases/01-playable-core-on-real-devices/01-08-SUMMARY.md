---
phase: 01-playable-core-on-real-devices
plan: 08
subsystem: timing-and-pause
tags: [fixed-timestep, vsync-snapping, refresh-estimator, auto-pause, visibilitychange, input-edges, tdd, playwright]

requires:
  - phase: 01-playable-core-on-real-devices
    provides: "FixedStepRunner and Game.tick/header FLAGS (01-01, 01-03), Button.PAUSE and the keyboard PAUSE bit (01-06), frame loop resetClock and quality controller resetWarmup (01-04), drones/bolts (01-07)"
provides:
  - "RefreshEstimator: allocation-light 15-dt ring, median snapped to standard rates within 1.5%, dt snapped to whole periods within 25% of a period"
  - "Game.tick feeds refresh.snap(dt) into the fixed-step runner: 600 +/- 1 steps per 10 s at 30, 60, 120 and 144 Hz, under 1% non-1-step frames at 60 Hz"
  - "InputFrame button edge detection (update/pressed/settle)"
  - "Game.set_paused / PAUSE edge toggle: paused ticks return 0 and touch no time, drag or history; resume zeroes accumulator, estimator and owed drag"
  - "WebGame.set_paused publishes the header so JS sees FLAG_PAUSED with no tick"
  - "pause_controller.js: hidden/blur/pagehide auto-pause, #paused overlay, resume only by tap or key, header-FLAGS sync for Escape/P"
  - "playfield.spec scroll e2e measuring per-frame sim progress against the rAF delta instead of a wall-clock floor"
affects: [01-09, 01-10, phase-02-gameplay]

plan_head_before: 8faec687651db27d5528984c5dffbd3aa6e02fa4
plan_head_after: 58244c44f266839f026f1b9183a78f607b5f2275

actuals:
  tokens: 14000
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Python owns the paused state; JS asks via set_paused and mirrors the header FLAGS bit onto the overlay each frame"
    - "Pause triggers (hidden, blur, pagehide) clear every input and reset the frame clock; resume demands a player action"
    - "Sim-progress e2e records per-frame {rAF dt, steps} with a probe registered after the game loop, rather than reading a wall-clock window"
    - "A skeleton class in the RED commit, so RED fails on planned assertions and never on import errors"

key-files:
  created:
    - src/scorched_core/clock/refresh_estimator.py
    - src/scorched_core/input/input_frame.py
    - tests/scorched_core/clock/test_refresh_estimator.py
    - tests/scorched_core/input/test_input_frame.py
    - web/src/loop/pause_controller.js
    - web/test/loop/pause_controller.test.js
    - tools/e2e/pause.spec.js
  modified:
    - src/scorched_core/game/game.py
    - src/scorched_web/web_game.py
    - tests/scorched_core/clock/test_fixed_step_runner.py
    - tests/scorched_core/game/test_game.py
    - tests/scorched_web/test_web_game.py
    - web/src/input/keyboard_input.js
    - web/test/input/keyboard_input.test.js
    - web/src/main.js
    - index.html
    - tools/e2e/playfield.spec.js

key-decisions:
  - "Resume also drops the touch drag the ship still owed (pending_x/y = 0), so a returning player's ship cannot drift on a finger movement from before the pause (prohibition: no ship moved by play that ran without them)"
  - "Alt, Meta, Control and Tab key codes do not count as the resume press: they arrive as the player comes back through an app switcher and are not a deliberate 'I am ready'"
  - "The #paused overlay is a sibling of #app, not a child, so the resume tap never starts a steering pointer in the touch input"
  - "The playfield scroll e2e checks sim progress per frame against the rAF delta (steps >= min(3, floor(dt/step)) - 1, <= ceil+1, scroll == 0.8 * ticks) and adds the real-time rate check only when no frame exceeded 45 ms, so slow software GL cannot fail it and a stalled or runaway sim still does. Gameplay timing is unchanged"
  - "While paused the header still carries the FIRING flag (overlay feedback only) and the runner alpha, but STEPS is 0 and no channel buffer is repacked"

patterns-established:
  - "Pattern: pause is idempotent on both sides (Python set_paused no-ops on no change; JS pause() may be called repeatedly by flapping blur/focus)"
  - "Pattern: e2e timing bounds use a page-side performance.now() taken in the same evaluate as the header read, never the Playwright round-trip duration"

requirements-completed: [PLAT-06, PLAT-08]

coverage:
  - id: D1
    description: "Game speed is identical on 30, 60, 120 and 144 Hz displays: seeded Gaussian 0.4 ms jittered rAF deltas over 10 s give 599..601 simulation steps at every rate, and tick_count equals the steps"
    requirement: PLAT-06
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py::test_the_simulation_runs_six_hundred_steps_in_ten_seconds_at_any_refresh_rate_hz[30|60|120|144] and test_unjittered_144_hz_frames_also_give_six_hundred_steps_in_ten_seconds_hz"
        status: pass
    human_judgment: true
    rationale: "The rates are proven on synthetic timestamps only (Assumption A4); smoothness and speed on a real 120/144 Hz panel is a device judgment (pending human check 3)."
  - id: D2
    description: "Vsync snapping removes stutter: fewer than 1% of jittered 60 Hz frames run a step count other than 1; RefreshEstimator snap rules (3-sample minimum, dt 0 not recorded, 25% period snap, 1.5% rate snap, true median over 15, reset)"
    requirement: PLAT-06
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py::test_vsync_snapping_leaves_under_one_percent_of_60_hz_frames_stuttering_with_jitter; tests/scorched_core/clock/test_refresh_estimator.py (23 tests incl. every standard rate)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Step boundary and clamp edges: dt exactly STEP_MS runs 1 step, STEP_MS - 2e-6 runs 0, dt 0 runs 0 and adds no time, 100 ms gives 3 with the accumulator dropped, 5000 ms gives 3, 60 exact steps give 60; the allocation-growth test stays green with the estimator in the loop"
    requirement: PLAT-06
    verification:
      - kind: unit
        ref: "tests/scorched_core/clock/test_fixed_step_runner.py (boundary tests); tests/scorched_core/game/test_game.py::test_a_five_second_gap_runs_at_most_three_steps_and_drops_the_backlog_boundary, ::test_the_first_frame_with_a_zero_dt_runs_no_step_boundary, ::test_tick_does_not_grow_allocated_blocks"
        status: pass
    human_judgment: false
  - id: D4
    description: "Auto-pause: a PAUSE edge or set_paused(true) freezes the game; while paused tick returns 0, tick_count, terrain, ship, accumulator, estimator and drag are untouched, a 5000 ms dt runs 0 steps, and the header carries FLAG_PAUSED and STEPS 0; a held PAUSE does not retoggle; set_paused(false) while running is a no-op"
    requirement: PLAT-08
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py (16 tests with paused or resume in the name); tests/scorched_core/input/test_input_frame.py (6 tests); tests/scorched_web/test_web_game.py (set_paused delegates and flushes the header)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Resume without a time jump: after set_paused(false) one 16.667 ms tick runs exactly 1 step, a 0.9-step accumulator is zeroed, the refresh history is forgotten and owed drag is dropped"
    requirement: PLAT-08
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py::test_resume_after_a_pause_runs_exactly_one_step_for_one_period_resume, ::test_resume_zeroes_the_accumulator_resume, ::test_resume_forgets_the_refresh_history_resume, ::test_resume_drops_the_drag_the_ship_still_owed_resume"
        status: pass
    human_judgment: false
  - id: D6
    description: "Browser pause behaviour: hidden/blur/pagehide pause with the PAUSED overlay, TICK_COUNT frozen for 1 s, held keys cleared, still paused after returning, a tap or key resumes with no catch-up burst beyond elapsed*60+3, Escape/P toggle through Python, __scorched.paused debug hook"
    requirement: PLAT-08
    verification:
      - kind: unit
        ref: "web/test/loop/pause_controller.test.js (21 tests); web/test/input/keyboard_input.test.js (pagehide and hidden clearing)"
        status: pass
      - kind: e2e
        ref: "tools/e2e/pause.spec.js (6 tests); tools/e2e/smoke.spec.js; tools/e2e/keyboard.spec.js"
        status: pass
    human_judgment: true
    rationale: "Real iOS/Android app switching and tab switching on desktop (Assumption A13) cannot be reproduced headlessly; the e2e only simulates visibilitychange and blur events (pending human checks 1 and 2)."
  - id: D7
    description: "Scroll e2e restored to a meaningful sim-progress assertion: per-frame step count versus rAF dt, exact 0.8 per step, and a real-time 60 Hz rate check whenever the catch-up cap is not engaged"
    requirement: PLAT-06
    verification:
      - kind: e2e
        ref: "tools/e2e/playfield.spec.js 'python-driven terrain scroll advances 0.8 units per 60 Hz step' (passed 4 times locally and in CI; local software GL engages the cap, so the real-time branch is annotated as skipped here)"
        status: pass
    human_judgment: false

duration: 22min
completed: 2026-10-17
status: complete
---

# Phase 1 Plan 08: Refresh-Independent Timing and Auto-Pause Summary

**A median-of-15 vsync snapper in front of the fixed-step runner makes the sim run exactly 600 steps per 10 s at 30, 60, 120 and 144 Hz without stutter, and hiding the tab, losing focus or leaving the page pauses the game behind a PAUSED overlay that only a tap or key (never time) can resume, with accumulator, refresh history and owed drag zeroed.**

## Performance

- **Duration:** about 22 min
- **Started:** 2026-10-17T16:37Z
- **Completed:** 2026-10-17T16:51Z (code pushed, CI, Deploy and live smoke green)
- **Tasks:** 2 (both `auto` + `tdd="true"`, each with a separate RED commit)
- **Files modified:** 17 in the code commits (1111 insertions, 30 deletions); no dependency or lockfile changes

## Accomplishments

- **Refresh independence (PLAT-06).** `RefreshEstimator.snap(dt)` ignores `dt <= 0`, records the delta in a 15-slot `array('d')` ring, and from the third sample on takes the true median (mean of the middle pair for even counts), snaps it to the nearest of 30/60/72/90/120/144/165/240 Hz within 1.5%, and snaps `dt` to the nearest whole number of periods when within 25% of a period (else returns it untouched, so a real hitch stays a hitch). `Game.tick` calls `self._runner.advance(self.refresh.snap(dt_ms))`. With a seeded 0.4 ms Gaussian timestamp jitter the sim runs 599 to 601 steps in 10 s at 30, 60, 120 and 144 Hz, and only the first two unsnapped frames plus the dt-0 first frame at 60 Hz run a step count other than 1 (under 1%, against 98 of 601 frames, 16%, without snapping in the same model).
- **Auto-pause (PLAT-08).** `Game.input` (`InputFrame`) turns the keyboard's held-or-pressed PAUSE bit into an edge; the edge toggles `Game.paused` (Escape or P), and JS calls `set_paused` for hidden/blur/pagehide. A paused `tick` packs the header (STEPS 0, FLAG_PAUSED, FIRING still mirrored) and returns 0 without touching the accumulator, estimator, drag or any channel buffer. `set_paused(False)` zeroes the accumulator, the estimator history, the held PAUSE edge state and the owed touch drag. `WebGame.set_paused` flushes the header so JS sees the flag at once.
- **Pause UI.** `pause_controller.js` listens for `visibilitychange` (hidden), window `blur` and `pagehide`; each clears the keyboard and touch input, resets the frame clock (the next dt is 0) and shows `#paused`. The overlay's `click`/`pointerup` or a window `keydown` (except Escape/P, which Python toggles, and app-switcher keys) resumes: `set_paused(false)`, `resetClock()`, `resetWarmup(now)`. `sync(flags)` runs each frame so Escape/P also drive the overlay. The rAF loop keeps rendering while paused. `keyboard_input.js` also clears on `pagehide` and on `visibilitychange` to hidden.
- **Gates.** `make check` green: ruff, pytest 332 passed at 100.00% line and branch, vitest 255, build, Playwright 28. **`make perf` avg 0.568 ms, p95 0.644 ms** (500 stress bullets, held fire, drones, grid; budget 3 ms; 01-07 measured 0.588/0.725). CI Deploy and E2E workflows succeeded and the live smoke spec passed.

## playfield.spec scroll e2e (carry-over from 01-07)

01-07 had to lower the wall-clock floor from 42 to 24 scroll units because headless software GL rendered the drone and bolt meshes at about 15 to 17 fps, so the runner's 3-steps-per-frame catch-up cap (by design: slow down, never spiral) held the sim near 46 steps/s. The cap is gameplay behaviour and was not changed to suit software GL. Decision:

- The wall-clock window is gone. A probe `requestAnimationFrame` callback, registered after the game's own (browsers run rAF callbacks in registration order), records for every frame over 2 s the rAF delta the game fed to Python together with the `STEPS`, `SCROLL_Y` and `TICK_COUNT` header values.
- Asserted always: `scroll == 0.8 * ticks` over the window (exact, as before); ticks advanced; and for every frame `steps >= min(3, floor(dt/step)) - 1` and `steps <= min(3, ceil(dt/step) + 1)`. This is the real property (the sim runs the steps the elapsed time owes, up to the cap) and is independent of render speed, so a stalled sim (0 steps on a long frame) or a runaway one fails it while slow GL cannot.
- Asserted only when no frame took longer than 45 ms (the cap cannot engage): total steps within 3% plus 3 of total elapsed time / step. This restores the original "keeps real time at 60 Hz" claim on any machine fast enough to render it, instead of a floor that silently depends on GPU speed. The branch taken is recorded as a Playwright annotation (`sim-rate-check`).
- In this environment (software GL) the cap engages, so the real-time branch is skipped here and the always-on part carries the test; on the CI runner the same applies if its GL is also slow. The spec passed repeatedly locally and in CI.

## Task Commits

1. **Task 1 RED:** `0891772` (test) - `RefreshEstimator` skeleton, estimator tests, multi-rate jitter and boundary tests
2. **Task 1 GREEN:** `6d6f247` (feat) - estimator implementation, `Game.tick` wiring
3. **Task 2 RED:** `29fbdb6` (test) - `InputFrame`, `Game.set_paused`, `WebGame.set_paused`, `pause_controller` skeletons with pytest, vitest and Playwright tests
4. **Task 2 GREEN:** `58244c4` (feat) - pause in Game/WebGame, `pause_controller.js`, overlay, keyboard clearing, main.js wiring, playfield.spec rework

**Plan metadata:** committed separately (docs: complete plan).

## CI and live verification

Pushed to `origin/main` before this SUMMARY. Deploy run 39050925960 for `58244c4` concluded success (https://github.com/rguillon/Stratoburst/actions/runs/39050925960); E2E run 39050925966 for the same SHA completed with success. `make wait-deploy SHA=58244c44f266839f026f1b9183a78f607b5f2275` confirmed the live site serves it and `make e2e-live` passed against https://rguillon.github.io/Stratoburst/ (1 passed).

## TDD Gate Compliance

Both tasks are `tdd="true"` in a `type: execute` plan; each has a RED test commit before its implementation commit.

- **RED Task 1 (`0891772`):** pytest 18 failed, 286 passed. The 17 estimator failures are assertion failures against a pass-through skeleton (for example `4.1833 == 4.1667` for the 240 Hz snap case); the one game failure is `assert (98 / 601) < 0.01`, the stutter ratio without snapping. The tests that pass in RED are the 30/60/120/144 Hz step-count tests and the runner boundary tests: the plain accumulator already yields 600 +/- 1 steps and the runner boundaries already held (01-01), so they are regression pins by construction. Semantic assessment: every intended-failing test failed on its planned assertion, none on import or fixture errors (the skeleton keeps the module importable).
- **RED Task 2 (`29fbdb6`):** pytest 18 failed, 314 passed (for example `FLAG_PAUSED` missing from the header, `Expected 'set_paused' to be called once. Called 0 times.`, `InputFrame.pressed` always False); vitest 16 failed, 235 passed (every pause_controller case against the inert skeleton, plus the three keyboard pagehide/visibility cases); Playwright `pause.spec.js` 6 failed (paused flag never set, `__scorched.paused` undefined). Semantic assessment: all failures are planned-behaviour assertions against skeletons. Several Python tests (for example idempotent `set_paused(True)` twice) pass vacuously against the no-op skeleton and are covered by the GREEN behaviour.
- **GREEN:** `6d6f247` and `58244c4`, all suites green. **REFACTOR:** none needed (the `_pack_header` extraction in `Game` was part of GREEN).
- `gsd_run check tdd-red-evidence` was not run: the plan is not `type: tdd` and pytest/vitest text reports are not formats that classifier accepts (same position as plans 01-03 to 01-07).

## Files Created/Modified

- `src/scorched_core/clock/refresh_estimator.py` - vsync-snapping estimator
- `src/scorched_core/input/input_frame.py` - button edge detection
- `src/scorched_core/game/game.py` - `refresh`, `input`, `paused`, `set_paused`, PAUSE edge, paused tick path, `_pack_header`/`_flags`
- `src/scorched_web/web_game.py` - `set_paused` with header flush
- `web/src/loop/pause_controller.js`, `index.html`, `web/src/main.js` - pause triggers, `#paused` overlay, per-frame FLAGS sync, `__scorched.paused`
- `web/src/input/keyboard_input.js` - clear on pagehide and hidden visibility
- `tools/e2e/pause.spec.js`, `tools/e2e/playfield.spec.js` - pause e2e; sim-progress scroll e2e
- Tests: `tests/scorched_core/{clock,input,game}/`, `tests/scorched_web/test_web_game.py`, `web/test/loop/pause_controller.test.js`, `web/test/input/keyboard_input.test.js`

## Decisions Made

See `key-decisions` above. No new Makefile target: the new tests run under existing `make test` / `make e2e`; no new command was added.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Resume drops owed touch drag**
- **Found during:** Task 2 design (prohibition PLAT-08: a returning player must never find their ship moved by play that ran without them)
- **Issue:** `PlayerShip.pending_x/y` holds up to 40 units of finger movement still to be applied. Left in place across a pause, the ship would slide on resume.
- **Fix:** `Game.set_paused(False)` zeroes `ship.pending_x/y`; covered by `test_resume_drops_the_drag_the_ship_still_owed_resume`.
- **Files modified:** `src/scorched_core/game/game.py`, `tests/scorched_core/game/test_game.py`
- **Committed in:** `29fbdb6` (test), `58244c4` (fix)

**2. [Rule 2 - Missing Critical] App-switcher keys do not resume**
- **Found during:** Task 2 (`pause_controller.js`)
- **Issue:** "any key resumes" would let the Alt/Meta/Ctrl/Tab keydowns of an Alt-Tab or Cmd-Tab return unpause the game before the player acts deliberately.
- **Fix:** AltLeft/Right, MetaLeft/Right, ControlLeft/Right and Tab are ignored by the resume listener (tested with `it.each`).
- **Files modified:** `web/src/loop/pause_controller.js`, `web/test/loop/pause_controller.test.js`
- **Committed in:** `58244c4`

**3. [Rule 2 - Missing Critical] vitest coverage for the new JS modules**
- **Issue:** The plan listed no vitest file for `pause_controller.js` or for the keyboard pagehide/visibility clearing.
- **Fix:** Added `web/test/loop/pause_controller.test.js` (21 tests) and 3 cases in `keyboard_input.test.js`, in the RED commit.
- **Committed in:** `29fbdb6` (RED), `58244c4` (GREEN)

**4. [Rule 3 - Blocking] Scroll e2e reworked, not just re-floored**
- **Found during:** Task 2 (orchestrator carry-over from 01-07)
- See the "playfield.spec scroll e2e" section; the plan did not list `tools/e2e/playfield.spec.js` in `files_modified`, the orchestrator asked for it.
- **Committed in:** `58244c4`

**5. [Rule 1 - Test robustness] pause.spec resume-burst bound uses page time**
- **Found during:** Task 2 (first Playwright run)
- **Issue:** The planned "within 300 ms, at most 0.3 * 60 + 3 steps" measured `TICK_COUNT` across a Playwright click, polls and a 300 ms wait, which is longer than 300 ms (24 steps against a bound of 21), so the assertion tested Playwright latency.
- **Fix:** Ticks and `performance.now()` are read in the same `page.evaluate`; the bound is `elapsed * 60 + 3`.
- **Files modified:** `tools/e2e/pause.spec.js`
- **Committed in:** `58244c4`

**6. [Rule 1 - Test arithmetic] Estimator test expectations**
- Two of my RED cases mis-stated the plan's arithmetic (2.4 periods is not within 25% of a period of 2 periods; 16.4 ms is 1.6% below 60 Hz, outside the 1.5% rate tolerance). Corrected before the test was relied on (the first in the RED amend, the second at GREEN `6d6f247`); the behaviour specified by the plan is unchanged.

**7. [Rule 1 - Documentation] Acceptance greps**
- `grep -n "refresh.snap(" src/scorched_core/game/game.py` matches `self.refresh.snap(dt_ms)` as intended. The plan's key_link pattern `refresh\.snap\(` also matches. The research claim "49.5% of frames stuttered without snapping" did not reproduce with this plan's timestamp-jitter model (98 of 601 frames, 16%); the snapped result (under 1%) is what the plan requires and what is tested.

---

**Total deviations:** 7 (3 missing critical, 1 blocking carry-over, 3 test robustness or documentation). **Impact on plan:** additive or test-robustness only; no planned behaviour was dropped. Gameplay timing was not weakened anywhere.

## Issues Encountered

- The first RED commit went through with a lint error in a test file because the lint and commit steps were chained with `;`; it was amended (local, unpushed) before any further work.
- Vite still prints the known chunk-size warning (unchanged in kind).
- `gh` is not installed; CI status came from `make wait-deploy` and the public Actions API.

## Pending Human Verification

The plan has no `<human-check>` block; these items need a person. None blocks the plan (it is autonomous).

1. **Desktop tab/app switching (D6):** run `make preview`, open http://localhost:4173/?debug, fly the ship, then switch to another tab and back, and separately Alt-Tab to another window and back. Expect the game frozen behind a PAUSED overlay on return with the ship exactly where it was, no held direction stuck, and nothing moving until you click the overlay or press a key (not Alt/Tab/Ctrl); after that, play resumes smoothly with no jump. Escape and P should also toggle the overlay.
2. **Real phone (D6, Assumption A13):** on an iPhone and an Android phone open the live URL, start flying, then switch apps (home gesture, app switcher, lock the screen) and return. Expect PAUSED to be showing, a tap to resume, and no lost lives or moved ship in between. Report which of visibilitychange, blur or pagehide fired if it did not pause (the debug build can log it); plan 01-10 owns the device session.
3. **120/144 Hz display (D1, Assumption A4):** on a high-refresh monitor or phone, open the live URL with `?debug`. Expect terrain scroll that looks as smooth as at 60 Hz and the same speed (about 48 units/s, visible as the same time to cross the screen) with `steps/frame` in the overlay near 0.5 (120 Hz) or 0.42 (144 Hz) and no periodic hitching. Judge whether it feels like a steady 60 Hz sim on any panel.
4. **Overlay look (D6):** confirm the PAUSED text and hint are legible on a phone screen in portrait and landscape and over the bloom-lit scene.

## Known Stubs

None.

## Threat Flags

None. T-01-19 is mitigated: a 5000 ms dt while paused runs 0 steps and after resume one 16.667 ms tick runs exactly 1 step (pytest), and the 100 ms clamp with the 3-step cap is unchanged. T-01-20 is mitigated: no step runs while hidden, blurred or paged out, resume needs a tap or key, and every pause trigger clears keyboard and pointer state (pytest, vitest, Playwright); the PLAT-08 prohibition is judgment-verified as pending human checks 1 and 2. T-01-SC: no new packages, lockfiles untouched.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 01-09 and 01-10 can rely on `__scorched.paused` and `Game.paused`; the device session (01-10) must confirm A4 (real 120/144 Hz) and A13 (iOS/Android lifecycle events).
- Open concern: on this machine the software-GL e2e is cap-bound (about 15 to 17 fps with drones and bolts), so the real-time rate branch of the scroll test only exercises on faster hardware; the always-on assertions do not depend on it.

---
*Phase: 01-playable-core-on-real-devices*
*Completed: 2026-10-17*

## Self-Check: PASSED

Verified: all key files exist on disk; commits `0891772`, `6d6f247`, `29fbdb6`, `58244c4` are ancestors of HEAD and of `origin/main`; `plan_head_before..plan_head_after` counts 4 commits; `make check` and `make perf` green; Deploy run success and E2E workflow success; `make e2e-live` 1 passed.
