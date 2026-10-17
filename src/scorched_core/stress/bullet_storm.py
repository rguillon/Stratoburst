"""Stress storm: bouncing bullets that exist only to load the pipeline (no gameplay effect)."""

import math
import random
from dataclasses import dataclass

from scorched_core.collision.circle_hits import circles_touch
from scorched_core.pools.bullet_pool import BulletPool
from scorched_core.protocol import PLAYFIELD_H, PLAYFIELD_W
from scorched_core.tuning import STORM_RADIUS, STORM_SPEED_MAX, STORM_SPEED_MIN


@dataclass(slots=True)
class BulletStorm:
    """``count`` bullets bouncing inside the playfield, tested against one target circle."""

    pool: BulletPool
    count: int
    rng: random.Random

    def __post_init__(self) -> None:
        for _ in range(self.count):
            heading = self.rng.uniform(0.0, math.tau)
            speed = self.rng.uniform(STORM_SPEED_MIN, STORM_SPEED_MAX)
            self.pool.spawn(
                self.rng.uniform(STORM_RADIUS, PLAYFIELD_W - STORM_RADIUS),
                self.rng.uniform(STORM_RADIUS, PLAYFIELD_H - STORM_RADIUS),
                math.cos(heading) * speed,
                math.sin(heading) * speed,
            )

    def step(self, target_x: float, target_y: float, target_r: float) -> int:
        """Advance one 60 Hz step; return how many bullets touch the target circle."""
        pool = self.pool
        pool.integrate()
        x, y, vx, vy = pool.x, pool.y, pool.vx, pool.vy
        low_x, high_x = STORM_RADIUS, PLAYFIELD_W - STORM_RADIUS
        low_y, high_y = STORM_RADIUS, PLAYFIELD_H - STORM_RADIUS
        hits = 0
        for i in range(pool.n):
            if x[i] < low_x:
                x[i] = low_x
                vx[i] = abs(vx[i])
            elif x[i] > high_x:
                x[i] = high_x
                vx[i] = -abs(vx[i])
            if y[i] < low_y:
                y[i] = low_y
                vy[i] = abs(vy[i])
            elif y[i] > high_y:
                y[i] = high_y
                vy[i] = -abs(vy[i])
            if circles_touch(x[i], y[i], STORM_RADIUS, target_x, target_y, target_r):
                hits += 1
        return hits
