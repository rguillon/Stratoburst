---
phase: 02-arcade-shooting-feel
plan: 11
subsystem: boot
tags: [url-flags, weapon, level, status-readout, input-validation, bolt-angle]

requires:
  - phase: 02-arcade-shooting-feel
    provides: "Game(weapon, level) and the header WEAPON/LEVEL slots with manifest.weapons (02-08)"
provides:
  - "?weapon=vulcan|laser|homing and ?level=1..5 test flags, parsed by parseUrlFlags and validated again by entrypoint _weapon and _level"
  - "createStatusReadout({ doc, weapons, colors }) -> { el, update, show } and the frozen WEAPON_CSS map; #status-readout markup in index.html"
  - "main.js forwards the whole parsed flags object to startGame and warmUp (crash nulled for the warm-up)"
  - "BulletPool.angle = atan2(vx, -vy) packed in slot 2 of the pbullets channel"
  - "tools/e2e/weapons.spec.js"
affects: [02-13 homing, 02-17 palette and stretched bolts, 02-20 god flag, 02-21 laser, 02-27 bombs flag, 03 HUD and scoring]

actuals:
  tokens: 13000
  tasks: 2
  commits: 2
plan_head_before: 8ec404a726fa25ea790ffe08ba9a1f6002145e61
plan_head_after: 20e25fef9622076398062120e721be23d6d26cb0
commits: 2

tech-stack:
  added: []
  patterns:
    - "URL flags are allow-listed and clamped in JS and validated again in Python; a null means the Python default"
    - "main.js spreads the parsed flags into the Python options, so a later flag needs no main.js edit"
    - "DOM readouts write textContent only, and only when a value changes"

key-files:
  created:
    - web/src/ui/status_readout.js
    - web/test/ui/status_readout.test.js
    - tools/e2e/weapons.spec.js
  modified:
    - src/scorched_web/entrypoint.py
    - tests/scorched_web/test_entrypoint.py
    - web/src/boot/url_flags.js
    - web/test/boot/url_flags.test.js
    - web/test/helpers/fake_dom.js
    - index.html
    - web/src/main.js
    - src/scorched_core/pools/bullet_pool.py
    - tests/scorched_core/pools/test_bullet_pool.py

key-decisions:
  - "_weapon matches the exact lowercase names through a dict built from WeaponKind, so LASER or a non-string is VULCAN; _level accepts int, float or numeric string, truncates, clamps to 1..MAX_LEVEL and treats bool, NaN, inf and junk as 1"
  - "An unknown weapon value in the header shows an uncoloured '?' in the readout instead of throwing"
  - "BulletPool.angle is the direction at spawn; the debug bullet storm bounces velocities in place, so its angle goes stale, which the orb style ignores"

patterns-established:
  - "Readout markup lives in index.html and the module finds it by id, failing loudly when absent"

requirements-completed: [PLYR-05, PLYR-04]

coverage:
  - id: D1
    description: "?weapon and ?level are allow-listed and clamped in JS, validated again in Python, and reach the game as the starting loadout"
    requirement: PLYR-05
    verification:
      - kind: unit
        ref: "tests/scorched_web/test_entrypoint.py#test_the_weapon_option_is_allow_listed_and_anything_else_is_vulcan"
        status: pass
      - kind: unit
        ref: "tests/scorched_web/test_entrypoint.py#test_the_level_option_is_truncated_and_clamped_and_junk_means_one"
        status: pass
      - kind: unit
        ref: "web/test/boot/url_flags.test.js"
        status: pass
    human_judgment: false
  - id: D2
    description: "The live build with ?weapon=vulcan&level=5 starts at WEAPON 0 / LEVEL 5, fires at least seven bolts, and ?weapon=plasma&level=99 falls back to vulcan Lv 5"
    requirement: PLYR-05
    verification:
      - kind: e2e
        ref: "npx playwright test tools/e2e/weapons.spec.js"
        status: pass
    human_judgment: false
  - id: D3
    description: "The player always sees the current weapon in its crystal colour and the level, written with textContent only and only on change"
    requirement: PLYR-04
    verification:
      - kind: unit
        ref: "web/test/ui/status_readout.test.js"
        status: pass
      - kind: e2e
        ref: "tools/e2e/weapons.spec.js#readout contains VULCAN / LASER and Lv N"
        status: pass
    human_judgment: false
  - id: D4
    description: "Player bolts carry atan2(vx, -vy) in slot 2 of the pbullets channel, swapped correctly on removal"
    requirement: PLYR-05
    verification:
      - kind: unit
        ref: "tests/scorched_core/pools/test_bullet_pool.py#test_spawn_stores_the_flight_angle"
        status: pass
      - kind: unit
        ref: "tests/scorched_core/pools/test_bullet_pool.py#test_pack_into_writes_the_flight_angle_in_slot_two"
        status: pass
      - kind: other
        ref: "npm run perf (avg_ms 0.569, budget 3)"
        status: pass
    human_judgment: false
  - id: D5
    description: "How the readout looks and sits on a phone-sized window, and that the seven-stream fan reads as a wide fan"
    verification: []
    human_judgment: true
    rationale: "Placement, legibility and the look of the fan are visual judgements; the plan's human-check at http://localhost:4173/?debug&weapon=vulcan&level=5 is left for end-of-phase verification"

duration: 9min
completed: 2026-10-18
status: complete
---

# Phase 2 Plan 11: Weapon Test Flags and Status Readout Summary

**Allow-listed `?weapon` and `?level` flags validated on both sides of the Pyodide boundary, a bottom-left weapon and level readout in the crystal colours, and player bolts that carry their flight angle**

## Performance

- **Duration:** 9 min
- **Started:** 2026-10-18T04:20:00Z
- **Completed:** 2026-10-18T04:29:00Z
- **Tasks:** 2
- **Files modified:** 12 (3 created, 9 modified)

## Accomplishments
- `?weapon=vulcan|laser|homing` and `?level=1..5` start the live build with any weapon at any level; unknown or upper-case weapons fall back to the default and levels are truncated and clamped, in `parseUrlFlags` and again in `_weapon` and `_level`.
- A small `#status-readout` (bottom-left, inside the safe area, `pointer-events: none`) shows the weapon name in red, blue or purple and `Lv N`; `textContent` only, written only when a value changes.
- `main.js` now spreads the parsed flags into the Python options (`{ seed: 1, ...flags }`), so later flags reach Python without another main.js edit; the warm-up copy keeps `crash: null`.
- `BulletPool` stores each bolt's flight angle `atan2(vx, -vy)` and packs it in slot 2 of the pbullets channel for the stretched bolt style of plan 02-17; straight-up bolts still pack exactly 0.
- The `?debug&weapon=vulcan&level=5` e2e checks WEAPON 0, LEVEL 5, the readout text and at least 7 simultaneous bolts; the Phase 1 flags and specs (boot, debug, stress, shooting) still pass.

## Task Commits

1. **Task 1: Tracer: opening the live build with ?weapon=vulcan&level=5 fires a seven-stream fan and the readout shows VULCAN Lv 5** - `a5c280a` (feat). The tracer's verify (ruff, 100% coverage gate, vitest, build, weapons, boot and debug Playwright specs) passed end to end, so expansion continued.
2. **Task 2: Player bolts carry their flight angle** - `20e25fe` (feat, TDD: the new tests were run and seen failing on the missing `angle` column before the implementation)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## Files Created/Modified
- `src/scorched_web/entrypoint.py` - `_weapon`, `_level` and the `_WEAPONS` allow-list, passed to `Game`
- `web/src/boot/url_flags.js` - `weapon` and `level` flags, documented grammar
- `web/src/ui/status_readout.js` - `createStatusReadout`, `WEAPON_CSS`
- `web/test/helpers/fake_dom.js` - `className`, `hidden` and a class-selector `querySelector`
- `index.html` - `#status-readout` markup and style
- `web/src/main.js` - flag spreading, readout creation after the gate, per-frame update
- `src/scorched_core/pools/bullet_pool.py` - `angle` column
- `tools/e2e/weapons.spec.js` - flags, readout and the Lv5 fan in the production build
- tests for each of the above

## Decisions Made
See key-decisions above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Existing pack test asserted the old zero angle**
- **Found during:** Task 2 (full gate after GREEN)
- **Issue:** `test_pack_into_writes_x_y_angle_kind_at_stride_four` expected slot 2 to be 0.0 for bolts flying at (1, -2); that is exactly what the plan changes.
- **Fix:** The expectation is now `atan2(1, 2)` (approx, float32). The old "clears a stale angle column" test became "overwrites a stale slot two".
- **Files modified:** tests/scorched_core/pools/test_bullet_pool.py
- **Verification:** full gate green, 606 passed at 100%
- **Committed in:** 20e25fe

---

**Total deviations:** 1 auto-fixed (1 bug-in-test caused by the planned change)
**Impact on plan:** None; behaviour matches the plan.

## Issues Encountered
None.

## Authentication Gates
None.

## Known Stubs
None. The LASER and HOMING weapons fire nothing until plans 02-21 and 02-13; the readout and flags for them are real.

## Threat Flags
None. T-02-14 is mitigated (allow-list on both sides, level clamped in JS, entrypoint and Game, non-finite values never cross) and T-02-15 is mitigated (`grep innerHTML web/src/ui/status_readout.js` prints nothing). No packages were added.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Ready for 02-12 onward: any weapon at any level can be started from a link, the readout stands in for the HUD until Phase 3, and plan 02-17 can stretch bolts along the packed angle.
- Test flags change nothing persistent; Phase 3 must flag runs that used them once scores exist.
- The plan's visual human-check (fan width, readout placement on a phone-sized window) is left for end-of-phase verification.

## Self-Check: PASSED
- Created files exist: status_readout.js, status_readout.test.js, weapons.spec.js.
- Commits `a5c280a` and `20e25fe` are ancestors of HEAD; `git rev-list --count` from the plan base gives 2.
- `uv run ruff check .`, `ruff format --check .`, `pytest --cov --cov-branch --cov-fail-under=100` (606 passed, 100%), `npm test` (576), `npm run perf` (avg 0.569 ms), `npm run build`, and the weapons, boot, debug, stress and shooting Playwright specs all pass.

---
*Phase: 02-arcade-shooting-feel*
*Completed: 2026-10-18*
