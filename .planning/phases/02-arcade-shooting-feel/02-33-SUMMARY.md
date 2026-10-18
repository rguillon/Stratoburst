---
phase: 02-arcade-shooting-feel
plan: 33
subsystem: testing
tags: [device-gate, real-devices, iphone, firefox-ios, performance, go-no-go]

requires:
  - phase: 02-arcade-shooting-feel
    provides: "the complete Phase 2 build, the report flags/audio lines (02-27, 02-32), make check / make perf gates"
provides:
  - "Real-device Phase 2 reports for desktop and iPhone 16 Pro, with the pass/fail table and the feel checklist in 02-DEVICE-REPORTS.md"
  - "The Phase 1 iPhone baseline measured from the live Phase 1 build and pasted into 01-DEVICE-REPORTS.md, side by side with Phase 2"
  - "A recorded NO-GO (incompleteness only) verdict: Android unmeasured, main deliberately not pushed"
affects: [phase-02-verification, phase-03-planning, ship-to-main]

actuals:
  tokens: 9000
  tasks: 3
  commits: 2
plan_head_before: a1beb19111f4a6d57e2616e47ddcdd986b172cc3
plan_head_after: d2c1096396366dcdf562ba8000f138d5bfa70572

tech-stack:
  added: []
  patterns:
    - "Device gate verdicts are computed from pasted report lines against written bars; missing devices make the verdict NO-GO-incomplete, never an assumed pass"

key-files:
  created:
    - .planning/phases/02-arcade-shooting-feel/02-DEVICE-REPORTS.md
  modified:
    - .planning/phases/01-playable-core-on-real-devices/01-DEVICE-REPORTS.md

key-decisions:
  - "Verdict is NO-GO for incompleteness only: the plan's rule requires every bar on all three devices and no Android phone was available; main was not pushed because the push publishes the build to everyone and the plan ties it to the verdict"
  - "iPhone tick (about 2.0 ms avg, 3 ms p95) is judged against the plan's bars as informational for phones (the 3 ms tick bar is desktop-only); it is about 3x the Node figure, inside the 3-5x mobile slowdown the budget assumed"
  - "Build hash a119574 in the Phase 2 reports is the PR #2 merge ref (verified via GitHub API and ls-remote), carrying the a1beb19 tree; Phase 1 baseline hash 6dcec36 is origin/main"

requirements-completed: []

coverage:
  - id: D1
    description: "Desktop passes the Phase 2 worst-case bars with the full effect stack (60.0 fps, p95 16.7 ms, tick 1.25 ms, tier high)"
    requirement: "VISL-02"
    verification:
      - kind: other
        ref: "02-DEVICE-REPORTS.md Desktop section (real device report a119574)"
        status: pass
    human_judgment: false
  - id: D2
    description: "iPhone 16 Pro passes the phone bars and shows no regression versus the Phase 1 baseline measured on the same phone"
    requirement: "VISL-05"
    verification:
      - kind: other
        ref: "02-DEVICE-REPORTS.md iPhone and Phase 1 baseline sections"
        status: pass
    human_judgment: false
  - id: D3
    description: "iOS audio after the start tap with ringer on/off and after app switch, and the touch bomb button, reported as all passed by the user (not itemised, Firefox for iOS not Safari)"
    requirement: "AUDI-03"
    verification: []
    human_judgment: true
    rationale: "Audibility and touch ergonomics are judged by the user; the reply was a blanket 'All passed' without per-sub-condition detail"
  - id: D4
    description: "Android phone bars, forced-tier runs and the live deploy of main"
    verification: []
    human_judgment: true
    rationale: "No Android device exists; forced-tier runs were not provided; main was not pushed so nothing was deployed or verified live"

duration: 30min
completed: 2026-10-18
status: halted
---

# Phase 2 Plan 33: Device Gate Summary

**Desktop and iPhone 16 Pro hold 60 fps with p95 under 18 ms on the full Phase 2 worst case and the iPhone shows no regression from the Phase 1 baseline, but Android was never measured so the verdict is NO-GO for incompleteness and main was deliberately not pushed.**

## Performance

- **Duration:** about 30 min for the continuation (Task 1 was done in the prior run; Task 2 was the human session)
- **Completed:** 2026-10-18
- **Tasks:** 3 of 3 attempted; Task 3 completed its recording half and halted before its ship half
- **Files modified:** 2

## Accomplishments

- Pasted the real-device reports (desktop Windows Firefox 158 on Adreno X1-45; iPhone 16 Pro plugged in, Firefox for iOS 158) and the Phase 1 iPhone baseline into `02-DEVICE-REPORTS.md`, and the baseline into `01-DEVICE-REPORTS.md`, closing the iPhone half of the long-standing STATE.md blocker.
- Evaluated each bar from the report lines: desktop 60.0 fps, p95 16.7 ms, tick 1.20 to 1.28 ms, final tier high; iPhone 60.0 fps in all five minutes, p95 17 to 18 ms, tick 1.97 to 2.10 ms (p95 3 ms), final tier mid. All pass.
- Compared Phase 1 and Phase 2 on the same phone: fps unchanged, p95 +0 to +1 ms, tick about +0.5 ms, under a far heavier load.
- Verified the report build hash: `a119574` is the PR #2 merge ref (head `a1beb19`, base `6dcec36`, merge `a1195741c8dd...`), not the branch head; the code under test equals `a1beb19`.
- Recorded the honest verdict: NO-GO under the plan's rule for incompleteness only (no Android, no `tier=low`/`tier=high` runs, checklist reported as a blanket "All passed").

## Task Commits

1. **Task 1: tracer, gates green and preview branch pushed** - `b7b9eee` (docs)
2. **Task 2: real-device session** - human checkpoint, no commit (reports supplied by the user)
3. **Task 3: record reports, baseline and verdict** - `d2c1096` (docs). The ship half (push main, `make wait-deploy`, `make e2e-live`, live build-hash check) was NOT executed.

**Plan metadata:** the commit that adds this SUMMARY (docs: complete plan, halted).

## Files Created/Modified

- `.planning/phases/02-arcade-shooting-feel/02-DEVICE-REPORTS.md` - reports, pass/fail table, baseline comparison, checklist, verdict
- `.planning/phases/01-playable-core-on-real-devices/01-DEVICE-REPORTS.md` - iPhone baseline pasted, Android marked unmeasurable, addendum

## Decisions Made

- Held back the push to main: GO requires every bar on all three devices, and the push publishes the Phase 2 build to everyone with the link. A waiver of the Android requirement is a human decision, not an executor one.
- Did not treat the iPhone's higher tick versus the Node figure as a failure: the plan's 3 ms tick bar is desktop-only and phone ticks are informational; frame time, the real pass criterion, is flat.

## Deviations from Plan

### Gate outcome (not an auto-fix)

Task 3 steps 4 and 5 (push main, `make wait-deploy`, `make e2e-live`, live `__scorched.build` and ENEMY_N check, preview cleanup check) were intentionally not performed because the verdict rule yields NO-GO and the plan's own success path ties the push to a GO. Acceptance criterion 3 of Task 3 (Deploy run succeeded, live smoke passed, live build hash equals HEAD) is therefore unmet and recorded as deferred.

**Total deviations:** 0 auto-fixed. **Impact:** the ship half of the plan waits for a human decision on Android.

## Issues Encountered

- Report build hash (`a119574`) did not match the pushed branch head; resolved by checking the GitHub PR API (merge ref) as in Phase 1.
- Phase 1 baseline run elapsed 5.2 min but only about 4.4 min of frames, so the last two minute rows are short samples (backgrounding or auto-pause); handled and noted, not counted.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. No code was changed by this plan.

## Next Phase Readiness

- Decision needed from the user: (a) waive the Android requirement for Phase 2 and record GO for desktop + iPhone, then push main fast-forward and run `make wait-deploy SHA="$(git rev-parse HEAD)"` and `make e2e-live`; (b) get an Android phone run; or (c) move Android to UAT.
- Open: forced `tier=low`/`tier=high` runs (assumption A11), Safari proper (reports came from Firefox for iOS), itemised checklist for the audio ringer/app-switch sub-conditions. Watch the iPhone p95 tick (3 ms) as Phase 3 adds load.

## Self-Check: PASSED

- `02-DEVICE-REPORTS.md` has `## Verdict`; commits `b7b9eee` and `d2c1096` are ancestors of HEAD; no files deleted by the commits; `NOT MEASURED` count in 01-DEVICE-REPORTS.md dropped from 4 to 3.
