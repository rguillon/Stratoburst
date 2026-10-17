---
gsd_state_version: "1.0"
current_phase: 01
current_phase_name: Playable Core on Real Devices
status: executing
stopped_at: Phase 1 context updated (pause & resume)
last_updated: "2026-10-17T14:44:03.736Z"
last_activity: 2026-10-17
last_activity_desc: Phase 01 execution started
state_head: dec49d19b834e6762339210d520023bc785c4986
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 10
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-17)

**Core value:** Shooting feels great: tight, responsive ship control and punchy 3D feedback (hits, explosions, screen shake) at a smooth framerate in the browser.
**Current focus:** Phase 01 — Playable Core on Real Devices

## Current Position

Phase: 01 (Playable Core on Real Devices) — EXECUTING
Plan: 1 of 10
Status: Executing Phase 01
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

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: 4 coarse MVP phases. Phase 1 ends in a real-device mobile performance + deploy go/no-go; Phase 3 (stage 1 + boss) is the vertical-slice gate before stages 2-3.
- [Research]: Stack is Pyodide 314.0.7 (Python logic) + three.js 0.186.1 WebGL2 (render) + Vite 8 + zzfx. Babylon.js 9.31.0 is the fallback renderer. No SharedArrayBuffer or Worker design.
- [Research]: From the first commit: fixed 60 Hz sim, seeded RNG, a single batched `tick()` per frame (no per-entity FFI), uniform-grid collision broadphase, and a pure `scorched_core` package testable with pytest.

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

Last session: 2026-10-17T14:42:20.292Z
Stopped at: Phase 1 context updated (pause & resume)
Resume file: .planning/phases/01-playable-core-on-real-devices/01-CONTEXT.md
