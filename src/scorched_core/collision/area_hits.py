"""Area passes: the laser beam and the bomb blast against enemies, the blast against bullets."""

from scorched_core.events.event_ring import EventRing
from scorched_core.pools.bullet_pool import BulletPool
from scorched_core.pools.enemy_pool import EnemyPool


def resolve_beam_vs_enemies(  # noqa: PLR0913, PLR0917 - a beam is a column, two ends, a damage and a sink
    enemies: EnemyPool,
    x: float,
    half_w: float,
    top_y: float,
    bottom_y: float,
    damage: int,
    events: EventRing,
) -> int:
    """Hit every live enemy a vertical beam overlaps; return how many were hit.

    The beam is the rectangle ``x +- half_w`` wide from ``top_y`` down to ``bottom_y`` (screen y
    grows downward). An enemy is hit when its circle overlaps the rectangle, edge contact
    included, and the beam pierces: it never stops at the first one. There is no grid: the pool
    holds at most ``ENEMY_MAX_ALIVE`` enemies, so one linear scan is cheaper than a broadphase.
    ``apply_hit`` merges the HIT events by flash state, so a held beam sparks once per flash.
    """
    hp, ex, ey, radius = enemies.hp, enemies.x, enemies.y, enemies.radius
    hits = 0
    for i in range(enemies.n):
        if hp[i] <= 0:
            continue
        dx = max(abs(ex[i] - x) - half_w, 0.0)
        dy = max(top_y - ey[i], 0.0, ey[i] - bottom_y)
        if dx * dx + dy * dy <= radius[i] * radius[i]:
            enemies.apply_hit(i, damage, events)
            hits += 1
    return hits


def resolve_bomb_vs_enemies(  # noqa: PLR0913, PLR0917 - a blast is a centre, a radius, a damage and a sink
    enemies: EnemyPool,
    x: float,
    y: float,
    radius: float,
    damage: int,
    events: EventRing,
) -> int:
    """Hit every live enemy whose circle touches the blast circle; return how many were hit.

    Air and ground units alike burn. Edge contact counts. As with the beam there is no grid: one
    linear scan over the pool is cheaper than a broadphase for so few enemies.
    """
    hp, ex, ey, er = enemies.hp, enemies.x, enemies.y, enemies.radius
    hits = 0
    for i in range(enemies.n):
        if hp[i] <= 0:
            continue
        dx = ex[i] - x
        dy = ey[i] - y
        reach = radius + er[i]
        if dx * dx + dy * dy <= reach * reach:
            enemies.apply_hit(i, damage, events)
            hits += 1
    return hits


def clear_bullets_in_radius(bullets: BulletPool, x: float, y: float, radius: float) -> int:
    """Remove every bullet whose centre is inside the circle (edge inclusive); return the count."""
    bx, by = bullets.x, bullets.y
    limit = radius * radius
    cleared = 0
    for i in range(bullets.n - 1, -1, -1):
        dx = bx[i] - x
        dy = by[i] - y
        if dx * dx + dy * dy <= limit:
            bullets.remove_at(i)
            cleared += 1
    return cleared
