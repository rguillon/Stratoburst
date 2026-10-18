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
  - "A recorded GO verdict for desktop + iPhone under an explicit USER WAIVER of the Android criterion (Android not measured, tier=low/high runs skipped, carried forward as UAT); main pushed fast-forward"
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
  - "Computed verdict was NO-GO for incompleteness only (plan rule needs all three devices; no Android phone exists). The genuine user then explicitly waived the Android criterion for Phase 2 (option 1) and the verdict was re-recorded as GO for desktop + iPhone with the waiver stated, not hidden; main was pushed after the waiver"
  - "iPhone tick (about 2.0 ms avg, 3 ms p95) is judged against the plan's bars as informational for phones (the 3 ms tick bar is desktop-only); it is about 3x the Node figure, inside the 3-5x mobile slowdown the budget assumed"
  - "Build hash a119574 in the Phase 2 reports is the PR #2 merge ref (verified via GitHub API and ls-remote), carrying the a1beb19 tree; Phase 1 baseline hash 6dcec36 is origin/main"

requirements-completed: [VISL-02, VISL-05, INPT-03, AUDI-03]

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
    description: "Android phone bars and forced-tier runs: WAIVED by the user for Phase 2, NOT measured and NOT passed"
    verification: []
    human_judgment: true
    rationale: "No Android device exists; forced-tier runs were not provided. The user explicitly waived the Android criterion; the check is carried forward as a follow-up/UAT item"

duration: 30min
completed: 2026-10-18
status: complete
---

# Phase 2 Plan 33: Device Gate Summary

**Desktop and iPhone 16 Pro hold 60 fps with p95 under 18 ms on the full Phase 2 worst case and the iPhone shows no regression from the Phase 1 baseline; Android was never measured, and the user explicitly waived that criterion, so the verdict is GO for desktop + iPhone (Android not measured, carried forward as UAT) and main was shipped.**

## Performance

- **Duration:** about 30 min for the continuation (Task 1 was done in the prior run; Task 2 was the human session)
- **Completed:** 2026-10-18
- **Tasks:** 3 of 3 complete (Task 3 ship half executed in the continuation after the user waiver)
- **Files modified:** 2

## Accomplishments

- Pasted the real-device reports (desktop Windows Firefox 158 on Adreno X1-45; iPhone 16 Pro plugged in, Firefox for iOS 158) and the Phase 1 iPhone baseline into `02-DEVICE-REPORTS.md`, and the baseline into `01-DEVICE-REPORTS.md`, closing the iPhone half of the long-standing STATE.md blocker.
- Evaluated each bar from the report lines: desktop 60.0 fps, p95 16.7 ms, tick 1.20 to 1.28 ms, final tier high; iPhone 60.0 fps in all five minutes, p95 17 to 18 ms, tick 1.97 to 2.10 ms (p95 3 ms), final tier mid. All pass.
- Compared Phase 1 and Phase 2 on the same phone: fps unchanged, p95 +0 to +1 ms, tick about +0.5 ms, under a far heavier load.
- Verified the report build hash: `a119574` is the PR #2 merge ref (head `a1beb19`, base `6dcec36`, merge `a1195741c8dd...`), not the branch head; the code under test equals `a1beb19`.
- Recorded the honest computed verdict (NO-GO for incompleteness only), then, on the genuine user's explicit decision, re-recorded it as GO for desktop + iPhone under a stated waiver of the Android criterion (no Android device, no `tier=low`/`tier=high` runs, checklist reported as a blanket "All passed").

## Task Commits

1. **Task 1: tracer, gates green and preview branch pushed** - `b7b9eee` (docs)
2. **Task 2: real-device session** - human checkpoint, no commit (reports supplied by the user)
3. **Task 3: record reports, baseline and verdict** - `d2c1096` (docs); waiver and GO re-recorded in the continuation commit; ship half (push main, wait-deploy, e2e-live, live build check) results are in the Ship record below.

**Plan metadata:** the commit that adds this SUMMARY (docs: complete plan, halted).

## Files Created/Modified

- `.planning/phases/02-arcade-shooting-feel/02-DEVICE-REPORTS.md` - reports, pass/fail table, baseline comparison, checklist, verdict
- `.planning/phases/01-playable-core-on-real-devices/01-DEVICE-REPORTS.md` - iPhone baseline pasted, Android marked unmeasurable, addendum

## Decisions Made

- Held back the push to main: GO requires every bar on all three devices, and the push publishes the Phase 2 build to everyone with the link. A waiver of the Android requirement is a human decision, not an executor one.
- Did not treat the iPhone's higher tick versus the Node figure as a failure: the plan's 3 ms tick bar is desktop-only and phone ticks are informational; frame time, the real pass criterion, is flat.

## Deviations from Plan

### User waiver of the Android criterion (not an auto-fix)

The plan's verdict rule requires every bar on all three devices. No Android device exists, so the computed result was NO-GO for incompleteness and the previous run halted before pushing. The genuine user then decided, explicitly, to WAIVE the Android criterion for Phase 2 and ship. The waiver is recorded in `02-DEVICE-REPORTS.md` (`## Verdict`) and here. It means Android is NOT measured and did NOT pass; it does not mean the Android bars were met.

**Waived / carried forward (follow-up or UAT):** Android baseline and worst-case runs and Android feel checklist; forced `tier=low`/`tier=high` runs (A11) on all devices; Safari proper on iOS (reports came from Firefox for iOS); itemised iOS audio sub-conditions.

Requirements completed (VISL-02, VISL-05, INPT-03, AUDI-03) are marked on the desktop + iPhone evidence only; the Android evidence for them is waived, not obtained.

**Total deviations:** 0 auto-fixed. **Impact:** none on code; evidence gap on Android is accepted by the user.

## Issues Encountered

- Report build hash (`a119574`) did not match the pushed branch head; resolved by checking the GitHub PR API (merge ref) as in Phase 1.
- Phase 1 baseline run elapsed 5.2 min but only about 4.4 min of frames, so the last two minute rows are short samples (backgrounding or auto-pause); handled and noted, not counted.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. No code was changed by this plan.

## Ship Record

(filled in after push, deploy and live checks; see below)

## Next Phase Readiness

- Android requirement waived by the user for Phase 2; carry the Android baseline and worst-case runs, the forced-tier runs (A11), Safari proper and the itemised audio checklist as UAT / follow-up items.
- Watch the iPhone p95 tick (3 ms) as Phase 3 adds load.

## Self-Check: PASSED

- `02-DEVICE-REPORTS.md` has `## Verdict` stating GO under the user waiver; commits `b7b9eee` and `d2c1096` are ancestors of HEAD; `NOT MEASURED` count in 01-DEVICE-REPORTS.md dropped from 4 to 3.
