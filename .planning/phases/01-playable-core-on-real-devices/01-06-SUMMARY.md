---
phase: 01-playable-core-on-real-devices
plan: 06
subsystem: input
tags: [keyboard, touch, pointer-events, unprojection, three, ship-model, hitbox, vitest, playwright, tdd]

requires:
  - phase: 01-playable-core-on-real-devices
    provides: "Fitted camera and rig.toWorld (01-05), PlayerShip.step and Game.tick boundary (01-01/01-02), manifest with flags and tuning (01-05)"
provides:
  - "ship_model.js: createShipModel({ hitboxRadius }) code-built jet (extruded planform, canopy, tail fins), HDR engine glow, always-on-top hitbox-marker (core + dark ring)"
  - "keyboard_input.js: full D-11 KEY_BINDINGS by event.code, press-edge latching, sample(buttonBits), onKeyDown hook"
  - "touch_input.js, touch_mapper.js, input_sampler.js: relative 1:1 drag via ray-plane unprojection, touch mode with auto-fire"
  - "Button IntFlag (FIRE, BOMB, PAUSE) published as manifest.buttons; header FLAGS carries FLAG_FIRING"
  - "PlayerShip.pending_x/pending_y, add_drag, catch-up at keyboard speed, TOUCH_LAG_CAP = 40, wall rule"
  - "Debug hooks __scorched.manifest, __scorched.touchMode, __scorched.projectPoint; tools/e2e/keyboard.spec.js and touch.spec.js"
affects: [01-07, 01-08, 01-09, 01-10]

plan_head_before: 81cb0391485c87ab4a69fba587a24e026ca161e5
plan_head_after: 41bdfb0bcfecbfc78e5071b0722872241e27d94a

actuals:
  tokens: 14000
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Button bit values originate in Python (Button IntFlag) and reach JS only through manifest.buttons; JS never hardcodes them"
    - "JS latches press edges (pressedSinceSample) and samples held-or-pressed; Python derives edges from consecutive samples"
    - "Touch drag is a queue (pending) drained at the keyboard speed cap inside the fixed step; the lag cap bounds it and the wall rule discards the blocked axis"
    - "Module-level scratch Vector/Raycaster/Plane objects in the per-frame unprojection (no per-call allocation)"
    - "Sampler owns the touch-mode flag; the two devices report into it through callbacks wired in main.js"

key-files:
  created:
    - src/scorched_core/input/__init__.py
    - src/scorched_core/input/button.py
    - tests/scorched_core/input/test_button.py
    - web/src/input/touch_input.js
    - web/src/input/touch_mapper.js
    - web/src/input/input_sampler.js
    - web/test/input/touch_input.test.js
    - web/test/input/touch_mapper.test.js
    - web/test/input/input_sampler.test.js
    - web/test/render/ship_model.test.js
    - tools/e2e/keyboard.spec.js
    - tools/e2e/touch.spec.js
  modified:
    - web/src/render/ship_model.js
    - web/src/input/keyboard_input.js
    - web/src/main.js
    - index.html
    - src/scorched_core/tuning.py
    - src/scorched_core/entities/player_ship.py
    - src/scorched_core/game/game.py
    - tests/scorched_core/entities/test_player_ship.py
    - tests/scorched_core/game/test_game.py
    - web/test/input/keyboard_input.test.js

key-decisions:
  - "The wall rule is applied uniformly: after any step (keyboard or drag) an axis whose clamp changed the position has its pending component zeroed; a keyboard step that does not hit a wall leaves pending untouched, as planned"
  - "A drag that fits inside one step is taken whole and pending is set to exactly 0.0 (no float residue); a longer one is scaled to SHIP_SPEED along its direction"
  - "touch_input keeps the accumulated delta after pointerup/cancel so a flick shorter than a frame is not lost; only clear() drops it"
  - "Touch mode is entered on any touch pointerdown (even a second finger, idempotent); mouse pointers may steer by drag but never enter touch mode"
  - "Hitbox marker ring draws after the core (renderOrder 21 over 20) and both materials are toneMapped:false, transparent, depthTest/depthWrite false"
  - "The ship is created after the Python manifest loads so the marker radius comes from manifest.tuning.hitbox_radius; the ship therefore first appears once Python has started"

patterns-established:
  - "Pattern: debug projectPoint(x, y) lets e2e assert on-screen distances (1:1 touch) independently of the unprojection code under test"
  - "Pattern: fakes for EventTarget and elements in vitest so input modules are tested without a DOM"

requirements-completed: [PLYR-01, PLYR-02, INPT-01, INPT-02]

coverage:
  - id: D1
    description: "The ship is a code-built jet (swept wings about 16 units wide, nose toward -Z, canopy, tail fins) with an HDR engine glow that crosses the bloom threshold while the fuselage albedo stays below 1.0"
    requirement: PLYR-02
    verification:
      - kind: unit
        ref: "web/test/render/ship_model.test.js (silhouette, engine glow, fuselage albedo)"
        status: pass
    human_judgment: true
    rationale: "Whether the silhouette reads as a jet and the glow looks good is a visual judgment (pending human check 1); the geometry facts are unit-tested."
  - id: D2
    description: "A hitbox core marker (bright 2.5-unit core plus dark ring) is always drawn on top: depthTest and depthWrite false, renderOrder >= 20, no focus-mode gating"
    requirement: PLYR-02
    verification:
      - kind: unit
        ref: "web/test/render/ship_model.test.js hitbox marker block (10 tests)"
        status: pass
    human_judgment: true
    rationale: "Readability of a roughly 3 px marker on a 360 px phone cannot be asserted headlessly (Pitfall 13); the real-device session in 01-10 decides it."
  - id: D3
    description: "Keyboard works by physical key (event.code): arrows and WASD/ZQSD move, Space/KeyJ fire, Shift/KeyK bomb, Escape/KeyP pause; opposing keys cancel; bound keys call preventDefault; blur clears state; a press+release between samples is seen once"
    requirement: INPT-01
    verification:
      - kind: unit
        ref: "web/test/input/keyboard_input.test.js (37 tests)"
        status: pass
      - kind: e2e
        ref: "tools/e2e/keyboard.spec.js (AZERTY dispatch code KeyW key 'z' and KeyA key 'q', Space/KeyJ FIRING, manifest.buttons)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Movement is 8-directional at a constant 3.333 units per step with instant start/stop; diagonals are normalised; non-finite input is zero"
    requirement: PLYR-01
    verification:
      - kind: unit
        ref: "tests/scorched_core/entities/test_player_ship.py (diagonal, clamp, non-finite) plus pytest 187 passed at 100.00% line and branch"
        status: pass
    human_judgment: false
  - id: D5
    description: "Touch is relative 1:1 drag: a touchstart alone does not move the ship, the ship travels the finger's on-screen distance (unprojection within 0.5 px), leftover is caught up at <= 3.333 units per step capped at 40, the wall rule discards blocked drag, only the first pointer steers, and touch mode auto-fires until a keydown"
    requirement: INPT-02
    verification:
      - kind: unit
        ref: "web/test/input/touch_mapper.test.js, touch_input.test.js, input_sampler.test.js; tests/scorched_core/entities/test_player_ship.py::test_wall_rule_reverse_drag_moves_immediately"
        status: pass
      - kind: e2e
        ref: "tools/e2e/touch.spec.js (CDP touch events at 390x844: no jump, 60 px drag moves the ship 45..75 px on screen, touchMode true, FIRING set, keydown leaves touch mode; 4 consecutive green runs)"
        status: pass
    human_judgment: true
    rationale: "Feel on real iOS and Android pointer implementations (Assumption A13) is only confirmable on devices (pending human check 2)."
  - id: D6
    description: "Boundary contract: Button IntFlag exported as manifest.buttons, FIRE bit sets header FLAG_FIRING, BOMB/PAUSE are accepted with no Phase 1 effect, drag is queued once per tick call"
    requirement: INPT-01
    verification:
      - kind: unit
        ref: "tests/scorched_core/input/test_button.py, tests/scorched_core/game/test_game.py"
        status: pass
    human_judgment: false

duration: 13min
completed: 2026-10-17
status: complete
---

# Phase 1 Plan 06: Jet, Hitbox Marker, Physical-Key Keyboard and 1:1 Touch Drag Summary

**The ship is now a code-built extruded jet with a blooming HDR engine and an always-on-top hitbox core, flown by event.code keyboard bindings that work on AZERTY and by a relative 1:1 touch drag unprojected onto the gameplay plane, drained by Python at keyboard speed (lag cap 40, wall rule) with auto-fire in touch mode.**

## Performance

- **Duration:** about 13 min
- **Started:** about 2026-10-17T15:58Z
- **Completed:** 2026-10-17T16:10Z (code, CI, Deploy and live smoke green)
- **Tasks:** 2 (both `auto` + `tdd="true"`, each with a separate RED commit)
- **Files modified:** 22 in the code commits (1435 insertions, 38 deletions); no lockfile or dependency changes

## Accomplishments

- **Jet and marker.** `createShipModel({ hitboxRadius })` extrudes a 9-point half-outline mirrored into a swept-wing planform (16 wide, about 20 long, 2.5 deep, nose toward -Z), adds a dark canopy cone, two canted tail fins and a stretched sphere engine glow at colour (3.0, 1.2, 0.4). The `hitbox-marker` group (core radius 2.5 at `hitboxRadius` 2, dark ring to 3.3, y = 0.6) uses depthTest/depthWrite false and renderOrder 20/21. A headless screenshot at 390x844 shows the jet nose-up with the core dot visible.
- **Keyboard.** `KEY_BINDINGS` holds the whole D-11 table by physical code; `createKeyboardInput(target, { onKeyDown })` keeps a held set plus a press-edge set; `sample(buttonBits)` ORs `manifest.buttons` bits for held-or-pressed actions, so a tap between frames is never lost. No code in `web/src/input` reads the typed character.
- **Touch.** `pixelDeltaToPlayfield` projects the ship to pixels, casts rays through the pixel and pixel+delta and intersects Y = 0, so the ship moves exactly the finger's on-screen distance. `createTouchInput` tracks one steering pointerId via clientX/clientY differences, wraps `setPointerCapture` in try/catch and releases on up/cancel/lostpointercapture. `createInputSampler` ORs FIRE in touch mode and zeroes non-finite values.
- **Python.** `Button` IntFlag, `manifest["buttons"]`, `FLAG_FIRING` in header FLAGS on every tick, `PlayerShip.add_drag` (non-finite ignored, vector capped at 40 keeping direction), `step` (keyboard wins, else catch-up at <= SHIP_SPEED, wall rule zeroes a blocked axis), `Game.tick` queues drag once per call.
- **Gates:** `make check` green (ruff, pytest 187 passed at 100.00% line and branch, vitest 223, build, Playwright 20); **`make perf` avg 0.4933 ms, p95 0.5399 ms** (budget 3 ms).

## Task Commits

1. **Task 1 RED:** `9663f9f` (test) - jet model, full key table and Button tests plus keyboard e2e, against a zero-valued Button skeleton
2. **Task 1 GREEN:** `afd7822` (feat) - jet model with hitbox marker, KEY_BINDINGS, edge latching, Button, FLAG_FIRING
3. **Task 2 RED:** `23b9a3c` (test) - drag catch-up, wall rule, mapper, touch input and sampler tests plus touch e2e, against skeletons
4. **Task 2 GREEN:** `41bdfb0` (feat) - PlayerShip drag queue, Game wiring, touch_mapper, touch_input, input_sampler, main.js, index.html

**Plan metadata:** committed separately (docs: complete plan).

## CI and live verification

Code commits were pushed to `origin/main` before this SUMMARY. Deploy run 39048116370 for `41bdfb0` concluded success (https://github.com/rguillon/Stratoburst/actions/runs/39048116370); `make wait-deploy` confirmed the live site serves it and `make e2e-live` passed against https://rguillon.github.io/Stratoburst/ (1 passed).

## TDD Gate Compliance

Both tasks are `tdd="true"` in a `type: execute` plan; each has a RED test commit before its implementation commit.

- **RED Task 1 (`9663f9f`):** vitest 27 failed, 13 passed in the two touched files (for example `expected [] to deeply equal [ 'KeyD', 'KeyQ' ]` for onKeyDown, `expected false to be true` for preventDefault on Space, `- 1 / + 0` for the latched press); pytest 7 failed, 24 passed (`Button` values 0 instead of 1/2/4, `KeyError: 'buttons'`, header FLAGS `0 == 2`). Semantic assessment: every intended-failing test failed on its own planned assertion; none failed on import, syntax or fixture errors. The skeleton `Button` carries zero values on purpose so the tests assert instead of erroring on a missing attribute. The keyboard e2e was not run RED (it needs the `manifest` debug hook). Passing-in-RED tests are existing-behaviour or vacuous-by-skeleton cases (ship geometry tests that the old cone could not pass were among the failures).
- **RED Task 2 (`23b9a3c`):** vitest 17 failed, 59 passed (for example `expected { dxPx: +0, ... active: false } to deeply equal { dxPx: 25, dyPx: -10, active: true }`, `expected +0 to be close to 40` for the 1:1 mapping); pytest 17 failed, 44 passed (`ship.pending_x` and position assertions against the no-op `add_drag` skeleton). Semantic assessment: all failures are planned-behaviour assertions. The tests that pass against the skeletons are the zero-result and non-finite-result cases, which a zero-returning skeleton satisfies by construction; the real behaviour is carried by the failing cases.
- **GREEN:** `afd7822` and `41bdfb0`, all suites green. **REFACTOR:** none needed.
- `gsd_run check tdd-red-evidence` was not run: the plan is not `type: tdd` and vitest/pytest text reports are not formats that classifier accepts (same position as plans 01-03 to 01-05).

## Files Created/Modified

- `web/src/render/ship_model.js` - jet, canopy, fins, engine glow, hitbox marker
- `web/src/input/keyboard_input.js` - full bindings, edge latching, `sample(buttonBits)`, `onKeyDown`
- `web/src/input/touch_input.js`, `touch_mapper.js`, `input_sampler.js` - drag tracking, unprojection, merge with auto-fire
- `web/src/main.js` - ship from manifest radius, sampler wiring, debug hooks `manifest`, `touchMode`, `projectPoint`
- `index.html` - `-webkit-touch-callout: none`, `overscroll-behavior: none` on `#app`
- `src/scorched_core/input/button.py`, `tuning.py`, `entities/player_ship.py`, `game/game.py` - Button, lag cap, drag queue, FIRING flag
- Tests: `web/test/input/*.test.js`, `web/test/render/ship_model.test.js`, `tests/scorched_core/input/test_button.py`, `tests/scorched_core/entities/test_player_ship.py`, `tests/scorched_core/game/test_game.py`, `tools/e2e/keyboard.spec.js`, `tools/e2e/touch.spec.js`

## Decisions Made

See `key-decisions` above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Unit tests for `touch_input.js`**
- **Found during:** Task 2
- **Issue:** The plan listed vitest files for the mapper and the sampler only, but `touch_input.js` carries the threat-model mitigations T-01-17 (try/catch capture, single steering pointer, release on up/cancel/lostpointercapture) and the flick-not-lost behaviour; nothing would have asserted them headlessly.
- **Fix:** Added `web/test/input/touch_input.test.js` (11 tests) with a fake element.
- **Files modified:** `web/test/input/touch_input.test.js`
- **Committed in:** `23b9a3c` (RED), `41bdfb0` (GREEN)

**2. [Rule 3 - Blocking] Debug hooks the e2e specs need**
- **Found during:** Tasks 1 and 2 (e2e design)
- **Issue:** `__scorched.flags` is the URL flags object, so the protocol FIRING bit and the button table were unreachable from Playwright, and the 1:1 touch check needed an independent on-screen projection.
- **Fix:** Debug-only hooks `manifest`, `touchMode` and `projectPoint(x, y)` in `main.js` (present only under `?debug`). The touch e2e measures the ship's screen travel with `projectPoint`, independent of the unprojection under test.
- **Files modified:** `web/src/main.js`
- **Committed in:** `afd7822`, `41bdfb0`

**3. [Rule 1 - Documentation] Acceptance grep for the constant and the `event.key` grep**
- `grep -n "TOUCH_LAG_CAP = 40.0" src/scorched_core/tuning.py` does not match literally because the file annotates every constant `: Final` (`TOUCH_LAG_CAP: Final = 40.0`), the existing convention (same as `SCROLL_SPEED` in 01-05). Intent is proven by `test_lag_cap_is_forty_units`.
- A first draft of a comment in `keyboard_input.js` contained the text `event.key`, which tripped the plan's `grep -rnE "(event|e|ev|evt)\.key\b" web/src/input` acceptance check; the comment was reworded and the grep now returns nothing. No code ever read `event.key`.

**4. [Rule 3 - Blocking] Touch e2e pacing**
- **Issue:** The plan sends six touchMove increments back to back; on software GL they could land inside one frame, pushing pending to the 40-unit cap (a 60 px drag is about 40 units) and shortening the ship's travel.
- **Fix:** 50 ms between increments and a 1200 ms wait for the catch-up to drain; the spec asserts the 1:1 screen distance (45..75 px for 60 px) in addition to the plan's SHIP_X bound (20..60 units). Four consecutive runs passed.
- **Files modified:** `tools/e2e/touch.spec.js`
- **Committed in:** `23b9a3c`

---

**Total deviations:** 4 (1 missing critical, 2 blocking, 1 documentation). **Impact on plan:** additive or test-robustness only; no plan behaviour was dropped or weakened.

## Issues Encountered

- Vite still prints the known chunk-size warning (unchanged in kind).
- `pkill -f "vite preview"` matched its own shell and terminated the command (exit 144); no files were affected and the preview process I started for a screenshot had already exited.
- `gh` is not installed; CI status is read through the public Actions API via `make wait-deploy`.

## Pending Human Verification

The plan's `<human-check>` and two judgment items from the coverage block need a person. None blocks the plan.

1. **Desktop look (plan human-check, D1/D2):** run `make preview` and open http://localhost:4173/?debug in a desktop browser. Expect: the ship reads as a jet (nose up-screen, swept wings, tail), the engine glows, a small bright dot with a dark ring marks the hitbox at the ship centre and stays visible over the glow, and arrows and WASD both move it.
2. **Real phone touch feel (D5, Assumption A13):** open the live URL on an iPhone and an Android phone. Expect: touching does not move the ship, dragging moves it by the same on-screen distance as the finger (never under the finger, never teleporting), a fast flick catches up smoothly at keyboard speed, dragging into a wall then reversing responds at once, auto-fire flag is set after the first touch, and a second finger does not disturb steering. Try `?debug` to watch the header FLAGS.
3. **Hitbox marker legibility on a small phone (D2, Pitfall 13):** on a roughly 360 px wide phone, confirm the 2.5-unit core stays readable (about 3 px) over bullets and terrain; plan 01-10 owns the decision to enlarge it.
4. **Real AZERTY keyboard (D3):** on a physical AZERTY layout confirm Z/Q/S/D move the ship and Space fires (the e2e simulates the layout by dispatching code KeyW with key 'z').

## Known Stubs

None added. The placeholder cone ship (`.planning/WINDOWS.md` entry 1, `web/src/render/ship_model.js`) is replaced by this plan and marked fixed.

## Threat Flags

None. T-01-16 is mitigated at four layers: `touch_mapper` and `input_sampler` zero non-finite values, `PlayerShip.add_drag` and `step` ignore non-finite input again in Python, pending is capped at `TOUCH_LAG_CAP`, and the ship is always clamped; pytest and vitest cover NaN and Infinity. T-01-17: `setPointerCapture` is in a try/catch, only one steering pointer is tracked and it is released on pointerup, pointercancel and lostpointercapture (unit-tested). T-01-SC: no new packages, lockfiles untouched.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 01-07 can read `header[FLAGS] & FIRING` (set from the FIRE bit, held in keyboard mode and forced on in touch mode) to spawn player shots; `Game.tick` already receives buttons, moves and drag.
- Plan 01-08 owns the PAUSE edge (the PAUSE bit is already sampled) and visibility/pagehide clearing; `keyboard.clear()` and `touch.clear()` exist for it.
- Plan 01-09 can reuse `sampler.setTouchMode(true)` for the start-gate tap.
- Open concern: all timing numbers are desktop Node or software GL; touch feel, marker legibility and iOS/Android pointer quirks belong to the plan 01-10 device session.

---
*Phase: 01-playable-core-on-real-devices*
*Completed: 2026-10-17*

## Self-Check: PASSED

Verified: all key files exist on disk; commits `9663f9f`, `afd7822`, `23b9a3c`, `41bdfb0` are ancestors of HEAD and of `origin/main`; `plan_head_before..plan_head_after` counts 4 commits; `make check` and `make perf` green; Deploy run success; `make e2e-live` 1 passed.
