# Architecture Research

**Domain:** Browser 3D-rendered, 2D-gameplay vertical shmup (Raiden-style); Python game logic in Pyodide (WASM) + JS/WebGL (three.js) renderer
**Researched:** 2026-10-17
**Confidence:** MEDIUM-HIGH (genre structure and boundary design are well-established; Pyodide per-frame cost on phones is NOT measured anywhere public and must be spiked)

## Headline Decisions

1. **Python is the simulation authority; JS is presentation.** Anything that can change a gameplay outcome (positions, hits, HP, scoring, spawning, RNG, scene flow, high-score rules) lives in pure Python. Anything cosmetic (particles, bloom, camera shake, audio synthesis, terrain, meshes, DOM HUD) lives in JS. Rule of thumb: *if it can't affect the score or whether you die, it does not belong in Python.*
2. **One boundary crossing per frame.** JS calls a held Python function `tick(dt_ms, buttons, ax, ay)` once per `requestAnimationFrame`; Python runs 0..N fixed 60 Hz steps internally and copies fixed-size render buffers into pre-allocated JS typed arrays. JS never calls into Python mid-frame, and Python never calls JS mid-step.
3. **Pooled struct-of-arrays for high-count dumb things (bullets), plain `__slots__` objects for low-count smart things (enemies, boss, player).** No ECS framework.
4. **Particles are not simulated in Python.** Python emits semantic events (`EXPLOSION(size)`, `HIT_SPARK`, `SFX(id)`, `SHAKE`); JS owns the particle system.
5. **Pure-Python core with zero `js`/`pyodide` imports**, tested headlessly with pytest. A thin adapter module is the only Pyodide-aware Python code.
6. **Copy, don't alias, at the boundary (default).** Use fixed-capacity buffers and `JsBuffer.assign()` into JS-owned typed arrays rather than long-lived zero-copy `getBuffer()` views, because views over the WASM heap can be detached when WASM memory grows. Zero-copy is an optimization to adopt only if profiling shows the copy matters (at ~10-60 KB/frame it almost certainly will not).
7. **Run Pyodide on the main thread for v1** (static hosting cannot set COOP/COEP headers, so no `SharedArrayBuffer`), but keep the boundary message-shaped (flat primitives in, flat buffers out) so a Web Worker move stays possible if Python+render time blows the 16.7 ms frame on phones.

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         JS / BROWSER (presentation)                      │
│                                                                          │
│  ┌─────────┐  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌───────────┐   │
│  │ Input   │  │ Frame    │  │ Renderer  │  │ FX       │  │ Audio     │   │
│  │ keys +  │  │ Loop     │  │ three.js  │  │ particles│  │ WebAudio  │   │
│  │ touch   │  │ rAF      │  │ instanced │  │ shake    │  │ synth +   │   │
│  │ → bits  │  │ (clock)  │  │ meshes,   │  │ bloom    │  │ sequencer │   │
│  │ + axes  │  │          │  │ terrain,  │  │ flashes  │  │           │   │
│  └────┬────┘  └────┬─────┘  │ camera    │  └────▲─────┘  └─────▲─────┘   │
│       │            │        └─────▲─────┘       │ events       │ events  │
│       │            │              │ buffers     │              │         │
│  ┌────▼────────────▼──────────────┴─────────────┴──────────────┴──────┐  │
│  │              Bridge (JS side): loader, tick(), buffer views,       │  │
│  │              event drain, DOM HUD diff, localStorage adapter       │  │
│  └─────────────────────────────┬──────────────────────────────────────┘  │
└────────────────────────────────┼─────────────────────────────────────────┘
        tick(dt, buttons, ax, ay) │ ▲ int event_count
        ─────────────────────────▼─┴── buffers copied via JsBuffer.assign()
┌────────────────────────────────┼─────────────────────────────────────────┐
│                  PYTHON in Pyodide (simulation authority)                │
│  ┌─────────────────────────────▼──────────────────────────────────────┐  │
│  │ api.Game facade: tick(), manifest(), snapshot → render buffers     │  │
│  │ (+ adapter: pyodide_adapter.py is the ONLY module that imports js) │  │
│  └─────────────────────────────┬──────────────────────────────────────┘  │
│  ┌─────────────────────────────▼──────────────────────────────────────┐  │
│  │ Scene stack: Title | Play | Pause | Continue | GameOver | NameEntry│  │
│  └─────────────────────────────┬──────────────────────────────────────┘  │
│  ┌─────────────────────────────▼──────────────────────────────────────┐  │
│  │ Play scene → World (fixed 60 Hz step)                              │  │
│  │ ┌────────┐ ┌─────────┐ ┌──────────┐ ┌───────────┐ ┌─────────────┐  │  │
│  │ │ Player │ │ Weapons │ │ Stage    │ │ Enemies + │ │ Collision   │  │  │
│  │ │ + bombs│ │ + pickups│ │ timeline │ │ boss FSM  │ │ + scoring   │  │  │
│  │ └────────┘ └─────────┘ └──────────┘ └───────────┘ └─────────────┘  │  │
│  │ ┌──────────────────────────────────────────────────────────────┐   │  │
│  │ │ Pools (SoA bullets, object pools), seeded RNG, event queue   │   │  │
│  │ └──────────────────────────────────────────────────────────────┘   │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────┐ ┌──────────────────────────────────────────┐   │
│  │ Services (pure):     │ │ Content (data + generator scripts):      │   │
│  │ HighScores, Settings │ │ kinds, stages, patterns, bosses          │   │
│  │ KeyValueStore proto  │ │                                          │   │
│  └──────────────────────┘ └──────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Frame loop (JS)** | Owns wall clock. One rAF callback: sample input, call `tick`, consume buffers + events, render. Clamps dt, auto-pauses on `visibilitychange`/blur. | ~60 lines of JS; no accumulator logic (that is in Python so it is testable) |
| **Input (JS)** | Normalize keyboard + touch into `buttons` bitmask + analog move vector `(ax, ay)` in [-1, 1]. Latch edge presses between frames. | `KeyboardInput`, `TouchInput` classes behind one `sample()` |
| **Fixed-step runner (Py)** | Accumulator: `acc += min(dt, 100ms)`; run `while acc >= STEP` (max 3 steps); apply input edges on first step only. | `core/clock.py`, pure, unit-testable with synthetic dt sequences |
| **Scene stack (Py)** | Title/Play/Pause/Continue/GameOver/NameEntry transitions; owns which scene is `update`d and what the JS UI should show. | Small class-based state machine with push/pop (Pause pushes over Play) |
| **World (Py)** | Per-step orchestration in fixed order: input → player → stage timeline spawns → enemy scripts → bullets → collisions → pickups/scoring → cleanup → events. | One `World.step()` method; systems are plain functions/classes called in order |
| **Pools (Py)** | Fixed-capacity storage, no per-tick allocation. SoA `array('f')` columns for bullets; reusable `__slots__` objects for enemies/pickups. | `core/pools.py` (swap-remove compaction for SoA) |
| **Collision (Py)** | Circle-vs-circle with layer bitmasks; player hitbox tiny; optional spatial grid behind an interface. | `sim/collision.py` |
| **Content scripts (Py)** | Stage timelines (data), enemy behavior + bullet patterns (generators), boss phases. | `content/` package; the only place design iteration happens |
| **Services (Py)** | High-score table rules, settings, `KeyValueStore` protocol. Pure logic, injected storage. | `services/` |
| **Adapter (Py)** | The *only* Python module touching `js`/`pyodide.ffi`: wraps `JsBuffer.assign`, `localStorage` as a `KeyValueStore`. | `bridge/pyodide_adapter.py` |
| **Bridge (JS)** | Load Pyodide, unpack Python zip, hold `tick` proxy, allocate typed arrays, read manifest, drain events, diff HUD state. | `web/src/bridge/` |
| **Renderer (JS)** | Scene, tilted fixed camera, lighting, InstancedMesh per entity kind, terrain, post-processing, coordinate mapping. | three.js; `web/src/render/` |
| **Model factory (JS)** | Procedural ships/tanks/turrets/props as merged `BufferGeometry` with vertex colors, built once at boot per kind. | `web/src/render/models/*.js` |
| **FX (JS)** | Event → particles, flashes, camera trauma/shake, bloom intensity pulses. Visual-only, variable dt, non-deterministic is fine. | GPU-instanced particles with a pooled ring buffer |
| **Audio (JS)** | WebAudio synthesized SFX (pre-rendered AudioBuffers), music sequencer, voice limiting, gesture unlock. | `web/src/audio/` |
| **UI/HUD (JS)** | DOM/CSS overlay for HUD, menus, touch buttons, driven by a small "ui snapshot" Python emits only when changed. | Plain DOM; no framework needed |

## Recommended Project Structure

```
scorched/
├── pyproject.toml                  # pytest + ruff config; Python version pinned to Pyodide's
├── src/scorched/                   # PURE PYTHON. Shipped to Pyodide verbatim. stdlib only.
│   ├── api.py                      # Game facade: tick(), manifest(), buffers. JS's only entry point.
│   ├── protocol.py                 # Buffer strides/offsets, event type ids, button bits, kind ids
│   ├── core/
│   │   ├── clock.py                # FixedStepRunner (accumulator, max-steps clamp)
│   │   ├── rng.py                  # Single seeded random.Random wrapper (determinism)
│   │   ├── pools.py                # SoA pool (swap-remove) + object pool
│   │   ├── events.py               # Event ring buffer (array('f'), stride 6)
│   │   ├── input.py                # InputState, edge detection
│   │   └── geometry.py             # Logical playfield constants, clamp helpers
│   ├── sim/
│   │   ├── world.py                # World.step() orchestration
│   │   ├── player.py               # Movement, focus hitbox, death/respawn/invuln
│   │   ├── bullets.py              # SoA bullet pools (player / enemy)
│   │   ├── weapons.py              # Vulcan / laser / homing + level tables
│   │   ├── pickups.py              # Colored weapon pickups, medals, bomb/life
│   │   ├── bombs.py                # Screen clear + invulnerability window
│   │   ├── enemies.py              # Enemy object pool + script runner
│   │   ├── collision.py            # Circle tests, layer masks, (optional) grid
│   │   └── scoring.py              # Points, medals, stage-clear bonus, extends
│   ├── content/
│   │   ├── kinds.py                # Enemy/bullet/pickup kind table (hp, radius, score, layer)
│   │   ├── patterns.py             # Reusable emitters: aimed, spread, ring, spiral (generators)
│   │   ├── behaviors.py            # Reusable enemy movement generators (zigzag, strafe, dive)
│   │   ├── stages/stage1.py ...    # Timeline data per stage
│   │   └── bosses/boss1.py ...     # Phase lists + part layouts
│   ├── scenes/
│   │   ├── base.py                 # Scene protocol: update(input), ui_state(), on_enter/exit
│   │   ├── title.py  play.py  pause.py  continue_.py  gameover.py  name_entry.py
│   └── services/
│       ├── storage.py              # KeyValueStore Protocol + MemoryStore (tests)
│       ├── highscores.py           # Insert/sort/trim/validate/serialize
│       └── settings.py
├── bridge/
│   └── pyodide_adapter.py          # ONLY file importing js / pyodide.ffi (tested with fakes)
├── web/
│   ├── index.html
│   └── src/
│       ├── main.js                 # Boot sequence, loading screen
│       ├── loop.js                 # rAF, dt clamp, visibility pause
│       ├── bridge/                 # pyodide-loader.js, buffers.js, events.js
│       ├── input/                  # keyboard.js, touch.js, sample.js
│       ├── render/
│       │   ├── scene.js camera.js lights.js postfx.js
│       │   ├── mapping.js          # logical (x,y,layer) → world; layer parallax scale
│       │   ├── instances.js        # InstancedMesh registry per kind
│       │   ├── terrain/            # chunk ring, procedural generators
│       │   └── models/             # ship.js tank.js turret.js boss.js props.js
│       ├── fx/                     # particles.js shake.js flashes.js
│       ├── audio/                  # synth.js sfx.js music.js unlock.js
│       └── ui/                     # hud.js menus.js touch-controls.js
├── tests/
│   ├── unit/                       # pools, collision, patterns, scoring, highscores
│   ├── scripted/                   # run N seconds with an input script, assert outcomes
│   ├── determinism/                # same seed + input log ⇒ identical state hash
│   ├── bridge/                     # adapter + buffer-layout tests with fake sinks
│   └── e2e/                        # Pyodide-in-Node / Playwright smoke tests
└── tools/
    └── build_pyzip.py              # zip src/scorched → dist/scorched.zip
```

### Structure Rationale

- **`src/scorched/` has no `js` imports, enforced by a test** (grep/AST check in `tests/`). This is what makes pytest-without-a-browser real. If anything in `src/` needs the browser, it takes an injected protocol object (`KeyValueStore`, a buffer sink), never an import.
- **`protocol.py` is the single source of truth for the boundary.** JS fetches strides, offsets, event ids and the kind manifest from Python at boot (`game.manifest()` → `to_js`) rather than duplicating constants. Drift becomes a boot-time assertion failure instead of a silent rendering bug.
- **`content/` is separated from `sim/`** so stage/enemy/boss design iteration (the bulk of the work after the engine exists) never touches engine code.
- **`bridge/` is outside `src/`** so the adapter is visibly the one impure Python file and can be excluded from the shipped zip in test builds.
- **`render/mapping.js` is its own file** because the logical-to-world mapping (including per-layer parallax compensation) is the thing most likely to be wrong and most worth testing in isolation.

## Architectural Patterns

### Pattern 1: Frame-locked fixed-step simulation, accumulator in Python

**What:** Arcade shmups run logic at a fixed 60 Hz (everything is "per tick": speed in units/tick, cooldowns in ticks). The simulation is frame-locked, not dt-scaled. Python owns the accumulator so the exact stepping logic is unit-testable.
**When to use:** Always for this game. Fixed step gives determinism (replays, tests) and makes bullet patterns identical on every device.
**Trade-offs:** On 120/144 Hz displays the runner yields step counts like 1,0,1,0 and the ship moves in visible 60 Hz increments unless the renderer interpolates. v1: render latest state (simplest). Later: keep two snapshots (prev/curr) and lerp in JS using a `alpha` float the tick returns. Max-3-steps clamp prevents the spiral of death on a slow phone (game slows down instead of freezing, which is also the arcade behavior).

```python
# core/clock.py
STEP_MS = 1000.0 / 60.0
MAX_STEPS = 3

class FixedStepRunner:
    def __init__(self, step_fn):
        self.step_fn = step_fn
        self.acc = 0.0

    def advance(self, dt_ms: float, inp) -> int:
        self.acc += min(dt_ms, 100.0)          # clamp tab-switch / GC hiccups
        steps = 0
        while self.acc >= STEP_MS and steps < MAX_STEPS:
            self.step_fn(inp if steps == 0 else inp.without_edges())
            self.acc -= STEP_MS
            steps += 1
        if steps == MAX_STEPS:
            self.acc = 0.0                      # drop backlog: slow-down, not spiral
        return steps
```

### Pattern 2: SoA pool for bullets, `__slots__` objects for enemies

**What:** Bullets (hundreds, trivial behavior) are stored as parallel `array('f')` columns (`x`, `y`, `vx`, `vy`, plus small `kind`/`flags` arrays) with swap-remove compaction, so live bullets are always `[0, count)`. Enemies, bosses, pickups (tens, rich behavior) are pooled `__slots__` objects. At end of tick, columns are packed into an interleaved render buffer with **C-speed strided slice assignment**.
**When to use:** Bullets as SoA is the default; any "smart" bullet (homing missile, laser beam, bouncing) is promoted to an object type with its own small pool.
**Trade-offs:** SoA is less ergonomic than `Bullet` objects, but the pack-to-render step becomes a handful of C-level slice copies instead of an N-iteration Python loop, and no per-bullet allocation means no GC pressure. ECS is rejected: its generality costs Python-level indirection for a game with ~6 entity types. Verified locally (CPython 3.12 native): integrate 400 bullets = 0.08 ms/tick; pack = 0.002 ms. Pyodide will be several times slower than native; treat 0.3-1 ms for 400 bullets as the planning figure, to be confirmed in the spike.

```python
# core/pools.py (sketch)
from array import array

class BulletPool:
    __slots__ = ("cap", "n", "x", "y", "vx", "vy", "kind")
    def __init__(self, cap):
        self.cap, self.n = cap, 0
        z = bytes(4 * cap)
        self.x, self.y, self.vx, self.vy = (array('f', z) for _ in range(4))
        self.kind = array('B', bytes(cap))

    def spawn(self, x, y, vx, vy, kind) -> bool:
        i = self.n
        if i >= self.cap:
            return False                      # hard cap: patterns must tolerate refusal
        self.x[i], self.y[i], self.vx[i], self.vy[i], self.kind[i] = x, y, vx, vy, kind
        self.n = i + 1
        return True

    def kill(self, i):                        # swap-remove; caller iterates backwards
        last = self.n - 1
        if i != last:
            self.x[i], self.y[i] = self.x[last], self.y[last]
            self.vx[i], self.vy[i] = self.vx[last], self.vy[last]
            self.kind[i] = self.kind[last]
        self.n = last

    def pack_into(self, buf, stride=4):       # buf: array('f') sized cap*stride
        n = self.n
        buf[0:n*stride:stride]   = self.x[:n]
        buf[1:n*stride:stride]   = self.y[:n]
        # kind/angle columns packed the same way
```

Starting caps (90s Raiden pacing, not bullet hell): enemy bullets 300, player bullets 128, enemies 48, pickups 16. Caps are a design parameter that directly buys mobile performance.

### Pattern 3: Generators as scripts (enemy behavior, bullet patterns, boss phases)

**What:** Each enemy gets a Python generator; `yield n` means "wait n ticks". Patterns are composable sub-generators (`yield from fire_spread(e, count=5, arc=40)`). Stage progression itself is *data* (a sorted timeline), but per-entity behavior is code.
**When to use:** For anything time-sequenced per entity. Python generators are the idiomatic equivalent of the coroutine/bytecode scripting that arcade shmups and engines like BulletML implement; this is Python's natural strength.
**Trade-offs:** Generators cannot be pickled, so no mid-run save-state (not needed; replays use seed + input log). Cost is one `next()` per live scripted entity per tick (≤48), negligible. Cycles between enemy objects and their generators need the GC story below.

```python
# content/behaviors.py
def wait(n):
    for _ in range(n):
        yield

def tank_script(e, world):
    yield from move_to(e, e.x, e.y + 60, speed=0.4)
    while True:
        yield from patterns.aimed(e, world, kind=B_SHELL, speed=2.2)
        yield from wait(90)
```

### Pattern 4: Scroll-synced stage timeline (data) + world-anchored ground objects

**What:** One stage clock: `scroll` (logical units advanced per tick, optionally changed by script commands). A stage is a sorted list of triggers keyed on `scroll`, e.g. `(520, spawn("jet_v", x=60, script=zigzag))`. Ground enemies are placed at world-y so they scroll *with* the terrain; air enemies enter at the top edge when triggered. A cursor index advances through the list; no per-tick scanning.
**When to use:** All stages. Keying on scroll rather than wall time keeps ground targets locked to terrain and survives pause/hitstop/slow-down.
**Trade-offs:** Variable-speed scroll (boss approach, slowdowns) requires triggers to be scroll-based and the boss fight to switch to a *time*-based clock for its own phases. Keep both clocks explicit (`stage.scroll`, `boss.t`).

```python
# content/stages/stage1.py
TIMELINE = [  # (scroll_y, action...) sorted ascending, validated at import time by a test
    (  0, Spawn("jet_v",   x=40,  script="dive")),
    ( 90, Spawn("tank",    x=120, script="tank", ground=True)),
    (400, Warning("BOSS")),
    (480, SetScroll(0.3)),
    (480, SpawnBoss("boss1")),
]
```

### Pattern 5: Boss = ordered phase list + HP thresholds + hit-circle parts

**What:** A boss is a root object with N parts (each a hit circle with offset, HP, own kind id for rendering) and a list of `Phase(until_hp_fraction, script)` entries. Phase change = clear enemy bullets, emit `SHAKE`/`EXPLOSION` events, swap the running generator, optionally a brief invulnerable transition. Parts destroyed independently (turrets) feed the phase thresholds.
**When to use:** Every stage boss. Explicit phase lists beat a generic FSM library here: the transitions are linear and the interesting part is the per-phase script.
**Trade-offs:** Resist a data-only boss DSL; boss scripts are where hand-written Python pays off. Each part is emitted to JS as an ordinary enemy entry (world position + angle resolved in Python) so the renderer needs no articulation logic.

### Pattern 6: Scene stack with abstract input

**What:** `Scene.update(input) -> None`, `Scene.ui_state() -> small tuple/dict`. A stack: `[Play]` → push `Pause` → pop back. Title → Play → (death with 0 lives) Continue (countdown) → GameOver → NameEntry (if score qualifies) → Title. All scenes consume the *same* abstract input (directions + confirm/fire + bomb + pause), so menus, name entry and gameplay work identically on keyboard and touch.
**When to use:** Always. Pause is pushed by either the pause button or JS's auto-pause (tab hidden) via a `PAUSE` button bit.
**Trade-offs:** Menus in Python means JS UI is a dumb renderer of `ui_state()`. That keeps all flow testable headlessly. Touch name entry (arcade initials with up/down) is awkward; plan a DOM text-input overlay fallback as a UI concern with the same result delivered to Python as a string.

### Pattern 7: Event queue for all transient Python → JS effects

**What:** A preallocated `array('f')` ring (`stride 6`: `type, x, y, a, b, c`), cleared at the start of each `tick`. Events accumulate across the 0..3 steps in that tick. `tick` returns the count. JS drains and dispatches: particles, sounds, shake, flashes, DOM banners.
**When to use:** Explosions, hit sparks, muzzle flash, pickup collected, bomb fired, player death, boss warning, phase change, medal popups, SFX ids, music cue changes.
**Trade-offs:** Events are fire-and-forget: if the JS side drops a frame, effects still fire next frame (don't lose them). Semantic events (`EXPLOSION size=3`) rather than rendering commands keep Python free of visual knowledge. Cap per-tick events (e.g. 128) and merge duplicates (many bullets hitting one enemy → one `HIT_SPARK` batch) to protect both sides.

### Pattern 8: Logical-to-world mapping with per-layer parallax compensation

**What:** Gameplay lives on a fixed logical playfield (recommended 240 x 320 units, arcade-tate parity; aspect is a design-phase call), origin top-left, y down, scrolling in -y. World mapping: `X = x - W/2`, `Z = y - H/2` (screen-up is -Z in three.js, Y up). With a perspective tilted camera, objects at different altitudes project to shifted screen positions, so hitboxes no longer line up with visuals. Fix: define the playfield at the player's altitude, then for any altitude plane `h`, scale the (X,Z) offset about the camera's ground-projection by `k = (camH - h) / (camH - playerH)`. For a fixed camera `k` is a per-layer constant, so it costs one multiply per axis and makes every entity appear exactly where its hitbox is. Add a blob shadow on the ground under air units (essential depth cue for a tilted view). A narrow FOV (about 25-35 degrees) shrinks the correction and keeps perspective subtle.
**When to use:** Always; do it in the instance shader or the JS write loop, not in Python (Python only knows logical coordinates and a `layer` id).
**Trade-offs:** Slight apparent size difference between layers is a feature (reads as depth). This is derived geometry, not a library feature; validate visually in the first rendering slice. (Confidence MEDIUM: standard similar-triangles math, but untested here.)

### Pattern 9: Terrain as recycled chunks driven by a single scroll value

**What:** Python's snapshot header carries `scroll_y`. JS keeps a ring of ~3 terrain chunks (e.g. 480 units long each) and recycles the one that has passed the camera, regenerating it deterministically from `(stage_id, chunk_index)` as procedural geometry (displaced plane, road/river ribbons, instanced buildings/craters/fires). Alternatively, one big plane with the scroll applied as a shader uniform for cheap stages (desert).
**When to use:** All stages; chunks allow per-stage variety (city, desert, sea) and no unbounded geometry.
**Trade-offs:** v1 terrain is *cosmetic* and generated in JS; ground enemies are placed by logical coordinates and the generator keeps open areas. If tanks must sit exactly on roads later, make a shared stage-layout (Python emits chunk descriptors once per chunk) a deliberate later phase, not an v1 requirement. Build chunk geometry across multiple frames or at stage load to avoid a hitch.

## Data Flow

### Per-Frame Flow (the only hot path)

```
rAF(t)
  │
  ├─ JS Input.sample()      → buttons:int (edges latched), ax, ay in [-1,1]
  │
  ├─ JS tick(dt_ms, buttons, ax, ay)  ═══ single PyProxy call (held reference) ═══►
  │                                     Python:
  │                                       runner.advance(dt)  →  0..3 × World.step()
  │                                         input → player → stage timeline → enemy scripts
  │                                         → bullets move → collisions → pickups/score
  │                                         → emit events
  │                                       snapshot():
  │                                         header  = [scroll, scene_id, counts...]
  │                                         bullets = interleaved array('f')
  │                                         enemies = interleaved array('f')
  │                                         events  = array('f')
  │                                         ui      = changed? small tuple else None
  │                                       js_buf.assign(py_buf)   (memcpy per channel)
  │  ◄═══ returns int (event count) ═════
  │
  ├─ JS update renderer from typed arrays:
  │     bullets: attribute buffer needsUpdate, mesh.count = n   (no per-instance JS loop)
  │     enemies: loop ≤48, setMatrixAt on per-kind InstancedMesh
  │     player mesh, terrain scroll, camera shake offset
  ├─ JS drain events → particles / audio / shake / DOM banners
  ├─ JS HUD diff (only touch DOM if ui state changed)
  └─ JS fx.update(real_dt) ; composer.render()
```

### Buffer Contract (illustrative; owned by `protocol.py`, fetched by JS at boot)

| Channel | Layout (float32, fixed capacity) | JS consumer |
|---------|----------------------------------|-------------|
| `header` | `[scroll_y, scene_id, enemy_n, ebullet_n, pbullet_n, ev_n, player_x, player_y, player_state, ...]` | Loop / renderer |
| `pbullets` | stride 4: `x, y, angle, kind` (cap 128) | GPU-instanced; `mesh.count = n` |
| `ebullets` | stride 4: `x, y, angle, kind` (cap 300) | GPU-instanced; `mesh.count = n` |
| `enemies` | stride 8: `kind, x, y, angle, hp_frac/flash, scale, layer, spare` (cap 64, includes boss parts) | JS loop → per-kind InstancedMesh |
| `pickups` | stride 4: `kind, x, y, phase` (cap 16) | JS loop |
| `events` | stride 6: `type, x, y, a, b, c` (cap 128) | Event dispatcher |
| `ui` | Small string/tuple only when changed (score, lives, bombs, power, scene-specific text) | DOM HUD |

Prefer a custom shader reading raw `(x, y, angle, kind)` per instance (via `InstancedBufferAttribute`) over writing 16-float `Matrix4`s: Python writes 4 floats not 16, the upload is 4x smaller, and the model matrix is composed on the GPU (including the layer parallax scale). Use `InstancedMesh.setMatrixAt` only for the small enemy/boss set, where a JS loop is cheap.

### Input Flow

```
Keyboard: keydown/keyup ─┐
                          ├─► Input.sample() ─► buttons (FIRE|BOMB|PAUSE|CONFIRM bits, edge-latched)
Touch:   drag Δ (relative)┘                      ax, ay ∈ [-1,1]  (touch: Δ ÷ (max_speed·dt), clamped)
                                                 │
                              tick(dt, buttons, ax, ay)  → Python InputState(+edges)
```

Key detail: **latch press edges in JS between frames** (OR into a `pressed_since_last_sample` mask) so a tap shorter than a frame is never lost. Python derives edges for held buttons itself. Touch uses relative drag (finger delta moves the ship, never an absolute jump), auto-fire, and an on-screen bomb button, all reduced to the same four numbers.

### Persistence Flow

```
Boot:       JS reads localStorage["scorched.v1.hiscores"] ──► passes string to Game(init_blob)
Game over:  Python HighScores.insert(score, name) → serialize → store.set(key, json)
            store = KeyValueStore (adapter wraps js.localStorage; tests use MemoryStore)
```

Wrap all storage in `try/except` (Safari private mode, quota, disabled storage), version the key, tolerate corrupted JSON by discarding it. High-score *rules* (top 10, sort, tie-break, name validation) are pure Python and pytest-covered.

### Boot Flow

```
index.html → loading screen (static HTML, no JS dependency)
  → import three, create renderer, build procedural models (sync, fast)
  → loadPyodide()  (the long pole; show progress)
  → fetch scorched.zip → pyodide.unpackArchive(buf, "zip") → add dir to sys.path
  → game = pyodide.pyimport("scorched.api").make_game(storage_adapter, seed)
  → manifest = game.manifest().toJs()  → assert every kind has a model recipe (fail fast)
  → allocate typed arrays from manifest layouts; pass them to Python (attach_buffers)
  → hold tick = game.tick (single PyProxy, never recreated)
  → warm-up: run ~120 dummy ticks (forces any WASM heap growth + JIT-ish warm caches)
  → "Tap / press to start" (this gesture unlocks WebAudio) → Title scene
```

## Key Design Decisions (with rationale)

### Entity model: hybrid, not ECS

| Option | Verdict | Why |
|--------|---------|-----|
| ECS framework (esper etc.) | Reject | Component lookups/queries are pure Python indirection on every access; ~6 entity types do not need runtime composition |
| Simple pooled object lists for everything | Fine for enemies only | Per-bullet object iteration plus per-bullet pack loop costs N Python iterations twice per tick |
| SoA `array('f')` columns for bullets | **Use** | Cheap integrate loop, C-speed pack-to-render, zero allocation |
| `__slots__` objects for enemies/boss/pickups/player | **Use** | Readable scripts (`e.x`, `e.hp`), ≤64 live, generators attach naturally |
| numpy | Defer | Adds multi-MB download and a test dependency. Only reconsider if profiling shows bullet integrate/collision dominates, and then only behind the existing pool interface |

### Collision

- **Enemy bullets vs player:** one tiny circle (radius ~2 units, shown only when focused/slow) against ≤300 bullets: a tight loop with bounding early-out; no grid.
- **Player bullets vs enemies:** brute force with an x-reject is 0.25 ms native for 100 x 40 (measured here); even at a 10x WASM penalty that is within budget, so **start brute force, add a uniform grid (cell ~48 units) only if the Pyodide spike shows >2 ms**. Put it behind `CollisionWorld.player_bullets_vs_enemies()` so the swap is local.
- **Layers:** bitmask (`AIR`, `GROUND`, `PLAYER_SHOT`, `ENEMY_SHOT`, `BOSS_PART`). Some weapons (and all bombs) hit ground; some enemy types are ground-only. Ground vs air matters in Raiden-style play.
- **Lasers:** segment/capsule vs circle, handled as a special object type (not in the bullet pool).
- **Circles only.** No SAT, no broadphase library.

### Procedural meshes: build in JS, identify by Python

Models are presentation. Generating them in Python would just ship the same vertex arrays across the boundary once while making startup slower (WASM Python loops). Build merged `BufferGeometry` with vertex colors in JS factories at boot, one per kind, one `InstancedMesh` per kind. Python is the source of truth for the **kind id table** (hp, radius, score, layer, name); JS's `models/` registry must provide a recipe for every manifest kind, checked at boot. Emissive/glow comes from materials + bloom, not geometry detail (matches PROJECT.md).

### Audio

All JS. Synthesize SFX once into `AudioBuffer`s (OfflineAudioContext) so playback is a cheap `BufferSource.start()` with low latency; add per-id throttling (a 30-bullet volley should not start 30 voices) and a global voice cap. Music is a small step sequencer over synthesized instruments, with song data in JS and cue changes driven by `MUSIC(track)` events. First user gesture (the "press to start" screen) calls `audioContext.resume()`; iOS needs this inside a touch handler. `suspend()` on pause/hidden.

## Scaling Considerations

For a single-player static game, "scale" is entities-on-screen and device speed, not users.

| Concern | Desktop target | Mid phone | Low-end phone |
|---------|----------------|-----------|---------------|
| Enemy bullets cap | 300-400 | 250 | 150 (config flag) |
| Python tick (planning budget) | ≤3 ms | ≤6 ms | ≤8 ms |
| Render | full bloom, DPR ≤2 | half-res bloom, DPR ≤1.5 | bloom off or very cheap, DPR 1 |
| Particles | 3-5k GPU | 1.5k | 500 |

### Scaling Priorities

1. **First bottleneck: Pyodide tick cost on phones** (bullet integrate, collisions, generator resumption). Unmeasured publicly; the Phase-0 spike exists to measure it. Levers, in order: lower entity caps, brute-force → grid, reduce per-bullet Python work (precomputed velocity, no per-bullet branching), then optionally numpy for integrate, then Web Worker to overlap Python and render.
2. **Second: GPU fill-rate from bloom/particles/DPR.** Dynamic resolution scaling (drop DPR when frame time exceeds budget), half-res bloom, additive blended particle sprites, a quality setting.
3. **Third: startup time.** Pyodide core download plus init is several MB and multiple seconds on first load (older roadmap figures: about 6.4 MB download, 4-5 s init; numpy adds roughly 2.5-3.6 MB). Skip numpy, show real progress, rely on browser cache, and keep Python source small and zipped.

## Anti-Patterns

### Anti-Pattern 1: Chatty boundary (per-entity calls, per-frame object returns)

**What people do:** Call `js.spawnBullet(...)` from Python per bullet, or return Python lists/dicts/objects from `tick`.
**Why it's wrong:** Each crossing costs proxy creation and conversion; returned Python objects become `PyProxy`s that must be `destroy()`ed or they leak. Per-frame object returns are the classic Pyodide game-loop leak.
**Do this instead:** `tick` returns only an int. All bulk data moves through preallocated, fixed-size typed buffers. Hold a single `tick` proxy for the process lifetime.

### Anti-Pattern 2: `pyodide.runPython("game.tick()")` in the loop

**What people do:** Drive the game with a code string each frame.
**Why it's wrong:** Compiles the string every call; one report measured about 1.2 ms for recompiling a string versus about 0.01 ms for calling an already-compiled function (anecdotal; the direction is clearly right).
**Do this instead:** `const tick = game.tick;` once; call `tick(...)`.

### Anti-Pattern 3: Long-lived zero-copy views over the WASM heap

**What people do:** Cache `getBuffer().data` typed arrays for the lifetime of the game.
**Why it's wrong:** Typed arrays over WASM memory are detached when WASM memory grows; the view silently reads zeros/throws. Python allocating anything mid-game can trigger growth.
**Do this instead:** Default to `JsBuffer.assign()` into JS-owned arrays (safe across growth). If you adopt `getBuffer()` later, re-acquire on detach (`data.byteLength === 0`) and always `release()`.

### Anti-Pattern 4: Python-side particles

**What people do:** Simulate every spark and smoke puff in the Python game loop "because it's the game".
**Why it's wrong:** Thousands of cosmetic entities are the worst case for interpreted-in-WASM code and affect nothing gameplay-relevant.
**Do this instead:** Events with intensity/size; JS particle system with its own pool, GPU instancing, additive blending.

### Anti-Pattern 5: Allocating in the hot loop and ignoring GC

**What people do:** Create tuples/lists/dicts/vector objects per bullet per tick; let CPython's cyclic GC run mid-fight.
**Why it's wrong:** Allocation churn plus cyclic GC passes cause irregular multi-ms spikes, exactly the jitter that wrecks shmup feel. Enemy objects and their generators reference each other (cycles) and only the cycle collector frees them.
**Do this instead:** Pools and preallocated buffers; `gc.disable()` (or `gc.freeze()` after boot plus a high threshold) while in the Play scene; run `gc.collect()` at scene transitions and stage loads. Reuse enemy objects from the pool instead of constructing new ones. (Reasoned from CPython semantics, not benchmarked in Pyodide.)

### Anti-Pattern 6: Wall-clock gameplay timing / dt-scaled movement

**What people do:** Multiply velocities by variable dt, use `time.time()` for cooldowns and stage triggers.
**Why it's wrong:** Non-deterministic patterns, impossible to test, different difficulty on 60 vs 144 Hz, broken by pause.
**Do this instead:** Everything in ticks; stage triggers keyed to scroll; a single seeded RNG owned by the sim.

### Anti-Pattern 7: Unbounded spawn without caps

**What people do:** Let patterns spawn unconditionally into growing lists.
**Why it's wrong:** One mis-tuned boss pattern blows the frame budget on phones and the list reallocations spike GC.
**Do this instead:** Fixed-capacity pools whose `spawn()` returns `False` at capacity; pattern code treats refusal as normal.

### Anti-Pattern 8: Game flow in JS

**What people do:** Implement title/pause/game-over in JS UI code and only run "gameplay" in Python.
**Why it's wrong:** The most bug-prone logic (continues, extends, high-score qualification, pause during boss warning) becomes untestable without a browser.
**Do this instead:** Python scene stack owns flow; JS renders `ui_state()`.

### Anti-Pattern 9: One Mesh per bullet/enemy

**What people do:** `scene.add(new Mesh())` per entity.
**Why it's wrong:** Draw-call explosion kills mobile GPUs/CPU.
**Do this instead:** One `InstancedMesh` (or shader-driven instanced geometry) per kind, capacity pre-allocated, `count` adjusted per frame.

## Integration Points

### External Services

None at runtime (static hosting, no backend). Build-time/runtime dependencies only.

| Dependency | Integration Pattern | Notes |
|------------|---------------------|-------|
| Pyodide (CDN or self-hosted) | `loadPyodide({indexURL})`; self-host the files for share-by-link reliability and caching control | Pyodide switched to Python-synchronized versioning (the "314" release ships Python 3.14.2, Emscripten 5.0.3); pin the exact version and keep the CI Python version matching it |
| three.js | ES module import; postprocessing from `three/examples` or `postprocessing` library | Pin version; InstancedMesh partial-upload API (`addUpdateRange`) varies across versions |
| localStorage | Via `KeyValueStore` adapter with try/catch | Private-mode and quota failures must degrade silently |
| WebAudio | Single `AudioContext`, resumed on first gesture | iOS needs resume inside a touch handler |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| JS loop ↔ Python `Game` | One call: `tick(dt_ms, buttons, ax, ay) -> int` | Primitives only; held proxy |
| Python → JS render data | Fixed-size `float32` buffers via `JsBuffer.assign()` | Layout from `protocol.py`; JS fetches via `manifest()` |
| Python → JS transient effects | Event buffer (stride 6) drained after each tick | Cleared at next tick start |
| Python → JS UI | `ui_state` only on change | Avoid DOM thrash |
| Python ↔ storage | `KeyValueStore` protocol injected at construction | No `js` import in `src/` |
| Sim ↔ Scenes | `Scene.update(input)`; Play owns `World` | Pause = push scene, `World` simply not stepped |
| Sim ↔ Content | Content registers kinds/scripts; sim calls generators | Content never imports renderer concepts |
| Renderer ↔ FX/Audio | Both consume the same event stream | They never talk to each other or to Python directly |

## Testing Architecture (pure-Python, headless)

| Test type | What it covers | How |
|-----------|----------------|-----|
| Unit | Pools (spawn/kill/cap/swap-remove), collision geometry, scoring, weapon level tables, high-score rules | Plain pytest |
| Pattern tests | A pattern generator stepped N ticks yields expected bullet count/angles | Drive generator with a stub emitter |
| Scripted scenario | Run 60 s of ticks with scripted input; assert boss spawns at scroll X, stage clears, player dies at hit, continue flow | `World` + `FixedStepRunner`, no rendering |
| Determinism | Same seed + input log ⇒ identical state hash after N ticks | Guards against accidental `random`/wall-clock use; enables replay/attract demo for free |
| Timeline validation | Stage lists sorted, kinds exist, scripts resolvable | Import-time test per stage |
| Boundary | Buffer layout round-trips; `snapshot()` fills documented offsets; adapter behaves with fake `assign` sink | Fakes, no browser |
| Purity guard | No `import js` / `pyodide` under `src/scorched/` | AST test |
| Perf smoke | Headless ticks/second with max entities stays above a relative threshold | Tracks regressions (absolute WASM numbers come from the browser) |
| E2E | Real Pyodide: Pyodide-in-Node (npm `pyodide`) or Playwright loads the built bundle, runs a few hundred ticks, checks buffers sane | Few tests; catches Pyodide-version/stdlib mismatches |

Run CI on the same Python minor version Pyodide ships so syntax/stdlib behavior matches; stay stdlib-only so nothing needs a Pyodide-specific wheel.

## Suggested Build Order (dependency-driven)

```
[0] Boundary spike ──► [1] Sim core + tests ──► [2] Bridge + render slice ──► [3] Feel layer
                                                        │                          │
                                                        ▼                          ▼
                                               [4] Enemies/stage/scoring ──► [5] Boss + weapons depth
                                                        │
                                                        ▼
                              [6] Scenes + persistence + touch ──► [7] Content (stages 2-5) ──► [8] Perf/polish
```

0. **Boundary + perf spike (de-risk first).** Load Pyodide on a real phone and a desktop; Python moves 400 bullets, `assign()`s into a buffer driving a GPU-instanced three.js mesh, 60 fps; measure `tick` ms, init time, download size. Confirms Pyodide-on-main-thread, the copy-vs-view decision, entity caps, and whether numpy/worker are ever needed. Everything else depends on these numbers.
1. **Sim core + pytest harness.** `FixedStepRunner`, RNG, pools, events, input state, player movement/hitbox, bullets, collision, `protocol.py`. Headless from day one. Freeze the buffer/event contract here; both sides depend on it.
2. **Bridge + minimal renderer slice (deployed link).** Loader, `tick` loop, buffer views, tilted camera, logical-to-world mapping with layer correction, keyboard input, placeholder instanced shapes, scrolling placeholder ground. Output: "a ship you fly and shoot with in 3D, running from a static URL."
3. **Feel layer on the slice** (core value, so do it early, not last): hit sparks, muzzle flash, explosions, screen shake, bloom, lighting, synthesized SFX, event dispatcher. Judge shooting feel before building content on top of it.
4. **Enemies, stage timeline, scoring, death/bombs/lives.** Enemy pool + generator scripts, stage-1 timeline, scoring, player respawn/invulnerability, bombs. Procedural models for the first few kinds.
5. **Weapon system + pickups, then boss framework.** Colored pickups (switch/level/lose-on-death), vulcan/laser/homing; boss parts + phases + warning/transition events. (Weapons can interleave with step 4; bosses depend on enemies, collision parts, and events.)
6. **Scene stack, HUD, persistence, touch.** Title/pause/continue/game-over/name-entry in Python; DOM HUD; `KeyValueStore` adapter + high scores; relative-drag touch controls and on-screen bomb; auto-pause on hide. Touch needs the abstract input already in place (step 1/2).
7. **Content production.** Stages 2-5, bosses, terrain variety (chunk generators, props), more procedural models, music. Mostly `content/` and `render/models/` work; the engine should be stable.
8. **Performance and polish.** Mobile quality tiers, dynamic resolution, entity cap tuning, GC strategy validation in-browser, optional render interpolation for high-refresh displays, load-time trimming.

**Research flags:** Step 0 (measurement), step 3 (bloom/particle cost on mobile; needs STACK-level decisions), step 5 (boss pattern authoring ergonomics), step 6 (touch name entry UX). Steps 1, 2, 4, 7 follow standard patterns.

## Sources

- Pyodide type conversions (official): `toJs()` copies buffers; `getBuffer()` returns a typed array over the WASM-backed data; `JsBuffer.assign()/assign_to()`; `create_proxy()` for repeatedly called callbacks; proxies must be `destroy()`ed. https://pyodide.org/en/stable/usage/type-conversions.html (HIGH)
- Pyodide JS API (official): `loadPyodide` options, `pyimport`, `registerJsModule`, `PyBufferView` (`data`, `release()`, `shape`), `FS`. https://pyodide.org/en/stable/usage/api/js-api.html (HIGH)
- Pyodide FAQ: zip project files and load with `pyodide.unpackArchive()`. https://pyodide.readthedocs.io/en/stable/usage/faq.html (HIGH)
- Pyodide 314 release (new Python-synchronized versioning; Python 3.14.2, Emscripten 5.0.3), via search result summary only; page fetch failed. https://blog.pyodide.org/posts/314-release (MEDIUM)
- Typed-array detachment on WASM memory growth (WebKit bug thread and Emscripten runtime behavior). https://bugs.webkit.org/show_bug.cgi?id=182327 (MEDIUM)
- Pyodide size/startup figures from the older roadmap and 0.23 release notes (6.4 MB download, 4-5 s init, stdlib unvendoring/zip); no mobile data found. https://blog.pyodide.org/posts/0.23-release/ , https://pyodide.org/en/0.17.0/project/roadmap.html (LOW-MEDIUM, dated)
- Call-overhead guidance (precompiled function vs `runPython` string, anecdotal 1.2 ms vs 0.01 ms) from a downstream project PR; no authoritative Pyodide per-frame benchmark exists in public sources. https://skwrus.duckdns.org/CSSFrancis/anyplotlib/pull/21.patch (LOW)
- three.js `InstancedMesh` usage (`setMatrixAt`, `instanceMatrix.needsUpdate`, `count`, `frustumCulled`, update ranges): official docs page did not render in fetch; details from training knowledge, verify against the pinned version. (MEDIUM)
- Local measurements (CPython 3.12 native, this machine): integrate 400 bullets 0.078 ms/tick; strided slice pack 0.002 ms; brute-force 100 x 40 circle test with x-reject 0.245 ms. WASM multiplier is unmeasured. (HIGH for native numbers, LOW for WASM extrapolation)
- Genre structure (frame-locked 60 Hz, scroll-synced stage scripts, tiny center hitbox, pooled bullets with caps, generator/bytecode-style pattern scripting, phase-based bosses) is established shmup practice, from author knowledge of Raiden/Strikers/Truxton-style design; not tied to a single citable source. (MEDIUM)

---
*Architecture research for: browser 3D-rendered, 2D-gameplay vertical shmup with Python-in-WASM logic*
*Researched: 2026-10-17*
