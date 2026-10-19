---
phase: 03-stage-1-vertical-slice
plan: 02
subsystem: render
tags: [three.js, lighting, fog, bloom, quality-tiers, neon-night]

requires:
  - phase: 02-weapons-enemies-and-combat
    provides: renderer_rig, post_pipeline, TIERS, bomb_fx, playfield_mask, shadow_instances
provides:
  - createNightRig (NIGHT_SKY, FOG_DENSITY): fixed three-light neon-night rig with light FogExp2
  - rig.night and rig.sun as the moon light (shadow displacement unchanged)
  - Night-coloured playfield mask (NIGHT_SKY dim, cool violet-grey outline below bloom)
  - TIERS.*.bloomStrength applied by pipeline.setTier as bloomPass.strength and bloomPass.baseStrength
  - bomb_fx pulse that peaks at and returns to the live per-tier base strength
affects: [03-03, 03-12, 03-13, 03-25]

actuals:
  tokens: 5011
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Fixed light budget: three scene lights created once at load, never added or removed (no shader recompiles)"
    - "Per-tier presentation values live in TIERS and are published to the pass as baseStrength for transient pulses"

key-files:
  created:
    - web/src/render/night_rig.js
    - web/test/render/night_rig.test.js
  modified:
    - web/src/render/renderer_rig.js
    - web/src/render/playfield_mask.js
    - web/test/render/playfield_mask.test.js
    - web/src/quality/tiers.js
    - web/test/quality/tiers.test.js
    - web/src/render/post_pipeline.js
    - web/test/render/post_pipeline.test.js
    - web/src/fx/bomb_fx.js
    - web/test/fx/bomb_fx.test.js

key-decisions:
  - "Moon directional light takes the old sun position, so rig.sun and the air-shadow displacement are unchanged"
  - "FOG_DENSITY 0.0006 gives a FogExp2 factor of about 0.14 at 650 units (inside the 0.08-0.25 bound)"
  - "bomb_fx seeds baseStrength from the current strength only if the pass never published one (fallback for bare passes); the real pipeline always publishes it"
  - "Bloom strengths high 0.6, mid 0.5, low 0.5 are starting values for the end-of-phase device check to re-measure"

patterns-established:
  - "Colour guard in tests: any saturated (>= 0.25) night colour keeps >= 35 degrees from the 39 degree enemy-bullet hue (D-39)"

requirements-completed: [STGE-03]

coverage:
  - id: D1
    description: "Scene is lit by a fixed three-light neon-night rig (hemisphere, moon at the old sun position, magenta fill) with light FogExp2 in the sky colour; no warm tint"
    requirement: STGE-03
    verification:
      - kind: unit
        ref: "web/test/render/night_rig.test.js"
        status: pass
      - kind: e2e
        ref: "npx playwright test tools/e2e/glow.spec.js tools/e2e/tier.spec.js tools/e2e/smoke.spec.js"
        status: pass
    human_judgment: true
    rationale: "Whether the colours, moon/fill balance and fog read as a good neon night, with enemy bullets still standing out, is a visual judgement (plan human-check at ?debug&gallery&tier=high, deferred to the end-of-phase review)"
  - id: D2
    description: "Playfield mask dims with NIGHT_SKY and outlines in a cool violet-grey below the bloom threshold"
    requirement: STGE-03
    verification:
      - kind: unit
        ref: "web/test/render/playfield_mask.test.js; web/test/render/night_rig.test.js#the playfield mask colours"
        status: pass
    human_judgment: false
  - id: D3
    description: "Bloom strength is a tier property applied by pipeline.setTier; the bomb pulse peaks at and restores the live tier strength"
    requirement: STGE-03
    verification:
      - kind: unit
        ref: "web/test/quality/tiers.test.js; web/test/render/post_pipeline.test.js; web/test/fx/bomb_fx.test.js#the bloom pulse"
        status: pass
      - kind: e2e
        ref: "npx playwright test tools/e2e/bomb.spec.js tools/e2e/glow.spec.js tools/e2e/tier.spec.js"
        status: pass
    human_judgment: false
  - id: D4
    description: "Retuned bloom strengths (0.6 / 0.5 / 0.5) look right on a real device"
    requirement: STGE-03
    verification: []
    human_judgment: true
    rationale: "Starting values; RESEARCH Pattern 10 requires the end-of-phase device check to re-measure them"

duration: 12min
completed: 2026-10-18
status: complete
plan_head_before: ed20bfa274cc2442d24cf1bea79e9ed7b03a47ec
plan_head_after: 8bcbe3156b7ce14cddea1663099ebc0c56b3ffd0
commits: 4
---

# Phase 3 Plan 02: Neon-night lighting rig and per-tier bloom Summary

**A fixed three-light neon-night rig (violet hemisphere, cool moon at the old sun position, magenta fill) with light FogExp2, a night-coloured playfield mask, and bloom strength carried per quality tier with the bomb pulse returning to the live tier value.**

## Performance

- **Duration:** about 12 min
- **Completed:** 2026-10-18
- **Tasks:** 2 (a tracer and an auto task, both TDD: 2 RED + 2 GREEN commits)
- **Files modified:** 11 (6 source, 5 test; 2 of them new)

## Accomplishments
- `createNightRig(scene, { sunPosition })` replaces the warm hemisphere, warm sun and `0x0b0a09` background: background and `FogExp2` share `NIGHT_SKY` (`0x07061a`), the fog factor is about 0.14 at 650 units, and the light count is fixed at three (no runtime light changes, T-03-02).
- `renderer_rig` uses the rig; `rig.sun` is the moon at (-120, 300, 160), so `createShadowInstances({ sunPosition: rig.sun.position })` displaces air shadows exactly as before; `rig.night` exposes the lights and fog.
- Playfield mask dim uses `NIGHT_SKY` and the outline is `0x3a3f6b` (below 1.0 in every channel, never blooms); a scan test keeps every night colour 35 degrees or more from the 39 degree bullet hue when saturation is at least 0.25.
- `TIERS` carry `bloomStrength` (high 0.6, mid 0.5, low 0.5); `pipeline.setTier` writes `bloomPass.strength` and `bloomPass.baseStrength` when bloom is enabled, and the constructor seeds `baseStrength`.
- `bomb_fx` no longer caches the strength at creation: it reads the live `baseStrength` at start, advance and restore, so a tier change mid-pulse ends at the new tier strength.

## Tracer feedback gate

Task 1 is `type="tracer"`. Its `<verify>` carries a `<human-check>`, but the plan scopes it to the end-of-phase review (`human_verify_mode: end-of-phase`), so no mid-phase checkpoint was raised. The automated verify (`make test-web && make build && playwright glow/tier/smoke`) passed after GREEN (1052 vitest tests, 9 Playwright tests); expansion (Task 2) proceeded. The human visual check at `make preview` `?debug&gallery&tier=high` is deferred to the end-of-phase review and recorded as `human_judgment: true` in the coverage block.

## TDD Gate Compliance

Plan type is `execute` (task-level `tdd="true"`), `workflow.tdd_mode` is not enabled, so the gate classifier was not run. Discipline was followed per task:

- **Task 1 RED** `e7a357d`: night_rig tests plus a minimal skeleton module (so tests fail on assertions, not at import). 10 of 11 tests failed on the planned behaviour (light count, fog, moon position, fill side, hue guard, mask dim colour). The "outline below 1.0" test passed against the existing outline by design (a guard).
- **Task 1 GREEN** `2db779b`: 1052 vitest tests pass, build succeeds, glow/tier/smoke specs pass.
- **Task 2 RED** `0ee2da1`: 6 tests failed (tier table, constructor `baseStrength` seed, `setTier` strength, low-tier no-touch, pulse peak at a base set after load, pulse end after a tier drop). The no-published-base fallback test passed in RED by design (a regression guard for the fallback).
- **Task 2 GREEN** `8bcbe31`: 1058 vitest tests pass, build succeeds, bomb/glow/tier specs pass (19 tests).
- No REFACTOR commits were needed.

## Task Commits

1. **Task 1 RED: failing night-rig tests** - `e7a357d` (test)
2. **Task 1 GREEN: three-light neon-night rig, renderer wiring, night mask** - `2db779b` (feat)
3. **Task 2 RED: failing per-tier bloom and live-base pulse tests** - `0ee2da1` (test)
4. **Task 2 GREEN: per-tier bloom strength and live-base bomb pulse** - `8bcbe31` (feat)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## Files Created/Modified
- `web/src/render/night_rig.js` - `NIGHT_SKY`, `FOG_DENSITY`, `createNightRig`
- `web/src/render/renderer_rig.js` - builds the night rig; `rig.sun` is the moon, `rig.night`
- `web/src/render/playfield_mask.js` - night dim colour and cool outline
- `web/src/quality/tiers.js` - `bloomStrength` per tier
- `web/src/render/post_pipeline.js` - `setTier` applies strength and `baseStrength`
- `web/src/fx/bomb_fx.js` - pulse reads the live `baseStrength`
- Mirrored vitest files for each of the above (`web/test/...`)

## Decisions Made
- The moon takes the exact old sun position rather than a new angle, keeping air-shadow displacement unchanged.
- `FOG_DENSITY = 0.0006` (factor about 0.14 at 650 units).
- Bomb pulse fallback: if a bare pass never published `baseStrength`, `bomb_fx` seeds it once from the unpulsed strength (keeps pre-existing and standalone usage safe; the real pipeline always publishes it).
- Light colours and intensities (hemisphere 0x5b6cff/0x0d0a26 at 0.55, moon 0xa9b8ff at 0.9, fill 0xff3fd2 at 0.35) and bloom strengths are discretion starting values for the human check.

## Deviations from Plan

None - plan executed exactly as written. (The `?? ` fallback in the plan text became a one-time seed via `??=`, so the old strength-only mock stays correct instead of reading a pulsed value as the base; this implements the plan's intent and is covered by a test.)

**Total deviations:** 0 auto-fixed.

## Issues Encountered
None.

## Known Stubs
None.

## Threat Flags
None. Presentation only; no new network, auth or file surface. T-03-02 mitigated: fixed three-light budget, single FogExp2 term.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 03-03 can retint the palette against the night rig; its scan test can reuse the hue guard pattern from `night_rig.test.js`.
- City and atmosphere plans (03-12, 03-13, 03-25) build on the fixed light budget: add emissive materials, never lights.
- End-of-phase device check must re-measure fog, light balance, bloom strengths and phone frame rate.

## Self-Check: PASSED

`night_rig.js` and `night_rig.test.js` exist; commits `e7a357d`, `2db779b`, `0ee2da1`, `8bcbe31` are ancestors of HEAD; acceptance greps match (`createNightRig(scene)`, `FogExp2`, `bloomStrength` in tiers and post_pipeline, `baseStrength` in bomb_fx); `make test-web` (1058 tests) and `make build` pass; glow, tier, smoke and bomb Playwright specs pass; measured commit count 4.

---
*Phase: 03-stage-1-vertical-slice*
*Completed: 2026-10-18*
