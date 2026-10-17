---
phase: 01-playable-core-on-real-devices
plan: 10
subsystem: release-and-device-gate
tags: [go-no-go, device-reports, github-pages, pr-preview, deploy-verification, playwright]

requires:
  - phase: 01-playable-core-on-real-devices
    provides: "Live GitHub Pages deploy, Preview workflow and tools/wait_for_deploy.mjs (01-02), ?debug overlay with Copy report and ?stress/?tier flags (01-03, 01-04), the complete Phase 1 game (01-05 to 01-09)"
provides:
  - "01-DEVICE-REPORTS.md: verbatim desktop reports, pass/fail table, and the verdict GO (desktop), phone performance gate DEFERRED"
  - "First live exercise of D-04 PR previews (PR #1: Preview workflow success, preview URL served, then removed on merge)"
  - "main pushed as a fast-forward (f52e3e2..060161b), Deploy green, live smoke green, live build hash equals HEAD"
affects: [phase-02, verify-work, roadmap-go-no-go-gate]

plan_head_before: f52e3e2b8cd336ec496c93f1d5094ec9c5b2b27c
plan_head_after: 060161b174ea0e26796780074378a755b9083c47

actuals:
  tokens: 6500
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Device verdicts are computed from pasted raw reports; an unmeasured device is recorded as NOT MEASURED, never inferred"
    - "Main is pushed fast-forward from the PR head so GitHub marks the PR merged and the Preview workflow cleans up"

key-files:
  created:
    - .planning/phases/01-playable-core-on-real-devices/01-DEVICE-REPORTS.md
    - .planning/phases/01-playable-core-on-real-devices/01-10-SUMMARY.md
  modified: []

key-decisions:
  - "Verdict is GO (desktop) with the phone performance gate DEFERRED, not a full GO: the user chose to skip phone reports, so PLAT-05 and the phone half of ROADMAP success criterion 3 are undecided"
  - "PLAT-01 and PLAT-04 are marked complete (desktop evidence plus a live shareable URL); PLAT-05 stays pending"
  - "The informal remark that the game was smooth on a phone is recorded as a qualitative observation only; the per-item feel checklist is recorded as not itemized"

requirements-completed: [PLAT-01, PLAT-04]
requirements-deferred: [PLAT-05]

coverage:
  - id: D1
    description: "Desktop passes the PLAT-04 bar on the PR preview: stress=500, auto tier, 60.0 fps, p95 16.7 ms, tick ~1.1 ms, final tier high with bloom"
    requirement: "PLAT-04"
    verification:
      - kind: manual_procedural
        ref: "01-DEVICE-REPORTS.md Desktop 5-minute auto tier report (user-pasted, Firefox 158, Adreno X1-45)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Shareable URL is live on the real static host, serves the pushed build, and the smoke spec passes against it"
    requirement: "PLAT-01"
    verification:
      - kind: e2e
        ref: "make e2e-live (tools/e2e/smoke.spec.js against https://rguillon.github.io/Stratoburst/): 1 passed"
        status: pass
      - kind: command
        ref: "Deploy run 39055857002 success; live __scorched.build 060161b equals git rev-parse --short HEAD"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-04 PR previews work end to end: Preview run success, preview URL opened by the user, folder removed after merge"
    verification:
      - kind: command
        ref: "Actions runs 39054200041 (opened) and 39055858288 (closed), gh-pages commits b7545ca and aea4958, preview URL now 404"
        status: pass
    human_judgment: false
  - id: D4
    description: "Phone performance on Android and iPhone (PLAT-05, ROADMAP success criterion 3 on phones)"
    requirement: "PLAT-05"
    verification: []
    human_judgment: true
    rationale: "Not measured. The user deferred phone reports. Needs the Part B protocol on a mid-range Android phone and a recent iPhone."
  - id: D5
    description: "Per-item feel checklist (items 5 to 12): loading bar, letterbox in both orientations, keyboard, 1:1 touch drag, hitbox and effects, auto-pause, ?crash=py panel, Network br check"
    verification: []
    human_judgment: true
    rationale: "The user reported 'no problem observed' but did not itemize the checklist; no item is claimed as passed."

duration: 30min
completed: 2026-10-17
status: complete
---

# Phase 1 Plan 10: Real-device go/no-go and ship Summary

**Desktop go/no-go passed (60.0 fps, p95 16.7 ms, 1.1 ms Python tick at stress=500 with bloom), the Phase 1 game is live on GitHub Pages at the pushed build hash, and PR previews are proven end to end; the phone performance gate is deferred by the user and stays open.**

## Verdict line

**GO (desktop) — phone performance gate DEFERRED.** No NO-GO lever applies: there is no phone data to classify a bottleneck. See `01-DEVICE-REPORTS.md`.

## Performance

- **Duration:** about 30 min across the original and this continuation (Task 2 waited on the user)
- **Completed:** 2026-10-17T17:59Z
- **Tasks:** 3 (Task 2 was the blocking-human device session, resolved by the user with a partial result)
- **Files modified:** 2 documents (01-DEVICE-REPORTS.md, this summary); no production code

## Accomplishments

- All local gates were green before the push (Task 1, baseline `f52e3e2`): pytest 357 passed at 100.00% line + branch, vitest 330 passed, Playwright 39 passed, Vite build, `make perf` avg 0.5601 ms (budget 3 ms).
- Desktop (Snapdragon X, Windows 11, Firefox 158, Adreno X1-45 via ANGLE D3D11) passed every bar on the 5.2 minute auto-tier stress=500 run: avg fps 60.0 in every minute, p95 frame 16.7 ms, avg tick 1.08 to 1.12 ms (p95 2.00 ms), final tier high with bloom on, time to gate 2.4 s. The forced `tier=low` (1.3 min) and `tier=high` (0.5 min) runs also held 60.0 fps; both were shorter than the 2 minute protocol.
- Preview build `b807fd8` was verified through the public API to be the PR #1 merge ref (`merge_commit_sha b807fd80c8...`), not the PR head `a09c57b`.
- D-04 previews worked live: PR #1 Preview run 39054200041 succeeded, the user opened the preview on a desktop and a phone, and after merge run 39055858288 removed the folder (gh-pages commit `aea4958`, preview URL now HTTP 404).
- `git push origin main` fast-forwarded `f52e3e2..060161b` with no force; PR #1 became `merged: true`. Deploy run 39055857002 concluded success, `make e2e-live` passed (1 passed), and the live `?debug` page reports `__scorched.build = 060161b`, equal to `git rev-parse --short HEAD`.

## Task Commits

1. **Task 1: Run every gate and push the PR branch** - `a09c57b` (docs: device-gate report template with pass bars and local gate results). Branch `gsd/phase-01-device-gate` pushed; PR #1 opened by the user.
2. **Task 2: Real-device session (checkpoint, blocking-human)** - no commit. Resolved by the user with desktop reports only; phones skipped by choice.
3. **Task 3: Verdict, deploy and live verification** - `060161b` (docs: record desktop device reports and verdict, phone gate deferred)

**Plan metadata:** the commit that adds this summary and the STATE, ROADMAP and REQUIREMENTS updates (docs: complete plan).

## Files Created/Modified

- `.planning/phases/01-playable-core-on-real-devices/01-DEVICE-REPORTS.md` - verbatim desktop reports, NOT MEASURED sections for Android and iPhone, pass/fail table, live verification table and the verdict with follow-ups.

## Decisions Made

- The verdict is "GO (desktop) — phone performance gate DEFERRED", not a plain GO. Writing GO would have claimed phone evidence that does not exist.
- PLAT-04 is marked complete: its wording (60 fps on a mid-range desktop browser, 400+ bullets, effects on) is met by the stress=500 run with bloom at the high tier. Caveats: one machine, one browser (Firefox), and `stress=500` stands in for a full stage load that arrives in later phases.
- PLAT-01 is marked complete: the single shareable URL is live on static hosting, serves the pushed build, passes the live smoke spec, and the user reports it ran smoothly on desktop and a phone. Its wording says "desktop or mobile browser".
- PLAT-05 (30 fps steady on a mid-range Android and a recent iPhone) stays pending: nothing was measured on phones.
- The pasted reports (UA, screen, GPU strings) were committed to the public repo after the user was told beforehand, per threat T-01-25.

## Deviations from Plan

### Plan-shape deviation (not an auto-fix)

**Task 2 was only partly satisfied.** The acceptance criteria asked for a 5-minute auto-tier report on each of 3 devices. The user supplied desktop only (with shorter forced-tier runs) and explicitly skipped Android and iPhone. The orchestrator accepted this and directed the verdict wording and requirement handling. Task 3 step 3's GO condition ("every bar passes on all three devices") therefore cannot be met, so the verdict is the conditional "GO (desktop)" and the gap is carried as follow-ups below. No code was changed.

**Total deviations:** 0 auto-fixed. **Impact on plan:** The phase's ROADMAP go/no-go gate is only half decided; the stack is not shown to be wrong, but the phone half is open.

## Issues Encountered

- A first attempt to read the live build hash waited for `__scorched.ready` without clicking the start gate and timed out. `__scorched` only becomes ready after the gate (`web/src/main.js`). Clicking the gate first returned `060161b`. A tooling slip, not a game defect.
- The `E2E` workflow run for push `060161b` (39055856961) took several minutes after the Deploy run finished; it later concluded success.

## Findings

- Preview cleanup worked, and the later Deploy did not resurrect `pr-preview/pr-1`, even though both workflows were triggered by the same push. One empty `pr-preview/pr-1/.nojekyll` file remains on gh-pages (cosmetic, no action).
- The in-browser Python tick (about 1.1 ms) is about 2x the Node perf harness figure (0.56 ms). Headroom against the 3 ms budget remains, but the Node harness understates browser cost.
- Desktop frame time is pinned at the 60 Hz vsync cap on every tier, so these runs prove headroom but cannot rank the tiers. No tier change was logged.
- Auto tier on this display rendered at an effective scale of 0.74 and still held 60 fps.

## Remaining human verification (route to UAT / verify-work)

1. **Phone protocol (Part B), open.** On a mid-range Android phone and a recent iPhone: `https://rguillon.github.io/Stratoburst/?debug&stress=500`, 5 continuous minutes on the auto tier, plus 2 minutes each at `&tier=low` and `&tier=high`; paste the Copy report output into the Android and iPhone sections of `01-DEVICE-REPORTS.md`, with model, browser and power state. Bars: avg fps >= 29, p95 frame <= 40 ms, no minute under 29 fps, final tier keeps bloom. This decides PLAT-05 and the phone half of ROADMAP success criterion 3 and closes the "After Phase 1 (go/no-go)" gate.
2. **Per-item feel checklist (items 5 to 12)** from the plan, itemized: loading bar, letterbox in both orientations and on resize, keyboard control and pause keys, 1:1 touch drag with auto-fire, hitbox and effects, auto-pause and resume, `?crash=py` error panel, Network tab (`content-encoding: br` from cdn.jsdelivr.net, no CORS errors).
3. **Safari A6 and time-to-gate on phones:** streaming compile reaching 80% through the progress wrapper; time-to-gate per phone (Open Question 5).
4. Optional: a Chromium desktop run, and full 2 minute forced-tier desktop runs for tier comparison.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The game is live and shareable at https://rguillon.github.io/Stratoburst/ and deploys on each push to main.
- Blocker for confident Phase 2 mobile work: the phone go/no-go is undecided (PLAT-05 pending). If the phone run later misses the bars, the levers are, in order: tick-bound means lower caps, then numpy, then a Worker; GPU or fill-bound means lower tiers, then glow sprites instead of bloom; otherwise the Babylon.js fallback renderer.

---
*Phase: 01-playable-core-on-real-devices*
*Completed: 2026-10-17*

## Self-Check: PASSED

Found: 01-DEVICE-REPORTS.md, 01-10-SUMMARY.md; commits a09c57b and 060161b are ancestors of HEAD; the `## Verdict` heading exists; Deploy 39055857002, E2E 39055856961 and the live smoke spec all succeeded.
