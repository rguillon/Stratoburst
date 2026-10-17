"""Circle overlap tests and the player-shot versus drone pass."""

from array import array

from scorched_core.collision.uniform_grid import UniformGrid
from scorched_core.entities.drone_swarm import DroneSwarm
from scorched_core.pools.bullet_pool import BulletPool
from scorched_core.tuning import DRONE_RADIUS, PBULLET_RADIUS


def circles_touch(ax: float, ay: float, ar: float, bx: float, by: float, br: float) -> bool:  # noqa: PLR0913, PLR0917 - two circles are six numbers
    """Return whether circle ``a`` and circle ``b`` overlap; touching counts as overlap."""
    dx = ax - bx
    dy = ay - by
    return dx * dx + dy * dy <= (ar + br) ** 2


def resolve_shots_vs_drones(
    bullets: BulletPool,
    swarm: DroneSwarm,
    grid: UniformGrid,
    scratch: array,
) -> int:
    """Hit drones with player bolts through the grid broadphase; return the hits landed.

    A bolt hits at most one drone: the first live one, in grid query order, that it touches,
    and is consumed. Bolts are visited from the highest slot down so the swap-remove of a
    consumed bolt only ever moves one that was already visited.
    """
    grid.rebuild(swarm.x, swarm.y, swarm.n)
    bx, by, hp, dx, dy = bullets.x, bullets.y, swarm.hp, swarm.x, swarm.y
    hits = 0
    for i in range(bullets.n - 1, -1, -1):
        px, py = bx[i], by[i]
        for k in range(grid.query(px, py, scratch)):
            j = scratch[k]
            if hp[j] > 0 and circles_touch(px, py, PBULLET_RADIUS, dx[j], dy[j], DRONE_RADIUS):
                swarm.apply_hit(j)
                bullets.remove_at(i)
                hits += 1
                break
    swarm.remove_dead()
    return hits
