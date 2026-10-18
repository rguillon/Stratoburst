---
phase: 02-arcade-shooting-feel
plan: 24
subsystem: rendering
tags: [pickups, crystals, instanced-mesh, sparkle, max-flash, dom-overlay, e2e]

requires:
  - phase: 02-arcade-shooting-feel
    provides: "pickups channel (stride 4: x, y, colour index, kind; cap 16), header PICKUP_N, EV_PICKUP payload (kind, outcome, colour index), manifest pickup_kinds and outcomes (02-10); createStatusReadout and #status-readout (02-11); model_kit lathe/bake/tint (02-06); PALETTE CRYSTAL_RED/BLUE/PURPLE and BOMB_PICKUP (02-17); the fx dispatcher and missile prewarm pattern (02-23)"
provides:
  - "createPickupInstances: one InstancedMesh of a smooth six-sided gem that spins and bobs 2 units above the plane, HDR instance colour from the colour index Python packs (red, blue, purple; BOMB_PICKUP for the bomb kind)"
  - "PICKUP_RECIPE in explosion_fx: 10 additive sparkles, life 0.3 s, flying outward on the plane in the caught colour, scaled by the tier"
  - "createStatusReadout handle(type, x, y, a, b, c) and tick(nowMs): the #max-flash overlay for the MAXED outcome, 900 ms with a 400 ms fade, deadline restarted by a repeat catch"
  - "index.html #max-flash static markup, big warm amber glow in the upper third, pointer-events none"
  - "main.js wiring: pickups.update(header[PICKUP_N], fxTime), fx.add(readout), readout.tick(ts); debug hook fx.pickupsDrawn"
affects: [02-25 recovery drops, 02-26 bomb pickup and visuals, 02-33 phone perf measurement, phase 3 scoring (MAX_BONUS), phase 2 verification]

actuals:
  tokens: 9500
  tasks: 2
  commits: 3
plan_head_before: 4c3f01388abc21da47af26c70ac18303a34fd1b6
plan_head_after: dc1515a94172b4db91c822bcc99815c29edfa3ed
commits: 3

tech-stack:
  added: []
  patterns:
    - "A flash with no clock of its own: the event handler only arms it and the first frame tick after the catch sets the deadline, so presentation timing follows the frame clock and is testable without a time source"
    - "Recipe colour override: a burst can take its colour from the event payload instead of the recipe, so one recipe serves every pickup colour"
    - "Instance colours allocated at creation (setColorAt before the first prewarm) so the shader variant never changes when the first real instance is written"

key-files:
  created:
    - web/src/render/pickup_instances.js
    - web/test/render/pickup_instances.test.js
  modified:
    - web/src/fx/explosion_fx.js
    - web/test/fx/explosion_fx.test.js
    - web/src/ui/status_readout.js
    - web/test/ui/status_readout.test.js
    - index.html
    - web/src/main.js
    - tools/e2e/weapons.spec.js

key-decisions:
  - "The gem is a six-sided lathe double point (3.6 half height, 2.2 half width) baked white, tinted per instance by an HDR instance colour; spin 2.6 rad/s, bob 4 rad/s by 0.9 units around a lift of 2, and neighbouring instances are offset by 1.7 rad so they never move in lock step"
  - "A colour index outside the cycle is drawn red (gem and sparkle alike) instead of not at all; the packed index is Python's, so this only shows a protocol fault, and the fallback is pinned by tests"
  - "createStatusReadout now requires events, maxed and the #max-flash element and throws loudly without them; the MAX flash text is static markup, so nothing is ever written to it and innerHTML never appears"
  - "The sparkle fires for every outcome (raised, switched, maxed, stocked); only the MAXED outcome adds the big flash, and the score value stays with Phase 3 (Python records max_bonus)"

patterns-established:
  - "Overlay elements that must exist are looked up at creation and fail loudly, like #status-readout"

requirements-completed: [PLYR-04, PLYR-05]

coverage:
  - id: D1
    description: "Crystals are drawn as smooth glowing gems that spin and bob, coloured by the colour index Python packs (red, blue, purple, bomb colour for the bomb kind); count clamped to capacity and buffers reused every frame"
    requirement: PLYR-04
    verification:
      - kind: unit
        ref: "web/test/render/pickup_instances.test.js#createPickupInstances"
        status: pass
    human_judgment: false
  - id: D2
    description: "A carrier shot down in the live build drops a crystal that is drawn (PICKUP_N and fx.pickupsDrawn both reach 1)"
    requirement: PLYR-04
    verification:
      - kind: e2e
        ref: "tools/e2e/weapons.spec.js#a carrier shot down drops a crystal that is drawn"
        status: pass
    human_judgment: false
  - id: D3
    description: "Catching a pickup throws 10 sparkles in the caught colour on the additive layer, 0.3 s life, tier-scaled, BOMB_PICKUP for the bomb kind"
    requirement: PLYR-04
    verification:
      - kind: unit
        ref: "web/test/fx/explosion_fx.test.js#the PICKUP sparkle"
        status: pass
    human_judgment: false
  - id: D4
    description: "A MAXED catch shows #max-flash for 900 ms with a fade, a repeat extends it, RAISED/SWITCHED/STOCKED show nothing, no innerHTML, markup present and hidden at start"
    requirement: PLYR-05
    verification:
      - kind: unit
        ref: "web/test/ui/status_readout.test.js#the MAX flash"
        status: pass
      - kind: e2e
        ref: "tools/e2e/weapons.spec.js#without flags the readout shows VULCAN Lv 1"
        status: pass
      - kind: other
        ref: "grep -n innerHTML web/src/ui/status_readout.js prints nothing; grep -n 'id=\"max-flash\"' index.html matches"
        status: pass
    human_judgment: false
  - id: D5
    description: "The crystals read as glowing gems cycling red, blue and purple, the sparkle looks right, and the MAX flash is large, warm (not pink) and fades cleanly on screen"
    requirement: PLYR-05
    verification: []
    human_judgment: true
    rationale: "Glow, spin and bob readability, colour distinctness and the size and feel of the MAX flash are visual judgments; tests only prove the data, palette entries and DOM state"

duration: 14min
completed: 2026-10-18
status: complete
---

# Phase 2 Plan 24: Crystal Visuals, Catch Sparkle and the MAX Flash Summary

**Spinning, bobbing HDR gems coloured by Python's packed colour index, a tier-scaled sparkle in the caught colour on every catch, and a 900 ms fading MAX flash in the status readout for a fifth same-colour crystal**

## Performance

- **Duration:** 14 min
- **Started:** 2026-10-18T06:16:00Z
- **Completed:** 2026-10-18T06:31:00Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Crystals are visible: `createPickupInstances` draws one InstancedMesh of a smooth baked gem lifted 2 units above the plane, spinning and bobbing with the effect clock, coloured per instance by the colour index Python packs (red 0, blue 1, purple 2; the bomb kind takes `BOMB_PICKUP`). JS never recomputes the cycle, so the drawn colour is the colour the catch decides (D-16). `update` uses module-level scratch objects and instance colours are allocated at creation, so the shader compiles in the second prewarm (drawn once at count 1, then hidden).
- A carrier shot down in the live build drops a visible crystal (D-19): the new e2e case holds fire and sweeps until `PICKUP_N >= 1` and `fx.pickupsDrawn >= 1`, with no error panel.
- Catching any pickup throws a ten-sparkle ring in the caught colour: `PICKUP_RECIPE` on the additive layer, life 0.3 s, flying outward flat on the plane, count scaled by the tier and never below one. The colour comes from the event's `c` (colour index at the catch), or `BOMB_PICKUP` for the bomb kind.
- A fifth same-colour crystal flashes MAX (D-06): `createStatusReadout` now returns `handle` and `tick`; a PICKUP event with the MAXED outcome unhides the static `#max-flash` markup, the first following frame tick sets a 900 ms deadline, the opacity fades over the last 400 ms, and a repeat catch restarts the deadline instead of stacking. Python still records `max_bonus` for Phase 3; nothing here assigns a score.
- `index.html` gains the `#max-flash` markup with `pointer-events: none`, a large amber (`#ffd27a`) glow in the upper third, nowhere near the reserved bullet pink.

## Task Commits

1. **Task 1: Tracer, a carrier shot down drops a glowing crystal that cycles red, blue and purple** - `880b9dd` (feat)
2. **Task 2 RED: failing tests for the PICKUP sparkle and the MAX flash** - `cda78fa` (test)
3. **Task 2 GREEN: sparkle on catches and the MAX flash** - `dc1515a` (feat)

**Plan metadata:** committed as the docs commit following this summary.

Task 1 is a `tracer` task whose `<verify>` is automated only (`npm test && npm run build && npx playwright test tools/e2e/weapons.spec.js`). Under the default `end-of-phase` mode it was re-run end to end (741 vitest tests, build, 7 weapons e2e cases) and passed before Task 2 started: tracer verified end-to-end, expanding.

Task 2 RED evidence: 13 of the new tests failed for the planned reasons (`readout.handle` / `readout.tick` not functions, `PICKUP_RECIPE` undefined) and the colour tests were given an explicit ten-sparkle length assertion first so they could not pass vacuously on an empty emission. GREEN then passed all 154 tests in `web/test/ui` and `web/test/fx`.

## Files Created/Modified

- `web/src/render/pickup_instances.js` - gem InstancedMesh, per-instance palette colour, spin and bob
- `web/test/render/pickup_instances.test.js` - 14 tests: colours per index and kind, fallback, placement, bob range, spin, desync, clamping, empty update, stable buffers
- `web/src/fx/explosion_fx.js` - `PICKUP_RECIPE`, `pickupKinds` option, colour override on `burst`
- `web/test/fx/explosion_fx.test.js` - sparkle count, life, outward flat motion, colour per index, bomb colour, fallback, tier scaling
- `web/src/ui/status_readout.js` - `events` / `maxed` options, `handle`, `tick`, `FLASH_MS`
- `web/test/ui/status_readout.test.js` - existing tests updated for the new options and markup, plus 9 MAX flash tests
- `index.html` - `#max-flash` CSS and markup
- `web/src/main.js` - pickups create/prewarm/update, `fx.add(readout)`, `readout.tick(ts)`, `fx.pickupsDrawn`
- `tools/e2e/weapons.spec.js` - carrier-drop case (90 s timeout) and a `#max-flash` present-and-hidden check

## Decisions Made

- The flash deadline is armed by the event and started by the next frame tick, so no clock is injected and the 900 ms follow the frame clock; the dispatch runs before `readout.tick(ts)` in the same frame, so the flash starts on the catch frame.
- The flash text is never written: static markup toggled with `hidden`, which is the T-02-29 mitigation (no innerHTML, sparkles through the fixed particle rings).
- The gem fallback colour for an out-of-range index is red in both the mesh and the sparkle, so a protocol fault is visible rather than invisible.

## Deviations from Plan

None - plan executed exactly as written. The e2e case for the MAX flash itself is a markup-present-and-hidden check rather than a live catch, because forcing a fifth same-colour catch in a browser run depends on the colour cycle timing; the behaviour is pinned by the readout unit tests and left to the end-of-phase human check below.

## Issues Encountered

None. The `needsUpdate` flags on three.js buffer attributes are write-only, so the unit tests assert on `version` increments instead.

## Known Stubs

None.

## Threat Flags

None. No network, auth or file-access surface was added; the flash is static markup, sparkles use the fixed-capacity particle rings, and no packages were added (lockfiles unchanged).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- PLYR-04 and PLYR-05 are on screen end to end for crystals; fixed-colour recovery drops (02-25) and the bomb pickup (02-26) already draw correctly through the same mesh (fixed kinds pack colour = kind, the bomb takes its own colour).
- Open human check (end-of-phase UAT): `npm run preview`, then `http://localhost:4173/?debug&weapon=vulcan&level=5`: shoot a carrier, watch its crystal cycle red, blue and purple, and catch it while red for a red sparkle and a big MAX flash that appears and fades; catch one while blue and the weapon switches to the laser at Lv5 with the readout following.
- Phone measurement of the added draw (one more instanced mesh, capacity 16) stays with plan 02-33.

## Self-Check: PASSED

- FOUND: web/src/render/pickup_instances.js
- FOUND: web/test/render/pickup_instances.test.js
- FOUND commits 880b9dd, cda78fa and dc1515a in `git log` (`git rev-list --count 4c3f013..HEAD` = 3)
- `make check` (lint, 760 vitest tests, build, 57 Playwright tests) passed before this commit; `grep -n innerHTML web/src/ui/status_readout.js` prints nothing and `grep -n 'id="max-flash"' index.html` matches.

---
*Phase: 02-arcade-shooting-feel*
*Completed: 2026-10-18*
