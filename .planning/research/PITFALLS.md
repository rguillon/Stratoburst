# Pitfalls Research

**Domain:** Browser 3D-rendered, 2D-plane vertical shmup with game logic in Python-on-WASM (Pyodide-class), WebGL rendering, desktop + mobile, static hosting
**Project:** Scorched
**Researched:** 2026-10-17
**Confidence:** MEDIUM overall. Pyodide FFI/proxy semantics and hosting/iOS constraints are HIGH or MEDIUM (official docs plus community reports). All per-frame cost figures are engineering estimates and are LOW until measured in the Phase 1 spike. They are marked "(est.)" below. Do not treat them as facts.

**Phase naming used below (provisional; remap to the real ROADMAP.md):**

| ID | Phase |
|----|-------|
| P1 | Foundations spike: stack, hosting, FFI contract, perf budget, debug overlay |
| P2 | Core loop and ship feel: fixed timestep, input, player, shooting, collision, pools |
| P3 | Rendering look: lighting, bloom, particles, procedural meshes, background, quality tiers |
| P4 | Enemies, waves, weapons, bombs (data-driven) |
| P5 | Stage 1 vertical slice plus boss 1 |
| P6 | Audio, UI, scoring, persistence |
| P7 | Content scale-up (stages 2 to N, bosses 2 to N) |
| P8 | Mobile hardening, QA, release |

---

## Critical Pitfalls

### Pitfall 1: Crossing the Python/JS boundary per entity, per property

**What goes wrong:**
Python code drives the renderer through the `js` module at object granularity. Examples are `mesh.position.set(x, y, z)` for each bullet, `instance.setMatrixAt(i, m)` in a Python loop, and building `THREE.Vector3` objects from Python. With 200 to 400 bullets plus enemies plus particles, that is thousands of FFI calls per frame. Each call allocates JsProxy wrappers, converts arguments and re-enters the JS engine. The frame budget is gone before any gameplay logic runs. Mobile is several times worse.

**Why it happens:**
It is the obvious way to use a JS 3D library from Python. The three.js API is object-oriented and the Pyodide `js` module makes it feel free. It works with 20 objects in the first demo and falls over at 300.

**How to avoid:**
Define a narrow, batched boundary contract in P1 and never bypass it.
- Python owns simulation state in flat struct-of-arrays form (`array.array('f')`, preallocated lists, or a `memoryview`). Per frame it writes a snapshot of positions, rotations, scales, colours and flags for each instance class (player bullets, enemy bullets, particles, enemies) into a buffer.
- JS owns every renderer object. It reads the snapshot and uploads it as instanced-attribute data (WebGL2 instanced arrays), with one draw call per instance class.
- Total crossings per frame should be about 5 to 20 (one `render(snapshot)` call, a few event calls for sfx/shake), not O(entities).
- For bulk data use zero-copy views. Pyodide's `toJs()` copies buffers and the docs warn it is "extremely slow" for large buffers. `getBuffer()` gives direct access to WASM memory and requires `release()` afterwards.
- Cache `js.*` lookups in Python locals at init. Each attribute access creates a new JsProxy.

**Warning signs:**
- Any `for b in bullets: js_obj.something = ...` in Python.
- Profile shows time in `JsProxy` getattr/setattr or proxy allocation.
- Frame time scales linearly with bullet count at a steep slope.
- FPS fine with 50 bullets and collapsing at 200.

**Phase to address:** P1 (define and benchmark the contract with a synthetic 500-instance load), enforced in P2 and P3.

---

### Pitfall 2: PyProxy leaks (and the per-frame `create_proxy` trap)

**What goes wrong:**
Python callables passed to JS (rAF callback, event listeners, `setTimeout`) are wrapped as PyProxy objects. Pyodide docs state that persisted proxies must be created with `create_proxy()` and that you must call `.destroy()` when done "to avoid memory leaks". The classic game-loop bug is `requestAnimationFrame(create_proxy(frame))` inside the frame function. This allocates a new proxy every frame (60 per second) and leaks all of them, so memory climbs steadily until a mobile tab is killed after 10 to 20 minutes. Related leaks come from `to_js()` on nested structures (many proxies at depth), from listeners added on each scene/stage start and never removed, and from `setInterval` callbacks with no owner to destroy them. A community discussion in the PyScript project raised the same lifecycle problem for `create_once_callable` listeners and intervals. That is a contributor question, not an authoritative ruling.

**Why it happens:**
Without `create_proxy`, the first call fails or the callback is garbage-collected immediately. Developers "fix" it by wrapping at the call site and never revisit it. Proxy lifetime has no analogue in normal Python or JS code.

**How to avoid:**
- Create exactly one persistent proxy for the rAF tick function at startup and re-register that same proxy every frame. Never create a proxy inside a per-frame path.
- Every `addEventListener` goes through one `Input`/`Platform` class that stores its proxies and destroys them on teardown. Use `pyodide.ffi.wrappers.add_event_listener` or `remove_event_listener` where applicable.
- For cross-boundary data use the batched buffer approach from Pitfall 1 so no per-frame proxies exist at all.
- Where `toJs()` is unavoidable, pass `create_pyproxies=False` so accidental proxy creation raises instead of leaking silently.
- Add a soak test: run the game on autopilot for 15 minutes and chart Pyodide heap size (`pyodide._module.HEAPU8.length`) and JS heap. Memory should plateau.

**Warning signs:**
- Heap grows monotonically during a stage and does not drop at stage transitions.
- Mobile tab reloads itself after several minutes.
- Slowly increasing GC pauses.
- Errors like "This borrowed proxy was automatically destroyed" or "Object has already been destroyed".

**Phase to address:** P1 (loop and input wrapper written correctly from day one), re-verified in P8 with a soak test.

---

### Pitfall 3: Python GC pauses and allocation churn in the hot path

**What goes wrong:**
CPython refcounting frees most garbage immediately, but the cyclic collector triggers by net allocation count. A shmup that creates a `Bullet` instance, `Vec2` tuple, or dict per shot, per particle and per frame triggers frequent young-generation collections. Periodic older-generation collections walk every live container object, so pause length scales with live object count. On WASM and a phone CPU a 10 to 30 ms pause (est.) once or twice a second shows up as a visible hitch. Averages hide it: the game reads "58 fps" while feeling jittery. JS-side `new` per frame (vectors, matrices, arrays) adds browser GC pauses on top.

**Why it happens:**
Idiomatic OOP Python ("each bullet is an object") allocates freely. Desktop testing hides the cost.

**How to avoid:**
- Pre-allocate pools at stage load: bullets, enemies and particles live in fixed-capacity struct-of-arrays with a free-list or active-count. Zero allocation in the steady-state tick is a design rule, not an optimisation.
- Call `gc.collect()` once during loading, then `gc.freeze()`, and `gc.disable()` (or raise the thresholds massively) during gameplay. Explicitly `gc.collect()` at safe moments (stage transitions, pause, boss intro). This only works if the code does not create cyclic garbage in the hot path, which pooling guarantees.
- Prefer tuples/ints/floats in arrays over objects. Avoid creating closures, lambdas, generators or f-strings per tick (HUD text updates only when the value changes).
- JS side: no per-frame allocation either. Reuse typed arrays and scratch vectors.
- Track p95/p99 frame time and "worst frame in last 5 s" in the debug overlay. Treat p99 as the acceptance metric rather than average fps.

**Warning signs:**
- Regular hitch every N seconds that correlates with spawn bursts.
- Frame-time graph shows spikes though average is fine.
- Per-frame allocation count (in a Python `tracemalloc` or a manual counter) is non-zero in steady state.

**Phase to address:** P2 (pools and no-allocation rule), P8 (verify p99 on real devices).

---

### Pitfall 4: Per-frame Python cost blows up with bullet and collision counts

**What goes wrong:**
Pure-Python loops over hundreds of entities plus naive collision O(bullets x enemies) exceed the frame budget. Rough numbers (est., verify in P1): CPython on WASM runs roughly 1.5 to 3x slower than native, and a mid-range phone adds another 3 to 5x over a desktop. A naive 300 player bullets x 40 enemies = 12,000 pair tests per frame is several ms on desktop and can be 15 ms or more on a phone. Add bullet movement, pattern emitters, and path-following enemies, and a 16.6 ms budget is gone. Downstream, the developer starts deleting content to keep fps instead of fixing the architecture.

**Why it happens:**
Native-speed intuition ("300 bullets is nothing") does not transfer to interpreted Python on WASM on a phone. Performance is not measured on a phone until late.

**How to avoid:**
- Set an explicit simulation budget in P1 (for example, at most 4 ms of Python per 60 Hz tick on a mid-range phone at peak load) and a hard cap on live entities (for example 300 enemy bullets, 100 player bullets, particle count owned by the JS/GPU side).
- Collision design: enemy bullets vs player is O(N) against a single tiny hitbox. Do this check first and cheaply (bounding-box reject on squared distance, integer-ish math, early outs). Player bullets vs enemies uses a coarse uniform grid or sorting by y, and enemies are few, so loop enemies outer and bullets inner with an AABB reject. Never test bullet vs bullet.
- Particles, trails, sparks and screen-space effects are not simulated in Python at all. Spawn them as events ("explosion at x,y, size s") and let the GPU or JS integrate them analytically (position = f(t) in the vertex shader). This is the highest-leverage decision for the performance risk named in PROJECT.md.
- Bullet motion for simple patterns can be analytic (spawn position, velocity, spawn time, so position is computed in the shader) and needs no per-tick Python update at all.
- Consider NumPy only after measuring. It adds multi-MB to startup (see Pitfall 6) and has per-call overhead for small arrays. A hand-written tight loop over `array.array` is often enough for under 500 entities.
- Keep the sim core pure Python with no `js` import so it can be benchmarked natively under CPython and in Pyodide with the same harness (see Pitfall 20).

**Warning signs:**
- Python tick time (instrumented with `time.perf_counter`) exceeds 6 ms on a phone with a typical wave.
- Tick time is dominated by collision.
- You catch yourself lowering bullet counts for performance.

**Phase to address:** P1 (budget plus synthetic stress), P2 (collision structure), P4 (re-measure with real patterns).

---

### Pitfall 5: Variable timestep, rAF quirks, and the death spiral

**What goes wrong:**
A sim stepped by `dt = now - last` makes bullet patterns non-deterministic, lets 120/144 Hz displays run the game "fast" or fire faster, and tunnels fast bullets through targets when a frame is long. Fixing it with a fixed-timestep accumulator introduces the second bug: a slow Python frame makes the accumulator need 2 to 3 sim steps next frame, which takes longer still, and the game enters a death spiral. This is especially likely when the sim cost is high. Specific browser triggers:
- Returning from a background tab produces one giant `dt` (rAF is throttled or stopped in hidden tabs, and timers clamp to about 1 s).
- iOS Low Power Mode caps Safari rendering at about 30 fps (known behaviour, MEDIUM confidence). A 60 Hz fixed sim then needs 2 steps per frame and doubles per-frame Python cost exactly on the slowest devices.
- 120 Hz ProMotion phones and 144 Hz desktop monitors break any "1 frame = 1 tick" assumption.

**Why it happens:**
Frame-locked logic is the quick path. Fixed timestep is added late, without a cap.

**How to avoid:**
- Fixed 60 Hz sim from the first commit. Cooldowns, invulnerability, bomb duration, and pattern timers are all counted in ticks, never seconds.
- Accumulator with clamp: `acc += min(frame_dt, 0.1)`; run at most 2 to 3 steps per rendered frame; if more are owed, drop the remainder (slow down instead of spiralling). Reset the baseline on resume from hidden.
- Render interpolation between the previous and current sim state (store prev positions in the snapshot buffer) so 120/144 Hz is smooth. Collision runs on sim state only.
- Seeded RNG (`random.Random(seed)`) owned by the sim so identical inputs produce identical results. This enables replays and deterministic tests (Pitfall 20) and costs nothing now.
- Drive the loop from a single JS `requestAnimationFrame` that calls a Python `tick(timestamp)`. Do not use `asyncio.sleep(0)` as a frame pacer on the Pyodide webloop (extra scheduling overhead and non-rAF timing).
- Provide an adaptive quality fallback if the sim consistently exceeds the cap: reduce effects first, then allow slow-motion.

**Warning signs:**
- Game speed differs between a 60 Hz and 144 Hz monitor.
- After alt-tabbing, the ship teleports or enemies appear all at once.
- Fire rate varies with fps.
- Perf drops make things "worse than linear".

**Phase to address:** P2 (loop is the first thing built), re-verified in P8 on 30 fps and 120 Hz devices.

---

### Pitfall 6: Startup time and download size (Pyodide plus assets plus packages)

**What goes wrong:**
First load on mobile data is a long blank screen and many visitors bounce. The Pyodide runtime alone was about 5.3 MB Brotli-compressed for Python plus stdlib in the 0.23 release, with 0.9 to 1.3 s init on a fast connection with no cache (official blog, older release; newer versions have grown and moved to Python 3.14 as the 314.x line, so re-measure). On a mid-range phone on 4G the real wait is several times that. Every extra package multiplies it. NumPy or similar scientific packages add several more MB and a separate fetch. The project's own Python source is compiled to bytecode at every cold start because there is no persistent `.pyc` cache in the WASM filesystem. A project with dozens of modules pays import cost each time.

Hosting makes it worse. GitHub Pages serves gzip rather than Brotli (verify) and gives no control over caching headers.

**Why it happens:**
The "tens of MB" bundle is accepted as inevitable and loading UX is left until the end. Convenience imports (`numpy`, `dataclasses` plus heavy typing, `asyncio` extras) pull in more.

**How to avoid:**
- Set a load budget in P1: for example, time-to-title under 6 s on a mid-range phone on 4G and under 3 s on desktop; total first-visit transfer under about 15 MB. Measure with DevTools throttling and on a real phone.
- Pin an exact Pyodide version. Prefer the lightest runtime that works. Do not use PyScript for a game (extra framework layer, its own config and worker/SAB assumptions; see Pitfall 8). Use `loadPyodide` directly.
- Avoid NumPy and other loaded packages unless Pitfall 4 measurements prove they are required.
- Ship game code as a single zip (`unpackArchive`), ideally pre-compiled to `.pyc` for the pinned Python version, rather than many small files.
- Load order: show the title screen and a real progress bar as soon as the canvas and JS renderer are up. Fetch the Pyodide wasm in parallel with the JS renderer init. Defer music and later-stage assets.
- Serve Pyodide core files from a Brotli-capable CDN (for example jsDelivr, which also sets CORS headers) or a host with Brotli (Cloudflare Pages, Netlify), and use content-hashed filenames for your own files. Use a service worker for repeat-visit caching only if you also test its update path (Pitfall 8).
- Procedural-asset generation (meshes, textures, synthesized audio) at load time in Python is also startup cost (Pitfall 15). Generate once, lazily per stage, and consider doing heavy generation JS-side.

**Warning signs:**
- Lighthouse or DevTools shows more than 10 s to interactive on throttled 4G.
- Large `pyodide.asm.wasm` plus package downloads dominate the waterfall.
- Time between "wasm loaded" and "title visible" is long (imports, mesh generation).

**Phase to address:** P1 (measure baseline, set budget), P8 (final optimisation).

---

### Pitfall 7: iOS Safari - audio lock, silent switch, interruption

**What goes wrong:**
The game is silent on iPhone. WebAudio `AudioContext` starts `suspended` on iOS and can only be resumed inside a user gesture. Resuming on `touchstart` is unreliable (it might begin a scroll). `touchend` or `click` is the dependable trigger. Additional traps:
- The hardware silent/ringer switch mutes WebAudio output in Safari, so the game appears broken to a friend with the switch on.
- After a phone call, lock screen or app switch, iOS can put the context into an `interrupted` state that does not resume until another gesture.
- Desktop Chrome and Firefox apply autoplay policies too, so first-load music must wait for a click or key.

**Why it happens:**
Audio works on the developer's desktop where policies are lax. Python-driven audio start code runs from the game loop (not from a gesture), so `resume()` is rejected.

**How to avoid:**
- Make "Tap to start" a required first screen. Inside that gesture handler (JS, synchronous, not deferred through Python or an await), create or resume the `AudioContext`, play a silent buffer, and also request fullscreen where supported. Re-attempt on every subsequent touchend while `state !== 'running'`.
- Set `navigator.audioSession.type = 'playback'` where available so the silent switch does not mute the game (newer Safari; MEDIUM, verify), and show a visible mute indicator and a "check your ringer switch" hint otherwise.
- Handle `visibilitychange` and `statechange`: suspend on hide, resume on next gesture.
- Do audio scheduling in JS using `AudioContext.currentTime` and short lookahead. Python only sends events ("play sfx X", "music cue Y"). Python frame timing jitter would otherwise make music sloppy.
- Rate-limit and pool SFX (a vulcan weapon at 20 shots per second must not create 20 BufferSource nodes per second plus overlapping voices). Cap simultaneous voices per sound.
- Generating sample data by Python loops is too slow on phones; synthesize via WebAudio nodes or an offline render in JS at load.

**Warning signs:**
- No sound on iPhone while desktop is fine.
- Sound works until a notification or lock/unlock.
- Audio crackles or drifts when frame time spikes.
- `audioContext.state` is not `running` after the title screen.

**Phase to address:** P6 (audio), with the tap-to-start gesture scaffold planted in P1.

---

### Pitfall 8: Static hosting, MIME types, CORS, and the SharedArrayBuffer/COOP-COEP trap

**What goes wrong:**
Several separate failures hide under "just host it statically":
- **Wrong MIME type** for `.wasm` (must be `application/wasm` for streaming instantiation), `.mjs` and `.js` (module scripts require a JavaScript MIME type), and custom extensions such as `.data` or `.zip`. Result is a slow fallback path or a hard failure.
- **No custom headers on GitHub Pages.** Cross-origin isolation (`Cross-Origin-Opener-Policy: same-origin` plus `Cross-Origin-Embedder-Policy: require-corp`) cannot be set, so `SharedArrayBuffer` is unavailable. Anything designed around SAB (running Pyodide in a Worker with synchronous Atomics-based comms, PyScript workers, zero-copy shared state between worker and main thread) silently does not work.
- **The workaround has costs.** `coi-serviceworker` adds the headers via a service worker, but it must be served from your own origin over HTTPS, reloads the page on first visit, and sets COEP so every cross-origin resource (for example Pyodide from a CDN) must send CORS/CORP headers or be blocked. `COEP: credentialless` relaxes this but is not available everywhere (Safari support is limited; verify).
- **itch.io** offers an opt-in, experimental "SharedArrayBuffer support" checkbox in Embed options (announced in 2022). It applies headers only for opted-in projects. Community reports include Safari failures, a requirement that all iframes on the page use compatible headers, and CORP failures when embedding the game on another site. The itch.io iframe is also cross-origin, which can affect storage (Pitfall 18) and fullscreen.
- **Stale caches after deploy.** GitHub Pages sets a fixed short cache lifetime that you cannot change. Without hashed filenames, friends get a new `index.html` with an old game bundle or an old Pyodide asset.

**Why it happens:**
Local dev servers set different headers than production. A threaded-Pyodide design tested locally with COOP/COEP set breaks on first deploy.

**How to avoid:**
- Decide in P1: **the game must not require SharedArrayBuffer.** Pyodide itself does not need it for main-thread use. Run Python on the main thread first (lowest input latency, simplest), keeping the sim/renderer snapshot interface narrow so a later move to a Worker (using transferable ArrayBuffers via `postMessage`, no SAB) stays possible.
- Prefer a host that supports a `_headers` file and Brotli (Cloudflare Pages, Netlify) as the primary link. Use GitHub Pages or itch.io only if the SAB-free design is verified there. Treat itch.io as an optional secondary distribution rather than the primary.
- Add a deploy smoke test in P1: upload the actual build to the real host and check in DevTools Network that `.wasm` has `application/wasm`, all assets return 200, and no CORS errors appear. Test from a different origin too if embedding is planned.
- Use content-hashed filenames for everything the game owns, and pin the Pyodide URL to an exact version. If a service worker is used for caching, test the update path explicitly (old SW, new deploy).
- Keep the loaded Pyodide origin CORS-friendly (jsDelivr sends CORS headers).

**Warning signs:**
- Console shows "Incorrect response MIME type. Expected 'application/wasm'", `SharedArrayBuffer is not defined`, or a COEP/CORP block.
- Works on localhost and breaks on the host.
- Friends report old behaviour after you deployed a fix.

**Phase to address:** P1 (hosting decision and deploy smoke test), P8 (final release check on every target host).

---

### Pitfall 9: Mobile GPU fill-rate - bloom, overdraw and DPR

**What goes wrong:**
The look target (bloom, glow, particles, lighting) is where mobile GPUs die. Fill-rate (pixels shaded per frame) is the bottleneck on phones, not vertex count. Typical failures:
- Full-resolution multi-pass Gaussian bloom on a 3x-DPR phone (a 1170 x 2532 canvas is about 3 million pixels, multiplied by 6 to 10 passes).
- Large additive particle quads: one explosion with 50 big overlapping translucent sprites gives 20x+ overdraw on a screen-sized region (est.).
- Drawing at native `devicePixelRatio` (3 on recent iPhones).
- Many dynamic point lights in a forward shader (cost scales with lights x pixels).
- Real-time shadow maps.
- MSAA assumptions: `antialias: true` on the canvas does not apply to offscreen post-process targets, so you either get aliased edges or pay for multisampled renderbuffers.
- Thermal throttling: 60 fps for 30 seconds, then a steady drop. Short tests miss it.

**Why it happens:**
Quality settings are tuned on a desktop GPU. Off-the-shelf post-processing stacks (for example a stock bloom pass) are written for desktop.

**How to avoid:**
- Render to a fixed internal resolution with a DPR cap (for example max 1.5 on phones, or target a pixel budget such as about 1 million pixels) and upscale. Implement dynamic resolution scaling that drops the scale when p95 GPU frame time rises.
- Bloom: threshold, then downsample chain (dual-filter / Kawase) at half and quarter resolution, with a handful of taps, not a full-res wide Gaussian. Offer a bloom-off tier.
- Particles: cap sprite size and count, use soft additive with small quads, and prefer a few large textured "flash" quads over many overlapping ones. Cut count on low tiers, not the explosion's perceived size.
- Lighting: use one directional plus ambient, emissive materials and fake light (additive glow sprites, light-blob decals on the ground) instead of many real lights. Fake blob shadows rather than shadow maps.
- Handle quality tiers explicitly (High / Medium / Low), auto-selected from a short benchmark at startup and overridable in a menu.
- Test sustained performance for 5+ minutes on a real phone, not 30 seconds.

**Warning signs:**
- Fps scales with window size or DPR more than with entity count.
- Phone gets hot, fps drops after a minute.
- GPU time in a profiler dominated by post-process passes.

**Phase to address:** P3 (tiers and bloom budget before art polish), P8 (sustained device tests).

---

### Pitfall 10: Mobile WebGL precision, formats and context loss

**What goes wrong:**
Things that work on desktop break on phones:
- Fragment shaders default to `mediump` on mobile where it matters, causing banding, flicker, broken scrolling-texture coordinates and glow artefacts. Position and time uniforms in `mediump` break after a few minutes.
- Half-float / float render targets for HDR bloom need extensions (`EXT_color_buffer_half_float` / `EXT_color_buffer_float`). Support varies by device and the fallback is untested.
- Scrolling background coordinates accumulate in float32 over a long stage and visibly jitter or swim far from the origin.
- WebGL context loss when the tab is backgrounded or memory is tight. If procedural meshes only exist on the GPU (generated once and the CPU data dropped) the scene cannot be restored.
- Resizing the drawing buffer on every `resize` event (address bar showing/hiding, orientation change) reallocates the framebuffer chain and causes hitches.

**How to avoid:**
- Declare `precision highp float;` in fragment shaders that do world-space maths, and check `getShaderPrecisionFormat` at startup. Keep time and scroll values wrapped (modulo a tile period) rather than monotonically growing.
- Feature-detect float/half-float render targets and have an RGBA8 bloom path with threshold-and-clamp as fallback.
- Keep CPU-side copies (or regeneration functions) of all procedural geometry and textures and implement `webglcontextlost` / `webglcontextrestored` handlers. Test with `WEBGL_lose_context`.
- Debounce resize and only reallocate when the integer size actually changes.

**Warning signs:**
- Visual differences between desktop and phone (banding, shimmering ground).
- Black screen after returning from another app.
- Hitch on rotate or when the address bar collapses.

**Phase to address:** P3 (renderer foundation), P8 (device matrix).

---

### Pitfall 11: Bullet readability against a busy 3D scene (and the fire-palette collision)

**What goes wrong:**
This is the single biggest design risk of "modern look plus classic shmup". The theme is scorched earth: orange fires, red explosions, bright muzzle flashes, burning cities. Enemy bullets in the traditional orange/red/yellow are invisible against exactly that backdrop. Bloom inflates bright bullets into blobs that hide the true hitbox, and additive explosion particles drawn over bullets can swallow them entirely. A tilted perspective camera makes far (top-of-screen) bullets smaller than near ones, so the same bullet reads differently at different heights. Screen shake and camera effects reduce readability further. Players blame the game for "unfair" deaths.

**Why it happens:**
Art polish is developed in screenshots with few bullets and no overlapping effects. Readability is a gameplay feature but gets treated as an art problem.

**How to avoid:**
- Pick enemy-bullet colours from outside the environment palette (saturated magenta, cyan, or white-core with a coloured halo). Keep player bullets visually distinct (cooler colour, thinner, lower opacity) from enemy bullets. Document the palette rule before building stages.
- Render bullets in a dedicated late pass: on top of explosion particles, depth test off, and excluded from or capped in the bloom contribution so the bright core remains crisp. Lock a minimum on-screen bullet size independent of perspective (billboards with clamped size).
- Keep the background at lower contrast and saturation under the gameplay layer: darker ground near the play area, desaturated mid-tones, effects confined to emissive accents. A subtle dark vignette or a "play-area dimming" layer helps.
- Keep the camera tilt modest (low FOV, near-orthographic feel) so the playfield reads uniformly (see Pitfall 12).
- Screen shake: apply to the world camera only (HUD stays still), keep amplitude small, short and capped, and offer a reduce-effects toggle. Include a photosensitivity toggle for white bomb flashes and strobing explosions.
- Run a readability test early with a worst-case scene: boss pattern plus explosions plus the busiest stage background plus bloom at the low tier.

**Warning signs:**
- Playtesters say "I didn't see it".
- Bullets disappear in screenshots of explosions.
- You are adding glow to bullets to make them visible and bloom is making it worse.

**Phase to address:** P3 (palette and bullet pass rules), re-verified in every stage in P5 and P7.

---

### Pitfall 12: Perspective camera vs flat gameplay plane - distorted speeds and hitboxes

**What goes wrong:**
Gameplay is on a 2D plane but the tilted perspective camera makes screen-space speed and size non-uniform: a bullet moving at constant world speed appears slower at the top of the screen than at the bottom. The ship sits at a height above the ground and its ground shadow is offset, which confuses where it "is". Spawn and despawn bounds computed in world units no longer match the visible screen edge, so enemies pop in or are shot while off-screen. Hitboxes defined in world units look wrong against perspective-scaled meshes. Different phone aspect ratios (a vertical game on a landscape desktop; a tall 19.5:9 phone) change how much of the field you see, which changes difficulty.

**How to avoid:**
- Decide the camera in P3 and lock it: moderate tilt, narrow FOV. Make the playfield the plane at the ship's height and project its edges to compute exact screen bounds. Spawn and cull outside those projected bounds.
- Pick the aspect strategy explicitly: fixed playfield aspect (for example 9:16 or 3:4) letterboxed on desktop with HUD in the side margins, and on tall phones either letterbox or extend the *top/bottom* background only while keeping gameplay-visible region identical. Do not let device aspect change how far ahead the player sees.
- Keep everything gameplay-relevant (ship, bullets, enemies that can hit) on the same plane. Draw only scenery at other heights.
- Draw the player's hit marker/hurtbox indicator in the plane.

**Warning signs:**
- Players misjudge bullet speed at the top of the screen.
- Enemies visibly appear mid-screen.
- Difficulty feels different on different devices.

**Phase to address:** P3 (camera decision), P2 (world-unit conventions).

---

### Pitfall 13: Unfair hitboxes, tunnelling, and input fairness

**What goes wrong:**
Players die to bullets that visibly missed, or bullets pass through enemies. Causes:
- Player hurtbox is the ship mesh bounds rather than a small core (the genre convention is a tiny hitbox, much smaller than the sprite).
- Bullet collision radius is bigger than the visual radius, or bloom makes the visual look bigger.
- Collision tested at sim positions while interpolated render positions are shown, producing up to one tick of visual mismatch.
- Fast bullets/lasers move more than the sum of radii per tick and tunnel through targets. This is worse if a long frame is not subdivided into ticks.
- Contact with enemy bodies is instant death at the visual silhouette.
- Browser input latency (event delivery, Python tick, render pipeline) makes tight dodges feel unfair, and there is no grace window.

**How to avoid:**
- Hurtbox: a small circle (for example 3 to 5 px-equivalent) at the ship's core with a visible hit indicator. Enemy bullet hit radius slightly smaller than the visible core. Never use mesh bounds.
- Use swept tests (segment vs circle) for fast projectiles, or cap speed below the tunnelling threshold. Lasers use ray/segment queries evaluated per tick.
- Keep the player hurtbox forgiving when interpolation is on (favour the player by one tick).
- Add small fairness windows: a few frames of death-bomb grace (bomb within about 6 to 10 ticks after being hit saves the player), input buffering for bomb, and brief post-respawn invulnerability.
- Poll input state at the start of each sim tick from a state table updated by event handlers (key down/up, pointer positions), rather than reacting inside the event handler. This keeps input-to-sim deterministic and removes event-order surprises.
- Measure real input-to-photon latency (see Pitfall 14) and fix the biggest contributor first.

**Warning signs:**
- "That wasn't a hit" feedback.
- Bullets visibly overlap the ship without damage, or vice versa.
- Lasers occasionally miss stationary targets.

**Phase to address:** P2 (collision primitives and hurtbox), P4 (weapon types, lasers), P8 (fairness tuning).

---

### Pitfall 14: Input lag and touch-control UX on mobile

**What goes wrong:**
The core value is "tight, responsive control". Latency accumulates: event delivery, Python tick, snapshot upload, post-processing chain, compositor, possibly extra frame of buffering. On touch, the finger covers the ship, the bomb button sits where the OS gesture zone is, and Safari swallows gestures. Common specific bugs:
- Pull-to-refresh, overscroll bounce, double-tap zoom, text selection and the iOS long-press callout interrupt gameplay.
- `user-scalable=no` is ignored by iOS Safari; zoom via pinch still happens without `touch-action`.
- Bottom buttons collide with the iOS home indicator swipe and Android gesture nav; side drags collide with the browser's edge-swipe back gesture.
- `100vh` includes the collapsed address-bar area, so the canvas is cut off or resizes as bars show and hide.
- Keys get stuck: `keyup` is lost on window blur or an alt-tab, so the ship drifts forever.
- Arrow keys and space scroll the page if not `preventDefault`ed.
- Using `event.key` breaks layouts such as AZERTY (WASD physical positions become ZQSD). Use `event.code`.
- Multi-touch: dragging with one finger while tapping bomb with another must work.

**How to avoid:**
- Pointer Events with `touch-action: none` on the canvas, `overscroll-behavior: none`, `user-select: none`, `-webkit-touch-callout: none`, `preventDefault` on `gesturestart`. Use `dvh`/`visualViewport` and `env(safe-area-inset-*)`, plus `viewport-fit=cover`.
- Relative-drag control with an offset so the ship sits above the finger. Bomb button large, away from bottom and side edges (safe-area aware), and always usable simultaneously with drag. Auto-fire on.
- Clear all input state on `blur`, `visibilitychange` and `pointercancel`.
- Use `event.code` for keys with arrows as the primary scheme; prevent default scrolling keys.
- Reduce pipeline latency: no extra framebuffer copies, consider `desynchronized` or low-latency canvas context hints where supported, avoid CPU readbacks.
- Build an on-screen latency probe (input to visible change, measured with a high-fps phone camera at least once).

**Warning signs:**
- "Floaty" feel only on mobile.
- Page zooms or scrolls during play on iPhone.
- Stuck movement after tabbing away.

**Phase to address:** P2 (keyboard and pointer), P8 (mobile hardening; touch layout needs a real device).

---

### Pitfall 15: Procedural models looking cheap

**What goes wrong:**
Code-built meshes (boxes, cylinders, lathes, extrusions) read as untextured grey primitives under default lighting: flat plastic, inconsistent style between enemies, silhouettes that do not read from the tilted top-down angle. The development loop is also slow because tuning a model by editing code and reloading is painful. Generating meshes with Python vertex loops at load adds startup time on phones.

**How to avoid:**
- Define one art direction up front and apply it everywhere (for example faceted low-poly with hard-edge normals, strong rim light, emissive accent strips, and a shared metallic matcap or procedural gradient environment map for sheen).
- Compensate for lack of detail with shader work, which is cheap and effective: vertex-colour ambient occlusion baked at generation time, procedural panel-line and noise detail in the shader, hit-flash and damage-state emissive, subtle specular, and exaggerated dark/light value contrast.
- Design silhouettes for the top-down tilted view (wings, turrets, distinct shapes per enemy class). Detail the top surface only.
- Build a model-viewer page early (turntable plus lighting presets) so iteration is seconds, not minutes.
- Use mirroring and parameterised builders (one tank builder with parameters generating several tank variants) to scale the roster cheaply.
- Generate each mesh once, upload once, and render via instancing. Generate heavy geometry JS-side or lazily per stage if Python generation shows in the startup profile.

**Warning signs:**
- Everything looks the same grey.
- Models only look good in the lit hero screenshot.
- Enemy silhouettes confuse at game speed.

**Phase to address:** P3 (art direction, viewer and shader approach), then P4 and P7 for roster growth.

---

### Pitfall 16: Content scope creep - bosses, stages, patterns

**What goes wrong:**
"3 to 5 stages, each with a multi-phase boss" is the usual project killer. Each boss needs a model, multiple attack phases, telegraphing, transitions, a death sequence, and balance, and each takes as long as a stage. Hand-coding every wave and pattern in Python functions produces thousands of lines of fragile code. The game stalls with a great stage 1 and nothing else.

**How to avoid:**
- Build a data-driven content layer in P4: a timeline DSL for waves (at tick t, spawn enemy type E with path P at x) and a bullet-pattern DSL (emitter: aimed, spread, ring, spiral, with count, speed, rotation and delay), plus boss phases defined as data (HP threshold, pattern list, movement path). Python makes this cheap (dicts/dataclasses). Stages and bosses become data files, not new engine code.
- Vertical slice first: one complete stage with one multi-phase boss, fully polished, before any second stage. Define "done" for a boss up front (3 phases, one model, one death effect).
- Ship the campaign as 3 stages (the minimum credible set), with stages 4 and 5 as explicit stretch. Reuse by recolouring and re-parameterising enemy models and background generators (palette, props density, terrain type) rather than building new ones.
- Cap the pattern vocabulary (about 8 emitter types) and make variety come from parameters.

**Warning signs:**
- Boss 2 takes as long as boss 1 did.
- New content requires engine changes.
- Time spent on visuals of stage 4 while stage 1 still has balance holes.

**Phase to address:** P4 (DSL), P5 (vertical slice gate), P7 (scale-up with explicit cut line).

---

### Pitfall 17: Difficulty tuning without a tuning harness; power-loss snowball

**What goes wrong:**
Difficulty is tuned by feel in the author's hands, so the game is too hard for friends. Raiden-style "dying drops weapon power" produces the Gradius syndrome: one death in a hard section makes the next section harder, then you die again in a spiral. Weapon types (spread, laser, homing) have inconsistent DPS against enemy and boss HP, so one weapon trivialises or blocks. Unlimited continues make score meaningless, while too few make the game unfinishable for casual friends.

**How to avoid:**
- Tune with numbers: express enemy and boss HP as "seconds to kill at base power for each weapon" in a tuning table and keep weapons within a band.
- Soften the snowball: power loss is partial (drop one level, not all), a recovery pickup spawns after death, and early sections of each stage are gentle.
- Offer Easy/Normal toggling bullet speed/density/enemy HP multipliers (cheap with data-driven patterns), and a clear continue policy (credits count, score resets or penalty on continue).
- Adaptive rank (Raiden's hidden difficulty) is optional. If used, bound it, and make it decrease on death.
- Debug tools from day one: stage skip, boss spawn, invincibility, time scale, and input replay (Pitfall 20).
- Watch real friends play and record deaths per section (a simple death-location heatmap log in local storage).

**Warning signs:**
- Only the author can pass stage 2.
- Players quit after first death in a hard section.
- One weapon is always chosen.

**Phase to address:** P4 (weapon balance table), P5 (first tuning pass), P8 (friend playtest).

---

### Pitfall 18: Tab blur, app switching, and storage on iOS

**What goes wrong:**
Players switch tabs or apps during play, which needs a clean pause. On return: dt spike (Pitfall 5), stuck keys (Pitfall 14), suspended audio (Pitfall 7), lost WebGL context (Pitfall 10), and the game continues running while hidden. rAF may be throttled or stopped but timers continue at a reduced rate. Separately, high scores in `localStorage` can vanish. Safari applies tracking-prevention limits to script-writable storage (a long-unused site's storage can be purged), and the game inside a cross-origin iframe (for example itch.io) may have partitioned or blocked storage. Storing a score table as one JSON string with no error handling will crash on a storage exception.

**How to avoid:**
- One pause path: `visibilitychange` (hidden), `blur`, `pagehide` and `pointercancel` all trigger auto-pause with a resume prompt, suspend audio, clear input, and reset the time baseline on resume.
- Wrap all storage access in try/except, fall back to in-memory, and show "scores not saved" instead of crashing. Version the saved schema. Test on the actual host (including iframe embedding).
- Accept that Safari storage can be evicted. Do not promise permanence.

**Warning signs:**
- Ship drifts after returning to the tab.
- Game over screen appears immediately after resuming.
- Scores disappear on iPhone but not on desktop.

**Phase to address:** P2 (pause and visibility), P6 (persistence), P8 (verify on iOS).

---

### Pitfall 19: iPhone fullscreen and viewport expectations

**What goes wrong:**
Designing around the Fullscreen API. iPhone Safari does not support it for non-video elements (it was briefly enabled and disabled again in the Safari 17.2 betas per WebKit reports; iPad and macOS do support it). Chrome on iOS uses the same engine and has the same limitation. The page keeps visible browser chrome and the game area shrinks or jumps when the bars collapse.

**How to avoid:**
- Treat fullscreen as progressive enhancement: request it on Android/desktop from the tap-to-start gesture; on iPhone, design for the visible viewport (use `dvh`/`visualViewport`, no page scrolling, safe-area insets).
- Provide a web app manifest and the iOS meta tags (`apple-mobile-web-app-capable`) and an optional "Add to Home Screen for fullscreen" hint on iOS. Test the standalone mode separately because storage and viewport behaviour can differ.
- Do not call `requestFullscreen` unguarded; check support first.

**Warning signs:**
- Fullscreen button does nothing on iPhone.
- Canvas is cropped under the notch or home indicator.

**Phase to address:** P8 (mobile hardening); viewport scaffolding in P1.

---

### Pitfall 20: Testing and debugging - Python logic, WASM perf, iOS on a Linux box

**What goes wrong:**
Visual and feel qualities are hard to automate, and the developer works on Linux/WSL, which makes the target (iOS Safari on a real phone) hard to debug (no Safari Web Inspector without a Mac). Software-rendered WebGL in WSL or headless CI (SwiftShader) gives meaningless GPU performance numbers. Exceptions inside the rAF-called Python tick print to the console and then the loop stops, so friends report "it froze" and there is no trace. Feel regressions go unnoticed after refactors.

**How to avoid:**
- Architect the sim core as pure Python with no `js` import and a thin adapter at the edge. Then `pytest` runs the whole game logic natively and fast: collision, scoring, weapon levels, pattern emitters, wave timelines.
- Use seeded RNG plus a fixed timestep to make deterministic input-replay tests ("replay this recording, assert score and state hash"). Record replays during playtests; they double as bug reports and regression tests.
- Run the same benchmark harness in Pyodide through Playwright (Chromium and WebKit) in CI for Python tick-time budgets. Native CPython numbers are only a relative indicator.
- On-device observability: an in-game debug overlay (fps, p95/p99 frame time, Python tick ms, entity counts, draw calls, memory), a visible error overlay that wraps `tick()` in try/except and shows the traceback with a "copy report" button, and an optional on-page console (for example Eruda or vConsole) loaded via a URL flag.
- Real-device checklist in P8: at least one recent iPhone and one mid-range Android. `ios-webkit-debug-proxy` can give remote inspection from Linux but is fragile; plan on the on-page console and overlay as the primary tool. Cloud device services are a backup.
- Do GPU performance judgments only on real hardware.

**Warning signs:**
- Bugs are only reproducible by playing.
- Perf numbers differ wildly between your machine and a friend's phone.
- An exception means a silent freeze.

**Phase to address:** P1 (core/adapter split, overlay, error handling), P2 (replay tests), P8 (device matrix).

---

## Moderate Pitfalls

### Pitfall 21: Choosing an immature or heavyweight Python-3D-in-WASM engine

**What goes wrong:**
Panda3D's WebAssembly build and other WASM-capable Python 3D engines are experimental, with large binaries and no real mobile story. pygbag/SDL2 is 2D-oriented and its frame pacing model (`await asyncio.sleep(0)` main loop) is a poor fit for a custom WebGL pipeline. PyScript wraps Pyodide with extra layers, its own load path and (for workers) SAB or service-worker assumptions.
**Prevention:** Keep Python for logic only (plain Pyodide) and a mainstream JS WebGL library or small custom renderer for drawing. Make this the P1 decision, validated by a benchmark spike rather than by documentation.
**Phase:** P1.

### Pitfall 22: Python exceptions and asyncio entangled with the frame loop

**What goes wrong:** An unhandled exception in the tick kills the loop silently. Mixing `asyncio` tasks with the rAF loop causes ordering surprises and extra per-frame overhead.
**Prevention:** One synchronous `tick()` entry from rAF, guarded by try/except with an on-screen error and a fallback to the pause state. Use asyncio only for loading.
**Phase:** P1.

### Pitfall 23: WASM memory growth invalidating views

**What goes wrong:** When the WASM heap grows, typed-array views onto it (`HEAPU8`, `getBuffer()` results) can be detached and become zero-length. A cached view held across frames reads garbage or throws.
**Prevention:** Re-acquire buffer views each frame (or on a "memory grew" check), preallocate the heap by warming up pools at load so it does not grow during play, and `release()` buffers promptly.
**Phase:** P1 (boundary contract), P2.

### Pitfall 24: Pool exhaustion and entity lifecycle bugs

**What goes wrong:** When a pool is full, new bullets silently fail or crash. Off-screen enemies and bullets are never despawned, so entity counts creep up. Boss phase transitions leave stale bullets, a boss becomes killable (or not) at the wrong time, or a boss goes off-screen and soft-locks the stage. Bullets are not cleared on player death or boss death.
**Prevention:** Define overflow policy (drop low-priority effects first, never drop enemy bullets silently and cap the pattern emitter's output), despawn by bounds with margin, convert bullets to score items on boss death, add a boss kill-timer/failsafe, and assert on entity counts in debug builds.
**Phase:** P2, P4, P5.

### Pitfall 25: Colour pipeline and tone mapping mistakes

**What goes wrong:** Wrong sRGB/linear handling gives washed-out or over-saturated results, bloom clips to white, and emissive colours burn out so bullet colours lose identity. Tone mapping and bloom order produce different looks across tiers.
**Prevention:** Fix the colour pipeline (linear lighting, tone map, sRGB output) once in P3 with a reference test scene, and keep identical ordering across quality tiers.
**Phase:** P3.

### Pitfall 26: Weapon "feel" deferred until content exists

**What goes wrong:** The core value is shooting feel, but hit feedback is added last. Missing pieces: hitstop on kills, hit flash, muzzle flash, impact sparks, layered SFX, small camera kicks. The game ships technically working yet feels flat.
**Prevention:** Run a "feel pass" in the P5 vertical slice with a gate: a single weapon against a single enemy type must already feel good in P2/P3 before the roster grows. Test feel on both keyboard and touch.
**Phase:** P2, P3, P5.

### Pitfall 27: Stale deploys and service-worker cache traps

**What goes wrong:** A service worker added to speed up repeat loads serves old bundles after a fix, or a first-visit reload loop appears (for example with `coi-serviceworker`).
**Prevention:** Version the cache, `skipWaiting`/`clientsClaim` consciously, show the build version on the title screen, and test upgrade paths. Skip the service worker unless load times demand it.
**Phase:** P1, P8.

---

## Minor Pitfalls

### Pitfall 28: Z-fighting and depth precision in the tilted view
**What goes wrong:** Overlapping ground layers and decals flicker. **Prevention:** Tight near/far planes, polygon offset or render order for decals, depth writes off for effects.

### Pitfall 29: Text/HUD rendering cost
**What goes wrong:** Redrawing HUD text or a canvas-2D texture every frame is costly and allocates. **Prevention:** HTML/CSS overlay for HUD updated only on value changes, or a bitmap font in the renderer.

### Pitfall 30: Pause menu and focus edge cases
**What goes wrong:** Keys held at pause become stuck, or the pause overlay gets touches meant for the game. **Prevention:** Clear input on state changes; separate input contexts per game state.

### Pitfall 31: Keyboard ghosting and conflicting directions
**What goes wrong:** Some keyboards drop key combinations (for example fire plus two directions), and opposing directions (left+right) must resolve predictably. **Prevention:** Offer alternate bindings, resolve opposing keys to neutral, and do not require more than 3 simultaneous keys.

### Pitfall 32: Photosensitivity and accessibility
**What goes wrong:** Bomb and explosion white flashes at high frequency. **Prevention:** Limit flash frequency and amplitude, provide reduce-effects and reduce-shake toggles.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| One Python object per bullet/particle | Fast to write | GC pauses, slow loops, hard to batch to GPU (Pitfalls 3, 4) | Only in the P1 throwaway spike |
| Calling three.js (or any JS lib) objects directly from Python per entity | Quick demo | Boundary overhead, rewrite of render path (Pitfall 1) | Never |
| Variable timestep "for now" | Simplest loop | Non-deterministic patterns, tunnelling, later rewrite of all timers (Pitfall 5) | Never; fixed step is cheap on day one |
| Time-based (seconds) cooldowns and timers | Intuitive | Frame-rate-dependent fairness, breaks replays | Never in the sim; UI animations only |
| Mesh bounds as hurtbox | No extra work | Unfair deaths (Pitfall 13) | Never |
| Hard-coded waves and boss phases in Python code | Fast first stage | Scope explosion (Pitfall 16) | Only for the very first throwaway enemy |
| Full-res Gaussian bloom | Looks great on desktop | Phones throttle (Pitfall 9) | Only as the High tier, never the default |
| Skipping real-device testing until the end | More dev time early | Late discovery of the architecture-level mobile limits | Never; get a phone build in P1 |
| Relying on SharedArrayBuffer or workers | Cleaner threading | Breaks on GitHub Pages/Safari/itch.io iframe (Pitfall 8) | Only behind a feature check with a working fallback |
| Loading NumPy for convenience | Vectorised maths | +several MB startup, small-array overhead (Pitfalls 4, 6) | Only if measured to win on a phone |
| Generating meshes and textures with Python loops at startup | No JS code | Slow startup on phones (Pitfalls 6, 15) | OK for a handful of small meshes; measure |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Pyodide `js` bridge | Per-entity property writes; `create_proxy` inside the frame | One snapshot buffer per frame, one persistent tick proxy (Pitfalls 1, 2) |
| Pyodide buffers | `toJs()` on big arrays (copies) or caching `getBuffer()` views across frames | `getBuffer()` zero-copy, re-acquired each frame, `release()` after (Pitfall 23) |
| WebGL context | Assuming it lives forever; drawing buffer resized on every resize event | Context-loss handlers, regenerate from CPU data, debounced resize (Pitfall 10) |
| WebAudio | Created before a gesture, scheduled from the frame loop | Resume inside touchend/click, schedule with `currentTime` in JS (Pitfall 7) |
| CDN-hosted Pyodide | Unpinned version, mixing with COEP isolation | Exact version pin, CORS-friendly CDN, no COEP unless needed (Pitfall 8) |
| localStorage | Unguarded access, no schema version | try/except, in-memory fallback, versioned JSON (Pitfall 18) |
| GitHub Pages | Expecting header control or cache control | Hashed filenames, no SAB dependency, or use a header-capable host (Pitfall 8) |
| itch.io iframe | Assuming fullscreen, storage, and SAB behave as on the open web | Test inside the iframe; treat as secondary distribution (Pitfalls 8, 18) |
| Keyboard input | `event.key` and no `preventDefault` | `event.code`, block page scroll keys, clear on blur (Pitfall 14) |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Per-entity FFI writes | Frame time linear in entity count | Batched snapshot buffer | About 100 to 200 entities on desktop, far fewer on phones (est.) |
| Naive O(N x M) collision | Tick time spikes in dense fights | Grid/sort plus AABB reject, hurtbox-only tests for enemy bullets | About 200 bullets x 30 enemies (est.) |
| Python-simulated particles | Explosions drop fps | GPU/analytic particles, spawn events only | Over about 100 live particles in Python (est.) |
| Python GC pauses | Periodic stutter, fine average fps | Pools, `gc.freeze()` and `gc.disable()` in play | After a minute of play with churn |
| Full-res bloom plus overdraw | fps tracks resolution | Half/quarter-res chain, DPR cap, dynamic resolution | Any phone with DPR 3 |
| Per-frame proxy creation | Memory climbs, eventual tab kill | Single persistent proxies | Within 10 to 20 minutes |
| Mesh generation at load | Long black screen | Lazy per stage, once, or JS-side | Dozens of enemy types on phones |
| Many audio voices | Crackle, GC churn | Voice cap, rate limit, pooling | Rapid-fire weapons |
| Thermal throttling | Smooth for 30 s, then drops | 5+ minute sustained tests, auto quality tier | Mid-range phones within minutes |
| HUD text rebuilt every frame | GC and texture upload per frame | Update on change only | Always, but visible on phones |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Loading Pyodide or scripts from an unpinned CDN URL | Supply-chain change breaks or alters the game for all players | Pin exact versions; consider Subresource Integrity on the loader script; self-host if tolerance for CDN risk is low |
| Trusting `localStorage` high-score data (JSON parse and use) | Malformed or tampered data crashes the game | Validate and clamp on load; try/except with defaults (low risk, friends-only game) |
| Enabling COOP/COEP via a service worker blindly | Breaks third-party embeds and may cause a reload loop | Avoid the need (Pitfall 8); if used, document and test |
| Third-party embed or analytics scripts | Unnecessary attack surface and COEP conflicts | None for v1 |
| Cheating/online scores | Not applicable (no server) | Out of scope per PROJECT.md |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Blank screen during load | Visitors leave before the game starts | Immediate title screen with a real progress bar; "tap to start" doubles as audio unlock |
| No sound on iPhone, no explanation | Players think the game is broken | Visible mute state and a ringer-switch hint (Pitfall 7) |
| Page scrolls or zooms during play | Lost runs, frustration | `touch-action: none`, overscroll off, gesture blocking (Pitfall 14) |
| Finger covers the ship; button in OS-gesture zone | Imprecise control | Offset relative drag, safe-area-aware bomb button |
| Death from bullets that blend into fire | "Unfair" | Palette rule and bullet render pass (Pitfall 11) |
| Power loss spiral | Quit after one bad death | Partial drop plus recovery pickups (Pitfall 17) |
| No visible hurtbox cue | Cannot learn the threshold | Small core marker, optionally always-on setting |
| No pause on blur | Died while on another tab | Auto-pause (Pitfall 18) |
| No performance/quality option | Unplayable on weak phones | Quality tier menu plus auto-detect (Pitfall 9) |
| Landscape desktop shows tiny vertical strip | Poor first impression | Fixed-aspect letterbox with side-margin HUD (Pitfall 12) |

## "Looks Done But Isn't" Checklist

- [ ] **Game loop:** Fixed 60 Hz sim verified on 30 fps (iOS Low Power Mode) and 144 Hz displays, with clamped catch-up and tab-return test.
- [ ] **FFI contract:** Per-frame crossings counted and under budget; no `create_proxy` inside the frame path; soak test shows flat memory over 15 minutes.
- [ ] **GC:** Steady-state allocations per tick are zero; p99 frame time recorded on a phone.
- [ ] **Performance:** Worst-case scene (boss plus explosions plus busiest background) measured on a mid-range phone for 5+ minutes sustained.
- [ ] **Hosting:** Build uploaded to the real host; `.wasm` served as `application/wasm`; no CORS/COEP errors; old caches invalidated after a redeploy.
- [ ] **iOS audio:** Sound works after tap-to-start, after lock/unlock, with the ringer switch both ways.
- [ ] **iOS viewport:** No scroll/zoom/long-press callout; safe areas respected; bomb button reachable; fullscreen absence handled.
- [ ] **Bullet readability:** Verified in a screenshot of the worst-case scene at the lowest quality tier; colour-blind check on bullet vs background palette.
- [ ] **Hitboxes:** Hurtbox visibly smaller than the ship, fast bullets swept, death-bomb grace window works.
- [ ] **Pause/blur:** Auto-pause on hide, input cleared, audio suspended, time baseline reset, WebGL context loss restored.
- [ ] **Persistence:** High scores survive reload, fail gracefully when storage is blocked (private mode, iframe).
- [ ] **Boss:** Phase transitions clear bullets, no soft-lock, timeout failsafe, death sequence awards points.
- [ ] **Keyboard:** Works on AZERTY (uses `event.code`), no page scroll on arrows/space, no stuck keys after alt-tab.
- [ ] **Error handling:** An exception in `tick()` shows an on-screen report instead of a frozen canvas.
- [ ] **Accessibility:** Reduce shake/flash toggles; flash frequency limited.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Per-entity FFI (1) | HIGH | Introduce the snapshot buffer and instanced renderer; rewrite the render adapter; sim state to struct-of-arrays |
| Proxy leaks (2) | LOW | Centralise all JS callbacks in a platform wrapper, replace per-frame proxies with persistent ones, add the soak test |
| GC pauses (3) | MEDIUM | Introduce pools for the hottest object types first (bullets, particles), `gc.freeze()` plus phase-scoped collections |
| Python too slow (4) | MEDIUM to HIGH | Move particles/trails to GPU, make bullet motion analytic, reduce caps, then consider vectorising hot loops |
| Variable timestep (5) | HIGH | Convert all timers to ticks and the loop to fixed-step; every tuned value changes meaning, so do it before content exists |
| Large download (6) | MEDIUM | Drop packages, ship pre-compiled zip, change CDN, add progress UI, lazy-load stage assets |
| iOS audio (7) | LOW | Add the gesture unlock and statechange handlers; JS-side scheduling |
| Hosting headers (8) | LOW to MEDIUM | Move to a header-capable host or remove the SAB dependency; adding hashed filenames is cheap |
| Fill-rate (9) | MEDIUM | Add dynamic resolution and a lighter bloom chain; cut particle sizes; add quality tiers |
| Bullet readability (11) | MEDIUM | Re-palette bullets, add a bullet pass, dim backgrounds; avoid regenerating all stages by parameterising palette early |
| Hitbox complaints (13) | LOW | Shrink the hurtbox, add swept tests and grace windows |
| Scope creep (16) | MEDIUM | Cut to 3 stages, reuse bosses with re-skinned phases, ship the vertical slice |
| Difficulty (17) | LOW to MEDIUM | Add multipliers and the softened power loss; replay-based tuning |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1 Per-entity FFI | P1, P3 | Synthetic 500-instance spike under frame budget on a phone; crossings per frame logged |
| 2 PyProxy leaks | P1, P8 | 15-minute autoplay soak with a flat heap graph |
| 3 GC pauses | P2, P8 | Zero steady-state allocs; p99 frame time budget met on device |
| 4 Per-frame Python cost | P1, P2, P4 | Tick-time budget (for example 4 ms) held at peak pattern density on a mid-range phone |
| 5 Timestep and death spiral | P2, P8 | Same behaviour at 30/60/120/144 Hz and after tab return |
| 6 Startup/bundle | P1, P8 | Time-to-title measured on throttled 4G and a real phone against budget |
| 7 iOS audio | P1 (gate), P6 | Real iPhone: sound after tap, after lock, ringer on/off |
| 8 Hosting/SAB/MIME | P1, P8 | Deploy smoke test on the real host; no console errors; update test |
| 9 Fill-rate | P3, P8 | Sustained 5 min on mid-range phone at default tier |
| 10 Precision/context loss | P3, P8 | `WEBGL_lose_context` test; visual diff desktop vs phone |
| 11 Bullet readability | P3, P5, P7 | Worst-case screenshot review; playtester "couldn't see it" count |
| 12 Camera vs plane | P2, P3 | Bounds projection test; same visible field across aspect ratios |
| 13 Hitboxes/tunnelling | P2, P4, P8 | Unit tests for swept collision; replay of near-miss cases |
| 14 Input/touch UX | P2, P8 | Real-device touch checklist; latency probe; AZERTY test |
| 15 Cheap procedural models | P3, P4, P7 | Model-viewer review against the art-direction sheet |
| 16 Content scope | P4, P5, P7 | Vertical-slice gate before stage 2; boss defined as data |
| 17 Difficulty | P4, P5, P8 | Tuning table; friend playtest death heatmap |
| 18 Blur/pause/storage | P2, P6, P8 | Tab switch, app switch, private-mode tests |
| 19 iPhone fullscreen/viewport | P1, P8 | iPhone Safari and standalone-mode check |
| 20 Testing | P1, P2, P8 | Core runs under pytest natively; replay tests green; overlay and error screen present |
| 21 Engine choice | P1 | Documented spike results before committing |
| 22 Exceptions/asyncio | P1 | Fault-injection test shows error overlay |
| 23 WASM memory views | P1, P2 | Test that forces heap growth mid-run |
| 24 Pools/lifecycle | P2, P4, P5 | Entity-count assertions in debug builds; boss soft-lock tests |
| 25 Colour pipeline | P3 | Reference test scene on all tiers |
| 26 Feel deferral | P2, P3, P5 | Feel gate on the first weapon/enemy before roster growth |
| 27 SW cache traps | P1, P8 | Redeploy-with-old-client test |

## Sources

- Pyodide documentation, type conversions page (https://pyodide.org/en/stable/usage/type-conversions.html): create_proxy / destroy, `toJs` proxy creation, `getBuffer` zero-copy and `release()`; large-buffer `toJs` warning (HIGH, official docs).
- PyScript FFI documentation (https://docs.pyscript.net/latest/user-guide/ffi) and polyscript PR discussion (https://github.com/pyscript/polyscript/pull/79): lifetime of Python callbacks given to JS, `create_once_callable`, interval/listener leak concerns, and MicroPython's lack of explicit proxy destroy (MEDIUM; the PR is a contributor discussion).
- Pyodide 0.23 release notes (https://blog.pyodide.org/posts/0.23-release/): about 5.3 MB Brotli core+stdlib and 0.9 to 1.3 s init on a fast connection (MEDIUM; older release, re-measure on the pinned version).
- Pyodide 314 release (https://blog.pyodide.org/posts/314-release): versioning now follows Python (314.x is Python 3.14), 314.0.0 dated 2026-06-09 (MEDIUM, via search summary).
- itch.io forum, "experimental SharedArrayBuffer support" (https://itch.io/t/2025776/experimental-sharedarraybuffer-support) and related threads: opt-in checkbox, Safari and embed problems (MEDIUM; community and 2022 announcement, confirm current behaviour).
- coi-serviceworker (https://npmjs.org/package/coi-serviceworker) and Wasmer COOP/COEP guide (https://docs.wasmer.io/sdk/wasmer-js/how-to/coop-coep-headers): service-worker workaround for header-less hosts such as GitHub Pages, same-origin requirement, first-load reload (MEDIUM).
- Web Audio on iOS: Matt Montag unlock boilerplate (https://www.mattmontag.com/web/unlock-web-audio-in-safari-for-ios-and-macos), WebKit bug 149367 (https://bugs.webkit.org/show_bug.cgi?id=149367), Apple developer forums thread 48815 (https://developer.apple.com/forums/thread/48815): suspended-until-gesture, touchend/click reliability, silent switch muting (MEDIUM).
- WebKit Bugzilla 206854 (https://www2.webkit.org/show_bug.cgi?id=206854) and Apple developer forums thread 133248: iPhone has no Fullscreen API for non-video elements; briefly enabled then disabled in 17.2 betas; Add to Home Screen as workaround (MEDIUM).
- Game-loop guidance on rAF throttling in hidden tabs, delta clamping and fixed-timestep accumulator (https://bugnet.io/blog/how-to-fix-web-game-tab-throttling-backgrounded and similar; LOW to MEDIUM, practitioner articles; the pattern itself is standard).
- Engineering judgement (LOW until measured): all "(est.)" cost thresholds, GC pause magnitudes, iOS Low Power Mode 30 fps cap, `navigator.audioSession`, Safari storage eviction, Panda3D/pygbag suitability, `desynchronized` canvas hint, and genre conventions for hurtbox size, death-bomb windows and rank systems. Verify each in the P1 spike or the relevant phase research.

---
*Pitfalls research for: browser 3D shmup with Python-in-WASM game logic (Scorched)*
*Researched: 2026-10-17*
