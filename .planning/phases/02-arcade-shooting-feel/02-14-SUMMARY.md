---
phase: 02-arcade-shooting-feel
plan: 14
subsystem: render
tags: [scorch-decals, wrecks, smoke, flames, particles, quality-tiers, instancing, three]

requires:
  - phase: 02-arcade-shooting-feel
    provides: "rig.groundLayer and createWreckRing with the effect clock parameter (02-12), particle layers and TIERS.particleScale (02-02), EXPLOSION payload with the ground flag (02-05), ground_scroll_ratio in the manifest"
provides:
  - "createDecalRing({ capacity, events, blast, ratio, getScroll, playfieldW, playfieldH, rng }) -> { mesh, handle, add(x, y, size), update(scrollNow), setLimit(n), live }"
  - "createWreckRing options layers, getScale and toWorld: a throttled smoke and flame trickle from every on-screen wreck"
  - "TIERS.*.maxDecals (48 / 32 / 16), applied at start and on every tier change"
  - "debug hook fx.decals (live scorch count) and the ground.spec.js decal assertion"
affects: [02-15 shadows (renderOrder above the decals), 02-26 and 02-27 bombs (add() leaves one large scorch), 03 stages with ground units]

actuals:
  tokens: 9000
  tasks: 2
  commits: 3
plan_head_before: fddb7a3f83e35098837d4276b14ad9764a3767d2
plan_head_after: 8add4873a6838e875603b810c65544a041f55b33
commits: 3

tech-stack:
  added: []
  patterns:
    - "Terrain decals are one InstancedBufferGeometry quad per mark with a vec4 (x, y now, size, seed) attribute rewritten each frame for the drawn marks only; the ring stores x, y at kill and scroll at kill and reconstructs y"
    - "A per-wreck accumulator trickle: scaled dt accumulates toward a fixed interval and emits in a bounded while loop; the frame time is clamped to 0.25 s so a background tab never bursts a backlog"
    - "A tier cap that only changes how many of the stored newest items are drawn, never what is stored"

key-files:
  created:
    - web/src/fx/decal_ring.js
    - web/test/fx/decal_ring.test.js
  modified:
    - web/src/fx/wreck_ring.js
    - web/test/fx/wreck_ring.test.js
    - web/src/quality/tiers.js
    - web/test/quality/tiers.test.js
    - web/src/main.js
    - tools/e2e/ground.spec.js

key-decisions:
  - "Only ground MEDIUM and LARGE blasts scorch (16 and 24); a ground SMALL blast and every air blast leave no mark, since the sizes in the plan name only those two classes"
  - "A mark is retired when its whole disc is below the bottom edge (y > playfield height + size / 2); the wreck ring keeps its own PLAYFIELD_H + 40 margin"
  - "A wreck smoulders only while its y is inside 0..playfield height, and a wreck born at the latest effect clock counts its 6 s of flames from that clock"
  - "Smoke uses the dark explosion-smoke grey (0.14, 0.13, 0.12) with the same negative gravity as the explosion smoke; flames use the explosion fire colour (3.4, 1.6, 0.4), hue about 24 degrees, far from the 330 degree bullet pink"

patterns-established:
  - "Optional particle wiring for a ring: without layers the trickle is simply off, so older call sites and tests are unchanged"

requirements-completed: [STGE-04, ENMY-08]

coverage:
  - id: D1
    description: "Every ground kill scorches the terrain: a soft dark mark sized 16 (MEDIUM) or 24 (LARGE) at the kill, locked to the terrain by y_at_kill + ratio * (scroll_now - scroll_at_kill) until it leaves the bottom; air kills leave nothing"
    requirement: STGE-04
    verification:
      - kind: unit
        ref: "web/test/fx/decal_ring.test.js#scorches a ground MEDIUM kill at 16 and a ground LARGE kill at 24"
        status: pass
      - kind: unit
        ref: "web/test/fx/decal_ring.test.js#moves a mark down by the ground ratio times the scroll since the kill"
        status: pass
      - kind: e2e
        ref: "npx playwright test tools/e2e/ground.spec.js"
        status: pass
    human_judgment: true
    rationale: "Whether the mark reads as a soft, slightly irregular scorch that stays glued to the roads at play speed is a visual judgment"
  - id: D2
    description: "48 storage slots with the oldest overwritten, and a tier cap of 48 / 32 / 16 drawn marks that hides the oldest without deleting any"
    requirement: STGE-04
    verification:
      - kind: unit
        ref: "web/test/fx/decal_ring.test.js#overwrites the oldest mark when the 49th arrives"
        status: pass
      - kind: unit
        ref: "web/test/fx/decal_ring.test.js#setLimit"
        status: pass
      - kind: unit
        ref: "web/test/quality/tiers.test.js#is the frozen ladder high / mid / low"
        status: pass
    human_judgment: false
  - id: D3
    description: "Wrecks smoulder as they scroll away: dark smoke every 0.18 s and orange flames every 0.3 s during the first 6 s at particleScale 1, proportionally fewer at lower tiers, nothing for an off-screen wreck"
    requirement: ENMY-08
    verification:
      - kind: unit
        ref: "web/test/fx/wreck_ring.test.js#the smouldering trickle"
        status: pass
    human_judgment: true
    rationale: "The rates and colours are asserted; whether the smoke and flicker look right on a burning wreck is a visual judgment"
  - id: D4
    description: "Scorch marks draw below the shadows and dim mask (renderOrder 2) with depthWrite off and a polygon offset, so they never z-fight the terrain"
    requirement: STGE-04
    verification:
      - kind: unit
        ref: "web/test/fx/decal_ring.test.js#draws without writing depth, blends normally and offsets the polygons against the terrain"
        status: pass
    human_judgment: true
    rationale: "Absence of z-fighting at every camera aspect is a visual property no unit test can prove"
  - id: D5
    description: "The whole stack runs in the production build, at every tier, with no error panel"
    verification:
      - kind: e2e
        ref: "make check (ruff, pytest 100% line+branch, 649 vitest tests, build, 44 Playwright specs)"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-10-18
status: complete
---

# Phase 2 Plan 14: Scorch Marks and Smouldering Wrecks Summary

**A 48-slot ring of soft irregular scorch decals lies on the terrain under every ground kill and scrolls away with the city at the ground ratio, while on-screen wrecks smoulder with a tier-scaled trickle of dark smoke and, for 6 s, small orange flames; the tier caps the drawn marks at 48 / 32 / 16.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-10-18T04:43:31Z
- **Completed:** 2026-10-18T04:50:35Z
- **Tasks:** 2 (the tracer, and one TDD task with a RED and a GREEN commit)
- **Files modified:** 8

## Accomplishments

- `createDecalRing` is one InstancedMesh of a flat quad with a ShaderMaterial: a radial falloff whose edge wobbles with two sine harmonics phased by a per-mark seed, colour (0.04, 0.035, 0.03), alpha up to 0.85, normal blending, `depthWrite` off, polygon offset, 0.1 above the plane in layer coordinates, `renderOrder` 2. It sits in the ground layer so it shares the ray compensation with the wrecks and the tanks.
- An EXPLOSION with `b == 1` adds a mark (MEDIUM 16, LARGE 24); `add(x, y, size)` is public for the bomb. The 49th overwrites the oldest; `update(scrollNow)` rewrites only the drawn marks, newest first, at `y_at_kill + ratio * (scrollNow - scroll_at_kill)` and drops the ones whose disc is past the bottom.
- `setLimit(n)` draws only the n newest stored marks and never deletes one, so a tier step down and back up restores them. `TIERS.high/mid/low.maxDecals` is 48 / 32 / 16, applied at start (including after the bloom-unavailable lock) and on every tier change in `main.js`.
- `createWreckRing` takes `layers`, `getScale` and `toWorld`. Each on-screen wreck keeps two accumulators: dark smoke on the normal layer every 0.18 s, and orange flames on the additive layer every 0.3 s while the wreck is under 6 s old, with the accumulation scaled by `getScale()`. The frame time is clamped to 0.25 s, a backwards clock adds nothing, and a slot overwrite resets age and accumulators. Nothing is allocated per frame (module scratch vector, preallocated typed arrays).
- Debug hook `fx.decals` reports the drawn mark count, and `ground.spec.js` now asserts `fx.decals >= 1` after the first ground kill in the production build.

## Task Commits

1. **Task 1: Tracer, a ground kill leaves a scorch mark that scrolls away with the city** - `26b5959` (feat)
2. **Task 2 RED: failing tests for the decal limit, the smoulder trickle and tier maxDecals** - `7522c9b` (test)
3. **Task 2 GREEN: wrecks smoulder with tier-scaled smoke and flames, tiers cap the scorch marks** - `8add487` (feat)

**Plan metadata:** recorded in the docs commit that carries this file.

## Files Created/Modified

- `web/src/fx/decal_ring.js` - the scorch ring, its shader and `setLimit`
- `web/src/fx/wreck_ring.js` - the smoke and flame trickle on top of the existing ring
- `web/src/quality/tiers.js` - `maxDecals` per tier
- `web/src/main.js` - creates the ring in the ground layer, adds it to the dispatcher, updates it each frame, applies the tier limit, wires the trickle options, `fx.decals` hook
- `web/test/fx/decal_ring.test.js`, `web/test/fx/wreck_ring.test.js`, `web/test/quality/tiers.test.js` - unit coverage
- `tools/e2e/ground.spec.js` - the decal assertion

## Decisions Made

- Only ground MEDIUM and LARGE blasts leave a mark. The plan names only those two sizes, and a SMALL ground blast does not occur in the gallery.
- A scorch is retired when its whole disc is past the bottom edge, so a large mark does not pop out while still partly visible.
- Flames count their 6 s from the effect clock of the latest update at the kill, so a wreck's flame window is independent of the wall clock and replays deterministically.
- The smoke and flame looks are copied from the existing explosion palette (dark grey, fire orange) so they stay clear of the pink bullet hue; a test asserts the flame hue stays within 15 to 45 degrees.

## Deviations from Plan

None - plan executed exactly as written.

The plan's `<verify>` commands were run as `npm test`, `npm run build` and `npx playwright test tools/e2e/ground.spec.js tools/e2e/tier.spec.js`, and the full `make check` also passed (ruff, pytest at 100% line and branch, 649 vitest tests, build, 44 Playwright specs). The tracer's `<verify>` carries only an `<automated>` block, so under `end-of-phase` mode it was re-run and passed before the expansion task started.

## Human-check record (research assumptions A3 and A4)

The Task 2 human-check asks for a look at `?debug&weapon=vulcan&level=5` in a tall narrow and a wide window. I could not watch it live, so I ran a headless Chromium (software GL, so about 13 to 16 fps) at 500x900 and 1200x700, shot down three ground units at each size and took a screenshot. In both shots the scorch marks show as dark smudges on the terrain near the bottom, the smoke trickle rises from the wrecks, and nothing is offset from the road grid. A still frame cannot show the residual slide of about 2 percent that the 0.94 ratio leaves; that stays covered by the 02-12 NDC identity test and is left to the human UAT at real frame rate. No slide was observed in the frames, so the ratio 1.0 fallback was not exercised.

## Issues Encountered

None.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02-15 (air shadows) can draw at `renderOrder` above 2 and below 5; the scorch is already underneath.
- The bomb plans (02-26, 02-27) can call `decals.add(x, y, size)` for the large detonation scorch.
- UAT should confirm at play speed that scorch marks and wrecks stay locked to the roads at portrait and landscape.

## Self-Check: PASSED

- Created files exist: decal_ring.js, decal_ring.test.js
- Commits exist: 26b5959, 7522c9b, 8add487
- `make check` green

---
*Phase: 02-arcade-shooting-feel*
*Completed: 2026-10-18*
