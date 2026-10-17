---
phase: 01-playable-core-on-real-devices
reviewed: 2026-10-17T00:00:00Z
depth: standard
files_reviewed: 127
files_reviewed_list:
  - .github/workflows/deploy.yml
  - .github/workflows/e2e.yml
  - .github/workflows/gate.yml
  - .github/workflows/preview.yml
  - .gitignore
  - .node-version
  - .python-version
  - Makefile
  - README.md
  - index.html
  - package.json
  - playwright.config.js
  - public/.nojekyll
  - pyproject.toml
  - src/scorched_core/__init__.py
  - src/scorched_core/clock/__init__.py
  - src/scorched_core/clock/fixed_step_runner.py
  - src/scorched_core/clock/refresh_estimator.py
  - src/scorched_core/collision/circle_hits.py
  - src/scorched_core/collision/uniform_grid.py
  - src/scorched_core/entities/__init__.py
  - src/scorched_core/entities/drone_swarm.py
  - src/scorched_core/entities/player_ship.py
  - src/scorched_core/game/__init__.py
  - src/scorched_core/game/fault_mode.py
  - src/scorched_core/game/game.py
  - src/scorched_core/input/__init__.py
  - src/scorched_core/input/button.py
  - src/scorched_core/input/input_frame.py
  - src/scorched_core/pools/bullet_pool.py
  - src/scorched_core/protocol.py
  - src/scorched_core/stages/__init__.py
  - src/scorched_core/stages/terrain_scroll.py
  - src/scorched_core/stress/bullet_storm.py
  - src/scorched_core/tuning.py
  - src/scorched_core/weapons/__init__.py
  - src/scorched_core/weapons/twin_shot.py
  - src/scorched_web/__init__.py
  - src/scorched_web/bridge/__init__.py
  - src/scorched_web/bridge/render_sink.py
  - src/scorched_web/entrypoint.py
  - src/scorched_web/web_game.py
  - tests/scorched_core/clock/test_fixed_step_runner.py
  - tests/scorched_core/clock/test_refresh_estimator.py
  - tests/scorched_core/collision/test_circle_hits.py
  - tests/scorched_core/collision/test_uniform_grid.py
  - tests/scorched_core/entities/test_drone_swarm.py
  - tests/scorched_core/entities/test_player_ship.py
  - tests/scorched_core/game/test_fault_mode.py
  - tests/scorched_core/game/test_game.py
  - tests/scorched_core/input/test_button.py
  - tests/scorched_core/input/test_input_frame.py
  - tests/scorched_core/pools/test_bullet_pool.py
  - tests/scorched_core/stages/test_terrain_scroll.py
  - tests/scorched_core/stress/test_bullet_storm.py
  - tests/scorched_core/weapons/test_twin_shot.py
  - tests/scorched_web/bridge/test_render_sink.py
  - tests/scorched_web/test_entrypoint.py
  - tests/scorched_web/test_web_game.py
  - tests/test_conventions.py
  - tools/e2e/boot.spec.js
  - tools/e2e/debug.spec.js
  - tools/e2e/helpers.js
  - tools/e2e/keyboard.spec.js
  - tools/e2e/pause.spec.js
  - tools/e2e/playfield.spec.js
  - tools/e2e/shooting.spec.js
  - tools/e2e/smoke.spec.js
  - tools/e2e/stress.spec.js
  - tools/e2e/tier.spec.js
  - tools/e2e/touch.spec.js
  - tools/live_url.mjs
  - tools/perf_node.mjs
  - tools/wait_for_deploy.mjs
  - vite.config.js
  - web/src/boot/error_panel.js
  - web/src/boot/loading_screen.js
  - web/src/boot/runtime_loader.js
  - web/src/boot/start_gate.js
  - web/src/boot/url_flags.js
  - web/src/debug/debug_session.js
  - web/src/debug/overlay.js
  - web/src/debug/report.js
  - web/src/input/input_sampler.js
  - web/src/input/keyboard_input.js
  - web/src/input/touch_input.js
  - web/src/input/touch_mapper.js
  - web/src/loop/frame_loop.js
  - web/src/loop/frame_stats.js
  - web/src/loop/pause_controller.js
  - web/src/main.js
  - web/src/python/python_bridge.js
  - web/src/quality/quality_controller.js
  - web/src/quality/scaled_bloom_pass.js
  - web/src/quality/tiers.js
  - web/src/render/bullet_instances.js
  - web/src/render/camera_fit.js
  - web/src/render/drone_instances.js
  - web/src/render/playfield_mask.js
  - web/src/render/post_pipeline.js
  - web/src/render/renderer_rig.js
  - web/src/render/ship_model.js
  - web/src/render/terrain_ring.js
  - web/test/boot/error_panel.test.js
  - web/test/boot/loading_screen.test.js
  - web/test/boot/runtime_loader.test.js
  - web/test/boot/start_gate.test.js
  - web/test/boot/url_flags.test.js
  - web/test/debug/overlay.test.js
  - web/test/debug/report.test.js
  - web/test/helpers/fake_dom.js
  - web/test/input/input_sampler.test.js
  - web/test/input/keyboard_input.test.js
  - web/test/input/touch_input.test.js
  - web/test/input/touch_mapper.test.js
  - web/test/loop/frame_loop.test.js
  - web/test/loop/frame_stats.test.js
  - web/test/loop/pause_controller.test.js
  - web/test/python/python_bridge.test.js
  - web/test/quality/quality_controller.test.js
  - web/test/quality/scaled_bloom_pass.test.js
  - web/test/quality/tiers.test.js
  - web/test/render/camera_fit.test.js
  - web/test/render/drone_instances.test.js
  - web/test/render/playfield_mask.test.js
  - web/test/render/ship_model.test.js
  - web/test/render/terrain_ring.test.js
findings:
  critical: 0
  warning: 8
  info: 9
  total: 17
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-10-17
**Depth:** standard
**Files Reviewed:** 127
**Status:** issues_found

## Summary

All files in scope were read, with extra attention on `src/scorched_core`, `src/scorched_web`, `web/src`, CI/Makefile/tools, and the tests. The Python suite was also run natively (357 passed, 100.00% line+branch coverage; `-p no:cacheprovider`, no bytecode). No structural (fallow) findings were supplied.

The code is in good shape. The fixed-step runner, swap-remove pools, counting-sort grid, struct-of-arrays layout and the JS/Python boundary (one `assign` per channel per frame, header-only flush when no step ran) match the project constraints. The grid broadphase is correct: with a 32-unit cell and a combined radius of 10, the 3x3 query is sufficient, and the descending swap-remove order in `resolve_shots_vs_drones` is sound. Trust boundaries (URL flags, `create_game` options, `textContent` only, `FaultMode` fallback) are handled.

I found no BLOCKER. The defects that remain are boundary-validation gaps, one verified tuning bug, input-handling robustness problems, a CI privilege issue, a gap between the "Shooting feels great" core value and what is actually rendered (entities are not interpolated), and test coverage gaps on the JS side. Every claim marked "verified" was reproduced by running the code.

## Warnings

### WR-01: Non-finite or negative `dt_ms` is not validated at the Python boundary

**File:** `src/scorched_core/game/game.py:183` (also `src/scorched_core/clock/fixed_step_runner.py:22`, `src/scorched_core/clock/refresh_estimator.py:31-39`)
**Issue:** `PlayerShip` carefully rejects non-finite input, but the time input is not validated. Verified by running it:
- A negative `dt_ms` goes straight into the accumulator (`min(dt_ms, MAX_DT_MS)` has no lower bound). Calling `tick(-5000, ...)` leaves `acc = -4999.99` and the next five or more ticks run 0 steps; the simulation freezes for about `|dt| / 16.7` frames while the header still reports normal values. rAF timestamps are not guaranteed monotonic on every browser or after a clock reset, and `frame_loop.js` computes `ts - lastTs` with no clamp.
- `NaN` raises `ValueError: cannot convert float NaN to integer` inside `RefreshEstimator.snap` once 3 samples exist (the `dt_ms <= 0.0` guard is false for NaN). That bypasses the estimator's own "nothing to learn" path and turns a bad sample into a fatal error panel.
**Fix:** Sanitise once at the facade:
```python
import math
...
def tick(self, dt_ms: float, ...) -> int:
    if not math.isfinite(dt_ms) or dt_ms < 0.0:
        dt_ms = 0.0
```
and add a test for negative, NaN and infinite `dt_ms`. Optionally clamp in `FixedStepRunner.advance` as well (`max(0.0, min(dt_ms, MAX_DT_MS))`).

### WR-02: Drone sway amplitude is larger than the spawn margin, so drones leave the playfield

**File:** `src/scorched_core/tuning.py:38,43` (used in `src/scorched_core/entities/drone_swarm.py:60,97`)
**Issue:** `DRONE_SWAY = 30.0` but `DRONE_SPAWN_MARGIN_X = 24.0`. A drone's centre is `base_x + 30 * sin(phase)` with `base_x` in `[24, 216]`. Verified over 20,000 steps: x ranges from **-5.6 to 244.6** against a playfield of 0..240. Drones at the extremes hang half outside the outline, can be shot while partly off-field, and the hit-test is performed at positions the player cannot properly see. The comment on the margin implies it was meant to keep drones inside.
**Fix:** Derive the margin from the sway and radius so they cannot drift apart:
```python
DRONE_SPAWN_MARGIN_X: Final = DRONE_SWAY + DRONE_RADIUS  # 38.0
```
and add a test asserting every drone x stays within `[DRONE_RADIUS, PLAYFIELD_W - DRONE_RADIUS]` over a full lifetime.

### WR-03: Keyboard handler swallows browser shortcuts and can stick keys when a modifier is held

**File:** `web/src/input/keyboard_input.js:51-54`
**Issue:** Every bound `event.code` is `preventDefault()`-ed and added to `held` regardless of `ctrlKey`, `metaKey` or `altKey`. Consequences: Ctrl/Cmd+S, P, D, J, K, A and Alt+ArrowLeft (browser Back) are silently disabled during play. On macOS, while Cmd is held the page does not receive `keyup` for the other key, so Cmd+A leaves `left` held until the next blur (the ship then flies left by itself). The `pause_controller` ignores Alt/Meta/Control as "switcher" keys for resume, but the keyboard device does not apply the same care.
**Fix:**
```js
function onKey(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    if (event.type === 'keydown') return; // leave shortcuts alone
    // fall through for keyup so a held game key is always released
  }
  ...
}
```
and clear `held` when a `Meta` keydown is seen.

### WR-04: Every `window` error or unhandled rejection is treated as fatal

**File:** `web/src/boot/error_panel.js:103-104` (fatal callback wired at `web/src/main.js:219`)
**Issue:** Both `error` and `unhandledrejection` call `show()`, which builds the "Scorched crashed" panel and fires `onFatal` (stops the loop). For a game shared by link, that means an error thrown by a browser extension or injected script (including the opaque cross-origin `"Script error."`, which has no `error` object) kills a healthy session. Resource-load errors are filtered by the browser but script errors are not.
**Fix:** Only escalate errors that originate from this app, e.g. ignore events where `event.error == null && event.message === 'Script error.'` or where `event.filename` is not same-origin; at minimum show non-app errors as a dismissible notice instead of calling the fatal callbacks.

### WR-05: Deploy and preview jobs run `npm ci` and the build with a write token and persisted checkout credentials

**File:** `.github/workflows/deploy.yml:18-31`, `.github/workflows/preview.yml:19-41`
**Issue:** The `deploy` job has `permissions: contents: write`, and `actions/checkout` is used with its default `persist-credentials: true`, so the token is stored in `.git/config`. In the same job `make install-web` (`npm ci`, which runs dependency lifecycle scripts) and `make build` (executes `vite.config.js` and plugins) run before the deploy action. A compromised npm dependency could push to any branch. `preview.yml` has the same shape plus `pull-requests: write`, and builds the PR's own code with write permissions (same-repo PRs only, so lower exposure). Actions are SHA-pinned, which is good, but this removes most of that benefit.
**Fix:** Split the job: a read-only `build` job runs checkout, install and build and uploads `dist` as an artifact, and a second job with `contents: write` downloads the artifact and runs only the deploy action. At minimum set `persist-credentials: false` on checkout and pass the token explicitly to the deploy action.

### WR-06: Ship, bullets and drones are rendered at discrete 60 Hz positions; only the terrain uses `ALPHA`

**File:** `web/src/main.js:196-203` (protocol slot `H_ALPHA`, `src/scorched_core/protocol.py:15`)
**Issue:** The header carries the step fraction `H_ALPHA`, and the terrain is extrapolated with it, but the ship, player bolts, drones and enemy bullets are drawn at the last simulated step. On 90/120/144 Hz displays (the very case the `RefreshEstimator` snapping targets) the ship and bullets update only on step frames: at 144 Hz a step lands every 2 or 3 frames in an uneven 2,3,2,3 cadence, while the ground scrolls smoothly. The project's core value is "tight, responsive ship control" and smooth motion; this is a visible mismatch between the smooth background and the judder of the objects that matter. Position data for extrapolation (velocity) is not in the channels either, so it needs a protocol change.
**Fix:** Either publish per-instance velocity (bullet `vx,vy` are already in the pool) and extrapolate in the vertex shader by `alpha`, and extrapolate the ship by the last move vector; or record it as a known Phase 1 limitation and add it to the Phase 2 plan so the device go/no-go on 120 Hz phones is judged with this in mind.

### WR-07: Large parts of the JS runtime have no unit tests and there is no JS coverage gate

**File:** `web/test/python/python_bridge.test.js:1-100`, and missing tests for `web/src/python/python_bridge.js` (`installSources`, `startGame`), `web/src/main.js`, `web/src/render/renderer_rig.js`, `web/src/render/post_pipeline.js`, `web/src/render/bullet_instances.js`, `web/src/debug/debug_session.js`
**Issue:** The Python side is held to 100% line and branch coverage, but on the JS side only `warmUp` is tested in the bridge. `startGame` carries the protocol-version check, the manifest-driven buffer allocation and the `attach` loop, and `installSources` does the `/src` to `/lib` path mapping; neither is tested. A fake pyodide like the one already in the test file would cover them cheaply. The renderer modules and `debug_session.js` are covered only indirectly by the (advisory, non-blocking) e2e job. No `vitest --coverage` threshold exists, so gaps are invisible.
**Fix:** Add tests for `installSources` (path mapping, `mkdirTree`, `sys.path` insert), `startGame` (protocol mismatch throws; channels sized `stride * cap`; `attach` order) and `bullet_instances.update` (`instanceCount` clamp, update range). Add `@vitest/coverage-v8` with a threshold for `web/src/**` excluding the WebGL wiring that e2e covers.

### WR-08: Escape/P resume path skips the resume bookkeeping that tap/key resume performs

**File:** `web/src/loop/pause_controller.js:65-75` (compare `resume()` at 54-61); `web/src/quality/quality_controller.js:78-83`
**Issue:** When Python un-pauses itself (Escape/P), `sync()` only hides the overlay. `resume()` additionally calls `loop.resetClock()` and `controller.resetWarmup(now())`; `sync()` does neither. The quality controller therefore keeps sampling through the pause (cheap paused frames dilute the 90-sample median) and does not re-enter its 2 s warm-up after resume. Related: `resetWarmup` clears `samples` and `strikes` but not `medianBefore`, so a pending step-down verification can compare a pre-pause median with a post-pause one and wrongly lock the tier as "refresh-capped-or-cpu-bound".
**Fix:** Have `sync()` call the same helper as `resume()` for the un-pause transition (reset clock and warm-up), and set `medianBefore = null` inside `resetWarmup` (or keep it but drop the verification when warm-up is reset).

## Info

### IN-01: Per-frame allocations in hot paths (the project rule is "no allocation in the frame loop")

**File:** `web/src/input/input_sampler.js:21,25-31`, `web/src/input/touch_input.js:54`, `web/src/input/touch_mapper.js:24,40`, `web/src/render/terrain_ring.js:33-42,166`, `src/scorched_core/pools/bullet_pool.py:76-79`, `src/scorched_core/clock/refresh_estimator.py:52`
**Issue:** Small but avoidable per-frame garbage: the sampler spreads `{ ...getMapperArgs(), dxPx, dyPx }` and returns fresh result objects (while `touch_mapper.js` states "must not allocate"); `chunkLayout` builds an array of objects every frame; `pack_into` creates four `array` slices per pool per frame (about 80 KB per frame for ebullets at stress=5000); `_period` builds a sorted list per frame. None is per-entity, so it is not a defect today, but these are exactly the stutter sources the stack notes warn about on phones.
**Fix:** Reuse module-level result objects in the sampler and mapper; make `chunkLayout` write into preallocated slots (or compute the base chunk and offset once and iterate); use preallocated scratch arrays in `pack_into`.

### IN-02: Weak or unspecced tests

**File:** `tests/scorched_web/bridge/test_render_sink.py:26-28`, `tests/scorched_web/test_web_game.py:6-9`
**Issue:** `test_attach_matching_length` has no assertion; it only proves `attach` does not raise, not that the target is bound (later flush tests cover binding indirectly). `test_web_game.py` builds `WebGame` over bare `MagicMock()` objects, so a signature change in `Game.tick` or `RenderSink.flush` would not fail these tests.
**Fix:** Assert the binding (attach then flush, check `assigns == 1`), and use `create_autospec(Game, instance=True)` / `create_autospec(RenderSink, instance=True)`.

### IN-03: E2E suite is advisory, wall-clock dependent, and can reuse a stale preview server

**File:** `.github/workflows/e2e.yml:14`, `playwright.config.js:13-18`, `tools/e2e/*.spec.js` (many `waitForTimeout` calls, e.g. `keyboard.spec.js:24`, `touch.spec.js:40`)
**Issue:** `continue-on-error: true` means a failing e2e never blocks the gate or the deploy, so regressions in the actual boot, pause and touch paths are only discovered by looking. Several specs assert on elapsed wall time (for example ship moved more than 20 units in 500 ms), which is what makes them flaky on software GL, and `reuseExistingServer: true` can run the suite against an old `vite preview` of a stale `dist/` on a developer machine.
**Fix:** Replace fixed sleeps with `expect.poll` on `TICK_COUNT` deltas (as `shooting.spec.js` already does), and set `reuseExistingServer: !process.env.CI` (or build before preview in `webServer.command`) so a stale server is never reused. Consider making a small smoke subset blocking.

### IN-04: Queued touch drag keeps draining after keyboard release

**File:** `src/scorched_core/entities/player_ship.py:38-56`
**Issue:** A non-zero keyboard vector "wins and leaves the queued drag alone" (documented and tested), so on hybrid devices the pending drag (up to `TOUCH_LAG_CAP` = 40 units, about 0.8 s of travel) is applied after the keys are released and the ship keeps sliding. Intentional per the docstring, but it is surprising behaviour for a "tight" control.
**Fix:** Zero `pending_x/y` when a keyboard vector is applied, or document it as an accepted hybrid-input quirk.

### IN-05: Second finger never takes over steering when the first lifts

**File:** `web/src/input/touch_input.js:14-18,38-40`
**Issue:** While one pointer steers, a second pointerdown is ignored (documented). When the steering finger lifts, `steering` becomes `null` but the second finger's `lastX/lastY` were never recorded, so it stays dead until it is lifted and pressed again. In practice that is a mid-game input dropout for players who rest a second thumb on the screen.
**Fix:** Track active pointers in a map and promote the next one (recording its current position as the new origin) on release.

### IN-06: `FixedStepRunner` discards the remainder when exactly the step cap is reached

**File:** `src/scorched_core/clock/fixed_step_runner.py:28-29`
**Issue:** `if steps == MAX_STEPS: self.acc = 0.0` also fires when the backlog was only slightly more than 3 steps (for example a 60 ms frame), dropping up to a step of legitimate time. Harmless for gameplay but slightly biases the clock on a run of 50-70 ms frames.
**Fix:** Only reset when time remains above the cap, e.g. `if steps == MAX_STEPS and self.acc >= STEP_MS: self.acc = 0.0`.

### IN-07: `perf_node.mjs` and `wait_for_deploy.mjs` limitations

**File:** `tools/perf_node.mjs:72-77`, `tools/wait_for_deploy.mjs:26,30`
**Issue:** The perf gate always passes `16.667` ms, so it measures one step per tick and never the 2 to 3 step catch-up frames that decide whether a phone drops frames; it also enforces a 3 ms average on a shared CI runner, which can flake. `wait_for_deploy` looks only at the 10 most recent runs (`per_page=10`) so a burst of commits can push the target run out of view until the timeout, and it polls the unauthenticated API every 30 s (60 requests per hour limit).
**Fix:** Add a second perf pass with a 50 ms `dt` (3 steps) and report both; use a median of several runs. For `wait_for_deploy`, query `actions/workflows/<file>/runs?head_sha=<sha>` instead of a recency window.

### IN-08: `startGame` leaks proxies and `warmUp` blocks the main thread before the gate

**File:** `web/src/python/python_bridge.js:19,22-27,52-71`, `web/src/main.js:73-76`
**Issue:** `startGame` is `async` but never awaits; it does not destroy `pyodide.toPy(options)` or the `sys` and `sys.path` proxies, nor keep `entry` for later cleanup (one-off, so tiny leaks). `warmUp` runs 120 ticks synchronously after `setProgress(0.8)` without yielding, so the loading screen cannot repaint during that time, and with `?stress=5000` the 120 Python ticks (each potentially 3 steps of a 5000-bullet Python loop) can freeze the page for seconds.
**Fix:** Destroy the temporary proxies; `await new Promise(requestAnimationFrame)` between status updates and warm-up (or chunk the warm-up into batches of 20 ticks with a yield).

### IN-09: `_HEADER_SLOTS` is a mutable hand-maintained copy of the protocol constants

**File:** `src/scorched_core/game/game.py:52-65`
**Issue:** The header slot names are re-listed by hand in a module-level `dict`, separate from the `H_*` constants in `protocol.py`. Adding a new `H_*` slot without updating the dict compiles and passes tests but the JS side never sees the slot. The dict is also mutable module state.
**Fix:** Build it from `protocol` (for example iterate `vars(protocol)` for names starting with `H_`, or define the mapping in `protocol.py` as a `MappingProxyType`) and add a conventions test that every `H_*` constant appears in the manifest.

---

_Reviewed: 2026-10-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
