---
phase: 02-arcade-shooting-feel
plan: 01
subsystem: boundary-protocol
tags: [protocol-v2, event-ring, pyodide-boundary, float32-channel, tdd]

requires:
  - phase: 01-playable-core-and-platform
    provides: "Game.tick/RenderSink boundary, header channel, DroneSwarm, python_bridge.js"
provides:
  - "Protocol v2: 48-slot header, EVENT_N (12) and EVENT_DROPPED (13), events channel (stride 6, cap 128)"
  - "EventRing: preallocated float32 ring with a 96-slot low-priority soft cap and a cumulative dropped counter"
  - "All twelve EV_* ids and three BLAST_* classes as protocol.py constants, exported through the manifest as events and blast"
  - "Drone kills push EXPLOSION; hits push one merged low-priority HIT per flash window"
  - "python_bridge.js accepts protocol 2 only"
affects: [02-02, 02-03, 02-08, 02-10, 02-18, 02-20, 02-22, 02-26, 02-28, 02-30]

actuals:
  tokens: 4310
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Per-tick event ring cleared as the first statement of Game.tick, so events are delivered exactly once"
    - "Event ids and blast classes are protocol constants exported by name through the manifest; JS never hard-codes a number"
    - "Noisy events are merged at the source (one HIT per flash window)"

key-files:
  created:
    - src/scorched_core/events/__init__.py
    - src/scorched_core/events/event_ring.py
    - tests/scorched_core/events/test_event_ring.py
  modified:
    - src/scorched_core/protocol.py
    - src/scorched_core/entities/drone_swarm.py
    - src/scorched_core/game/game.py
    - tests/scorched_core/entities/test_drone_swarm.py
    - tests/scorched_core/game/test_game.py
    - tests/scorched_web/test_entrypoint.py
    - web/src/python/python_bridge.js
    - web/test/python/python_bridge.test.js

key-decisions:
  - "A killing blow pushes no HIT event: the EXPLOSION from remove_dead already covers it, so a kill yields exactly one event (matches the plan's Game behaviour of EVENT_N == 1 after a kill)"
  - "EventRing counts a drop on a hard-cap refusal too, not only on soft-cap refusals"
  - "DroneSwarm takes the ring by field injection (events: EventRing = field(default_factory=EventRing)) so existing constructions keep working until 02-03 deletes the class"

patterns-established:
  - "Event channel assign: the events array rides the same once-per-frame bulk assign as every other channel; EVENT_N in the always-assigned header bounds what JS reads, so stale tail data on zero-step frames is never read"
  - "Constants-only protocol.py: new boundary constants (Final) with reserved header slot numbering for later plans"

requirements-completed: [VISL-03, ENMY-08]

coverage:
  - id: D1
    description: "Protocol v2 manifest: protocol 2, 48-slot header, EVENT_N 12 / EVENT_DROPPED 13, events channel stride 6 cap 128, events and blast name maps"
    requirement: VISL-03
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_manifest_contract"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_manifest_publishes_every_event_id_and_blast_class_by_name"
        status: pass
    human_judgment: false
  - id: D2
    description: "A drone shot down pushes exactly one EXPLOSION (kill position, BLAST_SMALL) through the events channel; a drone leaving alive pushes nothing"
    requirement: ENMY-08
    verification:
      - kind: unit
        ref: "tests/scorched_core/entities/test_drone_swarm.py#test_a_destroyed_drone_pushes_one_small_explosion_at_its_position"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_a_kill_publishes_one_explosion_through_the_events_channel"
        status: pass
    human_judgment: false
  - id: D3
    description: "Events are never replayed: EVENT_N is 0 on zero-step and paused ticks after an event tick"
    requirement: VISL-03
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_event_n_resets_on_a_zero_step_tick_after_an_event_tick"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_event_n_resets_on_a_paused_tick_after_an_event_tick"
        status: pass
    human_judgment: false
  - id: D4
    description: "Ring never grows (128 cap), low-priority events refused from 96, dropped counter cumulative"
    requirement: VISL-03
    verification:
      - kind: unit
        ref: "tests/scorched_core/events/test_event_ring.py#test_soft_cap_refuses_low_priority_events_but_still_accepts_high_priority_ones"
        status: pass
    human_judgment: false
  - id: D5
    description: "One merged HIT per flash window; continuous hits while flashing add none"
    requirement: ENMY-08
    verification:
      - kind: unit
        ref: "tests/scorched_core/entities/test_drone_swarm.py#test_bolts_that_land_while_the_drone_flashes_push_no_extra_hit"
        status: pass
    human_judgment: false
  - id: D6
    description: "python_bridge.js accepts protocol 2, allocates and attaches the events channel, rejects 1 and 3"
    requirement: VISL-03
    verification:
      - kind: unit
        ref: "web/test/python/python_bridge.test.js (startGame)"
        status: pass
      - kind: e2e
        ref: "npx playwright test tools/e2e/shooting.spec.js tools/e2e/stress.spec.js tools/e2e/smoke.spec.js"
        status: pass
    human_judgment: false
  - id: D7
    description: "Python tick stays within the 3 ms budget with events enabled"
    verification:
      - kind: other
        ref: "npm run perf (avg_ms 0.57, budget 3)"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-10-18
status: complete
plan_head_before: ed17ceaf4cedf26f9dde44e8e72263686e904ade
plan_head_after: c5ff396cf4ed00172b1937dd1ca813787f7e0f23
commits: 3
---

# Phase 2 Plan 01: Event Channel and Protocol v2 Summary

**Protocol v2 with a 48-slot header and a preallocated float32 event ring (stride 6, cap 128, low-priority soft cap 96) that carries drone EXPLOSION and merged HIT events from Python to the browser every frame.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-10-18T02:54:57Z
- **Completed:** 2026-10-18T03:00:00Z
- **Tasks:** 2
- **Files modified:** 11 (3 created, 8 modified)

## Accomplishments

- Protocol bumped to v2 once: `HEADER_LEN` 48, `H_EVENT_N` 12, `H_EVENT_DROPPED` 13, slots 14-29 reserved for later Phase 2 plans and 30-47 for Phase 3. All twelve `EV_*` ids and the three `BLAST_*` classes live in `protocol.py` and reach JS by name through the manifest (`events`, `blast`).
- `EventRing` follows the `BulletPool` pattern: preallocated `array('f')`, six scalar stores per push, no allocation, cleared as the first statement of `Game.tick` so zero-step and paused calls never replay events.
- Drone kills push `EV_EXPLOSION` (kill position, `BLAST_SMALL`); the first hit on a resting drone pushes one low-priority `EV_HIT`, merged at the source for the flash window. Low-priority events are refused from 96 queued so explosions always fit, and every refusal bumps a cumulative `EVENT_DROPPED`.
- `python_bridge.js` accepts only protocol 2 and allocates the `events` Float32Array from the manifest like every other channel. The Phase 1 smoke, shooting and stress e2e specs pass on the protocol v2 production build, and `make check` (lint, 100% coverage, vitest, build, all 39 e2e) is green. `npm run perf` averages 0.57 ms per tick against the 3 ms budget.

## Task Commits

1. **Task 1: Tracer: EXPLOSION event across the protocol v2 events channel** - `50670f0` (feat)
2. **Task 2: Merged HIT events, soft cap, no replay (TDD)**
   - RED: `152bbcd` (test) - 7 target tests failed on the planned assertions (HIT merge rule, soft cap, game-level HIT event)
   - GREEN: `c5ff396` (feat)

**Plan metadata:** committed separately (docs: complete plan)

## Files Created/Modified

- `src/scorched_core/protocol.py` - protocol v2 constants: header, event channel sizes, `EV_*`, `BLAST_*`
- `src/scorched_core/events/event_ring.py` - `EventRing` with soft cap and cumulative dropped counter
- `src/scorched_core/entities/drone_swarm.py` - injected ring; EXPLOSION in `remove_dead`, merged HIT in `apply_hit`
- `src/scorched_core/game/game.py` - owns the ring, clears it first in `tick`, packs EVENT_N/EVENT_DROPPED, exports `events`/`blast` and the events channel
- `web/src/python/python_bridge.js` - protocol 2 check
- Tests: `test_event_ring.py` (new), `test_drone_swarm.py`, `test_game.py`, `test_entrypoint.py`, `python_bridge.test.js`

## Decisions Made

- A killing blow pushes no HIT event. The plan's Task 1 behaviour says a tick that kills a drone has `EVENT_N == 1`, and its Task 2 rule says a hit on a resting drone pushes HIT; the two only agree if the lethal hit is exempt (the EXPLOSION already covers it). Exempting it keeps "a kill is exactly one event".
- `EventRing.push` counts a drop on hard-cap refusal as well as soft-cap refusal.
- The ring is injected into `DroneSwarm` as a defaulted dataclass field (the class is deleted in 02-03, so no signature churn elsewhere).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Lethal hit would have pushed HIT before EXPLOSION**
- **Found during:** Task 2 (GREEN run: four Task 1 tests failed with EVENT_N == 2)
- **Issue:** Pushing HIT whenever `flash == 0` also fired on the killing blow, contradicting the plan's "a kill pushes exactly one EXPLOSION" and `EVENT_N == 1` after a kill.
- **Fix:** `apply_hit` decrements hp first and pushes HIT only when the drone was resting and survives. Added `test_a_killing_blow_on_a_resting_drone_pushes_the_explosion_and_no_hit`; adjusted the soft-cap swarm test to drive the explosion through `remove_dead` on a zeroed hp.
- **Files modified:** `src/scorched_core/entities/drone_swarm.py`, `tests/scorched_core/entities/test_drone_swarm.py`
- **Verification:** full pytest gate at 100% line and branch coverage; `make check` green
- **Committed in:** `c5ff396`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Resolves an inconsistency inside the plan's own behaviour list; no scope change.

## Issues Encountered

None. The `event_n_resets` tests passed at the RED stage because the per-tick `clear()` landed in Task 1 (the plan requires it there); they remain as regression locks for Pitfall 2.

## TDD Gate Compliance

Task 2 (`tdd="true"`): RED `152bbcd` (test commit, 7 failing target tests asserting planned behaviour, not import or setup errors), GREEN `c5ff396`. No REFACTOR commit needed. The plan itself is `type: execute`, so the plan-level gate sequence does not apply.

## Known Stubs

None. `EV_SHOT` through `EV_SFX` ids and header slots 14-29 are reserved constants only; later plans (named in `protocol.py` comments) add their pushes.

## Threat Flags

None. The new boundary surface (events channel, header slots) is exactly the one in the plan's threat model; T-02-01 (bounded ring, soft cap, dropped counter) and T-02-02 (protocol 2 check before any allocation) are both mitigated and tested.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02-02 can read `events` and `EVENT_N` from the JS side and turn EXPLOSION into GPU particles; the `events` and `blast` name maps are in the manifest.
- Header slot numbering for the rest of Phase 2 is reserved in `protocol.py`.
- No blockers.

---
*Phase: 02-arcade-shooting-feel*
*Completed: 2026-10-18*

## Self-Check: PASSED

- FOUND: src/scorched_core/events/event_ring.py, src/scorched_core/events/__init__.py, tests/scorched_core/events/test_event_ring.py
- FOUND commits: 50670f0, 152bbcd, c5ff396
- `make check` green (ruff, pytest 395 passed at 100% line and branch, vitest, build, 39 e2e); `npm run perf` avg 0.57 ms
