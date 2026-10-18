# Phase 2 Device Reports and Go/No-Go Verdict

Plan 02-33. Measurements come from real hardware against the real static host. WSL2 SwiftShader numbers do not count.

**Status in one line: PREPARED, awaiting the real-device session (Task 2).** The sections below are empty until the user pastes the reports.

## Header

| Field | Value |
|-------|-------|
| Date prepared | 2026-10-18 |
| Code under test (HEAD pushed) | `a1beb19` |
| Branch | `gsd/phase-02-device-gate` |
| Live URL (still serves the Phase 1 build) | https://rguillon.github.io/Stratoburst/ |
| Compare link | https://github.com/rguillon/Stratoburst/compare/main...gsd/phase-02-device-gate?expand=1 |
| PR number | TBD (filled in after the user opens the PR) |
| Preview URL pattern | `https://rguillon.github.io/Stratoburst/pr-preview/pr-<N>/` |

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

## Desktop

_Pending._

## Android

_Pending._

## iPhone

_Pending._

## Phase 1 baseline (live URL)

_Pending._

## Feel checklist

_Pending._

## Verdict

_Pending._
