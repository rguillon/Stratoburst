---
phase: 02-arcade-shooting-feel
plan: 30
subsystem: audio
tags: [sfx, event-ring, python-core, deterministic-routing, pytest]

requires:
  - phase: 02-arcade-shooting-feel
    provides: "EventRing with low-priority pushes (02-01), gameplay event kinds (02-01..02-27), hitstop gate in Game._step (02-28)"
provides:
  - "SfxId IntEnum (EXPLODE_SMALL 0 ... LASER_HUM 17)"
  - "route_sfx(events, start, end): gameplay events to SFX events (EV_SFX, a = SfxId)"
  - "manifest key sfx mapping every SfxId name to its value"
affects: [02-31 sound synthesis and playback, 02-32 mixing limits and iOS audio hardening]

actuals:
  tokens: 21000
  tasks: 2
  commits: 3
plan_head_before: e62f79315418d9f4ca0b907ceae270fc4deb1ff0
plan_head_after: 6841290a5c1cfa3da806fa4753ce4d285d1b31b2
commits: 3

tech-stack:
  added: []
  patterns:
    - "Module of functions with a match on dotted protocol constants, one arm per event kind and a single return"
    - "Router reads a slice [start, end) fixed on entry, so it never re-reads its own pushes"

key-files:
  created:
    - src/scorched_core/audio/__init__.py
    - src/scorched_core/audio/sfx_id.py
    - src/scorched_core/audio/sfx_router.py
    - tests/scorched_core/audio/test_sfx_id.py
    - tests/scorched_core/audio/test_sfx_router.py
  modified:
    - src/scorched_core/game/game.py
    - tests/scorched_core/game/test_game.py

key-decisions:
  - "The router runs at the end of every live step (after the hitstop gate, before the fault check) over the slice of events that step pushed, so a frozen step routes nothing"
  - "VULCAN, MISSILE, HIT and ENEMY_FIRE are pushed low priority and are the first refused at the ring's soft cap; a LASER shot is silent because the hum is driven by BEAM_W"
  - "Out-of-range blast classes clamp to the nearest explosion sound; unknown weapons and pickup outcomes are silent"

patterns-established:
  - "SFX selection lives in Python and is covered by pytest; JS only maps an id name from the manifest to a buffer"
  - "Game tests that count events go through _event_kinds, which filters out the router's SFX events"

requirements-completed: [AUDI-01]

coverage:
  - id: D1
    description: "SfxId enum with the 18 sound ids and the manifest sfx map"
    requirement: AUDI-01
    verification:
      - kind: unit
        ref: "tests/scorched_core/audio/test_sfx_id.py#test_sfx_ids_are_contiguous_from_zero_and_never_renumbered"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_manifest_publishes_every_sfx_id_by_name"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every explosion is followed by an SFX event for its blast class, wired into every live Game step"
    requirement: AUDI-01
    verification:
      - kind: unit
        ref: "tests/scorched_core/audio/test_sfx_router.py#test_an_explosion_is_followed_by_an_sfx_event_for_its_blast_class"
        status: pass
      - kind: integration
        ref: "tests/scorched_core/game/test_game.py#test_a_kill_step_follows_its_explosion_with_the_explosion_sound_id"
        status: pass
      - kind: e2e
        ref: "npx playwright test tools/e2e/smoke.spec.js tools/e2e/shooting.spec.js"
        status: pass
    human_judgment: false
  - id: D3
    description: "Shot, hit, pickup, enemy fire, player hit, death, respawn, bomb launch and detonate and deathbomb save each route to their own sound; noisy sounds are low priority; laser, unknown and SFX events are silent"
    requirement: AUDI-01
    verification:
      - kind: unit
        ref: "tests/scorched_core/audio/test_sfx_router.py#test_each_gameplay_event_routes_to_its_own_sound_at_the_same_position"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/audio/test_sfx_router.py#test_only_the_noisy_sounds_are_low_priority"
        status: pass
    human_judgment: false
  - id: D4
    description: "Frozen hitstop steps route no sound"
    requirement: AUDI-01
    verification:
      - kind: integration
        ref: "tests/scorched_core/game/test_game.py#test_a_frozen_hitstop_step_routes_no_sound_and_the_thawed_step_does"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-10-18
status: complete
---

# Phase 2 Plan 30: Deterministic SFX Routing Summary

**SfxId enum and a `route_sfx` router that turns every live step's gameplay events into low or high priority SFX events in the event ring, plus a manifest `sfx` map, all decided in Python (D-29).**

## Performance

- **Duration:** 10 min
- **Started:** 2026-10-18T07:51:15Z
- **Completed:** 2026-10-18T08:01:00Z
- **Tasks:** 2
- **Files modified:** 7 (5 created, 2 modified)

## Accomplishments

- `audio/` package: `SfxId` (18 ids, LASER_HUM reserved for the JS-driven beam loop) and `route_sfx(events, start, end)`.
- Every shot (by weapon), hit, explosion (by blast class), pickup (by outcome), enemy fire, player hit, death, respawn, bomb launch and detonation, and deathbomb save routes to its own sound id at the same position as its source event.
- Noisy sounds (VULCAN, MISSILE, HIT, ENEMY_FIRE) are pushed low priority so the ring's soft cap refuses them first; the router allocates nothing and stops at the slice end captured on entry.
- Game calls the router after the hitstop gate at the end of each live step, so frozen steps stay silent; the manifest publishes `sfx`.
- Perf unchanged: vulcan 0.69 ms, laser 0.55 ms, homing 0.63 ms average (budget 3 ms).

## Task Commits

1. **Task 1: Tracer, explosion SFX event after every kill** - `b08ee51` (feat)
2. **Task 2: full routing, priorities, frozen-step silence (TDD)**
   - RED `6b2abd6` (test): 29 tests failing on the routing assertions (router returned 0 where one SFX event was planned)
   - GREEN `6841290` (feat)

**Plan metadata:** the docs commit following this summary.

## Files Created/Modified

- `src/scorched_core/audio/sfx_id.py` - SfxId IntEnum
- `src/scorched_core/audio/sfx_router.py` - `route_sfx` plus `_sound_for`, `_shot_sound`, `_pickup_sound`
- `src/scorched_core/game/game.py` - routes each live step, adds the manifest `sfx` map
- `tests/scorched_core/audio/test_sfx_id.py`, `test_sfx_router.py` - mappings, priorities, ignore cases, ring-full behaviour
- `tests/scorched_core/game/test_game.py` - manifest, kill and frozen-step tests; existing event-count assertions adjusted

## Decisions Made

- The router is a module of functions (one-class-per-file allows this for function modules); the `match` assigns to a single `sound` variable to satisfy ruff PLR0911.
- A refused SFX push is not counted as routed (return value counts successful pushes) but does bump the ring's `dropped` counter, which stays visible in the header.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Existing game tests counted raw events**
- **Found during:** Task 1 and Task 2
- **Issue:** Adding SFX events to the ring changed `H_EVENT_N` and raw event lists asserted by 6 older tests (kill, overkill, event-n reset, hit, shot, pickup, plus the helper `_event_kinds`).
- **Fix:** Kill tests now expect explosion plus sound (2 events); `_event_kinds` filters out `EV_SFX` so the gameplay-event assertions (grace, death, bomb, deathbomb) keep their meaning; shot, hit and pickup tests assert via `_event_kinds`.
- **Files modified:** tests/scorched_core/game/test_game.py
- **Verification:** full pytest at 100% line and branch coverage, `make check` green.
- **Committed in:** b08ee51 and 6841290

---

**Total deviations:** 1 auto-fixed (1 test-expectation update, a direct consequence of the plan)
**Impact on plan:** None on scope; the adjustment is the expected cost of adding events to the shared channel.

## Issues Encountered

None. Tracer feedback gate: the tracer `<verify>` (ruff, 100% coverage, `npm run perf`, `npm run build`, Playwright smoke and shooting) passed end to end before the expansion task; the full `make check` (70 e2e tests) also passed before this summary.

## Known Stubs

None. LASER_HUM is intentionally never routed (plan truth 2); plan 02-31 plays it from BEAM_W.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02-31 can map each `manifest.sfx` name to a synthesized buffer and play EV_SFX events (a = id) in JS; the JS event dispatcher already ignores handlers that do not match type 12.
- Plan 02-32 adds mixing limits and iOS hardening on top.

## Self-Check: PASSED

- Created files exist: sfx_id.py, sfx_router.py, `audio/__init__.py`, both audio test files.
- Commits present: b08ee51, 6b2abd6, 6841290.

---
*Phase: 02-arcade-shooting-feel*
*Completed: 2026-10-18*
