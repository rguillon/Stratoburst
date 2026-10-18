"""Hits against the ship: pickups on its body, enemy bullets and bodies on its hitbox core."""

from collections.abc import Callable

from scorched_core.collision.circle_hits import circles_touch
from scorched_core.pools.bullet_pool import BulletPool
from scorched_core.pools.enemy_pool import EnemyPool
from scorched_core.pools.pickup_pool import PickupPool
from scorched_core.tuning import (
    ENEMY_BULLET_RADIUS,
    ENEMY_GROUND,
    PICKUP_GRAB_RADIUS,
    PICKUP_RADIUS,
)

type PickupCollector = Callable[[int, int, float, float], None]


def resolve_pickups_vs_ship(
    pickups: PickupPool, x: float, y: float, collect: PickupCollector
) -> int:
    """Collect every pickup that touches the ship's grab circle; return how many were caught.

    The grab circle is ``PICKUP_GRAB_RADIUS`` around the ship centre (the body, not the
    2-unit hitbox core) and edge contact counts. Each caught pickup is passed to
    ``collect(kind, colour, x, y)`` with the colour it has at this instant, then removed, so it
    is collected exactly once. Slots are visited from the highest down so the swap-remove only
    ever moves a pickup that was already visited.
    """
    caught = 0
    for i in range(pickups.n - 1, -1, -1):
        px, py = pickups.x[i], pickups.y[i]
        if circles_touch(px, py, PICKUP_RADIUS, x, y, PICKUP_GRAB_RADIUS):
            collect(pickups.kind[i], pickups.color_at(i), px, py)
            pickups.remove_at(i)
            caught += 1
    return caught


def resolve_bullets_vs_ship(bullets: BulletPool, x: float, y: float, radius: float) -> bool:
    """Remove the first enemy bullet touching the hitbox core at ``(x, y)``; True when one did.

    ``radius`` is the core radius and the bullet circle is ``ENEMY_BULLET_RADIUS``; edge contact
    counts. Only one bullet is consumed per call because one hit is all the ship can take.
    """
    bx, by = bullets.x, bullets.y
    for i in range(bullets.n):
        if circles_touch(bx[i], by[i], ENEMY_BULLET_RADIUS, x, y, radius):
            bullets.remove_at(i)
            return True
    return False


def resolve_bodies_vs_ship(enemies: EnemyPool, x: float, y: float, radius: float) -> bool:
    """Return whether a live air enemy's body touches the hitbox core at ``(x, y)``.

    Ground units never count (they are terrain, not rammers) and neither does a dead enemy that
    is still waiting to be removed from the pool.
    """
    ex, ey, er, kind, hp = enemies.x, enemies.y, enemies.radius, enemies.kind, enemies.hp
    for i in range(enemies.n):
        if (
            hp[i] > 0
            and not ENEMY_GROUND[kind[i]]
            and circles_touch(ex[i], ey[i], er[i], x, y, radius)
        ):
            return True
    return False
