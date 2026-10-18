---
phase: 03-stage-1-vertical-slice
plan: 25
subsystem: rendering-atmosphere
tags: [rain, wet-streets, reflections, sign-flicker, fire-plumes, quality-tiers, three.js, instancing, vitest, playwright, tdd]

requires:
  - phase: 03-stage-1-vertical-slice
    provides: createCityLayer with per-kind body and glow InstancedMeshes, SIGN / TOWER / FIRE scenery and sceneryTint (03-13); GPU particle layers and the wreck / stump smoulder emitters (Phase 2, 03-18); TIERS and the main.js tier helpers (Phase 1-2, 03-02); the effect clock fxTime held through hitstop and pause (02-28)
provides:
  - web/src/render/rain_layer.js createRainLayer ({ mesh, setCount, update, count, capacity }) and RAIN_COLOR
  - TIERS.*.rain (600 / 300 / 0), TIERS.*.reflections (true / true / false), TIERS.*.plumes (true / true / false)
  - city_layer setReflections, REFLECTION_GAIN, deterministic sign flicker (placementUnit, flickerLevel, FLICKER_SHARE, FLICKER_DIM), firePositions / fireCount, update(scroll, timeS)
  - web/src/fx/fire_plumes.js createFirePlumes ({ update(positions, count, dtS), setEnabled, emitted })
  - main.js applyAtmosphere(tierName) at start and on every tier change; debug hooks fx.rainCount and fx.plumes
  - tools/e2e/atmosphere.spec.js (rain count per tier, plumes at high, nothing at low)
affects: [03-26 onward, 03-28 vertical-slice gate (end-of-phase device check re-measures the phone frame rate and retunes the tier counts, T-03-33)]

actuals:
  tokens: 11600
  tasks: 2
  commits: 6
plan_head_before: 3e195dd8d15d637b485f62a4e21a29ecc4627ea9
plan_head_after: 4009f13a668296f3f4a2469112a7e52d10335638

tech-stack:
  added: []
  patterns:
    - "Rain is pure GPU: a seed per streak written once, position derived in the vertex shader from uTime with a fract() wrap; the tier only sets instanceCount and visibility"
    - "A reflection mesh shares the glow's geometry (swapped with setDetail) and its instanceColor attribute, so it takes the neon hue and the flicker for free and adds one draw call per glowing kind"
    - "Effects that must compile at load but start hidden on a tier (reflections) are shown for the prewarm and set by the tier helper afterwards"
    - "Trickle emitters keep one accumulator per effect, clamp dt to 0.25 s, scale by particleScale and owe no time while disabled, frozen or with nothing to burn"

key-files:
  created:
    - web/src/render/rain_layer.js
    - web/test/render/rain_layer.test.js
    - web/src/fx/fire_plumes.js
    - web/test/fx/fire_plumes.test.js
    - tools/e2e/atmosphere.spec.js
  modified:
    - web/src/quality/tiers.js
    - web/test/quality/tiers.test.js
    - web/src/render/city_layer.js
    - web/test/render/city_layer.test.js
    - web/src/main.js
    - tools/e2e/medal.spec.js
    - .planning/phases/03-stage-1-vertical-slice/deferred-items.md

key-decisions:
  - "Which signs flicker is decided by an integer hash of the placement (x, distance, variant) below FLICKER_SHARE 0.15, not by the variant: a sign's variant is a 0-5 hue index, so 'variant below 0.15' would have meant only the cyan signs"
  - "Reflections are one extra InstancedMesh per glowing kind that lays the glow geometry flat on the road (quarter turn about x, flattened to 0.05) and stretches it along +z by half the building height, capped at 14, at gain 0.3"
  - "Plumes take an optional getDrift (the ground's world speed along +z) so puffs ride with the terrain; without it smoke would be left behind the ruin it came from"
  - "The rain quad is built in view space and drawn DoubleSide: its winding flips with the streak's direction, and FrontSide culled every streak"

patterns-established:
  - "Verify a GPU effect by looking at a screenshot, not only by a count hook: rainCount read 600 while nothing was drawn"

requirements-completed: [STGE-03]

coverage:
  - id: D1
    description: "GPU rain: one instanced streak mesh, position from a time uniform and a per-instance seed with a fract() wrap, additive, no per-frame JS beyond a uniform, drawn in the main scene before the bullet pass"
    requirement: STGE-03
    verification:
      - kind: unit
        ref: "web/test/render/rain_layer.test.js"
        status: pass
      - kind: e2e
        ref: "tools/e2e/atmosphere.spec.js#?tier=high draws 600 rain streaks on a stage boot"
        status: pass
    human_judgment: true
    rationale: "Whether the rain reads as rain and leaves orange-yellow enemy bullets standing out in the densest moments is a visual judgement (the plan's end-of-phase human-check on desktop and iPhone)"
  - id: D2
    description: "The atmosphere follows the tier: rain 600 / 300 / 0, reflections and plumes on for high and mid and off for low, counts and visibility only"
    requirement: STGE-03
    verification:
      - kind: unit
        ref: "web/test/quality/tiers.test.js#is the frozen ladder high / mid / low"
        status: pass
      - kind: e2e
        ref: "tools/e2e/atmosphere.spec.js (rain per tier, plumes at high, none at low)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Wet streets: dim additive flattened mirrors of every glow lie on the road, gain at most 0.35, one draw call per glowing kind, off on the low tier"
    requirement: STGE-03
    verification:
      - kind: unit
        ref: "web/test/render/city_layer.test.js#reflections"
        status: pass
    human_judgment: true
    rationale: "Reflection placement and brightness are a look; checked once on a boosted-gain screenshot to confirm they land on the road in front of the buildings, final gain is judged at the device check"
  - id: D4
    description: "Some neon signs flicker deterministically from the effect clock; towers and the other signs are steady; the clock holding holds the flicker"
    requirement: STGE-03
    verification:
      - kind: unit
        ref: "web/test/render/city_layer.test.js#sign flicker in the city layer"
        status: pass
    human_judgment: false
  - id: D5
    description: "Burning ruins send up fire and smoke plumes through the existing particle layers, tier-scaled, clamped, silent when disabled or frozen; no particle simulated in Python"
    requirement: STGE-03
    verification:
      - kind: unit
        ref: "web/test/fx/fire_plumes.test.js"
        status: pass
      - kind: e2e
        ref: "tools/e2e/atmosphere.spec.js#?tier=high: burning ruins send up plumes within 20 s of a stage boot"
        status: pass
    human_judgment: false

duration: 32min
completed: 2026-10-18
status: complete
---

# Phase 3 Plan 25: Rain-Soaked Neon Atmosphere Summary

**GPU rain (one instanced streak draw driven by a time uniform and fract() wrap), wet-street reflections and deterministic sign flicker in the city layer, and fire/smoke plumes over burning ruins, all scaled by the quality tier (rain 600 / 300 / 0; reflections and plumes off on low)**

## Performance

- **Duration:** 32 min
- **Started:** 2026-10-18T20:39:00Z
- **Completed:** 2026-10-18T21:11:00Z
- **Tasks:** 2 (a tracer and an auto task, both TDD)
- **Files modified:** 12 (5 source, 5 test and spec files created or extended, medal spec, deferred items)

## Accomplishments

- Rain falls over the city at high (600 streaks) and mid (300) and is hidden at low; `update` writes one uniform, `setCount` only changes the drawn instance count, and the shader compiles with the second prewarm so a tier change never compiles.
- The wet streets mirror the neon: one dim (gain 0.3), additive, flattened and road-stretched reflection mesh per glowing kind, sharing the glow's instance colour; visible only on high and mid.
- About 15% of signs flicker (on, then a stutter of off and on) from the effect clock, so the flicker holds in hitstop and pause and is identical on every run.
- Burning ruins send up flames (PALETTE.FIRE) and smoke (PALETTE.SMOKE) through the existing GPU particle layers, riding the ground's speed, throttled and clamped like the wreck and stump smoulders.
- `atmosphere.spec.js` proves the tier contract end to end: rain count 600 / 300 / 0, plumes above 0 within 20 s at high, none at low. Full suite: vitest 1642 tests green, 98 of 100 Playwright specs green in a loaded run (the 2 failures are timing races, see Issues).

## Task Commits

1. **Task 1: Tracer, GPU rain at high and mid tier, stops at low**
   - RED `01b91b2` (test): rain_layer behaviour tests and the tier ladder with rain / reflections / plumes
   - GREEN `df0374a` (feat): rain_layer.js, tiers, main.js wiring, atmosphere e2e
   - FIX `17e667f` (fix): streaks drawn double-sided (see deviations)
   - Tracer gate: the tracer's automated `<verify>` (make test-web, make build, atmosphere + glow + tier specs) passed end to end, so expansion continued.
2. **Task 2: Reflections, sign flicker, plumes**
   - RED `fa647fa` (test): reflections, flicker, visible-fire buffer, fire plumes
   - GREEN `4c379a4` (feat): city_layer, fire_plumes, main.js, atmosphere e2e plume tests
3. **Spec robustness** `4009f13` (test): medal spec waits widened, intro race logged

**Plan metadata:** the docs commit following this file.

## RED evidence

Both RED commits were run with `npx vitest run`: the tier ladder test and 18 city_layer tests failed on assertions for the planned behaviour (`setReflections is not a function`, missing `rain` / `reflections` / `plumes` keys, `placementUnit is not a function`, empty fire buffer). `rain_layer.test.js` and `fire_plumes.test.js` failed to load because their modules did not exist yet (an import failure, the JS norm for a brand-new module, not a semantic RED on its own); each file's behaviour is covered by the assertion-level REDs above in the same commit and by the GREEN run. Semantic assessment: the failing targets named in the commits are the planned behaviours, nothing failed from a fixture or syntax fault.

## Files Created/Modified

- `web/src/render/rain_layer.js` - instanced rain streaks, shader-driven, `setCount` / `update` / `count`
- `web/src/fx/fire_plumes.js` - flame and smoke trickle per visible fire with tier scale, dt clamp, drift
- `web/src/render/city_layer.js` - reflection meshes, `setReflections`, sign flicker, visible-fire buffer, `update(scroll, timeS)`
- `web/src/quality/tiers.js` - `rain`, `reflections`, `plumes` per tier, documented in the header
- `web/src/main.js` - rain and plumes creation, `applyAtmosphere`, reflections shown for the prewarm, `fx.rainCount` and `fx.plumes` hooks, `city.update(scrollNow, fxTime)`
- `tools/e2e/atmosphere.spec.js` - rain per tier, plumes at high, nothing at low
- `tools/e2e/medal.spec.js` - widened waits (popup 100 s, test 160 s)
- `web/test/render/rain_layer.test.js`, `web/test/fx/fire_plumes.test.js`, `web/test/render/city_layer.test.js`, `web/test/quality/tiers.test.js` - mirrored tests

## Decisions Made

See key-decisions: hash-based flicker selection (the plan's "variant below 0.15" cannot work on a 0-5 hue index), flat road-stretched reflections sharing the glow's attributes, plume drift riding the ground, double-sided view-space rain quad.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Rain streaks were all culled (invisible while rainCount read 600)**
- **Found during:** Task 2 (visual check of a high-tier screenshot)
- **Issue:** The streak quad is built in view space; its sideways axis made the winding back-facing for every streak, so FrontSide culling dropped them all. The unit tests and the count hook could not see it.
- **Fix:** `side: THREE.DoubleSide`, a unit test pinning it, and width 1.1 / gain 0.7 (streaks read as a backdrop, not a curtain).
- **Files modified:** web/src/render/rain_layer.js, web/test/render/rain_layer.test.js
- **Verification:** screenshot shows slanted pale streaks over the city; rain tests and atmosphere spec green
- **Committed in:** 17e667f

**2. [Rule 1 - Spec mismatch] Sign flicker selection by variant replaced by a placement hash**
- **Found during:** Task 2 (reading the manifest layout)
- **Issue:** The plan flickers "SIGN glows whose variant is below 0.15", but a sign's variant is the 0-5 neon hue index, so that rule would flicker only the cyan signs.
- **Fix:** `placementUnit(x, distance, variant)` is an integer hash in [0, 1); signs with a unit below `FLICKER_SHARE` (0.15) flicker, giving the plan's 15% share, deterministic per placement.
- **Files modified:** web/src/render/city_layer.js, web/test/render/city_layer.test.js
- **Committed in:** 4c379a4

**3. [Rule 3 - Blocking] Medal e2e spec timed out in the loaded full run**
- **Found during:** full `npx playwright test` after Task 2
- **Issue:** Software GL renders fewer frames with the high tier's atmosphere on, so the medal spec went from about 49 s to about 55 s of its 60 s popup wait and failed once under load (passes in isolation on both builds).
- **Fix:** popup wait 100 s, test timeout 160 s. The device-frame-rate cost of the atmosphere stays with the end-of-phase check.
- **Files modified:** tools/e2e/medal.spec.js
- **Committed in:** 4009f13

**4. [Rule 2 - Extension] Optional `getDrift` on createFirePlumes; existing city test updated**
- Without a drift the smoke is left behind the scrolling ruin; `createFirePlumes({ layers, getScale, toWorld })` still works with the default 0. The existing city_layer test that lists a kind's mesh names now expects the new `city-tower-reflection` mesh, as the contract adds one reflection mesh per glowing kind.
- **Committed in:** fa647fa / 4c379a4

---

**Total deviations:** 4 (2 bug / spec mismatch, 1 blocking test robustness, 1 small extension)
**Impact on plan:** All needed for the rain to be visible, the flicker to match the plan's 15%, and the gate to hold. No scope creep.

## Issues Encountered

- `tools/e2e/intro.spec.js` "the banner is visible while the intro runs" failed once in the loaded 100-spec run and passes in isolation on both the pre-plan build and this one: a pre-existing race between the spec's immediate visibility check and the banner's fade. Logged in `deferred-items.md`, not fixed (out of scope).
- Reflection brightness and rain density are starting values (research A9). They were checked on a software-GL screenshot only; the plan's end-of-phase human-check on desktop (high) and iPhone (mid) owns the final tuning and the "orange-yellow enemy bullets still stand out" judgement.

## Known Stubs

None.

## Threat Flags

None. Presentation only, no new endpoint, storage or trust boundary. T-03-33 (denial of service): every element is tier-gated, rain has a fixed capacity and is pure GPU, and the device check re-measures phones.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The city is wet, flickering and burning on high and mid, and the low tier sheds it all. Ready for 03-26.
- Carry to the 03-28 device gate: measure the phone frame rate at mid with rain 300, reflections and plumes, and retune `TIERS.*.rain` if needed; judge bullet readability downtown at the end-of-phase review.

## Self-Check: PASSED

- Created files present: rain_layer.js, fire_plumes.js, the three new test files and atmosphere.spec.js
- Commits present: 01b91b2, df0374a, 17e667f, fa647fa, 4c379a4, 4009f13 (all ancestors of HEAD)
- Acceptance criteria: `createRainLayer` in rain_layer.js and main.js, `rain: 600` in tiers.js, `setReflections` in city_layer.js and main.js, `createFirePlumes` in main.js; atmosphere, glow, city and tier specs pass
- Plan verification: `make test-web` 1642 tests green; `make build` ok; `make lint` ok; full Playwright run 98 of 100 green, the 2 timing-sensitive failures pass in isolation

---
*Phase: 03-stage-1-vertical-slice*
*Completed: 2026-10-18*
