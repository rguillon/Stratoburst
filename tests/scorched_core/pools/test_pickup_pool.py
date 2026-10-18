from array import array

import pytest

from scorched_core.entities.pickup_kind import PickupKind
from scorched_core.pools.pickup_pool import PickupPool
from scorched_core.protocol import PICKUP_CAP, PICKUP_STRIDE


def test_a_new_pool_is_empty_and_preallocated_to_the_cap() -> None:
    pool = PickupPool()
    assert pool.n == 0
    assert all(len(col) == PICKUP_CAP for col in (pool.x, pool.y, pool.vx, pool.vy))
    assert all(len(col) == PICKUP_CAP for col in (pool.kind, pool.age))


def test_spawn_stores_every_column_and_starts_at_age_zero() -> None:
    pool = PickupPool()
    assert pool.spawn(PickupKind.BLUE, 30.0, 40.0, 0.25, -0.5)
    assert pool.n == 1
    assert (pool.x[0], pool.y[0], pool.vx[0], pool.vy[0]) == (30.0, 40.0, 0.25, -0.5)
    assert (pool.kind[0], pool.age[0]) == (PickupKind.BLUE, 0)


def test_a_crystal_is_launched_up_and_sideways_alternating_the_side_on_each_call() -> None:
    pool = PickupPool()
    pool.spawn_crystal(100.0, 90.0)
    pool.spawn_crystal(100.0, 90.0)
    pool.spawn_crystal(100.0, 90.0)
    assert [pool.kind[i] for i in range(3)] == [PickupKind.CRYSTAL] * 3
    assert [pool.vx[i] for i in range(3)] == [
        pytest.approx(0.64),
        pytest.approx(-0.64),
        pytest.approx(0.64),
    ]
    assert all(pool.vy[i] == pytest.approx(-0.48) for i in range(3))


def test_spawns_beyond_the_cap_are_refused_and_the_pool_never_grows() -> None:
    pool = PickupPool()
    assert all(pool.spawn_crystal(50.0, 50.0) for _ in range(PICKUP_CAP))
    assert not pool.spawn_crystal(50.0, 50.0)
    assert not pool.spawn(PickupKind.RED, 1.0, 1.0, 0.0, 0.0)
    assert pool.n == PICKUP_CAP
    assert len(pool.x) == PICKUP_CAP


def test_step_moves_every_pickup_by_its_velocity_and_ages_it() -> None:
    pool = PickupPool()
    pool.spawn(PickupKind.RED, 100.0, 100.0, 0.5, -0.25)
    pool.spawn(PickupKind.BLUE, 20.0, 30.0, -1.0, 0.0)
    pool.step()
    assert (pool.x[0], pool.y[0], pool.age[0]) == (100.5, 99.75, 1)
    assert (pool.x[1], pool.y[1], pool.age[1]) == (19.0, 30.0, 1)


def test_a_fixed_colour_pickup_reports_its_kind_as_its_colour_whatever_its_age() -> None:
    pool = PickupPool()
    pool.spawn(PickupKind.PURPLE, 100.0, 100.0, 0.0, 0.0)
    pool.age[0] = 5000
    assert pool.color_at(0) == int(PickupKind.PURPLE)


def test_remove_at_swaps_the_last_pickup_into_the_freed_slot() -> None:
    pool = PickupPool()
    pool.spawn(PickupKind.RED, 1.0, 2.0, 0.1, 0.2)
    pool.spawn(PickupKind.BLUE, 3.0, 4.0, 0.3, 0.4)
    pool.spawn(PickupKind.PURPLE, 5.0, 6.0, 0.5, 0.6)
    pool.age[2] = 7
    pool.remove_at(0)
    assert pool.n == 2
    assert (pool.x[0], pool.y[0], pool.kind[0], pool.age[0]) == (5.0, 6.0, PickupKind.PURPLE, 7)
    assert (pool.vx[0], pool.vy[0]) == (pytest.approx(0.5), pytest.approx(0.6))
    assert pool.kind[1] == PickupKind.BLUE


def test_remove_at_the_last_slot_just_shrinks_the_pool() -> None:
    pool = PickupPool()
    pool.spawn(PickupKind.RED, 1.0, 2.0, 0.0, 0.0)
    pool.spawn(PickupKind.BLUE, 3.0, 4.0, 0.0, 0.0)
    pool.remove_at(1)
    assert pool.n == 1
    assert pool.kind[0] == PickupKind.RED


def test_pack_into_writes_x_y_colour_and_kind_and_leaves_the_tail_alone() -> None:
    pool = PickupPool()
    pool.spawn_crystal(10.0, 20.0)
    pool.spawn(PickupKind.PURPLE, 30.0, 40.0, 0.0, 0.0)
    out = array("f", [9.0] * (PICKUP_STRIDE * PICKUP_CAP))
    pool.pack_into(out)
    assert list(out[:PICKUP_STRIDE]) == [10.0, 20.0, 0.0, float(PickupKind.CRYSTAL)]
    assert list(out[PICKUP_STRIDE : 2 * PICKUP_STRIDE]) == [
        30.0,
        40.0,
        float(PickupKind.PURPLE),
        float(PickupKind.PURPLE),
    ]
    assert all(v == 9.0 for v in out[2 * PICKUP_STRIDE :])
