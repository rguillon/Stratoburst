"""Game facade: owns the simulation, the packed channel buffers and the manifest."""

import math
import random
from array import array
from typing import Final

from scorched_core.audio.sfx_id import SfxId
from scorched_core.audio.sfx_router import route_sfx
from scorched_core.clock.fixed_step_runner import FixedStepRunner
from scorched_core.clock.hitstop import Hitstop
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
    BLAST_HUGE,
    BLAST_LARGE,
    BLAST_MEDIUM,
    BLAST_SMALL,
    CITY_STRIDE,
    EBULLET_GAME_CAP,
    EBULLET_MAX_CAP,
    EBULLET_MIN_CAP,
    EBULLET_STRIDE,
    ENEMY_CAP,
    ENEMY_STRIDE,
    EV_BOMB_DETONATE,
    EV_BOMB_LAUNCH,
    EV_BOSS_DEFEATED,
    EV_BOSS_PHASE,
    EV_BOSS_RETREAT,
    EV_BOSS_WARNING,
    EV_DEATHBOMB_SAVE,
    EV_ENEMY_FIRE,
    EV_EXPLOSION,
    EV_EXTEND,
    EV_GAME_OVER,
    EV_HIT,
    EV_MEDAL,
    EV_PART_DESTROYED,
    EV_PICKUP,
    EV_PLAYER_DEATH,
    EV_PLAYER_HIT,
    EV_RESPAWN,
    EV_SFX,
    EV_SHOT,
    EV_STAGE_CLEAR,
    EV_STAGE_START,
    EV_TALLY_LINE,
    EVENT_CAP,
    EVENT_STRIDE,
    FLAG_FIRING,
    FLAG_PAUSED,
    H_ALPHA,
    H_BEAM_W,
    H_BOMB_PHASE,
    H_BOMB_T,
    H_BOMB_X,
    H_BOMB_Y,
    H_BOMBS,
    H_BOSS_ACTIVE,
    H_BOSS_HP,
    H_BOSS_PHASE,
    H_BOSS_TIMER_S,
    H_DEATHS,
    H_EBULLET_N,
    H_ENEMY_N,
    H_EVENT_DROPPED,
    H_EVENT_N,
    H_FLAGS,
    H_FLOW,
    H_FLOW_T,
    H_HIGH_SCORE,
    H_HITSTOP,
    H_INVULN,
    H_KILLS,
    H_LEVEL,
    H_LIVES,
    H_MAX_BONUS,
    H_MEDAL_CHAIN,
    H_MEDAL_VALUE,
    H_MISSILE_N,
    H_NEW_RECORD,
    H_PBULLET_N,
    H_PICKUP_N,
    H_PLAYER_PHASE,
    H_SCORE,
    H_SCROLL_RATE,
    H_SCROLL_Y,
    H_SHIP_X,
    H_SHIP_Y,
    H_STAGE,
    H_STAGE_DIST,
    H_STEPS,
    H_STORM_HITS,
    H_STORM_N,
    H_TALLY_BOMBS,
    H_TALLY_BOSS,
    H_TALLY_MEDALS,
    H_TALLY_N,
    H_TALLY_NO_MISS,
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
from scorched_core.scoring.medal_chain import MedalChain
from scorched_core.scoring.score_keeper import ScoreKeeper
from scorched_core.stages.flow_state import FlowState
from scorched_core.stages.gallery_spawner import GallerySpawner
from scorched_core.stages.scenery_kind import SceneryKind
from scorched_core.stages.stage_1 import STAGE_1
from scorched_core.stages.stage_data import StageData
from scorched_core.stages.stage_director import StageDirector
from scorched_core.stages.stage_flow import StageFlow
from scorched_core.stages.terrain_scroll import TerrainScroll
from scorched_core.stress.bullet_storm import BulletStorm
from scorched_core.tuning import (
    AT_LEAD,
    BOMB_BLAST_TICKS,
    BOMB_DROP_VY,
    BOMB_GROW_TICKS,
    BOMB_INVULN_TAIL_TICKS,
    BOMB_LAUNCH_TICKS,
    BOMB_MAX_STOCK,
    BOMB_RADIUS_MAX,
    BOMB_RADIUS_MIN,
    BOMB_START_STOCK,
    CITY_BLOCK,
    CITY_PITCH,
    ENEMY_GROUND,
    ENEMY_POINTS,
    ENEMY_RADIUS,
    ENEMY_WRECK,
    GRID_CELL,
    GROUND_SCROLL_RATIO,
    GROUND_Y0,
    HITBOX_RADIUS,
    HITSTOP_BOMB_TICKS,
    HITSTOP_DEATH_TICKS,
    HOMING_DAMAGE,
    LIVES_CAP,
    LIVES_START,
    MAX_BONUS_POINTS,
    MAX_LEVEL,
    MISSILE_RADIUS,
    PICKUP_RADIUS,
    RECOVERY_BOTTOM_MARGIN,
    RECOVERY_MARGIN,
    RECOVERY_VY,
    SCROLL_SPEED,
)
from scorched_core.weapons.bomb import Bomb
from scorched_core.weapons.bomb_phase import BombPhase
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
    "HITSTOP": H_HITSTOP,
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
    "BOMBS": H_BOMBS,
    "BOMB_PHASE": H_BOMB_PHASE,
    "BOMB_X": H_BOMB_X,
    "BOMB_Y": H_BOMB_Y,
    "BOMB_T": H_BOMB_T,
    "SCORE": H_SCORE,
    "HIGH_SCORE": H_HIGH_SCORE,
    "LIVES": H_LIVES,
    "FLOW": H_FLOW,
    "FLOW_T": H_FLOW_T,
    "STAGE": H_STAGE,
    "STAGE_DIST": H_STAGE_DIST,
    "SCROLL_RATE": H_SCROLL_RATE,
    "BOSS_ACTIVE": H_BOSS_ACTIVE,
    "BOSS_PHASE": H_BOSS_PHASE,
    "BOSS_HP": H_BOSS_HP,
    "BOSS_TIMER_S": H_BOSS_TIMER_S,
    "MEDAL_VALUE": H_MEDAL_VALUE,
    "MEDAL_CHAIN": H_MEDAL_CHAIN,
    "TALLY_BOSS": H_TALLY_BOSS,
    "TALLY_MEDALS": H_TALLY_MEDALS,
    "TALLY_NO_MISS": H_TALLY_NO_MISS,
    "TALLY_BOMBS": H_TALLY_BOMBS,
    "TALLY_N": H_TALLY_N,
    "NEW_RECORD": H_NEW_RECORD,
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
    "MEDAL": EV_MEDAL,
    "EXTEND": EV_EXTEND,
    "PART_DESTROYED": EV_PART_DESTROYED,
    "BOSS_WARNING": EV_BOSS_WARNING,
    "BOSS_PHASE": EV_BOSS_PHASE,
    "BOSS_DEFEATED": EV_BOSS_DEFEATED,
    "BOSS_RETREAT": EV_BOSS_RETREAT,
    "STAGE_START": EV_STAGE_START,
    "STAGE_CLEAR": EV_STAGE_CLEAR,
    "TALLY_LINE": EV_TALLY_LINE,
    "GAME_OVER": EV_GAME_OVER,
}

_FIRE_PATTERNS: dict[str, int] = {pattern.name: pattern.value for pattern in FirePattern}

_BLAST_CLASSES: dict[str, int] = {
    "SMALL": BLAST_SMALL,
    "MEDIUM": BLAST_MEDIUM,
    "LARGE": BLAST_LARGE,
    "HUGE": BLAST_HUGE,
}


def _boss_manifest(stage: StageData) -> list[dict[str, object]]:
    """List the stage's fights for the boss bar: the slot, the name and the phase thresholds.

    ``phase_fracs`` are the hull-health fractions at which later phases start (the first phase,
    which starts at 1.0, is left out), so the bar can draw one tick mark per threshold.
    """
    fights = ((1, "midboss", stage.midboss), (2, "boss", stage.boss))
    return [
        {"slot": slot, "name": name, "phase_fracs": [phase.hp_frac for phase in spec.phases[1:]]}
        for slot, name, spec in fights
        if spec is not None
    ]


class Game:
    """Pure simulation core; knows nothing about JS."""

    __slots__ = (
        "_at",
        "_bomb_requested",
        "_ebullet_channel_cap",
        "_firing",
        "_move_x",
        "_move_y",
        "_on_pickup",
        "_runner",
        "_scratch",
        "_start_bombs",
        "_start_level",
        "_start_lives",
        "_start_weapon",
        "bomb",
        "buffers",
        "chain",
        "director",
        "ebullet_cap",
        "ebullets",
        "enemies",
        "events",
        "fault",
        "flow",
        "gallery",
        "god",
        "grid",
        "hitstop",
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
        "score",
        "ship",
        "stage",
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
        bombs: int = BOMB_START_STOCK,
        stage: StageData | None = None,
        at: str | None = None,
        high_score: int = 0,
        lives: int = LIVES_START,
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
        # What a restart returns to: the run's own starting options (D-28).
        self._start_weapon = weapon
        self._start_level = min(max(level, 1), MAX_LEVEL)
        self._start_bombs = min(max(bombs, 0), BOMB_MAX_STOCK)
        self._start_lives = min(max(lives, 1), LIVES_CAP)
        self._at = at
        self.loadout = WeaponLoadout(kind=weapon, level=self._start_level)
        self.vulcan = Vulcan()
        self.homing = HomingLauncher()
        self.laser = LaserBeam()
        self.bomb = Bomb(stock=self._start_bombs)
        self.hitstop = Hitstop()  # steps still frozen by a bomb detonation or a death (D-26)
        self._bomb_requested = False  # a press latched until a live step consumes it
        self.missiles = MissilePool()
        self.events = EventRing()
        self.enemies = EnemyPool()
        self.pickups = PickupPool()
        self.terrain = TerrainScroll()
        self.max_bonus = 0  # same-colour catches at the top level (D-06), each also paid in points
        self.chain = MedalChain()  # what the next medal pays and the catches in a row (D-15)
        self.score = ScoreKeeper(lives=self._start_lives, high_score=max(high_score, 0))
        self._on_pickup = self._collect_pickup  # bound once: no closure is built per step
        self.gallery = GallerySpawner()
        self.stage = stage
        self.director = StageDirector(stage) if stage is not None else None
        # The gallery has no run to lose (Phase 2 D-18): infinite lives and no flow.
        self.flow = (
            StageFlow(
                life=self.life,
                score=self.score,
                events=self.events,
                stage_number=stage.number,
                terrain=self.terrain,
                enemies=self.enemies,
                stage=stage,
            )
            if stage is not None
            else None
        )
        self.grid = UniformGrid(PLAYFIELD_W, PLAYFIELD_H, GRID_CELL, ENEMY_CAP)
        self._scratch = array("i", bytes(4 * ENEMY_CAP))
        self.storm = (
            BulletStorm(self.storm_pool, self.stress, self.rng) if self.stress > 0 else None
        )
        self.storm_hits = 0
        self._open_stage()
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

    def _jump_to_marker(self, name: str) -> None:
        """Start the stage ``AT_LEAD`` units before the marker ``name`` (the ``?at=`` jump, D-30).

        Every timeline row at or before the start is skipped. An unknown marker, or a marker with
        no stage to look it up in, is a ValueError: the timeline never shifts silently.
        """
        if self.stage is None or self.director is None:
            msg = f"cannot start at marker {name!r} without a stage"
            raise ValueError(msg)
        try:
            marker = self.stage.marker(name)
        except KeyError:
            msg = f"stage {self.stage.number} has no marker {name!r}"
            raise ValueError(msg) from None
        distance = max(0.0, marker - AT_LEAD)
        self.terrain.jump(distance)
        if distance > 0.0:  # a clamped start is the stage's own start: its first rows are kept
            self.director.jump(distance)

    def _open_stage(self) -> None:
        """Begin a stage run: jump to the ``?at=`` marker and fly the ship in (D-26, D-30).

        The intro fly-in grants no invulnerability, so the ship never blinks at stage start. The
        shooting gallery has no intro: its ship starts ALIVE at the start position.
        """
        if self._at is not None:
            self._jump_to_marker(self._at)
        if self.flow is not None:
            self.life.begin_fly_in(self.ship, 0)

    @property
    def save_requested(self) -> bool:
        """Return whether the run ended and the high score is waiting to be stored."""
        return self.flow is not None and self.flow.save_requested

    def clear_save_request(self) -> None:
        """Acknowledge a save request once the high score has been stored."""
        if self.flow is not None:
            self.flow.save_requested = False

    def restart(self) -> None:
        """Start a fresh run in place (D-28); the high score is kept as the new best at start.

        Score, lives, weapon, level and bombs return to their starting values, every pool is
        emptied, and the stage begins again from its start (or the ``?at=`` marker). The
        shooting gallery has no run to restart.
        """
        director, flow = self.director, self.flow
        if director is None or flow is None:
            msg = "the shooting gallery has no run to restart"
            raise ValueError(msg)
        self.events.clear()
        self.ship = PlayerShip()
        self.life.reset()
        self.score.reset_run(self._start_lives)
        self.loadout = WeaponLoadout(kind=self._start_weapon, level=self._start_level)
        self.bomb = Bomb(stock=self._start_bombs)
        self.vulcan.cooldown = 0
        self.homing.cooldown = 0
        self.laser.half_width = 0.0
        self.laser.timer = 0
        self.pbullets.clear()
        self.ebullets.clear()
        self.enemies.clear()
        self.enemies.kills = 0
        self.missiles.clear()
        self.pickups.clear()
        self.max_bonus = 0
        self.chain.miss()
        self.chain.stage_reset()
        self.hitstop.ticks = 0
        self._bomb_requested = False
        terrain = self.terrain
        terrain.distance = 0.0
        terrain.speed = terrain.target = SCROLL_SPEED
        director.reset()
        self._open_stage()
        flow.reset()
        self._pack_header(0)

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
            "sfx": {sfx.name: sfx.value for sfx in SfxId},
            "blast": dict(_BLAST_CLASSES),
            "fire_patterns": dict(_FIRE_PATTERNS),
            "enemy_kinds": {kind.name: kind.value for kind in EnemyKind},
            "pickup_kinds": {kind.name: kind.value for kind in PickupKind},
            "weapons": {kind.name: kind.value for kind in WeaponKind},
            "outcomes": {outcome.name: outcome.value for outcome in PickupOutcome},
            "phases": {phase.name: phase.value for phase in PlayerPhase},
            "bomb_phases": {phase.name: phase.value for phase in BombPhase},
            "flow_states": {state.name: state.value for state in FlowState},
            "scenery_kinds": {kind.name: kind.value for kind in SceneryKind},
            "stage": self._stage_manifest(),
            "tuning": {
                "scroll_speed": SCROLL_SPEED,
                "hitbox_radius": HITBOX_RADIUS,
                "ground_scroll_ratio": GROUND_SCROLL_RATIO,
                "ground_y0": GROUND_Y0,
                "enemy_ground": [int(ground) for ground in ENEMY_GROUND],
                "enemy_radius": list(ENEMY_RADIUS),
                "enemy_wreck": list(ENEMY_WRECK),
                "bomb_radius_min": BOMB_RADIUS_MIN,
                "bomb_radius_max": BOMB_RADIUS_MAX,
                "bomb_grow_ticks": BOMB_GROW_TICKS,
                "bomb_blast_ticks": BOMB_BLAST_TICKS,
            },
        }

    def _stage_manifest(self) -> dict[str, object]:
        """The stage the renderer plays: number, length, markers, city layout and whether it loops.

        The shooting gallery is stage 0: it loops, has no markers and borrows stage 1's length and
        city so it keeps a city under it. The city ships once here, never as a per-frame channel.
        """
        stage = self.stage
        layout: dict[str, object] = {
            "city_stride": CITY_STRIDE,
            "block_pitch": CITY_PITCH,
            "block_size": CITY_BLOCK,
        }
        if stage is None:
            return {
                "number": 0,
                "length": STAGE_1.length,
                "markers": {},
                "loop": True,
                "city": list(STAGE_1.placements),
                "bosses": [],
                **layout,
            }
        return {
            "number": stage.number,
            "length": stage.length,
            "markers": dict(stage.markers),
            "loop": False,
            "city": list(stage.placements),
            "bosses": _boss_manifest(stage),
            **layout,
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
            self._bomb_requested = False  # a press made while paused is not a bomb
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
        # The press edge is latched, not acted on: a frame that runs no step must not lose it
        # (RESEARCH Pitfall 1). The next live step consumes it; resuming discards a press made
        # while paused (set_paused), because the player was not playing.
        if self.input.pressed(Button.BOMB):
            self._bomb_requested = True
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
            self.pickups.medal_tier = self.chain.index
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
        header[H_SCROLL_RATE] = self.terrain.speed
        stage = self.stage
        header[H_STAGE] = 0 if stage is None else stage.number
        header[H_FLOW] = -1 if self.flow is None else int(self.flow.state)
        header[H_FLOW_T] = 0 if self.flow is None else self.flow.progress
        header[H_STAGE_DIST] = 0 if stage is None else self.terrain.distance
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
        header[H_HITSTOP] = self.hitstop.ticks
        header[H_WEAPON] = int(self.loadout.kind)
        header[H_LEVEL] = self.loadout.level
        header[H_BEAM_W] = self.laser.half_width
        header[H_MAX_BONUS] = self.max_bonus
        header[H_MEDAL_VALUE] = self.chain.value
        header[H_MEDAL_CHAIN] = self.chain.chain
        score = self.score
        header[H_SCORE] = score.score
        header[H_HIGH_SCORE] = score.high_score
        header[H_LIVES] = score.lives
        header[H_NEW_RECORD] = 1 if score.new_record else 0
        header[H_PLAYER_PHASE] = int(self.life.phase)
        header[H_INVULN] = self.life.invuln
        header[H_DEATHS] = self.life.deaths
        self._pack_boss_header(header)
        bomb = self.bomb
        header[H_BOMBS] = bomb.stock
        header[H_BOMB_PHASE] = int(bomb.phase)
        header[H_BOMB_X] = bomb.x
        header[H_BOMB_Y] = bomb.y
        header[H_BOMB_T] = bomb.progress

    def _pack_boss_header(self, header: array) -> None:
        """Write the boss slots: its slot number, phase, hull health and the last-seconds timer."""
        flow = self.flow
        boss = None if flow is None else flow.boss
        if boss is None:
            header[H_BOSS_ACTIVE] = 0
            header[H_BOSS_PHASE] = 0
            header[H_BOSS_HP] = 0
            header[H_BOSS_TIMER_S] = -1
            return
        header[H_BOSS_ACTIVE] = boss.slot
        header[H_BOSS_PHASE] = boss.phase_number
        header[H_BOSS_HP] = boss.hp_fraction
        header[H_BOSS_TIMER_S] = boss.seconds_left

    def _step_boss(self) -> None:
        """Advance the running boss fight, if any: after the director, before the enemies move."""
        flow = self.flow
        if flow is not None and flow.boss is not None:
            flow.boss.step(self.enemies, self.ebullets, self.ship.x, self.ship.y, self.events)

    def _settle_boss(self) -> None:
        """Resolve the boss's damage after every damage pass and before ``remove_dead`` (SCOR-01).

        A part shot off becomes a stump and a hull at zero starts its death sequence instead of
        being removed; what that pays (turret points, then the kill) goes through the score keeper.
        """
        flow = self.flow
        if flow is None or flow.boss is None:
            return
        boss = flow.boss
        points = boss.settle(self.enemies, self.ebullets, self.events, self.hitstop)
        if points:
            self.score.award(points, self.events, boss.spec.x, boss.spec.hold_y)

    def _settle_kills(self) -> None:
        """Remove the dead, then pay for them and drop what they carried."""
        self.enemies.remove_dead(self.events)
        self._award_kills()
        self._drop_pickups()

    def _award_kills(self) -> None:
        """Pay the fixed points of every enemy killed this step, at its kill position (SCOR-01)."""
        enemies = self.enemies
        for k in range(enemies.kill_n):
            kind, x, y = enemies.kill_kind[k], enemies.kill_x[k], enemies.kill_y[k]
            self.score.award(ENEMY_POINTS[kind], self.events, x, y)

    def _drop_pickups(self) -> None:
        """Spawn what every enemy killed this step drops at its kill position.

        A CRYSTAL is launched up and sideways; a BOMB (an AA turret's drop) just falls slowly; a
        MEDAL stays where it fell and drifts with the scroll (a refused spawn is simply lost).
        """
        enemies = self.enemies
        for k in range(enemies.kill_n):
            drop = enemies.kill_drop[k]
            if drop == PickupKind.CRYSTAL:
                self.pickups.spawn_crystal(enemies.kill_x[k], enemies.kill_y[k])
            elif drop == PickupKind.BOMB:
                self.pickups.spawn(
                    PickupKind.BOMB, enemies.kill_x[k], enemies.kill_y[k], 0.0, BOMB_DROP_VY
                )
            elif drop == PickupKind.MEDAL:
                self.pickups.spawn_medal(enemies.kill_x[k], enemies.kill_y[k])

    def _collect_medal(self, x: float, y: float) -> None:
        """Pay the chain value for a caught medal and announce it as one MEDAL event (D-15)."""
        value = self.chain.collect()
        self.score.award(value, self.events, x, y)
        self.events.push(EV_MEDAL, x, y, value, self.chain.chain)

    def _collect_pickup(self, kind: int, color: int, x: float, y: float) -> None:
        """Apply a caught pickup and announce it as one PICKUP event (a medal: one MEDAL event).

        A BOMB stocks one bomb up to ``BOMB_MAX_STOCK`` and is consumed even when the stock is
        full (STOCKED); every other kind is a weapon colour for the loadout.
        """
        if kind == PickupKind.MEDAL:
            self._collect_medal(x, y)
            return
        if kind == PickupKind.BOMB:
            bomb = self.bomb
            bomb.stock = min(bomb.stock + 1, BOMB_MAX_STOCK)
            outcome = PickupOutcome.STOCKED
        else:
            outcome = self.loadout.collect(WeaponKind(color))
            if outcome is PickupOutcome.MAXED:
                self.max_bonus += 1  # D-06: counted, and paid as a flat bonus
                self.score.award(MAX_BONUS_POINTS, self.events, x, y)
        self.events.push(EV_PICKUP, x, y, kind, outcome, color)

    def _on_death(self) -> None:
        """Cost the weapon its levels and leave a recovery pickup of its colour (PLYR-06).

        The pickup is guaranteed (it evicts the oldest when the pool is full), clamped inside the
        playfield and never cycles colour, so catching it is an ordinary +1 (D-04, D-05).
        """
        loadout = self.loadout
        loadout.penalize()
        edge = PICKUP_RADIUS + RECOVERY_MARGIN
        x = min(max(self.ship.x, edge), PLAYFIELD_W - edge)
        y = min(max(self.ship.y, edge), PLAYFIELD_H - RECOVERY_BOTTOM_MARGIN)
        self.pickups.spawn_guaranteed(PickupKind(int(loadout.kind)), x, y, 0.0, RECOVERY_VY)

    def _step_pickups(self) -> None:
        """Move the pickups, collect what the ship touches, then charge the medals that got away.

        The misses are drained after the catches, so a medal caught on the very step another one
        scrolls off pays its climbing value and the next one restarts at the base (D-15).
        """
        pickups = self.pickups
        pickups.step(self.terrain.speed * GROUND_SCROLL_RATIO)
        if self.life.can_control:
            resolve_pickups_vs_ship(pickups, self.ship.x, self.ship.y, self._on_pickup)
        if pickups.medals_missed:
            pickups.medals_missed = 0
            self.chain.miss()

    def _lethal_contact(self) -> bool:
        """Return whether a gameplay enemy bullet or an air enemy body touches the hitbox core.

        Storm bullets are never checked here: the ``?stress`` load is harmless by design.
        """
        ship = self.ship
        return resolve_bullets_vs_ship(
            self.ebullets, ship.x, ship.y, HITBOX_RADIUS
        ) or resolve_bodies_vs_ship(self.enemies, ship.x, ship.y, HITBOX_RADIUS)

    def _resolve_bomb_request(self) -> None:
        """Consume a latched bomb press: launch when allowed, and save a ship in its grace window.

        Resolved before ``life.step``, the call that lets the grace window expire: a press on the
        last grace step still saves the ship, a press one step later cannot (D-11).
        """
        if not self._bomb_requested:
            return
        self._bomb_requested = False  # consumed whether or not it launches
        life = self.life
        if life.can_control and self.bomb.try_launch(self.ship.x, self.ship.y):
            if life.try_deathbomb():
                self.events.push(EV_DEATHBOMB_SAVE, self.ship.x, self.ship.y)
            self.events.push(EV_BOMB_LAUNCH, self.ship.x, self.ship.y)
            life.grant_invuln(BOMB_LAUNCH_TICKS + BOMB_BLAST_TICKS + BOMB_INVULN_TAIL_TICKS)

    def _step_life(self) -> None:
        """Advance the player's life cycle; a confirmed death costs a life in stage mode.

        ``final`` is refreshed from the lives left before every step, so an extend earned at any
        point before the DYING window ends (including on the step the death is confirmed) sends
        the ship back in instead of out. The gallery never takes a life (Phase 2 D-18).
        """
        life = self.life
        was_dying = life.phase == PlayerPhase.DYING
        life.final = self.score.lives == 0
        if life.step(self.ship, self.events):
            self._on_death()
            self.chain.miss()  # D-16: dying restarts the medal chain
            self.hitstop.trigger(HITSTOP_DEATH_TICKS)  # only a confirmed death, never the grace
            if self.flow is not None:
                self.score.lose_life()
        if was_dying and life.phase == PlayerPhase.RESPAWN:
            self.bomb.stock = max(self.bomb.stock, BOMB_START_STOCK)  # D-10: a new life restocks

    def _step(self) -> None:
        # Hitstop (D-27): a frozen step does nothing at all, so no state moves and TICK_COUNT stays
        # put. The bomb press stays latched: it is resolved only after this gate.
        if self.hitstop.consume():
            return
        first = self.events.n  # the router reads only this step's events (D-29)
        self.terrain.step()
        life = self.life
        self._resolve_bomb_request()
        self._step_life()
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
        director, flow = self.director, self.flow
        if director is None or flow is None:
            self.gallery.step(self.enemies)
        elif flow.spawning:  # nothing new comes once the run is over
            director.step(self.terrain.distance, self.enemies)
        self._step_boss()
        self.enemies.step(self.ship.x, self.ship.y, self.terrain.speed * GROUND_SCROLL_RATIO)
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
        if self.bomb.step(self.enemies, self.ebullets, self.events):
            self.hitstop.trigger(HITSTOP_BOMB_TICKS)
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
        self._settle_boss()
        self._settle_kills()
        self._step_pickups()
        if life.vulnerable and not self.god and self._lethal_contact():
            life.hit(self.ship.x, self.ship.y, self.events)
        if flow is not None:
            flow.step()
        if self.storm is not None:
            self.storm_hits += self.storm.step(self.ship.x, self.ship.y, HITBOX_RADIUS)
        self.tick_count += 1
        route_sfx(self.events, first, self.events.n)
        # Proves the error panel (PLAT-09): the JS fault mode is injected on the JS side only.
        if self.fault is FaultMode.PY and self.tick_count == FAULT_TICK:
            msg = f"Injected Python fault (?crash=py) at tick {FAULT_TICK}"
            raise RuntimeError(msg)
