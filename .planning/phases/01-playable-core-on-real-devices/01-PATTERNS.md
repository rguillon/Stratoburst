# Phase 1: Playable Core on Real Devices - Pattern Map

**Mapped:** 2026-10-17
**Files analyzed:** ~75 planned (Python core ~25, Python web adapter 2, JS ~30, config/CI ~12, tests mirror)
**Analogs found:** 0 in-repo / all. The repo is greenfield: `git ls-files` has no source. No tracked analog exists, so every pattern source is a RESEARCH.md sketch or a CLAUDE.md convention. Phase 1 creates the analogs that later phases copy.

## Ordering rule for the planner
The first file of each kind becomes the in-repo analog for the rest. Build in this order and have later plans cite the earlier file:
1. `protocol.py` (constants-only module pattern).
2. `fixed_step_runner.py` and its test (the dataclass + pytest template).
3. `button.py` (enum template).
4. `bullet_pool.py` (SoA pool template).
5. `game.py` (facade).
6. JS: `error_panel.js`, then `runtime_loader.js`, then `frame_loop.js`.

## File Classification

| File | Role | Data Flow | Pattern Source | Match |
|------|------|-----------|----------------|-------|
| `src/scorched_core/protocol.py` | config (constants) | n/a | CLAUDE.md + RESEARCH Pattern 2 channel table | none |
| `clock/fixed_step_runner.py` | service | transform | RESEARCH Pattern 3 code block | sketch |
| `clock/refresh_estimator.py` | utility | transform | RESEARCH Pattern 3 (prose) | none |
| `input/button.py` | model (IntFlag enum) | n/a | CLAUDE.md "enums" | none |
| `input/input_frame.py` | model (dataclass slots) | n/a | CLAUDE.md "dataclasses/`__slots__`" | none |
| `entities/player_ship.py` | model/service | transform | RESEARCH Pattern 7 (pending/catch-up rule) | none |
| `entities/drone.py` | model | n/a | RESEARCH Pattern 7 (drone numbers) | none |
| `pools/bullet_pool.py`, `drone_pool.py` | store | batch (SoA `array('f')`, swap-remove) | RESEARCH Pattern 2 + ARCHITECTURE.md | none |
| `weapons/twin_shot.py` | service | event-driven | RESEARCH Pattern 7 | none |
| `collision/circle_hits.py` | utility (functions) | transform | RESEARCH Pattern 7 (x-reject brute force) | none |
| `spawning/drone_spawner.py` | service | event-driven | RESEARCH Pattern 7 (seeded `random.Random`) | none |
| `stress/bullet_storm.py` | service | batch | RESEARCH summary (500 bullets, 0.3-0.4 ms/tick) | none |
| `stages/terrain_scroll.py` | model | transform | RESEARCH Pattern 6 | none |
| `game/game.py`, `game/fault_mode.py` | facade, enum | request-response | RESEARCH Pattern 2 (`tick` signature) | none |
| `src/scorched_web/bridge/render_sink.py` | adapter | streaming (`assign`) | RESEARCH Pattern 2 | none |
| `src/scorched_web/entrypoint.py` | adapter | request-response | RESEARCH Pattern 2 (`to_py`, manifest) | none |
| `web/src/boot/*.js` (error_panel, url_flags, loading_screen, start_gate, runtime_loader) | utility/component | event-driven | RESEARCH Patterns 1, 10 | sketch (runtime_loader) |
| `web/src/loop/*.js` (frame_loop, pause_controller, frame_stats) | service | event-driven | RESEARCH Patterns 2, 3, 9 | none |
| `web/src/input/*.js` | service | event-driven | RESEARCH Pattern 7 | none |
| `web/src/render/*.js` | component | streaming | RESEARCH Patterns 4, 5, 6 | sketch (bullet_instances) |
| `web/src/quality/*.js` | service | transform | RESEARCH Pattern 8 | none |
| `web/src/debug/*.js` | component | event-driven | RESEARCH Pattern 9 | none |
| `web/src/python/*.js` | service | file-I/O | RESEARCH (`import.meta.glob ?raw` + `FS.writeFile`) | none |
| `tests/**/test_*.py`, `tests/test_conventions.py` | test | n/a | CLAUDE.md + RESEARCH structure section | none |
| `pyproject.toml`, `.python-version`, `uv.lock`, `package.json`, `vite.config.js`, `.node-version`, `.gitignore`, `public/.nojekyll`, `index.html` | config | n/a | RESEARCH Installation + Pattern 11 | none |
| `.github/workflows/{gate,deploy,preview}.yml` | config (CI) | batch | RESEARCH Pattern 11 YAML skeletons | sketch |

## Pattern Assignments (no in-repo analog; copy from these sources)

### Every Python file (CLAUDE.md, hard constraints)
- One class per file, snake_case file name equals the class name (`PlayerShip` in `player_ship.py`). This includes enums and dataclasses.
- Domain subdir under `src/scorched_core/<domain>/`, mirrored at `tests/scorched_core/<domain>/test_<module>.py`.
- Python 3.14, full type hints, `@dataclass(slots=True)`, enums, `match` where it helps. `ruff check` and `ruff format --check` must pass (`target-version = "py314"`).
- `scorched_core` imports stdlib only. Never import `js` or `pyodide` there.
- 100% line + branch coverage via `pytest --cov --cov-branch --cov-fail-under=100`.
- No `# pragma: no cover` unless justified.
- Hot loops: no per-frame allocation, use preallocated `array('f')`, no per-entity FFI.

### `clock/fixed_step_runner.py` (service, transform)
**Source:** 01-RESEARCH.md Pattern 3, code block around lines 325-351. This is the one real Python template in the research, so use it as the style exemplar for every other Python file.
```python
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
            self.acc = 0.0
        return steps
```
**Test pattern (Pattern 3 "Tests that prove PLAT-06/08"):** synthetic dt sequences at 30/60/120/144 Hz with jitter, asserting 600 +/- 1 steps over 10 s. A 5 s gap yields at most 3 steps. Pause then resume with a huge dt yields 0 extra steps.

### `protocol.py` (constants-only)
Source: RESEARCH Pattern 2 channel table.
- Header: 16 float32 slots `[steps, scroll_y, alpha, ship_x, ship_y, flags, pbullet_n, ebullet_n, drone_n, tick_count, graze_count, ...]`.
- Strides: `pbullets` 4 (cap 128), `ebullets` 4 (cap `max(600, N)`, max 5000), `drones` 8 (cap 32).
- `flags`: bit 0 = paused, bit 1 = firing.
- Playfield 240x320, `SHIP_SPEED = PLAYFIELD_W / (1.2 * 60)` = 3.333.
- Constants-only modules are exempt from the one-class and mirrored-test guards via the allow-list in `test_conventions.py`.
- `tick(dt_ms, buttons, move_x, move_y, drag_x, drag_y) -> int` returns the steps run.

### `game/game.py` + `scorched_web/*` (boundary)
Source: RESEARCH Pattern 2 (lines 298-317).
- JS calls one held `tick` proxy per rAF, with primitives only.
- Python packs `array('f')` and calls `sink.assign(js_typed_array)`.
- `RenderSink.attach` validates lengths at boot, because `assign` raises `ValueError` on mismatch.
- `manifest()` returns a dict that JS reads with `toJs({dict_converter: Object.fromEntries, create_pyproxies: false})`, then destroys the proxy.
- Skip pack/assign when 0 steps ran.
- Pytest tests `scorched_web` against a fake `js` module so it is measurable natively.

### `PlayerShip` (pending/catch-up rule), Pattern 7
- Normalize the keyboard vector if its length is greater than 1.
- Move by `min(|pending|, SHIP_SPEED)` per step.
- Clamp the pending length to a lag cap of 40 units.
- After clamping to the playfield edge, zero the pending component on any blocked axis. This needs a dedicated pytest.

### `web/src/boot/runtime_loader.js` (service, file-I/O)
Source: RESEARCH Pattern 1, lines 264-296. Use `trackFetch` (wrap `globalThis.fetch` during `loadPyodide` only, counting decoded bytes) and the `DECODED_BYTES` table beside the version pin (total 12,262,932). `loadPyodide({ indexURL: CDN })` with the exact-pinned jsDelivr URL.

### `web/src/render/bullet_instances.js`
Source: RESEARCH Pattern 5, lines 368-394.
- `InstancedBufferGeometry` plus an `InstancedBufferAttribute` on the same Float32Array that Python assigns into.
- Per frame: `clearUpdateRanges(); addUpdateRange(0, n*4); needsUpdate = true; geo.instanceCount = n`.
- `frustumCulled = false`.
- Each `#include` goes on its own line, and include `tonemapping_fragment` and `colorspace_fragment`.

### CI workflows
Source: RESEARCH Pattern 11, lines 447-497.
- Reusable `gate.yml` (`workflow_call`) runs `uv sync --locked`, ruff check, ruff format --check, pytest with the cov gate, `npm ci` and `npm run build`.
- `deploy.yml` (push to main) calls the gate, then `JamesIves/github-pages-deploy-action` with `clean-exclude: pr-preview/`.
- `preview.yml` uses `rossjrw/pr-preview-action`.
- Third-party actions are pinned by the full SHAs listed in the RESEARCH Standard Stack table.
- A human checkpoint for repo and Pages setup comes from D-05.
- One consolidated dependency `checkpoint:human-verify` precedes the first `npm install` / `uv sync`.

## Shared Patterns

### Error handling
**Source:** RESEARCH Pattern 10.
- `error_panel.js` is installed first and has no three or Pyodide dependency.
- It is the single sink for `onerror`, `unhandledrejection`, frame try/catch, load failure, load timeout, and WebGL context loss.
- Use `textContent` only.
- Fault injection goes through the `FaultMode` enum and the `?crash=py|js` flags.
- **Apply to:** all JS boot and loop files.

### Repo-convention guards
**Source:** RESEARCH structure section. `tests/test_conventions.py` is AST-based and checks four things:
- No `js` or `pyodide` import in `scorched_core`.
- At most one top-level class per file, named to match the file.
- A mirrored test for every `src` module (allow-list for constants modules and `__init__`).
- Test files mirror source paths.

### Determinism
Seeded `random.Random` only. No wall-clock reads in the core. The fixed 60 Hz step is owned by Python.

### Pause
`Game.set_paused` is Python-owned. JS triggers it on visibilitychange, blur and pagehide, clears input, and resets `lastTs`. Resume zeroes the accumulator.

## No Analog Found
Everything. The planner should treat the RESEARCH.md sketches above as the pattern source, and make the first-written file of each kind explicitly the analog for later plans (see "Ordering rule").

## Metadata
**Analog search scope:** whole repo (`git ls-files`, only `.planning/` and `.claude/CLAUDE.md` are tracked). No mirror or gitignored paths are referenced.
**Sources read:** 01-CONTEXT.md in full, and 01-RESEARCH.md lines 1-502 (through Pattern 11 and Anti-Patterns). The remaining ~350 lines (Code Examples, Pitfalls, Planning Notes) were not read.
**Pattern extraction date:** 2026-10-17
