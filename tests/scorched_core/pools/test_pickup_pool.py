from array import array

import pytest

from scorched_core.entities.pickup_kind import PickupKind
from scorched_core.pools.pickup_pool import PickupPool
from scorched_core.protocol import PICKUP_CAP, PICKUP_STRIDE, PLAYFIELD_H, PLAYFIELD_W
from scorched_core.tuning import PICKUP_EXIT_SPEED, PICKUP_LIFE_TICKS, PICKUP_RADIUS


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


def test_spawn_guaranteed_adds_a_pickup_like_spawn_when_there_is_room_guaranteed() -> None:
    pool = PickupPool()
    pool.spawn_guaranteed(PickupKind.PURPLE, 30.0, 40.0, 0.0, -0.5)
    assert pool.n == 1
    assert (pool.x[0], pool.y[0], pool.vy[0]) == (30.0, 40.0, -0.5)
    assert (pool.kind[0], pool.age[0]) == (PickupKind.PURPLE, 0)


def test_spawn_guaranteed_evicts_the_oldest_pickup_when_the_pool_is_full_guaranteed() -> None:
    pool = PickupPool()
    for i in range(PICKUP_CAP):
        pool.spawn(PickupKind.CRYSTAL, float(i), 50.0, 0.0, 0.0)
        pool.age[i] = i + 1
    pool.age[5] = 999  # the oldest
    pool.spawn_guaranteed(PickupKind.BLUE, 7.5, 8.5, 0.0, -0.5)
    assert pool.n == PICKUP_CAP
    assert len(pool.x) == PICKUP_CAP
    assert 5.0 not in [pool.x[i] for i in range(pool.n)]
    assert pool.kind[pool.n - 1] == PickupKind.BLUE
    assert (pool.x[pool.n - 1], pool.y[pool.n - 1], pool.age[pool.n - 1]) == (7.5, 8.5, 0)


def test_spawn_guaranteed_evicts_the_lowest_slot_on_an_age_tie_guaranteed() -> None:
    pool = PickupPool()
    for i in range(PICKUP_CAP):
        pool.spawn(PickupKind.CRYSTAL, float(i), 50.0, 0.0, 0.0)
    pool.spawn_guaranteed(PickupKind.RED, 99.0, 99.0, 0.0, 0.0)
    assert 0.0 not in [pool.x[i] for i in range(pool.n)]
    assert 99.0 in [pool.x[i] for i in range(pool.n)]


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


def _age_crystal(pool: PickupPool, steps: int) -> list[int]:
    """Step a pool holding one still crystal and return its colour index before every step."""
    colors = []
    for _ in range(steps):
        colors.append(pool.color_at(0))
        pool.step()
    return colors


def test_a_crystal_cycles_red_blue_purple_every_ninety_steps_color_cycle() -> None:
    pool = PickupPool()
    pool.spawn(PickupKind.CRYSTAL, 120.0, 160.0, 0.0, 0.0)
    colors = _age_crystal(pool, 300)
    assert colors[0:90] == [0] * 90
    assert colors[90:180] == [1] * 90
    assert colors[180:270] == [2] * 90
    assert colors[270:300] == [0] * 30


def test_a_crystal_is_still_red_on_its_last_red_step_and_blue_on_the_next_color_cycle() -> None:
    pool = PickupPool()
    pool.spawn(PickupKind.CRYSTAL, 120.0, 160.0, 0.0, 0.0)
    pool.age[0] = 89
    assert pool.color_at(0) == 0
    pool.step()
    assert pool.color_at(0) == 1


def test_a_crystal_reflects_off_the_left_and_right_edges_bounce() -> None:
    pool = PickupPool()
    pool.spawn(PickupKind.CRYSTAL, PICKUP_RADIUS + 0.1, 160.0, -1.0, 0.0)
    pool.spawn(PickupKind.CRYSTAL, PLAYFIELD_W - PICKUP_RADIUS - 0.1, 160.0, 1.0, 0.0)
    pool.step()
    assert pool.vx[0] > 0.0
    assert pool.vx[1] < 0.0
    assert pool.x[0] >= PICKUP_RADIUS
    assert pool.x[1] <= PLAYFIELD_W - PICKUP_RADIUS


def test_a_crystal_reflects_off_the_top_and_bottom_edges_bounce() -> None:
    pool = PickupPool()
    pool.spawn(PickupKind.CRYSTAL, 120.0, PICKUP_RADIUS + 0.1, 0.0, -1.0)
    pool.spawn(PickupKind.CRYSTAL, 130.0, PLAYFIELD_H - PICKUP_RADIUS - 0.1, 0.0, 1.0)
    pool.step()
    assert pool.vy[0] > 0.0
    assert pool.vy[1] < 0.0
    assert pool.y[0] >= PICKUP_RADIUS
    assert pool.y[1] <= PLAYFIELD_H - PICKUP_RADIUS


def test_a_fixed_colour_pickup_bounces_too_and_never_cycles_bounce() -> None:
    pool = PickupPool()
    pool.spawn(PickupKind.BLUE, PICKUP_RADIUS + 0.1, 160.0, -1.0, 0.0)
    pool.step()
    assert pool.vx[0] > 0.0
    pool.age[0] = 4000
    assert pool.color_at(0) == int(PickupKind.BLUE)


def test_a_crystal_stays_on_screen_while_bouncing_for_its_whole_life_bounce() -> None:
    pool = PickupPool()
    pool.spawn_crystal(PICKUP_RADIUS, PICKUP_RADIUS)
    for _ in range(PICKUP_LIFE_TICKS):
        pool.step()
        assert PICKUP_RADIUS <= pool.x[0] <= PLAYFIELD_W - PICKUP_RADIUS
        assert PICKUP_RADIUS <= pool.y[0] <= PLAYFIELD_H - PICKUP_RADIUS
    assert pool.n == 1


def test_after_its_life_a_crystal_drifts_straight_down_and_stops_bouncing() -> None:
    pool = PickupPool()
    pool.spawn(PickupKind.CRYSTAL, 120.0, 100.0, 0.7, -0.5)
    pool.age[0] = PICKUP_LIFE_TICKS
    pool.step()
    assert pool.x[0] == pytest.approx(120.0)
    assert pool.y[0] == pytest.approx(100.0 + PICKUP_EXIT_SPEED)


def test_a_drifting_crystal_does_not_reflect_off_the_bottom_edge() -> None:
    pool = PickupPool()
    pool.spawn(PickupKind.CRYSTAL, 120.0, PLAYFIELD_H, 0.0, 0.0)
    pool.age[0] = PICKUP_LIFE_TICKS
    pool.step()
    assert pool.y[0] == pytest.approx(PLAYFIELD_H + PICKUP_EXIT_SPEED)


def test_a_crystal_is_removed_once_it_has_drifted_below_the_playfield_margin() -> None:
    pool = PickupPool()
    pool.spawn(PickupKind.CRYSTAL, 120.0, PLAYFIELD_H + 15.0, 0.0, 0.0)
    pool.age[0] = PICKUP_LIFE_TICKS
    pool.step()  # 15.8: still inside the 16-unit margin
    assert pool.n == 1
    pool.step()  # 16.6: gone
    assert pool.n == 0


def test_a_crystal_left_alone_leaves_the_pool_after_its_life_and_the_drift() -> None:
    pool = PickupPool()
    pool.spawn_crystal(120.0, 160.0)
    steps = 0
    while pool.n and steps < 5000:
        pool.step()
        steps += 1
    assert pool.n == 0
    assert PICKUP_LIFE_TICKS < steps < 5000


def test_removing_a_drifted_pickup_mid_step_keeps_the_others_stepping() -> None:
    pool = PickupPool()
    pool.spawn(PickupKind.CRYSTAL, 50.0, PLAYFIELD_H + 20.0, 0.0, 0.0)  # gone on the next step
    pool.age[0] = PICKUP_LIFE_TICKS
    pool.spawn(PickupKind.RED, 100.0, 100.0, 0.5, 0.0)
    pool.step()
    assert pool.n == 1
    assert (pool.kind[0], pool.x[0]) == (PickupKind.RED, 100.5)
