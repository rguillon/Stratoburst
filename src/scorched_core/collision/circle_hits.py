"""Circle overlap tests and the player-shot versus enemy pass."""

from array import array

from scorched_core.collision.uniform_grid import UniformGrid
from scorched_core.events.event_ring import EventRing
from scorched_core.pools.bullet_pool import BulletPool
from scorched_core.pools.enemy_pool import EnemyPool
from scorched_core.tuning import PBULLET_RADIUS


def circles_touch(ax: float, ay: float, ar: float, bx: float, by: float, br: float) -> bool:  # noqa: PLR0913, PLR0917 - two circles are six numbers
    """Return whether circle ``a`` and circle ``b`` overlap; touching counts as overlap."""
    dx = ax - bx
    dy = ay - by
    return dx * dx + dy * dy <= (ar + br) ** 2


def resolve_shots_vs_enemies(  # noqa: PLR0913, PLR0917 - one pass needs both pools, the grid and the hit
    bullets: BulletPool,
    enemies: EnemyPool,
    grid: UniformGrid,
    scratch: array,
    damage: int,
    events: EventRing,
) -> int:
    """Hit enemies with player bolts through the grid broadphase; return the hits landed.

    The caller rebuilds ``grid`` from the enemy positions once per step before any damage pass.
    A bolt hits at most one enemy: the first live one, in grid query order, that it touches,
    and is consumed. Bolts are visited from the highest slot down so the swap-remove of a
    consumed bolt only ever moves one that was already visited. Dead enemies stay in the pool
    (absorbing no further bolts) until the caller runs ``EnemyPool.remove_dead``.
    """
    bx, by, hp, ex, ey, radius = (
        bullets.x,
        bullets.y,
        enemies.hp,
        enemies.x,
        enemies.y,
        enemies.radius,
    )
    hits = 0
    for i in range(bullets.n - 1, -1, -1):
        px, py = bx[i], by[i]
        for k in range(grid.query(px, py, scratch)):
            j = scratch[k]
            if hp[j] > 0 and circles_touch(px, py, PBULLET_RADIUS, ex[j], ey[j], radius[j]):
                enemies.apply_hit(j, damage, events)
                bullets.remove_at(i)
                hits += 1
                break
    return hits
