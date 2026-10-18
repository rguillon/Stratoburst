---
phase: 02-arcade-shooting-feel
plan: 28
subsystem: hitstop-and-screen-shake
tags: [hitstop, screen-shake, camera, effect-clock, python, three.js, playwright]

requires:
  - phase: 02-arcade-shooting-feel
    provides: "02-22 bomb (step returns True on detonation), 02-25 and 02-15 PlayerLife death step, 02-26 deathbomb, 02-02 events dispatcher, 02-27 debug hooks and e2e helpers"
provides:
  - "Hitstop (clock/hitstop.py): trigger(ticks) keeps the max, consume() freezes one step; Game._step returns first thing while it lasts, so nothing moves and TICK_COUNT stays put"
  - "Header slot 14 HITSTOP (steps still frozen); tuning HITSTOP_BOMB_TICKS 4 and HITSTOP_DEATH_TICKS 6"
  - "fx/shake.js: createShake (seeded decaying jitter, 3.0 / 0.5 s bomb and 1.6 / 0.35 s death, hard ceilings 3.0 and 0.5 s), withCameraOffset (try/finally restore), effectClockDelta"
  - "main.js holds the effect clock and the extrapolation alpha during hitstop and pause, and renders through withCameraOffset"
  - "Debug hooks fx.shakes and fx.hitstopFrames; e2e assertions on the bomb and death specs"
affects: [02-33-device-gate, phase-3-boss-hits, phase-4-audio]

actuals:
  tokens: 36000
  tasks: 2
  commits: 3
plan_head_before: ad8979b4ad9b83cdb036624fde9c849bc90c817e
plan_head_after: 84768177adc5651e3fb9229a4d30ef5436b4c911

tech-stack:
  added: []
  patterns:
    - "Deterministic freeze in Python: a gate at the top of _step swallows steps; latched inputs are resolved after the gate so presses survive"
    - "Render-only camera shake: offset applied immediately before the render call and removed in a finally, so every other reader sees the unshaken camera"
    - "One tested helper (effectClockDelta) owns the freeze rule for the JS effect clock"

key-files:
  created:
    - src/scorched_core/clock/hitstop.py
    - tests/scorched_core/clock/test_hitstop.py
    - web/src/fx/shake.js
    - web/test/fx/shake.test.js
  modified:
    - src/scorched_core/protocol.py
    - src/scorched_core/tuning.py
    - src/scorched_core/game/game.py
    - tests/scorched_core/game/test_game.py
    - web/src/main.js
    - tools/e2e/bomb.spec.js
    - tools/e2e/death.spec.js

key-decisions:
  - "Hitstop triggers only on the bomb detonation return value and on the confirmed death step (life.step True), never on the grace hit, so the 8-step deathbomb window is never eaten"
  - "The shake samples its jitter once per update (not per offset call) and update(0) holds both age and jitter, so a paused game does not keep shaking and resumes where it stopped"
  - "The jitter is a random angle at radius amplitude * quadratic envelope, so its magnitude never exceeds the amplitude; trigger clamps to MAX_AMPLITUDE 3.0 and MAX_DURATION_S 0.5"
  - "A weaker trigger during a stronger shake is compared against the strength left now, so a faded bomb shake is replaced by a fresh death shake"
  - "Bomb request resolution moved to Game._resolve_bomb_request so _step stays under the ruff branch limit; behaviour unchanged"

patterns-established:
  - "Tests that count ticks on a mortal default Game use god=True once deaths freeze steps (tick_count excludes frozen steps)"
  - "A bomb-detonation test thaws with _thaw(game) before asserting the first blast step"

requirements-completed: [VISL-04]

coverage:
  - id: D1
    description: "A bomb detonation freezes the simulation for 4 steps, header HITSTOP reports the steps left, frozen steps leave every buffer and TICK_COUNT identical"
    requirement: VISL-04
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_hitstop_frozen_steps_identical_then_the_simulation_resumes"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/clock/test_hitstop.py"
        status: pass
    human_judgment: false
  - id: D2
    description: "A player death freezes 6 steps; a grace hit, ordinary hits and 20 kills never freeze; the deathbomb window keeps its full 8 live steps"
    requirement: VISL-04
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_death_hitstop_the_death_step_freezes_six_steps_to_come"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_no_hitstop_on_kills_twenty_kills_by_bolts_and_missiles_never_freeze"
        status: pass
    human_judgment: false
  - id: D3
    description: "Inputs survive the freeze: a bomb press during hitstop is latched and fires on the first live step; paused ticks never count the freeze down"
    requirement: VISL-04
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_hitstop_a_bomb_press_during_the_freeze_is_latched_and_fires_on_the_first_live_step"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_hitstop_a_paused_tick_leaves_the_freeze_unchanged"
        status: pass
    human_judgment: false
  - id: D4
    description: "Shake is render-only: bounded decaying jitter, exact camera restore even when render throws, only BOMB_DETONATE and PLAYER_DEATH trigger it"
    requirement: VISL-04
    verification:
      - kind: unit
        ref: "web/test/fx/shake.test.js#createShake"
        status: pass
      - kind: unit
        ref: "web/test/fx/shake.test.js#withCameraOffset"
        status: pass
      - kind: e2e
        ref: "tools/e2e/bomb.spec.js#a detonation shakes the screen and freezes the action for a few frames"
        status: pass
      - kind: e2e
        ref: "tools/e2e/death.spec.js#a mortal idle ship dies, flies back in and blinks invulnerable"
        status: pass
    human_judgment: false
  - id: D5
    description: "Nothing jitters during the freeze and the effect clock holds while paused (effectClockDelta, alpha 0 during hitstop)"
    requirement: VISL-04
    verification:
      - kind: unit
        ref: "web/test/fx/shake.test.js#effectClockDelta"
        status: pass
    human_judgment: true
    rationale: "Whether the freeze and shake feel right (ground, wrecks and particles hold still, no stutter, touch drag tracks 1:1 right after a shake, ordinary kills stay smooth) is a feel judgment; the plan's human-check covers it at http://localhost:4173/?debug"

# Metrics
duration: 18min
completed: 2026-10-18
status: complete
---

# Phase 2 Plan 28: Hitstop and Screen Shake Summary

**Bombs and deaths now hit hard: a deterministic Python hitstop (4 steps on detonation, 6 on death, header slot 14) freezes the simulation while a render-only seeded camera shake (3.0 over 0.5 s, 1.6 over 0.35 s) jolts the screen, and ordinary hits and kills never do either.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-10-18T07:13:00Z
- **Completed:** 2026-10-18T07:31:00Z
- **Tasks:** 2
- **Files modified:** 11 (4 created, 7 modified)

## Accomplishments

- `Hitstop` is a two-method dataclass; `Game._step` begins with `if self.hitstop.consume(): return`, so a frozen step moves nothing, advances no TICK_COUNT, and leaves the latched bomb press for the first live step. Overlapping triggers keep the larger value; the freeze never counts down while paused.
- The bomb detonation (the `bomb.step` return value) triggers 4 frozen steps and the confirmed death step triggers 6, never the grace hit, so the 8-step deathbomb window is untouched.
- `shake.js` adds a seeded, quadratically decaying jitter, `withCameraOffset` (try/finally restore of position and matrix, tested with a throwing render) and `effectClockDelta`. `main.js` holds the effect clock and uses alpha 0 for the terrain and ground units while HITSTOP is above zero, holds the clock while paused, and renders through `withCameraOffset`.
- Tracer gate: the Task 1 verify (ruff, 100% pytest, vitest, perf, build, bomb/touch/playfield Playwright) passed end to end before the death work started. Full `make check` (lint, 1008 pytest at 100% line+branch, 867 vitest, build, 65 Playwright) passes; perf averages 0.55-0.70 ms against the 3 ms budget.

## Task Commits

1. **Task 1: Tracer, bomb detonation freeze and shake** - `c114313` (feat)
2. **Task 2 (TDD RED): failing tests for death hitstop, death shake, effect clock** - `18ecbb3` (test)
3. **Task 2 (TDD GREEN): death freeze and shake, effectClockDelta, death e2e** - `8476817` (feat)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## Files Created/Modified

- `src/scorched_core/clock/hitstop.py` - Hitstop: trigger keeps the max, consume freezes one step
- `tests/scorched_core/clock/test_hitstop.py` - unit tests for the max rule and the countdown
- `src/scorched_core/protocol.py` - H_HITSTOP = 14
- `src/scorched_core/tuning.py` - HITSTOP_BOMB_TICKS 4, HITSTOP_DEATH_TICKS 6
- `src/scorched_core/game/game.py` - hitstop gate in `_step`, triggers, header slot, `_resolve_bomb_request` extraction
- `tests/scorched_core/game/test_game.py` - hitstop behaviour tests (identical frozen steps, latch, pause, death, no-hitstop-on-kills); existing detonation tests thaw the freeze
- `web/src/fx/shake.js` - createShake, withCameraOffset, effectClockDelta, SHAKE_BOMB, SHAKE_DEATH
- `web/test/fx/shake.test.js` - decay to zero, ceilings, stronger-wins, per-event idle checks, camera restore, effect clock
- `web/src/main.js` - hitstop/pause aware frame loop, shake in the dispatcher, render wrapper, debug hooks
- `tools/e2e/bomb.spec.js`, `tools/e2e/death.spec.js` - shake and hitstop assertions

## Decisions Made

See `key-decisions` in the frontmatter. The notable ones: the shake samples its jitter once per update so a paused game holds a still frame, and `trigger` compares a new shake against the strength left now rather than the original amplitude.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extracted `_resolve_bomb_request` from `_step`**
- **Found during:** Task 1 (ruff after adding the hitstop gate)
- **Issue:** The gate plus the bomb trigger pushed `_step` to 13 branches, over ruff's PLR0912 limit of 12, so the lint gate failed.
- **Fix:** Moved the bomb request block into `Game._resolve_bomb_request`; the order of operations is identical and the gate is still the first statement of `_step`.
- **Files modified:** src/scorched_core/game/game.py
- **Verification:** ruff clean, all existing bomb and deathbomb tests unchanged and green
- **Committed in:** c114313

**2. [Rule 1 - Bug] Existing tests assumed a detonation freezes nothing**
- **Found during:** Task 1 and Task 2 (full pytest)
- **Issue:** Five bomb tests counted steps from the detonation and four runner tests counted steps on a mortal idle ship that now dies and freezes, so `tick_count` no longer equals steps run.
- **Fix:** Added a `_thaw` helper and extended the tick counts by HITSTOP_BOMB_TICKS in the bomb tests; the runner and fault tests use `god=True` since they test the runner, not death.
- **Files modified:** tests/scorched_core/game/test_game.py
- **Verification:** full suite green at 100% coverage
- **Committed in:** c114313, 8476817

**3. [Rule 2 - Missing critical] Trigger ceilings and bad-input guard in the shake**
- **Found during:** Task 1 (prohibition: a shake must not last longer than 0.5 s or exceed its tuned amplitude)
- **Issue:** The plan's `trigger(amplitude, durationS)` accepted any value, so a future caller could break the motion-comfort limit.
- **Fix:** `trigger` clamps to MAX_AMPLITUDE 3.0 and MAX_DURATION_S 0.5 and ignores non-positive or NaN input; covered by unit tests.
- **Files modified:** web/src/fx/shake.js, web/test/fx/shake.test.js
- **Committed in:** c114313

---

**Total deviations:** 3 auto-fixed (1 blocking, 1 bug, 1 missing critical)
**Impact on plan:** All necessary for the lint gate, the gate suite and the plan's own comfort prohibition. No scope creep.

## Issues Encountered

- A bomb press during hitstop cannot literally launch a second bomb after the freeze in either real scenario (the bomb is still burning after a detonation, and the ship cannot control while DYING), so the latch is tested both ways: with an artificial freeze on an idle bomb it launches on the first live step, and during the real bomb freeze the press stays latched until the first live step consumes it.
- The Task 2 `<human-check>` (feel of the freeze and shake at `http://localhost:4173/?debug`, touch tracking after a shake) is harvested by the verifier at end of phase; it was not run interactively here.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Next Phase Readiness

- Boss parts and boss deaths in Phase 3 can reuse `hitstop.trigger` and `shake.trigger` directly.
- The HITSTOP header slot and `fx.shakes` / `fx.hitstopFrames` hooks are available to the 02-33 device gate and the device report.

## Self-Check: PASSED

- Created files exist: hitstop.py, test_hitstop.py, shake.js, shake.test.js (FOUND)
- Commits present on HEAD: c114313, 18ecbb3, 8476817 (FOUND)
- `self.hitstop.consume()` is in `_step`; `withCameraOffset(` replaces the bare render call in main.js
- `make check` passes (lint, 100% coverage, vitest, build, full Playwright); `npm run perf` under budget

---
*Phase: 02-arcade-shooting-feel*
*Completed: 2026-10-18*
