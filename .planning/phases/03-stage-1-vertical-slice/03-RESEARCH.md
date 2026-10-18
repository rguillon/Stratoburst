# Phase 3: Stage 1 Vertical Slice - Research

**Researched:** 2026-10-18
**Domain:** Data-driven shmup content pipeline (stage timeline, enemy paths, bullet patterns, composite boss, scoring/lives/flow state machine) on a Pyodide sim core, plus a neon-night three.js re-light, city ground layer and DOM HUD
**Confidence:** HIGH on the integration seams (all read from the repo this session); MEDIUM on tuning numbers (HP, timings, budgets are proposals that need the `?at=` playtest loop); LOW on anything visual that has not been seen on a phone.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Stage 1 layout & pacing (ENMY-01, ENMY-02, ENMY-05, STGE-03)
- **D-01:** **Stage length is about 3 min from start to boss,** not counting the boss fight.
- **D-02:** **Stage 1 has one mid-boss** about halfway: a **heavy tank / armored train** with 2 destructible turret parts. It previews the parts mechanic on the ground.
- **D-03:** **Stage data is authored as typed Python data modules**, e.g. `stages/stage_1.py`: frozen dataclasses or tuples of waves, enemy paths and placements. There are no TOML/JSON files and no parser. Data modules are linted and covered like everything else. "Data, not engine code" means a new wave or pattern is a new data entry. — **Reversibility:** costly — every stage and pattern for stages 1-3 is authored in this form
- **D-04:** **The timeline is keyed on scroll distance,** not ticks. Waves and ground placements trigger at fixed `TerrainScroll.distance` positions, so ground units line up with city blocks and the stage is deterministic. Wave-gating (waiting for a clear) is rejected.
- **D-05:** **Only selected buildings are destructible.** Some buildings and props (fuel tanks, depots, houses) are flagged in the data as targets. They blow up, leave rubble and a scorch mark, and often drop a medal. The rest is scenery. This keeps ground entity counts in budget.
- **D-06:** **The scroll slows to a crawl for the boss fight** and does not stop. The terrain keeps moving slowly under the bomber.
- **D-07:** **The difficulty is approachable.** A first-timer can reach the boss with a life or two lost. Bullets are slow and sparse, in Raiden pacing. Phase 4's Easy/Hard scale from this baseline.
- **D-08:** **Pickups are generous.** A carrier comes about every 30-40 s, so a good run reaches Lv4-5 by the boss, plus a few bomb pickups along the way. Reuses Phase 2 D-16/D-19 crystals and carriers.

### The boss & mid-boss (ENMY-06, ENMY-07, ENMY-09)
- **D-09:** **The stage 1 boss is a giant bomber (air)** over the city. Its wing turrets and engines are the destructible parts.
- **D-10:** **The boss has 3 phases.** Phase 1: parts intact, turret fire. Phase 2: the core opens with a new pattern. Phase 3: desperation, with faster and denser fire (still not bullet hell).
- **D-11:** **The move from phase 1 to phase 2 is triggered by hull HP crossing a threshold OR all parts being destroyed,** whichever comes first. Parts are optional point targets, and destroying them speeds the fight up and pays points.
- **D-12:** **The fight lasts about 60-75 s at typical power, and the timeout is about 100 s** (tunable). On timeout **the boss retreats** off screen, the stage still clears, and the boss-kill bonus is 0. The mid-boss also needs a timeout, at Claude's discretion.
- **D-13:** **The boss entrance is a flashing WARNING banner with an alarm SFX.** Then the bomber's shadow sweeps over and the bomber descends into view.
- **D-14:** **A destroyed part is a big event** (shake + hitstop, per Phase 2 D-26). The part becomes a **smoking, burning stump** on the hull for the rest of the fight. The boss kill gets the biggest explosion and shake in the game.

### Scoring, medals & lives (SCOR-01..05)
- **D-15:** **Medals are Raiden II style.** Destroyed flagged buildings and some ground targets drop a medal that drifts with the scroll. The medal is not gold: it must avoid the orange-yellow bullet color (D-39/D-40), for example a white/cyan holo chip. Values climb 100 → 200 → 500 → 1000 → … up to a 10000 cap (exact ladder is tunable data). **A medal that scrolls off resets the chain** to the base value.
- **D-16:** **Dying also resets the medal chain.**
- **D-17:** **The player has 3 starting lives, with extends at 200k and then every 500k** (tunable; Phase 4 difficulty changes the life count). Game over comes when the last life is lost.
- **D-18:** **The stage-clear bonus has four lines,** counted up one by one with SFX: boss destroyed (0 on retreat), medals collected, no-miss bonus, and a bonus per unused bomb.
- **D-19:** **Scoring stays simple.** Fixed points per enemy, part and building kind (data tables), with no multipliers or point-blank bonus (Cave-style chaining is out of scope). The deferred **Lv5 MAX pickup bonus (Phase 2 D-06) is a flat score award.**
- **D-20:** **World score popups appear only for medal pickups** (showing the chain value) **and destroyed boss/mid-boss parts.** Regular kills show no popup, so bullets stay readable.
- **D-21:** **An extend shows a short "1UP"/"EXTEND" banner with a distinct chime,** and the HUD lives icon pulses.
- **D-22:** **The HUD high score is a single best score in `localStorage`,** read and written through the adapter (`js.localStorage`), and tolerant of storage failures. Phase 4's top-10 initials table extends or replaces it.

### HUD & end-of-run flow (SCOR-08)
- **D-23:** **The HUD is drawn over the playfield edges,** arcade style: score and high score along the top, lives and bombs bottom-left, weapon/level bottom-right. It must work on phones that have no letterbox margins, and it must not collide with the touch bomb button (Phase 2 D-13).
- **D-24:** **The HUD is a DOM overlay in an arcade pixel/monospace font** with a subtle glow. It extends the `status_readout.js` approach: text only through `textContent`, and the DOM is only touched when a value changes. No three.js text.
- **D-25:** **The boss HP bar is a thin bar at the top** that appears with the WARNING, with tick marks at the phase thresholds. A timeout readout appears only in the last 20 s.
- **D-26:** **Stage intro:** the ship flies up from the bottom, reusing the respawn fly-in from Phase 2 D-14, while a "STAGE 1" banner fades. About 2 s.
- **D-27:** **After the clear tally comes a brief "STAGE CLEAR," then stage 1 restarts** with score, lives and power kept, so the run continues until game over. It's a placeholder loop until Phase 4 adds stages 2-3.
- **D-28:** **Game over is a minimal overlay** with the final score and the best score, plus "NEW RECORD" if the best was beaten. Any fire key or tap restarts stage 1 fresh. Phase 4 adds the continue countdown and the title screen.
- **D-29:** **Stage 1 replaces the gallery as the default game** (Phase 2 D-20). **The gallery stays reachable behind `?gallery`.**
- **D-30:** **A debug jump flag `?at=midboss` / `?at=boss`** starts the timeline at a named marker. It combines with the existing `?weapon` / `?level` / `?bombs` / `?god` flags to set power. It joins the URL flag grammar in `web/src/boot/url_flags.js` and is invisible to normal players.

### General game look: neon military cyberpunk (STGE-03, VISL)
*Revised 2026-10-18 after discussion. This replaces the earlier dusk / smoky-orange direction.*

- **D-31:** **The art direction is neon military cyberpunk, for the whole game.** The war theme and the roster stay: jets, helicopters, tanks, turrets, the heavy-tank mid-boss and the giant bomber boss. They are set in a neon megacity at night with glowing trim. This is a change of art direction, not of theme. Stages 2-3 (Phase 4) become neon variants of their settings. — **Reversibility:** costly — it sets the palette, lighting and model accents for every stage and model generator
- **D-32:** **Stage 1 is at night, in the rain, under neon signs.** A dark blue-violet base, wet reflective streets, holographic billboards, neon trim on buildings and light fog. This is the Blade Runner / Akira look, and bloom is a main tool for it.
- **D-33:** **The city is a neon city under attack.** The warzone stays: fires, smoke and explosions against the neon. Destroyed buildings spark, and their signs flicker and short out. Destruction and medal drops are unchanged (D-05, D-15).
- **D-34:** **The city is built from hand-placed blocks on a road grid.** Stage data places building, sign and prop kinds on city blocks with roads between them. Models are code-generated in the Phase 2 smooth stylized style (D-24) with emissive neon trim, and scale with the quality tier (D-25). Destructible ones are flagged in the data. Placement is deterministic and in step with the scroll timeline.
- **D-35:** **The stage arc is slums → neon downtown → rooftop airbase.** It opens on dark low-rise slums with sparse neon. Then comes dense downtown with towers and billboards, where the mid-boss runs on an elevated maglev line. It ends at a lit military airbase where the bomber arrives.
- **D-36:** **The atmosphere is rich and scales with tier.** Rain streaks, wet-street reflections (cheap fakes are fine, e.g. glossy roughness or mirrored glow strips), flickering signs, fire and smoke plumes, sparks and fog. Low tier drops rain, reflections and plumes to hold framerate. Particles stay GPU-driven (no Python particle sim).
- **D-37:** **The whole scene is re-lit for neon night.** The current single `HemisphereLight` and near-black background give way to a night rig: a cool blue-violet ambient/moon light, colored neon fill, fog, and emissive materials doing most of the work. Bloom is retuned per tier. The existing Phase 2 models are kept and gain neon trim, with no bigger art pass.
- **D-38:** **Faction colors.** The player ship has a white hull with **cyan** trim and engine glow. Enemies have **dark gunmetal** bodies with **red** neon strips and lights. Neither may use the enemy-bullet color.
- **D-39:** **Enemy bullets become hot orange-yellow with a white core.** This **supersedes Phase 2 D-23** (pink), so magenta is free for city neon. The reservation rule from D-23 stays: no other effect, pickup or scene element may use orange-yellow. Bullets stay drawn above all effects. — **Reversibility:** costly — it touches the bullet shader/palette, the effect palettes and the readability tests from Phase 2
- **D-40:** **Fire, explosions, medals and the bomb pickup must move away from orange-yellow.** Today they are orange (explosions), gold (medals) and amber (bomb pickup). Explosions and fire move to a white-hot core with red, magenta and cyan electrical sparks. Bullets may also get a thin dark rim for extra separation. The exact new palette is at Claude's discretion, but bullet readability (VISL-05) must still be verified in the densest stage moments.

### Claude's Discretion
- How the mid-boss is staged (rail line vs road), and its HP, patterns and timeout.
- The exact medal value ladder, point values per kind, the bonus amounts per tally line, and the extend thresholds within D-17.
- Wave composition and the enemy path vocabulary (curves, splines, formations). Bullet pattern vocabulary beyond aimed/spread/ring (ENMY-04 requires at least those three) and how patterns are parameterized as data.
- Boss attack patterns per phase, part HP and the phase-2 HP threshold.
- Pixel font choice (self-hosted or a Google Font, within the CLAUDE.md asset rules). Exact HUD layout and safe-area handling.
- Lighting values, fog density, sky technique, how far shadows reach per tier, and the rain, reflection, sign-flicker and fire/smoke technique.
- The exact retuned effect palette and medal/bomb-pickup colors within D-39/D-40, and billboard/sign content (procedural shapes or glyphs only, with no real brands).
- How the scroll-distance timeline maps onto the existing `TerrainScroll` / `terrain_ring.js` (and how the city ground layer is streamed). Protocol and buffer changes (bump `PROTOCOL_VERSION`).

### Deferred Ideas (OUT OF SCOPE)
None. The discussion stayed within phase scope. (Continue screen, top-10 initials, title screen, difficulty levels and stages 2-3 are already planned for Phase 4.)

Not in this phase (CONTEXT domain boundary): stages 2-3, naval/heavy multi-hit units (ENMY-03), difficulty levels, title screen, stage select, pause button, continue screen, the top-10 initials table, music, options, PWA (all Phase 4).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENMY-01 | Air enemies (jets, helicopters) fly scripted formations and paths | New `MotionKind.PATH` (waypoint polyline from data) + `WaveEntry` formation builders; Pattern 2 |
| ENMY-02 | Ground enemies (tanks, turrets) move with the terrain and aim at the player | Existing `GROUND` motion and `aux` aim angle, extended with `PATH` for road-following; ground layer single-frame rule (Pattern 5) |
| ENMY-04 | Bullet patterns (aimed, spread, rings) defined as data | `PatternSpec` frozen dataclass + `PATTERNS` registry + one runner shared by enemies and the boss (Pattern 3) |
| ENMY-05 | Waves follow a data-driven stage timeline | `StageData` typed module + `StageDirector` cursor keyed on `TerrainScroll.distance` (Pattern 1) |
| ENMY-06 | Multi-phase boss whose attacks change as it takes damage | `BossSpec`/`PhaseSpec` data + `BossController` state machine (Pattern 4) |
| ENMY-07 | Destructible boss parts for points | Parts are `EnemyPool` rows (all four weapons work with zero weapon changes) that convert to stump rows when destroyed (Pattern 4) |
| ENMY-09 | Boss timeout so a stage always progresses | Step-counted timeout inside `BossController` (freezes with hitstop/pause for free), retreat state, boss bonus 0 |
| STGE-03 | Ground scenery can be destroyed by player fire | Flagged buildings are ground-kind `EnemyPool` rows spawned by the director; wreck/decal rings reused (Pattern 5) |
| SCOR-01 | Points for enemies, parts, scenery | `ScoreKeeper` consuming the existing per-step kill buffer + `ENEMY_POINTS` table |
| SCOR-02 | Medals whose value climbs until one is missed | `PickupKind.MEDAL`, `MedalChain`, miss counter from `PickupPool.step` (Pattern 6) |
| SCOR-03 | Stage-clear bonus tally after the boss | `StageTally` (4 lines) driven by `StageFlow`, shown from header slots + events (Pattern 7) |
| SCOR-04 | Extra lives at score thresholds | `ScoreKeeper.next_extend` loop (200k then every 500k, tunable) |
| SCOR-05 | Starting lives, game over when all lost | `lives` in `Game` (stage mode only), `PlayerPhase.OUT`-style terminal state, JS-driven restart (Pitfall 9) |
| SCOR-08 | HUD shows score, high score, lives, bombs, weapon level | DOM HUD extending `status_readout.js`, laid out from projected playfield corners, bomb-button aware (Pattern 9) |
</phase_requirements>

## Summary

Phase 3 is additive on a very clean seam: one batched `Game.tick()`, struct-of-arrays pools, a uniform-grid broadphase, float32 header + event ring, and instanced JS views keyed by manifest enum names. Everything the phase needs maps onto those seams. The one hard decision from STATE.md ("boss authoring format and destructible-part model") resolves as: **the boss and its parts are rows in the existing `EnemyPool`, driven kinematically by a `BossController` that is configured by a frozen-dataclass `BossSpec`.** That keeps vulcan, missiles, laser, bomb and homing working against the boss with zero changes to any weapon, and it reuses flash, HP fraction, explosions, shadows and instanced drawing. Destroyed parts are converted in place into "stump" rows before `remove_dead` runs, so the stump stays on the hull for the rest of the fight (D-14). The hull is a single collision circle of radius <= 29 because `GRID_CELL` is 32 and the 3x3 query is only exact when radius + bolt radius <= cell [VERIFIED: `src/scorched_core/tuning.py:220` `GRID_CELL: Final = 32.0`; docstring `circle_hits.py` "The largest enemy radius plus `radius` must stay within one grid cell"].

The content pipeline (criterion 5) is three registries of frozen dataclasses: `PATTERNS` (bullet volleys), `PATHS` (waypoint polylines), and a `StageData` module (wave entries keyed on stage distance, ground/destructible placements, city blocks, markers, boss spec). Adding a wave or pattern is then a new tuple entry, never engine code. Existing gallery behaviour must stay byte-identical (it stays behind `?gallery` and its tests stay green), which a parity test against the current `ENEMY_FIRE_*` tuples guarantees, the same trick Phase 2 used for `VULCAN_STREAMS` Lv1 (02-08).

The riskiest item is not algorithmic; it is a rendering-geometry trap. D-04 wants ground units to "line up with city blocks", but today the terrain ring lives in the terrain frame (depth -40) while ground units live in the ray-compensating ground layer with an aspect-dependent offset and a 0.94 speed fudge. They only line up for one aspect ratio. **The fix is to render everything terrain-anchored (ground texture, static scenery, destructible rows, wrecks, decals) in the ground layer with one shared mapping `y = f(stage_distance)`.** Second-tier risks: the Phase 2 e2e suite and the Game tests assume the gallery is the default (switch them behind `gallery`/`stage=None` first), `python_bridge.js` and its test hard-code protocol 2 and header length 48, the palette test is keyed to the old pink, and "tap to restart" cannot be a Python FIRE edge because touch mode holds FIRE permanently (auto-fire).

**Primary recommendation:** Build the Python content engine first (patterns, paths, director, scoring/flow, boss controller) with exhaustive pytest and the `make perf --stage` gate, behind a `Game(stage=...)` option that leaves the gallery untouched; bump the protocol to v3 (header 64, new channels/events); then do the JS city/ground-layer rework and the neon re-light as an early spike gated by a projection test, and finish with HUD/banners/palette retint and the `?at=` playtest loop.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Stage timeline, wave spawning, paths, bullet patterns | Python core | — | Outcome-affecting, deterministic, pytest-covered (CLAUDE.md) |
| Boss/mid-boss state machine, parts, timeout, retreat | Python core | JS (draw only) | Outcome-affecting; JS reads rows + header |
| Scoring, medals, extends, lives, game over, tally | Python core | JS (display) | Outcome-affecting; JS mirrors header/events |
| Stage flow (intro, play, warning, boss, clear, tally, restart, game over) | Python core | JS DOM overlays | State machine in Python; banners are presentation |
| High-score persistence | Python adapter (`scorched_web`, `js.localStorage`) | — | D-22 says through the adapter; core stays pure (no `js` import allowed) |
| Restart after game over (fire/tap) | JS DOM event | Python `restart()` | Touch auto-fire holds FIRE, so a Python edge is unusable |
| Static city layout data | Python data module | JS (draws it) | D-03/D-34: authored in Python; shipped once via manifest |
| City, buildings, rain, fog, neon lighting, sky | JS renderer | — | Presentation; scales with tier (D-36) |
| Destructible buildings (HP, kill, medal drop) | Python core (ground-kind rows) | JS (model per kind) | Collision/score are gameplay |
| Boss warning shadow sweep, part stumps, fires | JS renderer | Python (events/header) | Visual only |
| HUD, banners, score popups, boss HP bar, tally panel | JS DOM | Python (header/events) | D-24: DOM overlay, `textContent` only |
| SFX selection | Python (`sfx_router`) | JS (zzfx table) | Phase 2 D-29 pattern |
| Palette / bullet shader retint | JS | — | Presentation; guarded by `palette.test.js` |
| URL flags `gallery`, `at` | JS parse (allow-list) | Python re-validate | Phase 2 pattern: JS and Python both validate untrusted URL input |

## Standard Stack

### Core
No new runtime stack. Everything is the locked Phase 1-2 stack.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Pyodide | 314.0.7 | Python 3.14 sim | Locked [VERIFIED: `package.json` `"pyodide": "314.0.7"`] |
| three | 0.186.1 | WebGL2 render, `InstancedMesh`, `FogExp2`, bloom | Locked [VERIFIED: `package.json`; `node_modules/three/package.json` version 0.186.1; `FogExp2` present in `build/three.core.js`] |
| Vite | 8.3.4 | Build | Locked [VERIFIED: `package.json`] |
| pytest / pytest-cov / ruff | 9.1.1 / 7.1.0 / 0.17.1 | 100% line+branch gate | Locked [VERIFIED: `pyproject.toml` dev group] |
| vitest | 5.0.5 | JS unit tests | Locked [VERIFIED: `package.json`] |
| zzfx (vendored) | 1.4.0 | New SFX (warning alarm, extend chime, medal, tally, part/boss destroy, stage clear, game over) | Phase 2 pattern; add table entries only |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Press Start 2P (latin subset woff2, 12.5 KB, OFL-1.1) | fontsource 5.3.0 files | HUD/banner pixel font (D-24) | Vendor the single file (zero-dependency, same precedent as zzfx in 02-31) [VERIFIED: tarball opened this session: `files/press-start-2p-latin-400-normal.woff2` is 12512 bytes; `npm view` license OFL-1.1] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vendored woff2 | `npm i @fontsource/press-start-2p@5.3.0` and `import '@fontsource/press-start-2p/latin-400.css'` | Same bytes, but adds a dependency and a lockfile change; the exact package name is not on fontsource.org's install pages (see Audit), so it needs a `checkpoint:human-verify` |
| Press Start 2P | Silkscreen / VT323 | Press Start 2P is very wide (8 px grid); at small HUD sizes on a 240-unit-wide playfield VT323 is more compact. Keep Press Start 2P for banners and a monospace fallback for dense numbers if width is a problem; judge on a phone |
| Google Fonts CDN | self-host | CDN adds a third-party request, breaks offline/PWA (Phase 4) and the "static, no external dependency" posture; do not use |

**Installation:** none required for the recommended path (vendor `web/src/assets/fonts/press-start-2p-latin-400-normal.woff2` plus the OFL license text, referenced from `index.html` `@font-face`; Vite emits it to `dist/assets` and `--base=./` keeps it relative).

**Version verification:** `npm view @fontsource/press-start-2p version license` returned `5.3.0` / `OFL-1.1`; `scripts.postinstall` empty [VERIFIED: npm registry, run this session].

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| @fontsource/press-start-2p | npm | published 2026-07-19 (version 5.3.0; the Fontsource family is long-lived) | ~51,800/wk | github.com/fontsource/font-files | OK | Optional alternative only. Name was discovered from training memory and the documented Fontsource naming pattern; fontsource.org's per-font pages did not show the exact package name, so it is tagged `[ASSUMED]` per the provenance rule. If chosen, the planner must add a `checkpoint:human-verify` before `npm install`. Primary recommendation avoids installing it (vendor the woff2) |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none (seam returned OK for @fontsource/press-start-2p, @fontsource/silkscreen, @fontsource/vt323 [VERIFIED: `gsd-tools query package-legitimacy check --ecosystem npm`])

## Architecture Patterns

### System Architecture Diagram

```
 URL ?gallery ?at=midboss|boss ?god ?weapon ?level ?bombs
        │ (JS allow-list, Python re-validates)
        v
 create_game(options) ──> Game(stage=StageData | None)        None = gallery (unchanged)
                               │
 fixed 60 Hz _step()  ─────────┤ hitstop gate (freezes ALL below, incl. boss timeout)
   terrain.step(speed)         │   speed = STAGE_SPEED, or BOSS_CRAWL_SPEED during boss
   StageFlow.step ─────────────┤   INTRO > PLAY > (MIDBOSS) > WARNING > BOSS > CLEAR > TALLY > RESTART
   StageDirector.step ─────────┤   cursor over WaveEntry/GroundEntry sorted by `at` (stage distance)
        │ spawn rows with (kind, x, y, motion, path id, pattern id, drop, hp override)
        v
   EnemyPool.step  (SWAY/DIVE/HOVER/GROUND/PATH/SCRIPTED)      BossController.step (moves boss rows,
   EnemyPool.fire  (per-row PatternSpec via shared runner) <── fires emitter patterns, phases, timeout)
        │
   weapons (vulcan, homing, laser, bomb) ── unchanged; hit rows through grid / linear scans
        │
   BossController.settle  (dead part -> stump row; hull dead -> death sequence)   BEFORE remove_dead
   EnemyPool.remove_dead -> kill buffer (x, y, kind, drop)
        │
   ScoreKeeper.award(kill buffer) ─ MedalChain (pickups) ─ extends ─ lives ─ high score (adapter)
   PickupPool (crystal / bomb / MEDAL) ── medal missed counter ──> chain reset
   PlayerLife (+ terminal OUT) ──> GAME_OVER
        │
   _pack_header (slots 30-63) + channels (enemies, pickups, ebullets) + events
        v
 RenderSink.flush ──> JS Float32Arrays ──> main.js frame:
   ground layer (ONE frame): ground texture + static city + destructible rows + wrecks + decals
   air: ship, jets, boss hull/parts, bullets (post-bloom pass), fx, rain, fog, night rig
   DOM: HUD, banners, popups, boss HP bar, tally, game over (textContent only)
```

### Recommended Project Structure
```
src/scorched_core/
├── stages/
│   ├── stage_data.py          # class StageData (frozen): waves, ground, city, markers, boss
│   ├── wave_entry.py          # class WaveEntry (frozen): at, kind, x, y, motion, vx, vy, path, pattern, drop
│   ├── ground_entry.py        # class GroundEntry (frozen): destructible/ground placement
│   ├── city_block.py          # class CityBlock (frozen): block origin, lot grid, style, seed
│   ├── stage_director.py      # class StageDirector: cursor + spawn + marker jump
│   ├── stage_flow.py          # class StageFlow: INTRO/PLAY/.../GAME_OVER state machine
│   ├── formations.py          # builder functions (v_formation, line, mirror): data authoring helpers
│   ├── city_builder.py        # expands CityBlock -> flat placements (seeded random.Random)
│   ├── stage_1.py             # the data module (no class): STAGE_1 = StageData(...)
│   └── gallery_spawner.py     # unchanged
├── paths/
│   ├── path_spec.py           # class PathSpec (frozen): points, speed
│   └── path_library.py        # PATHS registry + arc/loop point generators
├── patterns/
│   ├── pattern_spec.py        # class PatternSpec (frozen)
│   ├── pattern_library.py     # PATTERNS registry (gallery parity + stage + boss patterns)
│   ├── bullet_patterns.py     # fire_aimed, fire_ring (exist) + fire_spread, run_pattern
│   └── fire_pattern.py        # FirePattern: add SPREAD=3, STREAM=4 (values never change)
├── bosses/
│   ├── boss_spec.py           # class BossSpec (frozen)
│   ├── part_spec.py           # class PartSpec (frozen)
│   ├── phase_spec.py          # class PhaseSpec (frozen)
│   ├── boss_state.py          # IntEnum: ENTER, FIGHT, DYING, RETREAT, GONE
│   ├── boss_controller.py     # class BossController
│   └── stage_1_bosses.py      # data: MIDBOSS_1, BOMBER_1 (no class)
├── scoring/
│   ├── score_keeper.py        # score, high score, extends
│   ├── medal_chain.py
│   └── stage_tally.py
└── game/ (game.py gains stage wiring; keep new logic in the classes above)
src/scorched_web/bridge/high_score_store.py   # js.localStorage adapter (lazy import)
web/src/ui/{hud,banner_overlay,score_popups,boss_bar,tally_panel,game_over_overlay}.js
web/src/render/{city_layer,city_models,rain_layer,night_rig}.js   # terrain_ring.js is reworked
```
Tests mirror this tree (`tests/test_conventions.py` enforces one class per file, snake_case file name, a mirrored `test_<stem>.py` for every non-`__init__` module except `protocol.py`/`tuning.py`, and no orphan tests) [VERIFIED: `tests/test_conventions.py` read this session]. Data modules such as `stage_1.py` have no class but still need `tests/scorched_core/stages/test_stage_1.py` (put the validation tests there). New directories need an empty `__init__.py`.

### Pattern 1: Stage timeline keyed on scroll distance (ENMY-05, D-04)
**What:** `StageData` is a frozen dataclass holding `waves: tuple[WaveEntry, ...]` sorted by `at`, `ground: tuple[GroundEntry, ...]`, `city: tuple[CityBlock, ...]`, `markers: dict[str, float]`, `length`, and the `boss` specs. `StageDirector` holds one integer cursor into the merged sorted spawn list and, each step, spawns every entry with `at <= stage_distance`. `at` is the stage-local scroll distance. Use `<=` with a monotonically advancing cursor, not `==` (the existing `GallerySpawner` uses `==` on integer ticks, which is correct for ticks but would skip entries on a float distance that advances by 0.8 or by a variable boss-crawl speed).
**When to use:** all air and ground spawns. The boss itself is tick-based (a state machine in steps), because distance barely advances during the crawl.
**Key rules:**
- Variable scroll: `TerrainScroll.step()` currently adds the constant `SCROLL_SPEED` (`stages/terrain_scroll.py`). Give it a `speed` attribute; `StageFlow` sets it (normal, boss crawl). Publish the current speed in a new header slot, because `main.js` extrapolates with the constant `manifest.tuning.scroll_speed` (`scrollNow = header[SCROLL_Y] + alpha * manifest.tuning.scroll_speed`, and the same constant times the ground ratio for ground units). Without the slot the terrain visibly stutters every frame during the crawl.
- Debug jump (`?at=midboss|boss`): set the distance to `markers[name] - LEAD` and set the cursor to the first entry with `at >= distance`. Units that would already be visible on screen at that instant are simply absent; the lead-in (about one screen height of distance) covers it. Static scenery is a pure function of distance, so the city is correct at any jump.
- Restart (D-27): reset the stage distance to 0, clear every pool, reset the cursor, and push `EV_STAGE_START` so JS clears wreck/decal rings (their positions are `y_at_kill + ratio * (scroll_now - scroll_at_kill)`; a scroll that jumps back to 0 would fling them). Do not reset score, lives, weapon level or bombs (D-27).
**Example:** see Code Examples (WaveEntry, StageDirector).

### Pattern 2: Enemy paths as data (ENMY-01, ENMY-02)
**What:** one new motion, `MotionKind.PATH`, that follows a `PathSpec` (a polyline of offsets from the spawn point plus a constant speed per path), and one more, `MotionKind.SCRIPTED` (no motion at all; the `BossController` writes the position). Existing `SWAY/DIVE/HOVER/GROUND` stay for parity and for simple waves. Arcs, loops and S-curves are authored by pure helper functions that emit polyline points (`arc_points(radius, sweep_deg, steps)`), so there is exactly one runtime path mechanism and no spline engine. Mirroring is a boolean on the wave entry (flip x offsets), which halves authoring.
**Runtime:** new pool columns `path` (int registry index), `seg` (int), `seg_t` (float distance travelled in the segment) and `base_y`. Per step: advance `seg_t` by `speed`; while `seg_t >= seg_len` carry over to the next segment; position = base + lerp. Past the last point, continue along the last direction until the exit margin removes the enemy. A ground kind on a PATH adds `_GROUND_SCROLL` to `base_y` every step so a road-following tank stays terrain-anchored. Heading = segment direction (existing `angle` column; `atan2(dx, dy)` convention used by `DIVE`).
**Don't** introduce Catmull-Rom/Bezier evaluation per enemy per step; precompute polyline points (and segment lengths) at import.

### Pattern 3: Bullet patterns as data with one runner (ENMY-04)
**What:** `PatternSpec` (frozen) with `shape: FirePattern`, `count`, `speed`, `interval`, `delay`, `arc_deg` (spread fan), `aim_offset_deg`, `phase_step` (ring rotation per volley; `half` reproduces the current alternate-ring behaviour), `burst`/`burst_gap` (STREAM). `FirePattern` gains `SPREAD = 3` and `STREAM = 4` (values never change; they ride `ENEMY_FIRE` events as `a` and index the SFX router). A single `run_pattern(spec, pool, x, y, target_x, target_y, volley_index)` in `patterns/bullet_patterns.py` is called by both `EnemyPool.fire` and `BossController`, with a `match` on `spec.shape` and the loud unknown arm the codebase already uses.
**Registry:** `PATTERNS: dict[str, PatternSpec]` plus a name -> index resolution done once when stage data is built; rows store an int index (no string compares per step). Kind defaults in the gallery map to registry entries, with a parity test against the current `ENEMY_FIRE_PATTERN / INTERVAL / BULLET_SPEED / RING_COUNT` tuples (jet aimed speed 2.0 interval 140, heli ring 8 speed 1.3 interval 150, tank aimed 1.6 / 120, turret aimed 1.8 / 90 [VERIFIED: `tuning.py` lines 129-140 read this session]).
**Per-row state:** replace `age // interval` ring alternation with a `volley` counter column (the existing `age // ENEMY_FIRE_INTERVAL` trick breaks when a pattern or interval differs per row).
**Capacity:** `EBULLET_GAME_CAP` is 200 [VERIFIED: `protocol.py:58`]. A phase-3 boss ring of 16 every ~0.7 s at 1.6 u/step crosses 320 units in 200 steps, about 70 live bullets per ring stream before spreads and wave fire. Raise the cap to about 400 (D-07 still holds because density comes from the data, not the cap). Measured headroom: 500 harmless storm bullets cost about +0.47 ms on top of the 0.21 ms gallery baseline [VERIFIED: `node tools/perf_node.mjs` runs this session, see Environment Availability], so 400 gameplay bullets (plus the lethal-contact scan) fit.
**Phase 4 seam (cheap, optional):** pass bullet speed/count through the runner so Easy/Hard can scale without touching data.

### Pattern 4: Composite boss as `EnemyPool` rows + `BossController` (ENMY-06, ENMY-07, ENMY-09)
**Decision (resolves the STATE.md blocker):** hull and parts are `EnemyPool` rows; the controller moves them and owns behaviour.
- **Why rows:** every weapon already iterates the pool (`resolve_shots_vs_enemies` via the grid, `resolve_beam_vs_enemies`, `resolve_bomb_vs_enemies`, `MissilePool._nearest/steer`). Rows get hit flash, HP-fraction packing, explosions, air shadows and instanced drawing for free. A separate boss collider would need a boss pass added to bolts, missiles, laser, bomb and homing target selection.
- **Hull size rule:** one hull row with radius <= 29 (cell 32 minus the 2.5 missile radius, rounded down). The model art can be far larger than the collision circle; wing mass is covered by part rows (turrets/engines, radius 10-14). Do not decompose the hull into several linked circles: the beam and bomb would hit each circle (multiplied damage) and bolts would hit one (normal), with no clean fix.
- **Pool changes needed** (all columns, so update `spawn`, `_remove_at`, `pack_into`): `hp_max` (pack `hp / hp_max` instead of `hp / ENEMY_HP[kind]`), `shield` (non-zero means `apply_hit` ignores the hit: entrance, phase change, death sequence), per-spawn `hp` and `radius` overrides, `path/seg/seg_t/base_y/pattern/volley`. Raise `ENEMY_CAP` from 48 and `ENEMY_MAX_ALIVE` from 40 [VERIFIED: `protocol.py:60`, `tuning.py:115`] to about 64 and 56: a boss is 1 hull + up to 6 part/stump rows, and city targets share the pool. `GRID_CELL` stays 32; the grid capacity follows `ENEMY_CAP` automatically (`UniformGrid(PLAYFIELD_W, PLAYFIELD_H, GRID_CELL, ENEMY_CAP)` in `game.py`).
- **Make `_remove_at` column-driven.** It currently hand-copies 18 columns; every new column is a silent swap-remove corruption bug if forgotten. Iterate a module-level tuple of column names, and add a test that every `array` field of `EnemyPool` appears in that tuple.
- **Controller loop (two calls per step):** `step()` runs after `director.step` and before `enemies.step` (move rows: entrance descent, sinusoidal drift, aim, phase timers; fire emitter patterns for living parts and for the hull's own mounts; count the timeout in steps). `settle()` runs after all damage passes and before `remove_dead`: for each part uid whose row `hp <= 0`, convert the row in place into a stump (kind = stump kind, hp large, `shield` on, radius 0 so no collider), push `EV_EXPLOSION` and a new `EV_PART_DESTROYED`, trigger hitstop, award points; if the hull row `hp <= 0`, start the death sequence (rows shielded, chained explosions, then clear). Track rows by `uid` and use `index_of_uid`, never by slot (swap-remove moves slots).
- **Phase transitions (D-10, D-11):** phase 2 when `hull_hp / hull_hp_max <= phase2_frac` OR all parts are destroyed; phase 3 at `phase3_frac`. Each `PhaseSpec` lists emitters (mount offset or a part reference, `PatternSpec` name, enabled-while-part-alive flag) and a movement amplitude/period. A destroyed part's emitter stops (its stump no longer fires). Transition = brief `shield`, bullets of the old phase cleared, SFX/flash event.
- **Timeout (D-12):** step counter since the fight began (not since the warning). At the limit, state becomes RETREAT: shield on, no firing, rows glide off screen, flow proceeds to CLEAR with `boss_destroyed = False` (tally line 0). A step counter inherits hitstop and pause freezing for free (`_step` returns early). Publish seconds left in a header slot only when `<= 20 s` is meaningful (JS shows it; Python can publish -1 otherwise).
- **Mid-boss (D-02, discretion):** the same controller with a smaller `BossSpec`: a ground-kind hull (draws in the ground layer, not lethal on contact) plus 2 ground part rows. Stage it as an armored train on an elevated maglev line: rows are `SCRIPTED`, entering from the top, then holding at a fixed logical y while the terrain scrolls beneath (the train "runs up the screen against the scroll"); because the controller writes the position, no special `GROUND` velocity trick is needed. Timeout about 45 s then retreat (tunable). Entering and leaving keep the same controller states as the boss.
- **Rendering:** hull, each part kind and the stump kinds are ordinary enemy kinds drawn by `enemy_instances.js` (add builders in `enemy_models.js`; kinds without a builder fall back to tinted primitives). The `top` mesh already follows `aux` aim, which suits turret parts. The boss shadow sweep before the entrance (D-13) is a dedicated JS effect driven by the flow timer, not by rows (the hull is not on screen yet).
- **Sizing proposal [ASSUMED, tune with `?at=boss`]:** vulcan Lv1 is 24 bolts/s x 1 damage; the laser at Lv5 is 100 damage/s per pierced target; homing Lv5 is up to 100/s; one bomb deals about 60 to each overlapping row [VERIFIED: `tuning.py` `VULCAN_INTERVAL`, `LASER_DAMAGE`, `LASER_HIT_INTERVAL`, `HOMING_*`, `BOMB_DAMAGE`/`BOMB_DAMAGE_INTERVAL`/`BOMB_BLAST_TICKS` read this session]. For a 60-75 s fight at typical Lv4-5 power (about 40-50 effective dps), total boss HP of roughly 2,000-2,500 (hull about 1,400, four parts about 200 each) is the starting point.

### Pattern 5: One coordinate frame for everything on the terrain (STGE-03, D-04, D-34)
**Problem (verified geometry):** the terrain ring sits at depth -40 in the terrain frame; ground units sit in the ground layer, whose transform is the central projection `P' = C + k(P - C)` with `k` between 1.04 and 1.08 across aspects [CITED: `.planning/phases/02-arcade-shooting-feel/02-RESEARCH.md` Pattern 14: "phone 9:19.5 -> 1.0411; 4:3 portrait -> 1.0646; square, 16:9, ultrawide -> 1.0794"]. A point on the terrain at world Z maps to logical y = `H/2 + (Z - C_z(1-k))/k`, and `C_z` (camera z) is aspect-dependent, so a tank and a static building at the same distance only coincide on screen for one aspect, plus a slow 2-3% drift from the 0.94 ratio. Phase 2 never noticed because ground units had no static neighbours.
**Fix (recommended):** make the ground layer the single frame. The ground texture, the static scenery instances, destructible-building rows, wrecks and decals all live in the ground group and are positioned in logical plane coordinates by one function `y = Y0 + GROUND_SCROLL_RATIO * (scroll - d)` (the same `0.94` Python uses for `GROUND` motion). Because the layer projects along camera rays, the screen image equals the image of a flat plane at y = 0, so nothing is lost visually; air shadows and the 40-unit altitude cue are unaffected because the layer remains below the plane. Texture and building geometry are authored in plane units; the 6% non-uniformity along the road axis from the 0.94 ratio is invisible.
**Work this implies:** `terrain_ring.js` is reworked into a `city_layer` that streams chunks from Python-supplied placement data (static scenery only; destructibles are rows) into per-kind `InstancedMesh`es inside `rig.groundLayer.group`, ground texture included; `chunkLayout` keeps its base-relative trick to avoid float growth (Pitfall 10 of Phase 1).
**Gate it early:** add a vitest NDC test (as 02-12 did for tanks) asserting a static placement and a ground row with the same `(d, x)` project to the same pixel at four aspects, plus an e2e at two viewports. If this spike fails, the fallback is to keep the terrain ring as-is and keep destructibles away from dense static blocks (authoring rule: >= 24 units clearance) and accept the misregistration.
**Shipping the layout:** Python expands `CityBlock` entries deterministically (seeded `random.Random(stage_seed)`) into flat placements and sends the static ones once in `manifest["stage"]` as a flat list of numbers (JS converts to a `Float32Array` at load). Do NOT add it as a sink channel: `RenderSink.flush` assigns every attached channel on every bulk flush [VERIFIED: `render_sink.py` read this session], which would re-copy a large static buffer 60 times a second. The expansion lives in exactly one place (Python), because destructible entries must exist in Python anyway; JS never random-generates the city.

### Pattern 6: Medals, scoring, lives (SCOR-01, SCOR-02, SCOR-04, SCOR-05)
- **Scoring:** one pass after `remove_dead` over the existing kill buffer (`kill_x/kill_y/kill_kind/kill_drop`, `kill_n`) like `_drop_pickups` already does; points come from an `ENEMY_POINTS` tuple indexed by kind (add the tuple next to the other per-kind tables; add a test that every per-kind tuple has `len(EnemyKind)` entries). Parts and buildings are kinds, so they need no special case. The boss kill itself pays through the tally (D-18), not at the moment of death.
- **Medals:** `PickupKind.MEDAL = 5` (append; values never change). A medal does not bounce and does not time out like a crystal; it falls with the scroll (logical `vy` about the scroll speed). `PickupPool.step` must report removals of medals that left the bottom (new `medals_missed` counter, drained by `Game` each step like `enemies.kills`/`kill_n`), which resets `MedalChain`. `resolve_pickups_vs_ship`'s `collect(kind, color, x, y)` callback already receives the kind, so `_collect_pickup` gets a medal branch (value from the ladder, then chain += 1, push `EV_MEDAL`). Dying resets the chain (D-16). Pack the chain/tier in the pickup colour slot so JS can tint the chip; `PICKUP_CAP` is 16 [VERIFIED: `protocol.py:62`]: raise to about 40 (a downtown block of destructibles can drop many medals).
- **Ladder (proposal, tunable data):** (100, 200, 500, 1000, 2000, 5000, 10000), capped at the last entry [ASSUMED].
- **Extends:** `ScoreKeeper` loops `while score >= next_extend: lives += 1; next_extend += step` with first threshold 200,000 then +500,000 (D-17), and a cap on lives (proposal 9) so the HUD cannot overflow [ASSUMED]. Push `EV_EXTEND` once per extend.
- **Float32 limit:** header slots are float32, exact only to 16,777,216. Clamp the displayed/stored score to 9,999,999 (7 digits, arcade convention) and document it; a clamp avoids silent rounding if a Phase 4 three-stage run grows [ASSUMED: cap value].
- **Lives:** `lives` counts ships remaining including the current one; HUD shows that number (decision for the planner; Raiden shows reserves, but a count including the current ship is the simplest consistent reading of "3 starting lives"). Active in stage mode only: the gallery has infinite lives (the existing `death.spec.js` "an idle ship in the gallery is eventually hit (D-18, infinite lives)" must keep passing).
- **Game over:** on the death step `lives -= 1`; if it hits 0 the dying animation still plays, and when the DYING timer expires `PlayerLife` goes to a new terminal `PlayerPhase` value (append `OUT = 4`; values never change [VERIFIED: `player_phase.py` ALIVE 0, GRACE 1, DYING 2, RESPAWN 3]) instead of RESPAWN, and the flow moves to GAME_OVER. JS compares `phases.DYING` for the ship model, so appending is safe.
- **Lv5 MAX bonus (D-19):** `Game.max_bonus` already counts MAXED catches [VERIFIED: `game.py` `_collect_pickup`: `self.max_bonus += 1  # D-06: recorded now, the points are awarded in Phase 3`]. Award a flat amount (proposal 10,000) in the same branch.

### Pattern 7: Stage flow, tally, restart (SCOR-03, SCOR-05, D-26..D-28)
`StageFlow` is an IntEnum state machine (values appended, exported through the manifest like `phases`): INTRO (about 120 steps; reuse `ship.respawn_start()`/`fly_in()` for the fly-up, D-26) -> PLAY -> MIDBOSS_ENTER/MIDBOSS (optional per stage data) -> WARNING (flashing banner + alarm, shadow sweep) -> BOSS -> CLEAR_DELAY (bullets cleared, ship invulnerable, chained explosions play out) -> TALLY (one line every ~60 steps, `EV_TALLY_LINE`, SFX each) -> STAGE_CLEAR (brief banner) -> restart to INTRO with score/lives/power/bombs kept; any state -> GAME_OVER when the last ship dies. Tally lines (D-18): boss destroyed (0 on retreat), medals collected x per-medal bonus, no-miss (no deaths this stage), unused bombs x per-bomb bonus; amounts are tunable constants. Header holds `TALLY_0..3` and `TALLY_N` (how many lines revealed) so the panel is reconstructable from state, and JS tweens the count-up on the frame clock.
**Restart:** game over restarts a fresh run (lives 3, score 0, weapon level 1, bombs 3). Expose `restart()` on `WebGame` and have JS call it from a DOM handler on the overlay (`pointerup` and `keydown` after a short delay, with `data-no-steer` so `touch_input` ignores the pointer). `python_bridge.js` holds `tick` once; also hold `restart` once rather than calling through `game.restart` in the frame path (no `runPython`/proxy churn per call).

### Pattern 8: High score through the adapter (D-22)
`scorched_core` may not import `js` (enforced: `FORBIDDEN_CORE_IMPORTS = {"js", "pyodide", "time", "datetime"}` [VERIFIED: `tests/test_conventions.py`]). Put the store in `scorched_web/bridge/high_score_store.py` with an injected storage getter. `create_game` resolves the real one lazily (`import js` inside a function in a `try`; natively and in Node the import or the `localStorage` attribute fails and the store becomes a no-op). The Pyodide docs confirm `js` exposes `globalThis` and that JS errors surface as `JsException` [CITED: pyodide.org/en/stable/usage/type-conversions.html]; accessing `window.localStorage` itself can throw (storage disabled), so wrap both access and `getItem/setItem`. Parse the stored string defensively (digits only, clamp to the score cap, junk means 0). Persist at game over, stage clear, and in `WebGame.set_paused(True)` (auto-pause on tab hide is a natural flush point); never per frame. **Do not persist while any test flag is active** (`god`, `weapon`, `level`, `bombs`, `at`): this is the open Phase 2 verification item IN-05 [VERIFIED: `.planning/phases/02-arcade-shooting-feel/02-VERIFICATION.md:211`]. The best score at run start is kept so NEW RECORD compares against it. Tests install a fake `js` module in `sys.modules`; the `import js` failure branch is covered natively.

### Pattern 9: HUD and overlays (SCOR-08, D-23..D-28)
- DOM only, `textContent` only, write only on change (the `shownWeapon/shownLevel/shownPips` guard pattern in `status_readout.js`). Extend `createStatusReadout` or split into `hud.js` while keeping `#status-readout`, `.weapon`, `.level`, `.bombs`, `#max-flash` stable: the e2e specs `weapons.spec.js` and `bomb.spec.js` select them [VERIFIED: grep this session] and `web/test/ui/` tests construct them.
- Layout: compute the HUD box from the projected playfield corners (`projectCorners` from `camera_fit.js`, the same input `layoutBombButton` uses) intersected with the safe-area-inset viewport, re-laid out through the same coalesced-rAF resize path as the bomb button. On a phone there is no letterbox so the HUD sits over the playfield edge; the weapon/level block (bottom-right per D-23) must move above `bombLayout`'s rect when the touch bomb button overlaps it (in keyboard mode the button is hidden and the block returns to the corner).
- Pieces: score/high score (top), lives and bombs (bottom-left), weapon/level, boss HP bar with tick marks at the phase thresholds (fraction from header, thresholds from the manifest), timeout readout only when `BOSS_TIMER_S <= 20`, banners (STAGE 1, WARNING flashing, 1UP/EXTEND, STAGE CLEAR), tally panel, game-over overlay, and a pooled set of about 8 world score popups (DOM spans positioned once with `projectPoint`, CSS-animated, text written at spawn from events). All hidden attributes toggled, never `innerHTML`.
- Font: vendor the woff2 and `await document.fonts.load('12px "Press Start 2P"')` during the loading phase so the HUD never swaps mid-play; keep a `ui-monospace` fallback stack.
- Colour: the HUD must not use orange-yellow (CSS counterparts of the new palette). Today `index.html` uses `#ff8a3d`/`#ffb347` for loading, gate, pause and MAX text and amber for bomb pips/button [VERIFIED: `index.html` lines 52-212, grep this session]; retint the bomb pips and touch button to the new bomb-pickup colour; the loading/pause chrome is not gameplay but should follow the neon identity (discretion).

### Pattern 10: Neon night rig, atmosphere, palette (D-31..D-40)
- **Lighting:** replace the single `HemisphereLight(0xbfd4ff, 0x3a2a1a, 1.2)` + warm sun + `0x0b0a09` background [VERIFIED: `renderer_rig.js` lines 20-25] with a cool blue-violet hemisphere, one cool "moon" directional light (the sun position also drives air-shadow displacement, so keep it a stable direction), `FogExp2` in a dark blue-violet matching the background, and emissive materials for neon. Keep the light count fixed: Phase 2 learned a PointLight count change recompiles shaders mid-game (02-19) and every extra light costs fill rate on phones. Do not add a light per sign; fake neon pooling with additive soft quads (the `decal_ring` approach) on the ground under signs, scaled by tier.
- **Bloom:** the pipeline uses `strength 0.45, radius 0.25, threshold 1.0` [VERIFIED: `post_pipeline.js`], so only values above 1.0 bloom: neon works by giving trim materials `emissive` with intensity > 1 and the terrain albedo staying low. A neon-dense frame raises bloom coverage a lot; retune strength per tier and re-measure on the iPhone (the 02-33 baseline is 60 fps, p95 under 18 ms, tick about 2.0 ms avg on iPhone 16 Pro, Android unmeasured [CITED: `.planning/phases/02-arcade-shooting-feel/02-33-SUMMARY.md`]).
- **Rain:** one instanced streak mesh whose vertex shader derives position from `uTime` and a per-instance seed with `fract()` wrap, so there is zero per-frame JS or Python work; count per tier (high about 600, mid about 300, low off) [ASSUMED]. Draw it before the bullet pass.
- **Wet streets (cheap fake):** low roughness on road materials plus additive vertical glow strips under signs/lit windows (a mirrored copy of the sign's glow geometry, dimmer, stretched), tier-gated off on low.
- **Fire/smoke plumes, sparks:** reuse `particle_system.js` layers. Fire colour constants live in `explosion_fx.js` recipes and in `wreck_ring.js` (`FLAME_COLOR = [3.4, 1.6, 0.4]`), not only in `palette.js`; retint both.
- **Sky:** at a 25 degree tilt and 30 degree FOV [VERIFIED: `camera_fit.js:5-6`] the playfield view is a steep look-down; treat the background as the fog colour and do not build a sky dome [ASSUMED: no horizon visible at the fitted aspects; verify once on screen].
- **Palette (D-39/D-40):** the reservation rule is enforced by `palette.test.js` through `hueDistance(... ) >= PINK_EXCLUSION_DEGREES (35)` with `PINK_MIN_SATURATION 0.25` [VERIFIED: `palette.js` bottom lines]. Re-key it to the new bullet hue (orange-yellow, about 38-48 degrees: halo roughly (0.98, 0.62, 0.05) LDR, white core, dark rim, still <= 0.98 per channel because bullets are drawn after bloom). That exclusion band covers hues about 3-83 degrees, which today contains FIRE, FIRE_CORE, EMBER, SPARK, ENGINE, BEACON_AMBER, LIGHT_EXPLOSION, BOMB_FIRE, VULCAN_TRACER, CRYSTAL_RED and BOMB_PICKUP (all computed from the values in `palette.js`). They all move out. Proposed hue homes [ASSUMED, the numeric test is the arbiter]: explosions/fire = white-hot core with red (about 350), magenta (about 310) and cyan (about 185) sparks; red crystal/vulcan tracer = crimson (about 350, e.g. (3.0, 0.3, 0.6)); bomb pickup, pips and touch button = acid green (about 130, free of cyan/red/yellow); medal = white/cyan holo chip; enemy neon strips = crimson <= 355 degrees; player trim = cyan. Also retint `wreck_ring.js` flames, `bomb_fx.js`, `carrier.js` beacon (amber), `tank.js` EMBER `[2.6, 1.0, 0.2]`, and every model with HDR orange accents (`grep -rn "2\.6, 1\.0\|3\.4, 1\.6" web/src`).
- **Verify readability (VISL-05)** with a test that scans every HDR/emissive constant used by models, not only `PALETTE`, and with a screenshot checklist at the densest moments (boss phase 3 over a neon downtown).

### Pattern 11: Protocol v3 and boundary
- Bump `PROTOCOL_VERSION` 2 -> 3 [VERIFIED: `protocol.py:5` `PROTOCOL_VERSION: Final = 2`]. Update `python_bridge.js:33` (`manifest.protocol !== 2`) and `web/test/python/python_bridge.test.js` (`protocol: 2`, `header.length` `toBe(48)`) [VERIFIED lines above].
- Header: slots 30-47 are reserved for Phase 3 (`protocol.py:27-28` comment). The list below needs about 19 slots, so bump `HEADER_LEN` 48 -> 64 and leave 48-63 for Phase 4 (difficulty, stage number, continues). The header is manifest-driven in JS (`manifest.header.len`) so this is cheap. Proposed slots: 30 SCORE, 31 HIGH_SCORE, 32 LIVES, 33 FLOW, 34 FLOW_T (0..1 progress of the current state), 35 STAGE_DIST, 36 SCROLL_RATE, 37 BOSS_ACTIVE (0 none / 1 mid / 2 boss), 38 BOSS_PHASE, 39 BOSS_HP (fraction), 40 BOSS_TIMER_S (-1 none), 41 MEDAL_NEXT, 42 MEDAL_CHAIN, 43-46 TALLY_0..3, 47 TALLY_N, 48 NEW_RECORD [ASSUMED numbering; the planner owns the final table].
- New events (append, values never change): `EV_SCORE_POPUP`, `EV_MEDAL`, `EV_EXTEND`, `EV_PART_DESTROYED`, `EV_BOSS_WARNING`, `EV_BOSS_DEFEATED`, `EV_BOSS_RETREAT`, `EV_STAGE_START`, `EV_STAGE_CLEAR`, `EV_TALLY_LINE`, `EV_GAME_OVER`. Event ring is 128 per tick with a 96 soft cap [VERIFIED: `protocol.py:68,70`]; a boss death chain pushes many EXPLOSIONs, so push high-value ones normally and mark decorative ones `low=True`, and note that one `tick()` can run up to 3 steps, all sharing the ring.
- New blast class `BLAST_HUGE = 3` for the boss kill (recipe in `explosion_fx.js`, sound in `sfx_router._EXPLOSIONS`, which clamps to its length, so extend both together).
- New `SfxId` values appended (WARNING, EXTEND, MEDAL, TALLY_TICK, PART_DESTROY, BOSS_DEFEAT, STAGE_CLEAR, GAME_OVER); `sfx_table.js` must gain one entry per name. zzfx parameters are tuned by ear in the designer; do not fabricate numbers (Phase 2 rule).
- Shake: Phase 2 caps amplitude at 3.0 and duration at 0.5 s [VERIFIED: `shake.js:13-14`]. For "the biggest shake in the game" use a sequence of ceiling-strength shakes during the boss death chain instead of raising the comfort ceilings; add `PART_DESTROYED` (medium, with hitstop about 4 steps) and `BOSS_DEFEATED` handlers to the shake table. Hitstop values are `Hitstop.trigger(max)` so overlapping triggers never stack [VERIFIED: `hitstop.py`].
- `?gallery`/`?at`: add to `url_flags.js` with allow-lists (`at` in {midboss, boss}), re-validate in `entrypoint.py` (`_flag`-style: only a real `True` for `gallery`; only the two names for `at`). `main.js` already spreads the whole parsed flags object into Python options. **Default flips to stage:** `Game(stage=None)` keeps the gallery (so the 2,400-line `test_game.py` stays valid) and `create_game` passes the stage unless `gallery is True`.

### Recommended plan decomposition (for the planner)
1. **Wave 0 safety net:** make `bootGame` (e2e helper) append `gallery` by default; add per-kind tuple length tests; make `EnemyPool._remove_at` column-driven plus its parity test; protocol v3 bump with bridge/test updates; `make perf` gets a `--stage` mode (below).
2. **Python content engine** (parallelizable): patterns + library + parity test; paths; `StageData` types, director, formations, `stage_1.py` with validation tests; scoring/medals/extends; `StageFlow`/tally/lives/game over; `BossController` + specs; `HighScoreStore`.
3. **JS rendering spike (before art):** city layer in the ground group + projection test; neon night rig; palette retint with the re-keyed test.
4. **JS content/UI:** building/boss/mid-boss/stump/medal models, HUD/banners/popups/boss bar/tally/game over, rain/fog tiers, SFX table entries, shake/hitstop handlers, flags.
5. **Integration + tuning:** e2e stage specs (`?at=boss&god&level=5`), full-stage native simulation test, perf gate, readability pass, device check on the iPhone.

### Anti-Patterns to Avoid
- **A JSON/TOML stage parser or per-kind `if` chains for stage behaviour** (D-03): data modules only.
- **A boss collider separate from the pool**: forces edits in five weapon paths.
- **Hull as several linked circles**: multiplies beam/bomb damage.
- **Per-sign point lights, runtime light-count changes:** shader recompiles and fill-rate cost.
- **Python particle or rain simulation, per-entity FFI, allocation in the step** (CLAUDE.md "What NOT to Use").
- **Timeline keyed on ticks or wave-gating** (D-04).
- **Drawing the city in the terrain frame while ground rows draw in the ground layer** (misregistration).
- **Resetting the scroll distance without clearing wreck/decal rings.**

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Stage/pattern file format | TOML/JSON + parser | Frozen dataclasses in typed Python modules (D-03) | Linted, covered, refactorable; no parser to test |
| Boss hit handling per weapon | A second collision path | Boss parts and hull as `EnemyPool` rows | All weapons already handle rows |
| Spatial queries | A new structure | Existing `UniformGrid` (+ linear scan for few targets) | Chosen and tested in Phase 1; naive all-pairs is forbidden |
| Hit flash, explosions, shadows, wrecks, scorch | New effect code | Existing `explosion_fx`, `wreck_ring`, `decal_ring`, `shadow_instances` | Reuse via kinds/events; retint only |
| Particles, rain | CPU/Python simulation | GPU vertex-shader layers (spawn records / `fract()` loop) | CLAUDE.md rule |
| Text in the 3D scene | Canvas/three text | DOM overlay with `textContent` (D-24) | Locked; cheaper and sharper |
| Popup/banner animation | JS tween loops | CSS transitions/animations on a small DOM pool | Compositor-driven, no per-frame JS |
| Random placement in two languages | JS and Python generators | One Python expander shipped via manifest | One determinism source |
| Gameplay RNG | `random.random()` module state | `Game.rng` (`random.Random(seed)`) | Replay determinism (existing rule) |
| Extend/score logic spread over `Game` | Inline counters in `game.py` | `ScoreKeeper`, `MedalChain`, `StageTally` classes | `game.py` is already 591 lines; one class per file |
| Font delivery | Google Fonts CDN | Vendored woff2 (12.5 KB) | No third-party request; offline-friendly |

**Key insight:** every hard problem in this phase is a composition of seams that exist. The failure modes are at the joins: swap-remove column drift, coordinate frames, float32 header limits, protocol constants hard-coded in the bridge, and events lost to a 0-step frame.

## Common Pitfalls

### Pitfall 1: Swap-remove column drift
**What goes wrong:** a new `EnemyPool` column is added to `spawn` and `pack_into` but not to the hand-written `_remove_at`; after the first kill, an unrelated enemy inherits a stale path/pattern/shield.
**Why:** `_remove_at` copies 18 columns by hand.
**Avoid:** column-name tuple + a test asserting every `array` field is covered; a randomized spawn/remove test comparing against a reference model.
**Warning signs:** a jet changes behaviour after another dies; boss rows shielded forever.

### Pitfall 2: Grid exactness vs large hulls
**What goes wrong:** a hull radius above 29 silently misses hits when the bolt and the hull centre are two cells apart.
**Avoid:** assert in the controller/spec validation that every spawned radius `<= GRID_CELL - max(PBULLET_RADIUS, MISSILE_RADIUS)`; test it.

### Pitfall 3: Terrain/ground-layer misregistration
See Pattern 5. Warning sign: buildings sliding across roads on some aspect ratios, or a building whose hit flash is not where bolts land.

### Pitfall 4: Constant scroll speed in JS
`main.js` extrapolates with `manifest.tuning.scroll_speed`. Crawl or restart without a header SCROLL_RATE slot makes the terrain stutter or jump.

### Pitfall 5: Boss rows leaving the pool
`EnemyPool.step` removes rows past the exit margins and calls `remove_dead` on `hp <= 0`. Boss rows need `SCRIPTED` motion (skipped by the exit check) and must be settled before `remove_dead`, or the death/part logic never sees them.

### Pitfall 6: Events are cleared every `tick()`
Several steps share one event ring and `flush(bulk=False)` on a 0-step frame leaves the old events buffer in JS (harmless only because `EVENT_N` is 0). Anything the HUD must never miss (extend, game over, stage clear) should also be visible in header state (lives, FLOW, NEW_RECORD), not events alone.

### Pitfall 7: Float32 precision
Score above 16,777,216 loses integer exactness in the header; clamp (Pattern 6). `STAGE_DIST` near 8,640 is fine (ulp about 0.001).

### Pitfall 8: Protocol constants hard-coded in JS
`python_bridge.js` throws on any protocol other than 2 and a bridge test pins header length 48. Update both in the same plan that changes `protocol.py`.

### Pitfall 9: "Tap to restart" cannot be a Python FIRE edge
Touch mode sets auto-fire (FIRE permanently on), so there is never a press edge. Restart through a JS DOM handler calling `restart()`; add a short input delay (about 0.8 s) so the death button-mash does not skip the screen, and `data-no-steer` on the overlay.

### Pitfall 10: Palette reservation by eye
Hue conflicts are non-obvious (HDR values normalised by `hueOf`). The re-keyed `palette.test.js` must be the arbiter, and it must also cover model-local constants (tank EMBER, wreck flames, carrier beacon), not just `PALETTE`.

### Pitfall 11: High score polluted by test flags
Never write `localStorage` while `god`/`weapon`/`level`/`bombs`/`at` is active (IN-05).

### Pitfall 12: HUD collides with the touch bomb button
Phones have no letterbox; D-23 puts weapon/level bottom-right where `layoutBombButton` puts the button over the playfield corner. Lay the HUD out from `bombLayout`.

### Pitfall 13: Phase 2 specs assume the gallery
`bootGame` navigates to `./?debug&god`, which becomes stage 1 after the default flips. All existing e2e specs (shooting, weapons, bomb, death, stress, tier, audio, glow, ground ...) would break. Add `gallery` in the helper first. Likewise `perf_node.mjs` creates a game with no `gallery` option: keep the gallery default in Python and make the stage opt-in there too, or pass `gallery: true` explicitly in the existing perf runs so `make perf` still measures what it did.

### Pitfall 14: Medal and pickup caps
A downtown block can drop many medals; with `PICKUP_CAP 16` the weapon crystal could be evicted by `spawn_guaranteed` (death recovery) or a medal refused. Raise the cap and give weapon pickups priority (never refuse a crystal/bomb for a medal).

### Pitfall 15: Chain reset on a refused medal spawn
If a medal cannot spawn (pool full) the player cannot be blamed for "missing" it; the spawn refusal must not count as a miss.

## Code Examples

Numeric values below are illustrative proposals `[ASSUMED]` unless quoted from the repo; the structures follow patterns read from the repo.

### Data types (one class per file)
```python
# src/scorched_core/patterns/pattern_spec.py
from dataclasses import dataclass
from scorched_core.patterns.fire_pattern import FirePattern

@dataclass(frozen=True, slots=True)
class PatternSpec:
    """One volley recipe. All angles in degrees; speed in units per step."""
    shape: FirePattern
    count: int = 1
    speed: float = 1.6
    interval: int = 120      # steps between volleys
    delay: int = 45          # first volley delay (gallery: ENEMY_FIRE_DELAY)
    arc_deg: float = 0.0     # SPREAD total fan width
    aim_offset_deg: float = 0.0
    phase_step_deg: float = 0.0  # RING rotation added per volley (gallery: half a ring step)
    burst: int = 1           # STREAM: volleys per burst
    burst_gap: int = 6
```

```python
# src/scorched_core/stages/wave_entry.py
@dataclass(frozen=True, slots=True)
class WaveEntry:
    at: float                 # stage-local scroll distance at which the row spawns
    kind: EnemyKind
    x: float
    y: float = -16.0
    motion: MotionKind = MotionKind.DIVE
    vx: float = 0.0
    vy: float = 2.0
    path: str | None = None   # key in PATHS (resolved to an index once, at stage build)
    pattern: str | None = None  # key in PATTERNS; None means the kind default
    drop: PickupKind | None = None
    mirror: bool = False
```

### Director cursor (distance, not ticks)
```python
# src/scorched_core/stages/stage_director.py (sketch)
def step(self, distance: float, enemies: EnemyPool) -> None:
    spawns = self._spawns            # tuple sorted by `at`, built once from StageData
    while self._cursor < len(spawns) and spawns[self._cursor].at <= distance:
        enemies.spawn_entry(spawns[self._cursor])   # a refused spawn is skipped, never queued
        self._cursor += 1
```

### Column-driven swap-remove (kills Pitfall 1)
```python
_COLUMNS: Final = ("x", "y", "vx", "vy", "base_x", "base_y", "phase", "angle", "radius", "aux",
                   "kind", "motion", "timer", "hp", "hp_max", "shield", "flash", "uid", "drop",
                   "age", "fire_timer", "path", "seg", "seg_t", "pattern", "volley")

def _remove_at(self, i: int) -> None:
    last = self.n - 1
    if i != last:
        for name in _COLUMNS:
            column = getattr(self, name)
            column[i] = column[last]
    self.n = last
# test: {f.name for f in fields(EnemyPool) if f.type is array and not f.name.startswith("kill_")}
#       == set(_COLUMNS)
```

### Boss settle pass (before `remove_dead`)
```python
def settle(self, enemies: EnemyPool, events: EventRing) -> None:
    for part in self._parts:                       # one entry per PartSpec, tracked by uid
        if part.alive:
            i = enemies.index_of_uid(part.uid)
            if i >= 0 and enemies.hp[i] <= 0:
                enemies.become_stump(i, self._spec.stump_kind)   # kind, hp, shield, radius 0
                part.alive = False
                events.push(EV_EXPLOSION, enemies.x[i], enemies.y[i], BLAST_MEDIUM, 0, part.kind)
                events.push(EV_PART_DESTROYED, enemies.x[i], enemies.y[i], part.points, part.index)
                self._hitstop_request = HITSTOP_PART_TICKS
```

### High-score adapter (tolerant, lazy `js`)
```python
# src/scorched_web/bridge/high_score_store.py (sketch)
class HighScoreStore:
    def __init__(self, get_storage: Callable[[], Any]) -> None:
        self._get = get_storage

    def load(self) -> int:
        try:
            raw = self._get().getItem(KEY)
            return min(max(int(str(raw)), 0), SCORE_CAP) if raw is not None else 0
        except Exception:      # JsException, AttributeError, ValueError: storage is optional
            return 0
```

### Ground-layer placement (shared by static scenery and rows)
```js
// One mapping for the whole terrain frame (Pattern 5); ratio = manifest.tuning.ground_scroll_ratio
const y = Y0 + ratio * (scrollNow - d);   // logical plane y of a placement at stage distance d
position.set(x - halfW, 0, y - halfH);    // authored in plane units, inside rig.groundLayer.group
```

### URL flag additions
```js
// web/src/boot/url_flags.js: `gallery` is presence-only like `god`; `at` is allow-listed
const AT_MARKERS = new Set(['midboss', 'boss']);
// ...in parseUrlFlags: gallery: params.has('gallery'), at: pick(params, 'at', AT_MARKERS)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 2 pink enemy bullets with a pink hue reservation test | Orange-yellow bullets, same reservation rule on the new hue (D-39) | This phase | Every fire/pickup/effect constant moves; the test is re-keyed |
| Single hemisphere light on near-black | Night rig with fog, fixed light count, emissive neon (D-37) | This phase | Bloom coverage and fill rate rise; tier-gate rain/reflections |
| Gallery as default | Stage 1 default, gallery behind `?gallery` (D-29) | This phase | e2e helper and perf harness must opt the gallery in |
| Constant `SCROLL_SPEED` | Variable speed published in the header (D-06) | This phase | JS extrapolation must read the live speed |

**Deprecated/outdated within the repo:** the `ENEMY_FIRE_*` per-kind tuples become registry defaults (keep until the parity test passes, then derive them from `PATTERNS`).

## Runtime State Inventory

Not a rename/refactor/migration phase. Two migration-adjacent items to state explicitly:
| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `localStorage` high score is new (no prior key). Nothing else persisted today | none beyond the new key; junk values are clamped on read |
| Live service config | None, static hosting, no backend | none |
| OS-registered state | None | none |
| Secrets/env vars | None | none |
| Build artifacts | `dist/` is stale after changes (rebuilt by `make build`); no installed packages carry old names | `make build` before `make e2e` |

## Common Open Risks to Track in Plans
- Mobile fill rate with a neon-dense, fogged, bloomed, rained scene is **unmeasured**; Phase 2's phone numbers predate this phase. Plan a device check (iPhone available; Android never measured and the user waived it in Phase 2).
- `make perf` currently runs the gallery, god on, with the death/respawn/hitstop path outside the 3 ms measurement (Phase 2 IN-08) [VERIFIED: `02-VERIFICATION.md:223`]. The new `--stage` mode should include a mortal run segment so the death/lives/game-over path is measured too.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Boss total HP about 2,000-2,500 (hull about 1,400, parts about 200 each) gives a 60-75 s fight at Lv4-5 | Pattern 4 | Fight too short/long; only constants change, tune with `?at=boss` |
| A2 | Medal ladder (100, 200, 500, 1000, 2000, 5000, 10000), lives cap 9, MAX bonus 10,000, score cap 9,999,999 | Pattern 6 | Balance only; user confirms taste at the vertical-slice gate |
| A3 | `ENEMY_CAP` about 64 / `ENEMY_MAX_ALIVE` about 56, `PICKUP_CAP` about 40, `EBULLET_GAME_CAP` about 400 are enough | Patterns 3, 4, 6 | Caps refuse spawns (silent); validate with the full-stage native test counting refusals |
| A4 | Python tick for the full stage stays under about 1.5 ms desktop (3 ms budget, phone about 3x) | Pattern 3 | `make perf --stage` is the gate; scale caps down if not |
| A5 | Moving the whole terrain into the ground layer looks the same on screen and keeps shadows/ordering correct | Pattern 5 | Requires the early projection test and a visual check; fallback described |
| A6 | Palette homes (crimson red, acid green bomb, white/cyan medal, white-hot fire) satisfy VISL-05 | Pattern 10 | The re-keyed palette test decides; densest-moment screenshots verify |
| A7 | No sky dome is needed (no horizon at a 25 degree tilt) | Pattern 10 | Minor art rework if a horizon shows at some aspect |
| A8 | `lives` counts ships including the current one and the HUD shows that count | Pattern 6 | HUD semantics; trivial to change |
| A9 | Rain counts per tier (about 600/300/off) and additive glow strips are cheap enough on phones | Pattern 10 | Re-tune tiers after a device run |
| A10 | The proposed header slot numbering and event list | Pattern 11 | Planner owns the final table; no external impact |
| A11 | Press Start 2P is legible at HUD sizes on a 240-unit-wide playfield; VT323/Silkscreen are the fallbacks | Pattern 9 | Font swap only |
| A12 | Pyodide `toJs` of a flat Python list from the manifest is fast enough at load (about 10k numbers) | Pattern 5 | Load time; fall back to a typed array conversion |
| A13 | `@fontsource/press-start-2p` is the correct package name (optional path only) | Package Audit | Gate install behind `checkpoint:human-verify` |

## Open Questions

1. **Mid-boss staging detail (rail vs road).**
   - What we know: D-02 says heavy tank/armored train with 2 turret parts; D-35 puts it on an elevated maglev line in the downtown section.
   - What's unclear: whether it enters from the top or the side, and its timeout.
   - Recommendation: rail from the top, `SCRIPTED` hold, 45 s timeout, same controller as the boss.
2. **Does the user want the ground-layer rework or the cheaper fallback?**
   - What we know: the rework is the only way to honour "ground units line up with city blocks" at every aspect; it replaces `terrain_ring.js` and touches `ground.spec.js`.
   - What's unclear: tolerance for a possibly visible misregistration if the cheaper path is chosen.
   - Recommendation: do the rework, but behind the early projection-test spike so a failure is cheap.
3. **Lives semantics in the HUD (total including current vs reserves).**
   - Recommendation: show the total count; revisit at the slice gate.
4. **Whether Phase 3 should include a mortal-run perf segment.**
   - Recommendation: yes (Phase 2 IN-08).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | Vite 8, vitest, perf harness, Playwright | yes | v24.22.0 (`.node-version` 24.22.0) | — |
| uv + Python 3.14 | pytest/ruff gate | yes | uv 0.13.0, `.python-version` 3.14 | — |
| Playwright Chromium | e2e | yes (`~/.cache/ms-playwright/chromium_headless_shell-1248`) | 1.64.1 | `make browsers` |
| Pyodide in Node | `make perf` | yes (ran this session) | 314.0.7 | — |
| Real iPhone / Android | device check | iPhone yes (Phase 2), Android no | — | Android waived in Phase 2; carry forward |
| External services | none | — | — | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** Android device (accepted gap).

Baselines measured this session (Node v24.22.0, aarch64 WSL2, Pyodide 314.0.7, `make perf` equivalents) [VERIFIED: `node tools/perf_node.mjs ...`]: gallery vulcan Lv5, stress 0: avg 0.2124 ms / p95 0.2596 ms; stress 500 + bomb 300: vulcan 0.6753 / 0.7469, laser 0.5261 / 0.5737, homing 0.6235 / 0.7120 (budget 3 ms). Phase 2 recorded about 2.0 ms avg and 3 ms p95 tick on iPhone 16 Pro, about 3x the Node figure [CITED: `02-33-SUMMARY.md`].

## Security Domain

`security_enforcement` is enabled (ASVS level 1, block on high) [VERIFIED: `.planning/config.json`].

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | no accounts or server |
| V3 Session Management | no | none |
| V4 Access Control | no | none |
| V5 Input Validation | yes | URL flags allow-listed in JS and re-validated in Python (`gallery` only a real `True`, `at` only `midboss`/`boss`); stored high score parsed defensively and clamped; all HUD/popup text via `textContent` (never `innerHTML`) |
| V6 Cryptography | no | none (no secrets; do not invent any) |
| V10/V14 supply chain & config | yes | prefer the vendored font; if `@fontsource/*` is installed pin the exact version and review the lockfile diff |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Crafted URL flag (`?at=<junk>`, huge `level`) | Tampering | Allow-list + clamp on both sides (existing Phase 2 pattern) |
| Poisoned `localStorage` value (non-numeric, huge, negative) | Tampering | Digits-only parse, clamp to `[0, SCORE_CAP]`, junk becomes 0; no `eval`/`JSON` of untrusted structure |
| Storage disabled / quota (`SecurityError`, `JsException`) | Denial of service | Catch around access and `getItem/setItem`; game plays without persistence |
| DOM injection via text sinks | Tampering/XSS | `textContent` only; popup/banner strings come from constants and integers |
| Cheat flags persisting a fake high score | Repudiation/Tampering | Disable writes when `god`/`weapon`/`level`/`bombs`/`at` is set (IN-05) |
| Third-party font/CDN request | Information disclosure / availability | Self-host; no CDN |

## Project Constraints (from CLAUDE.md)

Extracted from `/home/renaud/scorched/.claude/CLAUDE.md` [VERIFIED: file contents provided in the session]:
- **Language and style:** game logic in Python; Python 3.14 idioms, type hints everywhere, dataclasses with `__slots__`, enums, `match` where it helps; `ruff check` and `ruff format --check` must pass.
- **One class per file**, file named after the class in snake_case; domain subdirectories (`entities/`, `weapons/`, `stages/`, `collision/`, `scoring/`, `bridge/` ...); the test tree mirrors the source tree.
- **pytest with 100% line + branch coverage** (`pytest --cov --cov-branch --cov-fail-under=100`); the Pyodide adapter is tested against a fake `js` module; avoid `# pragma: no cover` unless truly unreachable and justified.
- **Tooling:** Astral `uv` only (`uv sync`, `uv run`, committed `uv.lock`; never pip/venv); every developer/CI action is a root `Makefile` target; a plan that adds a command adds a matching target (this phase: `perf` gains the `--stage` run, likely a `perf-stage` target or an extended `perf`).
- **What NOT to use:** no per-entity FFI, no `runPython` in the frame loop, no Python-side particle simulation, no naive O(n*m) collision, no allocation in the frame loop (struct-of-arrays, preallocated pools), no unpinned ranged versions of three/pyodide, no loading numpy by default.
- **Assets:** 3D models are generated in code; no external modeling pipeline (the vendored woff2 is a font, not a model).
- **Performance:** Python budget at most 3 ms per frame on desktop; shmup must stay responsive on mobile; keyboard and touch both required.
- **GSD workflow:** file changes go through a GSD command.

## Sources

### Primary (HIGH confidence)
- Repo files read this session: `.planning/phases/03-stage-1-vertical-slice/03-CONTEXT.md`, `REQUIREMENTS.md`, `STATE.md`, `ROADMAP.md` (Phase 3), `.claude/CLAUDE.md`, `.planning/config.json`, `02-RESEARCH.md` (Pattern 14), `02-33-SUMMARY.md`, `02-VERIFICATION.md`
- `src/scorched_core/{game/game.py, protocol.py, tuning.py, pools/{enemy_pool,bullet_pool,pickup_pool,missile_pool}.py, stages/*, patterns/*, collision/*, weapons/{bomb,laser_beam,homing_launcher}.py, entities/*, audio/*, events/event_ring.py, clock/hitstop.py}`, `src/scorched_web/**`, `tests/test_conventions.py`, `pyproject.toml`, `Makefile`, `package.json`
- `web/src/{main.js, render/{renderer_rig,terrain_ring,ground_layer,enemy_instances,bullet_instances,post_pipeline,pickup_instances}.js, render/models/*, fx/{palette,explosion_fx,particle_system,shake,wreck_ring,fx_dispatcher}.js, ui/status_readout.js, quality/tiers.js, boot/url_flags.js, python/python_bridge.js, audio/sfx_table.js}`, `index.html`, `tools/e2e/helpers.js`, `tools/perf_node.mjs`
- `node_modules/three/build/three.module.js` (instanced draw with count 0 returns early, lines 2295 and 4341) and `three.core.js` (`FogExp2` present)
- npm registry via `npm view`/`npm pack` for `@fontsource/press-start-2p` (version 5.3.0, OFL-1.1, tarball inspected); `gsd-tools query package-legitimacy check` (OK for three fontsource packages)
- https://pyodide.org/en/stable/usage/type-conversions.html (js module exposes globalThis; JS errors wrapped in JsException; `toJs` buffer conversion)
- `node tools/perf_node.mjs` runs on this machine (numbers above)

### Secondary (MEDIUM confidence)
- https://fontsource.org/docs/getting-started/install (package naming pattern `@fontsource/<font>`, `latin` subsets, Vite usage); https://fontsource.org/fonts/press-start-2p (license OFL-1.1)

### Tertiary (LOW confidence)
- Tuning numbers, tier counts, palette hue proposals and boss HP are design proposals (see Assumptions Log); Context7 was not available (authentication required), and none of the conclusions depend on it.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, no new runtime dependencies (font vendoring path verified from the tarball).
- Architecture: HIGH for the Python seams (read every touched file); MEDIUM for the ground-layer single-frame rework (derived from the geometry in 02-RESEARCH and the code, not yet prototyped).
- Pitfalls: HIGH for those grounded in code lines (swap-remove columns, protocol constants, FIRE auto-fire, gallery-dependent specs); MEDIUM for visual/readability risks.

**Research date:** 2026-10-18
**Valid until:** 2026-11-17 (stack pinned; revisit only if three/Pyodide pins change)
