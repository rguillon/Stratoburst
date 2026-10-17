# Scorched

## What This Is

Scorched is an old-school vertical shoot-'em-up in the spirit of 90s arcade shmups (Raiden, Strikers 1945), written in Python and playable directly in a web browser with no server. Gameplay is classic 2D on a single plane, but everything is rendered in 3D — modern, polished visuals (lighting, bloom, particles, big explosions) seen through a tilted top-down camera. Military / scorched-earth theme: jets, tanks and gun emplacements over burning cities and deserts. Built for the author and friends, shared via a link.

## Core Value

Shooting feels great: tight, responsive ship control and satisfying, punchy 3D feedback (hits, explosions, screen shake) at a smooth framerate in the browser. If everything else is cut, the moment-to-moment shooting must feel like a real 90s arcade shmup.

## Requirements

### Validated

- ✓ Game logic written in Python, running fully client-side in the browser (Pyodide on GitHub Pages, no backend) — Phase 1
- ✓ 3D rendering (WebGL-class) with gameplay constrained to a 2D plane — Phase 1
- ✓ Fixed tilted top-down camera — Phase 1
- ✓ Keyboard controls (arrows/WASD + fire, physical keys so AZERTY works) — Phase 1
- ✓ Touch controls: relative 1:1 drag with auto-fire — Phase 1 (bomb button comes with bombs in Phase 2)
- ✓ Stable 60fps on desktop browsers; playable framerate on modern phones (stress mode, auto quality tiers) — Phase 1

### Active

- [ ] Modern polished look: dynamic lighting, bloom/glow, particle effects, explosions, screen shake
- [ ] All 3D models generated procedurally in code (no external model files required)
- [ ] Player ship with 8-direction movement, focused/precise hitbox
- [ ] Raiden-style weapon system: colored pickups switch weapon type (e.g. vulcan spread / laser / homing), same-color pickups level it up, dying drops power
- [ ] Limited bombs (screen-clearing, with brief invulnerability)
- [ ] Military enemy roster: aircraft, ground tanks, turrets, ships — scripted wave patterns
- [ ] Short campaign: 3–5 stages, each ending with a multi-phase boss
- [ ] Lives and continues
- [ ] Classic scoring: points per kill, medal/bonus pickups, stage-clear bonuses, local high-score table (persisted in browser storage)
- [ ] Title screen, pause, game-over / continue screen, high-score entry
- [ ] Bomb key and on-screen bomb button (with the bomb system)
- [ ] Sound effects and music (generated or code-synthesized where possible)

### Out of Scope

- Online leaderboards / accounts — no server; personal/friends project, local high scores are enough
- Gamepad support — not requested for v1 (could be cheap later via browser Gamepad API)
- Hand-authored / imported 3D models — models are built in code; polish comes from lighting, shaders and effects
- Multiplayer / co-op — not core to the experience
- Bullet-hell density and Cave-style chaining systems — target is 90s Raiden-style pacing with classic scoring
- Native desktop/mobile app builds — browser is the only target

## Context

- Phase 1 shipped: Pyodide + three.js core live on GitHub Pages; the ship flies and shoots over scrolling 3D terrain on desktop and phones.
- Key technical unknown: pygame is 2D-only, so "Python + 3D + browser" needs a specific stack. Candidates to evaluate: Python in Pyodide driving three.js (or Babylon.js) via JS interop; Panda3D's experimental WebAssembly build; pygbag with WebGL/OpenGL ES; Harfang3D or other WASM-capable Python 3D engines. Choice must balance: game logic genuinely in Python, WebGL post-processing (bloom), mobile performance, load time.
- Performance risk: Python-in-WASM per-frame overhead with many bullets/particles, especially on mobile. Hot paths (bullet updates, particles, rendering) may need to be batched/instanced or pushed to the JS/GPU side.
- "Modern polished" with code-built models: visual quality will rely on shaders, lighting, emissive/glow materials, particles, and camera effects rather than detailed geometry.
- Reference games: Raiden II/III/IV, Strikers 1945, Truxton; 3D-on-2D-plane references: Raiden III/IV, Ikaruga, Radiant Silvergun.

## Constraints

- **Language**: Game logic in Python — explicit user requirement
- **Platform**: Runs in the browser from static hosting, no backend — easy to share as a link
- **Assets**: 3D models generated in code — no external modeling pipeline
- **Input**: Keyboard (desktop) and touch (mobile) both required
- **Performance**: Must remain responsive on mobile browsers — shmups are unplayable with frame drops or input lag
- **Code style**: Clean, modern Python (3.14 idioms, type hints throughout, dataclasses/`__slots__`, enums, pattern matching where it helps; ruff for format and lint) — user requirement
- **Code organization**: One class per file; files organized in consistent, domain-based subdirectories (e.g. `entities/`, `weapons/`, `stages/`, `collision/`) mirrored by the test tree — user requirement
- **Testing**: pytest for all Python code, with 100% coverage (line + branch) enforced via `pytest-cov --cov-fail-under=100`; the Pyodide adapter layer is tested against a fake `js` module so coverage can be measured natively — user requirement

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 3D graphics, 2D gameplay plane | User wants 3D visuals with classic shmup gameplay | — Pending |
| Python running in the browser (WASM), no server | User choice; shareable link, no hosting cost | ✓ Good — live on GitHub Pages (rguillon/Stratoburst) |
| 90s arcade era (Raiden-style) over bullet hell | User choice | — Pending |
| Raiden-style colored weapon pickups | User choice | — Pending |
| Fixed tilted top-down camera | User choice | ✓ Good — 25° tilt, 30° FOV, letterboxed portrait playfield |
| Procedural/code-built models | User choice; no asset pipeline | — Pending |
| GitHub Pages hosting with gated CI/CD and PR previews | Static host, no special headers needed on the main thread | ✓ Good — Phase 1 |
| Fixed 60 Hz sim, one batched tick per frame, uniform-grid broadphase | Keeps Python cost within 3 ms per frame and speed independent of refresh rate | ✓ Good — tick ~1.1 ms at 500 stress bullets |
| 3D rendering stack | Research: Pyodide 314.0.7 + three.js 0.186.1 WebGL2, Babylon.js as fallback | ✓ Good — desktop and phone checks passed in Phase 1 UAT |
| One class per file, domain subdirectories | User coding standard | — Pending |
| pytest with 100% line+branch coverage gate | User quality standard; pure core makes it achievable | ✓ Good — enforced in CI through Makefile targets |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-10-17 after Phase 1*
