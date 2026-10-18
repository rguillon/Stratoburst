---
phase: 03-stage-1-vertical-slice
plan: 04
subsystem: boundary
tags: [protocol, header, url-flags, stage-default, e2e, tdd]

requires:
  - phase: 03-stage-1-vertical-slice
    provides: StageData, StageDirector, STAGE_1 and Game(stage=, at=) from plan 03-01
provides:
  - Protocol 3 with a 64-slot header (Phase 3 state at slots 30-49, 50-63 reserved for Phase 4)
  - Event ids 13-23, BLAST_HUGE and the raised caps (ENEMY_CAP 64, PICKUP_CAP 40, 400 gameplay enemy bullets, ENEMY_MAX_ALIVE 56)
  - FlowState IntEnum, manifest flow_states and stage
  - Stage 1 as the default game, ?gallery for the Phase 2 gallery, ?at=midboss|boss
  - Live SCROLL_RATE extrapolation in the renderer
affects: [03-05, 03-06, 03-07, 03-08, 03-11, 03-12, 03-17, 03-21, 03-27]

plan_head_before: ee3f46c
plan_head_after: 53db43efcd4db4c9843b519bab4751da757ac93a

actuals:
  tokens: 9267
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Protocol numbering is fixed once in protocol.py; later plans only fill header values"
    - "Untrusted URL values are allow-listed on both sides (JS pick/AT_MARKERS, Python _at/_flag)"
    - "bootGame appends gallery unless a spec asks for the stage, so Phase 2 specs stay on the gallery"

key-files:
  created:
    - src/scorched_core/stages/flow_state.py
    - tests/scorched_core/stages/test_flow_state.py
    - tools/e2e/stage.spec.js
  modified:
    - src/scorched_core/protocol.py
    - src/scorched_core/tuning.py
    - src/scorched_core/game/game.py
    - src/scorched_web/entrypoint.py
    - web/src/boot/url_flags.js
    - web/src/python/python_bridge.js
    - web/src/main.js
    - tools/e2e/helpers.js
    - tools/perf_node.mjs
    - tests/scorched_core/game/test_game.py
    - tests/scorched_core/stages/test_gallery_spawner.py
    - tests/scorched_web/test_entrypoint.py
    - web/test/boot/url_flags.test.js
    - web/test/python/python_bridge.test.js

key-decisions:
  - "The gallery manifest stage borrows STAGE_1.length with number 0, no markers and loop True, as the plan specifies"
  - "FLOW is the constant PLAY (1) in stage mode until StageFlow (03-08) exists, and -1 in the gallery"
  - "create_game drops ?at= entirely for a gallery game, so a stale at flag can never raise"

patterns-established:
  - "A Python-side flag that only matters in one mode is resolved once in create_game (gallery) and then gates the dependent options"

requirements-completed: [ENMY-05, ENMY-01]

coverage:
  - id: D1
    description: "Protocol 3: 64-slot header, slots 30-49, events 13-23, BLAST_HUGE, raised caps, flow_states and stage in the manifest"
    requirement: ENMY-05
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_manifest_contract; #test_protocol_three_header_slots_30_to_49_carry_the_phase_three_state; #test_the_raised_caps_are_part_of_protocol_three"
        status: pass
      - kind: unit
        ref: "web/test/python/python_bridge.test.js#startGame"
        status: pass
    human_judgment: false
  - id: D2
    description: "The link opens on stage 1; ?gallery (real True in Python) brings back the Phase 2 gallery"
    requirement: ENMY-05
    verification:
      - kind: unit
        ref: "tests/scorched_web/test_entrypoint.py#test_no_options_build_stage_one; #test_a_gallery_value_that_is_not_a_real_true_builds_the_stage"
        status: pass
      - kind: e2e
        ref: "tools/e2e/stage.spec.js"
        status: pass
    human_judgment: false
  - id: D3
    description: "?at=midboss|boss starts just before the marker, anything else is ignored on both sides"
    requirement: ENMY-01
    verification:
      - kind: unit
        ref: "tests/scorched_web/test_entrypoint.py#test_the_at_option_starts_the_stage_just_before_the_marker"
        status: pass
      - kind: unit
        ref: "web/test/boot/url_flags.test.js"
        status: pass
      - kind: e2e
        ref: "tools/e2e/stage.spec.js#?at=boss"
        status: pass
    human_judgment: false
  - id: D4
    description: "Terrain and ground units extrapolate with the live SCROLL_RATE so a crawl never stutters"
    verification:
      - kind: e2e
        ref: "tools/e2e/playfield.spec.js; tools/e2e/ground.spec.js"
        status: pass
    human_judgment: true
    rationale: "Smoothness of the ground under a changing scroll speed is a visual judgment; the specs only prove nothing regressed at constant speed (no variable-speed stage content exists yet)"

duration: 13min
completed: 2026-10-18
status: complete
---

# Phase 3 Plan 04: Stage 1 as the Default Game over Protocol 3 Summary

**Protocol 3 boundary (64-slot header, events 13-23, HUGE blasts, raised caps) with stage 1 as the default game, `?gallery` for the Phase 2 gallery, allow-listed `?at=midboss|boss` jumps and live scroll-rate extrapolation**

## Performance

- **Duration:** 13 min
- **Started:** 2026-10-18T16:12:00Z
- **Completed:** 2026-10-18T16:25:00Z
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments
- The boundary is protocol 3: slots 30-49 carry the Phase 3 state, 50-63 are reserved for Phase 4, events 13-23 and BLAST_HUGE are exported by name, and the bridge rejects any other protocol before allocating anything.
- `create_game` builds `Game(stage=STAGE_1)` by default; `?gallery` (a real boolean True in Python) keeps the shooting gallery, and every Phase 2 e2e spec and every `make perf` run is pinned to the gallery.
- The manifest publishes `flow_states` and `stage`; the header shows STAGE, FLOW, STAGE_DIST and SCROLL_RATE (stage 1 / PLAY in stage mode, 0 / -1 in the gallery).
- `?at=midboss` / `?at=boss` start the stage `AT_LEAD` before the marker; any other value is ignored on both sides, and the gallery ignores it.
- main.js extrapolates the terrain and ground units with the live SCROLL_RATE slot instead of the constant manifest speed.

## Task Commits

1. **Task 1: Tracer, stage 1 default over protocol 3 with ?gallery** - `9d8e13e` (test, RED), `74b19d9` (feat, GREEN)
2. **Task 2: ?at= jumps and live scroll-rate extrapolation** - `3dd8a81` (test, RED), `53db43e` (feat, GREEN)

**Plan metadata:** recorded in the docs commit following this summary.

## TDD Gate Compliance

Both tasks have a `test(03-04)` commit before the `feat(03-04)` commit. RED evidence, semantic assessment:
- Task 1 RED: the JS tests failed on real assertions (`protocol 4 ... expected 2` instead of 3, header length, the `gallery` key missing). The Python RED was a collection failure by nature: the new constants (`H_FLOW`, ...) and the `flow_state` module did not exist, so the tests could not import. The planned assertions were fully specified in the tests and all passed only after the implementation.
- Task 2 RED: `test_the_at_option_starts_the_stage_just_before_the_marker` failed on its assertion (start distance 0 against marker minus `AT_LEAD`) and nine `url_flags` cases failed on the missing `at` key.

## Files Created/Modified
- `src/scorched_core/protocol.py` - protocol 3 table: header slots, events, BLAST_HUGE, caps
- `src/scorched_core/stages/flow_state.py` - FlowState IntEnum
- `src/scorched_core/game/game.py` - slot/event/blast maps, `flow_states` and `stage` manifest, header packing
- `src/scorched_web/entrypoint.py` - stage default, `gallery`, `_at` allow-list
- `web/src/boot/url_flags.js`, `web/src/python/python_bridge.js`, `web/src/main.js` - flags, protocol check, SCROLL_RATE extrapolation
- `tools/e2e/helpers.js`, `tools/perf_node.mjs`, `tools/e2e/stage.spec.js` - gallery pinning and the stage spec

## Decisions Made
- Followed the plan as specified; the gallery stage manifest borrows STAGE_1's length, FLOW is a constant PLAY until plan 03-08.
- `at` is resolved only when the game is a stage game, so a gallery URL carrying `at` can never raise.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Phase 2 test pinned the old enemy cap**
- **Found during:** Task 1 (GREEN)
- **Issue:** `test_a_refused_spawn_is_skipped_never_queued` hard-coded 40 live enemies, which `ENEMY_MAX_ALIVE = 56` now exceeds.
- **Fix:** assert `ENEMY_MAX_ALIVE` instead of the literal.
- **Files modified:** tests/scorched_core/stages/test_gallery_spawner.py
- **Verification:** full pytest at 100% coverage
- **Committed in:** 74b19d9

---

**Total deviations:** 1 auto-fixed (1 bug in a stale test literal)
**Impact on plan:** None on scope; the file is outside files_modified but the change is a one-line literal.

## Issues Encountered
- ruff import sorting disagrees about a not-yet-existing first-party module, so the RED commit carries the `flow_state` import in an order ruff fixed once the module existed (GREEN). The RED commit was therefore not ruff-clean on import order only.
- The per-plan commit ledger (protocol 0c) was not created before the first commit; `plan_head_before` is the parent of the first plan commit (`ee3f46c`).

## Known Stubs
None. FLOW is the constant PLAY and the remaining Phase 3 slots stay at 0 by design (documented in the plan table: later plans fill them).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Ready for 03-05 onward: every Phase 3 plan fills the slots and events defined here.
- Full gates green: `make lint`, `make test` (1164 pytest at 100% line+branch, 57 vitest files), `make perf` (0.53-0.68 ms avg against 3 ms), `make build`, and the whole `make e2e` suite (77 passed).

## Self-Check: PASSED

Created files exist (flow_state.py, test_flow_state.py, stage.spec.js); commits 9d8e13e, 74b19d9, 3dd8a81 and 53db43e are ancestors of HEAD; all acceptance greps match.

---
*Phase: 03-stage-1-vertical-slice*
*Completed: 2026-10-18*
