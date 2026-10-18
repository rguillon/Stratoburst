---
phase: 03-stage-1-vertical-slice
plan: 16
subsystem: rendering
tags: [three.js, city-targets, explosion-fx, wreck-ring, instanced-mesh, neon, vitest, playwright]

requires:
  - phase: 03-stage-1-vertical-slice
    provides: "HOUSE/FUEL_TANK/DEPOT/BILLBOARD enemy kinds, tuning.enemy_wreck and the x 40 slums target (03-15), palette neon entries and SPARK/EMBER emitters (03-03), ground-layer wreck ring (02-12)"
provides:
  - "city_targets.js: buildHouse, buildFuelTank, buildDepot, buildBillboard (glyph-block panel, no text), buildRubble, CITY_TARGET_KINDS"
  - "HOUSE, FUEL_TANK, DEPOT, BILLBOARD registered in the enemy model registry and drawn in the ground layer"
  - "Explosion fx option cityKinds, recipe CITY_SPARKS (white flash, cyan sparks, magenta embers) and counter cityBursts (debug hook fx.cityBursts)"
  - "Wreck ring option rubble and wreckKindsFor(groundKindNames, enemyWreck, hasModel): wreck kinds follow the manifest enemy_wreck table plus a model"
  - "Enemy instances option flickerKinds: a city kind below half hp flickers its glow at about 6 Hz"
  - "tools/e2e/buildings.spec.js"
affects: [03-27, 03-28, end-of-phase visual review]

actuals:
  tokens: 11500
  tasks: 2
  commits: 4
plan_head_before: ea7ebe15a8686e68086fb7c35bc87145b1760def
plan_head_after: c09ffc97003c4f07757ed45ba273908bf4fc6db0

tech-stack:
  added: []
  patterns:
    - "A shared kind-name list (CITY_TARGET_KINDS) exported next to the builders, so main.js derives one cityKinds Set of manifest values for fx, wrecks and flicker"
    - "Options that default to empty (cityKinds, flickerKinds, rubble null) so every existing caller and test is unchanged"
    - "Per-kind glow instance colour allocated up front only for flicker kinds; other kinds keep a colourless glow mesh"

key-files:
  created:
    - web/src/render/models/city_targets.js
    - web/test/render/models/city_targets.test.js
    - tools/e2e/buildings.spec.js
  modified:
    - web/src/render/models/enemy_models.js
    - web/test/render/models/enemy_models.test.js
    - web/src/fx/explosion_fx.js
    - web/test/fx/explosion_fx.test.js
    - web/src/fx/wreck_ring.js
    - web/test/fx/wreck_ring.test.js
    - web/src/render/enemy_instances.js
    - web/test/render/enemy_instances.test.js
    - web/src/main.js

key-decisions:
  - "Rubble kinds and flicker kinds are Sets of manifest kind VALUES (the same cityKinds Set main.js passes to the explosion fx), because the EXPLOSION event and the enemy channel both carry values"
  - "The hit flash wins over the flicker by holding the glow at full while a building flashes, instead of multiplying the neon by the 10x body flash (which would bloom a billboard to white on every vulcan hit)"
  - "wreckKindsFor lives in wreck_ring.js rather than inline in main.js so the data-driven rule (enemy_wreck entry 1 and a model) is unit-tested"
  - "buildRubble takes no detail: one low pile shared by all four city kinds, drawn through the wreck ring's CHAR instance colour"

patterns-established:
  - "Pattern: world-scale city target models stand on y = 0 sized to the hitbox radius, boxes rounded with a 0.6 edge, neon trim only from PALETTE NEON_* entries"
  - "Pattern: a tilted panel is built in its own frame at the origin and tilted/lifted as one with place() (billboard body and glyphs)"

requirements-completed: [STGE-03]

coverage:
  - id: D1
    description: "Destructible buildings are drawn as code-built neon models (house, fuel tank, depot, billboard) with a dark body and PALETTE neon trim, registered in the enemy model registry"
    requirement: STGE-03
    verification:
      - kind: unit
        ref: "web/test/render/models/city_targets.test.js#keeps the body dark gunmetal, every channel below 1.0, so only the trim blooms"
        status: pass
      - kind: unit
        ref: "web/test/render/models/enemy_models.test.js#the city targets"
        status: pass
    human_judgment: true
    rationale: "Whether the four models read as a house, fuel tank, depot and billboard from the tilted camera is a visual judgment for the end-of-phase review"
  - id: D2
    description: "A destroyed building throws white-hot fire with cyan and magenta electrical sparks, counted as a city burst"
    requirement: STGE-03
    verification:
      - kind: unit
        ref: "web/test/fx/explosion_fx.test.js#city target bursts (D-33, D-40)"
        status: pass
      - kind: e2e
        ref: "tools/e2e/buildings.spec.js#a laser at x 40 destroys an early slums target: city burst, wreck and scorch, score"
        status: pass
    human_judgment: true
    rationale: "The look of the spark burst against the neon city is a visual judgment for the end-of-phase review"
  - id: D3
    description: "A destroyed building leaves a charred rubble pile (not its intact silhouette) and a scorch mark, both scrolling with the terrain"
    requirement: STGE-03
    verification:
      - kind: unit
        ref: "web/test/fx/wreck_ring.test.js#rubble for destroyed city targets (D-33)"
        status: pass
      - kind: e2e
        ref: "tools/e2e/buildings.spec.js#a laser at x 40 destroys an early slums target: city burst, wreck and scorch, score"
        status: pass
    human_judgment: false
  - id: D4
    description: "A damaged building's neon flickers below half hp (deterministic from the effect clock) and is steady at full hp"
    requirement: STGE-03
    verification:
      - kind: unit
        ref: "web/test/render/enemy_instances.test.js#createEnemyInstances flicker of damaged city targets (D-33)"
        status: pass
    human_judgment: true
    rationale: "Whether the flicker reads as a short-circuiting sign and stays comfortable is a visual judgment (end-of-phase human-check in the plan)"
  - id: D5
    description: "Which ground kills leave a wreck follows the manifest enemy_wreck table and the presence of a JS model"
    requirement: STGE-03
    verification:
      - kind: unit
        ref: "web/test/fx/wreck_ring.test.js#wreckKindsFor (data-driven wreck kinds)"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-10-18
status: complete
---

# Phase 3 Plan 16: Neon City Targets and Their Destruction Summary

**Code-built neon house, fuel tank, depot and glyph billboard that burst into white-hot fire with cyan and magenta sparks, leave charred rubble and a scorch mark, and flicker their glow below half hp, with wreck kinds read from the manifest's enemy_wreck table**

## Performance

- **Duration:** 7 min
- **Started:** 2026-10-18T18:50:49Z
- **Completed:** 2026-10-18T18:58:00Z
- **Tasks:** 2
- **Files modified:** 12 (3 created, 9 modified)

## Accomplishments
- Four destructible-building models (`city_targets.js`) at three detail levels each, dark gunmetal shell and palette neon trim (violet roof edge, cyan tank bands, magenta depot doors, a billboard panel of procedural glyph blocks with no text), registered so the ground layer draws them like tanks.
- A destroyed building adds `CITY_SPARKS` (white flash, 24 cyan sparks, 12 magenta embers, tier-scaled) on top of its blast and counts `cityBursts`; `buildings.spec.js` proves a laser at x 40 triggers the burst, a wreck, a scorch decal and score.
- The wreck ring draws a city kind as a low charred rubble pile, and `wreckKindsFor` selects wreck kinds from `tuning.enemy_wreck` plus the presence of a model, so train turrets and stumps never leave a second wreck under the boss.
- City kinds below half hp flicker their glow (about 6 Hz, dim 0.12 to full, out of step per slot); a flash or full health holds it steady.

## Task Commits

1. **Task 1: Tracer: neon city targets and electrical-spark bursts**
   - RED `62241f4` (test): city_targets, registry roster and explosion `cityKinds` tests
   - GREEN `a475252` (feat): builders, registry entries, `CITY_SPARKS`, `cityBursts`, main.js wiring and `buildings.spec.js`
2. **Task 2: Rubble, damaged-sign flicker and data-driven wreck kinds**
   - RED `2b8397d` (test): wreck ring rubble, `wreckKindsFor` and flicker tests
   - GREEN `c09ffc9` (feat): `rubble` option, `wreckKindsFor`, `flickerKinds`, main.js wiring

**Plan metadata:** recorded in the docs commit that carries this file.

## TDD Gate Compliance

Both tasks have a `test(03-16)` commit before their `feat(03-16)` commit.

RED evidence (vitest, run before each GREEN): Task 1 RED failed on the registry roster and `cityKinds`/`CITY_SPARKS`/`cityBursts` assertions (9 failures); `city_targets.test.js` itself failed at import because the module did not exist yet, which is a load failure rather than a target assertion, so its assertions were first exercised in GREEN (semantic assessment: acceptable, the registry and explosion tests carried the assertion-level RED). Task 2 RED failed 9 target assertions (rubble geometry, `wreckKindsFor is not a function`, flicker values and null `instanceColor`) with the 81 pre-existing tests still green. The plan is `type: execute`, so the `check tdd-red-evidence` classifier was not required.

## Files Created/Modified
- `web/src/render/models/city_targets.js` - the four builders, `buildRubble`, `CITY_TARGET_KINDS`
- `web/src/render/models/enemy_models.js` - BUILDERS gains HOUSE, FUEL_TANK, DEPOT, BILLBOARD
- `web/src/fx/explosion_fx.js` - `cityKinds` option, `CITY_SPARKS`, `cityBursts` getter
- `web/src/fx/wreck_ring.js` - `rubble` option, `wreckKindsFor`
- `web/src/render/enemy_instances.js` - `flickerKinds`, per-slot glow instance colour
- `web/src/main.js` - `cityKinds`, rubble geometry, data-driven wreck kinds, `fx.cityBursts` hook
- `tools/e2e/buildings.spec.js` - laser at x 40 destroys an early target
- Test modules mirrored for every changed source file under `web/test/`

## Decisions Made
See `key-decisions` above. Main points: kind Sets hold manifest values, the flash holds the glow at full rather than multiplying it, and the wreck-kind rule is a tested function.

## Deviations from Plan

None - plan executed exactly as written. (`CITY_TARGET_KINDS` was exported from `city_targets.js` so `main.js` does not repeat the four names; `wreckKindsFor` was added to `wreck_ring.js` so the data-driven wreck rule is unit-tested instead of living untested in `main.js`. Both stay within the plan's file list.)

## Issues Encountered
- Two vertex-colour test failures on the first GREEN run (billboard panel saturation exactly 0.3, rubble shade exactly 0.3 in float32); fixed by nudging the shell colours inside the gunmetal band.

## Known Stubs
None.

## Threat Flags
None. T-03-21 mitigated: the city spark counts go through the same `getScale()` tier scaling as every recipe and the particle layers keep their fixed capacities. T-03-SC: no packages added, lockfiles unchanged.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The visible half of STGE-03 is in place. The plan's end-of-phase human check remains: shoot a fuel tank in the slums and watch for white-hot fire with cyan and magenta sparks, a charred rubble pile scrolling away with the block, and a damaged billboard flickering before it dies.
- Note for later plans: all four city kinds share one rubble pile; per-kind rubble would need `rubble.geometry` to become a per-kind map.

## Self-Check: PASSED

- Created files exist: `web/src/render/models/city_targets.js`, `web/test/render/models/city_targets.test.js`, `tools/e2e/buildings.spec.js`.
- Commits found on HEAD: 62241f4, a475252, 2b8397d, c09ffc9 (`rev-list --count` from the ledger = 4).
- Acceptance greps match (FUEL_TANK, cityKinds, rubble, flickerKinds in both named files); the named vitest files pass (197 tests).
- Verification: `make test-web` 65 files / 1319 tests green; `make build` ok; Playwright buildings, city, ground, stage and medal specs pass (11 of 11).

---
*Phase: 03-stage-1-vertical-slice*
*Completed: 2026-10-18*
