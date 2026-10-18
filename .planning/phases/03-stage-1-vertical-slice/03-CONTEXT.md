# Phase 3: Stage 1 Vertical Slice - Context

**Gathered:** 2026-10-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 delivers one **complete, data-driven stage 1**. It has scripted air waves (jets, helicopters) and ground waves (tanks, AA turrets) over a destructible burning city at dusk, a heavy-tank mid-boss, and a **3-phase giant bomber boss** with destructible parts and a timeout. On top of that come scoring with Raiden II medals, lives with extends and game over, a stage-clear bonus tally, a HUD, and a dusk re-light of the whole scene. It is the content-pipeline gate: adding or changing a wave or bullet pattern must only mean editing stage/pattern data, never engine code.

Not in this phase: stages 2-3, naval/heavy multi-hit units (ENMY-03), difficulty levels, title screen, stage select, pause button, continue screen, the top-10 initials table, music, options, PWA (all Phase 4).

</domain>

<decisions>
## Implementation Decisions

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
- **D-15:** **Medals are Raiden II style.** Destroyed flagged buildings and some ground targets drop a gold medal that drifts with the scroll. Values climb 100 → 200 → 500 → 1000 → … up to a 10000 cap (exact ladder is tunable data). **A medal that scrolls off resets the chain** to the base value.
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

### General game look (STGE-03, VISL)
- **D-31:** **Stage 1 is set at dusk, in a smoky orange haze.** A low warm sun, a hazy orange-brown sky and fog, and fires glowing against long shadows. The ground stays warm and desaturated so the pink enemy bullets (Phase 2 D-23) always read.
- **D-32:** **The city is built from hand-placed blocks on a road grid.** Stage data places building and prop kinds on city blocks with roads between them. Models are code-generated in the Phase 2 smooth stylized style (D-24) and scale with the quality tier (D-25). Destructible ones are flagged in the data. Placement is deterministic and in step with the scroll timeline.
- **D-33:** **The atmosphere is rich and scales with tier.** Burning buildings get flame and smoke plumes, plus drifting embers, height fog and the occasional distant flash. Low tier drops the embers and plumes to hold framerate. Particles stay GPU-driven (no Python particle sim).
- **D-34:** **The stage arc is outskirts → burning downtown → airfield.** Suburbs and fields first, then dense burning downtown (the mid-boss on its rail line), then an industrial area or airfield where the bomber arrives.
- **D-35:** **The whole scene is re-lit for dusk.** The current single `HemisphereLight` and near-black background give way to a dusk rig: a warm key sun (shadows on the high tier), cool fill and fog. Materials and bloom are retuned so the ship, enemies, terrain and effects read as one scene. The existing models are kept, with no bigger art pass on ships.
- **D-36:** **Enemies share one faction scheme:** dark olive/gray bodies with a red-orange accent stripe and emissive lights. The player stays light/silver-blue. Neither may use the reserved enemy-bullet pink.

### Claude's Discretion
- How the mid-boss is staged (rail line vs road), and its HP, patterns and timeout.
- The exact medal value ladder, point values per kind, the bonus amounts per tally line, and the extend thresholds within D-17.
- Wave composition and the enemy path vocabulary (curves, splines, formations). Bullet pattern vocabulary beyond aimed/spread/ring (ENMY-04 requires at least those three) and how patterns are parameterized as data.
- Boss attack patterns per phase, part HP and the phase-2 HP threshold.
- Pixel font choice (self-hosted or a Google Font, within the CLAUDE.md asset rules). Exact HUD layout and safe-area handling.
- Lighting values, fog density, sky technique, how far shadows reach per tier, and fire/smoke/ember technique.
- How the scroll-distance timeline maps onto the existing `TerrainScroll` / `terrain_ring.js` (and how the city ground layer is streamed). Protocol and buffer changes (bump `PROTOCOL_VERSION`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope & requirements
- `.planning/ROADMAP.md` §Phase 3: goal and 5 success criteria (criterion 5 is data-only stage editing)
- `.planning/REQUIREMENTS.md`: exact wording of ENMY-01, ENMY-02, ENMY-04, ENMY-05, ENMY-06, ENMY-07, ENMY-09, STGE-03, SCOR-01..05, SCOR-08, plus the Out of Scope table (no bullet hell or Cave chaining, no procedural stages)
- `.planning/PROJECT.md`: core value, constraints, Key Decisions
- `.claude/CLAUDE.md`: coding standards (hard constraints: one class per file, domain subdirs, 100% branch coverage, uv + Makefile), stack versions, the "What NOT to use" table (no per-entity FFI, no Python particle sim, no frame-loop allocation, no naive collision)

### Prior phase decisions
- `.planning/phases/02-arcade-shooting-feel/02-CONTEXT.md`: D-13 touch bomb button placement, D-14 fly-in respawn, D-16/D-19 crystals and carriers, D-20 gallery as default (now superseded by D-29 here), D-21 terrain-anchored ground units, D-22/D-26 explosion and big-event shake/hitstop rules, D-23 reserved pink bullets, D-24/D-25 model style and tier detail, D-29 zzfx SFX pattern, D-06 MAX bonus deferred to here
- `.planning/phases/01-playable-core-on-real-devices/01-CONTEXT.md`: D-06 playfield units (~240×320), D-09 fixed camera, D-15 URL debug flags, D-16..18 pause behavior

### Stack & architecture research
- `.planning/research/ARCHITECTURE.md`: `scorched_core` / `scorched_web` split, `protocol.py` buffer contract, struct-of-arrays pools
- `.planning/research/FEATURES.md`: Raiden/Strikers conventions (medals, bosses, stage structure, extends)
- `.planning/research/PITFALLS.md`: bullet readability, FFI cost, WASM memory detachment
- `.planning/research/STACK.md`: performance budget (≤3 ms Python per frame), bloom/tier guidance

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/scorched_core/stages/gallery_spawner.py`: the deterministic tick-keyed spawn script. It becomes the template for the scroll-distance stage timeline (D-04) and stays for `?gallery` (D-29).
- `src/scorched_core/stages/terrain_scroll.py`: `TerrainScroll.distance` is the timeline key. Its constant `SCROLL_SPEED` needs a variable speed for the boss crawl (D-06).
- `src/scorched_core/patterns/bullet_patterns.py` (`fire_aimed`, `fire_ring`) and `patterns/fire_pattern.py` (`FirePattern` NONE/AIMED/RING): the seed of the data-driven pattern library. Add spread and parameterized patterns (ENMY-04).
- `src/scorched_core/entities/enemy_kind.py` (JET, HELI, CARRIER, TANK, TURRET) and `motion_kind.py` (SWAY, DIVE, HOVER, GROUND): extend them with path-following motion, the mid-boss, the boss and boss parts. Enum values never change and cross the boundary.
- `src/scorched_core/pools/{enemy_pool,bullet_pool,pickup_pool,missile_pool}.py`: struct-of-arrays pools. Medals are likely a new pickup kind.
- `src/scorched_core/collision/{uniform_grid,circle_hits,area_hits,ship_hits}.py`: the broadphase that all new pairs go through (shots vs buildings and boss parts, player vs medals).
- `src/scorched_core/audio/{sfx_id,sfx_router}.py` + `web/src/audio/sfx_table.js`: add SFX for WARNING, extend, medal, tally and part destruction.
- `web/src/ui/status_readout.js`: the Phase 2 stand-in HUD (weapon, level, bomb pips, MAX flash). It grows into the full HUD (D-23/D-24).
- `web/src/fx/*` (explosion_fx, wreck_ring, decal_ring, particle_system, light_pool, shake, shadow_instances): reuse for building destruction, part stumps, fires and the boss shadow sweep.
- `web/src/render/models/*` (model_kit, jet, heli, tank, turret, carrier): the model generator style for buildings, the bomber and the mid-boss, and where the faction scheme goes (D-36).
- `web/src/render/renderer_rig.js`: currently a single `HemisphereLight` and background 0x0b0a09. This is where the dusk rig goes (D-35).
- `web/src/quality/{tiers.js,quality_controller.js,scaled_bloom_pass.js}`: tier ladder for atmosphere budgets (D-33).
- `web/src/boot/url_flags.js`: the flag grammar (debug, stress, tier, crash, weapon, level, bombs, god). Add `gallery` and `at` (D-29/D-30).
- `tools/perf_node.mjs` + `make perf`: the 3 ms Python budget gate. The full stage with the boss must stay green.

### Established Patterns
- Pure deterministic Python core with one batched `tick()` per frame. Everything crosses via `protocol.py` float32 buffers, an event ring and the manifest. No per-entity FFI.
- Gameplay constants live in `tuning.py`, boundary constants in `protocol.py`. One class per file, tests mirrored, 100% branch coverage, JS unit tests in `web/test/`, Playwright e2e in `tools/e2e/`.
- Instanced rendering per entity class. Effects are spawned from Python events and simulated on the GPU/JS side.

### Integration Points
- `src/scorched_core/game/game.py`: owns the tick. The stage director, scoring, lives/game-over state machine, boss controller and stage-clear tally hook in here.
- `src/scorched_web/bridge/render_sink.py`: packs the new channels (buildings, boss/parts, medals, HUD state: score, high score, lives, boss HP, banners).
- `web/src/main.js`, `render/renderer_rig.js`, `render/ground_layer.js`, `render/terrain_ring.js`: city ground layer, dusk lighting, fog and sky.

</code_context>

<specifics>
## Specific Ideas

- Reference feel: Raiden II stage 1 (medals from buildings, a burning city, a generous power curve) and the Strikers 1945 giant bomber boss with parts that can be shot off.
- The WARNING banner plus the bomber's shadow sweeping over the city before it appears is the boss "moment".
- Destroyed parts stay on the hull as smoking stumps, so the damage tells a story.
- Dusk, smoky orange haze, fires and embers make it "scorched earth". Pink enemy bullets must still read clearly through all of it.

</specifics>

<deferred>
## Deferred Ideas

None. The discussion stayed within phase scope. (Continue screen, top-10 initials, title screen, difficulty levels and stages 2-3 are already planned for Phase 4.)

</deferred>

---

*Phase: 03-stage-1-vertical-slice*
*Context gathered: 2026-10-18*
