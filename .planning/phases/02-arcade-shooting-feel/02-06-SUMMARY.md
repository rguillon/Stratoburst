---
phase: 02-arcade-shooting-feel
plan: 06
subsystem: rendering
tags: [three.js, procedural-models, lathe, vertex-colors, quality-tiers, instancing]

requires:
  - phase: 02-arcade-shooting-feel
    provides: "02-02 tier-aware particles and tier plumbing; 02-04 enemy instancing behind a geometryFor seam"
provides:
  - "model_kit.js: normalizeDetail, segmentsFor, lathe, capsule, beveledExtrude, tint, place, bake (the shared smooth-style kit)"
  - "Smooth player jet with userData.setDetail and the unchanged hitbox marker"
  - "Rounded city buildings per detail with terrain.setDetail and TERRAIN_DEPTH"
  - "TIERS[*].modelDetail and a main.js detailViews list applied on every tier change"
affects: [02-07, 02-08, enemy models, crystals, missiles, bomb, wrecks, ground shadows]

actuals:
  tokens: 9964
  tasks: 2
  commits: 2
plan_head_before: 363509cacdba30dba599b65390e0f0f27eee91db
plan_head_after: 0269f29ab4be8133132c383865738c77e2dfa63f

tech-stack:
  added: []
  patterns:
    - "Models are parts (lathe, capsule, beveled extrude) tinted with vertex colours and baked into one non-indexed position/normal/color geometry per detail"
    - "Every detail level is built once at creation; a tier change only reassigns cached geometry and material (no generation, disposal or compile mid-game)"
    - "main.js warms every detail level behind the loading screen so the GPU uploads and shader variants exist before play"

key-files:
  created:
    - web/src/render/models/model_kit.js
    - web/test/render/models/model_kit.test.js
  modified:
    - web/src/render/ship_model.js
    - web/test/render/ship_model.test.js
    - web/src/render/terrain_ring.js
    - web/test/render/terrain_ring.test.js
    - web/src/quality/tiers.js
    - web/test/quality/tiers.test.js
    - web/src/main.js

key-decisions:
  - "All detail levels of a model are built eagerly at creation instead of lazily on first use, so a tier change can never run generator code (truth 2 outranks the plan's 'lazily' wording)"
  - "Terrain keeps one smooth and one flat Lambert material and swaps between them, instead of toggling flatShading (which would recompile the shader mid-game)"
  - "main.js cycles every detail level through rig.render() before the start gate so geometry upload and both shader variants happen at load"
  - "Fuselage vertex colours (steel grey, max channel 0.6) carry the albedo; the material colour stays white"

patterns-established:
  - "Kit generators take a detail of 'high' | 'mid' | 'low'; unknown values normalise to 'low'"
  - "bake() normalises every part to the same attribute set and index state and throws an Error naming the model on a failed merge"

requirements-completed: [VISL-01]

coverage:
  - id: D1
    description: "Model kit: lathe/capsule/beveledExtrude by detail, tint, place, and bake with normalisation, loud failure and deterministic output"
    requirement: VISL-01
    verification:
      - kind: unit
        ref: "web/test/render/models/model_kit.test.js (bake, normalizeDetail, generators follow the detail)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Player jet is smooth (flatShading false), steel-grey vertex colours below 1.0, HDR engine glow, keeps size, nose direction and hitbox marker, and setDetail swaps cached geometry"
    requirement: VISL-01
    verification:
      - kind: unit
        ref: "web/test/render/ship_model.test.js"
        status: pass
      - kind: e2e
        ref: "tools/e2e/tier.spec.js, smoke.spec.js, keyboard.spec.js"
        status: pass
    human_judgment: false
  - id: D3
    description: "City buildings are rounded at high and mid, hard boxes at low, swapped by terrain.setDetail without regenerating placement; TERRAIN_DEPTH exported"
    requirement: VISL-01
    verification:
      - kind: unit
        ref: "web/test/render/terrain_ring.test.js (detail)"
        status: pass
      - kind: e2e
        ref: "tools/e2e/playfield.spec.js, tier.spec.js"
        status: pass
    human_judgment: false
  - id: D4
    description: "The ship looks smooth and stylized with a glowing engine and the buildings look softened, at high and at ?tier=low"
    verification: []
    human_judgment: true
    rationale: "Art direction is a visual judgment; the screenshots at high and low looked right in software GL, but a real GPU view is the sign-off"

duration: 14min
completed: 2026-10-18
status: complete
---

# Phase 2 Plan 06: Smooth Procedural Models and Tier-Driven Detail Summary

**Smooth, code-built player jet and rounded city buildings from a new lathe/capsule/beveled-extrude model kit, with a detail level that follows the quality tier through cached geometry swaps.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-10-18T03:32:00Z
- **Completed:** 2026-10-18T03:47:00Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- `model_kit.js` is the shared toolbox for every later model (enemies, crystals, missiles, bomb, wrecks): detail-aware lathe, capsule and beveled extrude, vertex-colour tinting, placement, and a `bake` that normalises attributes and index state before merging and throws an Error naming the model instead of silently drawing nothing.
- The player jet is now a lathe fuselage with beveled wings, engine pods and tail fins baked into one 'fuselage' geometry (about 16.5 wide, 20 long, nose toward -Z), a smooth dark ellipsoid canopy, an HDR engine glow, and the Phase 1 hitbox marker untouched. High, mid and low have 7092, 2676 and 1044 vertices.
- City buildings use `RoundedBoxGeometry` (3 / 2 segments, radius 0.08) at high and mid and plain flat-shaded boxes at low; `terrain.setDetail` swaps geometry and material on every chunk without touching instance matrices. `TERRAIN_DEPTH = -40` is exported for the ground layer and shadows.
- Tiers gain `modelDetail`; main.js keeps a `detailViews` list (ship adapter and terrain), applies the tier's detail on every tier change including the forced bloom-unavailable drop, and warms every level behind the loading screen.

## Task Commits

1. **Task 1: Tracer, smooth jet from the new kit, detail follows the tier** - `5f5ffba` (feat)
2. **Task 2: Rounded city buildings and terrain follow the tier** - `0269f29` (feat)

**Plan metadata:** committed with this summary (docs: complete plan)

## Files Created/Modified

- `web/src/render/models/model_kit.js` - Model kit: detail helpers, lathe, capsule, beveledExtrude, tint, place, bake
- `web/test/render/models/model_kit.test.js` - Kit tests (detail ladder, bake normalisation and failure, determinism)
- `web/src/render/ship_model.js` - Smooth player jet, per-detail cache, `userData.setDetail`
- `web/test/render/ship_model.test.js` - Silhouette, smooth shading, colour, detail and hitbox-marker assertions
- `web/src/render/terrain_ring.js` - Rounded buildings per detail, `setDetail`, `TERRAIN_DEPTH`
- `web/test/render/terrain_ring.test.js` - Detail, cache identity and placement-unchanged tests
- `web/src/quality/tiers.js`, `web/test/quality/tiers.test.js` - `modelDetail` per tier
- `web/src/main.js` - `detailViews`, tier-change wiring, load-time warm cycle

## Decisions Made

- Build every detail level at creation (eager) rather than lazily, so a tier change cannot run generator code mid-game; the plan's "lazily once per detail" wording conflicted with its own truth 2.
- Two cached terrain materials (smooth and flat) instead of toggling `flatShading`, which would force a shader recompile at tier change.
- Warm every detail level with a `rig.render()` before the start gate so GPU buffers and both shader variants are ready before play (T-02-08).
- The fuselage's grey lives in vertex colours (max channel 0.6); the material colour stays white, so the albedo test reads the colour attribute.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Eager detail build and a load-time warm cycle**
- **Found during:** Task 1 (setDetail design)
- **Issue:** The plan asked for a per-detail cache "built lazily once per detail", but its own truth 2 and threat T-02-08 require that a tier change never runs generator code or allocates buffers mid-game. A lazy build on the first drop to low would do exactly that, and the first draw of a swapped geometry would upload it mid-frame.
- **Fix:** All three details are built in `createShipModel` and in `createTerrainRing`; main.js cycles each detail through one `rig.render()` before the gate. Terrain uses two cached materials so no recompile is triggered by `flatShading`.
- **Files modified:** web/src/render/ship_model.js, web/src/render/terrain_ring.js, web/src/main.js
- **Verification:** cache-identity and no-dispose tests for both ship and terrain; tier, playfield, smoke and keyboard e2e pass
- **Committed in:** 5f5ffba, 0269f29

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Honours the plan's stated truths and threat mitigation; adds a few ms of CPU at load and two extra renders behind the loading screen. No scope creep.

## Issues Encountered

None. The first test run of the kit, ship and terrain files passed; the production-build screenshots at high and low showed the expected silhouettes (software GL, so frame rate is not meaningful).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The kit is ready for the enemy, crystal, missile, bomb and wreck generators; each should return a `bake`d geometry per detail and plug into `detailViews` (or the enemy `geometryFor` seam).
- Human sign-off still pending on the look (D4): run `npm run preview` and open `/?debug`, then `&tier=low`, on a real GPU.
- Known edge: mid and high share the same wing and fin silhouette; only segment counts and bevels differ, as planned.

## Self-Check: PASSED

- web/src/render/models/model_kit.js, web/test/render/models/model_kit.test.js: found
- Commits 5f5ffba and 0269f29: found on HEAD
- `make check` (ruff, pytest 100% line+branch, vitest 453, build, 39 Playwright specs): passed

---
*Phase: 02-arcade-shooting-feel*
*Completed: 2026-10-18*
