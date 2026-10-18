# Phase 3: Stage 1 Vertical Slice - Pattern Map

**Mapped:** 2026-10-18
**Files analyzed:** about 45 new/modified (grouped below)
**Analogs found:** all groups have an analog except where listed in "No Analog Found"
**Path rule:** every analog below is git-tracked (checked with `git ls-files`).

Project rules that apply to every Python file: one class per file named in snake_case, domain subdirectory mirrored by `tests/<same path>/test_<stem>.py` (enforced by `tests/test_conventions.py`; data modules without a class such as `stage_1.py` still need a test file), new directories need an empty `__init__.py`, `scorched_core` may not import `js`/`pyodide`/`time`/`datetime`, 100% line+branch coverage, ruff, `@dataclass(slots=True)`, `Final` constants. Boundary constants go in `protocol.py`, gameplay constants in `tuning.py`. Enum values are append-only.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/scorched_core/stages/stage_data.py`, `wave_entry.py`, `ground_entry.py`, `city_block.py` | model (frozen data) | transform | `stages/gallery_spawner.py` (`ScriptEntry`) + `tuning.GALLERY_SCRIPT` | role-match |
| `src/scorched_core/stages/stage_director.py` | service | batch/event-driven cursor | `stages/gallery_spawner.py` | exact |
| `src/scorched_core/stages/stage_flow.py` | service (state machine) | event-driven | `entities/player_life.py` + `entities/player_phase.py` | role-match |
| `src/scorched_core/stages/stage_1.py`, `bosses/stage_1_bosses.py`, `paths/path_library.py`, `patterns/pattern_library.py`, `stages/formations.py`, `stages/city_builder.py` | data/utility | transform | `tuning.py` per-kind tuples + `GALLERY_SCRIPT`; `bullet_patterns.py` | partial |
| `src/scorched_core/stages/terrain_scroll.py` (modify: `speed`) | service | transform | itself | exact |
| `src/scorched_core/patterns/pattern_spec.py`, `bullet_patterns.py` (add `fire_spread`, `run_pattern`), `fire_pattern.py` (SPREAD=3, STREAM=4) | model/utility | request-response | `patterns/bullet_patterns.py`, `patterns/fire_pattern.py` | exact |
| `src/scorched_core/paths/path_spec.py` | model (frozen) | transform | `patterns/pattern_spec` (new) / `ScriptEntry` | partial |
| `src/scorched_core/entities/motion_kind.py` (PATH, SCRIPTED), `enemy_kind.py` (+boss/part/stump/building kinds), `pickup_kind.py` (MEDAL=5), `player_phase.py` (OUT=4) | model (enum) | n/a | `entities/pickup_kind.py`, `fire_pattern.py` | exact |
| `src/scorched_core/pools/enemy_pool.py` (modify: new columns, PATH/SCRIPTED motion, column-driven `_remove_at`) | model (SoA pool) | CRUD | itself | exact |
| `src/scorched_core/pools/pickup_pool.py` (medal drift, `medals_missed`) | model (SoA pool) | CRUD | itself | exact |
| `src/scorched_core/bosses/{boss_spec,part_spec,phase_spec}.py`, `boss_state.py`, `boss_controller.py` | model + service | event-driven | `pools/enemy_pool.py` (rows) + `player_life.py` (step-counted state machine) | role-match |
| `src/scorched_core/scoring/{score_keeper,medal_chain,stage_tally}.py` | service | transform | `weapons/weapon_loadout.py` / `entities/player_life.py` | role-match |
| `src/scorched_core/game/game.py` (modify: stage wiring, header slots) | controller | request-response tick | itself | exact |
| `src/scorched_core/protocol.py`, `tuning.py` (modify) | config | n/a | themselves | exact |
| `src/scorched_core/audio/sfx_id.py`, `sfx_router.py` (modify) | utility | event-driven | themselves | exact |
| `src/scorched_web/bridge/high_score_store.py` | service (adapter) | file-I/O (localStorage) | `scorched_web/entrypoint.py` + `render_sink.py` (duck-typed JsProxy) | role-match |
| `src/scorched_web/entrypoint.py`, `web_game.py` (modify: `gallery`, `at`, `restart`) | controller | request-response | `entrypoint.py` `_bombs`/`_flag` | exact |
| `web/src/boot/url_flags.js` (modify: `gallery`, `at`) | utility | transform | itself | exact |
| `web/src/ui/{hud,banner_overlay,score_popups,boss_bar,tally_panel,game_over_overlay}.js` | component | event-driven | `web/src/ui/status_readout.js` | exact |
| `web/src/render/{city_layer,rain_layer,night_rig}.js`, `terrain_ring.js` rework, `renderer_rig.js` | component | streaming | `render/terrain_ring.js`, `render/renderer_rig.js`, `render/ground_layer.js` | role-match |
| `web/src/render/models/{building,bomber,midboss,stump...}.js`, `enemy_models.js` | component (generator) | transform | `render/models/tank.js` | exact |
| `web/src/render/pickup_instances.js` (medal), `fx/palette.js`, `fx/explosion_fx.js`, `fx/wreck_ring.js`, `fx/bomb_fx.js` (retint) | component | streaming | themselves | exact |
| Tests: `tests/scorched_core/<mirror>/test_*.py`, `web/test/<mirror>/*.test.js` | test | n/a | `tests/scorched_core/stages/test_gallery_spawner.py`, `web/test/ui/status_readout.test.js`, `web/test/fx/palette.test.js` | exact |
| `tools/e2e/*.spec.js`, `tools/perf_node.mjs` (add `--stage`, `bootGame` gets `gallery`) | test/tool | request-response | existing specs, `tools/e2e/helpers.js` | exact |

## Pattern Assignments

### `stages/stage_director.py` (service, cursor over sorted data)

**Analog:** `src/scorched_core/stages/gallery_spawner.py` (lines 1-37 read in full)

**Imports + dataclass shape** (lines 1-24):
```python
from dataclasses import dataclass, field
from scorched_core.pools.enemy_pool import EnemyPool

@dataclass(slots=True)
class GallerySpawner:
    script: tuple[ScriptEntry, ...] = GALLERY_SCRIPT
    t: int = field(default=0, init=False)
    cursor: int = field(default=0, init=False)
```
**Core pattern** (lines 26-34): cursor loop; a refused spawn is skipped, never queued.
```python
while self.cursor < len(script) and script[self.cursor][0] == self.t:
    enemies.spawn(kind, x, y, motion, vx, vy, drop)
    self.cursor += 1
```
Deviation for the director: key on float `TerrainScroll.distance` and use `<=` (RESEARCH Pattern 1), never `==`. Do not loop; support jumping the cursor for `?at=`.
**Test analog:** `tests/scorched_core/stages/test_gallery_spawner.py` lines 20-37: a `run(spawner, enemies, ticks)` helper that returns alive counts, then asserts the exact kind/x/y/motion/velocity of the row spawned on a named step. Gallery behaviour must stay byte-identical (parity test vs. `ENEMY_FIRE_*` tuples).

### `stages/terrain_scroll.py` (modify: variable speed)

**Analog:** itself (lines 1-17)
```python
@dataclass(slots=True)
class TerrainScroll:
    distance: float = 0.0
    def step(self) -> None:
        self.distance += SCROLL_SPEED
```
Add `speed: float = SCROLL_SPEED` and `self.distance += self.speed`. Publish speed in a header slot (JS extrapolates with the constant today).

### `patterns/pattern_spec.py`, `bullet_patterns.py`, `fire_pattern.py`

**Analog:** `src/scorched_core/patterns/bullet_patterns.py` and `fire_pattern.py`

**Helper signature and noqa convention** (bullet_patterns.py 12-45): helpers take a `BulletPool`, return the count spawned, and never assume pool space.
```python
def fire_ring(  # noqa: PLR0913, PLR0917 - a ring is a pool, a centre, a count, a speed and a phase
    pool: BulletPool, x: float, y: float, count: int, speed: float, phase: float
) -> int:
    step = math.tau / count
    spawned = 0
    for k in range(count):
        angle = phase + k * step
        if not pool.spawn(x, y, speed * math.sin(angle), -speed * math.cos(angle)):
            break
        spawned += 1
    return spawned
```
Angle convention: 0 flies up, positive clockwise. Add `fire_spread` in the same style, and `run_pattern` doing `match spec.shape` with the loud unknown arm (copy from `EnemyPool.step`: `case unknown: raise ValueError(f"unknown motion ...")`).
**Enum** (fire_pattern.py 6-13): `IntEnum`, docstring "Values never change: they ride ENEMY_FIRE events as `a`"; append `SPREAD = 3`, `STREAM = 4`.
**Frozen spec:** use `@dataclass(frozen=True, slots=True)` as in RESEARCH Code Examples (`PatternSpec`, `WaveEntry`).

### `pools/enemy_pool.py` (modify)

**Analog:** itself. Structure: SoA `array("f"/"i")` columns declared as `field(init=False)` (lines 67-92), allocated in `__post_init__` from `zeros = bytes(4 * ENEMY_CAP)` (94-117), `spawn` returns False at `ENEMY_MAX_ALIVE` (119-150), `step` is `match motion[i]` with the unknown arm raising `ValueError` (lines ~170-198).
```python
case MotionKind.GROUND:
    x[i] += vx[i]
    y[i] += _GROUND_SCROLL + vy[i]
    angle[i] = math.atan2(vx[i], vy[i])
case unknown:
    msg = f"unknown motion {unknown} on enemy slot {i}"
    raise ValueError(msg)
```
Add `MotionKind.PATH` / `SCRIPTED` arms here (SCRIPTED must be skipped by the exit-margin check). New columns (`hp_max, shield, base_y, path, seg, seg_t, pattern, volley`) must go in spawn, `pack_into`, and a module-level `_COLUMNS` tuple driving `_remove_at`, with a test that every `array` field is listed (RESEARCH Pitfall 1). Per-kind tuples (`ENEMY_HP`, `ENEMY_RADIUS`, new `ENEMY_POINTS`) live in `tuning.py`; add a `len(EnemyKind)` test for each.

### `pools/pickup_pool.py` (modify: MEDAL)

**Analog:** itself (lines 1-60): columns x, y, vx, vy, kind, age; constants like `_EXIT_BOTTOM = PLAYFIELD_H + 16.0`; `spawn` returns False at `PICKUP_CAP`. Add a `medals_missed` counter drained by `Game` each step, mirroring how `enemies.kills`/`kill_n` are drained. A refused medal spawn must not count as a miss. Enum: append `MEDAL = 5` to `entities/pickup_kind.py`.

### `bosses/boss_controller.py` and specs

**Analog:** `entities/player_life.py` for a step-counted state machine (lines 12-40):
```python
@dataclass(slots=True)
class PlayerLife:
    phase: PlayerPhase = PlayerPhase.ALIVE
    timer: int = 0
    ...
    @property
    def can_fire(self) -> bool:
        return self.phase in (PlayerPhase.ALIVE, PlayerPhase.GRACE)
```
Every window counts simulation steps (so timeouts freeze with hitstop for free). Pair with `EnemyPool` rows tracked by `uid` + `index_of_uid` (never by slot). Specs: frozen slotted dataclasses, one per file. `settle()` runs before `remove_dead`. `boss_state.py` is an `IntEnum` in the style of `player_phase.py`.

### `stages/stage_flow.py`, `scoring/*`

**Analog:** `player_life.py` / `player_phase.py` (IntEnum states + step counters, events pushed through `EventRing`). Imports pattern: `from scorched_core.events.event_ring import EventRing`, `from scorched_core.protocol import EV_...`, tuning constants from `scorched_core.tuning`. Add `PlayerPhase.OUT = 4` (append only). Extend/lives logic lives in `ScoreKeeper`, not in `game.py` (591 lines already).

### `audio/sfx_id.py`, `audio/sfx_router.py` (modify)

**Analog:** `sfx_router.py` lines 10-50: `_EXPLOSIONS` tuple clamped by `min(max(a, 0), len-1)`, `_NOISY` frozenset, `_sound_for` is a `match kind: case protocol.EV_...` returning `-1` for silent, helper `match` functions like `_pickup_sound`.
```python
case protocol.EV_EXPLOSION:
    sound = _EXPLOSIONS[min(max(a, 0), len(_EXPLOSIONS) - 1)]
```
Add `BLAST_HUGE` to `_EXPLOSIONS` and new `SfxId` values together with `web/src/audio/sfx_table.js` entries (one per name; do not invent zzfx numbers).

### `scorched_web/bridge/high_score_store.py` (adapter)

**Analog:** `src/scorched_web/bridge/render_sink.py` (duck-typed JsProxy with `# noqa: ANN401`, `__slots__`, validation raising `ValueError`) and `entrypoint.py` lines 61-76 for defensive parsing of untrusted values:
```python
def _bombs(value: object) -> int:
    if isinstance(value, bool) or not isinstance(value, int | float | str):
        return BOMB_START_STOCK
    try:
        number = float(value)
    except ValueError:
        return BOMB_START_STOCK
    ...
def _flag(value: object) -> bool:
    return value is True
```
Take an injected storage getter, lazy `import js` in a function inside `try`, wrap access and getItem/setItem, parse digits only and clamp. Tests install a fake `js` module in `sys.modules` (see `tests/scorched_web/test_entrypoint.py` style: small fake classes like `FakeJsOptions`).

### `scorched_web/entrypoint.py`, `web_game.py` (modify)

**Analog:** `entrypoint.py` `create_game` (line 16) reads `opts.get("god")` through `_flag`, `opts.get("bombs")` through `_bombs`. Add `gallery` through `_flag` and `at` through an allow-list function returning `None` unless in `{"midboss","boss"}`. Stage is the default unless `gallery is True`; `Game(stage=None)` keeps the gallery so `test_game.py` stays valid. Note `test_entrypoint.py` asserts `manifest()["protocol"] == 2` and ebullet cap numbers: update with the protocol bump.

### `web/src/boot/url_flags.js` (modify)

**Analog:** itself. Presence flags are `params.has('god')`; allow-listed values use `pick(params, key, allowed)`:
```js
const WEAPONS = new Set(['vulcan', 'laser', 'homing']);
function pick(params, key, allowed) {
  const value = params.get(key);
  return allowed.has(value) ? value : null;
}
...
god: params.has('god'),
```
Add `gallery: params.has('gallery')` and `at: pick(params, 'at', new Set(['midboss','boss']))`; update the header comment and `web/test/boot/url_flags.test.js`.

### `web/src/ui/{hud,...}.js` (DOM overlays)

**Analog:** `web/src/ui/status_readout.js` (lines 1-80)
**Factory + guard pattern:** `createX({ doc = document, ... })` looks up elements by id and throws if missing; `shownX` cache variables so the DOM is only touched on change; `textContent` only; `hidden` toggled; frame-clock `tick(nowMs)` with deadline for timed flashes.
```js
export function createStatusReadout({ doc = document, weapons, events, maxed, colors = WEAPON_CSS }) {
  const el = doc.getElementById('status-readout');
  if (!el) throw new Error('#status-readout is missing from the page');
  let shownWeapon = Number.NaN;
  ...
  update(weapon, level, bombs) {
    if (weapon !== shownWeapon) { shownWeapon = weapon; weaponEl.textContent = name; }
```
Keep `#status-readout`, `.weapon`, `.level`, `.bombs`, `#max-flash` stable (e2e selects them). `handle(type, _x, _y, _a, b)` is the fx-event hook. Header slot indices come from the manifest, never hard-coded.
**Test analog:** `web/test/ui/status_readout.test.js` lines 1-30: builds the same markup via `createFakeDocument()` from `web/test/helpers/fake_dom.js` and counts `textContent` writes.

### `web/src/render/models/*` (new building/bomber/mid-boss/stump generators)

**Analog:** `web/src/render/models/tank.js` (lines 1-50)
Imports `{ bake, beveledExtrude, capsule, place, segmentsFor, tint } from './model_kit.js'` and `outline_shapes.js`; module-level colour constants as `[r,g,b]` arrays (non-emissive channels below 1.0 so only HDR accents bloom); `SPHERE_SEGMENTS = Object.freeze({ high: [...], mid: [...], low: [...] })` for tier scaling; header comment states hitbox radius and `top` mesh convention (turret follows `aux`). New neon trim uses HDR values above 1.0, in hues away from orange-yellow (D-39/D-40). Register in `enemy_models.js`; test in `web/test/render/models/<name>.test.js` copying `tank.test.js`.

### `web/src/render/pickup_instances.js` (medal) and palette retint

**Analog:** itself: stride 4 `x, y, colour index, kind`; `CYCLE = Object.freeze([PALETTE.CRYSTAL_RED, ...])`; geometry from `lathe`/`bake`/`tint`. Add a medal branch keyed on `kind` and the chain tier in the colour slot. `web/test/fx/palette.test.js` imports `PALETTE, PINK_EXCLUSION_DEGREES, PINK_MIN_SATURATION, hueDistance, hueOf, saturationOf`; re-key to the new bullet hue and extend the scan to model-local constants (tank `EMBER`, `wreck_ring.js` `FLAME_COLOR`, carrier beacon).

### `web/src/render/terrain_ring.js` -> city layer, `renderer_rig.js`

**Analog:** the current files themselves (not excerpted here beyond RESEARCH Pattern 5/10). Planner must read `terrain_ring.js`, `ground_layer.js`, `renderer_rig.js` lines 20-25 (HemisphereLight, sun, background `0x0b0a09`) and `web/test/render/terrain_ring.test.js`/`ground_layer.test.js` before planning. Static layout ships once through `manifest["stage"]`, never as a sink channel (`RenderSink.flush` re-assigns all attached channels on bulk flush).

## Shared Patterns

### Protocol / boundary changes
**Source:** `src/scorched_core/protocol.py` (PROTOCOL_VERSION 2 -> 3, HEADER_LEN 48 -> 64, new `EV_*` appended, caps `ENEMY_CAP`, `PICKUP_CAP`, `EBULLET_GAME_CAP`). **Apply to:** every plan that touches the header or events. Update in the same plan: `web/src/python/python_bridge.js` (`manifest.protocol !== 2`), `web/test/python/python_bridge.test.js` (`protocol: 2`, header length 48), `tests/scorched_web/test_entrypoint.py` (protocol and ebullet cap asserts).

### Event pushing and kill-buffer consumption
**Source:** `EventRing.push(...)` (six numbers, `low=` flag) and the `enemies.kills`/`kill_n`/`kill_*` buffer already used by `_drop_pickups` in `game/game.py`. Scoring, medals and boss settle follow this same drained-per-step pattern.

### Spec/data registries
**Source:** `tuning.py` per-kind `Final` tuples and `GALLERY_SCRIPT`. New data modules expose `Final` frozen dataclass instances and are validated by a test in the mirrored test file (spec radius <= `GRID_CELL - max(PBULLET_RADIUS, MISSILE_RADIUS)`, sorted `at`, registry names resolve).

### Test conventions
**Source:** `tests/scorched_core/stages/test_gallery_spawner.py` (plain functions, no classes, `pytest.approx` for floats, small `run()` helpers, exact-tick assertions), `tests/test_conventions.py` (mirror and one-class rules). JS: vitest with `createFakeDocument`. E2E: `tools/e2e/helpers.js` `bootGame` must append `gallery` by default before the default flips (Pitfall 13); `tools/perf_node.mjs` passes `gallery: true` for the existing runs and adds `--stage`.

### Makefile
Any new command (e.g. `perf --stage`) needs a matching root `Makefile` target; invoke via `uv run`/`make`.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `web/src/render/rain_layer.js` | component | GPU streaming | No procedural vertex-shader layer exists; closest is `fx/particle_system.js` (GPU spawn records), read it for shader/instancing conventions. |
| `web/src/render/night_rig.js` | component | config | Only the single hemisphere light in `renderer_rig.js`; use RESEARCH Pattern 10. |
| `src/scorched_core/stages/city_builder.py` | utility | transform (seeded RNG) | No seeded placement generator; use `Game.rng`-style `random.Random(seed)` per the existing determinism rule. |
| Vendored font + `@font-face` in `index.html` | asset | static | Precedent is the vendored zzfx (`web/src/audio/zzfx_synth.js`), see RESEARCH Standard Stack. |
| Boss death chain / hitstop wiring | service | event-driven | Use `clock/hitstop.py` `Hitstop.trigger(max)` and `fx/shake.js` as-is; no multi-event chain analog. |

## Metadata

**Analog search scope:** `src/scorched_core/**`, `src/scorched_web/**`, `web/src/{ui,render,fx,boot,audio}`, `web/test`, `tests`, `tools`
**Files read for excerpts:** gallery_spawner, terrain_scroll, bullet_patterns, fire_pattern, pickup_kind, enemy_pool (1-200), pickup_pool (1-60), player_life (1-40), sfx_router (1-50), render_sink (1-32), entrypoint (55-76), url_flags, status_readout (1-80), tank.js (1-50), pickup_instances.js (1-30), test files noted above
**Pattern extraction date:** 2026-10-18
