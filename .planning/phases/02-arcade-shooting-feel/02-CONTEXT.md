# Phase 2: Arcade Shooting Feel - Context

**Gathered:** 2026-10-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 makes the core value real inside a **shooting gallery**: the full Raiden-style arsenal (red vulcan spread, blue laser, purple homing missiles, levels 1-5), color-cycling weapon pickups, bombs with deathbomb, death with power loss and a recovery pickup, and a blinking respawn. It also adds the complete 3D effect stack: procedural models, dynamic lighting with bloom, explosion particles sized by class, hit flashes, burning wrecks and scorch marks, air-unit shadows, screen shake and hitstop, readable enemy bullets, synthesized SFX, and audio that works on iOS. The Phase 1 framerate targets must still hold.

Not in this phase: stage timelines, bosses, scoring/HUD, lives and game over (Phase 3), menus, music and difficulty (Phase 4). The gallery's enemies exist to exercise the systems. They are not stage content.

</domain>

<decisions>
## Implementation Decisions

### Weapons & power (PLYR-04, PLYR-05, PLYR-06)
- **D-01:** **Red vulcan = Raiden fan.** Lv1 is the existing twin shot. Each level adds wider-angled streams, up to a wide fan of about 7 streams at Lv5. Strong crowd control, weaker on a single target. Per-level patterns are data (tunable tables), not code branches.
- **D-02:** **Blue laser = Raiden beam.** A continuous straight beam locked to the ship's x that gets wider and deals more damage per level. Very high single-target DPS with no spread. The beam is a hitscan/segment collision, not pooled bullets.
- **D-03:** **Purple = homing missiles only (Strikers style), with no forward main shot.** Missiles curve toward targets, and the number of missiles per volley goes up with level (about 1 at Lv1 to about 5 at Lv5). Missiles need target acquisition plus a turn-rate-limited steering model.
- **D-04:** **Death costs 2 weapon levels** (minimum Lv1). The weapon type is kept. — **Reversibility:** reversible — tuning constant
- **D-05:** **The recovery pickup is an ordinary +1 level pickup fixed to the current weapon color** (it does not cycle). It drops near the death spot, so catching it limits the net loss to -1.
- **D-06:** **A same-color pickup at Lv5 gives a score bonus plus a "MAX" flash.** No score system exists until Phase 3, so record the event and award points once scoring arrives. The flash and SFX play now.
- **D-07:** **Switching color keeps the level** (Lv4 red → Lv4 blue).

### Bomb, death & respawn (PLYR-07, PLYR-08, PLYR-09, PLYR-10, INPT-03)
- **D-08:** **The bomb is a Raiden nuke.** A missile launches up the screen, then a huge expanding fireball fills it. This is the main showcase for bloom and particles.
- **D-09:** **Enemy bullets are cleared instantly at detonation.** The fireball then deals damage every tick for about 1.5 s. The player is invulnerable for the whole blast plus a short tail.
- **D-10:** **Bomb stock starts at 3 and is refilled to at least 3 on each new life, max 7.** Bomb pickups add +1.
- **D-11:** **Deathbomb grace window is about 8 frames** (about 0.13 s, tunable constant). A bomb pressed inside the window after a fatal hit cancels the death.
- **D-12:** **Keyboard bomb stays Shift or K** (Phase 1 D-11; already mapped in `keyboard_input.js`, and `Button.BOMB = 2` exists).
- **D-13:** **The touch bomb button is a big circle in the bottom-right.** It sits in the letterbox margin when there's room, otherwise it overlays the playfield corner. Pointers that start on the button are excluded from drag tracking.
- **D-14:** **Respawn flies in from the bottom.** After the death explosion and a short pause, the ship flies up from below the screen. The player takes control once it's on screen. The ship blinks for about 2-3 s of invulnerability.
- **D-15:** **The player can move and fire during the blink invulnerability.**

### Shooting gallery & pickups
- **D-16:** **Weapon pickups are Raiden color-cycling crystals.** One crystal cycles red → blue → purple about every 1.5 s and bounces around the playfield. The color at the moment of pickup decides the weapon. Exception: the death recovery pickup (D-05) is fixed to one color.
- **D-17:** **The gallery is a mixed, endlessly looping sandbox over the scrolling terrain.** It has air jets and helicopters (with shadows), ground tanks and turrets/AA guns, simple enemy fire (aimed shots and rings), and carrier enemies. Its job is to exercise every weapon, effect, wreck, shadow and death path. Spawning can be simple scripted loops. It is not the Phase 3 data-driven timeline, but it shouldn't block that design either.
- **D-18:** **The player can die in the gallery, with infinite lives.** Enemy bullets and body collisions kill, which exercises death, power loss, deathbomb and respawn. Lives and game over come in Phase 3.
- **D-19:** **Pickups drop from carrier enemies.** A distinctive carrier drops a weapon crystal when destroyed, and some ground targets drop bomb pickups.
- **D-20:** **The gallery is the default game on the live link** and replaces the Phase 1 drones. Stage 1 replaces it in Phase 3. Phase 1 URL flags (`?debug`, `?stress`, `?tier`) keep working.
- **D-21:** **Ground targets, their wrecks and scorch marks are anchored to the terrain and scroll with it** (STGE-04). This is the foundation for ground units in Phase 3.

### Juice, look & sound (VISL-01..06, ENMY-08, STGE-04, AUDI-01, AUDI-03)
- **D-22:** **Explosions are big and punchy, sized by class.** Small air targets get a bright pop plus sparks. Tanks and heavies get a fireball, rolling smoke, flying debris and a brief light flash on the terrain. Particles are GPU-driven from spawn events (no Python particle sim, per CLAUDE.md).
- **D-23:** **Enemy bullets are hot-pink/magenta orbs with a white core,** drawn above all effects. Pink is reserved: no fire, explosion or weapon effect may use it, so bullets stay readable (VISL-05). The blue laser and purple missiles must stay clearly different from enemy pink.
- **D-24:** **The art direction is smoother and stylized,** not faceted low-poly. Code-built models use more segments, smooth shading and some bevels, in military colors with bright emissive accents (engines, lights). This upgrades the Phase 1 flat-shaded jet. — **Reversibility:** costly — every model generator for ships, enemies and terrain props is written in this style
- **D-25:** **Model detail scales with the quality tier.** Generators take a detail parameter: the low tier gets fewer segments and no bevels, the high tier gets the full smooth look. This hooks into the Phase 1 tier controller.
- **D-26:** **Shake and hitstop happen only on big events.** The bomb gets a strong shake for about 0.5 s and about 3-4 frames of hitstop at detonation. Player death gets a medium shake and about 6 frames of hitstop. Ordinary hits and kills get neither (ROADMAP criterion 5). All values are tunable constants.
- **D-27:** **Shake is a render-only camera offset,** a short positional jitter. Gameplay coordinates and the fixed camera framing (Phase 1 D-09) are unchanged. Hitstop freezes the sim deterministically in Python, and the renderer keeps drawing.
- **D-28:** **Hit feedback is a white flash for a couple of frames plus a few sparks at the impact point.**
- **D-29:** **SFX are crunchy arcade sounds synthesized with zzfx.** Explosions are noisy with a low-end thump, shots are snappy, pickups chime brightly. Shot sounds are mixed quieter so they don't wear the player out. Python emits integer SFX IDs. JS plays pre-rendered buffers with a voice limit and a cooldown per ID (CLAUDE.md stack pattern).
- **D-30:** **Audio must play on iOS Safari after the start tap,** reusing the `AudioContext` that `start_gate.js` already resumes (AUDI-03).

### Claude's Discretion
- Exact per-level patterns, damage, fire rates, beam widths, missile counts and turn rates (all data tables).
- Blink duration within 2-3 s, the bomb invulnerability tail length, crystal bounce speed and cycle timing.
- Gallery enemy roster details, HP, spawn loop and enemy bullet speeds (keep Raiden pacing, not bullet hell).
- Lighting rig, bloom tuning per tier, particle system design (GPU instanced points or sprites), scorch-mark technique (decals vs terrain texture writes), and shadow technique (blob/projected shadows are fine).
- Protocol/buffer layout changes (bump `PROTOCOL_VERSION`; header slots 12-15 are spare) and the event ring for SFX and effect spawns.
- Exact hitstop frame counts and shake amplitudes within D-26.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope & requirements
- `.planning/ROADMAP.md` §Phase 2: goal, 5 success criteria (shake/hitstop only on bombs and death; framerate targets must hold)
- `.planning/REQUIREMENTS.md`: wording of PLYR-04..10, INPT-03, VISL-01..06, ENMY-08, STGE-04, AUDI-01, AUDI-03
- `.planning/PROJECT.md`: core value, constraints (Python 3.14 style, one class per file, domain subdirs, 100% coverage)
- `.claude/CLAUDE.md`: coding standards (hard constraints), stack versions, the "What NOT to use" table (no per-entity FFI, no Python particle sim, no allocation in the frame loop), zzfx audio pattern

### Prior phase decisions
- `.planning/phases/01-playable-core-on-real-devices/01-CONTEXT.md`: D-06 playfield units, D-09 fixed camera, D-10 ship speed, D-11 key map, D-12 touch drag, D-15 URL debug flags, D-16..18 pause behavior

### Stack & architecture research
- `.planning/research/ARCHITECTURE.md`: `scorched_core` / `scorched_web` split, `protocol.py` buffer contract, struct-of-arrays pools, altitude-scale camera mapping (shadows)
- `.planning/research/PITFALLS.md`: bullet readability, iOS audio quirks, FFI cost, WASM memory detachment
- `.planning/research/FEATURES.md`: Raiden weapon/bomb conventions, touch control conventions
- `.planning/research/STACK.md`: performance budget (≤3 ms Python per frame), bloom tier guidance
- `.planning/research/SUMMARY.md`: Phase 2 research flags (iOS audio, mobile bloom cost, bullet palette)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/scorched_core/weapons/twin_shot.py`: becomes vulcan Lv1; a starting point for the weapon abstraction.
- `src/scorched_core/pools/bullet_pool.py`: struct-of-arrays pool for player shots, enemy bullets and missiles.
- `src/scorched_core/collision/uniform_grid.py`, `circle_hits.py`: the broadphase that every new collision pair goes through (shots/beam vs enemies, enemy bullets vs player, player vs pickups).
- `src/scorched_core/entities/drone_swarm.py`: Phase 1 drones, to be replaced by the gallery's enemy set. Its flash-ticks logic is reusable.
- `src/scorched_core/input/button.py`: `Button.BOMB = 2` already defined. `web/src/input/keyboard_input.js` already maps Shift/K to bomb.
- `src/scorched_core/stages/terrain_scroll.py` + `web/src/render/terrain_ring.js`: scroll offset that ground units, wrecks and scorch marks anchor to.
- `web/src/render/ship_model.js`: Phase 1 code-built jet (flat-shaded ExtrudeGeometry). Upgrade it to the smoother style (D-24).
- `web/src/quality/{tiers.js,quality_controller.js,scaled_bloom_pass.js}`: tier ladder to extend with model detail (D-25) and effect budgets.
- `web/src/boot/start_gate.js`: already creates and resumes the `AudioContext` on the start gesture (AUDI-03 base).
- `tools/perf_node.mjs` + `make perf`: the 3 ms Python budget gate to keep green with the new systems.

### Established Patterns
- Pure deterministic Python core with one batched `tick()` per frame. Everything crosses via `protocol.py` float32 buffers and the manifest (button bits, tuning). No per-entity FFI.
- Constants live in `tuning.py` (gameplay) and `protocol.py` (boundary). One class per file, tests mirrored, 100% branch coverage, JS unit tests under `web/test/`, Playwright e2e under `tools/e2e/`.
- Instanced rendering per entity class (`bullet_instances.js`, `drone_instances.js`).

### Integration Points
- `src/scorched_core/game/game.py`: owns the tick. Gallery spawner, weapons, bomb, death/respawn state and the hitstop freeze hook in here.
- `src/scorched_web/bridge/render_sink.py`: packs the new channels (enemies by class, pickups, beam, missiles, effect/SFX events).
- `web/src/main.js` / `render/renderer_rig.js` / `render/post_pipeline.js`: lights, particles, shake offset, shadows and decals.

</code_context>

<specifics>
## Specific Ideas

- Raiden is the reference: the color-cycling crystal, the nuke bomb, the fan vulcan, the straight beam laser, the fly-in respawn. The purple weapon is the deliberate exception and follows Strikers 1945 homing missiles.
- Explosions should feel over the top but readable. Enemy pink bullets must always read through the fire.
- Visual identity: smoother stylized military models with glowing accents, not faceted low-poly.

</specifics>

<deferred>
## Deferred Ideas

- Score values for the Lv5 "MAX" pickup bonus: the event is recorded now and points are awarded once scoring exists (Phase 3).
- An X key as an extra bomb alias for Z/X players: declined for now, could become a Phase 4 option.

</deferred>

---

*Phase: 02-arcade-shooting-feel*
*Context gathered: 2026-10-17*
