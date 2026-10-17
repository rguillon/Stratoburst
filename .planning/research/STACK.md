# Stack Research

**Domain:** Browser-based 3D-rendered vertical shmup, game logic in Python (Python-in-WASM), fully client-side, static hosting, desktop 60fps + mobile touch
**Researched:** 2026-10-17
**Confidence:** MEDIUM-HIGH (versions, sizes, desktop timings verified first-hand; mobile performance NOT measured, see Gaps)

## Verdict (one paragraph)

**Pyodide 314.0.7 (CPython 3.14.2 in WASM) owns all game state and logic; three.js r186 (0.186.1) on `WebGLRenderer` (WebGL2) renders it; JavaScript owns only the `requestAnimationFrame` loop, input capture, rendering, and audio playback.** Python and JS meet through a *single* `step(dt, input)` call per frame plus a few bulk buffer copies, never per-object FFI calls. Fallback if three.js post-processing/bundle proves unworkable: same Pyodide layer with Babylon.js 9.31.0 as renderer. Every other candidate (pygbag, Panda3D, Ursina, Harfang3D, MicroPython, PyScript) is rejected below with evidence.

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

```
JS (main thread)                      Python (Pyodide, main thread)
-----------------                     ------------------------------
rAF loop  ──── step(dt, ax, ay, fire, bomb) ───►  fixed-timestep sim (1/60)
 (calls a PyProxy fetched ONCE)                    owns: player, enemies, bullets, waves,
                                                          score, weapons, bosses, RNG seed
          ◄── bulk buffers (float32) ───────────  writes instance data into preallocated
 InstancedMesh.instanceMatrix / attributes         array.array('f') / numpy float32
          ◄── small event ring (int32) ─────────  sfx ids, explosion spawns, shake, music cue
 audio + GPU particles consume events
```

Rules (each is backed by a measurement below):
1. **JS drives the loop.** `rAF` in JS calls one pre-fetched Python function (`py.globals.get("step")`). Measured cost of a JS-to-Python proxy call: **1.3 µs**. Never call `runPython("...")` per frame (compiles source each call; one 2026 project measured ~1.2 ms vs 0.02 ms for a pre-fetched proxy; secondary evidence).
2. **Scalar args in, buffers out.** Input as 4-5 numbers/bits. Output as typed-array copies.
3. **One bulk copy per buffer per frame** via `jsTypedArray.assign(pyArray)`: measured **~0.9 µs per 16 KB** (memcpy speed). A persistent JS `Float32Array` that backs the `InstancedBufferAttribute` is overwritten each frame, then `needsUpdate = true`.
4. **Never cross the FFI per object.** Measured Python-to-JS method call with 3 floats: **3.8 µs each** (1000 objects = 3.8 ms, ~23% of a frame budget), attribute set 0.56 µs. With 1000+ bullets this alone blows the budget.
5. **Particles are simulated on the GPU, not in Python.** Python emits *spawn events* (position, seed, kind, time); a vertex shader computes `pos = origin + vel(seed)*t + g*t^2/2` and fades via `age`. Python cost for a 5000-particle explosion becomes ~0. Python only simulates *gameplay-relevant* entities (player, enemies, bullets, pickups).
6. **Pack instances compactly and build matrices in the vertex shader.** Measured in Pyodide: writing 4 floats/instance (x, y, angle|scale, type) for 1000 instances = **0.61 ms**; writing full 16-float matrices via slice-assign = **1.75 ms** (2.9x worse). Use `InstancedBufferAttribute` + a patched `MeshStandardMaterial` (`onBeforeCompile`) so lights/shadows still work.
7. **Zero-copy `getBuffer()` is an optimization, not the default.** Verified hazard: the returned typed-array view is **detached when WASM memory grows** (`byteLength` became 0 after a 200 MB allocation). If used, re-acquire the view when `view.data.byteLength === 0` or after any allocation spike, and preallocate all buffers at init. The `assign()` copy is fast enough that this is rarely needed.
8. **Create proxies once.** Any Python callback given to JS (`create_proxy`) must be created at init and reused; `destroy()` when done. Python-to-JS objects handed across per frame leak PyProxies.

### Performance budget (measured, Pyodide 314.0.7 on Node v18.19.1/V8, desktop WSL2; single runs)

| Workload | Native CPython 3.12 | Pyodide 3.14 | MicroPython wasm 1.29 |
|----------|--------------------|--------------|-----------------------|
| Update 600 bullets (pure Python lists) | 0.063 ms | **0.174 ms** | 1.58 ms |
| Collision 600 bullets x 80 enemies, naive O(n*m) | 2.74 ms | **8.22 ms** (unusable) | 91.2 ms |
| Same, uniform-grid broadphase | 0.80 ms | **1.87 ms** | n/m |
| Write 1000 instances x 4 floats into `array('f')` | 0.20 ms | **0.61 ms** | 2.62 ms |
| numpy: update + pack 3000 particles | n/a locally | **0.094 ms** | not available |
| Cold start (node, local files) | n/a | **1.8 s** (+0.75 s numpy) | **34 ms** |

Interpretation:
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

**Baseline first-visit payload ≈ 6.3 MB (no numpy)**, ≈ 9.2 MB with numpy. Fine for a shared link on Wi-Fi; noticeable on cellular. Mitigation: load-screen with real progress, start downloading `pyodide.asm.wasm` in parallel with three.js init, "tap to start" gate (needed for audio unlock anyway).

Hosting recommendation: **load Pyodide from jsDelivr, pinned** (`https://cdn.jsdelivr.net/pyodide/v314.0.7/full/`): verified `access-control-allow-origin: *`, `cache-control: public, max-age=31536000`, `content-type: application/wasm`, brotli. Self-host as fallback (copy `pyodide.asm.{mjs,wasm}`, `pyodide.mjs`, `python_stdlib.zip`, `pyodide-lock.json`, `package.json` per the Pyodide deployment doc; any static host works if it serves `.wasm` as `application/wasm`). Whether GitHub Pages/itch.io compress `.wasm` with brotli is **unverified**; if not, self-hosting costs ~9.6 MB instead of 3.4 MB, which is a reason to prefer the CDN.

## Installation

```bash
# One-time machine setup (local Node is 18.19.1; Vite 8 needs >=20.19 / >=22.12)
fnm install 22 && fnm use 22        # or nvm
uv venv --python 3.14 .venv && uv pip install pytest==9.1.1

# Web app
npm init -y
npm install three@0.186.1 pyodide@314.0.7 zzfx@1.4.0
npm install -D vite@8.3.4
# optional
npm install -D @types/three@0.186.0
```

Pin exact versions (no `^`): three.js releases roughly quarterly and removes things between releases (r186 removed `PCFSoftShadowMap`; `Clock` deprecated in r183), and Pyodide 314.0.0 changed the Emscripten ABI.

Vite notes: do **not** let Vite bundle/pre-bundle Pyodide (`optimizeDeps.exclude: ['pyodide']`); import `loadPyodide` from the CDN `pyodide.mjs` URL or copy the runtime files into `public/pyodide/`. Ship game Python as plain `.py` files under `public/py/` (or one zip unpacked with `pyodide.unpackArchive`) and write them into Pyodide's FS at boot.

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

**Desktop-first path (default, ship this first):**
- WebGL2, DPR up to 2, full-res bloom (5-mip `UnrealBloomPass` at strength ~0.8-1.5, threshold high so only emissive pixels glow), `OutputPass` for tone-mapping/sRGB. Tone mapping must be enabled on the renderer for `UnrealBloomPass` (stated in the docs).

**Mobile tier (auto-selected by frame-time probe on first 2 s):**
- DPR capped at 1.5, bloom at half resolution (or additive-sprite fake glow), shadows off, fewer particles, same Python sim. Touch input = relative drag (`pointerdown/move`), auto-fire, on-screen bomb button. Use `pointer` events with `touch-action: none`; `visibilitychange` -> auto-pause.

**If Python budget is blown on phones:**
1. Grid broadphase + preallocated pools (should already be in).
2. Move bulk bullet/particle math to numpy float32 arrays (+2.9 MB).
3. Run sim at 60 Hz fixed step but skip render-side work first (lower DPR/bloom) before touching Python.
4. Move Python into a Worker (SAB + `mini-coi`), last resort.

**Audio:**
- `AudioContext` must be created/resumed inside a user gesture (iOS/Chrome autoplay policy), so use a title-screen "tap/press to start" which doubles as the load gate. Python pushes integer sfx IDs into an `Int32` event ring; JS maps ID -> pre-rendered `zzfx` `AudioBuffer` and plays via `AudioBufferSourceNode`. Voice-limit and per-ID cooldown to avoid 50 simultaneous explosion sounds. (WebAudio/autoplay behavior: MEDIUM, standard platform behavior, not re-verified this session.)

## Dev workflow, testing, deployment

**Repo layout (enforce the seam):**
```
src/scorched_core/   # PURE Python. No `import js`, no `pyodide`. Deterministic, seedable RNG, fixed dt.
src/scorched_web/    # thin adapter: imports js, packs buffers, exposes step(dt, ax, ay, fire, bomb)
web/                 # Vite app: main.js (loop/input/audio), renderer/*.js (procedural meshes, bloom)
tests/               # pytest against scorched_core only
tools/perf_node.mjs  # runs the real core inside Pyodide-in-Node, asserts ms/frame budget
```

**Dev server / hot reload:** `vite` serves `web/`; Python files are fetched as static files, so edit -> refresh reloads in ~2 s (Pyodide wasm is HTTP-cached). Add a tiny Vite plugin (or `server.watch`) that triggers a full reload on `.py` change; optionally a dev-only `importlib.reload` of enemy-wave/tuning modules with state kept for fast iteration. Pyodide memory snapshots exist to speed boot but were **not verified** for 314.x; evaluate only if load time becomes a problem.

**Headless testing (pytest):** because `scorched_core` is pure and deterministic, test: weapon level-ups/power loss on death, bomb invulnerability frames, scoring/medals, wave scripts (run N ticks, assert spawn timeline), boss phase transitions, collision grid correctness, high-score table. Property: same seed + same input log => identical state hash (enables replay tests). Plus a CI job `node tools/perf_node.mjs` loading `pyodide@314.0.7` and running 600 frames of a stress scenario (e.g. 400 bullets/60 enemies) asserting mean and p99 `step()` time; this also catches stdlib modules missing in Pyodide. Node 18 ran my benchmark successfully, so the harness works even on the current machine; use Node 22 for Vite anyway.

**Deployment (both verified/low-risk):**
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

1. **Mobile benchmark spike (do in phase 1):** run the Pyodide step() stress test and a bloom-on/off three.js scene on a mid-range Android and an iPhone. This decides the mobile tier and whether numpy/Worker escalation is needed. Also measure real-browser (Chrome/Safari) cold start and memory (iOS Safari WASM memory-growth limits are historically fragile; a 2024 WebKit bug reports allocation denial around ~200 MB initial / growth failing at varying sizes).
2. **Browser-side bloom cost:** `UnrealBloomPass` on iOS/older iGPUs (old forum report of Intel Safari slowness; unverified for 2026).
3. **Pyodide memory snapshot / startup trimming:** unverified for 314.x.
4. **Compression on target hosts** (GH Pages, itch.io) for `.wasm`.
5. **Babylon fallback details** if ever triggered: verify bloom/glow/thin-instance APIs in 9.31 docs at that time.
6. **WebGPU upgrade path** (post-v1): revisit when Firefox ships by default and three's `EffectComposer` story is settled.

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

---
*Stack research for: browser 3D vertical shmup with Python-in-WASM logic*
*Researched: 2026-10-17*
