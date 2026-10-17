# Phase 1: Playable Core on Real Devices - Context

**Gathered:** 2026-10-17
**Status:** Ready for planning

<domain>
## Phase Boundary

A Pyodide + three.js page deployed to the real static host (GitHub Pages). Anyone with the link sees a loading screen with progress, then a tap/click-to-start gate, then a portrait 3:4 playfield letterboxed to any screen. In the playfield the player flies a ship in 8 directions (keyboard or relative touch drag) over scrolling 3D terrain seen through a fixed tilted camera, and shoots down simple drifting targets. The phase also delivers a 400+ bullet stress mode with automatic quality tiers and an on-device timing overlay, refresh-rate-independent 60 Hz simulation, auto-pause on hide/blur, an on-screen error panel, and a headless pytest suite for the Python core. The phase ends in a **mobile performance go/no-go gate** (see ROADMAP.md gates).

Requirements: PLAT-01..09, PLAT-11, PLYR-01..03, INPT-01, INPT-02, STGE-02.
Not in this phase: weapon pickups, bombs (the key is reserved only), death/respawn, real explosions/particles/SFX, enemies that shoot, scoring, HUD, menus.

</domain>

<decisions>
## Implementation Decisions

### Hosting & deploy
- **D-01:** Host on **GitHub Pages**. No custom headers are available there, which is fine: no SharedArrayBuffer, Pyodide stays on the main thread. Vite build uses a relative base (`--base=./`) so the same build works at the root and in preview subfolders. — **Reversibility:** reversible
- **D-02:** Load the Pyodide runtime from the **jsDelivr CDN** (`https://cdn.jsdelivr.net/pyodide/v314.0.7/full/`), exact-pinned. Only the game's own files (JS bundle, Python sources/wheel) are served from Pages. Self-hosting may be revisited with PWA/offline in Phase 4 (PLAT-10).
- **D-03:** **Every push to `main` deploys** via a GitHub Actions workflow that first runs `ruff check`, `ruff format --check` and `pytest --cov --cov-branch --cov-fail-under=100`, then runs the Vite build and deploys. A red gate blocks the deploy.
- **D-04:** **PR preview deployments** as well. GitHub Pages has no native previews, so the researcher should pick the approach. The likely option is deploying to the `gh-pages` branch with each PR in a subfolder (e.g. `pr-preview/pr-N/`) and a sticky PR comment with the link, then cleanup on close. This implies branch-based Pages (not the artifact-based `actions/deploy-pages`) so main and previews can coexist. — **Reversibility:** costly — the Pages source mode (branch vs Actions artifact) and URL layout are shared by main deploy and previews
- **D-05:** **The user creates the GitHub repo and enables Pages themselves.** Plans must not try to create the remote. Instead, include a clear human checkpoint saying exactly what to create and configure (repo, Pages source/branch, Actions permissions) and when.

### Playfield & camera
- **D-06:** Logical playfield is **3:4 arcade portrait (~240×320 units)**. Gameplay coordinates, the speed constants and the hitbox sizes are defined in these units. — **Reversibility:** costly — every speed, spawn position, pattern and hitbox constant in later phases is authored in these units
- **D-07:** Letterbox margins show **dimmed/desaturated terrain continuing** beyond the playfield (not black bars), so the edges clearly read as out of play. Margins must be cheap to render (they're included in the quality-tier budget).
- **D-08:** **Camera tilt is modest, ~20–30°.** Mostly top-down with visible 3D depth. Planner/researcher pick the exact angle and FOV within this range and keep them as config constants. The altitude-scale mapping (gameplay at player altitude, other layers scaled about the camera) follows the research ARCHITECTURE.md.
- **D-09:** **Camera is fully fixed.** No sway or follow. The whole playfield is always visible.

### Ship control & input
- **D-10:** Ship speed is **Raiden-like: about 1.2 s to cross the playfield width**, with instant start/stop (no acceleration), as a tunable constant. Diagonals are normalized so they move no faster than straight lines. No focus/slow mode.
- **D-11:** Keyboard keys are read **by physical key (`event.code`)**: arrows + WASD (on AZERTY those physical keys are ZQSD) to move, **Space or J** to fire (hold), **Shift or K** reserved for bomb (Phase 2), **Esc or P** for pause.
- **D-12:** **Touch is relative 1:1 drag with the same speed cap as keyboard.** The ship follows finger movement 1:1 but never exceeds the max speed, and leftover finger movement is caught up over the next frames, so the ship can't teleport. Touch has always-on auto-fire. Pointer events are tracked per `pointerId` with `touch-action: none`.

### Placeholder visuals & targets
- **D-13:** Visuals are **"simple but recognizable"**: a low-poly code-built jet silhouette with an emissive engine glow, a visibly marked hitbox core (PLYR-02), plain block-shaped targets, and flat-shaded tiled terrain with a few block buildings scrolling continuously. Don't invest in the Phase 2 part-based model system yet.
- **D-14:** Phase 1 targets are **drifting air drones** that a basic spawner sends down the screen. They take a few hits, flash and disappear (no particles or explosions yet). No ground targets in Phase 1.

### Debug & stress tooling
- **D-15:** Debug features are enabled through **URL flags only**, invisible to normal players: `?debug` (frame/tick timing overlay), `?stress=N` (spawns N Python-driven bullets, default 500), `?tier=low|mid|high` (forces a quality tier instead of auto-selecting). Flags can be combined so a test link can be sent to a friend's phone.

### Pause & resume (added in an update session, 2026-10-17)
- **D-16:** Auto-pause leaves the game **frozen behind a PAUSED overlay until the player acts**. There is no auto-resume or countdown. Resuming adds no time jump (no catch-up steps). This confirms research assumption A1.
- **D-17:** **Losing window focus (`blur`) pauses too**, in addition to `visibilitychange` (hidden) and `pagehide`. All held input state is cleared on pause.
- **D-18:** The overlay is dismissed by **any tap/click, or Esc/P or the fire keys (Space/J)**. Movement keys (arrows/WASD) do **not** resume, so a held direction key can't unpause by accident. The input that resumes must not also count as a fire press or a movement delta on the first frame back.
- **D-19:** **Manual pause in Phase 1 is keyboard-only (Esc/P toggles it).** The on-screen touch pause button stays in Phase 4 (INPT-04).

### Claude's Discretion
- Exact camera angle and FOV within 20–30°, the terrain scroll speed, the player fire rate and shot pattern (a simple straight twin shot is fine), and drone HP and spawn rate.
- The quality-tier ladder (DPR caps, bloom resolution or off) and the auto-step-down heuristic. Bloom must exist in Phase 1 because the stress test measures it.
- The loading-screen and error-panel visual style.
- Go/no-go measurement method. The user did not discuss devices, so use the ROADMAP Phase 1 success criterion 3 as the pass/fail bar: 60fps on a mid-range desktop and ≥30fps steady on a mid-range Android and a recent iPhone, with 400+ bullets and bloom on. Plans should include a human-verify checkpoint where the user runs the `?debug&stress` link on their real phones and reports the numbers.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope & requirements
- `.planning/ROADMAP.md` §Phase 1 — Goal, 5 success criteria, go/no-go gate definition
- `.planning/REQUIREMENTS.md` — PLAT-01..09, PLAT-11, PLYR-01..03, INPT-01, INPT-02, STGE-02 wording
- `.planning/PROJECT.md` — Core value, constraints (Python 3.14 style, one class per file, domain subdirs, 100% coverage)
- `.claude/CLAUDE.md` — Coding standards (hard constraints), stack versions, "What NOT to use" table

### Stack & architecture research
- `.planning/research/SUMMARY.md` — Executive summary, phase research flags (mobile measurement, host/compression)
- `.planning/research/STACK.md` — Exact versions, Pyodide/three.js boundary, performance budget, loading sizes
- `.planning/research/ARCHITECTURE.md` — `scorched_core` / `scorched_web` split, `protocol.py` buffer contract, struct-of-arrays bullets, altitude-scale camera mapping
- `.planning/research/PITFALLS.md` — FFI cost, WASM memory detachment, bullet readability, hosting/MIME, iOS quirks
- `.planning/research/FEATURES.md` — Touch-control and keyboard conventions, hitbox visibility, 60 Hz/letterbox expectations

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None. This is a greenfield repo (only `.planning/` exists). Benchmark scripts from research (`bench_game.py`, `bench_pyodide.mjs`) are referenced in CLAUDE.md as starting points for a Node perf harness. They live in an old scratchpad and may no longer exist.

### Established Patterns
- None in code yet. Patterns are prescribed by research/CLAUDE.md: pure deterministic Python core, a single batched `tick()` per frame, no per-entity FFI, bulk float32 buffers into `InstancedMesh`, uniform-grid broadphase, preallocated pools, fixed 60 Hz timestep, seeded RNG.

### Integration Points
- Phase 1 establishes the project skeleton every later phase builds on: Python package layout + test tree mirror, `protocol.py` buffer/event contract, JS renderer/input/platform modules, Vite config, CI/deploy workflow.

</code_context>

<specifics>
## Specific Ideas

- Raiden / Raiden IV feel: instant-response movement, modest 3D tilt, classic 3:4 vertical-cabinet framing.
- The out-of-play margins should still feel like part of the world (dimmed terrain), not a dead black frame.
- Test links have to be easy to send to friends' phones, so debug and stress are controlled by URL parameters.

</specifics>

<deferred>
## Deferred Ideas

- Self-hosting Pyodide (instead of CDN) — revisit with PWA/offline install in Phase 4 (PLAT-10).
- Touch sensitivity multiplier as a player option — possible Phase 4 options item.
- Focus/slow-movement key — not in v1 requirements; would be a new capability.

</deferred>

---

*Phase: 01-playable-core-on-real-devices*
*Context gathered: 2026-10-17*
