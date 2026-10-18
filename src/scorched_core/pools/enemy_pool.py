"""Struct-of-arrays pool of gallery enemies: spawn, sway, hit flash, kills, swap-remove."""

import math
from array import array
from dataclasses import dataclass, field
from typing import Final

from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.entities.motion_kind import MotionKind
from scorched_core.events.event_ring import EventRing
from scorched_core.patterns.bullet_patterns import fire_aimed, fire_ring
from scorched_core.patterns.fire_pattern import FirePattern
from scorched_core.pools.bullet_pool import BulletPool
from scorched_core.protocol import (
    ENEMY_CAP,
    ENEMY_STRIDE,
    EV_ENEMY_FIRE,
    EV_EXPLOSION,
    EV_HIT,
    PLAYFIELD_H,
    PLAYFIELD_W,
)
from scorched_core.tuning import (
    ENEMY_BLAST,
    ENEMY_BULLET_SPEED,
    ENEMY_EXIT_MARGIN,
    ENEMY_FIRE_DELAY,
    ENEMY_FIRE_INTERVAL,
    ENEMY_FIRE_MAX_Y,
    ENEMY_FIRE_PATTERN,
    ENEMY_FLASH_TICKS,
    ENEMY_GROUND,
    ENEMY_HP,
    ENEMY_MAX_ALIVE,
    ENEMY_RADIUS,
    ENEMY_RING_COUNT,
    ENEMY_SWAY,
    ENEMY_SWAY_PERIOD,
    GROUND_SCROLL_RATIO,
    HOVER_DRIFT,
    HOVER_DRIFT_PERIOD,
    HOVER_EXIT_SPEED,
    HOVER_HOLD_TICKS,
    HOVER_STOP_Y,
    SCROLL_SPEED,
)

_RING_HALF_STEP: Final = math.pi / ENEMY_RING_COUNT  # alternate rings sit between each other
_PHASE_STEP: Final = math.tau / ENEMY_SWAY_PERIOD
_HOVER_PHASE_STEP: Final = math.tau / HOVER_DRIFT_PERIOD
_GROUND_SCROLL: Final = SCROLL_SPEED * GROUND_SCROLL_RATIO  # terrain-anchored: 0.752 per step
_AIMING: Final = (EnemyKind.TANK, EnemyKind.TURRET)  # kinds whose turret tracks the ship
_EXIT_BOTTOM: Final = PLAYFIELD_H + ENEMY_EXIT_MARGIN
_EXIT_LEFT: Final = -2.0 * ENEMY_EXIT_MARGIN
_EXIT_RIGHT: Final = PLAYFIELD_W + 2.0 * ENEMY_EXIT_MARGIN


@dataclass(slots=True)
class EnemyPool:
    """Up to ``ENEMY_MAX_ALIVE`` live enemies in preallocated ``ENEMY_CAP`` columns.

    Removal swaps the last live enemy into the freed slot, so slot order carries no meaning;
    the ``uid`` column is the stable identity (strictly increasing, never reused). Enemies
    destroyed by ``remove_dead`` are also written to the kill buffer for this step's drops.
    """

    x: array = field(init=False)
    y: array = field(init=False)
    vx: array = field(init=False)
    vy: array = field(init=False)
    base_x: array = field(init=False)
    phase: array = field(init=False)
    angle: array = field(init=False)
    radius: array = field(init=False)
    aux: array = field(init=False)
    kind: array = field(init=False)
    motion: array = field(init=False)
    timer: array = field(init=False)
    hp: array = field(init=False)
    flash: array = field(init=False)
    uid: array = field(init=False)
    drop: array = field(init=False)
    age: array = field(init=False)
    fire_timer: array = field(init=False)
    kill_x: array = field(init=False)
    kill_y: array = field(init=False)
    kill_kind: array = field(init=False)
    kill_drop: array = field(init=False)
    n: int = field(default=0, init=False)
    kill_n: int = field(default=0, init=False)
    kills: int = field(default=0, init=False)
    _next_uid: int = field(default=1, init=False, repr=False)

    def __post_init__(self) -> None:
        zeros = bytes(4 * ENEMY_CAP)
        self.x = array("f", zeros)
        self.y = array("f", zeros)
        self.vx = array("f", zeros)
        self.vy = array("f", zeros)
        self.base_x = array("f", zeros)
        self.phase = array("f", zeros)
        self.angle = array("f", zeros)
        self.radius = array("f", zeros)
        self.aux = array("f", zeros)
        self.kind = array("i", zeros)
        self.motion = array("i", zeros)
        self.timer = array("i", zeros)
        self.hp = array("i", zeros)
        self.flash = array("i", zeros)
        self.uid = array("i", zeros)
        self.drop = array("i", zeros)
        self.age = array("i", zeros)
        self.fire_timer = array("i", zeros)
        self.kill_x = array("f", zeros)
        self.kill_y = array("f", zeros)
        self.kill_kind = array("i", zeros)
        self.kill_drop = array("i", zeros)

    def spawn(  # noqa: PLR0913, PLR0917 - a spawn is a kind, a position, a motion, a velocity, a drop
        self,
        kind: int,
        x: float,
        y: float,
        motion: int,
        vx: float,
        vy: float,
        drop: int = -1,
    ) -> bool:
        """Add an enemy of ``kind``; return False when ``ENEMY_MAX_ALIVE`` are already alive.

        ``motion`` is a ``MotionKind``; a HOVER enemy starts with its full hold timer.
        """
        i = self.n
        if i >= ENEMY_MAX_ALIVE:
            return False
        self.x[i] = x
        self.y[i] = y
        self.vx[i] = vx
        self.vy[i] = vy
        self.base_x[i] = x
        self.phase[i] = 0.0
        self.angle[i] = 0.0
        self.radius[i] = ENEMY_RADIUS[kind]
        self.aux[i] = 0.0
        self.kind[i] = kind
        self.motion[i] = motion
        self.timer[i] = HOVER_HOLD_TICKS if motion == MotionKind.HOVER else 0
        self.hp[i] = ENEMY_HP[kind]
        self.flash[i] = 0
        self.uid[i] = self._next_uid
        self.drop[i] = drop
        self.age[i] = 0
        self.fire_timer[i] = ENEMY_FIRE_DELAY
        self._next_uid += 1
        self.n = i + 1
        return True

    def step(self, ship_x: float, ship_y: float, ground_scroll: float = _GROUND_SCROLL) -> None:
        """Advance one 60 Hz step by each enemy's motion, aim turrets and decay the hit flash.

        SWAY sways down the screen facing its heading. DIVE flies a straight line facing it.
        HOVER descends to ``HOVER_STOP_Y``, holds
        there drifting side to side, then leaves downward, always facing the player (angle 0).
        GROUND moves by ``ground_scroll`` (the terrain speed times the ground ratio) plus its own
        crawl, so a ground unit stays anchored while the scroll slows down.
        Enemies that left the playfield alive are removed with neither a kill nor an event.
        """
        x, y, vx, vy, base_x = self.x, self.y, self.vx, self.vy, self.base_x
        phase, angle, flash, age = self.phase, self.angle, self.flash, self.age
        motion, timer, kind, aux = self.motion, self.timer, self.kind, self.aux
        for i in range(self.n - 1, -1, -1):
            age[i] += 1
            match motion[i]:
                case MotionKind.SWAY:
                    previous_x = x[i]
                    y[i] += vy[i]
                    base_x[i] += vx[i]
                    phase[i] += _PHASE_STEP
                    x[i] = base_x[i] + ENEMY_SWAY * math.sin(phase[i])
                    angle[i] = math.atan2(x[i] - previous_x, vy[i])
                case MotionKind.DIVE:
                    x[i] += vx[i]
                    y[i] += vy[i]
                    angle[i] = math.atan2(vx[i], vy[i])
                case MotionKind.HOVER:
                    base_x[i] += vx[i]
                    if timer[i] == HOVER_HOLD_TICKS and y[i] < HOVER_STOP_Y:
                        y[i] = min(y[i] + vy[i], HOVER_STOP_Y)
                    elif timer[i] > 0:
                        timer[i] -= 1
                        phase[i] += _HOVER_PHASE_STEP
                    else:
                        y[i] += HOVER_EXIT_SPEED
                    x[i] = base_x[i] + HOVER_DRIFT * math.sin(phase[i])
                case MotionKind.GROUND:
                    x[i] += vx[i]
                    y[i] += ground_scroll + vy[i]
                    angle[i] = math.atan2(vx[i], vy[i])
                case unknown:
                    msg = f"unknown motion {unknown} on enemy slot {i}"
                    raise ValueError(msg)
            if y[i] > _EXIT_BOTTOM or x[i] < _EXIT_LEFT or x[i] > _EXIT_RIGHT:
                self._remove_at(i)
                continue
            if kind[i] in _AIMING:
                aux[i] = math.atan2(ship_x - x[i], ship_y - y[i])
            if flash[i] > 0:
                flash[i] -= 1

    def fire(self, bullets: BulletPool, ship_x: float, ship_y: float, events: EventRing) -> int:
        """Count every enemy's fire timer down and shoot into ``bullets``; return bullets spawned.

        A timer starts at ``ENEMY_FIRE_DELAY`` and counts one per call. An enemy whose timer ran
        out fires its kind's pattern (``ENEMY_FIRE_PATTERN``) and reloads from
        ``ENEMY_FIRE_INTERVAL``, but only inside the screen band, from the top edge down to
        ``ENEMY_FIRE_MAX_Y``: outside it the timer stays at zero and the shot is held until the
        enemy enters the band. A volley the pool cannot hold spawns what fits. Each volley that
        spawned anything pushes one low-priority ENEMY_FIRE event (x, y, a = fire pattern).
        """
        x, y, kind, timer = self.x, self.y, self.kind, self.fire_timer
        total = 0
        for i in range(self.n):
            if timer[i] > 0:
                timer[i] -= 1
                if timer[i] > 0:
                    continue
            if y[i] < 0.0 or y[i] > ENEMY_FIRE_MAX_Y:
                continue
            pattern = ENEMY_FIRE_PATTERN[kind[i]]
            match pattern:
                case FirePattern.NONE:
                    continue
                case FirePattern.AIMED:
                    spawned = fire_aimed(
                        bullets, x[i], y[i], ship_x, ship_y, ENEMY_BULLET_SPEED[kind[i]]
                    )
                case FirePattern.RING:
                    volley = self.age[i] // ENEMY_FIRE_INTERVAL[kind[i]]
                    spawned = fire_ring(
                        bullets,
                        x[i],
                        y[i],
                        ENEMY_RING_COUNT,
                        ENEMY_BULLET_SPEED[kind[i]],
                        volley % 2 * _RING_HALF_STEP,
                    )
                case unknown:
                    msg = f"unknown fire pattern {unknown} on enemy slot {i}"
                    raise ValueError(msg)
            timer[i] = ENEMY_FIRE_INTERVAL[kind[i]]
            if spawned:
                events.push(EV_ENEMY_FIRE, x[i], y[i], pattern, low=True)
                total += spawned
        return total

    def index_of_uid(self, uid: int) -> int:
        """Return the live slot of the enemy with ``uid``, or -1 when it is gone.

        Slots move on every swap-remove, so anything that tracks an enemy over time (a homing
        missile) holds the uid and looks the slot up again each step. The scan is bounded by
        ``ENEMY_MAX_ALIVE`` and allocates nothing.
        """
        uids = self.uid
        for i in range(self.n):
            if uids[i] == uid:
                return i
        return -1

    def apply_hit(self, i: int, damage: int, events: EventRing) -> None:
        """Deal ``damage`` to enemy ``i`` and flash it.

        A hit on a resting enemy that survives pushes one low-priority HIT event (D-28: one
        spark burst per flash window, merged at the source). A killing blow pushes none: the
        EXPLOSION from ``remove_dead`` already covers it.
        """
        resting = self.flash[i] == 0
        self.hp[i] -= damage
        if resting and self.hp[i] > 0:
            events.push(EV_HIT, self.x[i], self.y[i], self.kind[i], low=True)
        self.flash[i] = ENEMY_FLASH_TICKS

    def remove_dead(self, events: EventRing) -> None:
        """Remove every enemy at or below zero HP: one EXPLOSION, one kill-buffer entry each."""
        self.kill_n = 0
        hp = self.hp
        for i in range(self.n - 1, -1, -1):
            if hp[i] <= 0:
                kind = self.kind[i]
                events.push(
                    EV_EXPLOSION, self.x[i], self.y[i], ENEMY_BLAST[kind], ENEMY_GROUND[kind], kind
                )
                k = self.kill_n
                self.kill_x[k] = self.x[i]
                self.kill_y[k] = self.y[i]
                self.kill_kind[k] = kind
                self.kill_drop[k] = self.drop[i]
                self.kill_n = k + 1
                self._remove_at(i)
                self.kills += 1

    def pack_into(self, out: array) -> None:
        """Write ``x, y, angle, flash, hp, kind, aux, spare`` at stride 8 for live enemies."""
        for i in range(self.n):
            base = i * ENEMY_STRIDE
            kind = self.kind[i]
            out[base] = self.x[i]
            out[base + 1] = self.y[i]
            out[base + 2] = self.angle[i]
            out[base + 3] = self.flash[i] / ENEMY_FLASH_TICKS
            out[base + 4] = self.hp[i] / ENEMY_HP[kind]
            out[base + 5] = kind
            out[base + 6] = self.aux[i]
            out[base + 7] = 0.0

    def _remove_at(self, i: int) -> None:
        last = self.n - 1
        if i != last:
            self.x[i] = self.x[last]
            self.y[i] = self.y[last]
            self.vx[i] = self.vx[last]
            self.vy[i] = self.vy[last]
            self.base_x[i] = self.base_x[last]
            self.phase[i] = self.phase[last]
            self.angle[i] = self.angle[last]
            self.radius[i] = self.radius[last]
            self.aux[i] = self.aux[last]
            self.kind[i] = self.kind[last]
            self.motion[i] = self.motion[last]
            self.timer[i] = self.timer[last]
            self.hp[i] = self.hp[last]
            self.flash[i] = self.flash[last]
            self.uid[i] = self.uid[last]
            self.drop[i] = self.drop[last]
            self.age[i] = self.age[last]
            self.fire_timer[i] = self.fire_timer[last]
        self.n = last
