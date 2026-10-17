---
phase: 01-playable-core-on-real-devices
plan: 03
subsystem: rendering
tags: [pyodide, three, bloom, instancing, stress-test, perf-budget, pytest, tdd]

requires:
  - phase: 01-playable-core-on-real-devices
    provides: "Frozen boundary contract (ebullets channel, EBULLET_N / STORM_HITS header slots), Game/WebGame tick, renderer rig, URL flags, gate.yml that runs make perf"
provides:
  - "BulletPool (SoA array('f'), swap-remove, slice pack), circles_touch (inclusive), BulletStorm in the pure Python core"
  - "?stress=N: N Python-simulated bouncing bullets drawn in one instanced draw call from the Python-filled Float32Array"
  - "EffectComposer + RenderPass + UnrealBloomPass (threshold 1.0) + OutputPass pipeline, exposed as rig.pipeline"
  - "tools/perf_node.mjs: real scorched_core in Pyodide on Node, JSON line, exit 1 above the 3 ms budget; npm script and make target perf; green in CI"
affects: [01-04, 01-05, 01-06, 01-07, 01-08, 01-10]

plan_head_before: 1950488ded9d76f82ecee8182a2847eda1f805f5
plan_head_after: d0282f5596254cfb36fc8a3037179bb98a1fd82d

actuals:
  tokens: 8300
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Struct-of-arrays pools: preallocated array('f') columns, swap-remove, slice-assignment packing, no per-bullet objects"
    - "Instanced bullets: InstancedBufferAttribute shares the exact Float32Array Python assigns into; per-frame addUpdateRange(0, n*4) and instanceCount"
    - "HDR emissive output (4.0, 1.6, 0.4) plus bloom threshold 1.0 so only emitters glow; albedo stays below 1"
    - "Perf budget as a failing check: node tools/perf_node.mjs exits 1 when avg tick > budget"

key-files:
  created:
    - src/scorched_core/pools/bullet_pool.py
    - src/scorched_core/stress/bullet_storm.py
    - src/scorched_core/collision/circle_hits.py
    - web/src/render/bullet_instances.js
    - web/src/render/post_pipeline.js
    - tools/perf_node.mjs
    - tools/e2e/stress.spec.js
    - tests/scorched_core/pools/test_bullet_pool.py
    - tests/scorched_core/stress/test_bullet_storm.py
    - tests/scorched_core/collision/test_circle_hits.py
  modified:
    - src/scorched_core/game/game.py
    - src/scorched_core/tuning.py
    - web/src/main.js
    - web/src/render/renderer_rig.js
    - package.json
    - Makefile
    - tests/scorched_core/game/test_game.py

key-decisions:
  - "Bloom defaults are strength 0.45, radius 0.25, threshold 1.0 (not the 1.0 / 0.4 starting values): with 500 dense bullets the first values washed the whole frame and hid the ship (Pitfall 14), measured in a headless screenshot"
  - "Storm step does integrate() then one bounce+hit loop, so the pool owns integration and the storm owns bounce/count; measured cost is far inside budget so no fused loop"
  - "The Makefile perf target description was updated; the target itself already ran 'npm run perf --if-present' so make perf now runs the new script"

patterns-established:
  - "Pattern: perf budget lives in package.json (perf script) and is enforced by make perf locally and in gate.yml"
  - "Pattern: HDR emitters for bloom, tone-mapping includes in every custom ShaderMaterial"

requirements-completed: [PLAT-04]

coverage:
  - id: D1
    description: "?stress=N puts exactly N Python bullets on screen in one instanced draw call (500, 1, and none by default)"
    requirement: PLAT-04
    verification:
      - kind: e2e
        ref: "tools/e2e/stress.spec.js (3 tests: stress=500, no flag, stress=1)"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_stress_spawns_the_clamped_bullet_count"
        status: pass
    human_judgment: false
  - id: D2
    description: "Python-side edges: inclusive adjacency at exactly STORM_RADIUS+HITBOX_RADIUS and not one float step farther, swap-remove ordering, determinism by seed, empty and single storms, clamp to 5000"
    requirement: PLAT-04
    verification:
      - kind: unit
        ref: "tests/scorched_core/collision/test_circle_hits.py, tests/scorched_core/pools/test_bullet_pool.py, tests/scorched_core/stress/test_bullet_storm.py, tests/scorched_core/game/test_game.py"
        status: pass
    human_judgment: false
  - id: D3
    description: "Hot loop is allocation-stable: 600 ticks after 300 warm-up grow sys.getallocatedblocks() by fewer than 50 blocks"
    requirement: PLAT-04
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_tick_does_not_grow_allocated_blocks"
        status: pass
    human_judgment: false
  - id: D4
    description: "Python tick cost for 500 stress bullets in real Pyodide is gated at 3 ms average locally and in CI"
    requirement: PLAT-04
    verification:
      - kind: other
        ref: "make perf -> avg_ms 0.4975, p95_ms 0.5501 (budget 3); node tools/perf_node.mjs --stress 500 --ticks 60 --budget-ms 0 exits 1; CI 'Run make perf' success in Deploy run 39044215609"
        status: pass
    human_judgment: false
  - id: D5
    description: "Stress bullets render through the full bloom pipeline and the glow looks right on a desktop browser (orange halo, ground and ship do not glow, frame not washed out)"
    requirement: PLAT-04
    verification:
      - kind: other
        ref: "headless Chromium (SwiftShader) screenshots reviewed by the executor; not a real GPU"
        status: unknown
    human_judgment: true
    rationale: "Visual quality of bloom on a real GPU and display is a judgment call that no test asserts; real-device numbers come from plan 01-10"

duration: 15min
completed: 2026-10-17
status: complete
---

# Phase 1 Plan 03: Stress Storm and Bloom Summary

**`?stress=N` floods the playfield with N Python-simulated bouncing bullets drawn in one instanced call under real UnrealBloom, and the Python tick budget is a failing check: 500 bullets cost 0.50 ms average (0.55 ms p95) in Pyodide against a 3 ms budget.**

## Performance

- **Duration:** about 15 min
- **Started:** 2026-10-17T15:00Z (approximate; not recorded at start)
- **Completed:** 2026-10-17T15:17Z
- **Tasks:** 2 (both `auto`; Task 1 TDD with a separate RED commit)
- **Files modified:** 20 files changed across the plan range (692 insertions, 6 deletions, lockfiles untouched)

## Measured Python tick cost (the go/no-go number)

`make perf` runs `node tools/perf_node.mjs --stress 500 --ticks 600 --budget-ms 3` against the repository's own sources in real Pyodide 314.0.7 on Node 24 (120 warm-up ticks, then 600 timed `tick` calls including the `assign()` copies):

| Run | avg_ms | p95_ms |
|-----|--------|--------|
| make perf (final) | 0.4975 | 0.5501 |
| node tools/perf_node.mjs (3 repeats) | 0.4879 / 0.4912 / 0.4903 | 0.5389 / 0.5508 / 0.5548 |
| first run | 0.4984 | 0.5613 |

Budget 3 ms, so the desktop headroom is about 6x. `--budget-ms 0` exits 1 (checked), so the gate discriminates. This is desktop Node V8 only; the 3-5x mobile slowdown assumption in CLAUDE.md is not yet measured on a device (plan 01-10). CI ran the same script: the Deploy run's `gate / web` job step "Run make perf" concluded success (https://github.com/rguillon/Stratoburst/actions/runs/39044215609).

## Accomplishments

- Pure-Python core gained `BulletPool`, `BulletStorm` and `circles_touch`; `Game` owns the ebullets pool and an optional storm and packs `EBULLET_N` / `STORM_HITS` in the header every tick and the ebullets channel only on frames that ran a step.
- `createBulletInstances` draws every bullet in one call from an `InstancedBufferAttribute` that wraps the very `Float32Array` Python assigns into; verified in headless Chromium screenshots that the shader links and 500 bullets appear.
- `createPostPipeline` (RenderPass, UnrealBloomPass at threshold 1.0, OutputPass) is now the rig's only render path and is exposed as `rig.pipeline` for plan 01-04's tier controller. Screenshots confirm the ground and ship do not glow without bullets.
- `make perf` / `npm run perf` is a real failing check, run in CI by `gate.yml`.
- Python suite: 136 tests, 100.00% line and branch (273 statements, 50 branches); vitest 22; Playwright 4 (smoke + 3 stress) on the production build; ruff clean.

## Task Commits

1. **Task 1 RED:** `cd72372` (test) - failing tests for pool, storm, circle hits, Game stress, allocation, determinism, plus the Playwright stress spec
2. **Task 1 GREEN:** `e9189bd` (feat) - BulletPool, BulletStorm, circles_touch, Game wiring, bullet_instances.js, main.js
3. **Task 2:** `d0282f5` (feat) - post_pipeline.js, rig integration, perf_node.mjs, perf script, Makefile description

**Plan metadata:** committed separately (docs: complete plan). The code commits were pushed to `origin/main` first; Deploy run 39044215609 for `d0282f5` concluded success and `make e2e-live` passed against https://rguillon.github.io/Stratoburst/.

## TDD Gate Compliance

Task 1 is `tdd="true"` inside a `type: execute` plan.

- **RED (`cd72372`):** 31 tests failed before any implementation, `31 failed, 105 passed`. The new modules existed only as skeletons returning wrong values (`False`, `0`, no-ops), so the failures are planned-behavior assertions, for example `assert 0 == 1` for the inclusive-adjacency storm test and `Expected: 500 / Received: 0` for the Playwright stress spec. A handful of Game and storm tests failed with `AttributeError` (`Game.storm`, `BulletPool.x` not yet existing), which is the same missing behavior surfacing as a missing attribute. `gsd_run check tdd-red-evidence` was not run because the plan is not `type: tdd` and the report was plain pytest text, which that classifier does not accept.
- **GREEN (`e9189bd`):** all 136 Python tests pass, coverage 100%.
- **REFACTOR:** none needed.
- One GREEN-time test fix (shown in `e9189bd`): the storm test helper allocated a capacity-1 pool for an empty storm, which made three spawned bullets overflow; the helper now allocates at least 8. This was a test defect, not a behavior change.

## Files Created/Modified

- `src/scorched_core/pools/bullet_pool.py` - SoA bullet pool with swap-remove, `cull_outside`, `pack_into` by extended-slice assignment and a cached kind column
- `src/scorched_core/stress/bullet_storm.py` - N bouncing bullets, bounce by clamping and inward velocity, O(N) hit count against one circle
- `src/scorched_core/collision/circle_hits.py` - `circles_touch`, inclusive `<= (ar + br) ** 2`
- `src/scorched_core/game/game.py`, `tuning.py` - ebullets pool, optional storm, storm hits, `STORM_*` and `HITBOX_RADIUS` constants
- `web/src/render/bullet_instances.js`, `post_pipeline.js`, `renderer_rig.js`, `web/src/main.js` - instanced bullets and the bloom pipeline
- `tools/perf_node.mjs`, `package.json`, `Makefile` - perf harness, `perf` script, target description
- `tools/e2e/stress.spec.js` and the mirrored pytest files

## Decisions Made

- Bloom defaults tuned to strength 0.45, radius 0.25, threshold 1.0 after seeing 1.0 / 0.4 wash out the frame with a dense field (see Deviations).
- Kept the plan's two-step storm structure (`integrate()` then a bounce+hit loop). At 0.5 ms for 500 bullets there is no reason to fuse loops.
- `BulletPool.pack_into` writes the angle column from a preallocated zero array and the kind column from a cached constant array rebuilt only when `kind` changes; it allocates only the transient slices Python creates, and the allocation test confirms no growth.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Bloom defaults washed out the frame**
- **Found during:** Task 2 (headless screenshot of `?stress=500` with the plan's `strength = 1.0, radius = 0.4`)
- **Issue:** The halo covered the whole playfield and margins and the ship was barely visible, contradicting the done criterion ("not washed out", Pitfall 14).
- **Fix:** `createPostPipeline` defaults changed to `strength = 0.45, radius = 0.25, threshold = 1.0`. Re-checked: bullets glow orange with a soft halo, the ship is visible, and with no stress the ground and ship show no glow.
- **Files modified:** `web/src/render/post_pipeline.js`
- **Verification:** Screenshots reviewed by the executor in headless Chromium; the final judgment is the pending human-check below.
- **Committed in:** `d0282f5`

**2. [Rule 1 - Bug] Test helper capacity (test-only)**
- **Found during:** Task 1 GREEN
- **Issue:** `make_storm(0)` created a capacity-1 pool, so the three bullets spawned by the hit-count test overflowed.
- **Fix:** helper capacity is `max(count, 8)`.
- **Files modified:** `tests/scorched_core/stress/test_bullet_storm.py`
- **Committed in:** `e9189bd`

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** None on scope. Both fixes were needed to meet the plan's own done criteria.

## Pending Human Verification

**Desktop visual bloom check (from Task 2 `<human-check>`, not blocking; real-device numbers are plan 01-10):**

Run `make build && make preview`, open http://localhost:4173/?debug&stress=500 in a desktop browser and confirm: the bullets glow orange with a soft halo, the ground and the ship do not glow, and the frame is not washed out. Also open http://localhost:4173/?debug and confirm the ship and ground look matte with no halo. The executor only saw headless SwiftShader screenshots, not a real GPU or display. If the halo is too strong or too weak, the knobs are `strength`, `radius` and `threshold` in `web/src/render/post_pipeline.js`.

## Authentication Gates

None.

## Issues Encountered

- `gh` is not installed on this machine, so the CI perf output line was not read from the job log; the public Actions jobs API confirmed `Run make perf` concluded success inside the gate.
- Vite still prints the known `node:*` externalization and chunk-size warnings (bundle now 599 kB, 153 kB gzip, up from 570 kB / 146 kB with the bloom addons). Harmless; a mobile payload review belongs to a later plan.

## Known Stubs

None added. The stress storm is deliberately gameplay-free (hits only increment `STORM_HITS`), as specified. The flat ground and placeholder ship from plan 01-01 remain tracked in `.planning/WINDOWS.md`.

## Threat Flags

None. `?stress=` is clamped twice (url_flags 1..5000 and `Game` 0..5000, pytest case 99999 -> 5000), `tools/perf_node.mjs` reads only repository sources and the lockfile-pinned `pyodide`, and no new packages were added (three addons ship in 0.186.1).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 01-04 can add the tier-driven bloom bypass and scaling through `rig.pipeline`, and the overlay can read `EBULLET_N` and `STORM_HITS` from the header.
- The Python budget number to track on real devices (plan 01-10): 0.50 ms avg / 0.55 ms p95 for 500 bullets on desktop Node.
- Open concern: bloom fill-rate cost on phones is still unmeasured; this plan only proves the pipeline renders correctly.

---
*Phase: 01-playable-core-on-real-devices*
*Completed: 2026-10-17*

## Self-Check: PASSED

Verified: all key files exist on disk; commits `cd72372`, `e9189bd`, `d0282f5` are ancestors of HEAD and of `origin/main`; `make check` (ruff, pytest 136 passed at 100.00%, vitest 22 passed, build, Playwright 4 passed) and `make perf` (avg 0.4975 ms) green; Deploy run 39044215609 success; `make e2e-live` 1 passed.
