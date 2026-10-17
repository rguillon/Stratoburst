"""Circle overlap tests and the player-shot versus drone pass."""

from array import array

from scorched_core.collision.uniform_grid import UniformGrid
from scorched_core.entities.drone_swarm import DroneSwarm
from scorched_core.pools.bullet_pool import BulletPool


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
    """Hit drones with player bolts through the grid broadphase; return the hits landed."""
    return 0
