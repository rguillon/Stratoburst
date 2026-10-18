---
phase: 02-arcade-shooting-feel
plan: 23
subsystem: rendering
tags: [missiles, homing, instanced-mesh, particles, trail, perf, pyodide-node, e2e]

requires:
  - phase: 02-arcade-shooting-feel
    provides: "missiles channel (stride 4, cap 48) and header MISSILE_N (02-13), PALETTE.MISSILE and MISSILE_TRAIL (02-17), additive particle layer and TIERS particleScale (02-02), model_kit lathe/bake/tint (02-06), create_game weapon/level validation (02-11), god flag in the perf harness (02-20), beam prewarm pattern (02-21)"
provides:
  - "createMissileInstances: one InstancedMesh of a baked violet lathe missile oriented by its angle, with a 50 ms exhaust trail through layers.additive scaled by particleScale"
  - "main.js wiring (missiles.update(header[MISSILE_N], fxTime)), shader prewarm at count 1, debug hook fx.missilesDrawn"
  - "tools/perf_node.mjs --weapon vulcan|laser|homing|all and --level N: one JSON line per weapon on fresh games, exit 1 on an over-budget or idle run, exit 2 on bad usage"
  - "npm run perf (and make perf) sweeps all three weapons at Lv5 under the 3 ms budget"
affects: [02-26 bomb visuals, 02-33 phone perf measurement, phase 2 verification]

actuals:
  tokens: 4200
  tasks: 2
  commits: 2
plan_head_before: 80382b24882146d279506d84d6c3c6391be445d6
plan_head_after: fbecdb9a4c51cf14a68ec9454f4933fd8f0be682
commits: 2

tech-stack:
  added: []
  patterns:
    - "A perf gate that must prove it measured something: each weapon run records the peak of its output header slot (PBULLET_N, BEAM_W, MISSILE_N) and fails if fire was held and the peak is 0"
    - "Capped trail emission rotates its start index so a reduced puff count still serves every live missile over time"
    - "A mesh that is hidden at rest is drawn once at count 1 before the second prewarm, then reset, so its first real frame compiles nothing"

key-files:
  created:
    - web/src/render/missile_instances.js
    - web/test/render/missile_instances.test.js
  modified:
    - web/src/main.js
    - tools/e2e/weapons.spec.js
    - tools/perf_node.mjs
    - package.json
    - Makefile

key-decisions:
  - "The missile is a lathe along Y turned to point -Z (up the screen) and baked once with HDR violet vertex colours on a MeshBasicMaterial; the instance rotates about Y by minus the angle so the nose follows (sin a, -cos a)"
  - "Trail puffs per 50 ms cadence tick are min(count, max(1, round(count * particleScale))), starting at a rotating index; the cadence advances only when it emits, with no catch-up burst after a stall"
  - "perf_node.mjs validates --weapon itself because the Python entrypoint silently falls back to vulcan for unknown names; the weapon-less legacy invocation still works and prints no weapon field"

patterns-established:
  - "Tooling flags that select a game option are validated in the tool, since the entrypoint is deliberately lenient"

requirements-completed: [PLYR-04, PLYR-05]

coverage:
  - id: D1
    description: "Homing missiles are drawn as small violet missiles oriented by their angle, at (x - W/2, 0, y - H/2), count clamped to capacity, nothing drawn or emitted for zero missiles"
    requirement: PLYR-05
    verification:
      - kind: unit
        ref: "web/test/render/missile_instances.test.js#createMissileInstances"
        status: pass
      - kind: e2e
        ref: "tools/e2e/weapons.spec.js#holding fire with the level 5 homing weapon launches missiles that are drawn with trails"
        status: pass
    human_judgment: false
  - id: D2
    description: "Each live missile leaves a glowing violet exhaust trail, one puff about every 50 ms, scaled by tier and never zero for a live missile"
    requirement: PLYR-05
    verification:
      - kind: unit
        ref: "web/test/render/missile_instances.test.js#the exhaust trail"
        status: pass
      - kind: e2e
        ref: "tools/e2e/weapons.spec.js#holding fire with the level 5 homing weapon launches missiles that are drawn with trails"
        status: pass
    human_judgment: false
  - id: D3
    description: "make perf exercises vulcan, laser and homing at Lv5 on fresh games, prints one JSON line per weapon and fails above 3 ms; the Makefile help text describes it"
    requirement: PLYR-04
    verification:
      - kind: other
        ref: "npm run perf && make perf (three JSON lines, avg_ms 0.70 / 0.54 / 0.63 against budget 3)"
        status: pass
      - kind: other
        ref: "node tools/perf_node.mjs --weapon plasma exits 2; --budget-ms 0.0001 exits 1; make help shows the new perf text"
        status: pass
    human_judgment: false
  - id: D4
    description: "Missiles read as clearly violet and not pink, fanning out and curving onto enemies with a smooth bloom-lit trail"
    requirement: PLYR-05
    verification: []
    human_judgment: true
    rationale: "Colour distinctness, trail glow and curve readability on screen are visual judgments; the palette test only proves hue separation from the pink bullet"

duration: 9min
completed: 2026-10-18
status: complete
---

# Phase 2 Plan 23: Homing Missile Visuals and the Per-Weapon Perf Gate Summary

**Violet lathe-model homing missiles with 50 ms glowing exhaust trails through the particle rings, and a Pyodide-on-Node perf sweep that holds the 3 ms tick budget for vulcan, laser and homing at Lv5**

## Performance

- **Duration:** 9 min
- **Started:** 2026-10-18T06:09:00Z
- **Completed:** 2026-10-18T06:18:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Homing missiles are visible: `createMissileInstances` draws one InstancedMesh of a smooth baked violet missile, turned to its flight angle, and puffs `PALETTE.MISSILE_TRAIL` at each tail every 50 ms into the additive particle layer, scaled by the tier's `particleScale` (never fewer than one puff per cadence tick while a missile lives). `update` uses module-level scratch objects and allocates nothing.
- `main.js` creates the missiles from `bridge.channels.missiles`, adds the mesh to `rig.scene` before the second prewarm (drawn once at count 1 so the shader compiles at load, then reset to 0), updates it every frame with `header[MISSILE_N]` and `fxTime`, and exposes `fx.missilesDrawn`.
- The perf harness now takes `--weapon vulcan|laser|homing|all` and `--level N`. `all` runs the three weapons on fresh games and prints one JSON line each (with `weapon`, `level` and `peak_output`). It exits 1 if any average exceeds the budget or if a weapon produced nothing with fire held, and exits 2 on bad usage (for example `--weapon plasma`).
- `npm run perf` passes `--weapon all --level 5`; `make perf` still wraps it and its help text now describes the real load.

## Perf results (Pyodide on Node, 500 stress bullets, fire held, Lv5, 600 ticks, budget 3 ms)

| Weapon | avg_ms | p95_ms | peak output |
|--------|--------|--------|-------------|
| vulcan | 0.6978 | 0.8184 | 65 bolts |
| laser  | 0.5389 | 0.5962 | beam half-width 7 |
| homing | 0.6307 | 0.6964 | 35 missiles |

`make perf` repeated the sweep: 0.6957 / 0.5356 / 0.6281 ms. All three are well inside the 3 ms desktop budget that leaves room for a 3-5x phone slowdown (phones are measured in plan 02-33).

## Task Commits

1. **Task 1: Tracer, homing missiles appear as violet missiles with glowing trails** - `6d899f4` (feat)
2. **Task 2: The perf gate runs every weapon at Lv5 and fails if any one breaks the 3 ms budget** - `fbecdb9` (feat)

**Plan metadata:** committed as the docs commit following this summary.

Task 1 is a `tracer` task: its `<verify>` is automated only (`npm test && npm run build && npx playwright test tools/e2e/weapons.spec.js`), so under the default `end-of-phase` mode it was re-run end to end (727 vitest tests, build, 6 weapons e2e cases) and passed before Task 2 started: tracer verified end-to-end, expanding.

## Files Created/Modified

- `web/src/render/missile_instances.js` - missile InstancedMesh, orientation, tail trail puffs
- `web/test/render/missile_instances.test.js` - 12 tests: placement, orientation, clamping, colour, nose direction, cadence, tier scaling, rotation, shrinking count
- `web/src/main.js` - creation, prewarm, per-frame update, `fx.missilesDrawn`
- `tools/e2e/weapons.spec.js` - homing case: MISSILE_N > 0, `fx.missilesDrawn` > 0 and particles spawned within 3 s of holding Space
- `tools/perf_node.mjs` - weapon/level sweep, idle-weapon detection, usage errors
- `package.json` - perf script with `--weapon all --level 5`
- `Makefile` - perf help text (command unchanged, no new target needed)

## Decisions Made

- The missile model is a lathe pointing -Z baked with HDR violet vertex colours (MeshBasicMaterial), so it blooms like the other weapon effects; the instance rotation is about Y by minus the angle so the nose follows the same (sin a, -cos a) heading the bolts use.
- The trail cadence only advances when it emits, so a long stall produces one puff set, not a catch-up burst.
- The harness validates `--weapon` itself and adds an idle-weapon check (T-02-28), because the entrypoint falls back silently to vulcan for unknown names and a held-fire run of a non-producing weapon would otherwise pass while measuring an idle game.

## Deviations from Plan

### Auto-added Critical Functionality

**1. [Rule 2 - Missing Critical] Idle-weapon detection in the perf sweep**
- **Found during:** Task 2
- **Issue:** The threat register (T-02-28) requires that a silently skipped weapon cannot pass the gate. Printing one line per weapon and checking the budget does not catch a weapon that fires nothing (for example if a loadout bug left homing idle), because an idle game is also fast.
- **Fix:** Each run tracks the peak of the weapon's output header slot (PBULLET_N, BEAM_W, MISSILE_N) over the measured ticks, prints it as `peak_output`, and fails the run when fire is held and the peak is 0.
- **Files modified:** tools/perf_node.mjs
- **Verification:** `npm run perf` shows non-zero peaks for all three weapons; a `--fire 0` run reports 0 without failing.
- **Committed in:** fbecdb9 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Strengthens the planned mitigation only. No scope creep; JSON lines gain `level` and `peak_output` fields.

## Issues Encountered

None. The harness is a Node script, so it has no unit-test harness in the repo; Task 2's `tdd="true"` behaviours (all-weapons sweep, single weapon, bad weapon, legacy numeric flags, over-budget exit code) were verified by running the tool directly rather than by a RED test commit, which is why Task 2 has a single `feat` commit.

## Known Stubs

None.

## Threat Flags

None. The change adds no network, auth or file-access surface; trail puffs go through the fixed-capacity particle rings and no packages were added.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- PLYR-04 and PLYR-05 are on screen for all three colours; the missile channel is consumed.
- Open human check (end-of-phase UAT): at `npm run preview`, `http://localhost:4173/?debug&weapon=homing&level=5`, missiles should fan out and curve onto enemies with violet trails, clearly not pink.
- Phone measurement of the same weapon sweep stays with plan 02-33.

## Self-Check: PASSED

- FOUND: web/src/render/missile_instances.js
- FOUND: web/test/render/missile_instances.test.js
- FOUND commit 6d899f4 (Task 1) and fbecdb9 (Task 2) in `git log`
- `make check` (lint, 727 vitest tests, build, 56 Playwright tests) exited 0 before the final commit; `npm run perf` and `make perf` exited 0 with three JSON lines at or below 3 ms; `node tools/perf_node.mjs --weapon plasma` exited 2.

---
*Phase: 02-arcade-shooting-feel*
*Completed: 2026-10-18*
