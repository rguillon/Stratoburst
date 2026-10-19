---
phase: 03-stage-1-vertical-slice
plan: 11
subsystem: scoring
tags: [medals, medal-chain, pickups, score-popups, instanced-mesh, playwright, vitest, pytest]

requires:
  - phase: 03-stage-1-vertical-slice
    provides: "ScoreKeeper.award, header MEDAL_VALUE/MEDAL_CHAIN slots and EV_MEDAL (03-01/03-07), PICKUP_CAP 40 (03-01), PickupPool.clear (03-08), PALETTE.MEDAL (03-03), the banner/overlay factory style (03-09/03-10)"
provides:
  - "PickupKind.MEDAL = 5; tuning MEDAL_LADDER (100..10000) and MEDAL_RESERVE (4)"
  - "MedalChain (scoring/medal_chain.py): index, chain, collected, value, collect(), miss(), stage_reset()"
  - "PickupPool.spawn_medal, step(ground_speed), medals_missed, medal_tier; medal-first eviction in spawn_guaranteed"
  - "Game.chain; _collect_medal pays chain.collect() and pushes EV_MEDAL; header MEDAL_VALUE/MEDAL_CHAIN written; the chain resets on a drained miss and on a confirmed death"
  - "Stage 1 medal drops: left-road opening tank column (x 80) plus tanks and turrets in each section"
  - "createPickupInstances returns medalMesh (hex holo chip, tier brightness via medalRgb); PALETTE.MEDAL_WHITE"
  - "createScorePopups (web/src/ui/score_popups.js), #popups markup and .popup rise animation, MEDAL sparkle in explosion_fx"
  - "tools/e2e/medal.spec.js; debug hooks fx.medalsDrawn and fx.popupsShown"
affects: [03-15 destructible buildings reuse the medal drop, 03-14/03-18 mid-boss ground kinds (wreck ring now tolerates kinds without a model), 03-19 stage tally reads chain.collected]

actuals:
  tokens: 12800
  tasks: 2
  commits: 5
plan_head_before: d7246bf219c4b12873248c6cdfd1671643008b32
plan_head_after: 33d8e3b319c7342714bbe3d37615d4e7977dcad1

tech-stack:
  added: []
  patterns:
    - "A drifting pickup kind is moved by the pool from a caller-supplied ground speed, so its motion needs no per-pickup velocity and stays tied to the live scroll"
    - "Pool-owned counters (medals_missed) are drained by the owner each step after the catches, exactly like kill_n"
    - "The packed colour slot carries per-kind meaning (cycle position, chain tier, kind), decided in Python and only mapped to a palette entry in JS"
    - "Pooled DOM popups: a fixed set of spans reused round robin, restarted by toggling hidden, text via textContent only"

key-files:
  created:
    - src/scorched_core/scoring/medal_chain.py
    - tests/scorched_core/scoring/test_medal_chain.py
    - web/src/ui/score_popups.js
    - web/test/ui/score_popups.test.js
    - tools/e2e/medal.spec.js
  modified:
    - src/scorched_core/entities/pickup_kind.py
    - src/scorched_core/pools/pickup_pool.py
    - src/scorched_core/game/game.py
    - src/scorched_core/stages/stage_1.py
    - src/scorched_core/tuning.py
    - web/src/render/pickup_instances.js
    - web/src/fx/explosion_fx.js
    - web/src/fx/palette.js
    - web/src/main.js
    - index.html

key-decisions:
  - "A medal stores velocity 0 and the pool moves it by the ground speed passed to step(), so it follows the live scroll (a crawl or a stop) exactly and never bounces or times out"
  - "spawn_medal enforces MEDAL_RESERVE inside the pool; a refused spawn is simply lost and never reaches the miss counter, which only a medal drifting out of the playfield increments"
  - "medals_missed is drained in Game._step_pickups after the catch callbacks, so a catch on the step another medal scrolls off pays the climbing value and the next one restarts at 100"
  - "MedalChain.stage_reset only zeroes the stage catch count; the chain value carries over, and a restart (game over) resets both"
  - "Popups are positioned with left/top, because the CSS rise animation owns transform; the project function reuses one Vector3 and one result object"
  - "Chip tier colour is a mix of PALETTE.MEDAL and the new PALETTE.MEDAL_WHITE (4.6 grey), so it brightens with no hue shift and stays outside the reserved bullet hue band"

patterns-established:
  - "Per-kind pickup meshes: one InstancedMesh per look, the update loop counts each mesh's instances separately because the channel interleaves kinds"
  - "Defensive model lookup in main.js: JS asset loaders are given only the kinds that have builders (hasModel), so Python can add kinds ahead of their models"

requirements-completed: [SCOR-02, SCOR-01]

coverage:
  - id: D1
    description: "A destroyed medal-carrying ground target drops a medal that drifts down with the scroll at the ground speed, never bouncing or timing out"
    requirement: SCOR-02
    verification:
      - kind: unit
        ref: "tests/scorched_core/pools/test_pickup_pool.py#test_a_medal_drifts_down_by_exactly_the_ground_speed_each_step"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_a_medal_drifts_down_with_the_scroll_at_the_ground_speed"
        status: pass
    human_judgment: false
  - id: D2
    description: "Catching a medal pays the chain value (100, 200, 500, 1000, 2000, 5000, 10000, capped), pushes one MEDAL event and no PICKUP event, and updates MEDAL_VALUE and MEDAL_CHAIN"
    requirement: SCOR-02
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_seven_catches_pay_the_whole_ladder_and_an_eighth_pays_the_cap_again"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_catching_a_medal_pays_the_chain_value_and_pushes_one_medal_event"
        status: pass
    human_judgment: false
  - id: D3
    description: "A medal scrolling off or a confirmed death resets the chain; a refused spawn or an eviction never counts as a miss"
    requirement: SCOR-02
    verification:
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_a_medal_scrolling_off_the_bottom_resets_the_chain_to_the_base_value"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_dying_resets_the_chain_but_the_stage_count_keeps_its_catches"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/game/test_game.py#test_a_medal_the_pool_refused_is_never_counted_as_a_miss"
        status: pass
    human_judgment: false
  - id: D4
    description: "Weapon pickups keep priority: medals cannot take the last MEDAL_RESERVE slots and a guaranteed recovery pickup evicts the oldest medal first"
    requirement: SCOR-02
    verification:
      - kind: unit
        ref: "tests/scorched_core/pools/test_pickup_pool.py#test_medals_cannot_take_the_last_reserved_slots_but_other_pickups_can"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/pools/test_pickup_pool.py#test_a_guaranteed_pickup_evicts_the_oldest_medal_before_anything_older"
        status: pass
    human_judgment: false
  - id: D5
    description: "A medal catch shows its value as a world popup at the medal; regular kills show none (D-20)"
    requirement: SCOR-01
    verification:
      - kind: unit
        ref: "web/test/ui/score_popups.test.js"
        status: pass
      - kind: e2e
        ref: "tools/e2e/medal.spec.js#a laser under the medal tank column catches a medal: chain 1 and a \"100\" popup"
        status: pass
    human_judgment: false
  - id: D6
    description: "The medal reads as a white/cyan holographic chip, brighter at higher chain tiers, never gold or orange-yellow"
    requirement: SCOR-02
    verification:
      - kind: unit
        ref: "web/test/render/pickup_instances.test.js#medal tier colours"
        status: pass
    human_judgment: true
    rationale: "Whether the chip looks like a holographic medal and reads clearly against the burning city is a visual judgment no assertion makes"

duration: 25min
completed: 2026-10-18
status: complete
---

# Phase 3 Plan 11: Medals Summary

**Raiden II medals: medal-carrying tanks and turrets drop hexagonal holo chips that drift down with the city, a 100-to-10000 chain climbs on every catch and resets on a miss or a death, and each catch pops its value on screen.**

## Performance

- **Duration:** about 25 min
- **Completed:** 2026-10-18T17:34:30Z
- **Tasks:** 2 (Task 1 tracer, Task 2 chain rules)
- **Files modified:** 21 (11 source, 9 test, 1 e2e spec; plus this summary)

## Accomplishments

- Python: `PickupKind.MEDAL`, `MedalChain` over a tunable `MEDAL_LADDER`, pool-side medal motion and reserve, game wiring (drop, catch, miss drain, death reset) and header slots, all at 100% line and branch coverage.
- Stage 1 carries medals: the three-tank column on the left road (x 80) at distance 820 to 880, a downtown road column, a rooftop turret, a road-bend column, and an airbase tank column plus a turret line.
- Browser: medals render as a second instanced mesh of hex chips that brighten with the chain tier, `score_popups.js` pops the value over the medal, and the pickup sparkle fires in the medal colour.
- The wreck ring now builds hulls only for ground kinds that have a model, so Python can add mid-boss ground kinds (03-14) before their JS models (03-18) without the loader throwing.

## Task Commits

1. **Task 1 (tracer): a tank drops a medal, catching it pays 100 and pops "100"**
   - `1dbc579` test (RED: medal kind, chain, pool, game and stage tests)
   - `e1215c8` feat (Python: medal kind, chain, pool, game, stage 1)
   - `e9dc965` feat (browser: chips, popups, wiring, medal.spec.js)
2. **Task 2: chain climbs to its cap, resets on a miss or a death**
   - `fa2fd70` test (RED: misses, death reset, medal-first eviction)
   - `33d8e3b` feat (counter and drain, death reset, tier brightness, MEDAL sparkle)

**Plan metadata:** the docs commit following this summary.

## TDD Gate Compliance

RED then GREEN for both tasks. RED evidence is the pytest run before the implementation: Task 1 failed on `PickupKind.MEDAL` and `MedalChain` being absent plus the stage-1 medal assertions (20 failures, 1 collection error for the new `medal_chain` module); Task 2 failed on `pickups.medals_missed` being absent and on the chain not resetting (9 failures). Several RED failures were AttributeError/ImportError on the new API rather than a value assertion, so the strict `check tdd-red-evidence` classifier (not enabled for this project) would have called the Task 1 import failure a load error. The tests were rewritten around values where the API already existed, and all assert the planned behaviour once GREEN. The JS tests were written alongside the JS implementation (no separate RED commit) as the plan's gate is the Python path.

## Files Created/Modified

- `src/scorched_core/scoring/medal_chain.py` - ladder position, chain length and stage catch count
- `src/scorched_core/pools/pickup_pool.py` - medal spawn with reserve, ground-speed drift, miss counter, medal-first eviction
- `src/scorched_core/game/game.py` - `_collect_medal`, `_step_pickups` (move, catch, drain), death reset, header slots
- `src/scorched_core/stages/stage_1.py` - `drop=PickupKind.MEDAL` on tank columns and turrets
- `web/src/render/pickup_instances.js` - `medalMesh`, `medalRgb`, `MEDAL_TIER_MAX`
- `web/src/ui/score_popups.js` and `index.html` - pooled popups and their rise animation
- `web/src/main.js` - medal mesh, popups, wreck-kind guard, debug hooks
- `tools/e2e/medal.spec.js` - end-to-end catch with a laser under the x 80 column

## Decisions Made

See `key-decisions` above. The main call was keeping the miss counter inside the pool (only a medal leaving the playfield increments it) so a refused spawn or an eviction can never be blamed on the player (RESEARCH Pitfall 15).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Popup positioned with left/top instead of a transform**
- **Found during:** Task 1 (score_popups.js)
- **Issue:** the plan positions each span with a transform, but the CSS rise animation animates `transform`, which overrides an inline transform and would pin every popup at the top-left corner.
- **Fix:** `span.style.left/top` carry the projected point; the keyframes only translate upward from `translate(-50%, -50%)`.
- **Files modified:** web/src/ui/score_popups.js, index.html
- **Verification:** score_popups unit tests and medal.spec.js
- **Committed in:** e9dc965

**2. [Rule 1 - Bug] e2e steering tolerance**
- **Found during:** Task 1 (medal.spec.js)
- **Issue:** steering "within 4 of x 80" never converged: a key release lands a frame or two late (about 3.3 units a step, up to 3 steps a frame under software GL), and the ship also ignores keys during the intro fly-in.
- **Fix:** the spec waits for FLOW PLAY first and settles within 10 of x 80, which is still inside the laser column (half-width 7 plus tank radius 11) and the pickup grab circle (16).
- **Files modified:** tools/e2e/medal.spec.js
- **Verification:** medal.spec.js passes (three runs)
- **Committed in:** e9dc965

**3. [Rule 2 - Missing] Reserve and miss counter landed with Task 1 where coverage needed them**
- **Found during:** Task 1 (100% coverage gate)
- **Issue:** the plan places `MEDAL_RESERVE` and the miss counter in Task 2, but the pool code path and its branch had to be tested at the Task 1 commit to keep the 100% gate green.
- **Fix:** `spawn_medal` enforces the reserve from Task 1 (with its test); `medals_missed` and the drain arrive in Task 2 as planned.
- **Committed in:** e1215c8

---

**Total deviations:** 3 auto-fixed (1 blocking, 1 bug, 1 missing)
**Impact on plan:** none on behaviour; all in service of the plan's stated acceptance.

## Issues Encountered

- `tools/e2e/score.spec.js` has a known flaky comparison (logged by 03-10 in deferred-items.md); it passed in every run here, so nothing new was added to deferred items.

## Known Stubs

None.

## Threat Flags

None. The popup text is a rounded integer from the event written with `textContent` into a fixed pool of 8 spans (T-03-15); the reserve and medal-first eviction implement T-03-14.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 03-12. The medal drop is a plain `drop=PickupKind.MEDAL` on any wave row, so destructible buildings (03-15) reuse it; `chain.collected` and `stage_reset()` are ready for the stage tally (03-19).
- Carried assumption (from the plan): the chain persists across the stage-clear loop (D-27); only a miss or a death resets it. A game-over restart resets it fully.
- Visual judgment of the chip against the burning city is left for the slice gate.

## Self-Check: PASSED

All created files exist, all five commits are reachable from HEAD, `make lint`, `make test` (pytest at 100% line and branch, vitest 1181 passing) and `make perf` are green, and medal.spec.js, score.spec.js, weapons.spec.js, stage.spec.js and intro.spec.js pass.

---
*Phase: 03-stage-1-vertical-slice*
*Completed: 2026-10-18*
