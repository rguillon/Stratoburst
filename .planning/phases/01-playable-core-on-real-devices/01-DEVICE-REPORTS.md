# Phase 1 Device Reports and Go/No-Go Verdict

Plan 01-10. Measurements come from real hardware against the real static host. WSL2 SwiftShader numbers do not count.

**Status in one line: GO (desktop); iPhone baseline measured later at the Phase 2 gate and passes; Android NOT MEASURED (no device).** Desktop passed every bar. The iPhone baseline was added on 2026-10-18 from the Phase 1 live build and passes every phone bar. No Android phone has ever been measured.

## Header

| Field | Value |
|-------|-------|
| Date prepared | 2026-10-17 |
| Code baseline (all of Phase 1 through plan 01-09) | `f52e3e2` (origin/main before this branch) |
| PR branch head (what the PR contained) | `a09c57b` on `gsd/phase-01-device-gate` |
| Build hash measured on device | `b807fd8`, the PR merge ref (see Preview build note below) |
| Live URL | https://rguillon.github.io/Stratoburst/ |
| Branch | `gsd/phase-01-device-gate` |
| Compare link | https://github.com/rguillon/Stratoburst/compare/main...gsd/phase-01-device-gate?expand=1 |
| PR number | 1 |
| Preview URL | https://rguillon.github.io/Stratoburst/pr-preview/pr-1/ |

### Preview build note

The reports print `build: b807fd8`. That is not the PR head (`a09c57b`). GitHub's public API reports `merge_commit_sha = b807fd80c85e7d83e659a5e00d3fb6b54ee90a62` for PR #1, the synthetic merge of the PR head into main that `pull_request` workflows check out by default. So the preview was built from the PR merge ref, and `b807fd8` is that ref's short hash. The merge ref was main plus the PR branch, which is the same tree as the branch head because main had not diverged. This was verified through the public API (`gh` is not installed).

### D-04 PR preview, first live exercise

The Preview workflow ran for PR #1 at head `a09c57b` (run 39054200041, event `pull_request`) and concluded `success` per the public Actions API. The E2E workflow for the same head (run 39054200047) also concluded `success`. The user opened the resulting preview URL on a desktop and a phone. So D-04 PR previews work end to end on the real host (build, publish to `gh-pages/pr-preview/pr-1`, serve). The sticky comment and QR code were not separately confirmed by the user in the reply.

## Local gates before the push (Task 1)

All run through the Makefile targets on the baseline `f52e3e2`.

| Gate | Result |
|------|--------|
| `make check` (ruff check, ruff format --check, pytest 100% line + branch, vitest, Vite build, Playwright) | pass: pytest 357 passed at 100.00%, vitest 330 passed (23 files), Playwright 39 passed |
| `make perf` (500 stress bullets, fire held, Pyodide on Node, budget 3 ms) | pass: avg 0.5601 ms, p95 0.6194 ms |

## Pass bars

Copied from the plan must_haves (truths 4 and 5) and RESEARCH Pattern 9.

| Bar | Desktop | Each phone (Android, iPhone) |
|-----|---------|------------------------------|
| Run | `?debug&stress=500`, auto tier, bloom on, 5 minutes | `?debug&stress=500`, auto tier, 5 continuous minutes |
| Average fps | >= 58 | >= 29 |
| p95 frame time | <= 20 ms | <= 40 ms |
| Worst single-minute average fps | not required | >= 29 (thermal throttling check) |
| Final tier keeps bloom | high or mid | high or mid |
| Python tick average | <= 3 ms | recorded for information |
| Forced `tier=low` and `tier=high`, 2 minutes each | recorded | recorded for comparison |

## Desktop

Snapdragon X laptop, Windows 11, Firefox 158. GPU per the report: Qualcomm Adreno X1-45 via ANGLE Direct3D11. Screen 3072x1728 at DPR 1.25. Reports pasted verbatim by the user (the pasted text includes the user agent, screen and GPU strings; the user was told beforehand that it would be committed to the public repo).

### 5-minute auto tier (5.2 min)

```
Scorched device report
ua: Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:158.0) Gecko/20100101 Firefox/158.0
screen: 3072x1728 (css 3072x1643)
dpr: 1.25 (effective 0.74)
canvas: 2288x1223
gl renderer: ANGLE (Qualcomm, Adreno (TM) X1-45 Direct3D11 vs_5_0 ps_5_0), or similar
precision: highp (23 bits)
pyodide: 314.0.7
three: 0.186.1
build: b807fd8
flags: debug=on stress=500 tier=auto crash=none
tier: high
time to gate: 2.4 s
elapsed: 5.2 min
tier log: none
minute 0: frames 3600, avg fps 60.0, p95 frame 16.7 ms, avg tick 1.08 ms, p95 tick 2.00 ms
minute 1: frames 3600, avg fps 60.0, p95 frame 16.7 ms, avg tick 1.11 ms, p95 tick 2.00 ms
minute 2: frames 3600, avg fps 60.0, p95 frame 16.7 ms, avg tick 1.11 ms, p95 tick 2.00 ms
minute 3: frames 3600, avg fps 60.0, p95 frame 16.7 ms, avg tick 1.08 ms, p95 tick 2.00 ms
minute 4: frames 3600, avg fps 60.0, p95 frame 16.7 ms, avg tick 1.11 ms, p95 tick 2.00 ms
minute 5: frames 628, avg fps 60.0, p95 frame 16.7 ms, avg tick 1.12 ms, p95 tick 2.00 ms
```

### `tier=low` (1.3 min, shorter than the 2 min protocol)

```
Scorched device report
ua: Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:158.0) Gecko/20100101 Firefox/158.0
screen: 3072x1728 (css 3072x1643)
dpr: 1.25 (effective 0.34)
canvas: 1059x566
gl renderer: ANGLE (Qualcomm, Adreno (TM) X1-45 Direct3D11 vs_5_0 ps_5_0), or similar
precision: highp (23 bits)
pyodide: 314.0.7
three: 0.186.1
build: b807fd8
flags: debug=on stress=500 tier=low crash=none
tier: low (locked: forced)
time to gate: 2.4 s
elapsed: 1.3 min
tier log: none
minute 0: frames 3598, avg fps 60.0, p95 frame 16.7 ms, avg tick 0.89 ms, p95 tick 2.00 ms
minute 1: frames 1114, avg fps 60.0, p95 frame 16.7 ms, avg tick 1.34 ms, p95 tick 2.00 ms
```

### `tier=high` (0.5 min, shorter than the 2 min protocol)

```
Scorched device report
ua: Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:158.0) Gecko/20100101 Firefox/158.0
screen: 3072x1728 (css 3072x1643)
dpr: 1.25 (effective 0.74)
canvas: 2288x1223
gl renderer: ANGLE (Qualcomm, Adreno (TM) X1-45 Direct3D11 vs_5_0 ps_5_0), or similar
precision: highp (23 bits)
pyodide: 314.0.7
three: 0.186.1
build: b807fd8
flags: debug=on stress=500 tier=high crash=none
tier: high (locked: forced)
time to gate: 2.4 s
elapsed: 0.5 min
tier log: none
minute 0: frames 1864, avg fps 60.0, p95 frame 16.7 ms, avg tick 1.08 ms, p95 tick 2.00 ms
```

## Android

**NOT MEASURED, and now permanently unmeasurable for the user: they have no Android device** (stated at the Phase 2 device gate, plan 02-33). There is no Android model, browser, power state or report. The earlier remark that the game looked smooth on "their phone" was qualitative and is not counted against any bar. The Android baseline stays open until someone with an Android phone runs the protocol.

## iPhone

**MEASURED during the Phase 2 device gate (plan 02-33, 2026-10-18), from the Phase 1 build on the live URL.** The Phase 1 baseline was never pasted at the Phase 1 gate; it was measured afterwards, side by side with Phase 2, while the live URL still served Phase 1 (`origin/main` = `6dcec36`).

Device: iPhone 16 Pro, plugged in (power state was not stated separately for this run; the same plugged-in phone is assumed), Firefox for iOS (FxiOS 158, iOS 18.7; WebKit under the hood, not Safari). `?debug&stress=500`, auto tier. The run lasted 5.2 min (longer than the 2 min baseline protocol). The user was told beforehand that pasted text becomes public. Pasted verbatim:

```
ua: Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/158.0 Mobile/15E148 Safari/604.1
screen: 402x874 (css 402x670); dpr: 3 (effective 1.50); canvas: 603x1005; gl renderer: Apple GPU; precision: highp (23 bits); pyodide 314.0.7; three 0.186.1; build: 6dcec36
flags: debug=on stress=500 tier=auto crash=none
tier: mid; time to gate: 1.8 s; elapsed: 5.2 min; tier log: none
minute 0: frames 3588, avg fps 59.8, p95 frame 17.0 ms, avg tick 1.47 ms, p95 tick 2.00 ms
minute 1: frames 3316, avg fps 59.9, p95 frame 17.0 ms, avg tick 1.43 ms, p95 tick 2.00 ms
minute 2: frames 3600, avg fps 60.0, p95 frame 17.0 ms, avg tick 1.51 ms, p95 tick 2.00 ms
minute 3: frames 3599, avg fps 60.0, p95 frame 17.0 ms, avg tick 1.51 ms, p95 tick 2.00 ms
minute 4: frames 1491, avg fps 59.8, p95 frame 17.0 ms, avg tick 1.49 ms, p95 tick 2.00 ms
minute 5: frames 98, avg fps 56.3, p95 frame 25.0 ms, avg tick 0.14 ms, p95 tick 1.00 ms   (partial minute)
```

Against the Phase 1 phone pass bars (avg fps >= 29, p95 frame <= 40 ms, no minute under 29 fps, final tier keeps bloom): PASS on every full minute (59.8 to 60.0 fps, p95 17 ms, final tier mid). The frame counts total 15692 over 5.2 min elapsed, so part of the run was probably backgrounded or auto-paused; minute 4 (1491 frames) and minute 5 (98 frames, 1.6 s) are short samples, and even minute 5 (56.3 fps, p95 25 ms) clears the bars. The forced `tier=low` and `tier=high` runs were not done. A6 (Safari streaming compile through the progress wrapper) is still unverified in Safari proper; the time to gate on this phone was 1.8 s. Compared with the Phase 2 build on the same phone see `.planning/phases/02-arcade-shooting-feel/02-DEVICE-REPORTS.md`.

## Feel checklist

The user's words: "I observed no problem, the animation with smoth on computer and phone." They did not go through the numbered items (5 to 12) one by one. Recorded as exactly that: no problem observed, and **no individual item is claimed as passed**. In particular these were not individually confirmed: letterbox in both orientations (6), 1:1 touch drag with auto-fire (8), auto-pause and resume without a jump (10), the `?crash=py` error panel (11), and the Network tab check for `content-encoding: br` from cdn.jsdelivr.net (12). The per-item checklist stays on the list for the verify-work UAT.

## Ship and live verification (Task 3)

| Check | Result |
|-------|--------|
| `git push origin main` (fast-forward `f52e3e2..060161b`, no force) | done; PR #1 state `closed`, `merged: true` (merged_at 2026-10-17T17:55:28Z) |
| Deploy run for `060161b` | success (run 39055857002) |
| `make e2e-live` (Playwright smoke against https://rguillon.github.io/Stratoburst/) | 1 passed |
| Live `?debug` page, `__scorched.build` after the start gate | `060161b`, equals `git rev-parse --short HEAD` |
| Preview cleanup (`pr-preview/pr-1`) | The closed-PR Preview run (39055858288) succeeded and the gh-pages commit `aea4958` "Remove preview for PR 1" deleted all preview files. The later Deploy commit `6d6a71d` did not restore them. `https://rguillon.github.io/Stratoburst/pr-preview/pr-1/` now returns HTTP 404. A single empty `pr-preview/pr-1/.nojekyll` file remains on gh-pages (cosmetic). |

## Pass/fail table

Values are parsed from the report lines above. "Worst minute" excludes nothing; the final partial minute (628 frames) is 60.0 as well.

| Device | Bar | Required | Measured | Result |
|--------|-----|----------|----------|--------|
| Desktop (auto, 5.2 min) | Average fps | >= 58 | 60.0 (every minute) | PASS |
| Desktop (auto, 5.2 min) | p95 frame time | <= 20 ms | 16.7 ms (every minute) | PASS |
| Desktop (auto, 5.2 min) | Final tier keeps bloom | high or mid | high | PASS |
| Desktop (auto, 5.2 min) | Python tick average | <= 3 ms | 1.08 to 1.12 ms (p95 2.00 ms) | PASS |
| Desktop `tier=low` (1.3 min) | recorded | n/a | 60.0 fps, p95 16.7 ms, tick 0.89 / 1.34 ms | recorded (shorter than protocol) |
| Desktop `tier=high` (0.5 min) | recorded | n/a | 60.0 fps, p95 16.7 ms, tick 1.08 ms | recorded (shorter than protocol) |
| Android | all phone bars | see Pass bars | none (user has no Android device) | NOT MEASURED |
| iPhone (auto, 5.2 min, measured at the Phase 2 gate, Phase 1 build) | Average fps / p95 frame / worst minute / final tier | >= 29 / <= 40 ms / >= 29 / high or mid | 59.8 to 60.0 / 17.0 ms / 59.8 / mid | PASS (tick 1.43 to 1.51 ms recorded) |
| All | Feel checklist items 5 to 12 | all passed | "no problem observed", not itemized | NOT ITEMIZED |

Observations:

- Desktop frame time is pinned at the 60 Hz vsync cap (16.7 ms p95 at every tier), so these runs prove headroom at 500 stress bullets but cannot rank the tiers against each other. No tier change was logged (`tier log: none`).
- The in-browser Python tick (about 1.1 ms) is roughly 2x the Node perf harness figure (0.56 ms). Still well inside the 3 ms budget.
- Time to gate was 2.4 s on a (presumably warm-cache) desktop. Open Question 5 is answered for desktop only.
- The auto tier reported an effective scale of 0.74 (canvas 2288x1223 for a 3072x1643 CSS window), so the high tier rendered below native device resolution on this display and still held 60 fps.

## Verdict

**GO (desktop) — phone performance gate DEFERRED.**

- Desktop: GO. Every desktop bar passes with margin (60.0 fps vs >= 58, p95 16.7 ms vs <= 20 ms, tick ~1.1 ms vs <= 3 ms, final tier high with bloom on). This is one machine and one browser (Snapdragon X, Firefox 158), so Chromium and Safari desktop have not been measured. It is the evidence that PLAT-04's numeric bar holds, with `?stress=500` bullets standing in for the full stage load that does not exist yet.
- Phones: not measured, so the phone half of the ROADMAP "After Phase 1 (go/no-go)" gate (PLAT-05, success criterion 3 on phones) is **not decided**. This is neither a GO nor a NO-GO for phones. No lever is recommended because there is no phone data to classify the bottleneck. The only phone evidence is the user's remark that animation looked smooth on a phone.
- Consequence: the phone go/no-go must be closed before the Phase 2 content work is trusted on mobile. PLAT-05 stays pending.

### Addendum (2026-10-18, Phase 2 device gate)

The iPhone half of the phone gate is now measured: iPhone 16 Pro, Phase 1 build `6dcec36`, 59.8 to 60.0 fps, p95 17 ms, final tier mid, tick about 1.5 ms. It passes every phone bar. The Android half remains unmeasured because the user has no Android device, so PLAT-05 is decided for the iPhone only.

### Open follow-ups (route to UAT)

1. **Phone protocol (Part B).** On a mid-range Android phone and a recent iPhone, open https://rguillon.github.io/Stratoburst/?debug&stress=500, run 5 continuous minutes on the auto tier, then 2 minutes each at `&tier=low` and `&tier=high`, press Copy report, and paste the reports into the Android and iPhone sections above. Note the model, browser and power state. Pass bars: avg fps >= 29, p95 frame <= 40 ms, no minute under 29 fps, final tier keeps bloom.
2. **Per-item feel checklist (items 5 to 12)** from the plan's Task 2, itemized, especially the phone items 6, 8 and 10, the `?crash=py` panel (11), and the Network check (12).
3. **A6**: confirm on Safari that the streaming compile reaches 80% progress through the progress wrapper, and record time-to-gate per phone (Open Question 5).
4. Optional: repeat the desktop run in a Chromium browser, and re-run the forced `tier=low` and `tier=high` for the full 2 minutes if a comparison is wanted.
