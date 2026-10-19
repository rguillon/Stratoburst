---
phase: 03-stage-1-vertical-slice
plan: 20
subsystem: boss-presentation
tags: [boss, bomber, warning-banner, shadow-sweep, explosion, screen-shake, three-js, vitest, playwright, tdd]

requires:
  - phase: 03-stage-1-vertical-slice
    provides: BOMBER kinds 12-16, WARNING / BOSS / CLEAR flow states, FLOW_T clock and BOSS_DEFEATED event (03-19); train model and stump pattern, stump smoulder for every *_STUMP kind (03-18); banner overlay with STAGE n (03-10); BLAST_HUGE in the manifest (03-04)
provides:
  - web/src/render/models/bomber.js with buildBomber, buildBomberOpen, buildBomberTurret, buildBomberEngine, buildBomberStump, all registered in enemy_models.js
  - Banner WARNING state (text, `warning` class) and the `#banner.warning` red neon 2 Hz flash with a reduced-motion opt-out in index.html
  - web/src/fx/boss_sweep.js createBossSweep and silhouetteAlpha, wired into main.js
  - RECIPES.HUGE, LIGHT_PEAK_HUGE / LIGHT_DURATION_HUGE, a 40-unit ground scorch, SHAKE_BOSS with a four-shake chain, and the shadow `sizeScale` option
  - tools/e2e/boss.spec.js
affects: [03-21 tally and restart loop (CLEAR already reachable), 03-28 vertical-slice gate (?at=boss human check)]

actuals:
  tokens: 19900
  tasks: 2
  commits: 4
plan_head_before: 518e5d1d3407fcb37b288a7f1f3917cc8d5664ff
plan_head_after: 038830feadcc26a749c9fb66e24f5185801836bd

tech-stack:
  added: []
  patterns:
    - "A multi-part boss is several enemy rows that share one model frame: every part stands on a common DECK_TOP height and is seated by its real bounding box, so lower detail levels (no bevel) stay flush"
    - "The biggest event is a chain of ceiling-strength shakes queued in update time, never a raised ceiling; a paused update (dt 0) delays the queue"
    - "A silhouette that has no 3D model (the boss shadow) is an alpha texture built once from a pure, unit-tested outline function, so a frame only moves one mesh"
    - "WARNING flash photosensitivity is asserted by reading the stylesheet text of index.html in a unit test"

key-files:
  created:
    - web/src/render/models/bomber.js
    - web/src/fx/boss_sweep.js
    - web/test/render/models/bomber.test.js
    - web/test/fx/boss_sweep.test.js
    - tools/e2e/boss.spec.js
  modified:
    - web/src/render/models/enemy_models.js
    - web/src/ui/banner_overlay.js
    - index.html
    - web/src/fx/explosion_fx.js
    - web/src/fx/light_pool.js
    - web/src/fx/decal_ring.js
    - web/src/fx/shake.js
    - web/src/fx/shadow_instances.js
    - web/src/main.js
    - web/test/render/models/enemy_models.test.js
    - web/test/ui/banner_overlay.test.js
    - web/test/fx/explosion_fx.test.js
    - web/test/fx/light_pool.test.js
    - web/test/fx/decal_ring.test.js
    - web/test/fx/shake.test.js
    - web/test/fx/shadow_instances.test.js

key-decisions:
  - "The WARNING flash is a soft opacity pulse (1 to 0.2 to 1) on a 0.5 s CSS animation (2 Hz), never a hard strobe; prefers-reduced-motion turns the animation off and the banner holds at full opacity"
  - "The banner resets its inline opacity to 1 for the WARNING (the intro fade leaves it at 0), and drops the warning class whenever it hides or returns to STAGE n"
  - "The sweep's silhouette is the bomber's own plan outline with an 8-unit soft edge, 1.15x the airframe, drawn at 50% opacity at terrain depth plus the sun offset, from playfieldH + 120 (FLOW_T 0) to -120 (FLOW_T 1); the nose points down the screen at the player"
  - "Bomber shadows use sizeScale 3 on top of the 1.5x radius rule, so BOMBER and BOMBER_OPEN shadows are 126 units wide, matching the 120-unit span (the plan's 'about 3x' read as the multiplier it names)"
  - "The boss HUGE light pulse peaks at 10 for 0.4 s (LARGE is 6 for 0.25 s); the flash budget (3 pulses per second) is unchanged"
  - "The shake chain is 4 x (3.0, 0.5 s) with 0.35 s update-time spacing, triggered through trigger() so every shake is still clamped by MAX_AMPLITUDE and MAX_DURATION_S; a second BOSS_DEFEATED restarts the queue instead of adding to it"
  - "An e2e-only fx getter bossSweepVisible was added to main.js so the spec can assert the shadow is up exactly during the WARNING"

patterns-established:
  - "New boss rows get a builder per kind and a row in enemy_models.js BUILDERS, with the roster test in enemy_models.test.js extended in the same commit"
  - "Part builders take their pivot at the row origin and their height from the shared deck, so the Python part offsets (+-46,6 and +-26,-2) need no model-side offsets"

requirements-completed: [ENMY-06, ENMY-07]

coverage:
  - id: D1
    description: "The boss entrance is a flashing red WARNING banner shown exactly while FLOW is WARNING, pulsing at 2 Hz (0.5 s period), never faster than 3 flashes per second, off under prefers-reduced-motion"
    requirement: ENMY-06
    verification:
      - kind: unit
        ref: "web/test/ui/banner_overlay.test.js#the WARNING flash in index.html (photosensitivity)"
        status: pass
      - kind: unit
        ref: "web/test/ui/banner_overlay.test.js#the boss WARNING"
        status: pass
      - kind: e2e
        ref: "tools/e2e/boss.spec.js#a flashing WARNING comes first, then the bomber fight, and the kill brings the CLEAR state"
        status: pass
    human_judgment: false
  - id: D2
    description: "The bomber's shadow sweeps over the city from the bottom to the top of the playfield during the WARNING, driven by FLOW_T, visible only in that state, at terrain depth with renderOrder 3, then hidden when the bomber descends"
    requirement: ENMY-06
    verification:
      - kind: unit
        ref: "web/test/fx/boss_sweep.test.js"
        status: pass
      - kind: e2e
        ref: "tools/e2e/boss.spec.js (fx.bossSweepVisible true in the WARNING, false in the BOSS state)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The giant bomber is built in code: a 120-unit gunmetal flying wing with red neon, wing turrets whose guns track the player, glowing engine pods, a charred stump, and an open core with a bright magenta-white glow (BOMBER_OPEN); body colours below 1.0, no orange-yellow, shadow sized to the airframe"
    requirement: ENMY-07
    verification:
      - kind: unit
        ref: "web/test/render/models/bomber.test.js"
        status: pass
      - kind: unit
        ref: "web/test/render/models/enemy_models.test.js#the giant bomber"
        status: pass
      - kind: unit
        ref: "web/test/fx/shadow_instances.test.js#sizes a kind by its sizeScale on top of the radius, so the bomber shadow matches its airframe"
        status: pass
      - kind: unit
        ref: "web/test/fx/palette.test.js#colour scan"
        status: pass
    human_judgment: false
  - id: D4
    description: "The boss kill is the biggest event in the game: a HUGE explosion (core 46-80 against LARGE's 26-44, 199 particles against 75, cyan sparks, magenta embers, a white ring of 24), the strongest light pulse, and a chain of four ceiling-strength shakes over about 1.5 s, all within the 3.0 / 0.5 s comfort ceilings"
    requirement: ENMY-07
    verification:
      - kind: unit
        ref: "web/test/fx/explosion_fx.test.js#the HUGE boss explosion (D-14)"
        status: pass
      - kind: unit
        ref: "web/test/fx/light_pool.test.js#flashes a HUGE explosion harder and longer than any other class (D-14)"
        status: pass
      - kind: unit
        ref: "web/test/fx/shake.test.js#chains four ceiling-strength shakes over about 1.5 s, three more at 0.35 s intervals"
        status: pass
      - kind: e2e
        ref: "tools/e2e/boss.spec.js (fx.shakes rises by at least 4 after the kill, a light flashed)"
        status: pass
    human_judgment: false
  - id: D5
    description: "How the boss moment looks and feels: the WARNING cadence, the size and darkness of the sweeping shadow, the bomber's silhouette and opening core, and whether the death reads as clearly bigger and longer than a bomb"
    verification: []
    human_judgment: true
    rationale: "Visual impact, pacing and comfort are felt, not asserted; the plan's own human-check is for the end-of-phase review with ?debug&at=boss&weapon=laser&level=5"

duration: 16min
completed: 2026-10-18
status: complete
---

# Phase 3 Plan 20: Bomber Models, WARNING Flash, Shadow Sweep and Boss Death Summary

**The boss moment is drawn: a red neon WARNING banner pulsing at 2 Hz while the bomber's soft shadow sweeps the city from bottom to top, a code-built 120-unit flying-wing bomber with tracking turrets, engine pods, stumps and a glowing open core, and a boss death of a HUGE explosion, the strongest light pulse and four chained ceiling-strength shakes.**

## Performance

- **Duration:** about 16 min (start time not recorded programmatically; estimated from the previous plan's completion)
- **Started:** about 2026-10-18T19:51:00Z
- **Completed:** 2026-10-18T20:08:00Z
- **Tasks:** 2 (a tracer and an auto task, both TDD)
- **Files modified:** 21 (11 source, 10 test); 1473 insertions, 46 deletions

## Accomplishments

- `bomber.js` builds the five bomber models at three detail levels: a flying wing with swept leading edges, a saw-tooth tail, wing-tip fins and red neon along the edges; the closed airframe carries an armour dome and `buildBomberOpen` swaps it for a collar ring, two hinged-open plates, a red ring and a bright magenta-white core. The wing turret has a tracking `top` with twin barrels, the engine pod a faired nacelle with a red exhaust, and the stump is a charred plate with a broken pedestal and dim embers. All parts stand on one deck height, so the Python offsets (+-46, 6 and +-26, -2) land on the wing.
- The banner shows `WARNING` with the `warning` class while FLOW is WARNING; `#banner.warning` is red neon with a 0.5 s opacity pulse and no animation under `prefers-reduced-motion`. A unit test reads `index.html` and asserts the period is at least 0.34 s.
- `createBossSweep` moves one dark, soft wing silhouette (an alpha texture built once) from below the playfield (FLOW_T 0) to above it (FLOW_T 1), visible only during the WARNING, at terrain depth with the air shadows' render order and sun offset; `main.js` creates it before the second prewarm and updates it every frame. Bomber shadows are three times the usual size, matching the airframe.
- `RECIPES.HUGE`, a 10-intensity 0.4 s light pulse and a 40-unit ground scorch make the boss end the largest blast; `BOSS_DEFEATED` queues four ceiling-strength shakes 0.35 s apart.
- `make test-web` (70 files, 1544 tests) and `make build` pass; the e2e specs boss, midboss, bomb, death, tier, stage, glow, boot and smoke all pass; `make lint` passes. No Python changed.

## Task Commits

1. **Task 1 (tracer): at ?at=boss a flashing WARNING precedes the giant bomber, and killing it brings the CLEAR state**
   - RED `1e44f10` (test): bomber models, banner WARNING and the stylesheet flash rate
   - GREEN `ef2f1dc` (feat): bomber.js, registry, banner state, CSS, boss.spec.js
2. **Task 2: the shadow sweeps the city; the death is the biggest explosion, light and shake chain**
   - RED `7e68dfc` (test): sweep, HUGE recipe, light, scorch, shake chain, shadow scale
   - GREEN `038830f` (feat): boss_sweep.js, HUGE, SHAKE_BOSS chain, sizeScale, main.js wiring, e2e shake assertion

**Plan metadata:** the docs commit that adds this SUMMARY, STATE.md, ROADMAP.md and REQUIREMENTS.md.

Tracer feedback gate: the tracer's `<verify>` is automated-only, so `make test-web`, `make build` and `boss.spec.js` plus `midboss.spec.js` were re-run after Task 1 (all green) before expanding.

## Files Created/Modified

See `key-files` above. Notable: `web/src/render/models/bomber.js` (five builders), `web/src/fx/boss_sweep.js` (sweep and `silhouetteAlpha`), `web/src/fx/shake.js` (`SHAKE_BOSS`, chain queue), `index.html` (`#banner.warning`), `tools/e2e/boss.spec.js` (WARNING, sweep, fight, kill, shakes, CLEAR).

## Decisions Made

See `key-decisions` above. The ones later plans must know: the WARNING banner and sweep key off FLOW and FLOW_T only (03-21 can add STAGE CLEAR to the same banner by adding a FLOW branch); the boss shake chain is queued inside `createShake`, so any other presenter that wants "the big one" should fire `BOSS_DEFEATED` rather than call `trigger` four times; `sizeScale` is the general hook for any other air kind whose model is far wider than its collider.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Banner left a stale `warning` class and a faded inline opacity**
- **Found during:** Task 1 (GREEN, banner tests)
- **Issue:** the first banner implementation set the class only when showing, so hiding after the WARNING left `warning` on the element, and the intro fade's inline `opacity: 0` would hide the WARNING under reduced motion (animation off) because the inline value beats the stylesheet.
- **Fix:** the hidden branch clears the class, and the WARNING writes opacity `1` explicitly.
- **Files modified:** web/src/ui/banner_overlay.js
- **Verification:** `banner_overlay.test.js` (hides and drops the class, full opacity after a faded intro)
- **Committed in:** ef2f1dc

**2. [Rule 3 - Blocking] A merge slip broke `explosion_fx.js` while adding the HUGE recipe**
- **Found during:** Task 2 (GREEN)
- **Issue:** my scripted edit swallowed the `export const RECIPES = Object.freeze({` line into a comment, a syntax error caught at once by vitest.
- **Fix:** restored the declaration. `WHITE_RING` had to move above `RECIPES` (it is a `const`, used by the HUGE recipe) and `PLAYER_HIT_RECIPE` still uses it.
- **Files modified:** web/src/fx/explosion_fx.js
- **Verification:** `web/test/fx` 305 tests pass
- **Committed in:** 038830f

**3. [Rule 2 - Missing critical] An e2e hook to assert the sweep, and a test-only precision fix**
- **Found during:** Task 2
- **Issue:** the plan's e2e could not tell whether the boss shadow was ever shown. Separately, a light-pool test stepped a Float32 age to the exact end of the pulse and read 7e-7.
- **Fix:** added the `fx.bossSweepVisible` debug getter in `main.js` (same pattern as `beamVisible`) and made the light test step past the end instead of to it.
- **Files modified:** web/src/main.js, web/test/fx/light_pool.test.js, tools/e2e/boss.spec.js
- **Committed in:** 038830f

---

**Total deviations:** 3 auto-fixed (1 bug, 1 blocking, 1 missing critical)
**Impact on plan:** all within the plan's file list (light_pool.test.js is listed; `main.js` and `boss.spec.js` are listed for both tasks); no scope creep.

## Issues Encountered

- **Unexpected greens.** After the Task 1 RED run, 15 tests failed (missing module and missing banner behaviour); the Task 2 RED run showed 15 failures and one test (the sizeScale-ignored-for-ground-kind case) that already passed because the option did not exist yet; it asserts behaviour that must stay true.
- **bomber.js sits on one flat deck.** The turrets, engines and stumps all seat on `DECK_TOP`. If 03-28 moves the Python part offsets (the engine reach issue noted in 03-19), the models need only the offsets changed in `stage_1_bosses.py`; the wing is wide enough at the current offsets and a test pins that the wing exists under all four positions.
- **Silhouette is the bomber's plan, duplicated.** `boss_sweep.js` repeats the wing outline numbers from `bomber.js` rather than importing the model (the sweep is a presentation of the plan, not of a built geometry); if the wing outline changes, change both. A test pins the sweep's span to about 120 units.
- The pre-commit HEAD assertion would normally refuse commits on `main`; the orchestrator pinned sequential mode on main and `git.allow_default_branch_commits` is true, as in the earlier plans.
- Not checked visually: no human looked at the bomber, the sweep or the death in a real browser in this run (software GL in the e2e). The plan routes that to the end-of-phase human check.

## Known Stubs

None.

## Threat Flags

None. T-03-25 is mitigated: `RECIPES.HUGE` counts scale with `particleScale` (test: `scales the counts with the tier but never the sizes`) and both particle layers keep their fixed ring capacities (2048 additive, 1024 normal; HUGE emits 135 additive and 64 normal at full quality). T-03-SC: no new packages, lockfiles unchanged. The two prohibitions are tested: no flash above 3 per second (`the WARNING flash in index.html`) and no shake above 3.0 / 0.5 s (`chains four ceiling-strength shakes`, every chain shake passes through `trigger()`'s clamps).

## TDD Gate Compliance

Both tasks have a `test(03-20)` commit before their `feat(03-20)` commit (1e44f10 then ef2f1dc, 7e68dfc then 038830f); no refactor commits were needed. The plan type is `execute` (task-level `tdd="true"`), so the RED runs were not passed through `gsd check tdd-red-evidence`. Semantic assessment of the RED evidence: Task 1's bomber test file failed at import (`Cannot find module .../bomber.js`, the intended failure for a tracer that introduces that module), and the registry and banner tests failed on the planned assertions (`hasModel('BOMBER')` false, `warms the five names` got `[]`, banner hidden instead of `WARNING`, no `#banner.warning` rule in `index.html`). Task 2's tests ran and failed on the planned assertions (missing `HUGE` recipe and `SHAKE_BOSS`, a shake count of 1 instead of 4, no `sizeScale`) except `boss_sweep.test.js`, which failed at import.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 03-21: the CLEAR state is reachable and drawn (boss.spec.js asserts it); the banner can take a STAGE CLEAR branch beside WARNING without new plumbing.
- For 03-28: tune with `?debug&at=boss&weapon=laser&level=5`: the WARNING cadence and shadow darkness (`MAX_ALPHA` in boss_sweep.js), the HUGE size and light peak, and the chain spacing; the human check from the plan is still pending.

## Self-Check: PASSED

Created files exist (bomber.js, boss_sweep.js, bomber.test.js, boss_sweep.test.js, boss.spec.js); commits 1e44f10, ef2f1dc, 7e68dfc and 038830f are ancestors of HEAD; `make test-web` (1544 passed), `make build`, `make lint` and the e2e specs boss, midboss, bomb, death, tier, stage, glow, boot and smoke pass; the acceptance greps (`BOMBER_OPEN` in enemy_models.js, `WARNING` in banner_overlay.js, `createBossSweep` in boss_sweep.js and main.js, `SHAKE_BOSS` in shake.js, `HUGE` in explosion_fx.js) match.

---
*Phase: 03-stage-1-vertical-slice*
*Completed: 2026-10-18*
