---
phase: 01
review: 01-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "Non-finite or negative `dt_ms` is not validated at the Python boundary"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "Drone sway amplitude is larger than the spawn margin, so drones leave the playfield"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "Keyboard handler swallows browser shortcuts and can stick keys when a modifier is held"
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "Every `window` error or unhandled rejection is treated as fatal"
  - id: WR-05
    severity: warning
    disposition: fixed
    title: "Deploy and preview jobs run `npm ci` and the build with a write token and persisted checkout credentials"
  - id: WR-06
    severity: warning
    disposition: skipped
    title: "Ship, bullets and drones are rendered at discrete 60 Hz positions; only the terrain uses `ALPHA`"
  - id: WR-07
    severity: warning
    disposition: fixed
    title: "Large parts of the JS runtime have no unit tests and there is no JS coverage gate"
  - id: WR-08
    severity: warning
    disposition: fixed
    title: "Escape/P resume path skips the resume bookkeeping that tap/key resume performs"
  - id: IN-01
    severity: info
    disposition: open
    title: "Per-frame allocations in hot paths (the project rule is \"no allocation in the frame loop\")"
  - id: IN-02
    severity: info
    disposition: open
    title: "Weak or unspecced tests"
  - id: IN-03
    severity: info
    disposition: open
    title: "E2E suite is advisory, wall-clock dependent, and can reuse a stale preview server"
  - id: IN-04
    severity: info
    disposition: open
    title: "Queued touch drag keeps draining after keyboard release"
  - id: IN-05
    severity: info
    disposition: open
    title: "Second finger never takes over steering when the first lifts"
  - id: IN-06
    severity: info
    disposition: open
    title: "`FixedStepRunner` discards the remainder when exactly the step cap is reached"
  - id: IN-07
    severity: info
    disposition: open
    title: "`perf_node.mjs` and `wait_for_deploy.mjs` limitations"
  - id: IN-08
    severity: info
    disposition: open
    title: "`startGame` leaks proxies and `warmUp` blocks the main thread before the gate"
  - id: IN-09
    severity: info
    disposition: open
    title: "`_HEADER_SLOTS` is a mutable hand-maintained copy of the protocol constants"
open: 9
total: 17
recorded: 2026-10-17T18:41:44.473Z
---

# Phase 01: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | fixed | 01-REVIEW-FIX.md |
| WR-02 | warning | fixed | 01-REVIEW-FIX.md |
| WR-03 | warning | fixed | 01-REVIEW-FIX.md |
| WR-04 | warning | fixed | 01-REVIEW-FIX.md |
| WR-05 | warning | fixed | 01-REVIEW-FIX.md |
| WR-06 | warning | skipped | 01-REVIEW-FIX.md |
| WR-07 | warning | fixed | 01-REVIEW-FIX.md |
| WR-08 | warning | fixed | 01-REVIEW-FIX.md |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |
| IN-06 | info | open | - |
| IN-07 | info | open | - |
| IN-08 | info | open | - |
| IN-09 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
