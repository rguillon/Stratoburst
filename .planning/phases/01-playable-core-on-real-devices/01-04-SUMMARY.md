---
phase: 01-playable-core-on-real-devices
plan: 04
subsystem: rendering
tags: [quality-tiers, adaptive-resolution, bloom, debug-overlay, device-report, vitest, playwright, tdd]

requires:
  - phase: 01-playable-core-on-real-devices
    provides: "Renderer rig and bloom pipeline (01-03), URL flags with allow-listed ?tier (01-01), frame loop with rAF timestamps (01-01), bridge header slots (01-01/01-03)"
provides:
  - "Quality tier ladder (high / mid / low) changing only DPR, canvas pixel budget and bloom mode; effectiveDpr, renderSize, initialTier"
  - "Pure step-down controller with 2 s warm-up, 90-sample median window, 3 strikes at > 21.5 ms, 3000 ms spacing and verify-and-lock (refresh-capped-or-cpu-bound)"
  - "ScaledBloomPass (half-resolution bloom) and a composer-bypass low tier; rig.applyTier reallocates only on a changed integer size or DPR; rig.prewarm of both render paths; bloom-unavailable forces and locks low"
  - "?debug overlay (4 Hz, textContent) and a Copy report button producing the per-minute device measurement report; frame stats ring buffers and minute aggregator"
  - "__BUILD_HASH__ and __THREE_VERSION__ build constants; debug hooks __scorched.tier / tierLog / lockReason / build / stats()"
affects: [01-05, 01-06, 01-07, 01-08, 01-10]

plan_head_before: d2981d7a349bf42bb9b336625151cf7f690b6e80
plan_head_after: 7cd348514f421f2eee38a62cdea6dc17f2107628

actuals:
  tokens: 16500
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Pure controller + explicit clock: createQualityController(update(dtMs, nowMs)) has no DOM and no timers, so every boundary is a synthetic-input unit test"
    - "Tiers are presentation-only: nothing under src/scorched_core mentions a tier"
    - "Debug-only objects live behind one factory (createDebugSession) that main.js calls only under ?debug"
    - "Fake-DOM test helper (web/test/helpers/fake_dom.js) so overlay and report UI are unit-tested in the node environment without adding a package"

key-files:
  created:
    - web/src/quality/tiers.js
    - web/src/quality/quality_controller.js
    - web/src/quality/scaled_bloom_pass.js
    - web/src/loop/frame_stats.js
    - web/src/debug/overlay.js
    - web/src/debug/report.js
    - web/src/debug/debug_session.js
    - web/test/quality/tiers.test.js
    - web/test/quality/quality_controller.test.js
    - web/test/quality/scaled_bloom_pass.test.js
    - web/test/loop/frame_stats.test.js
    - web/test/debug/report.test.js
    - web/test/debug/overlay.test.js
    - web/test/helpers/fake_dom.js
    - tools/e2e/tier.spec.js
    - tools/e2e/debug.spec.js
  modified:
    - web/src/render/post_pipeline.js
    - web/src/render/renderer_rig.js
    - web/src/main.js
    - vite.config.js

key-decisions:
  - "Evaluations happen at samples 90, 120, 150 ...: a step-down needs three consecutive strike evaluations, so the earliest step-down is on the 150th post-warm-up sample"
  - "A deferred step-down (strikes reached but < 3000 ms since the last change) keeps its strikes and retries at the next evaluation instead of resetting"
  - "The evaluation that performs verify also counts as a normal strike evaluation when the gain is accepted"
  - "Composer passes would each reset renderer.info, so under ?debug autoReset is turned off and info is read and reset once per frame to show whole-frame draw calls and triangles"
  - "Controller gained lock(tier, reason) plus locked / reason getters (not in the plan interface) so main can force low with reason bloom-unavailable and the debug hook can report the lock reason"
  - "Half-float support is checked up front (EXT_color_buffer_float or EXT_color_buffer_half_float) as well as by try/catch, because three does not throw on an incomplete framebuffer"

patterns-established:
  - "Pattern: thrash-proof adaptation = warm-up + order-independent median window + strike counter + rate limit + verify-and-lock"
  - "Pattern: report text is built by a pure function (buildReport) from a plain info object, so the artifact format is unit-tested"

requirements-completed: [PLAT-05, PLAT-04]

coverage:
  - id: D1
    description: "Tier ladder and arithmetic: effectiveDpr (cap, pixel budget, zero-area guard), renderSize (floor, minimum 1), initialTier (forced / touch-primary mid / high)"
    requirement: PLAT-05
    verification:
      - kind: unit
        ref: "web/test/quality/tiers.test.js (9 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Step-down controller edges: 21.5 ms strict boundary, 3000 ms adjacency, exactly 10% gain keeps the tier while 5% locks, warm-up and 90-sample emptiness, even-count median and shuffle independence, low floor, forced and locked controllers"
    requirement: PLAT-05
    verification:
      - kind: unit
        ref: "web/test/quality/quality_controller.test.js (22 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "?tier=low|mid|high forces and locks a tier within its pixel budget; an invalid ?tier means auto (unlocked, high on a desktop pointer)"
    requirement: PLAT-05
    verification:
      - kind: e2e
        ref: "tools/e2e/tier.spec.js (4 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "?debug overlay and Copy report: overlay shows fps, tick, tier and build hash; the report contains pyodide: 314.0.7; without ?debug neither element exists; report has no network path"
    requirement: PLAT-04
    verification:
      - kind: unit
        ref: "web/test/debug/report.test.js, web/test/debug/overlay.test.js, web/test/loop/frame_stats.test.js"
        status: pass
      - kind: e2e
        ref: "tools/e2e/debug.spec.js (2 tests)"
        status: pass
      - kind: other
        ref: "grep -rnE 'sendBeacon|XMLHttpRequest|WebSocket' web/src returns nothing; no fetch( call in web/src"
        status: pass
    human_judgment: false
  - id: D5
    description: "Auto step-down and verify-and-lock actually keep a real phone near 30 fps without thrashing, and the report numbers (frame, tick, per-minute) are readable and trustworthy on a real device"
    requirement: PLAT-05
    verification: []
    human_judgment: true
    rationale: "Only a real phone shows whether the starting thresholds (21.5 ms, 90 samples, 3 strikes) and tier values are right; headless SwiftShader proved the mechanism, not the tuning. Decided from the report in plan 01-10."
  - id: D6
    description: "Tiers never change gameplay (simulation, entity counts, hitboxes)"
    requirement: PLAT-05
    verification:
      - kind: other
        ref: "grep -rn tier src/scorched_core returns nothing; tier code is web/src/quality and the render rig only"
        status: pass
    human_judgment: true
    rationale: "Fairness prohibition is a judgment-tier statement; the grep shows no coupling today but cannot prove future plans keep it"

duration: 8min
completed: 2026-10-17
status: complete
---

# Phase 1 Plan 04: Quality Tiers and Device Report Summary

**Automatic high/mid/low quality tiers (DPR cap, pixel budget, full / half / no bloom) with a pure thrash-proof step-down controller and verify-and-lock, plus a `?debug` overlay and a Copy report that produce the per-minute numbers the go/no-go gate reads.**

## Performance

- **Duration:** about 8 min
- **Started:** 2026-10-17T15:22:49Z
- **Completed:** 2026-10-17T15:31Z (code); CI and live checks green about 5 min later
- **Tasks:** 2 (both `auto` + `tdd="true"`, each with a separate RED commit)
- **Files modified:** 20 files in the code commits (1569 insertions, 20 deletions); no lockfile or dependency changes

## Accomplishments

- `createQualityController` is pure (explicit `nowMs`, no timers) and pinned at every plan edge by a named vitest case: median of exactly 21.5 ms is not a strike while 21.5 ms plus epsilon is, 2999 ms defers and 3000 ms allows a second step, a 5% gain steps back up and locks with `refresh-capped-or-cpu-bound` while exactly 10% keeps the tier, warm-up samples are not counted, and shuffling samples inside each 30-block gives identical decisions.
- Tier changes go through `rig.applyTier`, which reallocates only when the integer backing size or the DPR changes; `ScaledBloomPass` halves the whole bloom chain for `mid` and `low` bypasses the composer and renders directly. Both paths are compiled and rendered once at load (`rig.prewarm`), and an unsupported half-float target forces and locks `low` with reason `bloom-unavailable`.
- Observed for real in headless Chromium on software GL: with no forced tier, `?debug&stress=500` stepped `high -> mid` at 14.9 s and `mid -> low` at 22.9 s, each respecting the 2 s warm-up and the 3 s spacing, and the report listed both changes.
- `?debug` overlay (4 Hz via `textContent`) shows fps, frame ms avg/p50/p95/max over 120 frames, tick ms including `assign`, render-submit ms, steps per frame, bullet and drone counts, tier, DPR, canvas pixels, whole-frame draw calls and triangles, WASM and JS heap, elapsed minutes, frames over 25 ms and the build hash. Copy report writes plain text with UA, screen, DPR, GL renderer, shader precision, Pyodide and three versions, build, flags, tier log with timestamps and `minute N:` aggregates (clipboard, or a selected readonly textarea when the clipboard is unavailable).
- No telemetry: `grep -rnE "sendBeacon|XMLHttpRequest|WebSocket" web/src` and `grep -rn "fetch(" web/src` both return nothing.
- Suites: vitest 90 tests (was 22), Playwright 10 specs (was 4), pytest 136 at 100.00% line and branch, ruff clean, `make perf` 0.5154 ms average (budget 3 ms).

## Task Commits

1. **Task 1 RED:** `e4861ee` (test) - tiers, controller and scaled-bloom tests against skeleton modules
2. **Task 1 GREEN:** `ddb0ba8` (feat) - tiers, controller, ScaledBloomPass, tier-aware pipeline and rig, main wiring, tier e2e spec
3. **Task 2 RED:** `0a5735b` (test) - frame stats, report, overlay and debug e2e against skeletons
4. **Task 2 GREEN:** `7cd3485` (feat) - frame stats, overlay, report, debug session, build constants, main wiring

**Plan metadata:** committed separately (docs: complete plan).

## CI and live verification

Code commits were pushed to `origin/main` before this SUMMARY. Deploy run 39045364495 for `7cd3485` concluded success (https://github.com/rguillon/Stratoburst/actions/runs/39045364495; `make wait-deploy` confirmed the live site serves it) and `make e2e-live` passed against https://rguillon.github.io/Stratoburst/ (1 passed). Local `make check` (ruff, pytest 136 at 100.00%, vitest 90, build, Playwright 10) and `make perf` (avg 0.5154 ms, p95 0.5946 ms, budget 3 ms) were green before the push.

## TDD Gate Compliance

Both tasks are `tdd="true"` in a `type: execute` plan, with the RED test commit before each implementation commit.

- **RED Task 1 (`e4861ee`):** 32 failed, 7 passed. The skeleton modules return wrong values (`0`, `{width: 0, height: 0}`, `'high'`, never-changing controller), so every failure is a planned-behavior assertion, for example `expected 'high' to be 'mid'`, `expected +0 to be 2.5` (median), `expected -1 to be 149` (no step-down happened). The 7 that passed are negative cases that a no-op skeleton satisfies by construction (exactly 21.5 ms never strikes, low floor, fewer than 90 samples, `initialTier` default of high). Semantic assessment: all intended-failing tests failed on their own assertion, none on import, syntax or fixture errors.
- **RED Task 2 (`0a5735b`):** 25 failed, 3 passed in vitest, plus the debug e2e failing with `element(s) not found` for `#debug-overlay`. Some overlay and report tests fail with `TypeError: Cannot read properties of null` because the skeleton returns `null` for the elements the behavior is supposed to create; that is the missing behavior surfacing as a missing object, not a harness fault.
- **GREEN:** `ddb0ba8` and `7cd3485`, all suites green. **REFACTOR:** none needed.
- `gsd_run check tdd-red-evidence` was not run: the plan is not `type: tdd` and the reports were plain vitest text, not a format that classifier accepts (same position as plan 01-03).

## Files Created/Modified

- `web/src/quality/tiers.js` - frozen `TIERS`, `TIER_ORDER`, `effectiveDpr`, `renderSize`, `initialTier`
- `web/src/quality/quality_controller.js` - pure controller, exported constants, `median`, `lock()`
- `web/src/quality/scaled_bloom_pass.js` - `UnrealBloomPass` subclass with `setScale`
- `web/src/render/post_pipeline.js`, `renderer_rig.js` - tier-aware pipeline (`setTier`, `enabled`), `applyTier`, `prewarm`, coalesced resize with `visualViewport`
- `web/src/main.js` - initial tier, controller, tier log, bloom-unavailable fallback, visibility resume, debug session wiring
- `web/src/loop/frame_stats.js` - `createFrameStats`, `createMinuteAggregator`
- `web/src/debug/overlay.js`, `report.js`, `debug_session.js` - overlay, report and clipboard, and the debug-only wiring
- `vite.config.js` - `__BUILD_HASH__` and `__THREE_VERSION__`
- `web/test/...`, `tools/e2e/tier.spec.js`, `tools/e2e/debug.spec.js` - tests, including a fake-DOM helper

## Decisions Made

See `key-decisions` above. The two that matter for plan 01-10: the controller starts at the plan's thresholds (21.5 ms strike, 90-sample window, 3 strikes, 10% gain) untuned, and the report shows tier changes with timestamps so the first device run can retune them.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Resume handling for the controller and the clock**
- **Found during:** Task 1 (main.js wiring)
- **Issue:** The plan says the controller ignores 2 s after "start, resume or a tier change" but nothing called `resetWarmup`, and the frame loop's `resetClock` was never called, so a backgrounded tab would feed one huge `dt` to both the controller and the simulation.
- **Fix:** `visibilitychange` to visible calls `loop.resetClock()` and `controller.resetWarmup(now)`; the controller is also warmed up right before `loop.start()` so the Pyodide load time is not counted.
- **Files modified:** `web/src/main.js`
- **Committed in:** `ddb0ba8`

**2. [Rule 1 - Bug] Draw-call counter would have shown only the last composer pass**
- **Found during:** Task 2 (overlay)
- **Issue:** three resets `renderer.info` on every `render()` call; the composer makes several, so `info.render.calls` after a frame covers only the final pass.
- **Fix:** under `?debug`, `info.autoReset = false` and the session reads then resets once per frame. Measured 3 calls and 1010 triangles for the low (direct) path with 500 bullets.
- **Files modified:** `web/src/debug/debug_session.js`
- **Committed in:** `7cd3485`

**3. [Rule 3 - Blocking] Extra interface surface**
- **Issue:** the plan's controller interface had no way to force `low` with a reason for `bloom-unavailable` and no way to read the lock reason; the report text needs the three version `0.186.1` which `THREE.REVISION` does not provide.
- **Fix:** added `lock(tier, reason)`, `locked` and `reason` to the controller, `__THREE_VERSION__` (read from the exact-pinned `package.json` entry) next to `__BUILD_HASH__`, an overlay `due()` so the 4 Hz throttle also skips building the text, and `debug_session.js` to keep the `?debug` code out of main.js.
- **Files modified:** `web/src/quality/quality_controller.js`, `vite.config.js`, `web/src/debug/overlay.js`, `web/src/debug/debug_session.js`
- **Committed in:** `ddb0ba8`, `7cd3485`

**4. [Rule 2 - Missing Critical] Extra tests beyond the plan's list**
- Added `scaled_bloom_pass.test.js`, `overlay.test.js` and `tier.spec.js` (forced tiers respect their pixel budget; invalid `?tier` means auto), since the plan only named four vitest files and one e2e spec but its truths cover those behaviors.

---

**Total deviations:** 4 (1 bug, 2 missing critical, 1 blocking). **Impact on plan:** additive; no plan behavior was dropped or weakened.

## Observations Worth Carrying Forward

- The low tier renders directly with material tone mapping; in a headless screenshot the orange HDR bullets come out pale yellow-white and unhaloed, while the composer tiers show the orange halo. The ship also reads blue-grey in low and white (glow-washed) in mid and high. The plan asked to verify this match visually; it looks acceptable but is not identical (see pending human check).
- With 500 bullets on this small playfield the bloom tiers wash most of the frame orange. That was already true in plan 01-03 (strength 0.45) and is a tuning question for the first real-device look, not a tier bug.
- Software GL (SwiftShader) fell to `low` and still ran at about 24 fps; those numbers do not count toward the go/no-go bars.

## Issues Encountered

- Vite still prints the known chunk-size warning (bundle 609 kB, 157 kB gzip, up from 599 / 153 kB). Harmless; payload review belongs to a later plan.
- `gh` is not installed; CI status is read through the public Actions API via `make wait-deploy`.

## Pending Human Verification

The plan carries no `<human-check>` blocks. Two judgment items from the coverage block still need a human, both decided with real hardware in plan 01-10:

1. **Tuning on a real phone (D5):** open `?debug&stress=500` on the phone (start tier `mid`), let it run 5 minutes, tap Copy report and paste it back. Look at the tier log (no oscillation, at most one or two changes, a lock reason if the display is capped) and at the per-minute lines (avg fps at or above 29, p95 frame at or below 40 ms). Also try `?tier=low` and `?tier=high` for 2 minutes each for comparison.
2. **Visual match of the low tier (from Observations):** open `?debug&stress=500&tier=low` next to `?tier=high` and confirm the low tier is acceptable (bullets visible and readable, ship visible, no broken colors) even without the glow.

## Known Stubs

None added. The flat ground and placeholder ship from plan 01-01 remain tracked in `.planning/WINDOWS.md`.

## Threat Flags

None. T-01-13 (report only on explicit click, only to clipboard or a local textarea, no network path) is evidenced by the grep results above; T-01-14 (`?tier=` allow-listed in `parseUrlFlags`, controller rate-limited and locking) is covered by `tier.spec.js` and the controller tests. No new packages: `ScaledBloomPass` subclasses the `UnrealBloomPass` shipped in three 0.186.1.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 01-05 onward can render the real terrain knowing tiers only touch DPR, canvas pixels and bloom; any new custom `ShaderMaterial` must include the tone-mapping chunks so the direct (low) path matches the composer path.
- Plan 01-10 gets its instrument: `?debug&stress=500` overlay plus Copy report, with the thresholds in `quality_controller.js` as the knobs to retune.
- Open concern: all numbers so far are desktop Node or software GL; the real-phone behavior of the thresholds is unmeasured.

---
*Phase: 01-playable-core-on-real-devices*
*Completed: 2026-10-17*

## Self-Check: PASSED

Verified: all key files exist on disk; commits `e4861ee`, `ddb0ba8`, `0a5735b`, `7cd3485` are ancestors of HEAD and of `origin/main`; `plan_head_before..plan_head_after` counts 4 commits; `make check` and `make perf` green; Deploy run success; `make e2e-live` 1 passed.
