---
gsd_state_version: "1.0"
current_phase: 02
current_phase_name: Arcade Shooting Feel
status: executing
stopped_at: Completed 02-06-PLAN.md
last_updated: "2026-10-18T03:46:57.773Z"
last_activity: 2026-10-18
last_activity_desc: Phase 02 execution started
state_head: 63216cafb08b78ab9aeaae4ba36a27b75ea95397
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 43
  completed_plans: 16
  percent: 25
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-17)

**Core value:** Shooting feels great: tight, responsive ship control and punchy 3D feedback (hits, explosions, screen shake) at a smooth framerate in the browser.
**Current focus:** Phase 02 — Arcade Shooting Feel

## Current Position

Phase: 02 (Arcade Shooting Feel) — EXECUTING
Plan: 7 of 33
Status: Ready to execute
Last activity: 2026-10-18 — Phase 02 execution started

Progress: [███░░░░░░░] 25%

## Performance Metrics

**Velocity:**
- Total plans completed: 10
- Average duration: -
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 10 | - | - |

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
| Phase 01 P09 | 20 min | 2 tasks | 24 files |
| Phase 01 P10 | 30 min | 3 tasks | 2 files |
| Phase 02 P01 | 6 min | 2 tasks | 11 files |
| Phase 02 P02 | 12 min | 2 tasks | 10 files |
| Phase 02 P03 | 11 min | 2 tasks | 14 files |
| Phase 02 P04 | 14 min | 2 tasks | 10 files |
| Phase 02 P05 | 9 min | 3 tasks | 10 files |
| Phase 02 P06 | 14 min | 2 tasks | 9 files |

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
- [Phase 01]: 01-09: keyboard, touch, sampler and pause controller are created after the start gate, so the gate tap/key never reaches them; only pointerType decides touch mode
- [Phase 01]: 01-09: __scorched.audioState is a live getter on AudioContext.state (resume() settles asynchronously)
- [Phase 01]: 01-09: error panel Copy report appends the device report layout even without a debug session; text via textContent only; ?crash values are allow-listed on JS and Python sides
- [Phase 01]: Plan 01-10 verdict was GO (desktop) with the phone gate deferred; phone gate (PLAT-05) then passed in Phase 1 UAT on 2026-10-17
- [Phase 02]: 02-01: a killing blow pushes no HIT event (the EXPLOSION covers it), so a kill is exactly one event; HIT is pushed only for a surviving hit on a resting drone
- [Phase 02]: 02-01: protocol v2 reserves header slots 14-29 for Phase 2 plans and 30-47 for Phase 3; event ids and blast classes are protocol constants exported by name through the manifest
- [Phase 02]: 02-02: particle layers draw depthTest-off at renderOrder 4 (above terrain, below the playfield mask); explosion size never scales with tier, only particle count (1, 0.6, 0.35)
- [Phase 02]: 02-03: a killing blow pushes no HIT event; apply_hit subtracts first and pushes a low-priority HIT only for a resting survivor, so a kill is exactly one event
- [Phase 02]: 02-03: the gallery has no RNG (scripted GALLERY_SCRIPT), so determinism means same inputs give byte-identical buffers; wire names DRONE_N/DRONES_DOWN/drones stay until 02-04
- [Phase 02]: 02-04: enemy meshes are one InstancedMesh per kind behind a geometryFor seam; flash is HDR (2.2) instanceColor on a white shared material; mesh with zero instances is not re-uploaded
- [Phase 02]: 02-05: enemy motion is data (MotionKind per enemy, applied by a match with a loud unknown arm); hover state lives in the timer column; ground units move at SCROLL_SPEED * 0.94 = 0.752 per step and the ratio is exported in the manifest
- [Phase 02]: 02-06: every model detail level is built eagerly and warmed at load, so a tier change only swaps cached geometry and material; terrain keeps separate smooth and flat materials instead of toggling flatShading

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 2]: iOS audio unlock and silent switch behavior; bloom cost on mobile GPUs; bullet palette vs fire backgrounds.
- [Phase 3]: Research needed: boss authoring format and destructible-part model.
- [Phase 4]: Research needed: touch initials-entry UX, music synthesis vs loops. Stages 4-5 (CAMP-01) are a v2 stretch only.
- [Phase 1]: Phone gate passed in UAT, but the Android/iPhone stress reports are not pasted into 01-DEVICE-REPORTS.md yet; add them as the mobile baseline for Phase 2

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-10-18T03:46:57.700Z
Stopped at: Completed 02-06-PLAN.md
Resume file: None
