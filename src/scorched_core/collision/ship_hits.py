"""Hits against the ship's body: pickups now, enemy bullets and bodies in plan 02-15."""

from collections.abc import Callable

from scorched_core.collision.circle_hits import circles_touch
from scorched_core.pools.pickup_pool import PickupPool
from scorched_core.tuning import PICKUP_GRAB_RADIUS, PICKUP_RADIUS

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
