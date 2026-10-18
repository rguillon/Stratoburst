---
phase: 03-stage-1-vertical-slice
plan: 18
subsystem: bosses-render
tags: [mid-boss, armored-train, boss-bar, screen-shake, score-popups, stump-smoulder, three-js, vitest, playwright, tdd]

requires:
  - phase: 03-stage-1-vertical-slice
    provides: MIDBOSS_1 data, StageFlow-owned BossController, the boss header slots BOSS_ACTIVE / BOSS_PHASE / BOSS_HP / BOSS_TIMER_S, manifest stage.bosses and the PART_DESTROYED event (03-17); the enemy model registry and the ground layer (03-13, 03-16); the popup pool (03-11); the wreck smoulder (02-14)
provides:
  - buildTrain, buildTrainTurret and buildTrainStump, registered as TRAIN, TRAIN_TURRET and TRAIN_STUMP in the enemy model registry
  - createBossBar and the #boss-bar markup (fill, phase ticks, last-20-seconds timer), state-driven from the header every frame
  - SHAKE_PART (2.0, 0.35 s) and PART_DESTROYED popups carrying the part's points
  - createStumpFx / stumpKindsFor, a smoke and flame trickle from every live stump row for the rest of the fight
  - tools/e2e/midboss.spec.js, which plays the whole ?at=midboss fight in the browser
affects: [03-19 giant bomber (reuses the boss bar, part popups and part shake), 03-20 boss e2e, vertical-slice gate visual tuning]

actuals:
  tokens: 37096
  tasks: 2
  commits: 4
plan_head_before: 151b486f9b717842b3cf9e23a495820a380914e6
plan_head_after: b2cd69940d09b58621160e02c0c6476b2a53d8e7

tech-stack:
  added: []
  patterns:
    - "A boss bar is a pure function of the header: BOSS_ACTIVE shows and hides it, BOSS_HP scales the fill, BOSS_TIMER_S >= 0 shows the countdown; every DOM write is guarded by a cached last value"
    - "Per-effect clock instead of per-row state for a smoulder: one accumulator drives a round of puffs from every live row of a kind, reset while none exist so a new stump never bursts"
    - "Model parts built for a boss are three registry kinds sharing one coordinate frame (hull, gun car on the mount deck, stump on the same deck)"

key-files:
  created:
    - web/src/render/models/train.js
    - web/src/ui/boss_bar.js
    - web/src/fx/stump_fx.js
    - web/test/render/models/train.test.js
    - web/test/ui/boss_bar.test.js
    - web/test/fx/stump_fx.test.js
    - tools/e2e/midboss.spec.js
  modified:
    - web/src/render/models/enemy_models.js
    - web/src/fx/shake.js
    - web/src/ui/score_popups.js
    - web/src/main.js
    - index.html
    - web/test/render/models/enemy_models.test.js
    - web/test/fx/shake.test.js
    - web/test/fx/wreck_ring.test.js
    - web/test/ui/score_popups.test.js

key-decisions:
  - "The train stays at ground level and its guns are set wide (housing 5.6 wide, barrels at x +-4.4) because the elevated maglev deck (6 wide, about 20 units up) passes over the train's centre line and hid a narrow centred gun from the camera; the hull keeps its footprint aligned with the hit circle (D-21)"
  - "The hull model is 64 units nose to tail along +Z with mount decks at z +-22, so the two TRAIN_TURRET rows at dy -22 / +22 sit on it; the gun car and the stump share the deck height so a stump replaces a turret exactly"
  - "The stump ember is dim red with blue at or above green (1.9, 0.14, 0.2), keeping its hue on the crimson side of the enemy-bullet band"
  - "Stump smoulder has no flame window (the wreck's is 6 s) because the stump 'keeps smouldering for the rest of the fight'; it reads only the enemies channel and keeps one clock per effect, reset when no stump exists"
  - "The boss bar caches its last written values and writes nothing while BOSS_ACTIVE is 0; tick elements are built once per boss from manifest.stage.bosses with createElement, shown only for the active slot"
  - "BOSS_TIMER_S is shown as Math.ceil of the header value when it is 0 or more, so 20 shows '20', 1 shows '1' and -1 hides the readout"
  - "The train hull now leaves a charred wreck when it dies, because ENEMY_WRECK marks it 1 and it finally has a model; the gun cars and stumps still leave none"

patterns-established:
  - "A shake is data: add a frozen { amplitude, durationS } constant and one handle() arm; the ceilings in trigger() apply to everything"

requirements-completed: [ENMY-06, ENMY-07, ENMY-09, SCOR-08]

coverage:
  - id: D1
    description: "The armored train is drawn: a long gunmetal hull with red neon, two tracking gun cars on its mount decks and a charred stump kind, all built in code at three detail levels and warmed at load"
    requirement: ENMY-06
    verification:
      - kind: unit
        ref: "web/test/render/models/train.test.js"
        status: pass
      - kind: unit
        ref: "web/test/render/models/enemy_models.test.js#the mid-boss train"
        status: pass
      - kind: e2e
        ref: "tools/e2e/midboss.spec.js"
        status: pass
    human_judgment: false
  - id: D2
    description: "A thin boss HP bar appears while a boss is active, its fill follows BOSS_HP, it carries a tick at each phase threshold from manifest stage.bosses, and a timeout readout shows only when BOSS_TIMER_S is 0 or more"
    requirement: ENMY-09
    verification:
      - kind: unit
        ref: "web/test/ui/boss_bar.test.js"
        status: pass
      - kind: e2e
        ref: "tools/e2e/midboss.spec.js"
        status: pass
    human_judgment: false
  - id: D3
    description: "Shooting off a part shakes the screen within the comfort ceilings and pops its points where it was"
    requirement: ENMY-07
    verification:
      - kind: unit
        ref: "web/test/fx/shake.test.js#triggers the part shake on PART_DESTROYED, which carries its points, and counts it"
        status: pass
      - kind: unit
        ref: "web/test/ui/score_popups.test.js#shows a destroyed boss part as a popup with its points at the part position"
        status: pass
      - kind: e2e
        ref: "tools/e2e/midboss.spec.js"
        status: pass
    human_judgment: false
  - id: D4
    description: "A shot-off turret leaves a stump that smokes and burns for the rest of the fight, scaled by tier, clamped per frame and silent while paused"
    requirement: SCOR-08
    verification:
      - kind: unit
        ref: "web/test/fx/stump_fx.test.js"
        status: pass
      - kind: e2e
        ref: "tools/e2e/midboss.spec.js"
        status: pass
    human_judgment: false
  - id: D5
    description: "How the train reads on screen: dark gunmetal on a busy neon city under the glowing maglev deck, the turret guns against it, the size and strength of the part shake and the stump smoke"
    verification: []
    human_judgment: true
    rationale: "Readability, taste and feel cannot be asserted by tests; the author should look at ?at=midboss at the vertical-slice gate"

duration: 29min
completed: 2026-10-18
status: complete
---

# Phase 3 Plan 18: Train Models, Boss HP Bar and Part Feedback Summary

**The mid-boss is now visible: an armored maglev train (long gunmetal hull, red neon, tracking twin-barrel gun cars, burnt stumps), a state-driven magenta boss HP bar with phase ticks and a last-20-seconds countdown, and a medium shake plus a points popup plus a smouldering stump every time a turret is shot off.**

## Performance

- **Duration:** 29 min
- **Started:** 2026-10-18T19:09:01Z
- **Completed:** 2026-10-18T19:38:00Z
- **Tasks:** 2 (a tracer and an auto task, both TDD)
- **Files modified:** 16 (3 new source modules, 3 new unit test modules, 1 new e2e spec, 9 changed)

## Accomplishments

- `train.js` builds the hull (about 64 units along +Z, beveled gunmetal plan with a roof car, two flat mount decks at z +-22, maglev skids, red neon along the flanks and top edges and across the car joints, a red nose beacon and tail embers), the gun car (octagonal plate, lathe pedestal, red status lamp and neon, a pivot-centred twin-barrel `top` that follows the aim angle) and the stump (charred plate, broken pedestal, a torn-off barrel and dim red embers). All three are registered, tiered and warmed at load.
- `boss_bar.js` and `#boss-bar`: hidden while BOSS_ACTIVE is 0, shown for 1 or 2, fill = `scaleX(BOSS_HP)` clamped, one cyan tick per phase threshold of the active boss built once from `manifest.stage.bosses`, a timer that appears only for BOSS_TIMER_S >= 0. It runs from the header every frame, so a missed event cannot leave it stuck, and writes the DOM only on change.
- `SHAKE_PART` (2.0, 0.35 s) is a third big-event shake inside the Phase 2 ceilings (3.0, 0.5 s). `score_popups.js` pops the part's points through the same pool as medals.
- `stump_fx.js` reads the enemies channel and smokes and burns from every live stump row at a rate scaled by the tier, with the frame time clamped to 0.25 s and nothing while paused or in hitstop. `main.js` creates it after the particle layers and runs it on the effect-clock delta.
- `midboss.spec.js` plays the fight from `?at=midboss` with a Lv5 laser: bar visible with one tick, hull HP falls, a "5000" popup appears, `fx.shakes` and `fx.popupsShown` rise, stump puffs start, BOSS_ACTIVE returns to 0, the bar hides and no error panel appears.
- `make test-web`: 1419 vitest tests pass (68 files). `make build` succeeds. Playwright: midboss, city, bomb and death specs all pass. `make lint` passes (no Python changed).

## Task Commits

1. **Task 1 (tracer): the armored train rolls in with its HP bar, and the bar drains and disappears with the kill**
   - RED `5be1ead` (test): train, boss bar and registry tests plus the first midboss e2e
   - GREEN `043b43c` (feat): train.js, boss_bar.js, registry entries, #boss-bar markup, main.js wiring
2. **Task 2: shooting off a turret shakes the screen, pops its points and leaves a burning stump**
   - RED `8bf3d8b` (test): stump_fx, shake and popup tests; the e2e gains shake, popup and stump assertions
   - GREEN `b2cd699` (feat): SHAKE_PART, PART_DESTROYED popups, stump_fx.js, main.js wiring and the `fx.stumpPuffs` hook

**Plan metadata:** the docs commit that adds this SUMMARY, STATE.md, ROADMAP.md and REQUIREMENTS.md.

Tracer feedback gate: the tracer's `<verify>` is automated-only; after Task 1 `make test-web`, `make build` and `npx playwright test tools/e2e/midboss.spec.js tools/e2e/city.spec.js` were re-run green, so the tracer was verified end-to-end before expanding (`Tracer verified end-to-end - expanding`).

## Files Created/Modified

- `web/src/render/models/train.js` - hull, gun car and stump builders
- `web/src/render/models/enemy_models.js` - registers TRAIN, TRAIN_TURRET, TRAIN_STUMP
- `web/src/ui/boss_bar.js` - `createBossBar({ doc, bosses })`
- `web/src/fx/stump_fx.js` - `createStumpFx`, `stumpKindsFor`
- `web/src/fx/shake.js` - `SHAKE_PART` and the PART_DESTROYED arm
- `web/src/ui/score_popups.js` - PART_DESTROYED popups
- `web/src/main.js` - boss bar, stump fx, debug hook `fx.stumpPuffs`
- `index.html` - `#boss-bar` markup and styles
- `tools/e2e/midboss.spec.js` - the mid-boss fight in the browser
- tests mirror each module under `web/test/`; `wreck_ring.test.js` was updated for the train hull's new wreck

## Decisions Made

See `key-decisions` above. The two later plans should know: plan 03-19's bomber reuses `createBossBar` (set `StageData.boss` and the bar's second tick group appears from the manifest), the PART_DESTROYED shake and popup unchanged, and `stumpKindsFor` picks up any new `*_STUMP` kind from the manifest by name.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] wreck_ring tests assumed the train had no model**
- **Found during:** Task 1 (full `make test-web` after registering the train kinds)
- **Issue:** `wreckKindsFor` tests used the real `hasModel` and expected TRAIN to be absent because it had no model yet. With a model and `enemy_wreck[TRAIN] = 1` the hull now (correctly) leaves a charred wreck when it dies, while gun cars and stumps still do not.
- **Fix:** The data-driven tests now expect TRAIN in the wreck kinds, prove the "no model, no hull" rule with an explicit stand-in `hasModel`, and add a test that gun cars and stumps never get a second wreck.
- **Files modified:** web/test/fx/wreck_ring.test.js
- **Verification:** `make test-web` green
- **Committed in:** 043b43c

**2. [Rule 3 - Blocking] midboss e2e waits too tight when other specs run beside it**
- **Found during:** Task 2 verify (`midboss + bomb + death` with two Playwright workers under software GL)
- **Issue:** The 30 s wait for BOSS_ACTIVE (and the 5 s per-key steering wait) timed out once under contention; the same spec passes alone in about 50 s.
- **Fix:** BOSS_ACTIVE wait 30 s to 60 s, steering wait 5 s to 15 s, test timeout 180 s to 240 s. They are upper bounds only, so a healthy run is not slower.
- **Files modified:** tools/e2e/midboss.spec.js
- **Verification:** the plan's full Task 2 verify command passes (15 tests)
- **Committed in:** b2cd699

### Additions beyond the file list (no behaviour change to existing code)

- `fx.stumpPuffs` debug hook and a `stumpKindsFor` helper (both small, tested), so the e2e can assert the smoulder started and the stump kinds come from manifest names as the plan specifies.
- A nose beacon, tail embers and car-joint strips on the hull, and a wider gun, added after looking at real screenshots (see Issues Encountered).

---

**Total deviations:** 2 auto-fixed (1 bug in a test assumption, 1 blocking e2e flake)
**Impact on plan:** Both necessary; no scope creep, no change to mid-boss data or hit rules.

## Issues Encountered

- **The elevated maglev deck passes over the train's centre line.** The maglev feature is a 6-wide deck about 20 units above the ground; the train rides at ground level (so its hull stays aligned with its hit circle, D-21), which means the deck sits between the camera and the middle 6 units of the train, hiding a narrow centred gun entirely. The gun housing and barrels were widened (barrels at x +-4.4) so the guns show beside the deck; the hull's red neon frames it clearly. Screenshots (real Chromium, high tier) show the neon outline, mount decks and plates reading well, but the dark gunmetal guns are low contrast against the busy city. Worth a look at the vertical-slice gate: options are lifting the train onto the deck (a few units of visual offset from its hit circle) or hiding the deck during the fight.
- **The aft turret is still shadowed from bolts and missiles by the hull** (03-17's open design decision). Nothing changed here: the plan said to draw what exists. The e2e uses the laser, which pierces both.
- A first combined Playwright run reported 11 failures right after a rebuild with a stale background preview server; reruns with a clean server passed everything. The only genuine problem was the midboss wait timing above.

## Known Stubs

None. Every new module is wired to live data (header slots, the events dispatcher and the enemies channel).

## Threat Flags

None. T-03-23 is mitigated as planned: the bar's text and every popup value are written through `textContent` from header and event integers, and the tick elements are built once with `createElement` from manifest numbers, never `innerHTML`. T-03-SC: no packages were added and no lockfile changed.

## TDD Gate Compliance

Both tasks have a `test(03-18)` commit before their `feat(03-18)` commit: Task 1 RED `5be1ead` then GREEN `043b43c`, Task 2 RED `8bf3d8b` then GREEN `b2cd699`. No refactor commits were needed. The plan type is `execute` (task-level `tdd="true"`), so the RED runs were not passed through `gsd check tdd-red-evidence`. Semantic assessment of the RED evidence: Task 1's `train.test.js` and `boss_bar.test.js` failed at import because `train.js` and `boss_bar.js` did not exist, and the new `enemy_models.test.js` cases failed on their registry assertions (`warmModels` returned `[]`, `hasModel('TRAIN')` false), the intended failure for modules this tracer introduces. Task 2's `stump_fx.test.js` failed at import for the same reason, and the 8 new shake and popup tests failed on their assertions (no SHAKE_PART export, PART_DESTROYED ignored), not on a syntax or fixture fault.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 03-19: the boss bar, part shake, part popups and stump smoulder are boss-agnostic; the bomber only needs its own models, WARNING and STAGE CLEAR banners and `StageData.boss`.
- For the vertical-slice gate: look at `?at=midboss` for train readability against the maglev deck, the guns' contrast and the part shake strength (SHAKE_PART is one constant in shake.js).

## Self-Check: PASSED

Created files exist on disk (train.js, boss_bar.js, stump_fx.js, the three new unit test modules, midboss.spec.js). Commits 5be1ead, 043b43c, 8bf3d8b and b2cd699 are ancestors of HEAD. `make test-web` (1419 passed), `make build` and `make lint` pass; the Playwright runs of midboss, city, bomb and death specs passed. The acceptance greps match: `TRAIN_TURRET` in enemy_models.js, `createBossBar` and `createStumpFx` in main.js, `id="boss-bar"` in index.html, `SHAKE_PART` in shake.js.

---
*Phase: 03-stage-1-vertical-slice*
*Completed: 2026-10-18*
