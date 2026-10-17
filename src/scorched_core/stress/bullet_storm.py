"""Stress storm (skeleton, replaced in the GREEN commit)."""

import random
from dataclasses import dataclass

from scorched_core.pools.bullet_pool import BulletPool


@dataclass(slots=True)
class BulletStorm:
    """Skeleton."""

    pool: BulletPool
    count: int
    rng: random.Random

    def step(self, target_x: float, target_y: float, target_r: float) -> int:  # noqa: ARG002
        """Skeleton."""
        return 0
