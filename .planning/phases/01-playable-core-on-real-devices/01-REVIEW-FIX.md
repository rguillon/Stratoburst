---
phase: 01-playable-core-on-real-devices
fixed_at: 2026-10-17T20:30:00Z
review_path: .planning/phases/01-playable-core-on-real-devices/01-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 7
skipped: 1
status: partial
---

# Phase 1: Code Review Fix Report

**Fixed at:** 2026-10-17
**Source review:** .planning/phases/01-playable-core-on-real-devices/01-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (WR-01 to WR-08; fix_scope critical_warning, no Info items)
- Fixed: 7 (WR-07 only partially, see below)
- Skipped: 1 (WR-06)

**Verification (where it ran):** all gates ran in the main checkout (`/home/renaud/scorched`), not an isolated worktree. A fresh worktree has no `node_modules` or `.venv`, so it cannot run vitest, the build or Playwright. No worktree, temp branch or recovery sentinel was created, so there was nothing to clean up. After the last commit, `make check` passed (ruff check and format, pytest at 100.00% line+branch coverage with 367 passed, vitest with 373 passed in 25 files, production build, Playwright 39 passed) and `make perf` reported avg 0.60 ms, p95 0.82 ms against the 3 ms budget. An earlier baseline `make check` before any fix had 4 Playwright failures with `net::ERR_CONNECTION_REFUSED` against the preview server (boot.spec.js:162, :177, :187 and tier.spec.js:25). Those did not reproduce on the final run, so they look like preview-server flakiness unrelated to these fixes. Before each Python commit, ruff, pytest with the coverage gate, and `make perf` were run; before each JS commit, the full vitest suite. CI changes (WR-05) can only be verified after a push.

## Fixed Issues

### WR-01: Non-finite or negative `dt_ms` is not validated at the Python boundary

**Files modified:** `src/scorched_core/game/game.py`, `src/scorched_core/clock/fixed_step_runner.py`, `tests/scorched_core/game/test_game.py`, `tests/scorched_core/clock/test_fixed_step_runner.py`
**Commit:** f678cdf
**Applied fix:** `Game.tick` treats NaN, infinite or negative `dt_ms` as 0 before the refresh estimator sees it, and `FixedStepRunner.advance` also clamps the lower bound (`max(0.0, min(dt_ms, MAX_DT_MS))`). Tests cover negative, NaN, +inf and -inf (the sim returns 0 steps for the bad frame and runs normally on the next) and a negative `dt` in the runner. Status: fixed, logic fix, requires human verification (judgement call: a bad delta is "no time passed").

### WR-02: Drone sway amplitude is larger than the spawn margin

**Files modified:** `src/scorched_core/tuning.py`, `tests/scorched_core/entities/test_drone_swarm.py`
**Commit:** 9d25cb3
**Applied fix:** `DRONE_SPAWN_MARGIN_X = DRONE_SWAY + DRONE_RADIUS` (38.0), so the sway and radius cannot drift apart. Added a parametrised test (5 seeds, 20,000 steps each) asserting every drone x stays within `[DRONE_RADIUS, PLAYFIELD_W - DRONE_RADIUS]`, and the existing spawn test now uses the constant instead of the hardcoded 24/216. Determinism and shot tests stay green. Status: fixed, logic fix, requires human verification.

### WR-03: Keyboard handler swallows browser shortcuts and can stick keys when a modifier is held

**Files modified:** `web/src/input/keyboard_input.js`, `web/test/input/keyboard_input.test.js`
**Commit:** 6c2eb06
**Applied fix:** A keydown with Ctrl, Meta or Alt held is no longer game input and is not `preventDefault()`-ed (`onKeyDown` still fires, so the pause controller is unaffected). A keyup always falls through so a game key held before the modifier is released. A `Meta` keydown clears every held key (macOS does not deliver the keyups under Cmd). Tests added for each modifier, onKeyDown, keyup-with-modifier and Meta clearing. Status: fixed, logic fix, requires human verification.

### WR-04: Every `window` error or unhandled rejection is treated as fatal

**Files modified:** `web/src/boot/error_panel.js`, `web/test/boot/error_panel.test.js`
**Commit:** ce763f5
**Applied fix:** `window` `error` events are ignored (logged with `console.warn`, no panel, no `onFatal`) when they are the opaque cross-origin `"Script error."` with no error object, or when `event.filename` is a browser-extension URL (chrome, moz, safari, safari-web, ms-browser). `unhandledrejection` is ignored only when the reason's stack comes from an extension URL. Deliberately conservative: a cross-origin error with a real error object (for example from the Pyodide CDN script) still escalates, because ignoring it could leave a frozen game with no panel. The existing test that expected `"Script error."` to crash the page was updated to a non-opaque message, and new tests cover the ignored and still-escalated cases. Status: fixed, logic fix, requires human verification.

### WR-05: Deploy and preview jobs run `npm ci` and the build with a write token and persisted credentials

**Files modified:** `.github/workflows/deploy.yml`, `.github/workflows/preview.yml`
**Commit:** bc4dfe6
**Applied fix:** Each workflow is split into a read-only `build` job (`contents: read`, `persist-credentials: false`, `npm ci`, `make build`, uploads `dist` as an artifact with `include-hidden-files: true` so `public/.nojekyll` survives) and a write job (`deploy` / `preview`) that checks out with `persist-credentials: false`, downloads the artifact and runs only the deploy action (token passed explicitly via `github.token`). No npm or project code runs with a write token any more. Existing action SHA pins were kept. Two new actions were added and pinned to the SHAs resolved from the upstream tags with `git ls-remote`: `actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9` (v7.0.2) and `actions/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333` (v8.0.2). The YAML parses and the job graph is `gate -> build -> deploy` and `gate -> build -> preview`. **Not verified in CI**: the workflows must be watched after the orchestrator pushes. Points to watch: the artifact upload/download pairing across the two major versions, `.nojekyll` being present in the deployed branch, and the `preview` job's `always()` condition on `closed` events (the `build` job is skipped then, and the preview job runs only the cleanup path). These are new GitHub Actions, not npm or PyPI packages. Status: fixed, requires human verification (CI only).

### WR-07: Large parts of the JS runtime have no unit tests and there is no JS coverage gate (partially addressed)

**Files modified:** `web/test/python/python_bridge.test.js`, `web/test/render/bullet_instances.test.js` (new), `web/test/debug/debug_session.test.js` (new)
**Commit:** 0f75f3b
**Applied fix:** Added tests for `installSources` (the `/src` to `/lib` mapping, parent `mkdirTree` first, `sys.path` insert at 0), `startGame` (sources installed, one Float32Array per channel sized `stride * cap`, attach order and identity, returned manifest/slots/tick, manifest proxy destroyed, protocol mismatch throws before any allocation or attach), `PY_SOURCES` contents, `createBulletInstances` (instance count, update range limited to the live prefix, capacity clamp, range replacement, uniforms, quad size) and `createDebugSession` (renderer info handling, overlay text, lock reason, `n/a` slots, report text, copy button). Suite goes from 342 to 373 vitest tests. **Remaining, intentionally not done:** `web/src/main.js`, `renderer_rig.js` and `post_pipeline.js` (WebGL/DOM wiring, covered by the Playwright suite), and the JS coverage gate itself. `vitest --coverage` needs `@vitest/coverage-v8` (or istanbul), which is not installed, and a new package needs human approval. Suggested follow-up: approve `@vitest/coverage-v8` pinned to the vitest version (5.0.5), add a `coverage` block to `vite.config.js` with a threshold for `web/src/**` excluding the three WebGL wiring files, and wire it into `make test-web`. Status: partial.

### WR-08: Escape/P resume path skips the resume bookkeeping that tap/key resume performs

**Files modified:** `web/src/loop/pause_controller.js`, `web/src/quality/quality_controller.js`, `web/test/loop/pause_controller.test.js`, `web/test/quality/quality_controller.test.js`
**Commit:** 2d30516
**Applied fix:** `resume()` and the Python-resumed branch of `sync()` now share one `afterResume()` helper (reset the loop clock, `controller.resetWarmup(now())`, clear `shown`, hide the overlay). `resetWarmup` also sets `medianBefore = null`, so a pending step-down verification is dropped rather than compared across a pause. Tests cover the sync path doing the bookkeeping without calling `set_paused`, and a reset warm-up not locking the tier on a stale median. Status: fixed, logic fix, requires human verification. Side effect to be aware of: a step-down that is followed by a pause is no longer verified, which is the "drop the verification" option from the review.

## Skipped Issues

### WR-06: Ship, bullets and drones are rendered at discrete 60 Hz positions; only the terrain uses `ALPHA`

**File:** `web/src/main.js:196-203` (protocol slot `H_ALPHA`, `src/scorched_core/protocol.py:15`)
**Reason:** skipped: cannot be done cleanly inside the existing header and buffer protocol. Extrapolating by `alpha` needs per-instance velocity, and the pbullets/ebullets channels (stride 4: x, y, angle, kind) do not carry it. The review itself notes that it needs a protocol change. Doing it properly means a stride change on the bullet channels (a JS-side interleaved attribute plus Python `pack_into` growth, which touches the 5000-bullet stress path and the perf budget), a `PROTOCOL_VERSION` bump, and changes to the e2e specs that read buffers. A partial version (ship from header deltas, player bolts from a constant speed, drones from the spare slot) would leave enemy bullets unsmoothed, which is the largest class of instances. Interpolation instead of extrapolation was rejected because it adds up to one step (16.7 ms) of latency, against the core value of responsive control.
**Original issue:** The header carries `H_ALPHA`, and the terrain is extrapolated with it, but the ship, player bolts, drones and enemy bullets are drawn at the last simulated step. On 90/120/144 Hz displays the objects update only on step frames (a 2,3,2,3 cadence at 144 Hz) while the ground scrolls smoothly.
**Suggested approach:** Record this as a known Phase 1 limitation and plan it for Phase 2 so the 120 Hz phone go/no-go is judged with it in mind. Implementation: (1) bump the protocol to 2 and add `vx, vy` columns to the pbullet/ebullet channels (the pool already has them), stored as an interleaved buffer so one `assign` per channel stays; (2) extrapolate in the bullet vertex shader with an `alpha` uniform (`p.xz += aData.xy + aVel * alpha * step`); (3) for drones put the sway derivative in the spare slot 7 of the stride; (4) for the ship derive velocity from the last two header positions in JS (no allocation) and extrapolate only the model, keeping the hitbox marker on the true position; (5) re-run `make perf` with `--stress 5000` to confirm the extra data per frame fits the 3 ms budget; (6) add a determinism test that the extra columns do not change the simulation.

---

_Fixed: 2026-10-17_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
