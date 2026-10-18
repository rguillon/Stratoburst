---
phase: 02-arcade-shooting-feel
plan: 07
subsystem: rendering
tags: [three.js, procedural-models, instancing, lathe, vertex-colors, hdr-glow, quality-tiers]

requires:
  - phase: 02-arcade-shooting-feel
    provides: "02-06 model_kit (lathe, capsule, beveledExtrude, tint, place, bake) and the main.js detailViews tier wiring; 02-04 enemy instancing behind a geometryFor seam; 02-05 the aux aim-angle channel"
provides:
  - "buildJet, buildHeli, buildCarrier: (detail) -> { body, glow, top } smooth code-built air enemy models"
  - "enemy_models.js: enemyModel(kind, detail) cached per (kind, detail), hasModel, warmModels, BUILDERS"
  - "outline_shapes.js: polygonShape and mirroredShape shared outline helpers"
  - "enemy_instances.js: body, glow and optional top InstancedMesh per kind, update(n, timeS), setDetail(detail), ROTOR_RATE"
affects: [02-09 ground enemy models (TANK, TURRET register in BUILDERS and reuse the top mesh), 02-08, 02-10]

actuals:
  tokens: 15000
  tasks: 2
  commits: 2
plan_head_before: 8d0177a605cab9579ebef97818fb1a7f4affae85
plan_head_after: 0928988c15cca563da4a4712feb88bed1e8d66e1

tech-stack:
  added: []
  patterns:
    - "A model is { body, glow, top }: the lit hull with vertex colours below 1.0, an HDR accent geometry in a separate MeshBasicMaterial mesh so only accents bloom, and an optional separately rotating part"
    - "The instance colour is a multiplier on the vertex colours: (1, 1, 1) at rest and (6, 6, 6) on a hit, which pushes the desaturated military colours past the bloom threshold"
    - "setDetail only reassigns cached geometries on existing meshes; the primitive stand-ins are built once per kind in the default geometryFor closure"

key-files:
  created:
    - web/src/render/models/jet.js
    - web/src/render/models/heli.js
    - web/src/render/models/carrier.js
    - web/src/render/models/enemy_models.js
    - web/src/render/models/outline_shapes.js
    - web/test/render/models/jet.test.js
    - web/test/render/models/heli.test.js
    - web/test/render/models/carrier.test.js
    - web/test/render/models/enemy_models.test.js
    - web/test/render/models/outline_shapes.test.js
  modified:
    - web/src/render/enemy_instances.js
    - web/test/render/enemy_instances.test.js
    - web/src/main.js

key-decisions:
  - "geometryFor now returns { body, glow, top } for every kind, so the TANK and TURRET primitives are tinted with their base colour at build time (the body material uses vertex colours, and an untinted primitive would draw black)"
  - "A HELI top spins by angle + timeS * ROTOR_RATE and any other kind's top points along the absolute aux aim angle"
  - "enemyModel throws 'unknown enemy kind X' for every name without a builder, including TANK and TURRET until 02-09; instances use hasModel to fall back to the primitive instead"
  - "Models are centred on the hitbox origin and both the width and length half-extents sit inside 0.8x to 1.6x of the kind radius, so the rotor (centred on the origin) can spin about Y alone"

patterns-established:
  - "Shared flat outlines (polygonShape, mirroredShape) live in outline_shapes.js instead of being repeated per model"
  - "Cargo stripe as a thin separate lathe sleeve tinted bright, so its edges are crisp instead of a vertex-colour gradient"

requirements-completed: [VISL-01]

coverage:
  - id: D1
    description: "Jets, helicopters and carriers are generated in code in the smooth style with military vertex colours below 1.0 and HDR accents in a separate glow geometry"
    requirement: VISL-01
    verification:
      - kind: unit
        ref: "web/test/render/models/jet.test.js, heli.test.js, carrier.test.js (colour channels below 1.0, glow above 1.0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Model detail follows the tier: every (kind, detail) pair is cached, vertex counts fall from high to low, and setDetail swaps cached geometry without creating a mesh"
    requirement: VISL-01
    verification:
      - kind: unit
        ref: "web/test/render/models/enemy_models.test.js; web/test/render/enemy_instances.test.js#setDetail swaps the cached geometries on the existing meshes, creating nothing"
        status: pass
      - kind: e2e
        ref: "npx playwright test tools/e2e/tier.spec.js"
        status: pass
    human_judgment: false
  - id: D3
    description: "Each enemy model's footprint matches its hitbox (half-extent between 0.8x and 1.6x of the radius)"
    verification:
      - kind: unit
        ref: "web/test/render/models/{jet,heli,carrier}.test.js hitbox tests"
        status: pass
    human_judgment: false
  - id: D4
    description: "Body, glow and top meshes per kind; the HELI rotor spins at ROTOR_RATE (30 rad/s), other tops follow the aux angle, hit flash is (6, 6, 6) and rest is (1, 1, 1)"
    verification:
      - kind: unit
        ref: "web/test/render/enemy_instances.test.js (createEnemyInstances tops, hit flash)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The air enemies look smooth and stylized with glowing accents, a distinctive carrier, a readable near-white hit flash and similar silhouettes at the low tier"
    verification: []
    human_judgment: true
    rationale: "Visual quality is subjective. A software-GL screenshot at ?debug&tier=high showed recognisable swept jets, helicopters with nav lights and a large khaki carrier facing down the screen, but the glow, flash feel and mobile look need a human eye."

duration: 8min
completed: 2026-10-18
status: complete
---

# Phase 2 Plan 07: Smooth Air Enemy Models Summary

**Code-built jets, helicopters with a spinning rotor mesh and cargo carriers with an amber beacon, each as a body plus HDR glow (plus top) InstancedMesh trio whose detail follows the tier through cached geometry swaps**

## Performance

- **Duration:** 8 min
- **Started:** 2026-10-18T03:49:03Z
- **Completed:** 2026-10-18T03:57:18Z
- **Tasks:** 2
- **Files modified:** 13 (10 created, 3 modified)

## Accomplishments
- The enemy jet is a lathe fuselage with beveled swept wings, engine pods and tail fins in olive greys with a darker belly, plus two HDR engine discs in a separate glow geometry. The jet faces +Z (down the screen) and is sized to its radius of 9.
- The helicopter has a capsule cabin, tapered tail boom, stub wings with rocket pods, skids, warm white and green nav lights, and a rotor `top` centred on the origin that spins at 30 rad/s on the effect clock.
- The carrier is the largest air model (span 30, length 28): a khaki cargo fuselage with a bright stripe sleeve (up to 0.88, still below 1.0), high wings, four engine pods, a T-tail, engine discs and an amber (3.2, 2.0, 0.3) HDR beacon.
- `enemy_models.js` caches every (kind, detail) pair; `warmModels` builds them at load in `main.js`, and `enemies` joins `detailViews`, so a tier change swaps geometry with no generation (T-02-09).
- `enemy_instances.js` now draws body, glow and optional top meshes per kind with the same matrices, flashes a hit enemy at (6, 6, 6), and exposes `setDetail` and `update(n, timeS)`. Kinds with no builder (TANK, TURRET) keep tinted primitives until 02-09.

## Task Commits

1. **Task 1: Tracer, enemy jets with a smooth model and glowing engines, detail follows the tier** - `7362ddd` (feat)
2. **Task 2: Helicopters with spinning rotors and distinctive carriers** - `0928988` (feat)

**Plan metadata:** recorded in the docs commit that follows this summary.

## Files Created/Modified
- `web/src/render/models/jet.js`, `heli.js`, `carrier.js` - the three air model generators
- `web/src/render/models/enemy_models.js` - registry, cache, `hasModel`, `warmModels`
- `web/src/render/models/outline_shapes.js` - shared `polygonShape` and `mirroredShape`
- `web/src/render/enemy_instances.js` - body, glow and top instancing, `setDetail`, `ROTOR_RATE`
- `web/src/main.js` - warm the models, enemies in `detailViews`, pass `fxTime` to `enemies.update`
- Tests mirror each source file under `web/test/render/` and `web/test/render/models/`

## Decisions Made
See key-decisions. The tracer gate ran in end-of-phase mode with an automated-only verify: it was re-run (npm test, build, the shooting and tier Playwright specs) and passed before the expansion task, so the run continued without a checkpoint.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Primitive stand-ins are tinted with their base colour**
- **Found during:** Task 1 (switching the body material to vertex colours)
- **Issue:** With `vertexColors: true` an untinted primitive (TANK, TURRET) has no colour attribute and would be drawn black.
- **Fix:** The default `geometryFor` tints each primitive once with its `BASE_COLORS` entry and caches it, so `setDetail` never rebuilds it.
- **Files modified:** `web/src/render/enemy_instances.js`
- **Committed in:** `7362ddd`

**2. [Rule 3 - Blocking] Shared outline helpers module**
- **Found during:** Task 1
- **Issue:** The wing and fin outline code from `ship_model.js` would otherwise be copied into three more files.
- **Fix:** Added `outline_shapes.js` (`polygonShape`, `mirroredShape`) with its own test file. `ship_model.js` was left untouched.
- **Files modified:** `web/src/render/models/outline_shapes.js`, `web/test/render/models/outline_shapes.test.js`
- **Committed in:** `7362ddd`

**3. [Rule 1 - Bug] The instance count of a top mesh is cleared with the body count**
- **Found during:** Task 2 (review of the update loop before committing)
- **Issue:** The first draft set `top.count` only after the early `continue` for an empty kind, so a helicopter rotor would have kept drawing at its last count after the last helicopter left.
- **Fix:** `top.count` is set next to the body and glow counts; a test covers the zero-live case.
- **Files modified:** `web/src/render/enemy_instances.js`
- **Committed in:** `0928988`

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug)
**Impact on plan:** All three were needed for correctness; the only scope addition is the small shared `outline_shapes.js` module.

## Issues Encountered
None beyond the deviations. Existing instancing tests asserted the old primitive meshes, a single shared material and the (2.2, 2.2, 2.2) flash, so they were rewritten for the new body and glow meshes and the (6, 6, 6) flash.

## Known Stubs
None. TANK and TURRET intentionally still draw the 02-04 primitive shapes (tinted); plan 02-09 adds their builders through the same `BUILDERS` registry and the turning top mesh is already in place.

## Threat Flags
None. No new network, auth or storage surface; T-02-09 is mitigated as planned (everything is built by `warmModels` at load, `setDetail` only reassigns cached geometry, tested by object identity). No packages were installed.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 02-09 can register TANK and TURRET builders in `BUILDERS` returning a `top`; non-HELI tops already rotate by the aux aim angle.
- Human check still open (end-of-phase UAT): at `http://localhost:4173/?debug` (npm run preview) confirm the air enemies look smooth with glowing accents, the carrier is distinctive, helicopter rotors spin, `&tier=low` keeps the same silhouettes with fewer segments, and a hit enemy flashes near-white.
- Verification run: `make check` (ruff, pytest 100% coverage, vitest 520 tests, build, 39 Playwright specs) passed.

---
*Phase: 02-arcade-shooting-feel*
*Completed: 2026-10-18*

## Self-Check: PASSED

- FOUND: web/src/render/models/jet.js, heli.js, carrier.js, enemy_models.js, outline_shapes.js and their tests
- FOUND commits: 7362ddd, 0928988
- `grep -n "warmModels(" web/src/main.js` and `grep -n "ROTOR_RATE" web/src/render/enemy_instances.js` match
