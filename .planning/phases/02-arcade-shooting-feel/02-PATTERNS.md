# Phase 2: Arcade Shooting Feel - Pattern Map

**Mapped:** 2026-10-17
**Files analyzed:** 52 new/modified (grouped where they share an analog)
**Analogs found:** 48 / 52 (all analog paths verified git-tracked via `git ls-files`)

Line numbers refer to the files as of commit b1ed8b2. Layout names come from 02-RESEARCH.md (Recommended Project Structure); the planner may adjust names.

## File Classification

### Python core (`src/scorched_core/`)

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `protocol.py` (v2: HEADER_LEN 32, new H_*/EV_*/channel consts) | config | request-response | itself (`protocol.py`) | exact |
| `tuning.py` (weapon tables, enemy kinds, timings) | config | - | itself (`tuning.py`) | exact |
| `weapons/weapon_kind.py` | model (IntEnum) | - | `input/button.py` | role-match |
| `weapons/weapon_loadout.py` | model (state machine) | CRUD | `weapons/twin_shot.py` | role-match |
| `weapons/vulcan.py` (replaces/extends `twin_shot.py`) | service | batch | `weapons/twin_shot.py` | exact |
| `weapons/laser_beam.py` | service | transform | `weapons/twin_shot.py` + `stress/bullet_storm.py` | partial |
| `weapons/homing_launcher.py` | service | batch | `weapons/twin_shot.py` | role-match |
| `pools/bullet_pool.py` (+angle column, `pack_into` offset) | model (SoA pool) | batch | itself | exact |
| `pools/missile_pool.py` | model (SoA pool) | batch | `pools/bullet_pool.py` | exact |
| `pools/pickup_pool.py` | model (SoA pool) | batch | `entities/drone_swarm.py` | exact |
| `pools/enemy_pool.py` (replaces `drone_swarm.py`) | model (SoA pool) | batch | `entities/drone_swarm.py` | exact |
| `entities/player_life.py` | model (state machine) | event-driven | `entities/player_ship.py` | role-match |
| `entities/player_ship.py` (respawn fly-in, control lock) | model | request-response | itself | exact |
| `bombs/bomb.py` | model (state machine) | event-driven | `weapons/twin_shot.py` (tick counters) | partial |
| `events/event_ring.py` | utility | pub-sub | `pools/bullet_pool.py` (prealloc array) | role-match |
| `gallery/gallery_spawner.py` | service | batch | `entities/drone_swarm.py` (`_spawn`, timer, rng) | role-match |
| `gallery/enemy_ai.py` (function helpers; no class) | utility | transform | `entities/drone_swarm.py` `step` | partial |
| `collision/circle_hits.py` (+ resolve_* pairs) | utility | batch | itself `resolve_shots_vs_drones` | exact |
| `game/game.py` (step order, hitstop, latch, manifest) | controller | request-response | itself | exact |
| `scorched_web/bridge/render_sink.py` | service | request-response | itself (no mechanism change) | exact |
| `entities/drone_swarm.py`, `stress/bullet_storm.py` | removal / keep own pool (Pitfall 4) | - | - | - |

### Python tests (mirror tree, `tests/scorched_core/...`)

One `test_<module>.py` per new module, per `tests/test_conventions.py`. Analogs: `tests/scorched_core/entities/test_drone_swarm.py` (pools/enemies), `tests/scorched_core/weapons/test_twin_shot.py` (weapons), `tests/scorched_core/collision/test_circle_hits.py`, `tests/scorched_core/game/test_game.py` (scenarios), `tests/scorched_web/bridge/test_render_sink.py`. Scenario helpers go in `conftest.py` (exempt from `test_no_orphan_tests`).

### JS (`web/src/`)

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `render/enemy_instances.js`, `render/pickup_instances.js` | component | batch/instanced | `render/drone_instances.js` | exact |
| `render/bullet_instances.js` (pink orb, white core, dark rim) | component | batch | itself | exact |
| `render/bullet_layer.js` (post-bloom pass) | component | transform | `render/post_pipeline.js` | role-match |
| `render/model_kit.js`, `render/models/*.js` | utility | transform | `render/ship_model.js` | role-match |
| `render/ship_model.js` (smooth upgrade, blink) | component | transform | itself | exact |
| `render/ground_layer.js` | utility | transform | `render/camera_fit.js` | role-match |
| `fx/particle_system.js` | component | event-driven/instanced | `render/bullet_instances.js` (ShaderMaterial + update ranges) | role-match |
| `fx/shadow_instances.js`, `fx/decal_ring.js`, `fx/wreck_ring.js`, `fx/beam_mesh.js`, `fx/bomb_fx.js` | component | instanced | `render/drone_instances.js` / `bullet_instances.js` | role-match |
| `fx/fx_dispatcher.js`, `fx/explosion_recipes.js`, `fx/palette.js`, `fx/shake.js`, `fx/light_pool.js` | utility | event-driven | `quality/quality_controller.js` (pure state, injected deps) | partial |
| `audio/zzfx_synth.js`, `sfx_table.js`, `sfx_bank.js`, `sfx_player.js` | service | event-driven | `boot/start_gate.js` (AudioContext handling) | partial |
| `audio/audio_keepalive.js` | utility | event-driven | `boot/start_gate.js` | role-match |
| `input/bomb_button.js`, `input/bomb_button_layout.js` | component | event-driven | `input/keyboard_input.js` (held + pressedSinceSample + clear) | role-match |
| `input/touch_input.js` (drag exclusion) | component | event-driven | itself | exact |
| `input/input_sampler.js`, `loop/pause_controller.js` (register button) | controller | request-response | themselves | exact |
| `quality/tiers.js` (+modelDetail, particleScale, lights, maxDecals) | config | - | itself | exact |
| `python/python_bridge.js` (protocol check `!== 2`, new channels) | service | request-response | itself | exact |
| `main.js`, `render/renderer_rig.js`, `render/post_pipeline.js` | controller | request-response | themselves | exact |
| JS tests `web/test/**` | test | - | `web/test/render/drone_instances.test.js`, `web/test/input/keyboard_input.test.js`, `web/test/boot/start_gate.test.js` | exact |
| `tools/perf_node.mjs`, `tools/e2e/*.spec.js` (extend per weapon/bomb; `shooting.spec.js:21,27,34` read H_DRONE_N/DRONES_DOWN, rename) | test | - | themselves | exact |

## Pattern Assignments

### `pools/enemy_pool.py`, `pools/pickup_pool.py` (SoA pool, batch)

**Analog:** `src/scorched_core/entities/drone_swarm.py` (115 lines). Move to `pools/`, add `kind`, `radius`, `uid`, `aux` columns.

**Structure** (lines 1-60): `@dataclass(slots=True)`, `array("f"/"i", zeros)` columns built in `__post_init__`, `Final` private constants, seeded `rng` injected.
```python
@dataclass(slots=True)
class DroneSwarm:
    rng: random.Random
    x: array = field(init=False)
    ...
    n: int = field(default=0, init=False)
    def __post_init__(self) -> None:
        zeros = bytes(4 * DRONE_CAP)
        self.x = array("f", zeros)
        self.hp = array("i", zeros)
```
**Swap-remove** (lines 100-115): copy every column from `last` into `i`, then `self.n = last`. Add every new column to it (swap-removal makes indices unstable, so homing targets must use `uid`, per RESEARCH Pattern 3).
**Hit/flash + remove_dead** (lines 66-78): `apply_hit` sets `flash = FLASH_TICKS`; `remove_dead` iterates `range(n-1, -1, -1)`. Generalize `apply_hit(i, damage)`; emit `EV_HIT` only when `flash` was 0.
**Pack** (lines 80-92): stride-8 `x, y, angle, flash, hp_frac, scale/kind, aux, spare`; matches proposed `enemies` stride 8.

### `pools/bullet_pool.py`, `pools/missile_pool.py` (SoA pool)

**Analog:** `src/scorched_core/pools/bullet_pool.py` (79 lines). Copy `spawn` (returns False when full), `integrate`, `remove_at` swap-remove, `cull_outside` (iterates high-to-low), `pack_into` (strided slice assignment, kind column cached):
```python
end = n * 4
out[0:end:4] = self.x[:n]
out[3:end:4] = self._kinds[:n]
```
Phase 2: add an `offset` param to `pack_into` so storm bullets (own pool, Pitfall 4) and gameplay enemy bullets share one `ebullets` channel; sum counts in `H_EBULLET_N`. `MissilePool` adds `angle`, `target_uid`, `life` columns; pack kind=1.0 into the shared pbullets channel.

### `weapons/vulcan.py`, `homing_launcher.py`, `laser_beam.py` (weapons)

**Analog:** `src/scorched_core/weapons/twin_shot.py` (29 lines).
```python
def step(self, firing: bool, x: float, y: float, pool: BulletPool) -> int:
    spawned = 0
    if firing and self.cooldown == 0:
        ...pool.spawn(x - TWIN_OFFSET, muzzle_y, 0.0, -PBULLET_SPEED)
        self.cooldown = FIRE_INTERVAL_TICKS
    if self.cooldown > 0:
        self.cooldown -= 1
    return spawned
```
Keep: cooldown runs down whether or not fire is held; a volley that does not fit is dropped; `firing` is gated by `life.can_fire`. Replace hard-coded offsets with level-indexed tables in `tuning.py` (constants-only file, nested tuples) so Lv1 reproduces TwinShot exactly. Vulcan angle streams need `vx = sin(a)*SPEED`, `vy = -cos(a)*SPEED`.
Laser has no pool: hitscan rectangle vs enemy circle (`circles_touch`-style math), cadence every 3rd tick, writes `H_BEAM_W`/`H_BEAM_TOP_Y`.

### `collision/circle_hits.py` (new resolve_* pairs)

**Analog:** same file, `resolve_shots_vs_drones` (lines 18-43) and `circles_touch` (lines 9-14).
```python
grid.rebuild(swarm.x, swarm.y, swarm.n)
for i in range(bullets.n - 1, -1, -1):
    px, py = bx[i], by[i]
    for k in range(grid.query(px, py, scratch)):
        j = scratch[k]
        if hp[j] > 0 and circles_touch(px, py, PBULLET_RADIUS, dx[j], dy[j], DRONE_RADIUS):
            swarm.apply_hit(j); bullets.remove_at(i); hits += 1; break
swarm.remove_dead()
```
Generalize: per-enemy `radius` column, `damage` argument, cap enemy radius so `radius + PBULLET_RADIUS <= GRID_CELL` (tuning.py:36 comment). New pairs (beam, bomb circle, ebullets vs `HITBOX_RADIUS`, bodies vs ship, pickups vs ship body) are plain functions using `circles_touch` with linear scans (<=48 enemies). Note `# noqa: PLR0913, PLR0917` precedent for 6-number signature. Beware circular import: this file imports `DroneSwarm`; move to `EnemyPool`. One-class-per-file rule allows module functions.

### `entities/player_life.py` (state machine), `bombs/bomb.py`

**Analog:** `src/scorched_core/entities/player_ship.py` (dataclass(slots=True), tick-driven `step`, `math.isfinite` guards, constants from `tuning`) and `weapons/twin_shot.py` (integer tick counters decremented per step). Use `IntEnum` phases (analog `input/button.py`) and `match` on phase. All windows count steps, not ms (Pitfall 14). Resolve bomb press before enemy collision (deathbomb). Respawn fly-in: extend `PlayerShip.step` with a controlled-by-life flag; `x` clamp logic at lines 56-66 stays.

### `events/event_ring.py`

**Analog:** `pools/bullet_pool.py` preallocated `array("f")` + counter. `n` reset at the start of every `tick()` (Pitfall 2), overflow increments dropped counter instead of growing; no allocation per push.

### `game/game.py` (modify)

**Analog:** itself.
- `__slots__` tuple (lines 66-93) must list every new attribute; `manifest()` (lines 136-150) exports header slot map via `_HEADER_SLOTS` (lines 53-66), channel strides/caps, `buttons`, `tuning`. Add `events`, `H_*` names, `EV_*` ids, phase ids, sfx ids.
- `tick()` (lines 168-197): PAUSE edge uses `self.input.pressed(Button.PAUSE)`; comment at line 172 "BOMB is accepted and unused". Latch BOMB into `_bomb_requested` here (consume in `_step`), zero `EVENT_N` before the paused early return (lines 174-177) and before `_pack_header`.
- `_step` (lines 215-229): add `if self.hitstop > 0: self.hitstop -= 1; return` at the top; keep `FaultMode.PY` block at the end; replace drone calls with enemy/gallery/life/bomb order from RESEARCH Pattern 2.
- Constructor keeps `Game(seed=, stress=, fault=)` and `storm` behavior (URL flags D-20).
- Pack channels only when `steps > 0` (lines 192-196); events are zeroed through the header.

### `scorched_web/bridge/render_sink.py`

**Analog:** itself (32 lines). `attach(name, target)` validates `target.length == len(buffer)`; `flush(bulk=)` always assigns `header`, other channels only when bulk. New channels just need entries in `Game.buffers` and the JS attach list.

### `web/src/render/enemy_instances.js`, `pickup_instances.js`

**Analog:** `web/src/render/drone_instances.js` (49 lines).
```js
const matrix = new THREE.Matrix4();           // module-level scratch, no allocation in update()
const color = new THREE.Color();
export function createDroneInstances({ data, capacity, playfieldW, playfieldH }) {
  const mesh = new THREE.InstancedMesh(geometry, material, capacity);
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.setColorAt(0, color.setRGB(...BASE_COLOR));   // allocate instanceColor up front
  mesh.count = 0;
  function update(n) { ... matrix.makeTranslation(data[base] - halfW, 0, data[base + 1] - halfH); ... }
  return { mesh, update };
}
```
Per kind: one InstancedMesh per kind, filter by `data[base+6]` kind, HDR `FLASH_COLOR = [2,2,2]` hit flash. Position mapping `x - halfW`, `y - halfH` on the XZ plane is the shared convention. Factory returns `{ mesh, update }`. Test analog: `web/test/render/drone_instances.test.js` (`build()`, `setDrone()`, `positionOf()` via `getMatrixAt`).

### `web/src/render/bullet_instances.js` and `fx/particle_system.js`

**Analog:** `bullet_instances.js` (62 lines): `InstancedBufferGeometry` of one quad, `InstancedBufferAttribute` over the Python-assigned Float32Array, custom `ShaderMaterial`, partial upload:
```js
attribute.clearUpdateRanges();
attribute.addUpdateRange(0, count * 4);
attribute.needsUpdate = true;
geometry.instanceCount = count;
```
Fragment shader includes `<tonemapping_fragment>` and `<colorspace_fragment>`. For particles: same structure plus a CPU ring written on events, uniform `uTime` held while `HITSTOP > 0`. For enemy bullets: change color to LDR hot pink (<=0.98) with white core and dark rim, `depthTest: false`, high `renderOrder`; keep `name` option (`ebullets`/`pbullets`) since debug and tests look up meshes by name.

### `web/src/render/bullet_layer.js` / `post_pipeline.js`

**Analog:** `web/src/render/post_pipeline.js` imports `EffectComposer`, `RenderPass`, `OutputPass`, `ScaledBloomPass`. Insert a second `RenderPass(bulletScene, camera)` with `clear = false`, `clearDepth = true` between bloom and `OutputPass` (RESEARCH Pattern 12); low tier (no composer) renders the bullet scene after `renderer.render(scene, camera)`. Read the file before editing to see how `createPostPipeline` exposes `render`/`setTier`.

### `web/src/render/ship_model.js` and `render/models/*.js`

**Analog:** `ship_model.js` (exports `createShipModel({ hitboxRadius })`, line 118). Keep the hitbox marker (renderOrder 20/21) and the named `fuselage`/`engine-glow` children; blink those only (Pitfall 9). `web/test/render/ship_model.test.js` asserts the flat silhouette; rewrite alongside. New generators take a `detail` of `'high' | 'mid' | 'low'` and cache per `(kind, detail)`; use `mergeGeometries` after normalizing attributes (Pitfall 7).

### `web/src/input/bomb_button.js`

**Analog:** `web/src/input/keyboard_input.js`.
```js
const held = new Set();
const pressedSinceSample = new Set();     // a tap shorter than a frame survives
// BUTTON_ACTIONS maps action -> manifest.buttons key ("bomb" -> "BOMB"); bit values come from Python
```
Mirror: `held` flag + `pressedSinceSample`, `sample()` ORs `buttonBits.BOMB`, `clear()` and `dispose()`. Register in `input_sampler.js` and in the `inputs` list given to `createPauseController` (each needs `.clear()`, Pitfall 13). Layout as a pure function using `projectCorners` from `render/camera_fit.js`.

### `web/src/input/touch_input.js` (modify)

**Analog:** itself. `onDown` (lines 13-24) is where exclusion goes:
```js
function onDown(event) {
  if (event.target.closest?.('[data-no-steer]')) return;   // add before touch-mode/steering
  if (event.pointerType === 'touch') onTouchMode?.();
  if (steering !== null) return;
  ...
```
Test analog: `web/test/input/touch_input.test.js` plus `web/test/helpers/fake_dom.js` (add `closest` to the fake target).

### `web/src/audio/*`

**Analog:** `web/src/boot/start_gate.js`. `waitForStartGesture` returns `{ audio, pointerType }` where `audio` may be `null`; SFX player must no-op on null. The unlock uses `click`/`pointerup`/`Enter|Space` only (never `pointerdown`/`touchstart`). Constructor injection with defaults (`{ AudioContextCtor = globalThis.AudioContext ?? ..., win = window }`) is the testability pattern; copy it for `sfx_player.js`/`audio_keepalive.js` so vitest (node) can pass fakes. Vendor zzfx `buildSamples` only (no `new AudioContext` at import; Pitfall 11). Test analog: `web/test/boot/start_gate.test.js`.

### `web/src/quality/tiers.js` (modify)

**Analog:** itself: frozen objects; add fields to each tier (`modelDetail`, `particleScale`, `lights`, `maxDecals`). Presentation only, never reaches Python. Update `web/test/quality/tiers.test.js`.

### `web/src/python/python_bridge.js`

Change `if (manifest.protocol !== 1)` (line ~33) to `!== 2` and attach the new channels (`enemies`, `pickups`, `events`). Update `web/test/python/python_bridge.test.js` and `tests/scorched_web/test_web_game.py`.

## Shared Patterns

### Constants discipline
**Source:** `src/scorched_core/protocol.py`, `tuning.py` (allow-listed as constants-only in `tests/test_conventions.py:15`; no classes/functions). Every number is `Final`; derived values computed in place (e.g. `DRONE_SPAWN_MARGIN_X = DRONE_SWAY + DRONE_RADIUS`). Boundary constants in `protocol.py`, gameplay numbers in `tuning.py`. Bump `PROTOCOL_VERSION`, `HEADER_LEN`; JS reads slot names from the manifest, never hard-coded numbers.
**Apply to:** all Python files.

### Pure core / conventions
**Source:** `tests/test_conventions.py` lines 14-60: core may not import `js`, `pyodide`, `time`, `datetime`; one top-level class per file named in snake_case; each non-constants module needs a mirrored test file. Seeded `random.Random` only (`Game.rng`), `# noqa: S311` for gameplay randomness.
**Apply to:** every new Python file and its test.

### Struct-of-arrays, no allocation in step
**Source:** `pools/bullet_pool.py`, `entities/drone_swarm.py`. Preallocated `array('f'|'i', zeros)`, swap-remove from high index down, strided slice packing.
**Apply to:** enemy, missile, pickup pools, event ring.

### Instanced JS component factory
**Source:** `web/src/render/drone_instances.js`, `bullet_instances.js`: `createX({ data, capacity, playfieldW, playfieldH })` returns `{ mesh, update(n) }`; module-level scratch; `frustumCulled = false`; coordinates `x - playfieldW/2`, `y - playfieldH/2`.
**Apply to:** all instanced render/fx modules.

### Tests
**Python:** `tests/scorched_core/entities/test_drone_swarm.py` style: helper builders (`make_swarm(seed)`, `swarm_with_one_drone()`), `pytest.approx`, imports tuning constants rather than literals, plain test functions with descriptive names, `-> None` annotations. 100% line+branch.
**JS:** vitest under `web/test/` mirroring `web/src/`; THREE geometry works headless in node.

### Tooling
All commands via `uv` and root `Makefile` targets (`make check`, `make perf`, `make e2e`); add a target for any new command.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `fx/light_pool.js` | component | event-driven | No lights in the scene yet; fixed pool of 3 PointLights, intensity-only animation (RESEARCH Pattern 10) |
| `fx/shake.js` | utility | event-driven | No render-time camera offset exists; apply before render and subtract after (Pattern 11) |
| `render/ground_layer.js` | utility | transform | Derived ray-compensation transform (Pattern 14, code example in RESEARCH); closest math lives in `camera_fit.js` |
| `audio/zzfx_synth.js` | utility | transform | Vendored MIT algorithm; no existing synth |

## Metadata

**Analog search scope:** `src/scorched_core/**`, `src/scorched_web/**`, `tests/**`, `web/src/**`, `web/test/**`, `tools/**` (all via `git ls-files`; no gitignored mirror paths used).
**Files scanned:** about 45 read in full or in part (RESEARCH.md read through line 449 of 635; the remainder was not needed for analog selection).
**Pattern extraction date:** 2026-10-17
