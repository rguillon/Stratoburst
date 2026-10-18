"""Game facade: owns the simulation, the packed channel buffers and the manifest."""

import math
import random
from array import array
from typing import Final

from scorched_core.clock.fixed_step_runner import FixedStepRunner
from scorched_core.clock.refresh_estimator import RefreshEstimator
from scorched_core.collision.circle_hits import resolve_shots_vs_enemies
from scorched_core.collision.ship_hits import (
    resolve_bodies_vs_ship,
    resolve_bullets_vs_ship,
    resolve_pickups_vs_ship,
)
from scorched_core.collision.uniform_grid import UniformGrid
from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.entities.pickup_kind import PickupKind
from scorched_core.entities.player_life import PlayerLife
from scorched_core.entities.player_phase import PlayerPhase
from scorched_core.entities.player_ship import PlayerShip
from scorched_core.events.event_ring import EventRing
from scorched_core.game.fault_mode import FAULT_TICK, FaultMode
from scorched_core.input.button import Button
from scorched_core.input.input_frame import InputFrame
from scorched_core.patterns.fire_pattern import FirePattern
from scorched_core.pools.bullet_pool import BulletPool
from scorched_core.pools.enemy_pool import EnemyPool
from scorched_core.pools.missile_pool import MissilePool
from scorched_core.pools.pickup_pool import PickupPool
from scorched_core.protocol import (
    BLAST_LARGE,
    BLAST_MEDIUM,
    BLAST_SMALL,
    EBULLET_GAME_CAP,
    EBULLET_MAX_CAP,
    EBULLET_MIN_CAP,
    EBULLET_STRIDE,
    ENEMY_CAP,
    ENEMY_STRIDE,
    EV_BOMB_DETONATE,
    EV_BOMB_LAUNCH,
    EV_DEATHBOMB_SAVE,
    EV_ENEMY_FIRE,
    EV_EXPLOSION,
    EV_HIT,
    EV_PICKUP,
    EV_PLAYER_DEATH,
    EV_PLAYER_HIT,
    EV_RESPAWN,
    EV_SFX,
    EV_SHOT,
    EVENT_CAP,
    EVENT_STRIDE,
    FLAG_FIRING,
    FLAG_PAUSED,
    H_ALPHA,
    H_BEAM_W,
    H_DEATHS,
    H_EBULLET_N,
    H_ENEMY_N,
    H_EVENT_DROPPED,
    H_EVENT_N,
    H_FLAGS,
    H_INVULN,
    H_KILLS,
    H_LEVEL,
    H_MAX_BONUS,
    H_MISSILE_N,
    H_PBULLET_N,
    H_PICKUP_N,
    H_PLAYER_PHASE,
    H_SCROLL_Y,
    H_SHIP_X,
    H_SHIP_Y,
    H_STEPS,
    H_STORM_HITS,
    H_STORM_N,
    H_TICK_COUNT,
    H_WEAPON,
    HEADER_LEN,
    MISSILE_CAP,
    MISSILE_STRIDE,
    PBULLET_CAP,
    PBULLET_STRIDE,
    PICKUP_CAP,
    PICKUP_STRIDE,
    PLAYFIELD_H,
    PLAYFIELD_W,
    PROTOCOL_VERSION,
)
from scorched_core.stages.gallery_spawner import GallerySpawner
from scorched_core.stages.terrain_scroll import TerrainScroll
from scorched_core.stress.bullet_storm import BulletStorm
from scorched_core.tuning import (
    ENEMY_GROUND,
    ENEMY_RADIUS,
    GRID_CELL,
    GROUND_SCROLL_RATIO,
    HITBOX_RADIUS,
    HOMING_DAMAGE,
    MAX_LEVEL,
    MISSILE_RADIUS,
    SCROLL_SPEED,
)
from scorched_core.weapons.homing_launcher import HomingLauncher
from scorched_core.weapons.laser_beam import LaserBeam
from scorched_core.weapons.pickup_outcome import PickupOutcome
from scorched_core.weapons.vulcan import Vulcan
from scorched_core.weapons.weapon_kind import WeaponKind
from scorched_core.weapons.weapon_loadout import WeaponLoadout

# Bolts and gameplay enemy bullets are culled once they are this far outside the playfield.
_MARGIN: Final = 16.0

_HEADER_SLOTS: dict[str, int] = {
    "STEPS": H_STEPS,
    "SCROLL_Y": H_SCROLL_Y,
    "ALPHA": H_ALPHA,
    "SHIP_X": H_SHIP_X,
    "SHIP_Y": H_SHIP_Y,
    "FLAGS": H_FLAGS,
    "PBULLET_N": H_PBULLET_N,
    "EBULLET_N": H_EBULLET_N,
    "ENEMY_N": H_ENEMY_N,
    "TICK_COUNT": H_TICK_COUNT,
    "STORM_HITS": H_STORM_HITS,
    "KILLS": H_KILLS,
    "EVENT_N": H_EVENT_N,
    "EVENT_DROPPED": H_EVENT_DROPPED,
    "WEAPON": H_WEAPON,
    "PICKUP_N": H_PICKUP_N,
    "LEVEL": H_LEVEL,
    "BEAM_W": H_BEAM_W,
    "MAX_BONUS": H_MAX_BONUS,
    "MISSILE_N": H_MISSILE_N,
    "STORM_N": H_STORM_N,
    "PLAYER_PHASE": H_PLAYER_PHASE,
    "INVULN": H_INVULN,
    "DEATHS": H_DEATHS,
}

_EVENT_KINDS: dict[str, int] = {
    "EXPLOSION": EV_EXPLOSION,
    "HIT": EV_HIT,
    "SHOT": EV_SHOT,
    "PICKUP": EV_PICKUP,
    "ENEMY_FIRE": EV_ENEMY_FIRE,
    "PLAYER_HIT": EV_PLAYER_HIT,
    "PLAYER_DEATH": EV_PLAYER_DEATH,
    "RESPAWN": EV_RESPAWN,
    "BOMB_LAUNCH": EV_BOMB_LAUNCH,
    "BOMB_DETONATE": EV_BOMB_DETONATE,
    "DEATHBOMB_SAVE": EV_DEATHBOMB_SAVE,
    "SFX": EV_SFX,
}

_FIRE_PATTERNS: dict[str, int] = {pattern.name: pattern.value for pattern in FirePattern}

_BLAST_CLASSES: dict[str, int] = {
    "SMALL": BLAST_SMALL,
    "MEDIUM": BLAST_MEDIUM,
    "LARGE": BLAST_LARGE,
}


class Game:
    """Pure simulation core; knows nothing about JS."""

    __slots__ = (
        "_ebullet_channel_cap",
        "_firing",
        "_move_x",
        "_move_y",
        "_on_pickup",
        "_runner",
        "_scratch",
        "buffers",
        "ebullet_cap",
        "ebullets",
        "enemies",
        "events",
        "fault",
        "gallery",
        "god",
        "grid",
        "homing",
        "input",
        "laser",
        "life",
        "loadout",
        "max_bonus",
        "missiles",
        "paused",
        "pbullets",
        "pickups",
        "refresh",
        "rng",
        "ship",
        "storm",
        "storm_hits",
        "storm_pool",
        "stress",
        "terrain",
        "tick_count",
        "vulcan",
    )

    def __init__(  # noqa: PLR0913 - keyword-only options, one per URL test flag
        self,
        *,
        seed: int = 1,
        stress: int = 0,
        fault: FaultMode = FaultMode.NONE,
        weapon: WeaponKind = WeaponKind.VULCAN,
        level: int = 1,
        god: bool = False,
    ) -> None:
        self.fault = fault
        self.god = god  # test flag: hits are ignored so automated runs are never disturbed
        self.rng = random.Random(seed)  # noqa: S311 - gameplay randomness, not security
        self.stress = min(max(stress, 0), EBULLET_MAX_CAP)
        self.ebullet_cap = min(EBULLET_MAX_CAP, max(EBULLET_MIN_CAP, self.stress))  # storm only
        self._ebullet_channel_cap = self.ebullet_cap + EBULLET_GAME_CAP  # storm, then gameplay
        self.ship = PlayerShip()
        self.life = PlayerLife()
        self.storm_pool = BulletPool(self.ebullet_cap)  # harmless stress load, never lethal
        self.ebullets = BulletPool(EBULLET_GAME_CAP)  # gameplay enemy bullets
        self.pbullets = BulletPool(PBULLET_CAP)
        self.loadout = WeaponLoadout(kind=weapon, level=min(max(level, 1), MAX_LEVEL))
        self.vulcan = Vulcan()
        self.homing = HomingLauncher()
        self.laser = LaserBeam()
        self.missiles = MissilePool()
        self.events = EventRing()
        self.enemies = EnemyPool()
        self.pickups = PickupPool()
        self.max_bonus = 0  # same-colour catches at the top level; scored in Phase 3 (D-06)
        self._on_pickup = self._collect_pickup  # bound once: no closure is built per step
        self.gallery = GallerySpawner()
        self.grid = UniformGrid(PLAYFIELD_W, PLAYFIELD_H, GRID_CELL, ENEMY_CAP)
        self._scratch = array("i", bytes(4 * ENEMY_CAP))
        self.storm = (
            BulletStorm(self.storm_pool, self.stress, self.rng) if self.stress > 0 else None
        )
        self.storm_hits = 0
        self.terrain = TerrainScroll()
        self.tick_count = 0
        self._firing = False
        self._move_x = 0.0
        self._move_y = 0.0
        self.refresh = RefreshEstimator()
        self.input = InputFrame()
        self.paused = False
        self._runner = FixedStepRunner(self._step)
        self.buffers: dict[str, array] = {
            "header": array("f", bytes(4 * HEADER_LEN)),
            "pbullets": array("f", bytes(4 * PBULLET_STRIDE * PBULLET_CAP)),
            "ebullets": array("f", bytes(4 * EBULLET_STRIDE * self._ebullet_channel_cap)),
            "enemies": array("f", bytes(4 * ENEMY_STRIDE * ENEMY_CAP)),
            "pickups": array("f", bytes(4 * PICKUP_STRIDE * PICKUP_CAP)),
            "missiles": array("f", bytes(4 * MISSILE_STRIDE * MISSILE_CAP)),
            "events": self.events.buf,
        }

    def manifest(self) -> dict[str, object]:
        """Describe the boundary layout so JS can allocate matching typed arrays."""
        return {
            "protocol": PROTOCOL_VERSION,
            "playfield": {"w": PLAYFIELD_W, "h": PLAYFIELD_H},
            "header": {"len": HEADER_LEN, "slots": dict(_HEADER_SLOTS)},
            "channels": {
                "pbullets": {"stride": PBULLET_STRIDE, "cap": PBULLET_CAP},
                "ebullets": {"stride": EBULLET_STRIDE, "cap": self._ebullet_channel_cap},
                "enemies": {"stride": ENEMY_STRIDE, "cap": ENEMY_CAP},
                "pickups": {"stride": PICKUP_STRIDE, "cap": PICKUP_CAP},
                "missiles": {"stride": MISSILE_STRIDE, "cap": MISSILE_CAP},
                "events": {"stride": EVENT_STRIDE, "cap": EVENT_CAP},
            },
            "flags": {"PAUSED": FLAG_PAUSED, "FIRING": FLAG_FIRING},
            "buttons": {b.name: b.value for b in Button},
            "events": dict(_EVENT_KINDS),
            "blast": dict(_BLAST_CLASSES),
            "fire_patterns": dict(_FIRE_PATTERNS),
            "enemy_kinds": {kind.name: kind.value for kind in EnemyKind},
            "pickup_kinds": {kind.name: kind.value for kind in PickupKind},
            "weapons": {kind.name: kind.value for kind in WeaponKind},
            "outcomes": {outcome.name: outcome.value for outcome in PickupOutcome},
            "phases": {phase.name: phase.value for phase in PlayerPhase},
            "tuning": {
                "scroll_speed": SCROLL_SPEED,
                "hitbox_radius": HITBOX_RADIUS,
                "ground_scroll_ratio": GROUND_SCROLL_RATIO,
                "enemy_ground": [int(ground) for ground in ENEMY_GROUND],
                "enemy_radius": list(ENEMY_RADIUS),
            },
        }

    def set_paused(self, paused: bool) -> None:
        """Pause or resume. Resuming forgets all owed time so nothing jumps (PLAT-08)."""
        if paused == self.paused:
            return
        self.paused = paused
        if not paused:
            self._runner.reset()
            self.refresh.reset()
            self.input.settle()  # a PAUSE bit still held from before is not a new press
            self.ship.pending_x = 0.0  # the ship must not drift on drag owed from before
            self.ship.pending_y = 0.0
        self.buffers["header"][H_FLAGS] = self._flags()

    def tick(  # noqa: PLR0913, PLR0917 - frozen boundary signature (RESEARCH Pattern 2)
        self,
        dt_ms: float,
        buttons: int,
        move_x: float,
        move_y: float,
        drag_x: float,
        drag_y: float,
    ) -> int:
        """Advance the simulation by ``dt_ms`` and pack the header; return steps run."""
        self.events.clear()  # events live for one call only: never replayed (Pitfall 2)
        self.input.update(buttons)
        if self.input.pressed(Button.PAUSE):
            self.set_paused(not self.paused)
        # BOMB is accepted and unused in Phase 1 (D-11 reserves the key).
        self._firing = bool(buttons & Button.FIRE)
        if self.paused:
            # Time, drag and the refresh history stay untouched until the player resumes.
            self._pack_header(0)
            return 0
        self._move_x = move_x
        self._move_y = move_y
        # Queued once per call, so a frame that runs several steps still moves by the finger
        # distance only once; a frame that runs none keeps it for the next call.
        if drag_x or drag_y:
            self.ship.add_drag(drag_x, drag_y)
        if not math.isfinite(dt_ms) or dt_ms < 0.0:
            dt_ms = 0.0  # a bad rAF delta is "no time passed", never a frozen or crashed sim
        steps = self._runner.advance(self.refresh.snap(dt_ms))
        self._pack_header(steps)
        if steps > 0:
            self.pbullets.pack_into(self.buffers["pbullets"], 0.0)
            self.enemies.pack_into(self.buffers["enemies"])
            self.pickups.pack_into(self.buffers["pickups"])
            self.missiles.pack_into(self.buffers["missiles"])
            self.storm_pool.pack_into(self.buffers["ebullets"], 1.0)
            self.ebullets.pack_into(self.buffers["ebullets"], 1.0, offset=self.storm_pool.n)
        return steps

    def _flags(self) -> int:
        return (FLAG_PAUSED if self.paused else 0) | (FLAG_FIRING if self._firing else 0)

    def _pack_header(self, steps: int) -> None:
        header = self.buffers["header"]
        header[H_STEPS] = steps
        header[H_ALPHA] = self._runner.alpha
        header[H_SCROLL_Y] = self.terrain.distance
        header[H_SHIP_X] = self.ship.x
        header[H_SHIP_Y] = self.ship.y
        header[H_FLAGS] = self._flags()
        header[H_TICK_COUNT] = self.tick_count
        header[H_PBULLET_N] = self.pbullets.n
        header[H_ENEMY_N] = self.enemies.n
        header[H_PICKUP_N] = self.pickups.n
        header[H_MISSILE_N] = self.missiles.n
        header[H_KILLS] = self.enemies.kills
        header[H_EBULLET_N] = self.storm_pool.n + self.ebullets.n
        header[H_STORM_N] = self.storm_pool.n
        header[H_STORM_HITS] = self.storm_hits
        header[H_EVENT_N] = self.events.n
        header[H_EVENT_DROPPED] = self.events.dropped
        header[H_WEAPON] = int(self.loadout.kind)
        header[H_LEVEL] = self.loadout.level
        header[H_BEAM_W] = self.laser.half_width
        header[H_MAX_BONUS] = self.max_bonus
        header[H_PLAYER_PHASE] = int(self.life.phase)
        header[H_INVULN] = self.life.invuln
        header[H_DEATHS] = self.life.deaths

    def _drop_crystals(self) -> None:
        """Spawn a crystal at the position of every enemy killed this step that drops one."""
        enemies = self.enemies
        for k in range(enemies.kill_n):
            if enemies.kill_drop[k] == PickupKind.CRYSTAL:
                self.pickups.spawn_crystal(enemies.kill_x[k], enemies.kill_y[k])

    def _collect_pickup(self, kind: int, color: int, x: float, y: float) -> None:
        """Apply a caught pickup to the loadout and announce it as one PICKUP event.

        A BOMB is not a weapon colour; plan 02-26 adds its STOCKED path, and until then no BOMB
        pickup is ever spawned.
        """
        outcome = self.loadout.collect(WeaponKind(color))
        if outcome is PickupOutcome.MAXED:
            self.max_bonus += 1  # D-06: recorded now, the points are awarded in Phase 3
        self.events.push(EV_PICKUP, x, y, kind, outcome, color)

    def _lethal_contact(self) -> bool:
        """Return whether a gameplay enemy bullet or an air enemy body touches the hitbox core.

        Storm bullets are never checked here: the ``?stress`` load is harmless by design.
        """
        ship = self.ship
        return resolve_bullets_vs_ship(
            self.ebullets, ship.x, ship.y, HITBOX_RADIUS
        ) or resolve_bodies_vs_ship(self.enemies, ship.x, ship.y, HITBOX_RADIUS)

    def _step(self) -> None:
        self.terrain.step()
        life = self.life
        life.step(self.ship, self.events)
        if life.can_control:
            self.ship.step(self._move_x, self._move_y)
        else:
            self.ship.pending_x = 0.0  # drag owed while dying must not lurch the new ship
            self.ship.pending_y = 0.0
        firing = self._firing and life.can_fire
        self.vulcan.step(
            firing and self.loadout.kind is WeaponKind.VULCAN,
            self.ship.x,
            self.ship.y,
            self.loadout.level,
            self.pbullets,
            self.events,
        )
        self.homing.step(
            firing and self.loadout.kind is WeaponKind.HOMING,
            self.ship.x,
            self.ship.y,
            self.loadout.level,
            self.missiles,
            self.enemies,
            self.events,
        )
        self.pbullets.integrate()
        self.pbullets.cull_outside(-_MARGIN, -_MARGIN, PLAYFIELD_W + _MARGIN, PLAYFIELD_H + _MARGIN)
        self.ebullets.integrate()
        self.ebullets.cull_outside(-_MARGIN, -_MARGIN, PLAYFIELD_W + _MARGIN, PLAYFIELD_H + _MARGIN)
        self.gallery.step(self.enemies)
        self.enemies.step(self.ship.x, self.ship.y)
        self.enemies.fire(self.ebullets, self.ship.x, self.ship.y, self.events)
        self.missiles.steer(self.enemies)
        self.grid.rebuild(self.enemies.x, self.enemies.y, self.enemies.n)
        self.laser.step(
            firing and self.loadout.kind is WeaponKind.LASER,
            self.ship.x,
            self.ship.y,
            self.loadout.level,
            self.enemies,
            self.events,
        )
        resolve_shots_vs_enemies(
            self.pbullets, self.enemies, self.grid, self._scratch, 1, self.events
        )
        resolve_shots_vs_enemies(
            self.missiles,
            self.enemies,
            self.grid,
            self._scratch,
            HOMING_DAMAGE[self.loadout.level - 1],
            self.events,
            radius=MISSILE_RADIUS,
        )
        self.enemies.remove_dead(self.events)
        self._drop_crystals()
        self.pickups.step()
        if life.can_control:
            resolve_pickups_vs_ship(self.pickups, self.ship.x, self.ship.y, self._on_pickup)
        if life.vulnerable and not self.god and self._lethal_contact():
            life.hit(self.ship.x, self.ship.y, self.events)
        if self.storm is not None:
            self.storm_hits += self.storm.step(self.ship.x, self.ship.y, HITBOX_RADIUS)
        self.tick_count += 1
        # Proves the error panel (PLAT-09): the JS fault mode is injected on the JS side only.
        if self.fault is FaultMode.PY and self.tick_count == FAULT_TICK:
            msg = f"Injected Python fault (?crash=py) at tick {FAULT_TICK}"
            raise RuntimeError(msg)
