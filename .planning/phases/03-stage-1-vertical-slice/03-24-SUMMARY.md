---
phase: 03-stage-1-vertical-slice
plan: 24
subsystem: audio
tags: [sfx, zzfx, sfx-router, sfx-table, voice-priority, playwright, tdd]

requires:
  - phase: 03-stage-1-vertical-slice
    provides: EV_MEDAL, EV_EXTEND, EV_PART_DESTROYED, EV_BOSS_*, EV_STAGE_CLEAR, EV_TALLY_LINE, EV_GAME_OVER and BLAST_HUGE (03-04); the stage flow that pushes EV_BOSS_WARNING (03-21 and earlier); the Phase 2 SfxId router and zzfx table pattern (D-29)
provides:
  - SfxId values 18-27 (EXPLODE_HUGE, WARNING, EXTEND, MEDAL, PART_DESTROY, BOSS_PHASE, BOSS_DEFEAT, TALLY_TICK, STAGE_CLEAR, GAME_OVER), appended, never renumbered
  - sfx_router arms for every stage event (a _STAGE_SOUNDS lookup) and a fourth _EXPLOSIONS entry for the HUGE blast; EV_BOSS_RETREAT and EV_STAGE_START stay silent
  - ten sfx_table.js entries designed in the ZzFX style, the five big stage moments above every gameplay sound in voice priority
  - tools/e2e/stage_audio.spec.js (at ?at=boss the voice count rises as FLOW enters WARNING)
affects: [03-28 vertical-slice gate, end-of-phase listening review]

actuals:
  tokens: 4800
  tasks: 2
  commits: 3
plan_head_before: 24f6743144b90b0031a6b5c7d27dcf7aaa4e5f69
plan_head_after: 40b19afc092ee0b7634bebf344387ad508192ccb

tech-stack:
  added: []
  patterns:
    - "One-to-one stage events route through a module-level dict (_STAGE_SOUNDS) so the _sound_for match stays under the branch-complexity limit"
    - "Voice priority tiers: 1 noise, 5-8 gameplay, 10 player/bomb, 11-13 the big stage moments"

key-files:
  created:
    - tools/e2e/stage_audio.spec.js
  modified:
    - src/scorched_core/audio/sfx_id.py
    - src/scorched_core/audio/sfx_router.py
    - web/src/audio/sfx_table.js
    - tests/scorched_core/audio/test_sfx_id.py
    - tests/scorched_core/audio/test_sfx_router.py
    - web/test/audio/sfx_table.test.js

key-decisions:
  - "Stage-sound priorities: WARNING 12, EXTEND 11, BOSS_DEFEAT 13, STAGE_CLEAR 12, GAME_OVER 12 (all above the Phase 2 maximum of 10); EXPLODE_HUGE 6, MEDAL 6, PART_DESTROY 6, BOSS_PHASE 8, TALLY_TICK 7"
  - "TALLY_TICK cooldown 120 ms (a tally line is 60 steps, one second) and MEDAL cooldown 60 ms, so every line ticks and medals 100 ms apart both play"
  - "The WARNING is a two-tone alarm built from a pitch jump timed at 0.5 s and a 0.34 s pulse period, because the ZzFX repeat folds the jump into the start pitch and cannot alternate tones indefinitely"
  - "The existing 'highest priority' and 'bomb blast is the longest' table tests are scoped to the 18 Phase 2 gameplay names, since the stage sounds are deliberately above and longer than them"

patterns-established:
  - "The table test's SFX_ID_NAMES list is the Python enum in order; GAMEPLAY_NAMES = its first 18 entries scopes Phase 2 mix rules"

requirements-completed: [ENMY-06, SCOR-02, SCOR-03, SCOR-04, SCOR-05]

coverage:
  - id: D1
    description: "Every stage event routes to its own SfxId and a HUGE blast plays EXPLODE_HUGE; the retreat and stage start stay silent"
    requirement: "ENMY-06"
    verification:
      - kind: unit
        ref: "tests/scorched_core/audio/test_sfx_router.py (each_gameplay_event_routes_to_its_own_sound, a_boss_retreat_and_a_stage_start_stay_silent)"
        status: pass
    human_judgment: false
  - id: D2
    description: "SfxId appends 18-27 contiguously and the zzfx table has one full-shape entry per name, in enum order"
    verification:
      - kind: unit
        ref: "tests/scorched_core/audio/test_sfx_id.py; web/test/audio/sfx_table.test.js#SFX_TABLE covers every sound"
        status: pass
    human_judgment: false
  - id: D3
    description: "The boss WARNING starts a voice at ?at=boss in the production build"
    requirement: "SCOR-05"
    verification:
      - kind: e2e
        ref: "tools/e2e/stage_audio.spec.js (also fails when the WARNING router arm is removed)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The big stage moments outrank gameplay noise in the voice limiter; the tally tick and medal cooldowns allow one tick per line and two catches 100 ms apart"
    requirement: "SCOR-02"
    verification:
      - kind: unit
        ref: "web/test/audio/sfx_table.test.js#the stage sounds keep their place in the mix; tests/scorched_core/audio/test_sfx_router.py#test_past_the_soft_cap_the_noise_is_refused_before_a_stage_sound_is"
        status: pass
    human_judgment: false
  - id: D5
    description: "The synthesized sounds themselves: the alarm is unmistakable, the extend chime is distinct from pickups, the tally ticks per line, the boss defeat sounds bigger than a bomb"
    requirement: "SCOR-03"
    verification: []
    human_judgment: true
    rationale: "Sound character is judged by ear with speakers at the end-of-phase review; tests only prove shape (finite, audible samples, pitch direction, duration ordering)"

duration: 12min
completed: 2026-10-18
status: complete
---

# Phase 03 Plan 24: Stage Event Sounds Summary

**Ten new zzfx sounds (huge boom, boss alarm, extend chime, medal ping, part crunch, phase whoosh, boss defeat, tally tick, stage-clear fanfare, game-over sting) routed from every stage event in Python, with the big moments outranking gunfire in the voice limiter**

## Performance

- **Duration:** about 12 min
- **Completed:** 2026-10-18
- **Tasks:** 2
- **Files modified:** 7 (1 created)

## Accomplishments
- `SfxId` grew to 28 values (18-27 appended); the router maps EV_MEDAL, EV_EXTEND, EV_PART_DESTROYED, EV_BOSS_WARNING, EV_BOSS_PHASE, EV_BOSS_DEFEATED, EV_TALLY_LINE, EV_STAGE_CLEAR and EV_GAME_OVER, and a BLAST_HUGE explosion plays EXPLODE_HUGE (the clamp now tops out at HUGE).
- Ten `SFX_TABLE` entries, designed by the executor (research fabricated none): the WARNING is a pulsing low-passed saw that holds 880 Hz then drops 330 Hz inside its second; the EXTEND and STAGE_CLEAR use the repeat/pitch-jump staircase for rising arpeggios; BOSS_DEFEAT is the longest sound in the table.
- The WARNING, EXTEND, BOSS_DEFEAT, STAGE_CLEAR and GAME_OVER priorities (11-13) sit above every Phase 2 sound (max 10), and none of the stage sounds is low priority at the event ring, so they survive a busy ring that refuses shots.
- `stage_audio.spec.js` proves at `?at=boss` that the voice count rises as FLOW enters WARNING (verified to fail when the router arm is removed).

## Task Commits

1. **Task 1 (tracer): the boss WARNING plays an alarm and every stage event has a routed, synthesized sound**
   - `e5a459e` test (RED: enum, router, table list, sound shape tests, e2e spec)
   - `d67ac22` feat (GREEN: enum, router, ten table entries)
2. **Task 2: stage sounds keep their place in the mix under load** - `40b19af` (test)

**Plan metadata:** the docs commit that carries this SUMMARY.

## Files Created/Modified
- `src/scorched_core/audio/sfx_id.py` - SfxId 18-27
- `src/scorched_core/audio/sfx_router.py` - `_EXPLOSIONS` with HUGE, `_STAGE_SOUNDS` lookup
- `web/src/audio/sfx_table.js` - ten new entries with volume, cooldown and priority
- `tests/scorched_core/audio/test_sfx_id.py`, `test_sfx_router.py`, `web/test/audio/sfx_table.test.js` - enum, routing, ring-pressure, shape, priority and cooldown tests
- `tools/e2e/stage_audio.spec.js` - the WARNING voice-count check

## TDD Gate Compliance

- **RED (`e5a459e`):** `test_sfx_id` failed on the assertion for the 28-name enum; the vitest run failed 19 tests (the 28-name list, missing table entries). The router test module failed at collection (`SfxId.EXPLODE_HUGE` absent), which is an import-time failure, not an assertion failure, so the router RED rests on the enum assertion failing and the JS assertion failures. Semantic assessment: each failure was for the planned missing behavior (no new ids, no new entries). The formal `check tdd-red-evidence` classifier was not run (plan is `type: execute`, not `type: tdd`).
- **GREEN (`d67ac22`):** all audio tests pass, 100% coverage, lint clean.
- **Task 2 (`40b19af`):** the priority and cooldown tests were green on arrival because Task 1's table entries already carried the priorities the plan's Task 1 action specifies; they are regression locks. A mutation check (cooldown 1200 ms, EXTEND priority 9) made two of them fail, then the table was restored.
- No REFACTOR commit; the router branch-count lint fix (the `_STAGE_SOUNDS` dict) was folded into the GREEN commit.

## Decisions Made
See key-decisions. The main judgment call: the alarm is a one-shot two-tone drop, not an endless alternation, because ZzFX's repeat carries the pitch jump into the start pitch.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Existing table mix tests contradicted the new stage sounds**
- **Found during:** Task 1 (GREEN)
- **Issue:** "death, bomb blast and player hit have the highest priority" and "the bomb blast is the longest sound" were written against 18 sounds; the plan's required priorities (above every gameplay sound) and BOSS_DEFEAT's long tail break them by design.
- **Fix:** scoped both to the 18 Phase 2 gameplay names (`GAMEPLAY_NAMES`).
- **Files modified:** web/test/audio/sfx_table.test.js
- **Committed in:** `e5a459e`

**2. [Rule 1 - Lint] PLR0912 on `_sound_for` after nine new match arms**
- **Found during:** Task 1 (lint gate)
- **Fix:** the one-to-one stage events moved to a `_STAGE_SOUNDS` dict read in the default arm.
- **Files modified:** src/scorched_core/audio/sfx_router.py
- **Committed in:** `d67ac22`

---

**Total deviations:** 2 auto-fixed (both Rule 1, test scope and lint)
**Impact on plan:** none on behavior; no scope creep.

## Issues Encountered
- The tracer's `<human-check>` (alarm, chime, tick and boss defeat by ear) cannot be done by an agent. With `human_verify_mode: end-of-phase` and auto mode off, it was not turned into a mid-plan checkpoint: the plan itself schedules it for the end-of-phase review, and the automated verify was re-run and passed (`make lint`, `make test`, `make build`, stage_audio and audio specs).
- Mid-run, `test_sfx_router.py` also gained the Task 2 ring-pressure tests during the RED commit; Task 2's commit added the remaining soft-cap-versus-noise test.

## Known Stubs
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Stage events are audible. The sound design is untuned: judge the ten new sounds by ear at the end-of-phase review (the table params are plain ZzFX designer values and easy to retune; only the shape tests would need to follow a change that alters pitch direction or duration ordering).
- `plan 03-23` (human checkpoint, same wave) is independent of this plan.

## Self-Check: PASSED

- FOUND: tools/e2e/stage_audio.spec.js
- FOUND commits: e5a459e, d67ac22, 40b19af (ancestors of HEAD)
- `GAME_OVER = 27`, `EV_BOSS_WARNING`, `EXPLODE_HUGE`, `TALLY_TICK` greps match; `make lint`, `make test` (2093 pytest at 100% coverage, 1596 vitest), `make build`, and stage_audio + audio Playwright specs all pass; `vitest -t priority` and `pytest tests/scorched_core/audio` pass.

---
*Phase: 03-stage-1-vertical-slice*
*Completed: 2026-10-18*
