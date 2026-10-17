---
phase: 01-playable-core-on-real-devices
plan: 05
subsystem: rendering
tags: [camera-fit, letterbox, terrain, instanced-mesh, three, vitest, playwright, tdd]

requires:
  - phase: 01-playable-core-on-real-devices
    provides: "Renderer rig with coalesced resize and tiers (01-04), header SCROLL_Y and ALPHA slots (01-01), Game._step hook (01-02)"
provides:
  - "camera_fit.js: fixed 25 deg tilt / 30 deg FOV constants, fitCamera (binary search of distance and look-at Z), applyCameraFit, projectCorners, altitudeScale"
  - "playfield_mask.js: one ShapeGeometry mask with a playfield-sized hole plus an edge outline (dimmed-terrain margins, no CSS bars)"
  - "terrain_ring.js: ring of 4 recycled 400-unit chunks (canvas-textured ground plus 40 seeded instanced buildings each), chunkLayout and generateChunkBuildings"
  - "TerrainScroll (Python), tuning.SCROLL_SPEED = 0.8, Game.terrain, header SCROLL_Y, manifest tuning {scroll_speed, hitbox_radius}"
  - "__scorched.projectPlayfield debug hook and tools/e2e/playfield.spec.js"
affects: [01-06, 01-07, 01-08, 01-09, 01-10]

plan_head_before: 647b9e86c3d22039b07ea88ff1c273662fe05c1b
plan_head_after: ac371a07e969750608637a315f2ff5b8bee9ed16

actuals:
  tokens: 21500
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Pure fit: fitCamera uses a scratch PerspectiveCamera and returns only {distance, targetZ}; orientation is never a function of aspect"
    - "Ring slot = chunkIndex mod chunks; a slot is rewritten only when its chunkIndex changes, with positions computed relative to the base chunk so floats stay small"
    - "Canvas factory injection (createCanvas) so the procedural texture builds under vitest in node without a DOM"
    - "World-space dimming mask instead of CSS bars: follows the trapezoid exactly, one overdraw of the margins"

key-files:
  created:
    - web/src/render/camera_fit.js
    - web/src/render/playfield_mask.js
    - web/src/render/terrain_ring.js
    - src/scorched_core/stages/__init__.py
    - src/scorched_core/stages/terrain_scroll.py
    - web/test/render/camera_fit.test.js
    - web/test/render/playfield_mask.test.js
    - web/test/render/terrain_ring.test.js
    - tests/scorched_core/stages/test_terrain_scroll.py
    - tools/e2e/playfield.spec.js
  modified:
    - web/src/render/renderer_rig.js
    - web/src/main.js
    - src/scorched_core/tuning.py
    - src/scorched_core/game/game.py
    - tests/scorched_core/game/test_game.py

key-decisions:
  - "Camera orientation is fully fixed; fit varies only distance (555 at 1:1 and wider, 1074 at 9/19.5) and look-at Z (10 to 19 units)"
  - "Chunk world Z is scroll - (chunkIndex + 0.5) * chunkLen, computed relative to the base chunk; ring slot is chunkIndex mod 4"
  - "Buildings that land in a lane (x = -80, 0, 80, half-width 14) are pushed to the lane edge, which lines the lanes like streets and keeps them open for later ground units"
  - "Instanced building meshes set frustumCulled = false because their cached bounding sphere would go stale when a slot is rewritten on recycle"
  - "The scroll e2e boots with ?tier=low and checks scroll == 0.8 x ticks, not only wall-clock, because the fixed-step runner caps catch-up at 3 steps per frame"

patterns-established:
  - "Pattern: debug-only projection hook (projectPlayfield) lets e2e assert layout facts without pixel diffing"
  - "Pattern: tiers stay presentation-only; terrain, camera fit and mask are tier-independent"

requirements-completed: [PLAT-07, STGE-02]

coverage:
  - id: D1
    description: "Fixed 3:4 playfield fitted and letterboxed: for aspects 9/19.5, 9/16, 3/4, 1, 16/9, 21/9 every corner is inside padded NDC, the fit is tight on the limiting axis (within 0.01), vertically centred, and the camera quaternion is identical across aspects"
    requirement: PLAT-07
    verification:
      - kind: unit
        ref: "web/test/render/camera_fit.test.js (26 tests)"
        status: pass
      - kind: e2e
        ref: "tools/e2e/playfield.spec.js (390x844, 844x390, 1280x720: corners inside the viewport, fill >= 0.85 on the limiting axis, canvas equals the viewport)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Margins show dimmed terrain through one world-space mask with an exact playfield hole plus an edge outline; no CSS bars"
    requirement: PLAT-07
    verification:
      - kind: unit
        ref: "web/test/render/playfield_mask.test.js (5 tests: area equals big square minus the hole, flat, no depth write, one mesh plus one line)"
        status: pass
    human_judgment: true
    rationale: "Whether the dimming and the outline read well against the terrain is a visual judgment (see pending human check 1)."
  - id: D3
    description: "Python drives a continuous scroll: TerrainScroll advances 0.8 per 60 Hz step, header SCROLL_Y carries it, manifest tuning publishes scroll_speed and hitbox_radius"
    requirement: STGE-02
    verification:
      - kind: unit
        ref: "tests/scorched_core/stages/test_terrain_scroll.py, tests/scorched_core/game/test_game.py (pytest 150 passed, coverage 100.00% line and branch)"
        status: pass
      - kind: e2e
        ref: "tools/e2e/playfield.spec.js python-driven terrain scroll (scroll in 42..54 over 1000 ms and equal to 0.8 x ticks)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Terrain ring: 4 chunks tile contiguously, exactly one chunk is recycled per boundary crossing, building matrices are rewritten only on a chunk-index change, generation is deterministic per (seed, chunkIndex) and leaves open lanes"
    requirement: STGE-02
    verification:
      - kind: unit
        ref: "web/test/render/terrain_ring.test.js (12 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The ground scrolls smoothly (no judder, correct direction, 120/144 Hz extrapolation) and looks like recognisable simple terrain with nothing outside the bullets glowing"
    requirement: STGE-02
    verification: []
    human_judgment: true
    rationale: "Smoothness and look are perceptual; headless software GL cannot show judder or refresh-rate behavior (see pending human checks 1 and 2)."
  - id: D6
    description: "altitudeScale exported as the single altitude-mapping function and unit-tested"
    verification:
      - kind: unit
        ref: "web/test/render/camera_fit.test.js altitudeScale cases (1, 1.04, 0.9)"
        status: pass
    human_judgment: false

duration: 16min
completed: 2026-10-17
status: complete
---

# Phase 1 Plan 05: Camera Fit, Letterbox Mask and Scrolling Terrain Summary

**A fixed 25-degree tilted camera now fits the 3:4 portrait playfield to any viewport (letterboxed by a dimmed-terrain world-space mask, not CSS bars), over a ring of four recycled procedural terrain chunks with seeded block buildings whose scroll comes from Python (0.8 units per 60 Hz step, alpha-extrapolated for smooth high-refresh display).**

## Performance

- **Duration:** about 16 min
- **Started:** about 2026-10-17T15:40Z
- **Completed:** 2026-10-17T15:56Z (code, CI and live checks green)
- **Tasks:** 2 (both `auto` + `tdd="true"`, each with a separate RED commit)
- **Files modified:** 15 in the code commits; no lockfile or dependency changes

## Accomplishments

- `fitCamera` binary-searches the smallest distance that keeps all four projected corners inside NDC +/- 0.96, centres the box by searching the look-at Z, and repeats; orientation is identical for every aspect. Measured fits: distance 555.6 for aspects 1, 16/9 and 21/9 (height-limited), 683 at 3/4, 892 at 9/16, 1074 at 9/19.5 (width-limited), look-at Z 10 to 19. All six unit aspects and the three Playwright viewports (390x844, 844x390, 1280x720) pass; the portrait screenshot shows the trapezoid filling 372 of 390 px width.
- `createPlayfieldMask` is one `ShapeGeometry` (3000-unit square with an exact 240x320 hole) at y = -0.5 with `depthWrite: false`, renderOrder 5, plus one `LineLoop` outline at y = 0.05 in a below-bloom brown. A unit test proves the triangulated area equals the square minus the hole.
- The terrain ring recycles exactly one chunk per 400 units of scroll, reuses the slot `chunkIndex mod 4`, rewrites 40 instance matrices and colors only for the new chunk, and works relative to the base chunk (a test at scroll 400,000,123 keeps |z| <= 1200). Buildings come from mulberry32 keyed by `(seed ^ imul(chunkIndex, 0x9E3779B1)) >>> 0`; three open lanes stay free.
- Python: `TerrainScroll` (dataclass, slots), `Game.terrain`, header `SCROLL_Y` always packed, manifest `tuning`. `main.js` renders `SCROLL_Y + ALPHA * tuning.scroll_speed`.
- Gates: `make check` green (ruff, pytest 150 at 100.00% line and branch, vitest 133, build, Playwright 14); **`make perf` avg 0.5117 ms, p95 0.6171 ms** (budget 3 ms).

## Task Commits

1. **Task 1 RED:** `99ad846` (test) - camera fit, letterbox and altitude tests plus the playfield e2e against a placeholder skeleton
2. **Task 1 GREEN:** `a8e1112` (feat) - camera_fit, playfield_mask, rig refit on integer CSS size change, ResizeObserver, debug hook, mask test
3. **Task 2 RED:** `2d9416a` (test) - terrain ring and Python scroll tests against skeletons, scroll e2e
4. **Task 2 GREEN:** `ac371a0` (feat) - TerrainScroll, Game wiring, terrain ring, rig and main wiring, stand-in ground removed

**Plan metadata:** committed separately (docs: complete plan).

## CI and live verification

Code commits were pushed to `origin/main` before this SUMMARY. Deploy run 39047096999 for `ac371a0` concluded success (https://github.com/rguillon/Stratoburst/actions/runs/39047096999); `make wait-deploy` confirmed the live site serves it and `make e2e-live` passed against https://rguillon.github.io/Stratoburst/ (1 passed).

## TDD Gate Compliance

Both tasks are `tdd="true"` in a `type: execute` plan; each has a RED test commit before its implementation commit.

- **RED Task 1 (`99ad846`):** 17 failed, 9 passed. Failures are planned-behavior assertions, for example `expected 1.1995 to be <= 0.960001` (corner outside the padded box), `expected 60 to be 30` (fov not applied), `expected +0 to be 1` (altitudeScale), `expected [] to have length 4` (projectCorners). The 9 passes are constants, determinism and the quaternion-equality test, which a skeleton that never moves the camera satisfies vacuously (the real check is the fit tests). Semantic assessment: every intended-failing test failed on its own assertion, none on import, syntax or fixture errors. The playfield e2e was not run RED (it needs the debug hook).
- **RED Task 2 (`2d9416a`):** JS 9 failed, 3 passed (`expected [] to deeply equal [ -1, 0, 1, 2 ]`, `expected [] to have a length of 40`, `Cannot read properties of undefined (reading 'z')`); Python 6 failed, 22 passed (3 `TerrainScroll` distance assertions, manifest `tuning` KeyError, `game.terrain` AttributeError, header SCROLL_Y 0.0 vs 0.8); the scroll e2e failed with `Expected: > 42, Received: 0`. The `game.terrain` AttributeError and `undefined.z` are the missing behavior surfacing as a missing object. Semantic assessment: all failures are on planned behavior.
- **GREEN:** `a8e1112` and `ac371a0`, all suites green. **REFACTOR:** none needed.
- `gsd_run check tdd-red-evidence` was not run: the plan is not `type: tdd` and the vitest and pytest text reports are not formats that classifier accepts (same position as plans 01-03 and 01-04).

## Files Created/Modified

- `web/src/render/camera_fit.js` - constants, `fitCamera`, `applyCameraFit`, `projectCorners`, `altitudeScale`
- `web/src/render/playfield_mask.js` - dimming mask with a hole and the edge outline
- `web/src/render/terrain_ring.js` - `chunkLayout`, `generateChunkBuildings`, `createTerrainRing`
- `web/src/render/renderer_rig.js` - refit on integer CSS size change, `ResizeObserver`, mask and terrain added, stand-in ground and fixed distance removed
- `web/src/main.js` - `rig.terrain.update(SCROLL_Y + ALPHA * scroll_speed)`, `projectPlayfield` debug hook
- `src/scorched_core/stages/terrain_scroll.py`, `tuning.py`, `game/game.py` - Python scroll
- `web/test/render/*.test.js`, `tests/scorched_core/stages/test_terrain_scroll.py`, `tests/scorched_core/game/test_game.py`, `tools/e2e/playfield.spec.js`

## Decisions Made

See `key-decisions` above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Scroll e2e window was unreachable on software GL in the first second**
- **Found during:** Task 2 (e2e)
- **Issue:** The plan's 48 +/- 6 over 1000 ms right after boot measured 37.6 in headless Chromium: the full-resolution bloom tier renders at about 15 fps on SwiftShader, and `FixedStepRunner` caps catch-up at 3 steps per frame, so the sim legitimately runs slower than real time (designed "slow down, never spiral"). A first version that read SCROLL_Y and TICK_COUNT in separate evaluates also disagreed by one step.
- **Fix:** The spec boots with `?tier=low` (tiers are presentation-only), waits 1500 ms, reads both slots in one evaluate, keeps the plan's 42..54 window, and adds the stronger check `scroll == 0.8 x ticks`. Three consecutive runs passed.
- **Files modified:** `tools/e2e/playfield.spec.js`
- **Committed in:** `ac371a0`

**2. [Rule 2 - Missing Critical] Stale bounding sphere on recycled building meshes**
- **Found during:** Task 2 (terrain ring design)
- **Issue:** `InstancedMesh` caches its bounding sphere at first render; rewriting a slot's instances on recycle would leave frustum culling using stale bounds and make buildings pop out.
- **Fix:** `frustumCulled = false` on the building meshes (the chunks are always near the camera).
- **Files modified:** `web/src/render/terrain_ring.js`
- **Committed in:** `ac371a0`

**3. [Rule 3 - Blocking] `createCanvas` injection and extra tests**
- **Issue:** The plan's tests only named `camera_fit.test.js` and `terrain_ring.test.js`, but the ring builds its canvas texture at startup, which needs a DOM that vitest's node environment lacks; the mask truth ("rectangular hole exactly matching the playfield") also had no test.
- **Fix:** `createTerrainRing({ createCanvas })` defaults to `document.createElement('canvas')`, tests inject a stub; added `playfield_mask.test.js` (area equals the square minus the hole, flat, no depth write).
- **Files modified:** `web/src/render/terrain_ring.js`, `web/test/render/playfield_mask.test.js`
- **Committed in:** `a8e1112`, `ac371a0`

**4. [Rule 1 - Documentation] Acceptance grep for the constant**
- `grep -n "SCROLL_SPEED = 0.8" src/scorched_core/tuning.py` does not match literally because the file annotates every constant `: Final` (`SCROLL_SPEED: Final = 0.8`, line 22), which is the existing convention and enforced by review. Intent (constant is 0.8) is proven by `test_scroll_speed_is_eight_tenths_of_a_unit_per_step`.

---

**Total deviations:** 4 (2 bug or documentation, 1 missing critical, 1 blocking). **Impact on plan:** additive or test-robustness only; no plan behavior was dropped or weakened.

## Issues Encountered

- Vite still prints the known chunk-size warning (bundle size unchanged in kind; payload review belongs to a later plan).
- `gh` is not installed; CI status is read through the public Actions API via `make wait-deploy`.
- A shell mishap early on (a stray `cat >` waiting on stdin) hung one command until it was killed; no files were affected and the stray scratch file was removed.

## Pending Human Verification

The plan's `<human-check>` (Task 2) and two judgment items from the coverage block still need a person. None blocks the plan.

1. **Desktop look and smoothness (plan human-check, D2/D5):** run `make preview` and open http://localhost:4173/?debug in a desktop browser, then resize the window from tall to wide. Expect: terrain with block buildings scrolls smoothly toward the bottom of the screen; the margins outside the playfield show the same terrain dimmed; the playfield edge outline is visible; nothing outside bullets glows.
2. **Real phone, both orientations (D5):** open the live URL on a phone in portrait and rotate to landscape. Expect: the whole playfield stays visible and fitted after rotation and after the address bar hides or shows, and the terrain scrolls without judder. Try `?debug&stress=500` to confirm the terrain does not push the tier ladder down earlier than before (compare the tier log with plan 01-04's report).
3. **High-refresh display (D5):** on a 120 or 144 Hz screen, confirm the ground does not judder (alpha extrapolation); headless software GL cannot show this.

## Known Stubs

None added. The placeholder cone ship from plan 01-01 remains tracked in `.planning/WINDOWS.md` (entry 1, resolved by plan 01-06). Entry 2 (stand-in ground and fixed camera distance) is resolved by this plan and marked fixed.

## Threat Flags

None. T-01-15 (resize storms) is mitigated: resize and the ResizeObserver both go through the existing one-per-animation-frame `queueResize`, and the camera refit and buffer reallocation run only when the integer CSS size (or DPR) changed; chunk regeneration happens only on a chunk-index change (tested by instance-matrix version counts). T-01-SC: no new packages, lockfiles untouched.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 01-06 onward can rely on a fixed camera, world mapping unchanged (`X = x - W/2`, `Z = y - H/2`, gameplay plane Y = 0), `altitudeScale` for later layers, and a `manifest.tuning` block that JS reads for constants.
- Caveat for long sessions: `SCROLL_Y` travels as float32, so beyond roughly 10^5 units (about 35 minutes of play) its resolution is about 0.008 units, still far below one pixel; if sessions ever run longer, Python can wrap the distance on a multiple of the chunk length times the ring size, which the relative layout already tolerates.
- Open concern: all frame numbers so far are desktop Node or software GL; real-phone cost of the terrain (one more full-screen textured pass under bloom) is unmeasured and belongs to the plan 01-10 device report.

---
*Phase: 01-playable-core-on-real-devices*
*Completed: 2026-10-17*

## Self-Check: PASSED

Verified: all key files exist on disk; commits `99ad846`, `a8e1112`, `2d9416a`, `ac371a0` are ancestors of HEAD and of `origin/main`; `plan_head_before..plan_head_after` counts 4 commits; `make check` and `make perf` green; Deploy run success; `make e2e-live` 1 passed.
