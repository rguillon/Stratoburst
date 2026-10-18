"""Area damage passes: the laser beam's rectangle against every enemy circle."""

from scorched_core.events.event_ring import EventRing
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
