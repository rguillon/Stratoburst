"""Bullet pattern helpers: volleys written straight into a ``BulletPool``.

These are the seed of the Phase 3 data-driven bullet patterns. Each helper spawns what fits and
returns how many bullets it spawned, so callers never need to know the pool's fill level.
"""

import math

from scorched_core.pools.bullet_pool import BulletPool


def fire_aimed(  # noqa: PLR0913, PLR0917 - a shot is a pool, a muzzle, a target and a speed
    pool: BulletPool, x: float, y: float, target_x: float, target_y: float, speed: float
) -> int:
    """Spawn one bullet from ``(x, y)`` flying at ``speed`` units per step towards the target.

    A target on the muzzle has no direction, so the bullet flies straight down the screen.
    Returns 1, or 0 when the pool is full.
    """
    dx = target_x - x
    dy = target_y - y
    distance = math.hypot(dx, dy)
    if distance == 0.0:
        return int(pool.spawn(x, y, 0.0, speed))
    scale = speed / distance
    return int(pool.spawn(x, y, dx * scale, dy * scale))


def fire_ring(  # noqa: PLR0913, PLR0917 - a ring is a pool, a centre, a count, a speed and a phase
    pool: BulletPool, x: float, y: float, count: int, speed: float, phase: float
) -> int:
    """Spawn ``count`` bullets from ``(x, y)`` evenly spaced in angle, the first at ``phase``.

    Angles follow the bullet-pool convention: 0 flies straight up the screen and positive angles
    turn clockwise (to the right). Returns how many bullets fit; a full pool spawns none.
    """
    step = math.tau / count
    spawned = 0
    for k in range(count):
        angle = phase + k * step
        if not pool.spawn(x, y, speed * math.sin(angle), -speed * math.cos(angle)):
            break
        spawned += 1
    return spawned
