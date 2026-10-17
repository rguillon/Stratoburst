# Phase 1: Playable Core on Real Devices - Research

**Researched:** 2026-10-17
**Domain:** Pyodide (Python-in-WASM) game core + three.js WebGL2 renderer, deployed as a static site on GitHub Pages, validated on real phones
**Confidence:** HIGH on the toolchain, boundary mechanics and deploy pipeline (all exercised in this session). MEDIUM on camera/tier/touch tuning numbers (starting values, must be tuned on devices). LOW on anything about real phone performance (nobody has measured it yet; that is what this phase is for).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Hosting & deploy**
- **D-01:** Host on **GitHub Pages**. No custom headers are available there, which is fine: no SharedArrayBuffer, Pyodide stays on the main thread. Vite build uses a relative base (`--base=./`) so the same build works at the root and in preview subfolders. — **Reversibility:** reversible
- **D-02:** Load the Pyodide runtime from the **jsDelivr CDN** (`https://cdn.jsdelivr.net/pyodide/v314.0.7/full/`), exact-pinned. Only the game's own files (JS bundle, Python sources/wheel) are served from Pages. Self-hosting may be revisited with PWA/offline in Phase 4 (PLAT-10).
- **D-03:** **Every push to `main` deploys** via a GitHub Actions workflow that first runs `ruff check`, `ruff format --check` and `pytest --cov --cov-branch --cov-fail-under=100`, then runs the Vite build and deploys. A red gate blocks the deploy.
- **D-04:** **PR preview deployments** as well. GitHub Pages has no native previews, so the researcher should pick the approach. The likely option is deploying to the `gh-pages` branch with each PR in a subfolder (e.g. `pr-preview/pr-N/`) and a sticky PR comment with the link, then cleanup on close. This implies branch-based Pages (not the artifact-based `actions/deploy-pages`) so main and previews can coexist. — **Reversibility:** costly — the Pages source mode (branch vs Actions artifact) and URL layout are shared by main deploy and previews
- **D-05:** **The user creates the GitHub repo and enables Pages themselves.** Plans must not try to create the remote. Instead, include a clear human checkpoint saying exactly what to create and configure (repo, Pages source/branch, Actions permissions) and when.

**Playfield & camera**
- **D-06:** Logical playfield is **3:4 arcade portrait (~240×320 units)**. Gameplay coordinates, the speed constants and the hitbox sizes are defined in these units. — **Reversibility:** costly — every speed, spawn position, pattern and hitbox constant in later phases is authored in these units
- **D-07:** Letterbox margins show **dimmed/desaturated terrain continuing** beyond the playfield (not black bars), so the edges clearly read as out of play. Margins must be cheap to render (they're included in the quality-tier budget).
- **D-08:** **Camera tilt is modest, ~20–30°.** Mostly top-down with visible 3D depth. Planner/researcher pick the exact angle and FOV within this range and keep them as config constants. The altitude-scale mapping (gameplay at player altitude, other layers scaled about the camera) follows the research ARCHITECTURE.md.
- **D-09:** **Camera is fully fixed.** No sway or follow. The whole playfield is always visible.

**Ship control & input**
- **D-10:** Ship speed is **Raiden-like: about 1.2 s to cross the playfield width**, with instant start/stop (no acceleration), as a tunable constant. Diagonals are normalized so they move no faster than straight lines. No focus/slow mode.
- **D-11:** Keyboard keys are read **by physical key (`event.code`)**: arrows + WASD (on AZERTY those physical keys are ZQSD) to move, **Space or J** to fire (hold), **Shift or K** reserved for bomb (Phase 2), **Esc or P** for pause.
- **D-12:** **Touch is relative 1:1 drag with the same speed cap as keyboard.** The ship follows finger movement 1:1 but never exceeds the max speed, and leftover finger movement is caught up over the next frames, so the ship can't teleport. Touch has always-on auto-fire. Pointer events are tracked per `pointerId` with `touch-action: none`.

**Placeholder visuals & targets**
- **D-13:** Visuals are **"simple but recognizable"**: a low-poly code-built jet silhouette with an emissive engine glow, a visibly marked hitbox core (PLYR-02), plain block-shaped targets, and flat-shaded tiled terrain with a few block buildings scrolling continuously. Don't invest in the Phase 2 part-based model system yet.
- **D-14:** Phase 1 targets are **drifting air drones** that a basic spawner sends down the screen. They take a few hits, flash and disappear (no particles or explosions yet). No ground targets in Phase 1.

**Debug & stress tooling**
- **D-15:** Debug features are enabled through **URL flags only**, invisible to normal players: `?debug` (frame/tick timing overlay), `?stress=N` (spawns N Python-driven bullets, default 500), `?tier=low|mid|high` (forces a quality tier instead of auto-selecting). Flags can be combined so a test link can be sent to a friend's phone.

### Claude's Discretion
- Exact camera angle and FOV within 20–30°, the terrain scroll speed, the player fire rate and shot pattern (a simple straight twin shot is fine), and drone HP and spawn rate.
- The quality-tier ladder (DPR caps, bloom resolution or off) and the auto-step-down heuristic. Bloom must exist in Phase 1 because the stress test measures it.
- The loading-screen and error-panel visual style.
- Go/no-go measurement method. The user did not discuss devices, so use the ROADMAP Phase 1 success criterion 3 as the pass/fail bar: 60fps on a mid-range desktop and ≥30fps steady on a mid-range Android and a recent iPhone, with 400+ bullets and bloom on. Plans should include a human-verify checkpoint where the user runs the `?debug&stress` link on their real phones and reports the numbers.

### Deferred Ideas (OUT OF SCOPE)
- Self-hosting Pyodide (instead of CDN) — revisit with PWA/offline install in Phase 4 (PLAT-10).
- Touch sensitivity multiplier as a player option — possible Phase 4 options item.
- Focus/slow-movement key — not in v1 requirements; would be a new capability.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLAT-01 | Single shareable URL, static hosting, desktop or mobile | GitHub Pages branch deploy + relative-base Vite build (Pattern 11). Pages serves gzip only, `cache-control: max-age=600` [VERIFIED: curl emscripten.org]. |
| PLAT-02 | Game logic in Python (Pyodide), rendering three.js WebGL2 | Boot sequence and boundary verified end to end in headless Chromium (Patterns 1, 2). |
| PLAT-03 | Loading screen with progress, then tap/click gate that also unlocks audio | Byte-accurate progress via a counting `fetch` wrapper, with known decoded sizes (Pattern 1). Gate creates and resumes an `AudioContext` (Pattern 1). |
| PLAT-04 | 60fps on mid-range desktop with ≈400+ bullets, effects on | Stress mode `?stress=N`, instanced bullets, bloom, debug overlay (Patterns 5, 8, 9). Python cost measured at ~0.3-0.4 ms/tick for 500 bullets. |
| PLAT-05 | ≥30fps steady on mid-range Android and recent iPhone, automatic quality tiers | Tier ladder + step-down controller with a "verify and lock" rule (Pattern 8). Human-verify device checkpoint (Planning Notes). |
| PLAT-06 | Fixed 60 Hz timestep independent of display refresh | Python-owned accumulator with vsync snapping, unit-testable with synthetic dt sequences (Pattern 3). |
| PLAT-07 | Fixed logical portrait playfield letterboxed to any screen/orientation | Camera fit function + world-space mask frame for the dimmed margins (Pattern 4). |
| PLAT-08 | Auto-pause on blur or hidden | Python-owned `paused` flag, JS triggers on `visibilitychange`/`blur`/`pagehide`, clock reset on resume (Pattern 3). |
| PLAT-09 | On-screen error panel instead of a frozen page | Error panel installed first, wraps load, frame and Python exceptions; `?crash=py\|js` trigger (Pattern 10). |
| PLAT-11 | Python core testable headlessly with pytest | `scorched_core` is pure; toolchain verified (uv + Python 3.14.6, pytest 9.1.1, pytest-cov 7.1.0 at 100%) (Code Examples). |
| PLYR-01 | 8-direction movement, responsive, consistent speed | Normalized diagonals, 3.333 units/tick (240 units in 1.2 s at 60 Hz), instant start/stop (Pattern 7). |
| PLYR-02 | Small hitbox core visibly marked | Always-visible marker mesh at the hitbox radius (Pattern 7, Pitfall 13). |
| PLYR-03 | Main weapon: hold on keyboard, auto-fire on touch | Twin straight shot in Python; input-mode detection sets auto-fire (Pattern 7). |
| INPT-01 | Keyboard by physical key | `event.code` table, preventDefault, clear on blur (Pattern 7). |
| INPT-02 | Relative 1:1 touch drag with auto-fire | Pointer events per `pointerId`, ray-plane unprojection for exact 1:1, pending-delta with speed cap and wall rule held in Python (Pattern 7). |
| STGE-02 | 3D terrain scrolls under the gameplay plane through a fixed tilted camera | Ring of recycled terrain chunks driven by Python's scroll value (Pattern 6), camera fit (Pattern 4). |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

These carry the same authority as locked decisions. Source: `/home/renaud/scorched/.claude/CLAUDE.md`, read this session.

- **Language:** game logic in Python (explicit user requirement). Python 3.14 idioms, type hints on everything, dataclasses with `__slots__`, enums, `match` where it clarifies.
- **Format/lint:** `ruff check` and `ruff format --check` must pass.
- **One class per file**, file named after the class in snake_case (`PlayerShip` -> `player_ship.py`). This includes enums and dataclasses.
- **Consistent domain subdirectories** (`entities/`, `weapons/`, `stages/`, `collision/`, `scoring/`, `bridge/`), with the test tree mirroring the source tree (`tests/<same path>/test_<module>.py`).
- **100% line + branch coverage**: `pytest --cov --cov-branch --cov-fail-under=100`. A task is not done until the gate passes. The Pyodide adapter is tested against a fake `js` module. Avoid `# pragma: no cover` except for genuinely unreachable code, and justify each one.
- **Platform:** browser, static hosting, no backend. **Assets:** 3D models generated in code. **Input:** keyboard and touch both required. **Performance:** must stay responsive on mobile.
- **What NOT to use (STACK.md table, restated in CLAUDE.md):** per-entity FFI, `runPython` in the frame loop, Python-side particle simulation, naive O(n*m) collision at scale, holding `getBuffer().data` across frames, allocating in the frame loop, pygbag/Panda3D/Ursina/Harfang, MicroPython, PyScript tags, `^`-ranged versions of three/pyodide, loading numpy "just in case".
- **GSD workflow:** file edits go through a GSD command (this research is produced under `/gsd-plan-phase`).
- **No project skills** exist (`.claude/skills/` etc. absent).

## Summary

Every mechanism the phase depends on was exercised in this session, not just read about. A throwaway Vite 8.3.4 project (Node 24.22.0) bundled the npm `pyodide@314.0.7` wrapper and `three@0.186.1`; in headless Chromium it loaded the Pyodide runtime from jsDelivr through `indexURL`, wrote Python sources into the Pyodide filesystem, called a held `tick` proxy, and copied bullet positions with `JsBuffer.assign()` into a JS-owned `Float32Array` that was simultaneously the attribute array of an instanced shader mesh running through `EffectComposer` + `UnrealBloomPass` + `OutputPass`. A screenshot confirmed 500 bloom-lit bullets driven by Python. The same Vite dev server also worked.

The largest risk moved. Python cost for 500 bullets (integrate, bounce, player hit test, pack, assign) measured 0.40 ms/tick in Pyodide-on-Node and 0.32 ms/tick in headless Chromium on this machine [VERIFIED: local run], so even a 5x phone slowdown leaves it far under budget. The unmeasured risks are fill rate (bloom, DPR), Safari quirks, and thermal throttling. So the phase's real deliverable is the measurement tooling (debug overlay with a copyable report, forced tiers, a 5-minute soak) plus the human device checkpoint. The go/no-go decision is made from that report, not from the code.

Three non-obvious design findings shape the plans. (1) A perspective-tilted camera turns the rectangular playfield into a trapezoid (far edge about 0.85x the near edge at 25° tilt / 30° vertical FOV), so "letterbox" cannot be CSS bars. Draw the dimmed margins as a world-space mask mesh with a rectangular hole, and fit the camera by projecting the four playfield corners. (2) A plain fixed-step accumulator driven by rAF deltas produces 0-step/2-step frames on about half of all frames under 0.4 ms of timestamp jitter, which is visible stutter; snapping dt to the estimated vsync period cut that to 0.1% in a simulation, with identical steps per second at 30/60/120/144 Hz [VERIFIED: local simulation, synthetic jitter model]. (3) Pyodide has no download-progress API, but wrapping `globalThis.fetch` during `loadPyodide` and counting decoded bytes gives exact progress against known sizes (12,262,932 bytes total), with no double download and a working `WebAssembly.instantiateStreaming` [VERIFIED: headless Chromium].

**Primary recommendation:** Build the Phase 1 slice exactly along the research ARCHITECTURE seam (`scorched_core` pure Python, `scorched_web` thin adapter, one `tick()` per rAF, `assign()` into JS-owned typed arrays), ship Python sources inside the JS bundle via `import.meta.glob(..., {query: '?raw'})` and `FS.writeFile`, load the Pyodide runtime from jsDelivr with an exact pin, and invest the saved effort in the on-device overlay/report and the quality controller.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Simulation (movement, shooting, drones, collision, scroll, stress bullets) | Python in WASM (`scorched_core`) | — | Anything that can change gameplay outcome lives in Python (ARCHITECTURE headline 1). |
| Fixed 60 Hz stepping, pause state | Python in WASM | Browser (supplies dt, triggers pause) | Accumulator in Python so it is pytest-testable; JS only measures rAF time and signals visibility. |
| Raw input capture (keys, pointers) | Browser | — | DOM events only exist in JS; reduced to buttons + two axes + a drag delta. |
| Touch pixel-to-playfield mapping | Browser | — | Needs the camera projection (presentation concern); Python receives playfield units. |
| Touch catch-up, speed cap, wall rule | Python in WASM | — | Affects ship position, hence gameplay; deterministic and testable. |
| Rendering, camera fit, terrain, models, bloom | Browser (three.js) | — | Presentation only. |
| Quality tiers and step-down heuristic | Browser | — | Presentation only; uses frame timings. |
| Debug overlay, report, error panel, loading UI | Browser | — | Must work even when Python or WebGL failed to start. |
| Pyodide runtime delivery | CDN (jsDelivr) | — | D-02. Brotli, CORS `*`, 1-year cache [VERIFIED: curl]. |
| Game bundle delivery | Static host (GitHub Pages) | — | D-01. gzip only, `max-age=600` [VERIFIED: curl]. |
| Quality gate + deploy + PR previews | CI (GitHub Actions) | Static host (`gh-pages` branch) | D-03, D-04. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pyodide (npm) | 314.0.7 | JS wrapper (`loadPyodide`) bundled into the app; runtime files come from the CDN | Exact pin matches D-02. `checkAPIVersion` (default true) throws if the JS package and the CDN core versions differ [CITED: pyodide.org js-api]. Same package drives the Node test harness. [VERIFIED: npm registry, `latest` dist-tag] |
| Pyodide runtime (CDN) | v314.0.7, CPython 3.14.2 | Python in WASM | `https://cdn.jsdelivr.net/pyodide/v314.0.7/full/` returns `content-encoding: br`, `access-control-allow-origin: *`, `cache-control: public, max-age=31536000` [VERIFIED: curl]. |
| three | 0.186.1 | WebGL2 renderer, `InstancedBufferGeometry`, `EffectComposer`, `UnrealBloomPass`, `OutputPass` | Exact pin. All five postprocessing files present in the tarball [VERIFIED: file listing]. |
| vite | 8.3.4 | Dev server and production build | `engines.node` is `^20.19.0 \|\| >=22.12.0` [VERIFIED: npm view]. Built and dev-served the probe on Node 24.22.0. |
| Node.js | 24.x LTS ("Krypton", v24.22.0 verified; 22.12+ also satisfies Vite) | Vite, Node harness, Playwright | Local Node 18.19.1 is too old. [VERIFIED: nodejs.org index.json + built probe] |
| CPython (dev/test) | 3.14.x via uv (3.14.6 already installed here) | pytest on the pure core | Same minor as Pyodide's 3.14.2. [VERIFIED: `uv python list`, ran the suite on 3.14.6] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pytest | 9.1.1 | Test runner | Always. [VERIFIED: PyPI JSON API] |
| pytest-cov | 7.1.0 (pulls coverage 7.16.2) | Coverage gate | Always. [VERIFIED: PyPI JSON API] |
| ruff | 0.17.1 | Lint + format | Always. `target-version = "py314"` accepted. [VERIFIED: ran it] |
| vitest | 5.0.5 | Unit tests for pure JS logic (quality controller, camera fit, touch mapper, frame stats) | Recommended, low cost; device testing is expensive so pure logic should be tested natively. Optional. |
| @playwright/test | 1.64.1 | One CI smoke test of the built bundle (loads, gate, tick advances, `?crash=py` shows panel) | Recommended; headless Chromium + SwiftShader worked here (cached `chromium_headless_shell-1248`). Optional; make non-blocking if flaky. |
| rossjrw/pr-preview-action | v1.8.1 (`ffa7509e91a3ec8dfc2e5536c4d5c1acdf7a6de9`) | PR preview deploys with sticky comment and QR code | D-04. QR code is on by default in 1.8.x, which is convenient for phones. [VERIFIED: GitHub API + README] |
| JamesIves/github-pages-deploy-action | v4.9.0 (`fa24774553152dd7873cd16ebd8d959b010c5445`) | Main-branch deploy to `gh-pages` with `clean-exclude: pr-preview/` | D-03/D-04. [VERIFIED: GitHub API + README] |
| actions/checkout | v7.0.1 (`3d3c42e5aac5ba805825da76410c181273ba90b1`) | CI | [VERIFIED: GitHub API] |
| actions/setup-node | v7.1.0 (`949feb2413d6458794dcd2491c4babbbce0c15c1`) | CI | [VERIFIED: GitHub API] |
| astral-sh/setup-uv | v10.3.0 (`1c37ad07a6a961277cf70c0d37d6f313000f5884`) | CI (installs uv, which reads `.python-version`) | [VERIFIED: GitHub API] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Python sources via `import.meta.glob ?raw` + `FS.writeFile` (recommended) | Zip + `pyodide.unpackArchive(buf, "zip", {extractDir})` | Zip also verified working (8 ms unpack). Needs a Python packer that itself needs 100% coverage, plus a build ordering step, plus `assetsInlineLimit` care. Glob-raw has no extra tool, identical dev and prod path, and the sources are versioned together with the JS bundle. Use the zip only if source size ever matters. |
| Plain `.py` import (recommended) | Pre-compiled `.pyc` | `.pyc`-only import works across 3.14.6 -> 3.14.2 (2.4 ms vs 3.8 ms for a tiny module) but loses source lines in tracebacks. For 80 dataclass modules, source import took 115 ms vs 86 ms with unchecked-hash `.pyc` on desktop [VERIFIED: local]. Not worth it now; revisit only if boot time on phones is the bottleneck. |
| `UnrealBloomPass` | Custom bloom, or additive glow sprites | Stock pass is enough (its bright target is already half resolution, five mips). Glow sprites are the Phase 2 fallback if bloom cannot hold on phones. |
| rAF directly | `renderer.setAnimationLoop` | Equivalent. Use plain `requestAnimationFrame` so the loop is fully owned by `frame_loop.js` and easy to stop on error. |

**Installation:**
```bash
# Toolchain (human or setup task): Node 24 LTS (fnm, nvm, or tarball), uv already present
echo "24" > .node-version
uv sync --locked                       # pytest 9.1.1, pytest-cov 7.1.0, ruff 0.17.1, Python 3.14
npm install --save-exact pyodide@314.0.7 three@0.186.1
npm install --save-dev --save-exact vite@8.3.4
npm install --save-dev --save-exact vitest@5.0.5 @playwright/test@1.64.1   # optional
```

**Version verification:** run this session. `npm view pyodide version` -> 314.0.7 (dist-tag `latest`, also `next` = 315.0.0-alpha.2, do not use), `three` -> 0.186.1, `vite` -> 8.3.4, `vitest` -> 5.0.5, `playwright` -> 1.64.1. PyPI JSON API: ruff 0.17.1, pytest 9.1.1, pytest-cov 7.1.0, coverage 7.16.2.

## Package Legitimacy Audit

Seam output (`gsd-tools query package-legitimacy check`) run this session. None of the packages define `postinstall` or `install` scripts (`npm view <pkg> scripts.postinstall scripts.install` empty for all five npm packages).

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| pyodide | npm | years (npm package since 2019; latest 2026-09-14) | ~925k/wk | github.com/pyodide/pyodide | OK | Approved |
| three | npm | 15+ yrs (latest 2026-09-24) | ~21.4M/wk | github.com/mrdoob/three.js | SUS (`too-new`) | `three` [WARNING: flagged as suspicious — verify before using.] The flag reflects the date of the latest release, not the package age. User-mandated stack. Covered by the single dependency checkpoint. |
| vite | npm | years (latest 2026-10-08) | ~195M/wk | github.com/vitejs/vite | SUS (`too-new`) | `vite` [WARNING: flagged as suspicious — verify before using.] Same reason. User-mandated stack. |
| vitest (optional) | npm | years (latest 2026-10-15) | ~125M/wk | github.com/vitest-dev/vitest | SUS (`too-new`) | `vitest` [WARNING: flagged as suspicious — verify before using.] Optional. |
| @playwright/test (optional) | npm | years (latest 2026-10-14) | ~76M/wk | github.com/microsoft/playwright | SUS (`too-new`) | `@playwright/test` [WARNING: flagged as suspicious — verify before using.] Optional. |
| ruff | PyPI | years (latest 2026-10-15) | unknown to seam | docs.astral.sh/ruff | SUS (`too-new`, `unknown-downloads`) | `ruff` [WARNING: flagged as suspicious — verify before using.] Named by CLAUDE.md. |
| pytest | PyPI | years | unknown to seam | github.com/pytest-dev/pytest | SUS (`unknown-downloads`) | `pytest` [WARNING: flagged as suspicious — verify before using.] Named by CLAUDE.md. |
| pytest-cov | PyPI | years | unknown to seam | none reported by seam | SUS (`unknown-downloads`, `no-repository`) | `pytest-cov` [WARNING: flagged as suspicious — verify before using.] Named by CLAUDE.md. |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** three, vite, vitest, @playwright/test, ruff, pytest, pytest-cov. Every flag is a heuristic artifact (a release in the last few weeks, or the seam not reporting PyPI download counts); all are first-party tools named by the user's own stack documents. **Planner: insert ONE consolidated `checkpoint:human-verify` before the first `npm install` / `uv sync`, showing the exact pinned manifest above, instead of one checkpoint per package.** Mitigations to put in the plan: exact pins, committed lockfiles (`package-lock.json`, `uv.lock`), `npm ci` and `uv sync --locked` in CI.

*Third-party GitHub Actions (rossjrw/pr-preview-action, JamesIves/github-pages-deploy-action, astral-sh/setup-uv) are pinned by full commit SHA (resolved via the GitHub API this session) in the workflow skeletons below. rossjrw/pr-preview-action: 447 stars, created 2022-02-22, last push 2026-04-26, not archived [VERIFIED: GitHub API].*

## Architecture Patterns

### System Architecture Diagram

```
                          LOAD (once)                                    RUN (every rAF)
 ┌──────────────┐   ┌───────────────────────────┐              ┌────────────────────────────────────────────┐
 │ index.html   │   │ error_panel installed FIRST│              │ rAF(ts)                                    │
 │ static       │──►│ url_flags parsed           │              │   input.sample() ─► buttons, ax, ay, dragX/Y│
 │ loading UI   │   │ renderer + scene + shaders │              │   if paused or not started: render only     │
 └──────────────┘   │   compiled (warm both      │              │   tick(dt_ms, buttons, ax, ay, dx, dy)      │
                    │   render paths)            │              │        │  single held PyProxy call          │
 jsDelivr CDN       │ loadPyodide(indexURL=CDN)  │              │        ▼                                    │
 pyodide.asm.wasm ─►│  fetch wrapper ► progress  │              │  ┌──────────── Python (scorched_core) ───┐ │
 python_stdlib.zip  │ FS.writeFile(py sources)   │              │  │ FixedStepRunner.advance(dt)           │ │
 lockfile           │ create_game(options)       │              │  │  0..3 × World step:                   │ │
                    │ manifest() ► allocate typed│              │  │   input ► ship ► fire ► drones/spawn  │ │
 GitHub Pages       │   arrays, game.attach(...) │              │  │   ► stress bullets ► collisions       │ │
 bundle (hashed) ──►│ warm-up ticks              │              │  │ pack SoA ► array('f') ► sink.assign() │ │
                    │ ► "TAP / CLICK TO START"   │              │  └──────────────┬────────────────────────┘ │
                    │   (unlocks AudioContext)   │              │                 ▼ returns int steps         │
                    └───────────────────────────┘              │   header/bullets/enemies Float32Arrays      │
                                                                │   ► InstancedBufferAttribute.needsUpdate    │
                                                                │   ► terrain scroll (alpha-extrapolated)     │
                                                                │   quality.update(dt) ► tier change?         │
                                                                │   composer.render() or renderer.render()    │
                                                                │   overlay (4 Hz) / report ring buffer       │
                                                                └────────────────────────────────────────────┘
 visibilitychange / blur / pagehide ─► game.set_paused(True) + clear input + DOM "PAUSED"; resume on tap/key
 any exception (load, frame, Python) ─► error_panel (textContent only), loop stopped
```

### Recommended Project Structure

Python follows CLAUDE.md (one class per file, domain subdirectories, mirrored tests). Names below are recommendations; the executor may adjust within those rules. Function-only and constants-only modules are fine.

```
pyproject.toml            .python-version (3.14)     uv.lock
package.json              package-lock.json          .node-version (24)       vite.config.js
index.html                .gitignore (NONE EXISTS YET: node_modules, dist, .venv, __pycache__, .coverage, .planning/research/.cache)
public/.nojekyll          (copied to dist root; keeps Pages from running Jekyll)
.github/workflows/        gate.yml (workflow_call), deploy.yml (push main), preview.yml (pull_request)
src/scorched_core/                         # PURE: stdlib only, no js/pyodide imports
  protocol.py                              # constants only: PLAYFIELD_W/H, STEP_MS, SHIP_SPEED, caps, strides, header indices
  clock/        fixed_step_runner.py (FixedStepRunner), refresh_estimator.py (RefreshEstimator)
  input/        button.py (Button IntFlag), input_frame.py (InputFrame dataclass)
  entities/     player_ship.py (PlayerShip), drone.py (Drone)
  pools/        bullet_pool.py (BulletPool, SoA array('f') swap-remove), drone_pool.py (DronePool)
  weapons/      twin_shot.py (TwinShot)
  collision/    circle_hits.py (functions: x-reject brute force)
  spawning/     drone_spawner.py (DroneSpawner)
  stress/       bullet_storm.py (BulletStorm: N bouncing bullets, integrate + player-hit test)
  stages/       terrain_scroll.py (TerrainScroll)
  game/         game.py (Game facade: tick, manifest, attach, set_paused), fault_mode.py (FaultMode enum)
src/scorched_web/                          # the only code aware of JS objects
  bridge/       render_sink.py (RenderSink: validates length at attach, calls .assign)
  entrypoint.py                            # create_game(options_js) -> Game
tests/                                     # mirrors src/: tests/scorched_core/clock/test_fixed_step_runner.py ...
  test_conventions.py                      # AST guards (see below)
web/src/
  main.js                                  # boot orchestration
  boot/        error_panel.js url_flags.js loading_screen.js start_gate.js runtime_loader.js
  loop/        frame_loop.js pause_controller.js frame_stats.js
  input/       keyboard_input.js touch_input.js input_sampler.js
  render/      renderer_rig.js camera_fit.js playfield_mask.js terrain_ring.js ship_model.js drone_instances.js bullet_instances.js
  quality/     tiers.js quality_controller.js scaled_bloom_pass.js
  debug/       overlay.js report.js
  python/      sources.js (import.meta.glob), python_bridge.js
tools/         perf_node.mjs (optional Node harness, adapted from the old bench scripts), e2e/smoke.spec.js (optional)
```

**Repo-convention guards** (one `tests/test_conventions.py`, AST based, cheap): (a) no file under `src/scorched_core/` imports `js` or `pyodide`; (b) every `src/**/*.py` defines at most one top-level class and, if one, its snake_case name equals the file name; (c) every `src/**/x.py` has `tests/**/test_x.py` mirrored (exempt `__init__.py` and constants-only modules via an explicit allow-list). This turns the user's organization rules into a failing test.

### Pattern 1: Boot sequence with real progress and the start gate
**What:** Static loading UI in `index.html` (no JS dependency), `error_panel` installed before anything else, then load work in an order that overlaps the long pole.
**Steps:**
1. Install error panel and URL flags.
2. Start `loadPyodide` immediately (long pole: ~12.3 MB decoded, 1.7 s on desktop broadband).
3. In parallel build renderer, scene, models, terrain; call `renderer.compile(scene, camera)` and render one frame through **both** paths (composer and direct) so no shader compile happens at a tier switch or first gameplay frame.
4. After Pyodide: write sources (`FS.mkdirTree` + `FS.writeFile`), `sys.path.insert(0, "/lib")`, `create_game(options)`, `manifest()` -> allocate typed arrays -> `attach`, hold `tick = game.tick`, run ~120 warm-up ticks (stress count included) so any pool/heap growth happens before play.
5. Show the gate. On its gesture: create and `resume()` an `AudioContext` and start a one-sample silent buffer (satisfies PLAT-03's "also unlocks audio"; Phase 2 only adds sounds). Use `click`/`pointerup`, not `pointerdown`/`touchstart`, for iOS.

**Progress model:** Pyodide has no download progress hook [CITED: pyodide.org js-api config list has none]. Wrap `globalThis.fetch` only for the duration of `loadPyodide`, count decoded bytes per URL, restore afterwards. Decoded sizes at v314.0.7 [VERIFIED: curl with `Accept-Encoding: identity`]: `pyodide.asm.wasm` 9,598,218; `python_stdlib.zip` 2,545,637; `pyodide-lock.json` 119,077; total 12,262,932. Do NOT use `Content-Length`: jsDelivr sends the Brotli size (3,438,516 for the wasm) while the stream yields decoded bytes. Weight the bar: downloads 0-80%, Python init + import 80-90%, GPU warm-up 90-100%. If a URL is not in the size table (version bump), fall back to an indeterminate bar rather than a wrong percentage. Keep the size table next to the version pin and update both together.

**Verified in headless Chromium:** the wrapped `Response` (copying `status`, `statusText`, `headers`) still goes through WASM streaming compilation; counted bytes matched the table exactly.

```js
// Source: verified in this session (vite-probe, headless Chromium 156). Needs a Safari check on a real iPhone (see Assumptions A6).
import { loadPyodide } from "pyodide";
const PYODIDE_VERSION = "314.0.7";
const CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
const DECODED_BYTES = { "pyodide.asm.wasm": 9598218, "python_stdlib.zip": 2545637, "pyodide-lock.json": 119077 };

function trackFetch(onBytes) {
  const orig = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const res = await orig(input, init);
    const url = typeof input === "string" ? input : (input.url ?? String(input));
    if (!res.body || !url.startsWith(CDN)) return res;
    const reader = res.body.getReader();
    const body = new ReadableStream({
      async pull(c) {
        const { done, value } = await reader.read();
        if (done) c.close(); else { onBytes(url.slice(CDN.length), value.byteLength); c.enqueue(value); }
      },
      cancel(reason) { return reader.cancel(reason); },
    });
    return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
  };
  return () => { globalThis.fetch = orig; };
}

export async function loadRuntime(onProgress) {
  const total = Object.values(DECODED_BYTES).reduce((a, b) => a + b, 0);
  let got = 0;
  const restore = trackFetch((_name, n) => { got += n; onProgress(Math.min(got / total, 1) * 0.8); });
  try { return await loadPyodide({ indexURL: CDN }); } finally { restore(); }
}
```

### Pattern 2: One boundary call per frame, flat buffers, JS-owned arrays
**What:** JS holds one `tick` PyProxy and calls it once per rAF with primitives only. Python writes into fixed-size `array('f')` buffers and copies them with `JsBuffer.assign()` into typed arrays that JS allocated from `manifest()` and handed over once through `attach(...)`.
**Verified facts:**
- `assign()` requires equal total length and element type; a mismatch raises `ValueError: cannot assign to TypedArray of length 9600 from buffer of length 40`. So Python buffers and JS arrays are both allocated at full capacity from the same manifest; validate lengths once in `RenderSink.attach` so drift fails at boot, not mid-game.
- JS ints arrive as Python `int`, JS non-integers as `float` (`-0` arrives as `int`). Annotate numeric parameters `float` and do not rely on `isinstance`.
- `proxy.toJs({dict_converter: Object.fromEntries, create_pyproxies: false})` converts a nested dict manifest in one call; `options.to_py()` converts a JS options object inside `create_game`. Do both only at boot, destroy the manifest proxy after reading.
- A Python exception reaches JS as `PythonError` whose `message` contains the full formatted traceback, including source lines when `.py` files were written to the FS [VERIFIED: Node run].
- Because the arrays are JS-owned, WASM heap growth cannot detach them (the `getBuffer()` hazard from PITFALLS 23 does not apply).

**Channels (frozen in `protocol.py`, read by JS from `manifest()`):**

| Channel | Layout (float32) | Capacity | JS consumer |
|---------|------------------|----------|-------------|
| `header` | `[steps, scroll_y, alpha, ship_x, ship_y, flags, pbullet_n, ebullet_n, drone_n, tick_count, graze_count, ...]` (length 16, spare slots) | 16 | loop, camera, HUD-less status |
| `pbullets` | stride 4: `x, y, angle, kind` | 128 | `InstancedBufferAttribute`, `instanceCount = n` |
| `ebullets` | stride 4: `x, y, angle, kind` (stress bullets) | `max(600, N)` clamped to 5000 | same |
| `drones` | stride 8: `x, y, angle, flash, hp_frac, scale, kind, spare` | 32 | JS loop over <=32 `setMatrixAt` |

`flags` bit 0 = paused, bit 1 = firing. Events are not needed in Phase 1 (flash is a field in `drones`); adding an `events` channel in Phase 2 is additive.
`tick` signature: `tick(dt_ms, buttons, move_x, move_y, drag_x, drag_y) -> int` (steps run; 0 while paused or when the frame owed no step). When 0 steps ran, Python skips the pack/assign entirely.

### Pattern 3: Fixed 60 Hz stepping with vsync snapping, Python owns pause
**What:** `FixedStepRunner` (pure Python) owns the accumulator, `MAX_STEPS = 3`, the 100 ms dt clamp, and a small `RefreshEstimator`. JS passes the rAF callback timestamp delta (not `performance.now()` read inside the callback; the callback argument is vsync-aligned and lower jitter).
**Why snapping:** with 0.4 ms Gaussian jitter on rAF timestamps, the plain accumulator ran a step count other than 1 on 49.5% of 60 Hz frames (0-step then 2-step pairs, visible as stutter). Snapping `dt` to the nearest multiple of the median of the last 15 `dt`s (when within 25% of one period), and snapping that median to a standard rate (30, 60, 72, 90, 120, 144, 165, 240 Hz) when within 1.5%, cut it to 0.1%. Steps per second were 59.98-60.00 at 30, 60, 120 and 144 Hz for both variants [VERIFIED: local simulation script, jitter model is synthetic: see A4]. Also use a `>= STEP_MS - 1e-6` comparison.
**Pause:** `Game.set_paused(bool)` and a `PAUSE` button edge both toggle `paused`. While paused `tick` returns 0 and does not touch the accumulator. `set_paused(False)` zeroes the accumulator and the refresh estimator history, which is what makes "resume without a time jump" a pytest-checkable property. JS triggers `set_paused(True)` from `visibilitychange` (hidden), `window blur`, and `pagehide`, clears all input state, and sets `lastTs = null` so the first frame after resume passes `dt = 0`. Recommended UX (assumption A1): resuming requires a tap or a key press on a "PAUSED" overlay, so a player returning from another app is not killed by a running game; `Esc`/`P` toggle manually.
**Tests that prove PLAT-06/08 natively:** feed synthetic dt sequences for 30, 60, 120, 144 Hz with jitter; assert step counts over 10 s are 600 +/- 1; assert a 5 s dt gap yields at most 3 steps and the backlog is dropped; assert pause then resume with a huge dt runs 0 extra steps.

```python
# Source: design, shape verified by the clock simulation and the pyproj toolchain run (src/scorched_core/clock/fixed_step_runner.py)
from collections.abc import Callable
from dataclasses import dataclass, field

STEP_MS = 1000.0 / 60.0
MAX_STEPS = 3
MAX_DT_MS = 100.0
EPS = 1e-6


@dataclass(slots=True)
class FixedStepRunner:
    step_fn: Callable[[], None]
    acc: float = field(default=0.0, init=False)

    def advance(self, dt_ms: float) -> int:
        self.acc += min(dt_ms, MAX_DT_MS)
        steps = 0
        while self.acc >= STEP_MS - EPS and steps < MAX_STEPS:
            self.step_fn()
            self.acc -= STEP_MS
            steps += 1
        if steps == MAX_STEPS:
            self.acc = 0.0  # slow down, never spiral
        return steps
```
(`RefreshEstimator.snap(dt_ms) -> float` sits in front of `advance`; the example above is the runner alone.)

### Pattern 4: Camera fit and the world-space playfield mask
**What:** Gameplay lives on the plane `y = 0` in three.js world space, mapped from logical coordinates by `X = x - W/2`, `Z = y - H/2` (logical y grows downward). Terrain sits below (for example `y = -40`). The camera is fixed in orientation and looks at the playfield from the near (bottom) side.
**Config constants (discretion, start here):** tilt 25° from vertical, vertical FOV 30°. In a numeric check, far-edge/near-edge width of the projected playfield was about 0.85 at 25°/30° (0.81 at 30° tilt, 0.88 at 20°), so the playfield is a trapezoid on screen [VERIFIED: local three.js projection script; ratio approximate]. This is inherent to D-08 and is also what makes "the whole playfield is always visible" need a real fit.
**Fit (`camera_fit.js`, pure and unit-testable):** on resize, project the four playfield corners with the camera, binary-search the camera distance `D` along the fixed tilt direction until the projected bounding box fits inside the viewport with a small pad, then center the box vertically (shift the look-at target along Z, or use `camera.setViewOffset`). Same orientation and FOV on every device; only distance and centering change. Height-limited (landscape, desktop) and width-limited (tall phones) both fall out of the same search.
**Margins (D-07):** build one `ShapeGeometry` of a very large rectangle with a playfield-sized rectangular hole, as a `MeshBasicMaterial({color: 0x0b0a09, transparent: true, opacity: ~0.55, depthWrite: false})` at `y` just below the gameplay plane, rendered after the terrain. A thin emissive outline on the hole boundary marks the playfield edge. This follows the trapezoid exactly, costs one overdraw of the margin area only, and survives bloom. CSS bars cannot match a trapezoid. Terrain must be wide and long enough to cover the largest visible area: roughly +/-400 units in X for landscape 16:9 at this camera, more for ultra-wide, so use a 1200-unit-wide ground and clamp.
**Altitude mapping:** Phase 1 has exactly two layers (gameplay plane, terrain below). Entities sit directly on the gameplay plane in world coordinates, so hitboxes line up with visuals exactly. Keep the layer scale in one function in `camera_fit.js`/a `mapping` helper (`k = (camH - h) / (camH - playerH)` per ARCHITECTURE Pattern 8) so Phase 2 shadows and Phase 3 ground enemies reuse it, but do not use it for anything in Phase 1.
**Renderer/canvas sizing:** canvas CSS size 100% of a `100dvh` container; `renderer.setSize(w, h, false)`; observe with `ResizeObserver` and `visualViewport`; debounce and reallocate only when the integer size actually changes (PITFALLS 10). `viewport-fit=cover`, `env(safe-area-inset-*)` for later HUD.

### Pattern 5: Instanced bullets driven directly by the Python buffer
**What:** `InstancedBufferGeometry` (copy of a small quad/diamond geometry) + one `InstancedBufferAttribute(dataArray, 4)` where `dataArray` is the same `Float32Array` that Python `assign`s into. Per frame set `attr.clearUpdateRanges(); attr.addUpdateRange(0, n*4); attr.needsUpdate = true;` and `geometry.instanceCount = n`. A `ShaderMaterial` reads `aData.xy` (logical x, y) and composes the transform on the GPU; output color is HDR (>1) so the bloom threshold isolates bullets. Python writes 4 floats per bullet instead of a 16-float matrix.
**Verified:** rendered 500 Python-driven bullets through composer + bloom in headless Chromium (screenshot). `addUpdateRange`, `clearUpdateRanges` exist in r186 `BufferAttribute`; `InstancedBufferGeometry.instanceCount` exists.
**Gotchas verified:** (1) in a `ShaderMaterial`, each `#include <...>` must start its own line, otherwise the program fails to link and the only symptom is `INVALID_OPERATION: useProgram: program not valid` warnings and an empty frame. (2) `frustumCulled = false` on the mesh. (3) Include `tonemapping_fragment` and `colorspace_fragment` so the direct-render (no-composer) tier matches the composer tier.
Use `setMatrixAt` on a normal `InstancedMesh` only for drones (<=32 per frame).

```js
// Source: verified (vite-probe screenshot, three 0.186.1)
const quad = new THREE.PlaneGeometry(4, 4);
const geo = new THREE.InstancedBufferGeometry();
geo.index = quad.index;
geo.attributes.position = quad.attributes.position;
const attr = new THREE.InstancedBufferAttribute(data /* the Float32Array Python assigns into */, 4);
attr.setUsage(THREE.DynamicDrawUsage);
geo.setAttribute("aData", attr);
const mat = new THREE.ShaderMaterial({
  vertexShader: `attribute vec4 aData;
void main() {
  vec3 p = position;
  p.xy += aData.xy - vec2(120.0, 160.0);   // logical -> centered playfield; map to world in the real version
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`,
  fragmentShader: `void main() {
  gl_FragColor = vec4(vec3(4.0, 1.6, 0.4), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
});
const mesh = new THREE.Mesh(geo, mat);
mesh.frustumCulled = false;
// per frame, after tick() returned and Python assigned into `data`:
attr.clearUpdateRanges(); attr.addUpdateRange(0, n * 4); attr.needsUpdate = true; geo.instanceCount = n;
```

### Pattern 6: Terrain as a recycled chunk ring, scroll from Python
**What:** Ground = a few chunks (for example 3-4 chunks of ~320-400 units, covering at least ~1000 units along Z), each a flat plane with a procedurally generated canvas tile texture (no external assets) plus one `InstancedMesh` of block buildings with `flatShading`/vertex-lit material. The whole ring translates by `scroll_off`; when `floor(scroll_y / CHUNK_LEN)` advances, the chunk that passed the camera is regenerated from a seeded RNG `(stage_id, chunk_index)` (rewrite ~40 instance matrices; trivial) and moved to the front. No per-frame per-instance JS work.
**Smoothness on high-refresh displays:** header carries `alpha` (accumulator remainder / STEP). Render `scroll = scroll_y + alpha * SCROLL_SPEED` (constant-speed extrapolation is exact for terrain) so the ground does not judder on 120/144 Hz while the sim stays at 60 Hz. Ship and bullets render the latest sim state (render interpolation for them is PLSH-01, deferred).
**Lighting/cost:** one directional + ambient light, Lambert or unlit-with-vertex-colors, no shadows, no real-time lights. The margins reuse the same terrain (D-07), so quality tiers lower DPR/bloom only; no separate margin geometry.

### Pattern 7: Input and ship control (keyboard, touch), logic in Python
**Keyboard (`event.code`, physical keys):** `ArrowUp/Down/Left/Right` and `KeyW/KeyA/KeyS/KeyD` move (on AZERTY those same physical keys are labeled ZQSD; `event.code` follows position, not label), `Space`/`KeyJ` fire (hold), `ShiftLeft/ShiftRight`/`KeyK` reserved bomb (latch the edge, Python ignores it in Phase 1), `Escape`/`KeyP` pause. `preventDefault` on all of them (arrows/space scroll the page). Opposing keys on an axis resolve to 0. Clear all key state on `blur`, `visibilitychange`, `pagehide`.
**Movement in Python:** `PlayerShip.step(move_x, move_y, drag_x, drag_y)`. Keyboard vector `(move_x, move_y)` with components in {-1, 0, 1}; if its length exceeds 1 normalize it (diagonal no faster). Speed `SHIP_SPEED = PLAYFIELD_W / (1.2 * 60) = 3.333` units/tick, instant start/stop. Clamp to the playfield inset by the ship half-size.
**Touch (relative 1:1, speed-capped):**
- `touch_input.js`: `pointerdown` records the pointer (`pointerId`), `pointermove` accumulates delta in pixels, `pointerup`/`pointercancel`/`lostpointercapture` removes it. Container has `touch-action: none; user-select: none; -webkit-touch-callout: none; overscroll-behavior: none`. Only the first pointer steers; extra pointers are ignored in Phase 1 (bomb button arrives in Phase 2). `setPointerCapture` on `pointerdown`.
- Exact 1:1 under perspective: convert the pixel delta to a playfield delta by ray-plane intersection. Unproject `shipScreen` and `shipScreen + delta` onto the plane `y = 0` and subtract. `shipScreen` is the projection of the ship's current world position. This gives equal on-screen distance for finger and ship at the ship's depth. (A constant `W / projectedWidthPx` factor is a simpler approximation that is off by roughly the +/-15% perspective variation; acceptable fallback.)
- JS passes the accumulated playfield-unit delta since the previous `tick` as `(drag_x, drag_y)` and then zeroes it. **Python owns the catch-up:** `PlayerShip` keeps `pending_x/pending_y`, adds the new delta, moves by `min(|pending|, SHIP_SPEED)` per step along the pending direction, clamps `|pending|` to a configurable lag cap (start at 40 units ~ 0.2 s) so the ship never trails far behind, and **after clamping to the playfield edge zeroes the pending component on any axis that was blocked** (otherwise a finger pressed against the wall "banks" movement and the ship ignores the reverse drag until the bank is repaid; this is the classic relative-drag bug and should have a dedicated pytest). On `pointerup` JS sends nothing more; leftover pending finishes naturally.
- Input mode: the first `pointerdown` with `pointerType === "touch"` (the start-gate tap counts) sets touch mode, which ORs the `FIRE` bit always on (auto-fire). A subsequent `keydown` switches back to keyboard mode. Hybrid devices work either way.

**Ship, hitbox, targets (placeholder, D-13/D-14; all numbers are starting values, A3):** hitbox radius 2.0 units with an always-visible marker (small bright dot with a dark ring, radius ~2.5, rendered on top, not focus-gated, since Phase 1 has no focus mode); twin straight shot, one volley every 5 ticks, bullet speed 8 units/tick, `pbullets` cap 128; drones: radius 8, HP 3, 0.9 units/tick downward with a sinusoidal sway (~30 units, ~120-tick period), spawned every ~40 ticks from a seeded `random.Random`, cap 10, flash 6 ticks on hit, removed below the bottom edge or at 0 HP. Player-bullet vs drone collision is brute force with an x-reject (<=128 x <=16); no grid in Phase 1 (the grid decision lands in Phase 2 where counts grow, per SUMMARY gaps).

### Pattern 8: Quality tiers and the automatic step-down controller
**Ladder (starting values, A2; the first device run tunes them):**

| Tier | DPR cap | Max canvas pixels | Bloom | Notes |
|------|---------|-------------------|-------|-------|
| high | 2 | ~2.8 M | on, standard `UnrealBloomPass` | desktop default |
| mid | 1.5 | ~1.2 M | on at half scale (`ScaledBloomPass`) | mobile default start |
| low | 1 | ~0.6 M | off, render directly (no composer) | |

`effectiveDpr = min(devicePixelRatio, tier.dprCap, sqrt(tier.maxPixels / (cssW * cssH)))`. Reason for the pixel budget: an iPhone at DPR 3 is ~3 M pixels uncapped; a 4K desktop at DPR 1 is 8.3 M.
**Facts about the stock pass [VERIFIED: r186 source]:** `UnrealBloomPass` is constructed with `nMips = 5`, its bright target and all blur targets are `HalfFloatType` and start at half of the pass size, and the pass requires `renderer.toneMapping` to be set. `nMips` cannot change after construction, so the cheap "reduced bloom" lever is a subclass that overrides `setSize(w, h)` to call `super.setSize(w * scale, h * scale)`; `EffectComposer.addPass`/`setSize` call it with the pixel-ratio-scaled size. Bloom off = skip the composer and call `renderer.render`; with `renderer.toneMapping` set the materials tone-map themselves, matching `OutputPass` (verify visually in the first slice; PITFALLS 25).
**Initial tier:** `?tier=` wins and disables auto-adjustment. Otherwise touch-primary devices start at `mid`, others at `high`.
**Step-down heuristic (`quality_controller.js`, pure and unit-testable):**
1. Ignore frames during the first 2 s after start, resume, and every tier change.
2. Every 30 frames compute the median of the last 90 `dt`s. If median > 21.5 ms (below ~46 fps) increment a strike counter, else reset it. After 3 strikes step down one tier (min `low`), and remember the pre-change median.
3. **Verify and lock:** after the next full window, if the new median improved by less than 10% relative to the remembered one, the bottleneck is not fill rate (display cap such as iOS Low Power Mode at 30 fps, or CPU/tick bound): step back up one tier and lock auto-adjustment. This is needed because rAF frames land on vsync multiples, so a GPU-bound 33 ms frame and a 30 Hz display cap look identical, and GPU timer queries do not exist on iOS.
4. Never step up automatically beyond the verify rule. Rate-limit to one change per 3 s.
A tier change calls `renderer.setPixelRatio`, `composer.setPixelRatio`/`setSize` and toggles the bloom pass; budget one hitch (~tens of ms) per change. Pre-warm both render paths at load (Pattern 1).
**Do not tie tiers to entity counts in Phase 1.** If the Python tick is the bottleneck, the overlay reports it and the go/no-go decision handles it (numpy, caps, Worker; see Open Questions).

### Pattern 9: On-device overlay and shareable report (the measurement instrument)
**Overlay (`?debug`):** a `<pre>` updated 4 times per second via `textContent` (never every frame). Show: fps and frame ms (avg, p50, p95, max over the last 120 frames), JS-measured `tick` ms (around the call, so it includes `assign`) avg/p95, render-submit ms (CPU side only; GPU time is not observable on iOS), steps per frame, header counts (bullets, drones), tier and DPR and canvas pixels, `renderer.info.render.calls`/`triangles`, WASM heap size via `pyodide._module.HEAPU8.length` (debug only, guarded), `performance.memory.usedJSHeapSize` where present, elapsed minutes, count of frames over 25 ms.
**Report:** a "Copy report" button writing plain text to the clipboard (fallback: select-all text area, since iOS clipboard needs a user gesture): UA, screen and DPR, `WEBGL_debug_renderer_info` renderer string (Safari may mask it), pyodide/three versions, flags, tier changes with timestamps, and per-minute aggregates (avg fps, p95 frame ms, avg/p95 tick ms) so thermal throttling over a 5-minute soak is visible. This text is what the user pastes back after the device checkpoint; there is no Safari inspector available from Linux/WSL.
**Pass bars (from CONTEXT discretion, restated as numbers for the report):** desktop avg >= 58 fps with p95 frame <= 20 ms at 500 stress bullets and bloom; phones avg >= 29 fps with p95 frame <= 40 ms over a continuous 5-minute `?debug&stress=500` run on the auto tier, plus 2-minute forced `?tier=low` and `?tier=high` runs for comparison. Software GL (WSL2 SwiftShader) numbers do not count.

### Pattern 10: Error handling that cannot freeze silently
**What:** `error_panel.js` has no dependency on three or Pyodide, is installed first, and is the single sink for: `window.onerror`, `unhandledrejection`, a `try/catch` around the frame function (Python `PythonError`, JS errors), `loadPyodide`/fetch failure (CDN blocked), a load timeout (suggest 60 s), WebGL context creation failure, and `webglcontextlost` (pause and show a notice; three re-uploads resources on restore). On first error: stop the rAF loop, render a fixed full-screen panel with `message` and the traceback/stack, a "Copy report" button, and "Reload". Insert error text with `textContent` only (traceback text can contain markup-looking characters and URL data).
**Trigger for success criterion 5:** an extra debug flag (A5, extends D-15) `?crash=py` (Python raises on tick N) and `?crash=js` (frame function throws). Implemented through a `FaultMode` enum passed in `options`, covered by pytest.

### Pattern 11: Deploy pipeline (GitHub Pages, branch mode, main + PR previews)
**Pages source is the `gh-pages` branch (D-04).** Required one-time repo settings (human checkpoint, D-05): create the repo; Settings > Actions > General > Workflow permissions = "Read and write permissions"; after the first successful `main` deploy has created the `gh-pages` branch, Settings > Pages > Source = "Deploy from a branch", branch `gh-pages`, folder `/ (root)`. rossjrw's action explicitly does not work with the "GitHub Actions" Pages source [CITED: github.com/rossjrw/pr-preview-action]. If the repo is private, Pages may need a paid plan (A9), so make it public or confirm the plan.
**URLs:** main at `https://<user>.github.io/<repo>/`; previews at `https://<user>.github.io/<repo>/pr-preview/pr-<N>/` (default `umbrella-dir: pr-preview`), with a sticky PR comment and QR code (convenient for phones). The relative Vite base (`base: './'`) works at both depths. The Pyodide URL is absolute, so it is unaffected.
**Gate reuse:** one reusable workflow `gate.yml` (`on: workflow_call`) runs `uv sync --locked`, `uv run ruff check .`, `uv run ruff format --check .`, `uv run pytest --cov --cov-branch --cov-fail-under=100`, `npm ci`, `npm run build`, and uploads `dist` as an artifact (or the caller rebuilds). `deploy.yml` (push to `main`) and `preview.yml` (PRs) both call it first; a red gate blocks the deploy (D-03). Apply the gate to PRs too.
**Deploy job skeleton (SHAs resolved this session):**

```yaml
# .github/workflows/deploy.yml   (preview.yml is analogous; see rossjrw usage below)
name: Deploy
on:
  push:
    branches: [main]
concurrency:
  group: deploy-main
  cancel-in-progress: false
permissions:
  contents: read
jobs:
  gate:
    uses: ./.github/workflows/gate.yml
  deploy:
    needs: gate
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with: { node-version-file: .node-version, cache: npm }
      - uses: astral-sh/setup-uv@1c37ad07a6a961277cf70c0d37d6f313000f5884 # v10.3.0
      - run: npm ci && uv sync --locked && npm run build        # build pins nothing outside lockfiles
      - uses: JamesIves/github-pages-deploy-action@fa24774553152dd7873cd16ebd8d959b010c5445 # v4.9.0
        with:
          folder: dist
          branch: gh-pages
          clean-exclude: pr-preview/    # keeps previews alive across main deploys
          force: false                  # rebase instead of force-push over previews
          attempt-limit: 5              # default 3; two workflows can push to the same branch
```
```yaml
# .github/workflows/preview.yml (deploy step only)
on:
  pull_request:
    types: [opened, reopened, synchronize, closed]
concurrency: preview-${{ github.ref }}
permissions: { contents: write, pull-requests: write }
jobs:
  preview:
    if: github.event.pull_request.head.repo.full_name == github.repository   # forks are unsupported by the action
    runs-on: ubuntu-latest
    steps:
      # checkout, setup, gate steps run only when github.event.action != 'closed'
      - uses: rossjrw/pr-preview-action@ffa7509e91a3ec8dfc2e5536c4d5c1acdf7a6de9 # v1.8.1
        with:
          source-dir: ./dist
          preview-branch: gh-pages
```
Add `public/.nojekyll` (lands in `dist/`), so Pages does not run Jekyll over the branch.
**Post-deploy smoke (human, once, D-01/PITFALLS 8):** open the live URL, DevTools Network: all assets 200, no CORS errors, bundle gzip-encoded, Pyodide files from jsDelivr with `content-encoding: br`.

### Anti-Patterns to Avoid
- **Per-entity FFI or `runPython` in the frame loop** (CLAUDE.md "What NOT to use"): everything crosses in `tick` + `assign`.
- **Creating proxies per frame** (`create_proxy` inside rAF; PITFALLS 2): hold `tick` once; Phase 1 needs no Python callbacks into JS at all, so no `create_proxy` is needed anywhere.
- **Reading dt from `performance.now()` inside the callback** instead of the rAF timestamp argument.
- **Letterbox as CSS bars or a CSS-overlay rectangle**: the playfield is a trapezoid on screen.
- **Assuming tier-switch is free**: two shader variants (composer vs direct) compile lazily; warm both at load.
- **Python-side timing in the sim state** (`time` calls in `scorched_core`): keep wall-clock out of the deterministic core; JS measures tick time.
- **Disabling the cyclic GC now**: instead keep `tick` allocation-free and prove it with a test (below).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PR preview deploy + cleanup + sticky comment | A custom gh-pages script | `rossjrw/pr-preview-action` + `JamesIves/github-pages-deploy-action` | Handles removal on close, comment upsert, QR code, umbrella directory. |
| Bloom | A custom blur pyramid | `UnrealBloomPass` (+ tiny scaling subclass) | Already half-res with five mips; correct HDR/half-float handling. |
| Tone mapping / sRGB for the composer path | A final shader | `OutputPass` | Reads `renderer.toneMapping`/`outputColorSpace`. |
| Pointer tracking, capture, cancellation | Touch events by hand | Pointer Events + `setPointerCapture` | Per-`pointerId`, unified mouse/touch/pen. |
| Python source delivery | A zip packer with its own tests | `import.meta.glob ... ?raw` + `FS.writeFile` | One mechanism for dev and prod; verified. |
| Seeded RNG | A custom PRNG | `random.Random(seed)` | Deterministic, stdlib. |
| Coverage gate | Custom scripts | `pytest-cov` with `fail_under = 100`, `branch = true` | Verified working here. |
| Dependency version pinning for Pyodide | Free-range `^` ranges | Exact pins in `package.json` + `checkAPIVersion` | A mismatched JS wrapper and CDN core throws at load. |

**Hand-roll anyway (no library covers it):** the fetch-counting progress wrapper (about 25 lines), the fixed-step runner with vsync snapping, the camera fit, the quality controller. Each is small, pure, and unit-testable.

**Key insight:** the expensive failures in this phase (CDN/version drift, stutter from timestamp jitter, trapezoid framing, silent freezes, tier thrash on a display-capped phone) are all integration-shaped and invisible on a fast desktop. The leverage is in instruments (overlay, report, error panel) and pure testable modules, not in clever rendering.

## Common Pitfalls

### Pitfall 1: `assign()` length mismatch kills the frame
**What goes wrong:** `ValueError: cannot assign to TypedArray of length 9600 from buffer of length 40`.
**Why:** `assign` needs identical element type and total length [CITED: pyodide.org type-conversions; VERIFIED: local run].
**Avoid:** allocate both sides at full capacity from `manifest()`; `RenderSink.attach` checks `len(array) == target.length` once and raises at boot.
**Warning signs:** error panel on the first tick after attach.

### Pitfall 2: Node `Buffer` rejected by `unpackArchive`
**What goes wrong:** `RuntimeError: Unknown typed array type 'Buffer'` in the Node harness (not in browsers, where `fetch().arrayBuffer()` is used).
**Avoid:** `new Uint8Array(fs.readFileSync(...))`. Only matters for `tools/perf_node.mjs` and any zip-based path. [VERIFIED: local]

### Pitfall 3: Vite inlines small `?url` assets as `data:` URIs
**What goes wrong:** a 1 KB asset imported with `?url` became a base64 data URI in the bundle [VERIFIED: local build]. Irrelevant for the glob-raw route, but if any asset is imported by URL (zip alternative, fonts, textures), set `build.assetsInlineLimit: 0`.

### Pitfall 4: `#include` not at the start of a line in a `ShaderMaterial`
See Pattern 5. Symptom is a blank frame plus `useProgram: program not valid` warnings. [VERIFIED: local]

### Pitfall 5: Rolldown "externalized for browser compatibility" warnings
Bundling `pyodide` prints `node:fs`, `node:path`, ... externalized warnings. Harmless: the Node branches are runtime-guarded; the bundle ran in Chromium. Dev server also works without `optimizeDeps.exclude` when `indexURL` is passed explicitly [VERIFIED: local, dev run with and without]. Do not add config you did not need.

### Pitfall 6: Stutter from a naive accumulator
See Pattern 3. Looks like "the ship vibrates a bit at 60 Hz" on some phones. Tests with jittered synthetic dts catch it natively.

### Pitfall 7: Step-down thrash on iOS Low Power Mode
LPM caps rendering near 30 fps [ASSUMED, from PITFALLS 5]. A naive controller walks to `low` and still sees 33 ms. The verify-and-lock rule (Pattern 8) handles it. Surface "locked: refresh-capped or CPU-bound" in the overlay.

### Pitfall 8: Resume time jump and stuck keys
Returning from another tab yields one giant rAF delta and lost `keyup` events. Reset `lastTs`, zero the Python accumulator in `set_paused(False)`, clear keys/pointers on every pause trigger.

### Pitfall 9: Relative-drag banking against the wall
See Pattern 7. Pytest case: drag far right while at the right edge, then drag left; the ship must move immediately.

### Pitfall 10: Mobile WebGL: precision, context loss, resize churn
Use `highp` for scroll/time-dependent shader math (three's default is `highp`; check `getShaderPrecisionFormat` once and log it in the report). Debounce resize, reallocate only on integer size change (the address bar showing/hiding fires resize). Handle `webglcontextlost`/`restored`. Wrap terrain scroll with a modulo before upload (the header already carries a small offset). [CITED: PITFALLS 10]

### Pitfall 11: Thermal throttling hides behind short tests
60 fps for 30 s then a steady decline. The per-minute aggregates in the report and the mandatory 5-minute run exist for this. [CITED: PITFALLS 9]

### Pitfall 12: GitHub Pages caching and compression
Pages sends `cache-control: max-age=600` and gzip, never Brotli [VERIFIED: curl against emscripten.org served by GitHub.com]. Vite's hashed filenames make stale bundles a non-issue except `index.html` (10 minutes). Put the build commit hash in the overlay/report so testers can confirm they are on the new deploy. Do not add a service worker (PWA is Phase 4).

### Pitfall 13: Hitbox marker unreadable or hidden
On a 360 px-wide phone, 1 logical unit ~ 1.5 px, so a 2-unit radius is ~3 px. Draw the marker at 2.5 units with a dark outline and render it on top of the ship, not occluded by the engine glow or bloom wash. Verify on the real phone.

### Pitfall 14: Bloom washes the whole frame
With a dense bullet field and a low threshold, bloom flooded the probe frame (visible in the screenshot at threshold 0.2). Start with threshold near 1.0 (in linear HDR, before `OutputPass`) and bullet emissive 3-4x; terrain and ship albedo stay below 1 so only intended emitters glow. Full bullet-vs-fire readability is Phase 2 (VISL-05).

### Pitfall 15: Two workflows pushing the same branch
`deploy.yml` and `preview.yml` can race on `gh-pages`. JamesIves rebases and retries (`attempt-limit`, default 3) and recommends using `concurrency` [CITED: its README]; the plan should keep distinct concurrency groups (`deploy-main`, `preview-<ref>`), `force: false`, and treat one transient failure as re-runnable. See Open Question 3.

### Pitfall 16: Deploying a build that never ran against the real host
Local dev and preview hide CORS/MIME/caching problems. The checkpoint "open the real URL on a phone" is part of the phase, not an afterthought.

## Code Examples

### pyproject.toml (verified: `uv sync`, `ruff check`, `ruff format --check`, `pytest --cov --cov-branch --cov-fail-under=100` all ran green on Python 3.14.6)

```toml
[project]
name = "scorched"
version = "0.0.0"
requires-python = ">=3.14"
dependencies = []

[dependency-groups]
dev = ["pytest==9.1.1", "pytest-cov==7.1.0", "ruff==0.17.1"]

[tool.uv]
package = false

[tool.pytest.ini_options]
minversion = "9.0"
testpaths = ["tests"]
pythonpath = ["src"]
addopts = ["--import-mode=importlib", "--strict-markers", "--strict-config", "-ra"]

[tool.coverage.run]
source = ["src"]
branch = true

[tool.coverage.report]
fail_under = 100
show_missing = true
skip_covered = true

[tool.ruff]
target-version = "py314"
line-length = 100
src = ["src", "tests"]

[tool.ruff.lint]
# Verified set. Do NOT add "TC": it demands moving runtime-useful imports (Callable, array) into
# TYPE_CHECKING blocks and fights dataclass annotations.
select = ["E", "F", "W", "I", "N", "UP", "B", "SIM", "C4", "RUF", "PT", "ANN", "PL", "S", "T20", "A", "RET", "ARG"]
ignore = ["PLR2004"]

[tool.ruff.lint.per-file-ignores]
"tests/**" = ["S101", "ANN", "PLR", "ARG", "PLC0415"]
```
`--import-mode=importlib` lets the test tree mirror `src/` without `__init__.py` files in `tests/`.

### Fake `js` module for the adapter (verified)

```python
# tests/scorched_web/bridge/test_render_sink.py (shape verified)
import sys, types
from array import array
import pytest


class FakeTypedArray:
    def __init__(self, length: int) -> None:
        self.length = length
        self.got: array | None = None

    def assign(self, data: array) -> None:
        if len(data) != self.length:
            raise ValueError("cannot assign to TypedArray of length ...")  # mirrors the real error
        self.got = data


@pytest.fixture
def fake_js(monkeypatch: pytest.MonkeyPatch) -> types.ModuleType:
    mod = types.ModuleType("js")
    monkeypatch.setitem(sys.modules, "js", mod)
    monkeypatch.delitem(sys.modules, "scorched_web.bridge.render_sink", raising=False)
    return mod
```
Prefer injection: `create_game(options)` and `RenderSink` take JsProxy-like objects as arguments, so most adapter code never imports `js` at all; only a module that truly needs `js.console`/`js.performance` imports it, behind this fixture.

### Allocation-free tick test (guards GC jitter without disabling GC)

```python
import sys

def test_tick_does_not_grow_allocated_blocks(game) -> None:
    for _ in range(300):          # warm up pools and caches
        game.tick(16.667, 0b1, 0.0, 0.0, 0.0, 0.0)
    before = sys.getallocatedblocks()
    for _ in range(600):
        game.tick(16.667, 0b1, 0.0, 0.0, 0.0, 0.0)
    assert sys.getallocatedblocks() - before < 50
```
(`sys.getallocatedblocks` is CPython-specific and present in Pyodide; threshold to be tuned once on the real implementation.)

### SoA pack and assign (verified in Pyodide, Node and Chromium: 0.32-0.40 ms for 500 bullets incl. bounce, hit test, pack, assign)

```python
# Pool columns are array('f'); render buffer is array('f') of cap*stride, same length as the JS Float32Array.
def pack_into(self, out: "array", stride: int = 4) -> None:
    n = self.n
    out[0 : n * stride : stride] = self.x[:n]
    out[1 : n * stride : stride] = self.y[:n]
    # angle/kind columns likewise; the tail beyond n*stride is left stale and ignored via instanceCount
# then, once per tick that ran >=1 step:
sink.assign(out)     # full capacity, equal length by construction
```

### Camera fit sketch (design; the executor writes and unit-tests it)

```js
// camera_fit.js (pure given a camera factory): returns {distance, targetZ} for a viewport aspect
export function fitCamera({ fovDeg, tiltDeg, aspect, pad = 0.04, corners /* [[X,Z] x4] */, project }) {
  // 1. place camera on the tilt ray from target (0, 0, tz) at distance D
  // 2. binary-search the smallest D with every projected corner inside [-(1-pad), 1-pad]
  // 3. shift tz so the corner bbox is vertically centered in NDC
  // 4. return D, tz; renderer sets camera.position/lookAt accordingly on resize only
}
```

### Quality-controller sketch (pure; drive with synthetic dt arrays in vitest)
```js
// update(dtMs, nowMs) -> {tier, changed, locked}
// warmup 2 s after start/resume/tier-change; window = 90 dt; evaluate every 30 frames;
// median > 21.5 for 3 consecutive evaluations -> stepDown(); after the next window, if improvement < 10% -> stepUp() and lock.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PyScript/pygbag/MicroPython for browser Python | Plain Pyodide with the JS FFI | STACK.md decision | Fixed; do not revisit. |
| Pyodide 0.2x versions (Python 3.11-3.13) | Pyodide 314.x, Python-synchronized versioning (CPython 3.14.2, Emscripten 5.0.3) | 2026 | `latest` dist-tag is 314.0.7; `next` is 315.0.0-alpha.2 (ignore). Tested floor in the docs: Chrome 112, Firefox 112, Safari 16.4 [CITED: pyodide.org usage docs for 314.0.x]. |
| Vite 5-7 (esbuild/Rollup) | Vite 8 (Rolldown): `build.rolldownOptions`, new chunk-warning text | 2026 | Build worked unmodified; ignore the 500 kB chunk warning or raise `chunkSizeWarningLimit`. |
| `BufferAttribute.updateRange` | `addUpdateRange` / `clearUpdateRanges` | three r159+ | Use the new API (present in r186). |
| `THREE.Clock` | `performance.now()` / rAF timestamp | three r17x deprecation | Not needed here. |
| Node 18 | Node 24 LTS (Active), Node 22 maintenance | 2026 | Local Node 18.19.1 must be replaced. |

**Deprecated/outdated for this project:** `fullStdLib`, `convertNullToNone`, `toJsLiteralMap`, `pyproxyToStringRepr` loadPyodide options (deprecated per docs); `pyodide.asm.js` (404 at v314.0.7, the glue is `.mjs`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Resuming after auto-pause should require a tap/key on a "PAUSED" overlay rather than auto-resume. Success criterion 4 says "returning resumes it without a time jump", which an auto-resume would also satisfy. | Pattern 3 | If the user wants hands-free auto-resume, the overlay becomes a brief "resuming" state; small rework. |
| A2 | Tier ladder numbers (DPR caps 2/1.5/1, pixel budgets 2.8/1.2/0.6 M, bloom scales, 21.5 ms step-down threshold, 3 strikes, 10% verify gain) are reasonable starting values. | Pattern 8 | Tiers too aggressive or too lax; tuned from the first real-device reports. |
| A3 | Gameplay constants: hitbox radius 2.0 (marker 2.5), volley every 5 ticks, bullet speed 8 u/tick, drone radius 8/HP 3/0.9 u/tick, spawn every 40 ticks, scroll 0.8 u/tick, touch lag cap 40 units. | Pattern 7 | Feel tuning only; all are constants. |
| A4 | Real rAF timestamp jitter is large enough to make a plain accumulator stutter. The 49.5% figure comes from a synthetic 0.4 ms Gaussian jitter model; Chrome's vsync-aligned timestamps may be cleaner, Android/Firefox noisier. | Pattern 3 | Snapping is cheap insurance either way; if jitter is negligible it is merely redundant. |
| A5 | An extra URL flag `?crash=py\|js` is acceptable beyond the three flags in D-15, solely to satisfy success criterion 5. | Pattern 10 | If not, use a debug-only keypress instead. |
| A6 | Safari/iOS accepts a constructed `Response` (copied headers incl. `application/wasm`, counted stream) for streaming WASM compile. Verified only in Chromium. Emscripten falls back to non-streaming instantiation if streaming fails, but then progress would still count (the fetch still passes through the wrapper). | Pattern 1 | Worst case: no streaming compile on iOS, slower boot; if the wrapper throws on Safari, fall back to an indeterminate bar. Check at the first iPhone run. |
| A7 | A strict CSP via `<meta>` would likely need `'wasm-unsafe-eval'` and possibly `'unsafe-eval'` for Pyodide; untested. | Security Domain | Do not ship a CSP in Phase 1 without testing it. |
| A8 | GitHub Pages also gzips `.js`/`.json` assets (verified for HTML only). | Pitfall 12 | Bundle ~145 kB gzip vs ~565 kB raw would hit mobile load time if not compressed. Check in the Network tab on the first deploy. |
| A9 | GitHub Pages for a private repository requires a paid plan. | Pattern 11 | Repo must be public (or plan upgraded) before Pages works. |
| A10 | Phone Python cost is 3-5x desktop (STACK.md extrapolation, never measured). | Summary | If worse, the 0.4 ms figure grows toward budget; the report will show it. |
| A11 | iOS Low Power Mode caps Safari at ~30 fps; iOS Safari has no GPU timer queries. | Pitfall 7, Pattern 8 | Controller design still holds; only the explanation changes. |
| A12 | Half-float render targets for bloom work on mid-range Android and recent iPhone (three's `UnrealBloomPass` uses `HalfFloatType` unconditionally). | Pattern 8 | A phone without the extension would fail the bloom tiers; fall back to the no-bloom tier and log it in the report. |
| A13 | Pointer-event and viewport behaviors on iOS/Android (`touch-action: none`, `100dvh`, `visualViewport`, `pagehide`) work as described in PITFALLS 14/18/19 (community and training knowledge, not re-verified here). | Patterns 4, 7 | UI glitches on a specific phone; caught at the device checkpoint. |

## Open Questions

1. **How will the user's devices be reached?**
   - Known: the discuss step skipped devices; PR previews give a QR code and any link carries `?debug&stress=500`.
   - Unclear: which Android and iPhone models exist, and whether the user has a "mid-range desktop" separate from the WSL2 box (headless GL here is SwiftShader, which proves nothing about speed).
   - Recommendation: the checkpoint text asks for model names, the copied report, and the two forced-tier runs; do not block earlier work on this.

2. **If the phone gate fails, which lever first?**
   - Known: Python tick is ~0.4 ms desktop-class, so a failure is far more likely fill rate or bloom than Python.
   - Unclear: nothing is measured on phones.
   - Recommendation: the report's tick vs frame numbers decide: GPU-bound -> lower tier/bloom (already in), additive glow sprites in Phase 2; tick-bound -> lower bullet caps, then numpy, then a Worker (not before measurement). Record the chosen follow-up in the phase summary.

3. **Do the main deploy and PR preview jobs ever collide on `gh-pages`?**
   - Known: JamesIves rebases with retries and recommends `concurrency`; the preview action recommends a per-ref group; the two live in different workflows.
   - Unclear: observed behavior under simultaneous pushes (not testable before the repo exists).
   - Recommendation: keep the settings in Pattern 11, include the first PR preview plus a subsequent main push in the human checkpoint, re-run on a transient failure.

4. **Include the optional Playwright smoke test in CI?**
   - Known: headless Chromium with SwiftShader ran Pyodide + three + bloom in this session; the Playwright package needs Node >= 20 (failed on 18).
   - Unclear: CI flakiness against the real jsDelivr CDN.
   - Recommendation: add it as a separate, initially non-blocking job (`npx playwright install --with-deps chromium`); it proves load, tick advancement and the `?crash=py` panel on every PR. Drop it if it flakes.

5. **Pyodide boot cost on phones and whether snapshots/pyc are needed.**
   - Known: desktop `loadPyodide` ~1.7 s, 80-module source import ~115 ms.
   - Unclear: phone numbers.
   - Recommendation: report time-to-gate in the debug report; revisit only if it misses ~6 s on a phone on 4G (PITFALLS 6 budget).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js >= 20.19 / 22.12 | Vite 8, Playwright, Node harness | ✗ (system Node is 18.19.1) | 18.19.1 installed; 24.22.0 tarball extracted and used successfully in the scratchpad | Install Node 24 LTS via fnm/nvm/tarball in a Wave 0 task (needs the user's OK to install a version manager, or use a tarball under `~/.local`). |
| npm | package install | ✓ (9.2.0 with Node 18) | 9.2.0 | npm 11 arrives with Node 24. |
| uv | Python toolchain | ✓ | 0.13.0 | — |
| Python 3.14 | pytest/ruff | ✓ via uv | 3.14.6 (uv-managed), system 3.12.3 | `uv python install 3.14` |
| git | VCS | ✓ | — | — |
| git remote / GitHub repo | Deploy, previews | ✗ (`git remote -v` empty) | — | Human checkpoint (D-05). Not blocking local work. |
| `gh` CLI | optional repo automation | ✗ | — | Not needed; the user configures via the GitHub web UI. |
| `.gitignore` | repo hygiene | ✗ (none exists; `.planning/research/.cache/` is untracked) | — | Create in Wave 0 (see Project Structure). |
| Headless Chromium (Playwright) | optional e2e | ✓ | chromium_headless_shell-1248 cached; Playwright 1.64.1 launches Chrome 156 headless | `npx playwright install chromium` |
| Hardware WebGL | performance judgments | ✗ (WSL2 uses SwiftShader software GL) | — | Real devices only (CONTEXT: numbers from WSL do not count). |
| Real phones (mid-range Android, recent iPhone) | go/no-go gate | unknown | — | Human checkpoint; cannot be automated. |
| Network to jsDelivr, npm, PyPI, GitHub API | build, run | ✓ | — | — |

**Missing dependencies with no fallback:** GitHub repo + Pages (user action, D-05) and real phones (user action). Node >= 20.19 must be installed before any Vite work.
**Missing dependencies with fallback:** Node (install), `gh` (not needed).

*Validation Architecture section omitted: `workflow.nyquist_validation` is `false` in `.planning/config.json`.*

## Security Domain

`security_enforcement` is enabled (ASVS level 1, block on high).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No accounts or backend. |
| V3 Session Management | no | None. |
| V4 Access Control | no | None; static site. |
| V5 Input Validation | yes | URL flags parsed with `URLSearchParams`: `stress` parsed as an integer and clamped to [1, 5000], `tier` checked against an allow-list (`low\|mid\|high`), `crash` against an allow-list, everything else ignored. Error and traceback text inserted with `textContent`, never `innerHTML`. |
| V6 Cryptography | no | None. (SHA pins on actions are integrity, not app crypto.) |
| V10 Malicious Code / V14 Config (supply chain) | yes | Exact version pins, committed lockfiles, `npm ci` / `uv sync --locked`, third-party actions pinned to commit SHAs, no install scripts in any dependency (verified), least-privilege workflow `permissions`. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Compromised CDN serves altered Pyodide wasm/JS (D-02 trust decision) | Tampering | Exact version path on jsDelivr (immutable once published), `checkAPIVersion`; residual risk accepted for a friends-only game. SRI cannot be applied to the runtime's internal fetches. Phase 4 self-hosting removes it. |
| Reflected content from query string or error text into the DOM | Tampering / XSS | Allow-list parsing, `textContent` only, no `innerHTML` of anything derived from URL or exceptions. |
| Malicious PR from a fork obtaining a write token or deploying a preview | Elevation of privilege | `pull_request` (never `pull_request_target`), fork guard `head.repo.full_name == github.repository`, `contents: write` only on the deploy/preview jobs, read-only default. |
| Compromised third-party Action | Tampering | Full-SHA pins (done above), review changes when bumping. |
| Secrets in the repo | Information disclosure | None are needed; `GITHUB_TOKEN` only. Add `.gitignore` entries for `.env*`. |
| Strict CSP breaking Pyodide | Denial of service (self-inflicted) | Do not add a CSP in Phase 1 (A7). |

## Planning Notes (non-binding sequencing hints)

- **Wave 0 (blocking foundations):** Node 24 install; `.gitignore`; `pyproject.toml`/`uv.lock`; `package.json` with exact pins + `package-lock.json`; Vite config (`base: './'`, `build.target: "es2022"`); `public/.nojekyll`; conventions test; dependency-manifest `checkpoint:human-verify`; human checkpoint for GitHub repo/Pages/Actions permissions (exact steps in Pattern 11, ordered: repo -> Actions read/write permission -> first main deploy creates `gh-pages` -> set Pages source to branch `gh-pages` `/ (root)`).
- **Independent tracks after that:** (A) pure Python core with tests at 100%: clock+snapping, input frame, ship movement (keyboard + touch catch-up + wall rule), pools, twin shot, drones/spawner, collision, stress storm, terrain scroll, `Game` facade + `manifest` + `FaultMode`, `scorched_web` adapter with fakes; (B) JS platform: error panel, URL flags, loading screen + progress loader, start gate, loop + pause controller, input modules, `python_bridge`; (C) renderer: camera fit + mask, terrain ring, ship/drone models, bullet instancing, bloom + tiers + controller, overlay + report.
- **Integration:** wire A+B+C into the playable slice and stress mode, then CI workflows, then first deploy and PR preview, then the **device checkpoint** (links with `?debug&stress=500`, forced tiers, 5-minute soak, paste the report) and the go/no-go write-up. The success criteria 1-5 map to: 1 deploy+devices, 2 control+terrain slice, 3 stress+tiers+overlay, 4 clock+pause tests and device check, 5 `?crash=py|js` plus the pytest gate.
- Optional Node harness: adapt the earlier benchmark scripts (they existed at `/tmp/claude-1000/-home-renaud-scorched/17d8c4cc-15f7-48eb-a508-364f50dc76ad/scratchpad/bench_pyodide.mjs` and may be gone) into `tools/perf_node.mjs` that loads the real package and prints tick ms for N bullets; use `new Uint8Array(...)` for any binary input.

## Sources

### Primary (HIGH confidence)
- Local experiments this session (scratchpad `probe/`, `vite-probe/`, `pw/`, `pyproj/`): Pyodide 314.0.7 on Node 18 and in headless Chromium 156; Vite 8.3.4 build and dev on Node 24.22.0; three 0.186.1 composer + bloom + instanced shader; `JsBuffer.assign`, `PythonError` traceback, `toJs`/`to_py` behavior; pyproject toolchain on Python 3.14.6; clock jitter simulation. [VERIFIED: local]
- jsDelivr `https://cdn.jsdelivr.net/pyodide/v314.0.7/full/` headers and decoded sizes via `curl`. [VERIFIED]
- https://pyodide.org/en/stable/usage/api/js-api.html: `loadPyodide` options, `unpackArchive`, `pyimport`, `FS`, `PythonError`. [CITED]
- https://pyodide.org/en/stable/usage/type-conversions.html: `assign`/`assign_to` constraints, proxies. [CITED]
- three@0.186.1 tarball source (`UnrealBloomPass.js`, `EffectComposer.js`, `OutputPass.js`, `BufferAttribute.js`, `InstancedBufferGeometry.js`, `WebGLRenderer.js`). [VERIFIED: file reads]
- npm registry (`npm view`), PyPI JSON API, GitHub REST API (releases, tag SHAs, repo metadata). [VERIFIED]
- https://github.com/rossjrw/pr-preview-action (usage, permissions, Pages source requirement, fork limitation, `clean-exclude` interplay). [CITED]
- https://github.com/JamesIves/github-pages-deploy-action (`clean-exclude`, `force`, `attempt-limit`, concurrency advice, permissions). [CITED]
- `/home/renaud/scorched/.planning/{REQUIREMENTS,STATE,ROADMAP}.md`, `phases/01-.../01-CONTEXT.md`, `.claude/CLAUDE.md`, and `research/{STACK,ARCHITECTURE,PITFALLS,FEATURES,SUMMARY}.md` (read this session). [VERIFIED]

### Secondary (MEDIUM confidence)
- Pyodide 314.0.x docs "Using Pyodide": tested browser floor Chrome 112 / Firefox 112 / Safari 16.4 (via search summary). [CITED]
- `emscripten.org` (served by GitHub Pages) response headers as a proxy for Pages behavior. [VERIFIED for that host]

### Tertiary (LOW confidence)
- iOS/Android viewport, pointer-event and Low Power Mode behavior (training knowledge and PITFALLS.md; see A11, A13).
- Mobile CPU multiplier for Pyodide (STACK.md extrapolation; A10).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. Versions queried live; whole chain built and run in a real (headless) browser.
- Architecture/boundary: HIGH for mechanics (assign, tick, bundling, progress, instancing). MEDIUM for camera fit and tier tuning (numbers are starting points).
- Deploy pipeline: MEDIUM. Actions and docs verified, but nothing can be run until the user creates the repo; the gh-pages race is an open question.
- Pitfalls: MEDIUM-HIGH. Items marked VERIFIED were reproduced; mobile items are inherited from PITFALLS.md.
- Real-device performance: LOW by construction; this phase produces the data.

**Research date:** 2026-10-17
**Valid until:** 2026-10-24 for version pins (three, vite, vitest, Playwright, actions move weekly); 30 days for the architecture findings.
