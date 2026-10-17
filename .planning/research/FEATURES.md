# Feature Research

**Domain:** 90s-arcade-style vertical shmup (Raiden / Strikers 1945 lineage), 3D-rendered on a 2D gameplay plane, military / scorched-earth theme, browser-only (desktop keyboard + mobile touch), game logic in Python/WASM
**Researched:** 2026-10-17
**Confidence:** MEDIUM

Confidence note: genre conventions (weapon colors, bomb rules, extends, boss structure, stage length) come from long-established, widely documented arcade design and are consistent with what web search surfaced (fan wikis, Shmups Wiki, TouchArcade forum threads, game-feel articles). The web sources are LOW tier under the provider classifier (fan wikis, forums, blogs), so I use them only to corroborate. All numeric values below (extend thresholds, hitstop frames, shake durations, level counts, medal ladders) are **starting values to tune in playtest, not verified facts**. Items I could not verify are marked "(unverified)". Medal ladder specifics and exact Raiden extend scores were not confirmed by any source.

## Feature Landscape

### Table Stakes (Users Expect These)

Anyone who has played Raiden or 1945 will notice if these are missing. Missing any of them makes it "not a real shmup".

#### Player ship, movement, hitbox

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Free 2D movement inside the playfield, clamped to screen, constant speed, normalized diagonals | Core of the genre; Raiden/1945 use one fixed speed | LOW | Keyboard = 8-direction digital input; normalize so diagonals are not ~41% faster. Process input at the start of each fixed sim step. |
| Tiny hitbox, much smaller than the visual ship | Every shmup since Raiden; lets you thread bullets | LOW | Collision circle ~ 2-4% of playfield width, centered on cockpit. Enemy-bullet hitboxes slightly smaller than their glow. Touching an enemy body is also fatal (Raiden convention). |
| Visible hitbox cue (small bright core on ship) | Tilted 3D camera makes the true collision point ambiguous; readability is a stated risk | LOW | Not in the 90s originals, but needed here because the ship is a 3D mesh seen at an angle. Toggleable. Keep all gameplay entities on one collision plane. |
| Hold-to-fire with rapid fixed fire rate | Core input | LOW | Auto-fire is default on touch; on desktop offer hold-to-fire plus an "auto-fire" toggle (accessibility and ergonomics). |
| Respawn with brief invulnerability (about 2-3 s, flashing) at bottom-center | Fairness after death; all arcade shmups | LOW | Also clear enemy bullets on death so the respawn is not a second death. |
| Shadow under the ship / air units | Tilted 3D view needs altitude cues so fliers read as above ground | LOW | Cheap blob or projected shadow; also helps the player read position against ground targets. |
| Keyboard layout independence | The user is likely on a non-QWERTY layout (WASD is ZQSD on AZERTY) | LOW | Bind by `event.code` (physical position) and always also support arrow keys; show key hints from the actual layout if possible. |

#### Weapons, power-ups, bombs

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Three colored main weapons: Red vulcan (wide spread), Blue laser (narrow, piercing, high damage), Purple homing (low damage, tracks) | The Raiden identity; also in PROJECT.md Active list | MEDIUM | Gives a rock-paper-scissors: red = crowd coverage, blue = bosses / lined-up targets, purple = fire-and-forget (also the friendliest on touch). Original Raiden had red vulcan, blue laser, plus separate missile / homing secondary; Raiden II added purple plasma. |
| Matching-color pickup levels the weapon up; different color switches weapon | Defines the Raiden power-up loop (confirmed: pickup must match to strengthen) | LOW | Recommend 5 levels per weapon (Raiden III uses 5 for primaries; Raiden II uses 7, too many for a short campaign). On switch, keep level (reward adapting; unverified in originals, treat as tuning knob). |
| Visible weapon level in HUD and visible change in the shot itself | Players must feel each upgrade | LOW | Level 1 -> 5 should look dramatically different (more streams, wider, brighter). This is where the 3D glow/bloom pays off. |
| Max-level pickups convert to score | Prevents a dead pickup (Strikers 1945 II gives 4,000 pts past cap; confirmed by search) | LOW | Same for max bombs. |
| Power loss on death | In PROJECT.md; the risk/reward of the genre | LOW | Original Raiden resets hard, which creates a death spiral. Recommend: drop to level 1 of current color (or lose 2 levels, tuning knob) **and** drop one recovery capsule at the death spot / guarantee a capsule early in the next wave. Keep the penalty felt but recoverable. |
| Screen-clearing bomb: limited stock (start 3, cap 7 per Raiden III/IV), cancels enemy bullets, big damage to everything, ~2-3 s invulnerability | In PROJECT.md; core panic button | MEDIUM | Bomb is a timed effect (not instant) with the invuln window. Resets to starting stock on death. Bomb pickups exist in the world. Cannot be re-triggered while active. |
| Short "death-bomb" grace window (~6-10 frames after being hit, bomb still saves you) | Not authentic to Raiden, but browser input latency (esp. touch) makes strict rules feel unfair | LOW | Opinionated recommendation. Cheap to implement; protects the Core Value ("feels responsive"). |
| Item drops from designated carrier enemies (deterministic from stage script) | Raiden/1945 give pickups from marked enemies, not random drops | LOW | Script-driven drops make balancing and testing tractable. Items drift down and off-screen. |
| 1UP / bomb / power / medal pickup variety with distinct silhouettes and colors | Instant legibility | LOW | Use shape plus color, not color alone (accessibility). |

#### Enemies

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Small air fighters with simple paths (straight dive, sine, arc, strafing sweep) | The bread-and-butter fodder | LOW | Path library of ~6 reusable path types parameterized per spawn. |
| Formations (V, line, column, mirrored pairs) | Raiden waves feel authored through formations | LOW | A formation = a spawn macro over the same path primitives. |
| Heavy air units: bombers, gunships, helicopters (hover then leave), tougher HP | Break up the fodder; carry pickups | MEDIUM | Hover-and-shoot behavior plus HP tiers. |
| Ground units that scroll with terrain: tanks, AA guns, static turrets, bunkers | PROJECT.md roster; Raiden's ground layer | MEDIUM | Ground units move relative to scroll speed. Player shots hit both air and ground (no Xevious air/ground split). Turrets fire aimed shots. |
| Naval units (gunboats, destroyer / carrier set pieces with multiple turrets) | PROJECT.md roster | MEDIUM-HIGH | Large units are composites of child parts, same machinery as bosses (see below). |
| Enemy fire patterns: aimed single, small spread, short bursts, slow ring | 90s pacing, not bullet hell | LOW-MEDIUM | Typical on-screen count 20-80 bullets; hard cap ~150-200. This pacing is also what keeps Python-in-WASM viable. |
| Distinct enemy bullet look (hot orange/pink core + glow) vs player bullets (cool blue/white) | Readability beats beauty in a shmup | LOW | Bullets are the top of the visual priority stack. Bloom and particles must never hide them. |
| Roster size of roughly 10-14 enemy types + 3-5 bosses | Enough variety for a 3-5 stage campaign | MEDIUM | All procedural meshes built from primitives; part-based composition lets one kit serve fodder, mid-bosses and bosses. |

#### Waves and stage scripting

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Data-driven stage timeline: list of (scroll position / time, enemy type, spawn x, path, params, drop) events | Needed to author 3-5 stages without hard-coding; defines the "scripted wave patterns" requirement | MEDIUM | Python data/DSL. Key by scroll distance or elapsed time (pick one; time is simpler and deterministic). Seeded RNG so a stage plays identically each run (tuning, testing). |
| Constant-speed vertical scroll with terrain chunks | Genre baseline | MEDIUM | Procedural terrain tiles + prop scatter (buildings, craters, trees, wrecks). Per-stage theme palette. |
| Mid-boss mid-stage | Raiden pacing beat; breaks monotony | MEDIUM | Reuses boss machinery with fewer phases. |
| Stage intro card, "WARNING" banner before boss, stage-clear tally | Arcade presentation beats | LOW | Text and a timer; cheap and high-impact. |

#### Bosses

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Multi-phase boss per stage (HP thresholds trigger new attack sets), boss health bar | PROJECT.md requirement | HIGH | A phase = pattern set + movement + visual state. Short invulnerable transition with explosion and bullet clear between phases. |
| Destructible parts (turrets, wings, cannons each with own HP and hitbox) that remove specific attacks when destroyed | The Raiden boss signature; aligns with procedural part-based models | HIGH | Parts are child nodes with independent HP, damage flash, destruction VFX. Core becomes vulnerable only after (or while) parts fall, depending on design. |
| Boss kill sequence: chain explosions, hitstop, all bullets turn to points, big bonus | The payoff moment, a big part of "feels great" | MEDIUM | Staged timeline of explosions over 2-3 s, then stage-clear. |
| Boss duration tuned to ~45-90 s at expected weapon level | Too short is anticlimactic; too long is tedious | LOW (tuning) | Boss HP is a function of player DPS at level ~3-4. A level-1 player (after dying) must still be able to win, just slower. No timeouts that fail the player. |

#### Lives, continues, extends

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Start with 3 lives; extends at score thresholds (e.g. first at ~50k, then every ~150k, tuning) and rare 1UP pickup | Arcade convention | LOW | Show 1UP flash/jingle. |
| Continue screen: 10-second countdown, press to continue, game over at 0 | PROJECT.md; arcade convention | LOW-MEDIUM | Continue resets score to 0 and flags the run as continued (or disables high-score entry for that run); respawn at the same stage with default lives/bombs/weapon. Cap continues (e.g. 3) or infinite-but-flagged; recommend infinite-but-flagged so friends can always finish the game. |
| Game-over screen with final score and routing to name entry | Convention | LOW | |

#### Scoring and high scores

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Points per kill by enemy class, floating score popups | Feedback and arcade feel | LOW | Ground targets and heavies worth more. |
| Medals (bonus pickups dropped by certain ground targets / formations), value escalates with consecutive collection, resets on death or miss | Raiden-style scoring hook; in PROJECT.md | MEDIUM | Raiden medals exist, but the exact ladder was not verified (unverified); design your own ladder (e.g. 500 -> 1k -> 2k ... capped). Medals drift down, so there is a light risk/reward to grab. |
| Stage-clear bonus: remaining bombs, remaining lives, destruction percentage | Arcade tally screen | LOW | Pure data screen. Destruction % requires tracking spawned vs killed counts per stage. |
| Local top-10 high-score table, 3-letter initials entry (arcade style), shows stage reached | PROJECT.md | LOW-MEDIUM | `localStorage` wrapped in try/catch (Safari private mode and blocked storage must not crash the game). Directional input cycles letters; touch needs on-screen letter picker. |
| HUD: score, hi-score, lives icons, bomb icons, weapon type and level, boss bar | Convention | LOW | See platform section for placement in portrait vs landscape. |

#### Stage structure and difficulty

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| 3-5 stages, each ~2-3 min of scroll + ~1 min boss (3-4 min per stage; full run 12-18 min for 4-5 stages) | Raiden-class stage length; fits "short campaign" and friends sharing a link | MEDIUM | Recommend designing for 4 stages, shipping 3 first, with the pipeline making stage 4/5 pure content. Themes: desert, burning city, coastline / naval, fortress / night industrial. |
| Smooth difficulty ramp: stage 1 teaches (slow, sparse aimed shots), each later stage introduces 2-3 new enemy types and denser patterns | Genre expectation | MEDIUM (mostly content tuning) | Raise HP, bullet speed and pattern complexity per stage; keep bullet counts in Raiden range, not Cave range. |
| Difficulty select (Easy / Normal / Hard) as parameter multipliers (enemy HP, bullet speed, fire rate, starting bombs/lives) | Sharing with mixed-skill friends; Easy is the main inclusion driver | LOW if built into the data model from day one; MEDIUM if retrofitted | Build all combat numbers as data with a difficulty multiplier table. |
| Ending / results screen after final boss | A campaign needs a finish | LOW | Final score, rank, high-score check. |

#### Game feel (Core Value area)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Enemy hit flash (white/emissive spike for 2-3 frames) | Every hit must be visible | LOW | Shader uniform or emissive swap per instance. Per-part for bosses. |
| Impact sparks at bullet hits | Makes shots feel physical | MEDIUM | Instanced pooled particles with a hard cap; Python-side per-particle updates will not scale, so spawn on the GPU/JS side or use parametric particle shaders. |
| Tiered explosions: small (fighters), medium (tanks/turrets), large (bombers/ships), huge (boss) with fireball, smoke, debris, shockwave and a brief point-light flash | The "big 3D explosions" promise in PROJECT.md | MEDIUM-HIGH | Biggest single visual-value feature. Bloom + additive particles + dynamic light flash. |
| Screen shake, tiered and decaying (~100-300 ms, small amplitude), on big explosions, boss events, bomb and player death only; shake the world camera, not the HUD | Documented practice (short, decaying, reserved for big events; large shake causes nausea) | LOW | Never on every hit. Must have an off switch. |
| Hitstop: 2-4 frames (~30-60 ms) on boss part destruction, boss kill and player death | Documented range is 50-100 ms; longer reads as lag | LOW | Opinionated: in a shmup, freeze only the sim on rare, big events, never on ordinary hits, because freezing affects dodging. |
| Muzzle flash and glowing player bullets | Fire must feel punchy at all times | LOW | Emissive materials plus bloom. |
| Pickup sparkle and collection pop | Reward feedback | LOW | |
| Death sequence: ship explosion, short slow-mo, bullet clear | Dying should be dramatic but short | LOW-MEDIUM | |
| Fixed-timestep simulation (60 Hz) decoupled from render | A 90s game must not run double speed on 120/144 Hz displays or slow on 30 fps phones | MEDIUM | Accumulator pattern; clamp dt after tab resume. This is table stakes for a browser port of a 90s game. |

#### Screens and UI

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Loading screen with progress, shown immediately | Python-in-WASM downloads a big runtime; users leave if the page is blank | MEDIUM | HTML/CSS splash renders before any WASM loads. "Tap / press to start" gate doubles as the audio-unlock gesture. |
| Title screen: logo, Start, Options, High Scores | PROJECT.md | LOW | |
| Pause screen (Resume / Restart / Options / Quit to title) | PROJECT.md | LOW | Also triggered automatically on tab blur or hidden. |
| Options: music volume, SFX volume, screen shake on/off, touch scheme and handedness, difficulty, quality (Low/High) | Browser games are judged on whether they can be tuned | LOW-MEDIUM | Persist in `localStorage`. |
| Continue screen, Game Over, Name Entry, Stage Clear tally, Ending | PROJECT.md | LOW each | |
| Game-state machine (Loading -> Title -> Playing <-> Paused -> Continue -> GameOver -> NameEntry -> Title) | Underlies all screens | LOW-MEDIUM | |

#### Input

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Keyboard: arrows or WASD (by physical key), Z/Space fire, X/Shift bomb, P/Esc pause, Enter confirm | PROJECT.md | LOW | Offer alternate keys because many keyboards ghost with 3+ simultaneous keys (e.g. two arrows + fire + bomb). |
| Touch: relative drag anywhere on the lower playfield moves the ship by finger delta (finger does not need to be on the ship), auto-fire always on, dedicated bomb button | PROJECT.md; relative/offset drag is the established answer to "finger covers the ship" (DoDonpachi mobile ports, Sky Force Reloaded offset the ship above the finger) | MEDIUM | Details below. |
| Handedness swap for bomb button position | Thumb reach differs | LOW | |
| Suppress browser gestures: `touch-action: none`, no pull-to-refresh, no pinch-zoom, no long-press menu, no text selection, `overscroll-behavior: none` | Otherwise the page scrolls or reloads mid-game | LOW | Use pointer events with per-`pointerId` tracking so move and bomb touches are independent (multi-touch). |

**Touch scheme detail (recommended):**
- Relative drag: ship moves by `delta * gain` (gain ~1.0-1.5), 1:1 with **no added lag** (Sky Force adds heaviness deliberately, but you want maximum responsiveness; Core Value). Clamp max ship speed at roughly 1.5-2x the keyboard speed so touch does not teleport and gain an advantage.
- The first touch that is not on the bomb button is the "move" pointer; it is anchored where it lands (floating origin).
- Auto-fire is always on for touch. Because it makes the game easier, balance the single game around it (keyboard players can opt into auto-fire too) rather than keeping two separate balances.
- Bomb button: large (>= 56 px CSS), bottom corner on the dominant-hand side's opposite thumb; pause button small in a top corner with a larger invisible hit area, spaced away from the bomb to avoid accidental taps.
- `navigator.vibrate` haptics on bomb and death where available (Android; iOS Safari does not support it). Optional.

#### Audio

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| SFX: shot (quiet, voice-limited), enemy hit, tiered explosions, pickups (pitch rising with level / medal chain), bomb, boss warning siren, 1UP, player death | Audio is half of the "punch" | MEDIUM | Code-synthesized with WebAudio (oscillators + filtered noise + envelopes). Enforce a voice cap and priority so a dense frame does not flood the mixer. |
| Per-stage music loop (and a boss theme) | Arcade identity | HIGH (if synthesized) / LOW-MEDIUM (if short pre-rendered loops) | Highest-risk audio item. Synthesized sequencer must be scheduled on the `AudioContext` clock in JS, **not** driven from Python frames, or frame hitches break tempo. Fallback: small bundled OGG/MP3 loops. |
| Mute / volume controls, audio unlock on first gesture, suspend on tab hide | Browsers block autoplay; iOS Safari requires a gesture and suspends on hide | LOW | Recreate looping sources after resume (buffer sources are single-use). Note iOS silent switch can mute Web Audio. |

#### Browser / platform expectations

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Fast first paint, progress bar, cached on repeat visits | Shared-by-link games get seconds of patience | MEDIUM | Splash immediately; service worker / HTTP caching for runtime and assets so second load is near instant. |
| Auto-pause on `visibilitychange` (hidden) and window blur; require a deliberate resume (do not auto-resume) | Tab switches and phone calls must not cost a life; rAF is throttled when hidden | LOW | Also suspend `AudioContext`. Clamp dt on return. |
| Fixed logical playfield aspect, letterboxed / pillarboxed to fit any viewport | Identical gameplay everywhere (fair high scores, authored waves) | MEDIUM | See portrait handling below. |
| Portrait-first on phones; "rotate to portrait" prompt in landscape on phones | Vertical shmup is natively portrait | LOW | Cannot lock orientation on most browsers without fullscreen. |
| Handle resize, `orientationchange`, `visualViewport` (iOS dynamic toolbar), `devicePixelRatio` cap | Mobile viewports change under you | MEDIUM | Cap render scale (e.g. DPR <= 2, lower on weak devices). |
| WebGL context-loss handling | Mobile browsers drop contexts when backgrounded | MEDIUM | At minimum: pause and show "tap to resume", re-create GPU resources. |
| Settings and high scores persisted in `localStorage`, failure-tolerant | PROJECT.md | LOW | |

**Portrait / aspect handling (recommended):** Fix the logical playfield width and a design aspect near 9:16 (Raiden arcade was a 3:4 vertical monitor). On desktop landscape, center the portrait playfield with themed side panels that can hold the HUD. On phones taller than 9:16, show the extra height as non-gameplay margin or a slightly longer look-ahead region, but do not change what is collidable. Ensure the HUD in portrait is a translucent overlay along the top and the bottom edge is reserved for touch controls (kept outside the main danger zone).

### Differentiators (Competitive Advantage)

Aligned with Core Value: "shooting feels great" and "modern polished 3D". Compete on feel and look; do not compete on content volume or mechanical novelty.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Heavy visual juice stack: bloom, additive particles, dynamic point-light flashes from explosions, emissive bullets, heat distortion on big blasts | The thing a 90s sprite game cannot do; the project's entire pitch | HIGH | Needs a post-process pipeline (bloom) plus adaptive quality scaling. |
| Persistent scorch marks and burning wrecks on terrain (crater decals, smoldering ground units, smoke columns that scroll away) | Delivers the "Scorched" theme literally; scrolling terrain accumulates visible destruction from your own bombs and kills | MEDIUM | Pooled decal quads in a ring buffer; wreck meshes swap on destroy. Cheap relative to the thematic payoff. |
| Destructible scenery (buildings and fuel tanks collapse into rubble, give points, sometimes medals) | Raiden-style ground interactivity with 3D payoff | MEDIUM | Two-state meshes (intact / ruined) per prop type. |
| Real-time dynamic lighting from fires and explosions on terrain at night stages | Shows off 3D on a 2D plane | MEDIUM-HIGH | Cap lights; use a few pooled point lights or fake with additive sprites on weak devices. |
| Adaptive quality: monitor frame time, auto-drop bloom / particles / render scale; manual Low / High toggle | The browser plus mobile plus Python-WASM combination makes this a necessity for "playable on modern phones" | MEDIUM | Also a safety net for the performance risk named in PROJECT.md. |
| Stage select / practice mode unlocked after reaching a stage | Friends dying on stage 3 want to retry stage 3 immediately; strong for a shared-link game | LOW-MEDIUM | Free if stages are data-driven. Practice runs are flagged "no high-score". |
| Hidden bonuses (secret fairies / hidden medals revealed by shooting specific scenery) | Raiden has hidden items; rewards exploration and replays | LOW-MEDIUM | Script entries tied to scenery hit zones. |
| Boss-specific theatrics: camera push-in on warning, destructible parts shed visibly as 3D debris | Makes bosses feel like events | MEDIUM | Camera effects must stay subtle; camera is fixed per project decision (only shake / small offset). |
| Subtle ship banking / roll in the direction of movement | Free polish from 3D (the sprite originals used frame swaps) | LOW | Visual only; collision unchanged. |
| Installable PWA (manifest, fullscreen, offline) | Removes browser chrome on phones, which matters a lot for a touch shmup; instant repeat loads | LOW-MEDIUM | iOS has no Fullscreen API for pages, so Add to Home Screen is the route to fullscreen there. |
| Mouse / trackpad relative-drag on desktop using the same pointer code path as touch | Nearly free once touch exists | LOW | Optional extra input scheme. |
| Optional slow/precision key (hold Shift) | Helps keyboard players thread bullets; Raiden has none, so keep it optional | LOW | Off by default or on by default is a design call; touch gets precision for free from analog drag. |
| Light dynamic mercy ("rank" lite): after repeated deaths, slightly fewer bullets / more power drops | Reduces frustration for casual friends | MEDIUM | Keep invisible and mild; do not turn it into a full rank system. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Bullet-hell density, grazing, Cave-style chaining and hyper systems | "Modern shmup" expectation | Explicitly out of scope; blows the Python-in-WASM bullet budget; needs a very different readability and hitbox design | Raiden-pace patterns (20-80 bullets), classic medals scoring. |
| Online leaderboards, accounts, replay sharing servers | Competitive appeal | No backend by design; adds auth, anti-cheat and hosting | Local top-10; optional "copy my score" text to the clipboard (P3). |
| Gamepad support in v1 | Natural for arcade games | Out of scope for v1; extra testing matrix | Add later via the Gamepad API (cheap) once core is tuned. |
| Multiple playable ships with unique shots / bombs / options (Strikers 1945 style roster) | Replay value | Multiplies balance and content cost; weapon-color system already provides loadout variety | One ship, three weapon colors. Revisit only after v1. |
| Charge shot / Super Shot (Strikers 1945) | Authentic to 1945 | Conflicts with auto-fire on touch; adds a third input and timing state | Keep Raiden's auto-fire plus bomb. |
| Separate air-to-air and air-to-ground weapons (Xevious style) | Depth | Adds a second button and mental load; poor on touch | Single shot that hits both layers (Raiden). |
| Separate secondary-weapon pickup track (Raiden's missiles / homing as a second axis) | Authentic to original Raiden | Doubles pickup, HUD and balance complexity | Fold homing into the three-color primary system; maybe add side missiles at max level later. |
| Second loop, rank-based hidden difficulty spikes | Arcade hardcore | Hostile to casual friends; large tuning cost | Single clear difficulty ramp plus Easy/Normal/Hard. |
| Story cutscenes, dialogue, voice acting | Production value | Raiden has none; large asset and scripting cost, hurts pacing | Short stage titles and a one-screen ending. |
| Random / procedurally generated stages | Replayability | Destroys authored wave pacing, the heart of Raiden | Hand-authored data-driven stages. |
| Meta-progression: shops, upgrades, unlocks, currencies | Mobile-genre habit | Not arcade; dilutes the core loop; needs a save system | Score is the only progression; stage select as the sole unlock. |
| Ads, monetization hooks, login prompts | Habit | Kills the "send a link to friends" appeal and load time | None. |
| Free-moving or cinematic camera (Raiden III/IV style camera sweeps) | Looks impressive | Breaks the readability of a fixed tilted camera; project decision is a fixed camera | Fixed camera plus screen shake and subtle banking. |
| Per-hit screen shake and hitstop everywhere | "More juice" | Becomes noise, blurs dodging, causes nausea; documented as an over-juicing failure mode | Reserve shake and hitstop for big events; flash and sparks for ordinary hits. |
| Hand-modeled / imported 3D assets | Visual fidelity | Out of scope (procedural only) | Shaders, lighting, emissive materials, particles. |
| Rebindable keys, full settings menu sprawl | Power users | Cost not justified for v1 | Fixed sensible defaults with two alternate key sets. |
| Local co-op / multiplayer | Fun with friends | Out of scope; doubles everything | Pass-the-score "friendly" high-score table. |

## Feature Dependencies

```
Fixed-timestep game loop
    └──requires──> Input layer (keyboard + pointer/touch)
                       └──requires──> Player ship + movement + hitbox
                                          └──requires──> Player shooting (red vulcan first)
                                                             └──requires──> Enemy + collision + damage
                                                                                └──requires──> Enemy spawner / stage timeline
                                                                                                   └──requires──> Boss (parts, phases)

Rendering pipeline (3D scene, fixed tilted camera, instancing)
    └──requires──> Procedural model kit (part-based)
                       ├──requires──> Enemy roster
                       └──requires──> Destructible boss parts (child parts with own HP)
    └──requires──> Post-process (bloom)
                       └──enhances──> Explosions / emissive bullets (juice stack)

Weapon system (3 colors x 5 levels)
    └──requires──> Pickup system (carrier drops, colors, bounce/drift)
    └──requires──> Power loss on death
Bomb
    └──requires──> Invulnerability state + bullet clearing + damage-all
    └──enhances──> Death-bomb grace window

Scoring (kill points) ──requires──> Enemy kill events
    └──enhances──> Medals (escalating value) ──requires──> Pickup system
    └──requires──> Stage-clear tally (bombs, lives, destruction %)
    └──requires──> High-score table + name entry ──requires──> localStorage wrapper

Lives / extends ──requires──> Scoring ──requires──> Respawn + invuln
Continue screen ──requires──> Lives + game-state machine

Game-state machine ──requires──> Title / Pause / Continue / GameOver / NameEntry / Stage-clear screens
Auto-pause on blur ──requires──> Game-state machine + AudioContext suspend

Touch controls ──requires──> Pointer input layer ──enhances──> Mouse relative-drag (free)
Touch controls ──requires──> Auto-fire + bomb button + gesture suppression
Aspect / portrait handling ──requires──> Fixed logical playfield ──enhances──> HUD layout

Difficulty select ──requires──> Combat numbers as data (not hard-coded)
Stage select / practice ──requires──> Data-driven stage scripts + state machine
Adaptive quality ──requires──> Frame-time monitor + quality-tiered effects
Scorch marks / destructible scenery ──requires──> Terrain chunks + prop two-state meshes
Music ──requires──> Audio unlock + JS-side scheduler (not Python frame-driven)

Screen shake / hitstop (too frequent) ──conflicts──> Dodging readability and Core Value
Auto-fire on touch ──conflicts──> Charge-shot mechanics (anti-feature)
```

### Dependency Notes

- **Boss destructible parts require the procedural part-based model kit:** if models are one fused mesh, parts cannot be individually hit-flashed, destroyed or removed from the attack set. Decide the part-based model structure before building the first boss.
- **Weapons require the pickup system and power-loss rule together:** the power-loss tuning only makes sense once recovery capsules exist; build and tune them as one unit.
- **Difficulty select requires combat numbers as data:** a cheap decision at the start (every HP, speed, fire interval read from tables), expensive to retrofit.
- **Stage select and practice mode are free if stage scripts are data:** the same decision supports tuning and testing, since you can launch directly at any wave or boss.
- **Music scheduler must live in JS (AudioContext clock):** the Python frame loop can hitch (GC, WASM interop), and the music must not.
- **Juice stack requires the render pipeline first:** bloom, instanced particles and light flashes need the 3D pipeline and post-process in place; gameplay prototyping can start with flat shading, but explosions and shake cannot be judged without bloom.
- **Auto-pause on blur requires the state machine and a dt clamp:** otherwise returning to the tab runs a huge timestep and kills the player.
- **Hitbox cue and shadow require a single collision plane:** with a tilted camera, mixing altitudes makes bullets look like they should hit when they do not (or vice versa).
- **Scoring and extends require stable score events:** emit kill / pickup / clear events from the sim and have scoring consume them, so medals, tally and extends do not couple to enemy code.

## MVP Definition

### Launch With (v1)

The Active list in PROJECT.md is already a coherent v1; priority order within it matters. Feel first, content second.

- [ ] Fixed-timestep loop, keyboard + touch input, 8-direction ship with small hitbox and visible core cue; this is the Core Value, so prove it with a vertical slice first
- [ ] Render pipeline: tilted camera, procedural ship + a few enemies, emissive bullets, bloom, instanced bullets / particles, hit flash, tiered explosions, screen shake; prove the target frame rate on a mid-range phone before building content
- [ ] Red vulcan + blue laser + purple homing, 5 levels each, colored pickups, power loss on death with recovery
- [ ] Bomb with invulnerability and bullet clear, plus death-bomb grace
- [ ] Data-driven stage timeline, ~10-14 enemy types including ground and naval, formations, carriers with deterministic drops
- [ ] 3 stages, each with a mid-boss and a multi-phase boss with destructible parts (stage 1 boss simpler)
- [ ] Lives, extends, continue countdown, game over
- [ ] Scoring: kills, medals, stage-clear tally, top-10 high-score table with initials, persistence
- [ ] Screens: loading with progress, title, pause (auto on blur), options (volume, shake, handedness), game over, continue, name entry, stage-clear, ending
- [ ] Touch controls: relative drag, auto-fire, bomb button, gesture suppression, portrait handling with letterboxing
- [ ] SFX (synthesized) and at least one looping music track per stage group (or a short bundle of loops if synthesized music is not ready)
- [ ] Difficulty select (data multipliers)

### Add After Validation (v1.x)

- [ ] Stage 4 (and 5): trigger = three stages feel good and friends finish them
- [ ] Stage select / practice mode: trigger = friends repeatedly dying before the late stages
- [ ] Adaptive quality and manual quality toggle: trigger = any real-device frame-time shortfall (probably needed earlier in practice; treat as P1 if mobile fps is borderline)
- [ ] Scorch decals, destructible scenery, hidden bonuses: trigger = core loop is fun and frame budget has headroom
- [ ] PWA install / offline: trigger = repeat-play on phones
- [ ] Mouse / trackpad relative-drag on desktop: trigger = anyone asks
- [ ] Optional slow/precision key, "mercy" rank lite: trigger = playtest frustration data
- [ ] Haptics on Android: trigger = polish pass

### Future Consideration (v2+)

- [ ] Gamepad support (explicit v1 exclusion; the Gamepad API is cheap later)
- [ ] Additional ships / loadouts: only if v1 is loved
- [ ] Replays / attract-mode demo: nice to have
- [ ] Rebindable controls
- [ ] Share-score text / screenshots
- [ ] Secondary missile track as a max-level bonus

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Responsive ship control + small hitbox + fixed timestep | HIGH | LOW | P1 |
| Player bullets, hit flash, tiered explosions, shake, bloom | HIGH | MEDIUM-HIGH | P1 |
| Three weapon colors x 5 levels + pickups + power loss | HIGH | MEDIUM | P1 |
| Bombs (+ death-bomb grace) | HIGH | MEDIUM | P1 |
| Data-driven stage scripting + enemy roster (air / ground / naval) | HIGH | MEDIUM-HIGH | P1 |
| Multi-phase bosses with destructible parts | HIGH | HIGH | P1 |
| Lives / extends / continues | HIGH | LOW | P1 |
| Scoring: kills, medals, tally, high-score table + name entry | HIGH | MEDIUM | P1 |
| Screens (loading, title, pause, game over, continue, name entry, tally, ending) | HIGH | MEDIUM | P1 |
| Touch controls (relative drag, auto-fire, bomb button, gesture suppression) | HIGH | MEDIUM | P1 |
| Auto-pause on blur, audio unlock, dt clamp, portrait letterboxing | HIGH | LOW-MEDIUM | P1 |
| SFX (synthesized) | HIGH | MEDIUM | P1 |
| Music (looping) | MEDIUM-HIGH | HIGH (synth) / LOW-MED (loops) | P1 for 1 track, P2 for per-stage |
| Difficulty select | MEDIUM-HIGH | LOW (if data-driven from start) | P1 |
| Adaptive quality / quality toggle | HIGH (for mobile) | MEDIUM | P1 if mobile fps is borderline, else P2 |
| Stage select / practice | MEDIUM | LOW-MEDIUM | P2 |
| Scorch decals / burning wrecks | MEDIUM-HIGH (theme) | MEDIUM | P2 |
| Destructible scenery | MEDIUM | MEDIUM | P2 |
| Dynamic fire lighting at night | MEDIUM | MEDIUM-HIGH | P2 |
| Hidden bonuses | LOW-MEDIUM | LOW-MEDIUM | P2/P3 |
| PWA / fullscreen | MEDIUM | LOW-MEDIUM | P2 |
| Mouse relative-drag, slow key, haptics | LOW-MEDIUM | LOW | P3 |
| Mercy / rank-lite | MEDIUM | MEDIUM | P3 |
| Gamepad, extra ships, replays, rebinding | LOW (v1) | MEDIUM-HIGH | P3 / out |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Raiden / Raiden II (Seibu, 1990 / 1993) | Strikers 1945 (Psikyo, 1995) | Sky Force Reloaded (mobile) | Our Approach |
|---------|------------------------------------------|------------------------------|-----------------------------|--------------|
| Weapon system | Colored pickups: red vulcan, blue laser, plus missiles / homing; Raiden II adds purple plasma; match color to level up | Selectable plane with unique shot, option and bomb; charge Super Shot | Upgrade trees bought with earned currency between runs | Raiden colors only (3 primaries, 5 levels); no ship select, no meta shop |
| Power loss | Reset on death | Reset on death | n/a (meta upgrades persist) | Reset with recovery capsule; softer than original |
| Bombs | 3 start, up to 7, screen clear, short invuln | Start 2, up to 9, plane-specific | Screen-clearing super weapon | Start 3, cap 7, plus death-bomb grace |
| Scoring | Medals with escalating value, stage tallies, hidden items | Gold bars, charge-meter kills, point conversion of maxed power-ups | Stars collected for currency | Medals (escalating), tally, max-power pickups convert to points |
| Controls (touch) | n/a | n/a | Offset drag with slight lag, auto-fire | Relative drag, no lag, auto-fire, separate bomb button |
| Visuals | Sprites | Sprites | 3D-ish rendered | Real 3D, bloom, particles, dynamic light, scorch decals |
| Stage length | ~2-3 min plus boss; 8 stages | ~2-3 min plus boss; 8 stages | Short missions, bite-size | 3-5 stages, ~3-4 min each |
| Difficulty | Single curve, ramps hard late | Single curve, rank variants | Mission difficulty select | Easy / Normal / Hard multipliers over one authored curve |
| Continues | Coin-op credit continues | Coin-op credit continues | Energy / currency | Infinite-but-flagged countdown continues |

## Sources

- Search: Raiden weapon system, power-up, bomb info (Shmups Wiki Raiden II, Raiden fandom wiki, MobyGames, PSX Data Center); LOW tier (fan wikis), used only to corroborate color weapons, matching-color rule, 5-7 power levels, 3 starting bombs, cap of 7. https://shmups.wiki/library/Raiden_II , https://raiden.fandom.com/wiki/Raiden_III
- Search: Strikers 1945 mechanics (Shmups Wiki Strikers 1945 / 1945 II); LOW tier, used for charge shot, bomb stock, max-power-to-points conversion. https://shmups.wiki/library/Strikers_1945 , https://shmups.wiki/library/Strikers_1945_II
- Search: mobile shmup touch controls (TouchArcade forum threads, Sky Force Reloaded review, itch.io devlog on mobile controls and auto-fire); LOW tier, used for relative/offset drag over finger-on-ship, auto-fire being common and making the game easier, offering scheme options. https://toucharcade.com/community/threads/preferred-control-method-for-shmup-bullethell-free-flight-games.125655/ , https://loubagel.itch.io/sleigh-invaders/devlog/853500/mobile-controls-auto-fire
- Search: game feel (Wayline, eastondev, GDC "Juice it or Lose it" reference); LOW tier, used for hitstop 50-100 ms, shake 50-300 ms decaying, over-juicing warnings. Not shmup-specific.
- Search: browser audio / visibility handling (bugnet.io guides, WebKit bug tracker); LOW tier, used for pause on `visibilitychange`, `AudioContext` suspend / resume on gesture, single-use buffer sources. MDN autoplay docs should be consulted at implementation time. Portrait / letterbox guidance was not found in search and is based on standard practice.
- Domain knowledge (genre conventions, stage length, boss structure, extend and medal conventions, mobile layout reasoning): MEDIUM confidence, consistent with the references above but not individually source-verified. Numeric tuning values are starting points.
- Project context: /home/renaud/scorched/.planning/PROJECT.md

---
*Feature research for: 90s-style vertical shmup with 3D visuals on a 2D plane (browser, Python/WASM)*
*Researched: 2026-10-17*
