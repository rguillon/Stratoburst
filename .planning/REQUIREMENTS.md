# Requirements: Scorched

**Defined:** 2026-10-17
**Core Value:** Shooting feels great: tight, responsive ship control and satisfying, punchy 3D feedback at a smooth framerate in the browser.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Platform & Tech

- [ ] **PLAT-01**: Player can open a single shareable URL (static hosting, no backend) and play in a desktop or mobile browser
- [x] **PLAT-02**: Game logic runs in Python (Pyodide) in the browser; rendering is three.js WebGL2
- [x] **PLAT-03**: Player sees a loading screen with progress, then a "tap/click to start" gate (also unlocks audio)
- [ ] **PLAT-04**: Game holds 60fps on a mid-range desktop browser with a full stage load (≈400+ bullets, effects on)
- [ ] **PLAT-05**: Game stays playable (≥30fps steady, no input lag spikes) on a mid-range Android phone and a recent iPhone, using automatic quality tiers (DPR cap, reduced bloom)
- [x] **PLAT-06**: Simulation runs on a fixed 60 Hz timestep, independent of display refresh rate
- [x] **PLAT-07**: Gameplay runs in a fixed logical playfield (portrait arcade aspect) letterboxed to any screen size/orientation
- [x] **PLAT-08**: Game auto-pauses when the tab loses focus or is hidden
- [x] **PLAT-09**: If a runtime error occurs, player sees an on-screen error panel instead of a frozen page
- [ ] **PLAT-10**: Player can install the game to a phone home screen (PWA) and launch it fullscreen
- [x] **PLAT-11**: Python game core is testable headlessly with pytest (no browser required)

### Player & Weapons

- [x] **PLYR-01**: Player can move the ship in 8 directions within the playfield with responsive, consistent speed
- [x] **PLYR-02**: Player ship has a small hitbox core that is visibly marked on the ship
- [x] **PLYR-03**: Player can fire a main weapon (hold to fire on keyboard; auto-fire on touch)
- [ ] **PLYR-04**: Player can collect colored weapon pickups: red (vulcan spread), blue (laser), purple (homing)
- [ ] **PLYR-05**: Collecting the same color as the current weapon raises its level (up to 5); a different color switches weapon type
- [ ] **PLYR-06**: On death the player loses weapon power and a recovery pickup drops nearby
- [ ] **PLYR-07**: Player can trigger a bomb (limited stock) that clears enemy bullets, damages enemies and grants brief invulnerability
- [ ] **PLYR-08**: Player can bomb within a short grace window after being hit to cancel the death
- [ ] **PLYR-09**: Player can collect bomb pickups to restock bombs
- [ ] **PLYR-10**: Player respawns with brief invulnerability (visibly blinking) after losing a life

### Enemies & Bosses

- [ ] **ENMY-01**: Stages contain air enemies (jets, helicopters) flying scripted formations and paths
- [ ] **ENMY-02**: Stages contain ground enemies (tanks, turrets/AA guns) that move with the scrolling terrain and aim at the player
- [ ] **ENMY-03**: Stages contain naval / large enemies (ships, heavy units) with multiple hit points
- [ ] **ENMY-04**: Enemies fire bullet patterns (aimed, spread, rings) defined as data, not hard-coded per stage
- [ ] **ENMY-05**: Enemy waves follow a data-driven stage timeline
- [ ] **ENMY-06**: Each stage ends with a multi-phase boss whose attack patterns change as it takes damage
- [ ] **ENMY-07**: Bosses have destructible parts (turrets, wings) that can be shot off individually for points
- [ ] **ENMY-08**: Enemies flash on hit and explode on destruction, leaving wrecks on ground units
- [ ] **ENMY-09**: Bosses have a timeout so a stage can always progress

### Stages & Campaign

- [ ] **STGE-01**: Player can play a campaign of at least 3 stages, each with distinct terrain/setting (e.g. burning city, desert, coast/fleet)
- [x] **STGE-02**: 3D terrain scrolls continuously beneath the gameplay plane, seen through a fixed tilted top-down camera
- [ ] **STGE-03**: Ground scenery (buildings, props) can be destroyed by the player's fire
- [ ] **STGE-04**: Explosions and destroyed units leave persistent scorch marks and burning wrecks on the terrain
- [ ] **STGE-05**: Player can choose a difficulty (Easy / Normal / Hard) that changes enemy bullet speed/density and lives
- [ ] **STGE-06**: Player can select any stage already reached to play it (stage select / practice)
- [ ] **STGE-07**: Difficulty ramps across the campaign; stage 1 is approachable for a first-time player

### Scoring & Progression

- [ ] **SCOR-01**: Player earns points for destroying enemies, parts and scenery
- [ ] **SCOR-02**: Player can collect medals whose value increases while collected without missing
- [ ] **SCOR-03**: Player sees a stage-clear bonus tally after each boss
- [ ] **SCOR-04**: Player earns extra lives at score thresholds
- [ ] **SCOR-05**: Player starts with a set number of lives; game over occurs when all are lost
- [ ] **SCOR-06**: Player can continue after game over (countdown); continued runs are flagged and score resets
- [ ] **SCOR-07**: Player can enter initials for a top-10 local high-score table that persists in browser storage
- [ ] **SCOR-08**: Player can see the current score, high score, lives, bombs and weapon level on a HUD

### Visuals & Feel

- [ ] **VISL-01**: All ship, enemy, boss and terrain models are generated procedurally in code
- [ ] **VISL-02**: Scene uses dynamic lighting and bloom/glow on emissive elements (bullets, engines, explosions)
- [ ] **VISL-03**: Explosions use particle effects (fire, smoke, debris) sized by enemy class
- [ ] **VISL-04**: Big events (boss parts, boss death, bombs, player death) trigger screen shake and short hitstop
- [ ] **VISL-05**: Enemy bullets stay clearly readable against the fiery backgrounds (dedicated palette and render pass)
- [ ] **VISL-06**: Air units cast shadows on the terrain so their altitude reads correctly from the tilted camera

### Input

- [x] **INPT-01**: Player can control the game by keyboard: arrows and WASD (layout-independent via physical keys), fire, bomb, pause
- [x] **INPT-02**: Player can control the ship by relative touch drag (1:1, ship never hidden under the finger) with auto-fire
- [ ] **INPT-03**: Player can trigger a bomb on touch via a large on-screen button
- [ ] **INPT-04**: Player can pause and resume on touch via an on-screen button
- [ ] **INPT-05**: Player can navigate all menus and enter initials by keyboard and by touch

### Audio

- [ ] **AUDI-01**: Player hears synthesized sound effects for shots, hits, explosions, pickups, bombs and deaths
- [ ] **AUDI-02**: Player hears code-synthesized music for title, each stage and bosses
- [ ] **AUDI-03**: Audio works on iOS Safari after the start gesture
- [ ] **AUDI-04**: Player can mute or adjust music and SFX volume

### Screens

- [ ] **SCRN-01**: Player sees a title screen with start, stage select, difficulty, options and high scores
- [ ] **SCRN-02**: Player can pause the game and resume or quit to title
- [ ] **SCRN-03**: Player sees game-over / continue and campaign-ending screens

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Campaign

- **CAMP-01**: Stages 4 and 5 (stretch — added to v1 if time allows after stage 3 ships)

### Accessibility & Comfort

- **ACCS-01**: Option to disable screen shake
- **ACCS-02**: Option to always display the hitbox
- **ACCS-03**: Left-handed touch layout (mirrored bomb button)

### Input

- **INPT-06**: Gamepad support via the browser Gamepad API

### Polish

- **PLSH-01**: Render interpolation for 120/144 Hz displays
- **PLSH-02**: Replays from recorded inputs (enabled by deterministic sim)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Online leaderboards / accounts | No server; local high scores suffice for friends |
| Bullet-hell density, Cave-style chaining | Target is 90s Raiden pacing |
| Multiple selectable ships | Doubles balance work; not core |
| Charge shot | Conflicts with touch auto-fire |
| Secondary weapon track / separate air-ground weapons | Doubles pickup and balance work |
| Second loop, story cutscenes, meta-progression | Scope; not core to arcade experience |
| Procedurally generated stages | Hand-scripted timelines give better pacing |
| Imported / hand-modeled 3D assets | Models are built in code |
| Multiplayer / co-op | Not core |
| Native app builds | Browser is the only target |
| SharedArrayBuffer / Worker-dependent design | Static hosts (GitHub Pages) can't set COOP/COEP headers |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PLAT-01 | Phase 1 | Pending |
| PLAT-02 | Phase 1 | Complete |
| PLAT-03 | Phase 1 | Complete |
| PLAT-04 | Phase 1 | Pending |
| PLAT-05 | Phase 1 | Pending |
| PLAT-06 | Phase 1 | Complete |
| PLAT-07 | Phase 1 | Complete |
| PLAT-08 | Phase 1 | Complete |
| PLAT-09 | Phase 1 | Complete |
| PLAT-10 | Phase 4 | Pending |
| PLAT-11 | Phase 1 | Complete |
| PLYR-01 | Phase 1 | Complete |
| PLYR-02 | Phase 1 | Complete |
| PLYR-03 | Phase 1 | Complete |
| PLYR-04 | Phase 2 | Pending |
| PLYR-05 | Phase 2 | Pending |
| PLYR-06 | Phase 2 | Pending |
| PLYR-07 | Phase 2 | Pending |
| PLYR-08 | Phase 2 | Pending |
| PLYR-09 | Phase 2 | Pending |
| PLYR-10 | Phase 2 | Pending |
| ENMY-01 | Phase 3 | Pending |
| ENMY-02 | Phase 3 | Pending |
| ENMY-03 | Phase 4 | Pending |
| ENMY-04 | Phase 3 | Pending |
| ENMY-05 | Phase 3 | Pending |
| ENMY-06 | Phase 3 | Pending |
| ENMY-07 | Phase 3 | Pending |
| ENMY-08 | Phase 2 | Pending |
| ENMY-09 | Phase 3 | Pending |
| STGE-01 | Phase 4 | Pending |
| STGE-02 | Phase 1 | Complete |
| STGE-03 | Phase 3 | Pending |
| STGE-04 | Phase 2 | Pending |
| STGE-05 | Phase 4 | Pending |
| STGE-06 | Phase 4 | Pending |
| STGE-07 | Phase 4 | Pending |
| SCOR-01 | Phase 3 | Pending |
| SCOR-02 | Phase 3 | Pending |
| SCOR-03 | Phase 3 | Pending |
| SCOR-04 | Phase 3 | Pending |
| SCOR-05 | Phase 3 | Pending |
| SCOR-06 | Phase 4 | Pending |
| SCOR-07 | Phase 4 | Pending |
| SCOR-08 | Phase 3 | Pending |
| VISL-01 | Phase 2 | Pending |
| VISL-02 | Phase 2 | Pending |
| VISL-03 | Phase 2 | Pending |
| VISL-04 | Phase 2 | Pending |
| VISL-05 | Phase 2 | Pending |
| VISL-06 | Phase 2 | Pending |
| INPT-01 | Phase 1 | Complete |
| INPT-02 | Phase 1 | Complete |
| INPT-03 | Phase 2 | Pending |
| INPT-04 | Phase 4 | Pending |
| INPT-05 | Phase 4 | Pending |
| AUDI-01 | Phase 2 | Pending |
| AUDI-02 | Phase 4 | Pending |
| AUDI-03 | Phase 2 | Pending |
| AUDI-04 | Phase 4 | Pending |
| SCRN-01 | Phase 4 | Pending |
| SCRN-02 | Phase 4 | Pending |
| SCRN-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 63 total
- Mapped to phases: 63
- Unmapped: 0 ✓

---
*Requirements defined: 2026-10-17*
*Last updated: 2026-10-17 after roadmap creation (traceability mapped)*
