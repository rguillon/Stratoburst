---
phase: 02-arcade-shooting-feel
reviewed: 2026-10-18T00:00:00Z
depth: standard
files_reviewed: 92
files_reviewed_list:
  - Makefile
  - src/scorched_core/audio/sfx_id.py
  - src/scorched_core/audio/sfx_router.py
  - src/scorched_core/clock/hitstop.py
  - src/scorched_core/collision/area_hits.py
  - src/scorched_core/collision/circle_hits.py
  - src/scorched_core/collision/ship_hits.py
  - src/scorched_core/entities/enemy_kind.py
  - src/scorched_core/entities/motion_kind.py
  - src/scorched_core/entities/pickup_kind.py
  - src/scorched_core/entities/player_life.py
  - src/scorched_core/entities/player_phase.py
  - src/scorched_core/entities/player_ship.py
  - src/scorched_core/events/event_ring.py
  - src/scorched_core/game/game.py
  - src/scorched_core/patterns/bullet_patterns.py
  - src/scorched_core/patterns/fire_pattern.py
  - src/scorched_core/pools/bullet_pool.py
  - src/scorched_core/pools/enemy_pool.py
  - src/scorched_core/pools/missile_pool.py
  - src/scorched_core/pools/pickup_pool.py
  - src/scorched_core/protocol.py
  - src/scorched_core/stages/gallery_spawner.py
  - src/scorched_core/tuning.py
  - src/scorched_core/weapons/bomb.py
  - src/scorched_core/weapons/bomb_phase.py
  - src/scorched_core/weapons/homing_launcher.py
  - src/scorched_core/weapons/laser_beam.py
  - src/scorched_core/weapons/pickup_outcome.py
  - src/scorched_core/weapons/vulcan.py
  - src/scorched_core/weapons/weapon_kind.py
  - src/scorched_core/weapons/weapon_loadout.py
  - src/scorched_web/entrypoint.py
  - tools/e2e/audio.spec.js
  - tools/e2e/bomb.spec.js
  - tools/e2e/death.spec.js
  - tools/e2e/debug.spec.js
  - tools/e2e/glow.spec.js
  - tools/e2e/ground.spec.js
  - tools/e2e/helpers.js
  - tools/e2e/shooting.spec.js
  - tools/e2e/stress.spec.js
  - tools/e2e/touch.spec.js
  - tools/e2e/weapons.spec.js
  - tools/perf_node.mjs
  - web/src/audio/audio_keepalive.js
  - web/src/audio/sfx_bank.js
  - web/src/audio/sfx_player.js
  - web/src/audio/sfx_table.js
  - web/src/audio/zzfx_synth.js
  - web/src/boot/url_flags.js
  - web/src/debug/debug_session.js
  - web/src/debug/report.js
  - web/src/fx/beam_mesh.js
  - web/src/fx/bomb_fx.js
  - web/src/fx/decal_ring.js
  - web/src/fx/explosion_fx.js
  - web/src/fx/fx_dispatcher.js
  - web/src/fx/light_pool.js
  - web/src/fx/palette.js
  - web/src/fx/particle_system.js
  - web/src/fx/shadow_instances.js
  - web/src/fx/shake.js
  - web/src/fx/wreck_ring.js
  - web/src/input/bomb_button.js
  - web/src/input/bomb_button_layout.js
  - web/src/input/input_sampler.js
  - web/src/input/touch_input.js
  - web/src/main.js
  - web/src/python/python_bridge.js
  - web/src/quality/tiers.js
  - web/src/render/bullet_instances.js
  - web/src/render/enemy_instances.js
  - web/src/render/ground_layer.js
  - web/src/render/missile_instances.js
  - web/src/render/models/carrier.js
  - web/src/render/models/enemy_models.js
  - web/src/render/models/heli.js
  - web/src/render/models/jet.js
  - web/src/render/models/model_kit.js
  - web/src/render/models/outline_shapes.js
  - web/src/render/models/tank.js
  - web/src/render/models/turret.js
  - web/src/render/pickup_instances.js
  - web/src/render/post_pipeline.js
  - web/src/render/renderer_rig.js
  - web/src/render/ship_model.js
  - web/src/render/terrain_ring.js
  - web/src/ui/status_readout.js
findings:
  critical: 1
  warning: 2
  info: 8
  total: 11
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-10-18
**Depth:** standard
**Files Reviewed:** 92
**Status:** issues_found

## Summary

The Python core is in good shape: the pools are allocation-free in the step loop, swap-remove iteration order is handled correctly everywhere, the hitstop/bomb-latch/deathbomb ordering is consistent, SFX routing is deterministic and the URL-flag path is allow-listed on both the JS and the Python side (no injection, XSS or path-traversal surface was found; all debug text goes through `textContent`/`textarea.value`).

The most serious defect is on the JS render side: the charred wrecks of ground kills are never actually visible, because a local variable shadows the module-level scale vector and corrupts every instance matrix with NaN. The unit tests and e2e specs only count spawned wrecks, so nothing caught it. Two gameplay-logic warnings follow (a bomb press latched across a pause; the bomb missile flying downward when fired near the top of the screen). The remaining items are info-level.

The model files `carrier.js`, `heli.js`, `jet.js`, `tank.js` and `turret.js` were skimmed only through their shared kit (`model_kit.js`, `enemy_models.js`, `outline_shapes.js`) and the instancing code that consumes them; no defects were found in that path.

## Critical Issues

### CR-01: Wreck instances are drawn with NaN matrices (shadowed `scale`), so wrecks are invisible

**File:** `web/src/fx/wreck_ring.js:172` (used at `:183`)
**Issue:** `update()` declares `const scale = layers === null ? 0 : getScale();` (a number, the tier particle scale) which shadows the module-level `const scale = new THREE.Vector3(1, 1, 1)` (line 36). Line 183 then calls `matrix.compose(position, quaternion, scale)` with the *number*. `Matrix4.compose` reads `scale.x/.y/.z`, which are `undefined`, so the matrix is NaN. I confirmed this against the repo's three build: `m.compose(new Vector3(1,2,3), new Quaternion(), 0.6)` yields `[NaN, NaN, NaN, 0]`. Every wreck instance (the ground-kill "charred wreck" feature, STGE-04/ENMY-08) is therefore degenerate and never renders. The smoke/flame smouldering still runs (it uses the number correctly), which makes the feature look half alive. The existing tests and `ground.spec.js` only assert `wrecksSpawned`/`live` counters, not the matrix contents, so the regression is invisible to the suite.
**Fix:**
```js
// wreck_ring.js, update()
const quality = layers === null ? 0 : getScale();
...
if (layers !== null && y >= 0 && y <= playfieldH) smoulder(i, wreckX[i], y, dt, quality, timeS);
...
matrix.compose(position, quaternion, scale); // the module-level Vector3 again
```
Also add a vitest assertion that after `handle(EXPLOSION ground)` + `update()`, `mesh.instanceMatrix.array.slice(0, 16)` is all finite and has a non-zero scale diagonal.

## Warnings

### WR-01: A bomb press made while paused is latched and fires on resume (resume key can spend a bomb)

**File:** `src/scorched_core/game/game.py:272-275` (latch) and `:241-251` (`set_paused`)
**Issue:** `tick()` latches `_bomb_requested = True` on any BOMB edge *before* the `if self.paused` early return, and `set_paused(False)` resets the runner, refresh estimator, input edge and drag but not `_bomb_requested`. The pause controller resumes on "any key" (`pause_controller.js` `onKeyDown`), and K / ShiftLeft / ShiftRight are bound to BOMB (`keyboard_input.js`). Pressing K or Shift to resume therefore records a BOMB edge in the paused tick, and the first live step after resume launches a bomb and burns stock (and grants 144 steps of invulnerability). The same happens for a bomb tap that lands in the frame in which the page blurs. The comment justifies the latch with "a frame that runs no step, or a paused one, must not lose it", but a paused one should lose it: the player is not playing.
**Fix:**
```python
def set_paused(self, paused: bool) -> None:
    ...
    if not paused:
        self._runner.reset()
        self.refresh.reset()
        self.input.settle()
        self._bomb_requested = False  # a press made while paused is not a bomb
        ...
```
(or only latch the press when `not self.paused`). Add a test: BOMB edge during pause, resume, step -> stock unchanged.

### WR-02: Bomb fired with the ship near the top of the screen sends the missile downward

**File:** `src/scorched_core/weapons/bomb.py:81`
**Issue:** `self.target_y = max(y - BOMB_RISE, BOMB_MIN_Y)`. The ship can fly up to `SHIP_HALF_H` = 10. For any `y < BOMB_MIN_Y` (90) plus the rise (i.e. whenever `y - 110 < 90`, which is every ship y below 200), the target is clamped to 90; when `y < 90` the "rising" missile starts above the target and travels *down* the screen, detonating below the ship. For `y` in 90..200 the rise is shortened but still upward, so only the top band (`y < 90`) is wrong. The blast is large enough that gameplay is mostly unaffected, but the missile visual (`bomb_fx.js` drawing `BOMB_X/Y`) visibly reverses direction, and the detonation centre (shake, scorch, light, bullet clear) is offset from where a player at the top expects it.
**Fix:**
```python
self.target_y = min(y, max(y - BOMB_RISE, BOMB_MIN_Y))  # never travel downward
```

## Info

### IN-01: Fireball radius drawn by JS differs from the radius Python damages with

**File:** `web/src/fx/bomb_fx.js:151-153` vs `src/scorched_core/weapons/bomb.py:49-52`
**Issue:** The JS comment says the radius is "the one Python's blast uses", but Python grows over `(age-1)/(GROW_TICKS-1)` while JS uses `min(1, t / (grow_ticks/blast_ticks))` with `t = age/BLAST_TICKS`, i.e. `age/GROW_TICKS`. The visible fireball is up to about 7 units larger than the damage/bullet-clear circle in the first ticks (age 1: 20 vs 27), converging at age >= 30. Not gameplay-breaking, but the visual is the player's only cue for the blast edge.
**Fix:** Publish the radius in the header (or compute `grown = min(max(age-1,0), grow-1)/(grow-1)` on the JS side from `t * blast_ticks`).

### IN-02: Bomb invulnerability makes the hull blink like a respawn

**File:** `web/src/main.js` (`hullVisibleFor(header[slots.INVULN])`) and `src/scorched_core/game/game.py:361`
**Issue:** `INVULN` is one shared counter (bomb launch + blast + tail = 144 steps, respawn = 150). The blink is documented as the respawn blink (PLYR-10, "Pitfall 9"), but the bomb also grants invulnerability through the same counter, so the ship blinks for 2.4 s after every bomb. Likely unintended; at minimum it hides the hull during the moment the player most needs to see it.
**Fix:** Publish a separate respawn-blink slot, or blink only while `PLAYER_PHASE`/a flag says the invulnerability came from a respawn.

### IN-03: Hitstop can make the terrain step backwards by up to one scroll step

**File:** `web/src/main.js` (`alpha = hitstop ? 0 : header[slots.ALPHA]`, `scrollNow = SCROLL_Y + alpha * scroll_speed`)
**Issue:** On the frame before the freeze was visible, scroll was `distance_prev + alpha_prev * 0.8`; once `HITSTOP > 0` it becomes `distance` with alpha forced to 0. If the previous alpha was high, the terrain/wrecks/decals jump back by up to 0.8 units for one frame at the exact moment of the biggest screen shake. Barely perceptible, but it is a visible discontinuity on the hero effect.
**Fix:** Hold the last extrapolated `scrollNow` for the duration of the hitstop instead of recomputing from alpha 0.

### IN-04: `create_game` hardens weapon/level/bombs/god but not `seed`/`stress`

**File:** `src/scorched_web/entrypoint.py:19-20`
**Issue:** `int(opts.get("seed", 1))` and `int(opts.get("stress", 0))` raise on `None`, a non-numeric string, NaN or infinity, while the surrounding code treats the options as untrusted ("the URL is untrusted input"). Today `url_flags.js` always passes a finite clamped integer for `stress` and a literal `1` for `seed`, so it is not reachable, but the Python layer's guarantee is inconsistent with its own docstrings and a future caller (or a changed flag grammar) turns a bad URL into a load-time error panel.
**Fix:** Route both through the same `_bounded_int(value, default, lo, hi)` helper used by `_level` and `_bombs`.

### IN-05: `?god` (and the other test flags) ship to every player

**File:** `web/src/boot/url_flags.js:49-57`, `src/scorched_core/game/game.py:226`
**Issue:** `?god` makes the ship ignore all hits and `?bombs=7&level=5&weapon=...` grant a full loadout, in the public production build. For a link-shared hobby game this is acceptable, but Phase 3 adds scoring and high scores in `localStorage`; any score recorded under these flags would be meaningless. Worth deciding now whether scoring must be disabled (or not persisted) when any test flag is active.
**Fix:** Expose a `cheats` boolean from the manifest/header and have Phase 3 skip score persistence when set.

### IN-06: Small per-frame allocations remain in the JS frame loop

**File:** `web/src/render/terrain_ring.js:38-47` (`chunkLayout` builds an array of 4 objects every frame), `web/src/input/touch_input.js:62` and `web/src/input/input_sampler.js:24-37` (a result object per sample, plus `{ ...getMapperArgs(), dxPx, dyPx }` on every drag frame)
**Issue:** The project rule is no allocation in the frame loop. These are tiny and short-lived, but they run at display rate on the same thread as the Pyodide step and the debug stats will show them as GC noise on low-end phones.
**Fix:** Reuse a preallocated layout array/result objects (mutate in place), as `shake.offset(out)` and the instance updaters already do.

### IN-07: Pyodide proxy hygiene in the bridge

**File:** `web/src/python/python_bridge.js:33` and `:60-67`
**Issue:** `startGame` creates `pyodide.toPy(options)` and never destroys the proxy; `warmUp` only destroys `tick` on the success path (an exception inside the loop leaks it, though `game.destroy()` still runs). One-time and bounded, but the convention elsewhere in this file is to destroy every proxy.
**Fix:** Keep the `toPy` proxy in a variable and `destroy()` it after `create_game`; move `tick.destroy()` into the `finally`.

### IN-08: Test gaps that let CR-01 through, and a vacuous assertion

**File:** `tools/e2e/ground.spec.js` / `web/test/fx/wreck_ring.test.js` (counters only), `tools/e2e/bomb.spec.js:57`, `tools/perf_node.mjs:106`
**Issue:** (a) Nothing asserts that a wreck is actually drawn with a finite matrix (see CR-01). (b) `expect(BOMB_T).toBeGreaterThanOrEqual(0)` can never fail. (c) The perf gate always runs `god: true`, so the lethal-contact and death/respawn paths (`_lethal_contact`, `_on_death`, `spawn_guaranteed`, hitstop) are never inside the 3 ms measurement; the bomb path is covered by `--bomb`, the death path is not.
**Fix:** Add a finite-matrix assertion for wrecks; assert `BOMB_T` strictly between 0 and 1 while a bomb is in the air; add a perf run with `god` off (or a forced death every N ticks) so the death path is budgeted.

---

_Reviewed: 2026-10-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
