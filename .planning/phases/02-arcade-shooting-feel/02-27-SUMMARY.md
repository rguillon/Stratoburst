---
phase: 02-arcade-shooting-feel
plan: 27
subsystem: bomb-readout-and-test-flags
tags: [status-readout, url-flags, device-report, perf, playwright, python, pytest]

requires:
  - phase: 02-arcade-shooting-feel
    provides: "02-26 Game(bombs=) clamp and bomb restocks, 02-22 header BOMBS slot, 02-24 status readout and MAX flash, 02-20 and 02-23 perf harness with god and --weapon all"
provides:
  - "Bomb stock as one amber pip per bomb (0..7) in the status readout, written on change with textContent only"
  - "?bombs=0..7 test flag validated in JS (parseUrlFlags), in the entrypoint (_bombs) and again in Game"
  - "Device report flags line listing every Phase 2 test flag: weapon, level, god and bombs"
  - "make perf / npm run perf bomb load: --bomb N presses BOMB every N ticks with a 7-bomb stock"
affects: [02-33-device-gate, phase-3-hud]

actuals:
  tokens: 6600
  tasks: 2
  commits: 3
plan_head_before: 02c92707be0f6371686c136ee57bae1971e3de0d
plan_head_after: 748455520d15fe1d2bae8f467990a22ff38f96e8

tech-stack:
  added: []
  patterns:
    - "Allow-listed flag parsed three times (JS truncate+clamp, entrypoint validate, Game clamp), junk falls back to the default"
    - "Perf gate fails when it measured nothing: --bomb requires a bomb phase above 0 during the measured ticks"

key-files:
  created: []
  modified:
    - src/scorched_web/entrypoint.py
    - tests/scorched_web/test_entrypoint.py
    - web/src/boot/url_flags.js
    - web/test/boot/url_flags.test.js
    - web/src/ui/status_readout.js
    - web/test/ui/status_readout.test.js
    - web/src/debug/report.js
    - web/test/debug/report.test.js
    - web/src/main.js
    - index.html
    - tools/perf_node.mjs
    - tools/e2e/bomb.spec.js
    - package.json

key-decisions:
  - "The pip is U+25CF in the .bombs span, coloured by a literal rgb(255, 191, 32) in index.html (PALETTE.BOMB_PICKUP 3.2/2.4/0.4 divided by its largest channel and scaled to 255)"
  - "update() clamps its bombs argument to 0..7 and treats non-finite values as no pips, so a bad header value can never write a long string"
  - "perf_node always passes bombs: 7; --bomb N only controls the presses, and a --bomb run fails when no bomb phase appears in the measured ticks"

patterns-established:
  - "A one-sample button press in the perf harness: the bit is set for index i with i % N == 0 and clear on the next sample, so Python derives the edge"

requirements-completed: [PLYR-09, PLYR-07]

coverage:
  - id: D1
    description: "The bomb stock is visible as amber pips (0..7) that drop as bombs are spent"
    requirement: PLYR-09
    verification:
      - kind: unit
        ref: "web/test/ui/status_readout.test.js#shows %i bombs as that many pips"
        status: pass
      - kind: e2e
        ref: "tools/e2e/bomb.spec.js#?bombs=7 starts with seven bombs shown as seven pips"
        status: pass
      - kind: e2e
        ref: "tools/e2e/bomb.spec.js#the pips follow the stock down as bombs are spent"
        status: pass
    human_judgment: false
  - id: D2
    description: "?bombs sets the starting stock, truncated and clamped on both sides, junk falls back to 3"
    requirement: PLYR-07
    verification:
      - kind: unit
        ref: "tests/scorched_web/test_entrypoint.py#test_the_bombs_option_is_truncated_and_clamped_and_junk_means_three"
        status: pass
      - kind: unit
        ref: "web/test/boot/url_flags.test.js#%s gives bombs %s"
        status: pass
      - kind: e2e
        ref: "tools/e2e/bomb.spec.js#?bombs=0 starts empty: no pips, and K launches nothing"
        status: pass
    human_judgment: false
  - id: D3
    description: "The device report flags line lists debug, stress, tier, crash, weapon, level, god and bombs"
    verification:
      - kind: unit
        ref: "web/test/debug/report.test.js#flags line"
        status: pass
    human_judgment: false
  - id: D4
    description: "make perf fires bombs while measuring every weapon at Lv5 and stays at most 3 ms per tick"
    verification:
      - kind: other
        ref: "make perf (three JSON lines, avg_ms 0.70 / 0.55 / 0.64, peak_bomb_phase 2)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The amber pips look right and drop one per bomb at http://localhost:4173/?debug&bombs=5, and Copy report ends its flags line with bombs=5"
    verification: []
    human_judgment: true
    rationale: "Colour, size and placement of the pips next to the weapon and level text are a visual judgement"

duration: 5 min
completed: 2026-10-18
status: complete
---

# Phase 2 Plan 27: Bomb Readout and Test Flags Summary

**Bomb stock shown as amber pips in the status readout, an allow-listed `?bombs=0..7` flag validated in JS and Python, a device report flags line covering every test flag, and a perf gate that fires bombs while timing all three weapons**

## Performance

- **Duration:** 5 min
- **Started:** 2026-10-18T07:01:53Z
- **Completed:** 2026-10-18T07:06:03Z (code); SUMMARY and state after the full `make check`
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments

- The readout now has a `.bombs` span: `update(weapon, level, bombs)` writes one pip per bomb (0..7) with textContent, only on change, no innerHTML (grep gate and a unit test on the source).
- `?bombs=` is truncated and clamped to 0..7 in `parseUrlFlags` (null when absent or non-numeric), validated again by `_bombs` in the entrypoint (finite numbers or numeric strings truncated and clamped, anything else 3) and clamped a third time by `Game`. main.js needed only the extra `update` argument because it already spreads the flags into the Python options.
- The report's `flags:` line reads `debug=on stress=0 tier=auto crash=none weapon=laser level=3 god=off bombs=5`, with `default` for an unset weapon, level or bombs.
- `npm run perf` appends `--bomb 300`: one BOMB press every 300 ticks (clear on the next sample, so Python sees an edge), a 7-bomb stock, and a failure if no bomb ever flew in the measured ticks.

### Perf with bombs active (`make perf`, budget 3 ms, 500 stress bullets, fire held, Lv5)

| Weapon | avg_ms | p95_ms | peak_bomb_phase |
|--------|--------|--------|-----------------|
| vulcan | 0.7028 | 0.8821 | 2 (blast) |
| laser  | 0.5468 | 0.6480 | 2 (blast) |
| homing | 0.6397 | 0.7675 | 2 (blast) |

## Task Commits

1. **Task 1: Tracer, `?bombs=7` starts with seven bombs shown as seven pips** - `57f129d` (feat)
2. **Task 2: device report flags line and perf bomb load (TDD)**
   - RED: `c67eb01` (test) - three flags-line tests fail on the old output `flags: debug=on stress=0 tier=auto crash=none` (expected the full line)
   - GREEN: `7484555` (feat)

**Plan metadata:** the docs commit following this summary.

## Files Created/Modified

- `src/scorched_web/entrypoint.py` - `_bombs` validation passed to `Game(bombs=)`
- `web/src/boot/url_flags.js` - `bombs` flag and grammar comment
- `web/src/ui/status_readout.js` - bomb pips, `update(weapon, level, bombs)`
- `index.html` - `.bombs` span and its amber style
- `web/src/main.js` - passes `header[slots.BOMBS]` to the readout
- `web/src/debug/report.js` - full flags line
- `tools/perf_node.mjs`, `package.json` - `--bomb N` and the perf script flag
- `tests/scorched_web/test_entrypoint.py`, `web/test/boot/url_flags.test.js`, `web/test/ui/status_readout.test.js`, `web/test/debug/report.test.js`, `tools/e2e/bomb.spec.js` - tests

## Decisions Made

- Pip glyph U+25CF with a literal `rgb(255, 191, 32)` (the bomb pickup colour normalised to 255), letter-spaced so seven pips stay countable.
- `update()` clamps its input to 0..7 and shows nothing for non-finite values.
- The perf harness fails a `--bomb` run that never launched a bomb, in the same spirit as the idle-weapon check from 02-23. The Makefile `perf` help text was left as is (the target wraps `npm run perf`).

## Deviations from Plan

None - plan executed exactly as written. Task 2 was committed as a RED test commit then a GREEN feat commit because it is `tdd="true"`; the RED run was taken against the reverted `report.js` to prove the new tests fail on the planned assertion.

## Issues Encountered

None. `make check` (ruff, pytest at 100% line+branch, 829 vitest tests, build, 64 Playwright specs) passed before the docs commit.

## Known Stubs

None.

## Threat Flags

None. The only new input path is `?bombs`, which is T-02-32 in the plan and is mitigated as described above (three-sided clamp, textContent only).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The report is self-describing for the 02-33 device gate; pasted reports show weapon, level, god and bombs.
- Human check outstanding for the verifier: open `npm run preview` at `/?debug&bombs=5`, confirm five amber pips that drop by one per bomb and that Copy report ends its flags line with `bombs=5`.

## Self-Check: PASSED

- Files: entrypoint.py, url_flags.js, status_readout.js, report.js, perf_node.mjs, bomb.spec.js all present.
- Commits: 57f129d, c67eb01, 7484555 are ancestors of HEAD; `git rev-list --count` from the plan base is 3.
- Gates: `make check` exit 0; `make perf` three runs under 3 ms with bombs; `grep innerHTML web/src/ui/status_readout.js` prints nothing; `grep -n -- "--bomb 300" package.json` matches.

---
*Phase: 02-arcade-shooting-feel*
*Completed: 2026-10-18*
