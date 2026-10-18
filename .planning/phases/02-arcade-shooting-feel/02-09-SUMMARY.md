---
phase: 02-arcade-shooting-feel
plan: 09
subsystem: render
tags: [three, procedural-models, instancing, tank, turret, vertex-colors]

requires:
  - phase: 02-arcade-shooting-feel
    provides: "model_kit and the enemy model registry (02-06, 02-07); enemy aux aim angle (02-05)"
provides:
  - "buildTank(detail) -> { body, glow, top }: beveled olive hull, track blocks with road wheels, rounded turret and barrel as the rotating top, HDR exhaust embers"
  - "buildTurret(detail) -> { body, glow, top }: beveled concrete octagon plate, lathe pedestal, twin-barrel gun as the rotating top, green HDR status light"
  - "TANK and TURRET registered in BUILDERS: every manifest kind (JET, HELI, CARRIER, TANK, TURRET) is now code-built"
affects: [02-12 ground units on terrain, 02-10, 02-11]

actuals:
  tokens: 6000
  tasks: 2
  commits: 2
plan_head_before: a8d62f3e7a20a575f8f1f6ad37c1d081a80c0e7c
plan_head_after: 36a61f2cb686753b8f2d349bda060370806029eb
commits: 2

tech-stack:
  added: []
  patterns:
    - "ground model = { body, glow, top } where top is centred on its pivot axis (barrels toward +Z) so enemy_instances rotates it by the aux aim angle"
    - "registering a builder in BUILDERS is the only wiring; geometryFor already prefers enemyModel when hasModel"

key-files:
  created:
    - web/src/render/models/tank.js
    - web/src/render/models/turret.js
    - web/test/render/models/tank.test.js
    - web/test/render/models/turret.test.js
  modified:
    - web/src/render/models/enemy_models.js
    - web/test/render/models/enemy_models.test.js
    - web/test/render/enemy_instances.test.js

key-decisions:
  - "Tank and turret reuse model_kit parts only (beveledExtrude, lathe, capsule, tint, bake), so detail ordering and no-bevel-at-low come from the kit rather than per-model code"
  - "basicEnemyGeometry keeps its TANK/TURRET primitives and BASE_COLORS as the fallback shapes for unknown kinds; they are no longer used by any gallery kind"

patterns-established:
  - "Roster test: a fixture of manifest kinds asserts every kind has a builder and warms, so a new kind without a model fails a test"

requirements-completed: [VISL-01]

coverage:
  - id: D1
    description: "Tanks are smooth code-built models with a rotating turret top, HDR embers, no pink, detail ordering high > mid > low and a footprint matching the hitbox radius"
    requirement: VISL-01
    verification:
      - kind: unit
        ref: "web/test/render/models/tank.test.js"
        status: pass
      - kind: e2e
        ref: "npx playwright test tools/e2e/shooting.spec.js"
        status: pass
    human_judgment: true
    rationale: "Whether the tank looks good (smooth, stylized, readable) is a visual judgment no test asserts"
  - id: D2
    description: "AA turrets are smooth code-built models with a twin-barrel gun top, a green HDR status light, detail ordering and a hitbox-matched footprint"
    requirement: VISL-01
    verification:
      - kind: unit
        ref: "web/test/render/models/turret.test.js"
        status: pass
      - kind: e2e
        ref: "npx playwright test tools/e2e/shooting.spec.js tools/e2e/tier.spec.js"
        status: pass
    human_judgment: true
    rationale: "Look of the turret and whether its gun visibly tracks the ship on screen is a visual judgment (plan human-check)"
  - id: D3
    description: "Every manifest kind has a builder and warmModels warms all five, so no primitive shape is drawn for a gallery kind"
    requirement: VISL-01
    verification:
      - kind: unit
        ref: "web/test/render/models/enemy_models.test.js#the manifest roster"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-10-18
status: complete
---

# Phase 02 Plan 09: Smooth Tanks and AA Turrets Summary

**Code-built smooth tank (beveled hull, tracks, rounded turret) and AA turret (concrete plate, lathe pedestal, twin-barrel gun) with rotating tops and HDR accents, completing the five-kind procedural roster**

## Performance

- **Duration:** 8 min
- **Started:** 2026-10-18T04:05:05Z
- **Completed:** 2026-10-18T04:13:34Z
- **Tasks:** 2
- **Files modified:** 7 (4 created, 3 modified)

## Accomplishments
- Tank: beveled olive hull from a mirrored plan, two chamfered track blocks with four road wheels each, a rounded turret with mantlet and barrel as `top` centred on the turret ring, two HDR embers at the rear. Body half-extent is inside 0.8x-1.6x of radius 11.
- AA turret: beveled octagonal concrete plate, lathe pedestal, rounded housing with two parallel barrels as `top` centred on the pedestal axis, one green HDR status light. Body half-extent is inside 0.8x-1.6x of radius 10.
- Both are registered in `BUILDERS`; with no change to enemy_instances the existing aux-driven top rotation turns the tank turret and AA gun toward the ship, and all five gallery kinds are code-built.

## Task Commits

1. **Task 1: Tracer, tanks as smooth code-built models with a turret that follows the aim angle** - `f8b2186` (feat)
2. **Task 2: AA turrets with a smooth concrete base and tracking twin-barrel gun** - `36a61f2` (feat)

**Plan metadata:** committed separately as the docs(02-09) commit.

_Task 2 is marked tdd: the turret test was run before the implementation and failed on the missing module (load failure, not a semantic RED). The test and implementation were committed together because the plan is `type: execute`, not `type: tdd`, so no separate RED commit gate applies._

## Files Created/Modified
- `web/src/render/models/tank.js` - buildTank(detail)
- `web/src/render/models/turret.js` - buildTurret(detail)
- `web/test/render/models/tank.test.js`, `turret.test.js` - detail ordering, colour range, hitbox footprint, HDR accent, top centring, determinism
- `web/src/render/models/enemy_models.js` - registers TANK and TURRET
- `web/test/render/models/enemy_models.test.js` - TANK cache and detail tests, manifest roster test (every kind has a builder and warms)
- `web/test/render/enemy_instances.test.js` - updated for modeled tank and turret (see deviations)

## Decisions Made
- Built only from model_kit parts so tier detail behaviour (bevels off at low, fewer segments) is inherited, not re-implemented.
- Left the TANK/TURRET primitives in `basicEnemyGeometry` as fallbacks for unknown kinds; removing them is out of this plan's scope.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] enemy_instances tests assumed tank and turret were primitives**
- **Found during:** Task 1 (and again in Task 2)
- **Issue:** Registering a builder made five tests in `web/test/render/enemy_instances.test.js` fail: the expected mesh name list and zero-count list assumed a single mesh for TANK and TURRET, one test asserted the tank had a BoxGeometry primitive and the neutral-primitive colour, and one counted every drawn mesh.
- **Fix:** The mesh name list and counts now include the glow and top meshes of both kinds. Primitive behaviour is now asserted through an unknown kind (`MYSTERY`) with the fallback colour and a BoxGeometry. The setDetail test checks the tank body and top swap with cached models. The out-of-range kind test now asserts exactly the turret's three meshes are drawn.
- **Files modified:** web/test/render/enemy_instances.test.js
- **Verification:** `npm test` 551 passed; `make check` green
- **Committed in:** f8b2186 and 36a61f2

---

**Total deviations:** 1 auto-fixed (1 blocking test update)
**Impact on plan:** Necessary consequence of registering the builders; no production code beyond the plan changed.

## Issues Encountered
- The human-check in Task 2 (visual smoothness, guns tracking the ship, low tier silhouette at http://localhost:4173/?debug) was not performed by the executor; it is left to the phase verifier / UAT per the end-of-phase human verify mode. Ground models still draw on the gameplay plane until plan 02-12, as the plan states.

## Known Stubs

None.

## Threat Flags

None. No new network, auth or trust-boundary surface; no packages added (T-02-SC), models generated once per detail through the existing cache (T-02-12).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All five gallery kinds are code-built; plan 02-12 can move ground units onto the terrain without touching model code.
- Visual sign-off of tank and turret appearance is pending in end-of-phase UAT.

## Self-Check: PASSED

- web/src/render/models/tank.js, turret.js and both test files exist on disk.
- Commits f8b2186 and 36a61f2 are ancestors of HEAD.
- `make check`: ruff clean, pytest 515 passed at 100% line+branch coverage, vitest 551 passed, build ok, Playwright 39 passed.
- `grep "TANK: buildTank"` and `grep "TURRET: buildTurret"` match in enemy_models.js.

---
*Phase: 02-arcade-shooting-feel*
*Completed: 2026-10-18*
