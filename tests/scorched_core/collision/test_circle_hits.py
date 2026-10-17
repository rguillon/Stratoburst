import math
import random
from array import array

from scorched_core.collision.circle_hits import circles_touch, resolve_shots_vs_drones
from scorched_core.collision.uniform_grid import UniformGrid
from scorched_core.entities.drone_swarm import DroneSwarm
from scorched_core.pools.bullet_pool import BulletPool
from scorched_core.protocol import DRONE_CAP
from scorched_core.tuning import (
    DRONE_FLASH_TICKS,
    DRONE_HP,
    DRONE_RADIUS,
    GRID_CELL,
    PBULLET_RADIUS,
)


def test_overlapping_circles_touch() -> None:
    assert circles_touch(0.0, 0.0, 2.5, 3.0, 0.0, 2.0)


def test_distant_circles_do_not_touch() -> None:
    assert not circles_touch(0.0, 0.0, 2.5, 50.0, 40.0, 2.0)


def test_touch_is_inclusive_at_exactly_the_radius_sum() -> None:
    assert circles_touch(0.0, 0.0, 2.5, 4.5, 0.0, 2.0)


def test_touch_fails_one_float_step_past_the_radius_sum() -> None:
    just_outside = math.nextafter(4.5, math.inf)
    assert not circles_touch(0.0, 0.0, 2.5, just_outside, 0.0, 2.0)


def test_touch_is_symmetric_on_the_diagonal() -> None:
    assert circles_touch(0.0, 0.0, 3.0, 3.0, 4.0, 2.0)
    assert circles_touch(3.0, 4.0, 2.0, 0.0, 0.0, 3.0)


# --- player bolts versus drones -----------------------------------------------------------


def _world(
    drones: list[tuple[float, float]],
    bolts: list[tuple[float, float]],
    hp: int = 3,
) -> tuple[BulletPool, DroneSwarm, UniformGrid, array]:
    swarm = DroneSwarm(random.Random(1))  # noqa: S311
    for i, (x, y) in enumerate(drones):
        swarm.x[i], swarm.y[i], swarm.hp[i] = x, y, hp
    swarm.n = len(drones)
    pool = BulletPool(128)
    for x, y in bolts:
        pool.spawn(x, y, 0.0, -8.0)
    grid = UniformGrid(240.0, 320.0, GRID_CELL, DRONE_CAP)
    return pool, swarm, grid, array("i", bytes(4 * DRONE_CAP))


def test_a_bolt_on_a_drone_hits_it_and_is_consumed() -> None:
    pool, swarm, grid, scratch = _world([(100.0, 100.0)], [(100.0, 104.0)])
    assert resolve_shots_vs_drones(pool, swarm, grid, scratch) == 1
    assert pool.n == 0
    assert swarm.hp[0] == DRONE_HP - 1
    assert swarm.flash[0] == DRONE_FLASH_TICKS


def test_a_bolt_touching_nothing_survives() -> None:
    pool, swarm, grid, scratch = _world([(100.0, 100.0)], [(100.0, 140.0)])
    assert resolve_shots_vs_drones(pool, swarm, grid, scratch) == 0
    assert pool.n == 1
    assert swarm.hp[0] == DRONE_HP


def test_touching_at_exactly_the_radius_sum_counts_as_a_hit() -> None:
    reach = DRONE_RADIUS + PBULLET_RADIUS
    pool, swarm, grid, scratch = _world([(100.0, 100.0)], [(100.0 + reach, 100.0)])
    assert resolve_shots_vs_drones(pool, swarm, grid, scratch) == 1


def test_a_bolt_just_past_the_radius_sum_misses() -> None:
    reach = DRONE_RADIUS + PBULLET_RADIUS
    pool, swarm, grid, scratch = _world([(100.0, 100.0)], [(100.0 + reach + 0.5, 100.0)])
    assert resolve_shots_vs_drones(pool, swarm, grid, scratch) == 0


def test_a_bolt_over_two_drones_hits_only_the_first_in_query_order() -> None:
    drones = [(60.0, 60.0), (100.0, 100.0), (100.0, 100.0), (60.0, 60.0), (60.0, 60.0)]
    drones.append((100.0, 100.0))  # index 5
    pool, swarm, grid, scratch = _world(drones, [(100.0, 100.0)])
    assert resolve_shots_vs_drones(pool, swarm, grid, scratch) == 1
    assert pool.n == 0
    assert [swarm.hp[i] for i in (1, 2, 5)] == [DRONE_HP - 1, DRONE_HP, DRONE_HP]


def test_first_in_query_order_follows_cell_rows_before_drone_index() -> None:
    # Drone 0 sits in the cell row below the bolt, drone 1 in the row above: the row above
    # is visited first, so drone 1 is hit even though drone 0 has the lower index.
    pool, swarm, grid, scratch = _world([(100.0, 70.0), (100.0, 60.0)], [(100.0, 66.0)])
    assert resolve_shots_vs_drones(pool, swarm, grid, scratch) == 1
    assert (swarm.hp[0], swarm.hp[1]) == (DRONE_HP, DRONE_HP - 1)


def test_a_drone_killed_earlier_in_the_pass_absorbs_no_further_bolt() -> None:
    pool, swarm, grid, scratch = _world([(100.0, 100.0)], [(100.0, 100.0), (101.0, 100.0)], hp=1)
    assert resolve_shots_vs_drones(pool, swarm, grid, scratch) == 1
    assert pool.n == 1  # exactly one bolt was consumed; the other flew on
    assert swarm.n == 0
    assert swarm.destroyed == 1


def test_a_second_bolt_moves_on_to_the_next_drone_when_the_first_is_dead() -> None:
    pool, swarm, grid, scratch = _world(
        [(100.0, 100.0), (104.0, 100.0)], [(100.0, 100.0), (102.0, 100.0)], hp=1
    )
    assert resolve_shots_vs_drones(pool, swarm, grid, scratch) == 2
    assert pool.n == 0
    assert swarm.n == 0
    assert swarm.destroyed == 2


def test_a_bolt_in_a_far_cell_never_reaches_a_drone_outside_its_block() -> None:
    pool, swarm, grid, scratch = _world([(20.0, 20.0)], [(200.0, 300.0)])
    assert resolve_shots_vs_drones(pool, swarm, grid, scratch) == 0
    assert pool.n == 1


def test_no_drones_or_no_bolts_resolve_to_zero() -> None:
    pool, swarm, grid, scratch = _world([], [(100.0, 100.0)])
    assert resolve_shots_vs_drones(pool, swarm, grid, scratch) == 0
    assert pool.n == 1
    pool, swarm, grid, scratch = _world([(100.0, 100.0)], [])
    assert resolve_shots_vs_drones(pool, swarm, grid, scratch) == 0


def test_surviving_bolts_keep_their_velocity_after_swap_removals() -> None:
    pool, swarm, grid, scratch = _world([(100.0, 100.0)], [(100.0, 100.0), (10.0, 10.0)])
    resolve_shots_vs_drones(pool, swarm, grid, scratch)
    assert pool.n == 1
    assert (pool.x[0], pool.y[0], pool.vy[0]) == (10.0, 10.0, -8.0)
