---
phase: 02-arcade-shooting-feel
plan: 17
subsystem: rendering
tags: [three.js, bloom, postprocessing, shaders, instancing, palette]

requires:
  - phase: 02-arcade-shooting-feel
    provides: bullet instancing and the bloom pipeline (01-03), bullet flight angle in the pbullets channel (02-11), explosion recipes (02-02, 02-12), stress and gameplay bullet pools (02-16)
provides:
  - PALETTE with named colours and roles plus hueOf, saturationOf, hueDistance, and a test that reserves hot pink for enemy bullets
  - 'orb' bullet style (white core, pink halo, dark rim) and 'bolt' style (HDR tracer stretched along the flight angle)
  - Post-bloom bullet RenderPass in the composer and a depth-cleared direct path on the low tier
  - rig.bulletScene and rig.sun, debug hooks passes and bulletPath, glow e2e spec
affects: [02-18 enemy shooting, 02-19 lighting (rig.sun), 02-21 laser, 02-23 missiles, any plan adding an effect or pickup colour]

actuals:
  tokens: 8400
  tasks: 2
  commits: 3
plan_head_before: 386afb0275eda681ba1f769c41b9cc4ef153eeb1
plan_head_after: 77872e31a4b98cd6d8caa15503547a41ea676bf2

tech-stack:
  added: []
  patterns:
    - "Colour governance: every effect, weapon and pickup colour is a PALETTE entry; a unit test enforces the pink exclusion band"
    - "Bullet scene drawn after bloom: second RenderPass (clear false, clearDepth true) before OutputPass; the low tier clears depth and renders the same scene directly"
    - "Bullet visuals are a style option of one instanced mesh, so draw-call count stays one per channel"

key-files:
  created:
    - web/src/fx/palette.js
    - web/test/fx/palette.test.js
    - web/test/render/post_pipeline.test.js
    - tools/e2e/glow.spec.js
  modified:
    - web/src/render/bullet_instances.js
    - web/test/render/bullet_instances.test.js
    - web/src/render/post_pipeline.js
    - web/src/render/renderer_rig.js
    - web/src/fx/explosion_fx.js
    - web/test/fx/explosion_fx.test.js
    - web/src/main.js

key-decisions:
  - "Orb colours are LDR (halo 0.98, 0.16, 0.62) and drawn after bloom, so bloom neither washes the orbs out nor makes them bloom themselves"
  - "Unknown bullet style throws in buildMaterial; the default style is orb for the ebullets channel and flat for any other name, so a plain call keeps the old look"
  - "Player bolts use the palette VULCAN_TRACER colour by default (warm white-yellow) instead of the earlier cyan override, so the blue stays free for the laser"
  - "Recipe colours that had no palette twin were mapped to the nearest entry (EMBER for the small ember emitter, FIRE_CORE for every core, DEBRIS for the dark debris)"

patterns-established:
  - "New effect colours are added to PALETTE first; the pink-exclusion test then guards them"
  - "A render pass is given a name so the debug hooks and tests can assert pass order"

requirements-completed: [VISL-05, VISL-02]

coverage:
  - id: D1
    description: "Enemy bullets are pink orbs with a white core and dark rim (LDR, halo hue 320..335, every channel at most 0.98) drawn depthTest-off at renderOrder 30"
    requirement: VISL-05
    verification:
      - kind: unit
        ref: "web/test/render/bullet_instances.test.js#style 'orb'"
        status: pass
      - kind: unit
        ref: "web/test/fx/palette.test.js#keeps the enemy bullet halo hot pink and low dynamic range"
        status: pass
    human_judgment: false
  - id: D2
    description: "Bullets are drawn after bloom: composer pass order scene, bloom, bullets, output with the bullet pass clear false and clearDepth true; the low tier draws the bullet scene directly after a depth clear"
    requirement: VISL-05
    verification:
      - kind: unit
        ref: "web/test/render/post_pipeline.test.js#lists scene, bloom, bullets, output when a bullet scene is given"
        status: pass
      - kind: e2e
        ref: "tools/e2e/glow.spec.js (tier high composer path, tier low direct path)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Pink is reserved: no saturated effect, weapon or pickup palette colour lies within 35 degrees of the enemy-bullet hue, and every explosion and hit recipe colour is a palette entry"
    requirement: VISL-05
    verification:
      - kind: unit
        ref: "web/test/fx/palette.test.js#reserves pink: no saturated effect, weapon or pickup colour is within 35 degrees of it"
        status: pass
      - kind: unit
        ref: "web/test/fx/explosion_fx.test.js#take every colour from the palette, with no inline literals"
        status: pass
    human_judgment: false
  - id: D4
    description: "Player bolts are HDR tracers stretched 2.5 times along their flight angle, so the vulcan fan's angled streams read as glowing streaks"
    requirement: VISL-02
    verification:
      - kind: unit
        ref: "web/test/render/bullet_instances.test.js#style 'bolt'"
        status: pass
    human_judgment: true
    rationale: "Whether the angled streaks read well over fire, smoke and bloom on every tier is a visual judgment; the plan's human-check covers it (checked once by screenshot at tier high with ?weapon=vulcan&level=5)"
  - id: D5
    description: "Five hundred stress bullets are still one draw call and both render paths show them (EBULLET_N at least 500)"
    requirement: VISL-05
    verification:
      - kind: e2e
        ref: "tools/e2e/glow.spec.js; tools/e2e/stress.spec.js; tools/e2e/tier.spec.js"
        status: pass
    human_judgment: false
  - id: D6
    description: "Enemy-bullet readability does not depend on hue alone (white core, dark rim) and pink stays legible over bright fire on every tier"
    requirement: VISL-05
    verification:
      - kind: unit
        ref: "web/test/fx/palette.test.js#gives each orb layer a distinct luminance so it reads without hue: white core, dark rim"
        status: pass
    human_judgment: true
    rationale: "Legibility over live fire, smoke and bloom on mid and low tiers is a visual judgment (the plan's human-check); the luminance ordering is asserted, the on-screen result is not"

duration: 7min
completed: 2026-10-18
status: complete
---

# Phase 2 Plan 17: Pink enemy bullets after bloom, tracer player bolts Summary

**Hot-pink enemy orbs with a white core and dark rim drawn in a post-bloom pass on every tier, a tested palette that reserves that pink, and player bolts stretched into HDR tracers along their flight angle**

## Performance

- **Duration:** 7 min
- **Started:** 2026-10-18T05:04:05Z
- **Completed:** 2026-10-18T05:11:32Z
- **Tasks:** 2 (a tracer and a TDD task)
- **Files modified:** 11 (4 created, 7 modified)

## Accomplishments

- `palette.js` names every effect, weapon and pickup colour with a role; a unit test fails and names the offender if any saturated one comes within 35 degrees of the enemy-bullet pink (the blue laser sits near 225 and the purple missiles near 257 degrees).
- The enemy bullet is one instanced mesh with an 'orb' fragment shader: white core below radius 0.3, pink halo, near-black rim band, antialiased edge. It lives in `rig.bulletScene`, so fire and explosion bloom can never cover it.
- `createPostPipeline` takes `bulletScene` and inserts a named 'bullets' RenderPass (`clear = false`, `clearDepth = true`) between bloom and output; `passNames()` reports `scene, bloom, bullets, output`. The low tier renders the main scene, clears depth, renders the bullet scene, and restores autoClear; `prewarm()` compiles and renders both.
- Player bolts use a 'bolt' style: the quad is stretched 2.5 times along its local forward axis and turned by `aData.z`, with an elliptical HDR streak that blooms. Verified by screenshot with the level 5 vulcan fan.
- All explosion and hit recipe colours are now `PALETTE` entries; the inline literals are gone.
- `rig.sun` is exposed for plan 02-19; debug hooks `passes` and `bulletPath` and `tools/e2e/glow.spec.js` cover both render paths.

## Task Commits

1. **Task 1: Tracer: pink orbs drawn after bloom** - `ae2904f` (feat). The tracer verify (`npm test`, `npm run build`, glow, stress and tier specs) was re-run end to end and passed before expanding.
2. **Task 2: Bolt tracers and palette-sourced recipes (TDD)**
   - RED: `20419e6` (test): five bolt-style tests and the recipe-colours test failed (unknown style 'bolt', inline colour literals not in the palette).
   - GREEN: `77872e3` (feat)

**Plan metadata:** committed with this SUMMARY (docs: complete plan).

## Files Created/Modified

- `web/src/fx/palette.js` - PALETTE, hueOf, saturationOf, hueDistance, exclusion constants
- `web/test/fx/palette.test.js` - helper tests, frozen-ness, halo hue and LDR bound, luminance ordering, pink exclusion, laser and missile hues
- `web/src/render/bullet_instances.js` - 'flat', 'orb' and 'bolt' styles behind one `style` option
- `web/test/render/bullet_instances.test.js` - tests for all three styles
- `web/src/render/post_pipeline.js` - bullets pass, pass names, `passNames()`
- `web/test/render/post_pipeline.test.js` - pass order and bullet-pass flags against a stub renderer
- `web/src/render/renderer_rig.js` - `bulletScene`, `sun`, direct-path bullet render, prewarm of both paths
- `web/src/fx/explosion_fx.js`, `web/test/fx/explosion_fx.test.js` - recipe colours from the palette and the scan test
- `web/src/main.js` - bullets scene wiring, bolt style for pbullets, debug hooks
- `tools/e2e/glow.spec.js` - pass order and bullet path at tier high and tier low

## Decisions Made

- Orb colours are LDR and drawn after bloom, so bloom neither washes them out nor makes them glow.
- Player bolts take the palette `VULCAN_TRACER` colour (warm white-yellow) rather than the previous cyan override, which frees blue for the laser (plan 02-21).
- Recipe colours with no exact palette twin map to the nearest entry: `EMBER` for the small ember emitter, `FIRE_CORE` for all three cores, `DEBRIS` for the dark debris; the visual change is a small shift in core and debris tint.
- The default style depends on the channel name (orb for `ebullets`, flat otherwise), so existing callers and tests keep working; the 'bolt' size default is 3 (matching the previous pbullets size).

## Deviations from Plan

None - plan executed exactly as written. Two additions inside the plan's scope: a unit test file `web/test/render/post_pipeline.test.js` (the plan's behaviour list required the pass order to be checked; there was no existing file for it), and a 'flat' style kept as the legacy solid-colour look.

## Issues Encountered

None. A first `pkill -f "vite preview"` inside a compound command killed its own shell (exit 144); no repo state was affected and `make check` was re-run clean.

## Known Stubs

None. The bolt and orb styles are fully wired; enemy bullets that can hurt the player arrive with plans 02-18 and 02-20, and until then the `?stress` storm bullets are the orbs on screen (stated in the plan).

## Threat Flags

None. No new network, auth or file-access surface. T-02-21 (extra pass cost): the bullet pass renders one instanced mesh into the existing render target, is prewarmed on both paths, and the low tier keeps the composer off. T-02-SC: no packages added, lockfiles unchanged.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02-18 (enemy shooting) can spawn gameplay bullets knowing they render as readable orbs from their first lethal frame.
- Plan 02-19 can light with `rig.sun`.
- Plans that add effect, weapon or pickup colours must add them to `PALETTE` so the pink-exclusion test covers them.
- Pending human check at the end of the phase: pink legibility over fire on tiers mid and low, and the vulcan fan streaks on a real device.

## Self-Check: PASSED

- Created files exist: palette.js, palette.test.js, post_pipeline.test.js, glow.spec.js (verified with `[ -f ]`).
- Commits `ae2904f`, `20419e6`, `77872e3` are ancestors of HEAD.
- `make check` (ruff, pytest at 100% line and branch, vitest 679 tests, build, 46 Playwright specs) exited 0.
- Acceptance criteria: `clearDepth = true` present in post_pipeline.js, `bulletScene.add(` present in main.js, glow spec passes at tier high and low.

---
*Phase: 02-arcade-shooting-feel*
*Completed: 2026-10-18*
