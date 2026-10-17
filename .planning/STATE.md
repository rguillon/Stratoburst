---
gsd_state_version: "1.0"
current_phase: 01
current_phase_name: Playable Core on Real Devices
status: executing
stopped_at: Completed 01-08-PLAN.md
last_updated: "2026-10-17T16:52:24.616Z"
last_activity: 2026-10-17
last_activity_desc: Phase 01 execution started
state_head: 58244c44f266839f026f1b9183a78f607b5f2275
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 10
  completed_plans: 8
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-17)

**Core value:** Shooting feels great: tight, responsive ship control and punchy 3D feedback (hits, explosions, screen shake) at a smooth framerate in the browser.
**Current focus:** Phase 01 — Playable Core on Real Devices

## Current Position

Phase: 01 (Playable Core on Real Devices) — EXECUTING
Plan: 9 of 10
Status: Ready to execute
Last activity: 2026-10-17 — Phase 01 execution started

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 25 min | 3 tasks | 47 files |
| Phase 01 P02 | 10min | 3 tasks | 10 files |
| Phase 01 P03 | 15 min | 2 tasks | 20 files |
| Phase 01 P04 | 8min | 2 tasks | 20 files |
| Phase 01 P05 | 16 min | 2 tasks | 15 files |
| Phase 01 P06 | 13 min | 2 tasks | 22 files |
| Phase 01 P07 | 20 min | 2 tasks | 21 files |
| Phase 01 P08 | 22 min | 2 tasks | 17 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: 4 coarse MVP phases. Phase 1 ends in a real-device mobile performance + deploy go/no-go; Phase 3 (stage 1 + boss) is the vertical-slice gate before stages 2-3.
- [Research]: Stack is Pyodide 314.0.7 (Python logic) + three.js 0.186.1 WebGL2 (render) + Vite 8 + zzfx. Babylon.js 9.31.0 is the fallback renderer. No SharedArrayBuffer or Worker design.
- [Research]: From the first commit: fixed 60 Hz sim, seeded RNG, a single batched `tick()` per frame (no per-entity FFI), uniform-grid collision broadphase, and a pure `scorched_core` package testable with pytest.
- [Phase 01]: Python tooling only via Astral uv; every dev command is a root Makefile target (user requirement, Task 1 amendment)
- [Phase 01]: Ruff excludes .planning/.claude (ruff 0.17 formats Python fences in Markdown)
- [Phase 01]: Repo is rguillon/Stratoburst; live URL https://rguillon.github.io/Stratoburst/ derived from origin (case-sensitive); page title stays Scorched
- [Phase 01]: CI workflow steps call Makefile targets (user-requested uv+Makefile tooling); literal gate.yml greps satisfied via Makefile
- [Phase 01]: Plan 01-03: bloom defaults strength 0.45 / radius 0.25 / threshold 1.0, since 1.0 / 0.4 washed out a 500-bullet frame; Python tick for 500 stress bullets measures 0.50 ms avg (budget 3 ms)
- [Phase 01]: 01-04: tier controller strikes need three consecutive evaluations (earliest step-down at the 150th post-warm-up sample); deferred steps keep their strikes; verify-and-lock at <10% gain
- [Phase 01]: 01-04: under ?debug renderer.info.autoReset is off and read/reset once per frame so draw calls cover all composer passes
- [Phase 01]: 01-04: half-float render targets are checked up front; missing support forces and locks the low tier with reason bloom-unavailable
- [Phase 01]: Camera orientation fixed (25 deg tilt, 30 deg FOV); the fit varies only distance and look-at Z, and the playfield is letterboxed by a world-space dimming mask with a hole instead of CSS bars
- [Phase 01]: Terrain is a 4-slot ring (slot = chunkIndex mod 4) rewritten only on chunk-index change, positions relative to the base chunk; scroll rendered as SCROLL_Y + ALPHA * tuning.scroll_speed
- [Phase 01]: Scroll e2e runs at ?tier=low and checks scroll == 0.8 x ticks, since the fixed-step runner caps catch-up at 3 steps per frame and software GL is slow
- [Phase 01]: Button bit values live in Python (Button IntFlag) and reach JS only via manifest.buttons; JS latches press edges and Python derives edges
- [Phase 01]: Touch drag is a pending queue drained at SHIP_SPEED inside the fixed step, capped at TOUCH_LAG_CAP 40, with the wall rule zeroing a blocked axis
- [Phase 01]: Hitbox marker is a depth-test-off core plus dark ring (renderOrder 20/21) built from manifest.tuning.hitbox_radius, never gated behind a focus mode
- [Phase 01]: 01-07: resolve_shots_vs_drones visits bolts descending with immediate swap-remove (no consumed-flag array); drone order is the grid query order
- [Phase 01]: 01-07: make perf holds fire and sweeps (--fire 1) so the 3 ms budget covers bolts, drones and the grid
- [Phase 01]: 01-08: resume drops owed touch drag and app-switcher keys (Alt/Meta/Ctrl/Tab) do not count as the resume press
- [Phase 01]: 01-08: scroll e2e checks per-frame sim progress against rAF dt (plus real-time rate when the 3-step cap is not engaged) instead of a wall-clock floor; gameplay timing unchanged

### Pending Todos

None yet.

### Blockers/Concerns

- [Pre-Phase 1]: Toolchain is behind. Node 18.19.1 is installed but Vite 8 needs 20.19 or newer (install Node 22), and the local Python is 3.12.3 (install a uv-managed Python 3.14).
- [Phase 1]: Mobile Pyodide tick cost and bloom fill-rate are unmeasured. WSL software-GL numbers don't count. If the gate fails: try numpy, lower quality tiers, or the Babylon.js fallback.
- [Phase 1]: Hosting is undecided (GitHub Pages vs itch.io vs Netlify/Cloudflare Pages), along with .wasm MIME/compression and Pyodide startup (snapshots, .pyc). Research needed: mobile measurement method, altitude-scale camera mapping.
- [Phase 2]: iOS audio unlock and silent switch behavior; bloom cost on mobile GPUs; bullet palette vs fire backgrounds.
- [Phase 3]: Research needed: boss authoring format and destructible-part model.
- [Phase 4]: Research needed: touch initials-entry UX, music synthesis vs loops. Stages 4-5 (CAMP-01) are a v2 stretch only.

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-10-17T16:52:24.588Z
Stopped at: Completed 01-08-PLAN.md
Resume file: None
