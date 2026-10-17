# Walking Skeleton — Scorched

**Phase:** 1
**Generated:** 2026-10-17

## Capability Proven End-to-End

> A player opens the game page, Pyodide boots from the jsDelivr CDN, and the Python core moves a three.js ship across a tilted-camera playfield when the arrow keys are held. JS makes one held `tick` call per frame, and Python copies positions into JS-owned `Float32Array`s. This is proven first on a local production build (`vite preview`, verified with Playwright) and then at the GitHub Pages URL.

Plan 01-01 (tracer task) proves the local path. Plan 01-02 proves the same path on the real static host.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Language / runtime split | Game logic in Python 3.14 running in Pyodide 314.0.7 (CPython 3.14.2) on the browser main thread. JS only does DOM, input capture, rendering and timing. | User requirement (Python game logic). STACK.md verdict. No SharedArrayBuffer or Worker, because GitHub Pages cannot set COOP/COEP headers. |
| Renderer | three.js 0.186.1 `WebGLRenderer` (WebGL2) with tone mapping. `EffectComposer` + `UnrealBloomPass` + `OutputPass` from plan 01-03 onwards. | Every needed feature ships in r186. WebGL2 works on all target browsers. Babylon.js 9.31.0 is the documented fallback if the device gate fails. |
| Python/JS boundary | JS holds one `WebGame.tick(dt_ms, buttons, move_x, move_y, drag_x, drag_y) -> steps` PyProxy and calls it once per `requestAnimationFrame`. Python packs `array('f')` channels and copies them with `JsBuffer.assign()` into JS-owned `Float32Array`s, which JS allocates once from `manifest()`. | No per-entity FFI, no Python source evaluation in the frame loop, and no WASM-heap views held across frames (CLAUDE.md "What NOT to use"). |
| Protocol | `src/scorched_core/protocol.py` holds the constants: a 16-slot header and the `header` / `pbullets` / `ebullets` / `drones` channels with their strides and caps. They are exported through `Game.manifest()`. JS reads slot indices and capacities from the manifest and never hardcodes them. | One source of truth. Python-side layout changes need no JS edits. `RenderSink.attach` validates lengths at boot. |
| Simulation clock | Fixed 60 Hz `FixedStepRunner` in Python (`MAX_STEPS = 3`, 100 ms dt clamp). `RefreshEstimator` vsync snapping lands in plan 01-08. Python owns pause. | Same game speed on 60, 120 and 144 Hz displays. Deterministic and pytest-testable. |
| Units | 240 x 320 logical playfield units (D-06), origin top-left, y down. World mapping is `X = x - 120`, `Z = y - 160` on the plane `Y = 0`. | Every speed, hitbox and spawn constant is authored in these units. |
| Python source delivery | `import.meta.glob('/src/**/*.py', { query: '?raw', import: 'default', eager: true })` bundles the sources into the JS build. They are written into the Pyodide filesystem under `/lib`. | Dev and prod use the same mechanism. Sources are versioned with the bundle and need no packer tool. |
| Data layer | None in Phase 1. Simulation state lives in Python memory. Browser `localStorage` (high scores) arrives in Phase 4. | Static game with no backend. |
| Auth | None. | Static site with no accounts (REQUIREMENTS "Out of Scope"). |
| Build / toolchain | Vite 8.3.4 (`base: './'`, `target: 'es2022'`), Node 24.22.0, uv-managed Python 3.14. All dependencies are exact-pinned with committed lockfiles. | The relative base works at the site root and in `pr-preview/pr-N/` subfolders (D-01). |
| Tests | pytest 9.1.1 + pytest-cov 7.1.0 (100% line + branch), ruff 0.17.1, vitest 5.0.5 for pure JS modules, Playwright 1.64.1 end-to-end against the production build. `tests/test_conventions.py` enforces the user's organisation rules. | CLAUDE.md coding standards. The Pyodide adapter is tested against fake JsProxy objects. |
| Deployment | GitHub Pages served from the `gh-pages` branch. `deploy.yml` runs on every push to `main` after the reusable `gate.yml`. PR previews go to `pr-preview/pr-N/` via `rossjrw/pr-preview-action`. All actions are pinned by full commit SHA. | D-01, D-03, D-04 (branch-based Pages so main and previews coexist). |
| Directory layout | `src/scorched_core/<domain>/` (pure, stdlib only), `src/scorched_web/` (the only JS-aware Python), `tests/` mirroring `src/`, `web/src/<area>/` JS (`boot`, `loop`, `input`, `render`, `quality`, `debug`, `python`), `web/test/` mirroring `web/src/`, `tools/e2e/` Playwright specs, `.github/workflows/`. | One class per file, domain subdirectories, mirrored tests (CLAUDE.md). |

## Stack Touched in Phase 1

- [ ] Project scaffold: Vite build, ruff, pytest + coverage gate, vitest, Playwright (plan 01-01)
- [ ] Routing: single page; behaviour is selected by URL flags (`?debug`, `?stress=N`, `?tier=`, `?crash=`) parsed with allow-lists (plans 01-01, 01-03, 01-04, 01-09)
- [ ] Database: not applicable (no persistence in Phase 1). The equivalent round trip is the per-frame Python to JS buffer copy, exercised from plan 01-01.
- [ ] UI: keyboard input reaches Python and the rendered ship moves (plan 01-01). Touch drag is added in plan 01-06.
- [ ] Deployment: running at `https://<owner>.github.io/<repo>/` from the `gh-pages` branch (plan 01-02). PR previews are validated at the device gate (plan 01-10).

## Out of Scope (Deferred to Later Slices)

- Weapon pickups, weapon levels, bombs (the bomb key is reserved only), death and respawn (Phase 2)
- Explosions, particles, scorch marks, shadows, screen shake, hitstop, SFX (Phase 2)
- Enemies that shoot, ground targets, stage timelines, bosses, scoring, HUD, lives (Phase 3)
- Menus, difficulty, stage select, continues, high scores, music, options, PWA install (Phase 4)
- Self-hosting Pyodide, touch sensitivity option, focus or slow-movement key (CONTEXT.md Deferred Ideas)
- numpy, Web Worker / SharedArrayBuffer, WebGPU renderer (only if the device gate demands them)

## Subsequent Slice Plan

Each later phase adds vertical slices on top of this skeleton without changing its architectural decisions:

- Phase 2: Arcade shooting feel. Full arsenal, bombs, death/respawn, effect stack and SFX in a shooting gallery.
- Phase 3: Stage 1 vertical slice. Data-driven waves, multi-phase boss, scoring, lives, HUD.
- Phase 4: Full campaign and arcade shell. Stages 2-3, menus, high scores, music, options, PWA.
