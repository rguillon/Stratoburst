---
phase: 02-arcade-shooting-feel
plan: 19
subsystem: rendering
tags: [three.js, point-lights, blob-shadows, instancing, quality-tiers, vitest, playwright]

requires:
  - phase: 02-arcade-shooting-feel
    provides: rig.sun and the double prewarm (02-17), PALETTE.LIGHT_EXPLOSION and PALETTE.SHADOW (02-17), ground-aware toWorld and the dispatcher handler list (02-12, 02-02), scorch decals at renderOrder 2 (02-14), enemies channel and manifest tuning tables (02-05)
provides:
  - createLightPool: a fixed pool of 3 PointLights flashed by MEDIUM and LARGE explosions, intensity-only, with a WCAG flash budget
  - createShadowInstances: one InstancedMesh of soft blob shadows for every aircraft and the ship, displaced along the sun direction
  - tier field lights (high 3, mid 2, low 0) applied through lightPool.setEnabled
  - debug hooks fx.lightsFlashed and fx.shadows, and glow e2e assertions for both
affects: [02-25 respawn plan passes shipVisible false, 02-33 phone gate (lights per tier is the lever), any plan that adds lit materials before the second prewarm]

actuals:
  tokens: 7000
  tasks: 2
  commits: 3
plan_head_before: 55ac7b89c44e9e2016db9a8512c96a0d04c69e1b
plan_head_after: c6ffa953f030594721047f8e3aa83a56c7ae2bf3

tech-stack:
  added: []
  patterns:
    - "Fixed light pool: lights are created once, added to the scene before the second prewarm and only ever have their intensity changed, so the point-light count in the shader key never changes"
    - "Flash budget: at most 3 fresh pulses per second; a flash beyond it re-triggers the newest lit light or is dropped, never starting a pulse from dark"
    - "Altitude cue by offset: shadows live in the scene, not the ground layer, and are displaced along the sun ray by a fixed altitude without ray compensation"

key-files:
  created:
    - web/src/fx/light_pool.js
    - web/test/fx/light_pool.test.js
    - web/src/fx/shadow_instances.js
    - web/test/fx/shadow_instances.test.js
  modified:
    - web/src/quality/tiers.js
    - web/test/quality/tiers.test.js
    - web/src/main.js
    - tools/e2e/glow.spec.js

key-decisions:
  - "Light pulses decay linearly to exactly zero; a flash on a lit light restarts from the larger of its current and the new peak, so continuous explosions keep the scene lit instead of strobing"
  - "A flash budget of 3 fresh pulses per rolling second enforces the WCAG 2.3.1 limit in code: over budget, the newest lit light is re-triggered, and a flash that would start from dark is dropped"
  - "Shadow quads are 1.5 radii across (scale = radius * 1.5 on a unit quad) with a soft radial falloff to alpha 0.45; the ship uses radius 9"
  - "Shadows draw with a small polygon offset at terrain depth + 0.3 and depthWrite off, so buildings still hide them"

patterns-established:
  - "Per-tier presentation caps are plain numbers in TIERS (lights, maxDecals) applied through a small apply function in main.js at start and on every tier change"

requirements-completed: [VISL-02, VISL-06]

coverage:
  - id: D1
    description: "MEDIUM and LARGE explosions flash a pooled light (peak 3 over 0.15 s, peak 6 over 0.25 s, 20 units above the blast); SMALL explosions and hits do not"
    requirement: VISL-02
    verification:
      - kind: unit
        ref: "web/test/fx/light_pool.test.js#flashes a MEDIUM explosion at peak 3 for 0.15 s, 20 units above the blast"
        status: pass
      - kind: unit
        ref: "web/test/fx/light_pool.test.js#does not flash for SMALL explosions, hits or other events"
        status: pass
      - kind: e2e
        ref: "playwright: tools/e2e/glow.spec.js#a heavy kill flashes a pooled explosion light"
        status: pass
    human_judgment: false
  - id: D2
    description: "The pool is exactly 3 lights that are never added, removed or hidden; the tier only changes how many may flash (3, 2, 0)"
    requirement: VISL-02
    verification:
      - kind: unit
        ref: "web/test/fx/light_pool.test.js#setEnabled(0) darkens every light and ignores later flashes, keeping the lights in place"
        status: pass
      - kind: unit
        ref: "web/test/quality/tiers.test.js#is the frozen ladder high / mid / low"
        status: pass
    human_judgment: false
  - id: D3
    description: "Pulses never strobe: single decaying pulses, re-trigger from the larger of current and new peak, at most 3 fresh pulses per second"
    requirement: VISL-02
    verification:
      - kind: unit
        ref: "web/test/fx/light_pool.test.js#never starts more than 3 new pulses inside one second, so continuous explosions cannot strobe"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every aircraft and the ship cast a soft shadow displaced along the sun direction by 40 units (about 16 right, 21 up the screen); ground units cast none; the ship shadow can be hidden"
    requirement: VISL-06
    verification:
      - kind: unit
        ref: "web/test/fx/shadow_instances.test.js#draws one shadow per air enemy plus the ship, displaced along the sun direction by 40 units"
        status: pass
      - kind: unit
        ref: "web/test/fx/shadow_instances.test.js#skips ground kinds and kinds it does not know"
        status: pass
      - kind: unit
        ref: "web/test/fx/shadow_instances.test.js#omits the ship shadow when the ship is hidden"
        status: pass
      - kind: e2e
        ref: "playwright: tools/e2e/glow.spec.js#the ship casts a shadow on the terrain"
        status: pass
    human_judgment: false
  - id: D5
    description: "Flash brightness and shadow strength look right: the lit terrain does not bloom beyond the blast core, and the shadow offset reads as altitude"
    verification: []
    human_judgment: true
    rationale: "Intensity against terrain albedo and the readability of the altitude cue are visual judgements; the plan's human-check covers them and the numbers are module constants for tuning"

duration: 10min
completed: 2026-10-18
status: complete
---

# Phase 2 Plan 19: Explosion Lights and Air Shadows Summary

**Heavy explosions flash one of three pooled point lights across the terrain in a single decaying pulse, and every aircraft, the player's included, casts a soft blob shadow displaced along the sun ray so its offset shows how high it flies.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-10-18T05:23:00Z
- **Completed:** 2026-10-18T05:33:00Z
- **Tasks:** 2
- **Files modified:** 8 (4 created, 4 modified)

## Accomplishments

- `createLightPool`: exactly 3 PointLights (decay 0, reach 140, intensity 0) created once and added to `rig.scene` before the second prewarm; a flash only animates intensity, so no lit shader recompiles mid-game. MEDIUM peaks at 3 over 0.15 s, LARGE at 6 over 0.25 s, 20 units above the blast, ground blasts placed on the terrain through the ground layer.
- Tier `lights` (high 3, mid 2, low 0) applied with `lightPool.setEnabled` at start and on every tier change; lights above the cap go dark but stay in the scene.
- `createShadowInstances`: one InstancedMesh (capacity + 1) of soft dark quads at terrain depth + 0.3, renderOrder 3 (above scorch marks, below the dim mask), offset (-sun.x / sun.y, -sun.z / sun.y) * 40 (about (16, -21.3)), scaled to 1.5 x unit radius; ground kinds skipped, `shipVisible` false omits the ship's, `update` allocates nothing.
- Tracer verified end to end before expansion (vitest, build, glow and tier Playwright specs with a real MEDIUM/LARGE kill flashing a light); the full `make check` (ruff, pytest at 100% line+branch, vitest 704 tests, build, 48 e2e specs) passes at the end.

## Task Commits

1. **Task 1: Tracer, a heavy kill flashes one pooled light** - `62c08d2` (feat)
2. **Task 2: Air shadows**
   - RED - `79eb17e` (test)
   - GREEN - `c6ffa95` (feat)

**Plan metadata:** the docs commit that follows this summary.

## TDD Gate Compliance (Task 2)

- **RED:** `79eb17e` added 9 shadow tests plus a `shadow_instances.js` scaffold (a factory returning an empty InstancedMesh and a no-op `update`) so the tests could load. Run before the implementation, all 9 failed on assertions for the intended behaviour (name `''` vs `air-shadows`, count 6 vs 1, scale 1 vs 13.5, position 0 vs -60); none failed from an import, syntax or fixture fault. No machine-readable RED record was produced because the classifier does not read vitest reports; this is the semantic assessment.
- **GREEN:** `c6ffa95` implemented the factory and wiring; all 704 vitest tests passed. One test assertion about quad flatness was loosened from exact set equality to a 1e-6 tolerance (rotateX leaves a 6e-17 rounding residue), a test fix rather than an implementation change.
- **REFACTOR:** none needed.

## Files Created/Modified

- `web/src/fx/light_pool.js` - the light pool, flash constants and the flash budget.
- `web/src/fx/shadow_instances.js` - blob shadow InstancedMesh and its soft radial shader.
- `web/src/quality/tiers.js` - `lights` per tier.
- `web/src/main.js` - pool and shadows created before the second prewarm, pool added to the dispatcher, per-frame `lightPool.update` and `shadows.update`, `applyLights` on tier changes, hooks `fx.lightsFlashed` and `fx.shadows`.
- `tools/e2e/glow.spec.js` - heavy-kill light assertion and ship shadow assertion.
- Tests mirror each source file under `web/test/fx/` and `web/test/quality/`.

## Decisions Made

See `key-decisions` above. The two worth remembering for tuning: the light constants (`LIGHT_PEAK_*`, `LIGHT_DURATION_*`, `LIGHT_LIFT`) and the shadow constants (`SHADOW_SCALE`, `MAX_ALPHA`, altitude 40) are plain module constants, and the shadow is deliberately not ray-compensated.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Enforced the flash limit in code**
- **Found during:** Task 1 (light pool)
- **Issue:** The plan's prohibition says the screen never flashes more than 3 times per second, and the specified behaviour (round-robin over three lights plus restart from the larger peak) alone does not bound fresh pulses: a burst of kills could start more than 3 pulses from dark within a second.
- **Fix:** A ring of the last 3 fresh-pulse start times; if the oldest is inside the last second the flash re-triggers the newest light while it is lit and is dropped once it is dark. Covered by the no-strobe and drop tests.
- **Files modified:** web/src/fx/light_pool.js, web/test/fx/light_pool.test.js
- **Verification:** `never starts more than 3 new pulses inside one second` and `drops a flash that the budget refuses...` pass.
- **Committed in:** 62c08d2 (part of the Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** The budget makes the plan's own photosensitivity prohibition a tested property instead of a judgement. A dropped flash only affects a burst of more than 3 separate heavy blasts inside one second with all lights dark, which the existing explosion particles still show.

The plan's `<verify>` commands use `npm test`, `npm run build` and Playwright; all were run, and the project's `make check` gate was run as well.

## Issues Encountered

None.

## Known Stubs

None. The ship shadow is always on (`shipVisible` is `true` in main.js) by design; plan 02-25 passes `false` while the ship is hidden.

## Threat Flags

None. T-02-23 is mitigated as planned (fixed light count prewarmed at load, low tier disables flashes, single decaying pulses with a per-second budget). T-02-24 is mitigated (one InstancedMesh capped at the enemy capacity plus one, no per-frame allocation). T-02-SC: no packages added, lockfiles unchanged.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for the next plans in wave 10. The plan's human-check (shoot carriers and tanks at `http://localhost:4173/?debug&weapon=vulcan&level=5` after `make preview`; confirm each blast flashes the terrain once without the whole ground blooming, nothing strobes, aircraft and ship shadows sit offset on the ground and ground units have none) is left for the end-of-phase verification. A software-GL screenshot confirmed the ship shadow renders and a flash occurs, but it is faint against the dark terrain, so `MAX_ALPHA` is the first knob if the human check wants it stronger. Lights per tier remains the lever for the 02-33 phone gate.

---
*Phase: 02-arcade-shooting-feel*
*Completed: 2026-10-18*

## Self-Check: PASSED
