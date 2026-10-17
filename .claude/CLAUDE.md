<!-- GSD:project-start source:PROJECT.md -->

## Project

**Scorched**

Scorched is an old-school vertical shoot-'em-up in the spirit of 90s arcade shmups (Raiden, Strikers 1945), written in Python and playable directly in a web browser with no server. Gameplay is classic 2D on a single plane, but everything is rendered in 3D — modern, polished visuals (lighting, bloom, particles, big explosions) seen through a tilted top-down camera. Military / scorched-earth theme: jets, tanks and gun emplacements over burning cities and deserts. Built for the author and friends, shared via a link.

**Core Value:** Shooting feels great: tight, responsive ship control and satisfying, punchy 3D feedback (hits, explosions, screen shake) at a smooth framerate in the browser. If everything else is cut, the moment-to-moment shooting must feel like a real 90s arcade shmup.

### Constraints

- **Language**: Game logic in Python — explicit user requirement
- **Platform**: Runs in the browser from static hosting, no backend — easy to share as a link
- **Assets**: 3D models generated in code — no external modeling pipeline
- **Input**: Keyboard (desktop) and touch (mobile) both required
- **Performance**: Must remain responsive on mobile browsers — shmups are unplayable with frame drops or input lag
- **Code style**: Clean, modern Python (3.14 idioms, type hints throughout, dataclasses/`__slots__`, enums, pattern matching where it helps; ruff for format and lint) — user requirement
- **Code organization**: One class per file; files organized in consistent, domain-based subdirectories (e.g. `entities/`, `weapons/`, `stages/`, `collision/`) mirrored by the test tree — user requirement
- **Testing**: pytest for all Python code, with 100% coverage (line + branch) enforced via `pytest-cov --cov-fail-under=100`; the Pyodide adapter layer is tested against a fake `js` module so coverage can be measured natively — user requirement

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Verdict (one paragraph)

## Recommended Stack

### Core Technologies

| Technology | Version (verified) | Purpose | Why Recommended |
|------------|--------------------|---------|-----------------|
| Pyodide | 314.0.7 (npm + jsDelivr, released 2026-09-14) | CPython 3.14.2 in WASM; runs 100% of game logic | Only candidate that is simultaneously mature, actively released (7 releases since June 2026), and has a first-class `js` FFI to talk to three.js. Fastest Python-in-browser option measured (see Performance). Ships numpy 2.4.6, pytest 9.0.2 as prebuilt wheels. |
| three.js | 0.186.1 (r186, npm 2026-09-24) | WebGL2 renderer, InstancedMesh, lights, `EffectComposer` + `UnrealBloomPass`, procedural geometry | Largest ecosystem; every needed feature ships in-box (verified in the r186 tarball: `examples/jsm/postprocessing/{EffectComposer,UnrealBloomPass,OutputPass,SMAAPass}.js`). Small core vs Babylon. Procedural models via `BufferGeometry`/`ExtrudeGeometry`/`LatheGeometry` need no asset pipeline. |
| WebGLRenderer (WebGL2 backend) | in three r186 | Rendering backend | Works everywhere today (Firefox, all iOS, all Android). WebGPU is NOT universal: caniuse shows Firefox disabled by default through v161, Safari/iOS only from 26, ~88% global. A 60fps shmup needs no compute shaders. |
| Vite | 8.3.4 | Dev server (HMR for JS), production build to static `dist/` | Zero-config static output for GitHub Pages / itch.io zip. **Requires Node `^20.19.0 \|\| >=22.12.0`** (verified from registry); this machine has Node 18.19.1, so install Node 22 LTS first. |
| CPython (dev/test only) | 3.14.x via `uv` | Run pytest on game core natively | Must match Pyodide's 3.14.2 so tests exercise the same language semantics. `uv` is already installed at `~/.local/bin/uv`. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| numpy (Pyodide wheel) | 2.4.6 (2.9 MB br, ~0.7 s extra load measured) | Vectorized bullet/particle/collision math | **Only if** pure-Python loops exceed budget (see Performance). Do not load by default; adds ~2.9 MB. |
| zzfx | 1.4.0 (MIT, <1 KB gz) | Procedural SFX (explosions, shots, pickups) synthesized to WebAudio `AudioBuffer` | Default SFX generator. Python sends integer sound IDs; JS plays. Precache buffers at load. |
| ZzFXM (tracker music) or hand-rolled WebAudio step sequencer | latest at implementation time (not version-verified) | Procedural music | Music phase. Keep in JS; Python just emits "change track / intensity" events. |
| jsfxr | 1.4.1 (50 KB) | Alternative SFX synth with preset generator UI | Only if you want sfxr-style preset editing; ZzFX is smaller and sufficient. |
| `@types/three` | 0.186.0 | Editor autocomplete for JS | Optional; skip if writing plain JS. |
| pytest | 9.1.1 (PyPI; 9.0.2 inside Pyodide) | Headless tests of Python core | From phase 1. |
| `coi-serviceworker` / `mini-coi` | not version-verified | Add COOP/COEP headers on hosts that can't | **Only** if you later move Python into a Web Worker with SharedArrayBuffer (not in v1). |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Node 22 LTS (via fnm/nvm) | Run Vite 8 and the Pyodide-in-Node CI harness | Local Node 18.19.1 is too old for Vite 8. |
| `uv` + Python 3.14 | `uv venv --python 3.14`, `uv pip install pytest` | Same minor version as Pyodide. |
| Pyodide npm package in Node | Headless *WASM* test/perf runs of the real game core | Verified working: `pyodide@314.0.7` loads on Node 18+ (cold `loadPyodide` 1.8 s, +0.75 s for numpy). Use as CI perf gate (see Testing). |
| Chrome DevTools remote debugging + Safari Web Inspector | Mobile profiling | Needed because mobile perf is unmeasured; plan a real-device test early. |

## Architecture of the Python/JS boundary (this is the stack's core decision)

### Performance budget (measured, Pyodide 314.0.7 on Node v18.19.1/V8, desktop WSL2; single runs)

| Workload | Native CPython 3.12 | Pyodide 3.14 | MicroPython wasm 1.29 |
|----------|--------------------|--------------|-----------------------|
| Update 600 bullets (pure Python lists) | 0.063 ms | **0.174 ms** | 1.58 ms |
| Collision 600 bullets x 80 enemies, naive O(n*m) | 2.74 ms | **8.22 ms** (unusable) | 91.2 ms |
| Same, uniform-grid broadphase | 0.80 ms | **1.87 ms** | n/m |
| Write 1000 instances x 4 floats into `array('f')` | 0.20 ms | **0.61 ms** | 2.62 ms |
| numpy: update + pack 3000 particles | n/a locally | **0.094 ms** | not available |
| Cold start (node, local files) | n/a | **1.8 s** (+0.75 s numpy) | **34 ms** |
- Pyodide runs ~2.3-3x slower than native CPython. A Raiden-class game (<=~300-500 live bullets, <=~60 enemies, grid broadphase) uses roughly **1-3 ms/frame on desktop**. Comfortable.
- **Naive all-pairs collision is forbidden**; mandate a uniform grid (or sort-and-sweep) from the first collision commit.
- Mobile CPUs are commonly several times slower than desktop V8 for WASM loops. This is an *assumption*, not measured. Set a Python budget of **<=3 ms/frame on desktop** so a 3-5x phone slowdown still fits in 16.6 ms; enforce it in CI (Testing section).
- numpy is ~20x faster per element for bulk updates, so it is the first escalation if Python loops get hot, at a cost of 2.9 MB and ~0.75 s load.

### Loading/size (measured from jsDelivr `v314.0.7/full/`)

| File | Raw | Brotli | Notes |
|------|-----|--------|-------|
| `pyodide.asm.wasm` | 9.6 MB | **3.4 MB** | gzip: 3.6 MB |
| `python_stdlib.zip` | 2.5 MB | 2.5 MB | already compressed |
| `pyodide.mjs` | 18 KB | | |
| numpy wheel (optional) | 2.96 MB | 2.93 MB | |
| three.js (tree-shaken app bundle + bloom addons) | n/m | est. ~150-250 KB gz | not measured; `three.module.js` core is the bulk |
| Game Python + zzfx | | < 100 KB | |

## Installation

# One-time machine setup (local Node is 18.19.1; Vite 8 needs >=20.19 / >=22.12)

# Web app

# optional

## Candidate Evaluation (all requested candidates)

| # | Candidate | Verdict | Evidence |
|---|-----------|---------|----------|
| 1 | **Pyodide + three.js (`js` FFI)** | **RECOMMENDED** | Active (314.0.0 June 2026 -> 314.0.7 Sept 2026), FFI speedups landed in 314.0.1, three r186 ships InstancedMesh + EffectComposer + UnrealBloomPass. Measured hot-path numbers above. |
| 2 | Pyodide + Babylon.js | **FALLBACK** | Babylon 9.0 (March 2026) is current (9.31.0 on npm), has clustered lighting, volumetric lighting, WebGPU work. Same Python layer works unchanged. Costs: far larger package (71 MB unpacked on npm vs 20 MB for three; tree-shaken size not measured), smaller community for code-built meshes. Bloom/glow APIs (`DefaultRenderingPipeline`, `GlowLayer`, thin instances) are from my background knowledge and were **not re-verified** this session. Switch only if three's bloom cannot hit mobile budget. |
| 3 | PyScript (Pyodide or MicroPython) + three.js | **REJECT** | PyScript (`@pyscript/core` 0.7.31, release channel 2026.7.3) is a loader/config wrapper over the same runtimes. It adds a tag-based init layer, but no rendering/perf benefit and less control over boot and proxies. Its workers need COOP/COEP headers (docs point to `mini-coi`). Use raw Pyodide. |
| 4 | pygbag (pygame-ce WASM) | **REJECT** | pygbag 0.9.3 (Feb 2026) packages pygame-ce on its *own* CPython-WASM SDK, not Pyodide ("Pyodide wheels aren't compatible out of the box"). Output is SDL2 canvas; docs mention `--template noctx.tmpl` for 3D/WebGL but I found **no evidence** of moderngl or any scene-graph/bloom path in the browser. You would hand-write a GLES renderer from Python; every GL call crosses the WASM/JS boundary. Mobile Safari needs workarounds (`--ume_block 0`, delayed audio). |
| 5 | Panda3D WASM / Ursina | **REJECT** | No official browser build. Community threads: pygbag route worked for simple samples (mid-2025); an Oct 2025 report shows it failing (`WebAssembly.Compile is disallowed on the main thread` for >8 MB module; `.so` ImportError). Panda3D 1.10.16 on PyPI is desktop-only. Ursina is a Panda3D wrapper, so inherits the problem. |
| 6 | Harfang3D WASM | **REJECT** | `harfang` 3.2.7 on PyPI is desktop. The only browser lead is a third-party "harfang-wasm" port described as in progress; its GitHub URL 404'd and I found no demo or release. Treat as non-existent (LOW confidence; absence of evidence). |
| 7 | MicroPython-in-WASM | **REJECT for the sim; ok for nothing here** | Real advantages verified: 450 KB wasm (~200 KB gz), 34 ms boot, same `js` module style. But measured **4-11x slower than Pyodide** on the game loop (naive collide 91 ms vs 8 ms), no numpy in the standard build, narrower stdlib (also breaks "same code under pytest" for dataclasses/typing-heavy code). Startup savings (~2 s) do not offset loop cost. |
| 8 | Any other Python 3D engine with browser target | None found | Searches surfaced no maintained alternative. |

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| three.js `WebGLRenderer` + `EffectComposer`/`UnrealBloomPass` | three.js `WebGPURenderer` + TSL `PostProcessing`/`BloomNode` (both present in r186; falls back to a WebGL2 backend; `forceWebGL` option) | After v1, as an opt-in quality tier if you want WebGPU on Chrome/Safari 26+. Not default: init is async (black canvas pitfall with custom rAF; use `setAnimationLoop`), `EffectComposer` is WebGL-only, Firefox lacks WebGPU. three's direction is toward WebGPURenderer, so re-check before upgrading past r186. |
| `UnrealBloomPass` | Fake glow: additive emissive sprites/particles + cheap vignette/tone-map only; Babylon `GlowLayer` | If bloom costs too much on phones. Make bloom a settings tier (off / half-res / full) from day one. |
| Pyodide on main thread | Pyodide in a Web Worker (+OffscreenCanvas or message-passed buffers) | Only if main-thread Python step spikes cause dropped frames on phones. Needs SharedArrayBuffer -> COOP/COEP (impossible on GitHub Pages without `coi-serviceworker`/`mini-coi`; itch.io has a SAB toggle, per one portal guide, unverified). |
| zzfx (JS synthesis, events from Python) | Python-generated PCM via numpy -> `AudioBuffer` | Never for runtime; costs FFI + numpy. Fine for an offline asset-bake script if a sound must be Python-authored. |
| Vite | No bundler (ES modules + import map from CDN) | If you want zero toolchain; loses dev-server HMR and minification. Viable for a tiny project. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Per-entity FFI (`mesh.position.set(...)` from Python for each bullet/enemy) | 3.8 µs/call measured; also creates JsProxy churn. 1000 bullets = 3.8 ms/frame | Bulk float32 buffer + `InstancedMesh` + one `assign()` per frame |
| `pyodide.runPython("...")` inside the frame loop | Recompiles source every call | Fetch `step` proxy once at init |
| Python-side particle simulation | Thousands of particles x per-frame Python | GPU vertex-shader particles driven by spawn events |
| Naive O(n*m) collision | 8.2 ms for 600x80 in Pyodide | Uniform grid broadphase from the start |
| Holding `getBuffer().data` across frames without checks | Detached on WASM memory growth (verified: length -> 0) | `assign()` copy, or re-acquire on `byteLength===0` |
| Allocating in the frame loop (new lists/tuples/dicts per bullet) | GC pauses = visible stutter in a main-thread loop | Struct-of-arrays, preallocated pools, free-list reuse |
| pygbag / Panda3D / Ursina / Harfang3D | See Candidate Evaluation | Pyodide + three.js |
| MicroPython for the sim | ~10x slower loop | Pyodide |
| PyScript tags | Extra indirection, no benefit | Raw `loadPyodide` |
| Tone.js | 5.4 MB unpacked, overkill for SFX/chiptune | zzfx / small WebAudio sequencer |
| `^`-ranged versions of three/pyodide | Breaking changes between minors (Pyodide 314.0.0 bumped Emscripten 5.0.3 ABI; three removes APIs each release) | Exact pins, upgrade deliberately |
| Loading numpy "just in case" | +2.9 MB, +0.75 s | Add only when a measured loop needs it |

## Stack Patterns by Variant

- WebGL2, DPR up to 2, full-res bloom (5-mip `UnrealBloomPass` at strength ~0.8-1.5, threshold high so only emissive pixels glow), `OutputPass` for tone-mapping/sRGB. Tone mapping must be enabled on the renderer for `UnrealBloomPass` (stated in the docs).
- DPR capped at 1.5, bloom at half resolution (or additive-sprite fake glow), shadows off, fewer particles, same Python sim. Touch input = relative drag (`pointerdown/move`), auto-fire, on-screen bomb button. Use `pointer` events with `touch-action: none`; `visibilitychange` -> auto-pause.
- `AudioContext` must be created/resumed inside a user gesture (iOS/Chrome autoplay policy), so use a title-screen "tap/press to start" which doubles as the load gate. Python pushes integer sfx IDs into an `Int32` event ring; JS maps ID -> pre-rendered `zzfx` `AudioBuffer` and plays via `AudioBufferSourceNode`. Voice-limit and per-ID cooldown to avoid 50 simultaneous explosion sounds. (WebAudio/autoplay behavior: MEDIUM, standard platform behavior, not re-verified this session.)

## Dev workflow, testing, deployment

- GitHub Pages: static `dist/`; fine because Pyodide needs no special headers on the main thread. Use relative base (`vite build --base=./`).
- itch.io: zip `dist/` with `index.html` at root. Limits reported by forum posts (unconfirmed, official page returned 403): 500 MB total, ~1000 files max, ~200 MB per file. Our payload is a handful of files. Pyodide from CDN keeps the zip tiny. Test the itch iframe on a real phone (fullscreen button, audio unlock, touch).
- Persistence: `localStorage` for high scores via `js.localStorage` in the adapter (cheap, no server).

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| pyodide@314.0.7 | CPython 3.14.2, Emscripten 5.0.3, numpy 2.4.6, pytest 9.0.2 (lock file) | Wheel ABI tag `pyemscripten_2026_0_wasm32`; 314.x is a new versioning scheme (older 0.29.x line also still maintained). |
| local CPython 3.14.x | pyodide 314.0.7 | Same minor => same language semantics for tests. Local default here is 3.12.3; install 3.14 via `uv`. |
| three@0.186.1 | `three/addons/postprocessing/{EffectComposer,RenderPass,UnrealBloomPass,OutputPass}.js` | `UnrealBloomPass(resolution, strength, radius, threshold)`; requires renderer tone mapping enabled. |
| vite@8.3.4 | Node `^20.19 \|\| >=22.12` | Current Node 18.19.1 will not work. |
| pyodide npm in Node | Node >=18 | Used for CI/perf harness only. |
| @pyscript/core@0.7.31 | Node >=20 | Not used. |

## Confidence by claim

| Claim | Confidence | Basis |
|-------|------------|-------|
| Current versions (Pyodide, three, Vite, Babylon, zzfx, jsfxr, pygbag, harfang, pytest) | HIGH | npm / PyPI registries queried live 2026-10-17; Pyodide changelog |
| Pyodide file sizes | HIGH | Measured via HTTP from jsDelivr |
| FFI cost, zero-copy detachment, Pyodide vs MicroPython speed | MEDIUM | My own benchmarks; single machine (WSL2, Node 18/V8), single run each; browser V8/JSC differ; `getBuffer` hazard is also consistent with Pyodide docs' "requires care" warning |
| Mobile performance of any of this | LOW | Not measured; extrapolation only |
| three r186 has both bloom paths; WebGPURenderer falls back to WebGL2 | HIGH | Inspected npm tarball + three docs |
| WebGPU browser support numbers | MEDIUM | caniuse fetch, summarized by the fetch tool |
| Panda3D/Harfang/pygbag rejection | MEDIUM | Official repo/PyPI facts + forum reports; absence of evidence for harfang-wasm and pygbag+3D is LOW-confidence negative evidence |
| Babylon bloom/GlowLayer/thin-instance details | LOW-MEDIUM | Background knowledge only; not re-verified |
| itch.io limits | LOW | Forum posts; official page 403 |
| Brotli/compression on GH Pages / itch.io | LOW | Not tested |

## Gaps to Address (flag for phase research)

## Sources

- npm registry (live queries 2026-10-17): `pyodide` 314.0.7, `three` 0.186.1, `vite` 8.3.4 (engines), `@babylonjs/core` 9.31.0, `@pyscript/core` 0.7.31, `zzfx` 1.4.0, `jsfxr` 1.4.1, `tone` 15.1.22, `@micropython/micropython-webassembly-pyscript` 1.29.0-6 (HIGH)
- PyPI JSON API: pygame-ce 2.5.8, pygbag 0.9.3, panda3d 1.10.16, harfang 3.2.7, pytest 9.1.1, numpy 2.5.4 (HIGH)
- https://pyodide.org/en/stable/project/changelog.html (314.x changes: FFI speedups, Emscripten 5.0.3, Python 3.14.2) (HIGH)
- https://pyodide.org/en/stable/usage/type-conversions.html (getBuffer / to_js / create_proxy) (HIGH)
- https://pyodide.org/en/stable/usage/downloading-and-deploying.html (required files, hosting) (HIGH)
- https://cdn.jsdelivr.net/pyodide/v314.0.7/full/ (sizes/headers measured first-hand) (HIGH)
- three@0.186.1 npm tarball contents (postprocessing + WebGPU/TSL files); https://threejs.org/docs/pages/UnrealBloomPass.html; https://threejs.org/docs/pages/WebGPURenderer.html; https://github.com/mrdoob/three.js/releases (r186, 24 Sep) (HIGH)
- https://caniuse.com/webgpu (MEDIUM)
- https://github.com/micropython/micropython/tree/master/ports/webassembly (MEDIUM); first-hand benchmark of the npm wasm build (MEDIUM)
- https://github.com/pmp-p/pygbag; https://pypi.org/project/pygbag/ (MEDIUM)
- https://discourse.panda3d.org/t/building-for-web/31131 (MEDIUM, community)
- https://docs.pyscript.net/2026.7.3/user-guide/workers/ (HIGH for header requirement)
- https://github.com/KilledByAPixel/ZzFX (HIGH for API/size)
- Windows Developer Blog "Announcing Babylon.js 9.0" (2026-03-26) via search (MEDIUM)
- WebKit bug 222097 (WASM memory growth on iOS) (LOW-MEDIUM, 2024 report)
- Benchmarks: `/tmp/claude-1000/-home-renaud-scorched/17d8c4cc-15f7-48eb-a508-364f50dc76ad/scratchpad/{bench_game.py,bench_pyodide.mjs,bench_mpy.mjs}` (reusable as the starting point for `tools/perf_node.mjs`)

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

## Coding Standards (user-mandated — hard constraints)

- **Clean, modern Python:** Python 3.14 idioms, type hints on everything, dataclasses / `__slots__`, enums, `match` where it clarifies. Format and lint with `ruff`; code must pass `ruff check` and `ruff format --check`.
- **One class per file.** The file is named after the class in snake_case (`PlayerShip` → `player_ship.py`).
- **Consistent subdirectories:** organize by domain (e.g. `entities/`, `weapons/`, `stages/`, `collision/`, `scoring/`, `bridge/`). The test tree mirrors the source tree (`tests/<same path>/test_<module>.py`).
- **pytest, 100% coverage:** all Python code is tested with pytest at 100% line + branch coverage, enforced with `pytest --cov --cov-branch --cov-fail-under=100`. A task is not done until the gate passes. The Pyodide adapter is tested against a fake `js` module so it is measured natively. Avoid `# pragma: no cover` except for genuinely unreachable code, and justify each one.
- **Tooling — uv + Makefile:** Python environments and dependencies are managed only with Astral `uv` (`uv sync`, `uv run …`, committed `uv.lock`; never pip/venv directly). Every developer and CI action is exposed as a target in a root `Makefile` (e.g. `install`, `lint`, `format`, `test`, `build`, `preview`, `e2e`, `perf`, `check` for the full gate, `clean`); CI workflows and docs invoke `make <target>` rather than raw commands. When a plan adds a new command, add a matching Makefile target. — user requirement

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-fast` for a trivial task inline, with no subagents and no PLAN.md
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
