---
phase: 03-stage-1-vertical-slice
plan: 09
subsystem: ui
tags: [game-over, restart, overlay, dom, playwright, vitest]

requires:
  - phase: 03-stage-1-vertical-slice
    provides: "FLOW GAME_OVER state, header SCORE/HIGH_SCORE/NEW_RECORD and WebGame.restart (plan 03-08)"
provides:
  - "startGame returns a held `restart` proxy next to `tick`"
  - "createGameOverOverlay / RESTART_DELAY_MS (web/src/ui/game_over_overlay.js)"
  - "#game-over markup and night-palette CSS, wired into the frame loop"
  - "tools/e2e/gameover.spec.js (key restart, click restart)"
affects: [03-10 INTRO, phase 4 continue countdown and title screen]

actuals:
  tokens: 8000
  tasks: 2
  commits: 4
plan_head_before: 796e48e08820b558138351c5075570e46872cd6c
plan_head_after: 21d18e4c27eb440a310e752af5936ccc9e261fbb

tech-stack:
  added: []
  patterns:
    - "State-driven overlay: shown exactly while header FLOW == GAME_OVER, text through textContent on change only"
    - "Restart is a DOM handler calling the held proxy, never a Python FIRE edge (touch auto-fire holds FIRE)"
    - "Tap = pointerdown after the arm plus the matching pointerup, tracked by pointerId"

key-files:
  created:
    - web/src/ui/game_over_overlay.js
    - web/test/ui/game_over_overlay.test.js
    - tools/e2e/gameover.spec.js
  modified:
    - web/src/python/python_bridge.js
    - web/test/python/python_bridge.test.js
    - index.html
    - web/src/main.js

key-decisions:
  - "Restart keys are the fire bindings of KEY_BINDINGS (Space, J); the 800 ms arm is measured on the frame clock passed to update()"
  - "#game-over sits outside #app (like #paused) at z-index 8 and also carries data-no-steer"
  - "BEST is a static label inside .best-line and .best holds only the number, so textContent never touches the label"

patterns-established:
  - "Overlay factories take { doc, win, ... } and are exercised against createFakeDocument with a second fake document as the window"

requirements-completed: [SCOR-05, SCOR-08]

coverage:
  - id: D1
    description: "When the last ship is lost the player sees GAME OVER with the final score, best score and NEW RECORD when beaten, state-driven from header FLOW"
    requirement: SCOR-05
    verification:
      - kind: unit
        ref: "web/test/ui/game_over_overlay.test.js#shows on the first GAME_OVER frame with the final and best scores as text"
        status: pass
      - kind: unit
        ref: "web/test/ui/game_over_overlay.test.js#hides when the flow leaves GAME_OVER and re-arms for the next game over"
        status: pass
      - kind: e2e
        ref: "tools/e2e/gameover.spec.js#the last ship lost shows GAME OVER with the score, and a key press starts a fresh stage 1"
        status: pass
    human_judgment: false
  - id: D2
    description: "A fire key or a tap restarts stage 1 through the held restart proxy, only after the 800 ms arm and at most once, ignoring key repeats and stale pointers"
    requirement: SCOR-05
    verification:
      - kind: unit
        ref: "web/test/ui/game_over_overlay.test.js (a deliberate restart)"
        status: pass
      - kind: unit
        ref: "web/test/python/python_bridge.test.js#holds the restart function once, next to tick, so no proxy is looked up per call"
        status: pass
      - kind: e2e
        ref: "tools/e2e/gameover.spec.js#a click on the GAME OVER screen restarts too, after a short pause"
        status: pass
    human_judgment: false
  - id: D3
    description: "The overlay looks right: magenta title, cyan text, legible layout on phone and desktop"
    verification: []
    human_judgment: true
    rationale: "Visual quality of the screen is not asserted by any test; only its text, visibility and behaviour are"

duration: 12min
completed: 2026-10-18
status: complete
---

# Phase 3 Plan 09: Game-Over Screen and Restart Input Summary

**A state-driven GAME OVER overlay (final score, best score, NEW RECORD) shown while FLOW is GAME_OVER, restarted by a fire key or a tap through the held `restart` proxy after an 800 ms arm, ignoring key repeats and presses that began before the arm.**

## Performance

- **Duration:** ~12 min (start time was not recorded; estimated from the commit timestamps)
- **Completed:** 2026-10-18
- **Tasks:** 2 (Task 1 a tracer, both TDD)
- **Files modified:** 7 (4 source, 3 test)

## Accomplishments

- `startGame` returns `restart = game.restart`, held once beside `tick`.
- `createGameOverOverlay({ doc, win, flowStates, onRestart, delayMs })` returns `{ el, update(header, slots, nowMs) }`. It shows exactly while header FLOW equals `flow_states.GAME_OVER`, writes `.final` and `.best` only on change, shows `.record` only when NEW_RECORD is 1, and hides and re-arms when the flow leaves GAME_OVER.
- Input: a fire keydown (non-repeat) or a pointerdown plus matching pointerup, both only after `RESTART_DELAY_MS` (800) of the overlay being up, and once per game over. A pointercancel, or the overlay hiding, forgets pending pointers.
- `#game-over` markup (data-no-steer, z-index 8, outside `#app`) and CSS in the night palette; `main.js` creates the overlay after the gate and calls `gameOver.update(header, slots, ts)` every frame.
- `gameover.spec.js`: a `?lives=1` mortal idle stage run reaches GAME_OVER (about 20 s), the overlay shows the score, Space restarts with LIVES 1 and SCORE 0; a second test restarts with a click.

## Task Commits

1. **Task 1 (tracer): GAME OVER with the score, a key press starts a fresh stage 1**
   - RED `463f937` (test): the `restart` assertion failed with `expected undefined to be [Function restart]`; the overlay suite failed to load because the module did not exist yet.
   - GREEN `006de33` (feat)
2. **Task 2: a tap restarts too, and a button-mash cannot skip the screen**
   - RED `de4c53b` (test): 6 new tests failed on their planned assertions (a repeat, an orphan pointerup, a stale pointerdown and a cancelled pointer each restarted when they should not).
   - GREEN `21d18e4` (feat)

**Plan metadata:** the docs commits that follow this SUMMARY.

Tracer gate: `make test-web`, `make build` and the gameover, pause and touch specs all passed before Task 2 began (tracer verified end to end, then expanded).

## Files Created/Modified

- `web/src/ui/game_over_overlay.js` - the overlay factory (new)
- `web/test/ui/game_over_overlay.test.js` - 23 unit tests (new)
- `tools/e2e/gameover.spec.js` - two e2e tests (new)
- `web/src/python/python_bridge.js`, `web/test/python/python_bridge.test.js` - held `restart`
- `index.html` - `#game-over` markup and CSS
- `web/src/main.js` - overlay creation and per-frame update

## Decisions Made

- Restart keys are the fire bindings already in `KEY_BINDINGS` (Space and J), so a remapped fire key follows automatically.
- The 800 ms arm is measured on the frame clock last passed to `update()`, so listeners need no clock of their own; the error is at most one frame.
- The overlay lives outside `#app` like `#paused`, so `touch_input` never sees its pointers, and it still carries `data-no-steer` as the plan requires.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- A pause overlay on top of the game over screen (z-index 10) still passes key presses to the window; a key that resumes the pause can also restart the run once armed. Rare (needs a blur during the game over screen) and harmless, so left as is.
- 03-08's known edge (an extend on the very last DYING step comes one step too late) is not touched by this plan; nothing here moves OUT detection.
- `StageFlow.timer` is still not published to FLOW_T; the overlay does not need it because the 800 ms arm runs on the frame clock.

## Known Stubs

None.

## Threat Flags

None. T-03-11 (restart only in GAME_OVER, after the arm, once, repeats and early pointers ignored) and T-03-12 (textContent only, header integers and static markup) are both implemented and unit tested; no packages were added.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 03-10. Phase 4 can extend `#game-over` with the continue countdown and title screen.

## Self-Check: PASSED

- Files exist: game_over_overlay.js, game_over_overlay.test.js, gameover.spec.js.
- Commits exist: 463f937, 006de33, de4c53b, 21d18e4.
- `make test-web` 1140 passed, `make build` ok, gameover (2), pause (5) and touch (7) specs passed, `make lint` clean, `make test-python` at 100% coverage.

---
*Phase: 03-stage-1-vertical-slice*
*Completed: 2026-10-18*
