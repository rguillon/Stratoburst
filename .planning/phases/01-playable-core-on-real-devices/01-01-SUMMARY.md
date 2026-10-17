---
phase: 01-playable-core-on-real-devices
plan: 01
subsystem: infra
tags: [pyodide, three, vite, pytest, ruff, uv, playwright, vitest, make]

requires: []
provides:
  - "Walking skeleton: Python (Pyodide 314.0.7) moves a three.js ship from arrow keys in a production build"
  - "Frozen boundary contract: protocol.py constants, Game.manifest(), header/pbullets/ebullets/drones channels, tick signature"
  - "scorched_core (pure) and scorched_web (adapter) Python packages at 100% line+branch coverage"
  - "Convention guards (tests/test_conventions.py), vitest specs, Playwright smoke spec"
  - "Root Makefile exposing every developer command (uv + npm wrappers)"
affects: [01-02, 01-03, 01-04, 01-05, 01-06, 01-07, 01-08, 01-09, 01-10]

plan_head_before: d8910c66e45ed6f0bb9cb5612de1c047a26d6fca
plan_head_after: f277258282d3a38e4cbac6c9d4329d5c5793286b

actuals:
  tokens: 10500
  tasks: 3
  commits: 2

tech-stack:
  added:
    - "pyodide 314.0.7 (npm wrapper; runtime from jsDelivr)"
    - "three 0.186.1"
    - "vite 8.3.4, vitest 5.0.5, @playwright/test 1.64.1"
    - "pytest 9.1.1, pytest-cov 7.1.0, ruff 0.17.1 (uv-locked)"
    - "Node 24.22.0 (sha256-verified tarball in ~/.local/opt)"
  patterns:
    - "One held tick PyProxy called once per rAF with primitives only"
    - "Python array('f') buffers assign()-ed into JS-owned Float32Arrays allocated from manifest()"
    - "Python sources bundled via import.meta.glob ?raw and written to the Pyodide FS under /lib"
    - "scorched_core is stdlib-only; scorched_web receives JsProxy-like objects by injection"
    - "Convention rules enforced by AST tests (one class per file, mirrored tests, core purity)"

key-files:
  created:
    - Makefile
    - pyproject.toml
    - uv.lock
    - package.json
    - package-lock.json
    - vite.config.js
    - playwright.config.js
    - index.html
    - src/scorched_core/protocol.py
    - src/scorched_core/tuning.py
    - src/scorched_core/clock/fixed_step_runner.py
    - src/scorched_core/entities/player_ship.py
    - src/scorched_core/game/game.py
    - src/scorched_web/bridge/render_sink.py
    - src/scorched_web/web_game.py
    - src/scorched_web/entrypoint.py
    - tests/test_conventions.py
    - web/src/main.js
    - web/src/python/python_bridge.js
    - web/src/loop/frame_loop.js
    - tools/e2e/smoke.spec.js
  modified: []

key-decisions:
  - "Task 1 approval: manifest approved as presented, amended to require Astral uv and a root Makefile (verbatim reply recorded below)"
  - "Ruff is configured with extend-exclude for .planning/.claude because ruff 0.17 formats Python fences inside Markdown"
  - "Makefile test target runs npm test only when vitest specs exist (wildcard), so it works before and after the specs land"
  - "Header slots not yet owned by a feature (SCROLL_Y, FLAGS, counts, STORM_HITS, DRONES_DOWN) stay 0; only STEPS, ALPHA, SHIP_X, SHIP_Y, TICK_COUNT are packed"

patterns-established:
  - "Pattern: every new dev command gets a Makefile target wrapping an npm script or uv run"
  - "Pattern: adapter classes take duck-typed JsProxy-like objects; tests use FakeTypedArray, no js module needed"
  - "Pattern: constants-only modules are allow-listed in CONSTANTS_ONLY and verified to contain no defs"

requirements-completed: [PLAT-02, PLAT-11]

coverage:
  - id: D1
    description: "Python-driven ship moves under ArrowRight in a production build served by vite preview, Pyodide 314.0.7 loaded from jsDelivr"
    requirement: PLAT-02
    verification:
      - kind: e2e
        ref: "tools/e2e/smoke.spec.js#python moves the ship with the arrow keys"
        status: pass
    human_judgment: false
  - id: D2
    description: "Python core and web adapter run headlessly with no browser or network, 100% line+branch, adapter tested through fake typed arrays"
    requirement: PLAT-11
    verification:
      - kind: unit
        ref: "uv run pytest --cov --cov-branch --cov-fail-under=100"
        status: pass
    human_judgment: false
  - id: D3
    description: "RenderSink.attach rejects unknown channels and JS/Python length mismatches at boot"
    verification:
      - kind: unit
        ref: "tests/scorched_web/bridge/test_render_sink.py"
        status: pass
    human_judgment: false
  - id: D4
    description: "Repository organisation rules fail the suite when violated (core purity, one class per file, mirrored tests, orphan tests)"
    verification:
      - kind: unit
        ref: "tests/test_conventions.py"
        status: pass
    human_judgment: false
  - id: D5
    description: "URL flag grammar, keyboard reduction and frame loop dt/error semantics"
    verification:
      - kind: unit
        ref: "npm test (web/test/**)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Error panel shows on load or frame failure with textContent-only insertion"
    verification: []
    human_judgment: true
    rationale: "Built and grep-checked for HTML-insertion APIs, but no automated test triggers it; plan 01-09 adds the ?crash=py|js path that exercises it"

duration: 25min
completed: 2026-10-17
status: complete
---

# Phase 1 Plan 01: Walking Skeleton Summary

**Pyodide 314.0.7 runs a pure-Python fixed-step core that moves a three.js ship through one held tick proxy per frame, proven in a production build by Playwright, with 100% covered Python, vitest specs, AST convention guards and a uv-based Makefile.**

## Performance

- **Duration:** about 25 min (this continuation; Task 1 was resolved in an earlier session)
- **Completed:** 2026-10-17T14:55Z
- **Tasks:** 3 (Task 1 checkpoint resolved, Task 2 tracer, Task 3 guard rails)
- **Files modified:** 47 files created across the two code commits (about 2861 insertions including lockfiles)

## Accomplishments

- Production build loads Pyodide 314.0.7 from `https://cdn.jsdelivr.net/pyodide/v314.0.7/full/`, writes the bundled Python sources into the FS and moves the ship from Python. Playwright: holding ArrowRight for 500 ms raises SHIP_X by more than 20 while TICK_COUNT advances, with no `#error-panel`.
- Boundary contract frozen: 16-slot header, `pbullets`/`ebullets`/`drones` channels allocated from the manifest, `tick(dt_ms, buttons, move_x, move_y, drag_x, drag_y) -> steps`. Later slices only fill channels.
- `uv run pytest --cov --cov-branch --cov-fail-under=100` passes (77 tests, 100.00%) with no browser. `scorched_web` is exercised through a `FakeTypedArray`.
- `tests/test_conventions.py` makes the user's organisation rules executable. Mutation proof below.
- `make check` (lint, test, build, e2e) is green.

## Task 1 Approval (recorded before any install)

Task 1 (`checkpoint:human-verify`, `gate="blocking-human"`) was resolved by the user. User reply, verbatim:

> I also want you to use astral uv and a Makefile for the targets

Interpretation: the pinned manifest was approved exactly as presented, with one amendment (uv for all Python tooling and a root Makefile exposing every command). The approved manifest was installed unchanged:

- Node v24.22.0 linux-arm64, SHA-256 `fef00bb4d36e1c50104a9775a10359beee98f162b4104dd12472c75065c6a143`
- pyodide 314.0.7, three 0.186.1, vite 8.3.4, vitest 5.0.5, @playwright/test 1.64.1
- pytest 9.1.1, pytest-cov 7.1.0, ruff 0.17.1 (coverage 7.16.2 as transitive)

**Node SHA-256 check (T-01-05):** the tarball's hash, the official `SHASUMS256.txt` entry and the value recorded in research were all `fef00bb4d36e1c50104a9775a10359beee98f162b4104dd12472c75065c6a143`. Verified before extraction to `~/.local/opt/node-v24.22.0-linux-arm64`; `node`, `npm`, `npx` are symlinked in `~/.local/bin` (`node --version` prints v24.22.0). System `/usr/bin/node` 18.19.1 was not touched.

## Task Commits

1. **Task 1: Approve the pinned toolchain and dependency manifest** - no commit (checkpoint; resolution recorded above)
2. **Task 2: Tracer, arrow keys move a Python-driven ship in a production build** - `7105b90` (feat)
3. **Task 3: Guard rails, convention tests and vitest specs** - `f277258` (test)

**Plan metadata:** committed separately after this file (docs: complete plan).

## Mutation Proof (Task 3)

Both temporary violations made `tests/test_conventions.py` fail, then were reverted (`git status src` clean, suite back to 37 passed):

1. `import time` added to `src/scorched_core/tuning.py`: `FAILED tests/test_conventions.py::test_core_is_pure[src/scorched_core/tuning.py]` (1 failed, 36 passed).
2. A second top-level class added to `src/scorched_core/entities/player_ship.py`: `FAILED tests/test_conventions.py::test_one_class_per_file_named_after_the_file[src/scorched_core/entities/player_ship.py]` (1 failed, 36 passed).

Allow-list: `CONSTANTS_ONLY` contains exactly `protocol.py` and `tuning.py`.

## Files Created/Modified

- `Makefile` - help (default), install, browsers, lint, format, test, build, dev, preview, e2e, check, clean; `.PHONY` declared (user-requested)
- `pyproject.toml`, `uv.lock`, `.python-version` - uv-managed Python 3.14 project, pytest/coverage/ruff config
- `package.json`, `package-lock.json`, `.node-version`, `vite.config.js`, `playwright.config.js`, `index.html`, `public/.nojekyll` - web toolchain with exact pins and `base: './'`
- `src/scorched_core/{protocol,tuning}.py`, `clock/fixed_step_runner.py`, `entities/player_ship.py`, `game/game.py` - pure core
- `src/scorched_web/{entrypoint,web_game}.py`, `bridge/render_sink.py` - JS-aware adapter
- `tests/**` - mirrored pytest tree plus `tests/test_conventions.py`
- `web/src/**` - boot (error panel, URL flags, runtime loader), Python bridge, frame loop, keyboard input, renderer rig, ship model, `main.js`
- `web/test/**` - vitest specs for url_flags, keyboard_input, frame_loop
- `tools/e2e/{helpers,smoke.spec}.js` - Playwright smoke test

## Decisions Made

- Honoured the Task 1 amendment: Python only through uv (`uv sync`, `uv run`, committed `uv.lock`), commands exposed as Makefile targets. npm scripts are kept because later plans reference them.
- `extend-exclude = [".planning", ".claude", "node_modules", "dist"]` in ruff config: ruff 0.17.1 reformats Python code fences in Markdown, and the first `ruff format .` rewrote three planning documents (reverted with `git checkout --` on those exact files before any commit).
- The unused `buttons`, `drag_x`, `drag_y` parameters on `Game.tick` carry targeted `noqa: ARG002` comments with reasons, because the signature is frozen for plans 01-06 and 01-08.
- `Game.tick` always packs the five owned header slots, even on a 0-step frame, so JS reads a consistent ALPHA every frame.

## Deviations from Plan

### User-requested

**1. [User requirement] Root Makefile and uv-only Python tooling**
- **Found during:** Task 1 resolution (user amendment), implemented in Task 2
- **Change:** Added `Makefile` with `help` (default), `install`, `browsers`, `lint`, `format`, `test`, `build`, `dev`, `preview`, `e2e`, `check`, `clean`. `test` adds `npm test` only when vitest specs exist. `install` uses `uv sync --locked` and `npm ci`. `browsers` is an extra convenience target. Also recorded in `.claude/CLAUDE.md` under "Tooling".
- **Files:** `Makefile`
- **Verification:** `make check` passes end to end after Task 3.
- **Committed in:** `7105b90`

### Auto-fixed Issues

**2. [Rule 3 - Blocking] Ruff formatted Markdown planning files**
- **Found during:** Task 2 (first `uv run ruff format .`)
- **Issue:** ruff 0.17.1 formats Python code blocks in `.md`, which modified `01-PATTERNS.md`, `01-RESEARCH.md` and `research/ARCHITECTURE.md`.
- **Fix:** Restored the three tracked files with `git checkout -- <file>` (specific paths only), then added `extend-exclude` to `[tool.ruff]`.
- **Files modified:** `pyproject.toml`
- **Verification:** `git status` showed no tracked-file modifications afterwards; `ruff check` and `ruff format --check` pass.
- **Committed in:** `7105b90`

**3. [Rule 1 - Bug] Ruff PLR0917 on the frozen six-argument tick signature**
- **Found during:** Task 2
- **Issue:** the planned `noqa: PLR0913` alone left PLR0917 (too many positional arguments) failing the lint gate.
- **Fix:** `# noqa: PLR0913, PLR0917` with a justification on `Game.tick` and `WebGame.tick`.
- **Files modified:** `src/scorched_core/game/game.py`, `src/scorched_web/web_game.py`
- **Committed in:** `7105b90`

**4. [Rule 1 - Bug] Conventions test used pytest.skip for allow-listed modules**
- **Found during:** Task 3
- **Issue:** skipping inside the parametrised mirrored-test check produced noisy skips in `-ra` output.
- **Fix:** filter allow-listed modules out of the parametrisation list instead.
- **Files modified:** `tests/test_conventions.py`
- **Committed in:** `f277258`

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 bugs) plus 1 user-requested addition.
**Impact on plan:** No scope creep; the Makefile is the only addition and was mandated by the user.

## Authentication Gates

None.

## Issues Encountered

- `vite build` prints "externalized for browser compatibility" warnings for `node:*` modules imported by `pyodide.mjs`. The build output is correct and the Playwright smoke test passes, so they are harmless noise from the Pyodide Node code paths. Also a chunk-size warning (570 kB, 146 kB gzip) which is expected with three.js plus the Pyodide wrapper.
- Smoke test passes headless against `vite preview` with Pyodide fetched from jsDelivr, as required. It has not been run on the real GitHub Pages host or a phone; that is plans 01-02 and 01-10.

## Known Stubs

| File | Line | Reason |
|------|------|--------|
| `web/src/render/ship_model.js` | 3 | Placeholder cone ship; plan 01-06 builds the real jet and hitbox marker |
| `web/src/render/renderer_rig.js` | 23 | Flat stand-in ground and fixed camera distance; plan 01-05 adds terrain and camera fit |

Both are intentional per the plan and do not block this plan's goal. They are also appended to `.planning/WINDOWS.md`.

## Threat Flags

None. No network endpoint, auth path or file-access surface was added beyond the plan's threat model (T-01-01 exact CDN pin, T-01-02 allow-listed URL flags and textContent-only panel, T-01-04 length validation in `RenderSink.attach`, T-01-05 SHA-256 check, T-01-SC package gate).

## User Setup Required

None - no external service configuration required. The machine now has Node 24.22.0 in `~/.local/opt` (symlinked into `~/.local/bin`), which shadows system Node 18.19.1 for this user only.

## Next Phase Readiness

- Plan 01-02 can deploy the same `dist/` to GitHub Pages and reuse `make check` as the gate (`make install` for CI, `BASE_URL` for the Playwright run against the real host).
- The boundary contract and tick signature are frozen. Plans 01-03 to 01-09 fill channels and consume `buttons`, `drag_x`, `drag_y` without contract changes.
- Open concern: the error panel has no automated trigger test yet (plan 01-09 adds `?crash=`).

---
*Phase: 01-playable-core-on-real-devices*
*Completed: 2026-10-17*

## Self-Check: PASSED

Verified: all key files exist on disk; commits `7105b90` and `f277258` are ancestors of HEAD; `make check` green (ruff, pytest 77 passed at 100.00%, vitest 22 passed, vite build, Playwright 1 passed).
