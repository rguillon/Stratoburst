---
status: complete
phase: 01-playable-core-on-real-devices
source: [01-VERIFICATION.md]
started: 2026-10-17T18:42:02Z
updated: 2026-10-17T18:46:18.877Z
---

## Current Test

[testing complete]

## Tests

### 1. Phone performance gate on Android and iPhone (PLAT-05)
Phone performance gate (PLAT-05, SC1 + SC3 on phones). On a mid-range Android phone and a recent iPhone open https://rguillon.github.io/Stratoburst/?debug&stress=500, run 5 continuous minutes on the auto tier, then 2 minutes each at &tier=low and &tier=high, press Copy report, paste into 01-DEVICE-REPORTS.md (Android and iPhone sections) with model, browser and power state.
expected: Per phone: avg fps >= 29, p95 frame <= 40 ms, no single minute under 29 fps, final tier keeps bloom (high or mid). A NO-GO must name the lever (tick-bound: lower caps, numpy, Worker; GPU/fill-bound: lower tiers, glow sprites; neither: Babylon fallback).
result: pass

### 2. Phone load path on the real host
Phone load path on the real host (SC1). Open the live link on the Android phone and the iPhone: confirm progress bar reaches 100%, the TAP / CLICK TO START gate appears, a tap starts the game, and the portrait playfield is letterboxed in both orientations. On Safari confirm the progress wrapper reaches ~80% during the Pyodide streaming compile (assumption A6) and record time-to-gate.
expected: Loading -> gate -> letterboxed playfield in portrait and landscape on both phones; progress is real (not stuck at 0 or indeterminate forever); audio context state 'running' after the tap (check __scorched.audioState under ?debug).
result: pass

### 3. Feel checklist items 5-12, itemized
Feel checklist items 5-12 from 01-10 Task 2, itemized (user said 'no problem observed' only). Especially: 1:1 touch drag with auto-fire and the ship never under the finger (8), auto-pause on app switch / tab switch and resume without a jump (10), ?crash=py panel (11), Network tab shows content-encoding: br from cdn.jsdelivr.net (12), hitbox marker readability, terrain/dimmed-margin look.
expected: Each item passes; none is claimed passed today.
result: pass

### 4. High-refresh smoothness (WR-06)
High-refresh smoothness (WR-06 / 01-08 pending check 3). On a 90/120/144 Hz display (or a 120 Hz phone) fly the ship while firing with ?debug and compare ship, bolts, drones and enemy bullets against the terrain.
expected: Game speed is the same as at 60 Hz (verified by tests). Judge whether the 2,3,2,3 update cadence of non-terrain objects (they are drawn at the last 60 Hz step; only the terrain uses H_ALPHA) is acceptable. If not, schedule the protocol-2 interpolation work in Phase 2.
result: pass

### 5. Split Preview workflow in CI (WR-05)
Post-WR-05 CI confirmation. Open a throwaway same-repo PR and confirm the split Preview workflow (gate -> build -> preview, artifact upload/download pairing, .nojekyll present, cleanup path on close with the build job skipped).
expected: Preview builds, publishes pr-preview/pr-N, and the closed-PR run removes it. (The Deploy workflow's new build/deploy split is already confirmed by Deploy run 39058629150 plus the live smoke.)
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
