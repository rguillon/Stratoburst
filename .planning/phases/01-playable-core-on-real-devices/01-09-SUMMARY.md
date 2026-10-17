---
phase: 01-playable-core-on-real-devices
plan: 09
subsystem: boot-and-error-handling
tags: [loading-screen, fetch-progress, start-gate, audio-unlock, warm-up, error-panel, fault-injection, webgl-context-loss, tdd, playwright]

requires:
  - phase: 01-playable-core-on-real-devices
    provides: "loadRuntime/PYODIDE_CDN and the error panel skeleton (01-01), startGame/create_game (01-01), rig.prewarm (01-04), createInputSampler.setTouchMode (01-06), createPauseController (01-08), buildReport/copyReport (01-04)"
provides:
  - "trackFetch + DECODED_BYTES size table + progressFraction: real decoded-byte progress of the three Pyodide CDN files for the 0-80% share of the bar, indeterminate when a file is unlisted"
  - "loadRuntime({ onProgress, timeoutMs, loader }) with a 60 s timeout that names the CDN or network, fetch restored in finally"
  - "Static #loading screen from first paint (title, role=progressbar, status, hidden gate button) and createLoadingScreen binding"
  - "waitForStartGesture: click/pointerup/Enter/Space gate that creates, resumes and plays a silent sample on an AudioContext inside the gesture"
  - "warmUp: 120 ticks on a throwaway game before play"
  - "Error panel with Copy report (error text + device report), Reload, setReportProvider, showNotice/hideNotice"
  - "FaultMode (NONE, PY, JS), FAULT_TICK = 120, Game(fault=...), create_game option 'crash'"
  - "?crash=py raises on tick 120 exactly; ?crash=js throws on frame 120; WebGL context loss pauses with a notice"
  - "Gate-aware bootGame e2e helper; tools/e2e/boot.spec.js (11 tests)"
affects: [01-10, phase-02-audio, phase-02-gameplay]

plan_head_before: b823e2f32d2a87535e2c43182d9ce12da8e01fbd
plan_head_after: 6de86d5df5db72285fef2e4dd1ac4bdef5073e12

actuals:
  tokens: 19500
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Global fetch is wrapped only for the duration of loadPyodide and restored in finally; only URLs under the exact CDN prefix are re-streamed"
    - "Input devices (keyboard, touch, sampler, pause controller) are created after the start gate, so the gate tap or key never reaches them"
    - "Error panel inserts text with textContent only; a V8 stack that already carries the message is not repeated"
    - "Report provider registered before main() so a load failure can still produce the device report layout"
    - "A skeleton in the RED commit keeps every RED failure an assertion on the planned behaviour"

key-files:
  created:
    - src/scorched_core/game/fault_mode.py
    - tests/scorched_core/game/test_fault_mode.py
    - web/src/boot/loading_screen.js
    - web/src/boot/start_gate.js
    - web/test/boot/runtime_loader.test.js
    - web/test/boot/start_gate.test.js
    - web/test/boot/loading_screen.test.js
    - web/test/boot/error_panel.test.js
    - web/test/python/python_bridge.test.js
    - tools/e2e/boot.spec.js
  modified:
    - web/src/boot/runtime_loader.js
    - web/src/boot/error_panel.js
    - web/src/python/python_bridge.js
    - web/src/main.js
    - web/src/debug/debug_session.js
    - web/src/debug/report.js
    - web/src/debug/overlay.js
    - index.html
    - src/scorched_core/game/game.py
    - src/scorched_web/entrypoint.py
    - tests/scorched_core/game/test_game.py
    - tests/scorched_web/test_entrypoint.py
    - web/test/debug/report.test.js
    - tools/e2e/helpers.js

key-decisions:
  - "Keyboard, touch, sampler and pause controller are created after the gate instead of before it: the gate tap would otherwise start a steering pointer and flip touch mode through the touch input's own pointerdown, and an Enter keydown would register with the keyboard. The gate's pointerType alone decides touch mode"
  - "__scorched.audioState is a live getter on audio.state, not a value copied at start: AudioContext.resume() settles asynchronously, so a snapshot taken in the gesture reads 'suspended'"
  - "rig.prewarm() runs twice: once before awaiting the runtime (terrain and both render paths compile while the download runs, which is idle main-thread time) and once after the instanced meshes exist"
  - "The debug session now starts at the gate click, so the report's elapsed minutes exclude the loading screen; timeToGateMs is reported separately as a 'time to gate' line"
  - "Copy report on the crash panel appends buildReport output even without a debug session (unknown fields render n/a), so a load-time crash still carries UA, build and flags"
  - "A second error appends to the panel and the onFatal callbacks fire once; errors thrown by the Copy handler (provider, clipboard) are swallowed so Copy always copies at least the error text"

patterns-established:
  - "Pattern: the e2e progress check records aria-valuenow with a MutationObserver installed by addInitScript, so a fast or cached load cannot hide the bar and the sequence can be asserted monotonic"
  - "Pattern: injected faults use allow-listed URL values; an invalid value falls back to no fault on both the JS and Python side"

requirements-completed: [PLAT-03, PLAT-09]

coverage:
  - id: D1
    description: "Real download progress: trackFetch counts decoded bytes of the three CDN files only while loadPyodide runs (0-80%), keeps status/statusText/content-type so wasm streaming compile works, passes other URLs through untouched, restores fetch in finally; an unlisted file gives an indeterminate bar"
    requirement: PLAT-03
    verification:
      - kind: unit
        ref: "web/test/boot/runtime_loader.test.js (23 tests); web/test/boot/loading_screen.test.js (9 tests)"
        status: pass
      - kind: e2e
        ref: "tools/e2e/boot.spec.js 'loading shows progress then a start gate' (progress values recorded from first paint, monotonic, ends at 100)"
        status: pass
    human_judgment: true
    rationale: "Safari's handling of the counted Response for streaming WASM compile (Assumption A6) and the felt time to the gate on a real phone are only verifiable on a device (pending human check 1)."
  - id: D2
    description: "Start gate: loading screen visible from first paint; after load a TAP / CLICK TO START gate waits for click, pointerup or Enter/Space (never pointerdown/touchstart) and creates, resumes and plays a silent buffer on an AudioContext inside the gesture; gameplay starts only after it"
    requirement: PLAT-03
    verification:
      - kind: unit
        ref: "web/test/boot/start_gate.test.js (16 tests)"
        status: pass
      - kind: e2e
        ref: "tools/e2e/boot.spec.js 'loading shows progress then a start gate', 'the game does not run before the gate is used', 'pressing Enter also starts the game' (audioState 'running' headless)"
        status: pass
    human_judgment: true
    rationale: "Audio actually becoming audible after the tap on iOS Safari and Android Chrome is a device judgment; Phase 1 plays no sound, so only the AudioContext state is checkable (pending human check 2)."
  - id: D3
    description: "Warm-up: 120 ticks on a throwaway game (crash flag forced off) run before play, with every proxy destroyed"
    requirement: PLAT-03
    verification:
      - kind: unit
        ref: "web/test/python/python_bridge.test.js (6 tests)"
        status: pass
      - kind: e2e
        ref: "tools/e2e/boot.spec.js 'the warm-up never trips the crash flag before the gate'"
        status: pass
    human_judgment: false
  - id: D4
    description: "?crash=py raises RuntimeError on simulation tick 120 exactly (119 is fine), ?crash=js and none never raise in Python, create_game parses 'crash' via FaultMode and ignores anything else"
    requirement: PLAT-09
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_fault_mode.py (8 tests); tests/scorched_core/game/test_game.py::test_the_python_fault_waits_for_step_120_and_not_119_fault and ::test_only_the_python_fault_mode_raises_in_the_simulation_fault; tests/scorched_web/test_entrypoint.py (9 crash cases)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Error panel for every failure class: Python traceback, JS frame exception, load failure (blocked CDN), unhandled rejection; shows message and stack via textContent only, stops the loop, offers Copy report (error + device report) and Reload; a second error is appended"
    requirement: PLAT-09
    verification:
      - kind: unit
        ref: "web/test/boot/error_panel.test.js (19 tests incl. markup-like text stays text, no innerHTML/outerHTML)"
        status: pass
      - kind: e2e
        ref: "tools/e2e/boot.spec.js crash=py (Traceback, tick 120, loop stopped), crash=js, crash=bogus ignored, Copy report puts the error and 'pyodide: 314.0.7' on the clipboard, Reload returns to the loading screen, blocked CDN ends on the panel"
        status: pass
    human_judgment: false
  - id: D6
    description: "WebGL context loss pauses the game with a non-fatal notice; restoring clears the notice and three.js re-uploads"
    requirement: PLAT-09
    verification:
      - kind: e2e
        ref: "tools/e2e/boot.spec.js 'losing the WebGL context pauses with a notice, restoring clears the notice' (WEBGL_lose_context in headless Chromium)"
        status: pass
    human_judgment: true
    rationale: "A real GPU context loss (backgrounded tab on a phone, driver reset) and visual recovery of the scene after restore cannot be reproduced headlessly; the e2e only forces it through WEBGL_lose_context (pending human check 4)."
  - id: D7
    description: "The 60 s load timeout rejects into the error panel with a CDN hint and no infinite spinner"
    requirement: PLAT-09
    verification:
      - kind: unit
        ref: "web/test/boot/runtime_loader.test.js 'rejects with a CDN hint when the loader never resolves within timeoutMs' and 'names the timeout in seconds and the likely cause'"
        status: pass
    human_judgment: true
    rationale: "The real 60 s path (a slow rather than blocked CDN) is only simulated with a short injected timeout; the blocked-CDN e2e proves the immediate-failure path (pending human check 3)."

duration: 20min
completed: 2026-10-17
status: complete
---

# Phase 1 Plan 09: First-Run Experience and Error Panel Summary

**Opening the link shows a loading screen from first paint with real decoded-byte download progress of the Pyodide CDN files (fetch wrapped only during loadPyodide), then a TAP / CLICK TO START gate whose click, pointerup or Enter creates and resumes an AudioContext after a 120-tick warm-up; every failure class ends on an error panel with traceback, Copy report and Reload, proven by `?crash=py` (RuntimeError on tick 120 exactly) and `?crash=js` (frame 120).**

## Performance

- **Duration:** about 20 min
- **Started:** 2026-10-17T16:53Z
- **Completed:** 2026-10-17T17:14Z (code pushed, Deploy and live smoke green)
- **Tasks:** 2 (both `auto` + `tdd="true"`, each with a separate RED commit)
- **Files modified:** 24 in the code commits (1818 insertions, 15 deletions); no dependency or lockfile changes

## Accomplishments

- **Real progress (PLAT-03).** `trackFetch` wraps `globalThis.fetch` for the span of `loadPyodide` and re-streams only bodies whose URL starts with the exact CDN prefix through a counting `ReadableStream`, copying status, statusText and headers so WebAssembly streaming compile still accepts the response. `progressFraction` divides by the 12,262,932 decoded bytes in `DECODED_BYTES` (9,598,218 + 2,545,637 + 119,077), scaled to the 0-80% share; a counted file outside the table returns null and the bar goes indeterminate. In real Chromium against the live CDN the bar visibly stepped 0, 1, 14, ... 80 during the download, then 100 at the gate.
- **Loading screen and gate.** `index.html` paints `#loading` (SCORCHED, `role="progressbar"` with `aria-valuenow`, status line, hidden `#start-gate`) before any module runs. `createLoadingScreen` keeps the bar forward-only and uses `textContent`. `waitForStartGesture` listens for `click` and `pointerup` on `#app` and Enter/Space on `window`, and inside the handler creates the `AudioContext`, calls `resume()` and plays a one-sample silent buffer; audio failures are swallowed so the game still starts.
- **Boot order.** The download starts first, then the GPU side (`rig.applyTier`, `rig.prewarm`, render) runs while it downloads; after the runtime: `startGame` (progress 0.8, "Starting Python..."), `warmUp` of 120 ticks on a throwaway game with `crash: null` (0.9, "Warming up graphics..."), instanced meshes, a second prewarm, one render (1.0), `timeToGateMs` recorded, gate shown. After the gesture the loading screen hides, keyboard, touch, sampler and pause controller are created, a touch gate tap turns touch mode on, and the loop starts. `ready` is set only after start.
- **Fault injection and error panel (PLAT-09).** `FaultMode` and `FAULT_TICK = 120` live in Python; `Game._step` raises `RuntimeError("Injected Python fault (?crash=py) at tick 120")` right after incrementing `tick_count` to 120, and `create_game` maps `crash` through `FaultMode(value)` with an unknown value falling back to NONE. `?crash=js` throws `Injected JS fault (?crash=js) at frame 120` in `onFrame`. The panel (textContent only) shows the Python traceback carried by `PythonError.message`, the JS frames below, Copy report (error text plus the debug session's report, or the same layout with n/a fields before one exists) and Reload; `showNotice`/`hideNotice` drive a non-fatal banner. Context loss pauses with `pause('context-lost')` and the notice; restore clears it.
- **Gates.** `make check` green: ruff, pytest 357 passed at 100.00% line and branch, vitest 330, build, Playwright 39 (4 workers). **`make perf` avg 0.564 ms, p95 0.634 ms** (500 stress bullets, held fire, drones; budget 3 ms; 01-08 measured 0.568/0.644). The bundle is 686.7 kB (181.6 kB gzip), the known chunk-size warning is unchanged in kind.

## Task Commits

1. **Task 1 RED:** `a28089a` (test) - trackFetch/progressFraction/loadRuntime, start gate, loading screen, report time-to-gate and boot.spec tests against inert skeletons
2. **Task 1 GREEN:** `070f3f2` (feat) - progress-tracking loader, `#loading` UI, gate with audio unlock, warm-up, boot order, gate-aware `bootGame`
3. **Task 2 RED:** `d35e2af` (test) - FaultMode, Game fault, create_game crash, error panel unit tests and crash/copy/reload/CDN/context-loss e2e against skeletons
4. **Task 2 GREEN:** `6de86d5` (feat) - fault raise, entrypoint parsing, error panel buttons/notice/provider, JS fault, context-loss handlers

**Plan metadata:** committed separately (docs: complete plan).

## CI and live verification

Pushed `6de86d5` to `origin/main` before this SUMMARY. Deploy run 39052601528 concluded success (https://github.com/rguillon/Stratoburst/actions/runs/39052601528); `make wait-deploy SHA=6de86d5df5db72285fef2e4dd1ac4bdef5073e12` confirmed the live site serves it, and `make e2e-live` passed against https://rguillon.github.io/Stratoburst/ (1 passed, through the gate-aware `bootGame`). The non-blocking E2E workflow run 39052601500 was still in progress when this was written.

## TDD Gate Compliance

Both tasks are `tdd="true"` in a `type: execute` plan; each has a RED test commit before its implementation commit.

- **RED Task 1 (`a28089a`):** vitest 37 failed, 267 passed, plus the Playwright boot.spec. Failures are assertion failures against inert skeletons (the size table `{}`, `trackFetch` not wrapping, `progressFraction` returning 0, a gate that resolves immediately, a loading screen that does nothing, no time-to-gate line in the report). Tests that pass in RED do so vacuously against the skeletons (the passthrough, body-less and lookalike-host cases, the "never moves backwards" no-ops) and are covered by the GREEN behaviour. Semantic assessment: every intended-failing test failed on its planned assertion; none on import or fixture errors (the skeleton `loadRuntime` ignores the injected loader precisely so no real Pyodide load starts).
- **RED Task 2 (`d35e2af`):** pytest 3 failed, 354 passed (step 120 did not raise; `create_game` ignored `crash=py` and `crash=js`; the `FaultMode` enum and constant were written in full in the RED commit because they are definitions, so `test_fault_mode.py` passes in RED by construction); vitest 9 failed (Copy report, Reload, notice, message not repeated); Playwright `crash=py` timed out waiting for `#error-panel` (30 s). Semantic assessment: all failures are planned-behaviour assertions against skeletons.
- **GREEN:** `070f3f2` and `6de86d5`, all suites green. **REFACTOR:** none needed.
- `gsd_run check tdd-red-evidence` was not run: the plan is not `type: tdd` and vitest/pytest text reports are not formats that classifier accepts (same position as plans 01-03 to 01-08).

## Files Created/Modified

- `web/src/boot/runtime_loader.js` - `DECODED_BYTES`, `TOTAL_DECODED_BYTES`, `trackFetch`, `progressFraction`, `loadRuntime` with progress and timeout
- `web/src/boot/loading_screen.js`, `web/src/boot/start_gate.js` - loading UI binding and the gesture gate with audio unlock
- `web/src/boot/error_panel.js` - Copy report, Reload, report provider, notice
- `web/src/python/python_bridge.js` - `warmUp`
- `web/src/main.js`, `index.html` - boot order, gate, post-gate input wiring, JS fault, context loss, `__scorched.started/audioState/timeToGateMs`
- `web/src/debug/debug_session.js`, `web/src/debug/report.js` - `timeToGateMs`, `reportText()`, time-to-gate report line
- `src/scorched_core/game/fault_mode.py`, `game.py`, `src/scorched_web/entrypoint.py` - fault injection
- Tests: `tests/scorched_core/game/{test_fault_mode,test_game}.py`, `tests/scorched_web/test_entrypoint.py`, `web/test/boot/{runtime_loader,start_gate,loading_screen,error_panel}.test.js`, `web/test/python/python_bridge.test.js`, `web/test/debug/report.test.js`
- `tools/e2e/helpers.js` (gate-aware `bootGame`), `tools/e2e/boot.spec.js` (11 tests)

## Decisions Made

See `key-decisions` above. No new Makefile target: every new test runs under the existing `make test` / `make e2e`, and no new command was added.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Gate tap would start a steering pointer and flip touch mode**
- **Found during:** Task 1 (main.js boot order design)
- **Issue:** The plan places the gate inside `#app`, where `createTouchInput` listens for `pointerdown`. With the inputs created before the gate, tapping the gate would begin a drag and set touch mode through the input's own callback (a mouse click would not), and Enter would register in the keyboard input.
- **Fix:** Keyboard, touch, sampler and the pause controller are created after `waitForStartGesture` resolves; `pointerType === 'touch'` alone calls `sampler.setTouchMode(true)`.
- **Files modified:** `web/src/main.js`
- **Committed in:** `070f3f2`

**2. [Rule 1 - Bug] audioState read as 'suspended' right after the gesture**
- **Found during:** Task 1 (boot.spec design)
- **Issue:** `AudioContext.resume()` settles asynchronously, so `audio.state` copied at start would not be 'running'.
- **Fix:** `__scorched.audioState` is a getter reading `audio?.state` live; the e2e polls it.
- **Files modified:** `web/src/main.js`, `tools/e2e/boot.spec.js`
- **Committed in:** `070f3f2`

**3. [Rule 2 - Missing Critical] Plan 01-04 did not give `buildReport` a time-to-gate line**
- **Found during:** Task 1 (the plan says buildReport "accepts timeToGateMs"; it did not)
- **Fix:** `buildReport` prints `time to gate: N.N s` (or n/a); `createDebugSession` takes and snapshots `timeToGateMs`; two report tests added in the RED commit.
- **Files modified:** `web/src/debug/report.js`, `web/src/debug/debug_session.js`, `web/test/debug/report.test.js`
- **Committed in:** `a28089a` (tests), `070f3f2`

**4. [Rule 2 - Missing Critical] vitest coverage the plan did not list**
- **Issue:** The plan listed only `runtime_loader.test.js`. The gate (audio unlock ordering, no pointerdown), loading screen, error panel (T-01-21 textContent guard, Copy provider swallowing) and `warmUp` (proxy destruction) are safety-relevant.
- **Fix:** Added `start_gate.test.js`, `loading_screen.test.js`, `error_panel.test.js` in the RED commits and `python_bridge.test.js` alongside the `warmUp` implementation (the one test file that was not in a RED commit).
- **Committed in:** `a28089a`, `d35e2af`, `070f3f2`

**5. [Rule 1 - Bug] Duplicate message in the panel and the false-positive HTML-API grep**
- **Found during:** Task 2
- **Issue:** A V8 `Error.stack` already begins with the message (for a `PythonError`, the full traceback), so showing message plus stack printed it twice. Separately, a pre-existing comment in `web/src/debug/overlay.js` contained the word `innerHTML`, so the acceptance grep (which must return nothing) matched a comment.
- **Fix:** The panel shows the message once with the frames below it (and the stack after the message on engines whose stack omits it). The overlay comment was reworded to say "an HTML string".
- **Files modified:** `web/src/boot/error_panel.js`, `web/src/debug/overlay.js`
- **Committed in:** `6de86d5`

**6. [Rule 1 - Test assumption] e2e asserted TICK_COUNT == 120 after the Python crash**
- **Found during:** Task 2 (first Playwright run)
- **Issue:** The header is repacked after the steps, so a raise inside step 120 leaves the last good frame's value (119 observed), not 120.
- **Fix:** The assertion is a range (100 < ticks < 121) and the exact 120 is proven by the pytest test on `Game.tick_count`.
- **Files modified:** `tools/e2e/boot.spec.js`
- **Committed in:** `6de86d5`

**7. [Rule 1 - Test robustness] Progress e2e could miss the bar on a fast load**
- **Found during:** Task 1 (first Playwright run: a poll loop saw only the final 100)
- **Fix:** A `MutationObserver` installed by `addInitScript` records every `aria-valuenow` and class change from the first paint; the test also asserts the sequence never goes backwards.
- **Files modified:** `tools/e2e/boot.spec.js`
- **Committed in:** `070f3f2`

---

**Total deviations:** 7 (2 bugs in the plan's wiring, 2 missing critical, 3 test or documentation robustness). **Impact on plan:** additive; every planned behaviour is delivered and tested.

## Issues Encountered

- The plan's ordering put the input devices before the gate; that had to change (deviation 1).
- `tools/e2e/boot.spec.js` is slow under software GL (11 tests, about 90 s serially), as is the full suite (39 tests, 1.9 min with 4 workers); no flake was seen across the runs.
- Vite still prints the known chunk-size warning and the `node:*` externalized-module notices (unchanged in kind).
- `gh` is not installed; CI status came from `make wait-deploy` and the public Actions API.

## Pending Human Verification

The plan has no `<human-check>` block; these items need a person. None blocks the plan (it is autonomous).

1. **Real-phone loading and gate (D1, D2, Assumption A6):** on an iPhone (Safari) and an Android phone (Chrome) open the live URL, https://rguillon.github.io/Stratoburst/ (add `?debug` to see `time to gate` in the report). Expect the bar to creep forward during the download (a stuck or jumping bar is a failure, and a bar that never reaches the gate means Safari rejected the counted Response for streaming WASM compile, in which case report it), then TAP / CLICK TO START. Note how long it takes to reach the gate on mobile data and on wifi (Open Question 5); plan 01-10 owns the device session.
2. **Audio unlock (D2):** on both phones, tap the gate. Expect the game to start at once. With `?debug` open the console and check `__scorched.audioState` is `running` (or use the Safari/Chrome remote inspector). Phase 1 plays no sound, so there is nothing to hear yet; if the state is `suspended` after the tap, Phase 2 sounds would be silent on that device.
3. **Slow or blocked network (D7):** throttle the connection (Chrome DevTools "Slow 3G", or block `cdn.jsdelivr.net` with a content blocker) and open the page. Expect either a slow bar that finishes, or after at most 60 s the error panel naming the CDN or network with a working Reload button, never a permanent spinner.
4. **Context loss on a device (D6):** on a phone, start the game, background the browser for a minute, return. Expect either an intact game behind the PAUSED overlay, or the "Graphics context lost" banner that clears by itself and a visually intact scene after a tap on the overlay. Report a black or corrupted scene.
5. **Shared crash links (D4, D5):** open `?crash=py` and `?crash=js` on a desktop and a phone. Expect the error panel after about two seconds of play with the Python traceback or the JS message, and a Copy report that pastes the error plus the device report. Judge whether the panel text is readable on a phone screen.

## Known Stubs

None.

## Threat Flags

None. T-01-21 is mitigated: the panel and notice use `textContent` only, `error_panel.test.js` replaces `innerHTML`/`outerHTML` with throwing setters and checks markup-like error text stays text, and `grep -rnE "innerHTML|outerHTML|insertAdjacentHTML" web/src` returns nothing. T-01-22 is mitigated by the 60 s timeout and the blocked-CDN e2e. T-01-23 is mitigated: the wrapper is restored in a finally block (vitest after success, failure and timeout) and non-CDN, lookalike-host and body-less responses are returned untouched. T-01-24 is accepted as planned (`crash` is allow-listed on both sides). T-01-SC: no new packages, lockfiles untouched.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 01-10 (device session) can use the gate, `time to gate` in the device report, and the panel's Copy report; items 1 to 4 above belong to that session, together with Assumption A6 (Safari streaming compile of the counted Response).
- Phase 2 sounds can rely on the `AudioContext` created and resumed inside the gate gesture; it is currently held only by `__scorched.audioState` under `?debug` and by `main()`'s local `audio`, so Phase 2 must pass it into its audio layer.

---
*Phase: 01-playable-core-on-real-devices*
*Completed: 2026-10-17*

## Self-Check: PASSED

Verified: all key files exist on disk; commits `a28089a`, `070f3f2`, `d35e2af`, `6de86d5` are ancestors of HEAD and of `origin/main`; `plan_head_before..plan_head_after` counts 4 commits; `make check` and `make perf` green; Deploy run success; `make e2e-live` 1 passed.
