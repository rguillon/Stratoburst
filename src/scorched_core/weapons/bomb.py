"""Bomb: the Raiden nuke, a missile that rises, detonates and burns the screen clean (D-08)."""

from dataclasses import dataclass

from scorched_core.collision.area_hits import clear_bullets_in_radius, resolve_bomb_vs_enemies
from scorched_core.events.event_ring import EventRing
from scorched_core.pools.bullet_pool import BulletPool
from scorched_core.pools.enemy_pool import EnemyPool
from scorched_core.protocol import EV_BOMB_DETONATE
from scorched_core.tuning import (
    BOMB_BLAST_TICKS,
    BOMB_DAMAGE,
    BOMB_DAMAGE_INTERVAL,
    BOMB_GROW_TICKS,
    BOMB_LAUNCH_TICKS,
    BOMB_MIN_Y,
    BOMB_RADIUS_MAX,
    BOMB_RADIUS_MIN,
    BOMB_RISE,
)
from scorched_core.weapons.bomb_phase import BombPhase


@dataclass(slots=True)
class Bomb:
    """The bomb stock and the state of the bomb in flight.

    LAUNCH moves the missile in a straight line from the ship to a point ``BOMB_RISE`` units
    ahead of it over ``BOMB_LAUNCH_TICKS`` steps (``timer`` counts them). The last of those steps
    detonates: every gameplay enemy bullet is cleared and the phase becomes BLAST, which lasts
    ``BOMB_BLAST_TICKS`` steps (``age`` counts them). ``x`` and ``y`` are the missile while it
    rises and the blast centre afterwards.
    """

    stock: int
    phase: BombPhase = BombPhase.NONE
    timer: int = 0
    age: int = 0
    x: float = 0.0
    y: float = 0.0
    start_x: float = 0.0
    start_y: float = 0.0
    target_y: float = 0.0

    @property
    def radius(self) -> float:
        """The fireball radius: 0 outside BLAST, then growing from the minimum to the maximum."""
        if self.phase != BombPhase.BLAST:
            return 0.0
        grown = min(max(self.age - 1, 0), BOMB_GROW_TICKS - 1) / (BOMB_GROW_TICKS - 1)
        return BOMB_RADIUS_MIN + (BOMB_RADIUS_MAX - BOMB_RADIUS_MIN) * grown

    @property
    def progress(self) -> float:
        """How far through the current phase the bomb is, 0..1 (0 when there is no bomb)."""
        match self.phase:
            case BombPhase.LAUNCH:
                return self.timer / BOMB_LAUNCH_TICKS
            case BombPhase.BLAST:
                return self.age / BOMB_BLAST_TICKS
            case _:
                return 0.0

    def try_launch(self, x: float, y: float) -> bool:
        """Spend one bomb and send the missile up from ``(x, y)``; False when it cannot go.

        There must be stock and no other bomb in the air or burning.
        """
        if self.stock <= 0 or self.phase != BombPhase.NONE:
            return False
        self.stock -= 1
        self.phase = BombPhase.LAUNCH
        self.timer = 0
        self.start_x = self.x = x
        self.start_y = self.y = y
        self.target_y = min(y, max(y - BOMB_RISE, BOMB_MIN_Y))  # never travel downward
        return True

    def step(self, enemies: EnemyPool, bullets: BulletPool, events: EventRing) -> bool:
        """Advance one 60 Hz step; return True only on the step the missile detonates."""
        match self.phase:
            case BombPhase.NONE:
                return False
            case BombPhase.LAUNCH:
                return self._rise(bullets, events)
            case BombPhase.BLAST:
                self._burn(enemies, bullets, events)
                return False
            case unknown:
                msg = f"unknown bomb phase {unknown}"
                raise ValueError(msg)

    def _rise(self, bullets: BulletPool, events: EventRing) -> bool:
        self.timer += 1
        self.y = self.start_y + (self.target_y - self.start_y) * self.timer / BOMB_LAUNCH_TICKS
        if self.timer < BOMB_LAUNCH_TICKS:
            return False
        self.y = self.target_y
        self.phase = BombPhase.BLAST
        self.age = 0
        bullets.clear()  # D-09: every gameplay enemy bullet at once
        events.push(EV_BOMB_DETONATE, self.x, self.y)
        return True

    def _burn(self, enemies: EnemyPool, bullets: BulletPool, events: EventRing) -> None:
        self.age += 1
        clear_bullets_in_radius(bullets, self.x, self.y, self.radius)  # research assumption A7
        if (self.age - 1) % BOMB_DAMAGE_INTERVAL == 0:
            resolve_bomb_vs_enemies(enemies, self.x, self.y, self.radius, BOMB_DAMAGE, events)
        if self.age >= BOMB_BLAST_TICKS:
            self.phase = BombPhase.NONE
            self.age = 0
