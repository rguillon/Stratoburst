"""Laser: the blue weapon, a hitscan beam locked to the ship that pierces its column (D-02)."""

from dataclasses import dataclass

from scorched_core.collision.area_hits import resolve_beam_vs_enemies
from scorched_core.events.event_ring import EventRing
from scorched_core.pools.enemy_pool import EnemyPool
from scorched_core.tuning import (
    LASER_DAMAGE,
    LASER_HALF_WIDTH,
    LASER_HIT_INTERVAL,
    MUZZLE_AHEAD,
)


@dataclass(slots=True)
class LaserBeam:
    """A beam of ``half_width`` units (0 when off) that damages everything it touches.

    The beam is not made of bullets: while fire is held it is simply there, from the nose to the top
    of the playfield, and deals ``LASER_DAMAGE[level - 1]`` to every enemy it overlaps on its first
    step and then every ``LASER_HIT_INTERVAL`` steps.
    """

    half_width: float = 0.0
    timer: int = 0

    def step(  # noqa: PLR0913, PLR0917 - the ship pose, level, the enemies and the sink are all needed
        self,
        firing: bool,
        x: float,
        y: float,
        level: int,
        enemies: EnemyPool,
        events: EventRing,
    ) -> int:
        """Advance one step; return how many enemies the beam hit.

        Releasing fire switches the beam off at once and resets the cadence, so pressing again
        always deals damage on the first firing step.
        """
        if not firing:
            self.half_width = 0.0
            self.timer = 0
            return 0
        self.half_width = LASER_HALF_WIDTH[level - 1]
        hits = 0
        if self.timer == 0:
            hits = resolve_beam_vs_enemies(
                enemies, x, self.half_width, 0.0, y - MUZZLE_AHEAD, LASER_DAMAGE[level - 1], events
            )
            self.timer = LASER_HIT_INTERVAL
        self.timer -= 1
        return hits
