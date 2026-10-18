---
phase: 02-arcade-shooting-feel
plan: 29
subsystem: touch-bomb-button
tags: [touch, bomb-button, input, layout, safe-area, javascript, playwright]

requires:
  - phase: 02-arcade-shooting-feel
    provides: "02-22 Python BOMB press latch, 02-28 hitstop and shake, 02-20 e2e god boot, 01-08 pause controller, 01-09 touch input and sampler, camera_fit projectCorners"
provides:
  - "input/bomb_button.js: createBombButton (pointer-id set plus press latch, sample/clear/setVisible/place/dispose) and readSafeInsets"
  - "input/bomb_button_layout.js: layoutBombButton, a pure margin-or-overlay placement from the projected playfield corners"
  - "touch_input ignores any pointerdown inside [data-no-steer]; the sampler ORs BOMB when the button samples true"
  - "#bomb-button markup (amber, data-no-steer) shown in touch mode, hidden in keyboard mode, cleared by pause"
  - "debug hooks bombButton.visible, bombButton.inMargin, bombButton.rect; bootGame {tap} e2e option"
affects: [02-33-device-gate, phase-4-polish]

actuals:
  tokens: 10000
  tasks: 2
  commits: 3
plan_head_before: 631219e32d0cff8fa057a4ea99e112b8b7054aee
plan_head_after: 447d5236e6bbdc1ea1de5d5bdbe6bb2ec5487e5f

tech-stack:
  added: []
  patterns:
    - "A control drawn over the playfield marks itself data-no-steer; touch_input ignores pointers that start on it and the control stops propagation of its own pointerdown"
    - "Pure DOM-free layout function fed by projected camera corners; main.js owns the resize wiring and asks the rig to refit first so the corners are current in either handler order"

key-files:
  created:
    - web/src/input/bomb_button.js
    - web/test/input/bomb_button.test.js
    - web/src/input/bomb_button_layout.js
    - web/test/input/bomb_button_layout.test.js
  modified:
    - web/src/input/input_sampler.js
    - web/test/input/input_sampler.test.js
    - web/src/input/touch_input.js
    - web/test/input/touch_input.test.js
    - web/test/helpers/fake_dom.js
    - index.html
    - web/src/main.js
    - tools/e2e/touch.spec.js
    - tools/e2e/helpers.js

key-decisions:
  - "The button tracks a set of pointer ids rather than one flag, so a second finger lifting never releases a button another finger still holds; sample() is true while any id is down or a press is latched"
  - "Margin placement hugs the viewport bottom-right (inside the safe-area insets) and counts as fitting when it clears the playfield edge, so a margin needs size + gap; landscape tries the right margin first, portrait the bottom margin first"
  - "layOutBombButton calls rig.resize() before projecting, so the corners are current whichever of the rig's and main's resize handlers runs first"
  - "Pause clearing is wired through the existing pause controller input list (inputs: [keyboard, touch, bombButton]) rather than a new mechanism"

patterns-established:
  - "FakeElement.dispatch bubbles through parents and honours stopPropagation, so tests can prove an event never reaches an ancestor listener"
  - "e2e bootGame({ tap: true }) starts a touch session from the gate"

requirements-completed: [INPT-03]

coverage:
  - id: D1
    description: "A tap on the on-screen bomb button sends the BOMB bit through the keyboard's button path and launches a bomb without moving the ship"
    requirement: INPT-03
    verification:
      - kind: e2e
        ref: "tools/e2e/touch.spec.js#a tap on the bomb button drops a bomb without moving the ship"
        status: pass
      - kind: unit
        ref: "web/test/input/input_sampler.test.js#ORs the BOMB bit when the bomb button samples true, and samples it every time"
        status: pass
    human_judgment: false
  - id: D2
    description: "A tap shorter than a frame still bombs (the press latch), pointer release/cancel/lost-capture release the button, dispose removes every listener"
    requirement: INPT-03
    verification:
      - kind: unit
        ref: "web/test/input/bomb_button.test.js#createBombButton"
        status: pass
    human_judgment: false
  - id: D3
    description: "The button never steers: a pointer starting on a data-no-steer element is excluded from drag tracking and the steering pointer is untouched"
    requirement: INPT-03
    verification:
      - kind: unit
        ref: "web/test/input/touch_input.test.js#a pointerdown inside [data-no-steer] neither steers, captures nor switches touch mode"
        status: pass
      - kind: e2e
        ref: "tools/e2e/touch.spec.js#a drag that starts on the bomb button does not steer the ship"
        status: pass
    human_judgment: false
  - id: D4
    description: "The button sits in the letterbox margin when there is room (right in landscape, bottom in portrait) and overlays the playfield corner otherwise, sized 15% of the shorter side clamped to 72..112, safe-area aware, re-laid out on resize and rotation"
    requirement: INPT-03
    verification:
      - kind: unit
        ref: "web/test/input/bomb_button_layout.test.js#layoutBombButton"
        status: pass
      - kind: e2e
        ref: "tools/e2e/touch.spec.js#on a 390 x 844 phone the button sits in the bottom letterbox margin"
        status: pass
      - kind: e2e
        ref: "tools/e2e/touch.spec.js#a rotation to landscape moves the button into the right margin"
        status: pass
      - kind: e2e
        ref: "tools/e2e/touch.spec.js#a viewport with the playfield own aspect has no margin: the button overlays the playfield bottom-right corner"
        status: pass
    human_judgment: false
  - id: D5
    description: "Pausing clears the button's held state and the button is hidden in keyboard mode"
    requirement: INPT-03
    verification:
      - kind: e2e
        ref: "tools/e2e/touch.spec.js#a finger drag flies the ship 1:1 with no jump, auto-fire and a keydown leaves touch mode"
        status: pass
      - kind: e2e
        ref: "tools/e2e/pause.spec.js"
        status: pass
    human_judgment: false
  - id: D6
    description: "On a real phone the button is thumb-sized, never under the notch or home bar, and steering with one finger while tapping it with another feels right without the ship jumping"
    requirement: INPT-03
    verification: []
    human_judgment: true
    rationale: "Thumb reach, notch and home-bar clearance and the two-finger feel are physical-device judgments; the plan's human-check defers them to a phone-sized emulation and the real phones in plan 02-33"

# Metrics
duration: 17min
completed: 2026-10-18
status: complete
---

# Phase 2 Plan 29: Touch Bomb Button Summary

**A large amber round bomb button for phones: it ORs the BOMB bit through the keyboard's own button path with a press latch, never steers (data-no-steer), lives in the letterbox margin or overlays the playfield corner with safe-area insets, and is cleared by pause and hidden in keyboard mode.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-10-18T07:32:35Z
- **Completed:** 2026-10-18T07:49:23Z
- **Tasks:** 2
- **Files modified:** 13 (4 created, 9 modified)

## Accomplishments

- `createBombButton` mirrors keyboard_input.js: a `pointerdown` prevents default, stops propagation, captures the pointer and latches the press, so a tap shorter than one frame still reaches the next sample; release, cancel and lost capture release it; `clear()` and `dispose()` are complete. The sampler ORs `buttonBits.BOMB` whenever the button samples true, and Python's own BOMB latch carries the edge.
- The button is shown by touch mode (a gate tap or the first touch pointerdown) and hidden by the next keydown, through one `setTouchMode(on)` helper in main.js. The pause controller's input list now includes it, so a pause drops a held press.
- `layoutBombButton` is a pure function over the projected playfield corners: right margin in landscape, bottom margin in portrait (the playfield's right side), otherwise an overlay on the bottom-right corner inset by the gap; size is round(15% of the shorter side) clamped to 72..112 and `readSafeInsets` shifts it inward. main.js lays it out at start and on every window and visualViewport resize through a coalesced rAF.
- `touch_input.onDown` returns early for targets inside `[data-no-steer]` (before the touch-mode callback and steering), so a second finger can bomb while the first steers.
- Tracer gate: the Task 1 verify (vitest, build, touch and keyboard Playwright) passed end to end before the layout work started. The full `make check` (lint, 1008 pytest at 100% line+branch, 905 vitest, build, perf, 70 Playwright) passes.

## Task Commits

1. **Task 1: Tracer, a tap on the bottom-right button fires a bomb** - `e0bc7d2` (feat)
2. **Task 2 (TDD RED): failing tests for layout, safe-area read, place and drag exclusion** - `b259121` (test)
3. **Task 2 (TDD GREEN): margin or overlay layout, drag exclusion, pause wiring, e2e** - `447d523` (feat)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## TDD Gate Compliance

RED (`b259121`): the layout tests ran against a stub returning zeros, `place` and `readSafeInsets` were absent, and the exclusion test failed on its assertion (touch mode was reported once, expected zero). 20 failed tests, each on the planned behaviour; no load faults. GREEN (`447d523`): all 905 vitest tests pass. No REFACTOR commit was needed.

## Files Created/Modified

- `web/src/input/bomb_button.js` - createBombButton (pointer-id set, latch, place, setVisible) and readSafeInsets
- `web/src/input/bomb_button_layout.js` - layoutBombButton, the pure placement rule
- `web/src/input/input_sampler.js` - optional `bombButton`, ORs BOMB
- `web/src/input/touch_input.js` - `[data-no-steer]` early return
- `web/src/main.js` - button creation, `setTouchMode`, layout wiring, pause inputs, debug hooks
- `index.html` - `#bomb-button` markup and amber circle styling
- `web/test/helpers/fake_dom.js` - removeEventListener, attributes, pointer capture, `closest`, bubbling `dispatch`
- `web/test/input/*.test.js` - button, layout, sampler and touch exclusion tests
- `tools/e2e/touch.spec.js`, `tools/e2e/helpers.js` - tap, drag-from-button, margin, rotation and overlay cases; `bootGame({ tap })`

## Decisions Made

See `key-decisions` in the frontmatter. The notable ones: a pointer-id set so one finger lifting never releases another finger's hold, and `rig.resize()` before projecting so the layout never depends on handler order.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `bootGame` needed a touch-tap start**
- **Found during:** Task 1 (the tracer e2e case)
- **Issue:** The plan says the new test "starts with a touch tap", but `tools/e2e/helpers.js` (not in the plan's file list) only clicked the gate with the mouse, which would leave the session in keyboard mode with the button hidden.
- **Fix:** Added a `tap` option that uses `locator.tap()` on the gate.
- **Files modified:** tools/e2e/helpers.js
- **Verification:** touch.spec.js bomb-button cases pass
- **Committed in:** e0bc7d2

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Test plumbing only; no scope creep.

## Issues Encountered

None. The 390 x 844, 844 x 390 (rotation) and 600 x 800 viewports all produced the placements the plan predicted on the first run.

The Task 2 `<human-check>` (thumb size, notch and home-bar clearance, one finger steering while another taps the button) is harvested by the verifier at end of phase and is repeated on the real phones in plan 02-33; it was not run interactively here.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Next Phase Readiness

- Plan 02-33 can check the button on the real phones; `bombButton.inMargin` and `bombButton.rect` are available in the debug hooks.
- Touch players now have fire (auto), steer (drag) and bomb (button); pause is still reached through blur and visibility changes on touch devices.

## Self-Check: PASSED

- Created files exist: bomb_button.js, bomb_button.test.js, bomb_button_layout.js, bomb_button_layout.test.js (FOUND)
- Commits on HEAD: e0bc7d2, b259121, 447d523 (FOUND)
- Acceptance greps: `id="bomb-button"` with `data-no-steer` in index.html, `data-no-steer` in touch_input.js and `inputs: [keyboard, touch, bombButton]` in main.js all match
- `make check` passes (lint, 100% coverage, vitest, build, perf, full Playwright)

---
*Phase: 02-arcade-shooting-feel*
*Completed: 2026-10-18*
