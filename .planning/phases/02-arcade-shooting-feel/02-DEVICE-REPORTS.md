# Phase 2 Device Reports and Go/No-Go Verdict

Plan 02-33. Measurements come from real hardware against the real static host. WSL2 SwiftShader numbers do not count.

**Status in one line: GO for desktop + iPhone, by an explicit USER WAIVER of the Android criterion. Android was NOT measured (the user has no Android device), the `tier=low`/`tier=high` runs were skipped, and the Android check is carried forward as a follow-up/UAT item. Android did not pass; it was not tested. Main was pushed after the waiver.**

## Header

| Field | Value |
|-------|-------|
| Date prepared / measured | 2026-10-18 |
| Code under test | `a1beb19` (head of `gsd/phase-02-device-gate`, and of PR #2) |
| Build hash printed by the Phase 2 reports | `a119574`, the PR #2 merge ref (see Build hash note) |
| Build hash printed by the Phase 1 baseline reports | `6dcec36`, the head of `origin/main`, which is the live Phase 1 build |
| Branch | `gsd/phase-02-device-gate` |
| Live URL (still serves the Phase 1 build) | https://rguillon.github.io/Stratoburst/ |
| Compare link | https://github.com/rguillon/Stratoburst/compare/main...gsd/phase-02-device-gate?expand=1 |
| PR number | 2 (still open: main has not been pushed) |
| Preview URL | `https://rguillon.github.io/Stratoburst/pr-preview/pr-2/` |

### Build hash note

The Phase 2 reports print `build: a119574`, which is neither the branch head (`a1beb19`) nor the local `main` head. Verified through the public GitHub API and `git ls-remote` (`gh` is not installed): PR #2 reports `head.sha = a1beb19111f4a6d57e2616e47ddcdd986b172cc3`, `base.sha = 6dcec3665be99307ca3a2c6c610f340014287824` and `merge_commit_sha = a1195741c8ddae8249ffa9bfcae1abc115298d71`, and `refs/pull/2/merge` points at that same commit. `a119574` is therefore the short hash of the synthetic merge ref that `pull_request` workflows build, the same situation as PR #1 in Phase 1. `6dcec36` is an ancestor of `a1beb19`, so the merge ref carries exactly the `a1beb19` tree. The local `main` head (`b7b9eee`) adds only this report file on top of `a1beb19`, so the code the devices ran is the code that would ship. The merge commit object is not fetchable locally, so `a119574` cannot be resolved with `git cat-file`; that is expected for a GitHub-side ref.

## Local gates before the push (Task 1)

All run through the Makefile targets on `a1beb19`.

| Gate | Result |
|------|--------|
| `make check` (ruff check, ruff format --check, pytest 100% line + branch, vitest, Vite build, Playwright) | pass: Playwright 73 passed |
| `make perf` (500 stress bullets, enemy fire, fire held, bomb at tick 300, Pyodide on Node, budget 3 ms) | pass: three lines below |

```
{"stress":500,"fire":1,"weapon":"vulcan","level":5,"bomb":300,"ticks":600,"avg_ms":0.6786,"p95_ms":0.76,"budget_ms":3,"peak_output":65,"peak_bomb_phase":2}
{"stress":500,"fire":1,"weapon":"laser","level":5,"bomb":300,"ticks":600,"avg_ms":0.5289,"p95_ms":0.5788,"budget_ms":3,"peak_output":7,"peak_bomb_phase":2}
{"stress":500,"fire":1,"weapon":"homing","level":5,"bomb":300,"ticks":600,"avg_ms":0.6172,"p95_ms":0.6848,"budget_ms":3,"peak_output":35,"peak_bomb_phase":2}
```

## Pass bars

Copied from the plan must_haves (truths 3 and 4).

| Bar | Desktop | Each phone (Android, iPhone) |
|-----|---------|------------------------------|
| Run | `?debug&stress=500&god&weapon=homing&level=5`, auto tier, fire held, a bomb about every 30 s | same URL, 5 continuous minutes |
| Average fps | >= 58 | >= 29 |
| p95 frame time | <= 20 ms | <= 40 ms |
| Worst single-minute average fps | not required | >= 29 |
| Final tier keeps bloom | high or mid | high or mid |
| Python tick average | <= 3 ms | recorded for information |
| Forced `tier=low` and `tier=high`, 2 minutes each | recorded | recorded for comparison |

## Protocol URLs

- Worst-case run (Phase 2 build): `<preview URL>?debug&stress=500&god&weapon=homing&level=5`, fire held (Space or J on desktop, auto-fire on touch), a bomb about every 30 s (K on desktop, the bomb button on phones, or add `&bombs=7`). 5 minutes, then Copy report. Repeat for 2 minutes each with `&tier=low` and `&tier=high` added.
- Baseline run (Phase 1 build): `https://rguillon.github.io/Stratoburst/?debug&stress=500`, 2 minutes per phone on the auto tier.

## Devices and session notes

| Device | Details |
|--------|---------|
| Desktop | Windows laptop, Firefox 158, Qualcomm Adreno X1-45 via ANGLE Direct3D11, 3072x1728 at DPR 1.25 |
| iPhone | iPhone 16 Pro, plugged in, Firefox for iOS (FxiOS 158, iOS 18.7; it runs on WebKit like every iOS browser, but it is not Safari), 402x874 at DPR 3 (effective 1.50) |
| Android | none. The user has no Android device, so there is no Android baseline and no Android Phase 2 report |

The user was told beforehand that pasted text (user agent, screen and GPU strings) becomes public, and pasted these reports for that purpose. Nothing was added to them and nothing was redacted by the executor.

Not provided: the `tier=low` and `tier=high` 2-minute runs (skipped, any device). The Phase 1 baseline run on the iPhone lasted 5.2 min rather than the 2 min protocol (longer is fine for a baseline); its power state was not stated separately and the same plugged-in iPhone 16 Pro is assumed.

## Desktop

Worst case, Phase 2 build (PR #2 preview), auto tier. Pasted verbatim.

```
ua: Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:158.0) Gecko/20100101 Firefox/158.0
screen: 3072x1728 (css 3072x1643); dpr: 1.25 (effective 0.74); canvas: 2288x1223
gl renderer: ANGLE (Qualcomm, Adreno (TM) X1-45 Direct3D11 vs_5_0 ps_5_0), or similar
precision: highp (23 bits); pyodide 314.0.7; three 0.186.1; build: a119574
flags: debug=on stress=500 tier=auto crash=none weapon=homing level=5 god=on bombs=default
audio: running; tier: high; time to gate: 3.0 s; elapsed: 5.4 min; tier log: none
minute 0: frames 3599, avg fps 60.0, p95 frame 16.7 ms, avg tick 1.28 ms, p95 tick 2.00 ms
minute 1: frames 3600, avg fps 60.0, p95 frame 16.7 ms, avg tick 1.25 ms, p95 tick 2.00 ms
minute 2: frames 3600, avg fps 60.0, p95 frame 16.7 ms, avg tick 1.25 ms, p95 tick 2.00 ms
minute 3: frames 3600, avg fps 60.0, p95 frame 16.7 ms, avg tick 1.27 ms, p95 tick 2.00 ms
minute 4: frames 3600, avg fps 60.0, p95 frame 16.7 ms, avg tick 1.20 ms, p95 tick 2.00 ms
minute 5: frames 1414, avg fps 60.0, p95 frame 16.7 ms, avg tick 1.23 ms, p95 tick 2.00 ms   (partial minute)
```

## Android

**NOT MEASURED. No Android device is available to the user.** There is no Android baseline and no Android Phase 2 report. This is a gap in evidence, not a pass: the plan's phone bars were written for "both phones" and the Android half is undecided. No Android-specific behaviour (Chrome on Adreno/Mali/Xclipse, thermal throttling, touch bomb button geometry on Android) was observed by anyone.

## iPhone

iPhone 16 Pro, plugged in, Firefox for iOS (FxiOS 158), iOS 18.7. Worst case, Phase 2 build (PR #2 preview), auto tier. Pasted verbatim.

```
ua: Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/158.0 Mobile/15E148 Safari/604.1
screen: 402x874 (css 402x670); dpr: 3 (effective 1.50); canvas: 603x1005
gl renderer: Apple GPU; precision: highp (23 bits); pyodide 314.0.7; three 0.186.1; build: a119574
flags: debug=on stress=500 tier=auto crash=none weapon=homing level=5 god=on bombs=default
audio: running; tier: mid; time to gate: 1.3 s; elapsed: 5.0 min; tier log: none
minute 0: frames 3593, avg fps 60.0, p95 frame 18.0 ms, avg tick 1.97 ms, p95 tick 3.00 ms
minute 1: frames 3599, avg fps 60.0, p95 frame 18.0 ms, avg tick 1.99 ms, p95 tick 3.00 ms
minute 2: frames 3600, avg fps 60.0, p95 frame 17.0 ms, avg tick 2.10 ms, p95 tick 3.00 ms
minute 3: frames 3599, avg fps 60.0, p95 frame 18.0 ms, avg tick 1.98 ms, p95 tick 3.00 ms
minute 4: frames 3531, avg fps 60.0, p95 frame 18.0 ms, avg tick 2.10 ms, p95 tick 3.00 ms
```

## Phase 1 baseline (live URL)

iPhone 16 Pro, the same device and browser as above. Phase 1 build `6dcec36` on the live URL, `?debug&stress=500`, auto tier. Pasted verbatim. There is no Android baseline.

```
ua: Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/158.0 Mobile/15E148 Safari/604.1
screen: 402x874 (css 402x670); dpr: 3 (effective 1.50); canvas: 603x1005
gl renderer: Apple GPU; precision: highp (23 bits); pyodide 314.0.7; three 0.186.1; build: 6dcec36
flags: debug=on stress=500 tier=auto crash=none
tier: mid; time to gate: 1.8 s; elapsed: 5.2 min; tier log: none
minute 0: frames 3588, avg fps 59.8, p95 frame 17.0 ms, avg tick 1.47 ms, p95 tick 2.00 ms
minute 1: frames 3316, avg fps 59.9, p95 frame 17.0 ms, avg tick 1.43 ms, p95 tick 2.00 ms
minute 2: frames 3600, avg fps 60.0, p95 frame 17.0 ms, avg tick 1.51 ms, p95 tick 2.00 ms
minute 3: frames 3599, avg fps 60.0, p95 frame 17.0 ms, avg tick 1.51 ms, p95 tick 2.00 ms
minute 4: frames 1491, avg fps 59.8, p95 frame 17.0 ms, avg tick 1.49 ms, p95 tick 2.00 ms
minute 5: frames 98, avg fps 56.3, p95 frame 25.0 ms, avg tick 0.14 ms, p95 tick 1.00 ms   (partial minute)
```

The frame counts sum to 15692 (about 4.4 min at 60 fps) over 5.2 min elapsed, with minute 4 holding only 1491 frames and minute 5 only 98. The page was probably backgrounded or auto-paused for part of the run, so the last two rows are short samples. Minute 5 covers 1.6 s and is a partial window; it is excluded from the baseline averages below, and it would still clear the 29 fps / 40 ms bars if counted.

## Feel checklist

The user answered **"All passed"** for all 10 items, on the devices they have: desktop and iPhone, with items 9 and 10 on the iPhone (the reply does not say which device ran items 1 to 8, so both are credited only as far as the blanket answer goes). Recorded exactly as stated. Caveats:

- Not itemised: the user gave a single blanket answer, so no per-item notes exist. In particular item 9 has three sub-conditions (ringer ON, ringer OFF, and after switching apps and back) and the reply does not separate them. The reports do show `audio: running` on both desktop and iPhone at the end of the 5-minute run, which is consistent with the audio context staying unlocked but does not prove audibility.
- Item 9 was tested in Firefox for iOS (WebKit under the hood), not in Safari as the plan wrote it. Research assumption A8 (audioSession 'playback' with the silent switch) is judged on that browser.
- Item 10 (touch bomb button): iPhone only, portrait and landscape as claimed by the blanket answer. Android was not tested.
- No Android device ran any checklist item.

## Pass/fail table

Values are parsed from the report lines above. "Worst minute" uses full minutes (partial minutes excluded; the desktop partial minute is 60.0 anyway).

| Device | Bar | Required | Measured | Result |
|--------|-----|----------|----------|--------|
| Desktop (auto, 5.4 min) | Average fps | >= 58 | 60.0 (every minute) | PASS |
| Desktop | p95 frame time | <= 20 ms | 16.7 ms (every minute) | PASS |
| Desktop | Final tier keeps bloom | high or mid | high | PASS |
| Desktop | Python tick average | <= 3 ms | 1.20 to 1.28 ms (p95 2.00 ms) | PASS |
| iPhone (auto, 5.0 min) | Average fps | >= 29 | 60.0 (every minute) | PASS |
| iPhone | p95 frame time | <= 40 ms | 17 to 18 ms | PASS |
| iPhone | Worst single-minute fps | >= 29 | 60.0 | PASS |
| iPhone | Final tier keeps bloom | high or mid | mid | PASS |
| iPhone | Python tick average | recorded | 1.97 to 2.10 ms (mean about 2.03; p95 3.00 ms) | recorded (see Observations) |
| Android | every phone bar | see Pass bars | none | NOT MEASURED (no device); WAIVED by the user, carried forward as UAT |
| Desktop / iPhone / Android | `tier=low` and `tier=high` 2 min runs | recorded | not provided | SKIPPED (carried forward) |
| Desktop / iPhone | Feel checklist items 1 to 10 | all passed | "All passed", not itemised | PASS (as stated by the user) |
| Android | Feel checklist items 1 to 10 | all passed | not run | NOT MEASURED; WAIVED by the user, carried forward as UAT |

### Phase 1 baseline beside Phase 2 (iPhone 16 Pro, plugged in, FxiOS 158, auto tier, both ended on tier mid)

| Metric | Phase 1 build `6dcec36` | Phase 2 build `a119574` | Delta |
|--------|------------------------|-------------------------|-------|
| Average fps (full minutes) | 59.8 to 60.0 | 60.0 | none |
| p95 frame time | 17.0 ms | 17 to 18 ms | +0 to +1 ms |
| Average tick | 1.43 to 1.51 ms (p95 2.00 ms) | 1.97 to 2.10 ms (p95 3.00 ms) | about +0.5 ms |
| Final tier | mid | mid | same |
| Time to gate | 1.8 s | 1.3 s | faster (warmer cache, not a code effect) |
| Load | `stress=500` bullets only | stress=500 plus homing Lv5, enemy fire, bombs, particles, decals, lights, shadows, `god` | far heavier |

Phase 2 asks the phone to do far more per frame than Phase 1 (full effect stack plus enemy gallery and weapons) and the frame rate and p95 are unchanged within one millisecond. "The Phase 1 framerate targets still hold" is therefore supported on the iPhone by real numbers; there is no Android number to compare.

### Observations

- Desktop frame time is pinned at the 60 Hz vsync cap (16.7 ms p95), so the desktop run proves headroom but cannot rank tiers. The auto tier stayed on `high` with no tier change logged (`tier log: none` on both devices). The desktop in-browser tick (about 1.25 ms) is about twice the Node `make perf` figure (0.5 to 0.7 ms), the same ratio seen in Phase 1.
- iPhone tick judged against the plan's bars: the tick bar (<= 3 ms) applies to desktop. For phones the plan records the tick for information only, and the frame bars are the pass criteria. The phone average is 1.97 to 2.10 ms, which is about 3x the Node figure and sits inside the 3 to 5x mobile slowdown that the project's 3 ms desktop budget was designed to absorb (CLAUDE.md Performance section). It is about 12% of the 16.7 ms frame. The one thing to watch is the p95 tick of 3.00 ms, which is at the desktop tick budget on the phone and equal to about 18% of a frame; it is not tied to any pass bar, and frame p95 is only 17 to 18 ms. This leaves a thin margin on slower phones (see Android gap) and is the first thing to watch if the next phases add load: the lever, if it is ever needed, is tick-bound (lower gallery and bullet caps, then numpy).
- Not verified by this run: the per-30-s bombing protocol. The flags line says `bombs=default`, not `bombs=7`, and the user did not state how often bombs were dropped, so "a bomb about every 30 s" is taken as followed, not confirmed.
- The `tier=low` and `tier=high` comparisons (assumption A11, the phone fill-rate cost at tier mid) were not run. A11 remains accepted-not-resolved; the iPhone auto tier landing on `mid` with 60 fps and a 17 to 18 ms p95 is indirect evidence only.
- Assumption A5 (particle, decal and light budgets on phones) is supported on the iPhone only. Assumption A8 (iOS audioSession with the silent switch) is supported by the user's blanket "All passed" on item 9, in Firefox for iOS, not itemised and not tested in Safari.

## Verdict

**GO for desktop + iPhone, recorded under an explicit user waiver of the Android criterion.**

- Original computed result: **NO-GO under the plan's rule ("GO when every bar passes on all three devices and no checklist item failed; otherwise NO-GO"), for incompleteness only. It was NOT a performance failure.** The executor did not and could not waive the Android requirement itself.
- **User waiver (2026-10-18):** the genuine user, who has no Android device, decided to waive the Android criterion for Phase 2 and ship (option 1 of the three offered: waive, get an Android run, or move to UAT). The verdict is therefore GO for the devices that were measured, with the waiver stated here rather than hidden.
- Measured evidence: desktop and the iPhone pass every bar with large margin (60.0 fps against >= 58 and >= 29, p95 frame 16.7 and 17 to 18 ms against <= 20 and <= 40 ms, no weak minute, final tiers high and mid so bloom is kept, desktop tick 1.25 ms against <= 3 ms). The iPhone shows no frame-rate regression from Phase 1 to Phase 2, with a tick increase of about 0.5 ms. The feel checklist was reported as all passed on desktop and iPhone.
- **What the waiver covers (NOT measured, NOT passed):** every Android phone bar (ROADMAP Phase 2 criterion 4, "both phones", Android half; criterion 5 device half), the Android feel checklist, Chrome on Adreno/Mali/Xclipse behaviour, thermal throttling and the touch bomb button on Android. The `tier=low` and `tier=high` forced runs (assumption A11) were also skipped on every device.
- **Carried forward (follow-up / UAT, not closed):**
  1. Android baseline and worst-case runs (protocols above) when an Android phone is available; record in this file and in `01-DEVICE-REPORTS.md`.
  2. Forced `tier=low` and `tier=high` 2-minute runs (A11).
  3. Safari proper on iOS (reports came from Firefox for iOS) and an itemised audio checklist (ringer on/off, app switch).
  4. Watch the iPhone p95 tick (3 ms) as Phase 3 adds load; lever if needed is tick-bound (lower gallery and bullet caps, then numpy).
- No lever is recommended: nothing failed, so there is no bottleneck to classify.
- Main push status: see the Ship record below (appended after the push and live checks).
