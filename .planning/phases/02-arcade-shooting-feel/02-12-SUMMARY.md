---
phase: 02-arcade-shooting-feel
plan: 12
subsystem: render
tags: [ground-layer, camera-ray-projection, wrecks, explosions, instancing, three]

requires:
  - phase: 02-arcade-shooting-feel
    provides: "altitudeScale and the camera fit (01-03), TERRAIN_DEPTH (02-06), enemy models and createEnemyInstances (02-07, 02-09), EXPLOSION payload (x, y, blast, ground flag, kind) and ground_scroll_ratio / enemy_ground in the manifest (02-05), createExplosionFx (02-02)"
provides:
  - "createGroundLayer({ terrainDepth, playfieldW, playfieldH }) -> { group, refit(camera), toWorld(x, y, out), k }, exposed as rig.groundLayer and refit after every camera fit"
  - "createEnemyInstances options groundKinds and groundGroup, airMeshes / groundMeshes, and update(n, timeS, groundOffsetY)"
  - "createWreckRing(...) -> { group, meshes, handle, update(scrollNow, timeS), spawned, live }: 12 charred hulls that scroll with the terrain"
  - "explosion toWorld(x, y, ground, out) and the groundKinds option: ground explosions and ground hit sparks burst on the terrain"
  - "debug hooks fx.wrecksSpawned and groundLayerK; tools/e2e/ground.spec.js"
affects: [02-14 scorch marks and smouldering trickle, 02-15 shadows, 02-27 bombs, 03 stages with ground units]

actuals:
  tokens: 21000
  tasks: 2
  commits: 3
plan_head_before: f3aa7d551a90948db9f25191c895cb6eeebbba46
plan_head_after: d2cbc1ff065cf8d6a7565e2ac2b6c3c6a6c135f5
commits: 3

tech-stack:
  added: []
  patterns:
    - "Terrain-anchored visuals are authored in plane coordinates inside one group whose transform is the central projection from the camera onto the terrain plane (position = C * (1 - k), uniform scale k)"
    - "Ground kinds are routed by a Set of kind values built from manifest.tuning.enemy_ground; the enemy factory parents their meshes to the ground group and leaves the air meshes for the caller"
    - "Ring buffers for transient scenery keep the kill position and the scroll at the kill and reconstruct the position each frame, so they hold no per-frame state"

key-files:
  created:
    - web/src/render/ground_layer.js
    - web/test/render/ground_layer.test.js
    - web/src/fx/wreck_ring.js
    - web/test/fx/wreck_ring.test.js
    - tools/e2e/ground.spec.js
  modified:
    - web/src/render/renderer_rig.js
    - web/src/render/enemy_instances.js
    - web/test/render/enemy_instances.test.js
    - web/src/fx/explosion_fx.js
    - web/test/fx/explosion_fx.test.js
    - web/src/main.js

key-decisions:
  - "Research assumption A4 is verified by an automated test: at 9/19.5, 3/4, 4/3 and 16/9 a ground-layer point and the same gameplay-plane point project to the same NDC within 1e-6, with k between 1.03 and 1.09"
  - "createEnemyInstances adds the ground meshes to groundGroup itself; with no groundGroup every kind is treated as air, so existing callers are unchanged"
  - "The wreck ring's meshes use the low-detail body of each ground kind whatever the tier, because a charred silhouette does not need the high-detail hull; this is also why geometryFor is called once per kind and never again"
  - "A single scrollNow per frame (SCROLL_Y + ALPHA * scroll_speed) drives the terrain, the wrecks and the wreck kill-scroll, so a wreck is exactly where its unit was drawn on the frame of the kill"

patterns-established:
  - "Pass the ground flag down to the one place that positions particles (toWorld) instead of branching in each emitter"

requirements-completed: [STGE-04, ENMY-08, VISL-03]

coverage:
  - id: D1
    description: "Tanks and AA turrets are drawn on the terrain where they are hit: gameplay-plane and ground-layer points project to the same NDC at portrait, 4:3 and 16:9, with k between 1.03 and 1.09"
    requirement: STGE-04
    verification:
      - kind: unit
        ref: "web/test/render/ground_layer.test.js#projects a ground point to the same NDC as the gameplay-plane point (1e-6)"
        status: pass
      - kind: unit
        ref: "web/test/render/enemy_instances.test.js#parents the body, glow and top meshes of ground kinds to the ground group"
        status: pass
    human_judgment: true
    rationale: "The NDC identity proves the projection; whether a tank reads as sitting on the roads at play speed is a visual judgment for UAT"
  - id: D2
    description: "A ground kill leaves a charred wreck placed at y_at_kill + ratio * (scroll_now - scroll_at_kill), capped at 12 with the oldest overwritten, retired past PLAYFIELD_H + 40"
    requirement: ENMY-08
    verification:
      - kind: unit
        ref: "web/test/fx/wreck_ring.test.js"
        status: pass
      - kind: e2e
        ref: "npx playwright test tools/e2e/ground.spec.js"
        status: pass
    human_judgment: false
  - id: D3
    description: "Ground explosions and ground hit sparks go through the ground layer; air explosions stay on the gameplay plane"
    requirement: VISL-03
    verification:
      - kind: unit
        ref: "web/test/fx/explosion_fx.test.js#bursts a ground LARGE explosion at the ground-layer position and an air one on the plane"
        status: pass
      - kind: unit
        ref: "web/test/fx/explosion_fx.test.js#sparks a HIT on a ground kind at the ground position when groundKinds is given"
        status: pass
    human_judgment: false
  - id: D4
    description: "The whole stack runs in the production build: layer scale in range, a wreck after real ground kills, no error panel"
    verification:
      - kind: e2e
        ref: "make check (lint, pytest 100%, vitest, build, 44 Playwright specs)"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-10-18
status: complete
---

# Phase 2 Plan 12: Ground Layer, Wrecks and Ground Explosions Summary

**Tanks and AA turrets are drawn on the terrain through a ray-compensating ground group (k = altitudeScale, refit with the camera), so they sit where the bolts hit them; a 12-wreck ring of charred hulls scrolls away with the city, and ground explosions burst on the terrain.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-10-18T04:26:50Z
- **Completed:** 2026-10-18T04:33:34Z
- **Tasks:** 2 (the tracer, and one TDD task with a RED and a GREEN commit)
- **Files modified:** 11

## Accomplishments

- `createGroundLayer` projects the gameplay plane onto the terrain plane along the camera ray (`position = C * (1 - k)`, uniform `scale = k`). It is created in the rig, added to the scene, and refit in `applyTier` right after the camera refits (and so once at creation). `toWorld` gives particles the same position a child of the layer would have.
- Research assumption A4 is now an automated check: at four aspects and seven playfield points, the ground-layer point and the plane point project to the same NDC within 1e-6, and `k` stays within 1.03..1.09.
- Ground kinds (from `manifest.tuning.enemy_ground`) draw inside the layer and extrapolate between steps by `ALPHA * scroll_speed * ground_scroll_ratio`, like the terrain, so they do not stutter against the roads.
- `createWreckRing` keeps 12 charred hulls (one InstancedMesh per ground kind, allocated once, nothing allocated in `update`). Each wreck is placed at `y_at_kill + ratio * (scroll_now - scroll_at_kill)` and retired past `PLAYFIELD_H + 40`; the 13th overwrites the oldest. Only `EXPLOSION` events with `b == 1` add one.
- `createExplosionFx` now calls `toWorld(x, y, ground, out)`: an `EXPLOSION` passes its `b` payload and a `HIT` passes whether the hit kind is a ground kind, so a tank's LARGE fireball, smoke, debris and hit sparks appear on the terrain where the tank was drawn.

## Task Commits

1. **Task 1: Tracer, ground layer, ground-kind parenting and wreck ring** - `2e6b821` (feat)
2. **Task 2 RED: ground-aware toWorld tests** - `8b77589` (test)
3. **Task 2 GREEN: ground explosions and hit sparks on the terrain** - `d2cbc1f` (feat)

**Plan metadata:** recorded in the docs commit that carries this file.

## Files Created/Modified

- `web/src/render/ground_layer.js` - the ray-compensating group, `refit(camera)` and `toWorld`
- `web/src/render/renderer_rig.js` - creates `rig.groundLayer`, adds it to the scene, refits after each camera fit
- `web/src/render/enemy_instances.js` - `groundKinds` / `groundGroup`, `airMeshes` / `groundMeshes`, `update(n, timeS, groundOffsetY)`
- `web/src/fx/wreck_ring.js` - the 12-slot ring of charred wrecks
- `web/src/fx/explosion_fx.js` - ground-aware positioning and the `groundKinds` option
- `web/src/main.js` - one `scrollNow` per frame, ground-kind wiring, wreck ring in the layer and the dispatcher, debug hooks `fx.wrecksSpawned` and `groundLayerK`
- `web/test/render/ground_layer.test.js`, `web/test/render/enemy_instances.test.js`, `web/test/fx/wreck_ring.test.js`, `web/test/fx/explosion_fx.test.js` - unit coverage
- `tools/e2e/ground.spec.js` - layer scale range and a wreck after real ground kills in the production build

## Decisions Made

- `createEnemyInstances` parents the ground meshes to `groundGroup` itself and exposes `airMeshes` for the caller. With no `groundGroup`, every kind is air, so older call sites and tests are unchanged.
- The wreck meshes use each kind's low-detail body regardless of tier: a burnt silhouette does not need the high-detail hull, and it means the ring never swaps geometry on a tier change.
- One `scrollNow` per frame feeds the terrain, the wreck kill-scroll and `wrecks.update`, so a wreck lands exactly where its unit was drawn on the frame of the kill.
- `wrecks.update(scrollNow, timeS)` accepts the effect clock now (unused) so 02-14's smouldering trickle needs no signature change.

## Deviations from Plan

None - plan executed exactly as written.

The Task 2 TDD cycle produced a RED commit, `8b77589`, and a GREEN commit, `d2cbc1f`. The RED failures are TypeErrors from the old three-argument `toWorld` meeting the new four-argument contract in the test stub, which is the planned contract change and not an unrelated fault. The plan's `<verify>` lines were run as `npx vitest` / `make check` equivalents of `npm test && npm run build && npx playwright test ...`; the full `make check` passed (lint, pytest at 100%, 616 vitest tests, build, 44 Playwright specs).

## Issues Encountered

None.

## Known Stubs

None. `wrecks.update(scrollNow, timeS)` ignores `timeS` on purpose until plan 02-14 adds the smouldering trickle; that is a reserved parameter, not a stub that blocks this plan's goal.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02-14 can add scorch decals and the wreck smoke trickle on top of `rig.groundLayer` and `wrecks`; the ring already stores the kill position and scroll it needs.
- Whether tanks look planted on the roads at play speed (the residual slide of about 2 percent) is a visual call for UAT.

## Self-Check: PASSED

- Created files exist: ground_layer.js, ground_layer.test.js, wreck_ring.js, wreck_ring.test.js, ground.spec.js
- Commits exist: 2e6b821, 8b77589, d2cbc1f
- `make check` green

---
*Phase: 02-arcade-shooting-feel*
*Completed: 2026-10-18*
