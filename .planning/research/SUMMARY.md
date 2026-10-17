# Project Research Summary

**Project:** Scorched
**Domain:** Browser-based 3D-rendered vertical shmup (90s arcade style) with Python game logic in WebAssembly
**Researched:** 2026-10-17
**Confidence:** MEDIUM

## Executive Summary

Scorched is a Raiden-style vertical shoot-'em-up whose gameplay lives on a 2D plane but is rendered in polished 3D, shipped as a static web page. The only viable way to get "game logic in Python" plus "WebGL 3D with post-processing" in a browser today is **Pyodide (CPython compiled to WASM) for the simulation, with three.js doing all rendering**. Python-native 3D engines (Panda3D/Ursina, Harfang3D) have no working browser target, pygbag has no 3D path, PyScript is just a wrapper over the same runtimes, and MicroPython boots fast but runs the game loop 4–11x slower than Pyodide.

The architecture hinges on a narrow, batched Python↔JS boundary. Python owns everything that can change a gameplay outcome (fixed 60 Hz sim, collision, scoring, scene flow, RNG); JS owns presentation (rAF loop, rendering, particles, bloom, shake, audio, HUD, input capture). JS calls one held `tick(dt_ms, buttons, ax, ay)` per frame; Python copies fixed-size float32 buffers into JS-owned typed arrays and emits effects through an event ring buffer. Measured FFI costs (3.8 µs per Python→JS call vs ~0.9 µs for a 16 KB bulk copy) rule out per-entity calls.

The dominant risk is **mobile performance**, which is entirely unmeasured: Pyodide tick cost on phones, UnrealBloomPass fill-rate on mobile GPUs, and iOS Safari quirks (audio unlock, Low Power Mode 30fps cap). Phase 1 must therefore be a feasibility spike on real devices and the real host, not scaffolding. The second risk is content scope — bosses are expensive — mitigated by a data-driven stage/pattern DSL and a one-stage vertical-slice gate before stages 2+.

## Key Findings

### Recommended Stack

Pyodide 314.0.7 (CPython 3.14.2) runs all game logic on the main thread; three.js 0.186.1 `WebGLRenderer` with `EffectComposer` + `UnrealBloomPass` renders; Vite 8.3.4 serves/builds; zzfx 1.4.0 synthesizes SFX via WebAudio. First-visit download ≈ 6.3 MB (Pyodide wasm 3.4 MB brotli + stdlib), Pyodide boot ≈ 1.8 s on desktop. Fallback renderer: Babylon.js 9.31.0 behind the same Pyodide layer.

**Core technologies:**
- Pyodide 314.0.7: Python game logic in WASM — only mature full-CPython browser runtime; pin jsDelivr URL
- three.js 0.186.1 (WebGL2): rendering, InstancedMesh, bloom — mature, best post-processing ecosystem; WebGPU/TSL deferred (Firefox off by default, iOS only Safari 26+)
- Vite 8.3.4: dev server/build — needs Node ≥20.19 (machine has Node 18.19.1 → install Node 22)
- zzfx 1.4.0: procedural SFX — tiny, code-only, fits "no external assets"
- pytest + uv-managed Python 3.14: headless testing of the pure core (local Python is 3.12.3)
- numpy (optional): ~20x faster bulk updates but +2.9 MB / ~0.75 s load — only if the spike shows the need

**Rejected:** MicroPython-WASM (too slow), PyScript (wrapper), pygbag (no 3D), Panda3D/Ursina web (no official build, reported failures), Harfang3D (no working browser build), SharedArrayBuffer/Worker designs (GitHub Pages can't set COOP/COEP).

### Expected Features

**Must have (table stakes):**
- Raiden weapons: red vulcan / blue laser / purple homing, ~5 levels; same color levels up, different color switches; power loss on death with recovery capsule
- Limited bombs (bullet-clear + brief invulnerability), with a short death-bomb grace window (compensates browser/touch latency)
- Tiny, visible hitbox core on the ship (tilted 3D camera makes collision point ambiguous)
- Air/ground/turret/ship enemy roster, scripted waves, multi-phase bosses with destructible parts
- Lives, score extends, countdown continues (infinite but flagged), medals, stage-clear tally, top-10 local high scores with initials
- Fixed 60 Hz sim, fixed logical playfield (≈240×320 arcade aspect) letterboxed to any screen
- Title, pause (auto-pause on tab blur), game over / continue, name entry
- Keyboard by physical key (`event.code`) + arrows (AZERTY-safe); touch: relative 1:1 drag with speed cap, always-on auto-fire, big bomb button with handedness swap, pointer events per `pointerId`
- Tap-to-start gate (doubles as audio unlock and load gate)

**Should have (differentiators):**
- Juice stack: bloom, particles, dynamic lights, explosions — tiered screen shake and short hitstop reserved for big events
- Persistent scorch marks / burning wrecks on terrain (delivers the "Scorched" theme), destructible scenery
- Adaptive quality scaling (doubles as perf mitigation)
- Stage select / practice mode (nearly free with data-driven stages), PWA fullscreen on phones

**Defer / anti-features:**
- Bullet-hell density, chaining systems, online leaderboards, gamepad (v1), multiple ships, charge shot (conflicts with touch auto-fire), secondary weapon track, separate air/ground weapons, second loop, cutscenes, procedural stages, meta-progression, per-hit shake

### Architecture Approach

Two packages with a hard seam: `scorched_core` (pure, deterministic Python, no `js` imports, fully pytest-able) and `scorched_web` (thin Pyodide adapter). `protocol.py` defines the buffer/event contract; JS reads it from a manifest at boot. Bullets are struct-of-arrays `array('f')` pools packed into the render buffer by strided slice assignment; enemies/boss/pickups/player are pooled `__slots__` objects whose behaviors and bullet patterns are Python generators driven by data-driven stage timelines. No ECS. Particles are GPU-simulated in JS, triggered by spawn events. Gameplay is defined at player altitude; other altitudes get a per-layer scale about the camera so hitboxes match what the tilted camera shows; air units get blob shadows.

**Major components:**
1. Sim core (Python) — fixed-timestep accumulator, entity pools, collision (uniform grid broadphase), weapons, scoring, scene state machine, seeded RNG
2. Stage/pattern DSL (Python) — timelines, wave spawners, bullet emitters, boss phase lists with destructible parts
3. Bridge — one `tick()` per frame, `JsBuffer.assign()` copies into JS-owned typed arrays (not long-lived `getBuffer()` views, which detach on WASM memory growth), event ring buffer
4. Renderer (JS/three.js) — tilted camera, InstancedMesh with packed 4-float instance data, procedural part-based meshes, scrolling 3D terrain, bloom behind quality tiers, GPU particles, shake
5. Platform layer (JS) — input (keyboard + pointer), audio (zzfx + music on `AudioContext` clock), localStorage persistence, HUD, debug/error overlay

### Critical Pitfalls

1. **Per-entity FFI and proxy leaks** — one batched call per frame; never `create_proxy` inside the frame path; hold proxies created once
2. **Variable timestep** — fixed 60 Hz with clamped accumulator, tick-based timers, seeded RNG from the first commit (retrofit cost HIGH); enables replay tests
3. **Mobile perf unknowns** — real-phone spike in Phase 1 (500-instance load, bloom on/off); DPR cap and quality tiers from day one; WSL software-GL numbers are meaningless
4. **Bullet readability vs scorched-earth palette** — orange/red bullets vanish in fire and explosions; fix the bullet palette rule and a late, un-bloomed (or bloom-controlled) bullet pass early; keep camera tilt modest
5. **Boss/content scope creep** — data-driven DSL, one-stage vertical-slice gate, stages 4–5 as explicit stretch
6. **Untestable code / no device debugging** — pure core under pytest; on-device debug overlay and error screen (no Safari Web Inspector from Linux/WSL)
7. **Hosting** — test deploy on the real host in Phase 1 (wasm MIME, compression, cache); don't depend on SharedArrayBuffer

## Implications for Roadmap

Suggested phase structure (to be compressed for **coarse** granularity):

### Phase 1: Boundary, Performance & Deploy Spike
**Rationale:** The whole stack choice rests on unmeasured mobile performance; fail fast.
**Delivers:** Pyodide + three.js page with 400–500 instanced bullets driven by Python `tick()`, bloom toggle, timing overlay, tap-to-start gate, error overlay, deployed to the real static host; measured on desktop, mid-range Android, iPhone.
**Avoids:** Per-entity FFI, hosting/MIME surprises, discovering mobile is unplayable late.

### Phase 2: Simulation Core
**Rationale:** Fixed timestep, pools and collision are expensive to retrofit.
**Delivers:** Fixed 60 Hz step, capped pools, input abstraction, player + hitbox, basic shot, grid-broadphase collision, frozen protocol, pytest suite.
**Gate:** One weapon vs one enemy feels good.

### Phase 3: Render Slice & Feel Layer
**Rationale:** Core value is shooting feel; it must be judged before content is built on it.
**Delivers:** Tilted camera with altitude/parallax mapping, procedural part-based meshes, scrolling terrain, bloom quality tiers, bullet palette rule, GPU particles, explosions, shake, zzfx SFX.

### Phase 4: Enemies, Stages, Weapons & Survival
**Delivers:** Data-driven stage DSL, pattern emitters, enemy roster, Raiden weapons/pickups, bombs with death-bomb grace, lives/extends, medals/scoring, difficulty data.

### Phase 5: Boss Framework & Stage 1 Vertical Slice
**Delivers:** Boss phase lists, destructible parts, timeout failsafe; complete stage 1 as the slice gate.

### Phase 6: Scenes, HUD, Persistence, Touch & Audio
**Delivers:** Scene stack, HUD, high-score entry, localStorage, touch controls, iOS audio path, music.

### Phase 7: Content Scale-Up & Mobile Hardening
**Delivers:** Stages 2–3 (4–5 stretch), soak tests, device QA, release.

### Phase Ordering Rationale

- Measurement before architecture commitment: the spike decides mobile tiers, numpy, and whether a Worker is ever needed.
- Sim core before rendering polish: determinism and pools are hard to retrofit; pure core enables tests from day one.
- Feel before content: the core value must be validated before investing in stages and bosses.
- Part-based procedural models must exist before bosses (destructible parts); combat numbers are data from day one.
- Vertical-slice gate before content scale-up protects against boss scope creep.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** mobile measurement methodology, host choice and compression
- **Phase 3:** mobile bloom cost, iOS GPU limits, altitude-scale camera mapping
- **Phase 5:** boss authoring format and part model
- **Phase 6:** iOS audio (silent switch, unlock), touch name entry UX, music synthesis vs loops

Phases with standard patterns:
- **Phase 2, 4, 7:** well-established shmup and sim patterns

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Versions verified live; desktop perf benchmarked (single WSL2 machine); mobile unmeasured |
| Features | MEDIUM | Genre conventions well established; game-feel numbers are starting points to tune |
| Architecture | MEDIUM-HIGH | Boundary design backed by measured FFI costs; altitude mapping needs visual check |
| Pitfalls | MEDIUM | Pyodide FFI from official docs; hosting/iOS from community reports; per-frame costs estimated |

**Overall confidence:** MEDIUM

### Gaps to Address

- Mobile Python tick cost and bloom cost: Phase 1 real-device spike decides quality tiers and numpy/Worker need
- Collision strategy conflict (STACK: grid from start; ARCHITECTURE: brute force first): resolve as **grid in Phase 2** — measured naive cost in Pyodide (8.2 ms for 600×80) far exceeds budget
- Primary host (GitHub Pages vs itch.io vs Netlify/Cloudflare Pages with `_headers`) and `.wasm` compression: decide in Phase 1
- iOS audio behavior (silent switch, `navigator.audioSession`): Phase 6
- Pyodide memory snapshots / precompiled `.pyc` for faster startup: measure in Phase 1
- Touch high-score initials UX: Phase 6
- High-refresh (120/144 Hz) render interpolation: polish
- Toolchain: install Node 22 (Vite 8) and uv-managed Python 3.14 before Phase 1

## Sources

- STACK.md — npm/PyPI/jsDelivr registry queries, three r186 package inspection, local Pyodide/MicroPython benchmarks
- FEATURES.md — Shmups Wiki, fan wikis, developer forums on touch controls, game-feel articles
- ARCHITECTURE.md — Pyodide official docs (FFI, buffers), native CPython timings, design reasoning
- PITFALLS.md — Pyodide docs on proxies/buffers, WebKit bugs, itch.io/GitHub Pages community reports

---
*Research completed: 2026-10-17*
*Ready for roadmap: yes*
