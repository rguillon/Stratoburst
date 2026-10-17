# Roadmap: Scorched

## Overview

Scorched goes from an empty directory to a shareable 3-stage, 3D-rendered Raiden-style shmup in four end-to-end playable increments. Phase 1 starts with the riskiest assumption and treats it as a go/no-go gate: Python (Pyodide) driving three.js has to hold framerate on real phones and on the real static host. Phase 1 still ends with something you can play: a ship that flies and shoots over scrolling terrain. Phase 2 makes the core value real. It adds the full Raiden arsenal, bombs, death and respawn, and the whole 3D effect stack (bloom, particles, explosions, shake, hitstop, SFX), all tested in a shooting gallery before any content exists. Phase 3 is the second gate: a complete stage 1 with data-driven waves, a multi-phase boss with destructible parts, scoring, lives and a HUD. It proves the content pipeline works before more stages are built on it. Phase 4 builds stages 2-3 on that pipeline and wraps everything in the full arcade shell (title, difficulty, stage select, pause, continues, high scores, music, options, PWA install).

**Gates:**
- **After Phase 1 (go/no-go):** if the real-device stress test misses its targets, revisit the stack (numpy, lower tiers, Babylon.js fallback renderer) before starting Phase 2.
- **After Phase 3 (vertical slice):** stage 1 with its boss must be fun and polished before stages 2-3 are built.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Playable Core on Real Devices** - Pyodide + three.js deployed to the real host; ship flies and shoots on desktop and phones; mobile performance go/no-go
- [ ] **Phase 2: Arcade Shooting Feel** - Full Raiden arsenal, bombs, death/respawn and the complete 3D juice + SFX stack, validated in a shooting gallery
- [ ] **Phase 3: Stage 1 Vertical Slice** - Complete data-driven stage 1 with multi-phase boss, scoring, lives and HUD (content-pipeline gate)
- [ ] **Phase 4: Full Campaign & Arcade Shell** - Stages 2-3, difficulty, stage select, title/pause/continue screens, high scores, music, options, PWA

## Phase Details

### Phase 1: Playable Core on Real Devices

**Goal**: Anyone with the link can load the game on desktop or phone, fly a ship and shoot down targets over scrolling 3D terrain. The Python-in-browser stack must be proven fast enough on real phones and on the real static host.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: PLAT-01, PLAT-02, PLAT-03, PLAT-04, PLAT-05, PLAT-06, PLAT-07, PLAT-08, PLAT-09, PLAT-11, PLYR-01, PLYR-02, PLYR-03, INPT-01, INPT-02, STGE-02
**Success Criteria** (what must be TRUE):
  1. Opening the deployed link (on the real static host) on a desktop, a mid-range Android phone and a recent iPhone shows a loading screen with progress, then a tap/click-to-start gate, then a portrait playfield letterboxed to the screen in any orientation.
  2. Player can fly the ship in 8 directions over scrolling 3D terrain seen through the fixed tilted camera, using arrows/WASD on desktop (works on AZERTY) or relative 1:1 touch drag on a phone (the ship is never hidden under the finger). The ship's hitbox core is visibly marked, and the player can shoot down simple targets (hold fire on keyboard, auto-fire on touch).
  3. A stress mode with 400+ Python-driven bullets and bloom on holds 60fps on a mid-range desktop and a steady 30fps or better on both phones. Quality tiers (DPR cap, reduced bloom) step down automatically, and an on-device overlay shows frame and tick timings.
  4. Game speed is identical on 60 Hz and high-refresh displays. Hiding the tab or switching away auto-pauses the game, and returning resumes it without a time jump.
  5. A deliberately triggered runtime error shows an on-screen error panel instead of a frozen page, and the Python game core's test suite passes headlessly under pytest.

**Plans:** 10/10 plans executed

Plans:
- [x] 01-01-PLAN.md — Walking skeleton: approve deps; tracer moves a Python-driven ship in a production build; convention guards
- [x] 01-02-PLAN.md — Shareable link: gated CI/CD to GitHub Pages (gh-pages branch), PR-preview wiring, user creates repo (D-05), live smoke
- [x] 01-03-PLAN.md — Stress mode: `?stress=N` Python bullets via one instanced draw, bloom pipeline, 3 ms Python budget check
- [x] 01-04-PLAN.md — Auto quality tiers with verify-and-lock step-down, `?tier=`, on-device `?debug` overlay and copyable report
- [x] 01-05-PLAN.md — Letterboxed portrait playfield with fixed tilted camera fit and dimmed margins; Python-driven scrolling 3D terrain
- [x] 01-06-PLAN.md — Recognizable jet with always-visible hitbox; physical-key keyboard (AZERTY-safe); relative 1:1 touch drag with catch-up
- [x] 01-07-PLAN.md — Twin shot (hold / auto-fire) and drifting drones that flash and die, via a uniform-grid broadphase
- [x] 01-08-PLAN.md — Refresh-rate-independent 60 Hz with vsync snapping; auto-pause on hide/blur with resume-on-input
- [x] 01-09-PLAN.md — Loading progress and tap/click start gate (audio unlock); full error panel with `?crash=py|js`
- [x] 01-10-PLAN.md — Real-device go/no-go: PR preview on phones, stress soak reports, verdict, deploy main

**UI hint**: yes

### Phase 2: Arcade Shooting Feel

**Goal**: Shooting feels like a real 90s arcade shmup rendered in 3D. The full Raiden-style arsenal, bombs, and death and respawn all work, with punchy lighting, explosions, shake and sound, tested in a shooting gallery before any content is built.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: PLYR-04, PLYR-05, PLYR-06, PLYR-07, PLYR-08, PLYR-09, PLYR-10, INPT-03, VISL-01, VISL-02, VISL-03, VISL-04, VISL-05, VISL-06, ENMY-08, STGE-04, AUDI-01, AUDI-03
**Success Criteria** (what must be TRUE):
  1. Player can collect red, blue and purple pickups to switch between vulcan spread, laser and homing, and same-color pickups raise the current weapon up to level 5. On death the player loses power, a recovery pickup drops nearby, and the ship respawns blinking and briefly invulnerable.
  2. Player can trigger a bomb with a key or a large on-screen touch button. The bomb clears enemy bullets, damages enemies and grants brief invulnerability. Bombing within the grace window after being hit cancels the death, and bomb pickups restock the bomb supply.
  3. Ships, air targets, ground targets and terrain are all built in code. Targets flash when hit and explode with fire, smoke and debris particles sized to their class. Ground targets leave burning wrecks and persistent scorch marks on the terrain, and air units cast shadows that make their altitude readable from the tilted camera.
  4. Bullets, engines and explosions glow with bloom under dynamic lighting, while enemy bullets stay clearly readable against fire and explosions. With the full effect stack on, the Phase 1 framerate targets still hold on desktop and both phones.
  5. Bombs and player death trigger screen shake and a short hitstop (ordinary hits do not). Every shot, hit, explosion, pickup, bomb and death has a synthesized sound effect, and audio plays on iOS Safari after the start tap.

**Plans**: TBD
**UI hint**: yes

### Phase 3: Stage 1 Vertical Slice

**Goal**: Player can play a complete stage 1, with scripted air and ground waves over a destructible burning city and a multi-phase boss at the end, plus scoring, lives and a HUD. This proves the content pipeline before more stages are added.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: ENMY-01, ENMY-02, ENMY-04, ENMY-05, ENMY-06, ENMY-07, ENMY-09, STGE-03, SCOR-01, SCOR-02, SCOR-03, SCOR-04, SCOR-05, SCOR-08
**Success Criteria** (what must be TRUE):
  1. Player can play stage 1 from start to finish. Jets and helicopters fly scripted formations and paths, tanks and AA turrets move with the scrolling terrain and aim at the player, and enemies fire aimed, spread and ring bullet patterns.
  2. Stage 1 ends with a multi-phase boss whose attacks change as it takes damage. Its turrets and wings can be shot off one by one for points, with big-event shake and hitstop when parts and the boss are destroyed. A timeout guarantees the stage always progresses.
  3. Player earns points for destroying enemies, boss parts and city buildings, collects medals whose value climbs until one is missed, and sees a stage-clear bonus tally after the boss.
  4. Player starts with a set number of lives, earns extra lives at score thresholds, and reaches game over when all lives are lost. Throughout play the HUD shows score, high score, lives, bombs and weapon level.
  5. Adding or changing a wave or a bullet pattern only requires editing stage and pattern data, never engine code. This is what makes stages 2-3 cheap to build.

**Plans**: TBD
**UI hint**: yes

### Phase 4: Full Campaign & Arcade Shell

**Goal**: The complete game ships: a campaign of at least 3 stages with distinct settings and rising difficulty, inside a full arcade shell (title, menus, pause, continues, high scores, music and options), installable on phones and shared as a link.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: STGE-01, STGE-05, STGE-06, STGE-07, ENMY-03, SCOR-06, SCOR-07, SCRN-01, SCRN-02, SCRN-03, INPT-04, INPT-05, AUDI-02, AUDI-04, PLAT-10
**Success Criteria** (what must be TRUE):
  1. Player can play a campaign of at least 3 stages with distinct settings (e.g. burning city, desert, coast/fleet), including multi-hit naval and heavy units, with a boss at the end of each stage. Difficulty ramps so that stage 1 stays approachable for a first-time player, and the campaign finishes on an ending screen.
  2. From the title screen the player can start a game, choose Easy, Normal or Hard (which changes enemy bullet speed and density and the number of lives), select any stage already reached for practice, open options and view high scores. Every menu works by keyboard and by touch.
  3. Player can pause with a key or an on-screen touch button, then resume or quit to the title. After game over, a continue screen with a countdown lets the player keep going; the continued run is flagged and its score resets.
  4. Player can enter initials (by keyboard or touch) into a top-10 high-score table that is still there after closing and reopening the browser.
  5. Player hears synthesized music for the title, each stage and the bosses, and can mute or adjust music and SFX volume. The game can be installed to a phone home screen and launched fullscreen, and the full campaign still meets the framerate targets on desktop and both phones.

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Playable Core on Real Devices | 10/10 | In Progress | - |
| 2. Arcade Shooting Feel | 0/TBD | Not started | - |
| 3. Stage 1 Vertical Slice | 0/TBD | Not started | - |
| 4. Full Campaign & Arcade Shell | 0/TBD | Not started | - |
