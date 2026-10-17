# Phase 1 Device Reports and Go/No-Go Verdict

Plan 01-10. Measurements come from real hardware against the real static host. WSL2 SwiftShader numbers do not count.

## Header

| Field | Value |
|-------|-------|
| Date prepared | 2026-10-17 |
| Code baseline (all of Phase 1 through plan 01-09) | `f52e3e2` (origin/main before this branch) |
| Preview build hash | the PR branch head; the `?debug` overlay and the report print it as `build` |
| Live URL | https://rguillon.github.io/Stratoburst/ |
| Branch | `gsd/phase-01-device-gate` |
| Compare link | https://github.com/rguillon/Stratoburst/compare/main...gsd/phase-01-device-gate?expand=1 |
| Preview URL pattern | https://rguillon.github.io/Stratoburst/pr-preview/pr-N/ |
| PR number | _pending (filled in Task 3 from the user's reply)_ |

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

_Device model, browser, notes: pending._

### 5-minute auto tier

_pending_

### 2-minute `tier=low`

_pending_

### 2-minute `tier=high`

_pending_

## Android

_Device model, browser, power state: pending._

### 5-minute auto tier

_pending_

### 2-minute `tier=low`

_pending_

### 2-minute `tier=high`

_pending_

## iPhone

_Device model, Safari version, power state (Low Power Mode?): pending._

### 5-minute auto tier

_pending_

### 2-minute `tier=low`

_pending_

### 2-minute `tier=high`

_pending_

## Feel checklist

_pending (result per numbered item from the checkpoint, "all passed" or the failing item numbers with notes)._

## Pass/fail table

_pending (computed in Task 3 from the pasted reports)._

## Verdict

_pending (GO or NO-GO, with the recommended lever when NO-GO)._
