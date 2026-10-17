---
phase: 01-playable-core-on-real-devices
verified: 2026-10-17T20:55:00Z
status: passed
score: 5/6 must-haves verified
covered_files:
  - .github/workflows/deploy.yml
  - .github/workflows/preview.yml
  - .planning/phases/01-playable-core-on-real-devices/01-01-PLAN.md
  - .planning/phases/01-playable-core-on-real-devices/01-01-SUMMARY.md
  - .planning/phases/01-playable-core-on-real-devices/01-02-PLAN.md
  - .planning/phases/01-playable-core-on-real-devices/01-02-SUMMARY.md
  - .planning/phases/01-playable-core-on-real-devices/01-03-PLAN.md
  - .planning/phases/01-playable-core-on-real-devices/01-03-SUMMARY.md
  - .planning/phases/01-playable-core-on-real-devices/01-04-PLAN.md
  - .planning/phases/01-playable-core-on-real-devices/01-04-SUMMARY.md
  - .planning/phases/01-playable-core-on-real-devices/01-05-PLAN.md
  - .planning/phases/01-playable-core-on-real-devices/01-05-SUMMARY.md
  - .planning/phases/01-playable-core-on-real-devices/01-06-PLAN.md
  - .planning/phases/01-playable-core-on-real-devices/01-06-SUMMARY.md
  - .planning/phases/01-playable-core-on-real-devices/01-07-PLAN.md
  - .planning/phases/01-playable-core-on-real-devices/01-07-SUMMARY.md
  - .planning/phases/01-playable-core-on-real-devices/01-08-PLAN.md
  - .planning/phases/01-playable-core-on-real-devices/01-08-SUMMARY.md
  - .planning/phases/01-playable-core-on-real-devices/01-09-PLAN.md
  - .planning/phases/01-playable-core-on-real-devices/01-09-SUMMARY.md
  - .planning/phases/01-playable-core-on-real-devices/01-10-PLAN.md
  - .planning/phases/01-playable-core-on-real-devices/01-10-SUMMARY.md
  - src/scorched_core/clock/fixed_step_runner.py
  - src/scorched_core/game/game.py
  - web/src/loop/frame_loop.js
  - web/src/loop/pause_controller.js
  - web/src/main.js
covered_digest: "v3:sha256:aaa092fb1cc0362bbab3472954c171028f8ca308f91110859eec5e3e3975fb9d"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Phone performance gate (PLAT-05, SC1 + SC3 on phones). On a mid-range Android phone and a recent iPhone open https://rguillon.github.io/Stratoburst/?debug&stress=500, run 5 continuous minutes on the auto tier, then 2 minutes each at &tier=low and &tier=high, press Copy report, paste into 01-DEVICE-REPORTS.md (Android and iPhone sections) with model, browser and power state."
    expected: "Per phone: avg fps >= 29, p95 frame <= 40 ms, no single minute under 29 fps, final tier keeps bloom (high or mid). A NO-GO must name the lever (tick-bound: lower caps, numpy, Worker; GPU/fill-bound: lower tiers, glow sprites; neither: Babylon fallback)."
    why_human: "Real phone hardware cannot be driven from this environment. Desktop headless SwiftShader numbers do not count. This is the phase goal's 'proven fast enough on real phones' clause and the ROADMAP After-Phase-1 go/no-go gate."
  - test: "Phone load path on the real host (SC1). Open the live link on the Android phone and the iPhone: confirm progress bar reaches 100%, the TAP / CLICK TO START gate appears, a tap starts the game, and the portrait playfield is letterboxed in both orientations. On Safari confirm the progress wrapper reaches ~80% during the Pyodide streaming compile (assumption A6) and record time-to-gate."
    expected: "Loading -> gate -> letterboxed playfield in portrait and landscape on both phones; progress is real (not stuck at 0 or indeterminate forever); audio context state 'running' after the tap (check __scorched.audioState under ?debug)."
    why_human: "iOS Safari / Android Chrome behavior (streaming compile through a fetch wrapper, AudioContext unlock policy) is only observable on device."
  - test: "Feel checklist items 5-12 from 01-10 Task 2, itemized (user said 'no problem observed' only). Especially: 1:1 touch drag with auto-fire and the ship never under the finger (8), auto-pause on app switch / tab switch and resume without a jump (10), ?crash=py panel (11), Network tab shows content-encoding: br from cdn.jsdelivr.net (12), hitbox marker readability, terrain/dimmed-margin look."
    expected: "Each item passes; none is claimed passed today."
    why_human: "Perceptual and real-OS-lifecycle behavior; the e2e suite only simulates visibilitychange/blur and synthetic pointer events."
  - test: "High-refresh smoothness (WR-06 / 01-08 pending check 3). On a 90/120/144 Hz display (or a 120 Hz phone) fly the ship while firing with ?debug and compare ship, bolts, drones and enemy bullets against the terrain."
    expected: "Game speed is the same as at 60 Hz (verified by tests). Judge whether the 2,3,2,3 update cadence of non-terrain objects (they are drawn at the last 60 Hz step; only the terrain uses H_ALPHA) is acceptable. If not, schedule the protocol-2 interpolation work in Phase 2."
    why_human: "Visual judder on a real high-refresh panel cannot be measured by synthetic timestamp tests."
  - test: "Post-WR-05 CI confirmation. Open a throwaway same-repo PR and confirm the split Preview workflow (gate -> build -> preview, artifact upload/download pairing, .nojekyll present, cleanup path on close with the build job skipped)."
    expected: "Preview builds, publishes pr-preview/pr-N, and the closed-PR run removes it. (The Deploy workflow's new build/deploy split is already confirmed by Deploy run 39058629150 plus the live smoke.)"
    why_human: "Requires a GitHub-side run; preview.yml has not executed since commit bc4dfe6."
---

# Phase 1: Playable Core on Real Devices Verification Report

**Phase Goal:** Anyone with the link can load the game on desktop or phone, fly a ship and shoot down targets over scrolling 3D terrain. The Python-in-browser stack must be proven fast enough on real phones and on the real static host.
**Verified:** 2026-10-17
**Status:** human_needed
**Re-verification:** No, initial verification
**HEAD verified:** 2d3ca7e

## Headline

The build is real, wired and green on everything this environment can exercise, and the stack is proven on the real static host and on one real desktop. The phase goal is **not fully achieved yet**: its "proven fast enough on real phones" clause rests on zero phone measurements. 01-DEVICE-REPORTS.md records "GO (desktop), phone gate DEFERRED" and PLAT-05 is correctly still Pending. This is an unmeasured gate, not a code gap (no evidence the phone bars fail, no code missing), so it is routed to human verification rather than `gaps_found`. Do not treat the ROADMAP After-Phase-1 go/no-go gate as passed, and do not trust Phase 2 effect-stack work on mobile until the phone protocol is run.

## Goal Achievement

### Observable Truths

Source: the 5 ROADMAP success criteria (the contract) merged with the plan must_haves. SC1 and SC3 each split into an automated/desktop half and a phone half; the phone halves are collected in truth 4.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1 (host + desktop half): the deployed link on the real static host shows a loading screen with progress, then a tap/click-to-start gate, then a portrait playfield letterboxed in any orientation. | VERIFIED | Live `https://rguillon.github.io/Stratoburst/` returns HTTP 200 and serves the static loading markup (`role=progressbar`, `#start-gate`). `make e2e-live` against the live URL passed (Python moves the ship on the real host). `make e2e` 39/39 incl. `playfield.spec.js` (all four projected corners inside 390x844, 844x390, 1280x720), boot/gate specs. Loader uses real byte progress with indeterminate fallback (`runtime_loader.js` DECODED_BYTES, `trackFetch`), 60 s timeout. Desktop real-hardware run reached the gate in 2.4 s (01-DEVICE-REPORTS). |
| 2 | SC2: 8-direction flight over scrolling 3D terrain through the fixed tilted camera (arrows/WASD, AZERTY-safe; relative 1:1 touch drag, ship never under finger), visibly marked hitbox core, and shooting down targets (hold fire / auto-fire). | VERIFIED (automated) | Keyboard reads `event.code` (KeyW/A/S/D, Arrow*) in `keyboard_input.js`. Hitbox marker `depthTest:false`, `renderOrder` 20/21 in `ship_model.js`. Touch: `touch_mapper` ray-plane unprojection + Python `PlayerShip.add_drag` with pending/lag cap/wall rule (pytest). `Game._step`: `terrain.step`, `ship.step`, `twin.step`, `resolve_shots_vs_drones` via `UniformGrid` (no all-pairs). e2e `keyboard`, `touch` (1:1, no jump, auto-fire), `shooting` (holding Space fires; drones shot down), `playfield` (scroll 0.8/step). Real-phone touch feel is listed under human verification, not claimed. |
| 3 | SC3 (desktop half): stress mode with 400+ Python-driven bullets and bloom holds 60 fps on a mid-range desktop; tiers step down automatically; on-device overlay shows frame and tick timings. | VERIFIED | Real hardware (Snapdragon X, Firefox 158, real GitHub Pages preview build): `?debug&stress=500`, 5.2 min, auto tier, every minute avg 60.0 fps, p95 16.7 ms, avg tick 1.08-1.12 ms, final tier `high` with bloom (bars: >=58 fps, <=20 ms, <=3 ms). Independent local re-run: `make perf` avg 0.5735 ms, budget 3 ms. Tier ladder, verify-and-lock controller, `?debug` overlay and Copy report are implemented and wired (`main.js` controller.update -> rig.applyTier; debug_session) and covered by vitest + `tier.spec.js`/`debug.spec.js`. Caveat: desktop frame time is pinned at the 60 Hz vsync cap at every tier and `tier log: none`, so auto step-down was not exercised under real GPU pressure; one machine and one browser only. |
| 4 | SC1 + SC3 (phone half): the same flow on a mid-range Android phone and a recent iPhone, and a steady >= 30 fps with auto tier step-down on both phones. | UNCERTAIN (human) | NOT MEASURED on either phone (01-DEVICE-REPORTS "Android: NOT MEASURED", "iPhone: NOT MEASURED"). The only evidence is the user's informal remark that it looked smooth on a phone, with no model, browser or numbers; not counted. PLAT-05 stays Pending. See Human Verification items 1 and 2. |
| 5 | SC4: game speed is identical on 60 Hz and high-refresh displays; hiding the tab or switching away auto-pauses; returning resumes without a time jump. | VERIFIED (automated) | `FixedStepRunner` + `RefreshEstimator` in Python; pytest proves 600 +/- 1 steps per 10 s at 30/60/120/144 Hz with jitter and boundary cases; `Game.tick` sanitises NaN/negative dt (WR-01 fix confirmed in code: `isfinite`, `max(0.0, ...)`). `pause_controller.js` listens to visibilitychange/blur/pagehide, calls `set_paused`, clears inputs, `loop.resetClock()` and `controller.resetWarmup` on every resume path (WR-08 fix confirmed); Python `set_paused(False)` resets accumulator, estimator, edges and pending drag. `pause.spec.js` e2e passes (hidden/blur events simulated). Resume requires a tap/key by design (D-18), which satisfies "resumes without a time jump". Real OS app/tab switching is human item 3. |
| 6 | SC5: a deliberately triggered runtime error shows an on-screen error panel instead of a frozen page, and the Python core's tests pass headlessly under pytest. | VERIFIED | `boot.spec.js` passes for `?crash=js`, invalid crash ignored, warm-up never trips the fault, Copy report/Reload, blocked CDN ends on the panel, WebGL context loss notice. `?crash=py` raises at exactly tick 120 (`game.py` FAULT_TICK). `make test-python`: 367 passed, coverage 100.00% line+branch (646 stmts, 124 branches, 0 miss). `tests/test_conventions.py` (purity, one class per file, mirrored tests) passes. Error panel uses `textContent` only. |

**Score:** 5/6 truths verified (1 UNCERTAIN routed to human verification; 0 behavior-unverified).

### Requirements Coverage

All 16 Phase-1 IDs from the ROADMAP are claimed by at least one PLAN's `requirements` frontmatter (union checked plan by plan), and all 16 appear in REQUIREMENTS.md mapped to Phase 1. No orphaned IDs. PLAT-10 (PWA), PLYR-04..10, INPT-03..05 belong to later phases and are not claimed here, as expected.

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|-------------|--------|----------|
| PLAT-01 | 01-02, 01-10 | Single shareable URL, static hosting | SATISFIED | Live URL 200, `make e2e-live` passed, Deploy run 39058629150 green, gh-pages deploy via gated workflow. Phone open of the link is human item 2. |
| PLAT-02 | 01-01 | Logic in Python (Pyodide), three.js WebGL2 render | SATISFIED | `scorched_core` owns the sim; JS only calls the held `tick` proxy; `test_conventions` forbids js/pyodide/time imports in core. |
| PLAT-03 | 01-09 | Loading screen with progress then tap/click gate, audio unlock | SATISFIED | `loading_screen.js`, `runtime_loader.js`, `start_gate.js` (click/pointerup, AudioContext resume); e2e boot specs. Audible unlock on iOS is human item 2. |
| PLAT-04 | 01-03, 01-04, 01-07, 01-10 | 60 fps on a mid-range desktop with ~400+ bullets, effects on | SATISFIED | 60.0 fps / p95 16.7 ms at 500 bullets with bloom on a real desktop (one machine, Firefox); perf budget 0.57 ms vs 3 ms. Stress bullets stand in for a full stage load that does not exist yet. |
| PLAT-05 | 01-04, 01-10 | Playable (>= 30 fps) on a mid-range Android phone and a recent iPhone via auto tiers | **NEEDS HUMAN (not satisfied by evidence)** | Tiers and overlay implemented; no phone measured. REQUIREMENTS.md correctly leaves it Pending. |
| PLAT-06 | 01-08 | Fixed 60 Hz timestep independent of display refresh | SATISFIED | See WR-06 analysis below. Pytest proof at 30/60/120/144 Hz. |
| PLAT-07 | 01-05 | Fixed portrait playfield letterboxed to any screen/orientation | SATISFIED | `camera_fit.js`, `playfield_mask.js`, `playfield.spec.js` at three viewports. |
| PLAT-08 | 01-08 | Auto-pause on focus loss / hidden | SATISFIED | `pause_controller.js` + Python `set_paused`; vitest + `pause.spec.js`. Prohibition (no sim advance while hidden, resume only on player action): judgment tier, upheld by code (tick returns 0 while paused; resume needs overlay tap/key). |
| PLAT-09 | 01-09 | On-screen error panel instead of a frozen page | SATISFIED | `error_panel.js`; boot specs. |
| PLAT-11 | 01-01 | Python core testable headlessly with pytest | SATISFIED | 367 tests, 100% line+branch, no browser. |
| PLYR-01 | 01-06 | 8-direction movement, consistent speed | SATISFIED | `PlayerShip.step` (3.333 units/step, normalised diagonals), pytest + `keyboard.spec.js`. |
| PLYR-02 | 01-06 | Small hitbox core visibly marked | SATISFIED | `ship_model.js` marker, always-on-top. Legibility against bloom on a phone is human item 3. |
| PLYR-03 | 01-07 | Hold-to-fire / auto-fire main weapon | SATISFIED | `TwinShot`, `shooting.spec.js`, touch auto-fire in `input_sampler`. |
| INPT-01 | 01-06 | Keyboard arrows/WASD (physical keys), fire, bomb, pause | SATISFIED | `event.code` mapping; bomb bit reserved and unused in Phase 1 by design; Escape/P pause. |
| INPT-02 | 01-06 | Relative 1:1 touch drag with auto-fire | SATISFIED (automated) | `touch.spec.js`; real-finger feel is human item 3. |
| STGE-02 | 01-05 | Terrain scrolls under the gameplay plane, fixed tilted camera | SATISFIED | `TerrainScroll` in Python (0.8/step), `terrain_ring.js` recycled chunks, tilt 25 deg fixed camera; `playfield.spec.js` scroll check. |

### Required Artifacts and Key Links

`verify.artifacts` and `verify.key-links` were run on all 10 plans: artifacts 48/48 pass (exist, substantive, patterns present), key links 30/30 verified. Data flow (Level 4) traced for the rendered channels: `Game.buffers` (header, pbullets, ebullets, drones) are packed from real pool/swarm state in `Game.tick`/`_pack_header` (`steps > 0`), `RenderSink` assigns them into JS typed arrays, and `main.js` feeds `header[EBULLET_N|PBULLET_N|DRONE_N]` and `SCROLL_Y + ALPHA * scroll_speed` into the instanced meshes and terrain. No static/hollow sources found.

### Anti-Patterns Found

None blocking. Grep for TBD/FIXME/XXX over `src web tools tests .github` returns nothing; TODO/HACK/PLACEHOLDER returns nothing in source. Debt-marker gate: clean.

### Behavioral Spot-Checks (run by this verifier at HEAD 2d3ca7e, via Makefile)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Lint + format | `make lint` | ruff check and format --check clean | PASS |
| Python gate | `make test-python` | 367 passed, 100.00% line+branch | PASS |
| JS unit tests | `make test-web` | 373 passed in 25 files | PASS |
| Python tick budget | `make perf` | avg 0.5735 ms, p95 0.6845 ms, budget 3 ms | PASS |
| Production build + e2e | `make build && make e2e` | 39/39 Playwright specs passed | PASS |
| Live host smoke | `make e2e-live` | 1 passed against https://rguillon.github.io/Stratoburst/ | PASS |
| Repo left clean | `git status --short` | only the pre-existing untracked `.planning/milestone.lock`, `.planning/state.json` | PASS |

`make check` as a single target was not re-run; each of its components was run individually above with the same results the orchestrator reported.

### Probe Execution

No probe scripts (`scripts/*/tests/probe-*.sh`) are declared by any plan or exist. Step skipped.

### Review Findings Weighed

- **0 critical, 8 warning, 9 info** (01-REVIEW.md). WR-01, 02, 03, 04, 05, 08 fixed; WR-07 partial; WR-06 skipped. Code confirms WR-01 (`isfinite`/clamp in `game.py` and `fixed_step_runner.py`), WR-02 (`DRONE_SPAWN_MARGIN_X = DRONE_SWAY + DRONE_RADIUS`), WR-05 (`deploy.yml`/`preview.yml` read-only `build` job, `persist-credentials: false`, artifact hand-off, SHA-pinned actions), WR-08 (`afterResume()` shared). WR-07 leaves `main.js`, `renderer_rig.js`, `post_pipeline.js` without unit tests (covered by Playwright) and no JS coverage gate; this does not contradict a Phase 1 requirement (the 100% gate in CLAUDE.md is for Python) and the package approval needed is a follow-up.
- **WR-06 decision: not a gap; acceptable as written, with a human check and a Phase 2 carry-over.**
  - PLAT-06 text: "Simulation runs on a fixed 60 Hz timestep, independent of display refresh rate." The simulation does; proven by pytest (600 +/- 1 steps/10 s at 30/60/120/144 Hz). WR-06 concerns presentation of already-simulated positions, not the timestep.
  - ROADMAP SC4: "Game speed is identical on 60 Hz and high-refresh displays." Speed is identical; WR-06 only changes how evenly the 60 Hz updates are presented (2,3,2,3 cadence on 144 Hz).
  - 01-08 must_haves (speed identical at 30/60/120/144 Hz; vsync snapping removes step-count stutter at 60 Hz; pause/resume rules) are all met. No 01-08 truth claims interpolated rendering of the ship, bolts or drones. The only render-smoothing claim in the phase (01-05, "the ground does not judder on high-refresh displays") is scoped to the terrain and is implemented (`rig.terrain.update(SCROLL_Y + ALPHA * scroll_speed)`).
  - Residual risk is perceptual, against the project's Core Value (tight, smooth feel) and 120 Hz phones, so it is a human-verification item (item 4) and should be planned into Phase 2 (protocol 2 with velocity columns), as the fix report suggests. The fix report's reasoning for skipping (needs a protocol/stride change touching the 5000-bullet perf path; interpolation would add 16.7 ms latency) is sound.
- Accepted-as-info: `01-REVIEW-DISPOSITION.md` is stale relative to `01-REVIEW-FIX.md` (it still lists WR-02, WR-05, WR-07 as `open` and `open: 12`; the fix report and code show them fixed/partial). Documentation inconsistency only; refresh before archiving.
- Security: 01-SECURITY.md `threats_open: 0`, 27/27 closed. Not re-audited here; consistent with the code read (textContent-only panel, allow-listed URL flags, pinned actions). One non-blocking T-01-SC warning (transitive `fsevents` install script, macOS only) stands.

### Gaps Summary

No code gaps. The one unmet piece of the phase goal is evidence, not implementation:

1. **Phone performance and phone load path are unmeasured** (PLAT-05, SC1 and SC3 phone halves, ROADMAP After-Phase-1 go/no-go). The mechanism to measure them exists and works (`?debug&stress=500`, Copy report, auto tiers, live URL). Running it is a short human task and its result is a genuine fork: GO (continue), or NO-GO naming a lever (numpy/Worker, lower tiers, glow sprites, Babylon fallback) that would change Phase 2's plan.
2. Desktop evidence is a single machine/browser (Snapdragon X, Firefox 158) pinned at the 60 Hz vsync cap, so the auto-step-down path has not been seen working under real GPU pressure. Phone runs are the first chance to see a `tier log` entry; if none appears and fps is below 29, that is a bug to investigate, not a pass.
3. The feel checklist was never itemized; no individual item is claimed as passed.

### Process note for the roadmap owner

ROADMAP.md marks Phase 1 `Mode: mvp`, but the goal is not in `As a [role], I want to [capability], so that [outcome].` form (`user-story.validate` returns valid: false). The MVP-mode verification rules (User Flow Coverage table) therefore could not be applied, and this report uses standard goal-backward verification, which is also how the plans were written and executed. Decide whether to drop `Mode: mvp` for Phase 1 or rewrite the goal as a user story via `/gsd-mvp-phase`; this does not affect the evidence above.

---

_Verified: 2026-10-17T20:55:00Z_
_Verifier: Claude (gsd-verifier)_
